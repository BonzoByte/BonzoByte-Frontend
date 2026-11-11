import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { EmailVerificationService, VerificationContext, VerificationState } from '../../core/services/email-verification.service';
import { LocalizedSnackbarService } from '../../core/i18n/localized-snackbar.service';
import { BbModalShellComponent } from '../../shared/ui/bb-modal-shell.component/bb-modal-shell.component';

@Component({
    selector: 'app-verification-code', standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, BbModalShellComponent],
    template: `
      <app-bb-modal-shell [title]="'verification.title' | translate" [closeLabel]="'common.close' | translate"
          (closed)="closed.emit()" modalClass="bb-modal--verification">
        <section class="verification-content">
          <p>{{ 'verification.instructions' | translate }}</p>
          <strong class="verification-email">{{ state?.email || context.email }}</strong>
          <p *ngIf="loading" role="status">{{ 'common.loading' | translate }}</p>
          <form (ngSubmit)="verify()">
            <label for="verification-code">{{ 'verification.code' | translate }}</label>
            <input id="verification-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code"
              pattern="[0-9]{6}" maxlength="6" [ngModel]="code" (ngModelChange)="setCode($event)"
              [disabled]="busy || loading || sessionExpired" aria-describedby="verification-help" />
            <p id="verification-help" class="verification-help">
              {{ (remainingSeconds > 0 ? 'verification.expiresIn' : 'verification.expired') | translate:{time: countdown} }}
            </p>
            <button class="oauth-btn" type="submit" [disabled]="!canVerify">
              {{ (busy ? 'common.loading' : 'verification.confirm') | translate }}
            </button>
          </form>
          <p *ngIf="message" role="status">{{ message | translate:{count: state?.attemptsRemaining} }}</p>
          <p *ngIf="state?.delivery === 'failed' && message !== 'verification.mailFailed'" role="status">{{ 'verification.mailFailed' | translate }}</p>
          <button *ngIf="!sessionExpired" type="button" class="oauth-btn" [disabled]="busy || loading || cooldownSeconds > 0"
              (click)="resend()">{{ (cooldownSeconds > 0 ? 'verification.resendIn' : 'verification.resend') | translate:{seconds: cooldownSeconds} }}</button>
          <button *ngIf="sessionExpired" type="button" class="oauth-btn" (click)="login()">{{ 'login' | translate }}</button>
          <p class="verification-help">{{ 'verification.hint' | translate }}</p>
        </section>
      </app-bb-modal-shell>`,
    styles: [`
      .verification-content { display:grid; gap:10px; max-width:430px; margin:auto; }
      .verification-content p { margin:0; }
      .verification-email { overflow-wrap:anywhere; }
      form { display:grid; gap:8px; }
      input { box-sizing:border-box; width:100%; min-width:0; font-size:26px; text-align:center; letter-spacing:.3em; padding:10px; }
      .verification-help { font-size:12px; opacity:.8; }
    `],
})
export class VerificationCodeComponent implements OnInit, OnDestroy {
    @Input() context: VerificationContext = {};
    @Output() closed = new EventEmitter<void>();
    state: VerificationState | null = null;
    code = ''; message = ''; loading = true; busy = false; sessionExpired = false;
    remainingSeconds = 0; cooldownSeconds = 0;
    private serverOffset = 0;
    private timer?: ReturnType<typeof setInterval>;
    private requests = new Subscription();
    private accountId?: string;
    private finished = false;
    private refreshing = false;
    private onFocus = () => { if (!this.busy && !this.loading) this.loadStatus(); };
    constructor(private verification: EmailVerificationService, private auth: AuthService,
        private snack: LocalizedSnackbarService) {}

