/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { filter, Subscription } from 'rxjs';

import { User } from './core/models/user.model';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { ReferralService } from './core/services/referral.service';
import { HeaderComponent } from './shared/ui/header/header.component';
import { FooterComponent } from './shared/ui/footer/footer.component';
import { UserModalComponent } from './user/user-modal/user-modal.component';
import { environment } from '../environments/environment';
import { TranslateModule } from '@ngx-translate/core';
import { ConsentedAnalyticsService } from './core/services/consented-analytics.service';
import { PopularityService } from './core/services/popularity.service';
import { PrivacyComponent } from './shared/ui/privacy/privacy.component';
import { AccountDeletionComponent } from './user/account-deletion/account-deletion.component';
import { savedDeletionReceipt } from './core/services/account-deletion.service';
import { PageTitleService } from './core/services/page-title.service';
import { ConnectivityNoticeComponent } from './shared/ui/connectivity-notice/connectivity-notice.component';
import { AppUpdateNoticeComponent } from './shared/ui/app-update-notice/app-update-notice.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        RouterModule,
        RouterOutlet,
        HeaderComponent,
        FooterComponent,
        UserModalComponent,
        PrivacyComponent,
        AccountDeletionComponent,
        ConnectivityNoticeComponent,
        AppUpdateNoticeComponent
    ],
    
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
    readonly billingLab = environment.billingLab;
    @ViewChild('aboutUsModal') aboutUsModal!: TemplateRef<unknown>;
    @ViewChild('contactUsModal') contactUsModal!: TemplateRef<unknown>;
    @ViewChild('mainContent', { static: true }) private mainContent?: ElementRef<HTMLElement>;

    showUserModal = false;
    showAccountDeletion = !!savedDeletionReceipt();
    showMatchFilterModal = false;
    showRegister = false;
    showLogin = false;
    user: User | null = null;

    private routerSub?: Subscription;

    constructor(
        private authService: AuthService,
        private router: Router,
        private modalService: NgbModal,
        private themeService: ThemeService,
        private referrals: ReferralService,
        private analytics: ConsentedAnalyticsService,
        private popularity: PopularityService,
        private pageTitles: PageTitleService
    ) { }

    ngOnInit(): void {
        this.pageTitles.start();
        if (!this.billingLab) this.referrals.start();
        this.authService.initAuth();
        this.popularity.start();

        // Before initial navigation router.url can still be '/' on an auth deep link.
        // Subscribe to choices now, but wait for the actual route before tracking it.
        this.analytics.start();
        if (this.router.navigated) this.analytics.page(this.router.url);
        // Only allowlisted section names may reach the consent-controlled analytics service.
        this.routerSub = this.router.events
            .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
            .subscribe(e => {
                this.analytics.page(e.urlAfterRedirects);
            });
    }

    ngOnDestroy(): void {
        this.pageTitles.stop();
        this.routerSub?.unsubscribe();
    }

    skipToContent(event: Event): void {
        // Keep the current route/hash and all remembered list positions intact.
        event.preventDefault();
        const main = this.mainContent?.nativeElement;
        if (!main?.isConnected) return;
        const document = main.ownerDocument;
        if (document.documentElement.classList.contains('bb-modal-active') || document.body.classList.contains('modal-open')) return;
        main.focus({ preventScroll: true });
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
        if (this.aboutUsModal) this.modalService.open(this.aboutUsModal, { centered: true, backdrop: 'static' });
    }
    openContactModal(): void {
        if (this.contactUsModal) this.modalService.open(this.contactUsModal, { centered: true, backdrop: 'static' });
    }

    openRegister() { this.showRegister = true; }
    openLogin() { this.showLogin = true; }

}

