/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { AppComponent } from '../../app.component';
import { Match } from '../../core/models/tennis.model';
import { MatchFilterModalComponent } from "./match-filter-modal/match-filter-modal.component";
import { MatchDetailsModalComponent } from "../matches/match-details-modal/match-details-modal.component";
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { Subject, Subscription, Observable, takeUntil } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

interface BootstrapDatesResult {
    dates: string[];
    min: Date;
    max: Date;
}

@Component({
    selector: 'app-matches',
    standalone: true,
    templateUrl: './matches.component.html',
    styleUrls: ['./matches.component.scss'],
    imports: [
        CommonModule,
        FormsModule,
        NgbDatepickerModule,
        MatchFilterModalComponent,
        MatchDetailsModalComponent
    ],
    encapsulation: ViewEncapsulation.None
})

export class MatchesComponent implements OnInit, OnDestroy {
    Math = Math;
    matches: Match[] = [];
    filteredMatches: Match[] = [];
    isFiltered = false;
    filteredPage = 1;
    currentDate: Date = new Date('1990-01-01');//currentDate: Date = new Date();
    currentDateISO = ''; // uvijek "YYYY-MM-DD" (source of truth)
    currentDateDMY = ''; // uvijek "DD.MM.YYYY" (UI prikaz)
    isNextDisabled = false;
    isPrevDisabled = false;
    loading = false;
    selectedDate: NgbDateStruct | null = null;
    showDatepicker = false;
    showFilterModal = false;
    selectedPlayer: number | null = null;
    selectedTournament: number | null = null;
    sortField: 'tournament' | 'date' | 'strength' = 'tournament';
    sortDirection: 'asc' | 'desc' = 'asc';
    filterApplied = false;
    activeDateFilter = 'all'; // 'year', 'month', 'week', 'custom'
    activeFromDate: string | null = null;
    activeToDate: string | null = null;
    activeSurfaceIds: number[] = [1, 2, 3, 4];
    activeTournamentTypeIds: number[] = [2, 4];
    activeTournamentLevelIds: number[] = [1, 2, 3, 4];
    activeStrengthStars: number[] = [0, 1, 2, 3, 4, 5];
    activeStatus: 'all' | 'finished' | 'unfinished' = 'all';
    activeOdds: 'all' | 'with' | 'without' = 'all';
    filteredAvailableDates: string[] = [];
    showDateWarning = false;
    currentDateString = '';
    noMatchesForFilter = false;
    showOutOfRangeModal = false;
    valueFilter: 'all' | 'valueOnly' = 'all';

    // search
    searchTerm = '';
    private search$ = new Subject<string>();

    private pendingAfterDetailsClose: 'login' | 'register' | 'upgrade' | null = null;

