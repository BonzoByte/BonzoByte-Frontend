import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, OnDestroy, OnInit, Optional, ViewChild, computed, effect, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DiscussionsService, FollowedDiscussion } from '../core/services/discussions.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { PrivateMessagesService } from '../core/services/private-messages.service';
import { PrivateInboxComponent } from '../private-messages/private-inbox.component';
import { DiscussionMineComponent } from './discussion-mine.component';
import { MatchSummary } from '../core/models/match-summary';
import { DiscussionCardComponent, DiscussionListHeadingComponent } from './discussion-card.component';
import { ViewRecoveryActionsComponent } from '../shared/ui/view-recovery-actions/view-recovery-actions.component';
import { PageTitleService } from '../core/services/page-title.service';
import { NotificationStreamService } from '../core/services/notification-stream.service';
import { UserPresenceService } from '../core/services/user-presence.service';

@Component({ selector: 'app-discussion-inbox', standalone: true, imports: [CommonModule, TranslateModule, DiscussionMineComponent, DiscussionCardComponent, DiscussionListHeadingComponent, PrivateInboxComponent, ViewRecoveryActionsComponent],
    template: `<details *ngIf="api.signedIn" #picker class="discussion-inbox" (keydown.escape)="close(true)" (toggle)="toggled()">
      <summary (click)="refresh()" [attr.aria-label]="'privateMessages.notificationSummary' | translate:{public: regional.number(api.following().unreadCount,0,true), private: regional.number(privateMessages.unreadCount(),0,true)}"
        [title]="'privateMessages.notificationSummary' | translate:{public: regional.number(api.following().unreadCount,0,true), private: regional.number(privateMessages.unreadCount(),0,true)}"><span class="bi bi-chat-left-text" aria-hidden="true"></span>
        <span>{{ regional.number(api.following().unreadCount + privateMessages.unreadCount(), 0, true) }}</span><span *ngIf="api.followingError() || privateMessages.summaryError()" aria-hidden="true">!</span></summary>
      <div class="discussion-inbox-panel">
        <h3>{{ 'privateMessages.hubTitle' | translate }}</h3>
        <div class="discussion-tabs" role="tablist" [attr.aria-label]="'discussions.inboxTitle' | translate" (keydown)="tabKey($event)">
          <button type="button" id="discussion-following-tab" role="tab" aria-controls="discussion-following-panel" [attr.aria-selected]="tab() === 'following'"
            [attr.tabindex]="tab() === 'following' ? 0 : -1" (click)="chooseTab('following')">{{ 'discussions.followed' | translate }}</button>
          <button type="button" id="discussion-mine-tab" role="tab" aria-controls="discussion-mine-panel" [attr.aria-selected]="tab() === 'mine'"
            [attr.tabindex]="tab() === 'mine' ? 0 : -1" (click)="chooseTab('mine')">{{ 'discussions.mine' | translate }}</button>
          <button type="button" id="discussion-private-tab" role="tab" aria-controls="discussion-private-panel" [attr.aria-selected]="tab() === 'private'"
            [attr.tabindex]="tab() === 'private' ? 0 : -1" (click)="chooseTab('private')">{{ 'privateMessages.title' | translate }} <span *ngIf="privateMessages.unreadCount()">{{regional.number(privateMessages.unreadCount(),0,true)}}</span></button>
        </div>
        <div *ngIf="tab() === 'following'" id="discussion-following-panel" role="tabpanel" aria-labelledby="discussion-following-tab">
        <app-discussion-list-heading noteKey="discussions.noEmail" [loading]="api.followingLoading()" (refresh)="api.refreshFollowing(true)"></app-discussion-list-heading>
        <p *ngIf="api.followingLoading()" role="status">{{ 'common.loading' | translate }}</p>
        <div *ngIf="api.followingError()" role="alert">{{ 'discussions.followingFailed' | translate }}
          <button type="button" [disabled]="api.followingLoading()" (click)="api.retryFollowing()">{{ 'discussions.retry' | translate }}</button></div>
        <div *ngIf="!api.followingLoading() && !api.followingError() && !api.following().threads.length"><p>{{ 'discussions.noFollowing' | translate }}</p>
          <app-view-recovery-actions [showBrowse]="true" (browse)="close(true)"></app-view-recovery-actions></div>
        <app-discussion-card [targets]="api.following().threads" [summaries]="cardMatches()" (openThread)="open($event)"></app-discussion-card>
        <button type="button" class="following-more" *ngIf="api.following().hasMore" [disabled]="api.followingLoading()"
          (click)="api.loadMoreFollowing()">{{ 'discussions.moreThreads' | translate }}</button>
        </div>
        <div *ngIf="tab() === 'mine'" id="discussion-mine-panel" role="tabpanel" aria-labelledby="discussion-mine-tab">
          <app-discussion-mine [summaries]="cardMatches()" (rowsChanged)="mineTargets.set($event)" (openThread)="open($event)" (browseMatches)="close(true)"></app-discussion-mine>
        </div>
        <div *ngIf="tab() === 'private'" id="discussion-private-panel" role="tabpanel" aria-labelledby="discussion-private-tab">
          @defer (when tab() === 'private') { <app-private-inbox (conversationOpened)="close(true)"></app-private-inbox> }
        </div>
      </div>
    </details>`,
    styles: [`:host{position:relative;display:block;}
      summary{display:flex;align-items:center;gap:5px;cursor:pointer;padding:7px;min-height:36px;list-style:none;color:var(--bb-text);}
      summary::-webkit-details-marker{display:none;}
      .discussion-inbox-panel{box-sizing:border-box;position:absolute;right:0;top:100%;z-index:1200;width:min(620px,calc(100vw - 24px));min-width:0;max-height:70vh;overflow-y:auto;white-space:normal;overflow-wrap:anywhere;background:var(--bb-surface,#17212b);color:var(--bb-text,#fff);border:1px solid var(--bb-border,#526071);border-radius:8px;padding:14px;box-shadow:0 8px 30px #0006;}
      h3{font-size:1rem;} ul{list-style:none;padding:0;margin:0;}
      .discussion-tabs{display:flex;gap:6px;margin:10px 0;min-width:0;} .discussion-tabs button{flex:1 1 0;min-width:0;white-space:normal;overflow-wrap:anywhere;cursor:pointer;}
      .discussion-tabs button[aria-selected=true]{background:var(--bb-surface-2,#2c414e);border-color:var(--bb-accent,#80d5ff);}
      button{background:transparent;color:inherit;border:1px solid var(--bb-border,#526071);border-radius:6px;padding:9px;}
      li{min-width:0;max-width:100%;}
      time,.discussion-inbox-note{font-size:.8rem;color:var(--bb-text-muted,#aab5c0);}
      .following-more{width:100%;margin-top:10px;}
      summary:focus-visible,button:focus-visible{outline:2px solid var(--bb-accent,#80d5ff);outline-offset:2px;}
      @media(max-width:600px){.discussion-inbox-panel{position:fixed;left:12px;right:12px;top:auto;margin-top:4px;width:auto;}}`] })
