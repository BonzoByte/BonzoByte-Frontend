import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
        private route: ActivatedRoute,
        private auth: AuthService,
        private router: Router,
        private snack: MatSnackBar
    ) { }

    ngOnInit(): void {
        const token = this.route.snapshot.queryParamMap.get('token');
        if (!token) { this.router.navigateByUrl('/'); return; }

        localStorage.setItem('token', token);
        this.auth.initAuth(true);            // dohvat /auth/me
        this.snack.open('Signed in!', '', { duration: 2000 });
        this.router.navigateByUrl('/');      // natrag na landing
    }
}
