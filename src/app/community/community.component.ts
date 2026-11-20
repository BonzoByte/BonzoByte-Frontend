import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, finalize } from 'rxjs';
import { CommunityCategory, CommunityService, CommunityTopic, CommunityTopicPage, CommunityMatch, CommunityList } from '../core/services/community.service';
import { DiscussionsService, DiscussionComment } from '../core/services/discussions.service';
import { AuthService } from '../core/services/auth.service';
import { User } from '../core/models/user.model';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { discussionTextLength } from '../core/helpers/discussion-text';

@Component({ selector: 'app-community', standalone: true, imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './community.component.html', styleUrl: './community.component.scss' })
export class CommunityComponent implements OnDestroy {
  readonly categories: { id: CommunityCategory; icon: string }[] = [
    { id: 'matches', icon: '◉' }, { id: 'play', icon: '↗' }, { id: 'equipment', icon: '◇' }, { id: 'terrace', icon: '☕' }];
  category: CommunityCategory = 'matches';
  user: User | null = null;
  canModerate = false;
  topics: CommunityTopic[] = []; matches: CommunityMatch[] = [];
  list: CommunityList<CommunityTopic> | null = null; matchList: CommunityList<CommunityMatch> | null = null;
  page: CommunityTopicPage | null = null;
  loading = false; matchLoading = false; busy = false; error = ''; matchError = false; notice = '';
  composing = false; title = ''; body = ''; language = 'hr'; reply: DiscussionComment | null = null;
  action: { kind: 'delete' | 'report' | 'hide' | 'topic'; comment?: DiscussionComment } | null = null;
  reason = ''; reports: { commentId: string; matchTPId: number; reason: string; createdAt: string }[] | null = null;
  private subscriptions = new Subscription(); private request?: Subscription; private matchRequest?: Subscription;
  private mutation?: Subscription; private reportRequest?: Subscription; private accessRequest?: Subscription; private revision = 0;
  private postKey = ''; private createKey = ''; private routeId: number | null = null;
  constructor(readonly api: CommunityService, readonly discussions: DiscussionsService, auth: AuthService,
    private route: ActivatedRoute, private router: Router, readonly regional: RegionalSettingsService,
    @Inject(DOCUMENT) private document: Document) {
    this.language = regional.language() === 'hr' ? 'hr' : 'en';
    this.subscriptions.add(auth.user$.subscribe(user => {
      const changed = (this.user?._id || '') !== (user?._id || ''); this.user = user;
      this.accessRequest?.unsubscribe(); this.canModerate = false;
      if (user) this.accessRequest = this.api.access().subscribe({ next: result => this.canModerate = result.canModerate === true,
        error: () => this.canModerate = false });
      if (changed) { this.revision++; this.mutation?.unsubscribe(); this.reportRequest?.unsubscribe(); this.busy = false;
        this.body = ''; this.title = ''; this.reply = null; this.composing = false; this.action = null; this.reports = null;
        this.postKey = ''; this.createKey = ''; this.notice = ''; this.error = ''; this.load(); }
    }));
    this.subscriptions.add(route.queryParamMap.subscribe(params => {
      const category = params.get('category'); this.category = this.categories.some(c => c.id === category) ? category as CommunityCategory : 'matches';
      const value = params.get('topic'); this.routeId = value && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(+value) ? +value : null;
      this.composing = false; this.reply = null; this.body = ''; this.postKey = ''; this.error = ''; this.notice = ''; this.action = null;
      this.load();
    }));
  }
  get canWrite(): boolean { return !!this.user?.isVerified; }
  get bodyLength(): number { return discussionTextLength(this.body); }
  get canSend(): boolean { return this.canWrite && !this.busy && this.body.trim().length > 0 && this.bodyLength <= 1000
    && (!this.composing || (this.title.trim().length > 0 && discussionTextLength(this.title) <= 120)); }
  select(category: CommunityCategory): void { if (!this.busy) void this.router.navigate(['/community'], { queryParams: { category } }); }
  open(topic: CommunityTopic): void { if (!this.busy) void this.router.navigate(['/community'], { queryParams: { category: topic.category, topic: topic.id } }); }
  login(): void { this.document.defaultView?.dispatchEvent(new CustomEvent('openLogin')); }
  load(more = false): void {
    this.request?.unsubscribe(); this.loading = true; this.error = '';
    if (this.routeId) {
      const previous = more ? this.page : null;
      if (!more) this.page = null;
      this.request = this.api.page(this.routeId, previous?.nextAfter || 0).subscribe({
        next: result => { this.page = { ...result, comments: [...(previous?.comments || []), ...result.comments] }; this.loading = false; },
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
  showReports(): void {
    this.reportRequest?.unsubscribe(); this.reportRequest = this.api.reports().subscribe({ next: result => this.reports = result.reports,
      error: e => this.error = this.errorKey(e) });
  }
  viewReport(id: number): void { void this.router.navigate(['/community'], { queryParams: { topic: id } }); }
  private errorKey(error: { status?: number; error?: { code?: string } }): string {
    if (error.status === 429) return 'community.rateLimit';
    if (error.status === 403) return 'community.verify';
    if (error.status === 401) return 'community.signIn';
    if (error.status === 400) return 'community.invalid';
    if (error.status === 404) return 'community.notFound';
    return 'community.failed';
  }
  ngOnDestroy(): void { this.revision++; this.subscriptions.unsubscribe(); this.request?.unsubscribe(); this.matchRequest?.unsubscribe(); this.mutation?.unsubscribe(); this.reportRequest?.unsubscribe(); this.accessRequest?.unsubscribe(); }
}
