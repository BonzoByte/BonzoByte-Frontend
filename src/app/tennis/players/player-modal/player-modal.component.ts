/* eslint-disable @typescript-eslint/array-type */
import {
  Component,
  EventEmitter,
  Input,
  Inject,
  Optional,
  Output,
  OnChanges,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { BbModalShellComponent } from '@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component';
import { StaticArchivesService } from '@app/core/services/static-archives.service';
import { Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { playsTranslationKey } from '@app/core/helpers/plays-translation';
import { RegionalSettingsService } from '@app/core/services/regional-settings.service';
import { PopularityService } from '@app/core/services/popularity.service';

import {
  PlayerDetailsRaw,
  PlayerDetailsVm,
  PlayerDetailsTab,
  RatingMode,
  SurfaceScope,
  PlayerTsSnapshotVm,
  WinLossStatVm,
  PlayerTsHistoryRaw,
  PlayerTsHistorySeriesKey,
  PlayerTsChartPointVm,
  TimeScope,
  PlayerFormVm,
  PlayerRoleStatsVm,
  PlayerPerformanceBlockVm
} from 'src/app/core/models/player-details.model';
import { PlayerIndex } from '@app/core/models/tennis.model';
import { RecentMatchesComponent } from '@app/shared/ui/recent-matches/recent-matches.component';
import { environment } from '@env/environment';
import { localUiPreviewAllowed as popularPreviewAllowed } from '@app/core/helpers/local-ui-preview';
import { DetailTabMemoryService, PLAYER_DETAIL_TABS } from '@app/core/services/detail-tab-memory.service';

interface PlayerOverviewStatItem {
  label: string;
  value: string;
  stars?: number;
}

@Component({
  selector: 'app-player-modal',
  standalone: true,
  imports: [CommonModule, BbModalShellComponent, FormsModule, RecentMatchesComponent, TranslateModule],
  templateUrl: './player-modal.component.html',
  styleUrls: ['./player-modal.component.scss']
})
export class PlayerModalComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() playerTPId!: number;
  @Input() genderHint: 'M' | 'W' = 'M';
  @Input() playerIndex: PlayerIndex | null = null;
  @Input() previewIndex: PlayerIndex | null = null;
  get isPreview(): boolean {
    return Number.isSafeInteger(this.playerTPId) && this.playerTPId < 0 && this.previewIndex?.playerTPId === this.playerTPId &&
      popularPreviewAllowed(environment, typeof location === 'undefined' ? '' : location.hostname);
  }

  @Output() closed = new EventEmitter<void>();
  @Output() showCurrentMatches = new EventEmitter<void>();

  activeTab: PlayerDetailsTab = 'overview';

  loading = false;
  error: string | null = null;

  raw: PlayerDetailsRaw | null = null;
  vm: PlayerDetailsVm | null = null;

  ratingMode: RatingMode = 'M';
  surfaceScope: SurfaceScope = 'ALL';

  tsHistoryRaw: PlayerTsHistoryRaw | null = null;
  tsHistoryLoading = false;
  tsHistoryError: string | null = null;

  hoveredTsPoint: PlayerTsChartPointVm | null = null;
  hoveredTsIndex: number | null = null;

  performanceTimeScope: TimeScope = 'ALL';
  performanceSurfaceScope: SurfaceScope = 'ALL';

  private detailsSub?: Subscription;
  private cancelDetailWatch?: () => void;
  private destroyed = false;
  private tabScope = 0;
  private tabScopeSub?: Subscription;

  constructor(public staticArchives: StaticArchivesService, private router: Router, public regional: RegionalSettingsService,
    @Optional() @Inject(PopularityService) private popularity: PopularityService | null = null,
    @Optional() @Inject(DetailTabMemoryService) private tabMemory: DetailTabMemoryService | null = null) {
    this.tabScope = tabMemory?.scopeVersion ?? 0;
    this.tabScopeSub = tabMemory?.scopeChanged.subscribe(() => {
      this.activeTab = 'overview';
      if (this.isOpen && this.playerTPId && !this.destroyed) this.load();
    });
  }

  ngOnChanges(): void {
    if (this.isOpen && this.playerTPId) {
      this.load();
    } else {
      this.stopDetailWatch();
      this.detailsSub?.unsubscribe();
      this.detailsSub = undefined;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopDetailWatch();
    this.detailsSub?.unsubscribe();
    this.tabScopeSub?.unsubscribe();
  }

  close(): void {
    this.stopDetailWatch();
    this.isOpen = false;
    this.loading = false;
    this.error = null;
    this.raw = null;
    this.vm = null;
    this.activeTab = 'overview';
    this.detailsSub?.unsubscribe();
    this.detailsSub = undefined;
    this.closed.emit();
  }

  setTab(tab: PlayerDetailsTab): void {
    if (this.isPreview && tab !== 'overview') return;
    this.activeTab = tab;
    if (this.isOpen && !this.isPreview) this.tabMemory?.remember('player',this.playerTPId,tab,this.tabScope);
  }

  private stopDetailWatch(): void {
    this.cancelDetailWatch?.();
    this.cancelDetailWatch = undefined;
  }

  private load(): void {
    this.stopDetailWatch();
    this.detailsSub?.unsubscribe();
    this.detailsSub = undefined;

    const playerId = this.playerTPId;
    if (this.destroyed || !this.isOpen || !playerId) return;
    this.tabScope = this.tabMemory?.scopeVersion ?? 0;
    if (!this.isPreview && this.playerIndex && this.playerIndex.playerTPId < 0) this.playerIndex = null;

    this.loading = true;
    this.error = null;
    this.raw = null;
    this.vm = null;
    this.activeTab = 'overview';
    this.ratingMode = 'M';
    this.surfaceScope = 'ALL';
    this.tsHistoryRaw = null;
    this.tsHistoryError = null;
    this.tsHistoryLoading = false;

    if (this.isPreview) {
      this.playerIndex = this.previewIndex;
      this.loading = false;
      return;
    }

    this.detailsSub = forkJoin({
      raw: this.staticArchives.getPlayerDetails(playerId).pipe(
        catchError(() => of(null))
      ),
      index: this.staticArchives.getPlayerIndexById(playerId).pipe(
        catchError(() => of(null))
      ),
      tsHistory: this.staticArchives.getPlayerTsHistory(playerId).pipe(
        catchError((err) => {
          console.error('[PLAYER TS HISTORY LOAD FAILED]', {
            playerTPId: playerId,
            err
          });
          return of(null);
        })
      )
    }).subscribe({
      next: ({ raw, index, tsHistory }) => {
        if (this.destroyed || !this.isOpen || this.playerTPId !== playerId) return;
        this.stopDetailWatch();
        this.raw = raw;
        this.playerIndex = index ?? this.playerIndex ?? null;
        this.tsHistoryRaw = tsHistory;

        console.log('[PLAYER TS HISTORY]', {
          playerTPId: playerId,
          tsHistory,
          hasHistory: !!tsHistory,
          keys: Object.keys(tsHistory?.s ?? {})
        });

        if (raw) {
          this.vm = buildPlayerDetailsVm(raw);
        } else {
          this.vm = null;
        }

        if (!raw && !this.playerIndex) {
          this.error = 'playerStats.noDetails';
        }

        this.loading = false;
        if (this.tabMemory && !this.isPreview) {
          const available: readonly PlayerDetailsTab[] = this.vm && !this.error ? PLAYER_DETAIL_TABS : ['overview'];
          this.activeTab = this.tabMemory.restore('player',playerId,available,this.tabScope);
        }

        const visible = () => !this.destroyed && this.isOpen && this.playerTPId === playerId &&
          !this.loading && !this.error && (!!this.raw || this.playerIndex?.playerTPId === playerId);
        if (visible()) {
          this.cancelDetailWatch = this.popularity?.watchDetail('player', playerId, visible);
        }
      },
      error: (err) => {
        if (this.destroyed || !this.isOpen || this.playerTPId !== playerId) return;
        this.stopDetailWatch();
        console.error('Failed to load player details:', err);
        this.error = 'playerStats.failed';
        this.loading = false;
        this.activeTab = 'overview';
      }
    });
  }

  flagIso2OrEmpty(iso2?: string): string {
    return (iso2 || '').trim().toLowerCase();
  }

  playerAvatarUrlById(tpId?: number): string {
    if (!tpId || this.isPreview) {
      return this.staticArchives.getDefaultPlayerPhotoUrl(this.genderHint);
    }

    return this.staticArchives.getPlayerPhotoUrl(tpId, this.genderHint);
  }

  onAvatarError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    img.src = this.staticArchives.getDefaultPlayerPhotoUrl(this.genderHint === 'W' ? 'W' : 'M');
  }

  get overviewName(): string {
    return this.vm?.overview?.name || this.playerIndex?.playerName || this.regional.text('playerStats.unnamed');
  }

  get overviewIso2(): string {
    return this.vm?.overview?.iso2 || this.playerIndex?.countryISO2 || '';
  }

  get overviewIso3(): string {
    return this.vm?.overview?.iso3 || this.playerIndex?.countryISO3 || '';
  }

  get countryText(): string {
    return this.vm?.overview?.countryName || this.playerIndex?.countryFull || '';
  }

  get bornText(): string {
    return this.formatDateMaybe(this.raw?.d009 || this.playerIndex?.playerBirthDate);
  }

  get ageText(): string {
    return this.vm?.overview?.ageText || '';
  }

  get playsText(): string {
    return playsTranslationKey(this.playerIndex?.playsId,
      this.vm?.overview?.playsText || this.playerIndex?.playsName);
  }

  get heightText(): string {
    if (this.vm?.overview?.heightText) return this.vm.overview.heightText;

    const h = this.playerIndex?.playerHeight;
    return typeof h === 'number' && Number.isFinite(h) ? `${h} cm` : '';
  }

  get weightText(): string {
    if (this.vm?.overview?.weightText) return this.vm.overview.weightText;

    const w = this.playerIndex?.playerWeight;
    return typeof w === 'number' && Number.isFinite(w) ? `${w} kg` : '';
  }

  get turnedProText(): string {
    if (this.vm?.overview?.turnedProText) return this.vm.overview.turnedProText;

    const y = this.playerIndex?.playerTurnedPro;
    return typeof y === 'number' && Number.isFinite(y) ? `${y}` : '';
  }

  get metaRows(): Array<{ label: string; value: string }> {
    return [
      { label: 'details.country', value: this.countryText },
      {
        label: 'details.born',
        value: this.bornText
          ? (this.ageText ? `${this.bornText} (${this.ageText})` : this.bornText)
          : ''
      },
      { label: 'plays.label', value: this.playsText },
      { label: 'details.height', value: this.heightText },
      { label: 'details.weight', value: this.weightText },
      { label: 'details.turnedPro', value: this.turnedProText }
    ].filter(x => !!x.value);
  }

  get tsSnapshot(): PlayerTsSnapshotVm | null {
    if (!this.vm) return null;

    if (this.surfaceScope === 'ALL') {
      return this.vm.ts.all[this.ratingMode];
    }

    return this.vm.ts.surfaces[this.surfaceScope][this.ratingMode];
  }

  get currentTsSeriesKey(): PlayerTsHistorySeriesKey {
    return `${this.ratingMode}_${this.surfaceScope}` as PlayerTsHistorySeriesKey;
  }

  get currentTsSeries(): PlayerTsChartPointVm[] {
    const points = this.tsHistoryRaw?.s?.[this.currentTsSeriesKey] ?? [];

    return points.map((p) => ({
      matchTPId: p.m,
      date: p.d,
      mean: p.t,
      sd: p.s
    }));
  }

  get hasTsSeries(): boolean {
    return this.currentTsSeries.length > 1;
  }

  get tsSeriesMin(): number {
    if (!this.currentTsSeries.length) return 0;
    return Math.min(...this.currentTsSeries.map(p => p.mean));
  }

  get tsSeriesMax(): number {
    if (!this.currentTsSeries.length) return 0;
    return Math.max(...this.currentTsSeries.map(p => p.mean));
  }

  get tsSeriesRange(): number {
    const range = this.tsSeriesMax - this.tsSeriesMin;
    return range <= 0 ? 1 : range;
  }

  get tsSeriesPoints(): string {
    const series = this.currentTsSeries;
    if (series.length < 2) return '';

    const min = this.tsSeriesMin;
    const max = this.tsSeriesMax;
    const range = max - min || 1;
    const width = 760;
    const height = 220;

    return series
      .map((p, i) => {
        const x = (i / (series.length - 1)) * width;
        const y = height - ((p.mean - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');
  }

  get tsSeriesFirstDateText(): string {
    const first = this.currentTsSeries[0];
    return first ? this.formatDate(first.date) : '';
  }

  get tsSeriesLastDateText(): string {
    const last = this.currentTsSeries[this.currentTsSeries.length - 1];
    return last ? this.formatDate(last.date) : '';
  }

  get tsHistoryKeysText(): string {
    const keys = Object.keys(this.tsHistoryRaw?.s ?? {});
    return keys.length ? keys.join(', ') : 'none';
  }

  get tsSeriesPointsPreview(): string {
    return this.tsSeriesPoints.slice(0, 120);
  }

  get activeTsPoint(): PlayerTsChartPointVm | null {
    if (this.hoveredTsPoint) return this.hoveredTsPoint;

    const series = this.currentTsSeries;
    return series.length ? series[series.length - 1] : null;
  }

  get activeTsMeanText(): string {
    const point = this.activeTsPoint;
    if (point) return this.formatNumberMaybe(point.mean, 2);

    return this.formatNumberMaybe(this.tsSnapshot?.mean, 2);
  }

  get activeTsSdText(): string {
    const point = this.activeTsPoint;
    if (point) return this.formatNumberMaybe(point.sd, 2);

    return this.formatNumberMaybe(this.tsSnapshot?.sd, 2);
  }

  get activeTsSnapshotTitle(): string {
    const point = this.activeTsPoint;
    if (this.hoveredTsPoint && point) {
      return this.regional.text('playerStats.snapshotAt', { date: this.formatDate(point.date) });
    }

    return this.regional.text('playerStats.snapshot');
  }

  get activePerformanceBlock(): PlayerPerformanceBlockVm | null {
    if (!this.vm) return null;

    if (this.performanceSurfaceScope === 'ALL') {
      return this.vm.performance[this.performanceTimeScope];
    }

    return this.vm.performance[this.performanceSurfaceScope][this.performanceTimeScope];
  }

  get performanceRows(): Array<{
    label: string;
    wins: number;
    losses: number;
    total: number;
    winPct: string;
  }> {
    const block = this.activePerformanceBlock;
    if (!block) return [];

    return [
      {
        label: this.regional.text('playerStats.matches'),
        wins: block.match.wins,
        losses: block.match.losses,
        total: block.match.total,
        winPct: this.formatPercent(block.match.winPct)
      },
      {
        label: this.regional.text('playerStats.sets'),
        wins: block.set.wins,
        losses: block.set.losses,
        total: block.set.total,
        winPct: this.formatPercent(block.set.winPct)
      },
      {
        label: this.regional.text('playerStats.games'),
        wins: block.game.wins,
        losses: block.game.losses,
        total: block.game.total,
        winPct: this.formatPercent(block.game.winPct)
      }
    ];
  }

  get activeForm(): PlayerFormVm | null {
    if (!this.vm) return null;

    const scope = this.performanceSurfaceScope;
    // Format recorded source dates at render time. The cached VM and archive stay untouched.
    const dates = {
      ALL: [this.raw?.d166, this.raw?.d171],
      S1: [this.raw?.d167, this.raw?.d172],
      S2: [this.raw?.d168, this.raw?.d173],
      S3: [this.raw?.d169, this.raw?.d174],
      S4: [this.raw?.d170, this.raw?.d175]
    }[scope];
    return {
      ...this.vm.form[scope],
      lastWinDateText: this.regional.date(dates[0]),
      lastLossDateText: this.regional.date(dates[1])
    };
  }

  get activeRoleStats(): PlayerRoleStatsVm | null {
    if (!this.vm) return null;

    return this.vm.roleStats[this.performanceTimeScope];
  }

  get activeStreakText(): string {
    const streak = this.activeForm?.streak;
  
    if (streak == null || streak === 0) return '—';
    if (streak > 0) return this.regional.text('playerStats.won', { count: this.regional.number(streak, 0, true) });
  
    return this.regional.text('playerStats.lost', { count: this.regional.number(Math.abs(streak), 0, true) });
  }

  timeScopeLabel(scope: TimeScope): string {
    switch (scope) {
      case 'ALL':
        return this.regional.text('common.all');
      case 'YEAR':
        return this.regional.text('playerStats.lastYear');
      case 'MONTH':
        return this.regional.text('playerStats.lastMonth');
      case 'WEEK':
        return this.regional.text('playerStats.lastWeek');
      default:
        return scope;
    }
  }

  private formatPercent(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `${this.regional.number(value, 1)}%`;
  }

  private formatDate(value: string | null | undefined): string {
    return this.regional.date(value);
  }

  onTsSelectorsChanged(): void {
    // No additional teardown is currently required;
    // Keep the same lifecycle hook pattern used by Match Details.
  }

  onTsChartMouseMove(event: MouseEvent): void {
    const svg = event.currentTarget as SVGSVGElement | null;
    const series = this.currentTsSeries;

    if (!svg || series.length === 0) {
      this.hoveredTsPoint = null;
      this.hoveredTsIndex = null;
      return;
    }

    const rect = svg.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const width = rect.width || 1;

    const clampedX = Math.max(0, Math.min(relativeX, width));
    const ratio = clampedX / width;

    const index = Math.round(ratio * (series.length - 1));
    const safeIndex = Math.max(0, Math.min(index, series.length - 1));

    this.hoveredTsIndex = safeIndex;
    this.hoveredTsPoint = series[safeIndex];
  }

  onTsChartMouseLeave(): void {
    this.hoveredTsPoint = null;
    this.hoveredTsIndex = null;
  }

  ratingModeLabel(mode: RatingMode): string {
    switch (mode) {
      case 'M':
        return this.regional.text('playerStats.match');
      case 'SM':
        return this.regional.text('playerStats.setMatch');
      case 'GSM':
        return this.regional.text('playerStats.gameSetMatch');
      default:
        return mode;
    }
  }

  isCurrentSurface(_scope: SurfaceScope): boolean {
    return false;
  }

  tsMeanText(): string {
    return this.formatNumberMaybe(this.tsSnapshot?.mean, 2);
  }

  tsSdText(): string {
    return this.formatNumberMaybe(this.tsSnapshot?.sd, 2);
  }

  get averageTsMeanText(): string {
    const mean = this.playerIndex?.averageTSMean;
    return this.formatNumberMaybe(mean, 2);
  }

  get currentTsMeanText(): string {
    const mean = this.playerIndex?.currentTsMean ?? this.vm?.ts?.all?.M?.mean;
    return this.formatNumberMaybe(mean, 2);
  }

  get peakTsMeanText(): string {
    return this.formatNumberMaybe(this.playerIndex?.peakTsMean, 2);
  }

  get matchesCountText(): string {
    return this.formatIntegerMaybe(this.playerIndex?.totalMatches ?? this.playerIndex?.numberOfMatches);
  }

  get winPctText(): string {
    const pct = this.playerIndex?.winPercentage;
    if (typeof pct !== 'number' || !Number.isFinite(pct)) return '';

    return `${this.regional.number(pct * 100, 1)}%`;
  }

  get lastMatchDateText(): string {
    return this.regional.matchDateTime(this.playerIndex?.dateOfLastMatch, undefined, true);
  }

  get overviewStats(): PlayerOverviewStatItem[] {
    return [
      { label: 'details.averageTs', value: this.averageTsMeanText,
        stars: this.getTSStars(this.playerIndex?.averageTSMean) },
      { label: 'details.peakTs', value: this.peakTsMeanText,
        stars: this.getTSStars(this.playerIndex?.peakTsMean) },
      { label: 'details.currentTs', value: this.currentTsMeanText,
        stars: this.getTSStars(this.playerIndex?.currentTsMean ?? this.vm?.ts?.all?.M?.mean) },
      { label: 'details.matchCount', value: this.matchesCountText },
      { label: 'details.winPercent', value: this.winPctText },
      { label: 'details.lastMatchDate', value: this.lastMatchDateText }
    ].filter(x => !!x.value);
  }

  get overviewRows(): Array<{ label: string; value: string; stars?: number }> {
    return [
      ...this.metaRows,
      ...this.overviewStats
    ].filter(x => !!x.value);
  }

  readonly stars = [1, 2, 3, 4, 5];

  starClass(starIndex: number, value: number): 'full' | 'half' | 'empty' {
    if (value >= starIndex) return 'full';
    if (value >= starIndex - 0.5) return 'half';
    return 'empty';
  }

  private readonly TS_MIN = 18;
  private readonly TS_MAX = 32;

  getTSStars(ts: number | null | undefined): number {
    if (ts == null || !Number.isFinite(ts)) return 0;
    const normalized = Math.min(1, Math.max(0, (ts - this.TS_MIN) / (this.TS_MAX - this.TS_MIN)));
    return Math.round(normalized * 10) / 2;
  }

  formatDateMaybe(value?: string | Date | null): string {
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) return '';
      value = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    return this.regional.date(value);
  }

  private formatNumberMaybe(value: unknown, decimals = 2): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    return this.regional.number(value, decimals);
  }

  private formatIntegerMaybe(value: unknown): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    return this.regional.number(Math.round(value), 0, true);
  }

  showAllMatches(): void {
    if (this.isPreview) return;
    const tpId = this.vm?.overview?.playerTPId || this.playerTPId;

    if (!tpId) {
      console.error('❌ showAllMatches: missing playerTPId', {
        playerTPId: this.playerTPId,
        vm: this.vm
      });
      return;
    }

    // The modal can also be opened from this player's existing matches page.
    if (this.router.url.split(/[?#]/)[0] === `/players/matches/${tpId}`) {
      this.showCurrentMatches.emit();
      this.close();
      return;
    }

    console.log('➡️ Navigating to player matches route', {
      tpId,
      name: this.overviewName
    });

    console.log('🧭 Current router url before navigate:', this.router.url);

    this.router.navigate(['/players/matches', tpId])
      .then(ok => {
        console.log('✅ navigate resolved:', ok, 'new url:', this.router.url);

        if (ok) {
          this.close();
        } else {
          console.warn('⚠️ navigate returned false');
        }
      })
      .catch(err => {
        console.error('❌ Navigation to player matches failed:', err);
      });
  }

  surfaceButtonLabel(scope: SurfaceScope): string {
    switch (scope) {
      case 'ALL':
        return this.regional.text('playerStats.allSurfaces');
      case 'S1':
        return this.regional.text('surfaces.carpet');
      case 'S2':
        return this.regional.text('surfaces.clay');
      case 'S3':
        return this.regional.text('surfaces.grass');
      case 'S4':
        return this.regional.text('surfaces.hard');
      default:
        return scope;
    }
  }

  get hasHoveredTsPoint(): boolean {
    return this.hoveredTsIndex !== null && !!this.hoveredTsPoint;
  }

  get hoveredTsPointX(): number {
    const series = this.currentTsSeries;
    if (this.hoveredTsIndex === null || series.length < 2) return 0;

    const width = 760;
    return (this.hoveredTsIndex / (series.length - 1)) * width;
  }

  get hoveredTsPointY(): number {
    const point = this.hoveredTsPoint;
    if (!point) return 0;

    const height = 220;
    return height - ((point.mean - this.tsSeriesMin) / this.tsSeriesRange) * height;
  }
}

export function buildPlayerDetailsVm(raw: PlayerDetailsRaw): PlayerDetailsVm {
  return {
    overview: {
      playerTPId: raw.d001,
      playerTEId: raw.d229,
      name: raw.d002 || '',
      iso2: raw.d005 || '',
      iso3: raw.d004 || '',
      countryName: raw.d006 || '',
      continentName: raw.d008 || '',
      birthDateText: formatDate(raw.d009),
      ageText: formatAge(raw.d009),
      heightText: raw.d010 ? `${raw.d010} cm` : '',
      weightText: raw.d011 ? `${raw.d011} kg` : '',
      turnedProText: raw.d012 ? String(raw.d012) : '',
      playsText: raw.d014 || '',
      tourTypeText: mapTourType(raw.d015)
    },

    ts: {
      all: {
        M: { mode: 'M', scope: 'ALL', mean: raw.d016, sd: raw.d017 },
        SM: { mode: 'SM', scope: 'ALL', mean: raw.d018, sd: raw.d019 },
        GSM: { mode: 'GSM', scope: 'ALL', mean: raw.d020, sd: raw.d021 }
      },
      surfaces: {
        S1: {
          M: { mode: 'M', scope: 'S1', mean: raw.d022, sd: raw.d023 },
          SM: { mode: 'SM', scope: 'S1', mean: raw.d024, sd: raw.d025 },
          GSM: { mode: 'GSM', scope: 'S1', mean: raw.d026, sd: raw.d027 }
        },
        S2: {
          M: { mode: 'M', scope: 'S2', mean: raw.d028, sd: raw.d029 },
          SM: { mode: 'SM', scope: 'S2', mean: raw.d030, sd: raw.d031 },
          GSM: { mode: 'GSM', scope: 'S2', mean: raw.d032, sd: raw.d033 }
        },
        S3: {
          M: { mode: 'M', scope: 'S3', mean: raw.d034, sd: raw.d035 },
          SM: { mode: 'SM', scope: 'S3', mean: raw.d036, sd: raw.d037 },
          GSM: { mode: 'GSM', scope: 'S3', mean: raw.d038, sd: raw.d039 }
        },
        S4: {
          M: { mode: 'M', scope: 'S4', mean: raw.d040, sd: raw.d041 },
          SM: { mode: 'SM', scope: 'S4', mean: raw.d042, sd: raw.d043 },
          GSM: { mode: 'GSM', scope: 'S4', mean: raw.d044, sd: raw.d045 }
        }
      }
    },

    performance: {
      ALL: {
        match: stat(raw.d046, raw.d047),
        set: stat(raw.d086, raw.d087),
        game: stat(raw.d126, raw.d127)
      },
      YEAR: {
        match: stat(raw.d048, raw.d049),
        set: stat(raw.d088, raw.d089),
        game: stat(raw.d128, raw.d129)
      },
      MONTH: {
        match: stat(raw.d050, raw.d051),
        set: stat(raw.d090, raw.d091),
        game: stat(raw.d130, raw.d131)
      },
      WEEK: {
        match: stat(raw.d052, raw.d053),
        set: stat(raw.d092, raw.d093),
        game: stat(raw.d132, raw.d133)
      },

      S1: {
        ALL: { match: stat(raw.d054, raw.d055), set: stat(raw.d094, raw.d095), game: stat(raw.d134, raw.d135) },
        YEAR: { match: stat(raw.d056, raw.d057), set: stat(raw.d096, raw.d097), game: stat(raw.d136, raw.d137) },
        MONTH: { match: stat(raw.d058, raw.d059), set: stat(raw.d098, raw.d099), game: stat(raw.d138, raw.d139) },
        WEEK: { match: stat(raw.d060, raw.d061), set: stat(raw.d100, raw.d101), game: stat(raw.d140, raw.d141) }
      },

      S2: {
        ALL: { match: stat(raw.d062, raw.d063), set: stat(raw.d102, raw.d103), game: stat(raw.d142, raw.d143) },
        YEAR: { match: stat(raw.d064, raw.d065), set: stat(raw.d104, raw.d105), game: stat(raw.d144, raw.d145) },
        MONTH: { match: stat(raw.d066, raw.d067), set: stat(raw.d106, raw.d107), game: stat(raw.d146, raw.d147) },
        WEEK: { match: stat(raw.d068, raw.d069), set: stat(raw.d108, raw.d109), game: stat(raw.d148, raw.d149) }
      },

      S3: {
        ALL: { match: stat(raw.d070, raw.d071), set: stat(raw.d110, raw.d111), game: stat(raw.d150, raw.d151) },
        YEAR: { match: stat(raw.d072, raw.d073), set: stat(raw.d112, raw.d113), game: stat(raw.d152, raw.d153) },
        MONTH: { match: stat(raw.d074, raw.d075), set: stat(raw.d114, raw.d115), game: stat(raw.d154, raw.d155) },
        WEEK: { match: stat(raw.d076, raw.d077), set: stat(raw.d116, raw.d117), game: stat(raw.d156, raw.d157) }
      },

      S4: {
        ALL: { match: stat(raw.d078, raw.d079), set: stat(raw.d118, raw.d119), game: stat(raw.d158, raw.d159) },
        YEAR: { match: stat(raw.d080, raw.d081), set: stat(raw.d120, raw.d121), game: stat(raw.d160, raw.d161) },
        MONTH: { match: stat(raw.d082, raw.d083), set: stat(raw.d122, raw.d123), game: stat(raw.d162, raw.d163) },
        WEEK: { match: stat(raw.d084, raw.d085), set: stat(raw.d124, raw.d125), game: stat(raw.d164, raw.d165) }
      }
    },

    form: {
      ALL: { streak: raw.d224, lastWinDateText: formatDate(raw.d166), lastLossDateText: formatDate(raw.d171) },
      S1: { streak: raw.d225, lastWinDateText: formatDate(raw.d167), lastLossDateText: formatDate(raw.d172) },
      S2: { streak: raw.d226, lastWinDateText: formatDate(raw.d168), lastLossDateText: formatDate(raw.d173) },
      S3: { streak: raw.d227, lastWinDateText: formatDate(raw.d169), lastLossDateText: formatDate(raw.d174) },
      S4: { streak: raw.d228, lastWinDateText: formatDate(raw.d170), lastLossDateText: formatDate(raw.d175) }
    },

    roleStats: {
      ALL: {
        winsAsFavourite: raw.d176,
        winsAsUnderdog: raw.d177,
        lossesAsFavourite: raw.d178,
        lossesAsUnderdog: raw.d179,
        winsAsFavouriteRatio: raw.d180,
        lossesAsFavouriteRatio: raw.d181,
        winsAsUnderdogRatio: raw.d182,
        lossesAsUnderdogRatio: raw.d183,
        avgWpWonFav: raw.d184,
        avgWpWonDog: raw.d185,
        avgWpLostFav: raw.d186,
        avgWpLostDog: raw.d187
      },
      YEAR: {
        winsAsFavourite: raw.d188,
        winsAsUnderdog: raw.d189,
        lossesAsFavourite: raw.d190,
        lossesAsUnderdog: raw.d191,
        winsAsFavouriteRatio: raw.d192,
        lossesAsFavouriteRatio: raw.d193,
        winsAsUnderdogRatio: raw.d194,
        lossesAsUnderdogRatio: raw.d195,
        avgWpWonFav: raw.d196,
        avgWpWonDog: raw.d197,
        avgWpLostFav: raw.d198,
        avgWpLostDog: raw.d199
      },
      MONTH: {
        winsAsFavourite: raw.d200,
        winsAsUnderdog: raw.d201,
        lossesAsFavourite: raw.d202,
        lossesAsUnderdog: raw.d203,
        winsAsFavouriteRatio: raw.d204,
        lossesAsFavouriteRatio: raw.d205,
        winsAsUnderdogRatio: raw.d206,
        lossesAsUnderdogRatio: raw.d207,
        avgWpWonFav: raw.d208,
        avgWpWonDog: raw.d209,
        avgWpLostFav: raw.d210,
        avgWpLostDog: raw.d211
      },
      WEEK: {
        winsAsFavourite: raw.d212,
        winsAsUnderdog: raw.d213,
        lossesAsFavourite: raw.d214,
        lossesAsUnderdog: raw.d215,
        winsAsFavouriteRatio: raw.d216,
        lossesAsFavouriteRatio: raw.d217,
        winsAsUnderdogRatio: raw.d218,
        lossesAsUnderdogRatio: raw.d219,
        avgWpWonFav: raw.d220,
        avgWpWonDog: raw.d221,
        avgWpLostFav: raw.d222,
        avgWpLostDog: raw.d223
      }
    }
  };
}

function stat(wins: number, losses: number): WinLossStatVm {
  const total = wins + losses;
  return {
    wins,
    losses,
    total,
    winPct: total > 0 ? (wins / total) * 100 : 0
  };
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatAge(value?: string): string {
  if (!value) return '';
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return '';

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const month = now.getMonth() - birthDate.getMonth();

  if (month < 0 || (month === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }

  return `${age}`;
}

function mapTourType(v: number): string {
  if (v === 1) return 'ATP';
  if (v === 2) return 'WTA';
  return '';
}
