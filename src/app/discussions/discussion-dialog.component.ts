import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, OnDestroy, Optional, ViewEncapsulation, effect, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { DiscussionsService } from '../core/services/discussions.service';
import { BbModalShellComponent } from '../shared/ui/bb-modal-shell.component/bb-modal-shell.component';
import { DiscussionThreadComponent } from './discussion-thread.component';
import { DiscussionMatchSummaryComponent } from './discussion-match-summary.component';
import { CopyMatchLinkComponent } from '../shared/ui/copy-match-link/copy-match-link.component';
import { DiscussionEntityTarget } from '../core/models/match-summary';
import { DiscussionEntityDialogComponent } from './discussion-entity-dialog.component';
import { DiscussionLoadingComponent } from './discussion-loading.component';

@Component({ selector: 'app-discussion-dialog', standalone: true,
    imports: [CommonModule, A11yModule, TranslateModule, BbModalShellComponent, DiscussionThreadComponent, DiscussionMatchSummaryComponent, CopyMatchLinkComponent, DiscussionEntityDialogComponent, DiscussionLoadingComponent],
    encapsulation: ViewEncapsulation.None,
    styles: [`app-discussion-dialog .bb-modal--discussion { width: min(680px, calc(100vw - 24px)); max-height: 90dvh; overflow: auto; padding-top:0; }
      app-discussion-dialog .bb-modal.bb-modal--discussion > .bb-modal-heading { display:block;position:sticky;top:0;z-index:4;
        margin:0 -18px 12px;padding:18px 48px 1px;background:var(--bb-surface-1); }
      app-discussion-dialog .bb-modal--discussion .bb-modal-heading .bb-modal-title { white-space:normal;overflow-wrap:anywhere; }
      app-discussion-dialog .bb-modal--discussion-loading { min-height:180px; }`],
    template: `<ng-container *ngIf="api.selected() as target"><app-bb-modal-shell *ngIf="!entity()" cdkTrapFocus [cdkTrapFocusAutoCapture]="true"
      [title]="'discussions.title' | translate"
      [closeLabel]="'common.close' | translate" modalClass="bb-modal--discussion" (closed)="api.selected.set(null)">
      <app-copy-match-link [matchTPId]="target.matchTPId" [matchId]="target.match?.matchId" view="discussion"></app-copy-match-link>
      <app-discussion-match-summary [target]="target" (entityRequested)="openEntity($event)"></app-discussion-match-summary>
      <app-discussion-thread [matchTPId]="target.matchTPId" [commentTarget]="target.comment ?? null" (requestLogin)="openLogin()"></app-discussion-thread>
    </app-bb-modal-shell>
      <ng-container *ngIf="entity() as info">
        @defer (on immediate) {
          <app-discussion-entity-dialog [target]="info" (closed)="entity.set(null)" (leave)="leaveDiscussion()"></app-discussion-entity-dialog>
        } @loading {
          <app-bb-modal-shell [title]="'discussions.title' | translate" modalClass="bb-modal--discussion-loading" [closeLabel]="'common.close' | translate" (closed)="entity.set(null)">
            <app-discussion-loading [label]="'common.loading' | translate"></app-discussion-loading>
          </app-bb-modal-shell>
        } @error {
          <app-bb-modal-shell [title]="'discussions.title' | translate" [closeLabel]="'common.close' | translate" (closed)="entity.set(null)">
            <p role="alert">{{ 'discussions.entityFailed' | translate }}</p>
            <button type="button" (click)="entity.set(null)">{{ 'discussions.backToDiscussion' | translate }}</button>
          </app-bb-modal-shell>
        }
      </ng-container>
    </ng-container>` })
export class DiscussionDialogComponent implements OnDestroy {
    readonly entity = signal<DiscussionEntityTarget | null>(null);
    private origin = '';
    private navigation?: Subscription;
    constructor(readonly api: DiscussionsService, @Optional() private router: Router | null = null) {
        effect(() => {
            const selected = this.api.selected(), entity = this.entity();
            if (entity && (!selected || selected.matchTPId !== entity.match.matchTPId)) this.entity.set(null);
        });
        this.navigation = this.router?.events.subscribe(event => {
            if (this.entity() && event instanceof NavigationEnd && event.urlAfterRedirects !== this.origin) this.leaveDiscussion();
        });
    }
    openEntity(entity: DiscussionEntityTarget): void {
        if (entity.match.matchTPId !== this.api.selected()?.matchTPId || !Number.isSafeInteger(entity.id) || entity.id <= 0) return;
        const expected = entity.kind === 'player' ? entity.side === 1 ? entity.match.player1TPId : entity.match.player2TPId : entity.match.tournamentEventTPId;
        if (expected !== entity.id) return;
        this.origin = this.router?.url || ''; this.entity.set(entity);
    }
    leaveDiscussion(): void { this.entity.set(null); this.api.selected.set(null); }
    openLogin(): void {
        // Hand focus to the existing login dialog instead of stacking two focus traps.
        this.api.selected.set(null);
        queueMicrotask(() => this.api.document.defaultView?.dispatchEvent(new CustomEvent('openLogin')));
    }
    ngOnDestroy(): void { this.navigation?.unsubscribe(); }
}
