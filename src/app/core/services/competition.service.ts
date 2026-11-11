import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, signal } from '@angular/core';
import { Subject, Subscription, takeUntil, timeout, tap } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

export interface CompetitionPlayer {
    id: number; name: string;
    countryISO2?: string | null; countryISO3?: string | null; countryFull?: string | null;
    seed?: string | null; rank?: string | null;
}
export interface CompetitionSnapshot {
    matchTPId: number; tournament: string; startAt: string; lockAt: string;
    players: CompetitionPlayer[]; odds: number[]; bookmakers: number;
    model: { version: string; p1: number; issuedAt: string } | null;
}
export interface CompetitionPick {
    displayMatch?: import('../models/match-summary').MatchSummary;
    /** UI-only local example metadata; never sent when accepting a pick. */
    previewMatch?: import('../models/match-summary').MatchSummary;
    matchTPId: number; side: number; snapshot: CompetitionSnapshot; submittedAt: string; month: string;
    settlement: { status: 'won' | 'lost' | 'void'; units: number; reason: string; settledAt: string } | null;
}
export interface CompetitionMatch {
    available: boolean; reason: string | null;
    quote: { token: string; snapshot: CompetitionSnapshot; expiresAt: string } | null;
    pick: CompetitionPick | null; community: { counts: number[]; total: number } | null;
}
export interface CompetitionStats {
    submitted: number; settled: number; pending: number; voided: number; won: number;
    units: number; roi: number | null; hitRate: number | null; qualified: boolean;
    comparison: { count: number; userUnits: number; modelUnits: number; marketUnits: number };
}
export interface TestActivity { seed: string; retrospective: true; preferredMonth: string; generatedAt: string; }
export interface CompetitionMine { month: string; entries: CompetitionPick[]; remainingToday: number; summary: CompetitionStats; demo?: boolean; testActivity?: TestActivity; }
export interface CompetitionRank { nickname: string; rank?: number; submitted: number; settled: number; won: number; units: number; picksProfileId?: string | null; }
export interface CompetitionPublicHistory {
    month: string; nickname: string; entries: CompetitionPick[]; demo?: boolean; testActivity?: TestActivity;
    summary: Pick<CompetitionStats, 'settled' | 'won' | 'voided' | 'units' | 'roi' | 'hitRate' | 'qualified'>;
}
export interface CompetitionBoard { month: string; qualified: CompetitionRank[]; provisional: CompetitionRank[]; demo?: boolean; testActivity?: TestActivity; }
export interface CompetitionDemoWindow { from: string; to: string; preferredMonth: string; }

