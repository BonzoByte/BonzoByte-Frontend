import type { MatchSummary } from '../core/models/match-summary';
import type { CompetitionPick } from '../core/services/competition.service';

/** Align public metadata to the frozen player axis; accepted snapshots stay immutable. */
export function predictionMatchPresentation(pick: CompetitionPick, summary?: MatchSummary, preview = false): MatchSummary {
 const [p1,p2] = pick.snapshot.players;
 const identity: MatchSummary = { matchTPId: pick.matchTPId, dateTime: pick.snapshot.startAt, sourceTimePrecision: 'minute', tournamentEventName: pick.snapshot.tournament,
  player1TPId: p1.id, player1Name: p1.name, player1CountryISO2: p1.countryISO2 ?? undefined, player1CountryISO3: p1.countryISO3 ?? undefined, player1CountryFull: p1.countryFull ?? undefined, player1Seed: p1.seed ?? undefined, player1Rank: p1.rank ?? undefined,
  player2TPId: p2.id, player2Name: p2.name, player2CountryISO2: p2.countryISO2 ?? undefined, player2CountryISO3: p2.countryISO3 ?? undefined, player2CountryFull: p2.countryFull ?? undefined, player2Seed: p2.seed ?? undefined, player2Rank: p2.rank ?? undefined };
 const data = preview ? pick.previewMatch : summary;
 if (!data || data.matchTPId !== pick.matchTPId) return identity;
 const same = data.player1TPId === p1.id && data.player2TPId === p2.id, reversed = data.player1TPId === p2.id && data.player2TPId === p1.id;
 if (!same && !reversed) return identity;
 const flip = (score?: string): string | undefined => score?.split(/(\s+)/).map(token => {
  if (/^\d\d(?:\(\d+\))?$/.test(token)) return token[1] + token[0] + token.slice(2);
  return token.replace(/^(\[?)(\d+):(\d+)/, '$1$3:$2');
 }).join('');
 // Explicit display allowlist: no current odds/model or settlement enters the snapshot.
 return { ...identity, dateTime: data.dateTime || identity.dateTime, sourceTimePrecision: data.sourceTimePrecision ?? identity.sourceTimePrecision,
  tournamentEventTPId: data.tournamentEventTPId, tournamentEventCountryISO2: data.tournamentEventCountryISO2,
  tournamentEventCountryISO3: data.tournamentEventCountryISO3, tournamentEventCountryFull: data.tournamentEventCountryFull,
  tournamentTypeName: data.tournamentTypeName, tournamentLevelName: data.tournamentLevelName, surface: data.surface, roundName: data.roundName,
  tournamentStrengthMeanTS: data.tournamentStrengthMeanTS, isFinished: data.isFinished, qualityStatus: data.qualityStatus,
  result: reversed ? flip(data.result) : data.result, resultDetails: reversed ? flip(data.resultDetails) : data.resultDetails };
}
