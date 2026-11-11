import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedSnackbarService } from '../../core/i18n/localized-snackbar.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-oauth-success',
    standalone: true,
    imports: [TranslateModule, CommonModule, MatSnackBarModule],
    template: `
    <div class="bb-backdrop"></div>
    <div class="bb-modal"><h4>{{ 'auth.signingIn' | translate }}</h4></div>
  `
})
export class OauthSuccessComponent implements OnInit, OnDestroy {
    private request?: Subscription;
    constructor(
        private auth: AuthService,
        private router: Router,
        private snack: LocalizedSnackbarService,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        const token = takeOauthToken();
        const error = this.route.snapshot.queryParamMap.get('error');
        if (error) { this.failed(error); return; }
        if (!token) { this.router.navigateByUrl('/'); return; }
        this.request = this.auth.completeOAuth(token).subscribe({
            next: () => {
                this.snack.open('auth.loginSuccess', '', { duration: 2000, panelClass: 'success-snackbar' });
                this.router.navigateByUrl('/');
            },
            error: () => this.failed('oauth_failed'),
        });
    }
    private failed(error: string): void {
        const key = error === 'account_erasure_pending' ? 'auth.accountErasurePending'
            : error === 'oauth_cancelled' ? 'auth.oauthCancelled' : 'auth.oauthFailed';
        this.snack.open(key, 'auth.ok', { duration: 8000, panelClass: error === 'oauth_cancelled' ? 'info-snackbar' : 'error-snackbar' });
        this.router.navigateByUrl('/');
    }
    ngOnDestroy(): void { this.request?.unsubscribe(); }
}

function takeOauthToken(): string | null {
    const fragmentToken = oauthTokenFromFragment(window.location.hash);
    const storedToken = sessionStorage.getItem('BB_oauth_token');

    sessionStorage.removeItem('BB_oauth_token');
    window.history.replaceState(null, document.title, window.location.pathname);

    return fragmentToken || storedToken;
}

function oauthTokenFromFragment(hash: string): string | null {
    const fragment = hash.replace(/^#/, '');
    return fragment ? new URLSearchParams(fragment).get('token') : null;
}
