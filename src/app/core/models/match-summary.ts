import { Match } from './tennis.model';

export type MatchSummary = Pick<Match, 'matchTPId'> & Partial<Pick<Match,
    'matchId' | 'player1TPId' | 'player2TPId' | 'tournamentEventTPId' | 'dateTime' | 'sourceTimePrecision' | 'tournamentEventName' | 'isFinished' | 'result' | 'resultDetails' | 'qualityStatus' |
    'tournamentEventCountryISO2' | 'tournamentEventCountryISO3' | 'tournamentEventCountryFull' | 'tournamentTypeName' |
    'tournamentLevelName' | 'surface' | 'roundName' | 'tournamentStrengthMeanTS' | 'prize' | 'predictionEligible' |
    'marketOddsVerified' | 'player1Odds' | 'player2Odds' | 'legacyPlayer1Odds' | 'legacyPlayer2Odds' |
    'modelProbabilityPlayer1' | 'modelProbabilityPlayer2' |
    'player1Name' | 'player1CountryISO2' | 'player1CountryISO3' | 'player1CountryFull' | 'player1Rank' | 'player1Seed' |
    'player2Name' | 'player2CountryISO2' | 'player2CountryISO3' | 'player2CountryFull' | 'player2Rank' | 'player2Seed'>>;

export type DiscussionEntityTarget = { kind: 'player'; id: number; side: 1 | 2; match: MatchSummary }
    | { kind: 'tournament'; id: number; match: MatchSummary };
