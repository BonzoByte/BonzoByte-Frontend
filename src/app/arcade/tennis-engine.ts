/** Isolated arcade physics. No HTTP, archive data, accounts or timers. */
export type CourtSurface = 'grass' | 'clay' | 'hard';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Shot = 'drive' | 'lob' | 'smash';
export type Side = 0 | 1;
export interface Athlete { x: number; y: number; vy: number; swing: number; }
export interface Ball { x: number; y: number; vx: number; vy: number; }
export interface Controls { left: boolean; right: boolean; jump: boolean; shot: Shot | null; }
export const COURT = { width: 1000, height: 540, ground: 432, netX: 500, netTop: 321, left: 58, right: 942 } as const;
const other = (side: Side): Side => side === 0 ? 1 : 0;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export class TennisEngine {
  players: [Athlete, Athlete] = [{ x: 215, y: 432, vy: 0, swing: 0 }, { x: 785, y: 432, vy: 0, swing: 0 }];
  ball: Ball = { x: 250, y: 320, vx: 0, vy: 0 };
  score: [number, number] = [0, 0];
  phase: 'ready' | 'playing' | 'point' | 'over' = 'ready';
  server: Side = 0;
  winner: Side | null = null;
  pointWinner: Side | null = null;
  reason: 'bounce' | 'net' | 'out' | null = null;
  rally = 0;
  bestRally = 0;
  hits = 0;
  eventId = 0;
  event: 'hit' | 'bounce' | 'point' | 'serve' | null = null;
  surface: CourtSurface = 'grass';
  difficulty: Difficulty = 'normal';
  private lastHitter: Side = 0;
  private crossed = false;
  private bounces = 0;
  private pointDelay = 0;
  private aiDelay = 0;
  private aiTarget = 785;
  private aiMiss = false;
  private humanJumpHeld = false;
  private readonly gravity = 690;

  constructor(private readonly random: () => number = Math.random) {}

  start(surface: CourtSurface = this.surface, difficulty: Difficulty = this.difficulty): void {
    this.surface = surface; this.difficulty = difficulty;
    this.score = [0, 0]; this.winner = this.pointWinner = null; this.reason = null;
    this.rally = this.bestRally = this.hits = 0; this.server = 0; this.humanJumpHeld = false;
    this.resetPositions(); this.serve();
  }

  update(seconds: number, controls: Controls): void {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.phase === 'ready' || this.phase === 'over') return;
    // Bounded substeps make net/floor collisions independent of rendering FPS.
    let remaining = Math.min(seconds, .05);
    while (remaining > .000001) {
      const dt = Math.min(remaining, 1 / 120); remaining -= dt;
      this.step(dt, controls);
    }
  }

  canHit(side: Side): boolean {
    const p = this.players[side];
    return this.phase === 'playing' && this.lastHitter !== side && p.swing <= 0 &&
      Math.hypot(this.ball.x - p.x, this.ball.y - (p.y - 62)) < 115;
  }

  hit(side: Side, kind: Shot): boolean {
    if (!this.canHit(side)) return false;
    const p = this.players[side], b = this.ball;
    const raisedSmash = kind === 'smash' && b.y < p.y - 82;
    const direction = side === 0 ? 1 : -1;
    const drift = this.random();
    const target = side === 0 ? 690 + drift * 150 : 160 + drift * 150;
    const distance = Math.abs(target - b.x);
    const flight = kind === 'lob' ? 1.45 : raisedSmash ? .72 : 1.02;
    b.vx = direction * clamp(distance / flight, 260, raisedSmash ? 760 : 620);
    const actualFlight = Math.abs((target - b.x) / b.vx);
    b.vy = (COURT.ground - 8 - b.y - .5 * this.gravity * actualFlight ** 2) / actualFlight;
    // A low running drive still needs enough lift to clear the net.
    if (kind !== 'smash' || !raisedSmash) b.vy = Math.min(b.vy, kind === 'lob' ? -390 : -245);
    this.lastHitter = side; this.crossed = false; this.bounces = 0;
    p.swing = .3; this.rally++; this.hits++; this.bestRally = Math.max(this.rally, this.bestRally);
    this.aiMiss = false; this.emit('hit');
    return true;
  }

  private step(dt: number, input: Controls): void {
    if (this.phase === 'point') {
      this.pointDelay -= dt;
      if (this.pointDelay <= 0) { this.resetPositions(); this.serve(); }
      return;
    }
    if (this.phase !== 'playing') return;
    const human = this.players[0], cpu = this.players[1];
    human.x = clamp(human.x + (Number(input.right) - Number(input.left)) * 310 * dt, 80, 456);
    if (input.jump && !this.humanJumpHeld && human.y >= COURT.ground) human.vy = -330;
    this.humanJumpHeld = input.jump;
    for (const p of this.players) {
      p.swing = Math.max(0, p.swing - dt);
      p.vy += 1000 * dt; p.y = Math.min(COURT.ground, p.y + p.vy * dt);
      if (p.y === COURT.ground) p.vy = 0;
    }
    this.aiDelay -= dt;
    const settings = { easy: { speed: 190, delay: .25, error: 82, miss: .17 }, normal: { speed: 265, delay: .16, error: 35, miss: .06 }, hard: { speed: 325, delay: .09, error: 12, miss: .015 } }[this.difficulty];
    if (this.lastHitter === 0 && this.aiDelay <= 0) {
      const b = this.ball;
      const t = Math.max(0, (-b.vy + Math.sqrt(b.vy ** 2 + 2 * this.gravity * Math.max(0, COURT.ground - 38 - b.y))) / this.gravity);
      this.aiTarget = clamp(b.x + b.vx * t + (this.random() - .5) * settings.error, 548, 920);
      this.aiDelay = settings.delay;
    } else if (this.lastHitter === 1) this.aiTarget = 770;
    cpu.x += clamp(this.aiTarget - cpu.x, -settings.speed * dt, settings.speed * dt);
    if (input.shot) this.hit(0, input.shot);
    if (this.canHit(1) && !this.aiMiss) {
      this.aiMiss = this.random() < settings.miss;
      if (!this.aiMiss) this.hit(1, this.ball.y < cpu.y - 100 ? 'smash' : this.random() < .18 ? 'lob' : 'drive');
    }
    const b = this.ball, previousX = b.x;
    b.vy += this.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if ((previousX < 500 && b.x >= 500) || (previousX > 500 && b.x <= 500)) {
      if (b.y + 6 >= COURT.netTop) { this.award(other(this.lastHitter), 'net'); return; }
      this.crossed = true;
    }
    if (b.y >= COURT.ground - 6 && b.vy > 0) {
      const landingSide: Side = b.x < 500 ? 0 : 1;
      if (b.x < COURT.left || b.x > COURT.right) { this.award(other(this.lastHitter), 'out'); return; }
      if (landingSide === this.lastHitter || !this.crossed) { this.award(other(this.lastHitter), 'out'); return; }
      if (this.bounces > 0) { this.award(this.lastHitter, 'bounce'); return; }
      this.bounces++;
      b.y = COURT.ground - 6;
      b.vy *= -({ grass: .76, clay: .87, hard: .82 }[this.surface]);
      b.vx *= this.surface === 'clay' ? .84 : .93;
      this.emit('bounce');
    }
    if (b.x < -45 || b.x > 1045) this.award(this.bounces ? this.lastHitter : other(this.lastHitter), 'out');
  }

  private serve(): void {
    this.phase = 'playing'; this.rally = 0; this.bounces = 0; this.crossed = false;
    this.pointWinner = null; this.reason = null; this.lastHitter = this.server;
    const x = this.players[this.server].x + (this.server === 0 ? 30 : -30);
    const target = this.server === 0 ? 785 : 215;
    const time = 1.2;
    this.ball = { x, y: 310, vx: (target - x) / time, vy: (COURT.ground - 6 - 310 - .5 * this.gravity * time ** 2) / time };
    this.aiDelay = 0; this.aiMiss = false; this.emit('serve');
  }

  private resetPositions(): void {
    this.players = [{ x: 215, y: 432, vy: 0, swing: 0 }, { x: 785, y: 432, vy: 0, swing: 0 }];
  }

  private award(side: Side, reason: 'bounce' | 'net' | 'out'): void {
    if (this.phase !== 'playing') return;
    this.score[side]++; this.pointWinner = side; this.reason = reason;
    this.server = (this.score[0] + this.score[1]) % 4 < 2 ? 0 : 1;
    if (this.score[side] >= 7 && this.score[side] - this.score[other(side)] >= 2) {
      this.winner = side; this.phase = 'over';
    } else { this.phase = 'point'; this.pointDelay = 1.6; }
    this.emit('point');
  }
  private emit(event: 'hit' | 'bounce' | 'point' | 'serve'): void { this.event = event; this.eventId++; }
}
