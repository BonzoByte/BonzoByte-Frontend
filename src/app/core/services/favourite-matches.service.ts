import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Observable, Subject, Subscription, defer, finalize, from, map, mergeMap, of, switchMap, takeUntil, throwError, timeout, toArray } from 'rxjs';
import { environment } from '@env/environment';
import { Match } from '../models/tennis.model';
import { AuthService } from './auth.service';

interface FavouriteIndex { ids: number[]; count: number; limit: number; }
interface FavouriteMutation { matchTPId: number; saved: boolean; count: number; }
interface FavouriteRows { items: { matchTPId: number; match: Match | null }[]; }
export interface FavouriteMatchRows { matches: Match[]; unavailableIds: number[]; }
const validId = (id: number) => Number.isSafeInteger(id) && id > 0;

/** Private account data: never stored in browser storage or sent to analytics. */
@Injectable({ providedIn: 'root' })
export class FavouriteMatchesService implements OnDestroy {
    private readonly base = `${environment.apiUrl}/favourites/matches`;
    private readonly saved = signal<ReadonlySet<number>>(new Set());
    readonly ids = this.saved.asReadonly();
    readonly count = computed(() => this.saved().size);
    readonly loading = signal(false);
    readonly error = signal(false);
    readonly pending = signal<ReadonlySet<number>>(new Set());
    readonly signedIn = signal(false);
    readonly limit = signal(1000);
    readonly message = signal<'added' | 'removed' | 'failed' | 'limit' | null>(null);
    readonly undoId = signal<number | null>(null);
    private readonly changed = new Subject<void>();
    readonly change$ = this.changed.asObservable();
    private readonly accountChanged = new Subject<void>();
    private userSubscription?: Subscription;
    private indexRequest?: Subscription;
    private mutations = new Subscription();
    private actor = '';
    private generation = 0;
    private rowLoads = 0;
    private messageTimer?: ReturnType<typeof setTimeout>;
    private readonly focus = () => {
        if (this.signedIn() && !this.pending().size && !this.rowLoads) this.refresh();
    };

    constructor(private http: HttpClient, private auth: AuthService,
        @Inject(DOCUMENT) private document: Document) {}

    start(): void {
        if (this.userSubscription || environment.billingLab) return;
        this.userSubscription = this.auth.user$.subscribe(user => {
            const actor = user?._id || '';
            if (actor === this.actor) return;
            this.actor = actor; this.generation++;
            this.accountChanged.next();
            this.indexRequest?.unsubscribe();
            this.mutations.unsubscribe(); this.mutations = new Subscription();
            this.saved.set(new Set()); this.pending.set(new Set());
            this.error.set(false); this.loading.set(false); this.dismissMessage();
            this.signedIn.set(!!actor);
            const generation = this.generation;
            this.changed.next();
            // An open favourites page may already start its own index+rows load.
            if (actor && generation === this.generation) this.refresh();
        });
        this.document.defaultView?.addEventListener('focus', this.focus);
    }

    isSaved(id: number): boolean { return this.saved().has(id); }

    private readIndex(): Observable<FavouriteIndex> {
        const actor = this.actor, generation = ++this.generation;
        return this.http.get<FavouriteIndex>(this.base).pipe(timeout(20000), takeUntil(this.accountChanged), map(index => {
            if (actor !== this.actor || generation !== this.generation) throw new Error('FAVOURITES_STALE');
            if (!Array.isArray(index?.ids) || !index.ids.every(validId) || new Set(index.ids).size !== index.ids.length
                || index.count !== index.ids.length || !Number.isSafeInteger(index.limit) || index.limit < 1)
                throw new Error('FAVOURITES_INVALID_RESPONSE');
            this.saved.set(new Set(index.ids)); this.limit.set(index.limit); this.error.set(false);
            return index;
        }));
    }

    refresh(): void {
        if (!this.actor || this.pending().size) return;
        this.indexRequest?.unsubscribe(); this.loading.set(true);
        const previous = [...this.saved()].sort((a, b) => a - b).join(',');
        this.indexRequest = this.readIndex().subscribe({
            next: index => {
                this.loading.set(false);
                if (previous !== [...index.ids].sort((a, b) => a - b).join(',')) this.changed.next();
            },
            error: () => { this.loading.set(false); this.error.set(true); },
        });
    }

