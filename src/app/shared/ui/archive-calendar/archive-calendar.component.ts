import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { dayAt } from '../../../core/i18n/archive-day-window';
import { RegionalSettingsService } from '../../../core/services/regional-settings.service';

type CalendarView = 'days' | 'months' | 'years';
interface CalendarDay { iso: string; number: number; outside: boolean; disabled: boolean; }
const isoDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

/** A small, client-side date navigator. Selecting a date never writes archive data. */
@Component({
  selector: 'app-archive-calendar', standalone: true, imports: [CommonModule],
  templateUrl: './archive-calendar.component.html', styleUrl: './archive-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArchiveCalendarComponent implements OnChanges {
  @Input() selectedISO = '';
  @Input() minISO = '';
  @Input() maxISO = '';
  @Input() availableDates: readonly string[] = [];
  @Input() disabled = false;
  @Output() dateSelected = new EventEmitter<string>();
  @Output() todayRequested = new EventEmitter<void>();
  @ViewChild('toggle') toggle?: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  open = false;
  view: CalendarView = 'days';
  year = 2026;
  month = 0;
  todayISO = '';
  focusISO = '';
  days: CalendarDay[] = [];
  left = 8;
  top = 0;
  maxHeight = 420;
  private available = new Set<string>();
  private frame = 0;
  private movingFocus = false;
  readonly monthNames = computed(() => {
    const format = new Intl.DateTimeFormat(this.regional.locale(), { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, month) => format.format(new Date(Date.UTC(2024, month, 1))));
  });
  readonly firstWeekday = computed(() => ['en-US', 'pt-BR', 'ja-JP'].includes(this.regional.locale()) ? 0 : 1);
  readonly weekdays = computed(() => {
    const format = new Intl.DateTimeFormat(this.regional.locale(), { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, day) => format.format(new Date(Date.UTC(2024, 0, 7 + this.firstWeekday() + day))));
  });

  constructor(public regional: RegionalSettingsService, private host: ElementRef<HTMLElement>) {
    effect(() => {
      this.firstWeekday();
      const zone = this.regional.timeZone();
      if (this.open) { this.todayISO = dayAt(Date.now(), zone); this.refreshDays(); }
    });
  }

  ngOnChanges(): void {
    this.available = new Set(this.availableDates);
    if (this.disabled) this.close(false);
    if (this.open) { this.setMonth(this.selectedISO); this.refreshDays(); }
  }

  get yearStart(): number { return Math.floor(this.year / 20) * 20; }
  get years(): number[] { return Array.from({ length: 20 }, (_, index) => this.yearStart + index); }
  get heading(): string {
    return this.view === 'years' ? `${this.yearStart} – ${this.yearStart + 19}`
      : this.view === 'months' ? String(this.year) : `${this.monthNames()[this.month]} ${this.year}`;
  }

  toggleOpen(): void {
    if (this.disabled) return;
    if (this.open) { this.close(); return; }
    this.todayISO = dayAt(Date.now(), this.regional.timeZone());
    this.setMonth(this.selectedISO || this.todayISO);
    this.view = 'days';
    this.open = true;
    this.refreshDays();
    this.position();
    this.focusDay();
  }

  close(restoreFocus = true): void {
    const wasOpen = this.open;
    this.open = false;
    this.movingFocus = false;
    cancelAnimationFrame(this.frame);
    if (wasOpen && restoreFocus) this.toggle?.nativeElement.focus();
  }

  chooseView(view: CalendarView): void {
    this.view = view;
    if (view === 'days') this.refreshDays();
    this.focusChoice();
  }

  chooseYear(year: number): void {
    if (this.yearDisabled(year)) return;
    this.year = year;
    this.chooseView('months');
  }

  chooseMonth(month: number): void {
    if (this.monthDisabled(month)) return;
    this.month = month;
    this.chooseView('days');
  }

  chooseDay(day: CalendarDay): void {
    if (day.disabled || this.disabled) return;
    this.close();
    this.dateSelected.emit(day.iso);
  }

  today(): void {
    if (this.disabled) return;
    this.close();
    this.todayRequested.emit();
  }

  yearDisabled(year: number): boolean {
    return (!!this.minISO && year < Number(this.minISO.slice(0, 4))) || (!!this.maxISO && year > Number(this.maxISO.slice(0, 4)));
  }
  monthDisabled(month: number): boolean {
    return (!!this.minISO && isoDate(this.year, month + 1, 0) < this.minISO)
      || (!!this.maxISO && isoDate(this.year, month, 1) > this.maxISO);
  }
  canMove(direction: number): boolean {
    if (this.view === 'years') {
      const start = this.yearStart + direction * 20;
      return !((this.minISO && start + 19 < Number(this.minISO.slice(0, 4))) || (this.maxISO && start > Number(this.maxISO.slice(0, 4))));
    }
    if (this.view === 'months') return !this.yearDisabled(this.year + direction);
    const next = new Date(Date.UTC(this.year, this.month + direction, 1));
    return (!this.minISO || isoDate(next.getUTCFullYear(), next.getUTCMonth() + 1, 0) >= this.minISO)
      && (!this.maxISO || isoDate(next.getUTCFullYear(), next.getUTCMonth(), 1) <= this.maxISO);
  }
  move(direction: number): void {
    if (!this.canMove(direction)) return;
    if (this.view === 'years') this.year += direction * 20;
    else if (this.view === 'months') this.year += direction;
    else { const date = new Date(Date.UTC(this.year, this.month + direction, 1)); this.year = date.getUTCFullYear(); this.month = date.getUTCMonth(); }
    this.refreshDays();
  }

  dayLabel(day: CalendarDay): string {
    return new Intl.DateTimeFormat(this.regional.locale(), { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${day.iso}T00:00:00Z`));
  }

  private setMonth(iso: string): void {
    const bounded = this.minISO && iso < this.minISO ? this.minISO : this.maxISO && iso > this.maxISO ? this.maxISO : iso;
    this.year = Number(bounded.slice(0, 4)); this.month = Number(bounded.slice(5, 7)) - 1;
  }
  private refreshDays(): void {
    const weekday = new Date(Date.UTC(this.year, this.month, 1)).getUTCDay();
    const offset = (weekday - this.firstWeekday() + 7) % 7;
    this.days = Array.from({ length: 42 }, (_, index) => {
      const iso = isoDate(this.year, this.month, index - offset + 1);
      return { iso, number: Number(iso.slice(8)), outside: Number(iso.slice(5, 7)) !== this.month + 1,
        disabled: (!!this.minISO && iso < this.minISO) || (!!this.maxISO && iso > this.maxISO)
          || (this.available.size > 0 && !this.available.has(iso)) };
    });
    this.focusISO = this.days.find(day => day.iso === this.selectedISO && !day.disabled)?.iso
      || this.days.find(day => !day.outside && !day.disabled)?.iso || '';
  }
  private focusChoice(): void {
    cancelAnimationFrame(this.frame);
    this.movingFocus = true;
    this.frame = requestAnimationFrame(() => {
      const panel = this.panel?.nativeElement;
      const target = this.view === 'days' ? panel?.querySelector<HTMLElement>(`[data-date="${this.focusISO}"]`)
        : panel?.querySelector<HTMLElement>('.calendar-choices button.is-selected:not(:disabled)')
          || panel?.querySelector<HTMLElement>('.calendar-choices button:not(:disabled)');
      (target || panel)?.focus();
      this.movingFocus = false;
    });
  }
  private focusDay(): void { this.focusChoice(); }

  onDayKey(event: KeyboardEvent, day: CalendarDay): void {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const date = new Date(`${day.iso}T00:00:00Z`);
    let next = '';
    for (let index = 0; index < 370; index++) {
      date.setUTCDate(date.getUTCDate() + steps[event.key]);
      next = date.toISOString().slice(0, 10);
      if ((this.minISO && next < this.minISO) || (this.maxISO && next > this.maxISO)) return;
      if (!this.available.size || this.available.has(next)) break;
      next = '';
    }
    if (!next) return;
    this.setMonth(next); this.refreshDays(); this.focusISO = next; this.focusDay();
  }

  @HostListener('document:click', ['$event']) outside(event: MouseEvent): void {
    // Angular may replace the clicked header before the event reaches document.
    // The original event path still identifies that click as inside this control.
    if (this.open && !event.composedPath().includes(this.host.nativeElement)
      && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }
  @HostListener('keydown.escape', ['$event']) escape(event: KeyboardEvent): void {
    if (this.open) { event.preventDefault(); event.stopPropagation(); this.close(); }
  }
  @HostListener('focusout', ['$event']) focusOut(event?: FocusEvent): void {
    // During focusout, activeElement can briefly be body even when the next
    // control is inside this popup. Use the destination before checking it.
    if (event?.relatedTarget && this.host.nativeElement.contains(event.relatedTarget as Node)) return;
    // Replacing the month/year header temporarily removes the focused button.
    // The scheduled focus transfer is internal navigation, not leaving the popup.
    queueMicrotask(() => { if (this.open && !this.movingFocus && !this.host.nativeElement.contains(document.activeElement)) this.close(false); });
  }
  @HostListener('window:resize') position(): void {
    if (!this.open) return;
    const rect = this.toggle!.nativeElement.getBoundingClientRect();
    this.left = Math.max(8, Math.min(rect.right - 156, window.innerWidth - 320));
    this.top = rect.bottom + 9;
    this.maxHeight = Math.max(160, window.innerHeight - this.top - 12);
  }
  ngOnDestroy(): void { cancelAnimationFrame(this.frame); }
}
