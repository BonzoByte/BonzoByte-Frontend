import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { EMPTY, of } from 'rxjs';
import { MatchesComponent } from './matches.component';
import { LANGUAGE_STORAGE_KEY, RegionalSettingsService, TIME_ZONE_STORAGE_KEY } from '../../core/services/regional-settings.service';

describe('Match calendar navigation', () => {
  let component: MatchesComponent;
  let load: jasmine.Spy;
  let notice: { open: jasmine.Spy };
  let regional: RegionalSettingsService;
  beforeEach(() => {
    jasmine.clock().install(); jasmine.clock().mockDate(new Date('2026-11-17T10:00:00Z'));
    localStorage.removeItem(LANGUAGE_STORAGE_KEY); localStorage.removeItem(TIME_ZONE_STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    regional = TestBed.inject(RegionalSettingsService); regional.setLanguage('en'); regional.setTimeZone('Europe/Zagreb');
    notice = { open: jasmine.createSpy('open') };
    component = new MatchesComponent({} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      new ElementRef(document.createElement('div')), { visible$: of(true) } as any, { current: {}, preferences$: EMPTY } as any,
      regional, {} as any, {} as any, null, null, undefined, undefined, null, null, notice as any);
    component.minDate = new Date(1990, 0, 1); component.maxDate = new Date(2026, 10, 17);
    component.currentDate = new Date(2026, 10, 13); component.currentDateISO = '2026-11-13';
    component.availableDates = ['2026-11-13', '2026-11-16', '2026-11-17'];
    load = spyOn(component, 'loadMatchesForDate');
  });
  afterEach(() => { jasmine.clock().uninstall(); localStorage.removeItem(LANGUAGE_STORAGE_KEY); localStorage.removeItem(TIME_ZONE_STORAGE_KEY); });
  it('routes calendar selection through the existing date handling without locale ambiguity', () => {
    regional.setLanguage('en-US'); component.selectCalendarDate('2026-11-16');
    expect(component.currentDateISO).toBe('2026-11-16'); expect(component.currentDateDMY).toBe('11/16/2026');
    expect(load).toHaveBeenCalledTimes(1); expect(load.calls.first().args[0].getDate()).toBe(16);
  });
  it('loads today when its archive exists and does not show a fallback notice', () => {
    component.goToToday();
    expect(component.currentDateISO).toBe('2026-11-17'); expect(load).toHaveBeenCalledTimes(1); expect(notice.open).not.toHaveBeenCalled();
  });
  it('clearly reports a missing today archive and loads the latest available day, not a false today', () => {
    component.availableDates = ['2026-11-13', '2026-11-16']; component.maxDate = new Date(2026, 10, 16);
    component.goToToday();
    expect(component.currentDateISO).toBe('2026-11-16'); expect(load).toHaveBeenCalledTimes(1);
    expect(notice.open).toHaveBeenCalledWith('matchCalendar.todayUnavailable', '', { duration: 5000 }, { date: '16/11/2026' });
    expect(component.showDateWarning).toBeFalse();
  });
  it('resolves today in the selected time zone rather than the machine zone', () => {
    jasmine.clock().mockDate(new Date('2026-11-17T00:30:00Z')); regional.setTimeZone('America/Los_Angeles');
    component.goToToday(); expect(component.currentDateISO).toBe('2026-11-16'); expect(notice.open).not.toHaveBeenCalled();
  });
  it('refreshes the current day on Today and leaves navigation alone while loading', () => {
    component.currentDateISO = '2026-11-17'; component.goToToday(); expect(load).toHaveBeenCalledTimes(1);
    load.calls.reset(); component.loading = true; component.goToToday(); component.selectCalendarDate('2026-11-16');
    expect(load).not.toHaveBeenCalled();
  });
});
