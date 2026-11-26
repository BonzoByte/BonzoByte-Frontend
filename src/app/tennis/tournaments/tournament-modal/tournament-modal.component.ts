/* eslint-disable @typescript-eslint/array-type */
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RegionalSettingsService } from '@app/core/services/regional-settings.service';
import { TournamentIndex } from '@app/core/models/tennis.model';
import { RecentMatchesComponent } from '@app/shared/ui/recent-matches/recent-matches.component';
import { TrapFocusDirective } from '@app/shared/directives/trap-focus.directive';
import { environment } from '@env/environment';
import { localUiPreviewAllowed } from '@app/core/helpers/local-ui-preview';

@Component({
  selector: 'app-tournament-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, RecentMatchesComponent, TrapFocusDirective],
  templateUrl: './tournament-modal.component.html',
  styleUrls: ['./tournament-modal.component.scss']
})
export class TournamentModalComponent implements OnInit {
  @Input() tournament: TournamentIndex | null = null;
  @Input() preview = false;
  get isPreview(): boolean { return this.preview && Number.isSafeInteger(this.tournament?.tournamentEventTPId) && (this.tournament?.tournamentEventTPId ?? 0) < 0 && localUiPreviewAllowed(environment, typeof location === 'undefined' ? '' : location.hostname); }
  @Input() strengthScale: { min: number | null; median: number | null; max: number | null } | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() showMatches = new EventEmitter<number>();

  constructor(private router: Router, public regional: RegionalSettingsService) {}

  ngOnInit(): void {
    console.log('🟣 TournamentModalComponent ngOnInit', this.tournament);
  }
  
  close(): void {
    this.closed.emit();
  }
  closeFromKeyboard = (): void => this.close();

  showAllMatches(): void {
    const tpId = this.tournament?.tournamentEventTPId;

    if (!tpId || tpId <= 0 || this.isPreview) {
      console.error('❌ showAllMatches: missing tournamentEventTPId', {
        tournament: this.tournament
      });
      return;
    }

    console.log('➡️ Emitting tournament matches request', {
      tpId,
      name: this.tournamentName
    });

    this.showMatches.emit(tpId);
  }

  get tournamentName(): string {
    const baseName = (this.tournament?.tournamentEventName || 'Tournament')
      .replace(/\s+(?:\([IVXLCDM]{1,6}\)|[IVXLCDM]{1,6})\s*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return this.isQualificationTournament && !/\sQ$/i.test(baseName)
      ? `${baseName} Q`
      : baseName;
  }

  private get isQualificationTournament(): boolean {
    if (this.tournament?.tournamentLevelId === 3) return true;

    const level = (this.tournament?.tournamentLevelName || '').trim().toLowerCase();
    return level === 'q'
      || level === 'qualification'
      || level === 'qualifications'
      || level === 'qualifying';
  }

  get tournamentIso2(): string {
    return this.tournament?.countryISO2 || '';
  }

  get tournamentIso3(): string {
    return this.tournament?.countryISO3 || '';
  }

  readonly stars = [1, 2, 3, 4, 5];

  starClass(starIndex: number, value: number): 'full' | 'half' | 'empty' {
    if (value >= starIndex) return 'full';
    if (value >= starIndex - 0.5) return 'half';
    return 'empty';
  }

  getStrengthStars(value: number | null | undefined): number {
    const min = this.strengthScale?.min;
    const median = this.strengthScale?.median;
    const max = this.strengthScale?.max;
    if (value == null || !Number.isFinite(value)
      || min == null || median == null || max == null
      || !Number.isFinite(min) || !Number.isFinite(median) || !Number.isFinite(max)
      || max <= min) return 0;

    const x = Math.min(max, Math.max(min, value));
    const score = x <= median
      ? 0.5 * (x - min) / Math.max(1e-9, median - min)
      : 0.5 + 0.5 * (x - median) / Math.max(1e-9, max - median);
    return Math.round(score * 10) / 2;
  }

  get overviewRows(): Array<{ label: string; value: string; stars?: number }> {
    return [
      { label: 'details.country', value: this.tournament?.countryFull || '' },
      { label: 'details.continent', value: this.tournament?.continentName || '' },
      { label: 'details.start', value: this.formatDateMaybe(this.tournament?.tournamentEventDate) },
      { label: 'details.type', value: this.tournament?.tournamentTypeName || '' },
      { label: 'details.surface', value: this.surfaceKey },
      { label: 'details.prize', value: this.regional.usd(this.tournament?.prize) },
      { label: 'details.tsMean', value: this.formatNumMaybe(this.tournament?.strengthMeanTS, 2) },
      { label: 'details.tsPlayers', value: this.formatNumMaybe(this.tournament?.strengthPlayers, 0) },
      { label: 'details.matches', value: this.formatNumMaybe(this.tournament?.totalMatches ?? this.tournament?.numberOfMatches, 0) },
      { label: 'details.lastMatch', value: this.regional.matchDateTime(this.tournament?.dateOfLastMatch, undefined, true) },
      { label: 'details.avgStrength', value: this.formatNumMaybe(this.tournament?.averageMatchStrength, 2),
        stars: this.getStrengthStars(this.tournament?.averageMatchStrength) },
      { label: 'details.peakStrength', value: this.formatNumMaybe(this.tournament?.peakMatchStrength, 2),
        stars: this.getStrengthStars(this.tournament?.peakMatchStrength) }
    ].filter(x => !!x.value);
  }

  flagIso2OrEmpty(iso2?: string | null): string {
    return (iso2 || '').trim().toLowerCase();
  }

  get surfaceCode(): string {
    const raw = (this.tournament?.surfaceName ?? '').trim().toLowerCase();
    if (raw === 'indoor' || raw === 'indoors') return 'carpet';
    return ['clay', 'grass', 'hard', 'carpet'].includes(raw) ? raw : 'unknown';
  }
  get surfaceKey(): string { return `surfaces.${this.surfaceCode}`; }

  private formatNumMaybe(value?: number | null, digits = 2): string {
    if (value == null || !Number.isFinite(value)) return '';
    return this.regional.number(value, digits, digits === 0);
  }

  private formatDateMaybe(value?: string | null): string {
    return this.regional.date(value);
  }
}
