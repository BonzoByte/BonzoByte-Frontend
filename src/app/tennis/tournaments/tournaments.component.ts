/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { TournamentIndex } from '../../core/models/tennis.model';
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

@Component({
  selector: 'app-tournaments',
  standalone: true,
  templateUrl: './tournaments.component.html',
  styleUrls: ['./tournaments.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    NgbDatepickerModule,
    // TournamentModalComponent,
    // TournamentFilterModalComponent
  ],
  encapsulation: ViewEncapsulation.None
})
export class TournamentsComponent implements OnInit, OnDestroy {

  // raw + view
  allTournaments: TournamentIndex[] = [];
  tournaments: TournamentIndex[] = []; // paged lista za prikaz

  // paging
  currentPage = 1;
  pageSize = 100;
  totalPages = 1;

  // ui
  loading = false;
  showFilterModal = false;
  isFiltered = false;

  // search
  searchTerm = '';

  // sorting
  sortField: SortField = 'tournamentEventName';
  sortDirection: 'asc' | 'desc' = 'asc';

  // modal (kasnije)
  selectedTournament: number | null = null;

  // strength stats for stars (from manifest)
  // fallbackovi su sigurni (da UI ne pukne ako stats izostanu)
  private strengthMin: number | null = null;
  private strengthMedian: number | null = null;
  private strengthMax: number | null = null;

  // ESC close
  private escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.selectedTournament) this.closeTournamentModal();
      if (this.showFilterModal) this.closeFilterModal();
    }
  };

  @ViewChild('pageInput') pageInputRef!: ElementRef<HTMLInputElement>;

  constructor(private archives: StaticArchivesService) { }

  ngOnInit(): void {
    document.addEventListener('keydown', this.escHandler);

    this.loading = true;
    document.body.classList.add('bb-noscroll');

    this.archives.getTournamentsIndex().subscribe({
      next: (res: { items: TournamentIndex[]; strength: { min: number | null; median: number | null; max: number | null } | null }) => {
        this.allTournaments = res?.items ?? [];

        const s = res?.strength ?? null;
        this.strengthMin = (s && Number.isFinite(s.min as any)) ? (s.min as number) : null;
        this.strengthMedian = (s && Number.isFinite(s.median as any)) ? (s.median as number) : null;
        this.strengthMax = (s && Number.isFinite(s.max as any)) ? (s.max as number) : null;

        this.currentPage = 1;
        this.rebuildView();

        this.loading = false;
        document.body.classList.remove('bb-noscroll');

        console.log('Tournaments index rows:', this.allTournaments.length);
        console.log('First row:', this.allTournaments[0]);
        console.log('Strength stats:', { min: this.strengthMin, median: this.strengthMedian, max: this.strengthMax });
      },
      error: (err: unknown) => {
        console.error(err);
        this.loading = false;
        document.body.classList.remove('bb-noscroll');
      }
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.escHandler);
  }

  // ---------- UI actions (players-like) ----------

  previousPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage--;
    this.rebuildView();
    this.scrollToTop();
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    this.rebuildView();
    this.scrollToTop();
  }

  jump(delta: number): void {
    const next = Math.min(this.totalPages, Math.max(1, this.currentPage + delta));
    if (next === this.currentPage) return;
    this.currentPage = next;
    this.rebuildView();
    this.scrollToTop();
  }

  onPageInputChange(event: Event): void {
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
    this.currentPage = 1;
    this.rebuildView();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.rebuildView();
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;

      // default sorting:
      // - name ASC
      // - ostalo DESC (da “strong/big/recent” ide gore)
      this.sortDirection = (field === 'tournamentEventName') ? 'asc' : 'desc';
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

  openTournamentModal(tournamentEventTPId: number): void {
    this.selectedTournament = tournamentEventTPId;
  }

  closeTournamentModal(): void {
    this.selectedTournament = null;
  }

  // ---------- pipeline: filter -> sort -> paginate ----------

  private rebuildView(): void {
    const filtered = this.applyFilter(this.allTournaments);
    const sorted = this.applySort(filtered);

    this.totalPages = Math.max(1, Math.ceil(sorted.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    this.tournaments = sorted.slice(start, start + this.pageSize);
  }

  private applyFilter(rows: TournamentIndex[]): TournamentIndex[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter(t => {
      const name = (t.tournamentEventName ?? '').toLowerCase();
      const iso3 = (t.countryISO3 ?? '').toLowerCase();
      const country = (t.countryFull ?? '').toLowerCase();
      return name.includes(q) || iso3.includes(q) || country.includes(q);
    });
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
          va = str(a.tournamentEventName);
          vb = str(b.tournamentEventName);
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
          va = num(a.numberOfMatches);
          vb = num(b.numberOfMatches);
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
    return v.toFixed(digits);
  }

  formatDateMaybe(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  scrollToTop(): void {
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
   * Zvjezdice za turnir: temeljeno na AverageMatchStrength,
   * normalizirano prema (min/median/max) iz manifest.tournaments.json.
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

  formatTournamentLabel(name?: string | null, iso3?: string | null): string {
    const n = (name ?? '').trim();
    const iso = (iso3 ?? '').trim().toUpperCase();

    if (!n) return '';
    if (!iso || iso === '0') return n;

    return `${n} (${iso})`;
  }
}