import { Injectable, OnDestroy } from '@angular/core';
import { distinctUntilChanged, map, Subject, Subscription } from 'rxjs';
import { AuthService } from './auth.service';

export const MATCH_DETAIL_TABS = ['overview','tsBreakdown','wpBreakdown','performance','form','roleStats','odds','h2h','nn','discussions'] as const;
export const PUBLIC_MATCH_DETAIL_TABS = ['overview','discussions'] as const;
export const PLAYER_DETAIL_TABS = ['overview','ts','performance'] as const;
type DetailKind = 'match' | 'player';
const TABS = { match:MATCH_DETAIL_TABS, player:PLAYER_DETAIL_TABS };

/** Bounded tab-memory UI choices only; never stores detail payloads or access rights. */
@Injectable({ providedIn:'root' })
export class DetailTabMemoryService implements OnDestroy {
  private readonly entries = new Map<string,string>();
  private readonly maximumEntries = 64;
  private readonly accountSubscription: Subscription;
  private version = 0;
  private destroyed = false;
  readonly scopeChanged = new Subject<void>();
  get scopeVersion(): number { return this.version; }

  constructor(auth: AuthService) {
    this.accountSubscription = auth.user$.pipe(map(user => user?._id || null),distinctUntilChanged()).subscribe(() => {
      this.entries.clear(); this.version++; this.scopeChanged.next();
    });
  }

  private key(kind: DetailKind, id: number, scope: number): string | null {
    return !this.destroyed && scope === this.version && (kind === 'match' || kind === 'player') && Number.isSafeInteger(id) && id > 0
      ? `${kind}:${id}` : null;
  }

  remember(kind: DetailKind, id: number, tab: string, scope: number): void {
    const key = this.key(kind,id,scope);
    if (!key || !(TABS[kind] as readonly string[]).includes(tab)) return;
    this.entries.delete(key); this.entries.set(key,tab);
    while (this.entries.size > this.maximumEntries) this.entries.delete(this.entries.keys().next().value!);
  }

  restore<T extends string>(kind: DetailKind, id: number, available: readonly T[], scope: number): T | 'overview' {
    const key = this.key(kind,id,scope), tab = key && this.entries.get(key);
    if (!key || !tab || !(TABS[kind] as readonly string[]).includes(tab) || !(available as readonly string[]).includes(tab)) return 'overview';
    // A temporary loading/error/lock fallback does not overwrite the user's choice.
    this.entries.delete(key); this.entries.set(key,tab);
    return tab as T;
  }

  ngOnDestroy(): void {
    this.destroyed = true; this.entries.clear(); this.version++;
    this.accountSubscription.unsubscribe(); this.scopeChanged.complete();
  }
}
