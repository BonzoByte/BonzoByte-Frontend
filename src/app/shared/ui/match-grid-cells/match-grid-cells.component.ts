import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MatchSummary } from '../../../core/models/match-summary';
import { compactPlayerGridLabel, playerGridFlagCode, playerGridLabel } from '../../../core/helpers/player-grid-label';
import { finalMatchResult, finalMatchSets } from '../../../core/helpers/final-match-result';
import { RegionalSettingsService } from '../../../core/services/regional-settings.service';

export interface MatchPlayerCell { id?: number; name: string; compact: string; flag: string; country: string; side: 1 | 2; }
export interface MatchResultCell { result: string; sets: string; qualityHold?: boolean; qualityTitle?: string; }

@Component({ selector: 'app-match-players-cell', standalone: true, imports: [CommonModule, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush, styleUrls: ['./match-grid-cells.component.scss'],
    template: `<div class="shared-matchup matchup-cell__content"><span *ngFor="let player of players" class="shared-player matchup-player" [class.is-selected]="selectedSide === player.side" [class.is-your-pick]="selectedSide === player.side" [class.predicted-player-cell]="selectedSide === player.side">
      <span *ngIf="player.flag !== 'un'" class="fi" [ngClass]="'fi-' + player.flag" [title]="player.country" aria-hidden="true"></span>
      <button *ngIf="canOpen(player.id); else text" type="button" class="shared-entity-link player-link responsive-label" [title]="player.name"
        [attr.aria-label]="('catalog.playerDetails' | translate) + ': ' + player.name" (click)="playerOpened.emit(player.side)">
        <span class="shared-full player-name responsive-label__full" [title]="player.name">{{ player.name }}</span><span class="shared-compact responsive-label__compact">{{ player.compact }}</span></button>
      <ng-template #text><span class="shared-player-text player-name" [title]="player.name">{{ player.name }}</span></ng-template>
    </span></div>` })
export class MatchPlayersCellComponent implements OnChanges {
    @Input() match!: MatchSummary;
    @Input() selectedSide?: 1 | 2;
    @Input() preview = false;
    @Input() interactive = true;
    /** Allows the main grid to keep using its already cached labels. */
    @Input() labels?: { player1: string; player2: string; player1Compact: string; player2Compact: string };
    @Output() playerOpened = new EventEmitter<1 | 2>();
    players: MatchPlayerCell[] = [];
    canOpen(id?: number): boolean { return this.interactive && !!id && Number.isSafeInteger(id) && (id > 0 || this.preview); }
    ngOnChanges(): void {
        this.players = ([1, 2] as const).map(side => {
            const m = this.match, first = side === 1;
            const name = (first ? m.player1Name : m.player2Name) || '—';
            return { side, id: first ? m.player1TPId : m.player2TPId,
                name: this.labels ? (first ? this.labels.player1 : this.labels.player2) : playerGridLabel(name, first ? m.player1CountryISO3 : m.player2CountryISO3, first ? m.player1Seed : m.player2Seed, first ? m.player1Rank : m.player2Rank),
                compact: this.labels ? (first ? this.labels.player1Compact : this.labels.player2Compact) : compactPlayerGridLabel(name),
                flag: playerGridFlagCode(first ? m.player1CountryISO2 : m.player2CountryISO2).toLowerCase(),
                country: (first ? m.player1CountryFull : m.player2CountryFull) || '' };
        });
    }
}

@Component({ selector: 'app-match-tournament-cell', standalone: true, imports: [CommonModule, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush, styleUrls: ['./match-grid-cells.component.scss'],
    template: `<div class="shared-tournament strength-cell">
      <button *ngIf="canOpen; else text" type="button" class="shared-entity-link shared-tournament-name" (click)="tournamentOpened.emit()" [title]="name">
        <ng-container *ngTemplateOutlet="label"></ng-container></button>
      <ng-template #text><span class="shared-tournament-name"><ng-container *ngTemplateOutlet="label"></ng-container></span></ng-template>
      <ng-template #label><span *ngIf="flag !== 'un'" class="fi" [ngClass]="'fi-' + flag" [title]="match.tournamentEventCountryFull || ''" aria-hidden="true"></span> {{ name }}</ng-template>
      <div class="shared-tournament-meta" [title]="'matchGrid.strengthTs' | translate:{value: strengthLabel}">
        <span class="stars" role="img" [attr.aria-label]="'matchGrid.strengthTs' | translate:{value: strengthLabel}"><span *ngFor="let star of stars" class="star" [ngClass]="rating >= star ? 'full' : rating >= star - .5 ? 'half' : 'empty'"></span></span>
        <span class="shared-surface" [ngClass]="'shared-surface--' + surface" role="img" [title]="'surfaces.' + surface | translate" [attr.aria-label]="'surfaces.' + surface | translate"></span>
      </div></div>` })
export class MatchTournamentCellComponent implements OnChanges {
    @Input() match!: MatchSummary;
    @Input() preview = false;
    @Input() interactive = true;
    @Input() displayName?: string;
    @Output() tournamentOpened = new EventEmitter<void>();
    readonly stars = [1, 2, 3, 4, 5];
    name = ''; flag = 'un'; rating = 0; surface = 'unknown'; strengthLabel = '—'; canOpen = false;
    constructor(private regional: RegionalSettingsService) {}
    ngOnChanges(): void {
        const m = this.match, ts = m.tournamentStrengthMeanTS, raw = (m.surface || '').toLowerCase();
        this.name = this.displayName || m.tournamentEventName || '—';
        this.flag = playerGridFlagCode(m.tournamentEventCountryISO2).toLowerCase();
        this.surface = ['indoor', 'indoors'].includes(raw) ? 'carpet' : ['hard', 'clay', 'grass', 'carpet'].includes(raw) ? raw : 'unknown';
        this.rating = typeof ts === 'number' && Number.isFinite(ts) ? Math.round(Math.min(1, Math.max(0, (ts - 18) / 14)) * 10) / 2 : 0;
        this.strengthLabel = typeof ts === 'number' && Number.isFinite(ts) ? this.regional.number(ts, 2) : '—';
        const id = m.tournamentEventTPId;
        this.canOpen = this.interactive && !!id && Number.isSafeInteger(id) && (id > 0 || this.preview);
    }
}

@Component({ selector: 'app-match-result-cell', standalone: true, imports: [CommonModule, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush, styleUrls: ['./match-grid-cells.component.scss'],
    template: `<div class="shared-result match-result-cell__content"><span class="shared-result-main main-result match-result-cell__summary">{{ view.result }}</span><span *ngIf="view.sets" class="shared-result-sets set-results match-result-cell__sets">{{ view.sets }}</span>
      <span *ngIf="view.qualityHold" class="match-quality-warning" [title]="view.qualityTitle || ''">{{ 'matchGrid.unverified' | translate }}</span></div>` })
export class MatchResultCellComponent implements OnChanges {
    @Input() match!: MatchSummary;
    @Input() presentation?: MatchResultCell;
    view: MatchResultCell = { result: '—', sets: '' };
    ngOnChanges(): void { this.view = this.presentation || { result: finalMatchResult(this.match) || '—', sets: finalMatchSets(this.match) || '' }; }
}
