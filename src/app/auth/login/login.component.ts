import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AccessibleClickDirective } from '../../shared/directives/accessible-click.directive';
import { ResetPasswordComponent } from '../reset-password/reset-password.component';
import { environment } from '@env/environment';
import { finalize } from 'rxjs';
import { BbModalShellComponent } from "@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component";

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule, RouterModule, ResetPasswordComponent, BbModalShellComponent, AccessibleClickDirective],
    templateUrl: './login.component.html',
    encapsulation: ViewEncapsulation.None
})
export class LoginComponent implements OnInit {
    @Output() closed = new EventEmitter<void>();

    loginForm: FormGroup;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router,
        private snackBar: MatSnackBar
    ) {
        this.loginForm = this.fb.group({
            identifier: ['', Validators.required], // samo required, bez email validacije
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
                // ✅ uspjeh
                this.authService.applyLogin(res.token, res.user);
                this.snackBar.open('Successful login', '', {
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

                // ✅ backend ti vraća {status:'error', code:'...', message:'...'}
                const code = err?.error?.code;
                const msg = err?.error?.message;

                this.serverErrorCode = code ?? null;

                // Reset flagova
                this.showResend = false;
                this.loginFailed = false;
                this.showRegisterSuggestion = false;

                // Mapiranje na UI ponašanje
                switch (code) {
                    case 'EMAIL_NOT_VERIFIED':
                        this.serverErrorMessage = msg || 'Please verify your email before logging in.';
                        this.showResend = true;
                        break;

                    case 'INVALID_CREDENTIALS':
                        this.serverErrorMessage = 'Invalid email/username or password.';
                        this.loginFailed = true;
                        // po želji: suggestion register samo kad pokušava s emailom
                        this.showRegisterSuggestion = true;
                        break;

                    case 'VALIDATION_ERROR':
                        this.serverErrorMessage = msg || 'Please enter identifier and password.';
                        break;

                    default:
                        // ako je server pukao (500) ili nešto nepredviđeno
                        this.serverErrorMessage = msg || 'Login failed. Please try again.';
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
        //console.log("slanje verifikacijskog linka sa frontenda");
        const email = this.loginForm.value.identifier;
        if (!email) {
            this.snackBar.open('Email not entered', '', { duration: 3000 });
            return;
        }

        this.authService.resendVerificationEmail(email).subscribe({
            next: () => {
                this.snackBar.open('Verification email sent', '', {
                    duration: 5000,
                    horizontalPosition: 'right',
                    verticalPosition: 'bottom',
                    panelClass: 'success-snackbar'
                });
                this.showResend = false;
                this.close();
            },
            error: () => {
                this.snackBar.open(this.errorMessage, '', {
                    duration: 5000,
                    horizontalPosition: 'right',
                    verticalPosition: 'bottom',
                    panelClass: 'error-snackbar'
                });
            }
        });
    }

    onCloseResetModal() {
        this.showResetPasswordModal = false;
    }

    isSendingReset = false;

    openForgotPasswordModal() {
        const email = this.loginForm.value.identifier;
        if (!email || this.isSendingReset) return;

        this.isSendingReset = true;

        this.authService.sendResetPasswordEmail(email)
            .pipe(finalize(() => this.isSendingReset = false))
            .subscribe({
                next: () => {
                    this.snackBar.open('Reset link sent to your email', '', { duration: 5000 });
                    this.close();
                },
                error: (err) => {
                    this.snackBar.open(err?.error?.message || 'Error sending reset link', '', { duration: 5000 });
                }
            });
    }
}
