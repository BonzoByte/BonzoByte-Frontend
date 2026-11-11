import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { maskRegionalDateInput, parseRegionalDate, UiLocale } from '../../../core/i18n/regional-format';
import { RegionalSettingsService } from '../../../core/services/regional-settings.service';
import { BbModalShellComponent } from '../../../shared/ui/bb-modal-shell.component/bb-modal-shell.component';

export type TournamentQualificationFilter = 'all' | 'main' | 'qualification';
export type TournamentStrengthFilterKey =
  | 'strengthMeanStars'
  | 'averageMatchStrengthStars'
  | 'peakMatchStrengthStars';

const ALL_STRENGTH_STARS = [0, 1, 2, 3, 4, 5];
const ALL_TOURNAMENT_SURFACES = ['clay', 'grass', 'hard', 'carpet', 'unknown'];

export interface TournamentFilterState {
  surfaces: string[];
  qualification: TournamentQualificationFilter;
  fromDate: string | null;
  toDate: string | null;
  strengthMeanStars: number[];
  averageMatchStrengthStars: number[];
  peakMatchStrengthStars: number[];
}

export const DEFAULT_TOURNAMENT_FILTER: TournamentFilterState = {
  surfaces: [...ALL_TOURNAMENT_SURFACES],
  qualification: 'all',
  fromDate: null,
  toDate: null,
  strengthMeanStars: [...ALL_STRENGTH_STARS],
  averageMatchStrengthStars: [...ALL_STRENGTH_STARS],
  peakMatchStrengthStars: [...ALL_STRENGTH_STARS]
};

@Component({
  selector: 'app-tournament-filter-modal',
  standalone: true,
  templateUrl: './tournament-filter-modal.component.html',
  imports: [CommonModule, FormsModule, BbModalShellComponent, TranslateModule]
})
export class TournamentFilterModalComponent implements OnChanges, OnInit, OnDestroy {
  @Input() activeFilter: TournamentFilterState = { ...DEFAULT_TOURNAMENT_FILTER };

  @Output() closed = new EventEmitter<void>();
  @Output() filterApplied = new EventEmitter<TournamentFilterState>();
  @Output() resetFilter = new EventEmitter<void>();

  readonly surfaces = [
    { value: 'clay', label: 'Clay', indicator: 'clay' },
    { value: 'grass', label: 'Grass', indicator: 'grass' },
    { value: 'hard', label: 'Hard', indicator: 'hard' },
    { value: 'carpet', label: 'Carpet', indicator: 'carpet' },
    { value: 'unknown', label: 'Unknown', indicator: 'unknown' }
  ];

  readonly strengthOptions = ALL_STRENGTH_STARS;

  draft: TournamentFilterState = { ...DEFAULT_TOURNAMENT_FILTER };
  fromDateText = '';
  toDateText = '';
  fromDateTouched = false;
  toDateTouched = false;
  errorMessage = '';
  private languageSubscription?: Subscription;

  constructor(public regional: RegionalSettingsService) {}

  ngOnInit(): void {
    let entryLocale = this.regional.locale();
    this.languageSubscription = this.regional.changes.subscribe(() => {
      // Reformat valid calendar dates only. Preserve unfinished/invalid user input and draft choices.
      this.fromDateText = this.reformatDateText(this.fromDateText, entryLocale);
      this.toDateText = this.reformatDateText(this.toDateText, entryLocale);
      entryLocale = this.regional.locale();
    });
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
  }

