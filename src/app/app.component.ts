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

// GA typings; keep the app safe when analytics is unavailable.
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
        this.authService.initAuth();

        // Send SPA pageviews without URL fragments so one-time tokens never reach analytics.
        this.routerSub = this.router.events
            .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
            .subscribe(e => {
                if (typeof gtag === 'function') {
                    gtag('config', 'G-Z7VMGXTFFP', { page_path: stripUrlFragment(e.urlAfterRedirects) });
                }
            });
    }

    ngOnDestroy(): void {
        this.routerSub?.unsubscribe();
    }

    // Header modal hooks
    onOpenUserModal(): void {
        this.showUserModal = true;
    }

    onUserUpdated(updatedUser: User): void {
        this.authService.setUser(updatedUser);
        this.user = updatedUser;
        this.showUserModal = false;
    }

    // Match filter modal hooks
    openMatchFilterModal(): void {
        this.showMatchFilterModal = true;
    }
    closeMatchFilterModal(): void {
        this.showMatchFilterModal = false;
    }

    // Template-backed NgbModal hooks
    openAboutModal(): void {
        if (this.aboutUsModal) this.modalService.open(this.aboutUsModal, { centered: true });
    }
    openContactModal(): void {
        if (this.contactUsModal) this.modalService.open(this.contactUsModal, { centered: true });
    }

    openRegister() { this.showRegister = true; }
    openLogin() { this.showLogin = true; }

}

function stripUrlFragment(url: string): string {
    return url.split('#', 1)[0];
}
