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

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.scss'],
})
export class SimulationComponent implements OnInit, OnDestroy {
  report: PredictionSimulationReport | null = null;
  selectedModelIndex = 0;
  selectedExecutionPolicy = 'median-bookmaker';
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

  readonly bankrollChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { color: '#cbd5e1' },
        grid: { display: false },
      },
      y: {
        ticks: { color: '#cbd5e1' },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#e2e8f0', usePointStyle: true },
      },
    },
  };

  constructor(private readonly archives: StaticArchivesService) {}

  ngOnInit(): void {
    document.body.classList.add('no-datebar');
    this.archives.getPredictionSimulation().subscribe({
      next: report => {
        this.report = report;
        this.selectedModelIndex = this.findResearchLeader(report.models);
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
          label: 'Median bookmaker',
          data: thresholds.map(threshold =>
            this.findEdgeCohort(model, 'median-bookmaker', threshold)?.flat.roi ?? 0
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

  get bankrollChartData(): ChartData<'line'> {
    const model = this.selectedModel;
    const cohorts = this.edgeThresholds(model)
      .map(threshold =>
        this.findEdgeCohort(model, this.selectedExecutionPolicy, threshold)
      )
      .filter((cohort): cohort is PredictionSimulationCohort => cohort != null);

    return {
      labels: cohorts.map(cohort => `${(cohort.threshold * 100).toFixed(1)}%`),
      datasets: [
        {
          label: 'Fixed 1% ending bankroll',
          data: cohorts.map(cohort => cohort.fixedPercentage.endingBankroll),
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.15)',
          pointBackgroundColor: '#93c5fd',
          tension: 0.28,
        },
        {
          label: '¼ Kelly ending bankroll',
          data: cohorts.map(cohort => cohort.fractionalKelly.endingBankroll),
          borderColor: '#c084fc',
          backgroundColor: 'rgba(192, 132, 252, 0.15)',
          pointBackgroundColor: '#d8b4fe',
          tension: 0.28,
        },
      ],
    };
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

  private findResearchLeader(models: PredictionSimulationModel[]): number {
    let bestIndex = 0;
    let bestRoi = Number.NEGATIVE_INFINITY;
    let fallbackBets = -1;

    models.forEach((model, index) => {
      const medianEdgeCohorts = model.cohorts.filter(cohort =>
        cohort.executionPolicy === 'median-bookmaker' &&
        cohort.cohortKind === 'edge'
      );
      const eligible = medianEdgeCohorts.filter(cohort => cohort.bets >= 30);
      const candidate = eligible.sort((left, right) =>
        right.flat.roi - left.flat.roi
      )[0];
      const modelFallbackBets = Math.max(
        0,
        ...medianEdgeCohorts.map(cohort => cohort.bets)
      );

      if (candidate && candidate.flat.roi > bestRoi) {
        bestRoi = candidate.flat.roi;
        bestIndex = index;
      } else if (
        bestRoi === Number.NEGATIVE_INFINITY &&
        modelFallbackBets > fallbackBets
      ) {
        fallbackBets = modelFallbackBets;
        bestIndex = index;
      }
    });

    return bestIndex;
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
}
