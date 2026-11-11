/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, OnDestroy, OnInit, Optional, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { TournamentIndex } from '../../core/models/tennis.model';
import { TournamentModalComponent } from './tournament-modal/tournament-modal.component';
import {
  DEFAULT_TOURNAMENT_FILTER,
  TournamentFilterModalComponent,
  TournamentFilterState
} from './tournament-filter-modal/tournament-filter-modal.component';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RegionalSettingsService } from '../../core/services/regional-settings.service';
import { BrowseMemoryService, BrowseScroll, BrowseVisit } from '../../core/services/browse-memory.service';
import { FilterUndoService } from '../../core/services/filter-undo.service';
import { ReadRecoveryService } from '../../core/services/read-recovery.service';
import { ViewRecoveryActionsComponent } from '../../shared/ui/view-recovery-actions/view-recovery-actions.component';
import { Subscription } from 'rxjs';
type TournamentBrowseState = Pick<TournamentsComponent, 'currentPage' | 'pageSize' | 'searchTerm' | 'tournamentFilter' | 'quickTourFilter' | 'sortField' | 'sortDirection'>;
// kasnije: TournamentModalComponent, TournamentFilterModalComponent

type SortField =
  | 'tournamentEventName'
  | 'tournamentEventDate'
  | 'tournamentTypeName'
  | 'tournamentLevelName'
  | 'surfaceName'
  | 'prize'
  | 'strengthMeanTS'
  | 'strengthPlayers'
  | 'numberOfMatches'
  | 'averageMatchStrength'
  | 'peakMatchStrength'
  | 'dateOfLastMatch';

const TOURNAMENT_SORT_STORAGE_KEY = 'bonzobyte.tournaments.sort.v1';
const TOURNAMENT_PAGE_SIZE_STORAGE_KEY = 'bonzobyte.tournaments.page-size.v1';
const TOURNAMENT_SORT_FIELDS: readonly SortField[] = [
  'tournamentEventName',
  'tournamentEventDate',
  'tournamentTypeName',
  'tournamentLevelName',
  'surfaceName',
  'prize',
  'strengthMeanTS',
  'strengthPlayers',
  'numberOfMatches',
  'averageMatchStrength',
  'peakMatchStrength',
  'dateOfLastMatch'
];

@Component({
  selector: 'app-tournaments',
  standalone: true,
  templateUrl: './tournaments.component.html',
  styleUrls: ['./tournaments.component.scss'],
  imports: [
    ViewRecoveryActionsComponent,
    CommonModule,
    TranslateModule,
    FormsModule,
    NgbDatepickerModule,
    TournamentModalComponent,
    TournamentFilterModalComponent
  ],
  encapsulation: ViewEncapsulation.None
})
export class TournamentsComponent implements OnInit, OnDestroy {

  // raw + view
  allTournaments: TournamentIndex[] = [];
  tournaments: TournamentIndex[] = []; // Current page rendered by the table.

  // paging
  currentPage = 1;
  pageSize = 100;
  readonly pageSizeOptions = [50, 100, 250];
  totalPages = 1;
  filteredResultCount = 0;

  // ui
  loading = false;
  loadError: string | null = null;
  showFilterModal = false;
  isFiltered = false;
  tournamentFilter: TournamentFilterState = { ...DEFAULT_TOURNAMENT_FILTER };

  // search
  searchTerm = '';
  quickTourFilter: 'all' | 'atp' | 'wta' = 'all';

  // sorting
  sortField: SortField = 'tournamentEventDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  selectedTournament: TournamentIndex | null = null;

  // strength stats for stars (from manifest)
  private strengthMin: number | null = null;
  private strengthMedian: number | null = null;
  private strengthMax: number | null = null;

  get tournamentStrengthScale(): { min: number | null; median: number | null; max: number | null } {
    return { min: this.strengthMin, median: this.strengthMedian, max: this.strengthMax };
  }

