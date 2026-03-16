/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { PlayerSummaryCardComponent } from '../player-summary-card/player-summary-card.component';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  OnDestroy,
  ViewEncapsulation
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { StaticArchivesService } from '@app/core/services/static-archives.service';
import { BbModalShellComponent } from '@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component';

type PlayerTab = 'overview' | 'ts' | 'performance' | 'form' | 'roleStats';
type TsMode = 'M' | 'SM' | 'GSM';
type PerfUnit = 'MATCH' | 'SET' | 'GAME';
type TimeScope = 'ALL' | 'YEAR' | 'MONTH' | 'WEEK';
type SurfaceScope = 'ALL' | 'S1' | 'S2' | 'S3' | 'S4';
type RoleTimeScope = 'ALL' | 'YEAR' | 'MONTH' | 'WEEK';

type PlayerDetailsRaw = Record<string, any>;

@Component({
  selector: 'app-player-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BbModalShellComponent, PlayerSummaryCardComponent],
  templateUrl: './player-modal.component.html',
  styleUrls: [
    '../../matches/match-details-modal/match-details-modal.component.scss',
    './player-modal.component.scss'
  ],
  encapsulation: ViewEncapsulation.None
})
export class PlayerModalComponent implements OnChanges, OnDestroy {
  @Input() playerTPId!: number;
  @Output() closed = new EventEmitter<void>();

  activeTab: PlayerTab = 'overview';

  activeTsMode: TsMode = 'M';
  activeTsSurface: SurfaceScope = 'ALL';

  activePerfUnit: PerfUnit = 'MATCH';
  activePerfTime: TimeScope = 'ALL';
  activePerfSurface: SurfaceScope = 'ALL';

  activeFormSurface: SurfaceScope = 'ALL';
  activeRoleTime: RoleTimeScope = 'ALL';

  loading = false;
  error: string | null = null;
  raw: PlayerDetailsRaw | null = null;

  private sub?: Subscription;

  readonly surfaceOptions = [
    { value: 'ALL' as SurfaceScope, label: 'All Surfaces' },
    { value: 'S1' as SurfaceScope, label: 'Carpet' },
    { value: 'S2' as SurfaceScope, label: 'Clay' },
    { value: 'S3' as SurfaceScope, label: 'Grass' },
    { value: 'S4' as SurfaceScope, label: 'Hard' }
  ];

  constructor(public staticArchives: StaticArchivesService) { }

