import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, distinctUntilChanged, finalize, map } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { ReferralService, ReferralStatus } from '../core/services/referral.service';
import { openEmailVerification } from '../core/services/email-verification.service';

@Component({
    selector: 'app-referral-card', standalone: true, imports: [CommonModule, FormsModule, TranslateModule],
    template: `
      <section class="bb-referral-preview" aria-labelledby="referral-title">
        <div>
          <h3 id="referral-title">{{ 'membership.referralTitle' | translate }}</h3>
          <p>{{ 'referral.rules' | translate }}</p>
          <div class="bb-referral-balances" *ngIf="status">
            <p class="bb-referral-remaining" role="status">{{ 'referral.remaining' | translate:{count: status.remainingInvitations} }}</p>
            <p>{{ 'referral.rewards' | translate:{count: status.rewards} }}</p>
          </div>
          <p *ngIf="status">{{ 'referral.allowance' | translate:{limit: status.invitationLimit} }}</p>
        </div>
        <button *ngIf="!auth.getUser()" class="oauth-btn" type="button" (click)="loginRequested.emit()">{{ 'login' | translate }}</button>
        <div *ngIf="auth.getUser() && !auth.getUser()?.isVerified" class="bb-referral-verification">
          <p>{{ 'referral.verifyToInvite' | translate }}</p>
          <div class="bb-referral-verification-actions">
            <button type="button" class="oauth-btn" (click)="openVerification()">
              {{ 'verification.title' | translate }}
            </button>
            <button type="button" class="oauth-btn" (click)="checkVerification()">{{ 'referral.checkVerification' | translate }}</button>
          </div>
        </div>
        <form *ngIf="auth.getUser()?.isVerified" (ngSubmit)="send()" class="bb-referral-form" #inviteForm="ngForm">
          <p *ngIf="!status?.canInvite">{{ (status?.remainingInvitations === 0 ? 'referral.limit' : 'referral.unavailable') | translate }}</p>
          <label for="referral-email">{{ 'auth.email' | translate }}</label>
          <input id="referral-email" type="email" name="recipient" [(ngModel)]="email" required email maxlength="254"
            autocomplete="off" [disabled]="!status?.canInvite || busy" />
          <label class="bb-referral-consent"><input type="checkbox" name="consent" [(ngModel)]="consent"
            [disabled]="!status?.canInvite || busy" /><span>{{ 'referral.consent' | translate }}</span></label>
          <button class="oauth-btn" type="submit" [disabled]="!status?.canInvite || busy || !consent || inviteForm.invalid">
            {{ (busy ? 'common.loading' : 'referral.send') | translate }}
          </button>
        </form>
        <p *ngIf="message" role="status">{{ message | translate:{email: sentEmail} }}</p>
      </section>`,
})
export class ReferralCardComponent implements OnInit, OnDestroy {
    @Output() loginRequested = new EventEmitter<void>();
    @Output() invitationSent = new EventEmitter<string>();
    status: ReferralStatus | null = null;
    email = ''; consent = false; busy = false; message = '';
    sentEmail = '';
    private statusRequest?: Subscription;
    private requests = new Subscription();
    private accountId?: string;
    constructor(public auth: AuthService, private referrals: ReferralService) {}
    ngOnInit(): void {
        this.requests.add(this.auth.user$.pipe(
            map(user => ({ id: user?._id, verified: !!user?.isVerified })),
            distinctUntilChanged((a, b) => a.id === b.id && a.verified === b.verified),
        ).subscribe(account => {
            this.statusRequest?.unsubscribe();
            if (account.id !== this.accountId) {
                this.email = ''; this.consent = false; this.sentEmail = '';
            }
            this.accountId = account.id; this.status = null; this.message = '';
            if (account.id) this.refreshStatus();
        }));
    }
    checkVerification(): void { this.auth.refreshMembership(); }
    openVerification(): void { openEmailVerification({ email: this.auth.getUser()?.email }); }
    private refreshStatus(): void {
        this.statusRequest?.unsubscribe();
        const accountId = this.accountId;
        // Keep sending disabled until the authoritative post-request balance arrives.
        if (this.status) this.status = { ...this.status, canInvite: false };
        this.statusRequest = this.referrals.status().subscribe({
            next: status => {
                if (this.auth.getUser()?._id === accountId) this.status = status;
            },
            error: () => { if (!this.message) this.message = 'referral.unavailable'; },
        });
    }
    send(): void {
        if (this.auth.getUser()?._id !== this.accountId) { this.message = 'referral.verified'; return; }
        if (!this.auth.getUser()?.isVerified || !this.status?.canInvite || this.busy || !this.consent || !this.email.trim()) return;
        const accountId = this.accountId;
        const recipientEmail = this.email.trim().toLowerCase();
        this.busy = true; this.message = '';
        this.requests.add(this.referrals.invite(recipientEmail, this.consent).pipe(finalize(() => this.busy = false)).subscribe({
            next: result => {
                if (this.auth.getUser()?._id !== accountId) return;
                if (result.accepted && result.delivery === 'sent') {
                    this.sentEmail = result.recipientEmail || recipientEmail;
                    this.message = 'referral.sentTo'; this.email = ''; this.consent = false;
                    this.refreshStatus();
                    this.invitationSent.emit(this.sentEmail);
                    return;
                }
                this.message = result.delivery === 'duplicate' ? 'referral.duplicate' : 'referral.sent';
                this.refreshStatus();
            },
            error: error => {
                if (this.auth.getUser()?._id !== accountId) return;
                const code = error.error?.code;
                this.message = code === 'INVITATION_LIMIT' ? 'referral.limit'
                    : code === 'RECIPIENT_ALREADY_REGISTERED' ? 'auth.emailExists'
                    : code === 'SELF_REFERRAL' ? 'referral.self'
                    : code === 'VERIFICATION_REQUIRED' ? 'referral.verifyToInvite' : 'referral.failed';
                this.refreshStatus(); // Also handles a budget consumed in another tab or uncertain SMTP delivery.
            },
        }));
    }
    ngOnDestroy(): void { this.requests.unsubscribe(); this.statusRequest?.unsubscribe(); }
}
