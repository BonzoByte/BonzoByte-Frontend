import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ReportPresentationService } from '../../core/i18n/report-presentation.service';
import { Component, OnInit } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';

import { StaticArchivesService } from '../../core/services/static-archives.service';
import { AnalyticsDashboard, ChartPoint } from '../../core/models/analytics.model';
import { annualChart, annualChartNote } from '../../core/helpers/annual-chart';

@Component({
    selector: 'app-analytics',
    standalone: true,
    imports: [TranslateModule, CommonModule, BaseChartDirective],
    templateUrl: './analytics.component.html',
    styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit {
    analytics: AnalyticsDashboard | null = null;
    isLoading = true;
    error: string | null = null;

    constructor(private staticArchivesService: StaticArchivesService, public readonly p: ReportPresentationService) { }

    ngOnInit(): void {
        this.staticArchivesService.getAnalyticsDashboard().subscribe({
            next: (data) => {
                this.analytics = data;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Failed to load analytics data', err);
                this.error = 'reports.messages.analyticsError';
                this.isLoading = false;
            }
        });
    }

    get updatedAt(): string | null {
        return this.analytics?.generatedAtUtc ?? null;
    }

    readonly doughnutOptions: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#e5e7eb'
                }
            }
        }
    };

    readonly barOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                ticks: { color: '#d1d5db' },
                grid: { color: 'rgba(255,255,255,0.08)' }
            },
            y: {
                ticks: { color: '#d1d5db' },
                grid: { color: 'rgba(255,255,255,0.08)' }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };

    readonly lineOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                ticks: { color: '#d1d5db', maxRotation: 0, autoSkip: true },
                grid: { color: 'rgba(255,255,255,0.08)' }
            },
            y: {
                ticks: { color: '#d1d5db' },
                grid: { color: 'rgba(255,255,255,0.08)' }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };

    readonly averageBookiesLineOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                ticks: {
                    color: '#d1d5db',
                    autoSkip: false,
                    minRotation: 45,
                    maxRotation: 45
                },
                grid: { color: 'rgba(255,255,255,0.08)' }
            },
            y: {
                ticks: { color: '#d1d5db' },
                grid: { color: 'rgba(255,255,255,0.08)' }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: context =>
                        this.p.text('booksTooltip', { value: this.p.regional.number(Number(context.raw), 2) }),
                    afterLabel: context => {
                        const coverage = this.analytics?.marketBehaviour?.oddsCoverageOverTime
                            ?.find(point => point.label === context.label);
                        return coverage
                            ? this.p.text('coverageTooltip', { value: this.p.regional.number(coverage.value, 0, true) })
                            : '';
                    }
                }
            }
        }
    };

    get atpWtaChartData(): ChartData<'doughnut'> {
        const items = this.analytics?.overview?.tournamentTypeSplit ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value)
                }
            ]
        };
    }

    get finishedUnfinishedChartData(): ChartData<'doughnut'> {
        const items = this.analytics?.overview?.matchStatusSplit ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value)
                }
            ]
        };
    }

    get matchesBySurfaceChartData(): ChartData<'bar'> {
        const items = this.analytics?.matchLandscape?.matchesBySurface ?? [];
        return {
            labels: items.map(x => this.p.surface(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: this.p.source('Matches')
                }
            ]
        };
    }

    get matchesByYearChartData(): ChartData<'line'> {
        const items = this.analytics?.matchLandscape?.matchesByYear ?? [];
        return annualChart(items, this.p.source('Matches'), this.analytics?.overview?.dateRange?.to ?? null, undefined, this.p.text('partial'));
    }

    get matchesByYearNote(): string {
        return annualChartNote(this.analytics?.matchLandscape?.matchesByYear ?? [],
            this.analytics?.overview?.dateRange?.to ?? null, undefined, {
              text: (key, params) => this.p.text(key, params), date: value => this.p.regional.date(value)
            });
    }

    get oddsCoverageNote(): string {
        return annualChartNote(this.analytics?.marketBehaviour?.oddsCoverageOverTime ?? [],
            this.analytics?.overview?.dateRange?.to ?? null, undefined, {
              text: (key, params) => this.p.text(key, params), date: value => this.p.regional.date(value)
            });
    }

    trackByLabel(_: number, item: ChartPoint): string {
        return item.label;
    }

    get matchesByRoundChartData(): ChartData<'bar'> {
        const items = this.analytics?.matchLandscape?.matchesByRound ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: this.p.source('Matches')
                }
            ]
        };
    }

    get matchLengthSplitChartData(): ChartData<'doughnut'> {
        const items = this.analytics?.matchLandscape?.matchLengthSplit ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value)
                }
            ]
        };
    }

    get tournamentsByLevelChartData(): ChartData<'bar'> {
        const items = this.analytics?.tournamentInsights?.tournamentsByLevel ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: this.p.source('Tournaments')
                }
            ]
        };
    }

    get tournamentsBySurfaceChartData(): ChartData<'bar'> {
        const items = this.analytics?.tournamentInsights?.tournamentsBySurface ?? [];
        return {
            labels: items.map(x => this.p.surface(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: this.p.source('Tournaments')
                }
            ]
        };
    }

    get topCountriesChartData(): ChartData<'bar'> {
        const items = this.analytics?.tournamentInsights?.topCountriesByTournamentCount ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: this.p.source('Tournaments')
                }
            ]
        };
    }

    get averageStrengthMeanTsByLevelChartData(): ChartData<'bar'> {
        const items = this.analytics?.tournamentInsights?.averageStrengthMeanTsByLevel ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: this.p.source('Average StrengthMeanTS')
                }
            ]
        };
    }

    readonly horizontalBarOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
            x: {
                ticks: { color: '#d1d5db' },
                grid: { color: 'rgba(255,255,255,0.08)' }
            },
            y: {
                ticks: { color: '#d1d5db' },
                grid: { color: 'rgba(255,255,255,0.08)' }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };

    get favoriteWinRateByBucketChartData(): ChartData<'bar'> {
        const items = this.analytics?.marketBehaviour?.favoriteWinRateByImpliedProbabilityBucket ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: this.p.source('Favorite Win Rate (%)')
                }
            ]
        };
    }

    get underdogWinRateByBucketChartData(): ChartData<'bar'> {
        const items = this.analytics?.marketBehaviour?.underdogWinRateByImpliedProbabilityBucket ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: this.p.source('Underdog Win Rate (%)')
                }
            ]
        };
    }

    get oddsCoverageOverTimeChartData(): ChartData<'line'> {
        const items = this.analytics?.marketBehaviour?.oddsCoverageOverTime ?? [];
        return annualChart(items, this.p.source('Matches With Odds'), this.analytics?.overview?.dateRange?.to ?? null, undefined, this.p.text('partial'));
    }

    get averageBookiesPerMatchByYearChartData(): ChartData<'line'> {
        const items = this.analytics?.marketBehaviour?.averageBookiesPerMatchByYear ?? [];
        return {
            labels: items.map(x => this.p.source(x.label)),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: this.p.source('Average Bookies'),
                    tension: 0.25,
                    fill: false
                }
            ]
        };
    }

    get averageBookiesCoverageNote(): string {
        const items = this.analytics?.marketBehaviour?.averageBookiesPerMatchByYear ?? [];
        const latestYear = items[items.length - 1]?.label;
        const currentYear = new Date().getUTCFullYear().toString();

        if (!latestYear) {
            return this.p.text('booksEmpty');
        }

        const availability = Number(latestYear) < Number(currentYear)
            ? this.p.text('booksStale', { latest: latestYear, year: currentYear })
            : this.p.text('booksCurrent', { latest: latestYear });

        return `${availability} ${this.p.text('booksNote')}`;
    }

    readonly percentBarOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                ticks: { color: '#d1d5db' },
                grid: { color: 'rgba(255,255,255,0.08)' }
            },
            y: {
                beginAtZero: true,
                max: 100,
                ticks: { color: '#d1d5db' },
                grid: { color: 'rgba(255,255,255,0.08)' }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };
}
