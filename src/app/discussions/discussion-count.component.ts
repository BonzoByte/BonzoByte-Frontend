import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Match } from '../core/models/tennis.model';
import { DiscussionsService } from '../core/services/discussions.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';

@Component({ selector: 'app-discussion-count', standalone: true, imports: [CommonModule, TranslateModule],
    template: `<button type="button" class="discussion-count" (click)="api.open({matchTPId: match.matchTPId}, match)"
      [title]="(api.countErrors().has(match.matchTPId) ? 'discussions.countFailed' : 'discussions.open') | translate"
      [attr.aria-label]="('discussions.open' | translate) + ': ' + match.player1Name + ' — ' + match.player2Name + ', ' + countLabel">
      <span aria-hidden="true" class="bi bi-chat-left-text"></span><span>{{ countLabel }}</span>
    </button>`,
    styles: [`.discussion-count{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:36px;min-width:44px;border:0;background:transparent;color:inherit;padding:2px; font-size:11px;cursor:pointer;}
      .discussion-count:focus-visible{outline:2px solid var(--bb-accent,#80d5ff);outline-offset:-2px;}`] })
export class DiscussionCountComponent implements OnChanges, OnDestroy {
    @Input({ required: true }) match!: Match;
    private unwatch?: () => void;
    constructor(readonly api: DiscussionsService, readonly regional: RegionalSettingsService) {}
    get countLabel(): string {
        const count = this.api.counts().get(this.match.matchTPId);
        return this.api.countErrors().has(this.match.matchTPId) ? '?' : count === undefined ? '…' : this.regional.number(count, 0, true);
    }
    ngOnChanges(): void { this.unwatch?.(); this.api.remember(this.match); this.unwatch = this.api.watchCount(this.match.matchTPId); }
    ngOnDestroy(): void { this.unwatch?.(); }
}
