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
    reportGenerator: string;
  };
  models: PredictionSimulationModel[];
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
  fractionalKelly: PredictionSimulationBankroll;
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
}
