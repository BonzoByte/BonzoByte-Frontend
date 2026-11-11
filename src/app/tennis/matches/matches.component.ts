/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, Input, OnDestroy, OnInit, Optional, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppComponent } from '../../app.component';
import { Match, PlayerIndex, TournamentIndex } from '../../core/models/tennis.model';
import { PlayerModalComponent } from '../players/player-modal/player-modal.component';
import { TournamentModalComponent } from '../tournaments/tournament-modal/tournament-modal.component';
import {
    DEFAULT_MATCH_STATUS,
    DEFAULT_ODDS_FILTER,
    DEFAULT_VALUE_FILTER,
    MatchFilterModalComponent,
    type MatchStatus
} from "./match-filter-modal/match-filter-modal.component";
import { MatchDetailsModalComponent } from "../matches/match-details-modal/match-details-modal.component";
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { PredictionOverviewPreferenceService } from '../../core/services/prediction-overview-preference.service';
import { QuickFilterPreferenceService, QuickFilterPreferences } from '../../core/services/quick-filter-preference.service';
import { Subject, Subscription, Observable, of, takeUntil } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { evaluateClientDetailsAccess } from '../../core/helpers/match-details-access';
import { compactPlayerGridLabel, playerGridFlagCode, playerGridLabel } from '../../core/helpers/player-grid-label';
import { TimeZoneNoticePreferenceService } from '../../core/services/time-zone-notice-preference.service';
import { HistoricalPlNoticePreferenceService } from '../../core/services/historical-pl-notice-preference.service';
import { RegionalSettingsService } from '../../core/services/regional-settings.service';
import { maskRegionalDateInput, parseRegionalDate, sourceCalendarDate } from '../../core/i18n/regional-format';
import { dayAt, projectArchiveDates, shiftDay, SourceTimePrecision } from '../../core/i18n/archive-day-window';
import { matchDisplayTime } from '../../core/i18n/display-time';
import { demoAdSlotAfter } from '../../core/helpers/demo-ad-layout';
import { DemoAdComponent } from '../../shared/ui/demo-ad/demo-ad.component';
import { AdDisplayPreferenceService } from '../../core/services/ad-display-preference.service';
import { AdRemovalAction, AdRemovalModalComponent } from '../../shared/ui/demo-ad/ad-removal-modal.component';
import { FavouriteMatchesService } from '../../core/services/favourite-matches.service';
import { PredictionButtonComponent } from '../../competition/prediction-button.component';
import { DiscussionCountComponent } from '../../discussions/discussion-count.component';
import { DiscussionsService } from '../../core/services/discussions.service';
import { BrowseMemoryService, BrowseScroll, BrowseVisit, rememberedArchiveDay } from '../../core/services/browse-memory.service';
import { FilterUndoService } from '../../core/services/filter-undo.service';
import { ReadRecoveryService } from '../../core/services/read-recovery.service';
import { ViewRecoveryActionsComponent } from '../../shared/ui/view-recovery-actions/view-recovery-actions.component';
import { MatchPlayersCellComponent, MatchTournamentCellComponent, MatchResultCellComponent } from '../../shared/ui/match-grid-cells/match-grid-cells.component';

type MatchBrowseState = Pick<MatchesComponent, 'currentDateISO' | 'searchTerm' | 'sortField' | 'sortDirection' |
    'dailyDisplayMode' | 'filterMode' | 'isFiltered' | 'filterApplied' | 'filteredPage' | 'activeDateFilter' |
    'activeFromDate' | 'activeToDate' | 'activeSurfaceIds' | 'activeTournamentTypeIds' | 'activeTournamentLevelIds' |
    'activeStrengthStars' | 'activeStatus' | 'activeOdds' | 'valueFilter' | 'activeConfidence' | 'plBasis'>;

interface AppliedMatchFilter {
    startDate: string | null; endDate: string | null; option: string;
    surfaceIds: number[]; tournamentTypeIds: number[]; strengthStars: number[];
    status: MatchStatus | undefined; odds: 'all' | 'with' | 'without';
    valueFilter: 'all' | 'valueOnly'; confidence: 'all' | '60' | '70' | '80'; plBasis?: 'fair' | 'median';
}

interface BootstrapDatesResult {
    dates: string[];
    min: Date;
    max: Date;
}

interface MatchPrediction {
    side: 'p1' | 'p2';
    playerName: string;
    confidence: number;
    label: string;
    tone: 'lean' | 'clear' | 'high' | 'very-high';
}

interface PredictionMarketContext {
    side: 'p1' | 'p2';
    fairProbability: number;
    decimalOdds: number;
    gapPoints: number;
    gapLabel: string;
}

interface ModelPlSummary {
    units: number;
    roiPercent: number;
    eligibleCount: number;
    totalCount: number;
}

interface MatchRowPresentation {
    date: string; dateTitle: string; tournament: string; strength: number; strengthTitle: string;
    surface: string; surfaceClass: string; surfaceLabel: string; round: string; roundTitle: string;
    player1: string; player2: string; player1Compact: string; player2Compact: string;
    player1Flag: string; player2Flag: string; result: string; sets: string;
    qualityHold: boolean; qualityTitle: string; oddsTitle: string;
    odds: { verified:boolean; player1:{integer:string;fraction:string}|null; player2:{integer:string;fraction:string}|null } | null;
    prediction: MatchPrediction | null; predictionClass: string; predictionTitle: string; outcome: string;
    market: PredictionMarketContext | null; marketDecimal: string; marketLabel: string | null;
    pl: string; plClass: string; plTitle: string; historicalPl: boolean;
}

interface TournamentMatchGroup {
    key: string;
    tournamentEventTPId: number;
    label: string;
    countryISO2: string;
    countryFull: string;
    tournamentType: string;
    surface: string;
    strengthStars: number;
    matches: Match[];
    modelPl: ModelPlSummary;
}

type MatchFilterMode = 'auto' | 'custom';

@Component({
    selector: 'app-matches',
    standalone: true,
    templateUrl: './matches.component.html',
    styleUrls: ['./matches.component.scss'],
    imports: [
        MatchPlayersCellComponent, MatchTournamentCellComponent, MatchResultCellComponent,
        ViewRecoveryActionsComponent,
        AdRemovalModalComponent,
        CommonModule,
        TranslateModule,
        FormsModule,
        NgbDatepickerModule,
        MatchFilterModalComponent,
        MatchDetailsModalComponent,
        PlayerModalComponent,
        TournamentModalComponent,
        DemoAdComponent,
        PredictionButtonComponent,
        DiscussionCountComponent
    ],
    encapsulation: ViewEncapsulation.None
})

export class MatchesComponent implements OnInit, OnDestroy {
    Math = Math;
    matches: Match[] = [];
    filteredMatches: Match[] = [];
    private groupedPresentationCache?: {
        rows: Match[]; count: number; language: string; basis: string;
        sortField: string; sortDirection: string; groups: TournamentMatchGroup[];
    };
    private columnPresentationCache?: {
        rows: Match[]; count: number; language: string; matchup: number; result: number;
    };
    private readonly decodedTextCache = new Map<string, string>();
    private textDecoder?: HTMLTextAreaElement;
    private readonly rowPresentationCache = new WeakMap<Match, {
        context:string; keys:string[]; snapshot:Record<string,unknown>; view:MatchRowPresentation;
    }>();
    private static readonly predictionFields = ['qualityStatus','predictionEligible','modelProbabilityPlayer1',
        'modelProbabilityPlayer2','probabilityText','player1Name','player2Name'] as const;
    private readonly predictionPresentationCache = new WeakMap<Match, {
        language:string; inputs:unknown[]; value:MatchPrediction|null;
    }>();
    isFiltered = true;
    filteredPage = 1;
    currentDate: Date = new Date(1990, 0, 1);
    currentDateISO = ''; // Always YYYY-MM-DD; this is the source of truth.
    currentDateDMY = ''; // Localized input; currentDateISO identifies the selected user's calendar day.
    isNextDisabled = false;
    isPrevDisabled = false;
    loading = false;
    selectedDate: NgbDateStruct | null = null;
    showDatepicker = false;
    showFilterModal = false;
    selectedPlayer: number | null = null;
    selectedTournament: number | null = null;
    infoPlayer: PlayerIndex | null = null;
    infoTournament: TournamentIndex | null = null;
    infoTournamentStrengthScale: { min: number | null; median: number | null; max: number | null } | null = null;
    private infoRequest?: Subscription;
    sortField: 'tournament' | 'date' | 'strength' = 'tournament';
    sortDirection: 'asc' | 'desc' = 'asc';
    filterApplied = true;
    filterMode: MatchFilterMode = 'auto';
    activeDateFilter = 'all'; // 'year', 'month', 'week', 'custom'
    activeFromDate: string | null = null;
    activeToDate: string | null = null;
    activeSurfaceIds: number[] = [1, 2, 3, 4, 5];
    activeTournamentTypeIds: number[] = [2, 4];
    activeTournamentLevelIds: number[] = [1, 2, 3, 4];
    activeStrengthStars: number[] = [0, 1, 2, 3, 4, 5];
    activeStatus: MatchStatus = DEFAULT_MATCH_STATUS;
    activeOdds: 'all' | 'with' | 'without' = DEFAULT_ODDS_FILTER;
    tournamentHeaderLevel = '';
    filteredAvailableDates: string[] = [];
    showDateWarning = false;
    currentDateString = '';
    noMatchesForFilter = false;
    showOutOfRangeModal = false;
    valueFilter: 'all' | 'valueOnly' = DEFAULT_VALUE_FILTER;
    plBasis: 'fair' | 'median' = 'fair';
    get plLabel(): string { return this.regional.text(this.plBasis === 'fair' ? 'matches.fairPl' : 'matches.medianPl'); }
    activeConfidence: 'all' | '60' | '70' | '80' = 'all';
    showScrollUp = false;
    showScrollDown = false;

    viewMode: 'daily' | 'player' | 'tournament' | 'favourites' = 'daily';
    favouriteStatus: 'all' | 'upcoming' | 'finished' = 'all';
    readonly favouriteStatuses = ['all', 'upcoming', 'finished'] as const;
    unavailableFavouriteIds: number[] = [];
    favouriteRowsError = false;
    private favouriteRowsRequest?: Subscription;
    private bootstrapRequest?: Subscription;
    private scopedRequest?: Subscription;
    dailyDisplayMode: 'all' | 'tournament' = 'tournament';
    readonly predictionOverviewVisible$: Observable<boolean>;
    quickFilterPreferences: QuickFilterPreferences;

    // Demo content stays local; visibility is shared with the account settings modal.
    get demoAdsAvailable(): boolean { return this.adDisplayPreference.demoAvailable; }
    get adNoticeCopyKey(): string {
        const user = this.auth.getUser();
        return !user ? 'demoAds.signInHint'
            : this.adDisplayPreference.canHide(user) ? 'demoAds.adFreeHint' : 'demoAds.memberHint';
    }
    showAdRemovalModal = false;
    get showDemoAds(): boolean {
        return this.demoAdsAvailable && !this.loading && !this.adDisplayPreference.isHidden(this.auth.getUser());
    }
    requestHideAds(): void {
        if (!this.adDisplayPreference.setHidden(this.auth.getUser(), true)) this.showAdRemovalModal = true;
        this.refreshScrollNavigation();
    }
    demoAdSlotAfter(index: number, total: number, mode: 'matches' | 'groups'): number | null {
        return this.showDemoAds ? demoAdSlotAfter(index, total, mode) : null;
    }
    onAdRemovalAction(action: AdRemovalAction): void {
        this.showAdRemovalModal = false;
        // Let the old shell release its scroll/focus lock before opening the next one.
        setTimeout(() => window.dispatchEvent(new CustomEvent(action)), 0);
    }
    matchGridColumnCount(grouped: boolean): number {
        // Eight fixed columns (including discussions), tournament OR round, optional tour.
        return 9 + (this.showTypeColumn && !grouped ? 1 : 0) + (this.showFavouriteColumn ? 2 : 0);
    }

    playerMatchesTPId: number | null = null;
    playerHeaderName = '';
    playerHeaderCountryISO2 = '';
    playerHeaderCountryISO3 = '';
    playerHeaderCountryFull = '';
    playerHeaderType = '';

    tournamentMatchesTPId: number | null = null;
    tournamentHeaderName = '';
    tournamentHeaderCountryISO2 = '';
    tournamentHeaderCountryISO3 = '';
    tournamentHeaderCountryFull = '';
    tournamentHeaderSurface = '';
    tournamentHeaderType = '';
    tournamentHeaderDateTime = '';
    tournamentHeaderStrength = '';
    tournamentHeaderStrengthValue: number | null = null;

    // search
    searchTerm = '';
    private search$ = new Subject<string>();

    private pendingAfterDetailsClose: 'login' | 'register' | 'upgrade' | null = null;
    private scrollNavigationRefreshId: number | null = null;
    private browseKey: string | null = null;
    private pendingBrowseScroll: BrowseScroll | null = null;
    private rememberedDay?: string;
    private browseLoaded = false;
    private cancelBrowseRestore?: () => void;
    private scrollToTopFrame: number | null = null;

    private browseState(): MatchBrowseState {
        return {
            currentDateISO: this.currentDateISO, searchTerm: this.searchTerm,
            sortField: this.sortField, sortDirection: this.sortDirection, dailyDisplayMode: this.dailyDisplayMode,
            filterMode: this.filterMode, isFiltered: this.isFiltered, filterApplied: this.filterApplied,
            filteredPage: this.filteredPage, activeDateFilter: this.activeDateFilter,
            activeFromDate: this.activeFromDate, activeToDate: this.activeToDate,
            activeSurfaceIds: this.activeSurfaceIds, activeTournamentTypeIds: this.activeTournamentTypeIds,
            activeTournamentLevelIds: this.activeTournamentLevelIds, activeStrengthStars: this.activeStrengthStars,
            activeStatus: this.activeStatus, activeOdds: this.activeOdds, valueFilter: this.valueFilter,
            activeConfidence: this.activeConfidence, plBasis: this.plBasis
        };
    }

    private rememberBrowse(): void {
        if (!this.browseKey || !this.browseLoaded) return;
        this.browseMemory.remember(this.browseKey, this.browseState(), this.hostElement.nativeElement);
    }

    private beforeFilterChange(): BrowseVisit<MatchBrowseState> | null {
        this.cancelBrowseRestore?.();
        this.pendingBrowseScroll = null;
        return this.filterUndo && this.viewMode !== 'favourites' && !this.loading && !this.dailyLoadError
            ? this.browseMemory.capture(this.browseState(), this.hostElement.nativeElement) : null;
    }

    private offerFilterUndo(previous: BrowseVisit<MatchBrowseState> | null): void {
        const scope = this.browseKey;
        this.filterUndo?.offer(this, previous, this.browseState(), visit => {
            if (scope !== this.browseKey || this.viewMode === 'favourites') return false;
            this.cancelScopeRequests();
            Object.assign(this, visit.state);
            this.showFilterModal = false;
            this.showDatepicker = false;
            this.showDateWarning = false;
            this.filteredAvailableDates = this.activeFromDate && this.activeToDate
                ? this.availableDates.filter(day => day >= this.activeFromDate! && day <= this.activeToDate!)
                : [...this.availableDates];
            this.pendingBrowseScroll = visit.scroll;
            // Keep the debounced search stream in sync with the restored, committed search.
            this.search$.next(this.searchTerm);
            if (this.viewMode === 'daily') {
                const day = this.isoToDateLocal(visit.state.currentDateISO);
                if (!day) return false;
                this.loadMatchesForDate(day);
            } else {
                this.matches = [...this.daySourceMatches];
                this.sortMatches();
                this.applyActiveFiltersToCurrentDay();
                this.loading = false;
                this.restoreBrowsePosition();
            }
            return true;
        });
    }

    private recallBrowse(key: string | null): void {
        this.browseKey = key;
        this.browseLoaded = false;
        this.pendingBrowseScroll = null;
        this.rememberedDay = undefined;
        const visit = key ? this.browseMemory.recall<MatchBrowseState>(key) : null;
        if (!visit) return;
        Object.assign(this, visit.state);
        this.pendingBrowseScroll = visit.scroll;
        this.rememberedDay = visit.state.currentDateISO;
    }

    private restoreBrowsePosition(): boolean {
        if (!this.pendingBrowseScroll) return false;
        this.cancelBrowseRestore?.();
        this.cancelBrowseRestore = this.browseMemory.restore(this.hostElement.nativeElement,
            this.pendingBrowseScroll, () => this.refreshScrollNavigation());
        this.pendingBrowseScroll = null;
        return true;
    }

    @Input() minDate!: Date;
    @Input() maxDate!: Date;
    availableDates: string[] = [];
    private sourceAvailableDates: string[] = [];
    private latestSourceMatches: Match[] | null = null;
    private dailyRequest?: Subscription;
    private dailyLoadingTimer?: number;
    unresolvedTimeCount = 0;
    missingArchiveDays: string[] = [];
    dailyLoadError = false;
    scopedLoadError = false;
    private releaseReadRecovery?: () => void;
    get missingArchiveDatesText(): string { return this.missingArchiveDays.map(d => this.regional.date(d)).join(', '); }

