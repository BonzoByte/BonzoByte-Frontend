import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, OnDestroy, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '@env/environment';
import { AccessibleClickDirective } from '../../shared/directives/accessible-click.directive';
import { TrapFocusDirective } from '../../shared/directives/trap-focus.directive';

@Component({
    selector: 'app-verify',
    standalone: true,
    imports: [CommonModule, MatSnackBarModule, AccessibleClickDirective, TrapFocusDirective],
    encapsulation: ViewEncapsulation.None,
    template: `
  <div class="bb-backdrop" appAccessibleClick (accessibleClick)="goHome()" aria-hidden="true">
    <div class="bb-modal"
         role="dialog" aria-modal="true" aria-labelledby="verify-title"
         appTrapFocus [onEscape]="goHome"
         (click)="$event.stopPropagation()">
      <button class="close-button" appAccessibleClick (accessibleClick)="goHome()" aria-label="Close">×</button>
      <h4 id="verify-title" style="margin-top:0">Email verification</h4>

      <ng-container *ngIf="loading(); else resultTpl">
        <p>Verifying your email, please wait…</p>
      </ng-container>

      <ng-template #resultTpl>
        <div *ngIf="success(); else errorTpl">
          <p class="success">Your email has been verified. You can now log in.</p>
          <div class="text-center" style="margin-top:12px">
            <button *ngIf="!isLoggedIn; else closeBtn" type="button" (click)="openLogin()">Go to login</button>
            <ng-template #closeBtn>
              <button type="button" (click)="goHome()">Close</button>
            </ng-template>
          </div>
        </div>

        <ng-template #errorTpl>
          <p class="error">{{ errorMessage() || 'Verification failed.' }}</p>
          <div class="text-center" style="margin-top:12px">
            <button type="button" (click)="goHome()">Go home</button>
          </div>
        </ng-template>
      </ng-template>
    </div>
  </div>
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
    ) { }

    ngOnInit(): void {
        // zabrani scroll dok je modal otvoren
        document.body.classList.add('modal-open');

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

        this.http.post<{ message?: string }>(`${environment.apiUrl}/auth/verify-email`, { token })
            .subscribe({
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
        document.body.classList.remove('modal-open');
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

    goHome() {
        document.body.classList.remove('modal-open');
        sessionStorage.removeItem('verifyToken');
        this.router.navigateByUrl('/');
    }

    openLogin() {
        if (this.isLoggedIn) { this.goHome(); return; }
        document.body.classList.remove('modal-open');
        this.router.navigateByUrl('/').then(() => {
            window.dispatchEvent(new CustomEvent('openLogin'));
        });
    }
}