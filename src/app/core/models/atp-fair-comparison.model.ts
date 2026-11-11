export const ATP_FAIR_THRESHOLDS = [0, 0.01, 0.025, 0.05, 0.075, 0.10] as const;
export type AtpFairMode = 'summary' | 'audit';

export interface AtpFairTotals {
  candidateMatches: number;
  bets: number;
  wins: number;
  losses: number;
  medianProfit: number;
  fairProfit: number;
  medianRoi: number | null;
  fairRoi: number | null;
}

export interface AtpFairPeriod extends AtpFairTotals {
  granularity: 'year' | 'quarter';
  label: string;
  partial: boolean;
}

export interface AtpFairPoint { date: string; medianProfit: number; fairProfit: number; }

export interface AtpFairCohort extends AtpFairTotals {
  threshold: number;
  periods: AtpFairPeriod[];
  trajectory: AtpFairPoint[];
}

export interface AtpFairFamily {
  mode: AtpFairMode;
  from: string;
  to: string;
  cohorts: AtpFairCohort[];
}

export interface AtpFairComparison {
  schema: 'bonzobyte.atp-fair-comparison.v1';
  source: {
    generatedAtUtc: string;
    reportSha256: string;
    candidateSha256: string;
    from: string;
    to: string;
  };
  thresholds: number[];
  families: AtpFairFamily[];
  verification: { passed: true; cohortsMatched: 12 };
}

export interface AtpFairExpectation {
  mode: AtpFairMode;
  threshold: number;
  sourceGeneratedAtUtc: string;
  bets: number | null;
  wins: number | null;
  losses: number | null;
  medianProfit: number | null;
}

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const count = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value) && value >= 0;
const sameProfit = (left: number, right: number): boolean => Math.abs(left - right) <= 1e-6;
const sameThreshold = (left: number, right: number): boolean => Math.abs(left - right) < 1e-12;
const sameRate = (left: number, right: number): boolean => Math.abs(left - right) <= 1e-8 * Math.max(1, Math.abs(right));
const calendarDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = (value: unknown): value is string => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  calendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));

function requireComparison(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid local ATP fair comparison.');
}

function validateTotals(value: JsonObject): void {
  requireComparison(count(value['candidateMatches']) && count(value['bets']) && count(value['wins']) && count(value['losses']));
  const bets = value['bets'] as number, wins = value['wins'] as number, losses = value['losses'] as number;
  requireComparison(bets === wins + losses && bets <= (value['candidateMatches'] as number));
  for (const [profitKey, roiKey] of [['medianProfit', 'medianRoi'], ['fairProfit', 'fairRoi']]) {
    const profit = value[profitKey], roi = value[roiKey];
    requireComparison(finite(profit) && profit >= -losses - 1e-6);
    requireComparison(bets === 0 ? roi === null && sameProfit(profit, 0) : finite(roi) && sameRate(roi, profit / bets));
  }
}

