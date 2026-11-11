import { CommonModule } from '@angular/common';
import { Component, effect } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CompetitionService } from '../core/services/competition.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { BbModalShellComponent } from '../shared/ui/bb-modal-shell.component/bb-modal-shell.component';

@Component({ selector: 'app-prediction-dialog', standalone: true,
    imports: [CommonModule, RouterModule, TranslateModule, BbModalShellComponent],
    template: `<app-bb-modal-shell *ngIf="service.selectedId() !== null" [title]="'competition.makePick' | translate"
        modalClass="bb-modal--prediction" [closeOnEsc]="!service.busy()" [closeDisabled]="service.busy()" (closed)="service.close(); side = null">
        <p class="competition-note">{{ 'competition.virtual' | translate }}</p>
        <p *ngIf="service.loading()" role="status">{{ 'common.loading' | translate }}</p>
        <p *ngIf="service.message()" role="alert">{{ service.message() | translate }}</p>
        <button *ngIf="service.message()" type="button" class="oauth-btn" (click)="reload()">{{ 'competition.refresh' | translate }}</button>
        <ng-container *ngIf="service.detail() as detail">
            <ng-container *ngIf="detail.quote as quote">
                <h5>{{ quote.snapshot.tournament }}</h5>
                <p>{{ 'competition.deadline' | translate }}: {{ regional.dateTime(quote.snapshot.lockAt, 'utc') }}</p>
                <div class="prediction-choices" role="group" [attr.aria-label]="'competition.winner' | translate">
                    <button *ngFor="let player of quote.snapshot.players; let i = index" type="button" class="prediction-choice"
                        [class.is-selected]="side === i" [attr.aria-pressed]="side === i" [disabled]="service.busy()"
                        (click)="side = i"><strong>{{ player.name }}</strong><span>{{ regional.number(quote.snapshot.odds[i], 2) }}</span></button>
                </div>
                <p>{{ 'competition.stake' | translate }}</p>
                <p class="competition-note">{{ 'competition.confirmNotice' | translate }}</p>
                <button type="button" class="oauth-btn oauth-btn-primary" [disabled]="side === null || service.busy()"
                    (click)="service.submit(side!)">{{ 'competition.confirm' | translate }}</button>
            </ng-container>
            <ng-container *ngIf="detail.pick as pick">
                <p *ngIf="service.accepted()" role="status" class="prediction-success">{{ 'competition.accepted' | translate }}</p>
                <h5>{{ pick.snapshot.players[pick.side].name }}</h5>
                <p>{{ 'competition.odds' | translate }}: {{ regional.number(pick.snapshot.odds[pick.side], 2) }} · {{ 'competition.stake' | translate }}</p>
                <p>{{ ('competition.' + (pick.settlement?.status || 'pending')) | translate }}</p>
                <p *ngIf="pick.settlement">{{ 'competition.units' | translate }}: {{ regional.number(pick.settlement.units, 2) }}</p>
            </ng-container>
            <p *ngIf="!detail.quote && !detail.pick">{{ ('competition.' + (detail.reason || 'sourceUnavailable')) | translate }}</p>
            <p *ngIf="detail.community as community">{{ 'competition.community' | translate:{a: community.counts[0], b: community.counts[1], total: community.total} }}</p>
        </ng-container>
        <div bbActions class="bb-modal-actions">
            <a routerLink="/predictions" (click)="service.close()">{{ 'competition.mine' | translate }}</a>
            <button type="button" class="oauth-btn" [disabled]="service.busy()" (click)="service.close(); side = null">{{ 'common.close' | translate }}</button>
        </div>
    </app-bb-modal-shell>
    <div *ngIf="service.busy()" class="bb-loading-overlay is-active" role="status" aria-live="polite">
        <div class="bb-loading-card"><div class="bb-spinner" aria-hidden="true"></div><div class="bb-loading-text">{{ 'competition.saving' | translate }}</div></div>
    </div>`,
    styles: [`.prediction-choices {display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0;}
      .prediction-choice {display:flex;flex-direction:column;gap:8px;padding:16px;border:1px solid var(--bb-border,#56616b);border-radius:10px;color:var(--bb-text);background:var(--bb-surface-2,#202b34);}
      .prediction-choice.is-selected {border-color:var(--bb-accent,#80d5ff);box-shadow:inset 0 0 0 1px var(--bb-accent,#80d5ff);}
      .competition-note {font-size:12px;color:var(--bb-text-muted);} .prediction-success {color:var(--bb-accent,#80d5ff);}
      .bb-modal-actions {display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:20px;}
      .bb-modal-actions a {color:var(--bb-accent,#80d5ff);}
      @media(max-width:420px){.prediction-choices{grid-template-columns:1fr;}}`] })
export class PredictionDialogComponent {
    side: number | null = null;
    constructor(public service: CompetitionService, public regional: RegionalSettingsService) {
        effect(() => { this.service.selectedId(); this.side = null; });
    }
    reload(): void { this.side = null; const id = this.service.selectedId(); if (id !== null) this.service.open(id); }
}
