import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedSnackbarService } from '../../core/i18n/localized-snackbar.service';
import { authErrorKey } from '../../core/i18n/auth-error-key';
import { Component, EventEmitter, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { openEmailVerification } from '../../core/services/email-verification.service';
import { AccessibleClickDirective } from '../../shared/directives/accessible-click.directive';
import { ResetPasswordComponent } from '../reset-password/reset-password.component';
import { environment } from '@env/environment';
import { finalize } from 'rxjs';
import { BbModalShellComponent } from "@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component";
import { CapsLockDirective } from '../../shared/directives/caps-lock.directive';
import { CapsLockHintComponent } from '../../shared/ui/caps-lock-hint/caps-lock-hint.component';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [TranslateModule, CommonModule, ReactiveFormsModule, MatSnackBarModule, RouterModule, ResetPasswordComponent, BbModalShellComponent, AccessibleClickDirective, CapsLockDirective, CapsLockHintComponent],
    templateUrl: './login.component.html',
    encapsulation: ViewEncapsulation.None
})
export class LoginComponent implements OnInit {
    readonly billingLab = environment.billingLab;
    readonly closedBeta = 'closedBeta' in environment && environment.closedBeta === true;
    @Output() closed = new EventEmitter<void>();

    loginForm: FormGroup;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router,
        private snackBar: LocalizedSnackbarService
    ) {
        this.loginForm = this.fb.group({
    identifier: ['', Validators.required], // Accept either an email address or username.
            password: ['', Validators.required]
        });
    }

    ngOnInit() {
        console.log("✅ LoginComponent inicijaliziran!");
    }

    submitted = false;
    showPassword = false;
    successMessage = '';
    errorMessage = '';
    showResend = false;
    unverifiedUserId = '';
    showRegisterSuggestion = false;
    loginFailed = false;
    hide = true;
    showResetPasswordModal = false;
    submitting = false;
    serverErrorMessage = '';
    serverErrorCode: string | null = null;

    onLogin() {
        this.submitted = true;
        this.serverErrorMessage = '';
        this.serverErrorCode = null;

        if (this.loginForm.invalid || this.submitting) return;

        this.submitting = true;

        this.authService.login(this.loginForm.value).subscribe({
            next: (res) => {
          // Successful authentication.
                this.authService.applyLogin(res.token, res.user);
                this.snackBar.open('auth.loginSuccess', '', {
                    duration: 2500,
                    horizontalPosition: 'right',
                    verticalPosition: 'bottom',
                    panelClass: 'success-snackbar'
                });

                this.submitting = false;
                this.close();
                this.router.navigate(['/']);
            },
            error: (err) => {
                this.submitting = false;

          // The backend returns { status: 'error', code: '...', message: '...' }.
                const code = err?.error?.code;

                this.serverErrorCode = code ?? null;

                // Reset flagova
                this.showResend = false;
                this.loginFailed = false;
                this.showRegisterSuggestion = false;

          // Map stable backend codes to explicit UI states.
                switch (code) {
                    case 'EMAIL_NOT_VERIFIED':
                        if (err.error?.verificationTicket) {
                            this.close();
                            openEmailVerification({ email: err.error.email, verificationTicket: err.error.verificationTicket });
                            break;
                        }
                        this.serverErrorMessage = 'auth.emailUnverified';
                        this.showResend = true;
                        break;

                    case 'INVALID_CREDENTIALS':
                        this.serverErrorMessage = 'auth.invalidCredentials';
                        this.loginFailed = true;
              // Suggest registration only when the attempted identifier is an email address.
                        this.showRegisterSuggestion = true;
                        break;

                    case 'VALIDATION_ERROR':
                        this.serverErrorMessage = 'auth.loginRequired';
                        break;

                    default:
              // Keep an actionable fallback for server errors and unknown responses.
                        this.serverErrorMessage = authErrorKey(err, 'login');
                        break;
                }
            }
        });
    }

    get identifier() {
        return this.loginForm.get('identifier');
    }

    get password() {
        return this.loginForm.get('password');
    }

    close() {
        console.log('🔥 zatvaram modal');
        this.closed.emit();
    }

    loginWithGoogle() {
        // Open in the current tab; the backend redirects to FRONTEND_URL/oauth-success#token=...
        window.location.href = `${environment.apiUrl}/auth/google`;
    }

    loginWithFacebook() {
        window.location.href = `${environment.apiUrl}/auth/facebook`;
    }

    togglePassword() {
        this.showPassword = !this.showPassword;
    }

    get f() {
        return this.loginForm.controls;
    }

    switchToRegister(): void {
        this.close(); // emit 'closed' -> Header zatvara login modal
        window.dispatchEvent(new CustomEvent('switchToRegister')); // Header otvara register modal
    }

    resendVerification() {
        // Re-authenticate to obtain a verification-only session; email alone is not authority to send.
        this.onLogin();
    }

    onCloseResetModal() {
        this.showResetPasswordModal = false;
    }

    isSendingReset = false;

    openForgotPasswordModal() {
        if (this.isSendingReset) return;
        const email = (this.loginForm.value.identifier || '').trim();
        if (!email || Validators.email(new FormControl(email))) {
            this.snackBar.open('auth.recoveryEmail', '', {
                duration: 5000,
                panelClass: 'error-snackbar'
            });
            return;
        }

        this.isSendingReset = true;

        this.authService.sendResetPasswordEmail(email)
            .pipe(finalize(() => this.isSendingReset = false))
            .subscribe({
                next: () => {
                    this.snackBar.open('auth.resetRequested', '', {
                        duration: 5000,
                        panelClass: 'success-snackbar'
                    });
                    this.close();
                },
                error: (err) => {
                    this.snackBar.open(authErrorKey(err, 'recovery'), '', {
                        duration: 5000,
                        panelClass: 'error-snackbar'
                    });
                }
            });
    }
}
