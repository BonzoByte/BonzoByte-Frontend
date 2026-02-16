import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, finalize, map, switchMap, take, filter } from 'rxjs/operators';

import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { AccessibleClickDirective } from '../../shared/directives/accessible-click.directive';
import { BbModalShellComponent } from "@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component";

/** Async validator za nickname zauzetost */
function usernameAvailableValidator(auth: AuthService): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
        const value = (control.value || '').trim();
        if (!value) return of(null);

        const current = auth.getUser()?.nickname;
        if (current && value === current) return of(null);

        return of(value).pipe(
            debounceTime(300),
            switchMap(v => auth.checkNicknameExists(v)),
            map(exists => (exists ? { nicknameTaken: true } : null)),
            catchError(() => of(null))
        );
    };
}

@Component({
    selector: 'app-user-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule, BbModalShellComponent, AccessibleClickDirective],
    templateUrl: './user-modal.component.html',
    encapsulation: ViewEncapsulation.None
})
export class UserModalComponent implements OnInit, OnDestroy {
    @Output() closed = new EventEmitter<void>();
    @Output() updated = new EventEmitter<User>();

    userForm!: FormGroup;

    currentUser!: User;
    isLocalAccount = false;

    selectedFile: File | null = null;
    previewUrl: string | null = null;

    submitted = false;

    // banners
    successMessage = '';
    errorMessage = '';

    // states
    isSaving = false;
    isSendingReset = false;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        const u = this.authService.getUser();
        if (!u) {
            // fallback - ako se nekako otvori bez usera
            this.errorMessage = 'User is not loaded.';
            return;
        }

        this.currentUser = u;

        // local/manual account?
        this.isLocalAccount = this.currentUser?.createdVia
            ? this.currentUser.createdVia === 'manual'
            : !this.currentUser?.googleId && !this.currentUser?.facebookId;

        this.userForm = this.fb.group({
            email: [{ value: this.currentUser.email || '', disabled: true }],
            nickname: this.fb.control(
                this.currentUser.nickname || '',
                {
                    validators: [Validators.minLength(3), Validators.maxLength(20)],
                    asyncValidators: [usernameAvailableValidator(this.authService)],
                    updateOn: 'blur'
                }
            )
        });

        this.previewUrl = this.currentUser.avatarUrl || null;

        // 🔒 zabrani scroll pozadine dok je modal otvoren
        document.body.classList.add('modal-open');
    }

    ngOnDestroy(): void {
        document.body.classList.remove('modal-open');
    }

    close(): void {
        document.body.classList.remove('modal-open');
        this.closed.emit();
    }

    // --------
    // Save
    // --------
    onSubmit(): void {
        this.submitted = true;
        this.successMessage = '';
        this.errorMessage = '';

        if (this.isSaving) return;

        const nicknameCtrl = this.userForm.get('nickname');

        // Trim nickname bez triggeranja valueChanges
        if (nicknameCtrl && typeof nicknameCtrl.value === 'string') {
            const raw = nicknameCtrl.value as string;
            const trimmed = raw.trim();
            if (trimmed !== raw) nicknameCtrl.setValue(trimmed, { emitEvent: false });
        }

        // Force run validators once
        this.userForm.markAllAsTouched();
        this.userForm.updateValueAndValidity({ onlySelf: false, emitEvent: false });

        // Ako je pending (async validator), pričekaj jednom pa nastavi
        if (this.userForm.pending) {
            this.userForm.statusChanges
                .pipe(filter(s => s !== 'PENDING'), take(1))
                .subscribe(() => this.onSubmit());
            return;
        }

        if (this.userForm.invalid) {
            this.errorMessage = 'Please fix validation errors before saving.';
            return;
        }

        const formData = new FormData();
        formData.append('nickname', this.userForm.get('nickname')?.value || '');
        if (this.selectedFile) formData.append('avatar', this.selectedFile);

        this.isSaving = true;

        this.authService.updateUser(formData)
            .pipe(finalize(() => (this.isSaving = false)))
            .subscribe({
                next: (user) => {
                    this.currentUser = user;
                    this.previewUrl = user.avatarUrl || this.previewUrl;

                    this.successMessage = 'Saved.';
                    this.errorMessage = '';

                    // form is now pristine again
                    this.userForm.markAsPristine();
                    this.selectedFile = null;

                    // notify parent (i eventualno zatvaranje modala)
                    this.updated.emit(user);

                    // optional: mali snack
                    this.snackBar.open('Saved', '', { duration: 2000, horizontalPosition: 'right', verticalPosition: 'bottom' });
                },
                error: (err) => {
                    const msg =
                        err?.error?.message ||
                        (err?.status === 0 ? 'Cannot reach API (network/CORS).' : '') ||
                        'Update failed.';
                    this.errorMessage = msg;
                }
            });
    }

    // --------
    // Avatar
    // --------
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const f = input.files[0];
        const okTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (f.size > 2 * 1024 * 1024) {
            this.errorMessage = 'Datoteka je prevelika (max 2MB).';
            this.selectedFile = null;
            input.value = '';
            return;
        }

        if (!okTypes.includes(f.type)) {
            this.errorMessage = 'Dozvoljeni formati: JPG, PNG, WebP.';
            this.selectedFile = null;
            input.value = '';
            return;
        }

        this.errorMessage = '';
        this.successMessage = '';

        this.selectedFile = f;

        const reader = new FileReader();
        reader.onload = () => {
            this.previewUrl = reader.result as string;
        };
        reader.readAsDataURL(f);

        // enable Save
        this.userForm.markAsDirty();
    }

    onAvatarError(event: Event) {
        (event.target as HTMLImageElement).src = 'assets/images/defaultUser.png';
    }

    // --------
    // Password reset (local accounts)
    // --------
    changePassword(): void {
        const email = this.currentUser?.email || this.userForm.get('email')?.value;
        if (!email || this.isSendingReset) return;

        this.isSendingReset = true;

        this.authService.sendResetPasswordEmail(email)
            .pipe(finalize(() => (this.isSendingReset = false)))
            .subscribe({
                next: () => {
                    this.snackBar.open('Reset link poslan na vaš email.', '', {
                        duration: 5000,
                        horizontalPosition: 'right',
                        verticalPosition: 'bottom',
                        panelClass: 'success-snackbar'
                    });
                },
                error: (err) => {
                    this.snackBar.open(err?.error?.message || 'Greška prilikom slanja linka za reset.', '', {
                        duration: 5000,
                        horizontalPosition: 'right',
                        verticalPosition: 'bottom',
                        panelClass: 'error-snackbar'
                    });
                }
            });
    }

    // Getters
    get nickname() { return this.userForm.get('nickname'); }
    get email() { return this.userForm.get('email'); }
}