  ngOnChanges(): void {
    if (this.playerTPId) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  close(): void {
    this.closed.emit();
  }

  setTab(tab: PlayerTab): void {
    this.activeTab = tab;
  }

  load(): void {
    if (!this.playerTPId) return;
  
    this.sub?.unsubscribe();
    this.loading = true;
    this.error = null;
    this.raw = null;
  
    this.sub = this.staticArchives.getPlayerDetails(this.playerTPId).subscribe({
      next: (data: PlayerDetailsRaw | null) => {
        if (!data) {
          this.error = 'Player details archive is empty.';
          this.loading = false;
          return;
        }
  
        this.raw = data;
        this.loading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.error = 'Could not load player details.';
        this.loading = false;
      }
    });
  }

  // ------------------------------------------------------------------------------------------------
  // Header / profile
  // ------------------------------------------------------------------------------------------------

  get playerName(): string {
    return this.safeText(this.raw?.['d002']);
  }

  get countryIso3(): string {
    return this.safeText(this.raw?.['d004'], '');
  }

  get countryIso2(): string {
    return this.safeText(this.raw?.['d005'], '');
  }

  get countryFull(): string {
    return this.safeText(this.raw?.['d006'], '');
  }

  get continentName(): string {
    return this.safeText(this.raw?.['d008'], '');
  }

  get bornText(): string {
    return this.formatBornWithAge(this.raw?.['d009']);
  }

  get heightText(): string {
    const n = this.numOrNull(this.raw?.['d010']);
    return n != null ? `${n} cm` : '';
  }

  get weightText(): string {
    const n = this.numOrNull(this.raw?.['d011']);
    return n != null ? `${n} kg` : '';
  }

  get turnedProText(): string {
    const n = this.numOrNull(this.raw?.['d012']);
    return n != null ? String(n) : '';
  }

  get playsText(): string {
    const s = this.safeText(this.raw?.['d014'], '');
    return s && s.toLowerCase() !== 'unknown' ? s : '';
  }

  get tourLabel(): string {
    const id = this.numOrNull(this.raw?.['d015']);
    if (id === 1) return 'ATP';
    if (id === 2) return 'WTA';
    return '';
  }

  flagIso2OrEmpty(iso2: string): string {
    return (iso2 || '').trim().toLowerCase();
  }

  // ------------------------------------------------------------------------------------------------
  // TS
  // ------------------------------------------------------------------------------------------------

  tsMean(): number | null {
    return this.readTs(this.activeTsMode, this.activeTsSurface, 'mean');
  }

  tsSd(): number | null {
    return this.readTs(this.activeTsMode, this.activeTsSurface, 'sd');
  }

  private readTs(mode: TsMode, surface: SurfaceScope, metric: 'mean' | 'sd'): number | null {
    const key = this.tsKey(mode, surface, metric);
    return this.numOrNull(this.raw?.[key]);
  }

  private tsKey(mode: TsMode, surface: SurfaceScope, metric: 'mean' | 'sd'): string {
    const allMap: Record<TsMode, [string, string]> = {
      M: ['d016', 'd017'],
      SM: ['d018', 'd019'],
      GSM: ['d020', 'd021']
    };

    const s1Map: Record<TsMode, [string, string]> = {
      M: ['d022', 'd023'],
      SM: ['d024', 'd025'],
      GSM: ['d026', 'd027']
    };

    const s2Map: Record<TsMode, [string, string]> = {
      M: ['d028', 'd029'],
      SM: ['d030', 'd031'],
      GSM: ['d032', 'd033']
    };

    const s3Map: Record<TsMode, [string, string]> = {
      M: ['d034', 'd035'],
      SM: ['d036', 'd037'],
      GSM: ['d038', 'd039']
    };

    const s4Map: Record<TsMode, [string, string]> = {
      M: ['d040', 'd041'],
      SM: ['d042', 'd043'],
      GSM: ['d044', 'd045']
    };

    const mapBySurface: Record<SurfaceScope, Record<TsMode, [string, string]>> = {
      ALL: allMap,
      S1: s1Map,
      S2: s2Map,
      S3: s3Map,
      S4: s4Map
    };

    const pair = mapBySurface[surface][mode];
    return metric === 'mean' ? pair[0] : pair[1];
  }

  // ------------------------------------------------------------------------------------------------
  // Performance
  // ------------------------------------------------------------------------------------------------

  perfWins(): number {
    return this.perfValue('W');
  }

  perfLosses(): number {
    return this.perfValue('L');
  }

  perfWinPct(): string {
    const w = this.perfWins();
    const l = this.perfLosses();
    const total = w + l;
    return total > 0 ? `${((w / total) * 100).toFixed(1)}%` : '—';
  }

  private perfValue(metric: 'W' | 'L'): number {
    const baseByUnit: Record<PerfUnit, number> = {
      MATCH: 46,
      SET: 86,
      GAME: 126
    };

    const surfaceOffsetBySurface: Record<SurfaceScope, number> = {
      ALL: 0,
      S1: 8,
      S2: 16,
      S3: 24,
      S4: 32
    };

    const timeOffsetByTime: Record<TimeScope, number> = {
      ALL: 0,
      YEAR: 2,
      MONTH: 4,
      WEEK: 6
    };

    const metricOffset = metric === 'W' ? 0 : 1;
    const idx =
      baseByUnit[this.activePerfUnit] +
      surfaceOffsetBySurface[this.activePerfSurface] +
      timeOffsetByTime[this.activePerfTime] +
      metricOffset;

    const key = `d${String(idx).padStart(3, '0')}`;
    return this.numOrNull(this.raw?.[key]) ?? 0;
  }

  // ------------------------------------------------------------------------------------------------
  // Form
  // ------------------------------------------------------------------------------------------------

  daysSinceLastWin(): number {
    const key = this.formKey('WIN', this.activeFormSurface);
    return this.numOrNull(this.raw?.[key]) ?? 0;
  }

  daysSinceLastLoss(): number {
    const key = this.formKey('LOSS', this.activeFormSurface);
    return this.numOrNull(this.raw?.[key]) ?? 0;
  }

  daysSinceLastMatch(): number {
    const w = this.daysSinceLastWin();
    const l = this.daysSinceLastLoss();

    if (!w && !l) return 0;
    if (!w) return l;
    if (!l) return w;
    return Math.min(w, l);
  }

  moreRecentWas(): 'WIN' | 'LOSS' | 'N/A' {
    const w = this.daysSinceLastWin();
    const l = this.daysSinceLastLoss();

    if (!w && !l) return 'N/A';
    if (!w) return 'LOSS';
    if (!l) return 'WIN';

    return w <= l ? 'WIN' : 'LOSS';
  }

  formSurfaceStreak(): number | null {
    const keyBySurface: Record<SurfaceScope, string> = {
      ALL: 'd224',
      S1: 'd225',
      S2: 'd226',
      S3: 'd227',
      S4: 'd228'
    };
    return this.numOrNull(this.raw?.[keyBySurface[this.activeFormSurface]]);
  }

  private formKey(kind: 'WIN' | 'LOSS', surface: SurfaceScope): string {
    const winMap: Record<SurfaceScope, string> = {
      ALL: 'd166',
      S1: 'd167',
      S2: 'd168',
      S3: 'd169',
      S4: 'd170'
    };

    const lossMap: Record<SurfaceScope, string> = {
      ALL: 'd171',
      S1: 'd172',
      S2: 'd173',
      S3: 'd174',
      S4: 'd175'
    };

    return kind === 'WIN' ? winMap[surface] : lossMap[surface];
  }

  // ------------------------------------------------------------------------------------------------
  // Role stats
  // ------------------------------------------------------------------------------------------------

  roleCount(kind: 'winsFav' | 'winsDog' | 'lossesFav' | 'lossesDog'): number {
    const key = this.roleKey(kind);
    return this.numOrNull(this.raw?.[key]) ?? 0;
  }

  roleRatio(kind: 'winsFavRatio' | 'winsDogRatio' | 'lossesFavRatio' | 'lossesDogRatio'): number | null {
    const key = this.roleKey(kind);
    return this.numOrNull(this.raw?.[key]);
  }

  roleAvg(kind: 'avgWpWonFav' | 'avgWpWonDog' | 'avgWpLostFav' | 'avgWpLostDog'): number | null {
    const key = this.roleKey(kind);
    return this.numOrNull(this.raw?.[key]);
  }

  private roleKey(
    kind:
      | 'winsFav'
      | 'winsDog'
      | 'lossesFav'
      | 'lossesDog'
      | 'winsFavRatio'
      | 'lossesFavRatio'
      | 'winsDogRatio'
      | 'lossesDogRatio'
      | 'avgWpWonFav'
      | 'avgWpWonDog'
      | 'avgWpLostFav'
      | 'avgWpLostDog'
  ): string {
    const baseByTime: Record<RoleTimeScope, number> = {
      ALL: 176,
      YEAR: 188,
      MONTH: 200,
      WEEK: 212
    };

    const offsetByKind = {
      winsFav: 0,
      winsDog: 1,
      lossesFav: 2,
      lossesDog: 3,
      winsFavRatio: 4,
      lossesFavRatio: 5,
      winsDogRatio: 6,
      lossesDogRatio: 7,
      avgWpWonFav: 8,
      avgWpWonDog: 9,
      avgWpLostFav: 10,
      avgWpLostDog: 11
    } as const;

    const idx = baseByTime[this.activeRoleTime] + offsetByKind[kind];
    return `d${String(idx).padStart(3, '0')}`;
  }

  // ------------------------------------------------------------------------------------------------
  // Shared helpers
  // ------------------------------------------------------------------------------------------------

  wlText(wIndex: number, lIndex: number): string {
    const wKey = `d${String(wIndex).padStart(3, '0')}`;
    const lKey = `d${String(lIndex).padStart(3, '0')}`;
    const w = this.numOrNull(this.raw?.[wKey]) ?? 0;
    const l = this.numOrNull(this.raw?.[lKey]) ?? 0;
    return `${w} / ${l}`;
  }

  streakText(v: number | null | undefined): string {
    if (v == null || !Number.isFinite(v) || v === 0) return '—';
    if (v > 0) return `W${v}`;
    return `L${Math.abs(v)}`;
  }

  fmtDays(v: number | null | undefined): string {
    if (v == null || !Number.isFinite(v) || v <= 0) return '—';
    return `${v}`;
  }

  fmtPct01(v: number | null | undefined): string {
    if (v == null || !Number.isFinite(v)) return '—';
    return `${(v * 100).toFixed(1)}%`;
  }

  fmtNum(v: any, digits = 2): string {
    const n = this.numOrNull(v);
    return n == null ? '—' : n.toFixed(digits);
  }

  private numOrNull(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private safeText(v: any, fallback = '—'): string {
    const s = (v ?? '').toString().trim();
    return s.length ? s : fallback;
  }

  private formatBornWithAge(birthIso: any): string {
    if (!birthIso) return '';
    const b = new Date(birthIso);
    if (isNaN(b.getTime())) return '';

    const dd = String(b.getDate()).padStart(2, '0');
    const mm = String(b.getMonth() + 1).padStart(2, '0');
    const yyyy = b.getFullYear();

    const age = this.ageNow(b);
    return age != null ? `${dd}.${mm}.${yyyy} (${age})` : `${dd}.${mm}.${yyyy}`;
  }

  private ageNow(b: Date): number | null {
    const now = new Date();
    if (isNaN(b.getTime())) return null;

    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age >= 0 && age < 120 ? age : null;
  }

  get genderHint(): 'M' | 'W' {
  return this.tourLabel === 'WTA' ? 'W' : 'M';
}

playerAvatarUrl(): string {
  return this.staticArchives.getPlayerPhotoUrl(this.playerTPId, this.genderHint);
}

onAvatarError(ev: Event): void {
  const img = ev.target as HTMLImageElement;
  img.src = this.staticArchives.getDefaultPlayerPhotoUrl(this.genderHint);
}
}