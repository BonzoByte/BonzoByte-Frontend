import type { MatchSummary } from '../models/match-summary';
import type { PlayerIndex, TournamentIndex } from '../models/tennis.model';
import type { MatchDetailsRaw, PlayerDTO } from '../models/match-details.model';

export function localPreviewPlayer(match: MatchSummary, side: 1 | 2): PlayerIndex | null {
    const id = side === 1 ? match.player1TPId : match.player2TPId;
    if (!Number.isSafeInteger(id) || !id || id >= 0) return null;
    return { playerTPId: id, playerName: (side === 1 ? match.player1Name : match.player2Name) || null,
        countryISO2: side === 1 ? match.player1CountryISO2 : match.player2CountryISO2,
        countryISO3: side === 1 ? match.player1CountryISO3 : match.player2CountryISO3,
        countryFull: side === 1 ? match.player1CountryFull : match.player2CountryFull };
}

export function localPreviewTournament(match: MatchSummary): TournamentIndex | null {
    const id = match.tournamentEventTPId;
    if (!Number.isSafeInteger(id) || !id || id >= 0) return null;
    return { tournamentEventTPId: id, tournamentEventName: match.tournamentEventName || null,
        countryISO2: match.tournamentEventCountryISO2, countryISO3: match.tournamentEventCountryISO3, countryFull: match.tournamentEventCountryFull,
        tournamentEventDate: match.dateTime?.slice(0, 10), tournamentTypeName: match.tournamentTypeName,
        tournamentLevelName: match.tournamentLevelName, surfaceName: match.surface, averageMatchStrength: match.tournamentStrengthMeanTS };
}

/** Explicit local overview data, with no invented biographies, model output or live discussion. */
export function localPreviewMatchDetails(match: MatchSummary, indices: readonly PlayerIndex[] = []): MatchDetailsRaw | null {
    if (!Number.isSafeInteger(match.matchTPId) || match.matchTPId >= 0) return null;
    const one = localPreviewPlayer(match, 1), two = localPreviewPlayer(match, 2), tournament = localPreviewTournament(match);
    if (!one || !two || !tournament) return null;
    const dto = (base: PlayerIndex): PlayerDTO => {
        const p = indices.find(row => row.playerTPId === base.playerTPId) ?? base;
        return { p01: p.playerTPId, p02: p.playerName || '', p03: 0, p04: p.countryISO3 || '', p05: p.countryISO2 || '', p06: p.countryFull || '', p07: 0,
            p09: p.playerBirthDate || undefined, p10: p.playerHeight || undefined, p11: p.playerWeight || undefined, p12: p.playerTurnedPro || undefined,
            p13: p.playsId || undefined, p14: p.playsId === 1 ? 'Right' : p.playsId === 2 ? 'Left' : undefined };
    };
    const main = match.result?.replace(/[:\s-]/g, '') || '';
    const sets = (match.resultDetails || '').trim().split(/\s+/).filter(Boolean).map(token => token.replace(/^(\d):(\d)/, '$1$2'));
    if (sets[0] === main) sets.shift();
    return { m001: match.matchTPId, m003: match.dateTime || '', m004: one.playerTPId, m005: two.playerTPId,
        m006: Number(match.player1Rank) || undefined, m007: Number(match.player2Rank) || undefined, m008: match.player1Seed, m009: match.player2Seed,
        m010: main, m011: sets.length ? [main, ...sets].join(' ') : '', m019: 0, m020: match.surface, m021: 0, m022: match.roundName,
        m655: null, m656: match.isFinished === true, p1: dto(one), p2: dto(two),
        t: { t01: tournament.tournamentEventTPId, t02: tournament.tournamentEventName || '', t03: 0, t04: tournament.countryISO3 || '', t05: tournament.countryISO2 || '', t06: tournament.countryFull || '',
            t07: 0, t08: '', t09: tournament.tournamentEventDate || '', t10: 0, t11: match.surface || '', t12: 0, t13: match.tournamentLevelName || '',
            t15: match.tournamentTypeName === 'WTA' ? 2 : 1, t16: match.tournamentTypeName || '' } };
}
