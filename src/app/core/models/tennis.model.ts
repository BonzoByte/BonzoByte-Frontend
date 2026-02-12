export interface Country {
  countryISO2: string;
  countryISO3: string;
  countryFull?: string;
}

export interface Player {
  playerTPId: number;
  playerName: string;
  playerSeed?: string;
  countryTPId?: Country;
  playerBirthDate?: string;
  playerHeight?: number;
  playerWeight?: number;
  playerTurnedPro?: number;
  playsId?: { plays: string };
  trueSkillMean?: number;
  careerTrueSkillMean?: number;
}

export interface PlayerIndex {
  playerTPId: number;
  playerName: string | null;

  countryTPId?: number | null;
  countryISO3?: string | null;
  countryISO2?: string | null;
  countryFull?: string | null;

  continentId?: number | null;
  continentName?: string | null;

  playerBirthDate?: string | null;   // ISO string
  playerHeight?: number | null;
  playerWeight?: number | null;
  playerTurnedPro?: number | null;

  playsId?: number | null;
  playsName?: string | null;

  averageTSMean?: number | null;
  peakTsMean?: number | null;
  currentTsMean?: number | null;
  numberOfMatches?: number | null;
  dateOfLastMatch?: string | null;   // ISO string
  winPercentage?: number | null;     // 0..1
}

export interface TournamentType {
  tournamentTypeId: string;
  tournamentType: string;
}

export interface TournamentLevel {
  tournamentLevelId: string;
  tournamentLevel: string;
}

export interface TrueSkillHistoryResponse {
  player1TPId: number;
  player2TPId: number;
  player1History: { dateTime: string; mean: number; sd: number }[];
  player2History: { dateTime: string; mean: number; sd: number }[];
}

export interface MergedTrueSkillEntry {
  dateTime: string; // ISO format
  player1: { mean: number; sd: number };
  player2: { mean: number; sd: number };
}

export interface TournamentEvent {
  tournamentEventId: number;
  matchDate: string;
  tournamentEventName: string;

  countryTPId?: number;
  countryISO2?: string;
  countryISO3?: string;
  countryFull?: string;

  tournamentLevelId?: number;
  tournamentLevel?: string;

  tournamentTypeId?: number;
  tournamentType?: string;

  surfaceId?: number;
  surface?: string;

  prize?: string;
  matches?: number;
}

export interface TournamentIndex {
  tournamentEventTPId: number;
  tournamentEventName: string | null;

  countryTPId?: number | null;
  countryISO3?: string | null;
  countryISO2?: string | null;
  countryFull?: string | null;

  continentId?: number | null;
  continentName?: string | null;

  tournamentEventDate?: string | null; // ISO
  tournamentLevelId?: number | null;
  tournamentLevelName?: string | null;

  tournamentTypeId?: number | null;
  tournamentTypeName?: string | null;

  prize?: number | null;

  surfaceId?: number | null;
  surfaceName?: string | null;

  strengthMeanTS?: number | null;
  strengthPlayers?: number | null;

  numberOfMatches?: number | null;
  dateOfLastMatch?: string | null; // ISO

  averageMatchStrength?: number | null;
  peakMatchStrength?: number | null;
}

export interface Surface {
  surfaceId: string;
  surface: string;
}

export interface Match {
  matchTPId: number;
  // _id: number;
  isFinished: boolean;
  dateTime: string;
  result?: string;
  resultDetails?: string;
  surfaceId?: number;
  surface?: string;
  roundName: string;
  tournamentEventTPId: number;
  tournamentEventCountryTPId: number;
  tournamentEventCountryISO2: string;
  tournamentEventCountryISO3: string;
  tournamentEventCountryFull: string;
  tournamentEventName?: string;
  tournamentLevelId?: number;
  tournamentLevelName?: string;
  tournamentStrengthMeanTS?: number | null;
  tournamentTypeId?: number;
  tournamentTypeName?: string;
  player1TPId: number;
  player1CountryTPId: number;
  player1CountryISO2: string;
  player1CountryISO3: string;
  player1CountryFull: string;
  player1Name?: string;
  player1Seed?: string;
  player1Rank?: string;
  player2TPId: number;
  player2CountryTPId: number;
  player2CountryISO2: string;
  player2CountryISO3: string;
  player2CountryFull: string;
  player2Name?: string;
  player2Seed?: string;
  player2Rank?: string;
  player1Odds?: number;
  player2Odds?: number;
  winProbabilityPlayer1NN?: number;
  winProbabilityPlayer2NN?: number;
  valueMarginPlayer1?: number;
  valueMarginPlayer2?: number;
  who2Bet?: number;
  prize?: number;
  // --- formatirana polja koja dolaze s /api/archives/daily ---
  tournamentCleanName?: string | null; // "Monastir" (bez sufiksa/zagrada)
  surfaceDisplay?: string | null;      // prazno ako je 'unknown'
  who2BetName?: string | null;         // "Player 1" / "Player 2" / null

  /** UI/formatirana polja iz /api/archives/daily */
  tournamentEventCountryISO2Display?: string;
  player1CountryISO2Display?: string;
  player2CountryISO2Display?: string;

