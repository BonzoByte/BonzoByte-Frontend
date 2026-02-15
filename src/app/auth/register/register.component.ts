/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { AccessibleClickDirective } from '../../shared/directives/accessible-click.directive';
import { TrapFocusDirective } from '../../shared/directives/trap-focus.directive';
import { finalize, timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    RouterModule,
    TrapFocusDirective,
    AccessibleClickDirective
  ],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  @Output() closed = new EventEmitter<void>();
  @Output() registered = new EventEmitter<string>(); // email

  registerForm: FormGroup;
  submitting = false;

  showPassword = false;
  showConfirmPassword = false;

  // ✅ inline messages (u modalu)
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
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
        // ✅ UX safety: ne čekamo beskonačno (SMTP na backendu može visiti)
        timeout(15000),

        catchError((err) => {
          // Ako timeoutamo, vrlo je moguće da je user kreiran,
          // ali backend čeka mail timeout.
          if (err?.name === 'TimeoutError') {
            const msg =
              'Registration was submitted, but the server is taking too long (email service). ' +
              'Please check your email in a minute. If nothing arrives, use "Resend verification".';

            // tretiramo kao “soft success” za UX
            this.successMessage = msg;

            this.snackBar.open(msg, 'OK', {
              duration: 8000,
              horizontalPosition: 'right',
              verticalPosition: 'bottom'
            });

            // možemo emitati email da parent odmah ponudi “Resend”
            this.registered.emit(normalizedEmail);

            // reset UI state
            this.submitting = false;

            // ✅ ne bacamo dalje error jer smo ga “handled”
            return throwError(() => ({ handled: true }));
          }

          return throwError(() => err);
        }),

        finalize(() => {
          // ako smo već ručno setali submitting=false u timeout grani,
          // ovaj finalize će to samo ponovno postaviti na false (OK)
          this.submitting = false;
        })
      )
      .subscribe({
        next: (res: any) => {
          // ✅ auto-login (backend vraća token + user)
          if (res?.token && res?.user) {
            localStorage.setItem('token', res.token);
            this.authService.setAuthState(true);
            this.authService.setUser(res.user);
          }

          this.snackBar.open('Registration successful. Logged in.', 'OK', {
            duration: 4000,
            horizontalPosition: 'right',
            verticalPosition: 'bottom'
          });

          this.registerForm.reset();
          this.registered.emit(normalizedEmail);

          // ✅ zatvori modal
          this.close();

          // ✅ opcionalno: refresh grid (ako ti treba odmah)
          window.dispatchEvent(new CustomEvent('authChanged'));
          this.router.navigate(['/']);
        },
        error: (err) => {
          // timeout “handled”
          if (err?.handled) return;

          const code = err?.error?.code;

          const backendMsg =
            typeof err?.error === 'string'
              ? err.error
              : (err?.error?.message || '');

          let message = 'Registration failed. Please try again.';

          switch (code) {
            case 'EMAIL_ALREADY_EXISTS':
              message = 'This email is already registered.';
              break;
            case 'NICKNAME_ALREADY_EXISTS':
              message = 'This nickname is already taken.';
              break;
            case 'VALIDATION_ERROR':
              message = 'Invalid registration data.';
              break;
            default:
              if (backendMsg) message = backendMsg;
              break;
          }

          this.errorMessage = message;
        }
      });
  }

  close(): void {
    this.closed.emit();
  }

  get email() { return this.registerForm.get('email'); }
  get nickname() { return this.registerForm.get('nickname'); }
  get password() { return this.registerForm.get('password'); }
  get confirmPassword() { return this.registerForm.get('confirmPassword'); }
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