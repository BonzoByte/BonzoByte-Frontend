import { ATP_FAIR_THRESHOLDS, AtpFairCohort, AtpFairComparison, AtpFairExpectation, AtpFairFamily, AtpFairMode, AtpFairPeriod, AtpFairTotals } from '../atp-fair-comparison.model';

export function atpFairComparisonFixture(empty = false): AtpFairComparison {
  const totals = (candidateMatches: number, bets: number): AtpFairTotals => ({
    candidateMatches, bets, wins: bets / 2, losses: bets / 2,
    medianProfit: bets ? -bets / 4 : 0, fairProfit: bets ? bets / 8 : 0,
    medianRoi: bets ? -0.25 : null, fairRoi: bets ? 0.125 : null,
  });
  const family = (mode: AtpFairMode): AtpFairFamily => {
    const from = mode === 'summary' ? '2025-01-01' : '2026-01-01';
    const candidates = mode === 'summary' ? 12 : 6, bets = empty ? 0 : mode === 'summary' ? 4 : 2;
    const period = (granularity: 'year' | 'quarter', label: string, active: boolean, partial = false): AtpFairPeriod =>
      ({ granularity, label, partial, ...totals(active ? candidates : 0, active ? bets : 0) });
    const cohort = (threshold: number): AtpFairCohort => ({ threshold, ...totals(candidates, bets),
      periods: [
        ...(mode === 'summary' ? [period('year', '2025', false),
          ...[1, 2, 3, 4].map(q => period('quarter', `2025 Q${q}`, false))] : []),
        period('year', '2026', true, true),
        ...[1, 2, 3, 4].map(q => period('quarter', `2026 Q${q}`, q === 3, q === 4)),
      ],
      trajectory: bets ? [{ date: '2026-09-01', medianProfit: -bets / 4, fairProfit: bets / 8 }] : [],
    });
    return { mode, from, to: '2026-11-03', cohorts: ATP_FAIR_THRESHOLDS.map(cohort) };
  };
  return { schema: 'bonzobyte.atp-fair-comparison.v1',
    source: { generatedAtUtc: '2026-11-04T23:11:21.466067+00:00', reportSha256: 'a'.repeat(64), candidateSha256: 'b'.repeat(64),
      from: '2025-01-01', to: '2026-11-03' }, thresholds: [...ATP_FAIR_THRESHOLDS],
    families: [family('summary'), family('audit')], verification: { passed: true, cohortsMatched: 12 } };
}

export function atpFairExpectation(report: AtpFairComparison, mode: AtpFairMode = 'summary', threshold = 0): AtpFairExpectation {
  const cohort = report.families.find(f => f.mode === mode)!.cohorts.find(c => c.threshold === threshold)!;
  return { mode, threshold, sourceGeneratedAtUtc: report.source.generatedAtUtc,
    bets: cohort.bets, wins: cohort.wins, losses: cohort.losses, medianProfit: cohort.medianProfit };
}
