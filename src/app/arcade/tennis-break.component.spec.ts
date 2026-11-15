import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { TennisBreakComponent } from './tennis-break.component';
import { TennisCareerService } from './tennis-career.service';
import { Subject, of, throwError } from 'rxjs';
import { TENNIS_KERNEL_VERSION } from './tennis-kernel-version';
import { replayArcade } from './tennis-replay';
import { SERVE_TOSS } from './tennis-3d-engine';

describe('Tennis break lifecycle and controls', () => {
  let fixture: ComponentFixture<TennisBreakComponent>;
  let page: TennisBreakComponent;
  const language = signal('en');
  let career: any;
  beforeEach(async () => {
    language.set('en');
    career = { actorChanged:new Subject<void>(), search:jasmine.createSpy('search'), opponents:signal([]),selected:signal(null),profile:signal(null),board:signal(null), catalogError:signal(false),searching:signal(false),signedIn:signal(false),verified:signal(false),engineVersion:signal(TENNIS_KERNEL_VERSION),profileError:signal(false),boardError:signal(false),boardLoading:signal(false), refreshProfile:jasmine.createSpy('profile'),refreshBoard:jasmine.createSpy('board'),start:jasmine.createSpy('start'),finish:jasmine.createSpy('finish') };
    await TestBed.configureTestingModule({ imports: [TennisBreakComponent], providers: [provideRouter([]), { provide: TennisCareerService,useValue:career }, { provide: RegionalSettingsService, useValue: { language,dateTime:(v:string)=>v } }] }).compileComponents();
    spyOn(window, 'requestAnimationFrame').and.returnValue(52);
    spyOn(window, 'cancelAnimationFrame');
    spyOn(TennisBreakComponent.prototype, 'ngAfterViewInit').and.callFake(function(this: TennisBreakComponent) {
      (this as any).renderer = { draw: jasmine.createSpy('draw'), dispose: jasmine.createSpy('dispose'), setCamera: jasmine.createSpy('setCamera'), setLightweight: jasmine.createSpy('setLightweight'), resize: jasmine.createSpy('resize') };
    });
    fixture = TestBed.createComponent(TennisBreakComponent); page = fixture.componentInstance; fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());
  const players = [{id: 101, name: 'Alpha Player', countryISO2: 'hr', countryISO3: 'HRV', ts: 31, lastMatch: null},
    {id: 102, name: 'Beta Player', countryISO2: 'de', countryISO3: 'DEU', ts: null, lastMatch: null}];
  function showSuggestions(): void { career.opponents.set(players); page.searchOpponents('Player'); tick(300); fixture.detectChanges(); }
  function awaitServeContact(): void {
    for (let i = 0; i < Math.ceil(SERVE_TOSS.contact / .01) + 2 && page.game.phase === 'serving'; i++) page.game.update(.01, (page as any).input());
  }
  it('centres the compact heading and removes only the redundant heading shortcut and native opponent select', () => {
    expect(fixture.nativeElement.querySelector('.arcade-heading.bb-compact-heading--centred')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.arcade-heading a')).toBeNull();
    expect(fixture.nativeElement.querySelector('.opponent-picker select')).toBeNull();
    expect(fixture.nativeElement.querySelector('#arcade-player-search').getAttribute('role')).toBe('combobox');
  });
  it('debounces typing and hides stale results until the new search is ready', fakeAsync(() => {
    career.opponents.set(players);page.searchOpponents('Al');tick(100);page.searchOpponents('Alpha');fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(0);tick(299);
    expect(career.search).toHaveBeenCalledTimes(1);tick(1);expect(career.search).toHaveBeenCalledWith('Alpha');
    fixture.detectChanges();expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(2);
  }));
  it('uses arrows and Enter without moving focus out of the search field', fakeAsync(() => {
    showSuggestions();const input=fixture.nativeElement.querySelector('#arcade-player-search') as HTMLInputElement;
    input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('arcade-player-option-101');
    expect(document.activeElement).toBe(input);input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));fixture.detectChanges();
    expect(career.selected()).toEqual(players[0]);expect(input.value).toBe('Alpha Player');expect(page.opponentOpen()).toBeFalse();
    expect(input.getAttribute('aria-activedescendant')).toBeNull();expect(page.game.phase).toBe('ready');
  }));
  it('wraps the keyboard cursor and Escape closes without selecting or clearing an opponent', fakeAsync(() => {
    showSuggestions();career.selected.set(players[0]);page.opponentKeyDown(new KeyboardEvent('keydown',{key:'ArrowUp'}));
    expect(page.activeOpponentIndex()).toBe(1);page.opponentKeyDown(new KeyboardEvent('keydown',{key:'ArrowDown'}));expect(page.activeOpponentIndex()).toBe(0);
    const escape=new KeyboardEvent('keydown',{key:'Escape',cancelable:true});page.opponentKeyDown(escape);
    expect(escape.defaultPrevented).toBeTrue();expect(page.opponentOpen()).toBeFalse();expect(career.selected()).toEqual(players[0]);
  }));
  it('selects a clicked suggestion with its TS unchanged and allows returning to ordinary practice', fakeAsync(() => {
    showSuggestions();(fixture.nativeElement.querySelector('[role="option"]') as HTMLElement).click();fixture.detectChanges();
    expect(career.selected()?.ts).toBe(31);expect(page.searchText()).toBe('Alpha Player');
    (fixture.nativeElement.querySelector('.clear-opponent') as HTMLButtonElement).click();fixture.detectChanges();
    expect(career.selected()).toBeNull();expect(page.searchText()).toBe('');expect(page.opponentName()).toBe('Computer');
  }));
  it('bounds suggestions to thirty and never inserts a previous selection into an unrelated search', fakeAsync(() => {
    career.selected.set(players[0]);career.opponents.set(Array.from({length:45},(_,i)=>({...players[1],id:200+i,name:'Search '+i})));
    page.searchOpponents('Search');tick(300);fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(30);expect(page.opponentChoices().some(p=>p.id===101)).toBeFalse();
    page.chooseOpponentId('101');expect(career.selected()).toEqual(players[0]);expect(page.opponentOpen()).toBeTrue();
  }));
  it('shows loading, empty and failure states rather than exposing stale suggestions', fakeAsync(() => {
    showSuggestions();career.searching.set(true);fixture.detectChanges();expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.opponent-search-status').textContent).toContain('Searching');
    career.searching.set(false);career.opponents.set([]);fixture.detectChanges();expect(fixture.nativeElement.querySelector('.opponent-search-status').textContent).toContain('No players');
    career.catalogError.set(true);fixture.detectChanges();expect(fixture.nativeElement.querySelector('.opponent-search-status').textContent).toContain(page.words().catalogUnavailable);
  }));
  it('does not select or modify the opponent while a search, game or rated start is in progress', fakeAsync(() => {
    showSuggestions();career.searching.set(true);page.chooseOpponentId('101');expect(career.selected()).toBeNull();career.searching.set(false);
    page.careerBusy.set(true);page.chooseOpponentId('101');page.searchOpponents('ignored');expect(page.searchText()).toBe('Player');page.careerBusy.set(false);
    page.start();page.chooseOpponentId('101');page.clearOpponent();expect(career.selected()).toBeNull();expect(page.opponentOpen()).toBeFalse();
  }));
  it('closes suggestions on outside click and Tab focus without sending a request or changing selection', fakeAsync(() => {
    showSuggestions();page.outsideOpponentSearch({target:document.body} as unknown as PointerEvent);expect(page.opponentOpen()).toBeFalse();
    page.openOpponentSearch();tick(300);fixture.detectChanges();
    const tab=new KeyboardEvent('keydown',{key:'Tab',cancelable:true});page.opponentKeyDown(tab);
    expect(page.opponentOpen()).toBeFalse();expect(tab.defaultPrevented).toBeFalse();page.openOpponentSearch();tick(300);fixture.detectChanges();
    fixture.nativeElement.querySelector('#arcade-player-search').dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:document.body}));
    expect(page.opponentOpen()).toBeFalse();expect(career.selected()).toBeNull();expect(career.start).not.toHaveBeenCalled();
  }));
  it('preserves a no-TS player as a practice-only opponent and ignores composing keyboard input', fakeAsync(() => {
    showSuggestions();page.opponentKeyDown(new KeyboardEvent('keydown',{key:'ArrowDown',isComposing:true}));expect(page.activeOpponentIndex()).toBe(-1);
    page.chooseOpponentId('102');expect(career.selected()).toEqual(players[1]);page.setRated(true);page.start();expect(career.start).not.toHaveBeenCalled();
  }));
  it('cancels a pending query when suggestions close or the component is destroyed', fakeAsync(() => {
    page.searchOpponents('cancelled');page.closeOpponentSearch();tick(400);expect(career.search).toHaveBeenCalledTimes(1);
    page.searchOpponents('destroyed');fixture.destroy();tick(400);expect(career.search).toHaveBeenCalledTimes(1);
  }));
  function finishGame(winner:0|1=0):void {
    page.game.scoring.winner=winner;page.game.phase='over';(page as any).sync();fixture.detectChanges();
  }
  it('offers play again, game leaderboard and matches after either outcome, but not during play',()=>{
    expect(fixture.nativeElement.querySelector('.end-game-actions')).toBeNull();
    for(const winner of [0,1] as const){finishGame(winner);const buttons=[...fixture.nativeElement.querySelectorAll('.end-game-actions button')] as HTMLButtonElement[];
      expect(buttons.map(button=>button.textContent?.trim())).toEqual(['Leaderboard','Back to matches']);
      expect(fixture.nativeElement.querySelector('.play-button').textContent).toContain('Play again');}
    language.set('hr');fixture.detectChanges();expect(fixture.nativeElement.querySelector('.end-game-actions').textContent).toContain('Natrag na mečeve');
  });
  it('routes the finished game to the Tennis break leaderboard without starting another game',async()=>{
    finishGame();const navigate=spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);const start=spyOn(page,'start');
    (fixture.nativeElement.querySelector('.end-game-actions button') as HTMLButtonElement).click();await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/competition'],{queryParams:{tab:'tennis-break'}});expect(start).not.toHaveBeenCalled();
  });
  it('leaves fullscreen and restores page scrolling before returning to matches',async()=>{
    const original=document.body.style.overflow;spyOn(page.gamePanel.nativeElement,'requestFullscreen').and.rejectWith(new Error('Denied'));
    await page.toggleFullscreen();finishGame();const navigate=spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);
    await page.leaveFinishedGame('matches');expect(navigate).toHaveBeenCalledWith(['/matches']);expect(page.expanded()).toBeFalse();expect(document.body.style.overflow).toBe(original);
  });
  it('waits for result saving and blocks duplicate exits while navigation is pending',async()=>{
    finishGame();const navigate=spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);page.savingResult.set(true);fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.end-game-actions button') as HTMLButtonElement).disabled).toBeTrue();
    await page.leaveFinishedGame('leaderboard');expect(navigate).not.toHaveBeenCalled();page.savingResult.set(false);
    let complete!:(value:boolean)=>void;navigate.and.returnValue(new Promise(resolve=>complete=resolve));
    const leaving=page.leaveFinishedGame('matches');await page.leaveFinishedGame('leaderboard');expect(navigate).toHaveBeenCalledTimes(1);complete(true);await leaving;
  });
  it('preserves an unsaved replay unless the user explicitly confirms leaving',async()=>{
    finishGame();(page as any).replayToSave='pending-replay';const navigate=spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);
    const confirm=spyOn(window,'confirm').and.returnValue(false);await page.leaveFinishedGame('matches');expect(navigate).not.toHaveBeenCalled();expect(page.canRetryCareerSave()).toBeTrue();
    confirm.and.returnValue(true);await page.leaveFinishedGame('matches');expect(navigate).toHaveBeenCalledWith(['/matches']);expect(career.finish).not.toHaveBeenCalled();
  });
  it('keeps the retry-save action visible inside the finished fullscreen card',()=>{
    finishGame();(page as any).replayToSave='pending-replay';page.careerMessage.set('Could not save');fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.start-card .end-save-warning').textContent).toContain('Try saving again');
  });
  it('lets guests practise but requires verification, TS and explicit consent for rated play', () => {
    page.setRated(true); page.start(); expect(career.start).not.toHaveBeenCalled();
    career.verified.set(true);career.selected.set({id:123,name:'Test Player',ts:32});page.rankingConsent.set(true);
    career.start.and.returnValue(of({id:'game',seed:45,engineVersion:TENNIS_KERNEL_VERSION,surface:'grass',opponent:{id:123,name:'Test Player',ts:32,strength:.68,gameMu:28.6}}));
    page.start();expect(career.start).toHaveBeenCalledTimes(1);expect(page.matchFormat()).toBe('challenge');expect(page.assist()).toBeTrue();
    expect(page.game.opponentStrength).toBe(.68);expect((page as any).recorder).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Test Player');fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Test Player');
  });
  it('clears a private rated game on an account change without submitting another result', () => {
    page.rated.set(true);(page as any).replayToSave='private';career.actorChanged.next();
    expect(page.rated()).toBeFalse();expect((page as any).replayToSave).toBeNull();expect(career.finish).not.toHaveBeenCalled();
  });
  it('locks setup while a rated start is pending and uses the server-confirmed surface', () => {
    career.verified.set(true); career.selected.set({id:123,name:'Test',ts:32}); page.setRated(true); page.rankingConsent.set(true);
    const pending = new Subject<any>(); career.start.and.returnValue(pending); page.start();
    page.changeSurface('clay'); page.changeDifficulty('easy'); page.changeFormat('match');
    expect(page.surface()).toBe('grass'); expect(page.difficulty()).toBe('normal'); expect(page.matchFormat()).toBe('challenge');
    // Even an unrelated signal change cannot override the authoritative session surface.
    page.surface.set('hard');
    pending.next({id:'game',seed:45,engineVersion:TENNIS_KERNEL_VERSION,surface:'clay',opponent:{id:123,name:'Test',ts:32,strength:.68,gameMu:28.6}});
    expect(page.surface()).toBe('clay'); expect(page.game.surface).toBe('clay'); expect(page.game.phase).toBe('serving');
    expect((page as any).recorder).toBeTruthy();
  });
  it('does not start or record a ranked session returned for a different kernel version', () => {
    career.verified.set(true); career.selected.set({id:123,name:'Test',ts:32}); page.setRated(true); page.rankingConsent.set(true);
    career.start.and.returnValue(of({id:'game',seed:45,engineVersion:'different-version',surface:'grass',opponent:{id:123,name:'Test',ts:32,strength:.68,gameMu:28.6}}));
    page.start(); expect(page.game.phase).toBe('ready'); expect((page as any).recorder).toBeNull();
    expect(page.careerMessage()).toBe(page.words().gameVersion); expect(career.finish).not.toHaveBeenCalled();
  });
  it('keeps the same start request id after a network error and blocks duplicate starts while pending', () => {
    career.verified.set(true);career.selected.set({id:123,name:'Test',ts:25});page.setRated(true);page.rankingConsent.set(true);
    career.start.and.returnValue(throwError(()=>({error:{code:'ARCADE_UNAVAILABLE'}})));page.start();page.start();
    expect(career.start.calls.argsFor(0)[0].requestId).toBe(career.start.calls.argsFor(1)[0].requestId);
    page.careerBusy.set(true);page.start();expect(career.start).toHaveBeenCalledTimes(2);
  });
  it('records the actual component controls so server replay reaches the identical result',()=>{
    career.verified.set(true);career.selected.set({id:123,name:'Test',ts:32});page.setRated(true);page.rankingConsent.set(true);
    career.start.and.returnValue(of({id:'game',seed:45,engineVersion:TENNIS_KERNEL_VERSION,surface:'grass',opponent:{id:123,name:'Test',ts:32,strength:.68,gameMu:28.6}}));
    let saved='';career.finish.and.callFake((_id:string,replay:string)=>{saved=replay;return of({winner:1,before:{mu:25},after:{mu:20,sigma:7,played:1},monthly:{mu:20}});});
    page.start();let held=0,time=1000;
    for(let i=0;i<20000&&page.game.phase!=='over';i++){
      if(page.game.phase==='serving'&&page.game.server===0){
        if(held===0)page.keyDown(new KeyboardEvent('keydown',{key:'x'}));
        if(held++===8)page.keyUp(new KeyboardEvent('keyup',{key:'x'}));
      }else held=0;
      const callback=(window.requestAnimationFrame as jasmine.Spy).calls.mostRecent().args[0];callback(time+=20);
    }
    expect(page.game.phase).toBe('over');expect(saved).not.toBe('');
    const bytes=Uint8Array.from(atob(saved),char=>char.charCodeAt(0));const verified=replayArcade(bytes,{seed:45,strength:.68,surface:'grass'});
    expect(verified.winner).toBe(page.game.winner!);expect(verified.score).toEqual([...page.game.score]);expect(career.finish).toHaveBeenCalledTimes(1);
  });
  it('does not animate, play audio or access data before Start', () => {
    expect(page.game.phase).toBe('ready'); expect(window.requestAnimationFrame).not.toHaveBeenCalled(); expect(page.sound()).toBeFalse();
    expect(fixture.nativeElement.querySelector('canvas').width).toBe(1000);
  });
  it('keeps practice playable and disables rated challenges while the server has older physics', () => {
    career.verified.set(true); career.engineVersion.set('older-reviewed-kernel'); fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.mode-switch button') as NodeListOf<HTMLButtonElement>;
    expect(buttons[0].disabled).toBeFalse(); expect(buttons[1].disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.rated-options [role="status"]').textContent).toContain('Your saved rating stays unchanged');
    page.start(); expect(page.game.phase).toBe('serving'); expect(career.start).not.toHaveBeenCalled();
    page.setup(); career.engineVersion.set(TENNIS_KERNEL_VERSION); fixture.detectChanges();
    expect(buttons[1].disabled).toBeFalse(); expect(fixture.nativeElement.querySelector('.rated-options [role="status"]')).toBeNull();
    career.engineVersion.set('older-reviewed-kernel'); language.set('hr'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.rated-options [role="status"]').textContent).toContain('Tvoja spremljena ocjena ostaje nepromijenjena');
  });
  it('starts only on interaction and stops the frame on pause', () => {
    page.start(); fixture.detectChanges(); expect(page.view().phase).toBe('serving'); expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    page.pause(); expect(page.paused()).toBeTrue(); expect(window.cancelAnimationFrame).toHaveBeenCalledWith(52);
  });
  it('stops on window blur and clears held movement', () => {
    page.start(); page.keyDown(new KeyboardEvent('keydown', { key: 'd' })); page.windowBlur();
    expect(page.paused()).toBeTrue(); expect((page as any).input().right).toBeFalse();
  });
  it('updates charge physics every frame but limits SPA meter refreshes to 20 Hz',()=>{
    page.start();page.keyDown(new KeyboardEvent('keydown',{key:' '}));
    const sync=spyOn(page as any,'sync').and.callThrough();let time=1000;
    for(let i=0;i<10;i++)(window.requestAnimationFrame as jasmine.Spy).calls.mostRecent().args[0](time+=10);
    expect(page.game.serveCharge).toBeGreaterThan(.05);expect(sync.calls.count()).toBeLessThanOrEqual(3);
  });
  it('cancels the frame and clears controls on route destruction', () => {
    page.start(); page.ngOnDestroy(); expect(window.cancelAnimationFrame).toHaveBeenCalledWith(52);
    expect((page as any).frameId).toBeNull();
  });
  it('starts a clean setup when New match is chosen', () => {
    page.start(); page.game.score = [4, 3]; page.setup(); expect(page.view().phase).toBe('ready'); expect(page.view().left).toBe(0);
    page.changeSurface('clay'); expect(page.surface()).toBe('clay');
    page.changeDifficulty('hard'); page.start(); expect(page.game.surface).toBe('clay'); expect(page.game.difficulty).toBe('hard');
  });
  it('prevents game-key scrolling but leaves other keyboard input alone', () => {
    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true }); page.keyDown(space); expect(space.defaultPrevented).toBeTrue();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); page.keyDown(tab); expect(tab.defaultPrevented).toBeFalse();
  });
  it('charges Space immediately, releases once and retains optional lob/smash keys', () => {
    page.start(); page.game.strikeServe();
    page.keyDown(new KeyboardEvent('keydown',{key:' '}));
    expect((page as any).input()).toEqual(jasmine.objectContaining({shot:'drive',aiming:true}));
    page.game.update(.05,(page as any).input());expect(page.game.strokeCharge).toBeGreaterThan(0);expect(page.game.hits).toBe(0);
    page.keyUp(new KeyboardEvent('keyup',{key:' '}));
    page.game.update(.01,(page as any).input());expect(page.game.strokePending).toBeTrue();expect((page as any).input().shot).toBeNull();
    page.keyDown(new KeyboardEvent('keydown',{key:'c'}));expect((page as any).input().shot).toBe('lob');
    page.keyUp(new KeyboardEvent('keyup',{key:'c'}));page.keyDown(new KeyboardEvent('keydown',{key:'z'}));expect((page as any).input().shot).toBe('smash');
  });
  it('maps adjacent B and N to charged drop and smash with arrow aiming',()=>{
    page.start();page.game.strikeServe();
    for(const [key,shot] of [['b','drop'],['n','smash']] as const){
      const event=new KeyboardEvent('keydown',{key,cancelable:true});page.keyDown(event);page.keyDown(new KeyboardEvent('keydown',{key:'ArrowLeft'}));
      expect(event.defaultPrevented).toBeTrue();expect((page as any).input()).toEqual(jasmine.objectContaining({shot,aiming:true,left:true}));expect(page.selectedShot()).toBe(shot);
      page.game.update(.05,(page as any).input());expect(page.game.strokeCharge).toBeGreaterThan(0);expect(page.game.strokeAim).toBeLessThan(0);expect(page.game.hits).toBe(0);
      page.keyUp(new KeyboardEvent('keyup',{key}));page.keyUp(new KeyboardEvent('keyup',{key:'ArrowLeft'}));page.game.update(.01,(page as any).input());expect(page.game.strokePending).toBeTrue();
      page.clearInput();
    }
  });
  it('includes drop and smash instructions and a touch drop button in both languages',()=>{
    expect(fixture.nativeElement.querySelector('.control-keys').textContent).toContain('B');expect(fixture.nativeElement.querySelector('.control-keys').textContent).toContain('N');
    expect(fixture.nativeElement.querySelector('.shot-help').textContent).toContain('lower, slower bounce');
    language.set('hr');fixture.detectChanges();expect(fixture.nativeElement.querySelector('.touch-controls').textContent).toContain('Skraćena');
  });
  it('cancels a touch drop without launching an accidental stroke',()=>{
    page.start();page.game.strikeServe();page.touchStart({pointerId:19,currentTarget:{setPointerCapture(){}},preventDefault(){}} as any,'drop');
    expect((page as any).input()).toEqual(jasmine.objectContaining({shot:'drop',aiming:true}));page.game.update(.05,(page as any).input());page.touchCancel({pointerId:19} as any);
    page.game.update(.02,(page as any).input());expect(page.game.strokePending).toBeFalse();expect(page.game.hits).toBe(0);expect(page.selectedShot()).toBeNull();
  });
  it('ignores auto-repeat and integrates aim in the engine while held', () => {
    page.start(); page.game.strikeServe(); spyOn(performance, 'now').and.returnValue(1000);
    page.keyDown(new KeyboardEvent('keydown', { key: ' ' }));
    page.keyDown(new KeyboardEvent('keydown', { key: ' ', repeat: true }));
    page.keyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect((page as any).input()).toEqual(jasmine.objectContaining({ shot: 'drive', left: true, aiming: true }));
    page.game.update(.05,(page as any).input());const aim=page.game.strokeAim;expect(aim).toBeLessThan(0);
    page.keyUp(new KeyboardEvent('keyup', { key: ' ' })); page.keyUp(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    page.game.update(.01,(page as any).input());expect(page.game.strokeAim).toBe(aim);
    page.pause(); expect((page as any).input(1190).shot).toBeNull(); expect(page.selectedShot()).toBeNull();
  });
  it('starts a toss on the first Space hold and queues overhead contact on release', () => {
    page.start(); page.keyDown(new KeyboardEvent('keydown', { key: ' ' }));
    page.game.update(.05, (page as any).input()); expect(page.game.serveCharge).toBeGreaterThan(0);
    expect(page.game.serveTossActive).toBeTrue(); expect(page.game.serveTossProgress).toBeGreaterThan(0);
    page.keyUp(new KeyboardEvent('keyup', { key: ' ' })); page.game.update(.01, (page as any).input());
    expect(page.game.phase).toBe('serving'); expect(page.game.serveReleaseQueued).toBeTrue(); expect((page as any).input().shot).toBeNull();
    awaitServeContact(); expect(page.game.phase).toBe('playing'); expect(page.game.players[0].stroke).toBe('serve');
  });
  it('offers service direction buttons and returns keyboard focus to the court', () => {
    page.start(); fixture.detectChanges();
    const buttons: HTMLButtonElement[] = [...fixture.nativeElement.querySelectorAll('.serve-aim-options button')];
    expect(buttons.length).toBe(3); buttons[0].click(); fixture.detectChanges();
    expect(page.game.serveAim).toBe(-1); expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(page.court.nativeElement);
    buttons[2].click(); fixture.detectChanges(); expect(page.game.serveAim).toBe(1);
    buttons[1].click(); fixture.detectChanges(); expect(page.game.serveAim).toBe(0);
  });
  it('retains the serve aim after releasing direction keys before the service', () => {
    page.start(); page.keyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    for (let i = 0; i < 10; i++) page.game.update(.05, (page as any).input());
    page.keyUp(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    page.keyDown(new KeyboardEvent('keydown', { key: ' ' })); page.game.update(.05, (page as any).input());
    const target = page.game.serveTarget;
    page.keyUp(new KeyboardEvent('keyup', { key: ' ' })); page.game.update(.01, (page as any).input());
    awaitServeContact();
    expect(page.game.phase).toBe('playing'); expect(page.game.serveAim).toBeCloseTo(-.9,5);
    expect(page.game.landing().x).toBeCloseTo(target.x, 3);
  });
  it('does not alter service direction while paused or when the computer serves', () => {
    page.start(); page.game.setServeAim(.5); page.pause(); page.chooseServeAim(-1); expect(page.game.serveAim).toBe(.5);
    page.resume(); page.game.server = 1; page.chooseServeAim(-1); expect(page.game.serveAim).toBe(.5);
  });
  it('localizes service direction controls and keeps them out of rally play', () => {
    page.start(); language.set('hr'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.serve-aim-options').getAttribute('aria-label')).toBe('Smjer servisa');
    expect(fixture.nativeElement.querySelector('.serve-target-hint').textContent).toContain('cilj');
    page.game.strikeServe(); (page as any).sync(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('.serve-aim-options')).toBeNull();
  });
  it('records depth buttons as commands 6, 7 and 8 and restores court focus without changing the opponent', () => {
    career.selected.set(players[0]); page.start(); fixture.detectChanges();
    const record = spyOn(page as any, 'recordCommand');
    const buttons = [...fixture.nativeElement.querySelectorAll('.serve-depth-options button')] as HTMLButtonElement[];
    expect(buttons.map(button => button.textContent?.trim())).toEqual(['↓ Near', 'Centre', 'Deep ↑']);
    for (const [index, depth, command] of [[0, -1, 6], [1, 0, 7], [2, 1, 8]]) {
      buttons[index].click(); fixture.detectChanges();
      expect(page.game.serveDepth).toBe(depth); expect(record).toHaveBeenCalledWith(command);
      expect(buttons[index].getAttribute('aria-pressed')).toBe('true'); expect(document.activeElement).toBe(page.court.nativeElement);
    }
    expect(record.calls.allArgs()).toEqual([[6], [7], [8]]); expect(career.selected()).toEqual(players[0]);
    expect(fixture.nativeElement.querySelector('.computer-score').textContent).toContain('Alpha Player');
    expect(career.start).not.toHaveBeenCalled(); expect(career.finish).not.toHaveBeenCalled();
  });
  it('rejects depth changes outside a live human serve, while paused, or for unsupported values', () => {
    const record = spyOn(page as any, 'recordCommand');
    page.chooseServeDepth(1); expect(record).not.toHaveBeenCalled();
    page.start(); page.chooseServeDepth(.4); page.chooseServeDepth(NaN); page.chooseServeDepth(Infinity);
    expect(page.game.serveDepth).toBe(0);
    page.chooseServeDepth(1); page.pause(); record.calls.reset();
    page.chooseServeDepth(-1); expect(page.game.serveDepth).toBe(1); expect(record).not.toHaveBeenCalled(); expect(page.paused()).toBeTrue();
    page.resume(); record.calls.reset(); page.game.server = 1; page.chooseServeDepth(-1); expect(page.game.serveDepth).toBe(1);
    page.game.server = 0; page.game.strikeServe(); page.chooseServeDepth(-1); expect(page.game.serveDepth).toBe(1); expect(record).not.toHaveBeenCalled();
  });
  it('passes held up/down and left/right arrows through the input contract for depth and width without an idle toss', () => {
    page.start(); const position = { x: page.game.players[0].x, z: page.game.players[0].z };
    const up = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }); page.keyDown(up);
    page.keyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(up.defaultPrevented).toBeTrue(); expect((page as any).input()).toEqual(jasmine.objectContaining({ forward: true, right: true, shot: null }));
    page.game.update(.05, (page as any).input()); expect(page.game.serveDepth).toBeGreaterThan(0); expect(page.game.serveAim).toBeGreaterThan(0);
    const depth = page.game.serveDepth; page.keyUp(new KeyboardEvent('keyup', { key: 'ArrowUp' })); page.keyUp(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    page.game.update(.05, (page as any).input()); expect(page.game.serveDepth).toBe(depth); expect(page.game.serveTossActive).toBeFalse();
    page.keyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' })); page.game.update(.05, (page as any).input());
    expect((page as any).input().back).toBeTrue(); expect(page.game.serveDepth).toBeLessThan(depth);
    expect(page.game.players[0].x).toBe(position.x); expect(page.game.players[0].z).toBe(position.z);
    page.keyUp(new KeyboardEvent('keyup', { key: 'ArrowDown' })); page.game.strikeServe();
    page.keyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' })); const z = page.game.players[0].z;
    page.game.update(.05, (page as any).input()); expect(page.game.players[0].z).toBeLessThan(z);
  });
  it('supports touch depth aiming during a toss and restores movement labels for rallies', () => {
    page.start(); fixture.detectChanges();
    const directions = fixture.nativeElement.querySelectorAll('.touch-directions button') as NodeListOf<HTMLButtonElement>;
    expect(directions[0].getAttribute('aria-label')).toContain('Deep'); expect(directions[2].getAttribute('aria-label')).toContain('Near');
    expect(fixture.nativeElement.querySelector('.hit-touch').textContent).toContain('Toss / serve');
    const pointer = (pointerId: number) => ({ pointerId, preventDefault() {}, currentTarget: { setPointerCapture() {} } } as any);
    page.touchStart(pointer(11), 'drive'); page.touchStart(pointer(12), 'forward'); page.game.update(.05, (page as any).input());
    expect(page.game.serveDepth).toBeGreaterThan(0); expect(page.game.serveTossActive).toBeTrue();
    page.touchEnd(pointer(12)); page.touchEnd(pointer(11)); page.game.update(.01, (page as any).input()); awaitServeContact();
    expect(page.game.phase).toBe('playing'); (page as any).sync(); fixture.detectChanges();
    expect(directions[0].getAttribute('aria-label')).toBe('Move ↑'); expect(fixture.nativeElement.querySelector('.hit-touch').textContent.trim()).toBe('Hit');
    expect(fixture.nativeElement.querySelector('.serve-depth-options')).toBeNull();
  });
  it('locks depth and width buttons after release and shows queued contact without an immediate hit', () => {
    page.start(); page.chooseServeDepth(1); page.keyDown(new KeyboardEvent('keydown', { key: ' ' }));
    page.game.update(.05, (page as any).input()); (page as any).sync(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.serve-toss-status').textContent).toBe(page.words().tossStatus);
    page.keyUp(new KeyboardEvent('keyup', { key: ' ' })); page.game.update(.01, (page as any).input()); (page as any).sync(); fixture.detectChanges();
    const record = spyOn(page as any, 'recordCommand'); page.chooseServeDepth(-1); page.chooseServeAim(-1);
    expect(record).not.toHaveBeenCalled(); expect(page.game.serveDepth).toBe(1); expect(page.game.serveAim).toBe(0);
    expect(page.game.phase).toBe('serving'); expect(fixture.nativeElement.querySelector('.serve-toss-status').textContent).toBe(page.words().queuedServe);
    for (const button of fixture.nativeElement.querySelectorAll('.serve-target button')) expect(button.disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.serve-toss [role="progressbar"]').getAttribute('aria-valuenow')).toBe('6');
    awaitServeContact(); expect(page.game.phase).toBe('playing');
  });
  it('does not blur or cancel a held keyboard toss when a target button is pressed', () => {
    page.start(); page.keyDown(new KeyboardEvent('keydown', { key: ' ' })); page.game.update(.05, (page as any).input()); fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.serve-depth-options button:last-child') as HTMLButtonElement;
    const pointer = new PointerEvent('pointerdown', { bubbles: true, cancelable: true }); button.dispatchEvent(pointer); button.click();
    expect(pointer.defaultPrevented).toBeTrue(); expect(document.activeElement).toBe(page.court.nativeElement);
    expect(page.game.serveTossActive).toBeTrue(); expect(page.game.serveDepth).toBe(1); expect((page as any).input().shot).toBe('drive');
  });
  it('warns when a held toss reaches contact instead of presenting a permanently safe full meter', () => {
    page.start(); page.keyDown(new KeyboardEvent('keydown', { key: ' ' }));
    for (let i = 0; i < 23; i++) page.game.update(.05, (page as any).input());
    (page as any).sync(); fixture.detectChanges(); expect(page.game.phase).toBe('serving'); expect(page.game.serveReleaseQueued).toBeFalse();
    expect(fixture.nativeElement.querySelector('.serve-toss-status').textContent).toBe(page.words().tossLate);
    expect(fixture.nativeElement.querySelector('.toss-meter').classList.contains('is-late')).toBeTrue();
  });
  it('cancels a queued toss on pause without consuming the attempt or changing selected depth or opponent', () => {
    career.selected.set(players[0]); page.start(); page.chooseServeDepth(-1); page.game.serveAttempt = 2;
    page.keyDown(new KeyboardEvent('keydown', { key: ' ' })); page.game.update(.05, (page as any).input());
    page.keyUp(new KeyboardEvent('keyup', { key: ' ' })); page.game.update(.01, (page as any).input()); expect(page.game.serveReleaseQueued).toBeTrue();
    page.pause(); expect(page.game.serveReleaseQueued).toBeFalse(); expect(page.game.serveTossActive).toBeFalse();
    expect(page.game.serveAttempt).toBe(2); expect(page.game.serveDepth).toBe(-1); expect(career.selected()).toEqual(players[0]);
    page.resume(); page.game.update(.05, (page as any).input()); expect(page.game.serveTossActive).toBeFalse(); expect(page.game.phase).toBe('serving');
  });
  it('localizes depth meters, target choices, toss feedback and the service/rally rule distinction', () => {
    page.start(); (page as any).sync(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.serve-card [role="meter"]').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.serve-depth-meter [role="meter"]').getAttribute('aria-valuemin')).toBe('-130');
    expect(page.words().serviceRules).toContain('including a second serve'); expect(page.words().serviceRules).toContain('Net touch + out = fault');
    expect(page.words().serviceRules).toContain('it is not a let'); expect(fixture.nativeElement.querySelector('.service-help').textContent).toContain('↑ deep / ↓ near');
    language.set('hr'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.serve-depth-options').getAttribute('aria-label')).toBe('Dubina servisa');
    expect(fixture.nativeElement.querySelector('.serve-depth-options').textContent).toContain('Kratko');
    expect(fixture.nativeElement.querySelector('.serve-depth-meter [role="meter"]').getAttribute('aria-label')).toBe('Dubina servisa');
    expect(fixture.nativeElement.querySelector('.serve-toss [role="progressbar"]').getAttribute('aria-label')).toBe('Izbačaj → trenutak udarca');
    expect(page.words().serviceRules).toContain('uključujući drugi servis'); expect(page.words().serviceRules).toContain('to nije let');
    page.game.server = 1; (page as any).sync(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.serve-depth-options')).toBeNull(); expect(fixture.nativeElement.querySelector('.serve-toss')).toBeNull();
  });
  it('shows which service attempt is replayed after a let without changing the scoreboard', () => {
    page.start(); const score = JSON.stringify(page.game.scoring); page.game.phase = 'let'; page.game.serveAttempt = 2;
    (page as any).sync(); fixture.detectChanges();
    expect(page.status()).toContain('Let — replay the same serve'); expect(page.status()).toContain('Second serve');
    expect(fixture.nativeElement.querySelector('.human-score .point-score').textContent.trim()).toBe('0');
    expect(fixture.nativeElement.querySelector('.point-callout').textContent).toContain('Second serve');
    language.set('hr'); fixture.detectChanges(); expect(page.status()).toContain('ponovi isti servis'); expect(page.status()).toContain('Drugi servis');
    expect(JSON.stringify(page.game.scoring)).toBe(score);
  });
  it('ignores composing and modified keyboard shortcuts instead of starting a toss or changing depth', () => {
    page.start(); const fullscreen = spyOn(page, 'toggleFullscreen').and.resolveTo(); const record = spyOn(page as any, 'recordCommand');
    for (const event of [new KeyboardEvent('keydown', { key: ' ', isComposing: true }), new KeyboardEvent('keydown', { key: 'ArrowUp', ctrlKey: true }), new KeyboardEvent('keydown', { key: 'f', metaKey: true }), new KeyboardEvent('keydown', { key: ' ', altKey: true })]) page.keyDown(event);
    expect((page as any).input()).toEqual(jasmine.objectContaining({ shot: null, forward: false })); expect(record).not.toHaveBeenCalled(); expect(fullscreen).not.toHaveBeenCalled();
  });
  it('keeps score, court and compact serve controls separate in the fitted full-screen view', () => {
    page.start(); page.expanded.set(true); language.set('hr'); fixture.detectChanges();
    const panel = page.gamePanel.nativeElement, court = page.courtStage.nativeElement.getBoundingClientRect();
    const score = fixture.nativeElement.querySelector('.scoreboard').getBoundingClientRect();
    const controls = fixture.nativeElement.querySelector('.play-controls').getBoundingClientRect();
    expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1); expect(court.height).toBeGreaterThan(100);
    expect(score.bottom).toBeLessThanOrEqual(court.top + 1); expect(court.bottom <= controls.top + 1 || court.right <= controls.left + 1).toBeTrue();
    for (const button of fixture.nativeElement.querySelectorAll('.serve-target button')) {
      const bounds = button.getBoundingClientRect(); expect(bounds.width).toBeGreaterThan(25); expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.left).toBeGreaterThanOrEqual(controls.left); expect(bounds.right).toBeLessThanOrEqual(controls.right);
    }
    const widthButton = fixture.nativeElement.querySelector('.serve-aim-options button:first-child');
    const depthButton = fixture.nativeElement.querySelector('.serve-depth-options button:first-child');
    expect(getComputedStyle(depthButton).backgroundColor).toBe(getComputedStyle(widthButton).backgroundColor);
    expect(getComputedStyle(depthButton).color).toBe(getComputedStyle(widthButton).color);
    const hit = fixture.nativeElement.querySelector('.is-expanded .hit-touch') as HTMLElement;
    if (getComputedStyle(hit.parentElement!.parentElement!).display !== 'none') {
      const bounds = hit.getBoundingClientRect();
      expect(bounds.bottom).toBeLessThanOrEqual(controls.bottom + 1);
      expect(bounds.top).toBeGreaterThanOrEqual(controls.top);
    }
  });
  it('shows power and bipolar direction meters during rallies, with localized instructions',()=>{
    page.start();page.game.strikeServe();page.keyDown(new KeyboardEvent('keydown',{key:' '}));
    page.game.update(.05,(page as any).input());(page as any).sync();fixture.detectChanges();
    const meters=fixture.nativeElement.querySelectorAll('.stroke-card [role="meter"]');expect(meters.length).toBe(2);
    expect(meters[1].getAttribute('aria-valuemin')).toBe('-130');expect(fixture.nativeElement.textContent).not.toContain('2 × SPACE');
    language.set('hr');fixture.detectChanges();expect(meters[0].getAttribute('aria-label')).toBe('Snaga udarca');
  });
  it('uses hold/release for the touch Hit button and cancels an interrupted rally stroke',()=>{
    page.start();page.game.strikeServe();const target={setPointerCapture:()=>{}};
    page.touchStart({pointerId:9,currentTarget:target,preventDefault:()=>{}} as any,'drive');page.game.update(.05,(page as any).input());
    expect(page.game.strokeCharging).toBeTrue();page.touchCancel({pointerId:9} as any);page.game.update(.02,(page as any).input());
    expect(page.game.strokePending).toBeFalse();expect(page.game.strokeCharge).toBe(0);
  });
  it('does not queue a shot on the ready screen or while paused', () => {
    page.keyDown(new KeyboardEvent('keydown', { key: ' ' })); expect(page.selectedShot()).toBeNull();
    page.start(); page.pause(); page.keyDown(new KeyboardEvent('keydown', { key: ' ' })); expect(page.selectedShot()).toBeNull();
  });
  it('uses Croatian UI and English fallback without changing game state', () => {
    page.start(); language.set('hr'); fixture.detectChanges(); expect(page.words().title).toBe('Teniski predah 3D'); expect(page.game.phase).toBe('serving');
    language.set('fr'); fixture.detectChanges(); expect(page.words().title).toBe('Tennis break 3D');
  });
  it('rejects unknown surface and difficulty values', () => {
    page.changeSurface('unknown'); page.changeDifficulty('unknown'); expect(page.surface()).toBe('grass'); expect(page.difficulty()).toBe('normal');
  });
  it('defaults to a tennis match and exposes a real scoreboard before starting', () => {
    expect(page.matchFormat()).toBe('match'); expect(page.view().format).toBe('match');
    expect(fixture.nativeElement.querySelector('.match-score')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Sets'); expect(fixture.nativeElement.textContent).toContain('Games');
    expect(page.formatTitle()).toBe('BEST OF 3 SETS');
  });
  it('keeps the seven-point challenge available and retains it when playing again', () => {
    page.changeFormat('challenge'); fixture.detectChanges(); expect(page.view().format).toBe('challenge');
    expect(fixture.nativeElement.querySelector('.match-score')).toBeNull(); expect(page.formatTitle()).toBe('FIRST TO 7');
    page.start(); expect(page.game.scoring.format).toBe('challenge'); page.setup(); page.start(); expect(page.game.scoring.format).toBe('challenge');
  });
  it('rejects an unknown format or changing format halfway through play', () => {
    page.changeFormat('unknown'); expect(page.matchFormat()).toBe('match'); page.start(); page.changeFormat('challenge'); expect(page.matchFormat()).toBe('match');
  });
  it('renders 15, deuce and advantage from actual point awards in both languages', () => {
    page.start(); const award = (side: 0 | 1) => { page.game.phase = 'playing'; (page.game as any).award(side, 'bounce'); (page as any).sync(); fixture.detectChanges(); };
    award(0); expect(fixture.nativeElement.querySelector('.human-score .point-score').textContent.trim()).toBe('15');
    award(0); award(0); award(1); award(1); award(1); expect(page.scoreNote()).toBe('Deuce');
    award(1); expect(page.scoreNote()).toBe('Advantage'); expect(fixture.nativeElement.querySelector('.computer-score .point-score').textContent.trim()).toBe('AD');
    language.set('hr'); fixture.detectChanges(); expect(page.scoreNote()).toBe('Prednost'); expect(fixture.nativeElement.textContent).toContain('Gemovi');
  });
  it('shows a completed set result, upcoming set and game/set callouts', () => {
    page.start();
    for (let i = 0; i < 4; i++) { page.game.phase = 'playing'; (page.game as any).award(0, 'bounce'); }
    (page as any).sync(); expect(page.status()).toContain('Your game');
    for (let i = 0; i < 20; i++) { page.game.phase = 'playing'; (page.game as any).award(0, 'bounce'); }
    (page as any).sync(); fixture.detectChanges();
    expect(page.status()).toContain('Your set'); expect(page.scoreNote()).toBe('Set 2');
    expect(fixture.nativeElement.querySelector('.set-history').textContent).toContain('6–0');
  });
  it('preserves games and sets while pausing and changing cameras', () => {
    page.start();
    for (let i = 0; i < 28; i++) { page.game.phase = 'playing'; (page.game as any).award(0, 'bounce'); }
    const score = JSON.stringify(page.game.scoring); page.pause(); page.changeCamera(); page.resume();
    expect(JSON.stringify(page.game.scoring)).toBe(score);
  });
  it('uses W and S for depth and Shift for height', () => {
    page.start(); page.game.strikeServe();
    page.keyDown(new KeyboardEvent('keydown', { key: 'w' })); expect((page as any).input().forward).toBeTrue(); expect((page as any).input().jump).toBeFalse();
    page.keyDown(new KeyboardEvent('keydown', { key: 'Shift' })); expect((page as any).input().jump).toBeTrue();
  });
  it('switches cameras, graphics and assist without resetting the match', () => {
    page.start(); page.game.score = [3, 2]; page.changeCamera(); page.toggleLightweight(); page.toggleAssist();
    expect(page.camera()).toBe('broadcast'); expect(page.lightweight()).toBeTrue(); expect(page.game.assist).toBeFalse(); expect(page.game.score).toEqual([3, 2]);
  });
  it('starts behind the baseline with the camera and sound options explicitly hidden', () => {
    const settings=fixture.nativeElement.querySelector('.display-settings') as HTMLDetailsElement;
    expect(page.camera()).toBe('baseline'); expect(settings.open).toBeFalse();
    expect(getComputedStyle(settings.querySelector('.display-settings-options')!).display).toBe('none');
  });
  it('closes the options after changing camera or graphics without changing the game', () => {
    const settings=fixture.nativeElement.querySelector('.display-settings') as HTMLDetailsElement;
    const summary=settings.querySelector('summary')!, buttons=settings.querySelectorAll('button');
    const before=JSON.stringify(page.game);
    summary.click(); buttons[0].click(); fixture.detectChanges();
    expect(settings.open).toBeFalse(); expect(page.camera()).toBe('broadcast');
    summary.click(); buttons[1].click(); fixture.detectChanges();
    expect(settings.open).toBeFalse(); expect(page.lightweight()).toBeTrue();
    expect(JSON.stringify(page.game)).toBe(before);
  });
  it('closes the display menu on an outside pointer but leaves an inside pointer alone', () => {
    const settings=fixture.nativeElement.querySelector('.display-settings') as HTMLDetailsElement;
    settings.open=true;
    page.outsideOpponentSearch({target:settings.querySelector('summary')} as unknown as PointerEvent);
    expect(settings.open).toBeTrue();
    page.outsideOpponentSearch({target:document.body} as unknown as PointerEvent);
    expect(settings.open).toBeFalse();
  });
  it('lets Escape close the display menu before exiting the expanded game', () => {
    const settings=fixture.nativeElement.querySelector('.display-settings') as HTMLDetailsElement;
    page.expanded.set(true); settings.open=true;
    const escape=new KeyboardEvent('keydown',{key:'Escape',cancelable:true}); page.fullscreenEscape(escape);
    expect(escape.defaultPrevented).toBeTrue(); expect(settings.open).toBeFalse(); expect(page.expanded()).toBeTrue();
  });
  it('closes the display options when keyboard focus leaves them', () => {
    const settings=fixture.nativeElement.querySelector('.display-settings') as HTMLDetailsElement;
    settings.open=true; page.displaySettingsFocusOut(new FocusEvent('focusout',{relatedTarget:page.court.nativeElement}));
    expect(settings.open).toBeFalse();
  });
  it('falls back to a fitted view if native fullscreen is denied and restores page scrolling on exit', async () => {
    const original = document.body.style.overflow;
    spyOn(page.gamePanel.nativeElement, 'requestFullscreen').and.returnValue(Promise.reject(new Error('Denied')));
    await page.toggleFullscreen(); fixture.detectChanges();
    expect(page.expanded()).toBeTrue(); expect(document.body.style.overflow).toBe('hidden');
    expect(page.gamePanel.nativeElement.classList.contains('is-expanded')).toBeTrue();
    expect(page.gamePanel.nativeElement.getAttribute('aria-modal')).toBe('true');
    await page.toggleFullscreen(); fixture.detectChanges(); expect(page.expanded()).toBeFalse(); expect(document.body.style.overflow).toBe(original);
    expect(document.activeElement).toBe(page.fullscreenButton.nativeElement);
  });
  it('restores page scrolling on route destruction while expanded', async () => {
    const original = document.body.style.overflow;
    spyOn(page.gamePanel.nativeElement, 'requestFullscreen').and.returnValue(Promise.reject(new Error('Denied')));
    await page.toggleFullscreen(); page.ngOnDestroy(); expect(document.body.style.overflow).toBe(original);
  });
  it('allows Esc to leave the fitted fallback view even while a toolbar button is focused', async () => {
    spyOn(page.gamePanel.nativeElement, 'requestFullscreen').and.returnValue(Promise.reject(new Error('Denied')));
    await page.toggleFullscreen(); const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    page.fullscreenEscape(event); expect(event.defaultPrevented).toBeTrue(); expect(page.expanded()).toBeFalse();
  });
  it('routes F to fullscreen rather than leaving a held game input', () => {
    spyOn(page, 'toggleFullscreen').and.resolveTo(); const key = new KeyboardEvent('keydown', { key: 'f', cancelable: true });
    page.keyDown(key); expect(key.defaultPrevented).toBeTrue(); expect(page.toggleFullscreen).toHaveBeenCalledTimes(1);
  });
  it('only calls for quiet when a loud crowd persists into service preparation', fakeAsync(() => {
    page.start(); page.game.strikeServe(); page.game.rally = 6; (page.game as any).award(0, 'bounce'); (page as any).gameFeedback();
    tick(900); expect(page.umpireSpeaking()).toBeFalse();
    page.game.phase = 'serving'; (page as any).gameFeedback(.02); expect(page.umpireSpeaking()).toBeTrue();
    page.pause(); expect(page.umpireSpeaking()).toBeFalse(); tick(2000); expect(page.umpireSpeaking()).toBeFalse();
  }));
  it('does not call for quiet during the point break, a quiet serve, or match over', fakeAsync(() => {
    page.start(); page.game.strikeServe(); (page.game as any).award(0, 'bounce'); (page as any).gameFeedback();
    for (let i = 0; i < 40; i++) (page as any).gameFeedback(.05);
    page.game.phase = 'serving'; (page as any).gameFeedback(.05); expect(page.umpireSpeaking()).toBeFalse();
    page.game.phase = 'over'; tick(2000); expect(page.umpireSpeaking()).toBeFalse();
  }));
  it('shows a localized serve meter and double-fault status', () => {
    page.start(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[role="meter"]')).toBeTruthy();
    expect(page.status()).toContain('First serve'); page.game.phase = 'point'; page.game.pointWinner = 1; page.game.reason = 'doubleFault'; (page as any).sync();
    expect(page.status()).toContain('Double fault'); language.set('hr'); expect(page.status()).toContain('Dvostruka pogreška');
  });
  it('arms the first touch serve even after canvas focus has been cleared', () => {
    page.start(); page.clearInput();
    page.touchStart({ pointerId: 7, preventDefault() {}, currentTarget: { setPointerCapture() {} } } as any, 'drive');
    page.game.update(.05, (page as any).input()); expect(page.game.serveCharge).toBeGreaterThan(0);
    page.touchEnd({ pointerId: 7 } as any); page.game.update(.02, (page as any).input());
    expect(page.game.phase).toBe('serving'); expect(page.game.serveReleaseQueued).toBeTrue(); awaitServeContact(); expect(page.game.phase).toBe('playing');
  });
  it('cancels an interrupted pointer gesture without launching a serve', () => {
    page.start(); page.touchStart({ pointerId: 7, preventDefault() {}, currentTarget: { setPointerCapture() {} } } as any, 'drive');
    page.game.update(.05, (page as any).input()); page.touchCancel({ pointerId: 7 } as any); page.game.update(.02, (page as any).input());
    expect(page.game.phase).toBe('serving'); expect(page.game.serveCharge).toBe(0);
  });
  it('does not issue duplicate audio activation requests while the first is pending', async () => {
    let finish!: (enabled: boolean) => void;
    const fake = { enable: jasmine.createSpy().and.returnValue(new Promise<boolean>(resolve => finish = resolve)), dispose: jasmine.createSpy() };
    (page as any).soundscape = fake;
    const first = page.toggleSound(); await page.toggleSound(); expect(fake.enable).toHaveBeenCalledTimes(1); expect(page.soundPending()).toBeTrue();
    finish(true); await first; expect(page.sound()).toBeTrue(); expect(page.soundPending()).toBeFalse();
  });
});
