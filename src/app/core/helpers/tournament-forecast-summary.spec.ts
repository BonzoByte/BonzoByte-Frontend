import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { RegionalSettingsService } from '../services/regional-settings.service';
import { TimeZoneNoticePreferenceService } from '../services/time-zone-notice-preference.service';
import { AdDisplayPreferenceService } from '../services/ad-display-preference.service';
import { MatchesComponent } from '../../tennis/matches/matches.component';
import { summarizeTournamentForecasts, TournamentForecastState } from './tournament-forecast-summary';

describe('Tournament forecast header', () => {
    const state = (extra: Partial<TournamentForecastState> = {}): TournamentForecastState => ({ forecast: true, outcome: 'correct', pending: false, ...extra });
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideTranslateService()] }));
    function component(): MatchesComponent {
        return new MatchesComponent({} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
            new ElementRef(document.createElement('div')), { visible$: of(true) } as any, { current: {} } as any,
            TestBed.inject(RegionalSettingsService), TestBed.inject(TimeZoneNoticePreferenceService), TestBed.inject(AdDisplayPreferenceService));
    }
    const row = (extra: Record<string, unknown> = {}): any => ({ matchTPId: 1, tournamentEventTPId: 10, tournamentEventName: 'Example',
        isFinished: true, result: '2:0', resultDetails: '6:3 6:2', dateTime: '2026-11-15T12:00:00',
        player1Name: 'Winner', player2Name: 'Opponent', modelProbabilityPlayer1: 75, modelProbabilityPlayer2: 25, ...extra });

    it('divides correct forecasts by graded forecasts, never by all shown matches', () => {
        const rows = [state(), state(), state({ outcome: 'incorrect' }), state({ outcome: null, pending: true }),
            state({ forecast: false, outcome: null }), state({ outcome: null })];
        const original = JSON.stringify(rows), result = summarizeTournamentForecasts(rows, value => value);
        expect(result).toEqual({ total: 6, forecasts: 5, correct: 2, graded: 3, pending: 1, excluded: 2, accuracy: 200 / 3 });
        expect(result.graded + result.pending + result.excluded).toBe(result.total);
        expect(JSON.stringify(rows)).toBe(original);
    });
    it('distinguishes no results from a genuine zero-percent result', () => {
        expect(summarizeTournamentForecasts([], value => value as TournamentForecastState).accuracy).toBeNull();
        expect(summarizeTournamentForecasts([state({ outcome: null, pending: true })], value => value).accuracy).toBeNull();
        expect(summarizeTournamentForecasts([state({ outcome: 'incorrect' })], value => value).accuracy).toBe(0);
    });
    it('ignores an outcome when no eligible forecast is available', () => {
        const result = summarizeTournamentForecasts([state({ forecast: false })], value => value);
        expect(result.graded).toBe(0); expect(result.correct).toBe(0); expect(result.accuracy).toBeNull();
    });
    it('uses actual grid grading and does not require bookmaker odds', () => {
        const view = component(), rows = [row(), row({ modelProbabilityPlayer1: 25, modelProbabilityPlayer2: 75 }),
            row({ player1Odds: null, player2Odds: null, marketOddsVerified: false })];
        const summary = view.getTournamentForecastSummary(rows);
        expect(summary.correct).toBe(2); expect(summary.graded).toBe(3); expect(summary.accuracy).toBeCloseTo(66.666667, 5);
        expect(summary.correct).toBe(rows.filter(match => view.getPredictionOutcome(match) === 'correct').length);
    });
    it('excludes held results, missing/tied predictions, retirements and noncanonical scores', () => {
        const view = component(), rows = [row(), row({ qualityStatus: 'NeedsReview' }), row({ calculationEligible: false }),
            row({ predictionEligible: false }), row({ modelProbabilityPlayer1: null, modelProbabilityPlayer2: null }),
            row({ modelProbabilityPlayer1: 50, modelProbabilityPlayer2: 50 }), row({ result: 'RET' }), row({ result: '0:2' })];
        const result = view.getTournamentForecastSummary(rows);
        expect(result.graded).toBe(1); expect(result.correct).toBe(1); expect(result.excluded).toBe(7); expect(result.accuracy).toBe(100);
    });
    it('counts only eligible upcoming forecasts as awaiting results', () => {
        const view = component(), upcoming = row({ isFinished: false, result: null, resultDetails: null, dateTime: '2099-01-01T12:00:00' });
        const result = view.getTournamentForecastSummary([upcoming, { ...upcoming, predictionEligible: false }, row({ isFinished: false, result: '1:0' })]);
        expect(result.pending).toBe(1); expect(result.graded).toBe(0); expect(result.excluded).toBe(2); expect(result.accuracy).toBeNull();
    });
    it('follows the currently filtered group and refreshes a changed result on the same row', () => {
        const view = component(), first = row(), second = row({ matchTPId: 2, modelProbabilityPlayer1: 25, modelProbabilityPlayer2: 75 });
        view.matches = [first, second]; view.filteredMatches = [first];
        const group = view.tournamentMatchGroups[0]; expect(group.forecastSummary?.accuracy).toBe(100);
        const stableSummary = group.forecastSummary;
        expect(view.tournamentMatchGroups[0].forecastSummary).toBe(stableSummary);
        first.modelProbabilityPlayer1 = 25; first.modelProbabilityPlayer2 = 75;
        expect(view.tournamentMatchGroups[0].forecastSummary?.accuracy).toBe(0);
        view.filteredMatches = [first, second]; expect(view.tournamentMatchGroups[0].forecastSummary?.graded).toBe(2);
    });
    it('localizes the percentage explanation and provides safe language fallback', () => {
        const view = component(), regional = TestBed.inject(RegionalSettingsService);
        view.filteredMatches = [row()]; regional.setLanguage('hr');
        expect(view.getTournamentForecastTooltip(view.tournamentMatchGroups[0])).toContain('Pogoci: 1/1');
        regional.setLanguage('en'); expect(view.getTournamentForecastTooltip(view.tournamentMatchGroups[0])).toContain('Correct: 1/1');
        regional.setLanguage('de'); expect(view.getTournamentForecastTooltip(view.tournamentMatchGroups[0])).not.toContain('matchGrid.');
    });
});
