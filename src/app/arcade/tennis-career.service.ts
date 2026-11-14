import { Injectable, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription, takeUntil, timeout } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from '../core/services/auth.service';
import { ArcadeRating } from './tennis-skill';

export interface ArcadeOpponent { id: number; name: string; countryISO2: string | null; countryISO3: string | null; ts: number | null; lastMatch: string | null; strength?: number; gameMu?: number; }
export interface ArcadeShownRating extends ArcadeRating { score: number; provisional: boolean; }
export interface ArcadeResult { winner: number; score: number[] | null; before: ArcadeShownRating; after: ArcadeShownRating; monthly: ArcadeShownRating; abandoned?: boolean; }
export interface ArcadeMine { month: string; career: ArcadeShownRating; monthly: ArcadeShownRating; active: { id: string; opponent: string; expired: boolean } | null;
  history: { id: string; opponent: ArcadeOpponent; finishedAt: string; result: ArcadeResult }[]; }
export interface ArcadeSession { id: string; seed: number; engineVersion: string; opponent: ArcadeOpponent & { strength: number; gameMu: number }; surface: 'grass'|'clay'|'hard'; expiresAt: string; }
export interface ArcadeBoard { month: string; items: (ArcadeShownRating & { rank: number; nickname: string })[]; }
@Injectable({ providedIn: 'root' })
export class TennisCareerService implements OnDestroy {
  private readonly base = `${environment.apiUrl}/arcade`;
  private readonly changed = new Subject<void>();
  readonly actorChanged = new Subject<void>();
  readonly opponents = signal<ArcadeOpponent[]>([]);
  readonly selected = signal<ArcadeOpponent | null>(null);
  readonly profile = signal<ArcadeMine | null>(null);
  readonly board = signal<ArcadeBoard | null>(null);
  readonly catalogError = signal(false);
  readonly searching = signal(false);
  readonly signedIn = signal(false);
  readonly verified = signal(false);
  readonly engineVersion = signal('');
  readonly profileError = signal(false);
  readonly boardError = signal(false);
  readonly boardLoading = signal(false);
  private queryRequest?: Subscription;
  private authSubscription: Subscription;
  private actor = '';
  constructor(private http: HttpClient, readonly auth: AuthService) {
    this.authSubscription = auth.user$.subscribe(user => {
      const actor = user?._id || '';
      this.signedIn.set(!!actor); this.verified.set(user?.isVerified === true);
      if (actor === this.actor) return;
      this.actor = actor; this.changed.next(); this.actorChanged.next(); this.profile.set(null); this.board.set(null); this.profileError.set(false); this.boardError.set(false); this.boardLoading.set(false);
      if (actor) this.refreshProfile();
    });
  }
  search(query: string): void {
    this.queryRequest?.unsubscribe(); this.opponents.set([]); this.catalogError.set(false); this.searching.set(true);
    this.queryRequest = this.http.get<{ items: ArcadeOpponent[]; engineVersion: string }>(`${this.base}/opponents`, { params: { q: query.slice(0,80) } }).pipe(timeout(15000)).subscribe({
      next: result => { this.opponents.set(result.items); this.engineVersion.set(result.engineVersion); this.catalogError.set(false); this.searching.set(false); },
      error: () => { this.catalogError.set(true); this.searching.set(false); },
    });
  }
  refreshProfile(): void {
    if (!this.actor) return;
    this.http.get<ArcadeMine>(`${this.base}/me`).pipe(timeout(15000),takeUntil(this.changed)).subscribe({ next: value => { this.profile.set(value); this.profileError.set(false); }, error: () => this.profileError.set(true) });
  }
  refreshBoard(): void {
    if (this.boardLoading()) return;
    this.boardLoading.set(true); this.boardError.set(false);
    this.http.get<ArcadeBoard>(`${this.base}/leaderboard`).pipe(timeout(15000),takeUntil(this.changed)).subscribe({ next: value => { this.board.set(value); this.boardLoading.set(false); }, error: () => { this.boardError.set(true); this.boardLoading.set(false); } });
  }
  start(body: { opponentId: number; surface: string; requestId: string; engineVersion: string; publicRanking: boolean }) {
    return this.http.post<ArcadeSession>(`${this.base}/sessions`,body).pipe(timeout(20000),takeUntil(this.changed));
  }
  finish(id: string, replay: string) { return this.http.post<ArcadeResult>(`${this.base}/sessions/${encodeURIComponent(id)}/finish`,{replay}).pipe(timeout(30000),takeUntil(this.changed)); }
  ngOnDestroy(): void { this.changed.next(); this.changed.complete(); this.queryRequest?.unsubscribe(); this.authSubscription.unsubscribe(); this.actorChanged.complete(); }
}
