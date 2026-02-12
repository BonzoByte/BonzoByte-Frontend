import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { StaticArchivesService } from '../../core/services/static-archives.service';
import { PlayerIndex } from '../../core/models/tennis.model';
import { PlayerFilterModalComponent } from './player-filter-modal/player-filter-modal.component';
import { PlayerModalComponent } from './player-modal/player-modal.component';

@Component({
  selector: 'app-players',
  standalone: true,
  templateUrl: './players.component.html',
  styleUrls: ['./players.component.scss'],
  imports: [
    CommonModule,
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
  players: PlayerIndex[] = []; // ovo je "paged" lista za prikaz

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
  sortField:
    | 'playerName'
    | 'playerBirthDate'
    | 'averageTSMean'
    | 'peakTsMean'
    | 'currentTsMean'
    | 'numberOfMatches'
    | 'winPercentage'
    | 'dateOfLastMatch'
    = 'playerName';

  sortDirection: 'asc' | 'desc' = 'asc';

  // modal
  selectedPlayer: number | null = null;

  // ESC close
  private escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.selectedPlayer) this.closePlayerModal();
      if (this.showFilterModal) this.closeFilterModal();
    }
  };

  @ViewChild('pageInput') pageInputRef!: ElementRef<HTMLInputElement>;

  constructor(private archives: StaticArchivesService) { }

  ngOnInit(): void {
    document.addEventListener('keydown', this.escHandler);

    this.loading = true;
    document.body.classList.add('bb-noscroll');

    this.archives.getPlayersIndex().subscribe({
      next: (rows: PlayerIndex[]) => {
        this.allPlayers = rows ?? [];
        this.currentPage = 1;
        this.rebuildView();
        this.loading = false;
        document.body.classList.remove('bb-noscroll');

        console.log('Players index rows:', this.allPlayers.length);
        console.log('First row:', this.allPlayers[0]);
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

  // ---------- UI actions (matches-like) ----------

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

    // sync DOM (da nema “glupih” vrijednosti)
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

  toggleSort(field: typeof this.sortField): void {
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

  openPlayerModal(playerTPId: number): void {
    this.selectedPlayer = playerTPId;
  }

  closePlayerModal(): void {
    this.selectedPlayer = null;
  }

  // ---------- pipeline: filter -> sort -> paginate ----------

  private rebuildView(): void {
    const filtered = this.applyFilter(this.allPlayers);
    const sorted = this.applySort(filtered);

    this.totalPages = Math.max(1, Math.ceil(sorted.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    this.players = sorted.slice(start, start + this.pageSize);
  }

  private applyFilter(rows: PlayerIndex[]): PlayerIndex[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter(p => (p.playerName ?? '').toLowerCase().includes(q));
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
          va = num(a.numberOfMatches);
          vb = num(b.numberOfMatches);
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
    return `${(v * 100).toFixed(1)}%`;
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
    // i window scroll (ako ti wrapper nije scroll container)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  readonly stars = [1, 2, 3, 4, 5];

  starClass(starIndex: number, value: number): 'full' | 'half' | 'empty' {
    if (value >= starIndex) return 'full';
    if (value >= starIndex - 0.5) return 'half';
    return 'empty';
  }

  // kalibracija (isti osjećaj kao matches); po potrebi ćemo fino dotjerati
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