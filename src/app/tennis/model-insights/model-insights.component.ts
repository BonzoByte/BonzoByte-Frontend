import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ReportPresentationService } from '../../core/i18n/report-presentation.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { Subscription } from 'rxjs';
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { AnalyticsDashboard } from '../../core/models/analytics.model';
import {
  ExplainabilityModel,
  ModelExplainabilityReport
} from '../../core/models/model-explainability.model';

@Component({
  selector: 'app-model-insights',
  standalone: true,
  imports: [TranslateModule, CommonModule, BaseChartDirective],
  templateUrl: './model-insights.component.html',
  styleUrls: ['./model-insights.component.scss']
})
export class ModelInsightsComponent implements OnInit, OnDestroy {
  private languageSubscription?: Subscription;
  analytics: AnalyticsDashboard | null = null;
  explainability: ModelExplainabilityReport | null = null;
  selectedExplainabilityModelId: string | null = null;
  isLoading = true;
  error: string | null = null;

  featureChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  familyChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };

  readonly featureChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: '#7c8793',
          callback: value => `${this.p.regional.number(Number(value), 0)}%`
        },
        grid: { color: 'rgba(127, 127, 127, 0.16)' }
      },
      y: {
        ticks: { color: '#7c8793', autoSkip: false },
        grid: { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: context => this.p.text('influenceTooltip', { value: this.p.regional.number(Number(context.raw), 2) }),
          afterLabel: context => this.selectedExplainabilityModel?.topFeatures[context.dataIndex]?.name ?? ''
        }
      }
    }
  };

  readonly familyChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#7c8793', boxWidth: 12 }
      },
      tooltip: {
        callbacks: {
          label: context => `${context.label}: ${this.p.regional.number(Number(context.raw), 2)}%`
        }
      }
    }
  };

  constructor(private staticArchivesService: StaticArchivesService, public readonly p: ReportPresentationService) { }

  ngOnInit(): void {
    document.body.classList.add('no-datebar');
    this.languageSubscription = this.p.regional.changes.subscribe(() => {
      this.selectExplainabilityModel(this.selectedExplainabilityModelId);
    });
    this.staticArchivesService.getAnalyticsDashboard().subscribe({
      next: (data) => {
        this.analytics = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load model insights data', err);
        this.error = 'reports.messages.insightsError';
        this.isLoading = false;
      }
    });

    this.staticArchivesService.getModelExplainability().subscribe({
      next: report => {
        this.explainability = report;
        this.selectExplainabilityModel(report.models[0]?.id ?? null);
      },
      error: err => {
        console.error('Failed to load model explainability data', err);
      }
    });
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
    document.body.classList.remove('no-datebar');
  }

  get modelInsights() {
    return this.analytics?.modelInsights ?? null;
  }

  get updatedAt(): string | null {
    return this.analytics?.generatedAtUtc ?? null;
  }

  get selectedExplainabilityModel(): ExplainabilityModel | null {
    return this.explainability?.models.find(
      model => model.id === this.selectedExplainabilityModelId
    ) ?? null;
  }

  selectExplainabilityModel(modelId: string | null): void {
    this.selectedExplainabilityModelId = modelId;
    const model = this.selectedExplainabilityModel;
    if (!model) {
      this.featureChartData = { labels: [], datasets: [] };
      this.familyChartData = { labels: [], datasets: [] };
      return;
    }

    const topFeatures = model.topFeatures.slice(0, 10);
    this.featureChartData = {
      labels: topFeatures.map(feature => this.p.feature(feature.name, feature.label)),
      datasets: [{
        label: this.p.source('Influence'),
        data: topFeatures.map(feature => feature.share * 100),
        backgroundColor: '#20c997',
        borderColor: '#14966f',
        borderWidth: 1,
        borderRadius: 5
      }]
    };

    const families = model.families.slice(0, 7);
    this.familyChartData = {
      labels: families.map(family => this.p.source(family.name)),
      datasets: [{
        data: families.map(family => family.share * 100),
        backgroundColor: [
          '#20c997', '#4dabf7', '#845ef7', '#ff922b',
          '#fcc419', '#f06595', '#74c0fc'
        ],
        borderWidth: 0
      }]
    };
  }
}
