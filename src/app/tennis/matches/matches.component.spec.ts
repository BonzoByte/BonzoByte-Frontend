import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { LANGUAGE_STORAGE_KEY, RegionalSettingsService } from '../../core/services/regional-settings.service';
import { of, Subject, throwError } from 'rxjs';
import { convertToParamMap } from '@angular/router';
import { TimeZoneNoticePreferenceService } from '../../core/services/time-zone-notice-preference.service';
import { AdDisplayPreferenceService } from '../../core/services/ad-display-preference.service';
import { MatchesComponent } from './matches.component';
import { PlayerModalComponent } from '../players/player-modal/player-modal.component';
import { TournamentModalComponent } from '../tournaments/tournament-modal/tournament-modal.component';

describe('Matches with regional settings', () => {
  beforeEach(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    TestBed.configureTestingModule({providers: [provideTranslateService()]});
    TestBed.inject(RegionalSettingsService).setLanguage('hr');
  });
  afterEach(() => localStorage.removeItem(LANGUAGE_STORAGE_KEY));

describe('Details modal strength stars', () => {
  it('uses the tournament-index scale for average and peak strength', () => {
    const modal = new TournamentModalComponent({} as any, TestBed.inject(RegionalSettingsService));
    modal.strengthScale = { min: 10, median: 20, max: 30 };
    modal.tournament = {
      tournamentEventTPId: 1,
      tournamentEventName: 'Brisbane',
      averageMatchStrength: 20,
      peakMatchStrength: 30,
    };

    expect(modal.overviewRows.find(row => row.label === 'details.avgStrength')?.stars).toBe(2.5);
    expect(modal.overviewRows.find(row => row.label === 'details.peakStrength')?.stars).toBe(5);
  });

  it('adds the existing TS scale to all three player TS values', () => {
    const modal = new PlayerModalComponent({} as any, {} as any, TestBed.inject(RegionalSettingsService));
    modal.playerIndex = {
      playerTPId: 1,
      playerName: 'Player',
      averageTSMean: 25,
      currentTsMean: 32,
      peakTsMean: 39,
    } as any;

    const stats = modal.overviewStats;
    expect(stats.find(row => row.label === 'details.averageTs')?.stars).toBe(2.5);
    expect(stats.find(row => row.label === 'details.currentTs')?.stars).toBe(5);
    expect(stats.find(row => row.label === 'details.peakTs')?.stars).toBe(5);
  });
});

describe('MatchesComponent info links', () => {
  it('does not append duplicate archive country and seeding metadata to the main-grid label', () => {
    expect(MatchesComponent.prototype.formatPlayerLabel('Auer Stefani [11] (AUT)', 'AUT', '11', '1334'))
      .toBe('Auer Stefani (AUT) (11) [1334]');
    expect(MatchesComponent.prototype.formatPlayerLabel('Yazdani Mahsa (2008) (IRN)', 'IRN'))
      .toBe('Yazdani Mahsa (2008) (IRN)');
  });
  it('closes player information when Show All Matches already targets the current page', () => {
    const router = { url: '/players/matches/12', navigate: jasmine.createSpy('navigate') };
    const modal = new PlayerModalComponent({} as any, router as any, TestBed.inject(RegionalSettingsService));
    modal.playerTPId = 12;
    modal.isOpen = true;
    const closed = spyOn(modal.closed, 'emit');
    const showAll = spyOn(modal.showCurrentMatches, 'emit');
    modal.showAllMatches();
    expect(modal.isOpen).toBeFalse();
    expect(closed).toHaveBeenCalled();
    expect(showAll).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  function setup() {
    const archives = jasmine.createSpyObj('archives', ['getPlayerIndexById', 'getTournamentsIndex']);
    archives.getPlayerIndexById.and.returnValue(of({ playerTPId: 12, playerName: 'Player' }));
    archives.getTournamentsIndex.and.returnValue(of({ items: [{ tournamentEventTPId: 34, tournamentEventName: 'Event' }] }));
    const router = jasmine.createSpyObj('router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
    const route = { snapshot: { paramMap: convertToParamMap({}) } };
    const component = new MatchesComponent(archives, {} as any, route as any, router,
      {} as any, {} as any, new ElementRef(document.createElement('div')),
      { visible$: of(true) } as any, { current: {} } as any, TestBed.inject(RegionalSettingsService), TestBed.inject(TimeZoneNoticePreferenceService), TestBed.inject(AdDisplayPreferenceService));
    return { component, archives, router, route };
  }

  it('opens player information without navigating or changing the match scope', () => {
    const { component, router } = setup();
    component.viewMode = 'player';
    component.playerMatchesTPId = 99;
    component.openPlayerPage(12);
    expect(component.infoPlayer?.playerTPId).toBe(12);
    expect(component.playerMatchesTPId).toBe(99);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens tournament information and navigates only on Show All Matches', () => {
    const { component, router } = setup();
    component.openTournamentPage(34);
    expect(component.infoTournament?.tournamentEventName).toBe('Event');
    expect(router.navigate).not.toHaveBeenCalled();
    component.showTournamentMatches(34);
    expect(component.infoTournament).toBeNull();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/tournaments/matches', 34]);
  });

  it('ignores invalid IDs', () => {
    const { component, archives, router } = setup();
    for (const id of [null, undefined, 0, -1, NaN, Infinity, 1.5]) {
      component.openPlayerPage(id);
      component.openTournamentPage(id);
    }
    expect(archives.getPlayerIndexById).not.toHaveBeenCalled();
    expect(archives.getTournamentsIndex).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not open stale information after another link is clicked', () => {
    const { component, archives } = setup();
    const pending = new Subject<any>();
    archives.getPlayerIndexById.and.returnValue(pending);
    component.openPlayerPage(12);
    component.openTournamentPage(34);
    pending.next({ playerTPId: 12, playerName: 'Late' });
    expect(component.infoPlayer).toBeNull();
    expect(component.infoTournament?.tournamentEventTPId).toBe(34);
    component.closeInfoModal();
    expect(component.infoTournament).toBeNull();
  });

  it('still opens information when reference indexes are unavailable', () => {
    const { component, archives, router } = setup();
    archives.getPlayerIndexById.and.returnValue(throwError(() => new Error('offline')));
    archives.getTournamentsIndex.and.returnValue(of({ items: [] }));
    component.matches = [{ player1TPId: 12, player1Name: 'Known player', tournamentEventTPId: 34, tournamentEventName: 'Known event' }] as any;
    component.openPlayerPage(12);
    expect(component.infoPlayer?.playerName).toBe('Known player');
    component.openTournamentPage(34);
    expect(component.infoTournament?.tournamentEventName).toBe('Known event');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  for (const scope of ['player', 'tournament'] as const) {
    it(`reloads a reused ${scope} route only after its ID changes`, () => {
      const { component, route } = setup();
      component.viewMode = scope;
      component.playerMatchesTPId = 99;
      component.tournamentMatchesTPId = 99;
      const loader = spyOn(component, scope === 'player' ? 'loadPlayerMatches' : 'loadTournamentMatches');
      route.snapshot.paramMap = convertToParamMap(scope === 'player' ? { playerTPId: '12' } : { tournamentEventTPId: '34' });
      (component as any).refreshReusedScopedRoute();
      (component as any).refreshReusedScopedRoute();
      expect(loader).toHaveBeenCalledOnceWith(scope === 'player' ? 12 : 34);
    });
  }
});

describe('MatchesComponent scoped filters', () => {
  it('switches date input, odds and display without changing source dates or numeric results', () => {
    const component = createComponent();
    const settings = TestBed.inject(RegionalSettingsService);
    const source = '2026-09-24T00:30:00';
    settings.setLanguage('en');
    expect(component.getLocalizedDateMaybeTime(source)).toBe('24/09/2026\n00:30');
    expect(component.formatOdds(1.25)).toBe('1.25');
    expect(component.getDecimalOddsParts(1.25)).toEqual({integer: '1', fraction: '25'});
    expect((component as any).toDMYFromISO('2026-09-24')).toBe('24/09/2026');
    expect((component as any).parseDMYtoISO('24/09/2026')).toBe('2026-09-24');
    settings.setLanguage('hr');
    expect(component.getLocalizedDateMaybeTime(source)).toBe('24.09.2026.\n00:30');
    expect(component.formatOdds(1.25)).toBe('1,25');
    expect(component.getDecimalOddsParts(1.25)).toEqual({integer: '1', fraction: '25'});
    expect((component as any).parseDMYtoISO('24.09.2026')).toBe('2026-09-24');
    expect(component.getLocalizedDateMaybeTime('1990-01-01T00:00:00.001')).toBe('01.01.1990.');
    expect(component.getLocalizedDateMaybeTime('2026-09-24T00:00:00')).toBe('24.09.2026.');
    settings.setLanguage('de');
    expect(component.getLocalizedDateMaybeTime(source)).toBe('24.09.2026\n00:30');
    expect(component.formatOdds(1.25)).toBe('1,25');
    expect((component as any).toDMYFromISO('2026-09-24')).toBe('24.09.2026');
    expect((component as any).parseDMYtoISO('24.09.2026')).toBe('2026-09-24');
  });

  function createComponent(): MatchesComponent {
    return new MatchesComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new ElementRef(document.createElement('div')),
      { visible$: of(true) } as any,
      { current: {} } as any,
      TestBed.inject(RegionalSettingsService), TestBed.inject(TimeZoneNoticePreferenceService), TestBed.inject(AdDisplayPreferenceService));
  }

  function applyDefaultFilter(component: MatchesComponent): void {
    component.onFilterApplied({
      startDate: null,
      endDate: null,
      option: 'all',
      surfaceIds: [1, 2, 3, 4, 5],
      tournamentTypeIds: [2, 4],
      strengthStars: [0, 1, 2, 3, 4, 5],
      status: 'all',
      odds: 'all',
      valueFilter: 'all',
      confidence: 'all',
    });
  }

  for (const viewMode of ['player', 'tournament'] as const) {
    it(`opens all ${viewMode} matches and clears every previous restriction`, () => {
      const component = createComponent();
      component.viewMode = viewMode;
      const rows = [{ matchTPId: 1, isFinished: true, surface: 'unknown' },
        { matchTPId: 2, isFinished: false, surface: 'clay' }] as any[];
      (component as any).daySourceMatches = rows;
      component.matches = [];
      component.isFiltered = true;
      component.searchTerm = 'unrelated';
      component.activeOdds = 'with';
      component.valueFilter = 'valueOnly';
      component.activeSurfaceIds = [4];
      component.showAllScopedMatches();
      expect(component.filteredMatches.map(row => row.matchTPId).sort()).toEqual([1, 2]);
      expect(component.activeStatus).toBe('all');
      expect(component.activeOdds).toBe('all');
      expect(component.valueFilter).toBe('all');
      expect(component.searchTerm).toBe('');
      expect(component.isFiltered).toBeFalse();
      component.onFilterReset();
      expect(component.activeStatus).toBe('all');
      expect(component.activeOdds).toBe('all');
    });

    it(`keeps the ${viewMode} archive when the modal filter is applied`, () => {
      const component = createComponent();
      const scopedRows = [{ matchTPId: 1 }, { matchTPId: 2 }] as any[];
      component.viewMode = viewMode;
      (component as any).daySourceMatches = scopedRows;
      component.matches = [...scopedRows] as any;
      spyOn(component, 'loadMatchesForDate');
      spyOn<any>(component, 'deferScrollToTop');

      applyDefaultFilter(component);

      expect(component.loadMatchesForDate).not.toHaveBeenCalled();
      expect(component.filteredMatches).toEqual(scopedRows as any);
    });
  }

  it('keeps the player archive when a quick filter is applied', () => {
    const component = createComponent();
    component.viewMode = 'player';
    (component as any).daySourceMatches = [{ matchTPId: 1 }] as any[];
    component.matches = [...(component as any).daySourceMatches] as any;
    spyOn(component, 'loadMatchesForDate');
    spyOn<any>(component, 'deferScrollToTop');

    component.setQuickOddsFilter('with');

    expect(component.loadMatchesForDate).not.toHaveBeenCalled();
  });

  it('treats missing and non-canonical surfaces as Unknown', () => {
    const component = createComponent();

    expect((component as any).normalizeSurfaceId({ surface: 'unknown' })).toBe(5);
    expect((component as any).normalizeSurfaceId({ surfaceId: 0 })).toBe(5);
    expect((component as any).normalizeSurfaceId({})).toBe(5);
    expect(component.formatSurface('unknown')).toBe('');
    expect(component.formatSurface('Hard')).toBe('HARD');
    expect(component.getMatchRoundTooltip({roundName: 'quarter finals'} as any)).toBe('QUARTER FINALS');
    expect(component.surfaceIndicatorLabel('Indoors')).toBe('carpet');
    expect(component.localizedSurface('Hard')).toBe('TVRDA');
    expect(component.surfaceIndicatorClass('Hard')).toBe('surface-indicator--hard');
    expect(component.localizedSurface('unknown')).toBe('');
    const regional = TestBed.inject(RegionalSettingsService);
    expect(regional.plural('matches.count', 1)).toBe('1 meč');
    expect(regional.plural('matches.count', 2)).toBe('2 meča');
    expect(regional.plural('matches.count', 5)).toBe('5 mečeva');
    expect(regional.plural('matches.count', 21)).toBe('21 meč');
    regional.setLanguage('en');
    expect(component.localizedSurface('Hard')).toBe('HARD');
    expect(component.surfaceIndicatorClass('Hard')).toBe('surface-indicator--hard');
    expect(regional.plural('matches.count', 2)).toBe('2 matches');
  });

  it('keeps the tournament header TS numeric when its tooltip is localized', () => {
    const component = createComponent();

    (component as any).syncTournamentHeaderFromRows([
      { tournamentEventTPId: 235056, tournamentStrengthMeanTS: 32.84 },
    ], 235056);

    expect(component.tournamentHeaderStrengthValue).toBe(32.84);
    expect(component.tournamentHeaderStrength).toContain('32');
    expect(component.tournamentHeaderStrengthStars).toBe(5);
  });

  it('lets Unknown participate explicitly in surface filtering', () => {
    const component = createComponent();
    const known = { matchTPId: 1, surface: 'hard' } as any;
    const unknown = { matchTPId: 2, surface: 'unknown' } as any;
    component.isFiltered = true;
    component.activeStatus = 'all';
    component.activeOdds = 'all';
    component.valueFilter = 'all';
    component.activeConfidence = 'all';
    component.activeTournamentTypeIds = [2, 4];
    component.activeStrengthStars = [0, 1, 2, 3, 4, 5];

    component.activeSurfaceIds = [5];
    expect((component as any).filterMatchesByActiveFilters([known, unknown])).toEqual([unknown]);

    component.activeSurfaceIds = [1, 2, 3, 4, 5];
    expect((component as any).filterMatchesByActiveFilters([known, unknown])).toEqual([known, unknown]);
  });

  it('explains the automatic historical prediction subset and can reveal the full day', () => {
    const component = createComponent();
    const rows = [{ matchTPId: 1 }, { matchTPId: 2 }] as any[];
    component.viewMode = 'daily';
    component.filterMode = 'auto';
    component.isFiltered = true;
    component.activeStatus = 'completed';
    component.activeOdds = 'with';
    component.valueFilter = 'valueOnly';
    (component as any).daySourceMatches = rows;
    component.matches = [rows[0]] as any[];
    component.filteredMatches = [rows[0]] as any[];
    spyOn<any>(component, 'deferScrollToTop');

    expect(component.showPredictionViewNotice).toBeTrue();
    expect(component.predictionViewTotalCount).toBe(2);

    component.showAllMatchesForCurrentDay();

    expect(component.filterMode).toBe('custom');
    expect(component.activeStatus).toBe('all');
    expect(component.activeOdds).toBe('all');
    expect(component.valueFilter).toBe('all');
    expect(component.filteredMatches).toEqual(rows as any);
    expect(component.showPredictionViewNotice).toBeFalse();
  });

  it('dismisses the notice without changing the prediction filters or visible matches', () => {
    const component = createComponent();
    component.viewMode = 'daily';
    component.filterMode = 'auto';
    component.isFiltered = true;
    component.activeStatus = 'completed';
    component.activeOdds = 'with';
    component.valueFilter = 'valueOnly';
    const rows = [{ matchTPId: 1 }] as any[];
    component.filteredMatches = rows;
    spyOn<any>(component, 'scheduleScrollNavigationRefresh');

    expect(component.showPredictionViewNotice).toBeTrue();
    component.dismissPredictionViewNotice();

    expect(component.showPredictionViewNotice).toBeFalse();
    expect(component.filterMode).toBe('auto');
    expect(component.isFiltered).toBeTrue();
    expect(component.activeStatus).toBe('completed');
    expect(component.activeOdds).toBe('with');
    expect(component.valueFilter).toBe('valueOnly');
    expect(component.filteredMatches).toBe(rows);
  });
});

describe('MatchesComponent model P/L benchmark', () => {
  function createComponent(): MatchesComponent {
    return new MatchesComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new ElementRef(document.createElement('div')),
      { visible$: of(true) } as any,
      { current: {} } as any,
      TestBed.inject(RegionalSettingsService), TestBed.inject(TimeZoneNoticePreferenceService), TestBed.inject(AdDisplayPreferenceService));
  }

  function completed(extra: Record<string, unknown> = {}): any {
    return {
      matchTPId: 1,
      isFinished: true,
      result: '2:0',
      resultDetails: '6:3 6:2',
      player1Name: 'Left winner',
      player2Name: 'Right player',
      modelProbabilityPlayer1: 75,
      modelProbabilityPlayer2: 25,
      player1Odds: 1.5,
      player2Odds: 2.5,
      marketOddsVerified: true,
      ...extra,
    };
  }

  it('grades the prediction displayed in the grid at verified median odds', () => {
    const component = createComponent();
    component.plBasis = 'median';

    expect(component.formatPL(completed())).toBe('+0,50');
    expect(component.getPLClass(completed())).toBe('pl-positive');
    expect(component.getPLTooltip(completed())).toContain('Tržišni medijan koeficijenta: 1,50');

    const miss = completed({ modelProbabilityPlayer1: 30, modelProbabilityPlayer2: 70 });
    expect(component.formatPL(miss)).toBe('-1,00');
    expect(component.getPLClass(miss)).toBe('pl-negative');
  });

  it('does not grade pending, prediction-less, or unverified-market rows', () => {
    const component = createComponent();

    expect(component.formatPL(completed({ isFinished: false, result: null }))).toBe('—');
    expect(component.formatPL(completed({ modelProbabilityPlayer1: null, modelProbabilityPlayer2: null }))).toBe('—');
    expect(component.formatPL(completed({ marketOddsVerified: false }))).toBe('—');
  });

  it('accepts a single bookmaker pair without quote timestamps for theoretical historical P/L', () => {
    const component = createComponent();
    const historical = completed({ player1Odds: null, player2Odds: null, legacyPlayer1Odds: 1.8, legacyPlayer2Odds: 1.8,
      marketOddsVerified: false, recoveryOddsCertifiedPrematch: false, marketBookieCount: 1 });
    const original = JSON.stringify(historical);
    expect(component.formatPL(historical)).toBe('+1,00');
    expect(component.isHistoricalPL(historical)).toBeTrue();
    expect(component.getVerifiedMarketOdds(historical)).toBeNull();
    expect(component.getPredictionMarketContext(historical)?.gapPoints).toBe(25);
    expect(component.getMarketEdge(historical)?.side).toBe('p1');
    expect((component as any).hasValueBet(historical)).toBeTrue();
    expect(component.getPLTooltip(historical)).toContain('Teorijski povijesni P/L');
    component.plBasis = 'median';
    expect(component.formatPL(historical)).toBe('+0,80');
    const miss = { ...historical, modelProbabilityPlayer1: 25, modelProbabilityPlayer2: 75 };
    expect(component.formatPL(miss)).toBe('-1,00');
    const summary = component.getModelPlSummary([historical, miss]);
    expect(summary.eligibleCount).toBe(2);
    expect(summary.units).toBeCloseTo(-0.2, 10);
    expect(JSON.stringify(historical)).toBe(original);
  });

  it('requires both clean prices and a valid NN, but not a pre-match timestamp, for the value filter', () => {
    const component = createComponent();
    const row = completed({ player1Odds: null, player2Odds: null, legacyPlayer1Odds: 1.8, legacyPlayer2Odds: 2.2,
      marketOddsVerified: false, recoveryOddsCertifiedPrematch: false, marketBookieCount: 1 });
    expect((component as any).hasValueBet(row)).toBeTrue();
    for (const extra of [{ legacyPlayer1Odds: null }, { legacyPlayer2Odds: 1 },
      { modelProbabilityPlayer1: null, modelProbabilityPlayer2: null }, { predictionEligible: false }, { qualityStatus: 'NeedsReview' }]) {
      expect((component as any).hasValueBet({ ...row, ...extra })).withContext(JSON.stringify(extra)).toBeFalse();
    }
    expect(component.getVerifiedMarketOdds(row)).toBeNull();
    expect(row.recoveryOddsCertifiedPrematch).toBeFalse();
  });

  it('keeps historical P/L unavailable for missing pairs, invalid prices, unresolved results or absent NN outputs', () => {
    const component = createComponent();
    const historical = completed({ player1Odds: null, player2Odds: null, legacyPlayer1Odds: 1.62, legacyPlayer2Odds: 2.41,
      marketOddsVerified: false, recoveryOddsCertifiedPrematch: false });
    for (const extra of [
      { legacyPlayer1Odds: null }, { legacyPlayer2Odds: null }, { legacyPlayer1Odds: 1 },
      { legacyPlayer2Odds: NaN }, { legacyPlayer1Odds: Infinity }, { legacyPlayer2Odds: -2 },
      { isFinished: false, result: null }, { result: 'RET' }, { result: '0:2' },
      { modelProbabilityPlayer1: null, modelProbabilityPlayer2: null },
      { calculationEligible: false }, { predictionEligible: false }, { qualityStatus: 'NeedsReview' },
      { recoveryOddsCertifiedPrematch: undefined }, { recoveryOddsCertifiedPrematch: true },
    ]) {
      const row = { ...historical, ...extra };
      expect(component.formatPL(row)).withContext(JSON.stringify(extra)).toBe('—');
      expect(component.isHistoricalPL(row)).toBeFalse();
      expect(component.getModelPlSummary([row]).eligibleCount).toBe(0);
    }
    expect(component.getPLTooltip({ ...historical, legacyPlayer2Odds: null })).toContain('oba igrača');
  });

  it('keeps held finished matches visible but suppresses prediction, winner and P/L grading', () => {
    const component = createComponent();
    const held = completed({ qualityStatus: 'NeedsReview', qualityReason: 'set-after-match-completed',
      calculationEligible: false, predictionEligible: false, result: '21', resultDetails: '7:6(5) 6:3 8:10' });
    expect(component.getMatchOutcomeStatus(held)).toBe('completed');
    expect(component.hasResultQualityHold(held)).toBeTrue();
    expect(component.getPrediction(held)).toBeNull();
    expect(component.getMarketEdge(held)).toBeNull();
    expect(component.getPredictionOutcome(held)).toBeNull();
    expect((component as any).getWinnerSide(held)).toBeNull();
    expect(component.formatPL(held)).toBe('—');
    expect(component.getPLTooltip(held)).toContain('isključeno iz izračuna');
    const summary = component.getModelPlSummary([completed(), held]);
    expect(summary.eligibleCount).toBe(1);
    expect(summary.totalCount).toBe(2);
    expect(held.resultDetails).toBe('7:6(5) 6:3 8:10');
  });

  it('fails closed for new quality states without blocking normal upcoming predictions', () => {
    const component = createComponent();
    expect(component.getPrediction(completed({ qualityStatus: 'FutureUnrecognizedStatus' }))).toBeNull();
    expect(component.getPrediction(completed({ qualityStatus: 'NotAssessed' }))).toBeNull();
    expect(component.getPrediction(completed({ qualityStatus: 'Incomplete', isFinished: false,
      result: null, calculationEligible: false, predictionEligible: true }))).not.toBeNull();
  });

  it('summarizes shown rows with unit P/L, ROI, and explicit coverage', () => {
    const component = createComponent();
    component.plBasis = 'median';
    const rows = [
      completed({ matchTPId: 1, player1Odds: 1.5 }),
      completed({ matchTPId: 2, modelProbabilityPlayer1: 30, modelProbabilityPlayer2: 70 }),
      completed({ matchTPId: 3, marketOddsVerified: false }),
    ];

    const summary = component.getModelPlSummary(rows);
    expect(summary.units).toBeCloseTo(-0.5, 10);
    expect(summary.roiPercent).toBeCloseTo(-25, 10);
    expect(summary.eligibleCount).toBe(2);
    expect(summary.totalCount).toBe(3);
    expect(component.formatSignedUnits(summary.units)).toBe('-0,50u');
    expect(component.formatSignedPercent(summary.roiPercent)).toBe('-25,0%');
  });

  it('defaults to fair P/L using the same normalized market pair', () => {
    const component = createComponent();
    expect(component.plBasis).toBe('fair');
    expect(component.plLabel).toBe('Fer P/L');
    expect(component.formatPL(completed({ player1Odds: 1.8, player2Odds: 1.8 }))).toBe('+1,00');
    expect(component.formatPL(completed())).toBe('+0,60');
    expect(component.getPLTooltip(completed())).toContain('Fer koeficijent bez marže: 1,60');
    expect(component.getPLTooltip(completed())).toContain('Hipotetski');
    component.plBasis = 'median';
    expect(component.plLabel).toBe('Medijan P/L');
    expect(component.formatPL(completed())).toBe('+0,50');
  });

  it('uses fair P/L for either predicted side and group ROI without changing coverage', () => {
    const component = createComponent();
    const winner2 = completed({ result: '0:2', modelProbabilityPlayer1: 25, modelProbabilityPlayer2: 75 });
    // Historical archives require the winner on the left; do not grade reversed results.
    expect(component.formatPL(winner2)).toBe('—');
    expect((component as any).getPlOdds({ player1: 1.5, player2: 2.5 }, 'p2')).toBeCloseTo(8 / 3, 10);
    const rows = [completed(), completed({ modelProbabilityPlayer1: 25, modelProbabilityPlayer2: 75 }), completed({ marketOddsVerified: false })];
    const fair = component.getModelPlSummary(rows);
    expect(fair.units).toBeCloseTo(-0.4, 10);
    expect(fair.roiPercent).toBeCloseTo(-20, 10);
    component.plBasis = 'median';
    const median = component.getModelPlSummary(rows);
    expect(median.eligibleCount).toBe(fair.eligibleCount);
    expect(median.totalCount).toBe(fair.totalCount);
    expect(component.formatPL(completed({ player2Odds: null }))).toBe('—');
    component.plBasis = 'fair';
    expect(component.formatPL(completed({ player2Odds: null }))).toBe('—');
  });
});
});
