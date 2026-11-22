import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateClientDetailsAccess } from '../src/app/core/helpers/match-details-access.ts';

test('grid uses the verified schedule and a two-hour window', () => {
    const details = { isFinished: false, scheduledStart: '2026-11-22T00:00:00.002',
        plannedStartChecked: true, plannedStartUtc: '2026-11-22T14:30:00.000Z' };
    for (const [now, locked] of [['12:29:59', true], ['12:30:00', false], ['13:12:00', false]]) {
        assert.equal(evaluateClientDetailsAccess({ ...details, nowMs: Date.parse(`2026-11-22T${now}Z`) }).locked, locked);
    }
    const withoutTime = { ...details, plannedStartUtc: null, nowMs: Date.parse('2026-11-22T12:00:00Z') };
    assert.equal(evaluateClientDetailsAccess(withoutTime).locked, false);
    assert.equal(evaluateClientDetailsAccess({ ...withoutTime, plannedStartChecked: false }).locked, true);
    assert.equal(evaluateClientDetailsAccess({ ...withoutTime, scheduledStart: '2026-11-22T19:00:00Z' }).locked, true);
});
