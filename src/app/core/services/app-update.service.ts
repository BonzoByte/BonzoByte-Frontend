import { DOCUMENT } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Inject, Injectable, Injector, NgZone, OnDestroy, signal } from '@angular/core';
import { Subscription, timeout } from 'rxjs';
import { DraftUnloadGuardService } from './draft-unload-guard.service';

const RELEASE = /^[a-f0-9]{64}$/;

/** Checks a tiny same-origin build manifest, never archive data or account endpoints. */
@Injectable({ providedIn: 'root' })
export class AppUpdateService implements OnDestroy {
    readonly availableRelease = signal<string | null>(null);
    readonly offline = signal(false);
    private readonly view: Window | null;
    private http?: HttpClient;
    private currentRelease = '';
    private manifestUrl = '';
    private started = false;
    private destroyed = false;
    private checking = false;
    private lastCheck = -Infinity;
    private readonly deferred = new Set<string>();
    private initialTimer?: ReturnType<typeof setTimeout>;
    private interval?: ReturnType<typeof setInterval>;
    private request?: Subscription;

    constructor(@Inject(DOCUMENT) private document: Document, private injector: Injector,
        private zone: NgZone, private drafts: DraftUnloadGuardService) {
        this.view = document.defaultView;
        this.offline.set(this.view?.navigator.onLine === false);
    }

    start(): void {
        if (this.started || this.destroyed || !this.view) return;
        const release = this.document.querySelector<HTMLMetaElement>('meta[name="bonzobyte-release"]')?.content;
        if (!release || !RELEASE.test(release)) return; // Unstamped live-development builds are deliberately silent.
        try {
            const url = new URL('app-version.json', this.document.baseURI);
            if (!['http:', 'https:'].includes(url.protocol) || url.origin !== this.view.location.origin) return;
            this.manifestUrl = url.href;
        } catch { return; }
        this.started = true; this.currentRelease = release;
        this.zone.runOutsideAngular(() => {
            this.initialTimer = setTimeout(() => this.check(), 30000);
            this.interval = setInterval(() => this.check(), 300000);
            this.document.addEventListener('visibilitychange', this.visibility);
            this.view!.addEventListener('online', this.online);
            this.view!.addEventListener('offline', this.disconnected);
        });
    }

    private readonly visibility = () => {
        if (this.document.visibilityState === 'hidden') this.cancelRequest();
        else this.check();
    };
    private readonly online = () => { this.zone.run(() => this.offline.set(false)); this.check(); };
    private readonly disconnected = () => { this.zone.run(() => this.offline.set(true)); this.cancelRequest(); };

    private check(): void {
        if (!this.started || !this.view || this.checking || this.document.visibilityState === 'hidden'
            || this.view.navigator.onLine === false || Date.now() - this.lastCheck < 30000) return;
        // Resolve the optional static reader only when an instrumented build needs it.
        // It must not attach an auth token or trigger API recovery/logout handling.
        const backend = this.injector.get(HttpBackend, null);
        if (!backend) return;
        this.http ??= new HttpClient(backend);
        this.lastCheck = Date.now(); this.checking = true;
        const url = new URL(this.manifestUrl); url.searchParams.set('check', String(this.lastCheck));
        this.request = this.http.get<unknown>(url.href, { headers: { 'Cache-Control': 'no-cache' } }).pipe(timeout(8000)).subscribe({
            next: value => {
                this.checking = false;
                if (!this.started || this.document.visibilityState === 'hidden' || !value || typeof value !== 'object') return;
                const manifest = value as Record<string, unknown>;
                if (manifest['schemaVersion'] !== 1 || manifest['application'] !== 'bonzobyte-frontend'
                    || typeof manifest['release'] !== 'string' || !RELEASE.test(manifest['release'])) return;
                const release = manifest['release'];
                const available = release === this.currentRelease || this.deferred.has(release) ? null : release;
                if (this.availableRelease() !== available) this.zone.run(() => this.availableRelease.set(available));
            },
            // A missing manifest, offline state or temporary server failure is not an app update.
            error: () => { this.checking = false; },
        });
    }

    later(): void {
        const release = this.availableRelease();
        if (!release) return;
        this.deferred.add(release);
        if (this.deferred.size > 20) this.deferred.delete(this.deferred.values().next().value!);
        this.availableRelease.set(null);
    }

    refreshApp(): void {
        if (!this.availableRelease() || !this.view || this.view.navigator.onLine === false) return;
        // Refresh readers immediately before navigation. The browser's existing confirmation
        // protects drafts/profile edits; cancelling leaves both the notice and all text intact.
        this.drafts.refresh();
        this.view.location.reload();
    }

    private cancelRequest(): void { this.request?.unsubscribe(); this.checking = false; }
    stop(): void {
        this.started = false; this.cancelRequest();
        clearTimeout(this.initialTimer); clearInterval(this.interval);
        this.document.removeEventListener('visibilitychange', this.visibility);
        this.view?.removeEventListener('online', this.online);
        this.view?.removeEventListener('offline', this.disconnected);
        this.availableRelease.set(null);
    }
    ngOnDestroy(): void { this.stop(); this.destroyed = true; }
}
