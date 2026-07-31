import { createReadStream, promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompress } from 'node:zlib';
import {
  createVersionedLruPromiseCache,
  mapWithConcurrency,
  parsePositiveInteger,
} from './local-archive-server-helpers.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultArchivesRoot = path.resolve(
  scriptDirectory,
  '..',
  '..',
  'StaticFiles',
  'Data',
  'Archives',
);

const archivesRoot = path.resolve(
  process.env.BONZOBYTE_ARCHIVES_ROOT || defaultArchivesRoot,
);
const port = Number(process.env.BONZOBYTE_ARCHIVE_PORT || 5001);
const host = process.env.BONZOBYTE_ARCHIVE_HOST || '127.0.0.1';
const detailEnrichmentConcurrency = parsePositiveInteger(
  process.env.BONZOBYTE_ARCHIVE_DETAIL_CONCURRENCY,
  8,
);
const dailyJsonCacheSize = parsePositiveInteger(
  process.env.BONZOBYTE_ARCHIVE_DAILY_CACHE_SIZE,
  6,
);

const dailyRoot = path.join(archivesRoot, 'daily');
const detailsRoot = path.join(archivesRoot, 'matches');
const apiPrefix = '/api/archives';
const compactDatePattern = /^\d{8}$/;
const numericIdPattern = /^\d+$/;
const archiveNamePattern = /^[A-Za-z0-9._-]+\.br$/;
const simulationArchiveNamePattern =
  /^prediction-simulation\.v1\.[0-9a-f]{16}\.json\.br$/i;

let dailyIndexCache;
const dailyJsonCache = createVersionedLruPromiseCache(dailyJsonCacheSize);

function sendJson(response, statusCode, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(body);
}

