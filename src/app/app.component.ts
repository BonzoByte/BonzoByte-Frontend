/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { filter, Subscription } from 'rxjs';

import { User } from './core/models/user.model';
import { AuthService } from './core/services/auth.service';
import { HeaderComponent } from './shared/ui/header/header.component';
import { FooterComponent } from './shared/ui/footer/footer.component';
import { UserModalComponent } from './user/user-modal/user-modal.component';

// GA typings – fallback safe
declare const gtag: undefined | ((...args: any[]) => void);

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        RouterOutlet,
        HeaderComponent,
        FooterComponent,
        UserModalComponent
    ],
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
    @ViewChild('aboutUsModal') aboutUsModal!: TemplateRef<unknown>;
    @ViewChild('contactUsModal') contactUsModal!: TemplateRef<unknown>;

    showUserModal = false;
    showMatchFilterModal = false;
    showRegister = false;
    showLogin = false;
    user: User | null = null;

    private routerSub?: Subscription;

    constructor(
        private authService: AuthService,
        private router: Router,
        private modalService: NgbModal
    ) { }

    ngOnInit(): void {
        // 1) OAuth callback: prihvati token iz URL-a, hidrira usera i očisti URL
        try {
            const url = new URL(window.location.href);
            const token = url.searchParams.get('token');
            if (token) {
                localStorage.setItem('token', token);
                this.authService.initAuth(true); // svježi /me
                url.searchParams.delete('token');
                const cleaned = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '');
                history.replaceState({}, '', cleaned);
            } else {
                this.authService.initAuth(); // cold start
            }
        } catch {
            // ako iz nekog razloga URL parsing pukne, nastavi bez toga
            this.authService.initAuth();
        }

        // 2) SPA Pageview za GA (s guardom)
        this.routerSub = this.router.events
            .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
            .subscribe(e => {
                if (typeof gtag === 'function') {
                    gtag('config', 'G-Z7VMGXTFFP', { page_path: e.urlAfterRedirects });
                }
            });
    }

    ngOnDestroy(): void {
        this.routerSub?.unsubscribe();
    }

    // === Header hooks ===
    onOpenUserModal(): void {
        this.showUserModal = true;
    }

    onUserUpdated(updatedUser: User): void {
        this.authService.setUser(updatedUser);
        this.user = updatedUser;
        this.showUserModal = false;
    }

    // === (opcionalno) Match filter modal kontrola ===
    openMatchFilterModal(): void {
        this.showMatchFilterModal = true;
    }
    closeMatchFilterModal(): void {
        this.showMatchFilterModal = false;
    }

    // === About / Contact (NgbModal templati) ===
    openAboutModal(): void {
        if (this.aboutUsModal) this.modalService.open(this.aboutUsModal, { centered: true });
    }
    openContactModal(): void {
        if (this.contactUsModal) this.modalService.open(this.contactUsModal, { centered: true });
    }

    openRegister() { this.showRegister = true; }
    openLogin() { this.showLogin = true; }

}