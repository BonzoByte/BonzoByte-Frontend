export function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function median(values) {
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

export function getMoneylineMedianOfMedians(details, player1Id, player2Id) {
  const historiesByPlayer = new Map([
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
        const historiesByBookmaker = historiesByPlayer.get(playerId);

        if (!historiesByBookmaker) {
          continue;
        }

        for (const offer of Array.isArray(selection?.o) ? selection.o : []) {
          const bookmakerId = Number(offer?.b);
          const odds = Number(offer?.q);

          if (
            !Number.isFinite(bookmakerId) ||
            !Number.isFinite(odds) ||
            odds <= 1
          ) {
            continue;
          }

          const history = historiesByBookmaker.get(bookmakerId) ?? [];
          history.push(odds);
          historiesByBookmaker.set(bookmakerId, history);
        }
      }
    }
  }

  const player1Histories = historiesByPlayer.get(player1Id);
  const player2Histories = historiesByPlayer.get(player2Id);
  const pairedBookmakerIds = [...player1Histories.keys()]
    .filter(bookmakerId => player2Histories.has(bookmakerId));

  const player1BookmakerMedians = pairedBookmakerIds
    .map(bookmakerId => median(player1Histories.get(bookmakerId)))
    .filter(value => value != null);
  const player2BookmakerMedians = pairedBookmakerIds
    .map(bookmakerId => median(player2Histories.get(bookmakerId)))
    .filter(value => value != null);

  const player1Median = median(player1BookmakerMedians);
  const player2Median = median(player2BookmakerMedians);

  return player1Median != null && player2Median != null
    ? {
        player1Median,
        player2Median,
        pairedBookmakers: pairedBookmakerIds.length,
      }
    : null;
}

export async function mapWithConcurrency(items, concurrency, mapper) {
  if (!Array.isArray(items)) {
    throw new TypeError('items must be an array.');
  }

  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError('concurrency must be a positive integer.');
  }

  if (typeof mapper !== 'function') {
    throw new TypeError('mapper must be a function.');
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(
        items[currentIndex],
        currentIndex,
        items,
      );
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

export function createVersionedLruPromiseCache(maxEntries) {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError('maxEntries must be a positive integer.');
  }

  const completed = new Map();
  const inFlight = new Map();
  let requestSequence = 0;

  function getInFlightKey(key, version) {
    return JSON.stringify([key, version]);
  }

  function remember(key, entry) {
    completed.delete(key);
    completed.set(key, entry);

    while (completed.size > maxEntries) {
      completed.delete(completed.keys().next().value);
    }
  }

  return {
    async get(key, version, factory) {
      if (typeof factory !== 'function') {
        throw new TypeError('factory must be a function.');
      }

      const cached = completed.get(key);
      if (cached?.version === version) {
        remember(key, cached);
        return cached.value;
      }

      const inFlightKey = getInFlightKey(key, version);
      const existingPromise = inFlight.get(inFlightKey);
      if (existingPromise) {
        return existingPromise;
      }

      requestSequence += 1;
      const sequence = requestSequence;
      let guardedPromise;

      const pendingPromise = (async () => {
        const value = await factory();
        const current = completed.get(key);

        if (!current || current.sequence <= sequence) {
          remember(key, { sequence, value, version });
        }

        return value;
      })();

      guardedPromise = pendingPromise.finally(() => {
        if (inFlight.get(inFlightKey) === guardedPromise) {
          inFlight.delete(inFlightKey);
        }
      });

      inFlight.set(inFlightKey, guardedPromise);
      return guardedPromise;
    },
  };
}
