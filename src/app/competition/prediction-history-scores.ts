import { catchError, combineLatest, concat, map, Observable, of, switchMap, timer } from 'rxjs';
import { ARCHIVE_TIME_ZONE, dayAt, planArchiveDay, shiftDay } from '../core/i18n/archive-day-window';
import { offsetInstant } from '../core/i18n/display-time';
import { sourceCalendarDate } from '../core/i18n/regional-format';
import { provisionalMatchResult, readProvisionalScores, type ProvisionalScore } from '../core/helpers/provisional-match-result';
import type { MatchSummary } from '../core/models/match-summary';
import type { CompetitionPick } from '../core/services/competition.service';

type Read = (path: string) => Observable<unknown>;
type Candidate = { pick: CompetitionPick; summary?: MatchSummary };
type Scores = Map<number, ProvisionalScore>;
const id = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;

function samePlayers(pick: CompetitionPick, a: number | undefined, b: number | undefined) {
    const [p, q] = pick.snapshot.players;
    return (a === p.id && b === q.id) || (a === q.id && b === p.id);
}

// The accepted start is an instant; archive dateTime is a recorded source calendar date.
// Neither the submission time nor the viewer's display zone identifies the archive bucket.
function groupCandidates(picks: CompetitionPick[], summaries: ReadonlyMap<number, MatchSummary>, now: number) {
    const today = dayAt(now, ARCHIVE_TIME_ZONE), oldest = shiftDay(today, -2);
    const groups = new Map<string, Candidate[]>();
    for (const pick of picks) {
        const s = summaries.get(pick.matchTPId), snapshot = pick.snapshot;
        if (!id(pick.matchTPId) || pick.matchTPId >= 8000000000000000 || snapshot.matchTPId !== pick.matchTPId ||
            snapshot.players.length !== 2 || !snapshot.players.every(p => id(p.id)) || snapshot.players[0].id === snapshot.players[1].id) continue;
        const instant = offsetInstant(snapshot.startAt);
        if (instant === null) continue;
        const day = dayAt(instant, ARCHIVE_TIME_ZONE);
        if (day < oldest || day > today) continue;
        if (s && (s.matchTPId !== pick.matchTPId || s.isFinished === true || s.result || s.resultDetails ||
            (s.qualityStatus && s.qualityStatus !== 'NotAssessed') || (s.dateTime != null && sourceCalendarDate(s.dateTime) !== day) ||
            ((s.player1TPId != null || s.player2TPId != null) && !samePlayers(pick, s.player1TPId, s.player2TPId)))) continue;
        const key = day.replaceAll('-', '');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ pick, summary: s });
    }
    return groups;
}

// Reject ambiguous TP or SQL identities instead of picking the first row on a public day.
function dailyIndex(raw: unknown, day: string): Map<number, MatchSummary> {
    const d = raw as { date?: string; count?: number; matches?: MatchSummary[] } | null;
    const index = new Map<number, MatchSummary>(), sql = new Set<number>();
    if (d?.date !== day || !Array.isArray(d.matches) || d.count !== d.matches.length || d.count > 2500) return index;
    for (const row of d.matches) {
        if (!id(row?.matchTPId) || !id(row.matchId) || index.has(row.matchTPId) || sql.has(row.matchId)) return new Map();
        index.set(row.matchTPId, row); sql.add(row.matchId);
    }
    return index;
}

function loadDay(day: string, candidates: Candidate[], read: Read, now: () => number): Observable<Scores> {
    return read('/api/provisional-results/' + day).pipe(switchMap(raw => {
        const packet = readProvisionalScores(raw, day, now()), scores: Scores = new Map(), missing: Candidate[] = [];
        function bind(pick: CompetitionPick, row: MatchSummary) {
            const score = provisionalMatchResult(row, packet, now());
            if (!score || !samePlayers(pick, row.player1TPId, row.player2TPId)) return;
            const flip = (text: string) => text.replace(/(\d):(\d)/g, '$2:$1');
            scores.set(pick.matchTPId, row.player1TPId === pick.snapshot.players[0].id ? score :
                { result: flip(score.result), sets: flip(score.sets) });
        }
        for (const candidate of candidates) {
            const {pick, summary: s} = candidate, entry = packet.get(pick.matchTPId);
            if (!entry || !samePlayers(pick, entry.player1, entry.player2) ||
                (s?.matchId != null && s.matchId !== entry.matchId) ||
                (s?.tournamentEventTPId != null && s.tournamentEventTPId !== entry.event)) continue;
            if (s && id(s.matchId) && id(s.tournamentEventTPId) && s.dateTime && s.isFinished === false && id(s.player1TPId) && id(s.player2TPId)) bind(pick, s);
            else missing.push(candidate);
        }
        if (!missing.length) return of(scores);
        return read('/api/archives/daily/' + day).pipe(map(rawDay => {
            const rows = dailyIndex(rawDay, day);
            for (const {pick} of missing) {
                const row = rows.get(pick.matchTPId);
                if (row) bind(pick, row);
            }
            return scores;
        }), catchError(() => of(scores)));
    }), switchMap(scores => {
        if (!scores.size) return of(scores);
        // A tab may stay open even if its next history refresh fails.
        const iso = day.slice(0, 4) + '-' + day.slice(4, 6) + '-' + day.slice(6);
        const remaining = planArchiveDay(shiftDay(iso, 2), ARCHIVE_TIME_ZONE).endExclusive - now();
        const empty: Scores = new Map();
        return remaining > 0 ? concat(of(scores), timer(remaining).pipe(map(() => empty))) : of(empty);
    }), catchError(() => of(new Map<number, ProvisionalScore>())));
}

/** Display-only. Never writes the archive match, accepted prediction, or settlement. */
export function predictionHistoryScores(picks: CompetitionPick[], summaries: ReadonlyMap<number, MatchSummary>, read: Read, now = Date.now): Observable<Scores> {
    const days = groupCandidates(picks, summaries, now());
    return days.size ? combineLatest([...days].map(([day, rows]) => loadDay(day, rows, read, now))).pipe(
        map(groups => new Map(groups.flatMap(group => [...group])))) : of(new Map());
}
