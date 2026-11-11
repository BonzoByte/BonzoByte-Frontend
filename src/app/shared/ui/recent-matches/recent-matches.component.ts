import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { RegionalSettingsService } from '../../../core/services/regional-settings.service';
import { Match } from '../../../core/models/tennis.model';
import { StaticArchivesService } from '../../../core/services/static-archives.service';

export function selectRecentMatches(rows: Match[], scope: 'player' | 'tournament', id: number, now = Date.now()): Match[] {
  const seen = new Set<number>();
  return rows.filter(row => {
    const date = Date.parse(row.dateTime);
    const belongs = scope === 'player' ? row.player1TPId === id || row.player2TPId === id : row.tournamentEventTPId === id;
    return belongs && row.isFinished === true && Number.isFinite(date) && date <= now;
  }).sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime) || b.matchTPId - a.matchTPId)
    .filter(row => { if (seen.has(row.matchTPId)) return false; seen.add(row.matchTPId); return true; }).slice(0, scope === 'tournament' ? 7 : 5);
}

@Component({
  selector: 'app-recent-matches', standalone: true, imports: [CommonModule, TranslateModule],
  templateUrl: './recent-matches.component.html', styleUrls: ['./recent-matches.component.scss']
})
export class RecentMatchesComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) scope!: 'player' | 'tournament';
  @Input({ required: true }) entityId!: number;
  matches: Match[] = [];
  loading = false;
  error = false;
  private request?: Subscription;
  constructor(private archives: StaticArchivesService, public regional: RegionalSettingsService) {}
  get heading(): string { return this.regional.plural('recent.heading', this.matches.length); }
  ngOnChanges(): void {
    this.request?.unsubscribe();
    this.matches = []; this.loading = false; this.error = false;
    if (!Number.isInteger(this.entityId) || this.entityId <= 0) return;
    this.loading = true;
    const source = this.scope === 'player' ? this.archives.getPlayerMatches(this.entityId) : this.archives.getTournamentMatches(this.entityId);
    this.request = source.subscribe({
      next: rows => { this.matches = selectRecentMatches(rows, this.scope, this.entityId); this.loading = false; },
      error: () => { this.loading = false; this.error = true; }
    });
  }
  ngOnDestroy(): void { this.request?.unsubscribe(); }
  roundLabel(value?: string): string {
    const round = (value ?? '').trim();
    const normalized = round.toLowerCase();
    if (!normalized || normalized === 'unknown') return '—';
    if (normalized === 'final' || normalized === 'finals') return 'F';
    if (/^semi[ -]?finals?$/.test(normalized)) return 'SF';
    if (/^quarter[ -]?finals?$/.test(normalized)) return 'QF';
    const numbered = normalized.match(/^round of (\d+)$/) ?? normalized.match(/^(\d+)(?:st|nd|rd|th) round$/);
    return numbered ? `R${numbered[1]}` : round;
  }
  flag(iso?: string, country?: string): string {
    const code = (iso ?? '').trim().toLowerCase();
    if ((country ?? '').trim().toLowerCase() === 'world') return 'un';
    return /^[a-z]{2}$/.test(code) && !['xx', 'ww'].includes(code) ? code : 'un';
  }
  surfaceLabel(value?: string): string {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'indoors' || normalized === 'indoor') return 'carpet';
    return ['clay', 'grass', 'hard', 'carpet'].includes(normalized) ? normalized : 'unknown';
  }
  result(value?: string): string {
    const text = String(value ?? '').trim();
    const compact = text.match(/^(\d)[-]?(\d)$/);
    return compact ? `${compact[1]}:${compact[2]}` : text || '—';
  }
  isHighlightedPlayer(match: Match, side: 1 | 2): boolean {
    if (this.scope === 'player') {
      return (side === 1 ? match.player1TPId : match.player2TPId) === this.entityId;
    }

    // Canonical TennisPrediction archives store the winner on the left.
    return side === 1 && match.isFinished === true;
  }
}