  tournamentTitle?: string;         // npr. "Canberra (AUS)"
  tournamentType?: string;          // npr. "ATP"
  tournamentLevel?: string;         // npr. ">50K"

  player1Label?: string;            // "Ime [Seed] (ISO3)"
  player2Label?: string;

  resultText?: string;              // "2:0"
  resultDetailsText?: string;       // "6:2 7:6(3)"

  oddsText?: string | null;         // "1.52 - 2.43"
  probabilityText?: string | null;  // "76.31 - 23.69"

  // za savr�eno poravnanje oko crtice:
  oddsLeft?: string;                // figure-space padded " 1.52"
  oddsRight?: string;               // " 2.43"
  probLeft?: string;                // "76.31"
  probRight?: string;               // "23.69"
}

export interface DetailedMatch {
  _id: number;
  dateTime: string;
  result?: string;
  resultDetails?: string;
  surfaceId?: number;
  surface?: string;
  tournamentEventTPId: number;
  tournamentEventCountryTPId: number;
  tournamentEventCountryISO2: string;
  tournamentEventCountryISO3: string;
  tournamentEventCountryFull: string;
  tournamentEventName?: string;
  tournamentLevelId?: number;
  tournamentLevel?: string;
  tournamentTypeId?: number;
  tournamentType?: string;
  player1TPId: number;
  player1CountryTPId: number;
  player1CountryISO2: string;
  player1CountryISO3: string;
  player1CountryFull: string;
  player1Name?: string;
  player1Seed?: string;
  player2TPId: number;
  player2CountryTPId: number;
  player2CountryISO2: string;
  player2CountryISO3: string;
  player2CountryFull: string;
  player2Name?: string;
  player2Seed?: string;
  player1Odds?: number;
  player2Odds?: number;
  winProbabilityPlayer1NN?: number;
  winProbabilityPlayer2NN?: number;
  valueMarginPlayer1?: number;
  valueMarginPlayer2?: number;
  who2Bet?: number;
  prize?: number;
  player1TrueSkillMeanOldM: number;
  player1TrueSkillStandardDeviationOldM: number;
  player2TrueSkillMeanOldM: number;
  player2TrueSkillStandardDeviationOldM: number;
  winProbabilityplayer1M: number;
  winProbabilityplayer2M: number;
  player1TrueSkillMeanOldSM: number;
  player1TrueSkillStandardDeviationOldSM: number;
  player2TrueSkillMeanOldSM: number;
  player2TrueSkillStandardDeviationOldSM: number;
  winProbabilityplayer1SM: number;
  winProbabilityplayer2SM: number;
  player1TrueSkillMeanOldGSM: number;
  player1TrueSkillStandardDeviationOldGSM: number;
  player2TrueSkillMeanOldGSM: number;
  player2TrueSkillStandardDeviationOldGSM: number;
  winProbabilityplayer1GSM: number;
  winProbabilityplayer2GSM: number;
  player1TrueSkillMeanOldMS1: number;
  player1TrueSkillStandardDeviationOldMS1: number;
  player2TrueSkillMeanOldMS1: number;
  player2TrueSkillStandardDeviationOldMS1: number;
  winProbabilityplayer1MS1: number;
  winProbabilityplayer2MS1: number;
  player1TrueSkillMeanOldSMS1: number;
  player1TrueSkillStandardDeviationOldSMS1: number;
  player2TrueSkillMeanOldSMS1: number;
  player2TrueSkillStandardDeviationOldSMS1: number;
  winProbabilityplayer1SMS1: number;
  winProbabilityplayer2SMS1: number;
  player1TrueSkillMeanOldGSMS1: number;
  player1TrueSkillStandardDeviationOldGSMS1: number;
  player2TrueSkillMeanOldGSMS1: number;
  player2TrueSkillStandardDeviationOldGSMS1: number;
  winProbabilityplayer1GSMS1: number;
  winProbabilityplayer2GSMS1: number;
  player1TrueSkillMeanOldMS2: number;
  player1TrueSkillStandardDeviationOldMS2: number;
  player2TrueSkillMeanOldMS2: number;
  player2TrueSkillStandardDeviationOldMS2: number;
  winProbabilityplayer1MS2: number;
  winProbabilityplayer2MS2: number;
  player1TrueSkillMeanOldSMS2: number;
  player1TrueSkillStandardDeviationOldSMS2: number;
  player2TrueSkillMeanOldSMS2: number;
  player2TrueSkillStandardDeviationOldSMS2: number;
  winProbabilityplayer1SMS2: number;
  winProbabilityplayer2SMS2: number;
  player1TrueSkillMeanOldGSMS2: number;
  player1TrueSkillStandardDeviationOldGSMS2: number;
  player2TrueSkillMeanOldGSMS2: number;
  player2TrueSkillStandardDeviationOldGSMS2: number;
  winProbabilityplayer1GSMS2: number;
  winProbabilityplayer2GSMS2: number;
  player1TrueSkillMeanOldMS3: number;
  player1TrueSkillStandardDeviationOldMS3: number;
  player2TrueSkillMeanOldMS3: number;
  player2TrueSkillStandardDeviationOldMS3: number;
  winProbabilityplayer1MS3: number;
  winProbabilityplayer2MS3: number;
  player1TrueSkillMeanOldSMS3: number;
  player1TrueSkillStandardDeviationOldSMS3: number;
  player2TrueSkillMeanOldSMS3: number;
  player2TrueSkillStandardDeviationOldSMS3: number;
  winProbabilityplayer1SMS3: number;
  winProbabilityplayer2SMS3: number;
  player1TrueSkillMeanOldGSMS3: number;
  player1TrueSkillStandardDeviationOldGSMS3: number;
  player2TrueSkillMeanOldGSMS3: number;
  player2TrueSkillStandardDeviationOldGSMS3: number;
  winProbabilityplayer1GSMS3: number;
  winProbabilityplayer2GSMS3: number;
  player1TrueSkillMeanOldMS4: number;
  player1TrueSkillStandardDeviationOldMS4: number;
  player2TrueSkillMeanOldMS4: number;
  player2TrueSkillStandardDeviationOldMS4: number;
  winProbabilityplayer1MS4: number;
  winProbabilityplayer2MS4: number;
  player1TrueSkillMeanOldSMS4: number;
  player1TrueSkillStandardDeviationOldSMS4: number;
  player2TrueSkillMeanOldSMS4: number;
  player2TrueSkillStandardDeviationOldSMS4: number;
  winProbabilityplayer1SMS4: number;
  winProbabilityplayer2SMS4: number;
  player1TrueSkillMeanOldGSMS4: number;
  player1TrueSkillStandardDeviationOldGSMS4: number;
  player2TrueSkillMeanOldGSMS4: number;
  player2TrueSkillStandardDeviationOldGSMS4: number;
  winProbabilityplayer1GSMS4: number;
  winProbabilityplayer2GSMS4: number;
  player1MatchesTotalS1: number;
  player1MatchesTotal: number;
  player1MatchesWinRatio: number;
  player1MatchesLossRatio: number;
  player1WinsTotal: number;
  player1LossesTotal: number;
  player1MatchesLastYear: number;
  player1MatchesLastYearWinRatio: number;
  player1MatchesLastYearLossRatio: number;
  player1WinsLastYear: number;
  player1LossesLastYear: number;
  player1MatchesLastMonth: number;
  player1MatchesLastMonthWinRatio: number;
  player1MatchesLastMonthLossRatio: number;
  player1WinsLastMonth: number;
  player1LossesLastMonth: number;
  player1MatchesLastWeek: number;
  player1MatchesLastWeekWinRatio: number;
  player1MatchesLastWeekLossRatio: number;
  player1WinsLastWeek: number;
  player1LossesLastWeek: number;
  player2MatchesTotal: number;
  player2MatchesWinRatio: number;
  player2MatchesLossRatio: number;
  player2WinsTotal: number;
  player2LossesTotal: number;
  player2MatchesLastYear: number;
  player2MatchesLastYearWinRatio: number;
  player2MatchesLastYearLossRatio: number;
  player2WinsLastYear: number;
  player2LossesLastYear: number;
  player2MatchesLastMonth: number;
  player2MatchesLastMonthWinRatio: number;
  player2MatchesLastMonthLossRatio: number;
  player2WinsLastMonth: number;
  player2LossesLastMonth: number;
  player2MatchesLastWeek: number;
  player2MatchesLastWeekWinRatio: number;
  player2MatchesLastWeekLossRatio: number;
  player2WinsLastWeek: number;
  player2LossesLastWeek: number;
  player1MatchesTotalS1WinRatio: number;
  player1MatchesTotalS1LossRatio: number;
  player1WinsTotalS1: number;
  player1LossesTotalS1: number;
  player1MatchesLastYearS1: number;
  player1MatchesLastYearS1WinRatio: number;
  player1MatchesLastYearS1LossRatio: number;
  player1WinsLastYearS1: number;
  player1LossesLastYearS1: number;
  player1MatchesLastMonthS1: number;
  player1MatchesLastMonthS1WinRatio: number;
  player1MatchesLastMonthS1LossRatio: number;
  player1WinsLastMonthS1: number;
  player1LossesLastMonthS1: number;
  player1MatchesLastWeekS1: number;
  player1MatchesLastWeekS1WinRatio: number;
  player1MatchesLastWeekS1LossRatio: number;
  player1WinsLastWeekS1: number;
  player1LossesLastWeekS1: number;
  player2MatchesTotalS1: number;
  player2MatchesTotalS1WinRatio: number;
  player2MatchesTotalS1LossRatio: number;
  player2WinsTotalS1: number;
  player2LossesTotalS1: number;
  player2MatchesLastYearS1: number;
  player2MatchesLastYearS1WinRatio: number;
  player2MatchesLastYearS1LossRatio: number;
  player2WinsLastYearS1: number;
  player2LossesLastYearS1: number;
  player2MatchesLastMonthS1: number;
  player2MatchesLastMonthS1WinRatio: number;
  player2MatchesLastMonthS1LossRatio: number;
  player2WinsLastMonthS1: number;
  player2LossesLastMonthS1: number;
  player2MatchesLastWeekS1: number;
  player2MatchesLastWeekS1WinRatio: number;
  player2MatchesLastWeekS1LossRatio: number;
  player2WinsLastWeekS1: number;
  player2LossesLastWeekS1: number;
  player1MatchesTotalS2: number;
  player1MatchesTotalS2WinRatio: number;
  player1MatchesTotalS2LossRatio: number;
  player1WinsTotalS2: number;
  player1LossesTotalS2: number;
  player1MatchesLastYearS2: number;
  player1MatchesLastYearS2WinRatio: number;
  player1MatchesLastYearS2LossRatio: number;
  player1WinsLastYearS2: number;
  player1LossesLastYearS2: number;
  player1MatchesLastMonthS2: number;
  player1MatchesLastMonthS2WinRatio: number;
  player1MatchesLastMonthS2LossRatio: number;
  player1WinsLastMonthS2: number;
  player1LossesLastMonthS2: number;
  player1MatchesLastWeekS2: number;
  player1MatchesLastWeekS2WinRatio: number;
  player1MatchesLastWeekS2LossRatio: number;
  player1WinsLastWeekS2: number;
  player1LossesLastWeekS2: number;
  player2MatchesTotalS2: number;
  player2MatchesTotalS2WinRatio: number;
  player2MatchesTotalS2LossRatio: number;
  player2WinsTotalS2: number;
  player2LossesTotalS2: number;
  player2MatchesLastYearS2: number;
  player2MatchesLastYearS2WinRatio: number;
  player2MatchesLastYearS2LossRatio: number;
  player2WinsLastYearS2: number;
  player2LossesLastYearS2: number;
  player2MatchesLastMonthS2: number;
  player2MatchesLastMonthS2WinRatio: number;
  player2MatchesLastMonthS2LossRatio: number;
  player2WinsLastMonthS2: number;
  player2LossesLastMonthS2: number;
  player2MatchesLastWeekS2: number;
  player2MatchesLastWeekS2WinRatio: number;
  player2MatchesLastWeekS2LossRatio: number;
  player2WinsLastWeekS2: number;
  player2LossesLastWeekS2: number;
  player1MatchesTotalS3: number;
  player1MatchesTotalS3WinRatio: number;
  player1MatchesTotalS3LossRatio: number;
  player1WinsTotalS3: number;
  player1LossesTotalS3: number;
  player1MatchesLastYearS3: number;
  player1MatchesLastYearS3WinRatio: number;
  player1MatchesLastYearS3LossRatio: number;
  player1WinsLastYearS3: number;
  player1LossesLastYearS3: number;
  player1MatchesLastMonthS3: number;
  player1MatchesLastMonthS3WinRatio: number;
  player1MatchesLastMonthS3LossRatio: number;
  player1WinsLastMonthS3: number;
  player1LossesLastMonthS3: number;
  player1MatchesLastWeekS3: number;
  player1MatchesLastWeekS3WinRatio: number;
  player1MatchesLastWeekS3LossRatio: number;
  player1WinsLastWeekS3: number;
  player1LossesLastWeekS3: number;
  player2MatchesTotalS3: number;
  player2MatchesTotalS3WinRatio: number;
  player2MatchesTotalS3LossRatio: number;
  player2WinsTotalS3: number;
  player2LossesTotalS3: number;
  player2MatchesLastYearS3: number;
  player2MatchesLastYearS3WinRatio: number;
  player2MatchesLastYearS3LossRatio: number;
  player2WinsLastYearS3: number;
  player2LossesLastYearS3: number;
  player2MatchesLastMonthS3: number;
  player2MatchesLastMonthS3WinRatio: number;
  player2MatchesLastMonthS3LossRatio: number;
  player2WinsLastMonthS3: number;
  player2LossesLastMonthS3: number;
  player2MatchesLastWeekS3: number;
  player2MatchesLastWeekS3WinRatio: number;
  player2MatchesLastWeekS3LossRatio: number;
  player2WinsLastWeekS3: number;
  player2LossesLastWeekS3: number;
  player1MatchesTotalS4: number;
  player1MatchesTotalS4WinRatio: number;
  player1MatchesTotalS4LossRatio: number;
  player1WinsTotalS4: number;
  player1LossesTotalS4: number;
  player1MatchesLastYearS4: number;
  player1MatchesLastYearS4WinRatio: number;
  player1MatchesLastYearS4LossRatio: number;
  player1WinsLastYearS4: number;
  player1LossesLastYearS4: number;
  player1MatchesLastMonthS4: number;
  player1MatchesLastMonthS4WinRatio: number;
  player1MatchesLastMonthS4LossRatio: number;
  player1WinsLastMonthS4: number;
  player1LossesLastMonthS4: number;
  player1MatchesLastWeekS4: number;
  player1MatchesLastWeekS4WinRatio: number;
  player1MatchesLastWeekS4LossRatio: number;
  player1WinsLastWeekS4: number;
  player1LossesLastWeekS4: number;
  player2MatchesTotalS4: number;
  player2MatchesTotalS4WinRatio: number;
  player2MatchesTotalS4LossRatio: number;
  player2WinsTotalS4: number;
  player2LossesTotalS4: number;
  player2MatchesLastYearS4: number;
  player2MatchesLastYearS4WinRatio: number;
  player2MatchesLastYearS4LossRatio: number;
  player2WinsLastYearS4: number;
  player2LossesLastYearS4: number;
  player2MatchesLastMonthS4: number;
  player2MatchesLastMonthS4WinRatio: number;
  player2MatchesLastMonthS4LossRatio: number;
  player2WinsLastMonthS4: number;
  player2LossesLastMonthS4: number;
  player2MatchesLastWeekS4: number;
  player2MatchesLastWeekS4WinRatio: number;
  player2MatchesLastWeekS4LossRatio: number;
  player2WinsLastWeekS4: number;
  player2LossesLastWeekS4: number;
  player1SetsTotal: number;
  player1SetsWinRatio: number;
  player1SetsLossRatio: number;
  player1WinsSetsTotal: number;
  player1LossesSetsTotal: number;
  player1SetsLastYear: number;
  player1setsLastYearWinRatio: number;
  player1setsLastYearLossRatio: number;
  player1WinsSetsLastYear: number;
  player1LossesSetsLastYear: number;
  player1SetsLastMonth: number;
  player1SetsLastMonthWinRatio: number;
  player1SetsLastMonthLossRatio: number;
  player1WinsSetsLastMonth: number;
  player1LossesSetsLastMonth: number;
  player1SetsLastWeek: number;
  player1SetsLastWeekWinRatio: number;
  player1SetsLastWeekLossRatio: number;
  player1WinsSetsLastWeek: number;
  player1LossesSetsLastWeek: number;
  player2SetsTotal: number;
  player2SetsWinRatio: number;
  player2SetsLossRatio: number;
  player2WinsSetsTotal: number;
  player2LossesSetsTotal: number;
  player2SetsLastYear: number;
  player2setsLastYearWinRatio: number;
  player2setsLastYearLossRatio: number;
  player2WinsSetsLastYear: number;
  player2LossesSetsLastYear: number;
  player2SetsLastMonth: number;
  player2SetsLastMonthWinRatio: number;
  player2SetsLastMonthLossRatio: number;
  player2WinsSetsLastMonth: number;
  player2LossesSetsLastMonth: number;
  player2SetsLastWeek: number;
  player2SetsLastWeekWinRatio: number;
  player2SetsLastWeekLossRatio: number;
  player2WinsSetsLastWeek: number;
  player2LossesSetsLastWeek: number;
  player1SetsTotalS1: number;
  player1SetsWinRatioS1: number;
  player1SetsLossRatioS1: number;
  player1WinsSetsTotalS1: number;
  player1LossesSetsTotalS1: number;
  player1SetsLastYearS1: number;
  player1SetsLastYearS1WinRatio: number;
  player1SetsLastYearS1LossRatio: number;
  player1WinsSetsLastYearS1: number;
  player1LossesSetsLastYearS1: number;
  player1SetsLastMonthS1: number;
  player1SetsLastMonthS1WinRatio: number;
  player1SetsLastMonthS1LossRatio: number;
  player1WinsSetsLastMonthS1: number;
  player1LossesSetsLastMonthS1: number;
  player1SetsLastWeekS1: number;
  player1SetsLastWeekS1WinRatio: number;
  player1SetsLastWeekS1LossRatio: number;
  player1WinsSetsLastWeekS1: number;
  player1LossesSetsLastWeekS1: number;
  player2SetsTotalS1: number;
  player2SetsWinRatioS1: number;
  player2SetsLossRatioS1: number;
  player2WinsSetsTotalS1: number;
  player2LossesSetsTotalS1: number;
  player2SetsLastYearS1: number;
  player2SetsLastYearS1WinRatio: number;
  player2SetsLastYearS1LossRatio: number;
  player2WinsSetsLastYearS1: number;
  player2LossesSetsLastYearS1: number;
  player2SetsLastMonthS1: number;
  player2SetsLastMonthS1WinRatio: number;
  player2SetsLastMonthS1LossRatio: number;
  player2WinsSetsLastMonthS1: number;
  player2LossesSetsLastMonthS1: number;
  player2SetsLastWeekS1: number;
  player2SetsLastWeekS1WinRatio: number;
  player2SetsLastWeekS1LossRatio: number;
  player2WinsSetsLastWeekS1: number;
  player2LossesSetsLastWeekS1: number;
  player1SetsTotalS2: number;
  player1SetsWinRatioS2: number;
  player1SetsLossRatioS2: number;
  player1WinsSetsTotalS2: number;
  player1LossesSetsTotalS2: number;
  player1SetsLastYearS2: number;
  player1SetsLastYearS2WinRatio: number;
  player1SetsLastYearS2LossRatio: number;
  player1WinsSetsLastYearS2: number;
  player1LossesSetsLastYearS2: number;
  player1SetsLastMonthS2: number;
  player1SetsLastMonthS2WinRatio: number;
  player1SetsLastMonthS2LossRatio: number;
  player1WinsSetsLastMonthS2: number;
  player1LossesSetsLastMonthS2: number;
  player1SetsLastWeekS2: number;
  player1SetsLastWeekS2WinRatio: number;
  player1SetsLastWeekS2LossRatio: number;
  player1WinsSetsLastWeekS2: number;
  player1LossesSetsLastWeekS2: number;
  player2SetsTotalS2: number;
  player2SetsWinRatioS2: number;
  player2SetsLossRatioS2: number;
  player2WinsSetsTotalS2: number;
  player2LossesSetsTotalS2: number;
  player2SetsLastYearS2: number;
  player2SetsLastYearS2WinRatio: number;
  player2SetsLastYearS2LossRatio: number;
  player2WinsSetsLastYearS2: number;
  player2LossesSetsLastYearS2: number;
  player2SetsLastMonthS2: number;
  player2SetsLastMonthS2WinRatio: number;
  player2SetsLastMonthS2LossRatio: number;
  player2WinsSetsLastMonthS2: number;
  player2LossesSetsLastMonthS2: number;
  player2SetsLastWeekS2: number;
  player2SetsLastWeekS2WinRatio: number;
  player2SetsLastWeekS2LossRatio: number;
  player2WinsSetsLastWeekS2: number;
  player2LossesSetsLastWeekS2: number;
  player1SetsTotalS3: number;
  player1SetsWinRatioS3: number;
  player1SetsLossRatioS3: number;
  player1WinsSetsTotalS3: number;
  player1LossesSetsTotalS3: number;
  player1SetsLastYearS3: number;
  player1SetsLastYearS3WinRatio: number;
  player1SetsLastYearS3LossRatio: number;
  player1WinsSetsLastYearS3: number;
  player1LossesSetsLastYearS3: number;
  player1SetsLastMonthS3: number;
  player1SetsLastMonthS3WinRatio: number;
  player1SetsLastMonthS3LossRatio: number;
  player1WinsSetsLastMonthS3: number;
  player1LossesSetsLastMonthS3: number;
  player1SetsLastWeekS3: number;
  player1SetsLastWeekS3WinRatio: number;
  player1SetsLastWeekS3LossRatio: number;
  player1WinsSetsLastWeekS3: number;
  player1LossesSetsLastWeekS3: number;
  player2SetsTotalS3: number;
  player2SetsWinRatioS3: number;
  player2SetsLossRatioS3: number;
  player2WinsSetsTotalS3: number;
  player2LossesSetsTotalS3: number;
  player2SetsLastYearS3: number;
  player2SetsLastYearS3WinRatio: number;
  player2SetsLastYearS3LossRatio: number;
  player2WinsSetsLastYearS3: number;
  player2LossesSetsLastYearS3: number;
  player2SetsLastMonthS3: number;
  player2SetsLastMonthS3WinRatio: number;
  player2SetsLastMonthS3LossRatio: number;
  player2WinsSetsLastMonthS3: number;
  player2LossesSetsLastMonthS3: number;
  player2SetsLastWeekS3: number;
  player2SetsLastWeekS3WinRatio: number;
  player2SetsLastWeekS3LossRatio: number;
  player2WinsSetsLastWeekS3: number;
  player2LossesSetsLastWeekS3: number;
  player1SetsTotalS4: number;
  player1SetsWinRatioS4: number;
  player1SetsLossRatioS4: number;
  player1WinsSetsTotalS4: number;
  player1LossesSetsTotalS4: number;
  player1SetsLastYearS4: number;
  player1SetsLastYearS4WinRatio: number;
  player1SetsLastYearS4LossRatio: number;
  player1WinsSetsLastYearS4: number;
  player1LossesSetsLastYearS4: number;
  player1SetsLastMonthS4: number;
  player1SetsLastMonthS4WinRatio: number;
  player1SetsLastMonthS4LossRatio: number;
  player1WinsSetsLastMonthS4: number;
  player1LossesSetsLastMonthS4: number;
  player1SetsLastWeekS4: number;
  player1SetsLastWeekS4WinRatio: number;
  player1SetsLastWeekS4LossRatio: number;
  player1WinsSetsLastWeekS4: number;
  player1LossesSetsLastWeekS4: number;
  player2SetsTotalS4: number;
  player2SetsWinRatioS4: number;
  player2SetsLossRatioS4: number;
  player2WinsSetsTotalS4: number;
  player2LossesSetsTotalS4: number;
  player2SetsLastYearS4: number;
  player2SetsLastYearS4WinRatio: number;
  player2SetsLastYearS4LossRatio: number;
  player2WinsSetsLastYearS4: number;
  player2LossesSetsLastYearS4: number;
  player2SetsLastMonthS4: number;
  player2SetsLastMonthS4WinRatio: number;
  player2SetsLastMonthS4LossRatio: number;
  player2WinsSetsLastMonthS4: number;
  player2LossesSetsLastMonthS4: number;
  player2SetsLastWeekS4: number;
  player2SetsLastWeekS4WinRatio: number;
  player2SetsLastWeekS4LossRatio: number;
  player2WinsSetsLastWeekS4: number;
  player2LossesSetsLastWeekS4: number;
  player1GamesTotal: number;
  player1GamesWinRatio: number;
  player1GamesLossRatio: number;
  player1WinsGamesTotal: number;
  player1LossesGamesTotal: number;
  player1GamesLastYear: number;
  player1GamesLastYearWinRatio: number;
  player1GamesLastYearLossRatio: number;
  player1WinsGamesLastYear: number;
  player1LossesGamesLastYear: number;
  player1GamesLastMonth: number;
  player1GamesLastMonthWinRatio: number;
  player1GamesLastMonthLossRatio: number;
  player1WinsGamesLastMonth: number;
  player1LossesGamesLastMonth: number;
  player1GamesLastWeek: number;
  player1GamesLastWeekWinRatio: number;
  player1GamesLastWeekLossRatio: number;
  player1WinsGamesLastWeek: number;
  player1LossesGamesLastWeek: number;
  player2GamesTotal: number;
  player2GamesWinRatio: number;
  player2GamesLossRatio: number;
  player2WinsGamesTotal: number;
  player2LossesGamesTotal: number;
  player2GamesLastYear: number;
  player2GamesLastYearWinRatio: number;
  player2GamesLastYearLossRatio: number;
  player2WinsGamesLastYear: number;
  player2LossesGamesLastYear: number;
  player2GamesLastMonth: number;
  player2GamesLastMonthWinRatio: number;
  player2GamesLastMonthLossRatio: number;
  player2WinsGamesLastMonth: number;
  player2LossesGamesLastMonth: number;
  player2GamesLastWeek: number;
  player2GamesLastWeekWinRatio: number;
  player2GamesLastWeekLossRatio: number;
  player2WinsGamesLastWeek: number;
  player2LossesGamesLastWeek: number;
  player1GamesTotalS1: number;
  player1GamesTotalS1WinRatio: number;
  player1GamesTotalS1LossRatio: number;
  player1WinsGamesTotalS1: number;
  player1LossesGamesTotalS1: number;
  player1GamesLastYearS1: number;
  player1GamesLastYearS1WinRatio: number;
  player1GamesLastYearS1LossRatio: number;
  player1WinsGamesLastYearS1: number;
  player1LossesGamesLastYearS1: number;
  player1GamesLastMonthS1: number;
  player1GamesLastMonthS1WinRatio: number;
  player1GamesLastMonthS1LossRatio: number;
  player1WinsGamesLastMonthS1: number;
  player1LossesGamesLastMonthS1: number;
  player1GamesLastWeekS1: number;
  player1GamesLastWeekS1WinRatio: number;
  player1GamesLastWeekS1LossRatio: number;
  player1WinsGamesLastWeekS1: number;
  player1LossesGamesLastWeekS1: number;
  player2GamesTotalS1: number;
  player2GamesTotalS1WinRatio: number;
  player2GamesTotalS1LossRatio: number;
  player2WinsGamesTotalS1: number;
  player2LossesGamesTotalS1: number;
  player2GamesLastYearS1: number;
  player2GamesLastYearS1WinRatio: number;
  player2GamesLastYearS1LossRatio: number;
  player2WinsGamesLastYearS1: number;
  player2LossesGamesLastYearS1: number;
  player2GamesLastMonthS1: number;
  player2GamesLastMonthS1WinRatio: number;
  player2GamesLastMonthS1LossRatio: number;
  player2WinsGamesLastMonthS1: number;
  player2LossesGamesLastMonthS1: number;
  player2GamesLastWeekS1: number;
  player2GamesLastWeekS1WinRatio: number;
  player2GamesLastWeekS1LossRatio: number;
  player2WinsGamesLastWeekS1: number;
  player2LossesGamesLastWeekS1: number;
  player1GamesTotalS2: number;
  player1GamesTotalS2WinRatio: number;
  player1GamesTotalS2LossRatio: number;
  player1WinsGamesTotalS2: number;
  player1LossesGamesTotalS2: number;
  player1GamesLastYearS2: number;
  player1GamesLastYearS2WinRatio: number;
  player1GamesLastYearS2LossRatio: number;
  player1WinsGamesLastYearS2: number;
  player1LossesGamesLastYearS2: number;
  player1GamesLastMonthS2: number;
  player1GamesLastMonthS2WinRatio: number;
  player1GamesLastMonthS2LossRatio: number;
  player1WinsGamesLastMonthS2: number;
  player1LossesGamesLastMonthS2: number;
  player1GamesLastWeekS2: number;
  player1GamesLastWeekS2WinRatio: number;
  player1GamesLastWeekS2LossRatio: number;
  player1WinsGamesLastWeekS2: number;
  player1LossesGamesLastWeekS2: number;
  player2GamesTotalS2: number;
  player2GamesTotalS2WinRatio: number;
  player2GamesTotalS2LossRatio: number;
  player2WinsGamesTotalS2: number;
  player2LossesGamesTotalS2: number;
  player2GamesLastYearS2: number;
  player2GamesLastYearS2WinRatio: number;
  player2GamesLastYearS2LossRatio: number;
  player2WinsGamesLastYearS2: number;
  player2LossesGamesLastYearS2: number;
  player2GamesLastMonthS2: number;
  player2GamesLastMonthS2WinRatio: number;
  player2GamesLastMonthS2LossRatio: number;
  player2WinsGamesLastMonthS2: number;
  player2LossesGamesLastMonthS2: number;
  player2GamesLastWeekS2: number;
  player2GamesLastWeekS2WinRatio: number;
  player2GamesLastWeekS2LossRatio: number;
  player2WinsGamesLastWeekS2: number;
  player2LossesGamesLastWeekS2: number;
  player1GamesTotalS3: number;
  player1GamesTotalS3WinRatio: number;
  player1GamesTotalS3LossRatio: number;
  player1WinsGamesTotalS3: number;
  player1LossesGamesTotalS3: number;
  player1GamesLastYearS3: number;
  player1GamesLastYearS3WinRatio: number;
  player1GamesLastYearS3LossRatio: number;
  player1WinsGamesLastYearS3: number;
  player1LossesGamesLastYearS3: number;
  player1GamesLastMonthS3: number;
  player1GamesLastMonthS3WinRatio: number;
  player1GamesLastMonthS3LossRatio: number;
  player1WinsGamesLastMonthS3: number;
  player1LossesGamesLastMonthS3: number;
  player1GamesLastWeekS3: number;
  player1GamesLastWeekS3WinRatio: number;
  player1GamesLastWeekS3LossRatio: number;
  player1WinsGamesLastWeekS3: number;
  player1LossesGamesLastWeekS3: number;
  player2GamesTotalS3: number;
  player2GamesTotalS3WinRatio: number;
  player2GamesTotalS3LossRatio: number;
  player2WinsGamesTotalS3: number;
  player2LossesGamesTotalS3: number;
  player2GamesLastYearS3: number;
  player2GamesLastYearS3WinRatio: number;
  player2GamesLastYearS3LossRatio: number;
  player2WinsGamesLastYearS3: number;
  player2LossesGamesLastYearS3: number;
  player2GamesLastMonthS3: number;
  player2GamesLastMonthS3WinRatio: number;
  player2GamesLastMonthS3LossRatio: number;
  player2WinsGamesLastMonthS3: number;
  player2LossesGamesLastMonthS3: number;
  player2GamesLastWeekS3: number;
  player2GamesLastWeekS3WinRatio: number;
  player2GamesLastWeekS3LossRatio: number;
  player2WinsGamesLastWeekS3: number;
  player2LossesGamesLastWeekS3: number;
  player1GamesTotalS4: number;
  player1GamesTotalS4WinRatio: number;
  player1GamesTotalS4LossRatio: number;
  player1WinsGamesTotalS4: number;
  player1LossesGamesTotalS4: number;
  player1GamesLastYearS4: number;
  player1GamesLastYearS4WinRatio: number;
  player1GamesLastYearS4LossRatio: number;
  player1WinsGamesLastYearS4: number;
  player1LossesGamesLastYearS4: number;
  player1GamesLastMonthS4: number;
  player1GamesLastMonthS4WinRatio: number;
  player1GamesLastMonthS4LossRatio: number;
  player1WinsGamesLastMonthS4: number;
  player1LossesGamesLastMonthS4: number;
  player1GamesLastWeekS4: number;
  player1GamesLastWeekS4WinRatio: number;
  player1GamesLastWeekS4LossRatio: number;
  player1WinsGamesLastWeekS4: number;
  player1LossesGamesLastWeekS4: number;
  player2GamesTotalS4: number;
  player2GamesTotalS4WinRatio: number;
  player2GamesTotalS4LossRatio: number;
  player2WinsGamesTotalS4: number;
  player2LossesGamesTotalS4: number;
  player2GamesLastYearS4: number;
  player2GamesLastYearS4WinRatio: number;
  player2GamesLastYearS4LossRatio: number;
  player2WinsGamesLastYearS4: number;
  player2LossesGamesLastYearS4: number;
  player2GamesLastMonthS4: number;
  player2GamesLastMonthS4WinRatio: number;
  player2GamesLastMonthS4LossRatio: number;
  player2WinsGamesLastMonthS4: number;
  player2LossesGamesLastMonthS4: number;
  player2GamesLastWeekS4: number;
  player2GamesLastWeekS4WinRatio: number;
  player2GamesLastWeekS4LossRatio: number;
  player2WinsGamesLastWeekS4: number;
  player2LossesGamesLastWeekS4: number;
}

export interface MatchApiResponse {
  matches: Match[];
  pagination?: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

export interface PlayerApiResponse {
  players: Player[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

export interface TournamentEventApiResponse {
  tournamentEvents: TournamentEvent[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

export interface TournamentEventDayApiResponse {
  tournaments: TournamentEvent[];
}