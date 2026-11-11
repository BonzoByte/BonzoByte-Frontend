import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AccountDeletionService, DeletionState, savedDeletionReceipt, savedDeletionOwner } from '../../core/services/account-deletion.service';
import { AuthService } from '../../core/services/auth.service';
import { RegionalSettingsService } from '../../core/services/regional-settings.service';
import { membershipTier, savedTrialBalance } from '../../core/helpers/membership';
import { BbModalShellComponent } from '../../shared/ui/bb-modal-shell.component/bb-modal-shell.component';

@Component({ selector: 'app-account-deletion', standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, BbModalShellComponent],
    templateUrl: './account-deletion.component.html', styleUrls: ['./account-deletion.component.scss'] })
export class AccountDeletionComponent implements OnInit, OnDestroy {
    @Output() closed = new EventEmitter<void>();
    private readonly auth = inject(AuthService);
    readonly reasons = ['not_needed', 'hard_to_use', 'missing_features', 'privacy', 'other'];
    readonly user = this.auth.getUser();
    readonly actor = savedDeletionOwner() || this.user?._id;
    readonly membershipKey = 'membership.' + membershipTier(this.user);
    readonly balance = savedTrialBalance(this.user, this.auth.membershipNowMs());
    readonly expiry = this.user?.entitlements?.membershipEndsAt;
    available = false; busy = false; code = ''; challenge = ''; reason = ''; agreed = false;
    expiresAt = ''; resendAt = 0; countdown = 0; error = '';
    receipt = savedDeletionReceipt() || ''; state: DeletionState | 'uncertain' | 'form' = this.receipt ? 'uncertain' : 'form';
    private subscriptions = new Subscription(); private timer?: ReturnType<typeof setInterval>; private checks = 0;
    constructor(private api: AccountDeletionService,
        private translate: TranslateService, public regional: RegionalSettingsService) {}
    ngOnInit() {
        if (this.receipt) this.check();
        else this.subscriptions.add(this.api.config().subscribe({ next: result => {
            this.available = result.available; if (!this.available) this.error = 'accountDeletion.unavailable';
        }, error: () => this.error = 'accountDeletion.unavailable' }));
        this.timer = setInterval(() => {
            this.countdown = Math.max(0, Math.ceil((this.resendAt - Date.now()) / 1000));
            if (this.state === 'queued' && !this.busy && ++this.checks <= 12) this.check();
        }, 5000);
    }
    sendCode() {
        if (!this.available || this.busy || this.resendAt > Date.now()) return;
        this.busy = true; this.error = '';
        this.subscriptions.add(this.api.requestCode(this.translate.currentLang || this.translate.defaultLang || 'en').subscribe({
            next: result => { this.challenge = result.challenge; this.expiresAt = result.expiresAt;
                this.resendAt = Date.parse(result.resendAt); this.countdown = Math.max(0, Math.ceil((this.resendAt - Date.now()) / 1000));
                this.code = ''; this.busy = false; },
            error: error => { this.busy = false; this.showError(error); },
        }));
    }
    confirm() {
        if (!this.available || this.busy || !this.agreed || !/^\d{6}$/.test(this.code) || !this.challenge) return;
        this.busy = true; this.error = ''; this.receipt = this.api.newReceipt(); this.api.remember(this.receipt, this.actor);
        this.subscriptions.add(this.api.confirm({ code: this.code, challenge: this.challenge,
            confirm: true, reason: this.reason, receipt: this.receipt }).subscribe({
            next: result => { this.busy = false; this.applyState(result.state); },
            error: error => {
                this.busy = false;
                if (error.status >= 400 && error.status < 500 && error.status !== 401) {
                    this.api.forget(); this.receipt = ''; this.showError(error);
                } else { this.state = 'uncertain'; this.check(); }
            },
        }));
    }
    check() {
        if (!this.receipt || this.busy) return;
        this.busy = true; this.error = '';
        this.subscriptions.add(this.api.status(this.receipt).subscribe({ next: result => {
            this.busy = false;
            if (result.state === 'not_found') { this.state = 'uncertain'; this.error = 'accountDeletion.notFound'; }
            else this.applyState(result.state);
        }, error: () => { this.busy = false; this.error = 'accountDeletion.checkFailed'; } }));
    }
    private applyState(state: DeletionState) {
        this.state = state;
        if (state === 'not_found') return;
        // Do not call /logout with an already-revoked token or clear another user's session.
        const ownsSession = !!this.actor && this.auth.getUser()?._id === this.actor;
        if (ownsSession) this.auth.forceClearSession();
        try {
            if (ownsSession) for (const key of ['verifyToken', 'BB_oauth_token', 'bonzobyte.referral.pending.v1']) sessionStorage.removeItem(key);
            if (this.actor) localStorage.removeItem('bonzobyte.ads.hidden.v1.' + encodeURIComponent(this.actor));
        } catch { /* Server-side account revocation does not depend on browser storage. */ }
        this.code = ''; this.challenge = '';
    }
    private showError(error: any) {
        const key: Record<string, string> = { DELETION_CODE_INVALID: 'invalidCode', DELETION_CODE_EXPIRED: 'expired',
            DELETION_RATE_LIMIT: 'rateLimit', DELETION_MAIL_FAILED: 'mailFailed', DELETION_VERIFY_EMAIL: 'verifyEmail' };
        this.error = 'accountDeletion.' + (key[error?.error?.code] || 'unavailable');
    }
    close() { if (!this.busy) {
        if (this.state === 'complete' || this.state === 'app_erased' || this.error === 'accountDeletion.notFound') this.api.forget();
        this.closed.emit();
    } }
    ngOnDestroy() { clearInterval(this.timer); this.subscriptions.unsubscribe(); }
}
