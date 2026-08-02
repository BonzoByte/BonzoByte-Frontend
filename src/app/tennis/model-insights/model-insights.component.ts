import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { AnalyticsDashboard } from '../../core/models/analytics.model';
import {
  ExplainabilityModel,
  ModelExplainabilityReport
} from '../../core/models/model-explainability.model';

@Component({
  selector: 'app-model-insights',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './model-insights.component.html',
  styleUrls: ['./model-insights.component.scss']
})
export class ModelInsightsComponent implements OnInit, OnDestroy {
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
          callback: value => `${Number(value).toFixed(0)}%`
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
          label: context => `${Number(context.raw).toFixed(2)}% of model influence`
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
          label: context => `${context.label}: ${Number(context.raw).toFixed(2)}%`
        }
      }
    }
  };

  constructor(private staticArchivesService: StaticArchivesService) { }

  ngOnInit(): void {
    document.body.classList.add('no-datebar');
    this.staticArchivesService.getAnalyticsDashboard().subscribe({
      next: (data) => {
        this.analytics = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load model insights data', err);
        this.error = 'Failed to load model insights data.';
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
      labels: topFeatures.map(feature => feature.label),
      datasets: [{
        label: 'Influence',
        data: topFeatures.map(feature => feature.share * 100),
        backgroundColor: '#20c997',
        borderColor: '#14966f',
        borderWidth: 1,
        borderRadius: 5
      }]
    };

    const families = model.families.slice(0, 7);
    this.familyChartData = {
      labels: families.map(family => family.name),
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
