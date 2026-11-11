import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, InjectionToken, OnDestroy, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '@env/environment';

export const PRIVACY_STORAGE_KEY = 'bonzobyte.privacy.v1';
export const PRIVACY_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;
/** Stable first-party purpose version for Popularity requests, independent of GA configuration. */
export const POPULARITY_POLICY_VERSION = 'popularity-2026-10-04.1';
export const PRIVACY_OPTIONS = new InjectionToken<{ analyticsEnabled: boolean; measurementId: string }>('PRIVACY_OPTIONS', {
    providedIn: 'root', factory: () => ({ analyticsEnabled: environment.analyticsEnabled,
        measurementId: 'G-Z7VMGXTFFP' }),
});
export interface PrivacyChoice { version: 1; policy: string; analytics: boolean; popularity: boolean; decidedAt: number; expiresAt: number; }

/** Separate from account authentication and the preferences explicitly selected by the user. */
@Injectable({ providedIn: 'root' })
export class PrivacyConsentService implements OnDestroy {
    private readonly value = signal<PrivacyChoice | null>(null);
    readonly choice = this.value.asReadonly();
    readonly settingsOpen = signal(false);
    readonly storageUnavailable = signal(false);
    readonly changes = new BehaviorSubject<PrivacyChoice | null>(null);
    readonly policy: string;
    private expiryTimer?: ReturnType<typeof setTimeout>;
    private readonly storageChanged = (event: StorageEvent) => {
        if (event.key !== PRIVACY_STORAGE_KEY && event.key !== null) return;
        try {
            if (event.storageArea && event.storageArea !== this.document.defaultView?.localStorage) return;
        } catch { /* Reading the choice below fails closed if storage is blocked. */ }
        this.readSavedChoice();
    };
    private readonly checkExpiry = () => this.refresh();

    constructor(@Inject(DOCUMENT) private document: Document, @Inject(PRIVACY_OPTIONS) readonly options: {
        analyticsEnabled: boolean; measurementId: string;
    }) {
        // Enabling analytics/new purposes requires a new decision, including after preview mode.
        this.policy = `2026-10-04.2:${POPULARITY_POLICY_VERSION}:${options.analyticsEnabled ? options.measurementId : 'analytics-disabled'}`;
        this.readSavedChoice();
        document.defaultView?.addEventListener('storage', this.storageChanged);
        document.defaultView?.addEventListener('focus', this.checkExpiry);
    }
    open(): void { this.refresh(); this.settingsOpen.set(true); }
    close(): void { this.settingsOpen.set(false); } // Closing is never acceptance.
    // Legacy one-argument callers never grant the new Popularity purpose.
    save(analytics: boolean, popularity = false): void {
        const now = Date.now();
        const value: PrivacyChoice = { version: 1, policy: this.policy, analytics: analytics === true, popularity: popularity === true,
            decidedAt: now, expiresAt: now + PRIVACY_LIFETIME_MS };
        try {
            const storage = this.document.defaultView?.localStorage;
            if (!storage) throw new Error('unavailable');
            storage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(value));
            this.storageUnavailable.set(false);
        } catch {
            this.storageUnavailable.set(true);
            // In particular, do not retain a previous grant when a withdrawal
            // cannot replace it (e.g. full storage). Removal normally still works.
            try { this.document.defaultView?.localStorage.removeItem(PRIVACY_STORAGE_KEY); } catch { /* Browser blocks storage. */ }
        }
        this.settingsOpen.set(false); this.publish(value);
    }
    allowsAnalytics(): boolean { this.refresh(); return this.value()?.analytics === true && this.options.analyticsEnabled; }
    allowsPopularity(): boolean { this.refresh(); return this.value()?.popularity === true; }
    refresh(): void {
        const current = this.value();
        if (current && current.expiresAt <= Date.now()) this.publish(null);
    }
    private readSavedChoice(): void {
        let value: PrivacyChoice | null = null;
        try {
            const raw = this.document.defaultView?.localStorage.getItem(PRIVACY_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null, now = Date.now();
            if (parsed?.version === 1 && parsed.policy === this.policy && typeof parsed.analytics === 'boolean'
                && typeof parsed.popularity === 'boolean'
                && Number.isFinite(parsed.decidedAt) && Number.isFinite(parsed.expiresAt)
                && parsed.decidedAt <= now && parsed.decidedAt > 0 && parsed.expiresAt > now
                && parsed.expiresAt - parsed.decidedAt === PRIVACY_LIFETIME_MS) value = parsed;
        } catch { /* Invalid or blocked storage never enables optional tracking. */ }
        this.publish(value);
    }
    private publish(value: PrivacyChoice | null): void {
        clearTimeout(this.expiryTimer); this.value.set(value); this.changes.next(value);
        if (value) this.expiryTimer = setTimeout(() => {
            this.refresh(); if (this.value()) this.publish(this.value());
        }, Math.min(value.expiresAt - Date.now(), 2147483647));
    }
    ngOnDestroy(): void {
        clearTimeout(this.expiryTimer); this.changes.complete();
        this.document.defaultView?.removeEventListener('storage', this.storageChanged);
        this.document.defaultView?.removeEventListener('focus', this.checkExpiry);
    }
}
