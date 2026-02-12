import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
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
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSnackBarModule,
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
    // reset poruka prije novog submit-a
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

    this.authService.register({
      email: normalizedEmail,
      password,
      nickname: normalizedNickname ? normalizedNickname : undefined
    })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.successMessage =
            'Registration successful. Please check your email to verify your account.';

          // ✅ success snackbar OK (ne smeta ako se zatvara modal)
          this.snackBar.open(this.successMessage, 'OK', {
            duration: 6000,
            horizontalPosition: 'right',
            verticalPosition: 'bottom'
          });

          this.registerForm.reset();
          this.registered.emit(normalizedEmail);

          // ako želiš da ostane otvoren da user pročita poruku, zakomentiraj close()
          this.close();
        },
        error: (err) => {
          const code = err?.error?.code;

          // fallback ako backend vrati samo message/string
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

          // ✅ inline poruka u modalu (glavni cilj)
          this.errorMessage = message;

          // ✅ opcionalno: fokus na error box (ako želiš)
          // setTimeout(() => document.getElementById('register-error')?.focus(), 0);

          // ❌ ne pokazujemo snackbar za error (jer je “neprimjetan”)
          // this.snackBar.open(message, 'OK', { ... });
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