    ngOnInit(): void {
        this.accountId = this.auth.getUser()?._id;
        this.requests.add(this.auth.user$.subscribe(user => {
            if (user?._id !== this.accountId) { this.finished = true; this.closed.emit(); return; }
            if (user?.isVerified) this.complete();
        }));
        if (!this.finished) this.loadStatus();
        this.timer = setInterval(() => this.tick(), 1000);
        window.addEventListener('focus', this.onFocus);
    }
    ngOnDestroy(): void {
        this.finished = true;
        this.requests.unsubscribe(); clearInterval(this.timer);
        window.removeEventListener('focus', this.onFocus);
    }
    get countdown(): string { return `${Math.floor(this.remainingSeconds / 60)}:${String(this.remainingSeconds % 60).padStart(2, '0')}`; }
    get canVerify(): boolean { return !this.busy && !this.loading && !this.sessionExpired && /^\d{6}$/.test(this.code)
        && this.remainingSeconds > 0 && (this.state?.attemptsRemaining ?? 0) > 0; }
    setCode(value: string): void { this.code = value.replace(/\D/g, '').slice(0, 6); }
    private tick(): void {
        const now = Date.now() + this.serverOffset;
        this.remainingSeconds = Math.max(0, Math.ceil((Date.parse(this.state?.expiresAt ?? '') - now) / 1000)) || 0;
        this.cooldownSeconds = Math.max(0, Math.ceil((Date.parse(this.state?.resendAt ?? '') - now) / 1000)) || 0;
    }
    private accept(state: VerificationState): void {
        if (this.finished) return;
        this.state = state;
        const serverTime = Date.parse(state.serverNow);
        if (Number.isFinite(serverTime)) this.serverOffset = serverTime - Date.now();
        this.tick();
        if (state.verified) this.complete();
    }
    private loadStatus(): void {
        if (this.finished || this.refreshing || this.sessionExpired) return;
        this.refreshing = true;
        this.requests.add(this.verification.status(this.context).pipe(finalize(() => { this.loading = false; this.refreshing = false; }))
            .subscribe({ next: state => this.accept(state), error: error => this.fail(error) }));
    }
    resend(): void {
        if (this.busy || this.loading || this.cooldownSeconds || this.sessionExpired) return;
        this.busy = true; this.message = ''; this.code = '';
        this.requests.add(this.verification.resend(this.context).pipe(finalize(() => this.busy = false)).subscribe({
            next: state => { this.message = 'verification.sent'; this.accept(state); }, error: error => this.fail(error),
        }));
    }
    verify(): void {
        if (!this.canVerify) return;
        this.busy = true; this.message = '';
        this.requests.add(this.verification.verify(this.context, this.code).pipe(finalize(() => this.busy = false)).subscribe({
            next: result => {
                if (this.finished) return;
                if (result.token && result.user) {
                    // Subscribe above must not interpret completion of this login as an unrelated account switch.
                    this.accountId = result.user._id;
                    this.auth.applyLogin(result.token, result.user);
                }
                this.complete();
            }, error: error => this.fail(error),
        }));
    }
    private fail(error: { status?: number; error?: { code?: string; verification?: VerificationState } }): void {
        if (this.finished) return;
        if (error.error?.verification) this.accept(error.error.verification);
        const code = error.error?.code;
        this.sessionExpired = error.status === 401 || code === 'VERIFICATION_SESSION_EXPIRED';
        this.message = this.sessionExpired ? 'verification.sessionExpired'
            : code === 'VERIFICATION_INVALID_CODE' ? 'verification.invalid'
            : code === 'VERIFICATION_EXPIRED' ? 'verification.expired'
            : code === 'VERIFICATION_ATTEMPTS_EXHAUSTED' ? 'verification.exhausted'
            : code === 'VERIFICATION_RATE_LIMIT' || error.status === 429 ? 'verification.rateLimit'
            : code === 'VERIFICATION_MAIL_FAILED' ? 'verification.mailFailed' : 'verification.unavailable';
    }
    private complete(): void {
        if (this.finished) return;
        this.finished = true;
        this.auth.refreshMembership(true);
        this.snack.open('auth.verified', '', { duration: 4000, panelClass: 'success-snackbar' });
        this.closed.emit();
    }
    login(): void { this.closed.emit(); window.dispatchEvent(new CustomEvent('openLogin')); }
}
