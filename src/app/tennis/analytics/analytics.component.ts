import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { AnalyticsDashboard } from '../../core/models/analytics.model';

@Component({
  selector: 'app-analytics',
  standalone: true,
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
    imports: [
        CommonModule
    ],  
})
export class AnalyticsComponent implements OnInit {
  analytics: AnalyticsDashboard | null = null;
  isLoading = true;
  error: string | null = null;

  constructor(private staticArchivesService: StaticArchivesService) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  private loadAnalytics(): void {
    this.isLoading = true;
    this.error = null;

    this.staticArchivesService.getAnalyticsDashboard().subscribe({
      next: (data) => {
        this.analytics = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load analytics dashboard archive:', err);
        this.error = 'Failed to load analytics data.';
        this.isLoading = false;
      }
    });
  }

  get updatedAt(): string | null {
    return this.analytics?.generatedAtUtc ?? null;
  }
}