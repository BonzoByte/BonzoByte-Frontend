import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportPresentationService } from '../../core/i18n/report-presentation.service';
import {
  AtpFairCohort, AtpFairComparison, AtpFairMode, atpFairPeriods, matchingAtpFairCohort,
} from '../../core/models/atp-fair-comparison.model';
import { AtpFairComparisonService } from '../../core/services/atp-fair-comparison.service';
import { LOCAL_SQL_STUDY_ENABLED } from '../../core/services/sql-selection-study.service';

@Component({
  selector: 'app-atp-fair-comparison',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './atp-fair-comparison.component.html',
  styleUrls: ['./atp-fair-comparison.component.scss'],
})
export class AtpFairComparisonComponent implements OnInit {
  @Input() mode: AtpFairMode = 'summary';
  @Input() threshold = 0.10;
  @Output() readonly thresholdChange = new EventEmitter<number>();
  @Input() sourceGeneratedAtUtc = '';
  @Input() expectedBets: number | null = null;
  @Input() expectedWins: number | null = null;
  @Input() expectedLosses: number | null = null;
  @Input() expectedMedianProfit: number | null = null;

  readonly p = inject(ReportPresentationService);
  private readonly service = inject(AtpFairComparisonService);
  private readonly enabled = inject(LOCAL_SQL_STUDY_ENABLED);
  private readonly destroyRef = inject(DestroyRef);
  report: AtpFairComparison | null = null;
  loading = true;
  unavailable = false;
  granularity: 'year' | 'quarter' = 'year';
  private chartCache?: {
    cohort: AtpFairCohort | null; locale: string; language: string;
    data: ChartData<'line'>; options: ChartOptions<'line'>;
  };
  private tableCache?: { family: object; cohorts: AtpFairCohort[] };

  ngOnInit(): void {
    if (!this.enabled) { this.loading = false; this.unavailable = true; return; }
    this.service.getComparison().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: report => { this.report = report; this.loading = false; },
      error: () => { this.unavailable = true; this.loading = false; },
    });
  }

  t(key: string, params?: Record<string, unknown>): string { return this.p.regional.text(`atpFair.${key}`, params); }
  n(value: number, digits = 0): string { return this.p.regional.number(value, digits, true); }
  percent(value: number | null): string { return value === null ? '—' : `${this.n(value * 100, 2)}%`; }
  thresholdLabel(value: number): string {
    const pp = Math.round(value * 1000) / 10;
    return this.t(value === 0 ? 'thresholdPositive' : 'thresholdValue', { value: this.n(pp, Number.isInteger(pp) ? 0 : 1) });
  }

  get family() { return this.report?.families.find(family => family.mode === this.mode) ?? null; }

  get selectedCohort(): AtpFairCohort | null {
    if (!this.enabled || this.threshold < 0.10) return null;
    return matchingAtpFairCohort(this.report, {
      mode: this.mode, threshold: this.threshold, sourceGeneratedAtUtc: this.sourceGeneratedAtUtc,
      bets: this.expectedBets, wins: this.expectedWins, losses: this.expectedLosses, medianProfit: this.expectedMedianProfit,
    });
  }

  get cohorts(): AtpFairCohort[] {
    const family = this.family;
    if (!family) return [];
    if (this.tableCache?.family !== family) this.tableCache = {
      family, cohorts: family.cohorts.filter(cohort => cohort.threshold >= 0.10).sort((left, right) => left.threshold - right.threshold),
    };
    return this.tableCache.cohorts;
  }

  get periods() { return atpFairPeriods(this.selectedCohort, this.granularity); }

  chooseThreshold(value: number): void {
    if (this.selectedCohort && this.cohorts.some(cohort => Math.abs(cohort.threshold - value) < 1e-12)) {
      this.thresholdChange.emit(value);
    }
  }

  get chartData(): ChartData<'line'> { return this.chartPresentation().data; }
  get chartOptions(): ChartOptions<'line'> { return this.chartPresentation().options; }

  private chartPresentation() {
    const cohort = this.selectedCohort, locale = this.p.regional.locale(), language = this.p.regional.language();
    if (this.chartCache?.cohort === cohort && this.chartCache.locale === locale && this.chartCache.language === language) return this.chartCache;
    const points = cohort?.trajectory ?? [];
    const data: ChartData<'line'> = {
      labels: [this.p.source('Start'), ...points.map(point => this.p.regional.date(point.date))],
      datasets: [
        { label: this.t('median'), data: [0, ...points.map(point => point.medianProfit)], borderColor: '#14b8a6',
          pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, tension: 0 },
        { label: this.t('fair'), data: [0, ...points.map(point => point.fairProfit)], borderColor: '#a78bfa',
          pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, borderDash: [6, 3], tension: 0 },
      ],
    };
    const options: ChartOptions<'line'> = {
      responsive: true, maintainAspectRatio: false, animation: false, locale,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: this.t('endOfDay') }, ticks: { maxTicksLimit: 12 } },
        y: { title: { display: true, text: this.t('profit') }, ticks: { callback: value => this.n(Number(value), 2) } },
      },
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: {
        label: context => `${context.dataset.label}: ${this.n(Number(context.raw), 2)}`,
      } } },
    };
    return this.chartCache = { cohort, locale, language, data, options };
  }
}
