import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import {
  PredictionProductionSummaryCohort,
  PredictionSimulationCohort,
  PredictionSimulationModel,
  PredictionSimulationReport,
  PredictionSimulationTemporalSlice,
} from '../../core/models/prediction-simulation.model';
import { StaticArchivesService } from '../../core/services/static-archives.service';

type DisplayTrajectoryKind =
  | 'flatUnit'
  | 'boundedPercentage'
  | 'fractionalKelly';
type SimulationView = 'summary' | 'modelAudit';
type ProductionScope = 'ALL' | 'ATP' | 'WTA';
type TemporalGranularity = 'year' | 'quarter';

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.scss'],
})
export class SimulationComponent implements OnInit, OnDestroy {
  readonly consensusPolicy = 'median-of-bookmaker-medians';
  report: PredictionSimulationReport | null = null;
  selectedView: SimulationView = 'summary';
  selectedModelIndex = 0;
  selectedExecutionPolicy = this.consensusPolicy;
  selectedEdgeThreshold = 0;
  selectedSummaryScope: ProductionScope = 'ALL';
  selectedSummaryEdgeThreshold = 0;
  selectedTemporalGranularity: TemporalGranularity = 'year';
  isLoading = true;
  error: string | null = null;

  readonly roiChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: '#64748b',
          callback: value => `${(Number(value) * 100).toFixed(0)}%`,
        },
        grid: { color: 'rgba(100,116,139,0.20)' },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#64748b', usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label: context =>
            `${context.dataset.label}: ${(Number(context.raw) * 100).toFixed(2)}%`,
        },
      },
    },
  };

  readonly flatTrajectoryChartOptions =
    this.createTrajectoryChartOptions('flatUnit');
  readonly kellyTrajectoryChartOptions =
    this.createTrajectoryChartOptions('fractionalKelly');
  readonly boundedTrajectoryChartOptions =
    this.createTrajectoryChartOptions('boundedPercentage');
  readonly summaryTrajectoryChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Chronological match date',
          color: '#64748b',
        },
        ticks: { color: '#64748b', autoSkip: true, maxTicksLimit: 12 },
        grid: { display: false },
      },
      y: {
        title: {
          display: true,
          text: 'Cumulative flat profit (units)',
          color: '#64748b',
        },
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(100,116,139,0.20)' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: context =>
            `Cumulative P/L: ${Number(context.raw).toFixed(2)} units`,
        },
      },
    },
  };

  readonly temporalRoiChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Calendar period',
          color: '#64748b',
        },
        ticks: { color: '#64748b', autoSkip: true, maxTicksLimit: 18 },
        grid: { display: false },
      },
      y: {
        title: {
          display: true,
          text: 'Flat ROI',
          color: '#64748b',
        },
        ticks: {
          color: '#64748b',
          callback: value => `${(Number(value) * 100).toFixed(0)}%`,
        },
        grid: { color: 'rgba(100,116,139,0.20)' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: context => `Flat ROI: ${(Number(context.raw) * 100).toFixed(2)}%`,
        },
      },
    },
  };

  constructor(private readonly archives: StaticArchivesService) {}

  ngOnInit(): void {
    document.body.classList.add('no-datebar');
    this.archives.getPredictionSimulation().subscribe({
      next: report => {
        this.report = report;
        this.selectedModelIndex = this.broadestHistoryModelIndex(report);
        this.isLoading = false;
      },
      error: error => {
        console.error('Failed to load prediction simulation', error);
        this.error =
          'Simulation data is not available yet. Generate the local read-only scorecard artifact first.';
        this.isLoading = false;
      },
    });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('no-datebar');
  }

  get selectedModel(): PredictionSimulationModel | null {
    return this.report?.models[this.selectedModelIndex] ?? null;
  }

  get summaryCohorts(): PredictionProductionSummaryCohort[] {
    return (this.report?.productionSummary?.cohorts ?? [])
      .filter(cohort => cohort.scope === this.selectedSummaryScope)
      .sort((left, right) => left.minimumEdge - right.minimumEdge);
  }

  get selectedSummaryCohort(): PredictionProductionSummaryCohort | null {
    return this.summaryCohorts.find(cohort =>
      Math.abs(cohort.minimumEdge - this.selectedSummaryEdgeThreshold) < 0.000001
    ) ?? this.summaryCohorts[0] ?? null;
  }

  get summaryEdgeThresholdOptions(): number[] {
    return this.summaryCohorts.map(cohort => cohort.minimumEdge);
  }

  get summaryRoiChartData(): ChartData<'bar'> {
    const summary = this.report?.productionSummary;
    const thresholds = [
      ...new Set((summary?.cohorts ?? []).map(cohort => cohort.minimumEdge)),
    ].sort((left, right) => left - right);
    const colors: Record<ProductionScope, string> = {
      ALL: 'rgba(45, 212, 191, 0.72)',
      ATP: 'rgba(56, 189, 248, 0.70)',
      WTA: 'rgba(192, 132, 252, 0.70)',
    };
    return {
      labels: thresholds.map(value => this.summaryEdgeLabel(value)),
      datasets: (['ALL', 'ATP', 'WTA'] as ProductionScope[]).map(scope => ({
        label: scope,
        data: thresholds.map(threshold =>
          summary?.cohorts.find(cohort =>
            cohort.scope === scope &&
            Math.abs(cohort.minimumEdge - threshold) < 0.000001
          )?.flatRoi ?? 0
        ),
        backgroundColor: colors[scope],
        borderWidth: 0,
        borderRadius: 7,
      })),
    };
  }

  get summaryTrajectoryChartData(): ChartData<'line'> {
    const points = this.selectedSummaryCohort?.trajectory ?? [];
    return {
      labels: [
        'Start',
        ...points.map(point =>
          new Date(point.matchDate).toLocaleDateString('en-GB')
        ),
      ],
      datasets: [{
        label: 'Legacy production WP flat P/L',
        data: [0, ...points.map(point => point.cumulativeProfit)],
        borderColor: '#2dd4bf',
        backgroundColor: 'rgba(45, 212, 191, 0.12)',
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        tension: 0.12,
        normalized: true,
      }],
    };
  }

  get selectedCohorts(): PredictionSimulationCohort[] {
    return (this.selectedModel?.cohorts ?? [])
      .filter(cohort =>
        cohort.executionPolicy === this.selectedExecutionPolicy
      )
      .sort((left, right) => {
        if (left.cohortKind !== right.cohortKind) {
          return left.cohortKind.localeCompare(right.cohortKind);
        }
        return left.threshold - right.threshold;
      });
  }

  get referenceCohort(): PredictionSimulationCohort | null {
    const cohorts = this.selectedCohorts;
    return cohorts.find(cohort =>
      cohort.cohortKind === 'edge' &&
      Math.abs(cohort.threshold - 0.025) < 0.000001
    ) ?? cohorts.find(cohort => cohort.cohortKind === 'edge') ?? cohorts[0] ?? null;
  }

  get roiChartData(): ChartData<'bar'> {
    const model = this.selectedModel;
    const thresholds = this.edgeThresholds(model);
    return {
      labels: thresholds.map(value => `${(value * 100).toFixed(1)}%`),
      datasets: [
        {
          label: 'Consensus median',
          data: thresholds.map(threshold =>
            this.findEdgeCohort(model, this.consensusPolicy, threshold)?.flat.roi ?? 0
          ),
          backgroundColor: 'rgba(45, 212, 191, 0.72)',
          borderColor: '#5eead4',
          borderWidth: 1,
          borderRadius: 7,
        },
        {
          label: 'Best price (optimistic)',
          data: thresholds.map(threshold =>
            this.findEdgeCohort(model, 'best-price', threshold)?.flat.roi ?? 0
          ),
          backgroundColor: 'rgba(251, 191, 36, 0.62)',
          borderColor: '#fcd34d',
          borderWidth: 1,
          borderRadius: 7,
        },
      ],
    };
  }

  get edgeThresholdOptions(): number[] {
    return this.edgeThresholds(this.selectedModel);
  }

  get selectedEdgeCohort(): PredictionSimulationCohort | null {
    return this.findEdgeCohort(
      this.selectedModel,
      this.selectedExecutionPolicy,
      this.selectedEdgeThreshold
    ) ?? null;
  }

  get temporalSlices(): PredictionSimulationTemporalSlice[] {
    return (this.selectedEdgeCohort?.temporalSlices ?? [])
      .filter(slice => slice.granularity === this.selectedTemporalGranularity)
      .sort((left, right) =>
        new Date(left.fromInclusive).getTime() -
        new Date(right.fromInclusive).getTime()
      );
  }

  get temporalRoiChartData(): ChartData<'bar'> {
    const slices = this.temporalSlices;
    return {
      labels: slices.map(slice => slice.label),
      datasets: [{
        label: 'Flat ROI',
        data: slices.map(slice => slice.flatRoi),
        backgroundColor: slices.map(slice =>
          slice.flatRoi >= 0
            ? 'rgba(45, 212, 191, 0.72)'
            : 'rgba(251, 113, 133, 0.72)'
        ),
        borderWidth: 0,
        borderRadius: 5,
      }],
    };
  }

  get flatTrajectoryChartData(): ChartData<'line'> {
    return this.trajectoryChartData(
      'flatUnit',
      'Flat one-unit cumulative profit',
      '#38bdf8',
      'rgba(56, 189, 248, 0.12)'
    );
  }

  get kellyTrajectoryChartData(): ChartData<'line'> {
    return this.trajectoryChartData(
      'fractionalKelly',
      'Quarter-Kelly stress-test cumulative profit',
      '#c084fc',
      'rgba(192, 132, 252, 0.12)'
    );
  }

  get boundedTrajectoryChartData(): ChartData<'line'> {
    return this.trajectoryChartData(
      'boundedPercentage',
      'Bounded 1% cumulative profit',
      '#2dd4bf',
      'rgba(45, 212, 191, 0.12)'
    );
  }

  modelLabel(model: PredictionSimulationModel): string {
    const identity = model.model;
    return [
      identity.tour,
      identity.modelVersion,
      `${identity.featureCount} features`,
      identity.predictionKind,
      identity.usesH2H ? 'H2H' : 'no H2H',
    ].join(' · ');
  }

  setExecutionPolicy(policy: string): void {
    this.selectedExecutionPolicy = policy;
  }

  setView(view: SimulationView): void {
    this.selectedView = view;
  }

  setTemporalGranularity(granularity: TemporalGranularity): void {
    this.selectedTemporalGranularity = granularity;
  }

  setSummaryScope(scope: ProductionScope): void {
    this.selectedSummaryScope = scope;
    if (!this.summaryEdgeThresholdOptions.some(threshold =>
      Math.abs(threshold - this.selectedSummaryEdgeThreshold) < 0.000001
    )) {
      this.selectedSummaryEdgeThreshold =
        this.summaryEdgeThresholdOptions[0] ?? 0;
    }
  }

  summaryEdgeLabel(threshold: number): string {
    return threshold === 0
      ? 'Edge > 0'
      : `Edge >= ${(threshold * 100).toFixed(0)} pp`;
  }

  summaryConfidenceInterval(
    cohort: PredictionProductionSummaryCohort
  ): string {
    const interval = cohort.flatRoiCi95;
    if (!interval.available || interval.low == null || interval.high == null) {
      return `N/A (n=${interval.sampleSize})`;
    }
    return `${(interval.low * 100).toFixed(1)}% to ${(interval.high * 100).toFixed(1)}%`;
  }

  cohortLabel(cohort: PredictionSimulationCohort): string {
    return cohort.cohortKind === 'edge'
      ? `Edge ≥ ${(cohort.threshold * 100).toFixed(1)}%`
      : `Confidence ≥ ${(cohort.threshold * 100).toFixed(0)}%`;
  }

  confidenceInterval(cohort: PredictionSimulationCohort): string {
    const interval = cohort.flat.roiCi95;
    if (!interval.available || interval.low == null || interval.high == null) {
      return `N/A (n=${interval.sampleSize})`;
    }

    return `${(interval.low * 100).toFixed(1)}% to ${(interval.high * 100).toFixed(1)}%`;
  }

  temporalEvidenceLabel(slice: PredictionSimulationTemporalSlice): string {
    const boundaryValue = this.selectedModel?.evaluation.outOfSampleFrom;
    if (!boundaryValue) return 'No registered boundary';

    const boundary = new Date(boundaryValue).getTime();
    const from = new Date(slice.fromInclusive).getTime();
    const to = new Date(slice.toExclusive).getTime();
    if (to <= boundary) return 'Before registered boundary';
    if (from >= boundary) return 'After registered boundary';
    return 'Boundary crosses this period';
  }

  private edgeThresholds(
    model: PredictionSimulationModel | null
  ): number[] {
    return [
      ...new Set(
        (model?.cohorts ?? [])
          .filter(cohort => cohort.cohortKind === 'edge')
          .map(cohort => cohort.threshold)
      ),
    ].sort((left, right) => left - right);
  }

  private findEdgeCohort(
    model: PredictionSimulationModel | null,
    policy: string,
    threshold: number
  ): PredictionSimulationCohort | undefined {
    return model?.cohorts.find(cohort =>
      cohort.executionPolicy === policy &&
      cohort.cohortKind === 'edge' &&
      Math.abs(cohort.threshold - threshold) < 0.000001
    );
  }

  private trajectoryChartData(
    kind: DisplayTrajectoryKind,
    label: string,
    borderColor: string,
    backgroundColor: string
  ): ChartData<'line'> {
    const points = this.selectedEdgeCohort?.trajectories?.points ?? [];
    return {
      labels: [
        'Start',
        ...points.map(point =>
          new Date(point.matchDateTime).toLocaleDateString('en-GB')
        ),
      ],
      datasets: [
        {
          label,
          data: [0, ...points.map(point => point[kind].cumulativeProfit)],
          borderColor,
          backgroundColor,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          tension: 0.16,
          normalized: true,
        },
      ],
    };
  }

  private createTrajectoryChartOptions(
    kind: DisplayTrajectoryKind
  ): ChartOptions<'line'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Chronological match date',
            color: '#64748b',
          },
          ticks: {
            color: '#64748b',
            autoSkip: true,
            maxTicksLimit: 12,
          },
          grid: { display: false },
        },
        y: {
          title: {
            display: true,
            text: 'Cumulative profit',
            color: '#64748b',
          },
          ticks: {
            color: '#64748b',
            callback: value => Number(value).toFixed(0),
          },
          grid: { color: 'rgba(100,116,139,0.20)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => this.trajectoryTooltipTitle(
              kind,
              items[0]?.dataIndex ?? 0
            ),
            label: context =>
              `Cumulative profit: ${Number(context.raw).toFixed(2)}`,
            afterLabel: context => this.trajectoryTooltipDetails(
              kind,
              context.dataIndex
            ),
          },
        },
      },
    };
  }

  private trajectoryTooltipTitle(
    _kind: DisplayTrajectoryKind,
    dataIndex: number
  ): string {
    if (dataIndex === 0) return 'Starting point';
    const point = this.selectedEdgeCohort?.trajectories?.points[dataIndex - 1];
    if (!point) return `Wager ${dataIndex}`;
    const date = new Date(point.matchDateTime);
    return `Wager ${point.sequence} · ${date.toLocaleDateString('en-GB')}`;
  }

  private trajectoryTooltipDetails(
    kind: DisplayTrajectoryKind,
    dataIndex: number
  ): string[] {
    if (dataIndex === 0) return [];
    const point = this.selectedEdgeCohort?.trajectories?.points[dataIndex - 1];
    if (!point) return [];
    const strategy = point[kind];
    return [
      `Match: ${point.matchTPId}`,
      `Side: Player ${point.selectedPlayer1 ? '1' : '2'} · ${point.won ? 'win' : 'loss'}`,
      `Odds: ${point.selectedOdds.toFixed(2)} · Edge: ${(point.edge * 100).toFixed(1)} pp`,
      `Stake: ${strategy.stake.toFixed(2)} · P/L: ${strategy.profit.toFixed(2)}`,
    ];
  }

  private broadestHistoryModelIndex(
    report: PredictionSimulationReport
  ): number {
    let selectedIndex = 0;
    let earliest = Number.POSITIVE_INFINITY;
    report.models.forEach((model, index) => {
      const firstBet = model.coverage.firstBet;
      if (!firstBet) return;
      const timestamp = new Date(firstBet).getTime();
      if (Number.isFinite(timestamp) && timestamp < earliest) {
        earliest = timestamp;
        selectedIndex = index;
      }
    });
    return selectedIndex;
  }
}
