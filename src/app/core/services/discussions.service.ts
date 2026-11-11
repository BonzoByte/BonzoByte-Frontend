import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, Injector, OnDestroy, signal } from '@angular/core';
import { EMPTY, Observable, Subject, Subscription, catchError, defer, expand, from, map, mergeMap, of, reduce, scan, takeUntil, tap, throwError, timeout, toArray } from 'rxjs';
import { environment } from '@env/environment';
import { Match } from '../models/tennis.model';
import { MatchSummary } from '../models/match-summary';
import { User } from '../models/user.model';
import { CommentLinkTarget, parseCommentLinkTarget } from '../helpers/comment-link';
import { AuthService } from './auth.service';

export interface DiscussionReply { id: string; authorName: string | null; body?: string | null; }
export interface DiscussionComment {
    id: string; sequence: number;
    author: { id: string; nickname: string; avatarUrl: string | null } | null;
    body: string; createdAt: string; replyTo: DiscussionReply | null;
    deleted: boolean; hidden: boolean; canDelete: boolean; canHide: boolean;
}
export interface DiscussionPage {
    matchTPId: number; comments: DiscussionComment[]; hasMore: boolean; nextAfter: number | null;
    total: number; following: boolean; readThrough: number; latestSequence: number;
}
export interface DiscussionPostResult {
    comment: DiscussionComment; matchTPId: number; following: boolean;
    readThrough: number; latestSequence: number; total: number; replayed: boolean;
}
export interface FollowedDiscussion {
    matchTPId: number; unread: boolean; lastActivityAt: string | null; title?: string;
}
export interface FollowingDiscussions {
    unreadCount: number; threads: FollowedDiscussion[]; hasMore?: boolean; nextAfter?: string | null;
}
export interface MyDiscussion {
    matchTPId: number; title: string | null; lastCommentAt: string; commentCount: number; unread?: boolean;
}
export interface MyDiscussionsPage { threads: MyDiscussion[]; hasMore: boolean; nextAfter: string | null; }
export interface DiscussionTarget { matchTPId: number; title?: string; match?: MatchSummary; comment?: CommentLinkTarget; }
const validId = (id: number) => Number.isSafeInteger(id) && id > 0;
// A first post may validate archived identity and perform two separately bounded
// transactions. Keep the client deadline outside that server-side budget.
export const DISCUSSION_REQUEST_TIMEOUT_MS = 75000;
export const DISCUSSION_PAGE_SIZE = 20;

/** Account-scoped in-memory data only. No email, analytics or browser persistence. */
@Injectable({ providedIn: 'root' })
export class DiscussionsService implements OnDestroy {
    private readonly base = `${environment.apiUrl}/discussions`;
    readonly user = signal<User | null>(null);
    readonly following = signal<FollowingDiscussions>({ unreadCount: 0, threads: [] });
    readonly followingLoading = signal(false);
    readonly followingError = signal(false);
    readonly selected = signal<DiscussionTarget | null>(null);
    readonly counts = signal<ReadonlyMap<number, number>>(new Map());
    readonly countErrors = signal<ReadonlySet<number>>(new Set());
    readonly accountChanged = new Subject<void>();
    readonly notificationsChanged = new Subject<void>();
    private notificationSummaryRequest?: Subscription;
    private notificationReadSerial = 0;
    readonly pulse = new Subject<void>();
    private actor = '';
    private authSub: Subscription;
    private followingRequest?: Subscription;
    private followingRetry = () => this.refreshFollowing(true);
    private countRequest?: Subscription;
    private timer?: ReturnType<typeof setInterval>;
    private countScheduled = false;
    private destroyed = false;
    private readonly wantedCounts = new Map<number, number>();
    private readonly countVersions = new Map<number, number>();
    private readonly pendingCounts = new Set<number>();
    private readonly titles = new Map<number, string>();
    private readonly summaries = new Map<number, MatchSummary>();
    private readonly visibility = () => {
        if (this.document.visibilityState === 'hidden') {
            this.followingRequest?.unsubscribe(); this.followingLoading.set(false);
        }
    };

