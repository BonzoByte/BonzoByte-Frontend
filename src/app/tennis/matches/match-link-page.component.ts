import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { combineLatest, Observable, of, Subject, Subscription, throwError } from 'rxjs';
import { catchError, distinctUntilChanged, map, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { parseMatchLinkId, tennisTodayTarget } from '../../core/helpers/match-link';
import { CommentLinkTarget, parseCommentLinkTarget } from '../../core/helpers/comment-link';
import { MatchSummary } from '../../core/models/match-summary';
import { Match } from '../../core/models/tennis.model';
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { DiscussionsService } from '../../core/services/discussions.service';
import { MatchLinksService } from '../../core/services/match-links.service';
import { PageTitleService } from '../../core/services/page-title.service';
import { MatchLinkOverviewComponent } from './match-link-overview.component';
import { MatchDetailsModalComponent } from './match-details-modal/match-details-modal.component';

/** A deep link selects a match, never an entitlement or a private user action. */
@Component({
    selector: 'app-match-link-page', standalone: true,
    imports: [CommonModule, RouterLink, TranslateModule, MatchLinkOverviewComponent, MatchDetailsModalComponent],
    template: `<section class="match-link-page">
      <nav class="match-link-navigation"><a class="bb-btn match-link-back" routerLink="/matches"><span class="bi bi-arrow-left" aria-hidden="true"></span>{{ 'matchLink.browse' | translate }}</a></nav>
      <p *ngIf="loading" role="status">{{ 'matchLink.loading' | translate }}</p>
      <div *ngIf="failed" class="match-link-error" role="alert">
        <p>{{ errorKey | translate }}</p>
        <button *ngIf="failureKind === 'temporary'" type="button" class="bb-btn" [disabled]="loading" (click)="retry()">{{ 'discussions.retry' | translate }}</button>
      </div>
      <ng-container *ngIf="match as row">
        <app-match-link-overview [match]="row"></app-match-link-overview>
        <div class="match-link-actions">
          <button type="button" class="bb-btn bb-btn-primary" [disabled]="loadingDetails" (click)="openDetails()">{{ (loadingDetails ? 'matchLink.loading' : 'matchLink.openDetails') | translate }}</button>
          <button type="button" class="bb-btn" (click)="openDiscussion()">{{ 'discussions.title' | translate }}</button>
        </div>
        <app-match-details-modal [isOpen]="detailsOpen" [matchTPId]="row.matchTPId" [match]="dailyRow ?? row" [dailyPreview]="!!dailyRow"
          (closed)="detailsOpen = false" (detailMissing)="openDatedGrid()" (requestLogin)="requestAccountAction('openLogin')"
          (requestRegister)="requestAccountAction('switchToRegister')" (requestUpgrade)="requestAccountAction('openBilling')">
        </app-match-details-modal>
      </ng-container>
    </section>`,
    styles: [`:host { display: block; } .match-link-page { width: min(800px, calc(100% - 32px)); margin: 24px auto; background: none; }
      .match-link-navigation { margin-bottom: 16px; } .match-link-back, .match-link-back:visited { display: inline-flex; align-items: center; gap: 7px; color: var(--bb-text); text-decoration: none; font-size: 12px; }
      .match-link-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; } .match-link-actions button { font: inherit; font-size: 12px; }
      .match-link-back:focus-visible { outline: 2px solid var(--bb-theme-accent); outline-offset: 3px; }
      .match-link-error { color: var(--bb-danger, #ff9393); }`],
})
export class MatchLinkPageComponent implements OnInit, OnDestroy {
    matchId: number | null = null;
    match: MatchSummary | null = null;
    loading = false;
    failed = false;
    failureKind: 'invalid' | 'missing' | 'temporary' | null = null;
    get errorKey(): string { return this.failureKind === 'invalid' ? 'matchLink.invalid' : this.failureKind === 'missing' ? 'matchLink.notFound' : 'matchLink.unavailable'; }
    detailsOpen = false;
    dailyRow: Match | null = null;
    loadingDetails = false;
    private detailsRequest?: Subscription;
    private discussionView = false;
    private commentTarget: CommentLinkTarget | null = null;
    private destroyed$ = new Subject<void>();
    private retry$ = new Subject<void>();
    private request?: Subscription;
    private titlePath = '';
    private desk: ReturnType<typeof tennisTodayTarget> = null;
    openDatedGrid(): void {
        if (this.desk) void this.router.navigate(['/matches'], {queryParams:{day:this.desk.day,fixture:this.desk.id},replaceUrl:true});
    }
    constructor(private route: ActivatedRoute, private api: DiscussionsService, @Inject(DOCUMENT) private document: Document,
        private links: MatchLinksService, private pageTitles: PageTitleService, private router: Router,
        private archives: StaticArchivesService) {}
    ngOnInit(): void {
        this.request = combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
            map(([params, query]) => ({ canonical: params.has('canonicalMatchId'),
                id: parseMatchLinkId(params.get('canonicalMatchId') ?? params.get('matchTPId')), discussion: query.get('view') === 'discussion',
                desk: query.get('view') === 'details' ? tennisTodayTarget(query) : null,
                comment: query.getAll('comment').length === 1 && query.getAll('sequence').length === 1
                    ? parseCommentLinkTarget(query.get('comment'), query.get('sequence')) : null })),
            distinctUntilChanged((a, b) => a.id === b.id && a.canonical === b.canonical && a.discussion === b.discussion
                && a.comment?.id === b.comment?.id && a.comment?.sequence === b.comment?.sequence
                && a.desk?.id === b.desk?.id && a.desk?.day === b.desk?.day),
            switchMap(target => {
                this.cancelDetailsRequest();
                this.dailyRow = null;
                this.closeOwnedDiscussion();
                this.desk = target.canonical || target.id === target.desk?.id ? target.desk : null;
                this.matchId = target.id; this.discussionView = target.discussion; this.commentTarget = target.comment;
                this.titlePath = `/matches/${target.canonical ? 'id/' : ''}${target.id ?? ''}`;
                this.match = null; this.detailsOpen = false;
                return this.retry$.pipe(
                    // A fresh target starts immediately; retries replace, not duplicate, its request.
                    startWith(undefined),
                    switchMap(() => {
                        this.loading = target.id !== null; this.failed = target.id === null;
                        this.failureKind = target.id === null ? 'invalid' : null;
                        this.match = null; this.detailsOpen = false;
                        this.pageTitles.setMatch(null, this, this.titlePath);
                        const request: Observable<MatchSummary | null> = target.id === null ? of(null) : target.canonical ? this.links.byCanonicalId(target.id) :
                            this.links.byLegacyTPId(target.id).pipe(catchError(error => !this.desk && error?.status === 404 ? this.api.summary(target.id!) : throwError(() => error)));
                        return request.pipe(catchError(error => {
                            const code = error?.error?.code ?? error?.code;
                            this.failureKind = error?.status === 404 || code === 'MATCH_LINK_NOT_FOUND' ? 'missing' :
                                error?.status === 400 || code === 'MATCH_LINK_INVALID_ID' ? 'invalid' : 'temporary';
                            return of(null);
                        }));
                    }),
                );
            }), takeUntil(this.destroyed$),
        ).subscribe(row => {
            this.loading = false; this.failed = !row; this.match = row;
            this.pageTitles.setMatch(row, this, this.titlePath);
            if (row && this.discussionView) this.openDiscussion();
            if (this.desk && row?.matchTPId === this.desk.id) this.openDetails();
            if (!row && this.desk && this.failureKind === 'missing') this.openDatedGrid();
        });
    }
    retry(): void { if (!this.loading && this.failureKind === 'temporary') this.retry$.next(); }
    openDetails(): void {
        this.closeOwnedDiscussion();
        const summary = this.match;
        if (!summary || this.loadingDetails) return;
        this.loadingDetails = true;
        this.detailsRequest = this.archives.getLinkedDailyRow(summary).pipe(catchError(() => of(null))).subscribe(row => {
            this.loadingDetails = false;
            this.dailyRow = row;
            this.detailsOpen = true;
        });
    }
    private cancelDetailsRequest(): void {
        this.detailsRequest?.unsubscribe();
        this.loadingDetails = false;
    }
    openDiscussion(): void {
        this.cancelDetailsRequest();
        if (!this.match) return;
        this.detailsOpen = false;
        this.api.open({ matchTPId: this.match.matchTPId,
            ...(this.commentTarget ? { comment: this.commentTarget, match: this.match } : {}) });
    }
    requestAccountAction(name: 'openLogin' | 'switchToRegister' | 'openBilling'): void {
        this.detailsOpen = false;
        queueMicrotask(() => this.document.defaultView?.dispatchEvent(new CustomEvent(name)));
    }
    private closeOwnedDiscussion(): void {
        if (this.match && this.api.selected()?.matchTPId === this.match.matchTPId) this.api.selected.set(null);
    }
    ngOnDestroy(): void {
        this.cancelDetailsRequest();
        this.pageTitles.clearMatch(this);
        this.closeOwnedDiscussion(); this.destroyed$.next(); this.destroyed$.complete(); this.retry$.complete(); this.request?.unsubscribe();
    }
}

