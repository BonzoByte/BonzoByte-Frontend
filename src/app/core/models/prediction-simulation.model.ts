export interface PredictionSimulationManifest {
  schema: string;
  schemaVersion: number;
  generatedAtUtc: string;
  localOnly: boolean;
  r2Published: boolean;
  report: {
    file: string;
    mediaType: string;
    contentEncoding: string;
    schema: string;
    schemaVersion: number;
    compressedBytes: number;
    uncompressedBytes: number;
    sha256: string;
    uncompressedSha256: string;
  };
}

export interface PredictionSimulationReport {
  schema: string;
  schemaVersion: number;
  reportKind: string;
  generatedAtUtc: string;
  window: {
    fromInclusive: string;
    toExclusive: string | null;
  };
  labels: {
    researchOnly: boolean;
    noGuaranteedProfit: boolean;
    oddsTimestampStatus: string;
    priceInterpretation: string;
    strictTemporalAvailable: boolean;
    strictTemporalMode: string;
    localOnly: boolean;
    r2Published: boolean;
    disclosure: string;
  };
  provenance: {
    predictionSource: string;
    oddsSource: string;
    databaseReadOnly: boolean;
    outcomeContract: string;
    pricePairingContract: string;
    valueSelectionContract: string;
    reportGenerator: string;
  };
  productionSummary: PredictionProductionSummary | null;
  models: PredictionSimulationModel[];
}

export interface PredictionProductionSummary {
  predictionSource: string;
  pricePolicy: string;
  refreshMode: string;
  interpretation: string;
  sourceMatches: number;
  firstMatch: string | null;
  lastMatch: string | null;
  cohorts: PredictionProductionSummaryCohort[];
}

export interface PredictionProductionSummaryCohort {
  scope: 'ALL' | 'ATP' | 'WTA';
  minimumEdge: number;
  candidateMatches: number;
  bets: number;
  wins: number;
  losses: number;
  coverage: number;
  hitRate: number;
  averageCompleteBookmakers: number;
  averageMedianOdds: number;
  averageMarketFairProbability: number;
  averageMarketFairOdds: number;
  averageModelProbability: number;
  averageEdge: number;
  averageExpectedValue: number;
  flatProfit: number;
  flatRoi: number;
  flatRoiCi95: {
    low: number | null;
    high: number | null;
    available: boolean;
    sampleSize: number;
    method: string;
  };
  flatMaximumDrawdownUnits: number;
  trajectory: PredictionProductionSummaryTrajectoryPoint[];
}

export interface PredictionProductionSummaryTrajectoryPoint {
  sequence: number;
  matchDate: string;
  cumulativeProfit: number;
}

export interface PredictionSimulationModel {
  model: {
    tour: string;
    modelName: string;
    modelVersion: string;
    featureFamily: string;
    featureCount: number;
    predictionKind: string;
    trainingPolicy: string;
    usesH2H: boolean;
    provenance: string;
  };
  coverage: {
    eligibleFinishedPredictions: number;
    sourceOfferRows: number;
    sourceMatches: number;
    matchesWithCompletePair: number;
    matchesWithCandidate: number;
    excludedNoCompletePair: number;
    excludedInvalidPair: number;
    excludedNoDirectionalPrediction: number;
    firstPrediction: string | null;
    lastPrediction: string | null;
    firstBet: string | null;
    lastBet: string | null;
  };
  evaluation: {
    outOfSampleFrom: string | null;
    fullHistoryIncludesInSample: boolean;
    outOfSampleLabel: string;
    disclosure: string;
  };
  cohorts: PredictionSimulationCohort[];
}

export interface PredictionSimulationCohort {
  executionPolicy: string;
  optimisticPrice: boolean;
  cohortKind: string;
  threshold: number;
  candidateMatches: number;
  bets: number;
  wins: number;
  losses: number;
  excluded: number;
  coverage: number;
  hitRate: number;
  averageOdds: number;
  averageEdge: number;
  flat: {
    stakeUnits: number;
    profitUnits: number;
    roi: number;
    roiCi95: {
      low: number | null;
      high: number | null;
      available: boolean;
      sampleSize: number;
      method: string;
    };
    maximumDrawdown: number;
  };
  fixedPercentage: PredictionSimulationBankroll;
  boundedPercentage: PredictionSimulationBankroll;
  fractionalKelly: PredictionSimulationBankroll;
  trajectories: PredictionSimulationTrajectories;
}

export interface PredictionSimulationBankroll {
  policy: string;
  startingBankroll: number;
  endingBankroll: number;
  profit: number;
  return: number;
  totalStaked: number;
  roi: number;
  maximumDrawdown: number;
  fixedStakeFraction: number | null;
  kellyMultiplier: number | null;
  maximumStakeFraction: number | null;
  minimumStake: number | null;
  maximumStake: number | null;
}

export interface PredictionSimulationTrajectoryPoint {
  sequence: number;
  matchTPId: number;
  matchDateTime: string;
  selectedPlayer1: boolean;
  won: boolean;
  modelProbability: number;
  marketFairProbability: number;
  edge: number;
  selectedOdds: number;
  flatUnit: PredictionSimulationTrajectoryValue;
  boundedPercentage: PredictionSimulationTrajectoryValue;
  fractionalKelly: PredictionSimulationTrajectoryValue;
}

export interface PredictionSimulationTrajectoryValue {
  stake: number;
  profit: number;
  cumulativeProfit: number;
  balance: number;
}

export interface PredictionSimulationTrajectories {
  basisEdgeThreshold: number | null;
  flatUnitPolicy: string;
  flatUnitStartingBalance: number;
  boundedPercentagePolicy: string;
  boundedPercentageStartingBalance: number;
  fractionalKellyPolicy: string;
  fractionalKellyStartingBalance: number;
  points: PredictionSimulationTrajectoryPoint[];
}
