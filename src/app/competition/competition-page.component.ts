import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { environment } from '@env/environment';
import { CompetitionBoard, CompetitionMine, CompetitionService, CompetitionDemoWindow, TestActivity } from '../core/services/competition.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { createPredictionPreview, predictionPreviewAllowed } from './prediction-preview';
import { PredictionHistoryGridComponent } from './prediction-history-grid.component';
import { leaderboardDemoName } from './leaderboard-demo-names';

@Component({ selector: 'app-competition-page', standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, TranslateModule, PredictionHistoryGridComponent],
    templateUrl: './competition-page.component.html', styleUrls: ['./competition-page.component.scss'] })
export class CompetitionPageComponent implements OnInit, OnDestroy {
    readonly mineMode: boolean;
    readonly maxMonth: string;
    month: string;
    mine: CompetitionMine | null = null;
    board: CompetitionBoard | null = null;
    get boardHasRows(): boolean { return !!(this.board && (this.board.qualified.length || this.board.provisional.length)); }
    leaderboardName(nickname: string): string {
        return this.demoMode && this.board?.demo === true ? leaderboardDemoName(nickname) : nickname;
    }
    loading = false; failed = false;
    sourceConnected = false;
    demoMode = false;
    readonly previewAllowed = predictionPreviewAllowed(environment, typeof location === 'undefined' ? '' : location.hostname);
    previewMode = false;
    get illustrativeMode(): boolean { return this.demoMode || this.previewMode; }
    demoWindow: CompetitionDemoWindow | null = null;
    testActivity: TestActivity | null = null;
    private explicitMonth = false;
    private request?: Subscription;
    private actorSubscription?: Subscription;
    private rulesSubscription?: Subscription;
    private routeSubscription?: Subscription;
    private timer?: ReturnType<typeof setInterval>;
    constructor(public service: CompetitionService, public regional: RegionalSettingsService, private route: ActivatedRoute) {
        this.mineMode = route.snapshot.data?.['mine'] === true;
        this.month = this.maxMonth = service.currentMonth();
    }
    ngOnInit(): void {
        this.actorSubscription = this.service.actorChanged.subscribe(() => { this.request?.unsubscribe(); this.mine = null; this.load(); });
        this.rulesSubscription = this.service.rules().subscribe({ next: result => {
            this.sourceConnected = result.sourceConnected; this.demoWindow = result.demo || null;
            this.testActivity = result.testActivity || null;
            if(this.testActivity){ this.previewMode=this.demoMode=false; if(!this.explicitMonth)this.month=this.testActivity.preferredMonth; this.load(); }
        }, error: () => {} });
        this.routeSubscription = this.route.queryParamMap.subscribe(params => {
            const month = params.get('month') || '';
            this.explicitMonth = /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) && month <= this.maxMonth;
            this.month = this.explicitMonth ? month : this.testActivity?.preferredMonth || this.maxMonth;
            this.previewMode = !this.testActivity && this.mineMode && this.previewAllowed && params.get('preview') === '1';
            this.demoMode = !this.testActivity && !this.previewMode && params.get('demo') === '1'; this.load();
        });
        this.timer = setInterval(() => { if (!this.loading && document.visibilityState === 'visible') this.load(false); }, 60000);
    }
    load(clear = true): void {
        this.request?.unsubscribe(); this.failed = false;
        if (clear) { this.mine = null; this.board = null; }
        if (this.previewMode) {
            this.mine = createPredictionPreview(this.month); this.loading = false; return;
        }
        if (this.mineMode && !this.service.auth.getUser()?._id) { this.loading = false; return; }
        this.loading = true;
        if (this.mineMode) this.request = this.service.mine(this.month, this.demoMode).subscribe({
            next: result => { this.mine = result; this.loading = false; }, error: () => { this.failed = true; this.loading = false; } });
        else this.request = this.service.leaderboard(this.month, this.demoMode).subscribe({
            next: result => { this.board = result; this.loading = false; }, error: () => { this.failed = true; this.loading = false; } });
    }
    ngOnDestroy(): void { this.request?.unsubscribe(); this.actorSubscription?.unsubscribe(); this.rulesSubscription?.unsubscribe(); this.routeSubscription?.unsubscribe(); clearInterval(this.timer); }
}
