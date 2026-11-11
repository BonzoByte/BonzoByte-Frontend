import type { Match, PlayerIndex } from '../../../core/models/tennis.model';
import type { MatchDetailsRaw } from '../../../core/models/match-details.model';
import type { PopularityRanking, PopularMatch } from '../../../core/services/popularity.service';
import { localUiPreviewAllowed } from '../../../core/helpers/local-ui-preview';
import { localPreviewMatchDetails } from '../../../core/helpers/local-match-preview';

/** UI examples are opt-in and never available in deployed builds or the billing lab. */
export function popularPreviewAllowed(config: { production: boolean; billingLab: boolean }, hostname: string): boolean {
    return localUiPreviewAllowed(config, hostname);
}

type ExamplePlayer = { name: string; iso2: string; iso3: string; country: string; seed: string; rank: string };
const players: ExamplePlayer[] = [
    { name: 'Marin Luka', iso2: 'hr', iso3: 'HRV', country: 'Croatia', seed: '3', rank: '42' },
    { name: 'Hart Alexander James', iso2: 'gb', iso3: 'GBR', country: 'United Kingdom', seed: 'Q', rank: '118' },
    { name: 'Sato Emi', iso2: 'jp', iso3: 'JPN', country: 'Japan', seed: '1', rank: '16' },
    { name: 'Dubois Camille', iso2: 'fr', iso3: 'FRA', country: 'France', seed: '', rank: '73' },
    { name: 'Bergström Elin Sofia', iso2: 'se', iso3: 'SWE', country: 'Sweden', seed: 'WC', rank: '205' },
    { name: 'Costa Lia', iso2: 'pt', iso3: 'PRT', country: 'Portugal', seed: '8', rank: '94' },
];

export function popularPreviewPlayerIndex(id: number): PlayerIndex | null {
    if (!Number.isSafeInteger(id) || id >= 0) return null;
    const offset = -id - 1, player = players[offset];
    if (!player) return null;
    return { playerTPId: id, playerName: player.name, countryISO2: player.iso2, countryISO3: player.iso3, countryFull: player.country,
        playerBirthDate: `199${offset + 1}-05-12`, playerHeight: 175 + offset * 2, playerWeight: 68 + offset * 3,
        playerTurnedPro: 2010 + offset, playsId: 1, playsName: 'Right-handed',
        averageTSMean: 25 + offset * .6, peakTsMean: 28 + offset * .5, currentTsMean: 26 + offset * .7,
        totalMatches: 120 + offset * 43, numberOfMatches: 120 + offset * 43, winPercentage: .61 + offset * .045,
        dateOfLastMatch: '2026-10-18' };
}

/** A local overview only; no fictional NN output, account access or live discussion. */
export function popularPreviewMatchDetails(item: PopularMatch): MatchDetailsRaw | null {
    if (item.id >= 0 || item.match.matchTPId !== item.id) return null;
    const match = item.match, first = popularPreviewPlayerIndex(match.player1TPId), second = popularPreviewPlayerIndex(match.player2TPId);
    if (!first || !second) return null;
    return localPreviewMatchDetails(match, [first, second]);
}

/** Negative IDs cannot collide with real records. No fixture is ever posted to an API. */
export function createPopularPreview(): PopularityRanking {
    const examples = [
        [0, 1, 'Adriatic Demo Open', '21', '6:4 4:6 6:3'], [2, 3, 'Autumn Demo Cup', '20', '6:2 7:6(4)'],
        [4, 5, 'Northern Demo Classic', '12', '6:3 4:6 5:7'], [1, 0, 'Indoor Demo Masters', '20', '7:5 6:4'],
        [3, 2, 'Coastal Demo Open', '', ''],
    ] as const;
    const matches: PopularMatch[] = examples.map(([first, second, tournament, result, resultDetails], index) => {
        const p1 = players[first], p2 = players[second], id = -(index + 1);
        const dateTime = `2026-10-${18 - index}T14:30:00Z`;
        const match: Match = {
            matchTPId: id, dateTime, sourceTimePrecision: 'minute', isFinished: !!result, result, resultDetails,
            roundName: 'SF', surface: index === 3 ? 'carpet' : 'hard', tournamentStrengthMeanTS: 25 + index * .75,
            tournamentTypeName: first < 2 ? 'ATP' : 'WTA', tournamentEventTPId: id, tournamentEventName: tournament,
            tournamentEventCountryTPId: 0, tournamentEventCountryISO2: 'hr', tournamentEventCountryISO3: 'HRV', tournamentEventCountryFull: 'Croatia',
            player1TPId: -(first + 1), player1Name: p1.name, player1CountryTPId: 0,
            player1CountryISO2: p1.iso2, player1CountryISO3: p1.iso3, player1CountryFull: p1.country, player1Seed: p1.seed, player1Rank: p1.rank,
            player2TPId: -(second + 1), player2Name: p2.name, player2CountryTPId: 0,
            player2CountryISO2: p2.iso2, player2CountryISO3: p2.iso3, player2CountryFull: p2.country, player2Seed: p2.seed, player2Rank: p2.rank,
        };
        return { id, player1: p1.name, player2: p2.name, tournament, date: dateTime.slice(0, 10), match };
    });
    return { environment: 'ui-demo', available: true, generatedAt: '2026-10-18T15:00:00Z', halfLifeDays: 7, windowDays: 28, matches,
        players: players.slice(0, 5).map((player, i) => ({ id: -(i + 1), name: player.name, country: player.country,
            gender: i < 2 ? 'M' : 'W', index: popularPreviewPlayerIndex(-(i + 1))! })) };
}
