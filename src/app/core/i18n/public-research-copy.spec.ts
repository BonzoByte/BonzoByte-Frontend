import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ReportPresentationService } from './report-presentation.service';
import { SUPPORTED_LANGUAGES } from './supported-languages';
import { LANGUAGE_STORAGE_KEY } from '../services/regional-settings.service';
import { LEGACY_RECONSTRUCTION_COPY, neutralResearchCopy } from './public-research-copy';

describe('Public research copy release', () => {
  let p: ReportPresentationService;
  beforeEach(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    TestBed.configureTestingModule({providers:[provideTranslateService()]});
    p=TestBed.inject(ReportPresentationService);
  });
  afterEach(() => {localStorage.removeItem(LANGUAGE_STORAGE_KEY); document.documentElement.lang='en';});

  it('localizes neutral disclosures in every supported language without losing extra warnings', () => {
    const raw=LEGACY_RECONSTRUCTION_COPY.replace('Archived bookmaker', 'Archived TennisExplorer bookmaker');
    const extra=' Unreviewed markets remain withheld. No guaranteed future profit.';
    for(const language of SUPPORTED_LANGUAGES){
      p.regional.setLanguage(language.code);
      expect(p.source(raw)).toBe(p.regional.text('researchData.reconstruction'));
      expect(p.source(raw+extra)).toBe(p.regional.text('researchData.reconstruction')+extra);
      expect(p.regional.text('researchData.notice')).toContain('BonzoByte');
      expect(p.regional.text('researchData.notice')).toContain('ROI');
      expect(p.regional.text('researchData.notice')).not.toContain('researchData.');
      expect(p.source(raw+extra)).not.toMatch(/tennis\s*(explorer|prediction)/i);
      expect(p.source('Canonical finished TennisPrediction rows only; player 1 is the winner.'))
        .toBe(p.regional.text('reports.copy.canonicalFinishedTennispredictionRowsOnlyPlayer1IsTheWinner'));
    }
  });

  it('keeps report values, evidence, unknown conclusions and source IDs intact', () => {
    const raw=Object.freeze({text:LEGACY_RECONSTRUCTION_COPY,odds:[1.03,10.50],roi:-0.0037694704049844237,
      prediction:0.9677,sourceId:'TP:827341732;TE:3281349'});
    const before=JSON.stringify(raw);
    p.source(raw.text);expect(JSON.stringify(raw)).toBe(before);
    expect(p.source('Unrecognized conclusion: ROI -2.50%; confidence 63.57%.'))
      .toBe('Unrecognized conclusion: ROI -2.50%; confidence 63.57%.');
    expect(neutralResearchCopy('TennisExploration and player TP:123')).toBe('TennisExploration and player TP:123');
  });
});
