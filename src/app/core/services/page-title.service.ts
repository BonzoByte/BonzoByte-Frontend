import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { MatchSummary } from '../models/match-summary';
import { RegionalSettingsService } from './regional-settings.service';

const cleanName = (value?: string | null) => (value ?? '').replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 120);
/** Public names/section labels and an unread count only; never private content or URL query strings. */
@Injectable({ providedIn: 'root' })
export class PageTitleService {
  private subscriptions?: Subscription;
  private match?: { owner: object; path: string; first: string; second: string };
  private unread?: { owner: object; count: number };
  constructor(private title: Title, private router: Router, private regional: RegionalSettingsService) {}
  start(): void {
    if (this.subscriptions) return;
    this.subscriptions = new Subscription();
    this.subscriptions.add(this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => this.refresh()));
    this.subscriptions.add(this.regional.changes.subscribe(() => this.refresh()));
    this.refresh();
  }
  stop(): void {
    const hadUnread = (this.unread?.count ?? 0) > 0;
    this.subscriptions?.unsubscribe(); this.subscriptions = undefined; this.unread = undefined;
    if (hadUnread) this.refresh();
  }
  /** Existing header counters publish here; this service never fetches or marks anything read. */
  setUnreadCount(count: number, owner: object): void {
    const normalized = Number.isSafeInteger(count) && count >= 0 ? count : 0;
    const previous = this.unread?.count ?? 0;
    this.unread = { owner, count: normalized };
    if (this.subscriptions && previous !== normalized) this.refresh();
  }
  clearUnreadCount(owner: object): void {
    if (this.unread?.owner !== owner) return;
    const hadUnread = this.unread.count > 0;
    this.unread = undefined;
    if (this.subscriptions && hadUnread) this.refresh();
  }
  setMatch(match: MatchSummary | null, owner: object, path: string): void {
    this.match = match ? { owner, path, first: cleanName(match.player1Name), second: cleanName(match.player2Name) } : undefined;
    this.refresh();
  }
  clearMatch(owner: object): void { if (this.match?.owner === owner) { this.match = undefined; this.refresh(); } }
  private refresh(): void {
    const path = this.router.url.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
    let label = '';
    if (this.match?.path === path && this.match.first && this.match.second) label = `${this.match.first} — ${this.match.second}`;
    else if (/^\/matches\/(?:id\/)?[^/]+$/.test(path)) label = this.regional.text('matchLink.overview');
    else {
      const key: Record<string, string> = { '/matches': 'navigation.matches', '/players': 'navigation.players',
        '/tournaments': 'navigation.tournaments', '/analytics': 'navigation.analytics', '/model-insights': 'navigation.modelInsights',
        '/simulation': 'navigation.simulation', '/predictions': 'competition.mine', '/competition': 'competition.leaderboard', '/popular': 'popularity.title', '/favourites': 'favourites.title', '/tennis-break': 'tennisBreak.title' };
      if (key[path]) label = this.regional.text(key[path]);
      else if (path.startsWith('/players/matches/')) label = this.regional.text('navigation.players');
      else if (path.startsWith('/tournaments/matches/')) label = this.regional.text('navigation.tournaments');
      else if (path.startsWith('/competition/profiles/')) label = this.regional.text('competition.leaderboard');
    }
    const base = label ? `${label} | BonzoByte` : 'BonzoByte';
    const count = this.unread?.count ?? 0;
    this.title.setTitle(count > 0 ? `(${this.regional.number(count, 0, true)}) ${base}` : base);
  }
}
