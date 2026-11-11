export const SQL_STUDY_THRESHOLDS_PP = [0, 1, 2.5, 5, 7.5, 10] as const;
export type SqlStudyScope = 'ALL' | 'ATP' | 'WTA';
export type SqlStudyGranularity = 'year' | 'quarter';

export interface SqlStudyPeriod {
  granularity: SqlStudyGranularity;
  label: string;
  candidateMatches?: number;
  picks: number;
  wins: number;
  losses: number;
  netUnits: number;
  roi: number | null;
  partial?: boolean;
}

export interface SqlStudyTrajectoryPoint { date: string; netUnits: number; }

export interface SqlStudyCohort {
  scope: SqlStudyScope;
  atpThresholdPp: number;
  wtaThresholdPp: number;
  candidateMatches: number;
  picks: number;
  wins: number;
  losses: number;
  netUnits: number;
  roi: number | null;
  hitRate: number | null;
  coverage: number;
  maxDrawdownUnits: number;
  activeDays: number;
  meanPicksPerActiveDay: number;
  periods: SqlStudyPeriod[];
  trajectory: SqlStudyTrajectoryPoint[];
}

export interface SqlSelectionStudy {
  schema: 'bonzobyte.sql-selection-study';
  schemaVersion: 1 | 2;
  generatedAtUtc: string;
  source: {
    database: string;
    view: string;
    medianRunId: string | number;
    rows: number;
    from: string;
    to: string;
    qualityCounts: Record<string, number>;
  };
  rule: {
    id: 'either-raw-edge-nn-favorite-v1' | 'either-raw-edge-nn-favorite-min10-v2';
    thresholdsPp: number[];
    defaultAtpPp: number;
    defaultWtaPp: number;
    operator: '>' | '>=';
    stakeUnits: 1;
    selectionOptimized: false;
    disclosure: string;
  };
  cohorts: SqlStudyCohort[];
  // The unfiltered baseline is never substituted for a missing threshold cohort.
  baseline: SqlStudyCohort;
  verification: { passed: true; sqlAggregateParity: true };
}

