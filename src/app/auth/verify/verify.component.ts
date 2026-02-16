/* eslint-disable @angular-eslint/no-empty-lifecycle-method */
import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, OnDestroy, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '@env/environment';
import { BbModalShellComponent } from '../../shared/ui/bb-modal-shell.component/bb-modal-shell.component';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, BbModalShellComponent],
  encapsulation: ViewEncapsulation.None,
  template: `
    <app-bb-modal-shell
      title="Email verification"
      (closed)="goHome()"
    >
      <ng-container *ngIf="loading(); else resultTpl">
        <div class="bb-subtitle">Verifying your email, please wait…</div>
      </ng-container>

      <ng-template #resultTpl>
        <ng-container *ngIf="success(); else errorTpl">
          <div class="bb-alert bb-alert--success">
            Your email has been verified. You can now log in.
          </div>

          <div bbActions class="bb-actions">
            <button
              *ngIf="!isLoggedIn; else closeBtn"
              type="button"
              class="oauth-btn oauth-btn-primary"
              (click)="openLogin()"
            >
              Go to login
            </button>

            <ng-template #closeBtn>
              <button
                type="button"
                class="oauth-btn"
                (click)="goHome()"
              >
                Close
              </button>
            </ng-template>
          </div>
        </ng-container>

        <ng-template #errorTpl>
          <div class="bb-alert bb-alert--error">
            {{ errorMessage() || 'Verification failed.' }}
          </div>

          <div bbActions class="bb-actions">
            <button
              type="button"
              class="oauth-btn oauth-btn-primary"
              (click)="goHome()"
            >
              Go home
            </button>
          </div>
        </ng-template>
      </ng-template>
    </app-bb-modal-shell>
  `
})
export class VerifyComponent implements OnInit, OnDestroy {
  loading = signal(true);
  success = signal(false);
  errorMessage = signal<string | null>(null);

  isLoggedIn = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private snack: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {

    this.isLoggedIn = !!localStorage.getItem('token');

    const token =
      this.route.snapshot.queryParamMap.get('token') ||
      this.readFromSearch() ||
      this.readFromHash() ||
      sessionStorage.getItem('verifyToken');

    if (!token) {
      this.loading.set(false);
      this.success.set(false);
      this.errorMessage.set('Missing verification token.');
      return;
    }

    this.http.post<{ message?: string }>(`${environment.apiUrl}/auth/verify-email`, { token }).subscribe({
      next: (res) => {
        this.success.set(true);
        this.snack.open(res?.message || 'Email verified!', '', { duration: 3000 });
        sessionStorage.removeItem('verifyToken');
      },
      error: (err) => {
        const msg = err?.error?.message || 'Verification failed.';
        this.success.set(false);
        this.errorMessage.set(msg);
        this.snack.open(msg, '', { duration: 4000 });
      },
      complete: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    // ✅ shell sada unlocka scroll, pa ovo više ne treba:
    // document.body.classList.remove('modal-open');
  }

  private readFromSearch(): string | null {
    const qp = new URLSearchParams(window.location.search || '');
    return qp.get('token');
  }

  private readFromHash(): string | null {
    const hash = window.location.hash || '';
    const i = hash.indexOf('?');
    if (i === -1) return null;
    const qp = new URLSearchParams(hash.substring(i));
    return qp.get('token');
  }

  goHome(): void {
    // ✅ shell će maknuti modal-open kroz ngOnDestroy; ne trebamo to ručno
    sessionStorage.removeItem('verifyToken');
    this.router.navigateByUrl('/');
  }

  openLogin(): void {
    if (this.isLoggedIn) {
      this.goHome();
      return;
    }

    this.router.navigateByUrl('/').then(() => {
      window.dispatchEvent(new CustomEvent('openLogin'));
    });
  }
}