  private reformatDateText(text: string, sourceLocale: UiLocale): string {
    const parsed = text.trim() ? (parseRegionalDate(text, sourceLocale, true) ?? undefined) : null;
    return parsed === undefined ? text : this.formatDateText(parsed);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeFilter']) {
      this.draft = this.cloneFilter(this.activeFilter);
      this.fromDateText = this.formatDateText(this.draft.fromDate);
      this.toDateText = this.formatDateText(this.draft.toDate);
      this.fromDateTouched = false;
      this.toDateTouched = false;
      this.errorMessage = '';
    }
  }

  close(): void {
    this.closed.emit();
  }

  apply(fromDateText = this.fromDateText, toDateText = this.toDateText): void {
    this.fromDateText = fromDateText;
    this.toDateText = toDateText;
    this.fromDateTouched = true;
    this.toDateTouched = true;
    const fromDate = this.parseDateText(this.fromDateText);
    const toDate = this.parseDateText(this.toDateText);

    if (fromDate === undefined) {
      this.errorMessage = 'catalog.invalidFrom';
      return;
    }
    if (toDate === undefined) {
      this.errorMessage = 'catalog.invalidTo';
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      this.errorMessage = 'catalog.invalidRange';
      return;
    }

    this.errorMessage = '';
    this.draft.fromDate = fromDate;
    this.draft.toDate = toDate;

    this.filterApplied.emit(this.cloneFilter(this.draft));
    this.closed.emit();
  }

  reset(): void {
    this.draft = this.cloneFilter(DEFAULT_TOURNAMENT_FILTER);
    this.fromDateText = '';
    this.toDateText = '';
    this.fromDateTouched = false;
    this.toDateTouched = false;
    this.errorMessage = '';
    this.resetFilter.emit();
    this.closed.emit();
  }

  toggleSurface(surface: string): void {
    const selected = this.draft.surfaces;
    if (selected.includes(surface) && selected.length === 1) return;

    this.draft = {
      ...this.draft,
      surfaces: selected.includes(surface)
        ? selected.filter(value => value !== surface)
        : [...selected, surface]
    };
  }

  get areAllSurfacesSelected(): boolean {
    return ALL_TOURNAMENT_SURFACES.every(surface => this.draft.surfaces.includes(surface));
  }

  get areSomeSurfacesSelected(): boolean {
    return this.draft.surfaces.length > 0 && !this.areAllSurfacesSelected;
  }

  toggleAllSurfaces(): void {
    this.draft = { ...this.draft, surfaces: [...ALL_TOURNAMENT_SURFACES] };
  }

  isLastSurfaceSelected(surface: string): boolean {
    return this.draft.surfaces.length === 1 && this.draft.surfaces[0] === surface;
  }

  toggleStrength(key: TournamentStrengthFilterKey, star: number): void {
    const selected = this.draft[key];
    if (selected.includes(star) && selected.length === 1) return;

    this.draft = {
      ...this.draft,
      [key]: selected.includes(star)
        ? selected.filter(value => value !== star)
        : [...selected, star].sort((a, b) => a - b)
    };
  }

  isLastStrengthSelected(key: TournamentStrengthFilterKey, star: number): boolean {
    const selected = this.draft[key];
    return selected.length === 1 && selected[0] === star;
  }

  normalizeDateText(boundary: 'from' | 'to'): void {
    const text = boundary === 'from' ? this.fromDateText : this.toDateText;
    const parsed = this.parseDateText(text);
    if (boundary === 'from') this.fromDateTouched = true;
    else this.toDateTouched = true;

    if (parsed === undefined) {
      this.errorMessage = boundary === 'from' ? 'catalog.invalidFrom' : 'catalog.invalidTo';
      return;
    }

    const normalized = this.formatDateText(parsed);
    if (boundary === 'from') {
      this.fromDateText = normalized;
      this.draft.fromDate = parsed;
    } else {
      this.toDateText = normalized;
      this.draft.toDate = parsed;
    }

    this.validateDateRange();
  }

  onDateTextChange(boundary: 'from' | 'to', value: string): void {
    const formatted = maskRegionalDateInput(value, this.regional.locale(), true);
    this.updateDateTextAndDraft(boundary, formatted);
    this.errorMessage = '';
  }

  onDateTextKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;

    const input = event.target as HTMLInputElement;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    if (start !== end) return;

    const separatorIndex = event.key === 'Backspace' ? start - 1 : start;
    if (separatorIndex < 0 || !['.', '/', '-'].includes(input.value[separatorIndex])) return;

    event.preventDefault();
    const nextCaret = event.key === 'Backspace' ? Math.max(0, start - 1) : Math.min(input.value.length, start + 1);
    input.setSelectionRange(nextCaret, nextCaret);
  }

  openDatePicker(input: HTMLInputElement): void {
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  }

  selectNativeDate(boundary: 'from' | 'to', value: string | null): void {
    const iso = value || null;
    if (boundary === 'from') {
      this.draft.fromDate = iso;
      this.fromDateText = this.formatDateText(iso);
      this.fromDateTouched = true;
    } else {
      this.draft.toDate = iso;
      this.toDateText = this.formatDateText(iso);
      this.toDateTouched = true;
    }
    this.validateDateRange();
  }

  get fromDateInvalid(): boolean {
    return this.fromDateTouched && this.parseDateText(this.fromDateText) === undefined;
  }

  get toDateInvalid(): boolean {
    return this.toDateTouched && this.parseDateText(this.toDateText) === undefined;
  }

  private validateDateRange(): void {
    const fromDate = this.parseDateText(this.fromDateText);
    const toDate = this.parseDateText(this.toDateText);

    if (fromDate === undefined || toDate === undefined) return;
    this.errorMessage = fromDate && toDate && fromDate > toDate
      ? 'catalog.invalidRange'
      : '';
  }

  private updateDateTextAndDraft(boundary: 'from' | 'to', text: string): void {
    const parsed = this.parseDateText(text);
    if (boundary === 'from') {
      this.fromDateText = text;
      this.draft.fromDate = parsed === undefined ? null : parsed;
    } else {
      this.toDateText = text;
      this.draft.toDate = parsed === undefined ? null : parsed;
    }
  }

  private cloneFilter(filter: TournamentFilterState): TournamentFilterState {
    return {
      ...DEFAULT_TOURNAMENT_FILTER,
      ...filter,
      surfaces: [...(filter.surfaces?.length ? filter.surfaces : ALL_TOURNAMENT_SURFACES)],
      strengthMeanStars: [...(filter.strengthMeanStars ?? ALL_STRENGTH_STARS)],
      averageMatchStrengthStars: [...(filter.averageMatchStrengthStars ?? ALL_STRENGTH_STARS)],
      peakMatchStrengthStars: [...(filter.peakMatchStrengthStars ?? ALL_STRENGTH_STARS)]
    };
  }

  private formatDateText(value: string | null): string {
    return this.regional.dateInput(value);
  }

  private parseDateText(value: string): string | null | undefined {
    if (!value.trim()) return null;
    return parseRegionalDate(value, this.regional.locale(), true) ?? undefined;
  }
}
