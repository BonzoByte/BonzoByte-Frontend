import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, catchError, of, timeout } from 'rxjs';
import { environment } from '@env/environment';
import { MatchSummary } from '../../../core/models/match-summary';
import { Match } from '../../../core/models/tennis.model';
import { PlayerIndex, TournamentIndex } from '../../../core/models/tennis.model';
import { localUiPreviewAllowed } from '../../../core/helpers/local-ui-preview';
import { localPreviewMatchDetails, localPreviewPlayer, localPreviewTournament } from '../../../core/helpers/local-match-preview';
import { StaticArchivesService } from '../../../core/services/static-archives.service';
import { MatchDetailsModalComponent } from '../../../tennis/matches/match-details-modal/match-details-modal.component';
import { PlayerModalComponent } from '../../../tennis/players/player-modal/player-modal.component';
import { TournamentModalComponent } from '../../../tennis/tournaments/tournament-modal/tournament-modal.component';

export interface MatchEntityRequest {
    kind: 'match' | 'player' | 'tournament'; match: MatchSummary; side?: 1 | 2;
    preview?: boolean; playerIndex?: PlayerIndex | null; previewPlayers?: readonly PlayerIndex[];
}

/** The same guarded modals for any compact match grid; no second details implementation. */
@Component({ selector: 'app-match-entity-details', standalone: true,
    imports: [CommonModule, MatchDetailsModalComponent, PlayerModalComponent, TournamentModalComponent],
    template: `<app-match-details-modal *ngIf="kind === 'match'" [isOpen]="true" [match]="match" [matchTPId]="match.matchTPId" [previewDetails]="previewDetails"
      (closed)="closed.emit()" (requestLogin)="auth('openLogin')" (requestRegister)="auth('openRegister')" (requestUpgrade)="auth('openBilling')"></app-match-details-modal>
      <app-player-modal *ngIf="kind === 'player'" [isOpen]="true" [playerTPId]="playerId" [genderHint]="match.tournamentTypeName === 'WTA' ? 'W' : 'M'"
        [playerIndex]="player" [previewIndex]="preview ? player : null" (closed)="closed.emit()"></app-player-modal>
      <app-tournament-modal *ngIf="kind === 'tournament'" [tournament]="tournament" [preview]="preview" [strengthScale]="strengthScale"
        (closed)="closed.emit()" (showMatches)="showTournamentMatches($event)"></app-tournament-modal>` })
export class MatchEntityDetailsComponent implements OnChanges, OnDestroy {
    @Input() request!: MatchEntityRequest;
    @Output() closed = new EventEmitter<void>();
    @Output() authRequested = new EventEmitter<'openLogin' | 'openRegister' | 'openBilling'>();
    kind: MatchEntityRequest['kind'] | null = null;
    match!: Match; preview = false; previewDetails = null as ReturnType<typeof localPreviewMatchDetails>;
    player: PlayerIndex | null = null; playerId = 0; tournament: TournamentIndex | null = null;
    strengthScale: { min: number | null; median: number | null; max: number | null } | null = null;
    private lookup?: Subscription;
    constructor(private archives: StaticArchivesService, private router: Router) {}
    ngOnChanges(): void {
        this.lookup?.unsubscribe(); this.kind = null; this.player = null; this.tournament = null; this.strengthScale = null; this.previewDetails = null;
        const r = this.request;
        if (!r?.match) return;
        this.preview = r.preview === true && r.match.matchTPId < 0 && localUiPreviewAllowed(environment, typeof location === 'undefined' ? '' : location.hostname);
        if (!Number.isSafeInteger(r.match.matchTPId) || (!this.preview && r.match.matchTPId <= 0)) return;
        this.match = r.match as Match;
        if (r.kind === 'match') {
            if (this.preview) { this.previewDetails = localPreviewMatchDetails(this.match, r.previewPlayers); if (!this.previewDetails) return; }
            this.kind = 'match'; return;
        }
        if (r.kind === 'player') {
            const side = r.side === 2 ? 2 : 1, id = side === 1 ? this.match.player1TPId : this.match.player2TPId;
            if (!Number.isSafeInteger(id) || !id || (id < 0 && !this.preview)) return;
            this.playerId = id;
            this.player = r.playerIndex?.playerTPId === id ? r.playerIndex : this.preview ? localPreviewPlayer(this.match, side) :
                { playerTPId: id, playerName: (side === 1 ? this.match.player1Name : this.match.player2Name) || null,
                    countryISO2: side === 1 ? this.match.player1CountryISO2 : this.match.player2CountryISO2,
                    countryISO3: side === 1 ? this.match.player1CountryISO3 : this.match.player2CountryISO3,
                    countryFull: side === 1 ? this.match.player1CountryFull : this.match.player2CountryFull };
            this.kind = 'player';
            if (!this.preview && !r.playerIndex) this.lookup = this.archives.getPlayerIndexById(id).pipe(timeout(10000), catchError(() => of(null)))
                .subscribe(index => { if (index?.playerTPId === id) this.player = index; });
            return;
        }
        const id = this.match.tournamentEventTPId;
        if (!Number.isSafeInteger(id) || !id || (id < 0 && !this.preview)) return;
        this.tournament = this.preview ? localPreviewTournament(this.match) : { tournamentEventTPId: id,
            tournamentEventName: this.match.tournamentEventName || null, countryISO2: this.match.tournamentEventCountryISO2,
            countryISO3: this.match.tournamentEventCountryISO3, countryFull: this.match.tournamentEventCountryFull,
            tournamentTypeName: this.match.tournamentTypeName, surfaceName: this.match.surface, strengthMeanTS: this.match.tournamentStrengthMeanTS };
        this.kind = 'tournament';
        if (!this.preview) this.lookup = this.archives.getTournamentsIndex().pipe(timeout(10000), catchError(() => of({ items: [], strength: null }))).subscribe(data => {
            const index = data.items.find(row => row.tournamentEventTPId === id);
            if (index) this.tournament = index;
            this.strengthScale = data.strength;
        });
    }
    auth(action: 'openLogin' | 'openRegister' | 'openBilling'): void { this.closed.emit(); this.authRequested.emit(action); }
    showTournamentMatches(id: number): void { if (this.preview || !Number.isSafeInteger(id) || id <= 0) return; this.closed.emit(); void this.router.navigate(['/tournaments/matches', id]); }
    ngOnDestroy(): void { this.lookup?.unsubscribe(); }
}
