import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { playerGridFlagCode, playerGridLabel } from '../core/helpers/player-grid-label';
import { finalMatchResult, finalMatchSets } from '../core/helpers/final-match-result';
import { DiscussionEntityTarget, MatchSummary } from '../core/models/match-summary';
import { DiscussionsService, DiscussionTarget } from '../core/services/discussions.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';

@Component({ selector: 'app-discussion-match-summary', standalone: true, imports: [CommonModule, TranslateModule],
    templateUrl: './discussion-match-summary.component.html', styleUrls: ['./discussion-match-summary.component.scss'] })
export class DiscussionMatchSummaryComponent implements OnChanges, OnDestroy {
    @Input({ required: true }) target!: DiscussionTarget;
    @Output() entityRequested = new EventEmitter<DiscussionEntityTarget>();
    match: MatchSummary | null = null;
    loading = false;
    private request?: Subscription;
    readonly flagCode = playerGridFlagCode;
    readonly playerLabel = playerGridLabel;
    readonly finalResult = finalMatchResult;
    readonly finalSets = (match: MatchSummary) => finalMatchSets(match)?.split(' ') || [];
    tournamentFlag(match: MatchSummary): string | null {
        const iso = match.tournamentEventCountryISO2;
        return iso && /^[a-z]{2}$/i.test(iso) && !['XX','XW','WD','UN'].includes(iso.toUpperCase()) ? playerGridFlagCode(iso).toLowerCase() : null;
    }
    constructor(private api: DiscussionsService, readonly regional: RegionalSettingsService) {}
    ngOnChanges(): void {
        this.request?.unsubscribe(); this.loading = false;
        this.match = this.target.match?.matchTPId === this.target.matchTPId ? this.target.match : null;
        if (!this.match) this.load();
    }
    load(): void {
        this.request?.unsubscribe(); this.loading = true;
        this.request = this.api.summary(this.target.matchTPId).subscribe({
            next: match => { this.match = match; this.loading = false; },
            error: () => { this.match = null; this.loading = false; },
        });
    }
    dateLabel(match: MatchSummary): string {
        return this.regional.matchDateTime(match.dateTime, match.sourceTimePrecision).replace(/ (\d{2}:\d{2})$/, '\n$1') || '—';
    }
    validId(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
    openPlayer(side: 1 | 2): void {
        const match = this.match, id = side === 1 ? match?.player1TPId : match?.player2TPId;
        if (match && this.validId(id)) this.entityRequested.emit({ kind: 'player', id, side, match });
    }
    openTournament(): void {
        const match = this.match, id = match?.tournamentEventTPId;
        if (match && this.validId(id)) this.entityRequested.emit({ kind: 'tournament', id, match });
    }
    ngOnDestroy(): void { this.request?.unsubscribe(); }
}
