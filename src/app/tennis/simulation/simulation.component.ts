import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import {
  PredictionSimulationCohort,
  PredictionSimulationModel,
  PredictionSimulationReport,
} from '../../core/models/prediction-simulation.model';
import { StaticArchivesService } from '../../core/services/static-archives.service';

type DisplayTrajectoryKind =
  | 'flatUnit'
  | 'boundedPercentage'
  | 'fractionalKelly';

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
  selectedModelIndex = 0;
  selectedExecutionPolicy = this.consensusPolicy;
  selectedEdgeThreshold = 0;
  isLoading = true;
  error: string | null = null;

  readonly roiChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { color: '#cbd5e1' },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: '#cbd5e1',
          callback: value => `${(Number(value) * 100).toFixed(0)}%`,
        },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#e2e8f0', usePointStyle: true },
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

  constructor(private readonly archives: StaticArchivesService) {}

  ngOnInit(): void {
    document.body.classList.add('no-datebar');
    this.archives.getPredictionSimulation().subscribe({
      next: report => {
        this.report = report;
        this.selectedModelIndex = 0;
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
      'Quarter-Kelly cumulative profit',
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
      labels: ['0', ...points.map(point => String(point.sequence))],
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
            text: 'Chronological wager number',
            color: '#94a3b8',
          },
          ticks: {
            color: '#cbd5e1',
            autoSkip: true,
            maxTicksLimit: 12,
          },
          grid: { display: false },
        },
        y: {
          title: {
            display: true,
            text: 'Cumulative profit',
            color: '#94a3b8',
          },
          ticks: {
            color: '#cbd5e1',
            callback: value => Number(value).toFixed(0),
          },
          grid: { color: 'rgba(255,255,255,0.08)' },
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
}
