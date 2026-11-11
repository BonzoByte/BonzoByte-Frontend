import { SQL_STUDY_THRESHOLDS_PP, SqlSelectionStudy, SqlStudyCohort, SqlStudyPeriod } from '../sql-selection-study.model';

export function sqlSelectionStudyFixture(empty = false): SqlSelectionStudy {
  const make = (scope: 'ALL' | 'ATP' | 'WTA', atp: number, wta: number, picks: number): SqlStudyCohort => {
    const period = (granularity: 'year' | 'quarter', label: string, total: number, partial = false): SqlStudyPeriod =>
      ({ granularity, label, picks: total, wins: 0, losses: total, netUnits: total ? -total : 0, roi: total ? -1 : null, partial });
    return { scope, atpThresholdPp: atp, wtaThresholdPp: wta, candidateMatches: scope === 'ALL' ? 24 : 12,
      picks, wins: 0, losses: picks, netUnits: picks ? -picks : 0, roi: picks ? -1 : null, hitRate: picks ? 0 : null,
      coverage: picks / (scope === 'ALL' ? 24 : 12), maxDrawdownUnits: picks, activeDays: picks ? 1 : 0,
      meanPicksPerActiveDay: picks, periods: [period('year', '2024', 0), period('year', '2025', picks, true),
        ...[1, 2, 3, 4].map(quarter => period('quarter', `2024 Q${quarter}`, 0)), period('quarter', '2025 Q1', picks)],
      trajectory: picks ? [{ date: '2025-01-02', netUnits: -picks }] : [] };
  };
  const amount = (threshold: number) => empty ? 0 : 6 - SQL_STUDY_THRESHOLDS_PP.findIndex(value => value === threshold);
  const atp = SQL_STUDY_THRESHOLDS_PP.map(t => make('ATP', t, -1, amount(t)));
  const wta = SQL_STUDY_THRESHOLDS_PP.map(t => make('WTA', -1, t, amount(t)));
  return { schema: 'bonzobyte.sql-selection-study', schemaVersion: 1, generatedAtUtc: '2026-11-10T12:00:00Z',
    source: { database: 'fixture', view: 'fixture-view', medianRunId: 'fixture-run', rows: 24,
      from: '2024-01-01', to: '2025-03-31', qualityCounts: { fixture: 24 } },
    rule: { id: 'either-raw-edge-nn-favorite-v1', thresholdsPp: [...SQL_STUDY_THRESHOLDS_PP],
      defaultAtpPp: 10, defaultWtaPp: 10, operator: '>', stakeUnits: 1, selectionOptimized: false,
      disclosure: 'Historical fixture, not a prospective test.' },
    cohorts: [...SQL_STUDY_THRESHOLDS_PP.flatMap(a => SQL_STUDY_THRESHOLDS_PP.map(w => make('ALL', a, w, amount(a) + amount(w)))), ...atp, ...wta],
    baseline: make('ALL', -1, -1, empty ? 0 : 12), verification: { passed: true, sqlAggregateParity: true } };
}

export function sqlSelectionMin10Fixture(empty = false): SqlSelectionStudy {
  const source = sqlSelectionStudyFixture(empty);
  return { ...source, schemaVersion: 2,
    rule: { ...source.rule, id: 'either-raw-edge-nn-favorite-min10-v2', operator: '>=', thresholdsPp: [10] },
    cohorts: source.cohorts.filter(c => (c.atpThresholdPp === 10 || c.atpThresholdPp === -1) &&
      (c.wtaThresholdPp === 10 || c.wtaThresholdPp === -1)) };
}
