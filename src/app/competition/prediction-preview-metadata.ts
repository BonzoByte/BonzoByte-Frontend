import type { MatchSummary } from '../core/models/match-summary';
import type { CompetitionPick } from '../core/services/competition.service';

// Public archived identity metadata only. No source prices, probabilities or results.
const groups: [string, string, string, string, string, number[]][] = [
 ['ATP','hard','US','USA','USA',[827373088,827373061,827373094,827373100,827374535,827375911]],
 ['WTA','hard','US','USA','USA',[827373102,827373062,827373097,827374532]],
 ['ATP','hard','CA','CAN','Canada',[827369841,827369840,827373093,827373086,827374538,827374377,827375908]],
 ['ATP','hard','MX','MEX','Mexico',[827370240,827374193,827370246,827374192,827374195,827374194,827374197,827374540,827375906,827375915]],
 ['ATP','hard','TW','TAI','Taiwan',[827371049,827371042,827372719,827374545,827374552,827374548,827376974,827376975]],
 ['ATP','carpet','CN','CHN','China',[827374205,827376946,827376948]],
 ['WTA','hard','CN','CHN','China',[827373104,827374209,827376947,827376967]],
 ['ATP','clay','CH','CHE','Switzerland',[827374398,827374397,827374396,827374395]],
 ['WTA','clay','RS','SRB','Serbia',[827374286,827374303,827374257,827372780,827374331,827374296,827372781,827374288]],
 ['ATP','hard','PT','PRT','Portugal',[827374352]],
 ['ATP','clay','DE','DEU','Germany',[827374275,827374365,827374322,827373080,827375907]],
 ['ATP','clay','SI','SVN','Slovenia',[827374313,827374441,827374304,827374443]],
 ['ATP','clay','BE','BEL','Belgium',[827374422]],
 ['WTA','clay','CZ','CZE','Czech Republic',[827374258,827374318,827374291]],
 ['WTA','clay','CH','CHE','Switzerland',[827374359,827374369,827377032]],
 ['WTA','clay','DE','DEU','Germany',[827374263,827374450,827374316,827374452,827374285,827374287,827374451,827377035]],
 ['WTA','clay','RO','ROU','Romania',[827374243,827374278,827374276,827374446,827374448]],
 ['WTA','clay','PL','POL','Poland',[827374325,827374374,827377000]],
 ['ATP','clay','CZ','CZE','Czech Republic',[827374290,827374310,827374360,827374299]],
 ['ATP','hard','GB','GBR','United Kingdom',[827374392,827374393,827374394,827374391]],
 ['ATP','clay','PL','POL','Poland',[827374413]], ['ATP','clay','RS','SRB','Serbia',[827372987]],
 ['ATP','hard','JM','JAM','Jamaica',[827374527,827374530,827374528,827374529]],
 ['ATP','clay','PY','PRY','Paraguay',[827374384,827373071]], ['WTA','hard','BR','BRA','Brazil',[827374524]],
 ['ATP','clay','RO','ROU','Romania',[827376994]], ['ATP','clay','AT','AUT','Austria',[827377015]],
 ['ATP','unknown','WD','WLD','World',[827376977]], ['WTA','hard','ES','ESP','Spain',[827377016]]
];
const metadata = new Map<number, Partial<MatchSummary>>();
for (const [type,surface,iso2,iso3,country,ids] of groups) for (const id of ids)
 metadata.set(id, { tournamentTypeName: type, surface, tournamentEventCountryISO2: iso2, tournamentEventCountryISO3: iso3, tournamentEventCountryFull: country });

/** Fictional layout scores follow the existing demo settlement, not real historic results. */
export function predictionPreviewMatch(pick: CompetitionPick, sourceMatchId: number): MatchSummary {
 const p = pick.snapshot.players, status = pick.settlement?.status;
 const winner = status === 'won' ? pick.side : 1 - pick.side, finished = status === 'won' || status === 'lost';
 return { ...metadata.get(sourceMatchId), matchTPId: pick.matchTPId, tournamentEventTPId: pick.matchTPId,
  dateTime: pick.snapshot.startAt, sourceTimePrecision: 'minute', tournamentEventName: pick.snapshot.tournament,
  player1TPId: p[0].id, player1Name: p[0].name, player1CountryISO2: p[0].countryISO2 ?? undefined, player1CountryISO3: p[0].countryISO3 ?? undefined, player1CountryFull: p[0].countryFull ?? undefined, player1Seed: p[0].seed ?? undefined, player1Rank: p[0].rank ?? undefined,
  player2TPId: p[1].id, player2Name: p[1].name, player2CountryISO2: p[1].countryISO2 ?? undefined, player2CountryISO3: p[1].countryISO3 ?? undefined, player2CountryFull: p[1].countryFull ?? undefined, player2Seed: p[1].seed ?? undefined, player2Rank: p[1].rank ?? undefined,
  isFinished: finished, result: finished ? winner === 0 ? '21' : '12' : '', resultDetails: finished ? winner === 0 ? '6:4 4:6 6:3' : '4:6 6:4 3:6' : '' };
}
