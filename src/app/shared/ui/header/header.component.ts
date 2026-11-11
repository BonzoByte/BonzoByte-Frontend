import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, Subscription } from 'rxjs';
import { LoginComponent } from '../../../auth/login/login.component';
import { RegisterComponent } from '../../../auth/register/register.component';
import { VerificationCodeComponent } from '../../../auth/verification-code/verification-code.component';
import { VerificationContext } from '../../../core/services/email-verification.service';
import { BillingModalComponent } from '../../../billing/billing-modal/billing-modal.component';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { accountAllowsDemoAds } from '../../../core/helpers/demo-ad-layout';
import { membershipTier, membershipCountdown, TrialCountdown } from '../../../core/helpers/membership';
import { TimeZoneNoticePreferenceService } from '../../../core/services/time-zone-notice-preference.service';
import { environment } from '../../../../environments/environment';
import { FavouriteMatchesService } from '../../../core/services/favourite-matches.service';
import { PredictionDialogComponent } from '../../../competition/prediction-dialog.component';
import { DiscussionInboxComponent } from '../../../discussions/discussion-inbox.component';
import { DiscussionDialogComponent } from '../../../discussions/discussion-dialog.component';
import { PrivateMessagesHostComponent } from '../../../private-messages/private-messages-host.component';
import { AccountAvatarComponent } from '../account-avatar/account-avatar.component';
import { PrivateMessagesService } from '../../../core/services/private-messages.service';
import { RegionalSettingsService } from '../../../core/services/regional-settings.service';
import {
    ThemeService
} from '../../../core/services/theme.service';

@Component({
    selector: 'app-header',
    standalone: true,
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    imports: [
        CommonModule,
        RouterModule,
        TranslateModule,
        RegisterComponent,
        VerificationCodeComponent,
        LoginComponent,
        BillingModalComponent,
        PredictionDialogComponent,
        DiscussionInboxComponent,
        DiscussionDialogComponent,
        PrivateMessagesHostComponent,
        AccountAvatarComponent
    ]
})
export class HeaderComponent implements OnInit, OnDestroy {
    readonly billingLab = environment.billingLab;
    @Output() closed = new EventEmitter<void>();
    @Output() userModalOpened = new EventEmitter<void>();
    @ViewChild('languagePicker') private languagePicker?: ElementRef<HTMLDetailsElement>;

    @HostListener('document:click', ['$event'])
    closeLanguagePickerOnOutsideClick(event: MouseEvent): void {
        const picker = this.languagePicker?.nativeElement;
        if (picker?.open && !picker.contains(event.target as Node | null)) {
            picker.open = false;
        }
    }

    isLoggedIn = false;
    authSub!: Subscription;
    private userSub?: Subscription;
    private navigationSub?: Subscription;
    private trialTimer?: ReturnType<typeof setTimeout>;
    trialRemaining: TrialCountdown | null = null;
    private readonly refreshTrialOnFocus = () => this.updateTrialCountdown();
    showRegisterModal = false;
    showLoginModal = false;
    showBillingModal = false;
    verificationContext: VerificationContext | null = null;
    user: User | null = null;
    get hasAdFreeAccess(): boolean { return !!this.user && !accountAllowsDemoAds(this.user); }
    get accountTierKey(): string {
        return 'membership.' + membershipTier(this.user);
    }
    userNickname = '';
    userDisplayName = '';

    private switchToRegisterHandler = () => {
        this.showLoginModal = false;
        this.showRegisterModal = true;
    };

    private openLoginFromGlobal = () => {
        this.zone.run(() => {
            this.verificationContext = null;
            this.showRegisterModal = false;
            this.showLoginModal = true;
            document.body.classList.add('modal-open');
        });
    };

    private openRegisterFromGlobal = () => {
        this.zone.run(() => {
            this.verificationContext = null;
            this.showLoginModal = false;
            this.showRegisterModal = true;
            document.body.classList.add('modal-open');
        });
    };

    private openBillingFromGlobal = () => {
        console.log('[HEADER] openBilling event received');
        this.zone.run(() => {
            this.verificationContext = null;
            this.showLoginModal = false;
            this.showRegisterModal = false;
            this.showBillingModal = true;
            document.body.classList.add('modal-open');
        });
    };

    private openVerificationFromGlobal = (event: Event) => {
        this.zone.run(() => this.openVerification((event as CustomEvent<VerificationContext>).detail));
    };

