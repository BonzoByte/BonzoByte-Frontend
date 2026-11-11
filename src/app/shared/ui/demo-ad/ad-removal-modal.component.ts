import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { BbModalShellComponent } from '../bb-modal-shell.component/bb-modal-shell.component';

export type AdRemovalAction = 'openLogin' | 'openRegister' | 'openBilling';

@Component({
    selector: 'app-ad-removal-modal',
    standalone: true,
    imports: [CommonModule, TranslateModule, A11yModule, BbModalShellComponent],
    template: `
        <app-bb-modal-shell cdkTrapFocus [cdkTrapFocusAutoCapture]="true"
            [title]="'demoAds.remove' | translate" [closeLabel]="'common.close' | translate"
            modalClass="bb-modal--ad-removal" (closed)="closed.emit()">
            <p class="ad-removal-copy">{{ (signedIn ? 'demoAds.memberHint' : 'demoAds.signInHint') | translate }}</p>
            <div class="ad-removal-actions">
                <ng-container *ngIf="!signedIn; else member">
                    <button type="button" class="oauth-btn" (click)="action.emit('openLogin')">{{ 'login' | translate }}</button>
                    <button type="button" class="oauth-btn" (click)="action.emit('openRegister')">{{ 'register' | translate }}</button>
                </ng-container>
                <ng-template #member>
                    <button type="button" class="oauth-btn" (click)="action.emit('openBilling')">{{ 'profile.viewPricing' | translate }}</button>
                </ng-template>
                <button type="button" class="oauth-btn" (click)="closed.emit()">{{ 'common.cancel' | translate }}</button>
            </div>
        </app-bb-modal-shell>
    `,
    styles: [`
        .ad-removal-copy { line-height: 1.6; margin: 14px 0; }
        .ad-removal-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    `]
})
export class AdRemovalModalComponent {
    @Input() signedIn = false;
    @Output() closed = new EventEmitter<void>();
    @Output() action = new EventEmitter<AdRemovalAction>();
}
