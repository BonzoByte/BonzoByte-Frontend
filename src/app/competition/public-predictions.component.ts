import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { combineLatest, Subscription } from 'rxjs';
import { environment } from '@env/environment';
import { CompetitionPick, CompetitionPublicHistory, CompetitionService } from '../core/services/competition.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { PredictionHistoryGridComponent } from './prediction-history-grid.component';
import { leaderboardDemoName } from './leaderboard-demo-names';
import { predictionPreviewAllowed } from './prediction-preview';
import { publicPredictionPreview } from './public-prediction-preview';
import { PUBLIC_PREVIEW_ARCHIVE_DAY } from './public-prediction-identities';

@Component({ selector: 'app-public-predictions', standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, TranslateModule, PredictionHistoryGridComponent],
    templateUrl: './public-predictions.component.html', styleUrls: ['./competition-page.component.scss'] })
export class PublicPredictionsComponent implements OnInit, OnDestroy {
    readonly maxMonth: string;
    month: string;
    profileId = '';
    demoMode = false;
    data: CompetitionPublicHistory | null = null;
    displayEntries: CompetitionPick[] = [];
    localPreview = false;
    readonly archiveDay = PUBLIC_PREVIEW_ARCHIVE_DAY;
    readonly previewAllowed = predictionPreviewAllowed(environment, typeof location === 'undefined' ? '' : location.hostname);
    loading = false;
    errorKey = '';
    private request?: Subscription;
    private routeSubscription?: Subscription;
    private timer?: ReturnType<typeof setInterval>;
    get nickname(): string { return this.demoMode && this.data?.demo === true
        ? leaderboardDemoName(this.data.nickname) : this.data?.nickname || ''; }
    constructor(private service: CompetitionService, public regional: RegionalSettingsService, private route: ActivatedRoute) {
        this.month = this.maxMonth = service.currentMonth();
    }
    ngOnInit(): void {
        this.routeSubscription = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([path, query]) => {
            this.profileId = path.get('profileId') || '';
            const month = query.get('month') || '';
            this.month = /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) && month <= this.maxMonth ? month : this.maxMonth;
            this.demoMode = query.get('demo') === '1'; this.load();
        });
        this.timer = setInterval(() => { if (!this.loading && document.visibilityState === 'visible') this.load(false); }, 30000);
    }
    load(clear = true): void {
        this.request?.unsubscribe();
        if (clear) this.clearHistory();
        this.errorKey = ''; this.loading = true;
        this.request = this.service.publicHistory(this.profileId, this.month, this.demoMode).subscribe({
            next: data => {
                this.data = data;
                if(data.testActivity)this.demoMode=false;
                this.displayEntries = publicPredictionPreview(data.entries, this.previewAllowed && this.demoMode && data.demo === true);
                this.localPreview = this.displayEntries !== data.entries;
                this.loading = false;
            },
            error: error => { this.clearHistory(); this.loading = false;
                this.errorKey = [403, 404].includes(error?.status) ? 'competition.privateHistory' : 'competition.unavailable'; },
        });
    }
    private clearHistory(): void { this.data = null; this.displayEntries = []; this.localPreview = false; }
    @HostListener('window:focus') onFocus(): void { if (this.profileId && !this.loading) this.load(); }
    @HostListener('document:visibilitychange') onVisibility(): void {
        if (document.visibilityState === 'visible') this.load();
        else { this.request?.unsubscribe(); this.clearHistory(); this.loading = false; }
    }
    ngOnDestroy(): void { this.request?.unsubscribe(); this.routeSubscription?.unsubscribe(); clearInterval(this.timer); this.clearHistory(); }
}