    openVerification(context: VerificationContext = {}): void {
        this.showLoginModal = this.showRegisterModal = this.showBillingModal = false;
        this.verificationContext = { email: this.user?.email, ...context };
        document.body.classList.add('modal-open');
    }
    closeVerification(): void {
        this.verificationContext = null;
        document.body.classList.remove('modal-open');
    }

    constructor(
        private authService: AuthService,
        private router: Router,
        private zone: NgZone,
        private themeService: ThemeService,
        public translate: TranslateService,
        public regional: RegionalSettingsService,
        public timeZoneNoticePreference: TimeZoneNoticePreferenceService,
        public favourites: FavouriteMatchesService,
        public privateMessages: PrivateMessagesService
    ) { }

    ngOnInit(): void {
        this.favourites.start();
        this.navigationSub = this.router.events
            .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
            .subscribe((e) => {
                const path = e.urlAfterRedirects.split(/[?#]/)[0];
                if (path === '/login') this.openLoginModal();
                if (path === '/register') this.openRegisterModal();
            });

        this.authSub = this.authService.authStatus$.subscribe(status => {
            this.isLoggedIn = status;
            if (status) this.themeService.restoreStoredTheme();
            else this.themeService.useAnonymousDefault();
            this.user = status ? this.authService.getUser() : null;
            this.userNickname = this.user?.nickname || '';
            this.userDisplayName = this.user?.nickname || this.user?.name || '';
            this.updateTrialCountdown();
        });

        this.userSub = this.authService.user$.subscribe(user => {
            this.user = user;
            this.userDisplayName = user?.nickname || user?.name || '';
            this.updateTrialCountdown();
        });

        window.addEventListener('focus', this.refreshTrialOnFocus);
        window.addEventListener('openRegister', this.openRegisterFromGlobal);
        window.addEventListener('switchToRegister', this.switchToRegisterHandler);
        window.addEventListener('openLogin', this.openLoginFromGlobal);
        window.addEventListener('openBilling', this.openBillingFromGlobal);
        window.addEventListener('openVerification', this.openVerificationFromGlobal);
    }

    ngOnDestroy(): void {
        if (this.authSub) this.authSub.unsubscribe();
        this.userSub?.unsubscribe();
        this.navigationSub?.unsubscribe();
        clearTimeout(this.trialTimer);
        window.removeEventListener('focus', this.refreshTrialOnFocus);
        window.removeEventListener('openRegister', this.openRegisterFromGlobal);
        window.removeEventListener('switchToRegister', this.switchToRegisterHandler);
        window.removeEventListener('openLogin', this.openLoginFromGlobal);
        window.removeEventListener('openBilling', this.openBillingFromGlobal);
        window.removeEventListener('openVerification', this.openVerificationFromGlobal);
    }

    private updateTrialCountdown(): void {
        clearTimeout(this.trialTimer);
        this.trialRemaining = null;
        if (!this.isLoggedIn) return;
        const now = this.authService.membershipNowMs();
        this.trialRemaining = membershipCountdown(this.user, now);
        if (!this.trialRemaining) return;
        const remainingMs = Date.parse(this.trialRemaining.endsAt) - now;
        // Wake only when the displayed minute changes (or at expiry), not every second.
        const delay = remainingMs % 60_000 || 60_000;
        this.trialTimer = setTimeout(() => this.updateTrialCountdown(), delay);
    }

    openLoginModal(): void {
        this.verificationContext = null;
        this.showRegisterModal = false;
        this.showLoginModal = true;
        document.body.classList.add('modal-open');
    }
    closeLoginModal(): void {
        this.showLoginModal = false;
        if (!this.showRegisterModal) document.body.classList.remove('modal-open');
    }

    openRegisterModal(): void {
        this.verificationContext = null;
        this.showLoginModal = false;
        this.showRegisterModal = true;
        document.body.classList.add('modal-open');
    }

    closeRegisterModal(): void {
        this.showRegisterModal = false;
        if (!this.showLoginModal) document.body.classList.remove('modal-open');
    }

    openBillingModal(): void {
        this.openBillingFromGlobal();
    }

    closeBillingModal(): void {
        this.showBillingModal = false;
        if (!this.showLoginModal && !this.showRegisterModal) {
            document.body.classList.remove('modal-open');
        }
    }

    logout(): void { this.authService.logout(); }

    openUserModal() { this.userModalOpened.emit(); }

}
