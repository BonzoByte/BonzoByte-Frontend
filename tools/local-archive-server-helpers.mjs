export function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
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
