/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, Subject, defer } from 'rxjs';
import { tap, catchError, map, finalize, timeout } from 'rxjs/operators';
import { expireMembership } from '../helpers/membership';
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
        competitionPrivacy: { shareSettledPicks: u?.competitionPrivacy?.shareSettledPicks === true },
        presencePrivacy: { showOnlineStatus: u?.presencePrivacy?.showOnlineStatus === true },
        entitlements: u?.entitlements ? {
            plan: u.entitlements.plan ?? 'free',
            isPremium: !!u.entitlements.isPremium,
            hasTrial: !!u.entitlements.hasTrial,
            trialEndsAt: u.entitlements.trialEndsAt ?? null,
            trialResumesAt: u.entitlements.trialResumesAt ?? null,
            trialRemainingMs: u.entitlements.trialRemainingMs,
            sandboxMembership: !!u.entitlements.sandboxMembership,
            liveMembership: !!u.entitlements.liveMembership,
            // Missing rights must not accidentally grant an ad-free account.
            showAds: u.entitlements.showAds !== false,
            tier: u.entitlements.tier,
            isVip: !!u.entitlements.isVip,
            isLifetime: !!u.entitlements.isLifetime,
            trialStartedAt: u.entitlements.trialStartedAt ?? null,
            subscriptionEndsAt: u.entitlements.subscriptionEndsAt ?? null,
            membershipEndsAt: u.entitlements.membershipEndsAt ?? null,
            adFreeReason: u.entitlements.adFreeReason,
            evaluatedAt: u.entitlements.evaluatedAt,
            nextChangeAt: u.entitlements.nextChangeAt ?? null,
        } : undefined,
    };
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
    private credentialRevision = 0;
    private oauthAttempt = 0;
    private membershipTimer: ReturnType<typeof setTimeout> | undefined;
    private paymentWatch?: ReturnType<typeof setInterval>;
    private serverClockOffset = 0;
    private refreshingMembership = false;
    private membershipRefreshRevision = 0;
    private readonly onWindowFocus = () => this.refreshMembership();
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
    constructor(private http: HttpClient, private router: Router) {
        if (typeof window !== 'undefined') window.addEventListener('focus', this.onWindowFocus);
    }

    ngOnDestroy(): void {
        this.credentialRevision++;
        clearTimeout(this.membershipTimer);
        clearInterval(this.paymentWatch);
        if (typeof window !== 'undefined') window.removeEventListener('focus', this.onWindowFocus);
    }

    refreshMembership(force = false): void {
        const token = this.getAccessToken(), userId = this._user$.value?._id;
        if (!token || !userId || (this.refreshingMembership && !force)) return;
        const revision = ++this.membershipRefreshRevision;
        // Handle sleep/wake before the server response, without extending expired access.
        this.expireCurrentMembership();
        this.refreshingMembership = true;
        this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
            tap(user => {
                if (revision === this.membershipRefreshRevision && this.getAccessToken() === token && this._user$.value?._id === userId)
                    this.setUser(normalizeUser(user));
            }),
            catchError(error => {
                if (revision === this.membershipRefreshRevision && (error.status === 401 || error.status === 403) && this.getAccessToken() === token)
                    this.forceClearSession();
                return of(null);
            }),
            finalize(() => { if (revision === this.membershipRefreshRevision) this.refreshingMembership = false; })
        ).subscribe();
    }

    /** A lost checkout response is resolved by the server; keep the header current even after closing its modal. */
    watchPaymentOutcome(): void {
        clearInterval(this.paymentWatch);
        const actor = this.getUser()?._id; let remaining = 60;
        if (!actor) return;
        this.paymentWatch = setInterval(() => {
            if (this.getUser()?._id !== actor || --remaining < 0) { clearInterval(this.paymentWatch); return; }
            this.refreshMembership();
        }, 10000);
    }

    private expireCurrentMembership(): void {
        const now = Date.now() + this.serverClockOffset;
        const user = expireMembership(this._user$.value, now);
        this.setUser(user?.entitlements ? { ...user, entitlements: {
            ...user.entitlements, evaluatedAt: new Date(now).toISOString()
        } } : user);
    }

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
                tap((u) => {
                    if (this.getAccessToken() !== token) return;
                    this.setUser(normalizeUser(u)); this.setAuthState(true);
                }),
                catchError(() => {
                    if (this.getAccessToken() === token) this.forceClearSession();
                    return of(null);
                })
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
        clearInterval(this.paymentWatch);
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
    setUser(u: User | null) {
        clearTimeout(this.membershipTimer);
        const evaluatedAt = Date.parse(u?.entitlements?.evaluatedAt ?? '');
        this.serverClockOffset = Number.isFinite(evaluatedAt) ? evaluatedAt - Date.now() : 0;
        const now = Date.now() + this.serverClockOffset;
        const effective = expireMembership(u, now);
        this._user$.next(effective);
        const e = effective?.entitlements;
        const transitions = [e?.nextChangeAt, e?.hasTrial ? e.trialEndsAt : null,
            e?.isPremium && !e.isLifetime && !e.isVip ? e.subscriptionEndsAt ?? e.membershipEndsAt : null]
            .map(value => Date.parse(value ?? '')).filter(value => Number.isFinite(value) && value > now);
        if (transitions.length) {
            const delay = Math.min(Math.min(...transitions) - now + 25, 2147483647);
            this.membershipTimer = setTimeout(() => {
                this.expireCurrentMembership();
                this.refreshMembership();
            }, delay);
        }
    }
    getUser(): User | null { return this._user$.value; }
    /** Shared membership clock for display timers; never use the archive date here. */
    membershipNowMs(): number { return Date.now() + this.serverClockOffset; }
    getAccessToken(): string | null { return readStoredAccessToken(); }
    setAccessToken(token: string): void { this.credentialRevision++; writeStoredAccessToken(token); }
    clearAuthStorage(): void { this.credentialRevision++; clearStoredAuth(); }

    isLoggedIn(): boolean {
        return this._auth$.value === true && !!this.getAccessToken();
    }

    getEntitlements() {
        return this._user$.value?.entitlements ?? null;
    }

    loginWithGoogle(): void { window.location.href = `${environment.apiUrl}/auth/google`; }
    loginWithFacebook(): void { window.location.href = `${environment.apiUrl}/auth/facebook`; }

    /** Verify the callback credential before persisting it or claiming that sign-in succeeded. */
    completeOAuth(token: string): Observable<User> {
        return defer(() => {
            if (typeof token !== 'string' || token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
                throw new Error('OAUTH_INVALID_CREDENTIAL');
            const revision = this.credentialRevision, attempt = ++this.oauthAttempt;
            return this.http.get<User>(`${environment.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).pipe(
                timeout(15000), map(user => {
                    if (revision !== this.credentialRevision || attempt !== this.oauthAttempt) throw new Error('OAUTH_REPLACED');
                    const identity = user?._id ?? (user as any)?.id;
                    if (typeof identity !== 'string' || !identity.trim() || identity.length > 128) throw new Error('OAUTH_INVALID_USER');
                    this.applyLogin(token, user);
                    return this.getUser()!;
                }));
        });
    }

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
