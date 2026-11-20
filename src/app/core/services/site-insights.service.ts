import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, InjectionToken, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import { PrivacyConsentService } from './privacy-consent.service';

export const SITE_INSIGHTS_POLICY = 'site-insights-2026-11-20.1';
export const INSIGHTS_EXCLUDED_KEY = 'bonzobyte.siteInsights.exclude.v1';
export const INSIGHTS_VISITOR_KEY = 'bonzobyte.siteInsights.visitor.v1';
const PURGE_KEY = 'bonzobyte.siteInsights.pendingPurge.v1';
export const SITE_INSIGHTS_OPTIONS = new InjectionToken<{ enabled: boolean }>('SITE_INSIGHTS_OPTIONS', {
    providedIn: 'root', factory: () => ({ enabled: environment.production && environment.siteAnalyticsEnabled })
});
export interface SiteInsightsAccess { allowed: boolean; internal: boolean; enabled: boolean; emailEnabled?: boolean; }
export interface SiteInsightsSummary {
    generatedAt: string; startedAt: string; timeZone: string; days: number; views: number; browsers: number; activeMembers: number; confirmed: number;
    accounts: { all: number; internal: number; external: number; confirmedExternal: number };
    daily: { day: string; views: number; browsers: number; confirmed: number }[];
    sections: { section: string; views: number }[];
}
export interface RegistrationNotice { id: string; at: string; provider: string; read: boolean; emailState: string; }
export function siteInsightsSection(url: string): string | null {
    const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
    if (path === '/') return 'home';
    if (/^\/(players|tournaments)\/matches\/\d+$/.test(path)) return path.split('/')[1];
    const name = path.slice(1);
    return ['matches', 'players', 'tournaments', 'analytics', 'model-insights', 'simulation', 'popular', 'competition', 'tennis-break', 'fantasy', 'favourites', 'predictions'].includes(name) ? name : null;
}
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

