/* eslint-disable @angular-eslint/no-output-native */
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedSnackbarService } from '../../core/i18n/localized-snackbar.service';
import { authErrorKey } from '../../core/i18n/auth-error-key';
import { Component, OnInit, OnDestroy, ViewEncapsulation, Output, EventEmitter } from '@angular/core';
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
    AbstractControl,
    ValidationErrors
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '@env/environment';
import { AccessibleClickDirective } from '../../shared/directives/accessible-click.directive';
import { finalize } from 'rxjs/operators';
import { BbModalShellComponent } from '../../shared/ui/bb-modal-shell.component/bb-modal-shell.component';
import { CapsLockDirective } from '../../shared/directives/caps-lock.directive';
import { CapsLockHintComponent } from '../../shared/ui/caps-lock-hint/caps-lock-hint.component';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [
    TranslateModule,
        CommonModule,
        ReactiveFormsModule,
        MatSnackBarModule,
        AccessibleClickDirective,
        BbModalShellComponent,
        CapsLockDirective,
        CapsLockHintComponent
    ],
    templateUrl: './reset-password.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ResetPasswordComponent implements OnInit, OnDestroy {

  @Output() close = new EventEmitter<void>(); // Allows modal hosts to restore shell state.

    form: FormGroup;

    loading = false;
    submitted = false;

    token: string | null = null;

    successMessage = '';
    errorMessage = '';

    showPassword = false;
    showConfirm = false;

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private http: HttpClient,
        private snack: LocalizedSnackbarService,
        private router: Router
    ) {
        this.form = this.fb.group(
            {
                password: ['', Validators.required],
                confirm: ['', Validators.required],
            },
            { validators: passwordsMatchValidator }
        );
    }

    ngOnInit(): void {
        document.body.classList.add('modal-open');

        this.token = resetTokenFromFragment(this.route.snapshot.fragment);

        if (this.token) {
            window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
        } else {
            this.errorMessage = 'auth.resetMissing';
        }
    }

    ngOnDestroy(): void {
        document.body.classList.remove('modal-open');
    }

    onSubmit(): void {
        this.submitted = true;

        if (this.loading || this.form.invalid || !this.token) {
            return;
        }

        this.loading = true;
        this.errorMessage = '';
        this.successMessage = '';

        const { password } = this.form.value;

        this.http.post<{ message?: string }>(
            `${environment.apiUrl}/auth/reset-password`,
            {
                token: this.token,
                password
            }
        ).pipe(
            finalize(() => this.loading = false)
        ).subscribe({
            next: () => {
                this.successMessage = 'auth.resetSuccess';
                this.snack.open(this.successMessage, '', {
                    duration: 3000,
                    panelClass: 'success-snackbar'
                });

        // Brief delay lets the user see the success state before navigation.
                setTimeout(() => {
                    this.closeAndGoToLogin();
                }, 800);
            },
            error: (err) => {
                this.errorMessage = authErrorKey(err, 'reset');
                this.snack.open(this.errorMessage, '', {
                    duration: 4000,
                    panelClass: 'error-snackbar'
                });
            }
        });
    }

    closeAndGoToLogin(): void {
        document.body.classList.remove('modal-open');

    // Notify the parent when hosted as a modal.
        this.close.emit();

    // Standalone routes return to the home screen.
        this.router.navigateByUrl('/').then(() => {
            window.dispatchEvent(new CustomEvent('openLogin'));
        });
    }
}

/* ---------------- VALIDATOR ---------------- */

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const p = group.get('password')?.value;
    const c = group.get('confirm')?.value;
    return p && c && p === c ? null : { passwordsMismatch: true };
}

function resetTokenFromFragment(fragment: string | null): string | null {
    if (!fragment) return null;

    const params = new URLSearchParams(fragment.startsWith('?') ? fragment.slice(1) : fragment);
    return params.get('token');
}
