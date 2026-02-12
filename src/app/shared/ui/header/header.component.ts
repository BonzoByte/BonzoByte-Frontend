import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Router, RouterLink, RouterModule, NavigationEnd } from '@angular/router';
import { NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LoginComponent } from '../../../auth/login/login.component';
import { RegisterComponent } from '../../../auth/register/register.component';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-header',
    standalone: true,
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    imports: [
        CommonModule,
        RegisterComponent,
        LoginComponent,
        RouterModule,
        RouterLink,
        NgbModalModule,
        TranslateModule
    ],
})
export class HeaderComponent implements OnInit, OnDestroy {
    @Output() closed = new EventEmitter<void>();
    @Output() userModalOpened = new EventEmitter<void>();

    isLoggedIn = false;
    authSub!: Subscription;
    showRegisterModal = false;
    showLoginModal = false;
    user: User | null = null;
    userNickname = '';
    userDisplayName = '';

    private switchToRegisterHandler = () => {
        this.showLoginModal = false;
        this.showRegisterModal = true;
    };

    private openLoginFromGlobal = () => {
        this.showRegisterModal = false;
        this.showLoginModal = true;
    };

    constructor(
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
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

        window.addEventListener('switchToRegister', this.switchToRegisterHandler);
        window.addEventListener('openLogin', this.openLoginFromGlobal);
    }

    ngOnDestroy(): void {
        if (this.authSub) this.authSub.unsubscribe();
        window.removeEventListener('switchToRegister', this.switchToRegisterHandler);
        window.removeEventListener('openLogin', this.openLoginFromGlobal);
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

    logout(): void { this.authService.logout(); }

    openUserModal() { this.userModalOpened.emit(); }
}