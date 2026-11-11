/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedSnackbarService } from '../../core/i18n/localized-snackbar.service';
import { authErrorKey } from '../../core/i18n/auth-error-key';
import { Component, EventEmitter, Output, ViewEncapsulation } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { openEmailVerification } from '../../core/services/email-verification.service';
import { AccessibleClickDirective } from '../../shared/directives/accessible-click.directive';
import { finalize, timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { BbModalShellComponent } from '@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component';
import { CapsLockDirective } from '../../shared/directives/caps-lock.directive';
import { CapsLockHintComponent } from '../../shared/ui/caps-lock-hint/caps-lock-hint.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    TranslateModule,
    CommonModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    RouterModule,
    AccessibleClickDirective,
    BbModalShellComponent,
    CapsLockDirective,
    CapsLockHintComponent
  ],
  templateUrl: './register.component.html',
  encapsulation: ViewEncapsulation.None
})
export class RegisterComponent {
  @Output() closed = new EventEmitter<void>();
  @Output() registered = new EventEmitter<string>();

  registerForm: FormGroup;
  submitting = false;

  showPassword = false;
  showConfirmPassword = false;

  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: LocalizedSnackbarService
  ) {
    this.registerForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        nickname: ['', [Validators.minLength(3), Validators.maxLength(30)]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordsMatchValidator }
    );
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.submitting = true;

    const { email, password, nickname } = this.registerForm.value;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedNickname = String(nickname || '').trim();

    this.authService
      .register({
        email: normalizedEmail,
        password,
        nickname: normalizedNickname ? normalizedNickname : undefined
      })
      .pipe(
        timeout(45000),
        catchError((err) => {
          if (err?.name === 'TimeoutError') {
            const msg = 'auth.registrationTimeout';

            this.successMessage = msg;

            this.snackBar.open(msg, 'auth.ok', {
              duration: 8000,
              horizontalPosition: 'right',
              verticalPosition: 'bottom',
              panelClass: 'success-snackbar'
            });

            this.registered.emit(normalizedEmail);
            this.submitting = false;

            return throwError(() => ({ handled: true }));
          }

          return throwError(() => err);
        }),
        finalize(() => {
          this.submitting = false;
        })
      )
      .subscribe({
        next: (res) => {
          if (res?.token && res?.user) {
            this.authService.applyLogin(res.token, res.user);
          }

          this.snackBar.open(res?.token && res?.user ? 'auth.registrationLoggedIn' : 'auth.registrationSuccess', 'auth.ok', {
            duration: 4000,
            horizontalPosition: 'right',
            verticalPosition: 'bottom',
            panelClass: 'success-snackbar'
          });

          this.registerForm.reset();
          this.registered.emit(normalizedEmail);

          this.close();

          window.dispatchEvent(new CustomEvent('authChanged'));
          this.router.navigate(['/']).then(() => {
            if (res?.token && res?.user && !res.user.isVerified) openEmailVerification({ email: normalizedEmail });
          });
        },
        error: (err) => {
          if (err?.handled) return;

          this.errorMessage = authErrorKey(err, 'registration');
        }
      });
  }

  close(): void {
    this.closed.emit();
  }

  get email() {
    return this.registerForm.get('email');
  }

  get nickname() {
    return this.registerForm.get('nickname');
  }

  get password() {
    return this.registerForm.get('password');
  }

  get confirmPassword() {
    return this.registerForm.get('confirmPassword');
  }
}

export const passwordsMatchValidator: ValidatorFn =
  (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    if (!password || !confirmPassword) return null;

    return password === confirmPassword
      ? null
      : { passwordsMismatch: true };
  };
