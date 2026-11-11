/* eslint-disable @angular-eslint/no-empty-lifecycle-method */
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedSnackbarService } from '../../core/i18n/localized-snackbar.service';
import { authErrorKey } from '../../core/i18n/auth-error-key';
import { Component, OnInit, signal, OnDestroy, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '@env/environment';
import { BbModalShellComponent } from '../../shared/ui/bb-modal-shell.component/bb-modal-shell.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [TranslateModule, CommonModule, MatSnackBarModule, BbModalShellComponent],
  encapsulation: ViewEncapsulation.None,
  template: `
    <app-bb-modal-shell
      [title]="'auth.verifyTitle' | translate"
      [closeLabel]="'common.close' | translate"
      (closed)="goHome()"
    >
      <ng-container *ngIf="loading(); else resultTpl">
        <div class="bb-subtitle">{{ 'auth.verifying' | translate }}</div>
      </ng-container>

      <ng-template #resultTpl>
        <ng-container *ngIf="success(); else errorTpl">
          <div class="bb-alert bb-alert--success">
            {{ 'auth.verified' | translate }}
          </div>

          <div bbActions class="bb-actions">
            <button
              *ngIf="!isLoggedIn; else closeBtn"
              type="button"
              class="oauth-btn oauth-btn-primary"
              (click)="openLogin()"
            >
              {{ 'auth.goLogin' | translate }}
            </button>

            <ng-template #closeBtn>
              <button
                type="button"
                class="oauth-btn"
                (click)="goHome()"
              >
                {{ 'common.close' | translate }}
              </button>
            </ng-template>
          </div>
        </ng-container>

        <ng-template #errorTpl>
          <div class="bb-alert bb-alert--error">
            {{ (errorMessage() || 'auth.verifyFailed') | translate }}
          </div>

          <div bbActions class="bb-actions">
            <button
              type="button"
              class="oauth-btn oauth-btn-primary"
              (click)="goHome()"
            >
              {{ 'auth.goHome' | translate }}
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
    private snack: LocalizedSnackbarService,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {

    this.isLoggedIn = !!this.auth.getAccessToken();

    const token =
      this.route.snapshot.queryParamMap.get('token') ||
      this.readFromSearch() ||
      this.readFromHash() ||
      sessionStorage.getItem('verifyToken');

    if (!token) {
      this.loading.set(false);
      this.success.set(false);
      this.errorMessage.set('auth.verifyMissing');
      return;
    }

    sessionStorage.removeItem('verifyToken');
    // The fallback link is single-use, and must not remain in browser history.
    window.history.replaceState(window.history.state, '', window.location.pathname);

    this.http.post<{ message?: string }>(`${environment.apiUrl}/auth/verify-email`, { token }).subscribe({
      next: () => {
        this.success.set(true);
        this.snack.open('auth.verified', '', {
          duration: 3000,
          panelClass: 'success-snackbar'
        });
        sessionStorage.removeItem('verifyToken');
        // Registration may already have signed this tab in with unverified account data.
        this.auth.refreshMembership(true);
      },
      error: (err) => {
        const msg = authErrorKey(err, 'verify');
        this.loading.set(false);
        this.success.set(false);
        this.errorMessage.set(msg);
        this.snack.open(msg, '', {
          duration: 4000,
          panelClass: 'error-snackbar'
        });
      },
      complete: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    // The application shell now owns scroll locking.
    // document.body.classList.remove('modal-open');
  }

  private readFromSearch(): string | null {
    const qp = new URLSearchParams(window.location.search || '');
    return qp.get('token');
  }

  private readFromHash(): string | null {
    return new URLSearchParams((window.location.hash || '').replace(/^#\??/, '')).get('token');
  }

  goHome(): void {
    // The shell removes modal-open during its own ngOnDestroy lifecycle.
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
