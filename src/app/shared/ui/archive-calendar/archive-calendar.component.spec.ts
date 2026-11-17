import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { RegionalSettingsService, LANGUAGE_STORAGE_KEY, TIME_ZONE_STORAGE_KEY } from '../../../core/services/regional-settings.service';
import { ArchiveCalendarComponent } from './archive-calendar.component';

describe('Archive calendar', () => {
  let fixture: ComponentFixture<ArchiveCalendarComponent>;
  let calendar: ArchiveCalendarComponent;
  const element = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement;
  const all = (selector: string) => [...fixture.nativeElement.querySelectorAll(selector)] as HTMLButtonElement[];
  beforeEach(async () => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY); localStorage.removeItem(TIME_ZONE_STORAGE_KEY);
    await TestBed.configureTestingModule({ imports: [ArchiveCalendarComponent], providers: [provideTranslateService()] }).compileComponents();
    TestBed.inject(RegionalSettingsService).setLanguage('en');
    fixture = TestBed.createComponent(ArchiveCalendarComponent); calendar = fixture.componentInstance;
    fixture.componentRef.setInput('selectedISO', '2026-11-16');
    fixture.componentRef.setInput('minISO', '1990-01-01');
    fixture.componentRef.setInput('maxISO', '2026-11-16');
    fixture.componentRef.setInput('availableDates', ['1990-01-01', '2024-02-29', '2026-10-30', '2026-11-13', '2026-11-16']);
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); localStorage.removeItem(LANGUAGE_STORAGE_KEY); localStorage.removeItem(TIME_ZONE_STORAGE_KEY); });
  const open = () => { element('.archive-calendar-toggle').click(); fixture.detectChanges(); };

  it('opens only on request, in the selected month, and marks the selected day', () => {
    expect(element('[role="dialog"]')).toBeNull();
    open();
    expect(element('[role="dialog"]')).not.toBeNull();
    expect(calendar.heading).toBe('November 2026');
    expect(element('[data-date="2026-11-16"]').getAttribute('aria-pressed')).toBe('true');
    expect(element('.archive-calendar-toggle').getAttribute('aria-expanded')).toBe('true');
  });
  it('offers all months and a paged year grid instead of requiring manual typing', () => {
    open(); element('.calendar-heading button[aria-label="Choose year"]').click(); fixture.detectChanges();
    expect(all('.calendar-years button').length).toBe(20);
    element('.calendar-navigation .calendar-step').click(); fixture.detectChanges();
    expect(calendar.heading).toBe('2000 – 2019');
    element('.calendar-navigation .calendar-step').click(); fixture.detectChanges();
    all('.calendar-years button').find(button => button.textContent?.trim() === '1990')!.click(); fixture.detectChanges();
    expect(all('.calendar-months button').length).toBe(12);
    all('.calendar-months button')[0].click(); fixture.detectChanges();
    expect(calendar.heading).toBe('January 1990');
    expect(calendar.canMove(-1)).toBeFalse();
  });
  it('emits a valid available day exactly once and closes', () => {
    const selected = spyOn(calendar.dateSelected, 'emit'); open();
    element('[data-date="2026-11-13"]').click(); fixture.detectChanges();
    expect(selected).toHaveBeenCalledOnceWith('2026-11-13');
    expect(element('[role="dialog"]')).toBeNull();
  });
  it('disables missing days, future bounds and out-of-range years without requesting data', () => {
    const selected = spyOn(calendar.dateSelected, 'emit'); open();
    expect((element('[data-date="2026-11-14"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((element('[data-date="2026-11-17"]') as HTMLButtonElement).disabled).toBeTrue();
    calendar.chooseDay(calendar.days.find(day => day.iso === '2026-11-14')!);
    expect(selected).not.toHaveBeenCalled();
    expect(calendar.yearDisabled(1989)).toBeTrue(); expect(calendar.yearDisabled(2027)).toBeTrue();
    expect(calendar.canMove(1)).toBeFalse();
  });
  it('includes leap day and handles December/January without local-time shifts', () => {
    open(); calendar.chooseYear(2024); calendar.chooseMonth(1); fixture.detectChanges();
    expect(calendar.days.find(day => day.iso === '2024-02-29')?.disabled).toBeFalse();
    calendar.chooseMonth(11); calendar.move(1);
    expect(calendar.year).toBe(2025); expect(calendar.month).toBe(0);
  });
  it('keeps keyboard navigation on available dates and restores focus on Escape', () => {
    open();
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    element('[data-date="2026-11-16"]').dispatchEvent(event); fixture.detectChanges();
    expect(calendar.focusISO).toBe('2026-11-13'); expect(event.defaultPrevented).toBeTrue();
    element('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(calendar.open).toBeFalse();
  });
  it('does not treat a header replacement during month/year selection as leaving the popup', async () => {
    open(); calendar.chooseView('years'); calendar.focusOut(); await Promise.resolve();
    expect(calendar.open).toBeTrue();
    calendar.chooseYear(2024); calendar.focusOut(); await Promise.resolve();
    expect(calendar.open).toBeTrue(); expect(calendar.view).toBe('months');
  });
  it('recognizes an internal click even after its old header button was removed', () => {
    open();
    const removed = document.createElement('button');
    calendar.outside({ target: removed, composedPath: () => [removed, fixture.nativeElement, document] } as unknown as MouseEvent);
    expect(calendar.open).toBeTrue();
  });
  it('keeps the popup open when mouse focus moves from a day to a header control', async () => {
    open(); (calendar as any).movingFocus = false;
    calendar.focusOut({ relatedTarget: element('.calendar-heading button') } as unknown as FocusEvent);
    await Promise.resolve(); expect(calendar.open).toBeTrue();
  });
  it('closes on an outside click and remains closed while the grid is loading', () => {
    open(); document.body.click(); fixture.detectChanges(); expect(calendar.open).toBeFalse();
    fixture.componentRef.setInput('disabled', true); fixture.detectChanges();
    element('.archive-calendar-toggle').click(); calendar.today(); fixture.detectChanges();
    expect(calendar.open).toBeFalse();
    expect((element('.archive-calendar-today') as HTMLButtonElement).disabled).toBeTrue();
  });
  it('delegates Today to the existing daily navigation and closes the popup', () => {
    const today = spyOn(calendar.todayRequested, 'emit'); open();
    element('.calendar-footer button').click(); fixture.detectChanges();
    expect(today).toHaveBeenCalledTimes(1); expect(calendar.open).toBeFalse();
  });
  it('localizes the month, labels and US weekday order without changing the selected ISO date', () => {
    open(); const regional = TestBed.inject(RegionalSettingsService);
    regional.setLanguage('hr'); fixture.detectChanges();
    expect(calendar.heading).toContain('studeni');
    expect(element('.archive-calendar-today').textContent).toContain('Danas');
    regional.setLanguage('en-US'); fixture.detectChanges();
    expect(calendar.weekdays()[0]).toBe('Sun');
    expect(calendar.days[0].iso).toBe('2026-11-01');
    expect(calendar.selectedISO).toBe('2026-11-16');
  });
  it('uses theme tokens and stays within a narrow viewport', () => {
    open();
    const panel = element('.archive-calendar-panel');
    expect(getComputedStyle(panel).position).toBe('fixed');
    const box = panel.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(window.innerWidth);
  });
});
