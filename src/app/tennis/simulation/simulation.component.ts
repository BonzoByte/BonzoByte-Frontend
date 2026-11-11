import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ReportPresentationService } from '../../core/i18n/report-presentation.service';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
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
import { LOCAL_SQL_STUDY_ENABLED } from '../../core/services/sql-selection-study.service';
import { SqlSelectionStudyComponent } from './sql-selection-study.component';
import { AtpFairComparisonComponent } from './atp-fair-comparison.component';

type DisplayTrajectoryKind =
  | 'flatUnit'
  | 'boundedPercentage'
  | 'fractionalKelly';
type SimulationView = 'matchSelection' | 'summary' | 'modelAudit';
type ProductionScope = 'ALL' | 'ATP' | 'WTA';
type TemporalGranularity = 'year' | 'quarter';

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [TranslateModule, CommonModule, FormsModule, BaseChartDirective, SqlSelectionStudyComponent, AtpFairComparisonComponent],
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.scss'],
})
export class SimulationComponent implements OnInit, OnDestroy {
  // Retain internal audit calculations, but do not expose the audit in the demo.
  readonly modelAuditVisible = false;
  readonly minimumDisplayedEdge = 0.10;
  readonly consensusPolicy = 'median-of-bookmaker-medians';
  readonly localStudyEnabled = inject(LOCAL_SQL_STUDY_ENABLED);
  report: PredictionSimulationReport | null = null;
  selectedView: SimulationView = this.localStudyEnabled ? 'matchSelection' : 'summary';
  selectedModelIndex = 0;
  selectedExecutionPolicy = this.consensusPolicy;
  selectedEdgeThreshold = this.minimumDisplayedEdge;
  selectedSummaryScope: ProductionScope = 'ALL';
  selectedSummaryEdgeThreshold = this.minimumDisplayedEdge;
  selectedTemporalGranularity: TemporalGranularity = 'year';
  isLoading = !this.localStudyEnabled;
  error: string | null = null;
  private legacyRequested = false;

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
          callback: value => `${this.p.regional.number(Number(value) * 100, 0)}%`,
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
            `${context.dataset.label}: ${this.p.regional.number(Number(context.raw) * 100, 2)}%`,
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
            this.p.text('summaryProfitTooltip', { value: this.p.regional.number(Number(context.raw), 2) }),
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
          callback: value => `${this.p.regional.number(Number(value) * 100, 0)}%`,
        },
        grid: { color: 'rgba(100,116,139,0.20)' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: context => this.p.text('roiTooltip', { value: this.p.regional.number(Number(context.raw) * 100, 2) }),
        },
      },
    },
  };

  constructor(private readonly archives: StaticArchivesService, public readonly p: ReportPresentationService) {}

  ngOnInit(): void {
    document.body.classList.add('no-datebar');
    if (!this.localStudyEnabled) this.loadLegacyReport();
  }

  private loadLegacyReport(): void {
    if (this.legacyRequested) return;
    this.legacyRequested = true;
    this.isLoading = true;
    this.archives.getPredictionSimulation().subscribe({
      next: report => {
        this.report = report;
        this.selectedModelIndex = this.broadestHistoryModelIndex(report);
        this.isLoading = false;
      },
      error: error => {
        console.error('Failed to load prediction simulation', error);
        this.error =
          'reports.messages.simulationError';
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

  get showSummaryFairComparison(): boolean {
    return this.localStudyEnabled && this.selectedView === 'summary' && this.selectedSummaryScope === 'ATP';
  }

  get showAuditFairComparison(): boolean {
    return this.modelAuditVisible && this.localStudyEnabled && this.selectedView === 'modelAudit' && this.selectedModel?.model.tour === 'ATP' &&
      this.selectedExecutionPolicy === this.consensusPolicy;
  }

  get usesReviewedAnnualNn(): boolean {
    return this.report?.reportKind === 'reviewed-archive-nn-reconstruction';
  }

  hasExecutionPolicy(policy: string): boolean {
    return !!this.selectedModel?.cohorts.some(cohort => cohort.executionPolicy === policy);
  }

  get summaryCohorts(): PredictionProductionSummaryCohort[] {
    return (this.report?.productionSummary?.cohorts ?? [])
      .filter(cohort => cohort.scope === this.selectedSummaryScope && cohort.minimumEdge >= this.minimumDisplayedEdge)
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
      ...new Set((summary?.cohorts ?? []).filter(cohort => cohort.minimumEdge >= this.minimumDisplayedEdge).map(cohort => cohort.minimumEdge)),
    ].sort((left, right) => left - right);
    const colors: Record<ProductionScope, string> = {
      ALL: 'rgba(45, 212, 191, 0.72)',
      ATP: 'rgba(56, 189, 248, 0.70)',
      WTA: 'rgba(192, 132, 252, 0.70)',
    };
    return {
      labels: thresholds.map(value => this.summaryEdgeLabel(value)),
      datasets: (['ALL', 'ATP', 'WTA'] as ProductionScope[]).map(scope => ({
        label: this.p.scope(scope),
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
        this.p.source('Start'),
        ...points.map(point =>
          this.p.regional.date(point.matchDate)
        ),
      ],
      datasets: [{
        label: this.p.source('Flat one-unit cumulative profit'),
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
        cohort.executionPolicy === this.selectedExecutionPolicy && cohort.cohortKind === 'edge' &&
        cohort.threshold >= this.minimumDisplayedEdge
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
      Math.abs(cohort.threshold - this.minimumDisplayedEdge) < 0.000001
    ) ?? cohorts.find(cohort => cohort.cohortKind === 'edge') ?? cohorts[0] ?? null;
  }

  get roiChartData(): ChartData<'bar'> {
    const model = this.selectedModel;
    const thresholds = this.edgeThresholds(model);
    return {
      labels: thresholds.map(value => this.summaryEdgeLabel(value)),
      datasets: [
        {
          label: this.p.source('Consensus median'),
          data: thresholds.map(threshold =>
            this.findEdgeCohort(model, this.consensusPolicy, threshold)?.flat.roi ?? 0
          ),
          backgroundColor: 'rgba(45, 212, 191, 0.72)',
          borderColor: '#5eead4',
          borderWidth: 1,
          borderRadius: 7,
        },
        {
          label: this.p.source('Best price (optimistic)'),
          data: thresholds.map(threshold =>
            this.findEdgeCohort(model, 'best-price', threshold)?.flat.roi ?? 0
          ),
          backgroundColor: 'rgba(251, 191, 36, 0.62)',
          borderColor: '#fcd34d',
          borderWidth: 1,
          borderRadius: 7,
        },
      ].filter(dataset => dataset.label !== this.p.source('Best price (optimistic)') || this.hasExecutionPolicy('best-price')),
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
      labels: slices.map(slice => this.p.period(slice.label)),
      datasets: [{
        label: this.p.source('Flat ROI'),
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
      this.p.source('Flat one-unit cumulative profit'),
      '#38bdf8',
      'rgba(56, 189, 248, 0.12)'
    );
  }

  get kellyTrajectoryChartData(): ChartData<'line'> {
    return this.trajectoryChartData(
      'fractionalKelly',
      this.p.source('Quarter-Kelly stress-test cumulative profit'),
      '#c084fc',
      'rgba(192, 132, 252, 0.12)'
    );
  }

  get boundedTrajectoryChartData(): ChartData<'line'> {
    return this.trajectoryChartData(
      'boundedPercentage',
      this.p.source('Bounded 1% cumulative profit'),
      '#2dd4bf',
      'rgba(45, 212, 191, 0.12)'
    );
  }

  modelLabel(model: PredictionSimulationModel): string {
    const identity = model.model;
    return [
      identity.tour,
      identity.modelVersion,
      this.p.text('features', { count: this.p.regional.number(identity.featureCount, 0, true) }),
      identity.predictionKind,
      identity.usesH2H ? 'H2H' : this.p.text('noH2H'),
    ].join(' · ');
  }

  setExecutionPolicy(policy: string): void {
    this.selectedExecutionPolicy = policy;
  }

  setView(view: SimulationView): void {
    if (view === 'modelAudit' && !this.modelAuditVisible) return;
    if (view === 'matchSelection' && !this.localStudyEnabled) return;
    this.selectedView = view;
    if (view !== 'matchSelection') this.loadLegacyReport();
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
        this.summaryEdgeThresholdOptions[0] ?? this.minimumDisplayedEdge;
    }
  }

  summaryEdgeLabel(threshold: number): string {
    return threshold === 0
      ? this.p.source('Edge > 0')
      : this.p.text('edgePp', { value: this.p.regional.number(threshold * 100,
          Number.isInteger(Math.round(threshold * 1000) / 10) ? 0 : 1) });
  }

  summaryConfidenceInterval(
    cohort: PredictionProductionSummaryCohort
  ): string {
    const interval = cohort.flatRoiCi95;
    if (!interval.available || interval.low == null || interval.high == null) {
      return this.p.text('unavailableSample', { count: this.p.regional.number(interval.sampleSize, 0, true) });
    }
    return this.p.text('interval', { low: this.p.regional.number(interval.low * 100, 1), high: this.p.regional.number(interval.high * 100, 1) });
  }

  cohortLabel(cohort: PredictionSimulationCohort): string {
    return cohort.cohortKind === 'edge'
      ? this.summaryEdgeLabel(cohort.threshold)
      : this.p.text('confidence', { value: this.p.regional.number(cohort.threshold * 100, 0) });
  }

  confidenceInterval(cohort: PredictionSimulationCohort): string {
    const interval = cohort.flat.roiCi95;
    if (!interval.available || interval.low == null || interval.high == null) {
      return this.p.text('unavailableSample', { count: this.p.regional.number(interval.sampleSize, 0, true) });
    }

    return this.p.text('interval', { low: this.p.regional.number(interval.low * 100, 1), high: this.p.regional.number(interval.high * 100, 1) });
  }

  formatCompoundedUnits(value: number): string {
    return this.p.text('units', { value: this.formatLargeNumber(value) });
  }

  formatCompoundedPercent(value: number): string {
    return `${this.formatLargeNumber(value * 100)}%`;
  }

  temporalEvidenceLabel(slice: PredictionSimulationTemporalSlice): string {
    const boundaryValue = this.selectedModel?.evaluation.outOfSampleFrom;
    if (!boundaryValue) return this.p.source('No registered boundary');

    const boundary = new Date(boundaryValue).getTime();
    const from = new Date(slice.fromInclusive).getTime();
    const to = new Date(slice.toExclusive).getTime();
    if (to <= boundary) return this.p.source('Before registered boundary');
    if (from >= boundary) return this.p.source('After registered boundary');
    return this.p.source('Boundary crosses this period');
  }

  private edgeThresholds(
    model: PredictionSimulationModel | null
  ): number[] {
    return [
      ...new Set(
        (model?.cohorts ?? [])
          .filter(cohort => cohort.cohortKind === 'edge' && cohort.threshold >= this.minimumDisplayedEdge)
          .map(cohort => cohort.threshold)
      ),
    ].sort((left, right) => left - right);
  }

  private findEdgeCohort(
    model: PredictionSimulationModel | null,
    policy: string,
    threshold: number
  ): PredictionSimulationCohort | undefined {
    if (threshold < this.minimumDisplayedEdge) return undefined;
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
        this.p.source('Start'),
        ...points.map(point =>
          this.p.regional.date(point.matchDateTime)
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
            callback: value => this.formatLargeNumber(Number(value), 0),
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
              this.p.text('profitTooltip', { value: this.formatLargeNumber(Number(context.raw)) }),
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
    if (dataIndex === 0) return this.p.source('Starting point');
    const point = this.selectedEdgeCohort?.trajectories?.points[dataIndex - 1];
    if (!point) return this.p.text('wager', { count: this.p.regional.number(dataIndex, 0, true) });
    return `${this.p.text('wager', { count: this.p.regional.number(point.sequence, 0, true) })} · ${this.p.regional.date(point.matchDateTime)}`;
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
      this.p.text('matchId', { id: point.matchTPId }),
      this.p.text('selectedSide', { side: point.selectedPlayer1 ? '1' : '2', outcome: this.p.text(point.won ? 'win' : 'loss') }),
      this.p.text('oddsEdge', { odds: this.p.regional.number(point.selectedOdds, 2), edge: this.p.regional.number(point.edge * 100, 1) }),
      this.p.text('stakeProfit', { stake: this.p.regional.number(strategy.stake, 2), profit: this.p.regional.number(strategy.profit, 2) }),
    ];
  }

  private formatLargeNumber(value: number, fractionDigits = 2): string {
    if (!Number.isFinite(value)) return this.p.source('N/A');

    const absoluteValue = Math.abs(value);
    if (absoluteValue === 0 || (absoluteValue >= 0.01 && absoluteValue < 1e15)) {
      return this.p.regional.number(value, fractionDigits, true);
    }

    const exponent = Math.floor(Math.log10(absoluteValue));
    const mantissa = value / Math.pow(10, exponent);
    return `${this.p.regional.number(mantissa, fractionDigits)} × 10${this.toSuperscript(exponent)}`;
  }

  private toSuperscript(value: number): string {
    const superscriptDigits: Record<string, string> = {
      '-': '⁻',
      '0': '⁰',
      '1': '¹',
      '2': '²',
      '3': '³',
      '4': '⁴',
      '5': '⁵',
      '6': '⁶',
      '7': '⁷',
      '8': '⁸',
      '9': '⁹',
    };
    return value.toString().split('').map(character => superscriptDigits[character]).join('');
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
