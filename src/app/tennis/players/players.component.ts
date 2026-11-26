import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, OnDestroy, OnInit, Optional, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { PlayerIndex } from '../../core/models/tennis.model';
import {
  DEFAULT_PLAYER_FILTER,
  PlayerCountryOption,
  PlayerFilterModalComponent,
  PlayerFilterState
} from './player-filter-modal/player-filter-modal.component';
import { PlayerModalComponent } from './player-modal/player-modal.component';
import { TranslateModule } from '@ngx-translate/core';
import { RegionalSettingsService } from '../../core/services/regional-settings.service';
import { BrowseMemoryService, BrowseScroll, BrowseVisit } from '../../core/services/browse-memory.service';
import { FilterUndoService } from '../../core/services/filter-undo.service';
import { ReadRecoveryService } from '../../core/services/read-recovery.service';
import { ViewRecoveryActionsComponent } from '../../shared/ui/view-recovery-actions/view-recovery-actions.component';
import { Subscription } from 'rxjs';

type PlayerBrowseState = Pick<PlayersComponent, 'currentPage' | 'pageSize' | 'searchTerm' | 'playerFilter' | 'sortField' | 'sortDirection'>;

const PLAYER_PAGE_SIZE_STORAGE_KEY = 'bonzobyte.players.page-size.v1';

@Component({
  selector: 'app-players',
  standalone: true,
  templateUrl: './players.component.html',
  styleUrls: ['./players.component.scss'],
  imports: [
    ViewRecoveryActionsComponent,
    CommonModule,
    TranslateModule,
    FormsModule,
    NgbDatepickerModule,
    PlayerModalComponent,
    PlayerFilterModalComponent
  ],
  encapsulation: ViewEncapsulation.None
})
export class PlayersComponent implements OnInit, OnDestroy {

  // raw + view
  allPlayers: PlayerIndex[] = [];
  players: PlayerIndex[] = []; // Current page rendered by the table.

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
  playerFilter: PlayerFilterState = { ...DEFAULT_PLAYER_FILTER };
  availableCountries: PlayerCountryOption[] = [];
  private latestPlayerActivityMs: number | null = null;

  // search
  searchTerm = '';

  // sorting
  sortField:
    | 'playerName'
    | 'playerBirthDate'
    | 'averageTSMean'
    | 'peakTsMean'
    | 'currentTsMean'
    | 'numberOfMatches'
    | 'winPercentage'
    | 'dateOfLastMatch'
    = 'averageTSMean';

  sortDirection: 'asc' | 'desc' = 'desc';

  // modal
  selectedPlayer: PlayerIndex | null = null;