    toggle(id: number): void { this.setSaved(id, !this.isSaved(id)); }
    undo(): void { const id = this.undoId(); if (id !== null) this.setSaved(id, true); }
    private setSaved(id: number, save: boolean): void {
        if (!this.actor || !validId(id) || this.pending().has(id) || this.loading() || this.error()) return;
        if (save && !this.isSaved(id) && this.count() >= this.limit()) { this.notify('limit'); return; }
        this.indexRequest?.unsubscribe(); this.generation++;
        this.pending.set(new Set([...this.pending(), id]));
        const actor = this.actor;
        const request = save ? this.http.put<FavouriteMutation>(`${this.base}/${id}`, {})
            : this.http.delete<FavouriteMutation>(`${this.base}/${id}`);
        this.mutations.add(request.pipe(timeout(20000), takeUntil(this.accountChanged)).subscribe({
            next: result => {
                if (actor !== this.actor) return;
                this.finishPending(id);
                if (result?.matchTPId !== id || result.saved !== save) { this.notify('failed'); this.refresh(); return; }
                const ids = new Set(this.saved());
                if (save) ids.add(id); else ids.delete(id);
                this.saved.set(ids);
                this.notify(save ? 'added' : 'removed', save ? null : id);
                this.changed.next();
            },
            error: error => {
                if (actor !== this.actor) return;
                this.finishPending(id);
                this.notify(error?.error?.code === 'FAVOURITES_LIMIT' ? 'limit' : 'failed');
                // A lost response is not proof the mutation failed. Reconcile without retrying a write.
                this.refresh();
            },
        }));
    }
    private finishPending(id: number): void {
        const pending = new Set(this.pending()); pending.delete(id); this.pending.set(pending);
    }

    loadRows(): Observable<FavouriteMatchRows> {
        return defer(() => {
            this.start();
            if (!this.actor) return throwError(() => new Error('FAVOURITES_AUTH_REQUIRED'));
            this.indexRequest?.unsubscribe(); this.loading.set(false);
            const actor = this.actor;
            this.rowLoads++;
            return this.readIndex().pipe(switchMap(index => {
                const batches: number[][] = [];
                for (let i = 0; i < index.ids.length; i += 50) batches.push(index.ids.slice(i, i + 50));
                if (!batches.length) return of<FavouriteMatchRows>({ matches: [], unavailableIds: [] });
                return from(batches).pipe(mergeMap(ids => this.http.post<FavouriteRows>(`${this.base}/resolve`, { ids })
                    .pipe(timeout(30000), map(response => {
                        if (!Array.isArray(response?.items)) throw new Error('FAVOURITES_INVALID_RESPONSE');
                        const items = new Map(response.items.map(item => [item.matchTPId, item]));
                        return ids.map(id => {
                            const item = items.get(id);
                            if (item?.match && item.match.matchTPId !== id) throw new Error('FAVOURITES_INVALID_RESPONSE');
                            return { matchTPId: id, match: item?.match ?? null };
                        });
                    })), 2), toArray(), map(groups => {
                    if (actor !== this.actor) throw new Error('FAVOURITES_STALE');
                    const items = groups.flat().filter(item => this.isSaved(item.matchTPId));
                    return { matches: items.flatMap(item => item.match ? [item.match] : []),
                        unavailableIds: items.filter(item => !item.match).map(item => item.matchTPId) };
                }));
            }), takeUntil(this.accountChanged), finalize(() => { this.rowLoads--; }));
        });
    }

    private notify(message: 'added' | 'removed' | 'failed' | 'limit', undoId: number | null = null): void {
        clearTimeout(this.messageTimer); this.message.set(message); this.undoId.set(undoId);
        this.messageTimer = setTimeout(() => this.dismissMessage(), 10000);
    }
    dismissMessage(): void {
        clearTimeout(this.messageTimer); this.message.set(null); this.undoId.set(null);
    }
    ngOnDestroy(): void {
        this.accountChanged.next(); this.accountChanged.complete();
        this.userSubscription?.unsubscribe(); this.indexRequest?.unsubscribe(); this.mutations.unsubscribe();
        this.dismissMessage(); this.changed.complete();
        this.document.defaultView?.removeEventListener('focus', this.focus);
    }
}
