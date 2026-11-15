import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { MatchPlayersCellComponent, MatchTournamentCellComponent, MatchResultCellComponent } from './match-grid-cells.component';
import { createPopularPreview } from '../popular/popular-preview';
import en from '../../../../assets/i18n/en.json';

describe('Reusable main-grid identity and result cells', () => {
 beforeEach(async () => { await TestBed.configureTestingModule({ imports: [MatchPlayersCellComponent, MatchTournamentCellComponent, MatchResultCellComponent], providers: [provideTranslateService()] }).compileComponents();
  const t = TestBed.inject(TranslateService); t.setTranslation('en', en); t.use('en'); });
 it('shows the same two labelled players and emits the clicked side, not the whole row', () => {
  const f = TestBed.createComponent(MatchPlayersCellComponent), match = createPopularPreview().matches[0].match;
  f.componentRef.setInput('match', match); f.componentRef.setInput('preview', true); f.componentRef.setInput('selectedSide', 2); f.detectChanges();
  const emit = spyOn(f.componentInstance.playerOpened, 'emit');
  expect(f.nativeElement.querySelector('.fi-hr').title).toBe('Croatia'); expect(f.nativeElement.querySelectorAll('button').length).toBe(2);
  f.nativeElement.querySelectorAll('button')[1].click(); expect(emit).toHaveBeenCalledOnceWith(2);
  expect(f.nativeElement.querySelectorAll('.is-selected').length).toBe(1);
  f.componentRef.setInput('preview', false); f.detectChanges(); expect(f.nativeElement.querySelectorAll('button').length).toBe(0);
 });
 it('uses cached main-grid full and compact labels when supplied', () => {
  const f = TestBed.createComponent(MatchPlayersCellComponent); f.componentRef.setInput('match', { matchTPId: 42, player1TPId: 1, player2TPId: 2 });
  f.componentRef.setInput('labels', { player1: 'Cached one', player2: 'Cached two', player1Compact: 'One', player2Compact: 'Two' }); f.detectChanges();
  expect(f.nativeElement.querySelector('.shared-full').textContent).toBe('Cached one'); expect(f.nativeElement.querySelector('.shared-compact').textContent).toBe('One');
 });
 it('renders legacy decorated names once in both the visible text and the tooltip', () => {
  const f = TestBed.createComponent(MatchPlayersCellComponent);
  f.componentRef.setInput('match', { matchTPId: 42, player1TPId: 1, player2TPId: 2,
   player1Name: 'Auer Stefani [11] (AUT)', player1CountryISO3: 'AUT', player1Seed: '11', player1Rank: '1334',
   player2Name: 'Yazdani Mahsa (2008) (IRN)', player2CountryISO3: 'IRN' }); f.detectChanges();
  const names = f.nativeElement.querySelectorAll('.shared-full');
  expect(names[0].textContent).toBe('Auer Stefani (AUT) (11) [1334]');
  expect(names[0].title).toBe(names[0].textContent);
  expect(names[1].textContent).toBe('Yazdani Mahsa (2008) (IRN)');
  expect(names[1].title).toBe(names[1].textContent);
 });
 it('shows flag, calibrated strength, surface and tournament action', () => {
  const f = TestBed.createComponent(MatchTournamentCellComponent); f.componentRef.setInput('match', createPopularPreview().matches[0].match); f.componentRef.setInput('preview', true); f.detectChanges();
  const emit = spyOn(f.componentInstance.tournamentOpened, 'emit'); f.nativeElement.querySelector('button').click(); expect(emit).toHaveBeenCalled();
  expect(f.nativeElement.querySelectorAll('.star.full').length).toBe(2); expect(f.nativeElement.querySelectorAll('.star.half').length).toBe(1);
  expect(f.nativeElement.querySelector('.stars').closest('.strength-cell')).not.toBeNull();
  expect(f.nativeElement.querySelector('.shared-surface--hard')).not.toBeNull();
 });
 it('shares supplied final and set scores but preserves main-grid quality warnings', () => {
  const f = TestBed.createComponent(MatchResultCellComponent); f.componentRef.setInput('match', createPopularPreview().matches[0].match); f.detectChanges();
  expect(f.nativeElement.querySelector('.shared-result-main').textContent).toBe('2:1'); expect(f.nativeElement.querySelector('.shared-result-sets').textContent).toBe('6:4 4:6 6:3');
  f.componentRef.setInput('presentation', { result: '—', sets: '', qualityHold: true, qualityTitle: 'Check' }); f.detectChanges();
  expect(f.nativeElement.querySelector('.match-quality-warning').title).toBe('Check');
 });
});
