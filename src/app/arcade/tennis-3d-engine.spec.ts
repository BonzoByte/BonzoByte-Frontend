import { CourtControls, FIELD, Tennis3DEngine } from './tennis-3d-engine';
const idle: CourtControls = { left: false, right: false, forward: false, back: false, jump: false, shot: null };

describe('Three-dimensional tennis physics', () => {
  let game: Tennis3DEngine;
  beforeEach(() => {
    game = new Tennis3DEngine(() => .5); game.start(); game.strikeServe();
    Object.assign(game, { serviceActive: false }); game.players[0].x = 0; game.players[0].z = 10.8;
  });
  function incoming(): void {
    Object.assign(game, { hitter: 1, crossed: true });
    game.ball = { x: .4, y: 1.25, z: 10.5, vx: 0, vy: -1, vz: 8 };
    game.players[0].swing = 0;
  }
  it('serves from the near baseline towards the far court', () => {
    expect(game.phase).toBe('playing'); expect(game.ball.z).toBeGreaterThan(0); expect(game.ball.vz).toBeLessThan(0);
    expect(Object.values(game.ball).every(Number.isFinite)).toBeTrue();
  });
  it('keeps all dimensions frozen on invalid time or an inactive scene', () => {
    const before = JSON.stringify(game.ball);
    for (const dt of [NaN, Infinity, -2, 0]) game.update(dt, idle);
    game.phase = 'ready'; game.update(.05, idle); expect(JSON.stringify(game.ball)).toBe(before);
    game.phase = 'over'; game.update(.05, idle); expect(JSON.stringify(game.ball)).toBe(before);
  });
  it('caps suspended frame gaps', () => {
    const z = game.ball.z; game.update(600, idle); expect(Math.abs(game.ball.z - z)).toBeLessThan(1);
  });
  it('moves independently across and along the court', () => {
    game.assist = false; const p = game.players[0];
    game.update(.05, { ...idle, right: true, forward: true }); expect(p.x).toBeGreaterThan(0); expect(p.z).toBeLessThan(10.8);
    expect(Math.hypot(p.x, p.z - 10.8)).toBeCloseTo(5.5 * .05, 5);
  });
  it('does not cross the net or leave the run-off area', () => {
    game.assist = false; const p = game.players[0]; p.x = 5.69; p.z = 1.11;
    game.update(.05, { ...idle, right: true, forward: true }); expect(p.x).toBe(5.7); expect(p.z).toBe(1.1);
  });
  it('jumps in height without repeated mid-air boosts', () => {
    game.update(.05, { ...idle, jump: true }); const vy = game.players[0].vy;
    expect(game.players[0].y).toBeGreaterThan(0);
    game.update(.05, { ...idle, jump: true }); expect(game.players[0].vy).toBeLessThan(vy);
  });
  it('rejects own shots and distant balls', () => {
    expect(game.hit(0, 'drive')).toBeFalse(); incoming(); game.ball.x = 10; expect(game.hit(0, 'drive')).toBeFalse();
  });
  it('strikes an incoming ball across the net and prevents a double hit', () => {
    incoming(); expect(game.hit(0, 'drive')).toBeTrue(); expect(game.ball.vz).toBeLessThan(0);
    expect(game.hits).toBe(1); expect(game.rally).toBe(1); expect(game.hit(0, 'drive')).toBeFalse();
  });
  it('aims strokes to the selected side without leaving the singles court', () => {
    incoming(); game.hit(0, 'drive', 1); const right = game.landing();
    incoming(); game.hit(0, 'drive', -1); const left = game.landing();
    expect(right.x).toBeGreaterThan(2); expect(left.x).toBeLessThan(-2); expect(Math.abs(right.x)).toBeLessThan(FIELD.halfWidth);
  });
  it('uses a higher lob trajectory and a faster elevated smash', () => {
    incoming(); game.hit(0, 'lob'); const lob = { ...game.ball };
    incoming(); game.ball.y = 2.2; game.hit(0, 'smash'); expect(Math.abs(game.ball.vz)).toBeGreaterThan(Math.abs(lob.vz)); expect(game.ball.vy).toBeLessThan(lob.vy);
  });
  it('waits after the actual human stroke before reading the new ball path', () => {
    incoming(); (game as any).cpuTarget = { x: 2, z: -10 };
    game.hit(0, 'drive', -1); const target = { ...(game as any).cpuTarget };
    for (let i = 0; i < 24; i++) game.update(1 / 120, idle);
    expect((game as any).cpuTarget).toEqual(target); expect((game as any).cpuAware).toBeFalse();
    for (let i = 0; i < 20; i++) game.update(1 / 120, idle);
    expect((game as any).cpuTarget.x).toBeLessThan(0); expect((game as any).cpuAware).toBeTrue();
  });
  it('cannot read held aim keys before the human has struck the ball', () => {
    incoming(); game.ball.z = 7; game.assist = false;
    game.update(.01, { ...idle, right: true, aiming: true, aim: 1 }); const first = { ...(game as any).cpuTarget };
    game.update(.01, { ...idle, left: true, aiming: true, aim: -1 });
    expect((game as any).cpuTarget).toEqual(first);
  });
  it('can be wrong-footed, with momentum rather than instant direction reversal', () => {
    incoming(); (game as any).cpuTarget = { x: 3, z: -10.8 }; (game as any).cpuVelocity = { x: 4, z: 0 };
    const x = game.players[1].x; game.hit(0, 'drive', -1); game.update(.05, idle);
    expect(game.players[1].x).toBeGreaterThan(x); expect((game as any).cpuTarget.x).toBe(3);
    for (let i = 0; i < 38; i++) game.update(1 / 120, idle);
    expect((game as any).cpuTarget.x).toBeLessThan(0);
  });
  it('uses at least 200 ms reaction delay even on the hardest setting', () => {
    game.difficulty = 'hard'; incoming(); game.hit(0, 'drive', 1);
    expect((game as any).reaction).toBeGreaterThanOrEqual(.2);
    for (let i = 0; i < 23; i++) game.update(1 / 120, idle);
    expect((game as any).cpuAware).toBeFalse();
  });
  it('aims with Space/arrows without sideways player movement', () => {
    incoming(); game.assist = false; const x = game.players[0].x;
    game.update(.01, { ...idle, right: true, aiming: true, aim: 1, shot: 'drive' });
    expect(game.players[0].x).toBe(x); expect(game.hits).toBe(0); expect(game.strokeCharging).toBeTrue();
    expect(game.strokeAim).toBeGreaterThan(0);
  });
  it('computes a ballistic landing point on the opposite half', () => {
    const landing = game.landing(); expect(landing.z).toBeCloseTo(-5, 4); expect(landing.x).toBeLessThan(0);
  });
  it('awards a net fault once', () => {
    game.ball = { x: 0, y: .4, z: .01, vx: 0, vy: 0, vz: -8 }; game.update(.02, idle);
    expect(game.score).toEqual([0, 1]); expect(game.reason).toBe('net'); game.update(.02, idle); expect(game.score).toEqual([0, 1]);
  });
  it('permits one valid bounce and gives the second bounce to the hitter', () => {
    Object.assign(game, { crossed: true }); game.players[1].x = 5;
    game.ball = { x: 0, y: .07, z: -8, vx: 0, vy: -2, vz: -1 }; game.update(.01, idle);
    expect(game.score).toEqual([0, 0]); expect(game.ball.vy).toBeGreaterThan(0);
    game.ball.y = .07; game.ball.vy = -2; game.update(.01, idle); expect(game.score).toEqual([1, 0]);
  });
  it('still awards the hitter when a legal first bounce runs beyond the baseline', () => {
    Object.assign(game, { crossed: true, bounces: 1 }); game.players[1].x = 5;
    game.ball = { x: 0, y: .07, z: -13, vx: 0, vy: -2, vz: -1 }; game.update(.01, idle);
    expect(game.score).toEqual([1, 0]); expect(game.reason).toBe('bounce');
  });
  it('awards the receiver for an unbounced shot outside the singles lines', () => {
    Object.assign(game, { crossed: true }); game.ball = { x: 4.5, y: .07, z: -8, vx: 0, vy: -2, vz: -1 }; game.update(.01, idle);
    expect(game.score).toEqual([0, 1]); expect(game.reason).toBe('out');
  });
  it('uses tie-break service order and requires a two-point lead', () => {
    const award = (side: 0 | 1) => { game.phase = 'playing'; (game as any).award(side, 'bounce'); };
    award(0); expect(game.server).toBe(1); award(1); expect(game.server).toBe(1); award(0); expect(game.server).toBe(0);
    game.score = [6, 6]; award(0); expect(game.phase).toBe('point'); award(0); expect(game.phase).toBe('over'); expect(game.winner).toBe(0);
  });
  it('lets manual movement override assist and preserves the assist preference on restart', () => {
    incoming(); const x = game.players[0].x; game.update(.02, { ...idle, left: true }); expect(game.players[0].x).toBeLessThan(x);
    game.assist = false; game.start('clay', 'hard'); expect(game.assist).toBeFalse(); expect(game.surface).toBe('clay'); expect(game.score).toEqual([0, 0]);
  });
  it('keeps physics finite through a complete unattended match', () => {
    let ticks = 0;
    while (game.phase !== 'over' && ticks++ < 30000) { if (game.phase === 'serving' && game.server === 0) game.strikeServe(); game.update(1 / 60, idle); expect(Object.values(game.ball).every(Number.isFinite)).toBeTrue(); }
    expect(game.phase).toBe('over'); expect(game.winner).toBe(1);
  });
  it('can sustain a rally with movement assist and held Hit', () => {
    for (let tick = 0; tick < 6000 && game.phase !== 'over'; tick++) {
      if (game.phase === 'serving' && game.server === 0) game.strikeServe();
      game.update(1 / 60, { ...idle, shot: 'drive' });
    }
    expect(game.hits).toBeGreaterThan(3); expect(game.bestRally).toBeGreaterThan(3);
  });
});