/** Independent shape/arithmetic checks; producer verification flags are not sufficient. */
export function validateAtpFairComparison(value: unknown): AtpFairComparison {
  requireComparison(object(value) && value['schema'] === 'bonzobyte.atp-fair-comparison.v1');
  const source = value['source'], verification = value['verification'];
  requireComparison(object(source) && timestamp(source['generatedAtUtc']) &&
    typeof source['reportSha256'] === 'string' && /^[0-9a-f]{64}$/i.test(source['reportSha256']) &&
    typeof source['candidateSha256'] === 'string' && /^[0-9a-f]{64}$/i.test(source['candidateSha256']) &&
    calendarDate(source['from']) && calendarDate(source['to']) && source['from'] <= source['to']);
  requireComparison(object(verification) && verification['passed'] === true && verification['cohortsMatched'] === 12);
  const declaredThresholds = value['thresholds'];
  requireComparison(Array.isArray(declaredThresholds) && declaredThresholds.length === ATP_FAIR_THRESHOLDS.length &&
    ATP_FAIR_THRESHOLDS.every(threshold => declaredThresholds.filter((item: unknown) => finite(item) && sameThreshold(item, threshold)).length === 1));
  requireComparison(Array.isArray(value['families']) && value['families'].length === 2);
  const modes = new Set<AtpFairMode>();
  for (const family of value['families']) {
    requireComparison(object(family) && (family['mode'] === 'summary' || family['mode'] === 'audit'));
    requireComparison(!modes.has(family['mode'])); modes.add(family['mode']);
    requireComparison(calendarDate(family['from']) && calendarDate(family['to']) && family['from'] <= family['to'] &&
      family['from'] >= source['from'] && family['to'] <= source['to']);
    requireComparison(Array.isArray(family['cohorts']) && family['cohorts'].length === 6);
    const thresholds = new Set<number>();
    for (const cohort of family['cohorts']) {
      requireComparison(object(cohort) && finite(cohort['threshold']));
      const threshold = ATP_FAIR_THRESHOLDS.find(item => sameThreshold(item, cohort['threshold'] as number));
      requireComparison(threshold !== undefined && !thresholds.has(threshold)); thresholds.add(threshold);
      validateTotals(cohort);
      requireComparison(Array.isArray(cohort['periods']));
      const periodKeys = new Set<string>();
      for (const period of cohort['periods']) {
        requireComparison(object(period)); validateTotals(period);
        requireComparison(typeof period['partial'] === 'boolean' && typeof period['label'] === 'string' &&
          (period['granularity'] === 'year' && /^\d{4}$/.test(period['label']) ||
            period['granularity'] === 'quarter' && /^\d{4}[- ]Q[1-4]$/.test(period['label'])));
        const key = `${period['granularity']}:${period['label'].replace(' ', '-')}`;
        requireComparison(!periodKeys.has(key)); periodKeys.add(key);
      }
      for (const granularity of ['year', 'quarter']) {
        const periods = cohort['periods'].filter((period: JsonObject) => period['granularity'] === granularity);
        requireComparison(periods.length > 0);
        for (const field of ['candidateMatches', 'bets', 'wins', 'losses', 'medianProfit', 'fairProfit']) {
          const sum = periods.reduce((total: number, period: JsonObject) => total + (period[field] as number), 0);
          requireComparison(sameProfit(sum, cohort[field] as number));
        }
      }
      const firstYear = Number(family['from'].slice(0, 4)), lastYear = Number(family['to'].slice(0, 4));
      const firstQuarter = firstYear * 4 + Math.floor((Number(family['from'].slice(5, 7)) - 1) / 3);
      const lastQuarter = lastYear * 4 + Math.floor((Number(family['to'].slice(5, 7)) - 1) / 3);
      for (let year = firstYear; year <= lastYear; year++) requireComparison(periodKeys.has(`year:${year}`));
      for (let quarter = firstQuarter; quarter <= lastQuarter; quarter++) {
        requireComparison(periodKeys.has(`quarter:${Math.floor(quarter / 4)}-Q${quarter % 4 + 1}`));
      }
      requireComparison(periodKeys.size === lastYear - firstYear + 1 + lastQuarter - firstQuarter + 1);
      // One additional synthetic Start point is reserved by the presentation layer.
      requireComparison(Array.isArray(cohort['trajectory']) && cohort['trajectory'].length <= 599);
      let previousDate = '';
      for (const point of cohort['trajectory']) {
        requireComparison(object(point) && calendarDate(point['date']) && point['date'] > previousDate &&
          point['date'] >= family['from'] && point['date'] <= family['to'] &&
          finite(point['medianProfit']) && finite(point['fairProfit']));
        previousDate = point['date'];
      }
      if (cohort['bets'] === 0) requireComparison(cohort['trajectory'].length === 0);
      else {
        const endpoint = cohort['trajectory'].at(-1);
        requireComparison(endpoint && sameProfit(endpoint['medianProfit'], cohort['medianProfit'] as number) &&
          sameProfit(endpoint['fairProfit'], cohort['fairProfit'] as number));
      }
    }
  }
  return value as unknown as AtpFairComparison;
}

/** Exact report timestamp and selected counts prevent stale/incompatible overlays. */
export function matchingAtpFairCohort(report: AtpFairComparison | null, expected: AtpFairExpectation): AtpFairCohort | null {
  if (!report || expected.sourceGeneratedAtUtc !== report.source.generatedAtUtc ||
    !count(expected.bets) || !count(expected.wins) || !count(expected.losses) || !finite(expected.medianProfit) ||
    !finite(expected.threshold)) return null;
  const cohort = report.families.find(family => family.mode === expected.mode)?.cohorts
    .find(item => sameThreshold(item.threshold, expected.threshold));
  return cohort && cohort.bets === expected.bets && cohort.wins === expected.wins && cohort.losses === expected.losses &&
    sameProfit(cohort.medianProfit, expected.medianProfit) ? cohort : null;
}

export function atpFairPeriods(cohort: AtpFairCohort | null, granularity: 'year' | 'quarter'): AtpFairPeriod[] {
  return (cohort?.periods ?? []).filter(period => period.granularity === granularity)
    .slice().sort((left, right) => left.label.replace(' ', '-').localeCompare(right.label.replace(' ', '-')));
}