    private projectAvailableDays(): void {
        this.availableDates = projectArchiveDates(this.sourceAvailableDates, this.regional.timeZone());
        if (this.latestSourceMatches?.length) {
            const actualLastDay = this.latestSourceMatches.map(row => {
                const time = matchDisplayTime(row.dateTime, row.sourceTimePrecision);
                return time.instant === null ? sourceCalendarDate(row.dateTime) : dayAt(time.instant, this.regional.timeZone());
            }).filter((day): day is string => !!day).sort().pop();
            if (actualLastDay) this.availableDates = this.availableDates.filter(day => day <= actualLastDay);
        }
        if (!this.availableDates.length) return;
        this.minDate = this.isoToDateLocal(this.availableDates[0])!;
        this.maxDate = this.isoToDateLocal(this.availableDates[this.availableDates.length - 1])!;
        this.filteredAvailableDates = [];
    }
    selectedMatch: Match | null = null;
    private escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            this.closeDateWarningModal?.();
            if (this.selectedMatch) this.closeMatchModal();
        }
    };
    private deferScrollToTop(): void {
        // Two animation frames allow Angular to replace the grid before scrolling it.
        if (this.scrollToTopFrame !== null) cancelAnimationFrame(this.scrollToTopFrame);
        this.scrollToTopFrame = requestAnimationFrame(() => {
            this.scrollToTopFrame = requestAnimationFrame(() => {
                this.scrollToTopFrame = null;
                this.scrollToTop();
                this.refreshScrollNavigation();
            });
        });
    }

    private finishDailyLoading(startedAt: number, afterUiReady?: () => void): void {
        // Cached archives can resolve before the browser paints a single loading frame.
        const minimumVisibleMs = 250;
        const remainingMs = Math.max(0, minimumVisibleMs - (performance.now() - startedAt));

        this.dailyLoadingTimer = window.setTimeout(() => {
            this.loading = false;
            document.body.classList.remove('bb-noscroll');
            if (!this.browseLoaded || !this.restoreBrowsePosition()) this.deferScrollToTop();
            afterUiReady?.();
        }, remainingMs);
    }

    private authSub?: Subscription;

    private destroy$ = new Subject<void>();

    onDetailsRequestLogin(): void {
        console.log('[PARENT] requestLogin');
        this.closeDetailsModal();
        queueMicrotask(() => this.openLoginModal());
    }

    onDetailsRequestRegister(): void {
        console.log('[PARENT] requestRegister');
        this.closeDetailsModal();
        queueMicrotask(() => this.openRegisterModal());
    }

    onDetailsRequestUpgrade(): void {
        console.log('[PARENT] requestUpgrade');
        this.pendingAfterDetailsClose = 'upgrade';
        this.closeDetailsModal(); // Closing through the public API must emit closed.
    }

    openLoginModal(): void {
    // The header listens for openLogin.
        window.dispatchEvent(new CustomEvent('openLogin'));
    }

    openRegisterModal(): void {
    // Registration is reached through the header's switchToRegister handler.
    // Reuse the existing event contract instead of introducing a second path.
        window.dispatchEvent(new CustomEvent('switchToRegister'));
    }

    openBillingModal(): void {
        console.log('[BILLING] openBillingModal');
        window.dispatchEvent(new CustomEvent('openBilling'));
    }

    private closeDetailsModal(): void {
    // Let a live modal close through its public API so it emits closed.
        if (this.detailsModal) {
            this.detailsModal.close();
            return;
        }

    // Fall back when the view reference is not ready.
        this.isDetailsOpen = false;
        this.selectedMatchTPId = null;
        this.selectedMatch = null;
    }

    @ViewChild('dateInput') dateInputRef!: ElementRef<HTMLInputElement>
    @ViewChild('detailsModal') detailsModal?: MatchDetailsModalComponent;
    @HostListener('document:click', ['$event'])

    onClickOutside(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const isDatePicker = target.closest('.datepicker-wrapper');
        const isIcon = target.closest('.datepicker-toggle');

        if (!isDatePicker && !isIcon) {
            this.showDatepicker = false;
        }
    }
    constructor(private staticArchives: StaticArchivesService,
        public auth: AuthService,
        private route: ActivatedRoute,
        private router: Router,
        private translate: TranslateService,
        private appComponent: AppComponent,
        private hostElement: ElementRef<HTMLElement>,
        private predictionOverviewPreference: PredictionOverviewPreferenceService,
        private quickFilterPreference: QuickFilterPreferenceService,
        public regional: RegionalSettingsService,
        public timeZoneNoticePreference: TimeZoneNoticePreferenceService,
        public adDisplayPreference: AdDisplayPreferenceService,
        @Optional() @Inject(FavouriteMatchesService) public favourites: FavouriteMatchesService | null = null,
        @Optional() @Inject(DiscussionsService) public discussions: DiscussionsService | null = null,
        public historicalPlNoticePreference: HistoricalPlNoticePreferenceService = new HistoricalPlNoticePreferenceService(),
        private browseMemory: BrowseMemoryService = new BrowseMemoryService(),
        @Optional() @Inject(FilterUndoService) private filterUndo: FilterUndoService | null = null,
        @Optional() @Inject(ReadRecoveryService) private recovery: ReadRecoveryService | null = null) {
        this.predictionOverviewVisible$ = predictionOverviewPreference.visible$;
        this.quickFilterPreferences = quickFilterPreference.current;
    }

    get showFavouriteColumn(): boolean { return this.favourites?.signedIn() === true; }

    favouriteDisabled(id: number): boolean {
        return !this.showFavouriteColumn || this.favourites!.loading() || this.favourites!.error() || this.favourites!.pending().has(id);
    }

    toggleFavourite(id: number): void {
        if (!this.favouriteDisabled(id)) this.favourites!.toggle(id);
    }

    setFavouriteStatus(status: 'all' | 'upcoming' | 'finished'): void {
        this.filterUndo?.cancel(this);
        this.favouriteStatus = status;
        this.applyActiveFiltersToCurrentDay();
    }

    retryFavourites(): void {
        if (this.viewMode === 'favourites') this.loadFavouriteRows();
        else this.favourites?.refresh();
    }

    /** Reload only the current failed read; never navigates or replays a user action. */
    retryCurrentRead(): void {
        if (this.loading) return;
        if (this.viewMode === 'player' && this.scopedLoadError && this.playerMatchesTPId)
            this.loadPlayerMatches(this.playerMatchesTPId);
        else if (this.viewMode === 'tournament' && this.scopedLoadError && this.tournamentMatchesTPId)
            this.loadTournamentMatches(this.tournamentMatchesTPId);
        else if (this.viewMode === 'daily' && this.dailyLoadError) {
            if (!this.sourceAvailableDates.length) this.bootstrapDailyMatches();
            else this.loadMatchesForDate(this.currentDate);
        }
    }

    clearEmptyViewFilters(): void {
        if (this.viewMode === 'favourites') {
            this.favouriteStatus = 'all'; this.searchTerm = ''; this.search$.next('');
            this.applyActiveFiltersToCurrentDay(); this.deferScrollToTop();
            return;
        }
        const previous = this.beforeFilterChange();
        this.resetScopedMatchFilters();
        this.search$.next('');
        this.filteredAvailableDates = [...this.availableDates];
        if (this.viewMode === 'daily' && !this.daySourceMatches.length) this.loadMatchesForDate(this.currentDate);
        else this.clearFilter();
        this.offerFilterUndo(previous);
    }

    private clearFavouriteRows(): void {
        this.favouriteRowsRequest?.unsubscribe();
        this.daySourceMatches = [];
        this.matches = [];
        this.filteredMatches = [];
        this.unavailableFavouriteIds = [];
        this.favouriteRowsError = false;
        this.loading = false;
    }

    private loadFavouriteRows(): void {
        if (this.viewMode !== 'favourites') return;
        this.favouriteRowsRequest?.unsubscribe();
        const saved = this.favourites;
        if (!saved?.signedIn()) {
            this.clearFavouriteRows();
            return;
        }
        // Remove confirmed unsaves immediately, including unavailable records. Never
        // synthesize Match objects or remove a save just because its date is in the past.
        this.matches = this.matches.filter(row => saved.ids().has(row.matchTPId));
        this.daySourceMatches = [...this.matches];
        this.unavailableFavouriteIds = this.unavailableFavouriteIds.filter(id => saved.ids().has(id));
        this.applyActiveFiltersToCurrentDay();
        this.favouriteRowsError = false;
        // loadRows refreshes IDs itself, including an initially empty/not-yet-loaded
        // index. It does not emit change$, so this cannot form a refresh loop.
        const account = this.auth.getUser()?._id;
        this.loading = true;
        this.favouriteRowsRequest = saved.loadRows().pipe(takeUntil(this.destroy$)).subscribe({
            next: result => {
                if (this.viewMode !== 'favourites' || !saved.signedIn() || this.auth.getUser()?._id !== account) return;
                this.matches = result.matches.filter(row => saved.ids().has(row.matchTPId));
                this.daySourceMatches = [...this.matches];
                this.unavailableFavouriteIds = result.unavailableIds.filter(id => saved.ids().has(id));
                this.sortMatches();
                this.applyActiveFiltersToCurrentDay();
                this.loading = false;
                this.scheduleScrollNavigationRefresh();
            },
            error: () => {
                if (this.viewMode !== 'favourites' || this.auth.getUser()?._id !== account) return;
                this.clearFavouriteRows();
                this.favouriteRowsError = true;
            }
        });
    }

    dismissPredictionOverview(): void {
        this.predictionOverviewPreference.dismissForDays();
    }

    // Map special and blank source codes to values supported by flag-icons.
    flagCode(iso2?: string | null): string {
        return playerGridFlagCode(iso2);
    }

    /** Formats yyyy-MM-dd in the local time zone without a UTC shift. */
    private ymdLocal(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /** Converts a local date to the backend YYYYMMDD format. */
    private ymdCompact(d: Date): string {
        return this.ymdLocal(d).replace(/-/g, '');
    }

    public ymd(d: Date): string {
        return this.ymdLocal(d);
    }

    private daySourceMatches: Match[] = [];

    private static readonly SURFACE_MAP: Record<string, number> = {
        indoors: 1, indoor: 1, carpet: 1, clay: 2, grass: 3, hard: 4, unknown: 5
    };

    private static readonly TYPE_MAP: Record<string, number> = {
        ATP: 2, WTA: 4
    };

    private static readonly LEVEL_MAP: Record<string, number> = {
        // High prize / main
        '> 50,000$': 1,
        '>50K': 1,
        '> 50K': 1,
        '50K+': 1,
        '>=50K': 1,
        'high': 1,

        // Cup
        'Cup': 2,
        'CUP': 2,

        // Qualifications
        'Qualifications': 3,
        'Qualification': 3,
        'Qualifying': 3,
        'QUALIFICATIONS': 3,
        'QUALIFYING': 3,
        'Q': 3,

        // Low prize
        '< 50,000$': 4,
        '<50K': 4,
        '< 50K': 4,
        '50K-': 4,
        '<=50K': 4,
        'low': 4,
    };

    starsArray(): number[] { return [1, 2, 3, 4, 5]; }

    readonly stars = [1, 2, 3, 4, 5];

    starClass(starIndex: number, value: number): 'full' | 'half' | 'empty' {
        if (value >= starIndex) return 'full';
        if (value >= starIndex - 0.5) return 'half';
        return 'empty';
    }

    private static readonly TS_MIN = 9.023;
    private static readonly TS_MAX = 35.755;

    // Minimum edge threshold; 0.00 accepts every positive edge.
    private readonly MIN_EDGE = 0.02; // 2% points

    getTournamentStrengthTS(match: Match): number | null {
        const v = match.tournamentStrengthMeanTS;
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    ngOnInit(): void {
        this.releaseReadRecovery = this.recovery?.register(this, () => this.retryCurrentRead());
        this.regional.changes.pipe(takeUntil(this.destroy$)).subscribe(() => this.syncDateStringsFromCurrentDate());
        this.regional.timeZoneChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
            if (this.viewMode === 'daily' && this.sourceAvailableDates.length) {
                this.projectAvailableDays();
                this.loadMatchesForDate(this.currentDate);
            } else if (this.viewMode !== 'daily') {
                this.applyActiveFiltersToCurrentDay();
            }
        });
        console.log('🔍 MatchesComponent ngOnInit');
        console.log('🔍 Current URL playerTPId param:', this.route.snapshot.paramMap.get('playerTPId'));
        console.log('🧭 route snapshot params keys:', this.route.snapshot.paramMap.keys);
        console.log('🧭 param playerTPId:', this.route.snapshot.paramMap.get('playerTPId'));
        console.log('🧭 param tournamentEventTPId:', this.route.snapshot.paramMap.get('tournamentEventTPId'));
        console.log('🧭 param tournamentsEventTPId:', this.route.snapshot.paramMap.get('tournamentsEventTPId'));
        console.log('🧭 all keys:', this.route.snapshot.paramMap.keys);
        document.addEventListener('keydown', this.escHandler);

        this.quickFilterPreference.preferences$
            .pipe(takeUntil(this.destroy$))
            .subscribe(preferences => {
                this.quickFilterPreferences = preferences;
            });

        this.search$
            .pipe(
                debounceTime(0),
                distinctUntilChanged(),
                takeUntil(this.destroy$)
            )
            .subscribe(() => this.applyActiveFiltersToCurrentDay());


        this.favourites?.change$.pipe(takeUntil(this.destroy$)).subscribe(() => this.loadFavouriteRows());
        this.favourites?.start();
        // Watch identity, not just authChanged$: profile/entitlement updates must
        // not reload rows, and logout/account switches must clear private data now.
        if (this.favourites) this.auth.user$?.pipe(
            map(user => user?._id ?? null), distinctUntilChanged(), takeUntil(this.destroy$)
        ).subscribe(() => {
            if (this.viewMode !== 'favourites') return;
            this.clearFavouriteRows();
            this.closeDetailsModal();
            this.closeInfoModal();
            this.loadFavouriteRows();
        });
        this.refreshReusedScopedRoute(true);

        this.router.events.pipe(takeUntil(this.destroy$)).subscribe(event => {
            if (event instanceof NavigationEnd) this.refreshReusedScopedRoute();
        });
        this.auth.authChanged$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                // The identity subscription and service changes own personal rows.
                if (this.viewMode === 'favourites') return;
                if (this.viewMode === 'player' && this.playerMatchesTPId) {
                    this.loadPlayerMatches(this.playerMatchesTPId);
                    return;
                }
                if (this.viewMode === 'tournament' && this.tournamentMatchesTPId) {
                    this.loadTournamentMatches(this.tournamentMatchesTPId);
                    return;
                }
                this.loadMatchesForDate(this.currentDate);
            });
    }

    private bootstrapDailyMatches(): void {
        this.recovery?.begin(this);
        this.dailyLoadError = false;
        this.bootstrapRequest?.unsubscribe();
        this.loading = true;
        this.bootstrapRequest = this.loadDatesAndBootstrap().pipe(
            switchMap(({ dates }) => {
                this.sourceAvailableDates = dates;
                this.projectAvailableDays();
                const latestSourceDay = dates[dates.length - 1];
                if (this.rememberedDay) return of(rememberedArchiveDay(this.rememberedDay, this.availableDates, latestSourceDay));
                return this.staticArchives.getDaily(latestSourceDay).pipe(
                    map(rows => {
                        this.latestSourceMatches = rows;
                        this.projectAvailableDays();
                        const days = rows.map(row => {
                            const time = matchDisplayTime(row.dateTime, row.sourceTimePrecision);
                            return time.instant === null ? sourceCalendarDate(row.dateTime) :
                                dayAt(time.instant, this.regional.timeZone());
                        }).filter((day): day is string => !!day).sort();
                        return days[days.length - 1] ?? latestSourceDay;
                    }),
                    catchError(() => of(latestSourceDay))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: latestDay => {
                if (this.filterMode === 'custom' && this.activeFromDate && this.activeToDate)
                    this.filteredAvailableDates = this.availableDates.filter(day => day >= this.activeFromDate! && day <= this.activeToDate!);
                const targetDay = rememberedArchiveDay(this.rememberedDay, this.availableDates, latestDay);
                this.rememberedDay = undefined;
                this.loadMatchesForDate(this.isoToDateLocal(targetDay)!);
            },
            error: err => {
                console.error('Failed to bootstrap archive dates:', err);
                this.dailyLoadError = true;
                this.recovery?.unavailable(this);
                this.loading = false;
                document.body.classList.remove('bb-noscroll');
            }
        });
    }

    private cancelScopeRequests(): void {
        this.recovery?.begin(this);
        this.dailyLoadError = false;
        this.scopedLoadError = false;
        this.missingArchiveDays = [];
        this.filterUndo?.cancel(this);
        this.cancelBrowseRestore?.();
        if (this.scrollToTopFrame !== null) cancelAnimationFrame(this.scrollToTopFrame);
        this.scrollToTopFrame = null;
        this.bootstrapRequest?.unsubscribe();
        this.scopedRequest?.unsubscribe();
        this.dailyRequest?.unsubscribe();
        this.favouriteRowsRequest?.unsubscribe();
        window.clearTimeout(this.dailyLoadingTimer);
        document.body.classList.remove('bb-noscroll');
    }


    ngOnDestroy(): void {
        this.releaseReadRecovery?.();
        this.rememberBrowse();
        this.infoRequest?.unsubscribe();
        this.cancelScopeRequests();
        document.removeEventListener('keydown', this.escHandler);
        if (this.scrollNavigationRefreshId !== null) {
            cancelAnimationFrame(this.scrollNavigationRefreshId);
        }
        this.search$.complete();
        this.authSub?.unsubscribe?.();
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ===========================================================================================
    // Bootstrap dates: primary = available-dates; fallback = daily index.json
    // ===========================================================================================
    private loadDatesAndBootstrap(): Observable<BootstrapDatesResult> {
        return this.staticArchives.getAvailableDates().pipe(
            map((dates: string[]) => {
                if (!Array.isArray(dates) || dates.length === 0) {
                    throw new Error('available-dates returned empty list');
                }

                const min = this.isoToDateLocal(dates[0]) ?? new Date(NaN);
                const max = this.isoToDateLocal(dates[dates.length - 1]) ?? new Date(NaN);

                if (isNaN(min.getTime()) || isNaN(max.getTime())) {
                    throw new Error('available-dates returned invalid date strings');
                }

                return { dates, min, max };
            }),
            catchError((err) => {
                console.warn('⚠️ Failed to load available-dates, falling back to daily index.json', err);

                return this.staticArchives.getDailyIndex().pipe(
                    map((idx: any) => {
                        const minIso = idx?.minDate;
                        const maxIso = idx?.maxDate ?? this.toIsoToday();

                        const min = this.isoToDateLocal(minIso) ?? new Date(NaN);
                        const max = this.isoToDateLocal(maxIso) ?? new Date(NaN);

                        if (isNaN(min.getTime()) || isNaN(max.getTime())) {
                            throw new Error('daily index.json returned invalid min/max date');
                        }

                        // The index provides a range, not proof of individual archive availability.
                        const dates: string[] = [];
                        for (let day = minIso; day <= maxIso; day = shiftDay(day)) dates.push(day);

                        return { dates, min, max };
                    })
                );
            })
        );
    }

    formatDate(date: Date): string {
        return this.ymdCompact(date);
    }

    scrollToTop(): void {
        const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth';
        const root = this.hostElement.nativeElement;
        const gridScrollers = root.querySelectorAll<HTMLElement>(
            '.match-table-scroll:not(.match-table-scroll--grouped), .tournament-groups-scroll');

        // The current layout scrolls inside the grid, not in the browser window.
        gridScrollers.forEach(scroller => scroller.scrollTo({ top: 0, behavior }));

        // Retain a window fallback for narrower/legacy layouts where the page itself scrolls.
        if (gridScrollers.length === 0 || window.scrollY > 0) {
            window.scrollTo({ top: 0, behavior });
        }
    }

    onResultsScroll(event: Event): void {
        this.refreshScrollNavigation(event.currentTarget as HTMLElement);
    }

    scrollResultsTo(edge: 'top' | 'bottom'): void {
        const scroller = this.getResultsScroller();
        if (!scroller) return;

        const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth';
        scroller.scrollTo({
            top: edge === 'top' ? 0 : scroller.scrollHeight,
            behavior
        });
    }

    @HostListener('window:resize')
    onViewportResize(): void {
        this.scheduleScrollNavigationRefresh();
    }

    private scheduleScrollNavigationRefresh(): void {
        if (this.scrollNavigationRefreshId !== null) {
            cancelAnimationFrame(this.scrollNavigationRefreshId);
        }

        this.scrollNavigationRefreshId = requestAnimationFrame(() => {
            this.scrollNavigationRefreshId = null;
            this.refreshScrollNavigation();
        });
    }

    private getResultsScroller(): HTMLElement | null {
        const root = this.hostElement.nativeElement;
        return root.querySelector<HTMLElement>(
            '.tournament-groups-scroll, .match-table-scroll:not(.match-table-scroll--grouped)');
    }

    private refreshScrollNavigation(scroller = this.getResultsScroller()): void {
        if (!scroller || this.loading) {
            this.showScrollUp = false;
            this.showScrollDown = false;
            return;
        }

        const threshold = 2;
        const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        const hasOverflow = maxScrollTop > threshold;

        this.showScrollUp = hasOverflow && scroller.scrollTop > threshold;
        this.showScrollDown = hasOverflow && scroller.scrollTop < maxScrollTop - threshold;
    }

    loadMatchesForDate(date: Date): void {
        this.filterUndo?.cancel(this);
        if (this.viewMode === 'favourites') return;
        this.recovery?.begin(this);
        if (this.currentDateISO && this.toISOFromDateLocal(date) !== this.currentDateISO) {
            this.pendingBrowseScroll = null;
            this.cancelBrowseRestore?.();
        }
        this.dailyRequest?.unsubscribe();
        window.clearTimeout(this.dailyLoadingTimer);
        this.dailyLoadError = false;
        this.missingArchiveDays = [];
        this.unresolvedTimeCount = 0;
        const loadingStartedAt = performance.now();
        this.loading = true;
        document.body.classList.add('bb-noscroll');

        const correctedDate = this.correctDateIfOutOfBounds(date);
        const correctedChanged = correctedDate.getTime() !== date.getTime();

        this.currentDate = correctedDate;
        this.syncDateStringsFromCurrentDate();
        this.currentDateString = this.ymdLocal(correctedDate);
        this.applyAutomaticFilterPreset(correctedDate);

        if (correctedChanged) this.showDateOutOfRangeModal();

        this.dailyRequest = this.staticArchives.getDailyForZone(this.currentDateISO,
            this.regional.timeZone(), this.sourceAvailableDates).pipe(takeUntil(this.destroy$)).subscribe({
            next: (data) => {
                this.unresolvedTimeCount = data.unresolvedCount;
                this.missingArchiveDays = data.missingDays;
                const rows = data.matches.map((m, i) => ({ ...(m as any), __idx: i }));

                this.daySourceMatches = rows;

                // The archive response, not the previous day's rows, determines
                // whether an automatic pre-match edge filter is meaningful.
                this.applyAutomaticFilterPreset(correctedDate, rows);

                console.log('[LOAD] isFiltered=', this.isFiltered, 'activeStatus=', this.activeStatus);

                console.log('📦 daySourceMatches loaded:', {
                    date: this.currentDateISO,
                    rows: this.daySourceMatches.length,
                    sample: this.daySourceMatches[0],
                });

                if (this.isFiltered) {
                    const filtered = this.filterMatchesByActiveFilters(this.daySourceMatches);

                    let nullSurface = 0, nullType = 0, nullLevel = 0;
                    for (const m of this.daySourceMatches as any[]) {
                        if (this.normalizeSurfaceId(m) == null) nullSurface++;
                        if (this.normalizeTypeId(m) == null) nullType++;
                        if (this.normalizeLevelId(m) == null) nullLevel++;
                    }

                    console.log('[LOAD] isFiltered=', this.isFiltered, 'activeStatus=', this.activeStatus);
                    console.log('🧪 filter result:', {
                        filtered: filtered.length,
                        nullSurface,
                        nullType,
                        nullLevel,
                    });
                }

                this.matches = this.isFiltered
                    ? this.filterMatchesByActiveFilters(this.daySourceMatches)
                    : this.daySourceMatches;

                this.applyActiveFiltersToCurrentDay();
                this.sortMatches();
                this.checkAdjacentDaysAvailability(correctedDate);

                this.noMatchesForFilter = this.isFiltered && this.matches.length === 0;
                this.browseLoaded = true;

                this.finishDailyLoading(loadingStartedAt);
            },
            error: (err) => {
                console.error('❌ Error loading daily archive:', err);
                this.dailyLoadError = true;
                this.browseLoaded = false;
                this.recovery?.unavailable(this);
                this.daySourceMatches = [];
                this.matches = [];
                this.filteredMatches = [];
                this.checkAdjacentDaysAvailability(this.currentDate);
                this.finishDailyLoading(loadingStartedAt);
            }
        });
    }

    loadPlayerMatches(playerTPId: number): void {
        this.filterUndo?.cancel(this);
        if (this.viewMode === 'favourites') return;
        this.recovery?.begin(this);
        this.scopedLoadError = false;
        this.scopedRequest?.unsubscribe();
        console.log('📦 loadPlayerMatches called', { playerTPId });
        this.loading = true;
        document.body.classList.add('bb-noscroll');

        this.scopedRequest = this.staticArchives.getPlayerMatches(playerTPId).pipe(takeUntil(this.destroy$)).subscribe({
            next: (data) => {
                console.log('✅ Player matches loaded', {
                    playerTPId,
                    count: data.length,
                    first: data[0]
                });
                const rows = (data || []).map((m, i) => ({ ...(m as any), __idx: i }));

    // Show the newest matches first by default.
                if (!this.pendingBrowseScroll) {
                    this.sortField = 'date';
                    this.sortDirection = 'desc';
                }

                rows.sort((a: any, b: any) => {
                    const ta = Date.parse(a?.dateTime ?? '') || 0;
                    const tb = Date.parse(b?.dateTime ?? '') || 0;
                    return tb - ta;
                });

                this.daySourceMatches = rows;

                this.matches = this.isFiltered
                    ? this.filterMatchesByActiveFilters(this.daySourceMatches)
                    : this.daySourceMatches;

                if (this.pendingBrowseScroll && (this.sortField !== 'date' || this.sortDirection !== 'desc'))
                    this.sortMatches();
                this.applyActiveFiltersToCurrentDay();
                this.syncPlayerHeaderFromRows(rows, playerTPId);

                this.loading = false;
                this.browseLoaded = true;
                document.body.classList.remove('bb-noscroll');
                this.restoreBrowsePosition();
            },
            error: (err) => {
                console.error('❌ Failed to load player matches:', err);
                this.scopedLoadError = true;
                this.browseLoaded = false;
                this.recovery?.unavailable(this);
                this.daySourceMatches = [];
                this.matches = [];
                this.filteredMatches = [];
                this.loading = false;
                document.body.classList.remove('bb-noscroll');
            }
        });
    }

    loadTournamentMatches(tournamentsEventTPId: number): void {
        this.filterUndo?.cancel(this);
        if (this.viewMode === 'favourites') return;
        this.recovery?.begin(this);
        this.scopedLoadError = false;
        this.scopedRequest?.unsubscribe();
        console.log('📦 loadTournamentMatches called', { tournamentsEventTPId });

        this.loading = true;
        document.body.classList.add('bb-noscroll');

        this.scopedRequest = this.staticArchives.getTournamentMatches(tournamentsEventTPId).pipe(takeUntil(this.destroy$)).subscribe({
            next: (data: any) => {
                const rows = (data || []).map((m: any, i: any) => ({ ...(m as any), __idx: i }));
                const sortedRows = this.sortTournamentMatches(rows);
                
                this.daySourceMatches = sortedRows;
                
                this.matches = this.isFiltered
                  ? this.filterMatchesByActiveFilters(this.daySourceMatches)
                  : this.daySourceMatches;
                
                this.applyActiveFiltersToCurrentDay();
                this.syncTournamentHeaderFromRows(sortedRows, tournamentsEventTPId);

                console.log('✅ Tournament matches loaded', {
                    tournamentsEventTPId,
                    count: sortedRows.length,
                    first: sortedRows[0]
                });

                this.loading = false;
                document.body.classList.remove('bb-noscroll');
                this.browseLoaded = true;
                this.restoreBrowsePosition();
            },
            error: (err: any) => {
                console.error('❌ Failed to load tournament matches:', err);
                this.scopedLoadError = true;
                this.browseLoaded = false;
                this.recovery?.unavailable(this);
                this.daySourceMatches = [];
                this.matches = [];
                this.filteredMatches = [];
                this.loading = false;
                document.body.classList.remove('bb-noscroll');
            }
        });
    }

    private syncTournamentHeaderFromRows(rows: any[], tournamentEventTPId: number): void {
        const first =
            rows?.find(r => Number(r?.tournamentEventTPId) === tournamentEventTPId) ??
            rows?.[0];

        if (!first) {
            this.tournamentHeaderName = '';
            this.tournamentHeaderCountryISO2 = '';
            this.tournamentHeaderCountryISO3 = '';
            this.tournamentHeaderCountryFull = '';
            this.tournamentHeaderSurface = '';
            this.tournamentHeaderType = '';
            this.tournamentHeaderDateTime = '';
            this.tournamentHeaderStrength = '';
            this.tournamentHeaderStrengthValue = null;
            this.tournamentHeaderLevel = '';
            return;
        }

        this.tournamentHeaderName = first?.tournamentEventName ?? '';
        this.tournamentHeaderCountryISO2 = first?.tournamentEventCountryISO2 ?? '';
        this.tournamentHeaderCountryISO3 = first?.tournamentEventCountryISO3 ?? '';
        this.tournamentHeaderCountryFull = first?.tournamentEventCountryFull ?? '';
        this.tournamentHeaderSurface = first?.surface ?? '';
        this.tournamentHeaderType = first?.tournamentTypeName ?? '';
        this.tournamentHeaderLevel =
            first?.tournamentLevelName ??
            first?.tournamentLevel ??
            first?.l09 ??
            '';

        const strengthRaw =
            first?.tournamentStrengthMeanTS ??
            first?.strengthMeanTS ??
            first?.l11 ??
            null;

        this.tournamentHeaderStrengthValue =
            strengthRaw != null && Number.isFinite(Number(strengthRaw))
                ? Number(strengthRaw)
                : null;
        this.tournamentHeaderStrength = this.tournamentHeaderStrengthValue != null
            ? this.regional.number(this.tournamentHeaderStrengthValue, 2)
            : '';

        console.log('🏆 tournament header synced', {
            tournamentEventTPId,
            name: this.tournamentHeaderName,
            iso2: this.tournamentHeaderCountryISO2,
            iso3: this.tournamentHeaderCountryISO3,
            surface: this.tournamentHeaderSurface,
            type: this.tournamentHeaderType,
            strengthRaw,
            strengthFinal: this.tournamentHeaderStrength,
            first
        });
    }

    getTournamentHeaderStrengthStars(): number {
        return this.tournamentHeaderStrengthValue == null
            ? 0
            : this.getTSStars(this.tournamentHeaderStrengthValue);
    }

    get tournamentHeaderStrengthTitle(): string {
        return this.tournamentHeaderStrength
            ? this.regional.text('matchGrid.strengthMean', { value: this.tournamentHeaderStrengthValue == null ? this.tournamentHeaderStrength : this.regional.number(this.tournamentHeaderStrengthValue, 2) })
            : '';
    }

    private readonly TS_MIN = 18; // “low”
    private readonly TS_MAX = 32; // “high”

    getTSStars(ts: number | null | undefined): number {
        if (ts == null || !Number.isFinite(ts)) return 0;

        const t = (ts - this.TS_MIN) / (this.TS_MAX - this.TS_MIN);
        const clamped = Math.min(1, Math.max(0, t));
        const stars = clamped * 5;

        // pola zvjezdice
        return Math.round(stars * 2) / 2;
    }

    private formatDateMaybe(value?: string | null): string {
        if (!value) return '';
        const d = new Date(value);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    }

    private getRoundSortKey(roundName?: string | null): number {
        const s0 = (roundName ?? '').trim().toLowerCase();
        if (!s0) return 999;

        // normalizacije
        const s = s0
            .replace(/\s+/g, ' ')
            .replace(/quarterfinals?/g, 'quarter finals')
            .replace(/semifinals?/g, 'semi finals');

    // Order the final tournament stages from round of 16 through the final.
        if (s === 'r16' || s === 'round of 16') return 0;
        if (s === 'qf' || s === 'quarter finals') return 1;
        if (s === 'sf' || s === 'semi finals') return 2;
        if (s === 'third place' || s === 'third-place' || s === '3rd place') return 3;
        if (s === 'f' || s === 'final' || s === 'finals') return 3;

        const leagueRound = s.match(/^league\s+round\s+(\d+)$/);
        if (leagueRound) return 200 + Number(leagueRound[1]);

    // Handle any additional Rxx abbreviations defensively.
        // Place R32, R64, and similar rounds after the main final stages.
        const rx = s.match(/^r(\d{1,3})$/);
        if (rx) {
            const n = parseInt(rx[1], 10);
    // Larger round numbers are earlier stages and remain behind the final stages.
            return 100 + (1000 - n);
        }

        // "1st round"..."5th round"
        const m1 = s.match(/^(\d+)(st|nd|rd|th)\s+round$/);
        if (m1) {
            const n = parseInt(m1[1], 10); // 1..5
            return 200 + n;               // After the main final stages.
        }

        // qualifications / qualifying / Q
        if (s === 'q' || s === 'qualifications' || s === 'qualification' || s.includes('qualif')) return 900;

        // Unknown rounds sort last.
        if (s === 'unknown') return 999;

        return 500; // fallback
    }

    private isLegacyOrInvalidTime(d: any): boolean {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return true;

        const y = dt.getFullYear();
        if (y < 2004) return true;               // tvoj cutoff

    // Treat a parser fallback of 00:00 as unknown and prefer round plus source index.
        const h = dt.getHours();
        const m = dt.getMinutes();
        return (h === 0 && m === 0);
    }

    private getDateSortKey(d: string | Date | null | undefined): number | null {
        if (d == null || d === '') return null;

        const value = d instanceof Date ? d.getTime() : new Date(d).getTime();
        return Number.isFinite(value) ? value : null;
    }

    sortMatches(): void {
        // Sorting can mutate an existing array; do not retain its old group order.
        this.groupedPresentationCache = undefined;
        const dir = this.sortDirection === 'asc' ? 1 : -1;

        this.matches.sort((a, b) => {

            const ta = this.removeRomanSuffix(a.tournamentEventName || '').toLowerCase();
            const tb = this.removeRomanSuffix(b.tournamentEventName || '').toLowerCase();

            const ia = (a as any).__idx ?? 0;
            const ib = (b as any).__idx ?? 0;

            const legacy = this.isLegacyOrInvalidTime(a.dateTime) || this.isLegacyOrInvalidTime(b.dateTime);

            // ---- SORT: TOURNAMENT (default)
            if (this.sortField === 'tournament') {
    // 1) Tournament.
                if (ta < tb) return -1 * dir;
                if (ta > tb) return 1 * dir;

    // 2) Round order within the same tournament, including legacy rows.
                const ra = this.getRoundSortKey((a as any).roundName);
                const rb = this.getRoundSortKey((b as any).roundName);
                if (ra < rb) return -1;
                if (ra > rb) return 1;

    // 4) Use a valid dateTime next, otherwise retain source order through __idx.
                if (!legacy) {
                    const da = new Date(a.dateTime).getTime();
                    const db = new Date(b.dateTime).getTime();
                    if (da < db) return -1 * dir;
                    if (da > db) return 1 * dir;
                }

                return (ia - ib) * dir;
            }

            // ---- SORT: STRENGTH (Tour Strength)
            if (this.sortField === 'strength') {
                const sa = this.getStrengthKey(a);
                const sb = this.getStrengthKey(b);

                // primarno: strength
                if (sa < sb) return -1 * dir;
                if (sa > sb) return 1 * dir;

                // tie-breaker: tournament name (grupiranje)
                if (ta < tb) return -1;
                if (ta > tb) return 1;

                // tie-breaker: round
                const ra = this.getRoundSortKey((a as any).roundName);
                const rb = this.getRoundSortKey((b as any).roundName);
                if (ra < rb) return -1;
                if (ra > rb) return 1;

    // Use a valid dateTime as the final tie-breaker.
                if (!legacy) {
                    const da = new Date(a.dateTime).getTime();
                    const db = new Date(b.dateTime).getTime();
                    if (da < db) return -1;
                    if (da > db) return 1;
                }

                // Final stable-order tie-breaker.
                return ia - ib;
            }

            // ---- SORT: DATE
            // Historical dates and records without a known time are still valid calendar dates.
            // Keep them in chronological order instead of grouping them by round.
            const da = this.getDateSortKey(a.dateTime);
            const db = this.getDateSortKey(b.dateTime);

            if (da !== null && db !== null) {
                if (da < db) return -1 * dir;
                if (da > db) return 1 * dir;
            } else if (da !== null) {
                return -1; // invalid/missing dates always stay at the end
            } else if (db !== null) {
                return 1;
            }

            if (ta < tb) return -1 * dir;
            if (ta > tb) return 1 * dir;

            return (ia - ib) * dir;
        });
    }

    toggleSort(field: 'tournament' | 'date' | 'strength'): void {
        this.filterUndo?.cancel(this);
        this.cancelBrowseRestore?.();
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
      this.sortDirection = (field === 'strength') ? 'desc' : 'asc'; // Strongest tournaments first.
        }

        this.sortMatches();
        this.applyActiveFiltersToCurrentDay();
    }

    onNativeDateChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const rawDate = this.isoToDateLocal(input.value);

        if (!rawDate || isNaN(rawDate.getTime())) return;

        const formatted = this.ymdLocal(rawDate);

        if (this.isFiltered && this.filteredAvailableDates.length > 0) {
            const isInsideFilter = this.filteredAvailableDates.includes(formatted);
            if (!isInsideFilter) {
                this.showOutOfFilterRangeModal();

                // Reset the Angular-bound property.
                const currentDateFormatted = this.currentDate
                    ? this.formatDateForInput(this.currentDate)
                    : '';
                console.log('Resetting input to last valid date:', this.currentDate, currentDateFormatted);
                this.currentDateString = currentDateFormatted;

    // Synchronize the native date input after adjusting the component state.
                if (this.dateInputRef?.nativeElement) {
                    this.dateInputRef.nativeElement.value = this.currentDateString;
                }

                return;
            }
        }

    // Continue normally when the date is already valid.
        this.loadMatchesForDate(rawDate);
    }

    onDateInputChanged(event: Event): void {
        const input = event.target as HTMLInputElement;
        const rawDate = this.isoToDateLocal(input.value);

        if (!rawDate || isNaN(rawDate.getTime())) return;

      // Respect the active filter range when filters are enabled.
        const formatted = this.ymdLocal(rawDate);

        if (this.isFiltered && this.filteredAvailableDates.length > 0) {
            const isInsideFilter = this.filteredAvailableDates.includes(formatted);
            if (!isInsideFilter) {
                this.showOutOfFilterRangeModal();

                const currentDateFormatted = this.ymdLocal(this.currentDate);
                this.currentDateString = currentDateFormatted;

                if (this.dateInputRef?.nativeElement) {
                    this.dateInputRef.nativeElement.value = currentDateFormatted;
                }
                return;
            }
        }

      // Otherwise clamp to the global archive range.
        if (!this.isFiltered) {
            const corrected = this.correctDateIfOutOfBounds(rawDate);

            if (corrected.getTime() !== rawDate.getTime()) {
                this.showDateOutOfRangeModal();

                const correctedStr = this.ymdLocal(corrected);
                this.currentDate = corrected;
                this.currentDateString = correctedStr;

                if (this.dateInputRef?.nativeElement) {
                    this.dateInputRef.nativeElement.value = correctedStr;
                }

                this.loadMatchesForDate(corrected);
                this.checkAdjacentDaysAvailability(corrected);
                return;
            }
        }

        this.loadMatchesForDate(rawDate);
    }

    onDateInputFocus(): void {
        requestAnimationFrame(() => {
            this.dateInputRef?.nativeElement?.select();
        });
    }

    previousDay(): void {
        if (this.loading) return;

        const list = this.availableDates || [];
        if (!list.length) return;

        const curIso = this.currentDateISO || this.toISOFromDateLocal(this.currentDate);
        const idx = list.indexOf(curIso);

      // If the current date is absent, snap to the nearest earlier date or the last entry.
        const safeIdx = idx >= 0 ? idx : (this.findPrevIndex(list, curIso) ?? (list.length - 1));
        const prevIdx = safeIdx - 1;

        if (prevIdx < 0) {
            this.isPrevDisabled = true;
            return;
        }

        const targetIso = list[prevIdx];
        const targetDate = this.isoToDateLocal(targetIso);
        if (!targetDate) return;

        this.filteredPage = 1;
        this.loadMatchesForDate(targetDate);
    }

    nextDay(): void {
        if (this.loading) return;

        const list = this.availableDates || [];
        if (!list.length) return;

        const curIso = this.currentDateISO || this.toISOFromDateLocal(this.currentDate);
        const idx = list.indexOf(curIso);

      // If the current date is absent, snap to the nearest later date or the first entry.
        const safeIdx = idx >= 0 ? idx : (this.findNextIndex(list, curIso) ?? 0);
        const nextIdx = safeIdx + 1;

        if (nextIdx >= list.length) {
            this.isNextDisabled = true;
            return;
        }

        const targetIso = list[nextIdx];
        const targetDate = this.isoToDateLocal(targetIso);
        if (!targetDate) return;

        this.filteredPage = 1;
        this.loadMatchesForDate(targetDate);
    }

    // Date-navigation helpers.
    private findPrevIndex(list: string[], iso: string): number | null {
    // The list is ascending; find the greatest index whose value is less than iso.
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i] < iso) return i;
        }
        return null;
    }

    private findNextIndex(list: string[], iso: string): number | null {
    // Find the smallest index whose value is greater than iso.
        for (let i = 0; i < list.length; i++) {
            if (list[i] > iso) return i;
        }
        return null;
    }

    getLocalizedDateTime(date: string | Date): string {
        const parsedDate = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(parsedDate.getTime())) return '';

        const pad = (n: number) => n.toString().padStart(2, '0');

        const day = pad(parsedDate.getDate());
        const month = pad(parsedDate.getMonth() + 1); // Mjeseci su 0-indeksirani
        const year = parsedDate.getFullYear();
        const hours = pad(parsedDate.getHours());
        const minutes = pad(parsedDate.getMinutes());

        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    getLocalizedDate(date: string | Date): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '';

        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    }

    getLocalizedDateMaybeTime(date: string | Date | null | undefined, precision?: SourceTimePrecision | null): string {
        if (!date) return '';
        const raw = date instanceof Date ? date.toISOString() : date;
        return this.regional.matchDateTime(raw, precision).replace(/ (\d{2}:\d{2})$/, '\n$1');
    }

    matchTimeTitle(match: Match): string {
        const time = matchDisplayTime(match.dateTime, match.sourceTimePrecision);
        return this.getLocalizedDateMaybeTime(match.dateTime, match.sourceTimePrecision) + ' — ' +
            (time.instant === null ? this.regional.text('timeZone.original') : this.regional.timeZone());
    }

    formatOdds(value: number | null | undefined): string {
        if (value == null || isNaN(value)) return '';
        return this.regional.number(value, 2);
    }

    formatPercent(value: number | null | undefined): string {
        if (value == null || isNaN(value)) return '';
        return this.regional.number(value * 100, 0) + '%';
    }

    closeMatchModal(): void {
        this.selectedMatch = null;
    }

    openFilterModal(): void {
        this.showFilterModal = true;
    }

    closeFilterModal(): void {
        this.showFilterModal = false;
    }

    openPlayerPage(playerTPId: number | null | undefined): void {
        const id = Number(playerTPId);
        if (!Number.isInteger(id) || id <= 0) return;
        this.closeInfoModal();
        this.infoRequest = this.staticArchives.getPlayerIndexById(id)
            .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
            .subscribe(player => {
                const row = this.matches.find(match => match.player1TPId === id || match.player2TPId === id);
                this.infoPlayer = player ?? {
                    playerTPId: id,
                    playerName: (row?.player1TPId === id ? row.player1Name : row?.player2Name) ?? null
                };
            });
    }

    openTournamentPage(tournamentEventTPId: number | null | undefined): void {
        const id = Number(tournamentEventTPId);
        if (!Number.isInteger(id) || id <= 0) return;
        this.closeInfoModal();
        this.infoRequest = this.staticArchives.getTournamentsIndex()
            .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
            .subscribe(index => {
                const row = this.matches.find(match => match.tournamentEventTPId === id);
                this.infoTournamentStrengthScale = index?.strength ?? this.deriveTournamentStrengthScale(index?.items ?? []);
                this.infoTournament = index?.items.find(tournament => tournament.tournamentEventTPId === id) ?? {
                    tournamentEventTPId: id,
                    tournamentEventName: row?.tournamentEventName ?? null,
                    countryISO2: row?.tournamentEventCountryISO2,
                    countryISO3: row?.tournamentEventCountryISO3,
                    countryFull: row?.tournamentEventCountryFull,
                    tournamentTypeName: row?.tournamentTypeName,
                    tournamentLevelId: row?.tournamentLevelId,
                    tournamentLevelName: row?.tournamentLevelName,
                    surfaceName: row?.surface
                };
            });
    }

    closeInfoModal(): void {
        this.infoRequest?.unsubscribe();
        this.infoPlayer = null;
        this.infoTournament = null;
        this.infoTournamentStrengthScale = null;
    }

    private deriveTournamentStrengthScale(items: TournamentIndex[]): { min: number; median: number; max: number } | null {
        const values = items
            .map(item => item.averageMatchStrength)
            .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
            .sort((a, b) => a - b);
        if (!values.length) return null;
        const middle = Math.floor(values.length / 2);
        const median = values.length % 2 === 0
            ? (values[middle - 1] + values[middle]) / 2
            : values[middle];
        return { min: values[0], median, max: values[values.length - 1] };
    }

    showTournamentMatches(id: number): void {
        if (!Number.isInteger(id) || id <= 0) return;
        this.closeInfoModal();
        if (this.viewMode === 'tournament' && this.tournamentMatchesTPId === id) {
            this.showAllScopedMatches();
            return;
        }
        void this.router.navigate(['/tournaments/matches', id]);
    }

    showAllScopedMatches(): void {
        if (this.viewMode === 'daily') return;
        if (this.viewMode === 'favourites') {
            this.searchTerm = '';
            this.setFavouriteStatus('all');
            return;
        }
        const previous = this.beforeFilterChange();
        this.resetScopedMatchFilters();
        this.clearFilter();
        this.offerFilterUndo(previous);
    }

    private refreshReusedScopedRoute(force = false): void {
        // Reuse is safe across both changed IDs and changed route modes.
        const playerId = Number(this.route.snapshot.paramMap.get('playerTPId'));
        const tournamentId = Number(this.route.snapshot.paramMap.get('tournamentEventTPId'));
        const mode = this.route.snapshot.data?.['favourites'] === true ? 'favourites' :
            Number.isFinite(playerId) && playerId > 0 ? 'player' :
            Number.isFinite(tournamentId) && tournamentId > 0 ? 'tournament' : 'daily';
        if (!force && mode === this.viewMode &&
            (mode !== 'player' || playerId === this.playerMatchesTPId) &&
            (mode !== 'tournament' || tournamentId === this.tournamentMatchesTPId)) return;

        this.rememberBrowse();
        this.cancelScopeRequests();
        this.clearFavouriteRows();
        this.closeInfoModal();
        this.closeDetailsModal();
        this.viewMode = mode;
        this.playerMatchesTPId = null;
        this.tournamentMatchesTPId = null;
        this.showFilterModal = false;
        this.showDatepicker = false;
        this.showDateWarning = false;
        this.showOutOfRangeModal = false;
        this.dailyLoadError = false;
        this.searchTerm = '';
        this.noMatchesForFilter = false;
        if (mode === 'favourites') {
            this.recallBrowse(null);
            this.favouriteStatus = 'all';
            this.sortField = 'date';
            this.sortDirection = 'desc';
            this.loadFavouriteRows();
        } else if (mode === 'player') {
            this.playerMatchesTPId = playerId;
            this.resetScopedMatchFilters();
            this.recallBrowse('matches:player:' + playerId);
            this.loadPlayerMatches(playerId);
        } else if (mode === 'tournament') {
            this.tournamentMatchesTPId = tournamentId;
            this.resetScopedMatchFilters();
            this.recallBrowse('matches:tournament:' + tournamentId);
            this.loadTournamentMatches(tournamentId);
        } else {
            this.resetScopedMatchFilters();
            this.filterMode = 'auto';
            this.activeStatus = DEFAULT_MATCH_STATUS;
            this.activeOdds = DEFAULT_ODDS_FILTER;
            this.valueFilter = DEFAULT_VALUE_FILTER;
            this.isFiltered = this.filterApplied = true;
            this.sortField = 'tournament';
            this.sortDirection = 'asc';
            this.recallBrowse('matches:daily');
            this.bootstrapDailyMatches();
        }
    }

    formatResult(raw: string | number | null | undefined): string {
        if (raw == null) return '';
        const s = String(raw).trim();

    // Preserve already formatted scores and special outcomes.
        if (!s) return '';
        if (s.includes(':')) return s;         // npr. "2:1"
    if (/^(RET|W[OW]|ABD|CAN|DEF)$/i.test(s)) return s; // Special outcomes.

        // "21", "2-1", "02-01" → "2:1"
        const m = s.match(/^(\d{1,2})\D?(\d{1,2})$/);
        if (m) return `${parseInt(m[1], 10)}:${parseInt(m[2], 10)}`;

        return s; // fallback
    }

    formatResultDetails(raw?: string | null): string {
        if (!raw) return '';

        const tokens = raw.split(/\s+/).filter(Boolean);
        if (!tokens.length) return '';

        const summary = this.parseSetSummary(tokens[0]);
        const setStart = summary && tokens.length >= 2 ? 1 : 0;
        const rawSetTokens = tokens.slice(setStart);
        const resolvedSets = summary
            ? this.resolveSetTokensAgainstSummary(rawSetTokens, summary)
            : rawSetTokens.map(token => this.normalizeSetToken(token));
        const normalized = setStart === 1
            ? [this.normalizeSetToken(tokens[0]), ...resolvedSets]
            : resolvedSets;

        if (!normalized.length) return '';

    // 2) Remove a leading overall set score such as 2:0, 2:1, or 3:2.
        // Remove the leading summary token only when at least two real set scores follow,
        // such as 6:4, 7:6(5), or 10:8.
        if (this.looksLikeSetScoreHeader(normalized[0])) {
            const setLikeCount = normalized.slice(1).filter(t => this.looksLikeRealSetToken(t)).length;
            if (setLikeCount >= 2) {
                normalized.shift();
            }
        }

        return normalized.join(' ');
    }

    private parseSetSummary(token: string): { p1: number; p2: number } | null {
        const compact = token.trim().match(/^([1-4])([0-2])$/);
        if (compact) return { p1: Number(compact[1]), p2: Number(compact[2]) };

        const explicit = token.trim().match(/^([1-4]):([0-2])$/);
        return explicit ? { p1: Number(explicit[1]), p2: Number(explicit[2]) } : null;
    }

    private resolveSetTokensAgainstSummary(
        tokens: string[],
        summary: { p1: number; p2: number }
    ): string[] {
        const candidates = tokens.map(token => this.setTokenCandidates(token));
        const matches: string[][] = [];

        const visit = (index: number, selected: string[], p1: number, p2: number): void => {
            if (p1 > summary.p1 || p2 > summary.p2) return;
            if (index === candidates.length) {
                if (p1 === summary.p1 && p2 === summary.p2) matches.push([...selected]);
                return;
            }

            for (const candidate of candidates[index]) {
                const parsed = candidate.match(/^(\d{1,2}):(\d{1,2})/);
                if (!parsed) continue;
                const first = Number(parsed[1]);
                const second = Number(parsed[2]);
                visit(
                    index + 1,
                    [...selected, candidate],
                    p1 + (first > second ? 1 : 0),
                    p2 + (second > first ? 1 : 0)
                );
            }
        };

        visit(0, [], 0, 0);
        return matches.length === 1
            ? matches[0]
            : tokens.map(token => this.normalizeSetToken(token));
    }

    private setTokenCandidates(token: string): string[] {
        const compact = token.trim().match(/^(\d{3})(\([^)]+\))?$/);
        if (!compact) return [this.normalizeSetToken(token)];

        const digits = compact[1];
        const suffix = compact[2] || '';
        const first = `${Number(digits[0])}:${Number(digits.slice(1))}${suffix}`;
        const second = `${Number(digits.slice(0, 2))}:${Number(digits[2])}${suffix}`;
        return first === second ? [first] : [first, second];
    }

    private looksLikeSetScoreHeader(tok: string): boolean {
        // 2:0, 2:1, 3:2, 1:1 ...
        return /^\d{1,2}:\d{1,2}$/.test(tok.trim());
    }

    private looksLikeRealSetToken(tok: string): boolean {
        // 6:4, 7:6(5), 10:8
        const m = tok.trim().match(/^(\d{1,2}):(\d{1,2})(\([^)]+\))?$/);
        if (!m) return false;
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
    return Math.max(a, b) >= 6; // Sets normally reach 6/7 games; a super tie-break reaches 10.
    }

    private normalizeSetToken(tok: string): string {
        const t = tok.trim();

    // Already formatted as 6:4 or 7:6(5).
        if (/^\d{1,2}:\d{1,2}(\([^)]+\))?$/.test(t)) return t;

        // "6-4" ili "10-8"
        const dash = t.match(/^(\d{1,2})[-–](\d{1,2})$/);
        if (dash) return `${parseInt(dash[1], 10)}:${parseInt(dash[2], 10)}`;

        // packed: "76", "62", "20", "76(5)"
        const packed = t.match(/^(\d{1,2})(\d{1,2})(\([^)]+\))?$/);
        if (packed) {
            return `${parseInt(packed[1], 10)}:${parseInt(packed[2], 10)}${packed[3] || ''}`;
        }

        // ostalo (RET, WO, ...)
        return t;
    }

    removeRomanSuffix(name: string): string {
        return name.replace(/\s+(\([IVXLCDM]{1,4}\)|[IVXLCDM]{1,4})\s*$/i, '').trim();
    }

    decodeHtmlEntities(value: string): string {
        // Almost every player/tournament label is already plain text. Avoid DOM
        // allocation/parsing for those labels on every Angular binding check.
        if (!/[&<]/.test(value)) return value;
        const cached = this.decodedTextCache.get(value);
        if (cached !== undefined) return cached;
        const textarea = this.textDecoder ??= document.createElement('textarea');
        textarea.innerHTML = value;
        const decoded = textarea.value;
        if (this.decodedTextCache.size >= 2048) this.decodedTextCache.clear();
        this.decodedTextCache.set(value, decoded);
        return decoded;
    }

    onFilterApplied(filter: AppliedMatchFilter): void {
        const previous = this.beforeFilterChange();
        this.filterUndo?.cancel(this);
        this.applyMatchFilter(filter);
        this.offerFilterUndo(previous);
    }

    private applyMatchFilter(filter: AppliedMatchFilter): void {
        this.pendingBrowseScroll = null;
        this.cancelBrowseRestore?.();
        // Applying either the modal or a quick filter explicitly opts out of date-aware defaults.
        this.filterMode = 'custom';
        console.log('🧪 onFilterApplied (incoming):', filter);
        console.log('[PARENT RECEIVED] status =', filter.status);

    // 1) Store active values; the modal already resolves start and end dates.
        this.activeDateFilter = filter.option;
        this.activeFromDate = filter.startDate;
        this.activeToDate = filter.endDate;
        this.activeSurfaceIds = (filter.surfaceIds || []).map(Number);
        this.activeTournamentTypeIds = (filter.tournamentTypeIds || []).map(Number);
        this.activeStrengthStars = (filter.strengthStars || []).map(Number);
        this.activeStatus = filter.status ?? DEFAULT_MATCH_STATUS;
        this.activeOdds = filter.odds ?? DEFAULT_ODDS_FILTER;
        this.valueFilter = filter.valueFilter ?? DEFAULT_VALUE_FILTER;
        this.activeConfidence = filter.confidence ?? 'all';
        if (filter.plBasis) this.plBasis = filter.plBasis;

        console.log('[PARENT STORED] activeStatus =', this.activeStatus);

        // 2) detektiraj je li filter "default" (badge)
        const allSurfaces = [1, 2, 3, 4, 5];
        const allTypes = [2, 4];
        const allStrength = [0, 1, 2, 3, 4, 5];

        const isDefaultDate =
            this.activeDateFilter === 'all' && !this.activeFromDate && !this.activeToDate;

        const isAllSurfaces =
            this.activeSurfaceIds.length === allSurfaces.length &&
            allSurfaces.every(id => this.activeSurfaceIds.includes(id));

        const isAllTypes =
            this.activeTournamentTypeIds.length === allTypes.length &&
            allTypes.every(id => this.activeTournamentTypeIds.includes(id));

        const isAllStrength =
            this.activeStrengthStars.length === allStrength.length &&
            allStrength.every(s => this.activeStrengthStars.includes(s));

        const isDefaultStatus = this.activeStatus === 'all';

        const isDefaultOdds = this.activeOdds === 'all';
        const isDefaultValue = this.valueFilter === 'all';
        const isDefaultConfidence = this.activeConfidence === 'all';

        this.isFiltered = !(
            isDefaultDate &&
            isAllSurfaces &&
            isAllTypes &&
            isAllStrength &&
            isDefaultStatus &&
            isDefaultOdds &&
            isDefaultValue &&
            isDefaultConfidence
        );
        this.filterApplied = this.isFiltered;

        // Player and tournament routes already own a scoped archive. Applying a
        // filter must never replace it with the global daily archive.
        if (this.viewMode === 'player' || this.viewMode === 'tournament') {
            this.matches = [...this.daySourceMatches];
            this.applyActiveFiltersToCurrentDay();
            this.filteredPage = 1;
            this.showFilterModal = false;
            this.deferScrollToTop();
            return;
        }

    // 3) Calculate available dates constrained only by the date-range filter.
        const hasDateRange = !!(this.activeFromDate && this.activeToDate);

        if (this.availableDates?.length) {
            if (!this.isFiltered || !hasDateRange) {
                this.filteredAvailableDates = [...this.availableDates];
            } else {
                const from = this.activeFromDate!;
                const to = this.activeToDate!;
                this.filteredAvailableDates = this.availableDates.filter(d => d >= from && d <= to);
            }
        } else {
            this.filteredAvailableDates = [];
        }

        console.log('✅ filteredAvailableDates:', {
            count: this.filteredAvailableDates.length,
            from: this.activeFromDate,
            to: this.activeToDate,
            first: this.filteredAvailableDates[0],
            last: this.filteredAvailableDates[this.filteredAvailableDates.length - 1],
        });

    // 4) When the date range is empty, show no results and retain the current day.
        if (this.isFiltered && hasDateRange && this.filteredAvailableDates.length === 0) {
            this.matches = [];
            this.daySourceMatches = [];
            this.filteredMatches = [];
            this.noMatchesForFilter = true;
            this.filteredPage = 1;
            this.showFilterModal = false;
            this.deferScrollToTop();
            return;
        }

    // 5) Resolve the target archive day.
        const currentIso = this.currentDateISO || this.toISOFromDateLocal(this.currentDate);

        let targetIso = currentIso;

        if (this.isFiltered && hasDateRange) {
            if (!this.filteredAvailableDates.includes(currentIso)) {
                targetIso = this.filteredAvailableDates[this.filteredAvailableDates.length - 1];
            }
        }

    // 6) Close the modal and load the resolved day.
        this.filteredPage = 1;
        this.showFilterModal = false;

        const targetDate = this.isoToDateLocal(targetIso);
        if (targetDate) {
            this.loadMatchesForDate(targetDate);
        } else {
            this.loadMatchesForDate(this.currentDate);
        }
    }

    private normalizeSurfaceId(m: any): number | null {
        const v = m.surfaceId ?? m.surface_id ?? null;
        if (v !== null && v !== undefined && !Number.isNaN(+v)) {
            const numeric = +v;
            return numeric >= 1 && numeric <= 4 ? numeric : 5;
        }
        const s = m.surface ?? m.courtSurface ?? m.surfaceName;
        if (s) {
            const key = String(s).toLowerCase().trim();
            return MatchesComponent.SURFACE_MAP[key] ?? 5;
        }
        return 5;
    }

    private normalizeTypeId(m: any): number | null {
        const v = m.tournamentTypeId ?? m.typeId ?? null;
        if (v !== null && v !== undefined && !Number.isNaN(+v)) return +v;

        // Include tournamentTypeName from the daily archive.
        const s = m.tournamentTypeName ?? m.tournamentType ?? m.series ?? m.tour ?? m.category ?? null;

        if (s) {
            const key = String(s).toUpperCase().trim();
            return MatchesComponent.TYPE_MAP[key] ?? null; // ATP->2, WTA->4
        }

        return null;
    }

    private normalizeLevelId(m: any): number | null {
        const v = m.tournamentLevelId ?? m.levelId ?? null;
        if (v !== null && v !== undefined && !Number.isNaN(+v)) return +v;

        const raw =
            m.tournamentLevelName ?? m.tournamentLevel ?? m.level ?? m.eventLevel ?? null;

        if (!raw) return null;

        // canonicalize
        let key = String(raw).trim();

        // ukloni razmake oko > i <
        key = key.replace(/\s+/g, ''); // "> 50K" -> ">50K"

        // normaliziraj neke poznate varijante
        const up = key.toUpperCase();

        // Qualifications variants
        if (up === 'QUALIFICATIONS' || up === 'QUALIFYING' || up === 'Q') return 3;

        // Cup variants
        if (up === 'CUP') return 2;

        // prize bucket variants
        if (up === '>50K' || up === '50K+' || up === '>=50K') return 1;
        if (up === '<50K' || up === '50K-' || up === '<=50K') return 4;

        // fallback to map (try original spacing too)
        return (
            MatchesComponent.LEVEL_MAP[String(raw).trim()] ??
            MatchesComponent.LEVEL_MAP[key] ??
            MatchesComponent.LEVEL_MAP[up] ??
            null
        );
    }

    private filterMatchesByActiveFilters(source: Match[]): Match[] {
        console.log('[FILTER RUN] source len=', (source || []).length, 'activeStatus=', this.activeStatus);

        const sample = (source || []).slice(0, 5).map((m: any) => ({
            matchTPId: m?.matchTPId,
            l03: m?.l03,
            isFinished: m?.isFinished,
            typeofIsFinished: typeof m?.isFinished,
        }));
        console.log('[FILTER SAMPLE]', sample);

    // Return the source directly when no filters are active.
    // valueFilter participates in this gate like every other filter.
        const hasAnyFilter =
            this.isFiltered ||
            this.activeStatus !== 'all' ||
            this.valueFilter === 'valueOnly' ||
            this.activeConfidence !== 'all';

        if (!hasAnyFilter) return source || [];

        const sSet = new Set((this.activeSurfaceIds || []).map(Number));
        const tSet = new Set((this.activeTournamentTypeIds || []).map(Number));
        const strengthSet = new Set((this.activeStrengthStars || []).map(Number));
        const restrictSurface =
            ![1, 2, 3, 4, 5].every(surfaceId => sSet.has(surfaceId));
        const restrictType =
            ![2, 4].every(typeId => tSet.has(typeId));
        const restrictStrength =
            ![0, 1, 2, 3, 4, 5].every(star => strengthSet.has(star));

        return (source || []).filter((m: Match) => {
            // SURFACE
            if (restrictSurface) {
                const sId = this.normalizeSurfaceId(m);
                if (sId == null || !sSet.has(sId)) return false;
            }

            // TYPE
            if (restrictType) {
                const tId = this.normalizeTypeId(m);
                if (tId == null || !tSet.has(tId)) return false;
            }

            // STRENGTH (0..5 bucket)
            if (restrictStrength) {
                const bucket = this.strengthBucket(m);
                if (!strengthSet.has(bucket)) return false;
            }

            // STATUS
            if (this.activeStatus !== 'all') {
      // Support both expanded and minified (l03) archive shapes.
                if (this.getMatchOutcomeStatus(m) !== this.activeStatus) return false;
            }

            // ODDS
            if (this.activeOdds !== 'all') {
                const has = this.hasOdds(m);
                if (this.activeOdds === 'with' && !has) return false;
                if (this.activeOdds === 'without' && has) return false;
            }

            // MODEL CONFIDENCE
            if (this.activeConfidence !== 'all') {
                const prediction = this.getPrediction(m);
                const minimum = Number(this.activeConfidence);
                if (!prediction || prediction.confidence < minimum) return false;
            }

      // Value-only requires at least one side with edge >= MIN_EDGE.
            if (this.valueFilter === 'valueOnly') {
                if (!this.hasValueBet(m)) return false;
            }

            return true;
        });
    }

    private applyActiveFiltersToCurrentDay(): void {
        if (this.viewMode === 'favourites') {
            // Personal saves never inherit discovery/date/tour/odds/strength filters.
            const now = Date.now();
            const rows = this.matches.filter(match => {
                if (this.favouriteStatus === 'all') return true;
                const finished = this.isFinishedValue(match.isFinished);
                if (this.favouriteStatus === 'finished') return finished;
                const start = matchDisplayTime(match.dateTime, match.sourceTimePrecision).instant;
                return !finished && !this.hasRecordedResultData(match) && start !== null && start > now;
            });
            this.filteredMatches = this.filterMatchesBySearchTerm(rows);
            this.noMatchesForFilter = this.filteredMatches.length === 0 && this.matches.length > 0;
            this.scheduleScrollNavigationRefresh();
            return;
        }
        // 1) aktivni filteri
        let rows = this.filterMatchesByActiveFilters(this.matches);

        // 2) Free-text search.
        rows = this.filterMatchesBySearchTerm(rows);

        this.filteredMatches = rows;

        if (this.viewMode === 'tournament') {
            this.filteredMatches = this.sortTournamentMatches(this.filteredMatches as any[]);
          }
        // Show the empty state for both filters and free-text search.
        this.noMatchesForFilter =
            (this.isFiltered || !!this.searchTerm.trim()) && this.filteredMatches.length === 0;
        this.scheduleScrollNavigationRefresh();
    }

    clearFilter(): void {
        this.filterUndo?.cancel(this);
        // The caller resolves the appropriate auto preset before rebuilding the current view.
        this.matches = [...this.daySourceMatches];
        this.sortMatches();
        this.applyActiveFiltersToCurrentDay();
        this.filteredPage = 1;
        this.deferScrollToTop();
    }

    predictionViewNoticeDismissed = false;
    private historicalAutoWithoutEdge = false;

    get predictionViewNoticeKey(): string {
        return this.historicalAutoWithoutEdge ? 'matchGrid.historicalNoticeText' : 'matchGrid.noticeText';
    }

    dismissPredictionViewNotice(): void {
        this.predictionViewNoticeDismissed = true;
        this.scheduleScrollNavigationRefresh();
    }

    get showPredictionViewNotice(): boolean {
        return !this.predictionViewNoticeDismissed && this.viewMode === 'daily' &&
            this.filterMode === 'auto' &&
            this.isFiltered &&
            this.activeStatus === DEFAULT_MATCH_STATUS &&
            this.activeOdds === DEFAULT_ODDS_FILTER &&
            (this.valueFilter === DEFAULT_VALUE_FILTER || (this.historicalAutoWithoutEdge && this.valueFilter === 'all'));
    }

    get predictionViewTotalCount(): number {
        return this.daySourceMatches.length;
    }

    showAllMatchesForCurrentDay(): void {
        const previous = this.beforeFilterChange();
        this.filterMode = 'custom';
        this.historicalAutoWithoutEdge = false;
        this.activeStatus = 'all';
        this.activeOdds = 'all';
        this.valueFilter = 'all';
        this.isFiltered = false;
        this.filterApplied = false;
        this.filteredAvailableDates = [...(this.availableDates || [])];
        this.clearFilter();
        this.offerFilterUndo(previous);
    }

    onFilterReset(): void {
        const previous = this.beforeFilterChange();
        this.showFilterModal = false;
        this.plBasis = 'fair';
        this.filterMode = 'auto';
        this.activeDateFilter = 'all';
        this.activeFromDate = null;
        this.activeToDate = null;
        this.activeSurfaceIds = [1, 2, 3, 4, 5];
        this.activeTournamentTypeIds = [2, 4];
        this.activeStrengthStars = [0, 1, 2, 3, 4, 5];
        this.applyAutomaticFilterPreset(this.currentDate, this.daySourceMatches);

        this.clearFilter();
        this.offerFilterUndo(previous);
    }

    isFilterDefault(): boolean {
        const allSurfacesSelected = this.activeSurfaceIds.length === 5 && [1, 2, 3, 4, 5].every(id => this.activeSurfaceIds.includes(id));
        const allTournamentTypeIds = this.activeTournamentTypeIds.length === 2 && [2, 4].every(id => this.activeTournamentTypeIds.includes(id));
        const allTournamentLevelIds = this.activeTournamentLevelIds.length === 4 && [1, 2, 3, 4].every(id => this.activeTournamentLevelIds.includes(id));
        const dateIsAll = this.activeDateFilter === 'all';
        return allSurfacesSelected && allTournamentTypeIds && allTournamentLevelIds && dateIsAll;
    }

    correctDateIfOutOfBounds(date: Date): Date {
        if (date < this.minDate) return this.minDate;
        if (date > this.maxDate) return this.maxDate;
        return date;
    }

    showDateOutOfRangeModal(): void {
        this.showDateWarning = true;
        setTimeout(() => this.closeDateWarningModal(), 5000);
    }

    closeDateWarningModal(): void {
        this.showDateWarning = false;
    }

    checkAdjacentDaysAvailability(baseDate: Date): void {
        const list = this.availableDates || [];
        if (!list.length) {
            this.isPrevDisabled = true;
            this.isNextDisabled = true;
            return;
        }

        const curIso = this.currentDateISO || this.toISOFromDateLocal(baseDate);
        const idx = list.indexOf(curIso);

    // Navigation remains available when the current date is absent; resolve the nearest entry.
        const prevIdx = (idx >= 0) ? idx - 1 : (this.findPrevIndex(list, curIso) ?? -1);
        const nextIdx = (idx >= 0) ? idx + 1 : (this.findNextIndex(list, curIso) ?? list.length);

        this.isPrevDisabled = prevIdx < 0;
        this.isNextDisabled = nextIdx >= list.length;
    }

    showOutOfFilterRangeModal(): void {
        this.showOutOfRangeModal = true;
        setTimeout(() => this.showOutOfRangeModal = false, 5000); // automatsko zatvaranje
    }

    formatDateForInput(date: Date): string {

        if (!date || isNaN(date.getTime())) {
            console.error('❌ Invalid date passed to formatDateForInput:', date);
            return 'Invalid-Date';
        }
        return this.ymdLocal(date);
    }

    cleanTournamentNameFront(name: string): string {
        if (!name) return '';

        let out = name;

        // 1) Remove trailing parenthesized groups.
        out = out.replace(/\s*(?:\([^()]*\)\s*)+$/g, '');

    // 2) Remove a trailing Roman numeral when separated by whitespace.
        out = out.replace(/\s+(?:[IVXLCDM]{1,6})\s*$/i, '');

        // 3) Remove a trailing qualifications Q, with or without whitespace,
        // for example "Vancouver Q" or "VancouverQ".
        out = out.replace(/\s*Q\s*$/i, '');

        // 4) normaliziraj razmake
        return out.replace(/\s{2,}/g, ' ').trim();
    }

    leftOf(text?: string | null): string {
        return this.splitPair(text)[0];
    }

    rightOf(text?: string | null): string {
        return this.splitPair(text)[1];
    }

    hasBoth(text?: string | null): boolean {
        const [l, r] = this.splitPair(text);
        return !!(l && r);
    }

  /** Aligns a number to intWidth digits before the decimal and fracWidth decimals.
   *  A figure space (U+2007) occupies a digit's width while remaining blank. */
    private alignFixed(value: string, intWidth: number, fracWidth: number): string {
        const v = Number(String(value).replace(',', '.'));
        if (!Number.isFinite(v)) return '';
        const [intPartRaw, fracPartRaw = ''] = v.toFixed(fracWidth).split('.');
    const intPart = intPartRaw; // Archive values are non-negative.
        const padCount = Math.max(0, intWidth - intPart.length);
    const FIG = '\u2007'; // A figure space has the width of a digit.
        return FIG.repeat(padCount) + intPart + ',' + fracPartRaw;
    }

    private splitPair(text?: string | null): [string, string] {
        if (!text) return ['', ''];
        const parts = text.includes('–') ? text.split('–') : text.split('-');
        return [(parts[0] || '').trim(), (parts[1] || '').trim()];
    }

    private toFixedParts(v: string, frac = 2): [string, string] {
        const n = Number(String(v).replace(',', '.'));
        if (!Number.isFinite(n)) return ['', ''];
        const s = n.toFixed(frac);
        const [i, f = ''] = s.split('.');
        return [i, f];
    }

  /* Invisible leading zeroes fill targetWidth: <span class="ghost">00</span>. */
    private ghostPadInt(intPart: string, targetWidth: number): string {
        const need = Math.max(0, targetWidth - intPart.length);
        return need ? `<span class="ghost">${'0'.repeat(need)}</span>${intPart}` : intPart;
    }

  /* Odds: empty when both sides are 0.00; use 2+2 widths. */
    formatOddsHTML(text?: string | null): string {
        const [l, r] = this.splitPair(text);
        const [li, lf] = this.toFixedParts(l, 2);
        const [ri, rf] = this.toFixedParts(r, 2);
        const bothZero = li === '0' && lf === '00' && ri === '0' && rf === '00';
        if (bothZero) return '';
        const L = `${this.ghostPadInt(li, 2)},${lf}`;
        const R = `${this.ghostPadInt(ri, 2)},${rf}`;
        return `<span class="dual dual-odds"><span class="l">${L}</span><span class="mid">–</span><span class="r">${R}</span></span>`;
    }

  /* Probability: use 3+2 widths to accommodate 100.xx. */
    formatProbHTML(text?: string | null): string {
        const [l, r] = this.splitPair(text);
        const [li, lf] = this.toFixedParts(l, 2);
        const [ri, rf] = this.toFixedParts(r, 2);
        const L = `${this.ghostPadInt(li, 3)},${lf}`;
        const R = `${this.ghostPadInt(ri, 3)},${rf}`;
        return `<span class="dual dual-prob"><span class="l">${L}</span><span class="mid">–</span><span class="r">${R}</span></span>`;
    }

    private toIsoToday(): string {
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = String(now.getUTCMonth() + 1).padStart(2, '0');
        const d = String(now.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    commitDateInput(): void {
    // Native date inputs store currentDateString as YYYY-MM-DD.
        const rawDate = this.isoToDateLocal(this.currentDateString);

        if (!rawDate || isNaN(rawDate.getTime())) return;

        // Clamp the date to the available range.
        const corrected = this.correctDateIfOutOfBounds(rawDate);

      // Synchronize the string so the corrected value appears immediately.
        this.currentDateString = this.ymdLocal(corrected);

        // update i load
        this.filteredPage = 1;
        this.loadMatchesForDate(corrected);
    }

    formatResultFromDetails(match: Match): string {
        const cleaned = this.formatResultDetails(match.resultDetails);
        if (!cleaned) return this.formatResult(match.result);

        const tokens = cleaned.split(/\s+/).filter(Boolean);

        let p1 = 0, p2 = 0;
        for (const tok of tokens) {
            const m = tok.match(/^(\d{1,2}):(\d{1,2})/);
            if (!m) continue;
            const a = parseInt(m[1], 10);
            const b = parseInt(m[2], 10);
            if (a > b) p1++;
            else if (b > a) p2++;
        }

        if (p1 === 0 && p2 === 0) return this.formatResult(match.result);
        return `${p1}:${p2}`;
    }

    getDisplayResult(match: Match): string {
    // Prefer the richer details payload when it is already available.
        const computed = this.computeResultFromDetails(match.resultDetails);
        if (computed) return computed;

        // Fall back to the backend result.
        return this.formatResult(match.result);
    }

    private computeResultFromDetails(raw?: string | null): string | null {
    const cleaned = this.formatResultDetails(raw); // Normalizes tokens and removes the summary header.
        if (!cleaned) return null;

        const tokens = cleaned.split(/\s+/).filter(Boolean);

        let p1 = 0;
        let p2 = 0;

        for (const tok of tokens) {
            const m = tok.match(/^(\d{1,2}):(\d{1,2})/);
            if (!m) continue;
            const a = parseInt(m[1], 10);
            const b = parseInt(m[2], 10);
            if (a > b) p1++;
            else if (b > a) p2++;
        }

    // Preserve the backend result when no valid set token exists.
        if (p1 + p2 === 0) return null;

        return `${p1}:${p2}`;
    }

    getStrengthStars(match: any): number {
        const ts = match.tournamentStrengthMeanTS;

    if (ts == null || Number.isNaN(ts)) return 0;   // Zero is a valid minimum strength.

    // Display calibration aligned with the expected tournament-strength range.
    const min = 18;  // Lowest expected strength.
    const max = 32;  // Highest expected strength.

        // normalizacija 0..1
        const t = (ts - min) / (max - min);

        // clamp 0..1
        const clamped = Math.min(1, Math.max(0, t));

        // map 0..5
        const stars = clamped * 5;

    // Round to the nearest half-star.
        return Math.round(stars * 2) / 2;
    }

    formatPlayerLabel(
        name: string,
        iso3?: string | null,
        seed?: string | null,
        rank?: string | null
    ): string {
        return playerGridLabel(name, iso3, seed, rank);
    }

    formatPlayerCompactLabel(name?: string | null): string {
        return compactPlayerGridLabel(this.decodeHtmlEntities(name ?? ''));
    }

    formatRound(value?: string | null): string {
        const s = (value ?? '').trim();
        if (!s) return '';

        // common shortenings
        const key = s.toLowerCase();

        if (key === 'final') return 'F';
        if (key === 'semi finals' || key === 'semifinals' || key === 'semi-final') return 'SF';
        if (key === 'quarter finals' || key === 'quarterfinals' || key === 'quarter-final') return 'QF';
        if (key === 'third place' || key === 'third-place' || key === '3rd place') return '3P';

        const leagueRound = key.match(/^league\s+round\s+(\d+)$/);
        if (leagueRound) return `L${leagueRound[1]}`;

        // round of X
        const m = key.match(/^round of\s+(\d+)$/);
        if (m) return `R${m[1]}`;

        // qualifications variants
        if (key.includes('qualification')) return 'Q';
        if (key === 'qualifying') return 'Q';

        return s.toUpperCase();
    }

    formatRoundShort(value?: string | null): string {
        const s = (value ?? '').trim().toLowerCase();
        if (!s || s === 'unknown') return '';

        if (s === 'qualifications') return 'Q';
        if (s === 'quarter finals') return 'QF';
        if (s === 'semi finals') return 'SF';
        if (s === 'third place' || s === 'third-place' || s === '3rd place') return '3P';
        if (s === 'finals' || s === 'final') return 'F';

        const leagueRound = s.match(/^league\s+round\s+(\d+)$/);
        if (leagueRound) return `L${leagueRound[1]}`;

        // "1st round"..."5th round" => R1..R5
        const m1 = s.match(/^(\d+)(st|nd|rd|th)\s+round$/);
        if (m1) return `R${m1[1]}`;

        // "round of 16" => R16
        const m2 = s.match(/^round\s+of\s+(\d+)$/);
        if (m2) return `R${m2[1]}`;

        return (value ?? '').toUpperCase(); // fallback
    }

    isQualificationMatch(match?: Match | null): boolean {
        return !!match && this.normalizeLevelId(match) === 3;
    }

    formatMatchRoundShort(match?: Match | null): string {
        if (!match) return '';

        const round = this.formatRoundShort(match.roundName);
        if (!round) return '';

        if (!this.isQualificationMatch(match) || round === 'Q') return round;
        return `Q · ${round}`;
    }

    getMatchRoundTooltip(match?: Match | null): string {
        if (!match) return '';

        const round = (match.roundName ?? '').trim();
        if (!round || round.toLowerCase() === 'unknown') {
            return this.isQualificationMatch(match) ? 'QUALIFYING · UNKNOWN ROUND' : '';
        }

        const displayRound = round.toUpperCase();

        return this.isQualificationMatch(match)
            ? `QUALIFYING · ${displayRound}`
            : displayRound;
    }

    private pad2(n: number): string { return String(n).padStart(2, '0'); }

    private toISOFromDateLocal(d: Date): string {
        // Convert a local date to YYYY-MM-DD.
        const y = d.getFullYear();
        const m = this.pad2(d.getMonth() + 1);
        const day = this.pad2(d.getDate());
        return `${y}-${m}-${day}`;
    }

    private toDMYFromISO(iso: string): string {
        return this.regional.dateInput(iso);
    }

    private parseDMYtoISO(dmy: string): string | null {
        return parseRegionalDate(dmy, this.regional.locale());
    }

    private isoToDateLocal(iso: string): Date | null {
        if (!iso || iso.length < 10) return null;
        const y = Number(iso.slice(0, 4));
        const m = Number(iso.slice(5, 7));
        const d = Number(iso.slice(8, 10));
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
        return new Date(y, m - 1, d);
    }

    private syncDateStringsFromCurrentDate(): void {
        this.currentDateISO = this.toISOFromDateLocal(this.currentDate);
        this.currentDateDMY = this.toDMYFromISO(this.currentDateISO);
    }

    /**
     * Resolve the recommended view against the archive watermark rather than the wall clock.
     * The latest archived day and the preceding calendar day form the live discovery window.
     */
    private resetScopedMatchFilters(): void {
        this.historicalAutoWithoutEdge = false;
        this.filterMode = 'custom';
        this.activeTournamentLevelIds = [1, 2, 3, 4];
        this.activeDateFilter = 'all';
        this.activeFromDate = null;
        this.activeToDate = null;
        this.activeSurfaceIds = [1, 2, 3, 4, 5];
        this.activeTournamentTypeIds = [2, 4];
        this.activeStrengthStars = [0, 1, 2, 3, 4, 5];
        this.activeConfidence = 'all';
        this.activeStatus = 'all';
        this.activeOdds = 'all';
        this.valueFilter = 'all';
        this.searchTerm = '';
        this.isFiltered = false;
        this.filterApplied = false;
        this.filteredPage = 1;
    }

    private applyAutomaticFilterPreset(date: Date, rows?: Match[]): void {
        this.historicalAutoWithoutEdge = false;
        if (this.viewMode !== 'daily') {
            this.resetScopedMatchFilters();
            return;
        }
        if (this.filterMode !== 'auto') return;

        const latestIso = this.availableDates?.[this.availableDates.length - 1]
            || (this.maxDate ? this.toISOFromDateLocal(this.maxDate) : '');
        const latestDate = this.isoToDateLocal(latestIso);
        const selectedIso = this.toISOFromDateLocal(date);

        let isLiveWindow = false;
        if (latestDate) {
            const liveWindowStart = new Date(latestDate);
            liveWindowStart.setDate(liveWindowStart.getDate() - 1);
            isLiveWindow = selectedIso >= this.toISOFromDateLocal(liveWindowStart);
        }

        this.activeDateFilter = 'all';
        this.activeFromDate = null;
        this.activeToDate = null;
        this.activeSurfaceIds = [1, 2, 3, 4, 5];
        this.activeTournamentTypeIds = [2, 4];
        this.activeStrengthStars = [0, 1, 2, 3, 4, 5];
        this.activeConfidence = 'all';

        this.activeStatus = isLiveWindow ? 'all' : DEFAULT_MATCH_STATUS;
        this.activeOdds = isLiveWindow ? 'all' : DEFAULT_ODDS_FILTER;
        const completedMarkets = !isLiveWindow && rows
            ? rows.filter(match => this.isCanonicalFinishedMatch(match) && !!this.getDisplayMarketOdds(match))
            : [];
        this.historicalAutoWithoutEdge = completedMarkets.some(match => match.recoveryOddsCertifiedPrematch === false)
            && !completedMarkets.some(match => !!this.getVerifiedMarketOdds(match));
        this.valueFilter = isLiveWindow || this.historicalAutoWithoutEdge ? 'all' : DEFAULT_VALUE_FILTER;

        this.isFiltered = !isLiveWindow;
        this.filterApplied = this.isFiltered;
        this.filteredAvailableDates = [...(this.availableDates || [])];
    }

    commitDateInputDMY(): void {
        const iso = this.parseDMYtoISO(this.currentDateDMY);

        if (!iso) {
            this.syncDateStringsFromCurrentDate();
            if (this.dateInputRef?.nativeElement) this.dateInputRef.nativeElement.value = this.currentDateDMY;
            return;
        }

        const dt = this.isoToDateLocal(iso);
        if (!dt) return;

    // Clamp to the global archive range to reject unrealistic years.
        const corrected = this.correctDateIfOutOfBounds(dt);
        const correctedIso = this.toISOFromDateLocal(corrected);

        if (correctedIso === this.currentDateISO) {
            this.syncDateStringsFromCurrentDate();
            return;
        }

    // Apply the requested date after clamping.
        this.currentDate = corrected;
        this.syncDateStringsFromCurrentDate();
        this.applyAutomaticFilterPreset(corrected);

        if (this.dateInputRef?.nativeElement) this.dateInputRef.nativeElement.value = this.currentDateDMY;

        this.filteredPage = 1;

    // Daily archives exist only for days that contain matches. Keep manual date
    // navigation consistent with the arrows by resolving an empty calendar day
    // to the closest available archive day.
        if (this.availableDates?.length && !this.availableDates.includes(correctedIso)) {
            const nearestIso = this.findNearestAvailableDate(correctedIso);
            const nearestDate = nearestIso ? this.isoToDateLocal(nearestIso) : null;
            if (nearestDate) {
                this.loadMatchesForDate(nearestDate);
            }
            return;
        }

    // Otherwise load the selected day normally.
        this.loadMatchesForDate(corrected);
    }

    private findNearestAvailableDate(requestedIso: string): string | null {
        const dates = this.availableDates || [];
        if (!dates.length) return null;

        let low = 0;
        let high = dates.length;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (dates[middle] < requestedIso) low = middle + 1;
            else high = middle;
        }

        const next = low < dates.length ? dates[low] : null;
        const previous = low > 0 ? dates[low - 1] : null;
        if (!previous) return next;
        if (!next) return previous;

        const requestedTime = this.isoToDateLocal(requestedIso)?.getTime();
        const previousTime = this.isoToDateLocal(previous)?.getTime();
        const nextTime = this.isoToDateLocal(next)?.getTime();
        if (requestedTime == null || previousTime == null || nextTime == null) return next;

        return requestedTime - previousTime < nextTime - requestedTime ? previous : next;
    }
    onDateDMYInput(event: Event): void {
        const input = event.target as HTMLInputElement;

        const raw = input.value ?? '';
        const caret = input.selectionStart ?? raw.length;

        // Once separators exist, preserve segment boundaries while the user edits
        // in the middle of the date. An incomplete segment remains incomplete and
        // cannot be committed until all locale-specific date fields are complete.
        const separator = this.regional.dateSeparator();
        const segmented = raw.split(separator);
        if (segmented.length === 3) {
            const formatted = maskRegionalDateInput(raw, this.regional.locale());

            this.currentDateDMY = formatted;
            input.value = formatted;
            const nextCaret = Math.min(caret, formatted.length);
            requestAnimationFrame(() => input.setSelectionRange(nextCaret, nextCaret));
            this.commitDateInputWhenComplete();
            return;
        }

        // Count digits left of the caret before reformatting.
        const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length;

        const formatted = maskRegionalDateInput(raw, this.regional.locale());

        this.currentDateDMY = formatted;

        if (this.dateInputRef?.nativeElement) {
            const el = this.dateInputRef.nativeElement;
            el.value = formatted;

    // Restore the caret according to the number of digits on its left.
            let nextCaret = 0;
            let seenDigits = 0;

            while (nextCaret < formatted.length && seenDigits < digitsBeforeCaret) {
                if (/\d/.test(formatted[nextCaret])) {
                    seenDigits++;
                }
                nextCaret++;
            }

            requestAnimationFrame(() => {
                el.setSelectionRange(nextCaret, nextCaret);
            });
        }

        this.commitDateInputWhenComplete();
    }

    private commitDateInputWhenComplete(): void {
        const iso = this.parseDMYtoISO(this.currentDateDMY);
        if (!iso || iso === this.currentDateISO) return;

        queueMicrotask(() => {
            const currentIso = this.parseDMYtoISO(this.currentDateDMY);
            if (currentIso && currentIso !== this.currentDateISO) this.commitDateInputDMY();
        });
    }

    onDateDMYKeydown(event: KeyboardEvent): void {
        this.protectDateSeparators(event);
    }

    private protectDateSeparators(event: KeyboardEvent): void {
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;

        const input = event.target as HTMLInputElement;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? start;
        if (start !== end) return;

        const separatorIndex = event.key === 'Backspace' ? start - 1 : start;
        if (separatorIndex < 0 || input.value[separatorIndex] !== (this.regional.dateSeparator())) return;

        event.preventDefault();
        const nextCaret = event.key === 'Backspace' ? Math.max(0, start - 1) : Math.min(input.value.length, start + 1);
        input.setSelectionRange(nextCaret, nextCaret);
    }

    isDetailsOpen = false;

    private getMatchTPId(m: any): number | null {
        const id = m?._id ?? m?.matchTPId ?? m?.m001 ?? m?.matchId ?? null;
        return typeof id === 'number' ? id : (id != null ? Number(id) : null);
    }

    selectedMatchTPId: number | null = null;

    openDetails(m: any) {
        const id = this.getMatchTPId(m);
        console.log('openDetails', id, m);

        if (!id) {
            console.warn('Match has no TPId field:', m);
            return;
        }

        this.selectedMatch = m;
        this.selectedMatchTPId = id;
        this.isDetailsOpen = true;
    }

    onDetailsClosed(): void {
        console.log('[PARENT] details closed', this.pendingAfterDetailsClose);

        this.isDetailsOpen = false;
        this.selectedMatchTPId = null;
        this.selectedMatch = null;

        const action = this.pendingAfterDetailsClose;
        this.pendingAfterDetailsClose = null;

        if (!action) return;

        if (action === 'upgrade') {
            setTimeout(() => this.openBillingModal(), 0);
        }
    }

    // Bet simulation PL
    private parseDualNumbers(text?: string | null): [number | null, number | null] {
        if (!text) return [null, null];

    // Accept both en dash and hyphen separators.
        const parts = text.includes('–') ? text.split('–') : text.split('-');
        const l = (parts[0] || '').trim().replace(',', '.');
        const r = (parts[1] || '').trim().replace(',', '.');

        const ln = Number(l);
        const rn = Number(r);

        return [
            Number.isFinite(ln) ? ln : null,
            Number.isFinite(rn) ? rn : null
        ];
    }

    private parseOdds(match: any): [number | null, number | null] {
        if (match?.recoveryOddsCertifiedPrematch === false) return [null, null];
        const [o1, o2] = this.parseDualNumbers(match?.oddsText);
        // 0, null, negativno -> invalid
        const v1 = o1 && o1 > 1 ? o1 : null;
        const v2 = o2 && o2 > 1 ? o2 : null;
        return [v1, v2];
    }

    private parseProbs(match: any): [number | null, number | null] {
        const directP1 = Number(match?.modelProbabilityPlayer1);
        const directP2 = Number(match?.modelProbabilityPlayer2);
        const hasDirectPair =
            match?.modelProbabilityPlayer1 != null &&
            match?.modelProbabilityPlayer2 != null &&
            Number.isFinite(directP1) && directP1 >= 0 && directP1 <= 100 &&
            Number.isFinite(directP2) && directP2 >= 0 && directP2 <= 100;

        const [p1, p2] = hasDirectPair
            ? [directP1, directP2]
            : this.parseDualNumbers(match?.probabilityText);

    // Model probabilities are expected in the 0..100 display range.
        const v1 = p1 != null && p1 >= 0 && p1 <= 100 ? p1 : null;
        const v2 = p2 != null && p2 >= 0 && p2 <= 100 ? p2 : null;
        return [v1, v2];
    }

    getPrediction(match: Match): MatchPrediction | null {
        const language = this.regional.language();
        const cached = this.predictionPresentationCache.get(match);
        if (cached?.language === language && MatchesComponent.predictionFields.every((key,index) =>
            Object.is(cached.inputs[index],match[key]))) return cached.value;
        const value = this.createPredictionPresentation(match);
        this.predictionPresentationCache.set(match,{language,
            inputs:MatchesComponent.predictionFields.map(key=>match[key]),value});
        return value;
    }

    private createPredictionPresentation(match: Match): MatchPrediction | null {
        if (this.hasResultQualityHold(match) || match.predictionEligible === false ||
            (match.qualityStatus && match.predictionEligible !== true)) return null;
        const [p1, p2] = this.parseProbs(match);
        if (p1 == null || p2 == null) return null;

        const side: 'p1' | 'p2' = p1 >= p2 ? 'p1' : 'p2';
        const confidence = side === 'p1' ? p1 : p2;
        const playerName =
            (side === 'p1' ? match.player1Name : match.player2Name)?.trim() ||
            this.regional.text(side === 'p1' ? 'matchGrid.player1' : 'matchGrid.player2');

        if (confidence >= 80) {
            return { side, playerName, confidence, label: this.regional.text('matchGrid.veryHigh'), tone: 'very-high' };
        }

        if (confidence >= 70) {
            return { side, playerName, confidence, label: this.regional.text('matchGrid.high'), tone: 'high' };
        }

        if (confidence >= 60) {
            return { side, playerName, confidence, label: this.regional.text('matchGrid.clearLean'), tone: 'clear' };
        }

        return { side, playerName, confidence, label: this.regional.text('matchGrid.lean'), tone: 'lean' };
    }

    /** Pure display values only. Account access, favourites and comments stay live. */
    rowPresentation(match: Match): MatchRowPresentation {
        const context = `${this.regional.language()}|${this.regional.timeZone()}|${this.plBasis}|${new Date().toDateString()}`;
        const record = match as unknown as Record<string,unknown>;
        const cached = this.rowPresentationCache.get(match);
        if (cached?.context === context && cached.keys.length === Object.keys(record).length &&
            cached.keys.every(key => Object.prototype.hasOwnProperty.call(record,key) && Object.is(cached.snapshot[key], record[key]))) return cached.view;

        const odds = this.getDisplayMarketOdds(match);
        const strength = this.getStrengthStars(match);
        const market = this.getPredictionMarketContext(match);
        const view:MatchRowPresentation = {
            date:this.getLocalizedDateMaybeTime(match.dateTime,match.sourceTimePrecision),
            dateTitle:this.matchTimeTitle(match), tournament:this.formatTournamentGridLabel(match), strength,
            strengthTitle:this.regional.text('matchGrid.strengthStars',{value:this.regional.number(strength,1)}),
            surface:this.formatSurface(match.surface), surfaceClass:this.surfaceIndicatorClass(match.surface),
            surfaceLabel:this.localizedSurface(match.surface), round:this.formatMatchRoundShort(match),
            roundTitle:this.getMatchRoundTooltip(match),
            player1:this.formatPlayerLabel(this.decodeHtmlEntities(match.player1Label||match.player1Name||''),match.player1CountryISO3,match.player1Seed,match.player1Rank),
            player2:this.formatPlayerLabel(this.decodeHtmlEntities(match.player2Label||match.player2Name||''),match.player2CountryISO3,match.player2Seed,match.player2Rank),
            player1Compact:this.formatPlayerCompactLabel(match.player1Name||match.player1Label||''),
            player2Compact:this.formatPlayerCompactLabel(match.player2Name||match.player2Label||''),
            player1Flag:this.flagCode(match.player1CountryISO2).toLowerCase(),
            player2Flag:this.flagCode(match.player2CountryISO2).toLowerCase(),
            result:this.getDisplayResult(match), sets:this.formatResultDetails(match.resultDetails),
            qualityHold:this.hasResultQualityHold(match), qualityTitle:this.getResultQualityTooltip(match),
            oddsTitle:this.getMarketOddsTooltip(match),
            odds:odds?{verified:odds.verified,player1:this.getDecimalOddsParts(odds.player1),player2:this.getDecimalOddsParts(odds.player2)}:null,
            prediction:this.getPrediction(match), predictionClass:this.getPredictionClass(match),
            predictionTitle:this.getPredictionTooltip(match), outcome:this.getPredictionOutcomeLabel(match),
            market, marketDecimal:market?this.formatDecimalOdds(market.decimalOdds):'', marketLabel:this.getMarketOddsLabel(match),
            pl:this.formatPL(match), plClass:this.getPLClass(match), plTitle:this.getPLTooltip(match), historicalPl:this.isHistoricalPL(match),
        };
        this.rowPresentationCache.set(match,{context,keys:Object.keys(record),snapshot:{...record},view});
        return view;
    }

    getPredictionCount(): number {
        return this.filteredMatches.reduce(
            (count, match) => count + (this.getPrediction(match) ? 1 : 0),
            0
        );
    }

    getConfidenceCount(minimum: number): number {
        return this.filteredMatches.reduce((count, match) => {
            const prediction = this.getPrediction(match);
            return count + (prediction && prediction.confidence >= minimum ? 1 : 0);
        }, 0);
    }

    getPredictionCoverage(): number {
        if (this.filteredMatches.length === 0) return 0;
        return Math.round((this.getPredictionCount() / this.filteredMatches.length) * 100);
    }

    isPredictedSide(match: Match, side: 'p1' | 'p2'): boolean {
        return this.getPrediction(match)?.side === side;
    }

    getPredictionClass(match: Match): string {
        const prediction = this.getPrediction(match);
        if (!prediction) return 'prediction-cell--empty';

        const outcome = this.getPredictionOutcome(match);
        const status = this.getMatchOutcomeStatus(match);
        return [
            `prediction-cell--${prediction.tone}`,
            outcome
                ? `prediction-cell--${outcome}`
                : status !== 'completed'
                    ? `prediction-cell--${status}`
                    : '',
        ].filter(Boolean).join(' ');
    }

    getPredictionOutcomeLabel(match: Match): string {
        if (!this.getPrediction(match)) return '';
        const outcome = this.getPredictionOutcome(match);
        if (outcome) return this.regional.text(outcome === 'correct' ? 'matchGrid.correct' : 'matchGrid.miss');
        const status = this.getMatchOutcomeStatus(match);
        const key = status === 'incomplete' ? 'matchGrid.incomplete'
            : status === 'not-played' ? 'matchGrid.notPlayed'
            : status === 'pending' ? 'matchGrid.pending' : null;
        return key ? this.regional.text(key) : '';
    }

    getPredictionTooltip(match: Match): string {
        if (this.hasResultQualityHold(match)) return this.getResultQualityTooltip(match);
        const prediction = this.getPrediction(match);
        if (!prediction) return this.regional.text('matchGrid.predictionUnavailable');

        const outcome = this.getPredictionOutcome(match);
        const status = this.getMatchOutcomeStatus(match);
        const outcomeKey = outcome === 'correct'
            ? 'outcomeCorrect'
            : outcome === 'incorrect'
                ? 'outcomeIncorrect'
                : status === 'incomplete'
                    ? 'outcomeIncomplete'
                    : status === 'not-played'
                        ? 'outcomeNotPlayed'
                        : 'outcomePending';
        const market = this.getPredictionMarketContext(match);
        const marketText = market
            ? this.regional.text('matchGrid.marketBenchmark', {
                side: market.side.toUpperCase(),
                probability: this.regional.number(market.fairProbability, 2),
                odds: this.formatDecimalOdds(market.decimalOdds),
                gap: market.gapLabel
            })
            : this.regional.text('matchGrid.benchmarkUnavailable');

        return [
            this.regional.text('matchGrid.modelEstimate', {
                player: prediction.playerName, probability: this.regional.number(prediction.confidence, 2)
            }),
            this.regional.text('matchGrid.' + outcomeKey),
            marketText,
            this.regional.text('matchGrid.probabilityNote')
        ].join(' ');
    }

    getPredictionMarketContext(match: Match): PredictionMarketContext | null {
        const prediction = this.getPrediction(match);
        const [odds1, odds2] = this.parseOdds(match);
        if (!prediction || !odds1 || !odds2) return null;

        const [fair1, fair2] = this.getFairMarketProbabilities(odds1, odds2);
        const fairProbability = 100 * (prediction.side === 'p1' ? fair1 : fair2);
        const decimalOdds = prediction.side === 'p1' ? odds1 : odds2;
        const rawGapPoints = prediction.confidence - fairProbability;
        const gapPoints = Math.abs(rawGapPoints) < 0.05 ? 0 : rawGapPoints;
        const sign = gapPoints > 0 ? '+' : '';

        return {
            side: prediction.side,
            fairProbability,
            decimalOdds,
            gapPoints,
            gapLabel: this.regional.text('matchGrid.gap', { value: sign + this.regional.number(gapPoints, 1) })
        };
    }

    getMarketOddsLabel(match: Match): string | null {
        const [odds1, odds2] = this.parseOdds(match);
        if (!odds1 || !odds2) return null;

        return `P1 ${this.formatDecimalOdds(odds1)} · P2 ${this.formatDecimalOdds(odds2)}`;
    }

    // Decimal odds use the active UI locale; fractional/American formats are a separate preference.
    formatDecimalOdds(value?: number | null): string {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 1
            ? this.regional.number(numeric, 2)
            : '';
    }

    getDecimalOddsParts(value?: number | null): { integer: string; fraction: string } | null {
        const formatted = this.formatDecimalOdds(value);
        if (!formatted) return null;

        const [integer, fraction] = formatted.split(this.regional.decimalSeparator());
        return { integer, fraction };
    }

    getVerifiedMarketOdds(match: Match): { player1: number; player2: number } | null {
        if (!match.marketOddsVerified) return null;

        const player1 = Number(match.player1Odds);
        const player2 = Number(match.player2Odds);
        if (!Number.isFinite(player1) || player1 <= 1 ||
            !Number.isFinite(player2) || player2 <= 1) {
            return null;
        }

        return { player1, player2 };
    }

    getDisplayMarketOdds(match: Match): { player1: number; player2: number; verified: boolean } | null {
        const verified = this.getVerifiedMarketOdds(match);
        if (verified) return { ...verified, verified: true };

        const player1 = Number(match.legacyPlayer1Odds ?? (!match.marketOddsVerified ? match.player1Odds : null));
        const player2 = Number(match.legacyPlayer2Odds ?? (!match.marketOddsVerified ? match.player2Odds : null));
        if (!Number.isFinite(player1) || player1 <= 1 ||
            !Number.isFinite(player2) || player2 <= 1) {
            return null;
        }

        return { player1, player2, verified: false };
    }

    getMarketOddsTooltip(match: Match): string {
        const pairText = (player1: number, player2: number): string => this.regional.text('matchGrid.oddsPair', {
            p1: this.formatDecimalOdds(player1), p2: this.formatDecimalOdds(player2)
        });
        if ((match as Match & { recoveryOddsCertifiedPrematch?: boolean }).recoveryOddsCertifiedPrematch === false) {
            const historical = this.getDisplayMarketOdds(match);
            return [
                this.regional.text('matchGrid.recoveredHistoricalOdds'),
                ...(historical ? [pairText(historical.player1, historical.player2)] : [])
            ].join('\n');
        }
        const median = this.getVerifiedMarketOdds(match);
        if (!median) {
            const legacy = this.getDisplayMarketOdds(match);
            return legacy
                ? [
                    this.regional.text('matchGrid.legacyOdds'),
                    pairText(legacy.player1, legacy.player2),
                    this.regional.text('matchGrid.legacyOddsNote')
                ].join('\n')
                : this.regional.text('matchGrid.archiveOddsUnavailable');
        }

        const format = (value?: number | null): string => {
            const numeric = Number(value);
            return Number.isFinite(numeric) && numeric > 1 ? this.formatDecimalOdds(numeric) : this.regional.text('matchGrid.na');
        };
        const count = match.marketBookieCount ?? 0;
        if (count <= 0) {
            return [
                this.regional.text('matchGrid.medianConsensus'),
                pairText(median.player1, median.player2),
                this.regional.text('matchGrid.medianArchiveNote')
            ].join('\n');
        }

        return [
            this.regional.text('matchGrid.bookmakerConsensus'),
            this.regional.text('matchGrid.oddsStats', {
                player: this.regional.text('matchGrid.player1'), median: this.formatDecimalOdds(median.player1),
                max: format(match.player1MaxOdds), fair: format(match.player1FairOdds)
            }),
            this.regional.text('matchGrid.oddsStats', {
                player: this.regional.text('matchGrid.player2'), median: this.formatDecimalOdds(median.player2),
                max: format(match.player2MaxOdds), fair: format(match.player2FairOdds)
            }),
            this.regional.text('matchGrid.bookmakerPairs', { count: this.regional.number(count, 0, true) }),
            this.regional.text('matchGrid.fairOddsNote')
        ].join('\n');
    }

    getPredictionOutcome(match: Match): 'correct' | 'incorrect' | null {
        if (!this.isCanonicalFinishedMatch(match)) return null;

        // TennisPrediction stores the winner on the left for every canonical
        // finished result, so Player 1 is the only valid historical winner.
        const prediction = this.getPrediction(match);
        if (!prediction) return null;

        return prediction.side === 'p1'
            ? 'correct'
            : 'incorrect';
    }

    getMatchOutcomeStatus(match: Match): Exclude<MatchStatus, 'all'> {
        // Lifecycle is independent of score trust: do not relabel a held completed match as unplayed.
        if (this.hasResultQualityHold(match) && this.isFinishedValue(match.isFinished)) return 'completed';
        if (this.isCanonicalFinishedMatch(match)) return 'completed';

        const finishedValue = (match as any)?.isFinished ?? (match as any)?.l03;
        if (this.hasRecordedResultData(match) || this.isFinishedValue(finishedValue)) {
            return 'incomplete';
        }

        return this.isHistoricalMatchDay(match) ? 'not-played' : 'pending';
    }

    private isCanonicalFinishedMatch(match: Match): boolean {
        if (this.hasResultQualityHold(match) || match.calculationEligible === false) return false;
        const finishedValue = (match as any)?.isFinished ?? (match as any)?.l03;
        if (!this.isFinishedValue(finishedValue)) return false;

        const rawResult = String(match.result ?? match.resultText ?? '')
            .replace(/[^0-9]/g, '');
        return rawResult === '20' ||
            rawResult === '21' ||
            rawResult === '30' ||
            rawResult === '31' ||
            rawResult === '32';
    }

    private hasRecordedResultData(match: Match): boolean {
        return [
            match?.result,
            match?.resultText,
            match?.resultDetails,
            match?.resultDetailsText,
        ].some(value => value != null && String(value).trim().length > 0);
    }

    private isFinishedValue(value: unknown): boolean {
        return value === true || value === 1 || value === '1' || value === 'true';
    }

    private isHistoricalMatchDay(match: Match): boolean {
        const raw = match?.dateTime;
        if (!raw) return false;

        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return false;

        return this.toISOFromDateLocal(parsed) < this.toISOFromDateLocal(new Date());
    }

    private getWinnerSide(match: Match): 'p1' | 'p2' | null {
        if (this.hasResultQualityHold(match) || match.calculationEligible === false) return null;
      // Use the normalized display result already populated from match details.
        const res = this.getDisplayResult(match); // npr "2:1" ili "RET"
        const m = (res || '').match(/^(\d{1,2}):(\d{1,2})$/);
        if (!m) return null;

        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        if (a === b) return null;
        return a > b ? 'p1' : 'p2';
    }

    private getBetSide(match: Match): { side: 'p1' | 'p2' | null, edge1?: number, edge2?: number } {
        if (this.hasResultQualityHold(match) || match.predictionEligible === false ||
            (match.qualityStatus && match.predictionEligible !== true)) return { side: null };
        const [odds1, odds2] = this.parseOdds(match);
        const [p1, p2] = this.parseProbs(match);

        if (!odds1 || !odds2 || p1 == null || p2 == null) return { side: null };

        const [imp1, imp2] = this.getFairMarketProbabilities(odds1, odds2);

        const m1 = p1 / 100;
        const m2 = p2 / 100;

        const edge1 = m1 - imp1;
        const edge2 = m2 - imp2;

        // At least one side must satisfy edge >= MIN_EDGE.
        const ok1 = edge1 >= this.MIN_EDGE;
        const ok2 = edge2 >= this.MIN_EDGE;

        if (!ok1 && !ok2) return { side: null, edge1, edge2 };

    // Select the stronger edge when both sides qualify.
        if (ok1 && ok2) return { side: edge1 >= edge2 ? 'p1' : 'p2', edge1, edge2 };
        return { side: ok1 ? 'p1' : 'p2', edge1, edge2 };
    }

    getMarketEdge(match: Match): { side: 'p1' | 'p2', label: string } | null {
        const edge = this.getBetSide(match);
        if (!edge.side) return null;

        const value = edge.side === 'p1' ? edge.edge1 : edge.edge2;
        if (value == null || !Number.isFinite(value)) return null;

        return {
            side: edge.side,
            label: `${edge.side.toUpperCase()} +${this.regional.number(value * 100, 1)}%`
        };
    }

    private getPlOdds(odds: { player1: number; player2: number }, side: 'p1' | 'p2'): number {
        if (this.plBasis === 'median') return side === 'p1' ? odds.player1 : odds.player2;
        const probabilities = this.getFairMarketProbabilities(odds.player1, odds.player2);
        return 1 / probabilities[side === 'p1' ? 0 : 1];
    }

    private getPlMarketOdds(match: Match): { player1: number; player2: number } | null {
        const verified = this.getVerifiedMarketOdds(match);
        if (verified) return verified;
        // Explicit recovery provenance means match/player identity has been checked.
        // Keep these descriptive prices out of pre-match comparisons; only the
        // clearly labelled historical P/L benchmark may use them without timestamps.
        return match.recoveryOddsCertifiedPrematch === false ? this.getDisplayMarketOdds(match) : null;
    }

    isHistoricalPL(match: Match): boolean {
        return match.recoveryOddsCertifiedPrematch === false && this.computePL(match) != null;
    }

    get showHistoricalPlNote(): boolean {
        return !this.loading && this.filteredMatches.some(match => this.isHistoricalPL(match));
    }

    private computePL(match: Match): number | null {
        const prediction = this.getPrediction(match);
        const outcome = this.getPredictionOutcome(match);
        const odds = this.getPlMarketOdds(match);
        if (!prediction || !outcome || !odds) return null;

        const selectedOdds = this.getPlOdds(odds, prediction.side);
        return outcome === 'correct' ? selectedOdds - 1 : -1;
    }

    formatPL(match: Match): string {
        const pl = this.computePL(match);
        if (pl == null) return '—';

        const sign = pl > 0 ? '+' : '';
        return `${sign}${this.regional.number(pl, 2)}u`;
    }

    getPLClass(match: Match): string {
        const pl = this.computePL(match);
        if (pl == null) return 'pl-empty';
        if (pl > 0) return 'pl-positive';
        if (pl < 0) return 'pl-negative';
        return 'pl-zero';
    }

    getPLTooltip(match: Match): string {
        if (this.hasResultQualityHold(match)) return this.getResultQualityTooltip(match);
        const prediction = this.getPrediction(match);
        const outcome = this.getPredictionOutcome(match);
        const odds = this.getPlMarketOdds(match);
        const pl = this.computePL(match);
        if (!prediction) return this.regional.text('matchGrid.plNoPrediction');
        if (!outcome) return this.regional.text('matchGrid.plNotCompleted');
        if (!odds) return this.regional.text('matchGrid.plNoOdds');

        const selectedOdds = this.getPlOdds(odds, prediction.side);
        return [
            this.regional.text('matchGrid.plBenchmark', { label: this.plLabel }),
            ...(this.isHistoricalPL(match) ? [this.regional.text('matchGrid.plHistoricalNote')] : []),
            this.regional.text('matchGrid.plPrediction', { player: prediction.playerName, side: prediction.side.toUpperCase() }),
            this.regional.text(this.plBasis === 'fair' ? 'matchGrid.plFairOdds' : 'matchGrid.plMedianOdds', { odds: this.formatDecimalOdds(selectedOdds) }),
            this.regional.text(this.plBasis === 'fair' ? 'matchGrid.plFairNote' : 'matchGrid.plMedianNote'),
            this.regional.text('matchGrid.plOutcome', { outcome: this.regional.text(outcome === 'correct' ? 'matchGrid.correct' : 'matchGrid.miss') }),
            this.regional.text('matchGrid.plResult', { value: pl == null ? '—' : this.formatSignedUnits(pl) }),
            this.regional.text('matchGrid.snapshotNote')
        ].join('\n');
    }

    getModelPlSummary(matches: readonly Match[]): ModelPlSummary {
        let units = 0;
        let eligibleCount = 0;

        for (const match of matches) {
            const pl = this.computePL(match);
            if (pl == null) continue;
            units += pl;
            eligibleCount++;
        }

        return {
            units,
            roiPercent: eligibleCount > 0 ? (units / eligibleCount) * 100 : 0,
            eligibleCount,
            totalCount: matches.length,
        };
    }

    hasResultQualityHold(match: Match): boolean {
        const status = match.qualityStatus;
        // Old archives have no quality contract; retain compatibility until republished.
        // An explicit new/unknown quality state, however, must never silently authorize grading.
        return !!status && !['Validated', 'Incomplete', 'NonRatedOutcome'].includes(status);
    }

    getResultQualityTooltip(match: Match): string {
        return this.regional.text('matchGrid.qualityNote') +
            (match.qualityReason ? ' ' + this.regional.text('matchGrid.qualityReason', { reason: match.qualityReason }) : '');
    }

    formatSignedUnits(value: number): string {
        const stable = Math.abs(value) < 0.005 ? 0 : value;
        return `${stable > 0 ? '+' : ''}${this.regional.number(stable, 2)}u`;
    }

    formatSignedPercent(value: number): string {
        const stable = Math.abs(value) < 0.05 ? 0 : value;
        return `${stable > 0 ? '+' : ''}${this.regional.number(stable, 1)}%`;
    }

    getPlTone(value: number): 'pl-positive' | 'pl-negative' | 'pl-zero' {
        if (value > 0.005) return 'pl-positive';
        if (value < -0.005) return 'pl-negative';
        return 'pl-zero';
    }

    getGroupPlTooltip(group: TournamentMatchGroup): string {
        const summary = group.modelPl;
        return [
            this.regional.text('matchGrid.groupBenchmark', { label: this.plLabel }),
            ...(group.matches?.some(match => this.isHistoricalPL(match)) ? [this.regional.text('matchGrid.plHistoricalNote')] : []),
            this.regional.text(this.plBasis === 'fair' ? 'matchGrid.groupFairNote' : 'matchGrid.groupMedianNote'),
            this.regional.text('matchGrid.groupStake'),
            `P/L: ${this.formatSignedUnits(summary.units)}`,
            `ROI: ${this.formatSignedPercent(summary.roiPercent)}`,
            this.regional.text('matchGrid.groupCoverage', {
                eligible: this.regional.number(summary.eligibleCount, 0, true),
                total: this.regional.number(summary.totalCount, 0, true)
            }),
            this.regional.text('matchGrid.groupEligibility'),
            this.regional.text('matchGrid.snapshotNote')
        ].join('\n');
    }

    private getFairMarketProbabilities(odds1: number, odds2: number): [number, number] {
        const raw1 = 1 / odds1;
        const raw2 = 1 / odds2;
        const overround = raw1 + raw2;

        return [raw1 / overround, raw2 / overround];
    }

    private getStrengthKey(match: any): number {
        const ts = Number(match?.tournamentStrengthMeanTS);
        // Sort null and NaN values last.
        return Number.isFinite(ts) ? ts : -Infinity;
    }

    private strengthBucket(match: any): number {
        const stars = this.getStrengthStars(match); // 0..5 u koracima 0.5
        return Math.round(stars); // bucket 0..5
    }

    private hasOdds(m: any): boolean {
        // Match the visible Odds column: a complete pair is required.
        if (this.getDisplayMarketOdds(m as Match)) return true;

        const litePlayer1 = Number(m?.l29);
        const litePlayer2 = Number(m?.l30);
        if (Number.isFinite(litePlayer1) && litePlayer1 > 1 &&
            Number.isFinite(litePlayer2) && litePlayer2 > 1) return true;

        // Support textual odds such as "1.35 - 2.82".
        const t = (m?.oddsText ?? '').toString().trim();
        if (!t) return false;

    // Treat the row as having odds when at least one numeric value exists.
        return /\d/.test(t);
    }

    onSearchInput(): void {
        this.filterUndo?.cancel(this);
        this.cancelBrowseRestore?.();
        this.search$.next(this.searchTerm ?? '');
    }

    clearSearch(): void {
        this.filterUndo?.cancel(this);
        this.cancelBrowseRestore?.();
        this.searchTerm = '';
        this.search$.next('');
    }

    setDailyDisplayMode(mode: 'all' | 'tournament'): void {
        this.filterUndo?.cancel(this);
        this.cancelBrowseRestore?.();
        this.dailyDisplayMode = mode;
        this.deferScrollToTop();
    }

    get quickTourFilter(): 'all' | 'atp' | 'wta' {
        const selected = new Set((this.activeTournamentTypeIds || []).map(Number));
        if (selected.size === 1 && selected.has(2)) return 'atp';
        if (selected.size === 1 && selected.has(4)) return 'wta';
        return 'all';
    }

    setQuickTourFilter(mode: 'all' | 'atp' | 'wta'): void {
        const tournamentTypeIds = mode === 'atp' ? [2] : mode === 'wta' ? [4] : [2, 4];

        this.onFilterApplied({
            startDate: this.activeFromDate,
            endDate: this.activeToDate,
            option: this.activeDateFilter,
            surfaceIds: [...this.activeSurfaceIds],
            tournamentTypeIds,
            strengthStars: [...this.activeStrengthStars],
            status: this.activeStatus,
            odds: this.activeOdds,
            valueFilter: this.valueFilter,
            confidence: this.activeConfidence
        });
    }

    setQuickOddsFilter(odds: 'all' | 'with' | 'without'): void {
        this.onFilterApplied({
            startDate: this.activeFromDate,
            endDate: this.activeToDate,
            option: this.activeDateFilter,
            surfaceIds: [...this.activeSurfaceIds],
            tournamentTypeIds: [...this.activeTournamentTypeIds],
            strengthStars: [...this.activeStrengthStars],
            status: this.activeStatus,
            odds,
            valueFilter: this.valueFilter,
            confidence: this.activeConfidence
        });
    }

    setQuickValueFilter(valueFilter: 'all' | 'valueOnly'): void {
        this.onFilterApplied({
            startDate: this.activeFromDate,
            endDate: this.activeToDate,
            option: this.activeDateFilter,
            surfaceIds: [...this.activeSurfaceIds],
            tournamentTypeIds: [...this.activeTournamentTypeIds],
            strengthStars: [...this.activeStrengthStars],
            status: this.activeStatus,
            odds: this.activeOdds,
            valueFilter,
            confidence: this.activeConfidence
        });
    }

    setQuickFinishedFilter(finalResultsOnly: boolean): void {
        this.onFilterApplied({
            startDate: this.activeFromDate,
            endDate: this.activeToDate,
            option: this.activeDateFilter,
            surfaceIds: [...this.activeSurfaceIds],
            tournamentTypeIds: [...this.activeTournamentTypeIds],
            strengthStars: [...this.activeStrengthStars],
            status: finalResultsOnly ? 'completed' : 'all',
            odds: this.activeOdds,
            valueFilter: this.valueFilter,
            confidence: this.activeConfidence
        });
    }

    get tournamentMatchGroups(): TournamentMatchGroup[] {
        const cached = this.groupedPresentationCache;
        const language = this.regional.language();
        if (cached?.rows === this.filteredMatches && cached.count === this.filteredMatches.length &&
            cached.language === language && cached.basis === this.plBasis &&
            cached.sortField === this.sortField && cached.sortDirection === this.sortDirection) return cached.groups;
        const groups = new Map<string, TournamentMatchGroup>();

        for (const match of this.filteredMatches) {
            const tournamentEventTPId = Number(match.tournamentEventTPId) || 0;
            const fallbackLabel = this.formatTournamentBaseLabel(match) || 'Unknown tournament';
            const key = tournamentEventTPId > 0
                ? `id:${tournamentEventTPId}`
                : `label:${fallbackLabel.toLocaleLowerCase()}`;
            let group = groups.get(key);

            if (!group) {
                group = {
                    key,
                    tournamentEventTPId,
                    label: fallbackLabel,
                    countryISO2: match.tournamentEventCountryISO2 || '',
                    countryFull: match.tournamentEventCountryFull || 'World',
                    tournamentType: match.tournamentTypeName || '',
                    surface: this.surfaceIndicatorLabel(match.surface),
                    strengthStars: this.getStrengthStars(match),
                    matches: [],
                    modelPl: { units: 0, roiPercent: 0, eligibleCount: 0, totalCount: 0 }
                };
                groups.set(key, group);
            }

            group.matches.push(match);
        }

        for (const group of groups.values()) {
            group.modelPl = this.getModelPlSummary(group.matches);
        }

        const result = [...groups.values()].sort((left, right) =>
            left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
        this.groupedPresentationCache = { rows:this.filteredMatches, count:this.filteredMatches.length,
            language, basis:this.plBasis, sortField:this.sortField, sortDirection:this.sortDirection, groups:result };
        return result;
    }

    trackTournamentGroup(_index: number, group: TournamentMatchGroup): string {
        return group.key;
    }

    get groupedMatchupWidthPx(): number {
        return this.getColumnPresentation().matchup;
    }

    get groupedResultWidthPx(): number {
        return this.getColumnPresentation().result;
    }

    private getColumnPresentation(): { matchup:number; result:number } {
        const language = this.regional.language();
        const cached = this.columnPresentationCache;
        if (cached?.rows === this.filteredMatches && cached.count === this.filteredMatches.length &&
            cached.language === language) return cached;
        let widest = 0, widestResult = 0;

        for (const match of this.filteredMatches) {
            const player1 = this.formatPlayerLabel(
                this.decodeHtmlEntities(match.player1Label || match.player1Name || ''),
                match.player1CountryISO3,
                match.player1Seed,
                match.player1Rank);
            const player2 = this.formatPlayerLabel(
                this.decodeHtmlEntities(match.player2Label || match.player2Name || ''),
                match.player2CountryISO3,
                match.player2Seed,
                match.player2Rank);

            widest = Math.max(
                widest,
                this.estimateGridTextWidth(player1),
                this.estimateGridTextWidth(player2));
            widestResult = Math.max(
                widestResult,
                this.estimateGridTextWidth(this.getDisplayResult(match)),
                this.estimateGridTextWidth(this.formatResultDetails(match.resultDetails)));
        }
        this.columnPresentationCache = { rows:this.filteredMatches, count:this.filteredMatches.length, language,
            matchup:Math.min(430,Math.max(210,Math.ceil(widest+34))),
            result:Math.min(170,Math.max(62,Math.ceil(widestResult+18))) };
        return this.columnPresentationCache;
    }

    private estimateGridTextWidth(value: string): number {
        let width = 0;

        for (const character of value || '') {
            if (character === ' ') width += 3.5;
            else if (/[MW@]/.test(character)) width += 9;
            else if (/[A-Z0-9]/.test(character)) width += 7.2;
            else if (/[ilI.,'()\[\]]/.test(character)) width += 4;
            else width += 6.4;
        }

        return width;
    }

    private filterMatchesBySearchTerm(rows: Match[]): Match[] {
        const q = this.norm(this.searchTerm);
        if (!q) return rows;

        return rows.filter(m => {
            const p1 = this.norm(m.player1Name);
            const p2 = this.norm(m.player2Name);

    // Prefer the normalized tournament name and fall back to eventName.
            const t = this.norm(m.tournamentCleanName ?? m.tournamentEventName);

            return p1.includes(q) || p2.includes(q) || t.includes(q);
        });
    }

    private norm(v: unknown): string {
        return String(v ?? '')
            .toLowerCase()
            .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritics for stable search.
            .replace(/\s+/g, ' ')
            .trim();
    }

    private hasValueBet(match: Match): boolean {
        return this.getBetSide(match).side != null;
    }

    isDetailsLocked(m: Match): boolean {
        if (!m) return true;

        return evaluateClientDetailsAccess({
            isFinished: (m as any)?.isFinished ?? (m as any)?.l03,
            user: this.auth.getUser(),
            scheduledStart: m.dateTime,
        }).locked;
    }

    get tournamentHeaderStrengthStars(): number {
        return this.tournamentHeaderStrengthValue == null
            ? 0
            : this.getTSStars(this.tournamentHeaderStrengthValue);
    }

    flagIso2OrEmpty(iso2?: string | null): string {
        return (iso2 || '').trim().toLowerCase();
    }

    get tournamentHeaderSurfaceSafe(): string {
        const v = (this.tournamentHeaderSurface || '').trim();
        if (!v) return '';

        const lower = v.toLowerCase();
        if (lower === 'unknown') return '';

        return v;
    }

    get tournamentHeaderDisplayName(): string {
        const name = (this.tournamentHeaderName || '').trim();
        const countryFull = (this.tournamentHeaderCountryFull || '').trim();
        const iso3 = (this.tournamentHeaderCountryISO3 || '').trim().toUpperCase();
      
        const baseName = name || countryFull || iso3 || '';
        const base = iso3 && baseName !== iso3 ? `${baseName} (${iso3})` : baseName;
      
        return this.appendQualificationSuffix(base, this.tournamentHeaderLevel);
      }

    private getTournamentRoundSortRank(roundName?: string | null): number {
        const s = (roundName || '').trim().toLowerCase();
        if (!s || s === 'unknown') return 0;

        if (s === 'finals' || s === 'final') return 100;
        if (s === 'third place' || s === 'third-place' || s === '3rd place') return 95;
        if (s === 'semi finals' || s === 'semifinals' || s === 'semi-final') return 90;
        if (s === 'quarter finals' || s === 'quarterfinals' || s === 'quarter-final') return 80;

        const leagueRound = s.match(/^league\s+round\s+(\d+)$/);
        if (leagueRound) {
            const n = Number(leagueRound[1]);
            if (Number.isFinite(n)) return 10 + n;
        }

        const roundOf = s.match(/^round\s+of\s+(\d+)$/);
        if (roundOf) {
            const n = Number(roundOf[1]);
            if (Number.isFinite(n)) return 70 + Math.min(n, 32) / 100;
        }

        const nthRound = s.match(/^(\d+)(st|nd|rd|th)\s+round$/);
        if (nthRound) {
            const n = Number(nthRound[1]);
            if (Number.isFinite(n)) return 10 + n;
        }

        if (s === 'qualifications' || s === 'qualification' || s === 'qualifying') return 1;

        return 0;
    }

    private sortTournamentMatches(rows: any[]): any[] {
        return [...rows].sort((a: any, b: any) => {
          const roundA = this.getTournamentRoundSortRank(a?.roundName);
          const roundB = this.getTournamentRoundSortRank(b?.roundName);
      
          if (roundA !== roundB) return roundB - roundA;
      
          const ta = Date.parse(a?.dateTime ?? '') || 0;
          const tb = Date.parse(b?.dateTime ?? '') || 0;
      
          if (ta !== tb) return tb - ta;
      
          return (a?.__idx ?? 0) - (b?.__idx ?? 0);
        });
      }

      get playerHeaderDisplayName(): string {
        const name = (this.playerHeaderName || '').trim();
        const iso3 = (this.playerHeaderCountryISO3 || '').trim().toUpperCase();
      
        if (!name) return '';
        if (!iso3 || iso3 === '0') return name;
      
        return `${name} (${iso3})`;
      }

      private syncPlayerHeaderFromRows(rows: any[], playerTPId: number): void {
        const first = rows?.find(r =>
          Number(r?.player1TPId) === playerTPId || Number(r?.player2TPId) === playerTPId
        );
      
        if (!first) {
          this.playerHeaderName = '';
          this.playerHeaderCountryISO2 = '';
          this.playerHeaderCountryISO3 = '';
          this.playerHeaderCountryFull = '';
          this.playerHeaderType = '';
          return;
        }
      
        const isP1 = Number(first?.player1TPId) === playerTPId;
      
        this.playerHeaderName = isP1
          ? (first?.player1Name ?? '')
          : (first?.player2Name ?? '');
      
        this.playerHeaderCountryISO2 = isP1
          ? (first?.player1CountryISO2 ?? '')
          : (first?.player2CountryISO2 ?? '');
      
        this.playerHeaderCountryISO3 = isP1
          ? (first?.player1CountryISO3 ?? '')
          : (first?.player2CountryISO3 ?? '');
      
        this.playerHeaderCountryFull = isP1
          ? (first?.player1CountryFull ?? '')
          : (first?.player2CountryFull ?? '');
      
        this.playerHeaderType =
          (first?.tournamentTypeName ?? first?.type ?? '').trim();
      
        console.log('🎾 player header synced', {
          playerTPId,
          name: this.playerHeaderName,
          iso2: this.playerHeaderCountryISO2,
          iso3: this.playerHeaderCountryISO3,
          country: this.playerHeaderCountryFull,
          type: this.playerHeaderType,
          first
        });
      }

      get showTypeColumn(): boolean {
        return this.viewMode === 'favourites' || (this.viewMode === 'daily' && this.quickTourFilter === 'all');
      }
      
      get playerHeaderTypeSafe(): string {
        return (this.playerHeaderType || '').trim();
      }

      private isQualificationLevel(level?: string | null): boolean {
        const v = (level || '').trim().toLowerCase();
        if (!v) return false;
      
        return v === 'q'
          || v === 'qualifications'
          || v === 'qualification'
          || v === 'qualifying';
      }
      
      private appendQualificationSuffix(baseLabel: string, level?: string | null): string {
        const base = (baseLabel || '').trim();
        if (!base) return '';
      
        return this.isQualificationLevel(level) ? `${base} Q` : base;
      }
      
      private extractTournamentLevel(match: any): string {
        return (
          match?.tournamentLevelName ??
          match?.tournamentLevel ??
          match?.levelName ??
          match?.level ??
          match?.l09 ??
          ''
        );
      }

      private formatTournamentBaseLabel(match: any): string {
        const rawName = this.decodeHtmlEntities(match?.tournamentEventName || '');
        const cleanName = this.cleanTournamentNameFront(rawName);
        const countryFull = (match?.tournamentEventCountryFull || '').trim();
        const iso3 = (match?.tournamentEventCountryISO3 || '').trim().toUpperCase();

        const baseName = cleanName || countryFull || iso3 || '';
        return iso3 && baseName !== iso3 ? `${baseName} (${iso3})` : baseName;
      }

      private formatTournamentGridRound(match: Match): string {
        const round = this.formatRoundShort(match?.roundName);
        if (!round) return '';
        if (!this.isQualificationMatch(match) || round === 'Q') return round;

        const numberedRound = round.match(/^R(\d+)$/i);
        return numberedRound ? `Q${numberedRound[1]}` : `Q · ${round}`;
      }
      
      formatTournamentDisplayLabel(match: any): string {
        return this.appendQualificationSuffix(
          this.formatTournamentBaseLabel(match),
          this.extractTournamentLevel(match));
      }

      formatTournamentGridLabel(match: Match): string {
        const base = this.formatTournamentBaseLabel(match);
        const round = this.formatTournamentGridRound(match);

        if (round) return `${base} · ${round}`;
        return this.appendQualificationSuffix(base, this.extractTournamentLevel(match));
      }

      hasMarketOdds(match: Match): boolean {
        return this.hasOdds(match);
      }

      formatSurface(value?: string | null): string {
        const v = (value ?? '').trim();
        if (!v) return '';
      
        return v.toLowerCase() === 'unknown' ? '' : v.toUpperCase();
      }

      localizedSurface(value?: string | null): string {
        const original = this.formatSurface(value);
        if (!original) return '';
        const key = this.surfaceIndicatorLabel(value);
        return key === 'unknown' ? original : this.regional.text('surfaces.' + key).toUpperCase();
      }

      surfaceIndicatorLabel(value?: string | null): string {
        const normalized = (value ?? '').trim().toLowerCase();
        if (normalized === 'indoors' || normalized === 'indoor') return 'carpet';
        return ['clay', 'grass', 'hard', 'carpet'].includes(normalized)
          ? normalized
          : 'unknown';
      }

      surfaceIndicatorClass(value?: string | null): string {
        return `surface-indicator--${this.surfaceIndicatorLabel(value)}`;
      }

      get showFilterButton(): boolean {
        return this.viewMode !== 'tournament' && this.viewMode !== 'favourites';
      }

      get showFilterModalSafe(): boolean {
        return this.showFilterModal && this.showFilterButton;
      }
}
