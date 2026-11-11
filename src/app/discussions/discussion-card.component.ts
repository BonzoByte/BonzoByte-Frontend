import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalMatchResult, finalMatchSets } from '../core/helpers/final-match-result';
import { playerGridFlagCode } from '../core/helpers/player-grid-label';
import { MatchSummary } from '../core/models/match-summary';
import { RegionalSettingsService } from '../core/services/regional-settings.service';

export interface DiscussionCardTarget { matchTPId: number; title?: string | null; unread?: boolean; }
interface DiscussionGridRow { target: DiscussionCardTarget; match?: MatchSummary; result: string | null; sets: string[];
    tournament: { name: string; flag: string | null; country: string };
    players: { name: string; flag: string | null; country: string }[]; }
@Component({ selector: 'app-discussion-card', standalone: true, imports: [CommonModule, TranslateModule],
    template: `<table *ngIf="rows.length" class="match-table discussion-inbox-grid">
      <colgroup><col class="grid-date"><col class="grid-tournament"><col><col class="grid-result"></colgroup>
      <thead><tr><th scope="col">{{ 'common.date' | translate }}</th><th scope="col">{{ 'common.tournament' | translate }}</th><th scope="col">{{ 'common.matchup' | translate }}</th><th scope="col">{{ 'common.result' | translate }}</th></tr></thead>
      <tbody><tr *ngFor="let row of rows; trackBy: trackRow" [class.has-unread]="row.target.unread === true" (click)="openThread.emit(row.target)">
        <td class="card-date"><time [attr.datetime]="row.match?.dateTime || null">{{ dateLabel(row.match) }}</time></td>
        <td class="card-tournament"><span class="card-tournament-label" [title]="row.tournament.name">
          <span *ngIf="row.tournament.flag" class="fi" [ngClass]="'fi-' + row.tournament.flag"
            role="img" [attr.aria-label]="row.tournament.country" [title]="row.tournament.country"></span>
          <span>{{ row.tournament.name || '—' }}</span></span></td>
        <td class="grid-players"><button type="button" class="discussion-card"
          [attr.aria-label]="('discussions.open' | translate) + ': ' + label(row) + (row.target.unread === true ? '. ' + ('discussions.newActivity' | translate) : '')"
          [title]="row.target.unread === true ? ('discussions.newComments' | translate) : ''">
          <span class="card-players"><span class="card-player" *ngFor="let player of row.players">
            <span *ngIf="player.flag" class="fi" [ngClass]="'fi-' + player.flag" [title]="player.country" aria-hidden="true"></span>
            <span class="card-player-name">{{ player.name }}</span>
          </span><span *ngIf="!row.players.length" class="card-player-name">{{ label(row) }}</span></span>
          <span *ngIf="row.target.unread === true" class="card-unread" aria-hidden="true"><i class="bi bi-chat-left-dots-fill"></i></span>
        </button></td><td class="card-result"><span class="card-result-main">{{ row.result || '—' }}</span>
          <span *ngIf="row.sets.length" class="card-sets"><span *ngFor="let set of row.sets">{{ set }}</span></span></td>
      </tr></tbody>
    </table>`,
    styles: [`:host{display:block;min-width:0;max-width:100%;}.discussion-inbox-grid{table-layout:fixed;box-sizing:border-box;width:100%;max-width:100%;min-width:0;margin:8px 0 0;border-collapse:collapse;font-size:12px;}
      .grid-date{width:86px;}.grid-tournament{width:24%;}.grid-result{width:88px;}.discussion-inbox-grid th,.discussion-inbox-grid td{min-width:0;padding:5px 4px;white-space:normal;overflow-wrap:anywhere;}
      .discussion-inbox-grid thead th{text-align:center;}.discussion-inbox-grid tbody tr{cursor:pointer;}
      .discussion-inbox-grid tbody tr:hover{background:var(--bb-surface-2,#26323c);}.has-unread .grid-players{box-shadow:inset 3px 0 var(--bb-accent,#80d5ff);}
      .card-date{text-align:center;white-space:pre-line!important;}.card-result{text-align:center;font-weight:600;color:var(--bb-text,#fff);}
      .discussion-card{box-sizing:border-box;position:relative;display:block;width:100%;max-width:100%;min-width:0;padding:3px;margin:0;text-align:left;white-space:normal;overflow-wrap:anywhere;background:transparent;color:inherit;border:0;border-radius:2px;cursor:pointer;}
      .has-unread .discussion-card{padding-right:28px;}.card-unread{box-sizing:border-box;position:absolute;right:4px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:20px;height:20px;border:1px solid currentColor;border-radius:50%;color:var(--bb-theme-accent,#80d5ff);background:var(--bb-surface-2,#26323c);font-size:11px;line-height:1;}
      .discussion-card:focus-visible{outline:2px solid var(--bb-accent,#80d5ff);outline-offset:0;}
      .card-players{display:grid;gap:4px;min-width:0;}.card-player{display:flex;align-items:flex-start;gap:5px;min-width:0;}
      .fi{flex:none;margin-top:.15em;}.card-player-name{min-width:0;overflow-wrap:anywhere;}
      .card-tournament{text-align:center;line-height:1.3;}.card-tournament-label{white-space:normal;overflow-wrap:anywhere;}.card-tournament .fi{margin-right:4px;}
      .card-sets{display:block;margin-top:3px;font-size:11px;font-weight:400;line-height:1.4;color:var(--bb-text-muted,#aab5c0);font-variant-numeric:tabular-nums;}
      .card-sets span{display:inline-block;white-space:nowrap;margin:0 2px;}
      @media(max-width:400px){.grid-date{width:71px;}.grid-result{width:66px;}}`] })
