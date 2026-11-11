import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { PrivacyConsentService } from './privacy-consent.service';

type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; [key: `ga-disable-${string}`]: boolean; };
export function analyticsSection(url: string): string | null {
    // Never forward arbitrary URLs, searches, IDs, email addresses, fragments or auth routes.
    const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
    return ['/', '/matches', '/players', '/tournaments', '/analytics', '/model-insights', '/simulation'].includes(path) ? path : null;
}
@Injectable({ providedIn: 'root' })
export class PrivacyReload { reload(): void { window.location.reload(); } }

@Injectable({ providedIn: 'root' })
export class ConsentedAnalyticsService implements OnDestroy {
    private subscription?: Subscription;
    private script?: HTMLScriptElement;
    private started = false;
    private configured = false;
    private lastPath: string | null = null;
    private section: string | null = null;
    private win?: AnalyticsWindow;
    constructor(@Inject(DOCUMENT) private document: Document, private privacy: PrivacyConsentService,
        private navigation: PrivacyReload) { this.win = document.defaultView as unknown as AnalyticsWindow | undefined; }
    start(): void {
        if (this.started) return;
        this.started = true;
        this.subscription = this.privacy.changes.subscribe(() => this.sync());
    }
    page(url: string): void { this.section = analyticsSection(url); this.start(); this.sync(); }
    private sync(): void {
        const win = this.win, id = this.privacy.options.measurementId;
        if (!win) return;
        if (!this.privacy.allowsAnalytics()) {
            win[`ga-disable-${id}`] = true;
            this.clearAnalyticsCookies();
            if (this.configured) {
                this.configured = false; this.script?.remove(); this.script = undefined;
                win.gtag = undefined; win.dataLayer = [];
                // Removing a script element does not unload its event listeners. Reload
                // after withdrawal/expiry so no already-loaded library keeps running.
                this.navigation.reload();
            }
            return;
        }
        if (!this.section) {
            win[`ga-disable-${id}`] = true;
            this.lastPath = null;
            return;
        }
        win[`ga-disable-${id}`] = false;
        if (!this.configured) {
            win.dataLayer = [];
            win.gtag = function () { win.dataLayer!.push(arguments); };
            win.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied',
                ad_user_data: 'denied', ad_personalization: 'denied' });
            win.gtag('consent', 'update', { analytics_storage: 'granted' });
            win.gtag('js', new Date());
            win.gtag('config', id, { send_page_view: false, allow_google_signals: false,
                allow_ad_personalization_signals: false, page_referrer: '',
                page_location: win.location.origin + this.section, cookie_domain: 'none',
                cookie_expires: Math.max(1, Math.floor((this.privacy.choice()!.expiresAt - Date.now()) / 1000)), cookie_update: false });
            this.configured = true;
            this.script = this.document.createElement('script'); this.script.async = true;
            this.script.dataset['bonzobyteAnalytics'] = 'consented';
            this.script.referrerPolicy = 'no-referrer';
            this.script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
            this.document.head.appendChild(this.script);
        }
        if (this.lastPath !== this.section) {
            win.gtag?.('event', 'page_view', { send_to: id, page_title: 'BonzoByte', page_path: this.section,
                page_location: win.location.origin + this.section, page_referrer: '' });
            this.lastPath = this.section;
        }
    }
    private clearAnalyticsCookies(): void {
        const id = this.privacy.options.measurementId.replace(/^G-/, '');
        const names = ['_ga', '_ga_' + id], host = this.win?.location.hostname || '';
        const domains = ['', host, ...host.split('.').slice(1).map((_, i) => host.split('.').slice(i + 1).join('.'))];
        for (const name of names) for (const domain of new Set(domains)) {
            this.document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? '; Domain=' + domain : ''}`;
        }
    }
    ngOnDestroy(): void { this.subscription?.unsubscribe(); }
}
