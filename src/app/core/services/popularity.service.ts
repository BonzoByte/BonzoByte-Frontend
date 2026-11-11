import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, OnDestroy } from '@angular/core';
import { Observable, Subscription, timeout } from 'rxjs';
import { environment } from '@env/environment';
import { Match, PlayerIndex } from '../models/tennis.model';
import { AuthService } from './auth.service';
import { PrivacyConsentService, POPULARITY_POLICY_VERSION } from './privacy-consent.service';

export const POPULARITY_POLICY = POPULARITY_POLICY_VERSION;
export type PopularityKind = 'match' | 'player';
export interface PopularMatch {
    id: number; player1: string; player2: string; tournament: string; date: string; match: Match;
}
export interface PopularPlayer { id: number; name: string; country?: string; gender?: 'M' | 'W'; index?: PlayerIndex; }
export interface PopularityRanking {
    testActivity?: import('./competition.service').TestActivity;
    environment: string; available?: boolean; generatedAt: string; halfLifeDays: number; windowDays: number;
    matches: PopularMatch[]; players: PopularPlayer[];
}

/** First-party, explicitly consented interest counts. Never sends names, URLs or search terms. */
@Injectable({ providedIn: 'root' })
export class PopularityService implements OnDestroy {
    private readonly base = `${environment.apiUrl}/popularity`;
    private lifecycle?: Subscription;
    private cleanups = new Set<() => void>();
    private allowed = false;
    private actor = '';
    private withdrawal?: Subscription;
    constructor(private http: HttpClient, private auth: AuthService,
        private privacy: PrivacyConsentService, @Inject(DOCUMENT) private document: Document) {}
    rankings(): Observable<PopularityRanking> { return this.http.get<PopularityRanking>(this.base).pipe(timeout(20000)); }
    start(): void {
        if (this.lifecycle || environment.billingLab) return;
        this.lifecycle = new Subscription();
        let syncing = false;
        const sync = () => {
            if (syncing) return;
            syncing = true;
            const previous = this.allowed;
            this.allowed = this.privacy.allowsPopularity();
            const actor = this.auth.getUser()?._id || '';
            if (this.actor && actor !== this.actor) {
                this.withdrawal?.unsubscribe();
                for (const cancel of [...this.cleanups]) cancel();
            }
            this.actor = actor;
            if (previous && !this.allowed && actor) {
                // Offline withdrawal still stops new views; server records also expire.
                this.withdrawal?.unsubscribe();
                this.withdrawal = this.http.delete(`${this.base}/views`).subscribe({ error: () => {} });
            }
            syncing = false;
        };
        this.lifecycle.add(this.privacy.changes.subscribe(sync));
        this.lifecycle.add(this.auth.user$.subscribe(sync));
    }
    /** Call after successful render; dispose on close, reload or destruction. */
    watchDetail(kind: PopularityKind, entityId: number, visible: () => boolean): () => void {
        if (environment.billingLab || !Number.isSafeInteger(entityId) || entityId <= 0) return () => {};
        this.start();
        const subscriptions = new Subscription();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let request: Subscription | undefined;
        let startedFor = '', sent = false, disposed = false;
        const eligibleActor = () => this.document.visibilityState !== 'hidden' && visible()
            && this.privacy.allowsPopularity() ? this.auth.getUser()?._id || '' : '';
        const stopTimer = () => { clearTimeout(timer); timer = undefined; startedFor = ''; };
        const check = () => {
            if (disposed) return;
            const actor = eligibleActor();
            if (!actor || (startedFor && startedFor !== actor)) { stopTimer(); request?.unsubscribe(); }
            if (!actor || sent || timer !== undefined) return;
            startedFor = actor;
            timer = setTimeout(() => {
                timer = undefined;
                if (disposed || eligibleActor() !== actor) { startedFor = ''; return; }
                sent = true;
                request = this.http.post(`${this.base}/views`, {
                    kind, entityId, consent: true, policy: POPULARITY_POLICY,
                }).subscribe({ error: () => {} }); // Tracking never blocks details or raises a user error.
            }, 2000);
        };
        const cancel = () => {
            if (disposed) return;
            disposed = true; stopTimer(); request?.unsubscribe(); subscriptions.unsubscribe();
            this.document.removeEventListener('visibilitychange', check);
            this.cleanups.delete(cancel);
        };
        this.cleanups.add(cancel);
        this.document.addEventListener('visibilitychange', check);
        subscriptions.add(this.privacy.changes.subscribe(check));
        subscriptions.add(this.auth.user$.subscribe(check));
        return cancel;
    }
    ngOnDestroy(): void {
        this.lifecycle?.unsubscribe(); this.withdrawal?.unsubscribe();
        for (const cancel of [...this.cleanups]) cancel();
    }
}
