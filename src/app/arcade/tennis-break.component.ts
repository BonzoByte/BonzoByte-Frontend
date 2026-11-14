import { CommonModule, DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, Inject, NgZone, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import type { CourtSurface, Difficulty } from './tennis-engine';
import type { CourtShot as Shot } from './tennis-3d-engine';
import { TennisSpaceStroke } from './tennis-space-stroke';
import { CourtControls, Tennis3DEngine } from './tennis-3d-engine';
import { Tennis3DRenderer, TennisCamera } from './tennis-3d-renderer';
import { TennisSoundscape } from './tennis-soundscape';
import { TennisAtmosphere } from './tennis-atmosphere';
import { CompletedTennisSet, PointAward, TennisFormat } from './tennis-scoring';
import { A11yModule } from '@angular/cdk/a11y';
import { Subscription } from 'rxjs';
import { ArcadeOpponent, ArcadeSession, ArcadeResult, TennisCareerService } from './tennis-career.service';
import { arcadeRandom, opponentStrength } from './tennis-skill';
import { ArcadeCommand, ArcadeRecorder, quantizedStep } from './tennis-replay';
import { TENNIS_KERNEL_VERSION } from './tennis-kernel-version';

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
  drop: 'Drop shot', dropHint: 'B: a soft, short ball with a lower, slower bounce. N: overhead smash when the ball is high; a low ball becomes a drive. Hold either key for power, then release. Arrows set the direction.',
  endLeaderboard: 'Leaderboard', endMatches: 'Back to matches', leaveUnsavedResult: 'Your challenge result has not been saved. Leave without saving it?',
  tip: 'Hold Space for a normal hit, B for a drop shot, or N for a smash; release to hit. Use ← / → while holding to aim. Green targets the court; red power goes long and red aim goes wide. Release shortly before the ball reaches you. Optional C: lob, Z: quick smash.',
  aim: 'Aim', selectedShot: 'Next shot',
  rules: 'First to 7, win by 2. Tie-break service order: one opening point, then two points each. Return the ball before its second bounce.',
  serveYou: 'Your serve', serveCpu: 'Computer serving', firstServe: 'First serve', secondServe: 'Second serve', fault: 'Fault — second serve', let: 'Let — serve again', doubleFault: 'Double fault',
  serveHint: '← / → moves the target in the service box. Hold Space for power, then release to serve. Your aim stays selected. Avoid the red zone.', power: 'Serve power',
  serveDirection: 'Serve direction', aimLeft: 'Left', aimCentre: 'Centre', aimRight: 'Right', targetHint: 'The marker on court shows your target.',
  shotPower: 'Shot power', shotDirection: 'Shot direction', releaseHit: 'Release to hit', queuedHit: 'Shot ready', safeZone: 'Green: in court · Red: out', holdHit: 'Hold → release',
  local: 'Training stays on this device. Rated challenges are verified and saved to your account. The trial standings have no prizes or automatic membership rewards.',
  chooseOpponent: 'Choose your opponent', searchOpponent: 'Search players…', computerOpponent: 'Practice computer', noTs: 'No TS available — practice only', strength: 'TS',
  searchingPlayers: 'Searching players…', noPlayers: 'No players found. Try another name.', clearOpponent: 'Use practice computer',
  opponentNote: 'Game difficulty is scaled from the available current TS snapshot. This is an arcade opponent, not a recreation of the real player.',
  training: 'Training', rated: 'Rated 7-point challenge', consent: 'Save this challenge and show my nickname in the trial standings.',
  ratedNote: 'Same format and movement assist for everyone. 10 starts per UTC day, at most 3 against the same opponent. Starting another rated challenge counts an unfinished one as a loss.',
  signInGame: 'Sign in with a verified account to save rated challenges. Training is available to everyone.',
  career: 'Your arcade rating', monthly: 'This month', played: 'Played', wins: 'Wins', ratingScore: 'Conservative rating', provisional: 'Provisional · fewer than 10 challenges',
  history: 'Recent challenges', standings: 'Trial standings', loadStandings: 'Show trial standings', noStandings: 'No completed challenges yet.',
  savingGame: 'Verifying and saving your challenge…', savedGame: 'Challenge verified and saved', retrySave: 'Try saving again', startingGame: 'Preparing your challenge…',
  gameUnavailable: 'Rated play is temporarily unavailable. You can still practise.', catalogUnavailable: 'Player selection is temporarily unavailable. The practice computer is still available.',
  gameVersion: 'The game has changed. Finish any drafts, then refresh the page before starting a rated challenge.',
  gameLimit: 'The daily challenge limit has been reached. You can still practise.', replayFailed: 'This challenge could not be verified. Your result has not been added. You can retry saving.',
  consentRequired: 'Choose an opponent with TS and confirm saving before starting.', challengeExpired: 'This rated session has expired. Start a new challenge; an unfinished rated session counts as a loss.',
  pendingGame: 'You have an unfinished rated challenge.', abandoned: 'Abandoned', selectedOpponent: 'Selected opponent',
  ratingHelp: 'Your game-only skill starts at μ 25 with uncertainty σ 8.33. The conservative rating is μ − 3σ. Beating stronger opponents earns more; losses also count. Real player ratings are never changed.',
  profileUnavailable: 'Your game history could not be loaded.', boardUnavailable: 'Standings could not be loaded. Try again.',
  autoPause: 'Automatically pauses when you leave the court or switch tabs.',
  ball: 'A three-dimensional tennis game. Keyboard and touch controls are described below.',
  pointYou: 'Your point', pointCpu: 'Computer’s point', net: 'Into the net', out: 'Out of court', bounce: 'Second bounce',
  live: 'Rally in play', rally: 'Rally', best: 'Longest rally', hits: 'Your returns', unavailable: '3D graphics are unavailable. Please use a browser with WebGL 2 and hardware acceleration enabled.',
  camera: 'Camera', broadcast: 'Courtside', baseline: 'Baseline', lightweight: 'Lighter graphics', assist: 'Movement assist',
  fullscreen: 'Full screen', exitFullscreen: 'Exit full screen', umpire: 'Chair umpire', quiet: 'Quiet, please.',
  soundHint: 'Crowd reactions and court sounds. The umpire uses a local English voice when available.', fullscreenHint: 'F: full screen · Esc: exit / pause',
  scoring: 'Points', first: 'FIRST TO 7', keyHelp: 'Click the court to use the keyboard. Arrows or WASD to move. Hold Space for a normal hit, B for a drop shot, N for a smash. Release to hit. While held, left/right adjusts aim instead of moving. Green: in court; red: long or wide. Space also serves. Optional shortcuts: Shift to jump, X to hit, C to lob, Z to smash. Esc / P to pause.'
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
  drop: 'Skraćena', dropHint: 'B: mekša, kratka lopta s nižim i sporijim odskokom. N: smeč kad je lopta visoko; niska se vraća običnim udarcem. Drži odabranu tipku za snagu pa otpusti. Strelice određuju smjer.',
  endLeaderboard: 'Ljestvica', endMatches: 'Natrag na mečeve', leaveUnsavedResult: 'Rezultat izazova još nije spremljen. Želiš li izaći bez spremanja rezultata?',
  tip: 'Drži Space za obični udarac, B za skraćenu ili N za smeč pa otpusti za udarac. Uz ← / → odaberi smjer. Zeleno cilja teren; crvena snaga šalje predugo, a crveni smjer preširoko. Otpusti malo prije dolaska loptice. Dodatno C: lob, Z: brzi smeč.',
  aim: 'Smjer', selectedShot: 'Sljedeći udarac',
  rules: 'Do 7 poena, uz 2 razlike. Servis kao u tie-breaku: prvi poen, zatim po dva. Vrati lopticu prije drugog odskoka.',
  serveYou: 'Tvoj servis', serveCpu: 'Računalo servira', firstServe: 'Prvi servis', secondServe: 'Drugi servis', fault: 'Pogreška — drugi servis', let: 'Mreža — ponovi servis', doubleFault: 'Dvostruka pogreška',
  serveHint: '← / → pomiče cilj u servisnom polju. Drži Space za snagu, zatim otpusti za servis. Odabrani smjer se pamti. Izbjegni crveno područje.', power: 'Snaga servisa',
  serveDirection: 'Smjer servisa', aimLeft: 'Lijevo', aimCentre: 'Sredina', aimRight: 'Desno', targetHint: 'Oznaka na terenu pokazuje odabrani cilj.',
  shotPower: 'Snaga udarca', shotDirection: 'Smjer udarca', releaseHit: 'Otpusti za udarac', queuedHit: 'Udarac spreman', safeZone: 'Zeleno: teren · Crveno: aut', holdHit: 'Drži → otpusti',
  local: 'Trening ostaje na ovom uređaju. Bodovani izazovi provjeravaju se i spremaju na tvoj račun. Probna ljestvica nema nagrada ni automatske dodjele članstva.',
  chooseOpponent: 'Odaberi protivnika', searchOpponent: 'Pretraži igrače…', computerOpponent: 'Računalo za trening', noTs: 'TS nije dostupan — samo trening', strength: 'TS',
  searchingPlayers: 'Tražimo igrače…', noPlayers: 'Nema pronađenih igrača. Pokušaj s drugim imenom.', clearOpponent: 'Vrati računalo za trening',
  opponentNote: 'Težina igre prilagođena je dostupnom trenutnom TS-u. Ovo je arkadni protivnik, ne vjerna simulacija stvarnog igrača.',
  training: 'Trening', rated: 'Bodovani izazov do 7', consent: 'Spremi ovaj izazov i prikaži moj nadimak na probnoj ljestvici.',
  ratedNote: 'Jednak format i pomoć pri kretanju za sve. Do 10 početaka dnevno prema UTC-u, najviše 3 protiv istog protivnika. Početak novog bodovanog izazova računa nedovršeni kao poraz.',
  signInGame: 'Za spremanje bodovanih izazova prijavi se potvrđenim računom. Trening je dostupan svima.',
  career: 'Tvoj rejting igrice', monthly: 'Ovaj mjesec', played: 'Odigrano', wins: 'Pobjede', ratingScore: 'Konzervativni rejting', provisional: 'Privremeni poredak · manje od 10 izazova',
  history: 'Nedavni izazovi', standings: 'Probna ljestvica', loadStandings: 'Prikaži probnu ljestvicu', noStandings: 'Još nema završenih izazova.',
  savingGame: 'Provjeravamo i spremamo tvoj izazov…', savedGame: 'Izazov je provjeren i spremljen', retrySave: 'Pokušaj ponovno spremiti', startingGame: 'Pripremamo tvoj izazov…',
  gameUnavailable: 'Bodovana igra trenutačno nije dostupna. Trening i dalje radi.', catalogUnavailable: 'Odabir igrača trenutačno nije dostupan. Računalo za trening i dalje je dostupno.',
  gameVersion: 'Igrica je promijenjena. Sačuvaj nedovršeni rad pa osvježi stranicu prije novog bodovanog izazova.',
  gameLimit: 'Dosegnuto je dnevno ograničenje izazova. Možeš nastaviti trenirati.', replayFailed: 'Ovaj izazov nije moguće potvrditi. Rezultat nije dodan. Možeš pokušati ponovno spremiti.',
  consentRequired: 'Odaberi protivnika s TS-om i potvrdi spremanje prije početka.', challengeExpired: 'Ovaj bodovani izazov je istekao. Pokreni novi; nedovršeni bodovani izazov računa se kao poraz.',
  pendingGame: 'Imaš nedovršeni bodovani izazov.', abandoned: 'Odustajanje', selectedOpponent: 'Odabrani protivnik',
  ratingHelp: 'Tvoja snaga u igrici počinje s μ 25 i nesigurnošću σ 8,33. Konzervativni rejting je μ − 3σ. Pobjeda protiv jačeg protivnika donosi više; porazi se također računaju. Rejtinzi stvarnih igrača ostaju netaknuti.',
  profileUnavailable: 'Nije moguće učitati tvoju povijest igrice.', boardUnavailable: 'Ljestvica nije učitana. Pokušaj ponovno.',
  autoPause: 'Igra se automatski pauzira kada napustiš teren ili promijeniš karticu.',
  ball: 'Trodimenzionalna teniska igra. Kontrole tipkovnicom i dodirom opisane su ispod terena.',
  pointYou: 'Tvoj poen', pointCpu: 'Poen za računalo', net: 'Loptica u mreži', out: 'Izvan terena', bounce: 'Drugi odskok',
  live: 'Izmjena je u tijeku', rally: 'Izmjena', best: 'Najdulja izmjena', hits: 'Tvoji povrati', unavailable: '3D prikaz nije dostupan. Potreban je preglednik s podrškom za WebGL 2 i uključenim grafičkim ubrzanjem.',
  camera: 'Kamera', broadcast: 'Uz teren', baseline: 'Osnovna crta', lightweight: 'Lakša grafika', assist: 'Pomoć pri kretanju',
  fullscreen: 'Cijeli ekran', exitFullscreen: 'Izađi iz cijelog ekrana', umpire: 'Glavni sudac', quiet: 'Quiet, please.',
  soundHint: 'Reakcije publike i zvukovi terena. Sudac koristi lokalni engleski glas kada je dostupan.', fullscreenHint: 'F: cijeli ekran · Esc: izlaz / pauza',
  scoring: 'Poeni', first: 'DO 7 POENA', keyHelp: 'Klikni teren za tipkovnicu. Strelice ili WASD za kretanje. Drži Space za obični udarac, B za skraćenu, N za smeč pa otpusti. Dok držiš, lijevo/desno odabire smjer umjesto kretanja. Zeleno: teren; crveno: predugo ili preširoko. Space je i servis. Dodatne prečice: Shift za skok, X za udarac, C za lob, Z za smeč. Esc / P za pauzu.'
};
type Action = 'left' | 'right' | 'forward' | 'back' | 'jump' | 'drive' | 'lob' | 'smash' | 'drop';
interface ScoreView {
  phase: string; left: number; right: number; winner: number | null; pointWinner: number | null; reason: string | null; rally: number; best: number; hits: number;
  server: number; attempt: number; charge: number; serveAim: number; format: TennisFormat; pointLabels: [string, string]; games: [number, number]; sets: [number, number];
  completedSets: CompletedTennisSet[]; tieBreak: boolean; award: PointAward | null;
  strokeCharge: number; strokeAim: number; strokeCharging: boolean; strokePending: boolean;
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
  readonly selectedShot = signal<Shot | null>(null);
  readonly rated = signal(false);
  readonly rankingConsent = signal(false);
  readonly careerBusy = signal(false);
  readonly savingResult = signal(false);
  readonly leavingGame = signal(false);
  readonly careerMessage = signal('');
  readonly careerResult = signal<ArcadeResult | null>(null);
  readonly searchText = signal('');
  readonly opponentOpen = signal(false);
  readonly opponentSearchPending = signal(false);
  readonly activeOpponentIndex = signal(-1);
  readonly opponentName = computed(() => this.career.selected()?.name || this.words().cpu);
  readonly opponentChoices = computed(() => this.career.opponents().slice(0, 30));
  readonly activeOpponentId = computed(() => {
    const player = this.opponentChoices()[this.activeOpponentIndex()];
    return this.opponentOpen() && !this.opponentSearchPending() && !this.career.searching() && !this.career.catalogError() && player
      ? 'arcade-player-option-' + player.id : null;
  });
  readonly opponentTrackBy = (_index: number, player: ArcadeOpponent) => player.id;
  private careerSession: ArcadeSession | null = null;
  private recorder: ArcadeRecorder | null = null;
  private replayToSave: string | null = null;
  private resultAttempted = false;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private careerRequest?: Subscription;
  private actorSubscription: Subscription;
  private startRequestId = '';
  readonly touchDirections: { action: Action; icon: string }[] = [{ action: 'forward', icon: '↑' }, { action: 'left', icon: '←' }, { action: 'back', icon: '↓' }, { action: 'right', icon: '→' }];
  readonly view = signal<ScoreView>({ phase: 'ready', left: 0, right: 0, winner: null, pointWinner: null, reason: null, rally: 0, best: 0, hits: 0, server: 0, attempt: 1, charge: 0, serveAim: 0,
    format: 'match', pointLabels: ['0', '0'], games: [0, 0], sets: [0, 0], completedSets: [], tieBreak: false, award: null,
    strokeCharge: 0, strokeAim: 0, strokeCharging: false, strokePending: false });
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
  private previousHud = 0;
  private readonly keys = new Set<string>();
  private readonly spaceStroke = new TennisSpaceStroke();
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

