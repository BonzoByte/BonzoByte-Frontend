import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';

import { StaticArchivesService } from '../../core/services/static-archives.service';
import { AnalyticsDashboard, ChartPoint } from '../../core/models/analytics.model';

@Component({
    selector: 'app-analytics',
    standalone: true,
    imports: [CommonModule, BaseChartDirective],
    templateUrl: './analytics.component.html',
    styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit {
    analytics: AnalyticsDashboard | null = null;
    isLoading = true;
    error: string | null = null;

    constructor(private staticArchivesService: StaticArchivesService) { }

    ngOnInit(): void {
        this.staticArchivesService.getAnalyticsDashboard().subscribe({
            next: (data) => {
                this.analytics = data;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Failed to load analytics data', err);
                this.error = 'Failed to load analytics data.';
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
                        `Average qualifying bookmakers: ${Number(context.raw).toFixed(2)}`,
                    afterLabel: context => {
                        const coverage = this.analytics?.marketBehaviour?.oddsCoverageOverTime
                            ?.find(point => point.label === context.label);
                        return coverage
                            ? `Matches with odds: ${coverage.value.toLocaleString('en-US')}`
                            : '';
                    }
                }
            }
        }
    };

    get atpWtaChartData(): ChartData<'doughnut'> {
        const items = this.analytics?.overview?.tournamentTypeSplit ?? [];
        return {
            labels: items.map(x => x.label),
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
            labels: items.map(x => x.label),
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
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Matches'
                }
            ]
        };
    }

    get matchesByYearChartData(): ChartData<'line'> {
        const items = this.analytics?.matchLandscape?.matchesByYear ?? [];
        return {
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Matches',
                    tension: 0.25,
                    fill: false
                }
            ]
        };
    }

    trackByLabel(_: number, item: ChartPoint): string {
        return item.label;
    }

    get matchesByRoundChartData(): ChartData<'bar'> {
        const items = this.analytics?.matchLandscape?.matchesByRound ?? [];
        return {
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Matches'
                }
            ]
        };
    }

    get matchLengthSplitChartData(): ChartData<'doughnut'> {
        const items = this.analytics?.matchLandscape?.matchLengthSplit ?? [];
        return {
            labels: items.map(x => x.label),
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
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Tournaments'
                }
            ]
        };
    }

    get tournamentsBySurfaceChartData(): ChartData<'bar'> {
        const items = this.analytics?.tournamentInsights?.tournamentsBySurface ?? [];
        return {
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Tournaments'
                }
            ]
        };
    }

    get topCountriesChartData(): ChartData<'bar'> {
        const items = this.analytics?.tournamentInsights?.topCountriesByTournamentCount ?? [];
        return {
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Tournaments'
                }
            ]
        };
    }

    get averageStrengthMeanTsByLevelChartData(): ChartData<'bar'> {
        const items = this.analytics?.tournamentInsights?.averageStrengthMeanTsByLevel ?? [];
        return {
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Average StrengthMeanTS'
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
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Favorite Win Rate (%)'
                }
            ]
        };
    }

    get underdogWinRateByBucketChartData(): ChartData<'bar'> {
        const items = this.analytics?.marketBehaviour?.underdogWinRateByImpliedProbabilityBucket ?? [];
        return {
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Underdog Win Rate (%)'
                }
            ]
        };
    }

    get oddsCoverageOverTimeChartData(): ChartData<'line'> {
        const items = this.analytics?.marketBehaviour?.oddsCoverageOverTime ?? [];
        return {
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Matches With Odds',
                    tension: 0.25,
                    fill: false
                }
            ]
        };
    }

    get averageBookiesPerMatchByYearChartData(): ChartData<'line'> {
        const items = this.analytics?.marketBehaviour?.averageBookiesPerMatchByYear ?? [];
        return {
            labels: items.map(x => x.label),
            datasets: [
                {
                    data: items.map(x => x.value),
                    label: 'Average Bookies',
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
            return 'No qualifying bookmaker coverage is available.';
        }

        const availability = Number(latestYear) < Number(currentYear)
            ? `The current archive ends in ${latestYear}; ${currentYear} will appear once qualifying bookmaker aggregates are available.`
            : `The current archive includes ${latestYear}.`;

        return `${availability} Values are per-match averages after odds-quality filters and are not annualized.`;
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
