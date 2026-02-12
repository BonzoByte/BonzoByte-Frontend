import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AccessibleClickDirective } from '../../../shared/directives/accessible-click.directive';
import { TrapFocusDirective } from '../../../shared/directives/trap-focus.directive';

@Component({
    selector: 'app-contact-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule, AccessibleClickDirective, TrapFocusDirective],
    templateUrl: './contact-modal.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ContactModalComponent implements OnInit, OnDestroy {
    @Output() closed = new EventEmitter<void>();

    form: FormGroup;
    submitting = false;
    submitted = false;

    constructor(
        private fb: FormBuilder,
        private snack: MatSnackBar,
        private http: HttpClient
    ) {
        this.form = this.fb.group({
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            message: ['', [Validators.required, Validators.minLength(10)]],
        });
    }

    ngOnInit(): void {
        document.body.classList.add('modal-open');
    }

    ngOnDestroy(): void {
        document.body.classList.remove('modal-open');
    }

    get name() { return this.form.get('name'); }
    get email() { return this.form.get('email'); }
    get message() { return this.form.get('message'); }

    close(): void {
        document.body.classList.remove('modal-open');
        this.closed.emit();
    }

    submit(): void {
        this.submitted = true;

        if (this.submitting) return;

        this.form.markAllAsTouched();
        if (this.form.invalid) return;

        this.submitting = true;

        this.http.post(`${environment.apiUrl}/auth/contact`, this.form.value)
            .pipe(finalize(() => (this.submitting = false)))
            .subscribe({
                next: () => {
                    this.snack.open('Message sent. Thanks!', '', { duration: 3000, panelClass: 'success-snackbar' });
                    this.form.reset();
                    this.submitted = false;
                    this.close();
                },
                error: (err) => {
                    this.snack.open(err?.error?.message || 'Failed to send message.', '', { duration: 4000, panelClass: 'error-snackbar' });
                }
            });
    }
}