function sendEmpty(response, statusCode, contentType = 'application/octet-stream') {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
  });
  response.end();
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function toIsoDate(compactDate) {
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

async function getDailyIndex() {
  const directory = await fs.stat(dailyRoot);

  if (dailyIndexCache?.directoryMtimeMs === directory.mtimeMs) {
    return dailyIndexCache;
  }

  const entries = await fs.readdir(dailyRoot, { withFileTypes: true });
  const compactDates = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.br'))
    .map(entry => entry.name.slice(0, -3))
    .filter(value => compactDatePattern.test(value))
    .sort();

  if (compactDates.length === 0) {
    throw new Error(`No daily Brotli archives found in ${dailyRoot}`);
  }

  dailyIndexCache = {
    compactDates,
    dateSet: new Set(compactDates),
    directoryMtimeMs: directory.mtimeMs,
    isoDates: compactDates.map(toIsoDate),
  };

  return dailyIndexCache;
}

function brotliDecompressAsync(buffer) {
  return new Promise((resolve, reject) => {
    brotliDecompress(buffer, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

function median(values) {
  const sorted = values
    .filter(value => Number.isFinite(value) && value > 1)
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return null;
  }

  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];

  return Math.round(value * 100) / 100;
}

function getMoneylineMedians(details, player1Id, player2Id) {
  const offersByPlayer = new Map([
    [player1Id, new Map()],
    [player2Id, new Map()],
  ]);

  for (const group of Array.isArray(details?.o) ? details.o : []) {
    if (Number(group?.i) !== 1) {
      continue;
    }

    for (const market of Array.isArray(group?.m) ? group.m : []) {
      for (const selection of Array.isArray(market?.x) ? market.x : []) {
        const playerId = Number(selection?.p);
        const bookieOffers = offersByPlayer.get(playerId);

        if (!bookieOffers) {
          continue;
        }

        for (const offer of Array.isArray(selection?.o) ? selection.o : []) {
          const bookieId = Number(offer?.b);
          const odds = Number(offer?.q);
          const seriesOrdinal = Number(offer?.r ?? 0);

          if (!Number.isFinite(bookieId) || !Number.isFinite(odds) || odds <= 1) {
            continue;
          }

          const existing = bookieOffers.get(bookieId);
          if (!existing || seriesOrdinal >= existing.seriesOrdinal) {
            bookieOffers.set(bookieId, { odds, seriesOrdinal });
          }
        }
      }
    }
  }

  const player1Median = median(
    [...offersByPlayer.get(player1Id).values()].map(value => value.odds),
  );
  const player2Median = median(
    [...offersByPlayer.get(player2Id).values()].map(value => value.odds),
  );

  return player1Median != null && player2Median != null
    ? { player1Median, player2Median }
    : null;
}

async function enrichDailyOdds(rows) {
  return mapWithConcurrency(rows, detailEnrichmentConcurrency, async row => {
    const currentPlayer1Odds = Number(row?.l29);
    const currentPlayer2Odds = Number(row?.l30);

    if (currentPlayer1Odds > 1 && currentPlayer2Odds > 1) {
      return row;
    }

    const matchId = Number(row?.l01);
    const player1Id = Number(row?.l13);
    const player2Id = Number(row?.l20);

    if (
      !Number.isInteger(matchId) ||
      !Number.isInteger(player1Id) ||
      !Number.isInteger(player2Id)
    ) {
      return row;
    }

    try {
      const compressed = await fs.readFile(path.join(detailsRoot, `${matchId}.br`));
      const detailsJson = await brotliDecompressAsync(compressed);
      const details = JSON.parse(detailsJson.toString('utf8'));
      const medians = getMoneylineMedians(details, player1Id, player2Id);

      if (!medians) {
        return row;
      }

      return {
        ...row,
        l29: medians.player1Median,
        l30: medians.player2Median,
      };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return row;
      }

      console.warn(`[local-archives] Odds enrichment skipped for match ${matchId}:`, error);
      return row;
    }
  });
}

async function getDetailsDirectoryVersion() {
  try {
    const stat = await fs.stat(detailsRoot);
    return stat.isDirectory()
      ? `${stat.mtimeMs}:${stat.ctimeMs}`
      : 'not-a-directory';
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return 'missing';
    }

    throw error;
  }
}

async function getDailyArchiveIdentity(compactDate) {
  const dailyPath = path.join(dailyRoot, `${compactDate}.br`);
  const [dailyStat, detailsDirectoryVersion] = await Promise.all([
    fs.stat(dailyPath),
    getDetailsDirectoryVersion(),
  ]);

  return {
    dailyPath,
    version: [
      dailyStat.size,
      dailyStat.mtimeMs,
      dailyStat.ctimeMs,
      detailsDirectoryVersion,
    ].join(':'),
  };
}

async function buildDailyJsonBody(dailyPath) {
  const compressed = await fs.readFile(dailyPath);
  const decompressed = await brotliDecompressAsync(compressed);
  const rows = JSON.parse(decompressed.toString('utf8'));
  const enrichedRows = Array.isArray(rows) ? await enrichDailyOdds(rows) : rows;
  return Buffer.from(JSON.stringify(enrichedRows));
}

async function getDailyJsonBody(compactDate) {
  const { dailyPath, version } = await getDailyArchiveIdentity(compactDate);
  return dailyJsonCache.get(
    compactDate,
    version,
    () => buildDailyJsonBody(dailyPath),
  );
}

async function sendFile(request, response, filePath, contentType = 'application/octet-stream') {
  let stat;

  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendError(response, 404, 'Local archive not found.');
      return;
    }

    throw error;
  }

  if (!stat.isFile()) {
    sendError(response, 404, 'Local archive not found.');
    return;
  }

  if (request.method === 'HEAD') {
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': stat.size,
      'Content-Type': contentType,
    });
    response.end();
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': stat.size,
    'Content-Type': contentType,
  });
  createReadStream(filePath).pipe(response);
}

