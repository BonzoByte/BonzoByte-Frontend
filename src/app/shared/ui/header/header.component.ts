import { CommonModule } from '@angular/common';
import { Component, EventEmitter, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter, Subscription } from 'rxjs';
import { LoginComponent } from '../../../auth/login/login.component';
import { RegisterComponent } from '../../../auth/register/register.component';
import { BillingModalComponent } from '../../../billing/billing-modal/billing-modal.component';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';

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
        LoginComponent,
        BillingModalComponent
    ]
})
export class HeaderComponent implements OnInit, OnDestroy {
    @Output() closed = new EventEmitter<void>();
    @Output() userModalOpened = new EventEmitter<void>();

    isLoggedIn = false;
    authSub!: Subscription;
    showRegisterModal = false;
    showLoginModal = false;
    showBillingModal = false;
    user: User | null = null;
    userNickname = '';
    userDisplayName = '';

    private switchToRegisterHandler = () => {
        this.showLoginModal = false;
        this.showRegisterModal = true;
    };

    private openLoginFromGlobal = () => {
        this.zone.run(() => {
            this.showRegisterModal = false;
            this.showLoginModal = true;
            document.body.classList.add('modal-open');
        });
    };

    private openRegisterFromGlobal = () => {
        this.zone.run(() => {
            this.showLoginModal = false;
            this.showRegisterModal = true;
            document.body.classList.add('modal-open');
        });
    };

    private openBillingFromGlobal = () => {
        console.log('[HEADER] openBilling event received');
        this.zone.run(() => {
            this.showLoginModal = false;
            this.showRegisterModal = false;
            this.showBillingModal = true;
            document.body.classList.add('modal-open');
        });
    };

    constructor(
        private authService: AuthService,
        private router: Router,
        private zone: NgZone
    ) { }

    ngOnInit(): void {
        window.addEventListener('openBilling', () => console.log('[WINDOW] openBilling fired'));
        this.router.events
            .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
            .subscribe((e) => {
                if (e.url === '/login') this.openLoginModal();
                if (e.url === '/register') this.openRegisterModal();
            });

        this.authSub = this.authService.authStatus$.subscribe(status => {
            this.isLoggedIn = status;
            this.user = status ? this.authService.getUser() : null;
            this.userNickname = this.user?.nickname || '';
            this.userDisplayName = this.user?.nickname || this.user?.name || 'User';
        });

        this.authService.user$.subscribe(user => {
            this.user = user;
            this.userDisplayName = user?.nickname || user?.name || 'User';
        });

        window.addEventListener('openRegister', this.openRegisterFromGlobal);
        window.addEventListener('switchToRegister', this.switchToRegisterHandler);
        window.addEventListener('openLogin', this.openLoginFromGlobal);
        window.addEventListener('openBilling', this.openBillingFromGlobal);
    }

    ngOnDestroy(): void {
        if (this.authSub) this.authSub.unsubscribe();
        window.removeEventListener('openRegister', this.openRegisterFromGlobal);
        window.removeEventListener('switchToRegister', this.switchToRegisterHandler);
        window.removeEventListener('openLogin', this.openLoginFromGlobal);
        window.removeEventListener('openBilling', this.openBillingFromGlobal);
    }

    openLoginModal(): void {
        this.showRegisterModal = false;
        this.showLoginModal = true;
        document.body.classList.add('modal-open');
    }
    closeLoginModal(): void {
        this.showLoginModal = false;
        if (!this.showRegisterModal) document.body.classList.remove('modal-open');
    }

    openRegisterModal(): void {
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