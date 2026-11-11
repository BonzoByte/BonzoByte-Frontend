import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, Injector, NgZone, OnDestroy, signal } from '@angular/core';
import { concatMap, from, map, reduce, Subscription, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { PrivateMessagesService } from './private-messages.service';
import { DiscussionsService } from './discussions.service';

export type PresenceContext = readonly ['d', number, string[]] | readonly ['p', string, string[]];
const valid = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);

/** Ephemeral, contextual, account-scoped status. No storage or per-message polling. */
@Injectable({ providedIn: 'root' })
export class UserPresenceService implements OnDestroy {
    readonly statuses = signal<ReadonlyMap<string, boolean>>(new Map());
    private readonly watched = new Map<string, { kind: 'd' | 'p'; target: number | string; user: string; count: number }>();
    private subscriptions?: Subscription;
    private request?: Subscription;
    private started = false;
    private actor = '';
    private revision = 0;
    private queued?: ReturnType<typeof setTimeout>;
    private timer?: ReturnType<typeof setInterval>;
    private expiry?: ReturnType<typeof setTimeout>;
    private lastRequest = -Infinity;
    private readonly offline = () => this.invalidate();
    private readonly online = () => this.schedule();
    private readonly visibility = () => {
        if (this.document.visibilityState === 'hidden') this.invalidate();
        else this.schedule();
    };
    constructor(private injector: Injector, private auth: AuthService, private discussions: DiscussionsService,
        private privateMessages: PrivateMessagesService, private zone: NgZone, @Inject(DOCUMENT) private document: Document) {}
    start(): void {
        if (this.started || environment.billingLab) return;
        this.started = true; this.subscriptions = new Subscription();
        this.subscriptions.add(this.auth.user$.subscribe(user => {
            const identity = valid(user?._id) && user?.isVerified === true ? user!._id + ':' + (user!.presencePrivacy?.showOnlineStatus === true) : '';
            if (identity !== this.actor) { this.actor = identity; this.invalidate(); this.schedule(); }
        }));
        this.subscriptions.add(this.privateMessages.changed?.subscribe(() => { this.invalidate(); this.schedule(); }));
        this.subscriptions.add(this.discussions.notificationsChanged?.subscribe(() => this.schedule()));
        this.document.addEventListener('visibilitychange', this.visibility);
        this.document.defaultView?.addEventListener('offline', this.offline);
        this.document.defaultView?.addEventListener('online', this.online);
        this.zone.runOutsideAngular(() => { this.timer = setInterval(() => this.schedule(), 20000); });
    }
    watch(user: string | null | undefined, matchTPId?: number | null, conversationId?: string | null): () => void {
        if (!valid(user)) return () => {};
        const kind = valid(conversationId) ? 'p' : 'd', target = kind === 'p' ? conversationId! : matchTPId;
        if (kind === 'd' && (!Number.isSafeInteger(target) || Number(target) <= 0)) return () => {};
        const key = `${kind}:${target}:${user}`, old = this.watched.get(key);
        this.watched.set(key, { kind, target: target!, user, count: (old?.count ?? 0) + 1 }); this.schedule();
        return () => {
            const row = this.watched.get(key); if (!row) return;
            if (row.count > 1) row.count--; else this.watched.delete(key);
            // Drop removed contexts immediately; an in-flight response must not revive them.
            if (!this.watched.size) this.invalidate(); else this.schedule();
        };
    }
    status(user: string | null | undefined): boolean | null { return valid(user) ? this.statuses().get(user) ?? null : null; }
    private invalidate(): void {
        this.revision++; this.request?.unsubscribe(); clearTimeout(this.queued); clearTimeout(this.expiry); this.queued = undefined;
        this.zone.run(() => this.statuses.set(new Map()));
    }
    private schedule(): void {
        if (!this.started || !this.actor || !this.watched.size || this.document.visibilityState === 'hidden' || this.queued !== undefined) return;
        this.zone.runOutsideAngular(() => {
            this.queued = setTimeout(() => { this.queued = undefined; this.refresh(); }, Math.max(120, 2000 - (performance.now() - this.lastRequest)));
        });
    }
    private refresh(): void {
        if (!this.started || !this.actor || !this.watched.size || this.document.visibilityState === 'hidden') return;
        this.request?.unsubscribe(); const revision = ++this.revision; this.lastRequest = performance.now();
        const groups = new Map<string, { kind: 'd' | 'p'; target: number | string; users: Set<string> }>();
        for (const row of [...this.watched.values()].slice(-500)) {
            const key = row.kind + ':' + row.target, group = groups.get(key) ?? { kind: row.kind, target: row.target, users: new Set<string>() };
            group.users.add(row.user); groups.set(key, group);
        }
        const batches: PresenceContext[][] = []; let batch: PresenceContext[] = [], count = 0;
        for (const group of groups.values()) {
            const users = [...group.users];
            for (let i = 0; i < users.length; i += 100) {
                const chunk = users.slice(i, i + 100);
                if (batch.length >= 20 || count + chunk.length > 100) { batches.push(batch); batch = []; count = 0; }
                batch.push([group.kind, group.target, chunk] as PresenceContext); count += chunk.length;
            }
        }
        if (batch.length) batches.push(batch);
        const wanted = new Set(batches.flatMap(rows => rows.flatMap(row => row[2])));
        this.request = from(batches).pipe(concatMap(contexts => this.injector.get(HttpClient).get<{ statuses: { userId: string; online: boolean }[] }>(
            environment.apiUrl + '/presence?contexts=' + encodeURIComponent(JSON.stringify(contexts))).pipe(timeout(8000), map(result => {
                const allowed = new Set(contexts.flatMap(row => row[2]));
                if (!Array.isArray(result?.statuses) || result.statuses.length > allowed.size || new Set(result.statuses.map(row => row.userId)).size !== result.statuses.length
                    || result.statuses.some(row => !allowed.has(row.userId) || typeof row.online !== 'boolean')) throw new Error('Invalid presence response');
                return result.statuses;
            }))), reduce((all, rows) => new Map([...all, ...rows.map(row => [row.userId, row.online] as const)]), new Map<string, boolean>()), timeout(10000)).subscribe({
                next: rows => {
                    if (revision !== this.revision) return;
                    for (const id of rows.keys()) if (!wanted.has(id)) rows.delete(id);
                    this.zone.run(() => {
                        const current = this.statuses();
                        if (rows.size !== current.size || [...rows].some(([id, online]) => current.get(id) !== online)) this.statuses.set(rows);
                    });
                    clearTimeout(this.expiry); this.expiry = setTimeout(() => this.zone.run(() => this.statuses.set(new Map())), 25000);
                }, error: () => { if (revision === this.revision) this.zone.run(() => this.statuses.set(new Map())); },
            });
    }
    stop(): void {
        this.started = false; this.actor = ''; this.invalidate(); clearInterval(this.timer); this.subscriptions?.unsubscribe();
        this.document.removeEventListener('visibilitychange', this.visibility);
        this.document.defaultView?.removeEventListener('offline', this.offline);
        this.document.defaultView?.removeEventListener('online', this.online);
    }
    ngOnDestroy(): void { this.stop(); }
}
