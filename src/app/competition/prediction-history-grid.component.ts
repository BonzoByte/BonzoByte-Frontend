import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Injector, OnChanges, OnDestroy, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CompetitionPick, CompetitionPlayer } from '../core/services/competition.service';
import { compactPlayerGridLabel, playerGridFlagCode, playerGridLabel } from '../core/helpers/player-grid-label';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { predictionHistoryRow, PredictionHistoryRow } from './prediction-history-row';
import { Subscription } from 'rxjs';
import { environment } from '@env/environment';
import { localUiPreviewAllowed } from '../core/helpers/local-ui-preview';
import { MatchSummary } from '../core/models/match-summary';
import { DiscussionsService } from '../core/services/discussions.service';
import { predictionMatchPresentation } from './prediction-match-presentation';
import { MatchPlayersCellComponent, MatchTournamentCellComponent, MatchResultCellComponent } from '../shared/ui/match-grid-cells/match-grid-cells.component';
import { MatchEntityDetailsComponent, MatchEntityRequest } from '../shared/ui/match-entity-details/match-entity-details.component';

@Component({ selector: 'app-prediction-history-grid', standalone: true,
    imports: [CommonModule, TranslateModule, MatchPlayersCellComponent, MatchTournamentCellComponent, MatchResultCellComponent, MatchEntityDetailsComponent], changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './prediction-history-grid.component.html', styleUrls: ['./prediction-history-grid.component.scss'] })
export class PredictionHistoryGridComponent implements OnChanges, OnDestroy {
    @Input() entries: CompetitionPick[] = [];
    @Input() illustrative = false;
    @Input() localPreview = false;
    @Input() publicView = false;
    @Input() retrospective = false;
    @Output() openPick = new EventEmitter<number>();
    rows: (PredictionHistoryRow & { match: MatchSummary })[] = [];
    entity: MatchEntityRequest | null = null;
    preview = false;
    private metadata?: Subscription;
    readonly flagCode = playerGridFlagCode;
    readonly compactName = compactPlayerGridLabel;
    constructor(public regional: RegionalSettingsService, private injector: Injector, private change: ChangeDetectorRef) {}
    ngOnChanges(): void {
        this.metadata?.unsubscribe(); this.entity = null;
        this.preview = this.localPreview && localUiPreviewAllowed(environment, typeof location === 'undefined' ? '' : location.hostname);
        this.rows = this.entries.map(pick => ({ ...predictionHistoryRow(pick, this.preview), match: predictionMatchPresentation(pick, this.retrospective ? pick.displayMatch : undefined, this.preview && pick.matchTPId < 0) }));
        if (this.illustrative || this.preview) return;
        // The reserved high-ID range belongs to server-side competition fixtures, never real archives.
        const ids = [...new Set(this.entries.map(p => p.matchTPId).filter(id => Number.isSafeInteger(id) && id > 0 && id < 8000000000000000))];
        if (!ids.length) return;
        this.metadata = this.injector.get(DiscussionsService).cardSummaries(ids).subscribe({ next: summaries => {
            this.rows = this.rows.map(row => ({ ...row, match: predictionMatchPresentation(row.pick, summaries.get(row.pick.matchTPId) ?? (this.retrospective ? row.pick.displayMatch : undefined)) }));
            this.change.markForCheck();
        }, error: () => { /* Accepted snapshot remains available if display metadata is offline. */ } });
    }
    matchDate(match: MatchSummary): string { return this.regional.matchDateTime(match.dateTime, match.sourceTimePrecision).replace(/ (\d{2}:\d{2})$/, '\n$1'); }
    details(row: PredictionHistoryRow & { match: MatchSummary }, kind: MatchEntityRequest['kind'], side?: 1 | 2): void {
        if (this.illustrative && !this.preview || row.pick.matchTPId <= 0 && !this.preview || row.pick.matchTPId >= 8000000000000000) return;
        this.entity = { kind, match: row.match, side, preview: this.preview && row.pick.matchTPId < 0 };
    }
    auth(action: 'openLogin' | 'openRegister' | 'openBilling'): void { setTimeout(() => window.dispatchEvent(new Event(action)), 0); }
    ngOnDestroy(): void { this.metadata?.unsubscribe(); }
    trackRow(_index: number, row: PredictionHistoryRow): number { return row.pick.matchTPId; }
    signed(value: number, digits = 2): string { return (value > 0 ? '+' : '') + this.regional.number(value, digits); }
    submittedLabel(value: string): string { return this.regional.dateTime(value, 'utc').replace(/ (\d{2}:\d{2})$/, '\n$1'); }
    playerLabel(player: CompetitionPlayer): string { return playerGridLabel(player.name, player.countryISO3, player.seed, player.rank); }
    open(row: PredictionHistoryRow): void {
        if (!this.illustrative && !this.publicView && !this.retrospective && row.pick.matchTPId > 0) this.openPick.emit(row.pick.matchTPId);
    }
}
