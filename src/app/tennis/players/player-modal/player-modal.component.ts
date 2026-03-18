/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BbModalShellComponent } from '@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component';
import { Subscription } from 'rxjs';

import {
  PlayerDetailsRaw,
  PlayerDetailsVm,
  PlayerDetailsTab,
  RatingMode,
  SurfaceScope,
  WinLossStatVm
} from 'src/app/core/models/player-details.model';
import { PlayerIndex } from '@app/core/models/tennis.model';

@Component({
  selector: 'app-player-modal',
  standalone: true,
  imports: [CommonModule, BbModalShellComponent],
  templateUrl: './player-modal.component.html',
  styleUrls: ['./player-modal.component.scss']
})
export class PlayerModalComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() playerTPId!: number;
  @Input() genderHint: 'M' | 'W' = 'M';

  @Output() closed = new EventEmitter<void>();

  activeTab: PlayerDetailsTab = 'overview';

  loading = false;
  error: string | null = null;

  raw: PlayerDetailsRaw | null = null;
  vm: PlayerDetailsVm | null = null;

  ratingMode: RatingMode = 'M';
  surfaceScope: SurfaceScope = 'ALL';

  private detailsSub?: Subscription;
  staticArchives: any;

  playerIndex: PlayerIndex | null = null;

  ngOnChanges(): void {
    if (this.isOpen && this.playerTPId) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.detailsSub?.unsubscribe();
  }

  close(): void {
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
    this.activeTab = tab;
  }

  private load(): void {
    if (!this.isOpen || !this.playerTPId) return;

    this.loading = true;
    this.error = null;
    this.raw = null;
    this.vm = null;

    // TEMP:
    // ovdje kasnije ide pravi service call
    // this.detailsSub = this.staticArchives.getPlayerDetails(this.playerTPId).subscribe(...)

    try {
      // placeholder dok ne spojimo service
      this.loading = false;
      this.raw = null;
      this.vm = null;
      this.error = null;
    } catch {
      this.loading = false;
      this.error = 'Could not load player details.';
    }
  }

  flagIso2OrEmpty(iso2?: string): string {
    return (iso2 || '').trim().toLowerCase();
  }

  playerAvatarUrlById(tpId?: number): string {
    if (!tpId) return this.staticArchives.getDefaultPlayerPhotoUrl(this.genderHint);
    // šaljemo gender hint kao query param da backend zna koji default vratiti kad nema slike
    return 'https://bonzobyte-backend.onrender.com/api/archives/players/photo/483767';
  }

  onAvatarError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    img.src = this.staticArchives.getDefaultPlayerPhotoUrl(this.genderHint === 'W' ? 'W' : 'M');
  }

  get countryText(): string {
    return this.vm?.overview?.countryName
      || this.playerIndex?.countryFull
      || '';
  }
  
  get bornText(): string {
    return this.vm?.overview?.birthDateText
      || this.formatDateMaybe(this.playerIndex?.playerBirthDate)
      || '';
  }
  
  get playsText(): string {
    return this.vm?.overview?.playsText
      || this.playerIndex?.playsName
      || '';
  }
  
  get heightText(): string {
    if (this.vm?.overview?.heightText) return this.vm.overview.heightText;
    const h = this.playerIndex?.playerHeight;
    return (typeof h === 'number' && Number.isFinite(h)) ? `${h} cm` : '';
  }
  
  get weightText(): string {
    if (this.vm?.overview?.weightText) return this.vm.overview.weightText;
    const w = this.playerIndex?.playerWeight;
    return (typeof w === 'number' && Number.isFinite(w)) ? `${w} kg` : '';
  }
  
  get turnedProText(): string {
    if (this.vm?.overview?.turnedProText) return this.vm.overview.turnedProText;
    const y = this.playerIndex?.playerTurnedPro;
    return (typeof y === 'number' && Number.isFinite(y)) ? `${y}` : '';
  }

  formatDateMaybe(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
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
  return date.toLocaleDateString();
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