describe('First and second serves', () => {
  it('holds the receiving stance until a struck serve can actually be read', () => {
    const game=new Tennis3DEngine(()=>.5);game.start('grass','hard');
    const before={x:game.players[1].x,z:game.players[1].z};game.strikeServe(.7,.9);
    for(let tick=0;tick<18;tick++)game.update(1/120,idle);
    expect(game.players[1].x).toBeCloseTo(before.x,8);expect(game.players[1].z).toBeCloseTo(before.z,8);
    expect((game as any).cpuAware).toBeFalse();
    for(let tick=0;tick<18;tick++)game.update(1/120,idle);
    expect((game as any).cpuAware).toBeTrue();
    expect(Math.hypot(game.players[1].x-before.x,game.players[1].z-before.z)).toBeGreaterThan(.01);
  });
  it('lets a strong receiver return an ordinary wide serve on either side on every surface', () => {
    for(const surface of ['grass','clay','hard'] as const)for(const parity of [0,1]){
      const game=new Tennis3DEngine(()=>.5);game.start(surface,'hard');game.score=[parity,0];
      (game as any).prepareServe(true);game.strikeServe(.7,.9);
      for(let tick=0;tick<360&&game.phase==='playing'&&game.rally===0;tick++)game.update(1/120,idle);
      expect(game.rally).withContext(surface+' service side '+parity).toBeGreaterThan(0);
      expect((game as any).hitter).toBe(1);expect(game.score).toEqual([parity,0]);
    }
  });
  let game: Tennis3DEngine;
  const advance = (seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 120); i++) game.update(1 / 120, idle); };
  beforeEach(() => { game = new Tennis3DEngine(() => .5); game.start(); });
  it('moves and retains the service target before charging without moving the player', () => {
    const playerX = game.players[0].x, centre = game.serveTarget.x;
    for (let i = 0; i < 14; i++) game.update(.05, { ...idle, left: true });
    expect(game.serveAim).toBeCloseTo(-1.26, 5); expect(game.players[0].x).toBe(playerX);
    expect(game.serveTarget.x).toBeLessThan(centre);
    game.update(.05, idle); expect(game.serveAim).toBeCloseTo(-1.26, 5); expect(game.phase).toBe('serving');
  });
  it('serves to the retained target after releasing the arrow before Space', () => {
    game.setServeAim(1); game.update(.01, idle);
    for (let i = 0; i < 12; i++) game.update(.05, { ...idle, shot: 'drive' });
    const target = game.serveTarget;
    game.update(.01, idle);
    expect(game.serveReleaseQueued).toBeTrue();
    for (let i = 0; i < 160 && game.phase === 'serving'; i++) game.update(1 / 120, idle);
    expect(game.phase).toBe('playing'); expect(game.serveAim).toBe(1);
    // The release update also advances one semi-implicit physics substep.
    expect(game.landing().x).toBeCloseTo(target.x, 3); expect(game.landing().z).toBeCloseTo(target.z, 3);
  });
  it('keeps left/right direction consistent in both diagonal service boxes', () => {
    for (const score of [[0, 0], [1, 0]] as [number, number][]) {
      game.score = score; (game as any).prepareServe(true);
      game.setServeAim(-1); const left = game.serveTarget;
      game.setServeAim(1); const right = game.serveTarget;
      expect(left.x).toBeLessThan(right.x);
      for (const target of [left, right]) {
        expect(target.x * game.serviceBoxSign).toBeGreaterThan(0);
        expect(Math.abs(target.x)).toBeLessThan(FIELD.halfWidth);
        expect(Math.abs(target.z)).toBeLessThan(FIELD.serviceLine);
      }
    }
  });
  it('keeps power and aim independent and marks an overcharged serve as long', () => {
    game.setServeAim(.6); const target = game.serveTarget;
    game.serveCharge = 1.1;
    expect(game.serveTarget.x).toBe(target.x); expect(Math.abs(game.serveTarget.z)).toBeGreaterThan(FIELD.serviceLine);
    game.strikeServe(1.1); expect(game.landing().x).toBeCloseTo(target.x, 8);
  });
  it('clamps direction and rejects invalid or out-of-turn direction changes', () => {
    game.setServeAim(10); expect(game.serveAim).toBe(1.3);
    game.setServeAim(NaN); expect(game.serveAim).toBe(1.3);
    game.strikeServe(); game.setServeAim(-1); expect(game.serveAim).toBe(1.3);
    game.start(); game.server = 1; game.setServeAim(-1); expect(game.serveAim).toBe(0);
  });
  it('retains aim on pause but resets it for a fresh service attempt', () => {
    game.setServeAim(-.7); game.cancelServeCharge(); expect(game.serveAim).toBe(-.7);
    (game as any).prepareServe(false); expect(game.serveAim).toBe(0);
  });
  it('waits for a human hold and release, behind the baseline', () => {
    expect(game.phase).toBe('serving'); expect(game.players[0].z).toBeGreaterThan(FIELD.halfLength);
    game.update(.03, idle); game.update(.05, { ...idle, shot: 'drive' });
    expect(game.phase).toBe('serving'); expect(game.serveCharge).toBeGreaterThan(0);
    game.update(.01, idle); expect(game.phase).toBe('serving'); expect(game.serveReleaseQueued).toBeTrue();
    for (let i = 0; i < 160 && game.phase === 'serving'; i++) game.update(1 / 120, idle);
    expect(game.phase).toBe('playing'); expect(game.event).toBe('serve');
  });
  it('cancels an unfinished charge when pausing instead of serving on resume', () => {
    game.update(.02, idle); game.update(.05, { ...idle, shot: 'drive' }); game.cancelServeCharge(); game.update(.02, idle);
    expect(game.phase).toBe('serving'); expect(game.serveCharge).toBe(0);
  });
  it('targets the diagonal service box and permits a normal first serve', () => {
    game.strikeServe(.5); (game as any).cpuMiss = true; const landing = game.landing();
    expect(landing.x).toBeLessThan(0); expect(Math.abs(landing.z)).toBeLessThan(FIELD.serviceLine);
    advance(.9); expect(game.score).toEqual([0, 0]); expect((game as any).bounces).toBe(1);
  });
  it('does not allow a serve volley before the first bounce', () => {
    game.strikeServe(); game.players[1].x = game.ball.x; game.players[1].z = -2; game.ball.z = -2; game.ball.y = 1.2;
    expect(game.canHit(1)).toBeFalse(); (game as any).bounces = 1; expect(game.canHit(1)).toBeTrue();
  });
  it('keeps score and server after the first fault, then awards a double fault', () => {
    game.strikeServe(1.1); advance(1); expect(game.phase).toBe('fault'); expect(game.serveAttempt).toBe(2);
    expect(game.score).toEqual([0, 0]); expect(game.server).toBe(0);
    advance(1.2); expect(game.phase).toBe('serving'); game.strikeServe(1.1); advance(1.1);
    expect(game.phase).toBe('point'); expect(game.reason).toBe('doubleFault'); expect(game.score).toEqual([0, 1]);
  });
  it('does not turn a held first attempt into an automatic second serve', () => {
    game.strikeServe(1.1); advance(1);
    for (let i = 0; i < 150; i++) game.update(1 / 60, { ...idle, shot: 'drive' });
    expect(game.phase).toBe('serving'); expect(game.serveCharge).toBe(0);
  });
  it('replays a legal net let without changing attempt or score', () => {
    game.strikeServe(); Object.assign(game, { crossed: true, netTouched: true });
    game.ball = { x: -2, y: .07, z: -5, vx: 0, vy: -2, vz: -1 }; game.update(.01, idle);
    expect(game.phase).toBe('let'); expect(game.score).toEqual([0, 0]); advance(1.1);
    expect(game.phase).toBe('serving'); expect(game.serveAttempt).toBe(1);
  });
  it('treats a net touch landing outside the service box as a fault, not a let', () => {
    game.strikeServe(); Object.assign(game, { crossed: true, netTouched: true });
    game.ball = { x: -2, y: .07, z: -8, vx: 0, vy: -2, vz: -1 }; game.update(.01, idle);
    expect(game.phase).toBe('fault'); expect(game.serveAttempt).toBe(2);
  });
  it('rejects a first bounce in the wrong diagonal box', () => {
    game.strikeServe(); Object.assign(game, { crossed: true });
    game.ball = { x: 2, y: .07, z: -5, vx: 0, vy: -2, vz: -1 }; game.update(.01, idle); expect(game.phase).toBe('fault');
  });
  it('turns a serve below the net into a fault without awarding a point', () => {
    game.strikeServe(); game.ball = { x: -.5, y: .4, z: .01, vx: 0, vy: 0, vz: -8 }; game.update(.02, idle);
    expect(game.phase).toBe('fault'); expect(game.score).toEqual([0, 0]);
  });
  it('recognizes a genuine net contact and then a legal let landing', () => {
    game.strikeServe(); game.ball = { x: -1, y: FIELD.netHeight + .03, z: .01, vx: -1, vy: 0, vz: -8 }; game.update(.01, idle);
    expect((game as any).netTouched).toBeTrue(); expect(game.phase).toBe('playing');
    game.ball = { x: -2, y: .07, z: -4, vx: 0, vy: -2, vz: -1 }; game.update(.01, idle);
    expect(game.phase).toBe('let');
  });
  it('clears the previous point event on a new match, avoiding phantom crowd reactions', () => {
    game.strikeServe(); (game as any).award(0, 'bounce'); expect(game.event).toBe('point');
    game.start(); expect(game.event).toBeNull(); expect(game.serveAttempt).toBe(1); expect(game.score).toEqual([0, 0]);
  });
  it('alternates diagonal boxes with total point parity and resets the attempt', () => {
    game.strikeServe(); (game as any).award(0, 'bounce'); advance(1.7);
    expect(game.server).toBe(1); expect(game.serviceBoxSign).toBe(-1); expect(game.serveAttempt).toBe(1);
  });
  it('lets the computer serve after its preparation time', () => {
    game.server = 1; (game as any).prepareServe(true); advance(1.2); expect(game.phase).toBe('playing'); expect(game.ball.vz).toBeGreaterThan(0);
  });
  it('rejects invalid serve inputs and duplicate launches', () => {
    expect(game.strikeServe(NaN)).toBeFalse(); expect(game.strikeServe(.5, Infinity)).toBeFalse();
    expect(game.strikeServe()).toBeTrue(); expect(game.strikeServe()).toBeFalse();
  });
});

