import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-oauth-success',
    standalone: true,
    imports: [CommonModule, MatSnackBarModule],
    template: `
    <div class="bb-backdrop"></div>
    <div class="bb-modal"><h4>Signing you in…</h4></div>
  `
})
export class OauthSuccessComponent implements OnInit {
    constructor(
        private auth: AuthService,
        private router: Router,
        private snack: MatSnackBar
    ) { }

    ngOnInit(): void {
        const token = takeOauthToken();
        if (!token) { this.router.navigateByUrl('/'); return; }

        localStorage.setItem('token', token);
        this.auth.initAuth(true);
        this.snack.open('Signed in!', '', { duration: 2000 });
        this.router.navigateByUrl('/');
    }
}

function takeOauthToken(): string | null {
    const fragmentToken = oauthTokenFromFragment(window.location.hash);
    const storedToken = sessionStorage.getItem('BB_oauth_token');

    sessionStorage.removeItem('BB_oauth_token');
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);

    return fragmentToken || storedToken;
}

function oauthTokenFromFragment(hash: string): string | null {
    const fragment = hash.replace(/^#/, '');
    return fragment ? new URLSearchParams(fragment).get('token') : null;
}