export function isLocalSqlStudyEnabled(production: boolean, hostname: string): boolean {
  return !production && /^(localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(hostname);
}

export function selectSqlStudyCohort(
  study: SqlSelectionStudy, scope: SqlStudyScope, atpPp: number, wtaPp: number
): SqlStudyCohort | null {
  return study.cohorts.find(cohort => cohort.scope === scope &&
    cohort.atpThresholdPp === (scope === 'WTA' ? -1 : atpPp) &&
    cohort.wtaThresholdPp === (scope === 'ATP' ? -1 : wtaPp)) ?? null;
}

/** Keep every calendar period, including zero-pick and loss-making periods. */
export function sqlStudyPeriods(cohort: SqlStudyCohort | null, granularity: SqlStudyGranularity): SqlStudyPeriod[] {
  return (cohort?.periods ?? []).filter(period => period.granularity === granularity)
    .slice().sort((left, right) => left.label.localeCompare(right.label));
}

/** Input is already cumulative end-of-day data; never aggregate sampled points again. */
export function sampleSqlStudyTrajectory(points: SqlStudyTrajectoryPoint[], limit = 600): SqlStudyTrajectoryPoint[] {
  if (points.length <= limit) return points.slice();
  return Array.from({ length: limit }, (_, index) =>
    points[Math.round(index * (points.length - 1) / (limit - 1))]);
}

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const count = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const close = (left: number, right: number): boolean => Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(right));
const timestamp = (value: unknown): value is string => text(value) && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value));
const calendarDate = (value: unknown): value is string => timestamp(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;

function requireStudy(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid local SQL selection study.');
}

function validTotals(value: JsonObject): void {
  requireStudy(count(value['picks']) && count(value['wins']) && count(value['losses']));
  const picks = value['picks'] as number, wins = value['wins'] as number, losses = value['losses'] as number;
  requireStudy(picks === wins + losses && finite(value['netUnits']));
  const net = value['netUnits'] as number;
  requireStudy(net >= -losses - 1e-6 && (picks !== 0 || close(net, 0)));
  requireStudy(picks === 0 && value['roi'] === null ||
    finite(value['roi']) && close(value['roi'], picks ? net / picks : 0));
}

/** Validate the data, not just the producer's verification flags. No archive normalization. */
export function validateSqlSelectionStudy(value: unknown): SqlSelectionStudy {
  requireStudy(object(value) && value['schema'] === 'bonzobyte.sql-selection-study' && [1, 2].includes(value['schemaVersion'] as number));
  const inclusiveMin10 = value['schemaVersion'] === 2;
  const allowedThresholds: readonly number[] = inclusiveMin10 ? [10] : SQL_STUDY_THRESHOLDS_PP;
  requireStudy(timestamp(value['generatedAtUtc']));
  const source = value['source'], rule = value['rule'], verification = value['verification'];
  requireStudy(object(source) && text(source['database']) && text(source['view']) &&
    (text(source['medianRunId']) || count(source['medianRunId'])) && count(source['rows']) &&
    timestamp(source['from']) && timestamp(source['to']) && Date.parse(source['from']) <= Date.parse(source['to']) &&
    object(source['qualityCounts']) && Object.values(source['qualityCounts']).every(count));
  requireStudy(object(rule) && rule['id'] === (inclusiveMin10 ? 'either-raw-edge-nn-favorite-min10-v2' : 'either-raw-edge-nn-favorite-v1') &&
    rule['operator'] === (inclusiveMin10 ? '>=' : '>') &&
    rule['stakeUnits'] === 1 && rule['selectionOptimized'] === false && text(rule['disclosure']) &&
    rule['defaultAtpPp'] === 10 && rule['defaultWtaPp'] === 10 && Array.isArray(rule['thresholdsPp']) &&
    JSON.stringify(rule['thresholdsPp']) === JSON.stringify(allowedThresholds));
  requireStudy(object(verification) && verification['passed'] === true && verification['sqlAggregateParity'] === true);
  requireStudy(object(value['baseline']));
  requireStudy(Array.isArray(value['cohorts']) && value['cohorts'].length === (inclusiveMin10 ? 3 : 48));
  const keys = new Set<string>();
  for (const cohort of [...value['cohorts'], value['baseline']]) {
    requireStudy(object(cohort));
    const scope = cohort['scope'], atp = cohort['atpThresholdPp'], wta = cohort['wtaThresholdPp'];
    const threshold = (v: unknown) => allowedThresholds.some(item => item === v);
    const baseline = cohort === value['baseline'];
    requireStudy(baseline ? scope === 'ALL' && atp === -1 && wta === -1 :
      (scope === 'ALL' && threshold(atp) && threshold(wta)) ||
      (scope === 'ATP' && threshold(atp) && wta === -1) || (scope === 'WTA' && atp === -1 && threshold(wta)));
    const key = `${scope}:${atp}:${wta}`;
    requireStudy(!keys.has(key)); keys.add(key);
    validTotals(cohort);
    const picks = cohort['picks'] as number;
    requireStudy(count(cohort['candidateMatches']) && picks <= cohort['candidateMatches'] && cohort['candidateMatches'] <= source['rows']);
    requireStudy(finite(cohort['coverage']) && cohort['coverage'] >= 0 && cohort['coverage'] <= 1 &&
      close(cohort['coverage'], cohort['candidateMatches'] ? picks / cohort['candidateMatches'] : 0));
    requireStudy(picks === 0 && cohort['hitRate'] === null || finite(cohort['hitRate']) &&
      cohort['hitRate'] >= 0 && cohort['hitRate'] <= 1 && close(cohort['hitRate'], picks ? (cohort['wins'] as number) / picks : 0));
    requireStudy(finite(cohort['maxDrawdownUnits']) && cohort['maxDrawdownUnits'] >= 0 &&
      count(cohort['activeDays']) && cohort['activeDays'] <= picks && (picks === 0 || cohort['activeDays'] > 0) &&
      finite(cohort['meanPicksPerActiveDay']) && close(cohort['meanPicksPerActiveDay'], cohort['activeDays'] ? picks / cohort['activeDays'] : 0));
    requireStudy(Array.isArray(cohort['periods']));
    const periodKeys = new Set<string>();
    for (const period of cohort['periods']) {
      requireStudy(object(period)); validTotals(period);
      requireStudy(period['candidateMatches'] === undefined ||
        count(period['candidateMatches']) && period['candidateMatches'] >= (period['picks'] as number));
      requireStudy(period['partial'] === undefined || typeof period['partial'] === 'boolean');
      requireStudy((period['granularity'] === 'year' && typeof period['label'] === 'string' && /^\d{4}$/.test(period['label'])) ||
        (period['granularity'] === 'quarter' && typeof period['label'] === 'string' && /^\d{4}[- ]Q[1-4]$/.test(period['label'])));
      const periodKey = `${period['granularity']}:${String(period['label']).replace(' ', '-')}`;
      requireStudy(!periodKeys.has(periodKey)); periodKeys.add(periodKey);
    }
    for (const granularity of ['year', 'quarter']) {
      const periods = cohort['periods'].filter((period: JsonObject) => period['granularity'] === granularity);
      requireStudy(periods.length > 0);
      for (const field of ['picks', 'wins', 'losses', 'netUnits']) {
        requireStudy(close(periods.reduce((sum: number, period: JsonObject) => sum + (period[field] as number), 0), cohort[field] as number));
      }
    }
    // Explicit zero-pick years must not disappear from the full source window.
    for (let year = Number(source['from'].slice(0, 4)); year <= Number(source['to'].slice(0, 4)); year++) {
      requireStudy(periodKeys.has(`year:${year}`));
    }
    requireStudy(Array.isArray(cohort['trajectory']) && cohort['trajectory'].length <= 600);
    let previousDate = '';
    for (const point of cohort['trajectory']) {
      requireStudy(object(point) && calendarDate(point['date']) && point['date'] > previousDate && finite(point['netUnits']));
      requireStudy(point['date'] >= source['from'].slice(0, 10) && point['date'] <= source['to'].slice(0, 10));
      previousDate = point['date'];
    }
    requireStudy(picks === 0 ? cohort['trajectory'].length === 0 : cohort['trajectory'].length > 0 &&
      close(cohort['trajectory'].at(-1)['netUnits'], cohort['netUnits'] as number));
  }
  const study = value as unknown as SqlSelectionStudy;
  for (const combined of study.cohorts.filter(cohort => cohort.scope === 'ALL')) {
    const atp = selectSqlStudyCohort(study, 'ATP', combined.atpThresholdPp, 0);
    const wta = selectSqlStudyCohort(study, 'WTA', 0, combined.wtaThresholdPp);
    requireStudy(atp && wta);
    for (const field of ['candidateMatches', 'picks', 'wins', 'losses', 'netUnits'] as const) {
      requireStudy(close(combined[field], atp[field] + wta[field]));
    }
  }
  return study;
}
