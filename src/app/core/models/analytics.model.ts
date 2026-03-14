export interface ChartPoint {
    label: string;
    value: number;
  }
  
  export interface MetricCard {
    key: string;
    label: string;
    value: string;
  }
  
  export interface DateRange {
    from: string | null;
    to: string | null;
  }
  
  export interface OverviewAnalytics {
    cards: MetricCard[];
    dateRange: DateRange;
    tournamentTypeSplit: ChartPoint[];
    matchStatusSplit: ChartPoint[];
  }
  
  export interface MatchLandscapeAnalytics {
    matchesBySurface: ChartPoint[];
    matchesByYear: ChartPoint[];
    matchesByRound: ChartPoint[];
    matchLengthSplit: ChartPoint[];
    averageOfferedBookiesPerMatch: string;
  }
  
  export interface TournamentInsightsAnalytics {
    tournamentsByLevel: ChartPoint[];
    tournamentsBySurface: ChartPoint[];
    topCountriesByTournamentCount: ChartPoint[];
    averageStrengthMeanTsByLevel: ChartPoint[];
  }
  
  export interface MarketBehaviourAnalytics {
    favoriteWinRateByImpliedProbabilityBucket: ChartPoint[];
    underdogWinRateByImpliedProbabilityBucket: ChartPoint[];
    oddsCoverageOverTime: ChartPoint[];
    averageBookiesPerMatchByYear: ChartPoint[];
    suspiciousOddsShare: string;
  }
  
  export interface AnalyticsDashboard {
    schemaVersion: number;
    generatedAtUtc: string;
    overview: OverviewAnalytics;
    matchLandscape: MatchLandscapeAnalytics;
    tournamentInsights: TournamentInsightsAnalytics;
    marketBehaviour: MarketBehaviourAnalytics;
  }