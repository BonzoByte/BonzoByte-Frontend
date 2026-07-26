import { createReadStream, promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompress } from 'node:zlib';

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
const port = Number(process.env.BONZOBYTE_ARCHIVE_PORT || 5000);
const host = process.env.BONZOBYTE_ARCHIVE_HOST || '127.0.0.1';

const dailyRoot = path.join(archivesRoot, 'daily');
const apiPrefix = '/api/archives';
const compactDatePattern = /^\d{8}$/;
const numericIdPattern = /^\d+$/;
const archiveNamePattern = /^[A-Za-z0-9._-]+\.br$/;

let dailyIndexCache;

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

  const compressed = await fs.readFile(path.join(dailyRoot, `${compactDate}.br`));
  const body = await brotliDecompressAsync(compressed);

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
