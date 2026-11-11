import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { accountAllowsDemoAds } from '../helpers/demo-ad-layout';
import { resolveAdvertisingMode } from '../helpers/advertising-mode';
import { User } from '../models/user.model';

export const AD_DISPLAY_STORAGE_PREFIX = 'bonzobyte.ads.hidden.v1.';

/** A browser-local display choice, never a subscription or an entitlement. */
@Injectable({ providedIn: 'root' })
export class AdDisplayPreferenceService {
    readonly demoAvailable = resolveAdvertisingMode(environment, globalThis.location?.hostname ?? '') === 'demo';
    private readonly choices = new Map<string, boolean>();

    canHide(user: User | null): boolean {
        return !!user && !accountAllowsDemoAds(user);
    }

    isHidden(user: User | null): boolean {
        // Recheck current server-derived rights on every read, including after logout/expiry.
        if (!this.canHide(user)) return false;
        const key = this.key(user);
        if (!key) return true;
        if (!this.choices.has(key)) {
            try { this.choices.set(key, localStorage.getItem(key) !== 'false'); }
            catch { this.choices.set(key, true); }
        }
        return this.choices.get(key)!;
    }

    setHidden(user: User | null, hidden: boolean): boolean {
        if (!this.canHide(user)) return false;
        const key = this.key(user);
        if (!key) return false;
        this.choices.set(key, hidden);
        try { localStorage.setItem(key, String(hidden)); }
        catch { /* Keep the in-memory choice if storage is blocked or full. */ }
        return true;
    }

    private key(user: User | null): string | null {
        return user?._id ? AD_DISPLAY_STORAGE_PREFIX + encodeURIComponent(user._id) : null;
    }
}
