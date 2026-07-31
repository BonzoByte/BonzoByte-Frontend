import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVersionedLruPromiseCache,
  getMoneylineMedianOfMedians,
  mapWithConcurrency,
  median,
  parsePositiveInteger,
} from './local-archive-server-helpers.mjs';

const delay = milliseconds => new Promise(resolve => {
  setTimeout(resolve, milliseconds);
});

test('mapWithConcurrency preserves order and respects the worker limit', async () => {
  let active = 0;
  let peakActive = 0;

  const result = await mapWithConcurrency([30, 5, 20, 1, 10], 2, async value => {
    active += 1;
    peakActive = Math.max(peakActive, active);
    await delay(value);
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(result, [60, 10, 40, 2, 20]);
  assert.equal(peakActive, 2);
});

test('versioned cache deduplicates concurrent work for the same day and version', async () => {
  const cache = createVersionedLruPromiseCache(2);
  let calls = 0;
  const factory = async () => {
    calls += 1;
    await delay(10);
    return Buffer.from('daily-json');
  };

  const [first, second] = await Promise.all([
    cache.get('20260717', 'v1', factory),
    cache.get('20260717', 'v1', factory),
  ]);

  assert.equal(calls, 1);
  assert.strictEqual(first, second);
  assert.strictEqual(await cache.get('20260717', 'v1', factory), first);
  assert.equal(calls, 1);
});

test('version changes invalidate a day and an older result cannot replace a newer one', async () => {
  const cache = createVersionedLruPromiseCache(2);
  let releaseOld;
  const oldGate = new Promise(resolve => {
    releaseOld = resolve;
  });

  const oldResult = cache.get('20260717', 'v1', async () => {
    await oldGate;
    return 'old';
  });
  const newResult = await cache.get('20260717', 'v2', async () => 'new');

  releaseOld();
  assert.equal(await oldResult, 'old');
  assert.equal(newResult, 'new');
  assert.equal(
    await cache.get('20260717', 'v2', async () => {
      throw new Error('The newer cached value should have been retained.');
    }),
    'new',
  );
});

test('completed entries use least-recently-used eviction', async () => {
  const cache = createVersionedLruPromiseCache(2);
  let bCalls = 0;

  await cache.get('a', 'v1', async () => 'a');
  await cache.get('b', 'v1', async () => {
    bCalls += 1;
    return 'b';
  });
  await cache.get('a', 'v1', async () => 'unexpected');
  await cache.get('c', 'v1', async () => 'c');
  await cache.get('b', 'v1', async () => {
    bCalls += 1;
    return 'b2';
  });

  assert.equal(bCalls, 2);
});

test('parsePositiveInteger accepts safe positive integers and otherwise falls back', () => {
  assert.equal(parsePositiveInteger('8', 4), 8);
  assert.equal(parsePositiveInteger('0', 4), 4);
  assert.equal(parsePositiveInteger('2.5', 4), 4);
  assert.equal(parsePositiveInteger('not-a-number', 4), 4);
});

test('median rejects unusable odds and rounds the midpoint to two decimals', () => {
  assert.equal(median([Number.NaN, 1, 2.123, 1.987]), 2.06);
  assert.equal(median([null, 0, 1]), null);
});

test('moneyline benchmark is the median of paired bookmaker history medians', () => {
  const details = {
    o: [{
      i: 1,
      m: [{
        x: [
          {
            p: 101,
            o: [
              { b: 10, q: 1.8, r: 1 },
              { b: 10, q: 2.0, r: 2 },
              { b: 20, q: 2.1, r: 1 },
              { b: 30, q: 9.9, r: 1 },
            ],
          },
          {
            p: 202,
            o: [
              { b: 10, q: 2.2, r: 1 },
              { b: 10, q: 2.4, r: 2 },
              { b: 20, q: 1.7, r: 1 },
            ],
          },
        ],
      }],
    }],
  };

  assert.deepEqual(getMoneylineMedianOfMedians(details, 101, 202), {
    player1Median: 2,
    player2Median: 2,
    pairedBookmakers: 2,
  });
});

test('moneyline benchmark requires both players from the same bookmaker', () => {
  const details = {
    o: [{
      i: 1,
      m: [{
        x: [
          { p: 101, o: [{ b: 10, q: 1.8 }] },
          { p: 202, o: [{ b: 20, q: 2.2 }] },
        ],
      }],
    }],
  };

  assert.equal(getMoneylineMedianOfMedians(details, 101, 202), null);
});
