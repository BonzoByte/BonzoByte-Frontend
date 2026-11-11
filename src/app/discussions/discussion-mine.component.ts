import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DiscussionsService, MyDiscussion, MyDiscussionsPage } from '../core/services/discussions.service';
import { MatchSummary } from '../core/models/match-summary';
import { DiscussionCardComponent, DiscussionCardTarget, DiscussionListHeadingComponent } from './discussion-card.component';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { ViewRecoveryActionsComponent } from '../shared/ui/view-recovery-actions/view-recovery-actions.component';

@Component({ selector: 'app-discussion-mine', standalone: true, imports: [CommonModule, TranslateModule, DiscussionCardComponent, DiscussionListHeadingComponent, ViewRecoveryActionsComponent],
    template: `<app-discussion-list-heading noteKey="discussions.mineNote" [loading]="loading()" (refresh)="refresh()"></app-discussion-list-heading>
      <p *ngIf="loading()" role="status">{{ 'common.loading' | translate }}</p>
      <div *ngIf="failed()" role="alert">{{ 'discussions.mineFailed' | translate }}
        <button type="button" [disabled]="loading()" (click)="retry()">{{ 'discussions.retry' | translate }}</button></div>
      <div *ngIf="page() && !loading() && !failed() && !page()!.threads.length"><p>{{ 'discussions.mineEmpty' | translate }}</p>
        <app-view-recovery-actions [showBrowse]="true" (browse)="browseMatches.emit()"></app-view-recovery-actions></div>
      <app-discussion-card *ngIf="page() as current" [attr.aria-busy]="loading()" [targets]="current.threads" [summaries]="summaries"
        (openThread)="openThread.emit($event)"></app-discussion-card>
      <nav *ngIf="page() && (pageIndex() > 0 || page()!.hasMore)" class="mine-paging" [attr.aria-label]="'discussions.minePages' | translate">
        <button type="button" class="mine-previous" [disabled]="loading() || pageIndex() === 0" (click)="previous()">{{ 'discussions.minePrevious' | translate }}</button>
        <span aria-live="polite">{{ 'discussions.minePage' | translate:{page: regional.number(pageIndex() + 1, 0, true)} }}</span>
        <button type="button" class="mine-next" [disabled]="loading() || !page()!.hasMore" (click)="next()">{{ 'discussions.mineNext' | translate }}</button>
      </nav>`,
    styles: [`:host{display:block;min-width:0;max-width:100%;white-space:normal;}
      button{background:transparent;color:inherit;border:1px solid var(--bb-border,#526071);border-radius:6px;padding:8px;cursor:pointer;}
      button:disabled{opacity:.5;cursor:default;} button:focus-visible{outline:2px solid var(--bb-accent,#80d5ff);outline-offset:2px;}
      ul{list-style:none;padding:0;margin:0;min-width:0;} li{min-width:0;}
      .mine-paging{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;font-size:.8rem;}`] })
export class DiscussionMineComponent implements OnInit, OnDestroy {
    @Output() openThread = new EventEmitter<DiscussionCardTarget>();
    @Output() rowsChanged = new EventEmitter<readonly MyDiscussion[]>();
    @Output() browseMatches = new EventEmitter<void>();
    @Input() summaries: ReadonlyMap<number, MatchSummary> = new Map();
    readonly page = signal<MyDiscussionsPage | null>(null);
    readonly loading = signal(false);
    readonly failed = signal(false);
    readonly pageIndex = signal(0);
    private cursors: (string | undefined)[] = [undefined];
    private pending?: Subscription;
    private account?: Subscription;
    private pulse?: Subscription;
    private notificationPulse?: Subscription;
    private retryLoad = () => this.refresh();
    readonly trackThread = (_: number, thread: MyDiscussion) => thread.matchTPId;
    constructor(readonly api: DiscussionsService, readonly regional: RegionalSettingsService) {}
    ngOnInit(): void {
        this.account = this.api.accountChanged.subscribe(() => {
            this.pending?.unsubscribe(); this.page.set(null); this.loading.set(false); this.failed.set(false);
            this.pageIndex.set(0); this.cursors = [undefined]; this.retryLoad = () => this.refresh();
        });
        const refreshPage = () => {
            if (this.api.signedIn && this.api.visible && this.page() && !this.loading())
                this.load(this.cursors[this.pageIndex()], this.cursors, this.pageIndex());
        };
        this.pulse = this.api.pulse.subscribe(refreshPage);
        this.notificationPulse = this.api.notificationsChanged?.subscribe(refreshPage);
        this.refresh();
    }
    refresh(): void { this.load(undefined, [undefined], 0); }
    next(): void {
        const after = this.page()?.nextAfter;
        if (this.loading() || !this.page()?.hasMore || !after) return;
        const index = this.pageIndex() + 1;
        this.load(after, [...this.cursors.slice(0, index), after], index);
    }
    previous(): void {
        if (this.loading() || this.pageIndex() === 0) return;
        const index = this.pageIndex() - 1;
        this.load(this.cursors[index], this.cursors, index);
    }
    retry(): void { if (!this.loading()) this.retryLoad(); }
    private load(after: string | undefined, cursors: (string | undefined)[], index: number): void {
        if (!this.api.signedIn) return;
        this.pending?.unsubscribe(); this.loading.set(true); this.failed.set(false);
        this.retryLoad = () => this.load(after, cursors, index);
        this.pending = this.api.minePage(after).subscribe({
            next: page => { this.page.set(page); this.cursors = cursors; this.pageIndex.set(index); this.loading.set(false); this.rowsChanged.emit(page.threads); },
            error: () => { this.loading.set(false); this.failed.set(true); },
        });
    }
    ngOnDestroy(): void { this.pending?.unsubscribe(); this.account?.unsubscribe(); this.pulse?.unsubscribe(); this.notificationPulse?.unsubscribe(); }
}