async function sendDailyJson(request, response, compactDate) {
  if (!compactDatePattern.test(compactDate)) {
    sendError(response, 400, 'Daily archive date must use YYYYMMDD.');
    return;
  }

  const index = await getDailyIndex();
  if (!index.dateSet.has(compactDate)) {
    sendError(response, 404, 'Local daily archive not found.');
    return;
  }

  if (request.method === 'HEAD') {
    sendEmpty(response, 200, 'application/json; charset=utf-8');
    return;
  }

  const body = await getDailyJsonBody(compactDate);

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(body);
}

async function sendManifest(response, filePath) {
  try {
    const body = await fs.readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(body);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendError(response, 404, 'Local archive manifest not found.');
      return;
    }

    throw error;
  }
}

async function sendAnalyticsDashboard(request, response) {
  const analyticsRoot = path.join(archivesRoot, 'analytics');
  const manifestPath = path.join(analyticsRoot, 'manifest.analytics.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const archiveName = manifest?.analytics?.url;

  if (!archiveNamePattern.test(archiveName || '')) {
    throw new Error('Local analytics manifest has no safe analytics.url.');
  }

  await sendFile(request, response, path.join(analyticsRoot, archiveName));
}

async function sendPredictionSimulation(request, response) {
  const simulationRoot = path.join(archivesRoot, 'simulation');
  const manifestPath = path.join(
    simulationRoot,
    'prediction-simulation.v1.manifest.json',
  );
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const archiveName = manifest?.report?.file;

  if (
    manifest?.schema !== 'bonzobyte.prediction-simulation.manifest' ||
    manifest?.schemaVersion !== 1 ||
    manifest?.report?.schema !== 'bonzobyte.prediction-simulation' ||
    manifest?.report?.schemaVersion !== 1 ||
    !simulationArchiveNamePattern.test(archiveName || '')
  ) {
    throw new Error(
      'Local prediction simulation manifest has no safe versioned report.',
    );
  }

  await sendFile(request, response, path.join(simulationRoot, archiveName));
}

function safeArchivePath(root, value, extension = '.br') {
  if (!numericIdPattern.test(value)) {
    return null;
  }

  return path.join(root, `${value}${extension}`);
}

async function routeRequest(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendError(response, 405, 'Only GET and HEAD are supported.');
    return;
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/health' || pathname === `${apiPrefix}/health`) {
    const index = await getDailyIndex();
    sendJson(response, 200, {
      archivesRoot,
      dailyCount: index.compactDates.length,
      maxDate: index.isoDates.at(-1),
      minDate: index.isoDates[0],
      mode: 'local-brotli',
    });
    return;
  }

  if (!pathname.startsWith(`${apiPrefix}/`)) {
    sendError(response, 404, 'Unknown local archive route.');
    return;
  }

  const relativeRoute = pathname.slice(apiPrefix.length);
  const index = await getDailyIndex();

  if (relativeRoute === '/daterange') {
    sendJson(response, 200, {
      minDate: index.isoDates[0],
      maxDate: index.isoDates.at(-1),
    });
    return;
  }

  if (relativeRoute === '/available-dates') {
    sendJson(response, 200, index.isoDates);
    return;
  }

  if (relativeRoute === '/latest-daily') {
    const date = index.compactDates.at(-1);
    sendJson(response, 200, { date, iso: toIsoDate(date) });
    return;
  }

  const dailyMatch = relativeRoute.match(/^\/daily\/(\d{8})$/);
  if (dailyMatch) {
    await sendDailyJson(request, response, dailyMatch[1]);
    return;
  }

  const rawArchiveRoutes = [
    {
      pattern: /^\/match-details\/(\d+)$/,
      root: path.join(archivesRoot, 'matches'),
    },
    {
      pattern: /^\/ts\/(\d+)$/,
      root: path.join(archivesRoot, 'players', 'ts'),
    },
    {
      pattern: /^\/players\/ts\/(\d+)$/,
      root: path.join(archivesRoot, 'players', 'ts'),
    },
    {
      pattern: /^\/players\/details\/(\d+)$/,
      root: path.join(archivesRoot, 'players', 'details'),
    },
    {
      pattern: /^\/players\/matches\/(\d+)$/,
      root: path.join(archivesRoot, 'players', 'matches'),
    },
    {
      pattern: /^\/tournaments\/matches\/(\d+)$/,
      root: path.join(archivesRoot, 'tournaments', 'matches'),
    },
  ];

  for (const route of rawArchiveRoutes) {
    const match = relativeRoute.match(route.pattern);
    if (match) {
      await sendFile(request, response, safeArchivePath(route.root, match[1]));
      return;
    }
  }

  if (relativeRoute === '/players/manifest') {
    await sendManifest(
      response,
      path.join(archivesRoot, 'players', 'indexBuild', 'manifest.json'),
    );
    return;
  }

  const playersIndexMatch = relativeRoute.match(/^\/players\/index\/([^/]+)$/);
  if (playersIndexMatch && archiveNamePattern.test(playersIndexMatch[1])) {
    await sendFile(
      request,
      response,
      path.join(archivesRoot, 'players', 'indexBuild', playersIndexMatch[1]),
    );
    return;
  }

  if (relativeRoute === '/tournaments/manifest') {
    await sendManifest(
      response,
      path.join(archivesRoot, 'tournaments', 'indexBuild', 'manifest.tournaments.json'),
    );
    return;
  }

  const tournamentsIndexMatch = relativeRoute.match(/^\/tournaments\/index\/([^/]+)$/);
  if (tournamentsIndexMatch && archiveNamePattern.test(tournamentsIndexMatch[1])) {
    await sendFile(
      request,
      response,
      path.join(archivesRoot, 'tournaments', 'indexBuild', tournamentsIndexMatch[1]),
    );
    return;
  }

  const photoMatch = relativeRoute.match(/^\/players\/photo\/(\d+)(?:\.jpg)?$/);
  if (photoMatch) {
    await sendFile(
      request,
      response,
      safeArchivePath(
        path.join(archivesRoot, 'players', 'photo'),
        photoMatch[1],
        '.jpg',
      ),
      'image/jpeg',
    );
    return;
  }

  if (relativeRoute === '/analytics/dashboard') {
    await sendAnalyticsDashboard(request, response);
    return;
  }

  if (relativeRoute === '/simulation/manifest') {
    await sendManifest(
      response,
      path.join(
        archivesRoot,
        'simulation',
        'prediction-simulation.v1.manifest.json',
      ),
    );
    return;
  }

  if (relativeRoute === '/simulation/report') {
    await sendPredictionSimulation(request, response);
    return;
  }

  sendError(response, 404, 'Unknown local archive route.');
}

const server = http.createServer((request, response) => {
  routeRequest(request, response).catch(error => {
    console.error('[local-archives] Request failed:', error);

    if (!response.headersSent) {
      sendError(response, 500, 'Local archive request failed.');
      return;
    }

    response.destroy(error);
  });
});

server.listen(port, host, async () => {
  try {
    const index = await getDailyIndex();
    console.log(`[local-archives] Serving ${index.compactDates.length} daily archives.`);
    console.log(`[local-archives] Range ${index.isoDates[0]} -> ${index.isoDates.at(-1)}.`);
    console.log(`[local-archives] Root ${archivesRoot}.`);
    console.log(
      `[local-archives] Daily cache=${dailyJsonCacheSize}, detail concurrency=${detailEnrichmentConcurrency}.`,
    );
    console.log(`[local-archives] Listening on http://${host}:${port}.`);
  } catch (error) {
    console.error('[local-archives] Startup validation failed:', error);
    server.close(() => process.exit(1));
  }
});

function closeServer(signal) {
  console.log(`[local-archives] ${signal} received, stopping.`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => closeServer('SIGINT'));
process.on('SIGTERM', () => closeServer('SIGTERM'));
