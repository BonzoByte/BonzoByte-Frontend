export type PlayerDetailsTab =
  | 'overview'
  | 'ts'
  | 'performance';

export type SurfaceScope = 'ALL' | 'S1' | 'S2' | 'S3' | 'S4';
export type TimeScope = 'ALL' | 'YEAR' | 'MONTH' | 'WEEK';
export type RatingMode = 'M' | 'SM' | 'GSM';

export interface PlayerDetailsRaw {
  d001: number;      // PlayerTPId
  d002: string;      // PlayerName
  d003: number;      // CountryTPId
  d004: string;      // CountryISO3
  d005: string;      // CountryISO2
  d006: string;      // CountryFull
  d007: number;      // ContinentId
  d008: string;      // ContinentName
  d009?: string;     // PlayerBirthDate
  d010?: number;     // PlayerHeight
  d011?: number;     // PlayerWeight
  d012?: number;     // PlayerTurnedPro
  d013?: number;     // PlaysId
  d014?: string;     // PlaysName
  d015: number;      // TournamentTypeId

  d016: number; d017: number;
  d018: number; d019: number;
  d020: number; d021: number;
  d022: number; d023: number;
  d024: number; d025: number;
  d026: number; d027: number;
  d028: number; d029: number;
  d030: number; d031: number;
  d032: number; d033: number;
  d034: number; d035: number;
  d036: number; d037: number;
  d038: number; d039: number;
  d040: number; d041: number;
  d042: number; d043: number;
  d044: number; d045: number;

  d046: number; d047: number;
  d048: number; d049: number;
  d050: number; d051: number;
  d052: number; d053: number;

  d054: number; d055: number;
  d056: number; d057: number;
  d058: number; d059: number;
  d060: number; d061: number;

  d062: number; d063: number;
  d064: number; d065: number;
  d066: number; d067: number;
  d068: number; d069: number;

  d070: number; d071: number;
  d072: number; d073: number;
  d074: number; d075: number;
  d076: number; d077: number;

  d078: number; d079: number;
  d080: number; d081: number;
  d082: number; d083: number;
  d084: number; d085: number;

  d086: number; d087: number;
  d088: number; d089: number;
  d090: number; d091: number;
  d092: number; d093: number;

  d094: number; d095: number;
  d096: number; d097: number;
  d098: number; d099: number;
  d100: number; d101: number;

  d102: number; d103: number;
  d104: number; d105: number;
  d106: number; d107: number;
  d108: number; d109: number;

  d110: number; d111: number;
  d112: number; d113: number;
  d114: number; d115: number;
  d116: number; d117: number;

  d118: number; d119: number;
  d120: number; d121: number;
  d122: number; d123: number;
  d124: number; d125: number;

  d126: number; d127: number;
  d128: number; d129: number;
  d130: number; d131: number;
  d132: number; d133: number;

  d134: number; d135: number;
  d136: number; d137: number;
  d138: number; d139: number;
  d140: number; d141: number;

  d142: number; d143: number;
  d144: number; d145: number;
  d146: number; d147: number;
  d148: number; d149: number;

  d150: number; d151: number;
  d152: number; d153: number;
  d154: number; d155: number;
  d156: number; d157: number;

  d158: number; d159: number;
  d160: number; d161: number;
  d162: number; d163: number;
  d164: number; d165: number;

  d166?: string;
  d167?: string;
  d168?: string;
  d169?: string;
  d170?: string;
  d171?: string;
  d172?: string;
  d173?: string;
  d174?: string;
  d175?: string;

  d176: number; d177: number; d178: number; d179: number;
  d180?: number; d181?: number; d182?: number; d183?: number;
  d184?: number; d185?: number; d186?: number; d187?: number;

  d188: number; d189: number; d190: number; d191: number;
  d192?: number; d193?: number; d194?: number; d195?: number;
  d196?: number; d197?: number; d198?: number; d199?: number;

  d200: number; d201: number; d202: number; d203: number;
  d204?: number; d205?: number; d206?: number; d207?: number;
  d208?: number; d209?: number; d210?: number; d211?: number;

  d212: number; d213: number; d214: number; d215: number;
  d216?: number; d217?: number; d218?: number; d219?: number;
  d220?: number; d221?: number; d222?: number; d223?: number;

  d224: number;
  d225: number;
  d226: number;
  d227: number;
  d228: number;

  d229?: number; // PlayerTEId
}