    constructor(private injector: Injector, private auth: AuthService, @Inject(DOCUMENT) readonly document: Document) {
        this.authSub = auth.user$.subscribe(user => {
            this.user.set(user);
            const actor = user?._id || '';
            if (actor === this.actor) return;
            this.actor = actor;
            this.followingRequest?.unsubscribe(); this.countRequest?.unsubscribe();
            this.notificationSummaryRequest?.unsubscribe();
            this.notificationReadSerial++;
            this.pendingCounts.clear();
            this.following.set({ unreadCount: 0, threads: [] });
            this.followingLoading.set(false); this.followingError.set(false);
            this.selected.set(null); this.counts.set(new Map()); this.countErrors.set(new Set()); this.countVersions.clear();
            this.titles.clear(); this.summaries.clear();
            this.accountChanged.next();
            for (const id of this.wantedCounts.keys()) this.queueCount(id);
            if (this.timer) this.refreshFollowing();
        });
        this.document.addEventListener('visibilitychange', this.visibility);
    }
    get signedIn(): boolean { return !!this.user()?._id; }
    get canCompose(): boolean { return this.signedIn && this.user()?.isVerified === true; }
    get visible(): boolean { return this.document.visibilityState !== 'hidden'; }

    private request<T>(method: string, path: string, body?: unknown): Observable<T> {
        return defer(() => this.injector.get(HttpClient).request<T>(method, `${this.base}${path}`, { body }))
            .pipe(timeout(DISCUSSION_REQUEST_TIMEOUT_MS), takeUntil(this.accountChanged));
    }
    page(id: number, after = 0): Observable<DiscussionPage> {
        return this.request<DiscussionPage>('GET', `/matches/${id}?after=${after}&limit=${DISCUSSION_PAGE_SIZE}`).pipe(map(page => {
            if (page.matchTPId !== id || !Array.isArray(page.comments) || page.comments.length > DISCUSSION_PAGE_SIZE
                || page.comments.some((c, i, rows) => !c.id || !validId(c.sequence) || c.sequence <= after
                    || (i > 0 && c.sequence <= rows[i - 1].sequence))
                || (page.hasMore && (!page.comments.length || page.nextAfter !== page.comments.at(-1)?.sequence))) {
                throw new Error('DISCUSSIONS_INVALID_PAGE');
            }
            this.setCount(id, page.total);
            return page;
        }));
    }
    summary(id: number): Observable<MatchSummary> {
        return this.request<{ match: MatchSummary }>('GET', `/matches/${id}/summary`).pipe(map(result => {
            if (result?.match?.matchTPId !== id || !result.match.player1Name || !result.match.player2Name)
                throw new Error('DISCUSSIONS_INVALID_SUMMARY');
            return result.match;
        }));
    }
    cardSummaries(ids: readonly number[]): Observable<ReadonlyMap<number, MatchSummary>> {
        if (ids.length > 1000 || !ids.every(validId) || new Set(ids).size !== ids.length)
            return throwError(() => new Error('DISCUSSIONS_INVALID_IDS'));
        if (!ids.length || environment.billingLab) return of(new Map<number, MatchSummary>());
        const batches: number[][] = [];
        for (let i = 0; i < ids.length; i += 20) batches.push(ids.slice(i, i + 20));
        return from(batches).pipe(mergeMap(batch => this.request<{ matches: MatchSummary[] }>('POST', '/matches/summaries', { ids: batch }).pipe(
            timeout(10000), map(result => {
                if (!Array.isArray(result?.matches) || result.matches.length > batch.length
                    || new Set(result.matches.map(row => row.matchTPId)).size !== result.matches.length
                    || result.matches.some(row => !batch.includes(row.matchTPId) || typeof row.player1Name !== 'string' || !row.player1Name.trim()
                        || typeof row.player2Name !== 'string' || !row.player2Name.trim())) throw new Error('DISCUSSIONS_INVALID_SUMMARY');
                return result.matches;
            }), catchError(() => of([] as MatchSummary[]))), 2),
            scan((all, rows) => new Map([...all, ...rows.map(row => [row.matchTPId, row] as const)]), new Map<number, MatchSummary>()),
            takeUntil(this.accountChanged));
    }
    minePage(after?: string): Observable<MyDiscussionsPage> {
        if (!this.signedIn || environment.billingLab) return throwError(() => new Error('DISCUSSIONS_AUTH_REQUIRED'));
        return this.request<MyDiscussionsPage>('GET', '/mine?limit=20' + (after ? `&after=${encodeURIComponent(after)}` : '')).pipe(map(result => {
            const rows = result?.threads;
            if (!Array.isArray(rows) || rows.length > 20 || typeof result.hasMore !== 'boolean'
                || new Set(rows.map(row => row.matchTPId)).size !== rows.length
                || rows.some((row, i) => !validId(row.matchTPId) || !Number.isSafeInteger(row.commentCount) || row.commentCount < 1
                    || (row.unread !== undefined && typeof row.unread !== 'boolean')
                    || typeof row.lastCommentAt !== 'string' || !Number.isFinite(Date.parse(row.lastCommentAt))
                    || (row.title !== null && (typeof row.title !== 'string' || row.title.length > 240))
                    || (i > 0 && (Date.parse(row.lastCommentAt) > Date.parse(rows[i - 1].lastCommentAt)
                        || (Date.parse(row.lastCommentAt) === Date.parse(rows[i - 1].lastCommentAt) && row.matchTPId <= rows[i - 1].matchTPId))))
                || (result.hasMore ? (!rows.length || typeof result.nextAfter !== 'string'
                    || !/^[A-Za-z0-9_-]{1,128}$/.test(result.nextAfter) || result.nextAfter === after) : result.nextAfter !== null))
                throw new Error('DISCUSSIONS_INVALID_MINE');
            return result;
        }));
    }
    post(id: number, body: string, clientRequestId: string, replyToId?: string) {
        return this.request<DiscussionPostResult>('POST', `/matches/${id}`, { body, clientRequestId, ...(replyToId ? { replyToId } : {}) })
            .pipe(tap(result => {
                if (result?.matchTPId === id && Number.isSafeInteger(result.total) && result.total >= 0) this.setCount(id, result.total);
                // Never advance read progress from a POST response: older pages may be unseen.
            }));
    }
    follow(id: number, following: boolean) { return this.request('PUT', `/matches/${id}/follow`, { following }); }
    read(id: number, through: number) { return this.request('PUT', `/matches/${id}/read`, { through }); }
    delete(id: string) { return this.request('DELETE', `/comments/${encodeURIComponent(id)}`); }
    report(id: string, reason?: string) { return this.request('POST', `/comments/${encodeURIComponent(id)}/report`, reason ? { reason } : {}); }
    hide(id: string, hidden: boolean) { return this.request('POST', `/comments/${encodeURIComponent(id)}/hide`, { hidden }); }

