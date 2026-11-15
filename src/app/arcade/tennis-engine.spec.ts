import { COURT, Controls, TennisEngine } from './tennis-engine';
const still: Controls = { left: false, right: false, jump: false, shot: null };
describe('Tennis break isolated engine', () => {
  let game: TennisEngine;
  beforeEach(() => { game = new TennisEngine(() => .5); game.start(); });
  function award(side: 0 | 1): void { Object.assign(game, { phase: 'playing' }); (game as any).award(side, 'bounce'); }
  it('starts a fresh match with a live, finite serve', () => {
    expect(game.phase).toBe('playing'); expect(game.score).toEqual([0, 0]);
    expect(game.ball.vx).toBeGreaterThan(0); expect(Object.values(game.ball).every(Number.isFinite)).toBeTrue();
  });
  it('ignores invalid time and freezes ready and finished matches', () => {
    const before = JSON.stringify(game.ball);
    for (const dt of [0, -1, NaN, Infinity]) game.update(dt, still);
    expect(JSON.stringify(game.ball)).toBe(before);
    game.phase = 'over'; game.update(.05, still); expect(JSON.stringify(game.ball)).toBe(before);
  });
  it('bounds long frame gaps instead of teleporting after backgrounding', () => {
    const x = game.ball.x; game.update(60, still); expect(game.ball.x - x).toBeLessThan(30);
  });
  it('keeps the human on their own half', () => {
    game.players[0].x = 455; game.update(.05, { ...still, right: true }); expect(game.players[0].x).toBe(456);
    game.players[0].x = 81; game.update(.05, { ...still, left: true }); expect(game.players[0].x).toBe(80);
  });
  it('allows a jump but not repeated mid-air jumps', () => {
    game.update(.04, { ...still, jump: true }); const y = game.players[0].y;
    expect(y).toBeLessThan(COURT.ground);
    game.update(.04, { ...still, jump: true }); expect(game.players[0].vy).toBeGreaterThan(-330);
  });
  it('does not return its own shot or strike a distant ball', () => {
    expect(game.hit(0, 'drive')).toBeFalse();
    Object.assign(game, { lastHitter: 1 }); game.ball.x = 900; expect(game.hit(0, 'drive')).toBeFalse();
  });
  it('returns a nearby ball and cannot double hit', () => {
    Object.assign(game, { lastHitter: 1 }); game.ball = { x: 230, y: 355, vx: -300, vy: 70 };
    expect(game.hit(0, 'drive')).toBeTrue(); expect(game.ball.vx).toBeGreaterThan(0);
    expect(game.rally).toBe(1); expect(game.hit(0, 'drive')).toBeFalse();
  });
  it('makes lob and elevated smash distinct shots', () => {
    Object.assign(game, { lastHitter: 1 }); game.ball = { x: 230, y: 310, vx: -300, vy: 0 };
    expect(game.hit(0, 'lob')).toBeTrue(); const lob = { ...game.ball };
    game.players[0].swing = 0; Object.assign(game, { lastHitter: 1 }); game.ball = { x: 230, y: 310, vx: -300, vy: 0 };
    expect(game.hit(0, 'smash')).toBeTrue(); expect(game.ball.vx).toBeGreaterThan(lob.vx); expect(game.ball.vy).toBeGreaterThan(lob.vy);
  });
  it('awards a net fault to the opponent exactly once', () => {
    game.ball = { x: 499, y: 350, vx: 300, vy: 0 }; game.update(.02, still);
    expect(game.score).toEqual([0, 1]); expect(game.phase).toBe('point'); expect(game.reason).toBe('net');
    game.update(.05, still); expect(game.score).toEqual([0, 1]);
  });
  it('allows one legal bounce and ends the rally on the second', () => {
    Object.assign(game, { crossed: true }); game.players[1].x = 548;
    game.ball = { x: 900, y: 426, vx: 0, vy: 100 }; game.update(.01, still);
    expect(game.score).toEqual([0, 0]); expect(game.ball.vy).toBeLessThan(0);
    game.ball.y = 426; game.ball.vy = 100; game.update(.01, still);
    expect(game.score).toEqual([1, 0]); expect(game.reason).toBe('bounce');
  });
  it('awards an unbounced shot outside the lines to the receiver', () => {
    game.ball = { x: 965, y: 426, vx: 20, vy: 100 }; game.update(.01, still);
    expect(game.score).toEqual([0, 1]); expect(game.reason).toBe('out');
  });
  it('changes server every two points', () => {
    award(0); expect(game.server).toBe(0); award(1); expect(game.server).toBe(1);
    award(1); expect(game.server).toBe(1); award(0); expect(game.server).toBe(0);
  });
  it('requires seven points and a two-point lead', () => {
    game.score = [6, 6]; award(0); expect(game.phase).toBe('point'); expect(game.winner).toBeNull();
    award(0); expect(game.phase).toBe('over'); expect(game.winner).toBe(0); expect(game.score).toEqual([8, 6]);
  });
  it('resets every match and applies new surface/difficulty', () => {
    game.score = [7, 3]; game.bestRally = 22; game.start('clay', 'hard');
    expect(game.score).toEqual([0, 0]); expect(game.bestRally).toBe(0); expect(game.surface).toBe('clay'); expect(game.difficulty).toBe('hard');
  });
  it('keeps finite physics through a complete unattended match', () => {
    let steps = 0;
    while (game.phase !== 'over' && steps++ < 25000) { game.update(1 / 60, still); expect(Object.values(game.ball).every(Number.isFinite)).toBeTrue(); }
    expect(game.phase).toBe('over'); expect(game.winner).toBe(1); expect(Math.abs(game.score[0] - game.score[1])).toBeGreaterThanOrEqual(2);
  });
});
