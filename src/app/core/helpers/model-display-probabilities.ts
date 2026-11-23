import type { Match } from '../models/tennis.model';

export const modelDisplaySchema = 'bonzobyte.retrospective-model-display-grid.v1';
export const dateModelDisplaySchema = 'bonzobyte.date-model-display-grid.v1';
const dayKey = /^20\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/;
const id = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
const probability = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1;
const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export function modelDisplayDays(index: unknown): ReadonlySet<string> {
    if (!record(index) || ![modelDisplaySchema,dateModelDisplaySchema].some(schema=>index['schema']===schema) ||
        !Array.isArray(index['days']) || index['days'].length > 15000 ||
        !index['days'].every(day => typeof day === 'string' && dayKey.test(day))) return new Set();
    return new Set(index['days']);
}

/** Adds a display-only estimate. Never modifies archival eligibility or timed prediction fields. */
export function applyRetrospectiveModelDisplay(matches: Match[], packet: unknown, day: string): Match[] {
    if (!dayKey.test(day) || !record(packet) ||
        ![modelDisplaySchema,dateModelDisplaySchema].some(schema=>packet['schema']===schema) ||
        packet['day'] !== day || !Array.isArray(packet['rows']) || packet['rows'].length > 2500) return matches;
    const dateOnly=packet['schema']===dateModelDisplaySchema;
    type Pair = [number, number, number, number, number];
    type Estimate = [...Pair, number, number];
    type Entry = Pair | Estimate;
    const entries = new Map<number, Entry>();
    const validPair = (row: unknown, count: number): row is Entry => Array.isArray(row) && row.length===count &&
        row.slice(0,5).every(id) && row[2]!==row[3] && !entries.has(row[0]);
    for (const row of packet['rows']) {
        if (!validPair(row,7) || !probability(row[5]) || !probability(row[6]) ||
            Math.abs(row[5] + row[6] - 1) > 1e-10) return matches;
        entries.set(row[0],row);
    }
    if(dateOnly){
        if(!Array.isArray(packet['held'])||entries.size+packet['held'].length>2500)return matches;
        for(const row of packet['held']){
            if(!validPair(row,5))return matches;
            entries.set(row[0],row);
        }
    }
    const seen = new Map<number, number>();
    for (const match of matches) if (entries.has(match.matchTPId))
        seen.set(match.matchTPId, (seen.get(match.matchTPId) ?? 0) + 1);
    return matches.map(match => {
        const entry = entries.get(match.matchTPId);
        if (!entry || seen.get(match.matchTPId) !== 1 || match.matchId !== entry[1] || match.tournamentEventTPId !== entry[4] ||
            typeof match.dateTime !== 'string' || match.dateTime.slice(0, 10).replace(/-/g, '') !== day) return match;
        const exact=match.player1TPId===entry[2]&&match.player2TPId===entry[3];
        const reversed=dateOnly&&match.player1TPId===entry[3]&&match.player2TPId===entry[2];
        if(!exact&&!reversed)return match;
        if(entry.length===5)return {...match,dateModelInsufficientHistory:true};
        return { ...match, retrospectiveModelDisplay: { player1: entry[reversed?6:5], player2: entry[reversed?5:6], dateOnly } };
    });
}
