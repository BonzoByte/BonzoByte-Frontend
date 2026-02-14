/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { User } from '../../core/models/user.model';

interface LoginResponse {
    token: string;
    user: User;
}

// Helper: normaliziraj payload iz API-ja u naš stroži User model
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

    constructor(private http: HttpClient, private router: Router) { console.log('API URL:', environment.apiUrl); }

    initAuth(force = false): void {
        const token = localStorage.getItem('token');
        if (!token) {
            this.setUser(null);
            this.setAuthState(false);
            return;
        }
        if (this._user$.value && !force) return;

        this.http.get<User>(`${environment.apiUrl}/auth/me`)
            .pipe(
                tap((u) => { this.setUser(normalizeUser(u)); this.setAuthState(true); }),
                catchError(() => { this.logout(true); return of(null); })
            )
            .subscribe();
    }

    login(payload: { identifier: string; password: string }): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, payload).pipe(
            tap((res) => {
                localStorage.setItem('token', res.token);
                this.setUser(normalizeUser(res.user));
                this.setAuthState(true);
            })
        );
    }

    logout(silent = false): void {
        this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(catchError(() => of(null))).subscribe();
        localStorage.removeItem('token');
        this.setUser(null);
        this.setAuthState(false);
        if (!silent) this.router.navigateByUrl('/');
    }

    resendVerificationEmail(email: string): Observable<any> {
        return this.http.post(`${environment.apiUrl}/auth/resend-verification`, { email });
    }

    // Backend kod tebe izlaže /auth/forgotPassword (camelCase)
    sendResetPasswordEmail(email: string): Observable<any> {
        return this.http.post(`${environment.apiUrl}/auth/forgotPassword`, { email });
    }

    // Provjera zauzetosti nicka (ostavi kako već imaš backend rutu)
    checkNicknameExists(nickname: string): Observable<boolean> {
        return this.http.get<boolean>(`${environment.apiUrl}/auth/nickname-exists/${encodeURIComponent(nickname)}`);
    }

    // 💡 KLJUČNO: PATCH na /users/updateUserProfile (multipart), vrati čisti User i emitiraj u user$
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

    isLoggedIn(): boolean {
        return this._auth$.value === true && !!localStorage.getItem('token');
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
    }): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(
            `${environment.apiUrl}/auth/register`,
            payload
        );
    }
}