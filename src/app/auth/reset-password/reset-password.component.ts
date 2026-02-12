/* eslint-disable @angular-eslint/no-output-native */
import { CommonModule } from '@angular/common';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '@env/environment';
import { AccessibleClickDirective } from '../../shared/directives/accessible-click.directive';
import { TrapFocusDirective } from '../../shared/directives/trap-focus.directive';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatSnackBarModule,
        AccessibleClickDirective,
        TrapFocusDirective
    ],
    templateUrl: './reset-password.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ResetPasswordComponent implements OnInit, OnDestroy {

    @Output() close = new EventEmitter<void>(); // 🔑 KLJUČNO

    form: FormGroup;

    loading = false;
    submitted = false;

    token: string | null = null;
    email: string | null = null;

    successMessage = '';
    errorMessage = '';

    showPassword = false;
    showConfirm = false;

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private http: HttpClient,
        private snack: MatSnackBar,
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

        const qp = this.route.snapshot.queryParamMap;
        this.token = qp.get('token');
        this.email = qp.get('email');

        // fallbackovi (hash / sessionStorage)
        if (!this.token) this.token = sessionStorage.getItem('BB_reset_token');
        if (!this.email) this.email = sessionStorage.getItem('BB_reset_email');

        if (!this.token || !this.email) {
            this.errorMessage = 'Invalid or missing reset link.';
        }
    }

    ngOnDestroy(): void {
        document.body.classList.remove('modal-open');
    }

    onSubmit(): void {
        this.submitted = true;

        if (this.loading || this.form.invalid || !this.token || !this.email) {
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
                email: this.email,
                password
            }
        ).pipe(
            finalize(() => this.loading = false)
        ).subscribe({
            next: (res) => {
                this.successMessage = res?.message || 'Password successfully changed.';
                this.snack.open(this.successMessage, '', { duration: 3000 });

                // ⏱️ kratki delay radi UX-a
                setTimeout(() => {
                    this.closeAndGoToLogin();
                }, 800);
            },
            error: (err) => {
                this.errorMessage = err?.error?.message || 'Error resetting password.';
                this.snack.open(this.errorMessage, '', { duration: 4000 });
            }
        });
    }

    closeAndGoToLogin(): void {
        document.body.classList.remove('modal-open');

        // ako je otvoreno kao modal
        this.close.emit();

        // ako je standalone ruta
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