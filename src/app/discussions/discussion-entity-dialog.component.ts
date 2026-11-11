import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DiscussionEntityTarget } from '../core/models/match-summary';
import { PlayerIndex, TournamentIndex } from '../core/models/tennis.model';
import { StaticArchivesService } from '../core/services/static-archives.service';
import { PlayerModalComponent } from '../tennis/players/player-modal/player-modal.component';
import { TournamentModalComponent } from '../tennis/tournaments/tournament-modal/tournament-modal.component';

/** Loaded on demand; reuse the actual main-grid detail modals and their access rules. */
@Component({ selector: 'app-discussion-entity-dialog', standalone: true, imports: [CommonModule, PlayerModalComponent, TournamentModalComponent],
    template: `<app-player-modal *ngIf="player" [isOpen]="true" [playerTPId]="player.playerTPId" [playerIndex]="player"
      (closed)="closed.emit()" (showCurrentMatches)="leave.emit()"></app-player-modal>
      <app-tournament-modal *ngIf="tournament" [tournament]="tournament" [strengthScale]="strength"
        (closed)="closed.emit()" (showMatches)="showTournamentMatches($event)"></app-tournament-modal>` })
export class DiscussionEntityDialogComponent implements OnChanges, OnDestroy {
    @Input({ required: true }) target!: DiscussionEntityTarget;
    @Output() closed = new EventEmitter<void>();
    @Output() leave = new EventEmitter<void>();
    player: PlayerIndex | null = null;
    tournament: TournamentIndex | null = null;
    strength: { min: number | null; median: number | null; max: number | null } | null = null;
    private request?: Subscription;
    constructor(private archives: StaticArchivesService, private router: Router) {}
    ngOnChanges(): void {
        this.request?.unsubscribe(); this.player = null; this.tournament = null; this.strength = null;
        const target = this.target, match = target.match;
        if (!Number.isSafeInteger(target.id) || target.id <= 0) return;
        if (target.kind === 'player') {
            const first = target.side === 1;
            if ((first ? match.player1TPId : match.player2TPId) !== target.id) return;
            this.player = { playerTPId: target.id, playerName: (first ? match.player1Name : match.player2Name) || null,
                countryISO2: first ? match.player1CountryISO2 : match.player2CountryISO2,
                countryISO3: first ? match.player1CountryISO3 : match.player2CountryISO3,
                countryFull: first ? match.player1CountryFull : match.player2CountryFull };
        } else {
            if (match.tournamentEventTPId !== target.id) return;
            const fallback: TournamentIndex = { tournamentEventTPId: target.id, tournamentEventName: match.tournamentEventName || null,
                countryISO2: match.tournamentEventCountryISO2, countryISO3: match.tournamentEventCountryISO3,
                countryFull: match.tournamentEventCountryFull, tournamentTypeName: match.tournamentTypeName,
                tournamentLevelName: match.tournamentLevelName, surfaceName: match.surface };
            this.tournament = fallback;
            this.request = this.archives.getTournamentsIndex().pipe(catchError(() => of(null))).subscribe(index => {
                this.tournament = index?.items.find(row => row.tournamentEventTPId === target.id) ?? fallback;
                const values = (index?.items ?? []).map(row => row.averageMatchStrength)
                    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
                const middle = Math.floor(values.length / 2);
                this.strength = index?.strength ?? (values.length ? { min: values[0], max: values[values.length - 1],
                    median: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2 } : null);
            });
        }
    }
    showTournamentMatches(id: number): void {
        if (!Number.isSafeInteger(id) || id <= 0 || id !== this.tournament?.tournamentEventTPId) return;
        void this.router.navigate(['/tournaments/matches', id]).then(ok => { if (ok) this.leave.emit(); }).catch(() => {});
    }
    ngOnDestroy(): void { this.request?.unsubscribe(); }
}
