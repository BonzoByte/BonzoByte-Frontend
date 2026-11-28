import type { Match } from '../models/tennis.model';
import type { MatchSummary } from '../models/match-summary';

/** Return the grid's actual row, including its player order; never mix side-specific fields. */
export function linkedDailyRow(summary: MatchSummary, rows: Match[], day: string): Match | null {
    const candidates = rows.filter(row => row.matchTPId === summary.matchTPId);
    if (candidates.length !== 1) return null;
    const row = candidates[0];
    const a = summary.player1TPId, b = summary.player2TPId;
    if (!a || !b || a === b || !summary.tournamentEventTPId ||
        row.tournamentEventTPId !== summary.tournamentEventTPId || row.dateTime?.slice(0,10) !== day ||
        (row.matchId != null && summary.matchId != null && row.matchId !== summary.matchId) ||
        !((row.player1TPId === a && row.player2TPId === b) || (row.player1TPId === b && row.player2TPId === a))) return null;
    return row;
}
