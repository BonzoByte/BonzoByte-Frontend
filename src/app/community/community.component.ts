import { CommonModule, DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, concatMap, finalize, of, tap } from 'rxjs';
import { CommunityCategory, CommunityService, CommunityTopic, CommunityTopicPage, CommunityMatch, CommunityList, CommunityReport, FollowedCommunityTopic } from '../core/services/community.service';
import { CommunityHubComponent } from './community-hub.component';
import { DiscussionsService, DiscussionComment } from '../core/services/discussions.service';
import { AuthService } from '../core/services/auth.service';
import { User } from '../core/models/user.model';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { discussionTextLength } from '../core/helpers/discussion-text';

@Component({ selector: 'app-community', standalone: true, imports: [CommonModule, FormsModule, RouterLink, TranslateModule, CommunityHubComponent],
  templateUrl: './community.component.html', styleUrl: './community.component.scss' })
export class CommunityComponent implements OnDestroy, AfterViewInit {
  readonly categories: { id: CommunityCategory; icon: string }[] = [
    { id: 'matches', icon: '◉' }, { id: 'play', icon: '↗' }, { id: 'equipment', icon: '◇' }, { id: 'terrace', icon: '☕' }];
  category: CommunityCategory = 'matches';
  user: User | null = null;
  canModerate = false;
  view: 'topics' | 'following' | 'moderation' = 'topics'; unreadCount = 0; reportCount = 0;
  @ViewChildren('forumPost', { read: ElementRef }) private posts!: QueryList<ElementRef<HTMLElement>>;
  targetPost = ''; private rangeAfter = 0; private deliveredThrough = 0; private visibleThrough = 0;
  private observer?: IntersectionObserver; private readTimer?: ReturnType<typeof setTimeout>;
  private pollTimer?: ReturnType<typeof setInterval>; private readRequest?: Subscription; private followRequest?: Subscription;
  private unreadRequest?: Subscription; private badgeAgain = false; private destroyed = false;
  private visibility = () => { if (this.document.visibilityState === 'hidden') this.stopObserver(); else { this.watchPosts(); this.refreshBadges(); } };
  topics: CommunityTopic[] = []; matches: CommunityMatch[] = [];
  list: CommunityList<CommunityTopic> | null = null; matchList: CommunityList<CommunityMatch> | null = null;
  page: CommunityTopicPage | null = null;
  loading = false; matchLoading = false; busy = false; error = ''; matchError = false; notice = '';
  composing = false; title = ''; body = ''; language = 'hr'; reply: DiscussionComment | null = null;
  action: { kind: 'delete' | 'report' | 'hide' | 'topic'; comment?: DiscussionComment } | null = null;
  reason = '';
  private subscriptions = new Subscription(); private request?: Subscription; private matchRequest?: Subscription;
  private mutation?: Subscription; private accessRequest?: Subscription; private revision = 0;
  private postKey = ''; private createKey = ''; private routeId: number | null = null;
  constructor(readonly api: CommunityService, readonly discussions: DiscussionsService, auth: AuthService,
    private route: ActivatedRoute, private router: Router, readonly regional: RegionalSettingsService,
    @Inject(DOCUMENT) private document: Document) {
    this.language = regional.language() === 'hr' ? 'hr' : 'en';
    this.subscriptions.add(auth.user$.subscribe(user => {
      const changed = (this.user?._id || '') !== (user?._id || ''); this.user = user;
      this.accessRequest?.unsubscribe(); this.canModerate = false;
      if (user) this.accessRequest = this.api.access().subscribe({ next: result => { this.canModerate = result.canModerate === true; this.refreshBadges(); this.watchPosts(); },
        error: () => this.canModerate = false });
      if (changed) { this.revision++; this.mutation?.unsubscribe(); this.busy = false;
        this.stopObserver(); this.readRequest?.unsubscribe(); this.followRequest?.unsubscribe(); this.badgeAgain = false; this.unreadRequest?.unsubscribe();
        this.unreadCount = 0; this.reportCount = 0;
        this.body = ''; this.title = ''; this.reply = null; this.composing = false; this.action = null;
        this.postKey = ''; this.createKey = ''; this.notice = ''; this.error = ''; this.load(); }
    }));
    this.subscriptions.add(route.queryParamMap.subscribe(params => {
      const category = params.get('category'); this.category = this.categories.some(c => c.id === category) ? category as CommunityCategory : 'matches';
      const value = params.get('topic'); this.routeId = value && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(+value) ? +value : null;
      this.view = params.get('view') === 'moderation' ? 'moderation' : params.get('view') === 'following' ? 'following' : 'topics';
      if (this.routeId) this.view = 'topics';
      const sequence = Number(params.get('sequence')); this.targetPost = /^[a-f0-9]{24}$/.test(params.get('post') || '') ? params.get('post')! : '';
      this.rangeAfter = this.targetPost && Number.isSafeInteger(sequence) && sequence > 0 ? sequence - 1 : 0;
      this.composing = false; this.reply = null; this.body = ''; this.postKey = ''; this.error = ''; this.notice = ''; this.action = null;
      this.load();
    }));
    this.document.addEventListener('visibilitychange', this.visibility);
    this.pollTimer = setInterval(() => { if (this.document.visibilityState !== 'hidden') this.refreshBadges(); }, 60000);
  }
  ngAfterViewInit(): void { this.subscriptions.add(this.posts.changes.subscribe(() => this.watchPosts())); this.watchPosts(); }
  get canWrite(): boolean { return !!this.user?.isVerified; }
  get bodyLength(): number { return discussionTextLength(this.body); }
  get canSend(): boolean { return this.canWrite && !this.busy && this.body.trim().length > 0 && this.bodyLength <= 1000
    && (!this.composing || (this.title.trim().length > 0 && discussionTextLength(this.title) <= 120)); }
  select(category: CommunityCategory): void { if (!this.busy) void this.router.navigate(['/community'], { queryParams: { category } }); }
  open(topic: CommunityTopic): void { if (!this.busy) void this.router.navigate(['/community'], { queryParams: { category: topic.category, topic: topic.id } }); }
  selectView(view: 'topics' | 'following' | 'moderation'): void { if (!this.busy) void this.router.navigate(['/community'], { queryParams: { view, category: this.category } }); }
  openFollowed(topic: FollowedCommunityTopic): void { void this.router.navigate(['/community'], { queryParams: { topic: topic.matchTPId, category: topic.category } }); }
  openReported(row: CommunityReport): void {
    if (row.scope === 'match') this.discussions.open({ matchTPId: row.threadId, title: row.title || undefined,
      ...(row.comment.sequence ? { comment: { id: row.commentId, sequence: row.comment.sequence } } : {}) });
    else void this.router.navigate(['/community'], { queryParams: { topic: row.threadId, post: row.commentId, sequence: row.comment.sequence } });
  }
  fromStart(): void { void this.router.navigate(['/community'], { queryParams: { topic: this.routeId, category: this.page?.topic.category } }); }
  get isJump(): boolean { return this.rangeAfter > 0; }
  refreshBadges(): void {
    if (this.destroyed || !this.canWrite || this.document.visibilityState === 'hidden') return;
    // Do not cancel an in-flight fenced read whenever another action changes a badge.
    // Serialize the two summaries and coalesce concurrent refresh requests.
    if (this.unreadRequest && !this.unreadRequest.closed) { this.badgeAgain = true; return; }
    const revision = this.revision; this.badgeAgain = false;
    this.unreadRequest = this.api.following(undefined, 1).pipe(
      tap(result => this.unreadCount = result.unreadCount),
      concatMap(() => this.canModerate ? this.api.moderationSummary() : of(null)),
      finalize(() => { if (this.badgeAgain && revision === this.revision && !this.destroyed) {
        this.badgeAgain = false; setTimeout(() => this.refreshBadges());
      } })
    ).subscribe({ next: result => { if (result) this.reportCount = result.total; }, error: () => {} });
  }
  toggleFollow(): void {
    if (!this.page || !this.canWrite || this.busy) return;
    const id = this.page.topic.id, revision = this.revision; this.busy = true;
    this.followRequest = this.api.follow(id, !this.page.following).pipe(finalize(() => { if (revision === this.revision) this.busy = false; })).subscribe({
      next: result => { if (this.page?.topic.id === id && revision === this.revision) { this.page = { ...this.page, following: result.following }; this.refreshBadges(); } },
      error: e => { if (revision === this.revision) this.error = this.errorKey(e); } });
  }
  togglePin(): void {
    if (!this.page || !this.canModerate || !this.canWrite || this.busy) return;
    const id = this.page.topic.id, revision = this.revision; this.busy = true; this.error = ''; this.notice = '';
    this.mutation = this.api.pin(id, !this.page.topic.pinned).pipe(finalize(() => { if (revision === this.revision) this.busy = false; })).subscribe({
      next: result => { if (revision === this.revision && this.page?.topic.id === id) {
        this.page = { ...this.page, topic: result.topic }; this.notice = result.topic.pinned ? 'community.pins.saved' : 'community.pins.removed';
      } }, error: e => { if (revision === this.revision) this.error = this.errorKey(e); } });
  }
  login(): void { this.document.defaultView?.dispatchEvent(new CustomEvent('openLogin')); }
  load(more = false): void {
    this.stopObserver(); this.readRequest?.unsubscribe(); this.deliveredThrough = 0;
    this.request?.unsubscribe(); this.loading = true; this.error = '';
    if (this.view !== 'topics') { this.page = null; this.loading = false; this.matchRequest?.unsubscribe(); return; }
    if (this.routeId) {
      const previous = more ? this.page : null;
      if (!more) this.page = null;
      this.request = this.api.page(this.routeId, previous?.nextAfter || this.rangeAfter).subscribe({
        next: result => { this.page = { ...result, comments: [...(previous?.comments || []), ...result.comments] };
          this.deliveredThrough = this.page.comments.at(-1)?.sequence || 0; this.loading = false;
          setTimeout(() => { this.watchPosts(); if (this.targetPost) this.document.getElementById('post-'+this.targetPost)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }); },
        error: e => { this.loading = false; this.error = this.errorKey(e); } });
    } else {
      this.page = null; const previous = more ? this.topics : []; if (!more) this.topics = [];
      this.request = this.api.topics(this.category, more ? this.list?.nextAfter || undefined : undefined).subscribe({
        next: result => { this.list = result; this.topics = [...previous, ...result.items]; this.loading = false; },
        error: e => { this.loading = false; this.error = this.errorKey(e); } });
      if (!more && this.category === 'matches') this.loadMatches();
    }
  }
  loadMatches(more = false): void {
    this.matchRequest?.unsubscribe(); this.matchLoading = true; this.matchError = false;
    const previous = more ? this.matches : []; if (!more) this.matches = [];
    this.matchRequest = this.api.matches(more ? this.matchList?.nextAfter || undefined : undefined).subscribe({
      next: result => { this.matches = [...previous, ...result.items]; this.matchList = result; this.matchLoading = false; },
      error: () => { this.matchLoading = false; this.matchError = true; } });
  }
  openMatch(match: CommunityMatch): void { this.discussions.open({ matchTPId: match.id, title: match.title || undefined }); }
  startTopic(): void { this.composing = true; this.title = ''; this.body = ''; this.reply = null; this.createKey = ''; this.notice = ''; }
  edited(): void { this.postKey = ''; this.createKey = ''; }
  send(): void {
    if (!this.canSend) return;
    const body = this.body.trim(), revision = this.revision; this.busy = true; this.error = '';
    if (this.composing) {
      this.createKey ||= crypto.randomUUID();
      this.mutation = this.api.create({ title: this.title.trim(), category: this.category, language: this.language, body, clientRequestId: this.createKey })
        .pipe(finalize(() => { if (revision === this.revision) this.busy = false; })).subscribe({
          next: result => { if (revision === this.revision) { this.busy = false; this.composing = false; this.body = ''; this.createKey = ''; this.open(result.topic); } },
          error: e => { if (revision === this.revision) this.error = this.errorKey(e); } });
    } else if (this.page) {
      this.postKey ||= crypto.randomUUID(); const id = this.page.topic.id;
      this.mutation = this.api.post(id, body, this.postKey, this.reply?.id)
        .pipe(finalize(() => { if (revision === this.revision) this.busy = false; })).subscribe({
          next: result => { if (revision !== this.revision || !this.page || this.page.topic.id !== id) return;
            this.body = ''; this.reply = null; this.postKey = ''; this.notice = 'community.sent';
            this.page = { ...this.page, following: result.following }; this.refreshBadges();
            // Keep chronological pagination contiguous; never append past unseen pages.
            if (!this.page.hasMore) { this.page = { ...this.page, total: result.total, nextAfter: result.comment.sequence,
              comments: [...this.page.comments.filter(c => c.id !== result.comment.id), result.comment] }; }
            else this.notice = 'community.sentMore'; },
          error: e => { if (revision === this.revision) this.error = this.errorKey(e); } });
    }
  }
  confirmAction(): void {
    if (!this.action || this.busy || !this.canWrite) return;
    const action = this.action, revision = this.revision; this.busy = true; this.error = '';
    const request = action.kind === 'topic' ? this.api.removeTopic(this.page!.topic.id)
      : action.kind === 'delete' ? this.api.remove(action.comment!.id)
      : action.kind === 'hide' ? this.api.hide(action.comment!.id, !action.comment!.hidden)
      : this.api.report(action.comment!.id, this.reason.trim());
    this.mutation = request.pipe(finalize(() => { if (revision === this.revision) this.busy = false; })).subscribe({
      next: () => { if (revision !== this.revision) return; this.action = null; this.reason = '';
        if (action.kind === 'topic') { this.busy = false; this.select(this.category); }
        else if (action.kind === 'report') this.notice = 'community.reported'; else this.load(); },
      error: e => { if (revision === this.revision) this.error = this.errorKey(e); } });
  }
  private errorKey(error: { status?: number; error?: { code?: string } }): string {
    if (error.status === 429) return 'community.rateLimit';
    if (error.status === 403) return 'community.verify';
    if (error.status === 401) return 'community.signIn';
    if (error.status === 400) return 'community.invalid';
    if (error.status === 404) return 'community.notFound';
    return 'community.failed';
  }
  private stopObserver(): void { this.observer?.disconnect(); this.observer = undefined; clearTimeout(this.readTimer); this.visibleThrough = 0; }
  private watchPosts(): void {
    this.stopObserver();
    if (this.destroyed || !this.page || !this.canWrite || this.rangeAfter || this.document.visibilityState === 'hidden' || !this.posts?.length) return;
    const id = this.page.topic.id;
    this.observer = new IntersectionObserver(entries => {
      if (this.page?.topic.id !== id || this.document.visibilityState === 'hidden') return;
      for (const entry of entries) if (entry.isIntersecting) {
        const sequence = Number((entry.target as HTMLElement).dataset['sequence']);
        if (sequence <= this.deliveredThrough) this.visibleThrough = Math.max(this.visibleThrough, sequence);
      }
      clearTimeout(this.readTimer); this.readTimer = setTimeout(() => this.acknowledgeRead(id), 600);
    }, { threshold: 0.25 });
    for (const post of this.posts) this.observer.observe(post.nativeElement);
  }
  private acknowledgeRead(id: number): void {
    if (this.page?.topic.id !== id || !this.canWrite || this.rangeAfter || this.document.visibilityState === 'hidden'
      || this.visibleThrough <= this.page.readThrough || this.visibleThrough > this.deliveredThrough) return;
    const revision = this.revision; this.readRequest?.unsubscribe();
    this.readRequest = this.api.read(id, this.visibleThrough).subscribe({ next: result => {
      if (revision === this.revision && this.page?.topic.id === id) { this.page = { ...this.page, readThrough: result.readThrough }; this.refreshBadges(); }
    }, error: () => {} });
  }
  ngOnDestroy(): void { this.destroyed = true; this.revision++; this.stopObserver(); clearInterval(this.pollTimer); this.document.removeEventListener('visibilitychange', this.visibility);
    this.readRequest?.unsubscribe(); this.followRequest?.unsubscribe(); this.unreadRequest?.unsubscribe();
    this.subscriptions.unsubscribe(); this.request?.unsubscribe(); this.matchRequest?.unsubscribe(); this.mutation?.unsubscribe(); this.accessRequest?.unsubscribe(); }
}
