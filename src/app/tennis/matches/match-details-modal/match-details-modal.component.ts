/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
    Component,
    EventEmitter,
    Input,
    Output,
    OnChanges,
    OnInit,
    OnDestroy,
    ElementRef,
    QueryList,
    ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaticArchivesService } from '../../../core/services/static-archives.service';
import { Observable, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Match } from 'src/app/core/models/tennis.model';
import { ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '@app/core/services/auth.service';

// =================================================================================================
// TYPES (UI tabs, selectors, DTO-ish rows)
// =================================================================================================

type Tab =
    | 'overview'
    | 'trueskill'
    | 'tsBreakdown'
    | 'wpBreakdown'
    | 'performance'
    | 'form'
    | 'roleStats'
    | 'odds'
    | 'h2h'
    | 'raw';

type PerfUnit = 'MATCH' | 'SET' | 'GAME';
type TimeScope = 'ALL' | 'YEAR' | 'MONTH' | 'WEEK';
type SurfaceScope = 'ALL' | 'S1' | 'S2' | 'S3' | 'S4';
type WlMetric = 'W' | 'L';
type RoleTimeScope = 'ALL' | 'YEAR' | 'MONTH' | 'WEEK';
type RoleSide = 'FAV' | 'DOG';
type RoleMetric = 'WINS' | 'LOSSES' | 'AVG_WP_WON' | 'AVG_WP_LOST';
type RatingMode = 'M' | 'SM' | 'GSM';
type RatingMetric = 'Mean' | 'SD' | 'WP';
type LastResult = 'WIN' | 'LOSS';
type H2HSurface = 'ALL' | 'S1' | 'S2' | 'S3' | 'S4';
type H2HMode = 'M' | 'SM' | 'GSM';

type RoleOption<T extends string> = { value: T; label: string };
type PerfOption<T extends string> = { value: T; label: string };

// =================================================================================================
// ODDS helpers (latest per bookie + full history on expand)
// =================================================================================================

type OddsRow = {
    o01: number;              // bookieId
    o02: string;              // bookieName
    o03?: string | Date | null; // oddsDateTime
    o04?: number | null;      // seriesOrdinal
    o05: number;              // odds(L)
    o06: number;              // odds(R)
    o07?: boolean | number | null; // suspicious?
    o08?: boolean | number | null; // likely switched?
    o09?: number | null;      // suspiciousMask
};

type ChartTooltip = {
    leftPx: number;
    topPx: number;
    dateLabel: string;
    p1Label: string;
    p2Label: string;
    mu1: number;
    sd1: number;
    wp1: number;
    mu2: number;
    sd2: number;
    wp2: number;
};

type MatchDetailsRaw = Record<string, any>;

type DetailsLockedError = {
    status: 'error';
    code: 'DETAILS_LOCKED';
    lockHours: number;
    expectedStartUtc: string;
    unlocksAt: string;
    message?: string;
};

// =================================================================================================
// PURE HELPERS (safe reads + minified key generators)
// -------------------------------------------------------------------------------------------------
// These are outside the component to keep them easily testable and independent from UI state.
// =================================================================================================

/** Safe numeric read from minified details object (returns 0 if missing). */
function getNumber(details: MatchDetailsRaw | null | undefined, key: string): number {
    const v = details?.[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Safe numeric read that preserves null (returns null if missing/invalid). */
function getNullableNumber(details: MatchDetailsRaw | null | undefined, key: string): number | null {
    const v = details?.[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ------------------------------------
// PERFORMANCE (minified DTO indexing)
// ------------------------------------

const PERF_BASE_START: Record<PerfUnit, number> = {
    MATCH: 158,
    SET: 238,
    GAME: 318,
};

// DTO layout constants (document the minified scheme)
const PERF_FIELDS_PER_TIME = 2;  // W/L
const PERF_FIELDS_PER_PLAYER = 8;  // 4 time scopes * 2 (W/L)
const PERF_FIELDS_PER_SURFACE = 16; // 2 players * 8

const TIME_INDEX: Record<TimeScope, number> = { ALL: 0, YEAR: 1, MONTH: 2, WEEK: 3 };
const SURFACE_INDEX: Record<SurfaceScope, number> = { ALL: 0, S1: 1, S2: 2, S3: 3, S4: 4 };

function playerOffset(player: 1 | 2): number {
    return player === 1 ? 0 : PERF_FIELDS_PER_PLAYER;
}

function wlOffset(m: WlMetric): number {
    return m === 'W' ? 0 : 1;
}

/**
 * Builds minified perf key for Win/Loss counts.
 *
 * Layout:
 * - unit block starts at PERF_BASE_START[unit]
 * - then surface block (ALL/S1..S4)
 * - then player block (P1/P2)
 * - then time block (ALL/YEAR/MONTH/WEEK)
 * - then W/L offset
 */
function perfKey(
    unit: PerfUnit,
    player: 1 | 2,
    time: TimeScope,
    surface: SurfaceScope,
    metric: WlMetric
): string {
    const base = PERF_BASE_START[unit];
    const s = SURFACE_INDEX[surface] * PERF_FIELDS_PER_SURFACE;
    const p = playerOffset(player);
    const t = TIME_INDEX[time] * PERF_FIELDS_PER_TIME;
    const w = wlOffset(metric);
    const idx = base + s + p + t + w;

    return `m${String(idx).padStart(3, '0')}`;
}

/**
 * Days since last win/loss key generator.
 *
 * Base:
 * - WIN => 398
 * - LOSS => 408
 *
 * Surface offsets:
 * - ALL=0, S1=2, S2=4, S3=6, S4=8
 *
 * Player offset:
 * - P1=0, P2=1
 */
function daysSinceKey(player: 1 | 2, last: LastResult, surface: SurfaceScope): string {
    const base = last === 'WIN' ? 398 : 408;

    // ALL=0, S1=2, S2=4, S3=6, S4=8
    const sIdx = SURFACE_INDEX[surface];
    const surfaceOffset = sIdx === 0 ? 0 : sIdx * 2;

    const pOffset = player === 1 ? 0 : 1;
    const idx = base + surfaceOffset + pOffset;

    return `m${String(idx).padStart(3, '0')}`;
}

// ------------------------------------
// TRUE SKILL (minified match keys)
// ------------------------------------

type TsKey = `${1 | 2}_${RatingMetric}_${'Old' | 'New'}_${RatingMode}_${SurfaceScope}`;

type TsPoint = {
    m: number; // matchTPId
    d: string; // ISO day ("YYYY-MM-DD")
    mu: number; // mean (json "t")
    sd: number; // sigma (json "s")
};

type TsMergedPoint = {
    time: number; // day timestamp (ms)
    p1mu: number;
    p1sd: number;
    p2mu: number;
    p2sd: number;
    wp1: number; // 0..1
    matchId?: number; // optional for tooltip/link
};

// -------------------------------------------------------------------------------------
// MINIFIED MATCH DETAILS KEYS (m001..mNNN)
// -------------------------------------------------------------------------------------
// Our MatchDetails archives use minified keys to keep payload small.
// TS_MIN_MAP translates:
//   (player, metric, Old/New, rating mode, surface scope) => concrete "mXYZ" key.
//
// Old/New convention:
// - If the match is finished (raw.m656 === true) we show the "New" ratings.
// - Otherwise we show the "Old" ratings (pre-match snapshot).
// -------------------------------------------------------------------------------------

const TS_MIN_MAP: Partial<Record<TsKey, string>> = {
    '1_Mean_New_M_ALL': 'm023',
    '1_SD_New_M_ALL': 'm024',
    '2_Mean_New_M_ALL': 'm025',
    '2_SD_New_M_ALL': 'm026',
    '1_Mean_Old_M_ALL': 'm027',
    '1_SD_Old_M_ALL': 'm028',
    '2_Mean_Old_M_ALL': 'm029',
    '2_SD_Old_M_ALL': 'm030',
    '1_WP_New_M_ALL': 'm031',

    '1_Mean_New_SM_ALL': 'm032',
    '1_SD_New_SM_ALL': 'm033',
    '2_Mean_New_SM_ALL': 'm034',
    '2_SD_New_SM_ALL': 'm035',
    '1_Mean_Old_SM_ALL': 'm036',
    '1_SD_Old_SM_ALL': 'm037',
    '2_Mean_Old_SM_ALL': 'm038',
    '2_SD_Old_SM_ALL': 'm039',
    '1_WP_New_SM_ALL': 'm040',

    '1_Mean_New_GSM_ALL': 'm041',
    '1_SD_New_GSM_ALL': 'm042',
    '2_Mean_New_GSM_ALL': 'm043',
    '2_SD_New_GSM_ALL': 'm044',
    '1_Mean_Old_GSM_ALL': 'm045',
    '1_SD_Old_GSM_ALL': 'm046',
    '2_Mean_Old_GSM_ALL': 'm047',
    '2_SD_Old_GSM_ALL': 'm048',
    '1_WP_New_GSM_ALL': 'm049',

    '1_Mean_New_M_S1': 'm050',
    '1_SD_New_M_S1': 'm051',
    '2_Mean_New_M_S1': 'm052',
    '2_SD_New_M_S1': 'm053',
    '1_Mean_Old_M_S1': 'm054',
    '1_SD_Old_M_S1': 'm055',
    '2_Mean_Old_M_S1': 'm056',
    '2_SD_Old_M_S1': 'm057',
    '1_WP_New_M_S1': 'm058',

    '1_Mean_New_SM_S1': 'm059',
    '1_SD_New_SM_S1': 'm060',
    '2_Mean_New_SM_S1': 'm061',
    '2_SD_New_SM_S1': 'm062',
    '1_Mean_Old_SM_S1': 'm063',
    '1_SD_Old_SM_S1': 'm064',
    '2_Mean_Old_SM_S1': 'm065',
    '2_SD_Old_SM_S1': 'm066',
    '1_WP_New_SM_S1': 'm067',

    '1_Mean_New_GSM_S1': 'm068',
    '1_SD_New_GSM_S1': 'm069',
    '2_Mean_New_GSM_S1': 'm070',
    '2_SD_New_GSM_S1': 'm071',
    '1_Mean_Old_GSM_S1': 'm072',
    '1_SD_Old_GSM_S1': 'm073',
    '2_Mean_Old_GSM_S1': 'm074',
    '2_SD_Old_GSM_S1': 'm075',
    '1_WP_New_GSM_S1': 'm076',

    '1_Mean_New_M_S2': 'm077',
    '1_SD_New_M_S2': 'm078',
    '2_Mean_New_M_S2': 'm079',
    '2_SD_New_M_S2': 'm080',
    '1_Mean_Old_M_S2': 'm081',
    '1_SD_Old_M_S2': 'm082',
    '2_Mean_Old_M_S2': 'm083',
    '2_SD_Old_M_S2': 'm084',
    '1_WP_New_M_S2': 'm085',

    '1_Mean_New_SM_S2': 'm086',
    '1_SD_New_SM_S2': 'm087',
    '2_Mean_New_SM_S2': 'm088',
    '2_SD_New_SM_S2': 'm089',
    '1_Mean_Old_SM_S2': 'm090',
    '1_SD_Old_SM_S2': 'm091',
    '2_Mean_Old_SM_S2': 'm092',
    '2_SD_Old_SM_S2': 'm093',
    '1_WP_New_SM_S2': 'm094',

    '1_Mean_New_GSM_S2': 'm095',
    '1_SD_New_GSM_S2': 'm096',
    '2_Mean_New_GSM_S2': 'm097',
    '2_SD_New_GSM_S2': 'm098',
    '1_Mean_Old_GSM_S2': 'm099',
    '1_SD_Old_GSM_S2': 'm100',
    '2_Mean_Old_GSM_S2': 'm101',
    '2_SD_Old_GSM_S2': 'm102',
    '1_WP_New_GSM_S2': 'm103',

    '1_Mean_New_M_S3': 'm104',
    '1_SD_New_M_S3': 'm105',
    '2_Mean_New_M_S3': 'm106',
    '2_SD_New_M_S3': 'm107',
    '1_Mean_Old_M_S3': 'm108',
    '1_SD_Old_M_S3': 'm109',
    '2_Mean_Old_M_S3': 'm110',
    '2_SD_Old_M_S3': 'm111',
    '1_WP_New_M_S3': 'm112',

    '1_Mean_New_SM_S3': 'm113',
    '1_SD_New_SM_S3': 'm114',
    '2_Mean_New_SM_S3': 'm115',
    '2_SD_New_SM_S3': 'm116',
    '1_Mean_Old_SM_S3': 'm117',
    '1_SD_Old_SM_S3': 'm118',
    '2_Mean_Old_SM_S3': 'm119',
    '2_SD_Old_SM_S3': 'm120',
    '1_WP_New_SM_S3': 'm121',

    '1_Mean_New_GSM_S3': 'm122',
    '1_SD_New_GSM_S3': 'm123',
    '2_Mean_New_GSM_S3': 'm124',
    '2_SD_New_GSM_S3': 'm125',
    '1_Mean_Old_GSM_S3': 'm126',
    '1_SD_Old_GSM_S3': 'm127',
    '2_Mean_Old_GSM_S3': 'm128',
    '2_SD_Old_GSM_S3': 'm129',
    '1_WP_New_GSM_S3': 'm130',

    '1_Mean_New_M_S4': 'm131',
    '1_SD_New_M_S4': 'm132',
    '2_Mean_New_M_S4': 'm133',
    '2_SD_New_M_S4': 'm134',
    '1_Mean_Old_M_S4': 'm135',
    '1_SD_Old_M_S4': 'm136',
    '2_Mean_Old_M_S4': 'm137',
    '2_SD_Old_M_S4': 'm138',
    '1_WP_New_M_S4': 'm139',

    '1_Mean_New_SM_S4': 'm140',
    '1_SD_New_SM_S4': 'm141',
    '2_Mean_New_SM_S4': 'm142',
    '2_SD_New_SM_S4': 'm143',
    '1_Mean_Old_SM_S4': 'm144',
    '1_SD_Old_SM_S4': 'm145',
    '2_Mean_Old_SM_S4': 'm146',
    '2_SD_Old_SM_S4': 'm147',
    '1_WP_New_SM_S4': 'm148',

    '1_Mean_New_GSM_S4': 'm149',
    '1_SD_New_GSM_S4': 'm150',
    '2_Mean_New_GSM_S4': 'm151',
    '2_SD_New_GSM_S4': 'm152',
    '1_Mean_Old_GSM_S4': 'm153',
    '1_SD_Old_GSM_S4': 'm154',
    '2_Mean_Old_GSM_S4': 'm155',
    '2_SD_Old_GSM_S4': 'm156',
    '1_WP_New_GSM_S4': 'm157',
};

// =================================================================================================
// VIEW MODELS (VM) - UI-oriented shapes so template doesn't depend on many DTO variants.
// =================================================================================================

interface VmPlayer {
    playerTPId: number;
    name: string;
    iso2: string; // for flag-icons
    iso3: string; // (ITA)
    countryName: string; // tooltip full
    rank?: number;
    seed?: string;

    born?: string; // formatted + (age)
    plays?: string;
    height?: string;
    weight?: string;

    tsMean?: number; // trueSkillMean (player summary)
    odds?: number;
    nnProb?: number; // 0..1
}

interface VmTournamentHeader {
    name: string;
    iso2: string;
    iso3: string;
    countryName: string;

    round: string;
    surface: string;
    dateText: string;
    prizeText: string; // "30000" or "—"
}

interface Vm {
    header: VmTournamentHeader;
    p1: VmPlayer;
    p2: VmPlayer;

    // result
    finished: boolean;
    scoreMain: string; // "2 : 0"
    scoreSets: string; // "6:4 6:3"

    // compare
    edgeP1?: number; // decimal (0.12 / -0.05)
    edgeP2?: number;

    betSide: 'p1' | 'p2' | null;
    pl?: number; // profit/loss for stake=1
}

// =================================================================================================
// COMPONENT
// =================================================================================================

@Component({
    selector: 'app-match-details-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './match-details-modal.component.html',
    styleUrls: ['./match-details-modal.component.scss'],
})
export class MatchDetailsModalComponent implements OnChanges, OnInit, OnDestroy {
    // -----------------------------------------------------------------------------------------------
    // Inputs / Outputs / View children
    // -----------------------------------------------------------------------------------------------

    @Input() isOpen = false;
    @Input() matchTPId!: number;
    @Input() genderHint!: 'M' | 'W';
    @Input() match!: Match;
    @Output() closed = new EventEmitter<void>();
    @Output() requestLogin = new EventEmitter<void>();
    @Output() requestRegister = new EventEmitter<void>();
    @Output() requestUpgrade = new EventEmitter<void>();

    /**
     * Tooltip element reference(s).
     * Note: we mostly use a fixed width assumption for clamping, but keeping this allows future
     * improvement with actual element measurement.
     */
    @ViewChildren('chartTip') private chartTipRefs!: QueryList<ElementRef<HTMLElement>>;

    // -----------------------------------------------------------------------------------------------
    // UI state: tabs + selectors
    // -----------------------------------------------------------------------------------------------

    activeTab: Tab = 'overview';

    // Performance tab selectors (must have strict defaults)
    activePerfUnit: PerfUnit = 'MATCH';
    activePerfTime: TimeScope = 'ALL';
    activePerfSurface: SurfaceScope = 'ALL';

    // Form tab selectors
    activeFormSurface: SurfaceScope = 'ALL';

    // Role tab selectors
    activeRoleTime: RoleTimeScope = 'ALL';

    // H2H tab selectors
    activeH2HMode: H2HMode = 'M';
    activeH2HSurface: H2HSurface = 'ALL';

    // TS selectors (used by TS/WP breakdown tabs)
    RatingMode: RatingMode = 'M';
    SurfaceScope: SurfaceScope = 'ALL';

    // Odds tab selectors
    activeOddsSeries = 0;
    showSuspiciousOnly = false;

    isLocked = false;
    locked: DetailsLockedError | null = null;
    lockedPayload: any | null = null;

    // -----------------------------------------------------------------------------------------------
    // UI option lists (label is for UI, value is for logic)
    // -----------------------------------------------------------------------------------------------

    perfUnitOptions: PerfOption<PerfUnit>[] = [
        { value: 'MATCH', label: 'Match' },
        { value: 'SET', label: 'Set' },
        { value: 'GAME', label: 'Game' },
    ];

    perfTimeOptions: PerfOption<TimeScope>[] = [
        { value: 'ALL', label: 'All' },
        { value: 'YEAR', label: 'Year' },
        { value: 'MONTH', label: 'Month' },
        { value: 'WEEK', label: 'Week' },
    ];

    perfSurfaceOptions: PerfOption<SurfaceScope>[] = [
        { value: 'ALL', label: 'All' },
        { value: 'S1', label: 'S1' },
        { value: 'S2', label: 'S2' },
        { value: 'S3', label: 'S3' },
        { value: 'S4', label: 'S4' },
    ];

    roleTimeOptions: RoleOption<RoleTimeScope>[] = [
        { value: 'ALL', label: 'All' },
        { value: 'YEAR', label: 'Year' },
        { value: 'MONTH', label: 'Month' },
        { value: 'WEEK', label: 'Week' },
    ];

    h2hModeOptions: RoleOption<H2HMode>[] = [
        { value: 'M', label: 'M' },
        { value: 'SM', label: 'SM' },
        { value: 'GSM', label: 'GSM' },
    ];

    h2hSurfaceOptions: RoleOption<H2HSurface>[] = [
        { value: 'ALL', label: 'All' },
        { value: 'S1', label: 'S1' },
        { value: 'S2', label: 'S2' },
        { value: 'S3', label: 'S3' },
        { value: 'S4', label: 'S4' },
    ];

    // -----------------------------------------------------------------------------------------------
    // Data state
    // -----------------------------------------------------------------------------------------------

    loading = false;
    error: string | null = null;

    raw: MatchDetailsRaw | null = null;
    vm: Vm | null = null;

    private _details: MatchDetailsRaw | null = null;
    allOdds: OddsRow[] | undefined;

    get details(): MatchDetailsRaw | null {
        return this._details;
    }

    public get hasDetails(): boolean {
        return !!this._details;
    }

    private detailsSub?: Subscription;

    readonly stars = [1, 2, 3, 4, 5];

    get oddsLabelP1(): string {
        const d: any = this._details as any;
        return d?.p1?.p01 ?? d?.p1?.name ?? 'P1';
    }

    get oddsLabelP2(): string {
        const d: any = this._details as any;
        return d?.p2?.p01 ?? d?.p2?.name ?? 'P2';
    }

    private authSub?: Subscription;

    // -----------------------------------------------------------------------------------------------
    // TS history state (cached + merged for charts)
    // -----------------------------------------------------------------------------------------------

    private tsHistCache = new Map<number, any>();

    tsBreakdownLoading = false;
    tsBreakdownError: string | null = null;

    p1Series: TsPoint[] = [];
    p2Series: TsPoint[] = [];
    mergedSeries: TsMergedPoint[] = [];

    // -----------------------------------------------------------------------------------------------
    // TS / WP SVG chart state
    // -----------------------------------------------------------------------------------------------

    chartWidth = 980;
    chartHeight = 320;
    chartPad = 28;

    showTrend = true;

    hoverIdx: number | null = null;
    hoverTooltip: ChartTooltip | null = null;
    pinnedTooltip: ChartTooltip | null = null;

    // -----------------------------------------------------------------------------------------------
    // Constructor / lifecycle
    // -----------------------------------------------------------------------------------------------

    constructor(public staticArchives: StaticArchivesService, private auth: AuthService, private cdr: ChangeDetectorRef) { }

    ngOnInit(): void {
        this.authSub = this.auth.user$.subscribe(() => {
            // ako smo locked i modal je otvoren -> retry
            if (this.isOpen && this.match?.matchTPId && this.isLocked) {
                console.log('[LOCKED] auth changed -> retry load');
                this.load();
            }
        });
    }

    ngOnChanges(): void {
        if (this.isOpen && this.match?.matchTPId) {
            this.load();
        }
    }

    ngOnDestroy(): void {
        this.detailsSub?.unsubscribe();
        this.authSub?.unsubscribe();
    }

    // =================================================================================================
    // PUBLIC UI ACTIONS
    // =================================================================================================

    close(): void {
        console.log('[DETAILS] close emit');
        this.isOpen = false;
        this.loading = false;
        this.error = null;
        this.isLocked = false;
        this.locked = null;
        this.raw = null;
        this.vm = null;
        this._details = null;
        this.closed.emit();
        this.detailsSub?.unsubscribe();
        this.detailsSub = undefined;
    }

    dbg(tag: string) {
        console.log('[DETAILS]', tag, {
            isLocked: this.isLocked,
            isLoggedIn: this.isLoggedIn,
            hasTrial: this.hasTrial,
            isPremium: this.isPremium
        });
    }

    onTabClick(tab: Tab): void {
        console.log('[UI] tab click', tab);
        this.setTab(tab);
    }

    setTab(tab: Tab): void {
        this.activeTab = tab;

        // TS/WP breakdown tabs share same underlying mergedSeries building.
        if (tab === 'tsBreakdown' || tab === 'wpBreakdown') {
            if (!this.raw) {
                console.log('[TS] tab clicked but raw is null yet');
                return;
            }
            this.loadTsHistoryAndBuildSeries();
        }
    }

    onTsSelectorsChanged(): void {
        // Rebuild series when selectors change (mode/surface) if we are on a TS/WP tab.
        if (this.activeTab === 'tsBreakdown' || this.activeTab === 'wpBreakdown') {
            this.loadTsHistoryAndBuildSeries();
        }
    }

    rawJson(): string {
        try {
            return JSON.stringify(this.raw, null, 2);
        } catch {
            return '';
        }
    }

    // =================================================================================================
    // LOAD DETAILS + BUILD VM
    // =================================================================================================

    load(): void {
        // guard: modal mora biti otvoren i match mora postojati
        if (!this.isOpen) return;

        const match = this.match;
        const matchTPId = match?.matchTPId;
        this.isLocked = false;

        if (!match || !matchTPId) {
            this.loading = false;
            this.error = 'Missing match context.';
            this.raw = null;
            this.vm = null;
            this.cdr.markForCheck();
            return;
        }

        // cancel prethodni request
        this.detailsSub?.unsubscribe();
        this.detailsSub = undefined;

        // reset state
        this.loading = true;
        this.error = null;
        this.raw = null;
        this.vm = null;
        this.cdr.markForCheck();

        // fetch
        this.detailsSub = this.staticArchives.getDetailsGuarded(match, 2).subscribe({
            next: (details) => {
                console.log('[DETAILS] loaded', details);

                this.raw = details;
                this._details = details;

                this.genderHint = this.tourTypeLabel(details) === 'WTA' ? 'W' : 'M';

                this.vm = this.buildVm(details);

                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.loading = false;

                // StaticArchivesService već prosljeđuje err.error kao "err" često,
                // ali nek bude robustno:
                const payload = (err && typeof err === 'object' && 'error' in err) ? (err as any).error : err;

                console.log('[DETAILS ERROR PAYLOAD]', { err, payload });

                if (payload?.code === 'DETAILS_LOCKED') {
                    this.isLocked = true;
                    this.locked = payload as DetailsLockedError;

                    const unlockLocal = payload.unlocksAt ? new Date(payload.unlocksAt).toLocaleString() : '';
                    this.error = unlockLocal ? `Details locked until ${unlockLocal}` : `Details are locked.`;

                    this.cdr.markForCheck();
                    return;
                }

                // fallback
                this.isLocked = false;
                this.locked = null;
                this.error = 'Could not load match details.';
                this.cdr.markForCheck();
                console.error(err);
            }
        });
    }

    // =================================================================================================
    // UI HELPERS (formatting, display-only)
    // =================================================================================================

    safeText(v: unknown, fallback = '—'): string {
        const s = (v ?? '').toString().trim();
        return s.length ? s : fallback;
    }

    flagIso2OrEmpty(iso2: string): string {
        const v = (iso2 || '').trim().toLowerCase();
        return v;
    }

    // stars rendering
    starClass(starIndex: number, rating: number): string {
        if (rating >= starIndex) return 'full';
        if (rating >= starIndex - 0.5) return 'half';
        return '';
    }

    tsToStars(ts: number | undefined): number {
        if (typeof ts !== 'number' || !isFinite(ts)) return 0;
        const min = 18;
        const max = 32;
        const t = (ts - min) / (max - min);
        const clamped = Math.min(1, Math.max(0, t));
        const stars = clamped * 5;
        return Math.round(stars * 2) / 2;
    }

    tsTooltip(ts: number | undefined): string {
        return `TS: ${typeof ts === 'number' && isFinite(ts) ? ts.toFixed(2) : '-'}`;
    }

    edgeText(edge: number | undefined): string {
        if (typeof edge !== 'number' || !isFinite(edge)) return '—';
        return edge.toFixed(2);
    }

    nnPct(prob01: number | undefined): string {
        if (typeof prob01 !== 'number' || !isFinite(prob01)) return '—';
        return `${(prob01 * 100).toFixed(0)}%`;
    }

    oddsText(odds: number | undefined): string {
        if (typeof odds !== 'number' || !isFinite(odds) || odds <= 0) return '—';
        return odds.toFixed(2);
    }

    who2BetText(vm: Vm, side: 'p1' | 'p2'): string {
        return vm.betSide === side ? 'kvacica' : '';
    }

    plLeft(vm: Vm): string {
        if (typeof vm.pl !== 'number' || !isFinite(vm.pl)) return '';
        return vm.pl > 0 ? `+${vm.pl.toFixed(2)}` : '';
    }

    plRight(vm: Vm): string {
        if (typeof vm.pl !== 'number' || !isFinite(vm.pl)) return '';
        return vm.pl < 0 ? vm.pl.toFixed(2) : '';
    }

    lockedUntilText(): string {
        const iso = this.locked?.unlocksAt;
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleString();
        } catch { return iso; }
    }

    openPricing(): void {
        // kasnije: otvori pricing modal ili route /pricing
        alert('Pricing/Unlock flow coming next 🙂');
    }

    private unwrapHttpError(err: any): any {
        if (!err) return null;

        // Ako interceptor već baca payload, to je već "pravo"
        if (typeof err === 'object' && err.code) return err;

        // Angular HttpErrorResponse shape: err.error je server payload
        const maybeError = (err && typeof err === 'object' && 'error' in err) ? (err as any).error : null;
        if (maybeError) return maybeError;

        // nekad dođe string
        if (typeof err === 'string') return { message: err };

        return err;
    }

    // =================================================================================================
    // VM BUILDING (single source of truth for template)
    // =================================================================================================

    private buildVm(d: any): Vm {
        const header: VmTournamentHeader = {
            name: this.safeText(d?.t?.t02),
            iso2: this.safeText(d?.t?.t05, ''),
            iso3: this.safeText(d?.t?.t04, ''),
            countryName: this.safeText(d?.t?.t06, ''),
            round: this.safeText(d?.m022),
            surface: this.safeText(d?.m020),
            dateText: this.formatMatchDate(d?.m003),
            prizeText: d.t14 ? this.formatUsdDots(d.t14) : '—',
        };

        const p1 = this.mapPlayer(d?.p1, d, 'p1');
        const p2 = this.mapPlayer(d?.p2, d, 'p2');

        // finished + scores
        const scoreMainRaw = this.safeText(d?.m010, '');
        const m011Raw = this.safeText(d?.m011, '');

        const setTokens = this.parseSetTokensFromM011(m011Raw, scoreMainRaw);
        const scoreSets = this.formatSetsFromTokens(setTokens);

        // main score from sets if possible, else fallback to m010
        const mainFromSets = this.formatMainFromSets(setTokens);
        const scoreMain = mainFromSets ?? this.formatMainScore(scoreMainRaw);

        // finished: best-effort
        const finished = this.isFinished(d, scoreMain, scoreSets);

        // NN prob: m655 = P1 % (0..100)
        const p1Pct = typeof d?.m655 === 'number' ? d.m655 : NaN;
        if (isFinite(p1Pct)) {
            p1.nnProb = Math.min(1, Math.max(0, p1Pct / 100));
            p2.nnProb = 1 - p1.nnProb;
        }

        // Odds: m012/m013
        p1.odds = this.numOrUndef(d?.m012);
        p2.odds = this.numOrUndef(d?.m013);

        // Edge = NNprob - impliedProb
        const edgeP1 = this.edge(p1.nnProb, p1.odds);
        const edgeP2 = this.edge(p2.nnProb, p2.odds);

        // Bet side: threshold 0.03, only one side
        const thr = 0.03;
        const ok1 = typeof edgeP1 === 'number' && edgeP1 >= thr;
        const ok2 = typeof edgeP2 === 'number' && edgeP2 >= thr;
        const betSide: Vm['betSide'] = ok1 && !ok2 ? 'p1' : ok2 && !ok1 ? 'p2' : null;

        // PL: for finished match, assume P1 is winner per original rule
        let pl: number | undefined = undefined;
        if (finished && betSide) {
            if (betSide === 'p1' && typeof p1.odds === 'number' && p1.odds > 0) pl = p1.odds - 1;
            else if (betSide === 'p2') pl = -1;
        }

        return {
            header,
            p1,
            p2,
            finished,
            scoreMain: finished ? scoreMain || '—' : '—',
            scoreSets: finished ? scoreSets : '',
            edgeP1,
            edgeP2,
            betSide,
            pl,
        };
    }

    private mapPlayer(p: any, d: any, side: 'p1' | 'p2'): VmPlayer {
        // Rank/seed from minified match keys
        const rank = this.numOrUndef(side === 'p1' ? d?.m006 : d?.m007);
        const seed = this.safeText(side === 'p1' ? d?.m008 : d?.m009, '');
        const pid = side === 'p1' ? d?.m004 : d?.m005;
        return {
            playerTPId: pid,
            name: this.safeText(p?.p02),
            iso2: this.safeText(p?.p05, ''),
            iso3: this.safeText(p?.p04, ''),
            countryName: this.safeText(p?.p06, 'World'),
            rank,
            seed: seed || undefined,

            born: this.formatBornWithAge(p?.p09),
            plays: this.safeText(p?.p14, ''),
            height: this.numOrUndef(p?.p10) ? `${Number(p.p10)} cm` : '',
            weight: this.numOrUndef(p?.p11) ? `${Number(p.p11)} kg` : '',

            // summary TS mean for player (if present)
            tsMean: this.numOrUndef(p?.trueSkillMean),
        };
    }

    // =================================================================================================
    // AVATARS
    // =================================================================================================

    playerAvatarUrlById(tpId?: number): string {
        if (!tpId) return this.staticArchives.getDefaultPlayerPhotoUrl(this.genderHint);
        // šaljemo gender hint kao query param da backend zna koji default vratiti kad nema slike
        return this.staticArchives.getPlayerPhotoUrl(tpId, this.genderHint);
    }

    onAvatarError(ev: Event): void {
        const img = ev.target as HTMLImageElement;
        img.src = this.staticArchives.getDefaultPlayerPhotoUrl(this.genderHint === 'W' ? 'W' : 'M');
    }


    // =================================================================================================
    // PERFORMANCE TAB (W/L metrics)
    // =================================================================================================

    /** Expose perfKey builder to template. */
    public perfKey(
        unit: PerfUnit,
        player: 1 | 2,
        time: TimeScope,
        surface: SurfaceScope,
        metric: WlMetric
    ): string {
        return perfKey(unit, player, time, surface, metric);
    }

    /** Expose daysSince key builder to template. */
    public daysSinceKey(player: 1 | 2, last: LastResult, surface: SurfaceScope): string {
        return daysSinceKey(player, last, surface);
    }

    // click handlers (state receives option.value only)
    setPerfUnit(v: PerfUnit) {
        this.activePerfUnit = v;
    }
    setPerfTime(v: TimeScope) {
        this.activePerfTime = v;
    }
    setPerfSurface(v: SurfaceScope) {
        this.activePerfSurface = v;
    }

    getW(player: 1 | 2): number {
        const k = perfKey(this.activePerfUnit, player, this.activePerfTime, this.activePerfSurface, 'W');
        return getNumber(this._details, k);
    }

    getL(player: 1 | 2): number {
        const k = perfKey(this.activePerfUnit, player, this.activePerfTime, this.activePerfSurface, 'L');
        return getNumber(this._details, k);
    }

    getWinPct(player: 1 | 2): number {
        const w = this.getW(player);
        const l = this.getL(player);
        const total = w + l;
        return total > 0 ? (w / total) * 100 : 0;
    }

    // =================================================================================================
    // FORM TAB (days since last win/loss + derived last result)
    // =================================================================================================

    getDaysSinceLastWin(player: 1 | 2, surface: SurfaceScope): number {
        const k = daysSinceKey(player, 'WIN', surface);
        return getNumber(this._details, k);
    }

    getDaysSinceLastLoss(player: 1 | 2, surface: SurfaceScope): number {
        const k = daysSinceKey(player, 'LOSS', surface);
        return getNumber(this._details, k);
    }

    /**
     * Last result heuristic:
     * - if daysSinceWin < daysSinceLoss => last was WIN
     * - if one missing => assume the other exists
     */
    getLastResult(player: 1 | 2, surface: SurfaceScope = 'ALL'): 'WIN' | 'LOSS' | 'N/A' {
        const w = this.getDaysSinceLastWin(player, surface);
        const l = this.getDaysSinceLastLoss(player, surface);

        if (!w && !l) return 'N/A';
        if (!w) return 'LOSS';
        if (!l) return 'WIN';

        return w <= l ? 'WIN' : 'LOSS';
    }

    fmtDays(v: number): string {
        return v > 0 ? `${v}` : '—';
    }

    getDaysSinceLastMatch(player: 1 | 2, surface: SurfaceScope): number {
        const w = this.getDaysSinceLastWin(player, surface);
        const l = this.getDaysSinceLastLoss(player, surface);

        if (!w && !l) return 0;
        if (!w) return l;
        if (!l) return w;

        return Math.min(w, l);
    }

    getMoreRecentWas(player: 1 | 2, surface: SurfaceScope): 'WIN' | 'LOSS' | 'N/A' {
        const w = this.getDaysSinceLastWin(player, surface);
        const l = this.getDaysSinceLastLoss(player, surface);

        if (!w && !l) return 'N/A';
        if (!w) return 'LOSS';
        if (!l) return 'WIN';

        return w <= l ? 'WIN' : 'LOSS';
    }

    // =================================================================================================
    // ROLE STATS TAB (minified key mapping)
    // =================================================================================================

    private roleKey(metric: RoleMetric, player: 1 | 2, side: RoleSide, time: RoleTimeScope): string {
        // Base starts per time window
        const baseByTime: Record<RoleTimeScope, number> = {
            ALL: 418,
            YEAR: 434,
            MONTH: 450,
            WEEK: 466,
        };

        const base = baseByTime[time];

        // Order inside each time block:
        // 0..7   => counts (wins fav/dog, losses fav/dog) for P1/P2 interleaved by player (as per DTO)
        // 8..15  => avgs (wp at won fav/dog, wp at loss fav/dog) for P1/P2 interleaved by player
        const isAvg = metric === 'AVG_WP_WON' || metric === 'AVG_WP_LOST';
        const offsetBase = isAvg ? 8 : 0;

        // player offset: P1 is even keys, P2 is odd keys (m418 P1, m419 P2, ...)
        const playerOffset = player === 1 ? 0 : 1;

        // side offsets within (fav,dog) pair
        const sideOffset = side === 'FAV' ? 0 : 2;

        // counts: wins keys start at base+0 (fav) and base+2 (dog), losses at base+4/+6
        const countOutcomeOffset =
            metric === 'WINS' ? 0 : metric === 'LOSSES' ? 4 : 0;

        // avgs: AVG_WP_WON at offsets 0(fav)/2(dog), AVG_WP_LOST at offsets 4(fav)/6(dog)
        const avgOutcomeOffset =
            metric === 'AVG_WP_WON' ? 0 : metric === 'AVG_WP_LOST' ? 4 : 0;

        const outcomeOffset = isAvg ? avgOutcomeOffset : countOutcomeOffset;

        const idx = base + offsetBase + outcomeOffset + sideOffset + playerOffset;
        return `m${String(idx).padStart(3, '0')}`;
    }

    getRoleCount(metric: 'WINS' | 'LOSSES', player: 1 | 2, side: RoleSide): number {
        const k = this.roleKey(metric, player, side, this.activeRoleTime);
        return getNumber(this._details, k);
    }

    getRoleAvg(metric: 'AVG_WP_WON' | 'AVG_WP_LOST', player: 1 | 2, side: RoleSide): number {
        const k = this.roleKey(metric, player, side, this.activeRoleTime);
        return getNullableNumber(this._details, k) ?? 0;
    }

    getRoleMatches(player: 1 | 2, side: RoleSide): number {
        const w = this.getRoleCount('WINS', player, side);
        const l = this.getRoleCount('LOSSES', player, side);
        return w + l;
    }

    getRoleWinPct(player: 1 | 2, side: RoleSide): number {
        const w = this.getRoleCount('WINS', player, side);
        const l = this.getRoleCount('LOSSES', player, side);
        const total = w + l;
        return total > 0 ? (w / total) * 100 : 0;
    }

    getRoleSharePct(player: 1 | 2, side: RoleSide): number {
        const fav = this.getRoleMatches(player, 'FAV');
        const dog = this.getRoleMatches(player, 'DOG');
        const total = fav + dog;
        const part = side === 'FAV' ? fav : dog;
        return total > 0 ? (part / total) * 100 : 0;
    }

    wpPct01(v: number): string {
        if (!v || !Number.isFinite(v)) return '—';
        return `${(v * 100).toFixed(1)}%`;
    }

    // =================================================================================================
    // H2H TAB
    // =================================================================================================

    /** H2H record (wins/losses) keys. */
    private h2hRecordKey(player: 1 | 2, surface: H2HSurface, isOld: boolean): string {
        // current: m482..m491 (ALL,S1..S4)
        // old:     m492..m501
        const base = isOld ? 492 : 482;
        const sIdx = surface === 'ALL' ? 0 : Number(surface.substring(1)); // S1->1
        const offset = sIdx * 2 + (player === 1 ? 0 : 1);
        const idx = base + offset;
        return `m${String(idx).padStart(3, '0')}`;
    }

    getH2HWins(player: 1 | 2, surface: H2HSurface, isOld = false): number {
        return getNumber(this._details, this.h2hRecordKey(player, surface, isOld));
    }

    // ---------- H2H TS (ALL surface only, for M/SM/GSM) ----------
    private h2hTsKey(mode: H2HMode, player: 1 | 2, metric: 'MU' | 'SD', isOld: boolean): string {
        // M:
        //  current P1 mu m502 sd m503 | P2 mu m504 sd m505
        //  old     P1 mu m506 sd m507 | P2 mu m508 sd m509
        //  wp P1 = m510
        //
        // SM:
        //  current P1 mu m511 sd m512 | P2 mu m513 sd m514
        //  old     P1 mu m515 sd m516 | P2 mu m517 sd m518
        //  wp P1 = m519
        //
        // GSM:
        //  current P1 mu m520 sd m521 | P2 mu m522 sd m523
        //  old     P1 mu m524 sd m525 | P2 mu m526 sd m527
        //  wp P1 = m528

        const map: Record<H2HMode, { curBase: number; oldBase: number }> = {
            M: { curBase: 502, oldBase: 506 },
            SM: { curBase: 511, oldBase: 515 },
            GSM: { curBase: 520, oldBase: 524 },
        };

        const base = isOld ? map[mode].oldBase : map[mode].curBase;
        const playerOffset = player === 1 ? 0 : 2;
        const metricOffset = metric === 'MU' ? 0 : 1;
        const idx = base + playerOffset + metricOffset;

        return `m${String(idx).padStart(3, '0')}`;
    }

    getH2HTsMu(mode: H2HMode, player: 1 | 2, isOld = false): number {
        return getNullableNumber(this._details, this.h2hTsKey(mode, player, 'MU', isOld)) ?? 0;
    }

    getH2HTsSd(mode: H2HMode, player: 1 | 2, isOld = false): number {
        return getNullableNumber(this._details, this.h2hTsKey(mode, player, 'SD', isOld)) ?? 0;
    }

    private h2hWpKey(mode: H2HMode, surface: H2HSurface): string | null {
        // WP exists for ALL + per-surface blocks:
        // ALL: M m510, SM m519, GSM m528
        if (surface === 'ALL') {
            const map: Record<H2HMode, number> = { M: 510, SM: 519, GSM: 528 };
            return `m${String(map[mode]).padStart(3, '0')}`;
        }

        // per surface:
        // MS1 wp m537, MS2 m564, MS3 m591, MS4 m618
        // SMS1 wp m546, SMS2 m573, SMS3 m600, SMS4 m627
        // GSMS1 wp m555, GSMS2 m582, GSMS3 m609, GSMS4 m636
        const s = Number(surface.substring(1)); // 1..4

        const wpByMode: Record<H2HMode, number[]> = {
            M: [537, 564, 591, 618],
            SM: [546, 573, 600, 627],
            GSM: [555, 582, 609, 636],
        };

        return `m${String(wpByMode[mode][s - 1]).padStart(3, '0')}`;
    }

    getH2HWinProbP1(mode: H2HMode, surface: H2HSurface): number {
        const k = this.h2hWpKey(mode, surface);
        return k ? (getNullableNumber(this._details, k) ?? 0) : 0;
    }

    // ---------- H2H TS per-surface (M/SM/GSM) ----------
    private h2hSurfaceTsKey(
        mode: H2HMode,
        surface: Exclude<H2HSurface, 'ALL'>,
        player: 1 | 2,
        metric: 'MU' | 'SD',
        isOld: boolean
    ): string {
        const s = Number(surface.substring(1)); // 1..4

        // Base per surface groups:
        // M:   MS1 529..536, MS2 556..563, MS3 583..590, MS4 610..617
        // SM:  SMS1 538..545, SMS2 565..572, SMS3 592..599, SMS4 619..626
        // GSM: GSMS1 547..554, GSMS2 574..581, GSMS3 601..608, GSMS4 628..635
        const bases: Record<H2HMode, number[]> = {
            M: [529, 556, 583, 610],
            SM: [538, 565, 592, 619],
            GSM: [547, 574, 601, 628],
        };

        const base = bases[mode][s - 1];

        // ordering: P1 cur mu/sd (0/1), P2 cur mu/sd (2/3), P1 old mu/sd (4/5), P2 old mu/sd (6/7), wp (8)
        const playerOffset = player === 1 ? 0 : 2;
        const oldOffset = isOld ? 4 : 0;
        const metricOffset = metric === 'MU' ? 0 : 1;

        const idx = base + oldOffset + playerOffset + metricOffset;
        return `m${String(idx).padStart(3, '0')}`;
    }

    getH2HSurfaceTsMu(
        mode: H2HMode,
        surface: Exclude<H2HSurface, 'ALL'>,
        player: 1 | 2,
        isOld = false
    ): number {
        return getNullableNumber(this._details, this.h2hSurfaceTsKey(mode, surface, player, 'MU', isOld)) ?? 0;
    }

    getH2HSurfaceTsSd(
        mode: H2HMode,
        surface: Exclude<H2HSurface, 'ALL'>,
        player: 1 | 2,
        isOld = false
    ): number {
        return getNullableNumber(this._details, this.h2hSurfaceTsKey(mode, surface, player, 'SD', isOld)) ?? 0;
    }

    // =================================================================================================
    // ODDS helpers (latest per bookie + full history on expand)
    // ================================================================================================

    private toNum(v: any): number | null {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    /** Pretty number for odds cells */
    oddsNum(v: any): string {
        const n = this.toNum(v);
        if (n === null || n <= 0) return '—';
        return n.toFixed(2);
    }

    /** Convert odds to implied probability (0..1) */
    oddsImplied(odds: any): number | null {
        const o = this.toNum(odds);
        if (o === null || o <= 0) return null;
        return 1 / o;
    }

    /** Render 0..1 as percent text */
    oddsPct01(p01: any): string {
        const p = this.toNum(p01);
        if (p === null) return '—';
        return `${(p * 100).toFixed(1)}%`;
    }

    /** Bookmaker margin (overround) from a row */
    overroundPct(r: OddsRow): string {
        const p1 = this.oddsImplied(r?.o05);
        const p2 = this.oddsImplied(r?.o06);
        if (p1 === null || p2 === null) return '—';
        const over = (p1 + p2 - 1) * 100;
        return `${over.toFixed(2)}%`;
    }

    /** Best odds rows */
    bestOddsP1(): OddsRow | null {
        let best: OddsRow | null = null;
        let bestVal = -Infinity;

        for (const r of this.oddsRows) {
            if (!this.isCleanOddsRow(r)) continue;
            const v = this.toNum(r?.o05);
            if (v !== null && v > bestVal) {
                bestVal = v;
                best = r;
            }
        }
        return best;
    }

    bestOddsP2(): OddsRow | null {
        let best: OddsRow | null = null;
        let bestVal = -Infinity;

        for (const r of this.oddsRows) {
            if (!this.isCleanOddsRow(r)) continue;
            const v = this.toNum(r?.o06);
            if (v !== null && v > bestVal) {
                bestVal = v;
                best = r;
            }
        }
        return best;
    }

    /** Market summary (min/median/max) */
    private marketSummary(side: 'p1' | 'p2'): { min: number | null; med: number | null; max: number | null } {
        const key = side === 'p1' ? 'o05' : 'o06';

        const vals = this.oddsRows
            .filter(r => this.isCleanOddsRow(r))
            .map(r => this.toNum((r as any)?.[key]))
            .filter((n): n is number => n !== null && n > 0)
            .sort((a, b) => a - b);

        if (!vals.length) return { min: null, med: null, max: null };

        const min = vals[0];
        const max = vals[vals.length - 1];
        const mid = Math.floor(vals.length / 2);
        const med = vals.length % 2 === 1 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;

        return { min, med, max };
    }

    marketMinP1(): number | null { return this.marketSummary('p1').min; }
    marketMedP1(): number | null { return this.marketSummary('p1').med; }
    marketMaxP1(): number | null { return this.marketSummary('p1').max; }

    marketMinP2(): number | null { return this.marketSummary('p2').min; }
    marketMedP2(): number | null { return this.marketSummary('p2').med; }
    marketMaxP2(): number | null { return this.marketSummary('p2').max; }

    expandedBookieId: number | null = null;

    toggleBookie(bookieId: number): void {
        this.expandedBookieId = this.expandedBookieId === bookieId ? null : bookieId;
    }

    get oddsRows(): OddsRow[] {
        const o = (this._details as any)?.o as OddsRow[] | undefined;
        return Array.isArray(o) ? o : [];
    }

    private isCleanOddsRow(r: OddsRow): boolean {
        const suspicious = !!r.o07 || !!r.o08 || ((r.o09 ?? 0) !== 0);
        return !suspicious && (r.o05 ?? 0) > 0 && (r.o06 ?? 0) > 0;
    }

    private oddsTimeMs(r: OddsRow): number | null {
        const v: unknown = r.o03; // ključni fix za TS "instanceof" error
        if (!v) return null;

        const d = (v instanceof Date) ? v : new Date(v as any);
        const ms = d.getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    private seriesOrdinal(r: OddsRow): number {
        return Number.isFinite(r.o04 as number) ? Number(r.o04) : 0;
    }

    /** Sve čiste odds stavke (bez filtriranja po seriji) */
    get cleanOddsRows(): OddsRow[] {
        return this.oddsRows.filter(r => this.isCleanOddsRow(r));
    }

    /** Zadnji (latest) red po bookie-u: usporedi po vremenu, fallback po seriesOrdinal */
    get latestOddsByBookie(): OddsRow[] {
        const best = new Map<number, OddsRow>();

        for (const r of this.cleanOddsRows) {
            const id = Number(r.o01);
            const cur = best.get(id);
            if (!cur) { best.set(id, r); continue; }

            const tA = this.oddsTimeMs(r) ?? -1;
            const tB = this.oddsTimeMs(cur) ?? -1;

            if (tA !== tB) {
                if (tA > tB) best.set(id, r);
                continue;
            }

            // fallback: seriesOrdinal (veći = noviji)
            if (this.seriesOrdinal(r) > this.seriesOrdinal(cur)) {
                best.set(id, r);
            }
        }

        return Array.from(best.values()).sort((a, b) => (a.o02 ?? '').localeCompare(b.o02 ?? ''));
    }

    /** Cijela povijest za bookie: novije -> starije (time desc, fallback seriesOrdinal desc) */
    bookieHistory(bookieId: number): OddsRow[] {
        const id = Number(bookieId);

        const rows = this.oddsRows
            .filter(r => Number(r?.o01) === id)
            .filter(r => this.isCleanOddsRow(r))
            .slice();

        rows.sort((a, b) => {
            const tb = this.oddsTimeMs(b) ?? -1;
            const ta = this.oddsTimeMs(a) ?? -1;
            if (tb !== ta) return tb - ta;

            const sb = this.seriesOrdinal(b);
            const sa = this.seriesOrdinal(a);
            return sb - sa;
        });

        return rows;
    }

    historyFirstColLabel = 'Time';

    // =================================================================================================
    // TRUE SKILL SUMMARY (minified match keys in details archive)
    // =================================================================================================

    isFinishedNow(): boolean {
        return this.raw?.['m656'] === true;
    }

    isCurrentSurface(s: 'S1' | 'S2' | 'S3' | 'S4'): boolean {
        const rawSurface = String(this.raw?.['m020'] ?? '').toUpperCase();
        return rawSurface.includes(s);
    }

    private tsMinKey(side: 'p1' | 'p2', metric: RatingMetric): string | undefined {
        const player = side === 'p1' ? 1 : 2;
        const oldNew: 'Old' | 'New' = this.raw?.['m656'] === true ? 'New' : 'Old';
        const surf: SurfaceScope = this.SurfaceScope;

        // e.g. "1_Mean_New_M_S3"
        const key = `${player}_${metric}_${oldNew}_${this.RatingMode}_${surf}` as TsKey;
        return TS_MIN_MAP[key];
    }

    private tsMinValue(side: 'p1' | 'p2', metric: RatingMetric): number | undefined {
        const mk = this.tsMinKey(side, metric);
        if (!mk) return undefined;
        return this.numOrUndef(this.raw?.[mk]);
    }

    tsMean(side: 'p1' | 'p2'): number | undefined {
        return this.tsMinValue(side, 'Mean');
    }

    tsSd(side: 'p1' | 'p2'): number | undefined {
        return this.tsMinValue(side, 'SD');
    }

    /**
     * Reads only P1 WP key and derives P2 as (1 - P1).
     * WP is normalized to 0..1 (some sources might store 0..100).
     */
    tsWp(side: 'p1' | 'p2'): number | undefined {
        const wp1Key = this.tsMinKey('p1', 'WP');
        const wp1 = this.numOrUndef(this.raw?.[wp1Key ?? '']);

        if (typeof wp1 !== 'number' || !isFinite(wp1)) return undefined;

        const wp01 = wp1 > 1 ? wp1 / 100 : wp1;
        return side === 'p1' ? wp01 : 1 - wp01;
    }

    tsNum(v: number | undefined): string {
        if (typeof v !== 'number' || !isFinite(v)) return '—';
        return v.toFixed(2);
    }

    wpPct(v: number | undefined): string {
        if (typeof v !== 'number' || !isFinite(v)) return '—';
        return `${(v * 100).toFixed(2)}%`;
    }

    // =================================================================================================
    // TRUE SKILL BREAKDOWN (TS + WP charts)
    // -------------------------------------------------------------------------------------------------
    // Data source:
    // - staticArchives.getTsHistory(playerTPId) returns a JSON like:
    //   { p: <playerId>, s: { "M_ALL": [{ m, d, t, s }, ...], "M_S1": [...], ... } }
    //     - m: matchTPId
    //     - d: ISO date string (we normalize to day-only)
    //     - t: mean (mu)
    //     - s: sigma (sd)
    //
    // Timeline strategy (why mergedSeries length stays stable):
    // - We always render both players on the SAME day-level timeline (shared X-axis).
    // - If SurfaceScope === 'ALL':
    //     timeline = union of P1 ALL days + P2 ALL days (+ match day).
    // - If SurfaceScope === 'S1'..'S4':
    //     timeline is still based on ALL-days,
    //     but surface values update only on days where a surface match exists.
    //     Other days forward-fill the last known surface rating.
    //     This prevents "forest of vertical bars" artifacts.
    //
    // Debug sanity metric ("changes"):
    // - Number of day steps where either player's mean changes vs previous point.
    //   ALL surface typically has lots of changes, rare surfaces much fewer.
    // =================================================================================================

    /**
     * Selects a TS history series for given rating mode and surface scope.
     *
     * Key in archive:
     * - `${mode}_${surface}` => e.g. "M_ALL", "M_S4"
     *
     * Normalization steps:
     * 1) Normalize date to day-only (YYYY-MM-DD)
     * 2) Sort by day then matchId (tie-breaker)
     * 3) Dedupe by day (keep last) => stable "one point per day"
     */
    public selectTsSeries(archive: any, mode: RatingMode, surface: SurfaceScope): TsPoint[] {
        const key = `${mode}_${surface}`; // "M_ALL", "M_S4"...
        const arr = archive?.s?.[key];
        if (!Array.isArray(arr)) return [];

        // Normalize everything to day-level and keep only valid points.
        const parsed = arr
            .map((x: any) => {
                const dRaw = String(x?.d ?? '');
                const day = dRaw.slice(0, 10); // normalize to YYYY-MM-DD
                return {
                    m: Number(x?.m),
                    d: day,
                    mu: Number(x?.t),
                    sd: Number(x?.s),
                } as TsPoint;
            })
            .filter(
                (p) =>
                    Number.isFinite(p.m) &&
                    p.d.length === 10 &&
                    Number.isFinite(Date.parse(`${p.d}T00:00:00.000Z`)) &&
                    Number.isFinite(p.mu) &&
                    Number.isFinite(p.sd)
            )
            .sort((a, b) => Date.parse(a.d) - Date.parse(b.d) || a.m - b.m);

        // Dedupe by day (keep last point within the day).
        // This avoids multiple points on the same date causing vertical spikes in the SVG path.
        const byDay = new Map<string, TsPoint>();
        for (const p of parsed) byDay.set(p.d, p);

        return [...byDay.values()].sort((a, b) => Date.parse(a.d) - Date.parse(b.d));
    }

    private unwrapTsResponse(resp: any): any {
        // backend: { ok, playerTPId, data: { p, s } }
        if (resp && typeof resp === 'object') {
            if (resp.data && resp.data.s) return resp.data;
            if (resp.s) return resp; // already unwrapped
        }
        return null;
    }

    private getTsHistoryCached$(playerId: number): Observable<any> {
        const cached = this.tsHistCache.get(playerId);
        if (cached) return of(cached);

        return this.staticArchives.getTsHistory(playerId).pipe(
            map((resp: any) => {
                const data = this.unwrapTsResponse(resp);

                // 🔥 debug (privremeno, ali sad nam je zlato)
                console.log('[TS] getTsHistoryCached$ resp keys', Object.keys(resp ?? {}));
                console.log('[TS] getTsHistoryCached$ unwrapped has s?', !!data?.s);

                if (!data?.s) return null;

                this.tsHistCache.set(playerId, data);
                return data;
            }),
            catchError((err) => {
                console.error('[TS] getTsHistoryCached$ failed', playerId, err);
                return of(null);
            })
        );
    }

    private loadTsHistoryAndBuildSeries(): void {
        const p1Id = Number(this.raw?.['m004']);
        const p2Id = Number(this.raw?.['m005']);

        if (!Number.isFinite(p1Id) || !Number.isFinite(p2Id)) {
            this.tsBreakdownError = 'Missing playerTPId (expected raw.m004 / raw.m005).';
            return;
        }

        console.log('[TS] loadTsHistoryAndBuildSeries', {
            p1Id,
            p2Id,
            mode: this.RatingMode,
            surface: this.SurfaceScope,
        });

        this.tsBreakdownLoading = true;
        this.tsBreakdownError = null;

        this.getTsHistoryCached$(p1Id)
            .pipe(
                switchMap((a1) => this.getTsHistoryCached$(p2Id).pipe(map((a2) => ({ a1, a2 })))),
                map(({ a1, a2 }) => {
                    if (!a1 || !a2) {
                        this.tsBreakdownError = 'TS history missing for one or both players (404).';
                        this.p1Series = [];
                        this.p2Series = [];
                        this.mergedSeries = [];
                        return false;
                    }

                    // Always compute ALL series because we use it as master timeline for surface-specific modes.
                    const p1All = this.selectTsSeries(a1, this.RatingMode, 'ALL');
                    const p2All = this.selectTsSeries(a2, this.RatingMode, 'ALL');

                    console.log('[TS] p1All sample', p1All.slice(0, 3));
                    console.log('[TS] p2All sample', p2All.slice(0, 3));

                    const p1Surf = this.selectTsSeries(a1, this.RatingMode, this.SurfaceScope);
                    const p2Surf = this.selectTsSeries(a2, this.RatingMode, this.SurfaceScope);

                    this.p1Series = p1Surf;
                    this.p2Series = p2Surf;

                    if (this.SurfaceScope === 'ALL') {
                        this.mergedSeries = this.mergeForwardFillWithDefaults(p1All, p2All);
                    } else {
                        this.mergedSeries = this.mergeSurfaceOnAllTimelineWithDefaults(p1All, p2All, p1Surf, p2Surf);
                    }

                    // Debug sanity metric: count how many steps actually change.
                    const changes = this.mergedSeries.reduce((acc, p, i, arr) => {
                        if (i === 0) return 0;
                        return acc + (arr[i - 1].p1mu !== p.p1mu || arr[i - 1].p2mu !== p.p2mu ? 1 : 0);
                    }, 0);

                    console.log('[TS] merged stats', {
                        surface: this.SurfaceScope,
                        points: this.mergedSeries.length,
                        changes,
                        p1SurfPoints: p1Surf.length,
                        p2SurfPoints: p2Surf.length,
                    });

                    // Reset tooltips on rebuild.
                    this.pinnedTooltip = null;

                    // Pin tooltip near match date (or last point fallback).
                    const matchMs = Date.parse(String(this.raw?.['m003'] ?? ''));
                    if (this.mergedSeries.length) {
                        let idx = this.mergedSeries.length - 1;

                        if (Number.isFinite(matchMs)) {
                            idx = this.nearestIndexByTime(this.mergedSeries, matchMs);
                        }

                        this.pinnedTooltip = {
                            leftPx: 0,
                            topPx: 0,
                            ...this.buildTooltipFromMerged(this.mergedSeries[idx]),
                        };
                    }

                    return true;
                }),
                catchError((err: any) => {
                    console.error('[TS] load failed', err);
                    this.tsBreakdownError = err?.message || 'Failed to load TS history.';
                    return of(false);
                })
            )
            .subscribe({
                next: () => {
                    this.tsBreakdownLoading = false;
                },
                error: () => {
                    this.tsBreakdownLoading = false;
                },
            });
    }

    // =================================================================================================
    // SVG TOOLTIP HELPERS
    // =================================================================================================

    private buildTooltipFromMerged(p: TsMergedPoint): Omit<ChartTooltip, 'leftPx' | 'topPx'> {
        return {
            dateLabel: this.formatDateShort(p.time),
            p1Label: this.playerLabel('p1'),
            p2Label: this.playerLabel('p2'),
            mu1: p.p1mu,
            sd1: p.p1sd,
            wp1: p.wp1,
            mu2: p.p2mu,
            sd2: p.p2sd,
            wp2: 1 - p.wp1,
        };
    }

    private playerLabel(player: 'p1' | 'p2'): string {
        const p = player === 'p1' ? this.vm?.p1 : this.vm?.p2;
        const name = p?.name ?? (player === 'p1' ? 'P1' : 'P2');
        const iso3 = (p?.iso3 ?? '').trim();
        return iso3 ? `${name} (${iso3})` : name;
    }

    private getChartTipEl(): HTMLElement | null {
        const el = this.chartTipRefs?.first?.nativeElement;
        return el ?? null;
    }

    // =================================================================================================
    // WP SVG CHART MODEL + EVENTS (based on mergedSeries.wp1)
    // =================================================================================================

    getWpChartModel(): {
        tMin: number;
        tMax: number;
        vMin: number;
        vMax: number;

        wp1Path: string;
        wp2Path: string | null;

        xTicks: { x: number; label: string }[];
        yTicks: { y: number; label: string }[];

        matchX: number | null;

        hoverX: number | null;
        hoverY1: number | null;
        hoverY2: number | null;
    } | null {
        const full = this.mergedSeries;
        if (!Array.isArray(full) || full.length < 2) return null;

        // draw-series: collapse to 1 point/day (keep last)
        const data = this.collapseMergedByDayKeepLast(full);
        if (data.length < 2) return null;

        const tMin = data[0].time;
        const tMax = data[data.length - 1].time;

        // WP always fixed 0..1
        const vMin = 0;
        const vMax = 1;

        const wp1Points = data.map((x) => ({
            time: x.time,
            value: Math.min(1, Math.max(0, Number(x.wp1))),
        }));

        const wp2Points = data.map((x) => ({
            time: x.time,
            value: 1 - Math.min(1, Math.max(0, Number(x.wp1))),
        }));

        const wp1Path = this.buildStepPath(wp1Points, tMin, tMax, vMin, vMax);
        const wp2Path = this.buildStepPath(wp2Points, tMin, tMax, vMin, vMax);

        // X ticks
        const xTicks: { x: number; label: string }[] = [];
        const xCount = 5;
        for (let i = 0; i < xCount; i++) {
            const tt = tMin + ((tMax - tMin) * i) / (xCount - 1);
            xTicks.push({ x: this.scaleX(tt, tMin, tMax), label: this.formatDateShort(tt) });
        }

        // Y ticks
        const yTicks: { y: number; label: string }[] = [];
        const ySteps = [0, 0.25, 0.5, 0.75, 1];
        for (const vv of ySteps) {
            yTicks.push({ y: this.scaleY(vv, vMin, vMax), label: `${Math.round(vv * 100)}%` });
        }

        // Match vertical line
        let matchX: number | null = null;
        const matchMs = Date.parse(String(this.raw?.['m003'] ?? ''));
        if (Number.isFinite(matchMs) && matchMs >= tMin && matchMs <= tMax) {
            matchX = this.scaleX(matchMs, tMin, tMax);
        }

        // Hover remains based on full mergedSeries indexing
        let hoverX: number | null = null;
        let hoverY1: number | null = null;
        let hoverY2: number | null = null;

        if (this.hoverIdx != null && this.hoverIdx >= 0 && this.hoverIdx < full.length) {
            const p = full[this.hoverIdx];
            const wp1 = Math.min(1, Math.max(0, Number(p.wp1)));
            const wp2 = 1 - wp1;

            const t = Math.min(Math.max(p.time, tMin), tMax);
            hoverX = this.scaleX(t, tMin, tMax);
            hoverY1 = this.scaleY(wp1, vMin, vMax);
            hoverY2 = this.scaleY(wp2, vMin, vMax);
        }

        return {
            tMin,
            tMax,
            vMin,
            vMax,
            wp1Path,
            wp2Path,
            xTicks,
            yTicks,
            matchX,
            hoverX,
            hoverY1,
            hoverY2,
        };
    }

    onWpChartMouseMove(ev: MouseEvent, cm: any): void {
        const data = this.mergedSeries;
        if (!data?.length) return;

        const svg = ev.currentTarget as SVGElement;
        const { rect, sx, sy } = this.getSvgViewport(svg);

        // mouse X in real pixels
        const xPx = ev.clientX - rect.left;

        // convert to virtual X (so invScaleX works in chart coordinate system)
        const xVirtual = xPx / sx;
        const t = this.invScaleX(xVirtual, cm.tMin, cm.tMax);

        const idx = this.nearestIndexByTime(data, t);
        this.hoverIdx = idx;

        const p = data[idx];
        const wp1 = Math.min(1, Math.max(0, Number(p.wp1)));
        const wp2 = 1 - wp1;

        // virtual coordinates
        const hoverXVirtual = this.scaleX(p.time, cm.tMin, cm.tMax);
        const hoverYVirtual = this.scaleY(wp1, cm.vMin, cm.vMax);

        // convert to real pixels for tooltip
        const hoverXPx = hoverXVirtual * sx;
        const hoverYPx = hoverYVirtual * sy;

        // tooltip dimensions (aligned with CSS max-width)
        const tipW = 360;
        const tipH = 95;
        const pad = 10;

        const left = this.clamp(hoverXPx - tipW / 2, pad, rect.width - tipW - pad);
        const top = this.clamp(hoverYPx - tipH - 10, pad, rect.height - tipH - pad);

        this.hoverTooltip = {
            leftPx: left,
            topPx: top,
            dateLabel: this.formatDateShort(p.time),

            p1Label: this.playerLabel('p1'),
            p2Label: this.playerLabel('p2'),

            mu1: p.p1mu,
            sd1: p.p1sd,
            wp1,

            mu2: p.p2mu,
            sd2: p.p2sd,
            wp2,
        };
    }

    onWpChartMouseLeave(): void {
        this.hoverIdx = null;
        this.hoverTooltip = null;
    }

    // =================================================================================================
    // TS SVG CHART MODEL + EVENTS (TS mean lines + optional regression trend)
    // =================================================================================================

    getTsChartModel(): {
        tMin: number;
        tMax: number;
        vMin: number;
        vMax: number;

        p1Path: string;
        p2Path: string;

        p1TrendPath: string | null;
        p2TrendPath: string | null;

        xTicks: { x: number; label: string }[];
        yTicks: { y: number; label: string }[];

        matchX: number | null;

        hoverX: number | null;
        hoverY1: number | null;
        hoverY2: number | null;
    } | null {
        const full = this.mergedSeries;
        if (!Array.isArray(full) || full.length < 2) return null;

        const isPercent = this.activeTab === 'wpBreakdown';
        const useStep = isPercent; // WP => step, TS => line

        // draw-series: collapse to 1 point/day (keep last)
        const data = this.collapseMergedByDayKeepLast(full);
        if (data.length < 2) return null;

        const tMin = data[0].time;
        const tMax = data[data.length - 1].time;

        // ---- extent values ----
        const vals: number[] = [];
        for (const p of data) {
            if (isPercent) {
                const wp1 = Number(p.wp1);
                if (Number.isFinite(wp1)) vals.push(wp1, 1 - wp1);
            } else {
                const a = Number(p.p1mu);
                const b = Number(p.p2mu);
                if (Number.isFinite(a)) vals.push(a);
                if (Number.isFinite(b)) vals.push(b);
            }
        }

        const { min, max } = this.extent(vals);
        const range = Math.max(1e-9, max - min);
        const eps = range * 0.05;

        let vMin = min - eps;
        let vMax = max + eps;

        if (isPercent) {
            vMin = Math.max(0, vMin);
            vMax = Math.min(1, vMax);
        }

        // ---- points ----
        const p1Points: { time: number; value: number }[] = [];
        const p2Points: { time: number; value: number }[] = [];

        for (const p of data) {
            const pair = this.getChartValuePair(p);
            p1Points.push({ time: p.time, value: pair.y1 });
            p2Points.push({ time: p.time, value: pair.y2 });
        }

        // ---- paths ----
        const p1Path = useStep
            ? this.buildStepPath(p1Points, tMin, tMax, vMin, vMax)
            : this.buildLinePath(p1Points, tMin, tMax, vMin, vMax);

        const p2Path = useStep
            ? this.buildStepPath(p2Points, tMin, tMax, vMin, vMax)
            : this.buildLinePath(p2Points, tMin, tMax, vMin, vMax);

        // ---- trend lines (TS only; no sense for WP) ----
        let p1TrendPath: string | null = null;
        let p2TrendPath: string | null = null;

        if (this.showTrend && !isPercent) {
            const r1 = this.linearRegressionLine(p1Points, tMin, tMax);
            const r2 = this.linearRegressionLine(p2Points, tMin, tMax);

            if (r1) {
                const x1 = this.scaleX(tMin, tMin, tMax);
                const x2 = this.scaleX(tMax, tMin, tMax);
                const y1 = this.scaleY(r1.yAtMin, vMin, vMax);
                const y2 = this.scaleY(r1.yAtMax, vMin, vMax);
                p1TrendPath = `M ${x1} ${y1} L ${x2} ${y2}`;
            }

            if (r2) {
                const x1 = this.scaleX(tMin, tMin, tMax);
                const x2 = this.scaleX(tMax, tMin, tMax);
                const y1 = this.scaleY(r2.yAtMin, vMin, vMax);
                const y2 = this.scaleY(r2.yAtMax, vMin, vMax);
                p2TrendPath = `M ${x1} ${y1} L ${x2} ${y2}`;
            }
        }

        // ---- ticks ----
        const xTicks: { x: number; label: string }[] = [];
        const xCount = 5;
        for (let i = 0; i < xCount; i++) {
            const tt = tMin + ((tMax - tMin) * i) / (xCount - 1);
            xTicks.push({ x: this.scaleX(tt, tMin, tMax), label: this.formatDateShort(tt) });
        }

        const yTicks: { y: number; label: string }[] = [];
        const yCount = 5;
        for (let i = 0; i < yCount; i++) {
            const vv = vMin + ((vMax - vMin) * i) / (yCount - 1);
            yTicks.push({
                y: this.scaleY(vv, vMin, vMax),
                label: isPercent ? `${Math.round(vv * 100)}%` : vv.toFixed(1),
            });
        }

        // ---- match vertical line ----
        let matchX: number | null = null;
        const matchMs = Date.parse(String(this.raw?.['m003'] ?? ''));
        if (Number.isFinite(matchMs) && matchMs >= tMin && matchMs <= tMax) {
            matchX = this.scaleX(matchMs, tMin, tMax);
        }

        // ---- hover (based on full mergedSeries index) ----
        let hoverX: number | null = null;
        let hoverY1: number | null = null;
        let hoverY2: number | null = null;

        if (this.hoverIdx != null && this.hoverIdx >= 0 && this.hoverIdx < full.length) {
            const p = full[this.hoverIdx];
            const t = Math.min(Math.max(p.time, tMin), tMax);
            hoverX = this.scaleX(t, tMin, tMax);

            const pair = this.getChartValuePair(p);
            hoverY1 = this.scaleY(pair.y1, vMin, vMax);
            hoverY2 = this.scaleY(pair.y2, vMin, vMax);
        }

        return {
            tMin,
            tMax,
            vMin,
            vMax,
            p1Path,
            p2Path,
            p1TrendPath,
            p2TrendPath,
            xTicks,
            yTicks,
            matchX,
            hoverX,
            hoverY1,
            hoverY2,
        };
    }

    onTsChartMouseMove(ev: MouseEvent, cm: any): void {
        const data = this.mergedSeries;
        if (!data?.length) return;

        const svg = ev.currentTarget as SVGElement;
        const { rect, sx, sy } = this.getSvgViewport(svg);

        // mouse X in real pixels
        const xPx = ev.clientX - rect.left;

        // convert to virtual X so invScaleX works properly
        const xVirtual = xPx / sx;
        const t = this.invScaleX(xVirtual, cm.tMin, cm.tMax);

        const idx = this.nearestIndexByTime(data, t);
        this.hoverIdx = idx;

        const p = data[idx];

        // virtual anchor points
        const hoverXVirtual = this.scaleX(p.time, cm.tMin, cm.tMax);
        const anchorYVirtual = this.scaleY(p.p1mu, cm.vMin, cm.vMax);

        // real pixels for tooltip positioning
        const hoverXPx = hoverXVirtual * sx;
        const anchorYPx = anchorYVirtual * sy;

        const tipW = 360;
        const tipH = 95;
        const pad = 10;

        const left = this.clamp(hoverXPx - tipW / 2, pad, rect.width - tipW - pad);
        const top = this.clamp(anchorYPx - tipH - 10, pad, rect.height - tipH - pad);

        this.hoverTooltip = {
            leftPx: left,
            topPx: top,
            dateLabel: this.formatDateShort(p.time),

            p1Label: this.playerLabel('p1'),
            p2Label: this.playerLabel('p2'),

            mu1: p.p1mu,
            sd1: p.p1sd,
            wp1: p.wp1,

            mu2: p.p2mu,
            sd2: p.p2sd,
            wp2: 1 - p.wp1,
        };
    }

    onTsChartMouseLeave(): void {
        this.hoverIdx = null;
        this.hoverTooltip = null;
    }

    private getChartValuePair(p: TsMergedPoint): { y1: number; y2: number; isPercent: boolean } {
        if (this.activeTab === 'wpBreakdown') {
            const wp1 = p.wp1;
            const wp2 = 1 - p.wp1;
            return { y1: wp1, y2: wp2, isPercent: true };
        }

        // default: TS Breakdown => mean
        return { y1: p.p1mu, y2: p.p2mu, isPercent: false };
    }

    // =================================================================================================
    // TRUE SKILL MERGING (forward-fill + defaults)
    // =================================================================================================

    private mergeForwardFillWithDefaults(p1: TsPoint[], p2: TsPoint[]): TsMergedPoint[] {
        if (!p1.length && !p2.length) return [];

        const TS_DEFAULT_MU = 25;
        const TS_DEFAULT_SD = 8.3333333333;

        // Forward-fill strategy:
        // - If a player has no rating yet, start from TrueSkill defaults (mu=25, sd=8.33).
        // - For each day on the unified timeline, advance pointers and keep last known mu/sd.
        // - This produces a smooth "evolution over time" series.
        const p1d = p1
            .map((x) => ({ ...x, _t: Date.parse(`${x.d}T00:00:00.000Z`) }))
            .filter((x) => Number.isFinite((x as any)._t))
            .sort((a: any, b: any) => a._t - b._t);

        const p2d = p2
            .map((x) => ({ ...x, _t: Date.parse(`${x.d}T00:00:00.000Z`) }))
            .filter((x) => Number.isFinite((x as any)._t))
            .sort((a: any, b: any) => a._t - b._t);

        if (!p1d.length && !p2d.length) return [];

        // Timeline = union of all DAY timestamps
        const ts = new Set<number>();
        for (const x of p1d as any[]) ts.add(x._t);
        for (const x of p2d as any[]) ts.add(x._t);

        // Include match day (pinned/vertical line), normalized to day-only UTC
        const matchIso = String(this.raw?.['m003'] ?? '');
        const matchDayMs = Date.parse(`${matchIso.slice(0, 10)}T00:00:00.000Z`);
        if (Number.isFinite(matchDayMs)) ts.add(matchDayMs);

        const timeline = [...ts].sort((a, b) => a - b);
        if (timeline.length < 2) return [];

        let i1 = 0,
            i2 = 0;
        let lastMu1 = TS_DEFAULT_MU,
            lastSd1 = TS_DEFAULT_SD;
        let lastMu2 = TS_DEFAULT_MU,
            lastSd2 = TS_DEFAULT_SD;

        const out: TsMergedPoint[] = [];

        for (const time of timeline) {
            while (i1 < p1d.length && (p1d as any)[i1]._t <= time) {
                lastMu1 = p1d[i1].mu;
                lastSd1 = p1d[i1].sd;
                i1++;
            }

            while (i2 < p2d.length && (p2d as any)[i2]._t <= time) {
                lastMu2 = p2d[i2].mu;
                lastSd2 = p2d[i2].sd;
                i2++;
            }

            const wp1 = this.calcWp1TrueSkill(lastMu1, lastSd1, lastMu2, lastSd2);

            out.push({
                time,
                p1mu: lastMu1,
                p1sd: lastSd1,
                p2mu: lastMu2,
                p2sd: lastSd2,
                wp1,
            });
        }

        return out;
    }

    private mergeSurfaceOnAllTimelineWithDefaults(
        p1All: TsPoint[],
        p2All: TsPoint[],
        p1Surf: TsPoint[],
        p2Surf: TsPoint[]
    ): TsMergedPoint[] {
        const TS_DEFAULT_MU = 25;
        const TS_DEFAULT_SD = 8.3333333333;

        if (!p1All.length && !p2All.length) return [];

        // Surface-on-ALL timeline:
        // - Timeline comes from ALL-days history (shared X-axis).
        // - Surface values only update on days where a surface match exists.
        // - Other days forward-fill last known surface rating values.
        const p1SurfByDay = new Map(p1Surf.map((p) => [p.d.slice(0, 10), p]));
        const p2SurfByDay = new Map(p2Surf.map((p) => [p.d.slice(0, 10), p]));

        // timeline = ALL days
        const days = new Set<string>();
        for (const p of p1All) days.add(p.d.slice(0, 10));
        for (const p of p2All) days.add(p.d.slice(0, 10));

        const timeline = [...days].sort();

        let lastMu1 = TS_DEFAULT_MU;
        let lastSd1 = TS_DEFAULT_SD;
        let lastMu2 = TS_DEFAULT_MU;
        let lastSd2 = TS_DEFAULT_SD;

        const out: TsMergedPoint[] = [];

        for (const day of timeline) {
            const s1 = p1SurfByDay.get(day);
            const s2 = p2SurfByDay.get(day);

            if (s1) {
                lastMu1 = s1.mu;
                lastSd1 = s1.sd;
            }
            if (s2) {
                lastMu2 = s2.mu;
                lastSd2 = s2.sd;
            }

            const wp1 = this.calcWp1TrueSkill(lastMu1, lastSd1, lastMu2, lastSd2);
            const time = Date.parse(day);

            out.push({
                time,
                p1mu: lastMu1,
                p1sd: lastSd1,
                p2mu: lastMu2,
                p2sd: lastSd2,
                wp1,
            });
        }

        return out;
    }

    // =================================================================================================
    // TRUESKILL -> WP MATH (Normal CDF approximation)
    // =================================================================================================

    private readonly TS_BETA = 4.1666666667;

    private erfApprox(x: number): number {
        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x);
        const a1 = 0.254829592,
            a2 = -0.284496736,
            a3 = 1.421413741,
            a4 = -1.453152027,
            a5 = 1.061405429;
        const p = 0.3275911;
        const t = 1.0 / (1.0 + p * x);
        const y =
            1.0 -
            (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
        return sign * y;
    }

    private normalCdf(z: number): number {
        return 0.5 * (1 + this.erfApprox(z / Math.SQRT2));
    }

    private calcWp1TrueSkill(p1mu: number, p1sd: number, p2mu: number, p2sd: number): number {
        const denom = Math.sqrt(2 * this.TS_BETA * this.TS_BETA + p1sd * p1sd + p2sd * p2sd);
        const z = (p1mu - p2mu) / denom;
        return this.normalCdf(z);
    }

    // =================================================================================================
    // MISC: TS strength helpers (stars + tooltips)
    // =================================================================================================

    private numOrNull(v: any): number | null {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    private avg3(a: number | null, b: number | null, c: number | null): number | null {
        if (a == null || b == null || c == null) return null;
        return (a + b + c) / 3;
    }

    // P1: (m027 + m036 + m045) / 3
    p1StrengthTs(d: any): number | null {
        return this.avg3(this.numOrNull(d?.m027), this.numOrNull(d?.m036), this.numOrNull(d?.m045));
    }

    // P2: (m029 + m038 + m047) / 3
    p2StrengthTs(d: any): number | null {
        return this.avg3(this.numOrNull(d?.m029), this.numOrNull(d?.m038), this.numOrNull(d?.m047));
    }

    p1StrengthStars(d: any): number {
        const ts = this.p1StrengthTs(d);
        return ts == null ? 0 : this.tsToStars(ts);
    }

    p2StrengthStars(d: any): number {
        const ts = this.p2StrengthTs(d);
        return ts == null ? 0 : this.tsToStars(ts);
    }

    p1StrengthTooltip(d: any): string {
        const ts = this.p1StrengthTs(d);
        return `TS: ${ts == null ? '-' : ts.toFixed(2)}`;
    }

    p2StrengthTooltip(d: any): string {
        const ts = this.p2StrengthTs(d);
        return `TS: ${ts == null ? '-' : ts.toFixed(2)}`;
    }

    // =================================================================================================
    // TOURNAMENT META (type labels, prize, strength)
    // =================================================================================================

    tourTypeLabel(d: any): 'ATP' | 'WTA' | '' {
        // 1) parent hint is most reliable
        if (this.genderHint === 'W') return 'WTA';
        if (this.genderHint === 'M') return 'ATP';

        // 2) fallback from raw fields if present
        const s = String(d?.t?.t03 ?? d?.tournamentTypeName ?? d?.tournamentType ?? '').toUpperCase();
        if (s.includes('WTA')) return 'WTA';
        if (s.includes('ATP')) return 'ATP';
        return '';
    }

    formatUsdDots(amount: number | undefined): string {
        if (typeof amount !== 'number' || !isFinite(amount)) return '—';
        const formatted = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(amount);
        return `${formatted} $`;
    }

    tournamentStrengthTs(d: any): number | undefined {
        const n = Number(d?.t?.t17);
        return Number.isFinite(n) ? n : undefined;
    }

    // =================================================================================================
    // SCORE PARSING / FORMATTING
    // =================================================================================================

    formatMainScore(raw: string): string {
        if (!raw) return '—';

        if (raw.includes(':')) {
            const [a, b] = raw.split(':');
            return `${a.trim()} : ${b.trim()}`;
        }

        // fallback: "20" -> "2 : 0"
        if (raw.length === 2) {
            return `${raw[0]} : ${raw[1]}`;
        }

        return raw;
    }

    private parseSetTokensFromM011(m011: string, m010Raw?: string): string[] {
        if (!m011) return [];

        const tokens = m011.trim().split(/\s+/).filter(Boolean);
        if (!tokens.length) return [];

        // Remove leading match-score token "20"/"21"/"30" if present
        const first = tokens[0];
        const looksLikeMain = /^\d{2}$/.test(first);
        const sameAsM010 = m010Raw ? m010Raw.replace(/\D/g, '') === first : false;

        // If the first looks like main score and (matches m010 or has enough set tokens after), remove it
        if (looksLikeMain && (sameAsM010 || tokens.length >= 3)) {
            tokens.shift();
        }

        return tokens;
    }

    private formatSetsFromTokens(tokens: string[]): string {
        return tokens
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => `${t[0]}:${t.slice(1)}`)
            .join(' ');
    }

    private normalizeSetTokenToGames(token: string): { a: number; b: number } | null {
        // token: "64", "67(10)", "76(8)"...
        const m = token.trim().match(/^(\d)(\d)(?:\(\d+\))?$/);
        if (!m) return null;
        const a = Number(m[1]);
        const b = Number(m[2]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        return { a, b };
    }

    private calcMainFromSets(tokens: string[]): { p1: number; p2: number } | null {
        if (!tokens.length) return null;

        let p1 = 0,
            p2 = 0;
        for (const t of tokens) {
            const g = this.normalizeSetTokenToGames(t);
            if (!g) continue;

            if (g.a > g.b) p1++;
            else if (g.b > g.a) p2++;
        }

        if (p1 === 0 && p2 === 0) return null;
        return { p1, p2 };
    }

    private formatMainFromSets(tokens: string[]): string | null {
        const res = this.calcMainFromSets(tokens);
        if (!res) return null;
        return `${res.p1} : ${res.p2}`;
    }

    private isFinished(d: any, scoreMain: string, scoreSets: string): boolean {
        // Best effort: if archive includes a flag, use it; otherwise fallback to score presence
        const flag = d?.IsFinished ?? d?.isFinished ?? d?.mIsFinished;
        if (flag === 1 || flag === true) return true;

        const hasScore = (scoreMain || '').trim().length > 0 || (scoreSets || '').trim().length > 0;
        return hasScore;
    }

    // =================================================================================================
    // DATE FORMATTING
    // =================================================================================================

    private formatMatchDate(iso: any): string {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return this.safeText(iso);

        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();

        // bug pre-2004
        if (yyyy < 2004) return `${dd}.${mm}.${yyyy}`;

        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
    }

    private formatBornWithAge(birthIso: any): string {
        if (!birthIso) return '';
        const b = new Date(birthIso);
        if (isNaN(b.getTime())) return '';

        const dd = String(b.getDate()).padStart(2, '0');
        const mm = String(b.getMonth() + 1).padStart(2, '0');
        const yyyy = b.getFullYear();

        const age = this.ageNow(birthIso);
        return age != null ? `${dd}.${mm}.${yyyy} (${age})` : `${dd}.${mm}.${yyyy}`;
    }

    private ageNow(birthIso: any): number | null {
        const b = new Date(birthIso);
        const now = new Date();
        if (isNaN(b.getTime())) return null;

        let age = now.getFullYear() - b.getFullYear();
        const m = now.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
        return age >= 0 && age < 120 ? age : null;
    }

    private formatDateShort(ms: number): string {
        const d = new Date(ms);
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = d.getUTCFullYear();
        return `${dd}.${mm}.${yyyy}`;
    }

    // =================================================================================================
    // NUM HELPERS (local)
    // =================================================================================================

    private numOrUndef(v: any): number | undefined {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    }

    private num(v: number): number {
        const n = Number(v);
        return n;
    }
    private impliedProb(odds: number | undefined): number | undefined {
        if (typeof odds !== 'number' || !isFinite(odds) || odds <= 0) return undefined;
        return 1 / odds;
    }

    private edge(nnProb01: number | undefined, odds: number | undefined): number | undefined {
        const imp = this.impliedProb(odds);
        if (typeof nnProb01 !== 'number' || !isFinite(nnProb01) || typeof imp !== 'number') return undefined;
        return nnProb01 - imp;
    }

    // =================================================================================================
    // GEOMETRY + PATH BUILDERS (SVG math)
    // =================================================================================================

    private extent(vals: number[]): { min: number; max: number } {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (const v of vals) {
            if (!Number.isFinite(v)) continue;
            if (v < min) min = v;
            if (v > max) max = v;
        }
        if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
        if (min === max) return { min: min - 1, max: max + 1 };
        return { min, max };
    }

    private scaleX(t: number, tMin: number, tMax: number): number {
        const w = this.chartWidth - this.chartPad * 2;
        if (tMax === tMin) return this.chartPad;
        return this.chartPad + ((t - tMin) / (tMax - tMin)) * w;
    }

    private invScaleX(x: number, tMin: number, tMax: number): number {
        const w = this.chartWidth - this.chartPad * 2;
        if (w <= 0) return tMin;
        const u = (x - this.chartPad) / w;
        const clamped = Math.min(1, Math.max(0, u));
        return tMin + clamped * (tMax - tMin);
    }

    private scaleY(v: number, vMin: number, vMax: number): number {
        const h = this.chartHeight - this.chartPad * 2;
        if (vMax === vMin) return this.chartPad + h / 2;
        return this.chartPad + (1 - (v - vMin) / (vMax - vMin)) * h;
    }

    private buildStepPath(
        points: { time: number; value: number }[],
        tMin: number,
        tMax: number,
        vMin: number,
        vMax: number
    ): string {
        if (!points.length) return '';

        let d = '';
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const x = this.scaleX(p.time, tMin, tMax);
            const y = this.scaleY(p.value, vMin, vMax);

            if (i === 0) {
                d += `M ${x} ${y}`;
                continue;
            }

            const prev = points[i - 1];
            const py = this.scaleY(prev.value, vMin, vMax);

            // step: horizontal to x at previous y, then vertical to current y
            d += ` L ${x} ${py} L ${x} ${y}`;
        }
        return d;
    }

    /** Simple LINE path (no steps). Skips non-finite points. */
    private buildLinePath(
        points: { time: number; value: number }[],
        tMin: number,
        tMax: number,
        vMin: number,
        vMax: number
    ): string {
        let d = '';
        let started = false;

        for (const p of points) {
            if (!p) continue;
            if (!Number.isFinite(p.time) || !Number.isFinite(p.value)) continue;

            const x = this.scaleX(p.time, tMin, tMax);
            const y = this.scaleY(p.value, vMin, vMax);

            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

            if (!started) {
                d += `M ${x} ${y}`;
                started = true;
            } else {
                d += ` L ${x} ${y}`;
            }
        }

        return d;
    }

    private linearRegressionLine(
        points: { time: number; value: number }[],
        tMin: number,
        tMax: number
    ): { yAtMin: number; yAtMax: number } | null {
        // y = a + b*x (x=time)
        const n = points.length;
        if (n < 2) return null;

        let sumX = 0,
            sumY = 0,
            sumXY = 0,
            sumXX = 0;
        for (const p of points) {
            const x = p.time;
            const y = p.value;
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumXX += x * x;
        }

        const denom = n * sumXX - sumX * sumX;
        if (!Number.isFinite(denom) || denom === 0) return null;

        const b = (n * sumXY - sumX * sumY) / denom;
        const a = (sumY - b * sumX) / n;

        const yAtMin = a + b * tMin;
        const yAtMax = a + b * tMax;
        if (!Number.isFinite(yAtMin) || !Number.isFinite(yAtMax)) return null;

        return { yAtMin, yAtMax };
    }

    private nearestIndexByTime(data: { time: number }[], t: number): number {
        // binary search closest
        let lo = 0;
        let hi = data.length - 1;

        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (data[mid].time < t) lo = mid + 1;
            else hi = mid;
        }

        const i = lo;
        if (i <= 0) return 0;
        if (i >= data.length) return data.length - 1;

        const a = data[i - 1].time;
        const b = data[i].time;
        return Math.abs(t - a) <= Math.abs(b - t) ? i - 1 : i;
    }

    private clamp(v: number, min: number, max: number): number {
        return Math.min(Math.max(v, min), max);
    }

    /**
     * SVG is rendered responsively (CSS controls real pixel size).
     * We keep chart math in a fixed "virtual" coordinate system (chartWidth/chartHeight),
     * then convert to real pixels via sx/sy for correct tooltip positioning & clamping.
     */
    private getSvgViewport(svg: SVGElement) {
        const rect = svg.getBoundingClientRect();
        const sx = rect.width / this.chartWidth;
        const sy = rect.height / this.chartHeight;
        return { rect, sx, sy };
    }

    private collapseMergedByDayKeepLast(series: TsMergedPoint[]): TsMergedPoint[] {
        if (!Array.isArray(series) || series.length === 0) return [];

        // series is already sorted by time; overwrite => keep last point of that UTC day
        const byDay = new Map<string, TsMergedPoint>();

        for (const p of series) {
            if (!Number.isFinite(p?.time)) continue;
            const day = new Date(p.time).toISOString().slice(0, 10); // YYYY-MM-DD in UTC
            byDay.set(day, p);
        }

        return Array.from(byDay.values()).sort((a, b) => a.time - b.time);
    }

    get p1HeaderName(): string {
        const d: any = this._details as any;

        // try name-ish properties first (adjust if you know exact key)
        const name =
            d?.p1?.name ||
            d?.p1?.fullName ||
            d?.p1?.p02 ||   // common pattern for "name" in minified DTOs
            d?.p1?.p03;

        if (typeof name === 'string' && name.trim().length) return name.trim();

        // fallback that NEVER exposes IDs
        return 'P1';
    }

    get p2HeaderName(): string {
        const d: any = this._details as any;

        const name =
            d?.p2?.name ||
            d?.p2?.fullName ||
            d?.p2?.p02 ||
            d?.p2?.p03;

        if (typeof name === 'string' && name.trim().length) return name.trim();

        return 'P2';
    }

    bookieSeriesHistory(bookieId: number): OddsRow[] {
        // sve odds za tog bookija, IGNORE suspicious/switched/mask, sortirano po SeriesOrdinal desc (najnovije prvo)
        return this.oddsRows
            .filter((x: OddsRow) => x.o01 === bookieId)
            .filter((x: OddsRow) => !x.o07 && !x.o08 && (x.o09 ?? 0) === 0)
            .slice()
            .sort((a: OddsRow, b: OddsRow) => (b.o04 ?? 0) - (a.o04 ?? 0));
    }

    private getCurrentUser(): any | null {
        // AuthService ti očito ima funkciju koja vraća usera
        try {
            const fn: any = (this.auth as any)?.getUser;
            if (typeof fn === 'function') return fn.call(this.auth);
        } catch { /* empty */ }
        return null;
    }

    get entitlements(): any | null {
        return this.getCurrentUser()?.entitlements ?? null;
    }

    openLogin(): void { this.requestLogin.emit(); }
    openRegister(): void { this.requestRegister.emit(); }
    openUpgrade(): void { this.requestUpgrade.emit(); }

    get user() {
        return this.auth.getUser();
    }

    get isLoggedIn(): boolean {
        return this.auth.isLoggedIn();
    }

    get ent() {
        return this.auth.getEntitlements();
    }

    get hasTrial(): boolean {
        return !!this.ent?.hasTrial;
    }

    get isPremium(): boolean {
        return !!this.ent?.isPremium;
    }
}