/** No browser persistence, analytics events or automatic write retries. */
@Injectable({ providedIn: 'root' })
export class CompetitionService implements OnDestroy {
    private readonly base = `${environment.apiUrl}/competition`;
    readonly picks = signal<ReadonlyMap<number, CompetitionPick>>(new Map());
    readonly selectedId = signal<number | null>(null);
    readonly detail = signal<CompetitionMatch | null>(null);
    readonly loading = signal(false);
    readonly busy = signal(false);
    readonly message = signal('');
    readonly accepted = signal(false);
    readonly actorChanged = new Subject<void>();
    private actor = '';
    private generation = 0;
    private indexLoaded = false;
    private userSubscription: Subscription;
    private request?: Subscription;
    constructor(private http: HttpClient, public auth: AuthService) {
        this.userSubscription = auth.user$.subscribe(user => {
            const actor = user?._id || '';
            if (actor === this.actor) return;
            this.actor = actor; this.generation++; this.actorChanged.next();
            this.request?.unsubscribe(); this.picks.set(new Map()); this.selectedId.set(null);
            this.detail.set(null); this.message.set(''); this.loading.set(false); this.busy.set(false);
            this.accepted.set(false); this.indexLoaded = false;
            if (actor) this.ensureIndex();
        });
    }
    currentMonth(): string { return new Date().toISOString().slice(0, 7); }
    rules() { return this.http.get<{ sourceConnected: boolean; demo?: CompetitionDemoWindow | null; testActivity?: TestActivity }>(`${this.base}/rules`).pipe(timeout(15000)); }
    ensureIndex(): void {
        if (this.indexLoaded || !this.actor || environment.billingLab) return;
        this.indexLoaded = true;
        this.mine(this.currentMonth()).subscribe({ error: () => { this.indexLoaded = false; } });
    }
    mine(month: string, demo = false) {
        const generation = this.generation;
        return this.http.get<CompetitionMine>(`${this.base}/me`, { params: demo ? { month, demo: '1' } : { month } }).pipe(timeout(15000),
            takeUntil(this.actorChanged), tap(result => {
                if (generation !== this.generation || demo || result.testActivity) return;
                const copy = new Map(this.picks());
                for (const pick of result.entries) copy.set(pick.matchTPId, pick);
                this.picks.set(copy);
            }));
    }
    leaderboard(month: string, demo = false) {
        return this.http.get<CompetitionBoard>(`${this.base}/leaderboard`, { params: demo ? { month, demo: '1' } : { month } }).pipe(timeout(15000));
    }
    publicHistory(profileId: string, month: string, demo = false) {
        // Public reads must never populate the signed-in user's private pick index.
        return this.http.get<CompetitionPublicHistory>(`${this.base}/profiles/${encodeURIComponent(profileId)}/picks`,
            { params: demo ? { month, demo: '1' } : { month } }).pipe(timeout(15000));
    }
    open(id: number): void {
        if (!this.actor || this.busy() || !Number.isSafeInteger(id) || id <= 0) return;
        this.request?.unsubscribe(); this.selectedId.set(id); this.accepted.set(false);
        this.detail.set(null); this.message.set(''); this.loading.set(true);
        const generation = this.generation;
        this.request = this.http.get<CompetitionMatch>(`${this.base}/matches/${id}`).pipe(timeout(15000),
            takeUntil(this.actorChanged)).subscribe({ next: detail => {
                if (generation !== this.generation) return;
                this.loading.set(false); this.detail.set(detail);
                if (detail.pick) this.remember(detail.pick);
            }, error: error => { this.loading.set(false); this.message.set(this.errorKey(error)); } });
    }
    close(): void {
        if (this.busy()) return;
        this.request?.unsubscribe(); this.selectedId.set(null); this.detail.set(null); this.loading.set(false);
    }
    submit(side: number): void {
        const id = this.selectedId(), quote = this.detail()?.quote;
        if (id === null || !quote || ![0, 1].includes(side) || this.busy()) return;
        this.busy.set(true); this.message.set(''); const generation = this.generation;
        this.request = this.http.post<{ pick: CompetitionPick }>(`${this.base}/matches/${id}`, { side, token: quote.token })
            .pipe(timeout(15000), takeUntil(this.actorChanged)).subscribe({ next: result => {
                if (generation !== this.generation) return;
                this.busy.set(false); this.accepted.set(true); this.remember(result.pick);
                this.detail.set({ available: false, reason: 'alreadyPicked', pick: result.pick, quote: null, community: null });
            }, error: error => {
                this.busy.set(false); this.message.set(this.errorKey(error));
                // Discard an uncertain quote. Retry means read status, not another POST.
                this.detail.set(null);
            } });
    }
    private remember(pick: CompetitionPick): void { this.picks.set(new Map([...this.picks(), [pick.matchTPId, pick]])); }
    private errorKey(error: any): string {
        const known: Record<string, string> = {
            COMPETITION_VERIFICATION_REQUIRED: 'verify', COMPETITION_DAILY_LIMIT: 'dailyLimit',
            COMPETITION_QUOTE_CHANGED: 'quoteChanged', COMPETITION_QUOTE_EXPIRED: 'quoteChanged',
            COMPETITION_ALREADY_PICKED: 'checkStatus', COMPETITION_LOCKED: 'locked',
        };
        return 'competition.' + (known[error?.error?.code] || 'checkStatus');
    }
    ngOnDestroy(): void { this.userSubscription.unsubscribe(); this.request?.unsubscribe(); this.actorChanged.next(); this.actorChanged.complete(); }
}
