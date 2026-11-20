import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, finalize } from 'rxjs';
import { CommunityService, CommunityReport, CommunityScope, FollowedCommunityTopic } from '../core/services/community.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';

@Component({ selector: 'app-community-hub', standalone: true, imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './community-hub.component.html', styleUrl: './community-hub.component.scss' })
export class CommunityHubComponent implements OnChanges, OnDestroy {
  @Input() view: 'following' | 'moderation' = 'following';
  @Input() actor = '';
  @Output() openReport = new EventEmitter<CommunityReport>();
  @Output() openTopic = new EventEmitter<FollowedCommunityTopic>();
  @Output() changed = new EventEmitter<void>();
  source: 'all' | CommunityScope = 'all'; status: 'open' | 'resolved' | 'all' = 'open';
  reports: CommunityReport[] = []; topics: FollowedCommunityTopic[] = [];
  loading = false; busy = false; error = ''; nextAfter: string | null = null;
  pending: CommunityReport | null = null;
  private request?: Subscription; private mutation?: Subscription; private revision = 0;
  constructor(readonly api: CommunityService, readonly regional: RegionalSettingsService) {}
  ngOnChanges(): void { this.revision++; this.mutation?.unsubscribe(); this.busy = false; this.pending = null; this.load(); }
  load(more = false): void {
    this.request?.unsubscribe(); this.loading = true; this.error = ''; this.pending = null;
    if (!more) { this.reports = []; this.topics = []; this.nextAfter = null; }
    if (this.view === 'moderation') this.request = this.api.moderation(this.source, this.status, more ? this.nextAfter || undefined : undefined).subscribe({
      next: result => { this.reports = [...this.reports, ...result.items]; this.nextAfter = result.nextAfter; this.loading = false; this.changed.emit(); },
      error: () => { this.loading = false; this.error = 'community.failed'; } });
    else this.request = this.api.following(more ? this.nextAfter || undefined : undefined).subscribe({
      next: result => { this.topics = [...this.topics, ...result.threads]; this.nextAfter = result.nextAfter; this.loading = false; this.changed.emit(); },
      error: () => { this.loading = false; this.error = 'community.failed'; } });
  }
  resolve(row: CommunityReport): void { this.mutate(this.api.resolveReport(row, !row.resolved)); }
  hide(row: CommunityReport): void { this.mutate(this.api.moderateComment(row, !row.comment.hidden)); }
  unfollow(row: FollowedCommunityTopic): void { this.mutate(this.api.follow(row.matchTPId, false)); }
  private mutate(request: ReturnType<CommunityService['resolveReport']>): void {
    if (this.busy) return;
    const revision = this.revision; this.busy = true; this.error = '';
    this.mutation = request.pipe(finalize(() => { if (revision === this.revision) this.busy = false; })).subscribe({
      next: () => { if (revision === this.revision) { this.changed.emit(); this.load(); } },
      error: () => { if (revision === this.revision) this.error = 'community.failed'; } });
  }
  ngOnDestroy(): void { this.revision++; this.request?.unsubscribe(); this.mutation?.unsubscribe(); }
}
