import { sourceCalendarDate } from '../i18n/regional-format';
import { ARCHIVE_TIME_ZONE, dayAt, planArchiveDay, shiftDay } from '../i18n/archive-day-window';
import type { MatchSummary } from '../models/match-summary';

export interface ProvisionalScore { result: string; sets: string; }
interface Entry {
    day: string; expiresAt: number; matchId: number; player1: number; player2: number; event: number; score: ProvisionalScore;
}
export type ProvisionalScores = ReadonlyMap<number, Entry>;

export function readProvisionalScores(value: unknown, day: string, now = Date.now()): ProvisionalScores {
    const result = new Map<number, Entry>();
    const packet = value as {schema?: string; day?: string; observedAt?: string; rows?: unknown[] } | null;
    if (packet?.schema !== 'bonzobyte.provisional-results.v1' || packet.day !== day ||
        typeof packet.observedAt !== 'string' || !Array.isArray(packet.rows) || packet.rows.length > 600) return result;
    const today = dayAt(now, ARCHIVE_TIME_ZONE);
    const sourceDay = [today, shiftDay(today,-1), shiftDay(today,-2)].find(d => d.replaceAll('-','') === day);
    const observed = Date.parse(packet.observedAt);
    if (!sourceDay || !Number.isFinite(observed) || observed > now || dayAt(observed, ARCHIVE_TIME_ZONE) < sourceDay) return result;
    const expiresAt = planArchiveDay(shiftDay(sourceDay, 2), ARCHIVE_TIME_ZONE).endExclusive;
    const ids = new Set<number>();
    for (const row of packet.rows) {
        if (!Array.isArray(row) || row.length !== 7 || !row.slice(0, 5).every(id => Number.isSafeInteger(id) && id > 0) ||
            row[2] === row[3] || result.has(row[0]) || ids.has(row[1]) ||
            typeof row[5] !== 'string' || !/^(?:2:[01]|[01]:2|3:[012]|[012]:3)$/.test(row[5]) ||
            typeof row[6] !== 'string' || !/^[0-7]:[0-7](?:\(\d{1,2}\))?(?: [0-7]:[0-7](?:\(\d{1,2}\))?){1,4}$/.test(row[6])) return new Map();
        ids.add(row[1]);
        result.set(row[0], {day, expiresAt, matchId:row[1], player1:row[2], player2:row[3], event:row[4], score:{result:row[5], sets:row[6]}});
    }
    return result;
}

/** A display-only overlay, never copied into Match or used as a verified outcome. */
export function provisionalMatchResult(match: MatchSummary, scores: ProvisionalScores, now = Date.now()): ProvisionalScore | undefined {
    if (match.isFinished !== false || match.result || match.resultDetails ||
        (match.qualityStatus && match.qualityStatus !== 'NotAssessed')) return undefined;
    const entry = scores.get(match.matchTPId);
    if (!entry || entry.expiresAt <= now || entry.day !== sourceCalendarDate(match.dateTime)?.replaceAll('-', '') ||
        match.matchId !== entry.matchId || match.player1TPId !== entry.player1 || match.player2TPId !== entry.player2 ||
        match.tournamentEventTPId !== entry.event) return undefined;
    return entry.score;
}
