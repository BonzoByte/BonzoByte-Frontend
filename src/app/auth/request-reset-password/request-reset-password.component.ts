import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { BbModalShellComponent } from '../../shared/ui/bb-modal-shell.component/bb-modal-shell.component';

@Component({
    selector: 'app-request-reset-password',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, BbModalShellComponent],
    templateUrl: './request-reset-password.component.html'
})
export class RequestResetPasswordComponent implements OnInit, OnDestroy {
    emailForm: FormGroup;
    submitted = false;

    constructor(
        private fb: FormBuilder,
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private router: Router
    ) {
        this.emailForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]]
        });
    }

    ngOnInit(): void {
        document.body.classList.add('modal-open');
    }
    ngOnDestroy(): void {
        document.body.classList.remove('modal-open');
    }

    close() {
        document.body.classList.remove('modal-open');
        this.router.navigate(['/']); // Return to the application after confirmation.
    }

    requestReset() {
        this.submitted = true;
        if (this.emailForm.invalid) return;

        const { email } = this.emailForm.value;

    // Keep this endpoint aligned with the backend authentication contract.
        // npr. `${environment.apiUrl}/auth/request-password-reset`
        this.http.post(`${environment.apiUrl}/auth/request-password-reset`, { email }).subscribe({
            next: () => {
                this.snackBar.open('A password reset link was sent to your email.', '', {
                    duration: 4000,
                    horizontalPosition: 'right',
                    verticalPosition: 'bottom',
                    panelClass: 'success-snackbar'
                });
                this.close();
            },
            error: (err) => {
                this.snackBar.open(err.error?.message || 'Something went wrong.', '', {
                    duration: 4000,
                    panelClass: 'error-snackbar'
                });
            }
        });
    }
}
