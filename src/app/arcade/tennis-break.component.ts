import { CommonModule, DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, Inject, NgZone, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import type { CourtSurface, Difficulty } from './tennis-engine';
import { CourtControls, Tennis3DEngine } from './tennis-3d-engine';
import { Tennis3DRenderer, TennisCamera } from './tennis-3d-renderer';
import { TennisSoundscape } from './tennis-soundscape';
import { TennisAtmosphere } from './tennis-atmosphere';
import { CompletedTennisSet, PointAward, TennisFormat } from './tennis-scoring';
import { A11yModule } from '@angular/cdk/a11y';

const EN = {
  title: 'Tennis break 3D', eyebrow: 'BONZOBYTE CLUB · OFF THE CLOCK', intro: 'Leave the numbers for a moment. Take your place on court.',
  back: 'Back to matches', you: 'You', cpu: 'Computer', surface: 'Court', grass: 'Grass', clay: 'Clay', hard: 'Hard court',
  difficulty: 'Opponent', easy: 'Relaxed', normal: 'Club player', hardLevel: 'Challenger', start: 'Step onto court',
  pause: 'Pause', resume: 'Continue playing', reset: 'New match', sound: 'Sound', ready: 'Your court. Your next point.',
  readyText: 'A quick first-to-seven challenge against the computer. Win by two points.', paused: 'Take your time.',
  format: 'Format', matchMode: 'Tennis match', challengeMode: '7-point challenge', bestOfThree: 'BEST OF 3 SETS',
  matchReady: 'Best of three sets. Standard advantage games, with a seven-point tie-break at 6–6 in every set.',
  matchRules: 'Win two sets. A set needs six games with a two-game lead; at 6–6 play a tie-break to 7, win by 2. Games use 0 / 15 / 30 / 40, deuce and advantage. The server changes after each game; tie-break service follows one point, then two each.',
  serviceRules: 'Two attempts per serve. A net let is replayed; a double fault gives the point to the receiver. Let a serve bounce before returning it.',
  sets: 'Sets', games: 'Games', points: 'Points', set: 'Set', tieBreak: 'Tie-break', deuce: 'Deuce', advantage: 'Advantage', serving: 'Serving', finished: 'Match complete',
  gameYou: 'Your game', gameCpu: 'Computer’s game', setYou: 'Your set', setCpu: 'Computer’s set', setHistory: 'Completed sets',
  pausedText: 'The match is paused. Nothing moves until you are ready.', victory: 'Well played!', defeat: 'One more match?',
  victoryText: 'The court is yours. Fancy another round?', defeatText: 'Every rally is a fresh start. Give it another shot.',
  again: 'Play again', controls: 'Make your move', move: 'Move', jump: 'Jump', drive: 'Hit', lob: 'Lob', smash: 'Smash',
  tip: 'You are the near-side player. Movement assist helps you reach the ball; hold Hit to return it. Use A / D while hitting to aim. The small ring shows the predicted bounce.',
  rules: 'First to 7, win by 2. Tie-break service order: one opening point, then two points each. Return the ball before its second bounce.',
  serveYou: 'Your serve', serveCpu: 'Computer serving', firstServe: 'First serve', secondServe: 'Second serve', fault: 'Fault — second serve', let: 'Let — serve again', doubleFault: 'Double fault',
  serveHint: 'Hold and release Hit / Space to serve. Release before the red zone; A / D changes your aim.', power: 'Serve power',
  local: 'Just for fun. No bets, prizes or account rankings. Game results are not sent or saved.',
  autoPause: 'Automatically pauses when you leave the court or switch tabs.',
  ball: 'A three-dimensional tennis game. Keyboard and touch controls are described below.',
  pointYou: 'Your point', pointCpu: 'Computer’s point', net: 'Into the net', out: 'Out of court', bounce: 'Second bounce',
  live: 'Rally in play', rally: 'Rally', best: 'Longest rally', hits: 'Your returns', unavailable: '3D graphics are unavailable. Please use a browser with WebGL 2 and hardware acceleration enabled.',
  camera: 'Camera', broadcast: 'Courtside', baseline: 'Baseline', lightweight: 'Lighter graphics', assist: 'Movement assist',
  fullscreen: 'Full screen', exitFullscreen: 'Exit full screen', umpire: 'Chair umpire', quiet: 'Quiet, please.',
  soundHint: 'Crowd reactions and court sounds. The umpire uses a local English voice when available.', fullscreenHint: 'F: full screen · Esc: exit / pause',
  scoring: 'Points', first: 'FIRST TO 7', keyHelp: 'Click the court to use the keyboard. A / D and W / S or arrows to move across and along the court, Shift to jump, Space / X to hit, C to lob, Z to smash, Esc / P to pause.'
};
const HR: typeof EN = {
  title: 'Teniski predah 3D', eyebrow: 'BONZOBYTE KLUB · MALO OPUŠTANJA', intro: 'Ostavimo brojke na trenutak. Vrijeme je za izlazak na teren.',
  back: 'Natrag na mečeve', you: 'Ti', cpu: 'Računalo', surface: 'Teren', grass: 'Trava', clay: 'Zemlja', hard: 'Tvrda podloga',
  difficulty: 'Protivnik', easy: 'Opušteno', normal: 'Klupski igrač', hardLevel: 'Izazivač', start: 'Izađi na teren',
  pause: 'Pauza', resume: 'Nastavi igrati', reset: 'Novi meč', sound: 'Zvuk', ready: 'Tvoj teren. Tvoj sljedeći poen.',
  readyText: 'Kratki izazov protiv računala do sedam poena. Za pobjedu trebaju dva poena razlike.', paused: 'Bez žurbe.',
  format: 'Format', matchMode: 'Teniski meč', challengeMode: 'Do 7 poena', bestOfThree: 'NA DVA DOBIVENA SETA',
  matchReady: 'Na dva dobivena seta. Gemovi s prednošću; pri 6:6 u svakom setu igra se tie-break do sedam poena.',
  matchRules: 'Osvoji dva seta. Set traži šest gemova uz dva razlike; pri 6:6 tie-break do 7, uz dva razlike. Bodovanje gema je 0 / 15 / 30 / 40, izjednačenje i prednost. Server se mijenja nakon gema; u tie-breaku nakon prvog poena, zatim po dva.',
  serviceRules: 'Dva pokušaja servisa. Dodir mreže uz ispravan odskok ponavlja servis; dvostruka pogreška daje poen primatelju. Servis mora odskočiti prije povrata.',
  sets: 'Setovi', games: 'Gemovi', points: 'Poeni', set: 'Set', tieBreak: 'Tie-break', deuce: 'Izjednačenje', advantage: 'Prednost', serving: 'Servira', finished: 'Meč je završen',
  gameYou: 'Tvoj gem', gameCpu: 'Gem za računalo', setYou: 'Tvoj set', setCpu: 'Set za računalo', setHistory: 'Završeni setovi',
  pausedText: 'Meč je pauziran. Igra se nastavlja tek kada budeš spreman.', victory: 'Odlično odigrano!', defeat: 'Još jedan meč?',
  victoryText: 'Teren je tvoj. Hoćemo još jednu rundu?', defeatText: 'Svaka izmjena je novi početak. Pokušaj još jednom.',
  again: 'Igraj ponovno', controls: 'Tvoj sljedeći potez', move: 'Kretanje', jump: 'Skok', drive: 'Udarac', lob: 'Lob', smash: 'Smeč',
  tip: 'Ti si igrač na bližoj strani. Pomoć pri kretanju dovodi te do loptice; drži Udarac za povrat. Uz A / D tijekom udarca biraš smjer. Mali krug označava predviđeni odskok.',
  rules: 'Do 7 poena, uz 2 razlike. Servis kao u tie-breaku: prvi poen, zatim po dva. Vrati lopticu prije drugog odskoka.',
  serveYou: 'Tvoj servis', serveCpu: 'Računalo servira', firstServe: 'Prvi servis', secondServe: 'Drugi servis', fault: 'Pogreška — drugi servis', let: 'Mreža — ponovi servis', doubleFault: 'Dvostruka pogreška',
  serveHint: 'Zadrži pa otpusti Udarac / Space. Otpusti prije crvenog područja; A / D mijenja smjer.', power: 'Snaga servisa',
  local: 'Samo zabava. Bez oklada, nagrada ili rangiranja računa. Rezultati igre ne šalju se niti spremaju.',
  autoPause: 'Igra se automatski pauzira kada napustiš teren ili promijeniš karticu.',
  ball: 'Trodimenzionalna teniska igra. Kontrole tipkovnicom i dodirom opisane su ispod terena.',
  pointYou: 'Tvoj poen', pointCpu: 'Poen za računalo', net: 'Loptica u mreži', out: 'Izvan terena', bounce: 'Drugi odskok',
  live: 'Izmjena je u tijeku', rally: 'Izmjena', best: 'Najdulja izmjena', hits: 'Tvoji povrati', unavailable: '3D prikaz nije dostupan. Potreban je preglednik s podrškom za WebGL 2 i uključenim grafičkim ubrzanjem.',
  camera: 'Kamera', broadcast: 'Uz teren', baseline: 'Osnovna crta', lightweight: 'Lakša grafika', assist: 'Pomoć pri kretanju',
  fullscreen: 'Cijeli ekran', exitFullscreen: 'Izađi iz cijelog ekrana', umpire: 'Glavni sudac', quiet: 'Quiet, please.',
  soundHint: 'Reakcije publike i zvukovi terena. Sudac koristi lokalni engleski glas kada je dostupan.', fullscreenHint: 'F: cijeli ekran · Esc: izlaz / pauza',
  scoring: 'Poeni', first: 'DO 7 POENA', keyHelp: 'Klikni teren za tipkovnicu. A / D i W / S ili strelice za kretanje u svim smjerovima, Shift za skok, Space / X za udarac, C za lob, Z za smeč, Esc / P za pauzu.'
};
type Action = 'left' | 'right' | 'forward' | 'back' | 'jump' | 'drive' | 'lob' | 'smash';
interface ScoreView {
  phase: string; left: number; right: number; winner: number | null; pointWinner: number | null; reason: string | null; rally: number; best: number; hits: number;
  server: number; attempt: number; charge: number; format: TennisFormat; pointLabels: [string, string]; games: [number, number]; sets: [number, number];
  completedSets: CompletedTennisSet[]; tieBreak: boolean; award: PointAward | null;
}

@Component({
  selector: 'app-tennis-break', standalone: true, imports: [CommonModule, RouterLink, A11yModule],
  templateUrl: './tennis-break.component.html', styleUrl: './tennis-break.component.scss'
})
export class TennisBreakComponent implements AfterViewInit, OnDestroy {
  @ViewChild('court', { static: true }) court!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gamePanel', { static: true }) gamePanel!: ElementRef<HTMLElement>;
  @ViewChild('courtStage', { static: true }) courtStage!: ElementRef<HTMLElement>;
  @ViewChild('fullscreenButton', { static: true }) fullscreenButton!: ElementRef<HTMLButtonElement>;
  readonly words = computed(() => this.regional.language() === 'hr' ? HR : EN);
  readonly surface = signal<CourtSurface>('grass');
  readonly difficulty = signal<Difficulty>('normal');
  readonly matchFormat = signal<TennisFormat>('match');
  readonly paused = signal(false);
  readonly sound = signal(false);
  readonly soundPending = signal(false);
  readonly unavailable = signal(false);
  readonly camera = signal<TennisCamera>('broadcast');
  readonly lightweight = signal(false);
  readonly assist = signal(true);
  readonly expanded = signal(false);
  readonly umpireSpeaking = signal(false);
  readonly touchDirections: { action: Action; icon: string }[] = [{ action: 'forward', icon: '↑' }, { action: 'left', icon: '←' }, { action: 'back', icon: '↓' }, { action: 'right', icon: '→' }];
  readonly view = signal<ScoreView>({ phase: 'ready', left: 0, right: 0, winner: null, pointWinner: null, reason: null, rally: 0, best: 0, hits: 0, server: 0, attempt: 1, charge: 0,
    format: 'match', pointLabels: ['0', '0'], games: [0, 0], sets: [0, 0], completedSets: [], tieBreak: false, award: null });
  readonly formatTitle = computed(() => this.matchFormat() === 'match' ? this.words().bestOfThree : this.words().first);
  readonly scoreNote = computed(() => {
    const s = this.view(), w = this.words();
    if (s.phase === 'over') return w.finished;
    if (s.format === 'challenge') return w.challengeMode;
    if (s.tieBreak) return w.tieBreak;
    if (s.pointLabels.includes('AD')) return w.advantage;
    if (s.pointLabels[0] === '40' && s.pointLabels[1] === '40') return w.deuce;
    return w.set + ' ' + (s.sets[0] + s.sets[1] + 1);
  });
  readonly surfaceName = computed(() => ({ grass: this.words().grass, clay: this.words().clay, hard: this.words().hard })[this.surface()]);
  readonly status = computed(() => {
    const s = this.view(), w = this.words();
    if (this.paused()) return w.pause;
    if (s.phase === 'ready') return this.formatTitle();
    if (s.phase === 'over') return s.winner === 0 ? w.victory : w.defeat;
    if (s.phase === 'fault') return w.fault;
    if (s.phase === 'let') return w.let;
    if (s.phase === 'serving') return (s.server === 0 ? w.serveYou : w.serveCpu) + ' · ' + (s.attempt === 1 ? w.firstServe : w.secondServe);
    if (s.phase === 'point') {
      const point = s.award === 'set' ? (s.pointWinner === 0 ? w.setYou : w.setCpu) : s.award === 'game' ? (s.pointWinner === 0 ? w.gameYou : w.gameCpu) : (s.pointWinner === 0 ? w.pointYou : w.pointCpu);
      return point + ' · ' + ({ net: w.net, out: w.out, bounce: w.bounce, doubleFault: w.doubleFault }[s.reason ?? ''] ?? '');
    }
    return w.live;
  });
  game = new Tennis3DEngine(Math.random, 'match');
  private renderer?: Tennis3DRenderer;
  private frameId: number | null = null;
  private previousTime = 0;
  private previousDraw = 0;
  private readonly keys = new Set<string>();
  private readonly touches = new Map<number, Action>();
  private lastView = '';
  private lastAudioEvent = -1;
  private soundscape?: TennisSoundscape;
  private stageObserver?: ResizeObserver;
  private readonly atmosphere = new TennisAtmosphere();
  private captionTimer?: ReturnType<typeof setTimeout>;
  private previousOverflow: string | null = null;
  private fullscreenPending = false;
  private destroyed = false;

  constructor(readonly regional: RegionalSettingsService, private zone: NgZone, @Inject(DOCUMENT) private document: Document, private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    try {
      this.zone.runOutsideAngular(() => {
        this.renderer = new Tennis3DRenderer(this.court.nativeElement, () => { if (!this.destroyed) this.paint(); });
        if (typeof ResizeObserver !== 'undefined') {
          this.stageObserver = new ResizeObserver(() => this.resizeCourt()); this.stageObserver.observe(this.courtStage.nativeElement);
        }
        this.resizeCourt();
        this.paint();
      });
    } catch { this.unavailable.set(true); }
  }
  start(): void {
    if (this.unavailable() || this.destroyed) return;
    this.clearAnnouncement(); this.atmosphere.reset(); this.soundscape?.stop(); this.lastAudioEvent = -1;
    this.clearInput(); this.game.assist = this.assist(); this.game.start(this.surface(), this.difficulty(), this.matchFormat()); this.paused.set(false);
    this.sync(); this.court.nativeElement.focus({ preventScroll: true }); this.run();
  }
  setup(): void {
    this.stop(); this.clearInput(); this.clearAnnouncement(); this.atmosphere.reset(); this.soundscape?.stop(); this.lastAudioEvent = -1;
    this.paused.set(false); this.game = new Tennis3DEngine(Math.random, this.matchFormat()); this.game.assist = this.assist();
    this.game.surface = this.surface(); this.sync(); this.paint();
  }
  changeSurface(value: string): void {
    if (!['grass', 'clay', 'hard'].includes(value) || this.view().phase !== 'ready') return;
    this.surface.set(value as CourtSurface); this.game.surface = value as CourtSurface; this.paint();
  }
  changeDifficulty(value: string): void { if (['easy', 'normal', 'hard'].includes(value)) this.difficulty.set(value as Difficulty); }
  changeFormat(value: string): void {
    if (!['match', 'challenge'].includes(value) || this.game.phase !== 'ready') return;
    this.matchFormat.set(value as TennisFormat); this.setup();
  }
  changeCamera(): void {
    this.camera.set(this.camera() === 'broadcast' ? 'baseline' : 'broadcast'); this.renderer?.setCamera(this.camera()); this.paint();
  }
  toggleLightweight(): void { this.lightweight.update(v => !v); this.renderer?.setLightweight(this.lightweight()); this.paint(); }
  toggleAssist(): void { this.assist.update(v => !v); this.game.assist = this.assist(); }
  async toggleFullscreen(): Promise<void> {
    if (this.destroyed || this.fullscreenPending) return;
    const panel = this.gamePanel.nativeElement;
    if (this.expanded()) {
      if (this.document.fullscreenElement === panel) {
        try { await this.document.exitFullscreen(); } catch { return; }
      }
      this.setExpanded(false); this.pause(); this.fullscreenButton.nativeElement.focus({ preventScroll: true });
      return;
    }
    this.setExpanded(true); this.fullscreenPending = true;
    try { await panel.requestFullscreen?.(); }
    catch { /* Retain a fitted in-page view when native fullscreen is unavailable or denied. */ }
    finally { this.fullscreenPending = false; }
    if (this.destroyed) return;
    this.resizeCourt();
    if (!['ready', 'over'].includes(this.game.phase) && !this.paused()) this.court.nativeElement.focus({ preventScroll: true });
  }
  @HostListener('document:fullscreenchange') fullscreenChanged(): void {
    if (this.destroyed) return;
    if (this.document.fullscreenElement === this.gamePanel.nativeElement) this.setExpanded(true);
    else if (this.expanded()) { this.setExpanded(false); this.pause(); this.fullscreenButton.nativeElement.focus({ preventScroll: true }); }
    this.resizeCourt();
  }
  @HostListener('document:keydown', ['$event']) fullscreenEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !event.defaultPrevented && this.expanded() && this.document.fullscreenElement !== this.gamePanel.nativeElement) {
      event.preventDefault(); this.pause(); void this.toggleFullscreen();
    }
  }
  @HostListener('window:resize') resizeCourt(): void {
    if (this.destroyed) return;
    const rect = this.courtStage?.nativeElement.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) { this.renderer?.resize(rect.width, rect.height); this.paint(); }
  }
  private setExpanded(expanded: boolean): void {
    if (expanded && this.previousOverflow === null) { this.previousOverflow = this.document.body.style.overflow; this.document.body.style.overflow = 'hidden'; }
    if (!expanded && this.previousOverflow !== null) { this.document.body.style.overflow = this.previousOverflow; this.previousOverflow = null; }
    this.expanded.set(expanded);
  }
  contextLost(event: Event): void { event.preventDefault(); this.pause(); this.stop(); this.unavailable.set(true); }
  pause(): void {
    if (['ready', 'over'].includes(this.game.phase) || this.paused()) return;
    this.paused.set(true); this.stop(); this.clearInput(); this.game.cancelServeCharge(); this.clearAnnouncement(); this.atmosphere.reset(); this.soundscape?.stop();
  }
  resume(): void {
    if (!this.paused() || this.document.hidden || this.destroyed) return;
    this.paused.set(false); this.clearInput(); this.court.nativeElement.focus({ preventScroll: true }); this.run();
  }
  keyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (key === 'f' && !event.repeat) { event.preventDefault(); void this.toggleFullscreen(); return; }
    if (key === 'escape' && this.expanded()) { event.preventDefault(); this.pause(); void this.toggleFullscreen(); return; }
    if (['p', 'escape'].includes(key)) { event.preventDefault(); this.pause(); return; }
    if (!['a', 'd', 'w', 's', 'shift', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'x', 'c', 'z'].includes(key)) return;
    event.preventDefault();
    if (!event.repeat && [' ', 'x', 'c', 'z'].includes(key)) this.game.armServe();
    this.keys.add(key);
  }
  keyUp(event: KeyboardEvent): void { this.keys.delete(event.key.toLowerCase()); }
  touchStart(event: PointerEvent, action: Action): void {
    if (this.game.phase === 'ready' || this.paused() || this.game.phase === 'over') return;
    event.preventDefault();
    if (['drive', 'lob', 'smash'].includes(action)) this.game.armServe();
    this.touches.set(event.pointerId, action);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  touchEnd(event: PointerEvent): void { this.touches.delete(event.pointerId); }
  touchCancel(event: PointerEvent): void {
    if (!this.touches.has(event.pointerId)) return;
    this.touches.delete(event.pointerId); this.game.cancelServeCharge();
  }
  clearInput(): void { this.keys.clear(); this.touches.clear(); this.game.cancelServeCharge(); }
  async toggleSound(): Promise<void> {
    if (this.soundPending() || this.destroyed) return;
    if (this.sound()) { this.sound.set(false); this.soundscape?.disable(); return; }
    this.soundPending.set(true);
    try {
      const browser = this.document.defaultView; if (!browser) return;
      this.soundscape ??= new TennisSoundscape(browser);
      const enabled = await this.soundscape.enable(); if (!this.destroyed) this.sound.set(enabled);
    } catch { this.sound.set(false); }
    finally { this.soundPending.set(false); }
  }
  @HostListener('document:visibilitychange') visibilityChanged(): void { if (this.document.hidden) this.pause(); }
  @HostListener('window:blur') windowBlur(): void { this.pause(); }
  @HostListener('focusout', ['$event']) focusLeftGame(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !this.host.nativeElement.contains(next)) this.pause();
  }

  private input(): CourtControls {
    const held = (action: Action) => [...this.touches.values()].includes(action);
    return { left: this.keys.has('a') || this.keys.has('arrowleft') || held('left'), right: this.keys.has('d') || this.keys.has('arrowright') || held('right'),
      forward: this.keys.has('w') || this.keys.has('arrowup') || held('forward'), back: this.keys.has('s') || this.keys.has('arrowdown') || held('back'),
      jump: this.keys.has('shift') || held('jump'),
      shot: this.keys.has('z') || held('smash') ? 'smash' : this.keys.has('c') || held('lob') ? 'lob' : this.keys.has(' ') || this.keys.has('x') || held('drive') ? 'drive' : null };
  }
  private run(): void {
    this.stop(); this.previousTime = 0; this.previousDraw = 0;
    this.zone.runOutsideAngular(() => {
      const tick = (now: number) => {
        this.frameId = null;
        if (this.destroyed || this.paused() || this.document.hidden) return;
        const dt = this.previousTime ? (now - this.previousTime) / 1000 : 0;
        this.previousTime = now; this.game.update(dt, this.input());
        if (now - this.previousDraw >= 32 || this.game.phase === 'over') { this.paint(now); this.previousDraw = now; }
        this.sync(); this.gameFeedback(dt);
        if (this.game.phase !== 'over') this.frameId = requestAnimationFrame(tick);
      };
      this.frameId = requestAnimationFrame(tick);
    });
  }
  private stop(): void { if (this.frameId !== null) cancelAnimationFrame(this.frameId); this.frameId = null; }
  private paint(now = 0): void { this.renderer?.draw(this.game, now / 1000); }
  private sync(): void {
    const next: ScoreView = { phase: this.game.phase, left: this.game.score[0], right: this.game.score[1], winner: this.game.winner, pointWinner: this.game.pointWinner,
      reason: this.game.reason, rally: this.game.rally, best: this.game.bestRally, hits: this.game.hits,
      server: this.game.server, attempt: this.game.serveAttempt, charge: Math.round(this.game.serveCharge * 20) / 20,
      format: this.game.scoring.format, pointLabels: this.game.scoring.pointLabels, games: [...this.game.scoring.games], sets: [...this.game.scoring.sets],
      completedSets: [...this.game.scoring.completedSets], tieBreak: this.game.scoring.isTieBreak, award: this.game.scoring.lastAward };
    const key = JSON.stringify(next);
    if (key !== this.lastView) { this.lastView = key; this.zone.run(() => this.view.set(next)); }
  }
  private gameFeedback(dt = 0): void {
    if (this.lastAudioEvent !== this.game.eventId) {
      this.lastAudioEvent = this.game.eventId;
      if (this.sound()) { try { this.soundscape?.effect(this.game.event, this.game.rally, this.game.reason); } catch { /* Audio failure must not interrupt play. */ } }
      if (this.game.event === 'point') this.atmosphere.point(this.game.rally);
    }
    if (!this.destroyed && !this.paused() && !this.document.hidden && this.atmosphere.update(dt, this.game.phase)) {
      this.clearAnnouncement(); this.zone.run(() => this.umpireSpeaking.set(true));
      if (this.sound()) { try { this.soundscape?.hushCrowd(); this.soundscape?.quietPlease(); } catch { /* Caption still remains available. */ } }
      this.captionTimer = setTimeout(() => this.zone.run(() => this.umpireSpeaking.set(false)), 1600);
    }
  }
  private clearAnnouncement(): void {
    clearTimeout(this.captionTimer); this.umpireSpeaking.set(false);
  }
  ngOnDestroy(): void {
    if (this.destroyed) return;
    this.destroyed = true; this.stop(); this.clearInput(); this.clearAnnouncement(); this.stageObserver?.disconnect(); this.soundscape?.dispose();
    if (this.document.fullscreenElement === this.gamePanel.nativeElement) void this.document.exitFullscreen().catch(() => undefined);
    this.setExpanded(false); this.renderer?.dispose();
  }
}
