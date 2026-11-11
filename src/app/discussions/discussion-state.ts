import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Observable, Subject, Subscription, expand, EMPTY, reduce, map, of, switchMap } from 'rxjs';
import { DISCUSSION_PAGE_SIZE, DiscussionComment, DiscussionPage, DiscussionsService } from '../core/services/discussions.service';
import { discussionLengthValid } from '../core/helpers/discussion-text';

/** One instance per visible thread; closing or switching accounts cancels every request. */
@Injectable()
export class DiscussionState implements OnDestroy {
    readonly comments = signal<DiscussionComment[]>([]);
    readonly loading = signal(false);
    readonly loaded = signal(false);
    readonly busy = signal(false);
    readonly backgroundLoading = signal(false);
    readonly showLoading = computed(() => this.busy() || (this.loading() && !this.backgroundLoading()));
    readonly error = signal('');
    readonly actionError = signal(false);
    readonly readError = signal(false);
    readonly readNeedsReload = signal(false);
    readonly reported = signal<ReadonlySet<string>>(new Set());
    readonly following = signal(false);
    readonly hasMore = signal(false);
    readonly total = signal(0);
    readonly reset = signal(0);
    readonly posted = signal(0);
    /** Keep the visit boundary stable even as visible comments are acknowledged. */
    readonly newAfter = signal<number | null>(null);
    readonly rangeAfter = signal(0);
    private readonly latestSequence = signal(0);
    private boundaryInitialized = false;
    readonly firstNewId = computed(() => this.comments().find(comment => this.isNewComment(comment))?.id ?? null);
    readonly canJumpNew = computed(() => this.api.canCompose && this.newAfter() !== null && (!!this.firstNewId()
        || (this.rangeAfter() === 0 && this.hasMore() && (this.comments().at(-1)?.sequence ?? 0) <= this.newAfter()!
            && this.latestSequence() > this.newAfter()!)));
    readonly postConfirmed = new Subject<{ matchTPId: number; body: string; replyToId?: string; clientRequestId: string }>();
    private id = 0;
    private openingAfter = 0;
    private cursor = 0;
    private readThrough = 0;
    private seen = new Set<string>();
    private loadRequest?: Subscription;
    private mutation?: Subscription;
    private readRequest?: Subscription;
    private readTimer?: ReturnType<typeof setTimeout>;
    private liveTimer?: ReturnType<typeof setTimeout>;
    private livePending = false;
    private lastLiveRefresh = -Infinity;
    private subscriptions = new Subscription();
    private retryAction?: () => void;
    private retryIsPost = false;
    private retryLoad: () => void = () => this.load();
    private pendingPost?: { body: string; replyToId?: string; requestId: string };
    private readonly visibility = () => {
        if (!this.api.visible) {
            if (this.loading() && this.api.canCompose) this.livePending = true;
            this.loadRequest?.unsubscribe(); this.loading.set(false); this.backgroundLoading.set(false);
            this.readRequest?.unsubscribe(); clearTimeout(this.readTimer);
            clearTimeout(this.liveTimer); this.liveTimer = undefined;
        } else this.scheduleLiveRefresh();
    };
    constructor(readonly api: DiscussionsService) {
        this.subscriptions.add(api.accountChanged.subscribe(() => { this.clear(); this.rangeAfter.set(this.openingAfter); if (this.id) this.load(); }));
        this.subscriptions.add(api.pulse.subscribe(() => { if (!this.busy() && !this.loading() && !this.error()) this.refresh(true); }));
        this.subscriptions.add(api.notificationsChanged?.subscribe(() => {
            if (!this.id || !this.api.canCompose) return;
            this.livePending = true; this.scheduleLiveRefresh();
        }));
        api.document.addEventListener('visibilitychange', this.visibility);
    }
    open(id: number, after = 0): void {
        this.clear(); this.id = id;
        this.openingAfter = Number.isSafeInteger(after) && after >= 0 ? after : 0;
        this.rangeAfter.set(this.openingAfter); this.load();
    }
    private clear(): void {
        this.loadRequest?.unsubscribe(); this.mutation?.unsubscribe(); this.readRequest?.unsubscribe();
        clearTimeout(this.readTimer);
        clearTimeout(this.liveTimer); this.liveTimer = undefined; this.livePending = false; this.lastLiveRefresh = -Infinity;
        this.comments.set([]); this.loading.set(false); this.loaded.set(false); this.backgroundLoading.set(false); this.busy.set(false); this.error.set('');
        this.actionError.set(false); this.readError.set(false); this.readNeedsReload.set(false); this.reported.set(new Set());
        this.following.set(false); this.hasMore.set(false); this.total.set(0);
        this.newAfter.set(null); this.rangeAfter.set(0); this.latestSequence.set(0); this.boundaryInitialized = false;
        this.cursor = this.readThrough = 0; this.seen.clear(); this.pendingPost = undefined; this.retryAction = undefined; this.retryIsPost = false;
        this.reset.update(n => n + 1);
    }
    retry(): void { this.retryLoad(); }
    load(more = false): void {
        if (!this.id || this.loading() || this.busy()) return;
        const start = this.rangeAfter(), after = more ? this.cursor : start;
        this.fetch(this.api.page(this.id, after), more, () => this.load(more), start);
    }
    isNewComment(comment: DiscussionComment): boolean {
        const after = this.newAfter();
        return this.api.canCompose && after !== null && comment.sequence > after && !comment.deleted && !comment.hidden
            && comment.author?.id !== this.api.user()?._id;
    }
    /** A single normal 20-comment page after the previously read prefix, never an unbounded scan. */
    loadNew(): void {
        const after = this.newAfter();
        if (!this.id || after === null || !this.canJumpNew() || this.firstNewId() || this.loading() || this.busy() || !this.api.visible) return;
        this.fetch(this.api.page(this.id, after), false, () => this.loadNew(), after);
    }
    loadEarlier(): void {
        if (!this.id || !this.rangeAfter() || this.loading() || this.busy() || !this.api.visible) return;
        this.fetch(this.api.page(this.id), false, () => this.loadEarlier(), 0);
    }
    /** Revalidate only the pages already loaded, preserving deletions/moderation and cursor order. */
    refresh(background = false): void {
        if (!this.id || this.loading() || this.busy() || !this.api.visible) return;
        const through = this.cursor, start = this.rangeAfter();
        const pages = this.api.page(this.id, start).pipe(
            expand(page => page.hasMore && (page.nextAfter || 0) < through ? this.api.page(this.id, page.nextAfter!) : EMPTY),
            reduce((all: DiscussionPage | null, page) => ({ ...page, comments: [...(all?.comments || []), ...page.comments] }), null));
        this.fetch(pages as Observable<DiscussionPage>, false, () => this.refresh(), start, background);
    }
    private scheduleLiveRefresh(): void {
        if (!this.livePending || !this.id || !this.api.visible || this.loading() || this.busy() || this.liveTimer !== undefined) return;
        this.liveTimer = setTimeout(() => {
            this.liveTimer = undefined;
            if (!this.livePending || !this.api.visible || this.loading() || this.busy()) return;
            this.livePending = false; this.lastLiveRefresh = performance.now(); this.refreshLive();
        }, Math.max(80, 2000 - (performance.now() - this.lastLiveRefresh)));
    }
    /** Revalidate the displayed tail, not every loaded page. At most one extra page
     * is appended when the reader had reached the end. Older paginated history stays put. */
    private refreshLive(background = true): void {
        if (!this.id || !this.api.visible || this.loading() || this.busy()) return;
        const rows = this.comments(), tail = rows.length % DISCUSSION_PAGE_SIZE || Math.min(rows.length, DISCUSSION_PAGE_SIZE);
        const prefix = rows.slice(0, rows.length - tail), start = this.rangeAfter();
        const after = prefix.at(-1)?.sequence ?? start, through = this.cursor, atEnd = !this.hasMore();
        const pages = this.api.page(this.id, after).pipe(switchMap(page =>
            atEnd && page.hasMore && page.nextAfter! > after && page.nextAfter! <= through
                ? this.api.page(this.id, page.nextAfter!).pipe(map(next => ({ ...next, comments: [...page.comments, ...next.comments] })))
                : of(page)), map(page => ({ ...page, comments: [...prefix, ...page.comments] })));
        this.fetch(pages, false, () => this.refreshLive(false), start, background);
    }
    private fetch(request: Observable<DiscussionPage>, append: boolean, retry: () => void, start: number, background = false): void {
        this.loadRequest?.unsubscribe(); this.retryLoad = retry; this.backgroundLoading.set(background); this.loading.set(true); this.error.set('');
        this.loadRequest = request.subscribe({
            next: page => {
                this.loaded.set(true);
                if (!this.boundaryInitialized) {
                    this.boundaryInitialized = true;
                    if (this.api.canCompose && Number.isSafeInteger(page.readThrough) && page.readThrough >= 0
                        && (page.following || page.readThrough > 0)) this.newAfter.set(page.readThrough);
                }
                this.rangeAfter.set(start);
                this.latestSequence.set(Number.isSafeInteger(page.latestSequence) && page.latestSequence >= 0 ? page.latestSequence : 0);
                this.comments.set(append ? [...this.comments(), ...page.comments] : page.comments);
                this.cursor = page.comments.at(-1)?.sequence ?? (append ? this.cursor : start);
                this.hasMore.set(page.hasMore); this.following.set(page.following); this.total.set(page.total);
                this.readThrough = Math.max(this.readThrough, page.readThrough);
                if (this.readNeedsReload()) { this.readNeedsReload.set(false); this.readError.set(false); this.markRead(); }
                this.api.setCount(this.id, page.total); this.loading.set(false); this.backgroundLoading.set(false); this.scheduleLiveRefresh();
            },
            error: error => {
                this.loading.set(false); this.backgroundLoading.set(false); this.error.set(error.status === 401 ? 'discussions.signInRead' : 'discussions.loadFailed');
                this.scheduleLiveRefresh();
            },
        });
    }
    visibleComment(id: string): void {
        if (!this.api.canCompose || !this.api.visible || !this.comments().some(c => c.id === id)) return;
        this.seen.add(id);
        clearTimeout(this.readTimer);
        this.readTimer = setTimeout(() => this.markRead(), 500);
    }
    markRead(): void {
        if (this.readNeedsReload()) { this.refresh(); return; }
        if (!this.api.canCompose || !this.api.visible || (this.readRequest && !this.readRequest.closed)) return;
        // A linked page is not evidence that earlier, unseen comments were read.
        if (this.rangeAfter() > this.readThrough) return;
        let through = this.readThrough;
        for (const comment of this.comments()) {
            if (comment.sequence <= through) continue;
            // Own posts and removed placeholders never create unread activity on the server.
            // They may be crossed, but an unseen visible comment by somebody else may not.
            if (!this.seen.has(comment.id) && !comment.deleted && !comment.hidden && comment.author?.id !== this.api.user()?._id) break;
            through = comment.sequence;
        }
        if (through <= this.readThrough) return;
        this.readError.set(false);
        this.readRequest = this.api.read(this.id, through).subscribe({
            next: () => {
                this.readThrough = through; this.api.refreshFollowing(true);
                this.readTimer = setTimeout(() => this.markRead(), 500);
            },
            error: error => {
                this.readError.set(true);
                this.readNeedsReload.set(error?.status === 409 && error?.error?.code === 'DISCUSSIONS_NOT_FETCHED');
            },
        });
    }
    submit(body: string, replyToId?: string, clientRequestId?: string): void {
        if (!discussionLengthValid(body)) return;
        body = body.trim();
        if (!this.api.canCompose || !body || this.busy()) return;
        if (!this.pendingPost || this.pendingPost.body !== body || this.pendingPost.replyToId !== replyToId
            || (clientRequestId && this.pendingPost.requestId !== clientRequestId))
            this.pendingPost = { body, replyToId, requestId: clientRequestId ?? crypto.randomUUID() };
        const post = this.pendingPost, matchTPId = this.id;
        this.act(() => this.api.post(this.id, post.body, post.requestId, post.replyToId), () => {
            this.pendingPost = undefined;
            this.postConfirmed.next({ matchTPId, body: post.body, replyToId: post.replyToId, clientRequestId: post.requestId });
            this.posted.update(n => n + 1);
        }, true);
    }
    toggleFollow(): void {
        if (!this.api.canCompose) return;
        const following = !this.following();
        this.act(() => this.api.follow(this.id, following), () => this.following.set(following));
    }
    delete(comment: DiscussionComment): void {
        if (comment.canDelete) this.act(() => this.api.delete(comment.id), () => this.redact(comment.id, 'deleted'));
    }
    hide(comment: DiscussionComment): void {
        if (comment.canHide) this.act(() => this.api.hide(comment.id, !comment.hidden), () => {
            if (!comment.hidden) this.redact(comment.id, 'hidden');
        });
    }
    report(comment: DiscussionComment, reason: string): void {
        if (!this.api.canCompose || comment.canDelete || !discussionLengthValid(reason, 500) || this.reported().has(comment.id)) return;
        this.act(() => this.api.report(comment.id, reason.trim()), () => {
            this.reported.update(ids => new Set([...ids, comment.id]));
        });
    }
    retryMutation(body?: string, replyToId?: string): void {
        if (this.retryIsPost && this.pendingPost && body !== undefined) this.submit(body, replyToId);
        else this.retryAction?.();
    }
    get retryingPost(): boolean { return this.retryIsPost; }
    private redact(id: string, kind: 'deleted' | 'hidden'): void {
        this.comments.update(rows => rows.map(row => ({ ...row,
            ...(row.id === id ? { [kind]: true, body: '', author: null } : {}),
            ...(row.replyTo?.id === id ? { replyTo: { id, authorName: null, body: null } } : {}),
        })));
    }
    discardPostRetry(): void {
        this.pendingPost = undefined;
        if (this.retryIsPost) { this.retryAction = undefined; this.retryIsPost = false; this.actionError.set(false); }
    }
    private act(request: () => Observable<unknown>, success: () => void = () => {}, isPost = false): void {
        if (this.busy()) return;
        this.loadRequest?.unsubscribe(); this.loading.set(false); this.backgroundLoading.set(false);
        this.busy.set(true); this.actionError.set(false);
        this.retryIsPost = isPost;
        this.retryAction = () => this.act(request, success, isPost);
        this.mutation = request().subscribe({
            next: () => {
                this.busy.set(false); this.retryAction = undefined; success();
                this.refresh(true); this.api.refreshFollowing(true);
            },
            error: () => { this.busy.set(false); this.actionError.set(true); this.scheduleLiveRefresh(); },
        });
    }
    ngOnDestroy(): void {
        this.clear(); this.subscriptions.unsubscribe();
        this.postConfirmed.complete();
        this.api.document.removeEventListener('visibilitychange', this.visibility);
    }
}
