import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, catchError, distinctUntilChanged, filter, map, of, switchMap, tap, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const REFERRAL_STORAGE_KEY = 'bonzobyte.referral.pending.v1';
export interface ReferralStatus {
    enabled: boolean; mailEnabled: boolean; canInvite: boolean; active: boolean;
    rewards: number; hasInvitations?: boolean; invitationLimit: number; remainingInvitations: number;
}
export interface ReferralInviteResult {
    accepted: boolean;
    // Optional for compatibility with an older server: unknown delivery must not be called sent.
    delivery?: 'sent' | 'duplicate';
    recipientEmail?: string;
}
const sections = new Set(['matches', 'players', 'tournaments', 'analytics', 'model-insights', 'simulation']);

@Injectable({ providedIn: 'root' })
export class ReferralService implements OnDestroy {
    private subscription?: Subscription;
    private activity?: Subscription;
    private rewards?: Subscription;
    private token: string | null = null;
    constructor(private http: HttpClient, private auth: AuthService, private router: Router) {}

    status() { return this.http.get<ReferralStatus>(`${environment.apiUrl}/referrals/me`); }
    invite(email: string, consent: boolean) {
        return this.http.post<ReferralInviteResult>(`${environment.apiUrl}/referrals/invite`, { email, consent })
            .pipe(tap(() => this.watchRewards()));
    }
    start(): void {
        if (this.subscription) return;
        this.takeReferralToken();
        this.subscription = this.auth.user$.pipe(
            map(user => ({ id: user?._id, verified: !!user?.isVerified })),
            distinctUntilChanged((a, b) => a.id === b.id && a.verified === b.verified),
            switchMap(account => {
                this.activity?.unsubscribe();
                this.rewards?.unsubscribe();
                if (!account.id) return of(null);
                const claim = this.token
                    ? this.http.post(`${environment.apiUrl}/referrals/claim`, { token: this.token }).pipe(
                        map(() => { this.clearToken(); return true; }),
                        catchError(error => {
                            if ([400, 403, 409].includes(error.status)) this.clearToken();
                            return of(false);
                        })) : of(false);
                return claim.pipe(switchMap(() => this.status()), map(status => ({ ...status, verified: account.verified })),
                    catchError(() => of(null)));
            }),
        ).subscribe(status => {
            if (status?.active && status.verified) this.trackActivity();
            if (status?.hasInvitations) this.watchRewards(status.rewards);
        });
    }
    private watchRewards(previous?: number): void {
        this.rewards?.unsubscribe();
        this.rewards = timer(60_000, 60_000).pipe(
            filter(() => document.visibilityState === 'visible'),
            switchMap(() => this.status().pipe(catchError(() => of(null)))),
        ).subscribe(status => {
            if (!status) return;
            if (status.rewards !== previous) { previous = status.rewards; this.auth.refreshMembership(); }
            if (!status.enabled || !status.hasInvitations) this.rewards?.unsubscribe();
        });
    }
    private takeReferralToken(): void {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const preboot = window as unknown as { BB_referral_token?: string };
        const incoming = params.get('ref') || preboot.BB_referral_token;
        delete preboot.BB_referral_token;
        if (incoming && /^[a-f0-9]{64}$/.test(incoming)) {
            this.token = incoming;
            try { sessionStorage.setItem(REFERRAL_STORAGE_KEY, incoming); } catch { /* In-memory fallback. */ }
            params.delete('ref');
            window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search
                + (params.size ? '#' + params.toString() : ''));
        } else {
            try { this.token = sessionStorage.getItem(REFERRAL_STORAGE_KEY); } catch { /* Storage can be blocked. */ }
            if (this.token && !/^[a-f0-9]{64}$/.test(this.token)) this.clearToken();
        }
    }
    private clearToken(): void {
        this.token = null;
        try { sessionStorage.removeItem(REFERRAL_STORAGE_KEY); } catch { /* In-memory fallback. */ }
    }
    private trackActivity(): void {
        this.activity?.unsubscribe();
        // Count real page sections after dwell time; never every click or background-tab time.
        let enteredAt = Date.now();
        this.activity = new Subscription();
        this.activity.add(this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => { enteredAt = Date.now(); }));
        this.activity.add(timer(15_000, 15_000).pipe(
            filter(() => document.visibilityState === 'visible' && Date.now() - enteredAt >= 10_000),
            map(() => this.router.url.split(/[?#]/)[0].split('/')[1]),
            filter(section => sections.has(section)),
            switchMap(section => this.http.post<{ active: boolean }>(`${environment.apiUrl}/referrals/activity`, { section })
                .pipe(catchError(() => of({ active: true })))),
        ).subscribe(result => { if (!result.active) this.activity?.unsubscribe(); }));
    }
    ngOnDestroy(): void { this.subscription?.unsubscribe(); this.activity?.unsubscribe(); this.rewards?.unsubscribe(); }
}