export interface PlayerOverviewVm {
  playerTPId: number;
  playerTEId?: number;
  name: string;
  iso2: string;
  iso3: string;
  countryName: string;
  continentName: string;
  birthDateText: string;
  ageText: string;
  heightText: string;
  weightText: string;
  turnedProText: string;
  playsText: string;
  tourTypeText: string;
}

export interface PlayerTsSnapshotVm {
  mode: RatingMode;
  scope: SurfaceScope;
  mean: number;
  sd: number;
  winProbability?: number;
}

export interface WinLossStatVm {
  wins: number;
  losses: number;
  total: number;
  winPct: number;
}

export interface PlayerPerformanceBlockVm {
  match: WinLossStatVm;
  set: WinLossStatVm;
  game: WinLossStatVm;
}

export interface PlayerRoleStatsVm {
  winsAsFavourite: number;
  winsAsUnderdog: number;
  lossesAsFavourite: number;
  lossesAsUnderdog: number;
  winsAsFavouriteRatio?: number;
  lossesAsFavouriteRatio?: number;
  winsAsUnderdogRatio?: number;
  lossesAsUnderdogRatio?: number;
  avgWpWonFav?: number;
  avgWpWonDog?: number;
  avgWpLostFav?: number;
  avgWpLostDog?: number;
}

export interface PlayerFormVm {
  streak: number;
  lastWinDateText: string;
  lastLossDateText: string;
}

export interface PlayerDetailsVm {
  overview: PlayerOverviewVm;
  ts: {
    all: {
      M: PlayerTsSnapshotVm;
      SM: PlayerTsSnapshotVm;
      GSM: PlayerTsSnapshotVm;
    };
    surfaces: Record<'S1' | 'S2' | 'S3' | 'S4', {
      M: PlayerTsSnapshotVm;
      SM: PlayerTsSnapshotVm;
      GSM: PlayerTsSnapshotVm;
    }>;
  };
  performance: {
    ALL: PlayerPerformanceBlockVm;
    YEAR: PlayerPerformanceBlockVm;
    MONTH: PlayerPerformanceBlockVm;
    WEEK: PlayerPerformanceBlockVm;
    S1: {
      ALL: PlayerPerformanceBlockVm;
      YEAR: PlayerPerformanceBlockVm;
      MONTH: PlayerPerformanceBlockVm;
      WEEK: PlayerPerformanceBlockVm;
    };
    S2: {
      ALL: PlayerPerformanceBlockVm;
      YEAR: PlayerPerformanceBlockVm;
      MONTH: PlayerPerformanceBlockVm;
      WEEK: PlayerPerformanceBlockVm;
    };
    S3: {
      ALL: PlayerPerformanceBlockVm;
      YEAR: PlayerPerformanceBlockVm;
      MONTH: PlayerPerformanceBlockVm;
      WEEK: PlayerPerformanceBlockVm;
    };
    S4: {
      ALL: PlayerPerformanceBlockVm;
      YEAR: PlayerPerformanceBlockVm;
      MONTH: PlayerPerformanceBlockVm;
      WEEK: PlayerPerformanceBlockVm;
    };
  };
  form: {
    ALL: PlayerFormVm;
    S1: PlayerFormVm;
    S2: PlayerFormVm;
    S3: PlayerFormVm;
    S4: PlayerFormVm;
  };
  roleStats: {
    ALL: PlayerRoleStatsVm;
    YEAR: PlayerRoleStatsVm;
    MONTH: PlayerRoleStatsVm;
    WEEK: PlayerRoleStatsVm;
  };
}

export interface PlayerTsHistoryPointRaw {
  m: number; // MatchTPId
  d: string; // DateTime
  t: number; // Mean
  s: number; // SD
}

export type PlayerTsHistorySeriesKey =
  | 'M_ALL' | 'M_S1' | 'M_S2' | 'M_S3' | 'M_S4'
  | 'SM_ALL' | 'SM_S1' | 'SM_S2' | 'SM_S3' | 'SM_S4'
  | 'GSM_ALL' | 'GSM_S1' | 'GSM_S2' | 'GSM_S3' | 'GSM_S4';

export interface PlayerTsHistoryRaw {
  p: number;
  s: Partial<Record<PlayerTsHistorySeriesKey, PlayerTsHistoryPointRaw[]>>;
}

export interface PlayerTsChartPointVm {
  matchTPId: number;
  date: string;
  mean: number;
  sd: number;
}

export interface PlayerTsChartPointVm {
  matchTPId: number;
  date: string;
  mean: number;
  sd: number;
}