    startPolling(): void {
        if (this.timer || environment.billingLab) return;
        this.refreshFollowing();
        this.timer = setInterval(() => {
            if (!this.signedIn || !this.visible) return;
            this.refreshFollowing(); this.pulse.next();
        }, 60000);
    }
    stopPolling(): void {
        clearInterval(this.timer); this.timer = undefined;
        this.followingRequest?.unsubscribe(); this.followingLoading.set(false);
    }
    refreshFollowing(force = false): void {
        if (!this.signedIn || !this.visible || environment.billingLab || (this.followingLoading() && !force)) return;
        this.followingRequest?.unsubscribe();
        const keep = this.following().threads.length;
        let loaded = 0;
        const cursors = new Set<string>();
        // Refresh the loaded range from the start: unread-first order can change after reading.
        const request = this.followingPage().pipe(expand(page => {
            loaded += page.threads.length;
            if (!page.hasMore || loaded >= keep) return EMPTY;
            if (cursors.has(page.nextAfter!)) return throwError(() => new Error('DISCUSSIONS_INVALID_CURSOR'));
            cursors.add(page.nextAfter!);
            return this.followingPage(page.nextAfter!);
        }), reduce((all: FollowingDiscussions | null, page) => this.mergeFollowing(all, page), null));
        this.fetchFollowing(request as Observable<FollowingDiscussions>, false);
    }
    /** Count only: no comment delivery, read acknowledgment, or full paginated-list reload in background tabs. */
    refreshNotificationSummary(): void {
        if (!this.signedIn || environment.billingLab) return;
        this.notificationSummaryRequest?.unsubscribe();
        const serial = ++this.notificationReadSerial;
        this.notificationSummaryRequest = this.request<{ unreadCount: number }>('GET', '/notification-summary').subscribe({
            next: value => {
                if (serial !== this.notificationReadSerial) return;
                if (!Number.isSafeInteger(value?.unreadCount) || value.unreadCount < 0) { this.followingError.set(true); return; }
                this.following.update(current => ({ ...current, unreadCount: value.unreadCount }));
                this.followingError.set(false); this.notificationsChanged.next();
            }, error: () => { if (serial === this.notificationReadSerial) this.followingError.set(true); }
        });
    }
    loadMoreFollowing(): void {
        const current = this.following();
        if (!this.signedIn || !this.visible || this.followingLoading() || !current.hasMore || !current.nextAfter) return;
        this.fetchFollowing(this.followingPage(current.nextAfter), true);
    }
    retryFollowing(): void { this.followingRetry(); }
    private followingPage(after?: string): Observable<FollowingDiscussions> {
        return this.request<FollowingDiscussions>('GET', '/following' + (after ? `?after=${encodeURIComponent(after)}&limit=100` : '')).pipe(map(result => {
            if (!Array.isArray(result?.threads) || !Number.isSafeInteger(result.unreadCount) || result.unreadCount < 0
                || result.threads.some(t => !validId(t.matchTPId))
                || (result.hasMore && (!result.threads.length || typeof result.nextAfter !== 'string' || !result.nextAfter || result.nextAfter === after)))
                throw new Error('DISCUSSIONS_INVALID_FOLLOWING');
            return result;
        }));
    }
    private mergeFollowing(previous: FollowingDiscussions | null, next: FollowingDiscussions): FollowingDiscussions {
        const threads = new Map((previous?.threads || []).map(thread => [thread.matchTPId, thread]));
        for (const thread of next.threads) threads.set(thread.matchTPId, thread);
        return { ...next, threads: [...threads.values()] };
    }
    private fetchFollowing(request: Observable<FollowingDiscussions>, append: boolean): void {
        const serial = ++this.notificationReadSerial;
        this.followingLoading.set(true); this.followingError.set(false);
        this.followingRetry = append ? () => this.loadMoreFollowing() : () => this.refreshFollowing(true);
        this.followingRequest = request.subscribe({
            next: result => {
                this.followingLoading.set(false);
                const current = this.following(), fresh = serial === this.notificationReadSerial ? result : { ...result, unreadCount: current.unreadCount };
                this.following.set(append ? this.mergeFollowing(current, fresh) : fresh);
                this.followingError.set(false);
            },
            error: () => { this.followingLoading.set(false); this.followingError.set(true); },
        });
    }
    remember(match: Match): void {
        if (match.player1Name && match.player2Name) {
            this.titles.set(match.matchTPId, `${match.player1Name} — ${match.player2Name}`);
            // Bounded, in-memory display context, cleared on account changes.
            this.summaries.delete(match.matchTPId);
            this.summaries.set(match.matchTPId, match);
            if (this.summaries.size > 1000) this.summaries.delete(this.summaries.keys().next().value!);
        }
    }
    title(target: { matchTPId: number; title?: string | null }): string | undefined { return this.titles.get(target.matchTPId) || target.title || undefined; }
    open(target: DiscussionTarget, match?: Match): void {
        if (!validId(target.matchTPId)) return;
        if (match?.matchTPId === target.matchTPId) this.remember(match);
        const summary = target.match?.matchTPId === target.matchTPId ? target.match : this.summaries.get(target.matchTPId);
        const comment = parseCommentLinkTarget(target.comment?.id, target.comment?.sequence);
        this.selected.set({ matchTPId: target.matchTPId, title: this.title(target), ...(summary ? { match: summary } : {}), ...(comment ? { comment } : {}) });
    }
    watchCount(id: number): () => void {
        if (!validId(id)) return () => {};
        const first = !this.wantedCounts.has(id);
        this.wantedCounts.set(id, (this.wantedCounts.get(id) || 0) + 1);
        if (first || !this.counts().has(id)) this.queueCount(id);
        return () => {
            const left = (this.wantedCounts.get(id) || 1) - 1;
            if (left) this.wantedCounts.set(id, left);
            else {
                this.wantedCounts.delete(id); this.pendingCounts.delete(id);
                this.countErrors.update(errors => { const next = new Set(errors); next.delete(id); return next; });
            }
            if (!this.wantedCounts.size) this.countRequest?.unsubscribe();
        };
    }
    private queueCount(id: number): void {
        this.pendingCounts.add(id);
        if (this.countScheduled) return;
        this.countScheduled = true;
        queueMicrotask(() => {
            this.countScheduled = false;
            if (!this.destroyed) this.flushCounts();
        });
    }
    retryCounts(): void { for (const id of this.wantedCounts.keys()) this.queueCount(id); }
    setCount(id: number, count: number): void {
        this.countVersions.set(id, (this.countVersions.get(id) || 0) + 1);
        this.counts.update(counts => new Map(counts).set(id, count));
        this.countErrors.update(errors => { const next = new Set(errors); next.delete(id); return next; });
    }
    private flushCounts(): void {
        if (this.countRequest && !this.countRequest.closed) return;
        const ids = [...this.pendingCounts]; this.pendingCounts.clear();
        const versions = new Map(ids.map(id => [id, this.countVersions.get(id) || 0]));
        if (!ids.length || environment.billingLab) return;
        const batches: number[][] = [];
        for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
        this.countRequest = from(batches).pipe(mergeMap(batch =>
            this.request<{ counts: { matchTPId: number; count: number }[] }>('POST', '/matches/counts', { ids: batch })
                .pipe(map(result => {
                    if (!Array.isArray(result?.counts) || batch.some(id => !result.counts.some(c => c.matchTPId === id
                        && Number.isSafeInteger(c.count) && c.count >= 0))) throw new Error('DISCUSSIONS_INVALID_COUNTS');
                    return result.counts;
                })), 2), toArray(), takeUntil(this.accountChanged)).subscribe({
            next: groups => {
                for (const c of groups.flat()) if (this.wantedCounts.has(c.matchTPId)
                    && (this.countVersions.get(c.matchTPId) || 0) === versions.get(c.matchTPId)) this.setCount(c.matchTPId, c.count);
            },
            error: () => {
                this.countErrors.update(errors => new Set([...errors, ...ids.filter(id => this.wantedCounts.has(id)
                    && (this.countVersions.get(id) || 0) === versions.get(id))]));
                if (this.pendingCounts.size) this.queueCount([...this.pendingCounts][0]);
            },
            complete: () => { if (this.pendingCounts.size) this.queueCount([...this.pendingCounts][0]); },
        });
    }
    ngOnDestroy(): void {
        this.notificationSummaryRequest?.unsubscribe(); this.notificationsChanged.complete();
        this.destroyed = true; this.stopPolling();
        this.authSub.unsubscribe(); this.followingRequest?.unsubscribe(); this.countRequest?.unsubscribe();
        this.accountChanged.next(); this.accountChanged.complete(); this.pulse.complete();
        this.document.removeEventListener('visibilitychange', this.visibility);
    }
}
