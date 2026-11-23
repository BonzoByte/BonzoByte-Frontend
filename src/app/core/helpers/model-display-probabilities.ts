import type { Match } from '../models/tennis.model';

export const modelDisplaySchema = 'bonzobyte.retrospective-model-display-grid.v1';
const dayKey = /^20\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/;
const id = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
const probability = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1;
const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export function modelDisplayDays(index: unknown): ReadonlySet<string> {
    if (!record(index) || index['schema'] !== modelDisplaySchema ||
        !Array.isArray(index['days']) || index['days'].length > 15000 ||
        !index['days'].every(day => typeof day === 'string' && dayKey.test(day))) return new Set();
    return new Set(index['days']);
}

/** Adds a separate odds-only estimate. Never modifies archival eligibility or prediction fields. */
export function applyRetrospectiveModelDisplay(matches: Match[], packet: unknown, day: string): Match[] {
    if (!dayKey.test(day) || !record(packet) || packet['schema'] !== modelDisplaySchema ||
        packet['day'] !== day || !Array.isArray(packet['rows']) || packet['rows'].length > 2500) return matches;
    type Entry = [number, number, number, number, number, number, number];
    const entries = new Map<number, Entry>();
    for (const row of packet['rows']) {
        if (!Array.isArray(row) || row.length !== 7 || !row.slice(0, 5).every(id) || row[2] === row[3] ||
            !probability(row[5]) || !probability(row[6]) || Math.abs(row[5] + row[6] - 1) > 1e-10 ||
            entries.has(row[0])) return matches;
        entries.set(row[0], row as Entry);
    }
    const seen = new Map<number, number>();
    for (const match of matches) if (entries.has(match.matchTPId))
        seen.set(match.matchTPId, (seen.get(match.matchTPId) ?? 0) + 1);
    return matches.map(match => {
        const entry = entries.get(match.matchTPId);
        if (!entry || seen.get(match.matchTPId) !== 1 || match.matchId !== entry[1] ||
            match.player1TPId !== entry[2] || match.player2TPId !== entry[3] || match.tournamentEventTPId !== entry[4] ||
            typeof match.dateTime !== 'string' || match.dateTime.slice(0, 10).replace(/-/g, '') !== day) return match;
        return { ...match, retrospectiveModelDisplay: { player1: entry[5], player2: entry[6] } };
    });
}
