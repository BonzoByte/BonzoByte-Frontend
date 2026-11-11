import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportPresentationService } from '../../core/i18n/report-presentation.service';
import {
  sampleSqlStudyTrajectory, selectSqlStudyCohort, SqlSelectionStudy, SqlStudyCohort,
  SqlStudyGranularity, SqlStudyScope, sqlStudyPeriods,
} from '../../core/models/sql-selection-study.model';
import { LOCAL_SQL_STUDY_ENABLED, SqlSelectionStudyService } from '../../core/services/sql-selection-study.service';

@Component({
  selector: 'app-sql-selection-study',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './sql-selection-study.component.html',
  styleUrls: ['./sql-selection-study.component.scss'],
})
export class SqlSelectionStudyComponent implements OnInit {
  readonly p = inject(ReportPresentationService);
  private readonly service = inject(SqlSelectionStudyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly enabled = inject(LOCAL_SQL_STUDY_ENABLED);
  readonly scopes: SqlStudyScope[] = ['ALL', 'ATP', 'WTA'];
  readonly granularities: SqlStudyGranularity[] = ['year', 'quarter'];
  study: SqlSelectionStudy | null = null;
  loading = true;
  unavailable = false;
  scope: SqlStudyScope = 'ALL';
  readonly atpThresholdPp = 10;
  readonly wtaThresholdPp = 10;
  readonly visibleThresholdsPp = [10];
  granularity: SqlStudyGranularity = 'year';
  private chartCache?: {
    cohort: SqlStudyCohort | null; locale: string; language: string;
    data: ChartData<'line'>; options: ChartOptions<'line'>;
  };

  ngOnInit(): void {
    if (!this.enabled) { this.loading = false; this.unavailable = true; return; }
    this.service.getStudy().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: study => {
        // Never label the previous strict >10 report as the inclusive >=10 rule.
        if (study.schemaVersion !== 2 || study.rule.operator !== '>=') {
          this.loading = false; this.unavailable = true; return;
        }
        this.study = study;
        this.loading = false;
      },
      error: () => { this.loading = false; this.unavailable = true; },
    });
  }

  t(key: string, params?: Record<string, unknown>): string { return this.p.regional.text(`sqlStudy.${key}`, params); }
  n(value: number, digits = 0): string { return this.p.regional.number(value, digits, true); }
  percent(value: number | null): string { return value === null ? '—' : `${this.n(value * 100, 2)}%`; }
  threshold(value: number): string { return this.t('thresholdValue', { value: this.n(value, Number.isInteger(value) ? 0 : 1) }); }

  get selectedCohort(): SqlStudyCohort | null {
    return this.study ? selectSqlStudyCohort(this.study, this.scope, this.atpThresholdPp, this.wtaThresholdPp) : null;
  }

  get periods() { return sqlStudyPeriods(this.selectedCohort, this.granularity); }

  tourCohort(tour: 'ATP' | 'WTA', threshold: number): SqlStudyCohort | null {
    return this.study && threshold >= 10 ? selectSqlStudyCohort(this.study, tour, threshold, threshold) : null;
  }

  get chartData(): ChartData<'line'> { return this.chartPresentation().data; }
  get chartOptions(): ChartOptions<'line'> { return this.chartPresentation().options; }

  private chartPresentation() {
    const cohort = this.selectedCohort, locale = this.p.regional.locale(), language = this.p.regional.language();
    if (this.chartCache?.cohort === cohort && this.chartCache.locale === locale && this.chartCache.language === language) return this.chartCache;
    // Reserve one plotted point for the initial zero balance.
    const points = sampleSqlStudyTrajectory(cohort?.trajectory ?? [], 599);
    const data: ChartData<'line'> = {
      labels: [this.p.source('Start'), ...points.map(point => this.p.regional.date(point.date))],
      datasets: [{ label: this.t('netUnits'), data: [0, ...points.map(point => point.netUnits)],
        borderColor: '#14b8a6', backgroundColor: 'rgba(20,184,166,0.12)',
        fill: true, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, tension: 0 }],
    };
    const options: ChartOptions<'line'> = {
      responsive: true, maintainAspectRatio: false, animation: false,
      locale,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: this.t('endOfDay') }, ticks: { maxTicksLimit: 12 } },
        y: { title: { display: true, text: this.t('netUnits') }, ticks: { callback: value => this.n(Number(value), 2) } },
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: context => `${this.t('netUnits')}: ${this.n(Number(context.raw), 2)}`,
      } } },
    };
    return this.chartCache = { cohort, locale, language, data, options };
  }
}