describe('Scorekeeper integration with the 3D court', () => {
  let game: Tennis3DEngine;
  const point = (side: 0 | 1) => { game.phase = 'playing'; (game as any).award(side, 'bounce'); };
  beforeEach(() => { game = new Tennis3DEngine(() => .5); game.start('grass', 'normal', 'match'); });
  it('uses normal points and keeps the same server within a game', () => {
    point(0); expect(game.scoring.pointLabels).toEqual(['15', '0']); expect(game.server).toBe(0); expect(game.phase).toBe('point');
    point(1); expect(game.scoring.pointLabels).toEqual(['15', '15']); expect(game.server).toBe(0);
  });
  it('changes server after a game, not after two points, and prepares a fresh first serve', () => {
    for (let i = 0; i < 4; i++) point(0);
    expect(game.scoring.games).toEqual([1, 0]); expect(game.server).toBe(1); expect(game.score).toEqual([0, 0]);
    for (let i = 0; i < 280; i++) game.update(1 / 120, idle);
    expect(game.phase).toBe('serving'); expect(game.serveAttempt).toBe(1); expect(game.serviceBoxSign).toBe(1);
  });
  it('awards a double fault as 15 to the receiver rather than as an entire game', () => {
    game.strikeServe(); game.serveAttempt = 2; (game as any).serviceFault();
    expect(game.reason).toBe('doubleFault'); expect(game.scoring.pointLabels).toEqual(['0', '15']); expect(game.scoring.games).toEqual([0, 0]); expect(game.server).toBe(0);
  });
  it('continues into a second set and finishes only after two sets are won', () => {
    for (let i = 0; i < 24; i++) point(0);
    expect(game.scoring.sets).toEqual([1, 0]); expect(game.winner).toBeNull(); expect(game.phase).toBe('point');
    for (let i = 0; i < 24; i++) point(0);
    expect(game.scoring.sets).toEqual([2, 0]); expect(game.winner).toBe(0); expect(game.phase).toBe('over');
    const score = JSON.stringify(game.scoring); game.update(.05, idle); expect(JSON.stringify(game.scoring)).toBe(score);
  });
  it('restarts the chosen format without retaining old games, sets or statistics', () => {
    for (let i = 0; i < 24; i++) point(0);
    game.start('clay', 'easy'); expect(game.scoring.format).toBe('match'); expect(game.scoring.sets).toEqual([0, 0]); expect(game.scoring.completedSets).toEqual([]);
    game.start('hard', 'hard', 'challenge'); point(0); expect(game.score).toEqual([1, 0]); expect(game.scoring.games).toEqual([0, 0]);
  });
  it('alternates service box within a game and resets to deuce court on the next game', () => {
    expect(game.serviceBoxSign).toBe(-1); point(0); expect(game.serviceBoxSign).toBe(1); point(0); expect(game.serviceBoxSign).toBe(-1);
    point(0); point(0); expect(game.server).toBe(1); expect(game.serviceBoxSign).toBe(1);
  });
});