  // ESC close
  private escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.selectedTournament) this.closeTournamentModal();
      if (this.showFilterModal) this.closeFilterModal();
    }
  };

  @ViewChild('pageInput') pageInputRef!: ElementRef<HTMLInputElement>;

  private indexRequest?: Subscription;
  private pendingScroll: BrowseScroll | null = null;
  private cancelScrollRestore?: () => void;
  private browseLoaded = false;

  constructor(private archives: StaticArchivesService, private router: Router, public regional: RegionalSettingsService,
    private browseMemory: BrowseMemoryService = new BrowseMemoryService(),
    private hostElement: ElementRef<HTMLElement> = new ElementRef(document.createElement('div')),
    @Optional() @Inject(FilterUndoService) private filterUndo: FilterUndoService | null = null,
    @Optional() @Inject(ReadRecoveryService) private recovery: ReadRecoveryService | null = null) { }
  private releaseReadRecovery?: () => void;

  private browseState(): TournamentBrowseState {
    return { currentPage: this.currentPage, pageSize: this.pageSize, searchTerm: this.searchTerm,
      tournamentFilter: this.tournamentFilter, quickTourFilter: this.quickTourFilter,
      sortField: this.sortField, sortDirection: this.sortDirection };
  }
  private beforeFilterChange(): BrowseVisit<TournamentBrowseState> | null {
    this.cancelScrollRestore?.();
    this.pendingScroll = null;
    return this.filterUndo && !this.loading && !this.loadError ? this.browseMemory.capture(this.browseState(), this.hostElement.nativeElement) : null;
  }
  private offerFilterUndo(previous: BrowseVisit<TournamentBrowseState> | null): void {
    this.filterUndo?.offer(this, previous, this.browseState(), visit => {
      this.cancelScrollRestore?.();
      Object.assign(this, visit.state);
      this.showFilterModal = false;
      this.isFiltered = this.countActiveFilters(this.tournamentFilter) > 0;
      this.rebuildView();
      this.cancelScrollRestore = this.browseMemory.restore(this.hostElement.nativeElement, visit.scroll);
    });
  }

  ngOnInit(): void {
    this.releaseReadRecovery = this.recovery?.register(this, () => this.retryRead());
    document.addEventListener('keydown', this.escHandler);
    this.restoreSortPreference();
    this.restorePageSize();
    const saved = this.browseMemory.recall<TournamentBrowseState>('tournaments');
    if (saved) {
      Object.assign(this, saved.state);
      this.isFiltered = this.countActiveFilters(this.tournamentFilter) > 0;
      this.pendingScroll = saved.scroll;
    }

    this.loadIndex();
  }

  retryRead(): void { if (!this.loading && this.loadError) this.loadIndex(true); }
  private loadIndex(forceRefresh = false): void {
    this.indexRequest?.unsubscribe();
    this.recovery?.begin(this);
    this.loading = true;
    this.loadError = null;
    document.body.classList.add('bb-noscroll');

    this.indexRequest = (forceRefresh ? this.archives.getTournamentsIndex(true) : this.archives.getTournamentsIndex()).subscribe({
      next: (res: { items: TournamentIndex[]; strength: { min: number | null; median: number | null; max: number | null } | null }) => {
        this.allTournaments = res?.items ?? [];

        const s = res?.strength ?? null;
        this.strengthMin = (s && Number.isFinite(s.min as any)) ? (s.min as number) : null;
        this.strengthMedian = (s && Number.isFinite(s.median as any)) ? (s.median as number) : null;
        this.strengthMax = (s && Number.isFinite(s.max as any)) ? (s.max as number) : null;

        // API mode historically omitted tournamentStrength from the manifest even
        // though the index rows contain AverageMatchStrength. Derive the same
        // display scale from those rows so valid strength values do not render as
        // five empty stars.
        if (this.strengthMin == null || this.strengthMedian == null || this.strengthMax == null) {
          this.deriveStrengthScale(this.allTournaments);
        }

        this.rebuildView();

        this.loading = false;
        this.browseLoaded = true;
        document.body.classList.remove('bb-noscroll');
        if (this.pendingScroll) {
          this.cancelScrollRestore = this.browseMemory.restore(this.hostElement.nativeElement, this.pendingScroll);
          this.pendingScroll = null;
        }

        console.log('Tournaments index rows:', this.allTournaments.length);
        console.log('First row:', this.allTournaments[0]);
        console.log('Strength stats:', { min: this.strengthMin, median: this.strengthMedian, max: this.strengthMax });
      },
      error: (err: unknown) => {
        console.error(err);
        this.loadError = 'catalog.tournamentsLoadError';
        this.recovery?.unavailable(this);
        this.loading = false;
        document.body.classList.remove('bb-noscroll');
      }
    });
  }

  ngOnDestroy(): void {
    this.releaseReadRecovery?.();
    this.filterUndo?.cancel(this);
    if (this.browseLoaded) this.browseMemory.remember('tournaments', this.browseState(), this.hostElement.nativeElement);
    this.indexRequest?.unsubscribe();
    this.cancelScrollRestore?.();
    document.body.classList.remove('bb-noscroll');
    document.removeEventListener('keydown', this.escHandler);
  }

  // ---------- UI actions (players-like) ----------

  previousPage(): void {
    this.filterUndo?.cancel(this);
    if (this.currentPage <= 1) return;
    this.currentPage--;
    this.rebuildView();
    this.scrollToTop();
  }

  nextPage(): void {
    this.filterUndo?.cancel(this);
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.rebuildView();
    this.scrollToTop();
  }

  jump(delta: number): void {
    this.filterUndo?.cancel(this);
    const next = Math.min(this.totalPages, Math.max(1, this.currentPage + delta));
    if (next === this.currentPage) return;
    this.currentPage = next;
    this.rebuildView();
    this.scrollToTop();
  }

  onPageInputChange(event: Event): void {
    this.filterUndo?.cancel(this);
    const input = event.target as HTMLInputElement;
    const page = Number(input.value);
    if (!Number.isFinite(page)) return;

    const clamped = Math.max(1, Math.min(this.totalPages, page));
    this.currentPage = clamped;

    if (this.pageInputRef?.nativeElement) {
      this.pageInputRef.nativeElement.value = String(clamped);
    }

    this.rebuildView();
    this.scrollToTop();
  }

  onSearchInput(): void {
    this.filterUndo?.cancel(this);
    this.cancelScrollRestore?.();
    this.currentPage = 1;
    this.rebuildView();
  }

  clearSearch(): void {
    this.filterUndo?.cancel(this);
    this.cancelScrollRestore?.();
    this.searchTerm = '';
    this.currentPage = 1;
    this.rebuildView();
  }

  setPageSize(value: number | string): void {
    this.filterUndo?.cancel(this);
    const parsed = Number(value);
    if (!this.pageSizeOptions.includes(parsed)) return;

    this.pageSize = parsed;
    this.currentPage = 1;
    this.persistPageSize();
    this.rebuildView();
    this.scrollToTop();
  }

  get resultStart(): number {
    return this.filteredResultCount === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get resultEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredResultCount);
  }

  setQuickTourFilter(mode: 'all' | 'atp' | 'wta'): void {
    if (this.quickTourFilter === mode) return;
    const previous = this.beforeFilterChange();

    this.quickTourFilter = mode;
    this.currentPage = 1;
    this.rebuildView();
    this.scrollToTop();
    this.offerFilterUndo(previous);
  }

  get showTypeColumn(): boolean {
    return this.quickTourFilter === 'all';
  }

  toggleSort(field: SortField): void {
    this.filterUndo?.cancel(this);
    this.cancelScrollRestore?.();
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;

      // default sorting:
      // - name ASC
      // - other fields DESC so stronger, larger, or more recent values sort first
      this.sortDirection = (field === 'tournamentEventName') ? 'asc' : 'desc';
    }

    this.persistSortPreference();
    this.currentPage = 1;
    this.rebuildView();
  }

  private restoreSortPreference(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(TOURNAMENT_SORT_STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as { field?: unknown; direction?: unknown };
      if (
        typeof saved.field === 'string' &&
        TOURNAMENT_SORT_FIELDS.includes(saved.field as SortField) &&
        (saved.direction === 'asc' || saved.direction === 'desc')
      ) {
        this.sortField = saved.field as SortField;
        this.sortDirection = saved.direction;
      }
    } catch {
      // Invalid or unavailable browser storage falls back to Start descending.
    }
  }

  private persistSortPreference(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(TOURNAMENT_SORT_STORAGE_KEY, JSON.stringify({
        field: this.sortField,
        direction: this.sortDirection
      }));
    } catch {
      // Sorting still works for the current visit when storage is unavailable.
    }
  }

  private restorePageSize(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = Number(localStorage.getItem(TOURNAMENT_PAGE_SIZE_STORAGE_KEY));
      if (this.pageSizeOptions.includes(saved)) this.pageSize = saved;
    } catch {
      // Use the default page size when storage is unavailable.
    }
  }

  private persistPageSize(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(TOURNAMENT_PAGE_SIZE_STORAGE_KEY, String(this.pageSize));
    } catch {
      // Pagination remains usable for the current visit when storage is unavailable.
    }
  }

  openFilterModal(): void {
    this.showFilterModal = true;
  }

  closeFilterModal(): void {
    this.showFilterModal = false;
  }

  applyTournamentFilter(filter: TournamentFilterState): void {
    const previous = this.beforeFilterChange();
    this.tournamentFilter = { ...filter };
    this.isFiltered = this.countActiveFilters(filter) > 0;
    this.currentPage = 1;
    this.rebuildView();
    this.scrollToTop();
    this.offerFilterUndo(previous);
  }

  resetTournamentFilter(clearSearch = false): void {
    const previous = this.beforeFilterChange();
    if (clearSearch) { this.searchTerm = ''; this.quickTourFilter = 'all'; }
    this.tournamentFilter = { ...DEFAULT_TOURNAMENT_FILTER };
    this.isFiltered = false;
    this.currentPage = 1;
    this.rebuildView();
    this.scrollToTop();
    this.offerFilterUndo(previous);
  }

  get activeFilterCount(): number {
    return this.countActiveFilters(this.tournamentFilter);
  }

  openTournamentModal(tournament: TournamentIndex): void {
    console.log('🟢 openTournamentModal called', tournament);
    this.selectedTournament = tournament;
    console.log('🟢 selectedTournament set to', this.selectedTournament);
  }

  closeTournamentModal(): void {
    console.log('🔴 closeTournamentModal called');
    this.selectedTournament = null;
  }

  // ---------- pipeline: filter -> sort -> paginate ----------

  private rebuildView(): void {
    const filtered = this.applyFilter(this.allTournaments);
    const sorted = this.applySort(filtered);

    this.filteredResultCount = sorted.length;

    this.totalPages = Math.max(1, Math.ceil(sorted.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    this.tournaments = sorted.slice(start, start + this.pageSize);
  }

  rowNumber(indexOnPage: number): number {
    return (this.currentPage - 1) * this.pageSize + indexOnPage + 1;
  }

  private applyFilter(rows: TournamentIndex[]): TournamentIndex[] {
    const q = this.searchTerm.trim().toLowerCase();

    return rows.filter(t => {
      const type = (t.tournamentTypeName ?? '').trim().toLowerCase();
      if (this.quickTourFilter !== 'all' && type !== this.quickTourFilter) return false;

      const surface = this.normalizeSurfaceFilterValue(t.surfaceName);
      if (!this.tournamentFilter.surfaces.includes(surface)) return false;

      const qualification = this.isQualificationTournament(t.tournamentLevelId, t.tournamentLevelName);
      if (this.tournamentFilter.qualification === 'main' && qualification) return false;
      if (this.tournamentFilter.qualification === 'qualification' && !qualification) return false;

      const eventDate = this.parseTournamentDate(t.tournamentEventDate);
      const fromDate = this.parseDateBoundary(this.tournamentFilter.fromDate, false);
      const toDate = this.parseDateBoundary(this.tournamentFilter.toDate, true);
      if (fromDate != null && (!Number.isFinite(eventDate) || eventDate < fromDate)) return false;
      if (toDate != null && (!Number.isFinite(eventDate) || eventDate > toDate)) return false;

      if (!this.matchesStrengthFilter(t.strengthMeanTS, this.tournamentFilter.strengthMeanStars)) return false;
      if (!this.matchesStrengthFilter(t.averageMatchStrength, this.tournamentFilter.averageMatchStrengthStars)) return false;
      if (!this.matchesStrengthFilter(t.peakMatchStrength, this.tournamentFilter.peakMatchStrengthStars)) return false;

      if (!q) return true;

      const name = this.cleanTournamentName(t.tournamentEventName).toLowerCase();
      const iso3 = (t.countryISO3 ?? '').toLowerCase();
      const country = (t.countryFull ?? '').toLowerCase();
      return name.includes(q) || iso3.includes(q) || country.includes(q);
    });
  }

  private countActiveFilters(filter: TournamentFilterState): number {
    return Number(filter.surfaces.length < 5)
      + Number(filter.qualification !== 'all')
      + Number(!!filter.fromDate || !!filter.toDate)
      + Number(filter.strengthMeanStars.length < 6)
      + Number(filter.averageMatchStrengthStars.length < 6)
      + Number(filter.peakMatchStrengthStars.length < 6);
  }

  private matchesStrengthFilter(value: number | null | undefined, selectedStars: number[]): boolean {
    if (selectedStars.length === 6) return true;
    if (value == null || !Number.isFinite(value)) return false;
    return selectedStars.includes(Math.round(this.getStrengthStars(value)));
  }

  private parseDateBoundary(value: string | null, endOfDay: boolean): number | null {
    if (!value) return null;
    const timestamp = Date.parse(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  private parseTournamentDate(value: string | null | undefined): number {
    if (!value) return NaN;

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

    const local = /^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/.exec(value);
    if (local) return Date.UTC(Number(local[3]), Number(local[2]) - 1, Number(local[1]));

    return NaN;
  }

  private applySort(rows: TournamentIndex[]): TournamentIndex[] {
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    const num = (v: number | null | undefined) =>
      (typeof v === 'number' && Number.isFinite(v)) ? v : -Infinity;

    const str = (v: string | null | undefined) =>
      (v ?? '').toLowerCase();

    const dateMs = (iso: string | null | undefined) => {
      if (!iso) return -Infinity;
      const t = Date.parse(iso);
      return Number.isFinite(t) ? t : -Infinity;
    };

    return [...rows].sort((a, b) => {
      let va: number | string = '';
      let vb: number | string = '';

      switch (this.sortField) {
        case 'tournamentEventName':
          va = str(this.cleanTournamentName(a.tournamentEventName));
          vb = str(this.cleanTournamentName(b.tournamentEventName));
          break;

        case 'tournamentEventDate':
          va = dateMs(a.tournamentEventDate);
          vb = dateMs(b.tournamentEventDate);
          break;

        case 'tournamentTypeName':
          va = str(a.tournamentTypeName);
          vb = str(b.tournamentTypeName);
          break;

        case 'tournamentLevelName':
          va = str(a.tournamentLevelName);
          vb = str(b.tournamentLevelName);
          break;

        case 'surfaceName':
          va = str(a.surfaceName);
          vb = str(b.surfaceName);
          break;

        case 'prize':
          va = num(a.prize);
          vb = num(b.prize);
          break;

        case 'strengthMeanTS':
          va = num(a.strengthMeanTS);
          vb = num(b.strengthMeanTS);
          break;

        case 'numberOfMatches':
          va = num(a.totalMatches ?? a.numberOfMatches);
          vb = num(b.totalMatches ?? b.numberOfMatches);
          break;

        case 'strengthPlayers':
          va = num(a.strengthPlayers);
          vb = num(b.strengthPlayers);
          break;

        case 'averageMatchStrength':
          va = num(a.averageMatchStrength);
          vb = num(b.averageMatchStrength);
          break;

        case 'peakMatchStrength':
          va = num(a.peakMatchStrength);
          vb = num(b.peakMatchStrength);
          break;

        case 'dateOfLastMatch':
          va = dateMs(a.dateOfLastMatch);
          vb = dateMs(b.dateOfLastMatch);
          break;
      }

      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;

      // stabilan tie-breaker
      const ida = a.tournamentEventTPId ?? 0;
      const idb = b.tournamentEventTPId ?? 0;
      return ida - idb;
    });
  }

  // ---------- helpers ----------

  flagCode(iso2?: string | null): string {
    const c = (iso2 || '').toUpperCase().trim();
    if (!c || c === 'WD' || c === 'WLD' || c === 'XX' || c === 'XW' || c === '-') return 'UN';
    if (c === 'UK') return 'GB';
    return c;
  }

  formatNum(v?: number | null, digits = 2): string {
    if (v == null || !Number.isFinite(v)) return '';
    return this.regional.number(v, digits);
  }

  formatInteger(value: number): string {
    return this.regional.number(Math.max(0, Math.trunc(value)), 0, true);
  }

  formatDateMaybe(value?: string | null): string {
    return this.regional.date(value);
  }

  scrollToTop(): void {
    this.cancelScrollRestore?.();
    const wrapper = document.querySelector('.table-wrapper') as HTMLElement | null;
    if (!wrapper) return;
    wrapper.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  readonly stars = [1, 2, 3, 4, 5];

  starClass(starIndex: number, value: number): 'full' | 'half' | 'empty' {
    if (value >= starIndex) return 'full';
    if (value >= starIndex - 0.5) return 'half';
    return 'empty';
  }

  /**
   * Tournament stars are based on AverageMatchStrength,
   * normalized against min, median, and max from manifest.tournaments.json.
   */
  getStrengthStars(avg: number | null | undefined): number {
    if (avg == null || !Number.isFinite(avg)) return 0;

    const min = this.strengthMin;
    const med = this.strengthMedian;
    const max = this.strengthMax;

    if (min == null || med == null || max == null) return 0;
    if (!Number.isFinite(min) || !Number.isFinite(med) || !Number.isFinite(max)) return 0;
    if (max <= min) return 0;

    // clamp
    const x = Math.min(max, Math.max(min, avg));

    // piecewise scaling around median:
    // <= median => 0..2.5 stars
    // >  median => 2.5..5 stars
    let score01: number;
    if (x <= med) {
      const den = Math.max(1e-9, (med - min));
      score01 = 0.5 * (x - min) / den;
    } else {
      const den = Math.max(1e-9, (max - med));
      score01 = 0.5 + 0.5 * (x - med) / den;
    }

    const stars = score01 * 5;
    return Math.round(stars * 2) / 2; // half-star granularity
  }

  private deriveStrengthScale(rows: TournamentIndex[]): void {
    const values = rows
      .map(row => row.averageMatchStrength)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .sort((a, b) => a - b);

    if (values.length === 0) return;

    const middle = Math.floor(values.length / 2);
    this.strengthMin = values[0];
    this.strengthMedian = values.length % 2 === 0
      ? (values[middle - 1] + values[middle]) / 2
      : values[middle];
    this.strengthMax = values[values.length - 1];
  }

  formatTournamentLabel(
    name?: string | null,
    iso3?: string | null,
    countryFull?: string | null,
    levelId?: number | null,
    levelName?: string | null
  ): string {
    const n = this.cleanTournamentName(name);
    const country = (countryFull ?? '').trim();
    const iso = (iso3 ?? '').trim().toUpperCase();
  
    let base = n || country || iso || '';
  
    if (!base) return '';
    if (this.isQualificationTournament(levelId, levelName) && !/\s(?:Q|\(Q\))$/i.test(base)) {
      base = `${base} Q`;
    }
    if (!iso || iso === '0' || base === iso) return base;
  
    return `${base} (${iso})`;
  }

  surfaceIndicatorClass(value?: string | null): string {
    const normalized = (value ?? '').trim().toLowerCase();
    const surface = ['clay', 'grass', 'hard', 'carpet'].includes(normalized)
      ? normalized
      : 'unknown';

    return `surface-indicator--${surface}`;
  }

  private normalizeSurfaceFilterValue(value?: string | null): string {
    const normalized = (value ?? '').trim().toLowerCase();
    return ['clay', 'grass', 'hard', 'carpet'].includes(normalized)
      ? normalized
      : 'unknown';
  }

  private isQualificationTournament(levelId?: number | null, levelName?: string | null): boolean {
    if (levelId === 3) return true;

    const level = (levelName ?? '').trim().toLowerCase();
    return level === 'q'
      || level === 'qualification'
      || level === 'qualifications'
      || level === 'qualifying';
  }

  private cleanTournamentName(name?: string | null): string {
    return (name ?? '')
      .replace(/\s+(?:\([IVXLCDM]{1,6}\)|[IVXLCDM]{1,6})\s*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  openTournamentMatches(tournamentEventTPId: number): void {
    console.log('🧭 openTournamentMatches called', { tournamentEventTPId });
  
    this.selectedTournament = null;
  
    this.router.navigate(['/tournaments/matches', tournamentEventTPId])
      .then(ok => {
        console.log('✅ tournament matches navigate resolved:', ok, 'new url:', this.router.url);
        if (!ok) {
          console.warn('⚠️ tournament matches navigate returned false');
        }
      })
      .catch(err => {
        console.error('❌ tournament matches navigate failed:', err);
      });
  }

  formatPrize(v?: number | null): string {
    return this.regional.usd(v);
  }

  formatSurface(value?: string | null): string {
    const v = (value ?? '').trim();
    if (!v) return '';
  
    if (v.toLowerCase() === 'unknown') return '';
    const key = v.toLowerCase();
    return ['clay', 'grass', 'hard', 'carpet'].includes(key)
      ? this.regional.text('surfaces.' + key).toUpperCase()
      : v.toUpperCase();
  }
}
