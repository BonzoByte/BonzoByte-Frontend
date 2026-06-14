/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { User } from '../../core/models/user.model';
import {
    clearAuthStorage as clearStoredAuth,
    getAccessToken as readStoredAccessToken,
    setAccessToken as writeStoredAccessToken
} from '../auth-token-storage';

interface LoginResponse {
    token: string;
    user: User;
}

interface RegisterResponse {
    message: string;
    token?: string;
    user?: User;
}

// Normalize API payloads into the stricter frontend User model.
function normalizeUser(u: any): User {
    return {
        _id: u?._id ?? u?.id ?? '',
        name: u?.name ?? '',
        email: u?.email ?? '',
        nickname: u?.nickname ?? '',
        avatarUrl: u?.avatarUrl ?? null,
        isAdmin: !!u?.isAdmin,
        isUser: !!u?.isUser,
        isVerified: !!u?.isVerified,
        provider: Array.isArray(u?.provider) ? u.provider : [],
        entitlements: u?.entitlements ? {
            plan: u.entitlements.plan ?? 'free',
            isPremium: !!u.entitlements.isPremium,
            hasTrial: !!u.entitlements.hasTrial,
            trialEndsAt: u.entitlements.trialEndsAt ?? null,
            showAds: !!u.entitlements.showAds,
        } : undefined,
    };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private _user$ = new BehaviorSubject<User | null>(null);
    private _auth$ = new BehaviorSubject<boolean>(false);

    user$ = this._user$.asObservable();
    authStatus$ = this._auth$.asObservable();
    private _authChanged = new Subject<void>();
    private authChangedSubject = new Subject<void>();
    authChanged$ = this.authChangedSubject.asObservable();

    emitAuthChanged(): void {
        this.authChangedSubject.next();
    }
    constructor(private http: HttpClient, private router: Router) { console.log('API URL:', environment.apiUrl); }

    initAuth(force = false): void {
        const token = this.getAccessToken();
        if (!token) {
            this.setUser(null);
            this.setAuthState(false);
            return;
        }
        if (this._user$.value && !force) return;

        this.http.get<User>(`${environment.apiUrl}/auth/me`)
            .pipe(
                tap((u) => { this.setUser(normalizeUser(u)); this.setAuthState(true); }),
                catchError(() => { this.forceClearSession(); return of(null); })
            )
            .subscribe();
    }

    login(payload: { identifier: string; password: string }): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, payload);
    }

    logout(silent = false): void {
        this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(catchError(() => of(null))).subscribe();
        this.forceClearSession();
        if (!silent) this.router.navigateByUrl('/');
    }

    forceClearSession(): void {
        this.clearAuthStorage();
        this.setUser(null);
        this.setAuthState(false);
        this.emitAuthChanged();
    }

    // Legacy entry point; keep it routed through the centralized login path.
    handleLoginSuccess(token: string, user: any) {
        this.applyLogin(token, user);
    }

    // Emit auth changes for flows that do not return a token.
    handleRegisterSuccess() {
        this.emitAuthChanged();
    }

    resendVerificationEmail(email: string): Observable<any> {
        return this.http.post(`${environment.apiUrl}/auth/resend-verification`, { email });
    }

    // Backend currently exposes /auth/forgotPassword (camelCase).
    sendResetPasswordEmail(email: string): Observable<any> {
        return this.http.post(`${environment.apiUrl}/auth/forgotPassword`, { email });
    }

    // Check nickname availability against the existing backend route.
    checkNicknameExists(nickname: string): Observable<boolean> {
        return this.http.get<boolean>(`${environment.apiUrl}/auth/nickname-exists/${encodeURIComponent(nickname)}`);
    }

    // Update profile data and normalize either wrapped or direct user payloads.
    updateUser(formData: FormData): Observable<User> {
        return this.http
            .patch<{ user: User } | User>(`${environment.apiUrl}/users/updateUserProfile`, formData)
            .pipe(
                map((res: any) => (res?.user ?? res) as User),
                tap((u) => this.setUser(normalizeUser(u)))
            );
    }

    setAuthState(v: boolean) { this._auth$.next(v); }
    setUser(u: User | null) { this._user$.next(u); }
    getUser(): User | null { return this._user$.value; }
    getAccessToken(): string | null { return readStoredAccessToken(); }
    setAccessToken(token: string): void { writeStoredAccessToken(token); }
    clearAuthStorage(): void { clearStoredAuth(); }

    isLoggedIn(): boolean {
        return this._auth$.value === true && !!this.getAccessToken();
    }

    getEntitlements() {
        return this._user$.value?.entitlements ?? null;
    }

    loginWithGoogle(): void { window.location.href = `${environment.apiUrl}/auth/google`; }
    loginWithFacebook(): void { window.location.href = `${environment.apiUrl}/auth/facebook`; }

    register(payload: {
        email: string;
        password: string;
        nickname?: string;
    }): Observable<RegisterResponse> {
        return this.http.post<RegisterResponse>(
            `${environment.apiUrl}/auth/register`,
            payload
        );
    }

    applyLogin(token: string, user: any): void {
        this.setAccessToken(token);
        this.setAuthState(true);
        this.setUser(normalizeUser(user));

        this.emitAuthChanged();
    }
}
