export interface ExplainabilityMetrics {
  accuracy: number;
  auc: number;
  logLoss: number;
  brier: number;
}

export interface ExplainabilityFeature {
  name: string;
  label: string;
  family: string;
  share: number;
  directionCorrelation: number | null;
}

export interface ExplainabilityFamily {
  name: string;
  share: number;
  featureCount: number;
}

export interface ExplainabilityModel {
  id: string;
  tour: 'ATP' | 'WTA';
  status: 'accepted' | 'production';
  label: string;
  window: {
    from: string;
    to: string;
  };
  sampleRows: number;
  eligibleRows: number;
  featureCount: number;
  metrics: ExplainabilityMetrics;
  topFeatures: ExplainabilityFeature[];
  families: ExplainabilityFamily[];
}

export interface ModelExplainabilityReport {
  schema: 'bonzobyte.model-explainability';
  schemaVersion: 1;
  generatedAtUtc: string;
  title: string;
  subtitle: string;
  models: ExplainabilityModel[];
  methodology: string[];
}
