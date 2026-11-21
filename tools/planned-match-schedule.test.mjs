import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyPlannedMatchSchedule, isRecentScheduleDay, scheduleSchema } from '../src/app/core/helpers/planned-match-schedule.ts';

const now = Date.parse('2026-11-21T15:00:00.000Z'), day = '20261121';
const slot = [30,11,12,'2026-11-21T19:30:00.000Z'];
const feed = {schema:scheduleSchema,day,observedAt:new Date(now).toISOString(),slots:[slot]};
const match = {matchTPId:30,player1TPId:11,player2TPId:12,isFinished:false,result:null,resultDetails:null,
    dateTime:'2026-11-21',sourceTimePrecision:'unknown',player1Odds:1.7,player2Odds:2.05};

test('adds display metadata only for the exact pair and still-open match', () => {
    const backwards = {...match,player1TPId:12,player2TPId:11};
    const completed = {...match,isFinished:true};
    const live = {...match,resultDetails:'6:3'};
    const [enriched,...unchanged] = applyPlannedMatchSchedule([match,backwards,completed,live],feed,day,now);
    assert.deepEqual(enriched,{...match,plannedStartUtc:slot[3],plannedStartKind:'not-before'});
    [backwards,completed,live].forEach((original,i)=>assert.equal(unchanged[i],original));
});

test('fails closed for stale, ambiguous, out-of-day and malformed data', () => {
    const rows = [match];
    assert.equal(applyPlannedMatchSchedule(rows,feed,day,now+37*3_600_000),rows);
    assert.equal(applyPlannedMatchSchedule(rows,feed,'20261122',now),rows);
    for (const slots of [[slot,slot], [[30,11,12,'2026-11-21T23:30:00.000Z']], [[30,11,12,'2026-11-21T19:30:00Z']]]) {
        assert.equal(applyPlannedMatchSchedule(rows,{...feed,slots},day,now),rows);
    }
    assert.equal(applyPlannedMatchSchedule(rows,null,day,now),rows);
});

test('does not request schedule assets for a historical archive day', () => {
    assert.equal(isRecentScheduleDay(day,now),true);
    assert.equal(isRecentScheduleDay('20261122',now),true);
    assert.equal(isRecentScheduleDay('20190801',now),false);
});