export class DiscussionCardComponent implements OnChanges {
    @Input({ required: true }) targets: readonly DiscussionCardTarget[] = [];
    @Input() summaries: ReadonlyMap<number, MatchSummary> = new Map();
    @Output() openThread = new EventEmitter<DiscussionCardTarget>();
    rows: DiscussionGridRow[] = [];
    readonly trackRow = (_: number, row: DiscussionGridRow) => row.target.matchTPId;
    constructor(readonly regional: RegionalSettingsService, private translate: TranslateService) {}
    ngOnChanges(): void {
        this.rows = this.targets.map(target => {
            const supplied = this.summaries.get(target.matchTPId), match = supplied?.matchTPId === target.matchTPId ? supplied : undefined;
            const names = match ? [match.player1Name!, match.player2Name!] : target.title?.split(/\s+(?:—|vs)\s+/);
            const players = (names?.length === 2 ? names : target.title ? [target.title] : []).map((name, i) => {
                const iso = i === 0 ? match?.player1CountryISO2 : match?.player2CountryISO2;
                const full = i === 0 ? match?.player1CountryFull : match?.player2CountryFull;
                return { name, flag: iso && /^[a-z]{2}$/i.test(iso) ? playerGridFlagCode(iso).toLowerCase() : null, country: full || iso || '' };
            });
            const iso = match?.tournamentEventCountryISO2;
            const flag = iso && /^[a-z]{2}$/i.test(iso) && !['XX','XW','WD','UN'].includes(iso.toUpperCase()) ? playerGridFlagCode(iso).toLowerCase() : null;
            return { target, match, players, result: match ? finalMatchResult(match) : null,
                sets: match ? finalMatchSets(match)?.split(' ') || [] : [],
                tournament: { name: match?.tournamentEventName || '', flag, country: match?.tournamentEventCountryFull || iso || '' } };
        });
    }
    label(row: DiscussionGridRow): string { return row.match ? `${row.match.player1Name} — ${row.match.player2Name}`
        : row.target.title || this.translate.instant('discussions.match', { id: row.target.matchTPId }); }
    dateLabel(match?: MatchSummary): string { return match ? this.regional.matchDateTime(match.dateTime, match.sourceTimePrecision).replace(/ (\d{2}:\d{2})$/, '\n$1') || '—' : '—'; }
}

@Component({ selector: 'app-discussion-list-heading', standalone: true, imports: [TranslateModule],
    template: `<div class="list-heading"><p>{{ noteKey | translate }}</p>
      <button type="button" class="list-refresh" [disabled]="loading" (click)="refresh.emit()">{{ 'discussions.refresh' | translate }}</button></div>`,
    styles: [`:host{display:block;min-width:0;max-width:100%;}.list-heading{display:flex;align-items:flex-start;gap:8px;min-width:0;}
      p{flex:1;min-width:0;margin:0 0 10px;font-size:.8rem;color:var(--bb-text-muted,#aab5c0);white-space:normal;overflow-wrap:anywhere;}
      button{box-sizing:border-box;max-width:100%;flex:none;font-size:.8rem;white-space:normal;background:transparent;color:inherit;border:1px solid var(--bb-border,#526071);border-radius:6px;padding:8px;cursor:pointer;}
      button:disabled{opacity:.5;cursor:default;}button:focus-visible{outline:2px solid var(--bb-accent,#80d5ff);outline-offset:2px;}`] })
export class DiscussionListHeadingComponent {
    @Input({ required: true }) noteKey!: string;
    @Input() loading = false;
    @Output() refresh = new EventEmitter<void>();
}