export class DiscussionInboxComponent implements OnInit, OnDestroy {
    @ViewChild('picker') picker?: ElementRef<HTMLDetailsElement>;
    private accountSubscription?: Subscription;
    private notificationSubscription?: Subscription;
    private notificationTimer?: number;
    private lastNotificationRefresh = -Infinity;
    readonly tab = signal<'following' | 'mine' | 'private'>('following');
    readonly mineTargets = signal<readonly { matchTPId: number }[]>([]);
    readonly cardMatches = signal<ReadonlyMap<number, MatchSummary>>(new Map());
    private readonly panelOpen = signal(false);
    private readonly cardTargets = computed(() => this.tab() === 'mine' ? this.mineTargets() : this.api.following().threads);
    readonly trackThread = (_: number, thread: FollowedDiscussion) => thread.matchTPId;
    constructor(readonly api: DiscussionsService, readonly regional: RegionalSettingsService, readonly privateMessages: PrivateMessagesService,
        @Optional() @Inject(PageTitleService) private pageTitles: PageTitleService | null = null,
        @Optional() @Inject(NotificationStreamService) private notifications: NotificationStreamService | null = null,
        @Optional() @Inject(UserPresenceService) private presence: UserPresenceService | null = null) {
        effect(() => this.pageTitles?.setUnreadCount(this.api.signedIn
            ? this.api.following().unreadCount + this.privateMessages.unreadCount() : 0, this));
        effect(onCleanup => {
            const targets = this.cardTargets();
            if (!this.panelOpen() || !targets.length) { this.cardMatches.set(new Map()); return; }
            this.cardMatches.set(new Map());
            const request = this.api.cardSummaries(targets.map(row => row.matchTPId)).subscribe({
                next: rows => this.cardMatches.set(rows), error: () => this.cardMatches.set(new Map()),
            });
            onCleanup(() => request.unsubscribe());
        });
    }
    ngOnInit(): void {
        this.accountSubscription = this.api.accountChanged.subscribe(() => this.close());
        this.api.startPolling();
        this.notificationSubscription = this.api.notificationsChanged?.subscribe(() => {
            if (!this.panelOpen() || this.tab() !== 'following' || !this.api.visible || this.notificationTimer !== undefined) return;
            this.notificationTimer = window.setTimeout(() => {
                this.notificationTimer = undefined;
                if (this.panelOpen() && this.tab() === 'following' && this.api.visible) {
                    this.lastNotificationRefresh = performance.now(); this.api.refreshFollowing(true);
                }
            }, Math.max(0, 10000 - (performance.now() - this.lastNotificationRefresh)));
        });
        this.notifications?.start();
        this.presence?.start();
    }
    ngOnDestroy(): void { this.presence?.stop(); this.notifications?.stop(); this.notificationSubscription?.unsubscribe(); window.clearTimeout(this.notificationTimer); this.pageTitles?.clearUnreadCount(this); this.accountSubscription?.unsubscribe(); this.api.stopPolling(); }
    refresh(): void {
        this.panelOpen.set(!this.picker?.nativeElement.open);
        if (!this.picker?.nativeElement.open) this.api.refreshFollowing();
    }
    chooseTab(tab: 'following' | 'mine' | 'private'): void { this.panelOpen.set(this.picker?.nativeElement.open === true); this.tab.set(tab); }
    toggled(): void {
        const open = this.picker?.nativeElement.open === true; this.panelOpen.set(open);
        if (!open) { this.tab.set('following'); this.mineTargets.set([]); }
    }
    tabKey(event: KeyboardEvent): void {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = ['following','mine','private'] as const, index = tabs.indexOf(this.tab());
        const tab = event.key === 'Home' ? 'following' : event.key === 'End' ? 'private' : tabs[(index + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
        this.chooseTab(tab); this.picker?.nativeElement.querySelector<HTMLButtonElement>('#discussion-' + tab + '-tab')?.focus();
    }
    close(focus = false): void {
        window.clearTimeout(this.notificationTimer); this.notificationTimer = undefined;
        this.panelOpen.set(false); this.mineTargets.set([]); this.cardMatches.set(new Map());
        if (!this.picker) return;
        this.picker.nativeElement.open = false;
        this.tab.set('following');
        if (focus) this.picker.nativeElement.querySelector('summary')?.focus();
    }
    open(thread: { matchTPId: number; title?: string | null }): void {
        const match = this.cardMatches().get(thread.matchTPId);
        this.close(true); this.api.open({ matchTPId: thread.matchTPId, ...(thread.title ? { title: thread.title } : {}), ...(match ? { match } : {}) });
    }
    @HostListener('document:click', ['$event']) outside(event: MouseEvent): void {
        if (!this.picker?.nativeElement.contains(event.target as Node)) this.close();
    }
}
