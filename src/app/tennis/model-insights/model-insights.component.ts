import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { AnalyticsDashboard } from '../../core/models/analytics.model';

@Component({
  selector: 'app-model-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './model-insights.component.html',
  styleUrls: ['./model-insights.component.scss']
})
export class ModelInsightsComponent implements OnInit, OnDestroy {
  analytics: AnalyticsDashboard | null = null;
  isLoading = true;
  error: string | null = null;

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
}