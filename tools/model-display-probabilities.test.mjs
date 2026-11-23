import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyRetrospectiveModelDisplay, modelDisplayDays, modelDisplaySchema } from '../src/app/core/helpers/model-display-probabilities.ts';

const read = name => JSON.parse(readFileSync(new URL('../src/assets/model-display/' + name + '.json', import.meta.url), 'utf8'));
const day = '20261119', feed = read(day);
const example = feed.rows.find(row => row[0] === 827551782);
const match = {
    matchTPId: 827551782, matchId: 1935405, player1TPId: 646010, player2TPId: 686709, tournamentEventTPId: 247939,
    dateTime: '2026-11-19T19:30:00', result: null, resultDetails: '1:0 6:0 5:2', isFinished: false,
    predictionEligible: false, calculationEligible: false, modelProbabilityPlayer1: null, modelProbabilityPlayer2: null,
};

test('adds the reviewed odds for an unverified result without altering performance, forecast, or game fields', () => {
    const [enriched] = applyRetrospectiveModelDisplay([match], feed, day);
    const { retrospectiveModelDisplay, ...original } = enriched;
    assert.deepEqual(original, match);
    assert.equal((1 / retrospectiveModelDisplay.player1).toFixed(2), '1.88');
    assert.equal((1 / retrospectiveModelDisplay.player2).toFixed(2), '2.13');
    assert.equal(modelDisplayDays(read('index')).has(day), true);
});

test('does not assume an outcome, but refuses duplicate or incorrectly oriented identities', () => {
    for (const result of [null, '2:0', 'RET', 'W/O']) {
        const [r] = applyRetrospectiveModelDisplay([{ ...match, result }], feed, day);
        assert.equal(r.result, result);
        assert.ok(r.retrospectiveModelDisplay);
    }
    for (const options of [{ player1TPId: match.player2TPId, player2TPId: match.player1TPId }, { matchId: 1 },
        { tournamentEventTPId: 2 }, { dateTime: '2026-11-20' }]) {
        const other = { ...match, ...options };
        assert.equal(applyRetrospectiveModelDisplay([other], feed, day)[0], other);
    }
    const ambiguous = [match, { ...match }];
    assert.deepEqual(applyRetrospectiveModelDisplay(ambiguous, feed, day), ambiguous);
});

test('malformed packets leave the archive untouched', () => {
    const rows = [match];
    for (const broken of [{ ...feed, day: '20261120' }, { ...feed, rows: [example, example] },
        { ...feed, rows: [[...example.slice(0, 5), 0, 1]] },
        { ...feed, rows: [[...example.slice(0, 5), .53, .43]] },
        { ...feed, schema: 'unknown' }]) assert.equal(applyRetrospectiveModelDisplay(rows, broken, day), rows);
    assert.equal(modelDisplayDays({ schema: modelDisplaySchema, days: ['missing'] }).size, 0);
});