  // ESC close
  private escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.selectedPlayer) this.closePlayerModal();
      if (this.showFilterModal) this.closeFilterModal();
    }
  };

  @ViewChild('pageInput') pageInputRef!: ElementRef<HTMLInputElement>;

  private indexRequest?: Subscription;
  private pendingScroll: BrowseScroll | null = null;
  private cancelScrollRestore?: () => void;
  private browseLoaded = false;

  constructor(private archives: StaticArchivesService, public regional: RegionalSettingsService,
    private browseMemory: BrowseMemoryService = new BrowseMemoryService(),
    private hostElement: ElementRef<HTMLElement> = new ElementRef(document.createElement('div')),
    @Optional() @Inject(FilterUndoService) private filterUndo: FilterUndoService | null = null,
    @Optional() @Inject(ReadRecoveryService) private recovery: ReadRecoveryService | null = null) { }
  private releaseReadRecovery?: () => void;

  private browseState(): PlayerBrowseState {
    return { currentPage: this.currentPage, pageSize: this.pageSize, searchTerm: this.searchTerm,
      playerFilter: this.playerFilter, sortField: this.sortField, sortDirection: this.sortDirection };
  }
  private beforeFilterChange(): BrowseVisit<PlayerBrowseState> | null {
    this.cancelScrollRestore?.();
    this.pendingScroll = null;
    return this.filterUndo && !this.loading && !this.loadError ? this.browseMemory.capture(this.browseState(), this.hostElement.nativeElement) : null;
  }
  private offerFilterUndo(previous: BrowseVisit<PlayerBrowseState> | null): void {
    this.filterUndo?.offer(this, previous, this.browseState(), visit => {
      this.cancelScrollRestore?.();
      Object.assign(this, visit.state);
      this.showFilterModal = false;
      this.isFiltered = this.countActiveFilters(this.playerFilter) > 0;
      this.rebuildView();
      this.cancelScrollRestore = this.browseMemory.restore(this.hostElement.nativeElement, visit.scroll);
    });
  }

  ngOnInit(): void {
    this.releaseReadRecovery = this.recovery?.register(this, () => this.retryRead());
    document.addEventListener('keydown', this.escHandler);
    this.restorePageSize();
    const saved = this.browseMemory.recall<PlayerBrowseState>('players');
    if (saved) {
      Object.assign(this, saved.state);
      this.isFiltered = this.countActiveFilters(this.playerFilter) > 0;
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

    this.indexRequest = (forceRefresh ? this.archives.getPlayersIndex(true) : this.archives.getPlayersIndex()).subscribe({
      next: (rows: PlayerIndex[]) => {
        this.allPlayers = rows ?? [];
        this.availableCountries = this.buildCountryOptions(this.allPlayers);
        this.latestPlayerActivityMs = this.findLatestDate(this.allPlayers.map(player => player.dateOfLastMatch));
        this.rebuildView();
        this.loading = false;
        this.browseLoaded = true;
        document.body.classList.remove('bb-noscroll');
        if (this.pendingScroll) {
          this.cancelScrollRestore = this.browseMemory.restore(this.hostElement.nativeElement, this.pendingScroll);
          this.pendingScroll = null;
        }

        console.log('Players index rows:', this.allPlayers.length);
        console.log('First row:', this.allPlayers[0]);
      },
      error: (err: unknown) => {
        console.error(err);
        this.loadError = 'catalog.playersLoadError';
        this.recovery?.unavailable(this);
        this.loading = false;
        document.body.classList.remove('bb-noscroll');
      }
    });
  }

  ngOnDestroy(): void {
    this.releaseReadRecovery?.();
    this.filterUndo?.cancel(this);
    if (this.browseLoaded) this.browseMemory.remember('players', this.browseState(), this.hostElement.nativeElement);
    this.indexRequest?.unsubscribe();
    this.cancelScrollRestore?.();
    document.body.classList.remove('bb-noscroll');
    document.removeEventListener('keydown', this.escHandler);
  }

  // ---------- UI actions (matches-like) ----------

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

    // Synchronize the DOM control after clamping invalid values.
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

  toggleSort(field: typeof this.sortField): void {
    this.filterUndo?.cancel(this);
    this.cancelScrollRestore?.();
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = (field === 'playerName') ? 'asc' : 'desc';
    }
    this.currentPage = 1;
    this.rebuildView();
  }

  openFilterModal(): void {
    this.showFilterModal = true;
  }

  closeFilterModal(): void {
    this.showFilterModal = false;
  }

  applyPlayerFilter(filter: PlayerFilterState): void {
    const previous = this.beforeFilterChange();
    this.playerFilter = { ...filter };
    this.isFiltered = this.countActiveFilters(filter) > 0;
    this.currentPage = 1;
    this.rebuildView();
    this.scrollToTop();
    this.offerFilterUndo(previous);
  }

  resetPlayerFilter(clearSearch = false): void {
    const previous = this.beforeFilterChange();
    if (clearSearch) this.searchTerm = '';
    this.playerFilter = { ...DEFAULT_PLAYER_FILTER };
    this.isFiltered = false;
    this.currentPage = 1;
    this.rebuildView();
    this.scrollToTop();
    this.offerFilterUndo(previous);
  }

  get activeFilterCount(): number {
    return this.countActiveFilters(this.playerFilter);
  }

  openPlayerModal(player: PlayerIndex): void {
    this.selectedPlayer = player;
  }

  closePlayerModal(): void {
    this.selectedPlayer = null;
  }

  // ---------- pipeline: filter -> sort -> paginate ----------

  private rebuildView(): void {
    const filtered = this.applyFilter(this.allPlayers);
    const sorted = this.applySort(filtered);

    this.filteredResultCount = sorted.length;

    this.totalPages = Math.max(1, Math.ceil(sorted.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    this.players = sorted.slice(start, start + this.pageSize);
  }

  rowNumber(indexOnPage: number): number {
    return (this.currentPage - 1) * this.pageSize + indexOnPage + 1;
  }

  private applyFilter(rows: PlayerIndex[]): PlayerIndex[] {
    const q = this.searchTerm.trim().toLowerCase();
    const activityCutoff = this.activityCutoffMs(this.playerFilter.activityMonths);

    return rows.filter(player => {
      if (q) {
        const name = (player.playerName ?? '').toLowerCase();
        const country = (player.countryFull ?? '').toLowerCase();
        const iso3 = (player.countryISO3 ?? '').toLowerCase();
        if (!name.includes(q) && !country.includes(q) && !iso3.includes(q)) return false;
      }

      if (this.playerFilter.countryISO3 &&
        (player.countryISO3 ?? '').toUpperCase() !== this.playerFilter.countryISO3.toUpperCase()) return false;
      if ((player.totalMatches ?? player.numberOfMatches ?? 0) < this.playerFilter.minimumMatches) return false;

      const hasTs = [player.averageTSMean, player.peakTsMean, player.currentTsMean]
        .some(value => typeof value === 'number' && Number.isFinite(value));
      if (this.playerFilter.tsAvailability === 'with' && !hasTs) return false;
      if (this.playerFilter.tsAvailability === 'without' && hasTs) return false;

      if (activityCutoff != null) {
        const lastMatch = player.dateOfLastMatch ? Date.parse(player.dateOfLastMatch) : NaN;
        if (!Number.isFinite(lastMatch) || lastMatch < activityCutoff) return false;
      }

      return true;
    });
  }

  private countActiveFilters(filter: PlayerFilterState): number {
    return Number(!!filter.countryISO3)
      + Number(filter.minimumMatches > 0)
      + Number(filter.tsAvailability !== 'all')
      + Number(filter.activityMonths != null);
  }

  private activityCutoffMs(months: number | null): number | null {
    if (months == null || this.latestPlayerActivityMs == null) return null;
    const cutoff = new Date(this.latestPlayerActivityMs);
    cutoff.setMonth(cutoff.getMonth() - months);
    return cutoff.getTime();
  }

  private findLatestDate(values: Array<string | null | undefined>): number | null {
    const timestamps = values
      .map(value => value ? Date.parse(value) : NaN)
      .filter(Number.isFinite);
    return timestamps.length ? Math.max(...timestamps) : null;
  }

  private buildCountryOptions(rows: PlayerIndex[]): PlayerCountryOption[] {
    const countries = new Map<string, string>();
    for (const player of rows) {
      const iso3 = (player.countryISO3 ?? '').trim().toUpperCase();
      if (!iso3 || iso3 === '0') continue;
      countries.set(iso3, (player.countryFull ?? '').trim() || iso3);
    }
    return [...countries.entries()]
      .map(([iso3, name]) => ({ iso3, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private restorePageSize(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = Number(localStorage.getItem(PLAYER_PAGE_SIZE_STORAGE_KEY));
      if (this.pageSizeOptions.includes(saved)) this.pageSize = saved;
    } catch {
      // Use the default page size when storage is unavailable.
    }
  }

  private persistPageSize(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(PLAYER_PAGE_SIZE_STORAGE_KEY, String(this.pageSize));
    } catch {
      // Pagination remains usable for the current visit when storage is unavailable.
    }
  }

  private applySort(rows: PlayerIndex[]): PlayerIndex[] {
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
        case 'playerName':
          va = str(a.playerName);
          vb = str(b.playerName);
          break;
        case 'playerBirthDate':
          va = dateMs(a.playerBirthDate);
          vb = dateMs(b.playerBirthDate);
          break;
        case 'dateOfLastMatch':
          va = dateMs(a.dateOfLastMatch);
          vb = dateMs(b.dateOfLastMatch);
          break;
        case 'averageTSMean':
          va = num(a.averageTSMean);
          vb = num(b.averageTSMean);
          break;
        case 'peakTsMean':
          va = num(a.peakTsMean);
          vb = num(b.peakTsMean);
          break;
        case 'currentTsMean':
          va = num(a.currentTsMean);
          vb = num(b.currentTsMean);
          break;
        case 'numberOfMatches':
          va = num(a.totalMatches ?? a.numberOfMatches);
          vb = num(b.totalMatches ?? b.numberOfMatches);
          break;
        case 'winPercentage':
          va = num(a.winPercentage);
          vb = num(b.winPercentage);
          break;
      }

      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;

      // ✅ stabilan tie-breaker
      const ida = a.playerTPId ?? 0;
      const idb = b.playerTPId ?? 0;
      return ida - idb;
    });
  }

  // ---------- helpers (reuse from matches vibe) ----------

  flagCode(iso2?: string | null): string {
    const c = (iso2 || '').toUpperCase().trim();
    if (!c || c === 'WD' || c === 'WLD' || c === 'XX' || c === 'XW' || c === '-') return 'UN';
    if (c === 'UK') return 'GB';
    return c;
  }

  formatWinPct(v?: number | null): string {
    if (v == null || !Number.isFinite(v)) return '';
    return `${this.regional.number(v * 100, 2)} %`;
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
    // Also reset window scrolling when the wrapper is not the scroll container.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  readonly stars = [1, 2, 3, 4, 5];

  starClass(starIndex: number, value: number): 'full' | 'half' | 'empty' {
    if (value >= starIndex) return 'full';
    if (value >= starIndex - 0.5) return 'half';
    return 'empty';
  }

    // Keep strength calibration consistent with the matches view.
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

  formatPlayerLabel(name?: string | null, iso3?: string | null): string {
    const n = (name ?? '').trim();
    const iso = (iso3 ?? '').trim().toUpperCase();
  
    if (!n) return '';
    if (!iso || iso === '0') return n;
  
    return `${n} (${iso})`;
  }  
}
