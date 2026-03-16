/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewEncapsulation
} from '@angular/core';
import { Subscription } from 'rxjs';

import { StaticArchivesService } from '@app/core/services/static-archives.service';
import { PlayerDetailsRaw } from '@app/core/models/player-details.model';
import { BbModalShellComponent } from '@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component';

type PlayerTab = 'overview' | 'ts' | 'performance' | 'form' | 'roleStats';
type TsMode = 'M' | 'SM' | 'GSM';
type SurfaceScope = 'ALL' | 'S1' | 'S2' | 'S3' | 'S4';
type PerfUnit = 'MATCH' | 'SET' | 'GAME';
type TimeScope = 'ALL' | 'YEAR' | 'MONTH' | 'WEEK';
type RoleTimeScope = 'ALL' | 'YEAR' | 'MONTH' | 'WEEK';

type RoleCountKey = 'winsFav' | 'winsDog' | 'lossesFav' | 'lossesDog';
type RoleRatioKey = 'winsFavRatio' | 'lossesFavRatio' | 'winsDogRatio' | 'lossesDogRatio';
type RoleAvgKey = 'avgWpWonFav' | 'avgWpWonDog' | 'avgWpLostFav' | 'avgWpLostDog';

@Component({
  selector: 'app-player-modal',
  standalone: true,
  imports: [CommonModule, BbModalShellComponent],
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

  loading = false;
  error: string | null = null;
  raw: PlayerDetailsRaw | null = null;

  activeTab: PlayerTab = 'overview';

  activeTsMode: TsMode = 'M';
  activeTsSurface: SurfaceScope = 'ALL';

  activePerfUnit: PerfUnit = 'MATCH';
  activePerfTime: TimeScope = 'ALL';
  activePerfSurface: SurfaceScope = 'ALL';

  activeFormSurface: SurfaceScope = 'ALL';

  activeRoleTime: RoleTimeScope = 'ALL';

  private sub?: Subscription;

  readonly surfaceOptions: Array<{ value: SurfaceScope; label: string }> = [
    { value: 'ALL', label: 'All Surfaces' },
    { value: 'S1', label: 'Carpet' },
    { value: 'S2', label: 'Clay' },
    { value: 'S3', label: 'Grass' },
    { value: 'S4', label: 'Hard' }
  ];

  constructor(public staticArchives: StaticArchivesService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['playerTPId']?.currentValue) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  close(): void {
    this.sub?.unsubscribe();
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

  // =========================================================================================
  // Basic helpers
  // =========================================================================================

  private numOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private str(value: unknown): string {
    return (value ?? '').toString().trim();
  }

  private key(n: number): string {
    return `d${String(n).padStart(3, '0')}`;
  }

  private getNum(n: number): number | null {
    return this.numOrNull(this.raw?.[this.key(n)]);
  }

  private getStr(n: number): string {
    return this.str(this.raw?.[this.key(n)]);
  }

  flagIso2OrEmpty(iso2: string): string {
    return (iso2 || '').trim().toLowerCase();
  }

  fmtNum(value: unknown, digits = 2): string {
    const n = this.numOrNull(value);
    return n == null ? '—' : n.toFixed(digits);
  }

  fmtDays(value: number | null): string {
    return value == null || value <= 0 ? '—' : `${value}`;
  }

  fmtPct01(value: number | null): string {
    return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
  }

  // =========================================================================================
  // Header / basic identity
  // =========================================================================================

  get playerName(): string {
    return this.getStr(2);
  }

  get countryIso3(): string {
    return this.getStr(4);
  }

  get countryIso2(): string {
    return this.getStr(5);
  }

  get countryFull(): string {
    return this.getStr(6);
  }

  get continentName(): string {
    return this.getStr(8);
  }

  get playsText(): string {
    return this.getStr(14);
  }

  get turnedProText(): string {
    const year = this.getNum(12);
    return year == null ? '' : String(year);
  }

  get tourLabel(): string {
    const id = this.getNum(15);

    if (id === 1) return 'ATP';
    if (id === 2) return 'WTA';

    return '';
  }

  get genderHint(): 'M' | 'W' {
    return this.tourLabel === 'WTA' ? 'W' : 'M';
  }

  get bornText(): string {
    const iso = this.raw?.[this.key(9)];
    if (!iso) return '';

    const d = new Date(String(iso));
    if (isNaN(d.getTime())) return '';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();

    const age = this.ageNow(d);
    return age == null ? `${dd}.${mm}.${yyyy}` : `${dd}.${mm}.${yyyy} (${age})`;
  }

  get heightText(): string {
    const h = this.getNum(10);
    return h == null ? '' : `${h} cm`;
  }

  get weightText(): string {
    const w = this.getNum(11);
    return w == null ? '' : `${w} kg`;
  }

  private ageNow(birthDate: Date): number | null {
    const now = new Date();

    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 0 && age < 120 ? age : null;
  }

  playerAvatarUrl(): string {
    return this.staticArchives.getPlayerPhotoUrl(this.playerTPId, this.genderHint);
  }

  onAvatarError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    img.src = this.staticArchives.getDefaultPlayerPhotoUrl(this.genderHint);
  }

  // =========================================================================================
  // Overview helpers
  // =========================================================================================

  wlText(wKey: number, lKey: number): string {
    const w = this.getNum(wKey);
    const l = this.getNum(lKey);

    if (w == null && l == null) return '—';
    return `${w ?? 0} / ${l ?? 0}`;
  }

  streakText(value: unknown): string {
    const n = this.numOrNull(value);
    if (n == null || n === 0) return '—';

    if (n > 0) return `W${n}`;
    return `L${Math.abs(n)}`;
  }

  // =========================================================================================
  // TrueSkill
  // =========================================================================================

  private readonly tsKeyMap: Record<TsMode, Record<SurfaceScope, { mean: number; sd: number }>> = {
    M: {
      ALL: { mean: 16, sd: 17 },
      S1: { mean: 22, sd: 23 },
      S2: { mean: 28, sd: 29 },
      S3: { mean: 34, sd: 35 },
      S4: { mean: 40, sd: 41 }
    },
    SM: {
      ALL: { mean: 18, sd: 19 },
      S1: { mean: 24, sd: 25 },
      S2: { mean: 30, sd: 31 },
      S3: { mean: 36, sd: 37 },
      S4: { mean: 42, sd: 43 }
    },
    GSM: {
      ALL: { mean: 20, sd: 21 },
      S1: { mean: 26, sd: 27 },
      S2: { mean: 32, sd: 33 },
      S3: { mean: 38, sd: 39 },
      S4: { mean: 44, sd: 45 }
    }
  };

  tsMean(): number | null {
    const cfg = this.tsKeyMap[this.activeTsMode][this.activeTsSurface];
    return this.getNum(cfg.mean);
  }

  tsSd(): number | null {
    const cfg = this.tsKeyMap[this.activeTsMode][this.activeTsSurface];
    return this.getNum(cfg.sd);
  }

  // =========================================================================================
  // Performance
  // =========================================================================================

  private readonly perfKeyMap: Record<PerfUnit, Record<SurfaceScope, Record<TimeScope, { w: number; l: number }>>> = {
    MATCH: {
      ALL: {
        ALL: { w: 46, l: 47 },
        YEAR: { w: 48, l: 49 },
        MONTH: { w: 50, l: 51 },
        WEEK: { w: 52, l: 53 }
      },
      S1: {
        ALL: { w: 54, l: 55 },
        YEAR: { w: 56, l: 57 },
        MONTH: { w: 58, l: 59 },
        WEEK: { w: 60, l: 61 }
      },
      S2: {
        ALL: { w: 62, l: 63 },
        YEAR: { w: 64, l: 65 },
        MONTH: { w: 66, l: 67 },
        WEEK: { w: 68, l: 69 }
      },
      S3: {
        ALL: { w: 70, l: 71 },
        YEAR: { w: 72, l: 73 },
        MONTH: { w: 74, l: 75 },
        WEEK: { w: 76, l: 77 }
      },
      S4: {
        ALL: { w: 78, l: 79 },
        YEAR: { w: 80, l: 81 },
        MONTH: { w: 82, l: 83 },
        WEEK: { w: 84, l: 85 }
      }
    },
    SET: {
      ALL: {
        ALL: { w: 86, l: 87 },
        YEAR: { w: 88, l: 89 },
        MONTH: { w: 90, l: 91 },
        WEEK: { w: 92, l: 93 }
      },
      S1: {
        ALL: { w: 94, l: 95 },
        YEAR: { w: 96, l: 97 },
        MONTH: { w: 98, l: 99 },
        WEEK: { w: 100, l: 101 }
      },
      S2: {
        ALL: { w: 102, l: 103 },
        YEAR: { w: 104, l: 105 },
        MONTH: { w: 106, l: 107 },
        WEEK: { w: 108, l: 109 }
      },
      S3: {
        ALL: { w: 110, l: 111 },
        YEAR: { w: 112, l: 113 },
        MONTH: { w: 114, l: 115 },
        WEEK: { w: 116, l: 117 }
      },
      S4: {
        ALL: { w: 118, l: 119 },
        YEAR: { w: 120, l: 121 },
        MONTH: { w: 122, l: 123 },
        WEEK: { w: 124, l: 125 }
      }
    },
    GAME: {
      ALL: {
        ALL: { w: 126, l: 127 },
        YEAR: { w: 128, l: 129 },
        MONTH: { w: 130, l: 131 },
        WEEK: { w: 132, l: 133 }
      },
      S1: {
        ALL: { w: 134, l: 135 },
        YEAR: { w: 136, l: 137 },
        MONTH: { w: 138, l: 139 },
        WEEK: { w: 140, l: 141 }
      },
      S2: {
        ALL: { w: 142, l: 143 },
        YEAR: { w: 144, l: 145 },
        MONTH: { w: 146, l: 147 },
        WEEK: { w: 148, l: 149 }
      },
      S3: {
        ALL: { w: 150, l: 151 },
        YEAR: { w: 152, l: 153 },
        MONTH: { w: 154, l: 155 },
        WEEK: { w: 156, l: 157 }
      },
      S4: {
        ALL: { w: 158, l: 159 },
        YEAR: { w: 160, l: 161 },
        MONTH: { w: 162, l: 163 },
        WEEK: { w: 164, l: 165 }
      }
    }
  };

  perfWins(): number {
    const cfg = this.perfKeyMap[this.activePerfUnit][this.activePerfSurface][this.activePerfTime];
    return this.getNum(cfg.w) ?? 0;
  }

  perfLosses(): number {
    const cfg = this.perfKeyMap[this.activePerfUnit][this.activePerfSurface][this.activePerfTime];
    return this.getNum(cfg.l) ?? 0;
  }

  perfWinPct(): string {
    const w = this.perfWins();
    const l = this.perfLosses();
    const total = w + l;

    if (total <= 0) return '—';
    return `${((w / total) * 100).toFixed(1)}%`;
  }

  // =========================================================================================
  // Form
  // =========================================================================================

  private readonly formKeyMap: Record<SurfaceScope, { win: number; loss: number; streak: number }> = {
    ALL: { win: 166, loss: 171, streak: 224 },
    S1: { win: 167, loss: 172, streak: 225 },
    S2: { win: 168, loss: 173, streak: 226 },
    S3: { win: 169, loss: 174, streak: 227 },
    S4: { win: 170, loss: 175, streak: 228 }
  };

  daysSinceLastWin(): number | null {
    return this.getNum(this.formKeyMap[this.activeFormSurface].win);
  }

  daysSinceLastLoss(): number | null {
    return this.getNum(this.formKeyMap[this.activeFormSurface].loss);
  }

  daysSinceLastMatch(): number | null {
    const w = this.daysSinceLastWin();
    const l = this.daysSinceLastLoss();

    if (w == null && l == null) return null;
    if (w == null) return l;
    if (l == null) return w;

    return Math.min(w, l);
  }

  moreRecentWas(): string {
    const w = this.daysSinceLastWin();
    const l = this.daysSinceLastLoss();

    if (w == null && l == null) return 'N/A';
    if (w == null) return 'LOSS';
    if (l == null) return 'WIN';

    return w <= l ? 'WIN' : 'LOSS';
  }

  formSurfaceStreak(): number | null {
    return this.getNum(this.formKeyMap[this.activeFormSurface].streak);
  }

  // =========================================================================================
  // Role Stats
  // =========================================================================================

  private readonly roleKeyMap: Record<RoleTimeScope, {
    winsFav: number;
    winsDog: number;
    lossesFav: number;
    lossesDog: number;
    winsFavRatio: number;
    lossesFavRatio: number;
    winsDogRatio: number;
    lossesDogRatio: number;
    avgWpWonFav: number;
    avgWpWonDog: number;
    avgWpLostFav: number;
    avgWpLostDog: number;
  }> = {
    ALL: {
      winsFav: 176,
      winsDog: 177,
      lossesFav: 178,
      lossesDog: 179,
      winsFavRatio: 180,
      lossesFavRatio: 181,
      winsDogRatio: 182,
      lossesDogRatio: 183,
      avgWpWonFav: 184,
      avgWpWonDog: 185,
      avgWpLostFav: 186,
      avgWpLostDog: 187
    },
    YEAR: {
      winsFav: 188,
      winsDog: 189,
      lossesFav: 190,
      lossesDog: 191,
      winsFavRatio: 192,
      lossesFavRatio: 193,
      winsDogRatio: 194,
      lossesDogRatio: 195,
      avgWpWonFav: 196,
      avgWpWonDog: 197,
      avgWpLostFav: 198,
      avgWpLostDog: 199
    },
    MONTH: {
      winsFav: 200,
      winsDog: 201,
      lossesFav: 202,
      lossesDog: 203,
      winsFavRatio: 204,
      lossesFavRatio: 205,
      winsDogRatio: 206,
      lossesDogRatio: 207,
      avgWpWonFav: 208,
      avgWpWonDog: 209,
      avgWpLostFav: 210,
      avgWpLostDog: 211
    },
    WEEK: {
      winsFav: 212,
      winsDog: 213,
      lossesFav: 214,
      lossesDog: 215,
      winsFavRatio: 216,
      lossesFavRatio: 217,
      winsDogRatio: 218,
      lossesDogRatio: 219,
      avgWpWonFav: 220,
      avgWpWonDog: 221,
      avgWpLostFav: 222,
      avgWpLostDog: 223
    }
  };

  roleCount(key: RoleCountKey): number {
    const dtoKey = this.roleKeyMap[this.activeRoleTime][key];
    return this.getNum(dtoKey) ?? 0;
  }

  roleRatio(key: RoleRatioKey): number | null {
    const dtoKey = this.roleKeyMap[this.activeRoleTime][key];
    return this.getNum(dtoKey);
  }

  roleAvg(key: RoleAvgKey): number | null {
    const dtoKey = this.roleKeyMap[this.activeRoleTime][key];
    return this.getNum(dtoKey);
  }
}