  constructor(readonly regional: RegionalSettingsService, private zone: NgZone, @Inject(DOCUMENT) private document: Document, private host: ElementRef<HTMLElement>, readonly career: TennisCareerService, private router: Router) {
    this.career.search('');
    this.searchText.set(this.career.selected()?.name ?? '');
    this.actorSubscription = career.actorChanged.subscribe(() => {
      this.careerRequest?.unsubscribe(); this.careerBusy.set(false); this.savingResult.set(false); this.rated.set(false); this.rankingConsent.set(false);
      this.careerSession = null; this.recorder = null; this.replayToSave = null; this.careerResult.set(null); this.careerMessage.set(''); this.setup();
    });
  }

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
    if (this.careerBusy() || this.savingResult()) return;
    this.closeOpponentSearch();
    if (this.rated()) { this.startRated(); return; }
    this.careerSession = null; this.recorder = null; this.replayToSave = null;
    this.game = new Tennis3DEngine(Math.random, this.matchFormat());
    const ts = this.career.selected()?.ts;
    this.game.opponentStrength = ts != null ? opponentStrength(ts) : null;
    this.beginPlay();
  }
  private beginPlay(): void {
    this.clearAnnouncement(); this.atmosphere.reset(); this.soundscape?.stop(); this.lastAudioEvent = -1;
    this.clearInput(); this.game.assist = this.assist(); this.game.start(this.surface(), this.difficulty(), this.matchFormat()); this.paused.set(false);
    this.sync(); this.court.nativeElement.focus({ preventScroll: true }); this.run();
  }
  private startRated(): void {
    const opponent = this.career.selected();
    if (!this.career.verified() || opponent?.ts == null || !this.rankingConsent()) { this.careerMessage.set(this.words().consentRequired); return; }
    if (this.career.engineVersion() !== TENNIS_KERNEL_VERSION) { this.careerMessage.set(this.words().gameVersion); return; }
    this.careerBusy.set(true); this.careerMessage.set(''); this.careerResult.set(null); this.replayToSave = null;
    this.startRequestId ||= crypto.randomUUID();
    this.careerRequest = this.career.start({ opponentId: opponent.id, surface: this.surface(), requestId: this.startRequestId,
      engineVersion: TENNIS_KERNEL_VERSION, publicRanking: true }).subscribe({ next: session => {
        this.careerBusy.set(false); this.startRequestId = ''; this.careerSession = session;
        this.matchFormat.set('challenge'); this.assist.set(true);
        this.game = new Tennis3DEngine(arcadeRandom(session.seed), 'challenge'); this.game.opponentStrength = session.opponent.strength;
        this.recorder = null; this.beginPlay(); this.recorder = new ArcadeRecorder(); this.resultAttempted = false;
      }, error: e => { this.careerBusy.set(false); this.careerMessage.set(this.arcadeError(e)); } });
  }
  setRated(value: boolean): void {
    if (!['ready','over'].includes(this.game.phase) || this.careerBusy() || this.savingResult()) return;
    this.rated.set(value); this.rankingConsent.set(false); this.setup();
    if (value) { this.matchFormat.set('challenge'); this.assist.set(true); this.setup(); }
  }
  selectOpponent(opponent: ArcadeOpponent | null): void {
    if (this.game.phase !== 'ready' || this.careerBusy()) return;
    this.career.selected.set(opponent); this.startRequestId = ''; this.careerMessage.set('');
  }
  chooseOpponentId(id: string): void {
    if (this.game.phase !== 'ready' || this.careerBusy() || this.opponentSearchPending() || this.career.searching() || this.career.catalogError()) return;
    const player = this.opponentChoices().find(p => String(p.id) === id);
    if (!player) return;
    this.selectOpponent(player); this.searchText.set(player.name); this.closeOpponentSearch();
  }
  clearOpponent(): void {
    if (this.game.phase !== 'ready' || this.careerBusy()) return;
    this.selectOpponent(null); this.searchText.set(''); this.closeOpponentSearch();
  }
  openOpponentSearch(): void {
    if (!this.opponentOpen()) this.searchOpponents(this.searchText());
  }
  searchOpponents(value: string): void {
    if (this.game.phase !== 'ready' || this.careerBusy()) return;
    const query = value.slice(0, 80);
    this.searchText.set(query); this.opponentOpen.set(true); this.activeOpponentIndex.set(-1);
    this.opponentSearchPending.set(true); clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.career.search(query); this.opponentSearchPending.set(false); }, 300);
  }
  closeOpponentSearch(): void {
    clearTimeout(this.searchTimer); this.opponentSearchPending.set(false); this.opponentOpen.set(false); this.activeOpponentIndex.set(-1);
  }
  opponentKeyDown(event: KeyboardEvent): void {
    if (event.isComposing || this.game.phase !== 'ready' || this.careerBusy()) return;
    if (event.key === 'Tab') { this.closeOpponentSearch(); return; }
    if (event.key === 'Escape' && this.opponentOpen()) {
      event.preventDefault(); event.stopPropagation(); this.closeOpponentSearch(); return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    if (event.key === 'Enter') {
      if (!this.activeOpponentId()) return;
      event.preventDefault(); this.chooseOpponentId('' + this.opponentChoices()[this.activeOpponentIndex()].id); return;
    }
    event.preventDefault();
    if (!this.opponentOpen()) { this.openOpponentSearch(); return; }
    if (this.opponentSearchPending() || this.career.searching() || this.career.catalogError() || !this.opponentChoices().length) return;
    const size = this.opponentChoices().length, current = this.activeOpponentIndex();
    this.activeOpponentIndex.set(event.key === 'ArrowDown' ? (current + 1) % size : (current < 0 ? size - 1 : (current + size - 1) % size));
    this.document.defaultView?.requestAnimationFrame(() => {
      const id = this.activeOpponentId();
      if (!this.destroyed && id) this.document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
    });
  }
  opponentFocusOut(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) this.closeOpponentSearch();
  }
  @HostListener('document:pointerdown', ['$event']) outsideOpponentSearch(event: PointerEvent): void {
    if (this.opponentOpen() && !this.host.nativeElement.querySelector('.opponent-combobox')?.contains(event.target as Node)) this.closeOpponentSearch();
  }
  retryCareerSave(): void {
    if (!this.replayToSave || !this.careerSession || this.savingResult()) return;
    this.savingResult.set(true); this.careerMessage.set('');
    this.careerRequest = this.career.finish(this.careerSession.id, this.replayToSave).subscribe({ next: result => {
      this.savingResult.set(false); this.careerResult.set(result); this.careerMessage.set(this.words().savedGame);
      this.replayToSave = null; this.career.refreshProfile(); if (this.career.board()) this.career.refreshBoard();
    }, error: e => { this.savingResult.set(false); this.careerMessage.set(this.arcadeError(e)); } });
  }
  canRetryCareerSave(): boolean { return !!this.replayToSave; }
  async leaveFinishedGame(destination: 'leaderboard' | 'matches'): Promise<void> {
    if (this.game.phase !== 'over' || this.careerBusy() || this.savingResult() || this.leavingGame()) return;
    if (this.canRetryCareerSave() && !this.document.defaultView?.confirm(this.words().leaveUnsavedResult)) return;
    this.leavingGame.set(true);
    try {
      if (this.document.fullscreenElement === this.gamePanel.nativeElement) {
        try { await this.document.exitFullscreen(); } catch { /* Removing the routed panel also exits native fullscreen. */ }
      }
      this.setExpanded(false); this.stop(); this.clearInput(); this.clearAnnouncement(); this.soundscape?.stop();
      if (destination === 'leaderboard') await this.router.navigate(['/competition'], { queryParams: { tab: 'tennis-break' } });
      else await this.router.navigate(['/matches']);
    } finally { if (!this.destroyed) this.leavingGame.set(false); }
  }
  private finishRated(): void {
    if (!this.careerSession || !this.recorder || this.resultAttempted) return;
    this.resultAttempted = true;
    try {
      const bytes = this.recorder.exportBytes(); let binary = '';
      for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i,i+16384));
      this.replayToSave = btoa(binary); this.zone.run(() => this.retryCareerSave());
    } catch { this.zone.run(() => this.careerMessage.set(this.words().replayFailed)); }
  }
  private arcadeError(error: { error?: { code?: string } }): string {
    const code = error?.error?.code || '';
    return code === 'ARCADE_VERSION_CHANGED' ? this.words().gameVersion : code === 'ARCADE_DAILY_LIMIT' ? this.words().gameLimit :
      code === 'ARCADE_SESSION_EXPIRED' ? this.words().challengeExpired : /^ARCADE_REPLAY/.test(code) ? this.words().replayFailed : this.words().gameUnavailable;
  }
  gameNumber(value: number): string { return new Intl.NumberFormat(this.regional.language() === 'hr' ? 'hr-HR' : 'en-GB', { maximumFractionDigits: 2 }).format(value); }
  gameDate(value: string): string { return this.regional.dateTime(value, 'utc'); }
  private recordCommand(command: ArcadeCommand): void { this.recorder?.command(command); }
  setup(): void {
    if (this.careerBusy() || this.savingResult()) return;
    this.stop(); this.clearInput(); this.clearAnnouncement(); this.atmosphere.reset(); this.soundscape?.stop(); this.lastAudioEvent = -1;
    this.paused.set(false); this.game = new Tennis3DEngine(Math.random, this.matchFormat()); this.game.assist = this.assist();
    this.recorder = null; this.careerSession = null; this.replayToSave = null; this.resultAttempted = false; this.careerResult.set(null); this.careerMessage.set(''); this.startRequestId = '';
    this.game.surface = this.surface(); this.sync(); this.paint();
  }
  changeSurface(value: string): void {
    if (!['grass', 'clay', 'hard'].includes(value) || this.view().phase !== 'ready') return;
    this.surface.set(value as CourtSurface); this.game.surface = value as CourtSurface; this.paint();
  }
  changeDifficulty(value: string): void { if (['easy', 'normal', 'hard'].includes(value)) this.difficulty.set(value as Difficulty); }
  changeFormat(value: string): void {
    if (!['match', 'challenge'].includes(value) || this.game.phase !== 'ready' || this.rated()) return;
    this.matchFormat.set(value as TennisFormat); this.setup();
  }
  changeCamera(): void {
    this.camera.set(this.camera() === 'broadcast' ? 'baseline' : 'broadcast'); this.renderer?.setCamera(this.camera()); this.paint();
  }
  toggleLightweight(): void { this.lightweight.update(v => !v); this.renderer?.setLightweight(this.lightweight()); this.paint(); }
  toggleAssist(): void { if (this.rated()) return; this.assist.update(v => !v); this.game.assist = this.assist(); }
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
    if (!['a', 'd', 'w', 's', 'shift', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'x', 'c', 'z', 'b', 'n'].includes(key)) return;
    event.preventDefault();
    if (this.paused() || ['ready', 'over', 'point', 'fault', 'let'].includes(this.game.phase)) return;
    if (!event.repeat && !this.keys.has(key) && [' ', 'x', 'c', 'z', 'b', 'n'].includes(key)) {
      this.recordCommand(1); this.game.armServe();
      if (key === ' ') this.spaceStroke.press(performance.now());
    }
    this.keys.add(key);
    this.syncShotChoice();
  }
  keyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (key === ' ') this.spaceStroke.release();
    this.keys.delete(key); this.syncShotChoice();
  }
  touchStart(event: PointerEvent, action: Action): void {
    if (this.game.phase === 'ready' || this.paused() || this.game.phase === 'over') return;
    event.preventDefault();
    if (['drive', 'lob', 'smash', 'drop'].includes(action)) { this.recordCommand(1); this.game.armServe(); }
    this.touches.set(event.pointerId, action);
    this.syncShotChoice();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  touchEnd(event: PointerEvent): void { this.touches.delete(event.pointerId); this.syncShotChoice(); }
  chooseServeAim(value: number): void {
    if (this.paused() || this.game.phase !== 'serving' || this.game.server !== 0) return;
    this.recordCommand((value + 4) as ArcadeCommand); this.game.setServeAim(value); this.sync(); this.paint(performance.now()); this.court.nativeElement.focus({ preventScroll: true });
  }
  touchCancel(event: PointerEvent): void {
    if (!this.touches.has(event.pointerId)) return;
    this.touches.delete(event.pointerId); this.recordCommand(2); this.game.cancelServeCharge();
    this.syncShotChoice();
  }
  clearInput(): void { this.keys.clear(); this.touches.clear(); this.spaceStroke.clear(); this.syncShotChoice(); this.recordCommand(2); this.game.cancelServeCharge(); }
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

  private syncShotChoice(): void {
    const next = this.input().shot;
    if (this.selectedShot() !== next) this.zone.run(() => this.selectedShot.set(next));
  }
  private input(): CourtControls {
    const actions = new Set(this.touches.values());
    const held = (action: Action) => actions.has(action);
    const gesture = this.spaceStroke.read();
    const charged: Shot | null = this.keys.has('n') || held('smash') ? 'smash' : this.keys.has('b') || held('drop') ? 'drop' : held('drive') ? 'drive' : gesture.shot;
    return { left: this.keys.has('a') || this.keys.has('arrowleft') || held('left'), right: this.keys.has('d') || this.keys.has('arrowright') || held('right'),
      forward: this.keys.has('w') || this.keys.has('arrowup') || held('forward'), back: this.keys.has('s') || this.keys.has('arrowdown') || held('back'),
      jump: this.keys.has('shift') || held('jump'),
      shot: charged ?? (this.keys.has('z') ? 'smash' : this.keys.has('c') || held('lob') ? 'lob' : this.keys.has('x') ? 'drive' : null),
      aiming: charged !== null };
  }
  private run(): void {
    this.stop(); this.previousTime = 0; this.previousDraw = 0; this.previousHud = 0;
    this.zone.runOutsideAngular(() => {
      const tick = (now: number) => {
        this.frameId = null;
        if (this.destroyed || this.paused() || this.document.hidden) return;
        const realDt = this.previousTime ? (now - this.previousTime) / 1000 : 0;
        const dt = this.recorder ? quantizedStep(realDt) : realDt;
        const previousPhase = this.game.phase;
        const input = this.input(); this.recorder?.capture(dt, input);
        this.previousTime = now; this.game.update(dt, input);
        if (this.game.phase !== previousPhase && ['serving', 'point', 'fault', 'let', 'over'].includes(this.game.phase)) this.clearInput();
        this.syncShotChoice();
        if (now - this.previousDraw >= 32 || this.game.phase === 'over') { this.paint(now); this.previousDraw = now; }
        // Keep physics/input at full rate without running the entire SPA for every meter tick.
        if (now - this.previousHud >= 50 || this.game.phase !== previousPhase || this.game.phase === 'over') {
          this.sync(); this.previousHud = now;
        }
        this.gameFeedback(dt);
        if (this.game.phase === 'over') this.finishRated();
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
      server: this.game.server, attempt: this.game.serveAttempt, charge: Math.round(this.game.serveCharge * 20) / 20, serveAim: Math.round(this.game.serveAim * 100) / 100,
      format: this.game.scoring.format, pointLabels: this.game.scoring.pointLabels, games: [...this.game.scoring.games], sets: [...this.game.scoring.sets],
      completedSets: [...this.game.scoring.completedSets], tieBreak: this.game.scoring.isTieBreak, award: this.game.scoring.lastAward,
      strokeCharge: Math.round(this.game.strokeCharge * 50) / 50, strokeAim: Math.round(this.game.strokeAim * 50) / 50,
      strokeCharging: this.game.strokeCharging, strokePending: this.game.strokePending };
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
    clearTimeout(this.searchTimer); this.careerRequest?.unsubscribe(); this.actorSubscription.unsubscribe(); this.recorder = null; this.replayToSave = null;
    if (this.document.fullscreenElement === this.gamePanel.nativeElement) void this.document.exitFullscreen().catch(() => undefined);
    this.setExpanded(false); this.renderer?.dispose();
  }
}