@Injectable({ providedIn: 'root' })
export class SiteInsightsService implements OnDestroy {
    readonly access = signal<SiteInsightsAccess>({ allowed: false, internal: false, enabled: false });
    readonly excluded = signal(this.readExcluded());
    private readonly subscriptions = new Subscription();
    private started = false;
    private resolved = false;
    private revision = 0;
    private section: string | null = null;
    private lastRecorded: string | null = null;
    private purging = false;
    private readonly storageEvent = (event: StorageEvent) => {
        if (!event.key || event.key === INSIGHTS_EXCLUDED_KEY) { this.excluded.set(this.readExcluded()); this.sync(); }
    };
    constructor(private http: HttpClient, private auth: AuthService, private privacy: PrivacyConsentService,
        @Inject(DOCUMENT) private document: Document, @Inject(SITE_INSIGHTS_OPTIONS) private options: { enabled: boolean }) {
        this.excluded.set(this.readExcluded());
    }
    private get win(): Window | null { return this.document.defaultView; }
    private get productionBrowser(): boolean { return this.options.enabled && this.win?.location.origin === 'https://bonzobyte.com'
        && this.win?.navigator?.webdriver !== true; }
    start(): void {
        if (this.started) return; this.started = true;
        this.win?.addEventListener('storage', this.storageEvent);
        this.subscriptions.add(this.auth.user$.pipe(distinctUntilChanged((a, b) => a?._id === b?._id && a?.isVerified === b?.isVerified)).subscribe(() => {
            const revision = ++this.revision; this.resolved = false;
            this.access.set({ allowed: false, internal: false, enabled: false });
            this.subscriptions.add(this.http.get<SiteInsightsAccess>(environment.apiUrl + '/site-insights/access').subscribe({
                next: value => {
                    if (revision !== this.revision) return;
                    this.access.set(value); this.resolved = true;
                    if (value.internal) this.setExcluded(true); else this.sync();
                }, error: () => { if (revision === this.revision) this.resolved = false; }
            }));
        }));
        this.subscriptions.add(this.privacy.changes.subscribe(() => this.sync()));
        this.retryPurge();
    }
    page(url: string): void {
        const section = siteInsightsSection(url);
        if (section !== this.section) this.lastRecorded = null;
        this.section = section; this.start(); this.sync();
    }
    setExcluded(value: boolean): void {
        try { this.win?.localStorage.setItem(INSIGHTS_EXCLUDED_KEY, value ? '1' : '0'); } catch { /* Session choice remains effective. */ }
        this.excluded.set(value); this.lastRecorded = null;
        if (value) this.purgeVisitor(); else this.sync();
    }
    private readExcluded(): boolean {
        try { return this.document?.defaultView?.localStorage.getItem(INSIGHTS_EXCLUDED_KEY) === '1'; }
        catch { return true; } // Never track when browser preference storage is blocked.
    }
    private visitor(create: boolean): string | null {
        try {
            const storage = this.win?.localStorage; if (!storage) return null;
            const raw = storage.getItem(INSIGHTS_VISITOR_KEY), saved = raw ? JSON.parse(raw) : null;
            if (saved && uuid(saved.id) && saved.expiresAt > Date.now() && saved.expiresAt <= Date.now() + 31 * 86400000) return saved.id;
            storage.removeItem(INSIGHTS_VISITOR_KEY);
            if (!create) return null;
            const id = this.win!.crypto.randomUUID(); storage.setItem(INSIGHTS_VISITOR_KEY, JSON.stringify({ id, expiresAt: Date.now() + 30 * 86400000 })); return id;
        } catch { return null; }
    }
    private sync(): void {
        if (!this.productionBrowser) return;
        if (this.excluded() || !this.privacy.allowsSiteAnalytics()) { this.purgeVisitor(); return; }
        if (!this.resolved || !this.access().enabled || this.access().internal || !this.section || this.lastRecorded === this.section) return;
        const visitorId = this.visitor(true); if (!visitorId) return;
        const section = this.section; this.lastRecorded = section;
        this.subscriptions.add(this.http.post(environment.apiUrl + '/site-insights/view', {
            policy: SITE_INSIGHTS_POLICY, consent: true, visitorId, eventId: this.win!.crypto.randomUUID(), section,
        }).subscribe({ error: () => { /* Analytics must never interrupt browsing or fall back to a third party. */ } }));
    }
    private purgeVisitor(): void {
        const id = this.visitor(false);
        if (id) {
            try { this.win?.localStorage.setItem(PURGE_KEY, JSON.stringify({ id, expiresAt: Date.now() + 32 * 86400000 }));
                this.win?.localStorage.removeItem(INSIGHTS_VISITOR_KEY); } catch { /* No new tracking occurs while excluded/without consent. */ }
        }
        this.retryPurge();
    }
    private retryPurge(): void {
        if (!this.productionBrowser || this.purging) return;
        let pending: { id: string; expiresAt: number };
        try { pending = JSON.parse(this.win?.localStorage.getItem(PURGE_KEY) || 'null'); } catch { return; }
        if (!pending || !uuid(pending.id)) return;
        if (pending.expiresAt <= Date.now()) { try { this.win?.localStorage.removeItem(PURGE_KEY); } catch { /* blocked */ } return; }
        this.purging = true;
        this.subscriptions.add(this.http.post(environment.apiUrl + '/site-insights/opt-out', { visitorId: pending.id }).subscribe({
            next: () => { this.purging = false; try { const current = JSON.parse(this.win?.localStorage.getItem(PURGE_KEY) || 'null');
                if (current?.id === pending.id) this.win?.localStorage.removeItem(PURGE_KEY); } catch { /* blocked */ } },
            error: () => { this.purging = false; } // Retry next visit; raw server records also expire after 32 days.
        }));
    }
    summary(days: number) { return this.http.get<SiteInsightsSummary>(environment.apiUrl + '/site-insights/summary', { params: { days } }); }
    notifications() { return this.http.get<{ items: RegistrationNotice[] }>(environment.apiUrl + '/site-insights/notifications'); }
    markRead(ids: string[]) { return this.http.post(environment.apiUrl + '/site-insights/notifications/read', { ids }); }
    ngOnDestroy(): void { this.subscriptions.unsubscribe(); this.win?.removeEventListener('storage', this.storageEvent); }
}