    @Input() minDate!: Date;
    @Input() maxDate!: Date;
    availableDates: string[] = [];
    selectedMatch: Match | null = null;
    private escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            this.closeDateWarningModal?.();
            if (this.selectedMatch) this.closeMatchModal();
        }
    };
    private deferScrollToTop(): void {
        // 2x raf = praktično “nakon što Angular nacrta DOM”
        requestAnimationFrame(() => requestAnimationFrame(() => this.scrollToTop()));
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

    // onDetailsRequestUpgrade(): void {
    //     console.log('[PARENT] requestUpgrade');
    //     this.pendingAfterDetailsClose = 'upgrade';
    //     this.closeDetailsModal();
    // }

    onDetailsRequestUpgrade(): void {
        console.log('[PARENT] requestUpgrade');

        // pokušaj zatvoriti details
        this.pendingAfterDetailsClose = 'upgrade';
        this.closeDetailsModal();

        // fallback: ako se iz nekog razloga ne zatvori u 1 ticku, svejedno otvori billing
        setTimeout(() => {
            if (this.pendingAfterDetailsClose === 'upgrade') {
                this.pendingAfterDetailsClose = null;
                this.openBillingModal();
            }
        }, 0);
    }

    openLoginModal(): void {
        // Header sluša "openLogin"
        window.dispatchEvent(new CustomEvent('openLogin'));
    }

    openRegisterModal(): void {
        // Header NE sluša "openRegister", ali sluša switchToRegister handler
        // Najjednostavnije: re-use postojeći event koji već imaš:
        window.dispatchEvent(new CustomEvent('switchToRegister'));
    }

    openBillingModal(): void {
        console.log('[BILLING] openBillingModal');
        window.dispatchEvent(new CustomEvent('openBilling'));
    }

    private closeDetailsModal(): void {
        // Ako je modal živ, zatvori ga “pravilno” da emit-a closed
        if (this.detailsModal) {
            this.detailsModal.close();
            return;
        }

        // fallback (ako iz nekog razloga ref nije spreman)
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
        private translate: TranslateService,
        private appComponent: AppComponent) { }

    // mapira specijalne/blank kodove na nešto što flag-icons zna prikazati
    flagCode(iso2?: string | null): string {
        const c = (iso2 || '').toUpperCase().trim();
        if (!c || c === 'WD' || c === 'WLD' || c === 'XX' || c === 'XW' || c === '-') return 'UN';
        // sitni aliasi, ako se pojave
        if (c === 'UK') return 'GB';   // flag-icons koristi 'gb'
        return c;
    }

    /** yyyy-MM-dd u LOKALNOJ zoni (bez UTC shiftanja) */
    private ymdLocal(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /** YYYYMMDD za backend, iz lokalnog datuma */
    private ymdCompact(d: Date): string {
        return this.ymdLocal(d).replace(/-/g, '');
    }

    public ymd(d: Date): string {
        return this.ymdLocal(d);
    }

    private daySourceMatches: Match[] = [];

    private static readonly SURFACE_MAP: Record<string, number> = {
        indoors: 1, indoor: 1, clay: 2, grass: 3, hard: 4
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

    // ✅ prag edge-a (0.00 = betaj na svaki pozitivan edge)
    private readonly MIN_EDGE = 0.02; // 2% points

    getTournamentStrengthTS(match: Match): number | null {
        const v = match.tournamentStrengthMeanTS;
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    ngOnInit(): void {
        console.log('ngOnInit start');

        document.addEventListener('keydown', this.escHandler);

        // ✅ Search debounce pipeline
        this.search$
            .pipe(
                debounceTime(200),
                distinctUntilChanged(),
                takeUntil(this.destroy$)
            )
            .subscribe(() => this.applyActiveFiltersToCurrentDay());

        this.loading = true;

        this.loadDatesAndBootstrap()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ({ dates, min, max }) => {
                    this.availableDates = dates;
                    this.minDate = min;
                    this.maxDate = max;

                    // startaj na zadnjem dostupnom danu
                    this.currentDate = new Date(this.maxDate);
                    this.currentDateString = this.ymdLocal(this.currentDate);
                    this.syncDateStringsFromCurrentDate();

                    console.log('✅ availableDates loaded:', {
                        count: this.availableDates.length,
                        min: dates[0],
                        max: dates[dates.length - 1],
                    });

                    // loadMatchesForDate sam upravlja loading state-om
                    this.loadMatchesForDate(this.currentDate);
                },
                error: (err) => {
                    console.error('❌ Failed to bootstrap dates:', err);
                    this.loading = false;
                    document.body.classList.remove('bb-noscroll');
                }
            });

        this.auth.authChanged$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                // refresh grid i lock state
                this.loadMatchesForDate(this.currentDate);
                // ako imaš i available-dates / entitlements, refresh i to:
                // this.loadAvailableDates();
            });
    }

    ngOnDestroy(): void {
        document.removeEventListener('keydown', this.escHandler);
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

                const min = new Date(dates[0]);
                const max = new Date(dates[dates.length - 1]);

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

                        const min = new Date(minIso);
                        const max = new Date(maxIso);

                        if (isNaN(min.getTime()) || isNaN(max.getTime())) {
                            throw new Error('daily index.json returned invalid min/max date');
                        }

                        // minimalna lista da UI ne pukne
                        const dates = [minIso, maxIso].filter(Boolean);

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
        const wrapper = document.querySelector('.table-wrapper') as HTMLElement | null;
        const firstRow = document.querySelector('.match-table tbody tr') as HTMLElement | null;
        const thead = document.querySelector('.match-table thead') as HTMLElement | null;

        // uzmi --top iz CSS-a (header + datebar)
        const cssTop = getComputedStyle(document.documentElement)
            .getPropertyValue('--top')
            .trim();

        const topBars = cssTop ? parseFloat(cssTop) : (56 + 40); // fallback
        const theadH = thead ? Math.ceil(thead.getBoundingClientRect().height) : 0;

        // malo zraka da ne "lijepi" odmah ispod head-a
        const extra = 8;

        // target: prvi red (najpreciznije) ili wrapper kao fallback
        const target = firstRow ?? wrapper;
        if (!target) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const y = target.getBoundingClientRect().top + window.scrollY - (topBars + theadH + extra);
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }

    loadMatchesForDate(date: Date): void {
        this.loading = true;
        document.body.classList.add('bb-noscroll');

        const correctedDate = this.correctDateIfOutOfBounds(date);
        const correctedChanged = correctedDate.getTime() !== date.getTime();

        this.currentDate = correctedDate;
        this.syncDateStringsFromCurrentDate();
        this.currentDateString = this.ymdLocal(correctedDate);

        if (correctedChanged) this.showDateOutOfRangeModal();

        const formattedDate = this.formatDate(correctedDate); // YYYYMMDD

        this.staticArchives.getDaily(formattedDate).subscribe({
            next: (data) => {
                const rows = (data || []).map((m, i) => ({ ...(m as any), __idx: i }));

                this.daySourceMatches = rows;

                console.log('[LOAD] isFiltered=', this.isFiltered, 'activeStatus=', this.activeStatus);

                console.log('📦 daySourceMatches loaded:', {
                    date: this.currentDateISO,
                    rows: this.daySourceMatches.length,
                    sample: this.daySourceMatches[0],
                });

                if (this.isFiltered) {
                    const filtered = this.filterMatchesByActiveFilters(this.daySourceMatches);

                    // quick stat: koliko ih pada zbog null id-eva
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

                this.loading = false;
                this.deferScrollToTop();
                document.body.classList.remove('bb-noscroll');
            },
            error: (err) => {
                console.error('❌ Error loading daily archive:', err);
                this.matches = [];
                this.loading = false;

                this.checkAdjacentDaysAvailability(this.currentDate);
                this.deferScrollToTop();
                document.body.classList.remove('bb-noscroll');
            }
        });
    }

    private getRoundSortKey(roundName?: string | null): number {
        const s0 = (roundName ?? '').trim().toLowerCase();
        if (!s0) return 999;

        // normalizacije
        const s = s0
            .replace(/\s+/g, ' ')
            .replace(/quarterfinals?/g, 'quarter finals')
            .replace(/semifinals?/g, 'semi finals');

        // ✅ prioritet koji ti želiš (osmina → QF → SF → F)
        if (s === 'r16' || s === 'round of 16') return 0;
        if (s === 'qf' || s === 'quarter finals') return 1;
        if (s === 'sf' || s === 'semi finals') return 2;
        if (s === 'f' || s === 'final' || s === 'finals') return 3;

        // ostale "Rxx" kratice (ako ikad dođu)
        // npr. R32, R64... => stavi ih poslije "main" faza
        const rx = s.match(/^r(\d{1,3})$/);
        if (rx) {
            const n = parseInt(rx[1], 10);
            // veći broj = ranija faza, ali svejedno iza top faza
            return 100 + (1000 - n);
        }

        // "1st round"..."5th round"
        const m1 = s.match(/^(\d+)(st|nd|rd|th)\s+round$/);
        if (m1) {
            const n = parseInt(m1[1], 10); // 1..5
            return 200 + n;               // poslije top faza
        }

        // qualifications / qualifying / Q
        if (s === 'q' || s === 'qualifications' || s === 'qualification' || s.includes('qualif')) return 900;

        // unknown zadnji
        if (s === 'unknown') return 999;

        return 500; // fallback
    }

    private isLegacyOrInvalidTime(d: any): boolean {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return true;

        const y = dt.getFullYear();
        if (y < 2004) return true;               // tvoj cutoff

        // ako parser prebaci ?? u 00:00, tretiramo to kao "unknown" i radije koristimo round+idx
        const h = dt.getHours();
        const m = dt.getMinutes();
        return (h === 0 && m === 0);
    }

    sortMatches(): void {
        const dir = this.sortDirection === 'asc' ? 1 : -1;

        this.matches.sort((a, b) => {

            const ta = this.removeRomanSuffix(a.tournamentEventName || '').toLowerCase();
            const tb = this.removeRomanSuffix(b.tournamentEventName || '').toLowerCase();

            const ia = (a as any).__idx ?? 0;
            const ib = (b as any).__idx ?? 0;

            const legacy = this.isLegacyOrInvalidTime(a.dateTime) || this.isLegacyOrInvalidTime(b.dateTime);

            // ---- SORT: TOURNAMENT (default)
            if (this.sortField === 'tournament') {
                // 1) turnir
                if (ta < tb) return -1 * dir;
                if (ta > tb) return 1 * dir;

                // 2) ✅ unutar istog turnira: runda (barem za legacy, a može i uvijek)
                const ra = this.getRoundSortKey((a as any).roundName);
                const rb = this.getRoundSortKey((b as any).roundName);
                if (ra < rb) return -1;
                if (ra > rb) return 1;

                // 4) onda po dateTime ako je legit, inače po __idx
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

                // tie-breaker: dateTime ako je legit
                if (!legacy) {
                    const da = new Date(a.dateTime).getTime();
                    const db = new Date(b.dateTime).getTime();
                    if (da < db) return -1;
                    if (da > db) return 1;
                }

                // zadnje: stabilnost
                return ia - ib;
            }

            // ---- SORT: DATE (kad klikneš Date header)
            if (!legacy) {
                const da = new Date(a.dateTime).getTime();
                const db = new Date(b.dateTime).getTime();
                if (da < db) return -1 * dir;
                if (da > db) return 1 * dir;

                // tie-breaker: turnir
                if (ta < tb) return -1 * dir;
                if (ta > tb) return 1 * dir;

                return (ia - ib) * dir;
            }

            // legacy date sort: runda primarno, pa turnir, pa __idx
            const ra = this.getRoundSortKey((a as any).roundName);
            const rb = this.getRoundSortKey((b as any).roundName);
            if (ra < rb) return -1;   // fiksno
            if (ra > rb) return 1;

            if (ta < tb) return -1 * dir;
            if (ta > tb) return 1 * dir;

            return (ia - ib) * dir;
        });
    }

    toggleSort(field: 'tournament' | 'date' | 'strength'): void {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = (field === 'strength') ? 'desc' : 'asc'; // ✅ najjače gore
        }

        this.sortMatches();
        this.applyActiveFiltersToCurrentDay();
    }

    onNativeDateChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const rawDate = new Date(input.value);

        if (isNaN(rawDate.getTime())) return;

        const formatted = rawDate.toISOString().split('T')[0];

        if (this.isFiltered && this.filteredAvailableDates.length > 0) {
            const isInsideFilter = this.filteredAvailableDates.includes(formatted);
            if (!isInsideFilter) {
                this.showOutOfFilterRangeModal();

                // Resetiraj Angular property koji se bind-a
                const currentDateFormatted = this.currentDate
                    ? this.formatDateForInput(this.currentDate)
                    : '';
                console.log('Resetting input to last valid date:', this.currentDate, currentDateFormatted);
                this.currentDateString = currentDateFormatted;

                // I ručno postavi value DOM elementa
                if (this.dateInputRef?.nativeElement) {
                    this.dateInputRef.nativeElement.value = this.currentDateString;
                }

                return;
            }
        }

        // Ako je sve ok, nastavi normalno
        this.loadMatchesForDate(rawDate);
    }

    onDateInputChanged(event: Event): void {
        const input = event.target as HTMLInputElement;
        const rawDate = new Date(input.value);

        if (isNaN(rawDate.getTime())) return;

        // ako je filtrirano i koristiš filter range validaciju
        const formatted = rawDate.toISOString().split('T')[0];

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

        // clamp na min/max ako nije filtrirano
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

    previousDay(): void {
        if (this.loading) return;

        const list = this.availableDates || [];
        if (!list.length) return;

        const curIso = this.currentDateISO || this.toISOFromDateLocal(this.currentDate);
        const idx = list.indexOf(curIso);

        // ako iz nekog razloga nismo na danu iz liste, snap na najbliži manji (ili zadnji)
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

        // ako nismo na danu iz liste, snap na najbliži veći (ili prvi)
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

    // helpers (dodaj negdje u klasu)
    private findPrevIndex(list: string[], iso: string): number | null {
        // list je ASC; tražimo najveći index gdje je list[i] < iso
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i] < iso) return i;
        }
        return null;
    }

    private findNextIndex(list: string[], iso: string): number | null {
        // tražimo najmanji index gdje je list[i] > iso
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

    getLocalizedDateMaybeTime(date: string | Date | null | undefined): string {
        if (!date) return '';

        const d = typeof date === 'string' ? new Date(date) : date;
        if (!(d instanceof Date) || isNaN(d.getTime())) return '';

        const pad = (n: number) => n.toString().padStart(2, '0');

        const day = pad(d.getDate());
        const month = pad(d.getMonth() + 1);
        const year = d.getFullYear();
        const hours = d.getHours();
        const minutes = d.getMinutes();

        // prije 2004: nikad ne prikazuj vrijeme
        if (year < 2004) return `${day}.${month}.${year}`;

        // ako je vrijeme "00:00" -> ne prikazuj
        if (hours === 0 && minutes === 0) return `${day}.${month}.${year}`;

        return `${day}.${month}.${year} ${pad(hours)}:${pad(minutes)}`;
    }

    formatOdds(value: number | null | undefined): string {
        if (value == null || isNaN(value)) return '';
        return value.toFixed(2);
    }

    formatPercent(value: number | null | undefined): string {
        if (value == null || isNaN(value)) return '';
        return (value * 100).toFixed(0) + '%';
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

    openPlayerModal(player: number) {
        this.selectedPlayer = player;
    }


    closePlayerModal() {
        this.selectedPlayer = null;
    }

    openTournamentModal(tournament: number) {
        this.selectedTournament = tournament;
    }

    closeTournamentModal() {
        this.selectedTournament = null;
    }

    formatResult(raw: string | number | null | undefined): string {
        if (raw == null) return '';
        const s = String(raw).trim();

        // već formatirano ili specijalni ishod
        if (!s) return '';
        if (s.includes(':')) return s;         // npr. "2:1"
        if (/^(RET|W[OW]|ABD|CAN|DEF)$/i.test(s)) return s; // posebni slučajevi

        // "21", "2-1", "02-01" → "2:1"
        const m = s.match(/^(\d{1,2})\D?(\d{1,2})$/);
        if (m) return `${parseInt(m[1], 10)}:${parseInt(m[2], 10)}`;

        return s; // fallback
    }

    formatResultDetails(raw?: string | null): string {
        if (!raw) return '';

        // Tokenizacija
        const tokens = raw.split(/\s+/).filter(Boolean);
        if (!tokens.length) return '';

        // 1) Normaliziraj sve u "a:b" ili "a:b(x)" format (npr. "76(5)" -> "7:6(5)", "20" -> "2:0")
        const normalized = tokens
            .map(t => this.normalizeSetToken(t))
            .filter(t => !!t);

        if (!normalized.length) return '';

        // 2) Ako prvi token izgleda kao ukupni set-score (2:0, 2:1, 3:2, ...)
        // i nakon njega postoje barem 2 stvarna seta (6:4, 7:6(5), 10:8, ...)
        // izbaci taj prvi token
        if (this.looksLikeSetScoreHeader(normalized[0])) {
            const setLikeCount = normalized.slice(1).filter(t => this.looksLikeRealSetToken(t)).length;
            if (setLikeCount >= 2) {
                normalized.shift();
            }
        }

        return normalized.join(' ');
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
        return Math.max(a, b) >= 6; // setovi obično 6/7, superTB 10
    }

    private normalizeSetToken(tok: string): string {
        const t = tok.trim();

        // već "6:4" ili "7:6(5)"
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
        return name.replace(/\s*(\([IVXLCDM]{1,4}\)|[IVXLCDM]{1,4})\s*$/, '').trim();
    }

    decodeHtmlEntities(value: string): string {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = value;
        return textarea.value;
    }

    onFilterApplied(filter: {
        startDate: string | null;
        endDate: string | null;
        option: string;
        surfaceIds: number[];
        tournamentTypeIds: number[];
        strengthStars: number[];
        status: 'all' | 'finished' | 'unfinished' | undefined;
        odds: 'all' | 'with' | 'without';
        valueFilter: 'all' | 'valueOnly';
    }): void {
        console.log('🧪 onFilterApplied (incoming):', filter);
        console.log('[PARENT RECEIVED] status =', filter.status);

        // 1) spremi aktivne vrijednosti (modal već šalje start/end izračunate)
        this.activeDateFilter = filter.option;
        this.activeFromDate = filter.startDate;
        this.activeToDate = filter.endDate;
        this.activeSurfaceIds = (filter.surfaceIds || []).map(Number);
        this.activeTournamentTypeIds = (filter.tournamentTypeIds || []).map(Number);
        this.activeStrengthStars = (filter.strengthStars || []).map(Number);
        this.activeStatus = filter.status ?? 'all';
        this.activeOdds = filter.odds ?? 'all';
        this.valueFilter = filter.valueFilter ?? 'all';
        this.applyActiveFiltersToCurrentDay();

        console.log('[PARENT STORED] activeStatus =', this.activeStatus);

        // 2) detektiraj je li filter "default" (badge)
        const allSurfaces = [1, 2, 3, 4];
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

        this.isFiltered = !(isDefaultDate && isAllSurfaces && isAllTypes && isAllStrength && isDefaultStatus && isDefaultOdds);
        this.filterApplied = this.isFiltered;

        // 3) izračunaj filteredAvailableDates (samo date range dio filtera)
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

        // 4) ako filtrirani date range nema dana -> pokaži "no results" i ostani na trenutnom danu
        if (this.isFiltered && hasDateRange && this.filteredAvailableDates.length === 0) {
            this.matches = [];
            this.daySourceMatches = [];
            this.noMatchesForFilter = true;
            this.filteredPage = 1;
            this.showFilterModal = false;
            return;
        }

        // 5) odredi na koji dan trebamo skočiti
        const currentIso = this.currentDateISO || this.toISOFromDateLocal(this.currentDate);

        let targetIso = currentIso;

        if (this.isFiltered && hasDateRange) {
            if (!this.filteredAvailableDates.includes(currentIso)) {
                targetIso = this.filteredAvailableDates[this.filteredAvailableDates.length - 1];
            }
        }

        // 6) zatvori modal i učitaj taj dan
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
        if (v !== null && v !== undefined && !Number.isNaN(+v)) return +v;
        const s = m.surface ?? m.courtSurface ?? m.surfaceName;
        if (s) {
            const key = String(s).toLowerCase().trim();
            return MatchesComponent.SURFACE_MAP[key] ?? null;
        }
        return null;
    }

    private normalizeTypeId(m: any): number | null {
        const v = m.tournamentTypeId ?? m.typeId ?? null;
        if (v !== null && v !== undefined && !Number.isNaN(+v)) return +v;

        // ✅ dodaj tournamentTypeName (to ti dolazi iz daily archive)
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

        // ako nema filtera, vrati izvor
        // ✅ ali: valueFilter je isto filter -> uključimo ga u gate
        const hasAnyFilter =
            this.isFiltered || this.valueFilter === 'valueOnly';

        if (!hasAnyFilter) return source || [];

        const sSet = new Set((this.activeSurfaceIds || []).map(Number));
        const tSet = new Set((this.activeTournamentTypeIds || []).map(Number));
        const strengthSet = new Set((this.activeStrengthStars || []).map(Number));

        return (source || []).filter((m: Match) => {
            // SURFACE
            if (sSet.size > 0) {
                const sId = this.normalizeSurfaceId(m);
                if (sId == null || !sSet.has(sId)) return false;
            }

            // TYPE
            if (tSet.size > 0) {
                const tId = this.normalizeTypeId(m);
                if (tId == null || !tSet.has(tId)) return false;
            }

            // STRENGTH (0..5 bucket)
            if (strengthSet.size > 0) {
                const bucket = this.strengthBucket(m);
                if (!strengthSet.has(bucket)) return false;
            }

            // STATUS
            if (this.activeStatus !== 'all') {
                // podržava i normalni shape i minified (l03)
                const finVal = (m as any)?.isFinished ?? (m as any)?.l03;
                const finished =
                    finVal === true || finVal === 1 || finVal === '1' || finVal === 'true';

                if (this.activeStatus === 'finished' && !finished) return false;
                if (this.activeStatus === 'unfinished' && finished) return false;
            }

            // ODDS
            if (this.activeOdds !== 'all') {
                const has = this.hasOdds(m);
                if (this.activeOdds === 'with' && !has) return false;
                if (this.activeOdds === 'without' && has) return false;
            }

            // ✅ VALUE (novo): barem jedan edge >= MIN_EDGE (koristi tvoj getBetSide)
            if (this.valueFilter === 'valueOnly') {
                if (!this.hasValueBet(m)) return false;
            }

            return true;
        });
    }

    private applyActiveFiltersToCurrentDay(): void {
        // 1) aktivni filteri
        let rows = this.filterMatchesByActiveFilters(this.matches);

        // 2) search (novo)
        rows = this.filterMatchesBySearchTerm(rows);

        this.filteredMatches = rows;

        // UX: no results i za filter i za search
        this.noMatchesForFilter =
            (this.isFiltered || !!this.searchTerm.trim()) && this.filteredMatches.length === 0;
    }

    clearFilter(): void {
        this.isFiltered = false;
        this.filterApplied = false;
        this.matches = this.daySourceMatches;
        this.sortMatches();
        this.filteredPage = 1;
        this.noMatchesForFilter = false;
    }

    onFilterReset(): void {
        this.filterApplied = false;
        this.activeDateFilter = 'all';
        this.activeFromDate = null;
        this.activeToDate = null;
        this.activeOdds = 'all';

        this.clearFilter();
    }

    isFilterDefault(): boolean {
        const allSurfacesSelected = this.activeSurfaceIds.length === 4 && [1, 2, 3, 4].every(id => this.activeSurfaceIds.includes(id));
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

        // ako trenutno nije u listi, strelice i dalje imaju smisla (možemo naći najbliže)
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

        // 1) makni trailing (...) grupe
        out = out.replace(/\s*(?:\([^()]*\)\s*)+$/g, '');

        // 2) makni rimski broj na kraju ako je odvojen razmakom
        out = out.replace(/\s+(?:[IVXLCDM]{1,6})\s*$/i, '');

        // 3) makni trailing "Q" (qualifications), s razmakom ili bez
        // npr. "Vancouver Q", "VancouverQ"
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

    /** Poravnaj broj na fiksnu širinu: intWidth znamenki prije točke + fracWidth decimala.
     *  figure space (U+2007) zauzima širinu znamenke ali je “prazan”, pa je 01.23 jednako široko kao 1.23 */
    private alignFixed(value: string, intWidth: number, fracWidth: number): string {
        const v = Number(String(value).replace(',', '.'));
        if (!Number.isFinite(v)) return '';
        const [intPartRaw, fracPartRaw = ''] = v.toFixed(fracWidth).split('.');
        const intPart = intPartRaw; // nema minusa u tvojim podacima
        const padCount = Math.max(0, intWidth - intPart.length);
        const FIG = '\u2007'; // figure space = širina znamenke
        return FIG.repeat(padCount) + intPart + '.' + fracPartRaw;
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

    /* nevidljive vodeće nule do targetWidth: <span class="ghost">00</span> */
    private ghostPadInt(intPart: string, targetWidth: number): string {
        const need = Math.max(0, targetWidth - intPart.length);
        return need ? `<span class="ghost">${'0'.repeat(need)}</span>${intPart}` : intPart;
    }

    /* ODS — prazno ako obje strane 0.00; širine 2+2 */
    formatOddsHTML(text?: string | null): string {
        const [l, r] = this.splitPair(text);
        const [li, lf] = this.toFixedParts(l, 2);
        const [ri, rf] = this.toFixedParts(r, 2);
        const bothZero = li === '0' && lf === '00' && ri === '0' && rf === '00';
        if (bothZero) return '';
        const L = `${this.ghostPadInt(li, 2)}.${lf}`;
        const R = `${this.ghostPadInt(ri, 2)}.${rf}`;
        return `<span class="dual dual-odds"><span class="l">${L}</span><span class="mid">–</span><span class="r">${R}</span></span>`;
    }

    /* PROB — širine 3+2 (do 100.xx) */
    formatProbHTML(text?: string | null): string {
        const [l, r] = this.splitPair(text);
        const [li, lf] = this.toFixedParts(l, 2);
        const [ri, rf] = this.toFixedParts(r, 2);
        const L = `${this.ghostPadInt(li, 3)}.${lf}`;
        const R = `${this.ghostPadInt(ri, 3)}.${rf}`;
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
        // currentDateString je "YYYY-MM-DD" (što type=date drži interno)
        const rawDate = new Date(this.currentDateString);

        if (isNaN(rawDate.getTime())) return;

        // clamp na min/max
        const corrected = this.correctDateIfOutOfBounds(rawDate);

        // sync string (da odmah pokaže korigirano)
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
        // pokušaj iz details-a (frontend patch)
        const computed = this.computeResultFromDetails(match.resultDetails);
        if (computed) return computed;

        // fallback na backend result
        return this.formatResult(match.result);
    }

    private computeResultFromDetails(raw?: string | null): string | null {
        const cleaned = this.formatResultDetails(raw); // ovo već normalizira i miče header
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

        // Ako nemamo nijedan valjan set, ne diraj backend result
        if (p1 + p2 === 0) return null;

        return `${p1}:${p2}`;
    }

    getStrengthStars(match: any): number {
        const ts = match.tournamentStrengthMeanTS;

        if (ts == null || Number.isNaN(ts)) return 0;   // omogući 0

        // PROBNA kalibracija (ti brojevi su ključ!)
        const min = 18;  // najniža očekivana snaga
        const max = 32;  // najviša očekivana snaga

        // normalizacija 0..1
        const t = (ts - min) / (max - min);

        // clamp 0..1
        const clamped = Math.min(1, Math.max(0, t));

        // map 0..5
        const stars = clamped * 5;

        // zaokruži na pola zvjezdice
        return Math.round(stars * 2) / 2;
    }

    formatPlayerLabel(
        name: string,
        iso3?: string | null,
        seed?: string | null,
        rank?: string | null
    ): string {
        const n = (name ?? '').trim();

        const isoRaw = (iso3 ?? '').toString().trim().toUpperCase();
        const iso = isoRaw && isoRaw !== '0' ? isoRaw : '';

        const sRaw = (seed ?? '').toString().trim();
        const s = (sRaw && sRaw !== '0' && sRaw !== '0.0') ? sRaw : '';

        const rRaw = (rank ?? '').toString().trim();
        const r = (rRaw && rRaw !== '0' && rRaw !== '0.0') ? rRaw : '';

        const isoPart = iso ? ` (${iso})` : '';
        const seedPart = s ? ` (${s})` : '';
        const rankPart = r ? ` [${r}]` : '';

        return `${n}${isoPart}${seedPart}${rankPart}`.trim();
    }

    formatRound(value?: string | null): string {
        const s = (value ?? '').trim();
        if (!s) return '';

        // common shortenings
        const key = s.toLowerCase();

        if (key === 'final') return 'F';
        if (key === 'semi finals' || key === 'semifinals' || key === 'semi-final') return 'SF';
        if (key === 'quarter finals' || key === 'quarterfinals' || key === 'quarter-final') return 'QF';

        // round of X
        const m = key.match(/^round of\s+(\d+)$/);
        if (m) return `R${m[1]}`;

        // qualifications variants
        if (key.includes('qualification')) return 'Q';
        if (key === 'qualifying') return 'Q';

        // fallback: Title Case-ish
        return s;
    }

    formatRoundShort(value?: string | null): string {
        const s = (value ?? '').trim().toLowerCase();
        if (!s || s === 'unknown') return '';

        if (s === 'qualifications') return 'Q';
        if (s === 'quarter finals') return 'QF';
        if (s === 'semi finals') return 'SF';
        if (s === 'finals' || s === 'final') return 'F';

        // "1st round"..."5th round" => R1..R5
        const m1 = s.match(/^(\d+)(st|nd|rd|th)\s+round$/);
        if (m1) return `R${m1[1]}`;

        // "round of 16" => R16
        const m2 = s.match(/^round\s+of\s+(\d+)$/);
        if (m2) return `R${m2[1]}`;

        return value ?? ''; // fallback
    }

    private pad2(n: number): string { return String(n).padStart(2, '0'); }

    private toISOFromDateLocal(d: Date): string {
        // lokalni datum → "YYYY-MM-DD"
        const y = d.getFullYear();
        const m = this.pad2(d.getMonth() + 1);
        const day = this.pad2(d.getDate());
        return `${y}-${m}-${day}`;
    }

    private toDMYFromISO(iso: string): string {
        // "YYYY-MM-DD" → "DD.MM.YYYY"
        if (!iso || iso.length < 10) return '';
        const y = iso.slice(0, 4);
        const m = iso.slice(5, 7);
        const d = iso.slice(8, 10);
        return `${d}.${m}.${y}`;
    }

    private parseDMYtoISO(dmy: string): string | null {
        const t = (dmy || '').trim();
        const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!m) return null;

        const dd = Number(m[1]);
        const mm = Number(m[2]);
        const yyyy = Number(m[3]);

        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

        const dt = new Date(yyyy, mm - 1, dd);
        // spriječi overflow tipa 31.02.
        if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;

        return this.toISOFromDateLocal(dt);
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

    commitDateInputDMY(): void {
        const iso = this.parseDMYtoISO(this.currentDateDMY);

        if (!iso) {
            this.syncDateStringsFromCurrentDate();
            if (this.dateInputRef?.nativeElement) this.dateInputRef.nativeElement.value = this.currentDateDMY;
            return;
        }

        const dt = this.isoToDateLocal(iso);
        if (!dt) return;

        // clamp na globalni min/max (da ne upiše 1800. godinu)
        const corrected = this.correctDateIfOutOfBounds(dt);
        const correctedIso = this.toISOFromDateLocal(corrected);

        // ✅ postavi current date na ono što je user htio (ili clamped)
        this.currentDate = corrected;
        this.syncDateStringsFromCurrentDate();

        if (this.dateInputRef?.nativeElement) this.dateInputRef.nativeElement.value = this.currentDateDMY;

        this.filteredPage = 1;

        // ✅ ako taj dan NE postoji u availableDates -> samo pokaži "No matches" (bez preskakanja)
        if (this.availableDates?.length && !this.availableDates.includes(correctedIso)) {
            this.daySourceMatches = [];
            this.matches = [];
            this.noMatchesForFilter = false; // nije filter problem
            this.checkAdjacentDaysAvailability(corrected); // strelice i dalje imaju smisla
            this.deferScrollToTop();
            return;
        }

        // inače normalno učitaj taj dan
        this.loadMatchesForDate(corrected);
    }
    onDateDMYInput(event: Event): void {
        const el = event.target as HTMLInputElement;
        const digits = (el.value || '').replace(/\D/g, '').slice(0, 8);

        let out = '';
        if (digits.length <= 2) {
            out = digits;
        } else if (digits.length <= 4) {
            out = `${digits.slice(0, 2)}.${digits.slice(2)}`;
        } else {
            out = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
        }

        this.currentDateDMY = out;

        // sync DOM value (bitno kad browser “kasni” s ngModel)
        if (this.dateInputRef?.nativeElement) {
            this.dateInputRef.nativeElement.value = out;
        }
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
        this.isDetailsOpen = false;
        this.selectedMatchTPId = null;
        this.selectedMatch = null;

        const action = this.pendingAfterDetailsClose;
        this.pendingAfterDetailsClose = null;

        if (!action) return;

        if (action === 'login') {
            queueMicrotask(() => window.dispatchEvent(new CustomEvent('openLogin')));
            return;
        }

        if (action === 'register') {
            queueMicrotask(() => window.dispatchEvent(new CustomEvent('switchToRegister')));
            return;
        }

        if (action === 'upgrade') {
            // ✅ MACROTASK -> ne dijeli isti click event s prethodnim modalom
            setTimeout(() => {
                this.openBillingModal();
            }, 0);
        }
    }

    // Bet simulation PL
    private parseDualNumbers(text?: string | null): [number | null, number | null] {
        if (!text) return [null, null];

        // podrži “–” i “-”
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
        const [o1, o2] = this.parseDualNumbers(match?.oddsText);
        // 0, null, negativno -> invalid
        const v1 = o1 && o1 > 1 ? o1 : null;
        const v2 = o2 && o2 > 1 ? o2 : null;
        return [v1, v2];
    }

    private parseProbs(match: any): [number | null, number | null] {
        const [p1, p2] = this.parseDualNumbers(match?.probabilityText);
        // očekujemo 0..100
        const v1 = p1 != null && p1 >= 0 && p1 <= 100 ? p1 : null;
        const v2 = p2 != null && p2 >= 0 && p2 <= 100 ? p2 : null;
        return [v1, v2];
    }

    private getWinnerSide(match: Match): 'p1' | 'p2' | null {
        // koristi tvoj prikazni rezultat (već ti radi iz details)
        const res = this.getDisplayResult(match); // npr "2:1" ili "RET"
        const m = (res || '').match(/^(\d{1,2}):(\d{1,2})$/);
        if (!m) return null;

        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        if (a === b) return null;
        return a > b ? 'p1' : 'p2';
    }

    private getBetSide(match: Match): { side: 'p1' | 'p2' | null, edge1?: number, edge2?: number } {
        const [odds1, odds2] = this.parseOdds(match);
        const [p1, p2] = this.parseProbs(match);

        if (!odds1 || !odds2 || p1 == null || p2 == null) return { side: null };

        const imp1 = 1 / odds1;
        const imp2 = 1 / odds2;

        const m1 = p1 / 100;
        const m2 = p2 / 100;

        const edge1 = m1 - imp1;
        const edge2 = m2 - imp2;

        // moramo imati barem jedan edge >= MIN_EDGE
        const ok1 = edge1 >= this.MIN_EDGE;
        const ok2 = edge2 >= this.MIN_EDGE;

        if (!ok1 && !ok2) return { side: null, edge1, edge2 };

        // uzmi jači edge (ako oba prolaze)
        if (ok1 && ok2) return { side: edge1 >= edge2 ? 'p1' : 'p2', edge1, edge2 };
        return { side: ok1 ? 'p1' : 'p2', edge1, edge2 };
    }

    private computePL(match: Match): number | null {
        const winner = this.getWinnerSide(match);
        if (!winner) return null; // nema validan rezultat

        const [odds1, odds2] = this.parseOdds(match);
        if (!odds1 || !odds2) return null;

        const bet = this.getBetSide(match);
        if (!bet.side) return null; // nema edge-a => ne betamo

        const won = bet.side === winner;
        const odds = bet.side === 'p1' ? odds1 : odds2;

        // unit stake
        const pl = won ? (odds - 1) : -1;

        // za stabilan prikaz
        return Math.round(pl * 100) / 100;
    }

    formatPL(match: Match): string {
        const pl = this.computePL(match);
        if (pl == null) return '';

        // +0.65 ili -1.00
        const sign = pl > 0 ? '+' : '';
        return `${sign}${pl.toFixed(2)}`;
    }

    getPLClass(match: Match): string {
        const pl = this.computePL(match);
        if (pl == null) return 'pl-empty';
        if (pl > 0) return 'pl-positive';
        if (pl < 0) return 'pl-negative';
        return 'pl-zero';
    }

    getPLTooltip(match: Match): string {
        const [odds1, odds2] = this.parseOdds(match);
        const [p1, p2] = this.parseProbs(match);
        const bet = this.getBetSide(match);

        if (!odds1 || !odds2 || p1 == null || p2 == null) return 'No odds/probability data.';
        const imp1 = 100 * (1 / odds1);
        const imp2 = 100 * (1 / odds2);

        const e1 = bet.edge1 != null ? (bet.edge1 * 100).toFixed(2) : 'n/a';
        const e2 = bet.edge2 != null ? (bet.edge2 * 100).toFixed(2) : 'n/a';

        const chosen = bet.side ? (bet.side === 'p1' ? 'Player 1' : 'Player 2') : 'None';

        return `Chosen: ${chosen}
      P1: model ${p1.toFixed(2)}% | implied ${imp1.toFixed(2)}% | edge ${e1}%
      P2: model ${p2.toFixed(2)}% | implied ${imp2.toFixed(2)}% | edge ${e2}%`;
    }

    private getStrengthKey(match: any): number {
        const ts = Number(match?.tournamentStrengthMeanTS);
        // null/NaN -> na dno
        return Number.isFinite(ts) ? ts : -Infinity;
    }

    private strengthBucket(match: any): number {
        const stars = this.getStrengthStars(match); // 0..5 u koracima 0.5
        return Math.round(stars); // bucket 0..5
    }

    private hasOdds(m: any): boolean {
        // DTO/minified
        if (m?.l29 != null || m?.l30 != null) return true;

        // "expanded" shape (ako negdje postoji)
        if (m?.player1Odds != null || m?.player2Odds != null) return true;

        // tekstualni prikaz (npr. "1.35 - 2.82")
        const t = (m?.oddsText ?? '').toString().trim();
        if (!t) return false;

        // ako ima barem jednu brojku, tretiramo kao da odds postoje
        return /\d/.test(t);
    }

    onSearchInput(): void {
        this.search$.next(this.searchTerm ?? '');
    }

    clearSearch(): void {
        this.searchTerm = '';
        this.search$.next('');
    }

    private filterMatchesBySearchTerm(rows: Match[]): Match[] {
        const q = this.norm(this.searchTerm);
        if (!q) return rows;

        return rows.filter(m => {
            const p1 = this.norm(m.player1Name);
            const p2 = this.norm(m.player2Name);

            // preferiraj clean name ako postoji (bolji UX), fallback na eventName
            const t = this.norm(m.tournamentCleanName ?? m.tournamentEventName);

            return p1.includes(q) || p2.includes(q) || t.includes(q);
        });
    }

    private norm(v: unknown): string {
        return String(v ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // makne dijakritiku (č/ć/š/đ/ž)
            .replace(/\s+/g, ' ')
            .trim();
    }

    private hasValueBet(match: Match): boolean {
        return this.getBetSide(match).side != null;
    }

    isDetailsLocked(m: Match): boolean {
        if (!m) return true;

        // finished -> unlocked
        const finVal: any = (m as any)?.isFinished ?? (m as any)?.l03;
        const finished = finVal === true || finVal === 1 || finVal === '1' || finVal === 'true';
        if (finished) return false;

        // privileged -> unlocked
        const u = this.auth.getUser();
        const ent: any = (u as any)?.entitlements;
        const privileged = !!(u?.isAdmin || ent?.isPremium || ent?.hasTrial);
        if (privileged) return false;

        // free/guest -> lock window
        const dt = m.dateTime ? new Date(m.dateTime as any) : null;
        if (!dt || isNaN(dt.getTime())) return false; // fail-open

        const unlockMs = dt.getTime() - 2 * 60 * 60 * 1000;
        return Date.now() < unlockMs;
    }
}