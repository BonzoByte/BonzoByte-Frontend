import type { CourtSurface, Difficulty, Shot, Side } from './tennis-engine';
import { TennisFormat, TennisScoring } from './tennis-scoring';
export interface CourtControls { left: boolean; right: boolean; forward: boolean; back: boolean; jump: boolean; shot: Shot | null; }
export interface Player3D { x: number; y: number; z: number; vy: number; swing: number; speed: number; }
export interface Ball3D { x: number; y: number; z: number; vx: number; vy: number; vz: number; }
export const FIELD = { halfWidth: 4.115, halfLength: 11.885, serviceLine: 6.4, netHeight: .965, gravity: 9.81 } as const;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const opposite = (side: Side): Side => side === 0 ? 1 : 0;

/** All three spatial dimensions participate in movement, strokes and faults. */
export class Tennis3DEngine {
  players: [Player3D, Player3D] = [this.player(0), this.player(1)];
  ball: Ball3D = { x: .3, y: 2.2, z: 10.2, vx: 0, vy: 0, vz: 0 };
  scoring = new TennisScoring();
  get score(): [number, number] { return this.scoring.points; }
  set score(value: [number, number]) { this.scoring.points = value; }
  phase: 'ready' | 'serving' | 'fault' | 'let' | 'playing' | 'point' | 'over' = 'ready';
  surface: CourtSurface = 'grass';
  difficulty: Difficulty = 'normal';
  assist = true;
  get server(): Side { return this.scoring.server; }
  set server(value: Side) { this.scoring.server = value; }
  get winner(): Side | null { return this.scoring.winner; }
  pointWinner: Side | null = null;
  reason: 'net' | 'out' | 'bounce' | 'doubleFault' | null = null;
  serveAttempt: 1 | 2 = 1;
  serveCharge = 0;
  private serveHeld = false;
  private serveArmed = false;
  private serviceActive = false;
  private netTouched = false;
  rally = 0; bestRally = 0; hits = 0;
  eventId = 0; event: 'hit' | 'bounce' | 'point' | 'serve' | 'fault' | 'let' | null = null;
  private hitter: Side = 0;
  private crossed = false;
  private bounces = 0;
  private delay = 0;
  private reaction = 0;
  private cpuTarget = { x: 0, z: -10.8 };
  private cpuMiss = false;
  private jumpHeld = false;
  constructor(private readonly random: () => number = Math.random, format: TennisFormat = 'challenge') { this.scoring = new TennisScoring(format); }

  start(surface: CourtSurface = this.surface, difficulty: Difficulty = this.difficulty, format: TennisFormat = this.scoring.format): void {
    this.surface = surface; this.difficulty = difficulty;
    this.scoring = new TennisScoring(format); this.pointWinner = null; this.reason = null;
    this.event = null; this.eventId++;
    this.rally = this.bestRally = this.hits = 0; this.server = 0; this.jumpHeld = false;
    this.players = [this.player(0), this.player(1)]; this.prepareServe(true);
  }
  update(seconds: number, input: CourtControls): void {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.phase === 'ready' || this.phase === 'over') return;
    let remaining = Math.min(.05, seconds);
    while (remaining > .000001) { const dt = Math.min(remaining, 1 / 120); remaining -= dt; this.step(dt, input); }
  }
  canHit(side: Side): boolean {
    const p = this.players[side], b = this.ball;
    return this.phase === 'playing' && (!this.serviceActive || this.bounces > 0) && this.hitter !== side && p.swing <= 0 &&
      b.z * (side === 0 ? 1 : -1) >= -.2 && Math.hypot(p.x - b.x, p.z - b.z) < 1.85 && b.y >= .16 && b.y < 2.8 + p.y;
  }
  hit(side: Side, shot: Shot, aim = 0): boolean {
    if (!this.canHit(side)) return false;
    const b = this.ball, p = this.players[side];
    const raised = shot === 'smash' && b.y > 1.9;
    const time = shot === 'lob' ? 1.8 : raised ? .83 : 1.12;
    const targetX = clamp(aim ? aim * 2.9 + (this.random() - .5) * .35 : (this.random() - .5) * 6.1, -3.5, 3.5);
    const targetZ = (side === 0 ? -1 : 1) * (8.6 + this.random() * 2.1);
    b.vx = (targetX - b.x) / time; b.vz = (targetZ - b.z) / time;
    b.vy = (.065 - b.y + .5 * FIELD.gravity * time ** 2) / time;
    this.hitter = side; this.crossed = false; this.bounces = 0; this.cpuMiss = false; this.serviceActive = false;
    p.swing = .34; this.rally++; if (side === 0) this.hits++;
    this.bestRally = Math.max(this.bestRally, this.rally); this.emit('hit'); return true;
  }
  landing(height = .065): { x: number; z: number } {
    const b = this.ball;
    const time = Math.max(0, (b.vy + Math.sqrt(Math.max(0, b.vy ** 2 + 2 * FIELD.gravity * (b.y - height)))) / FIELD.gravity);
    return { x: b.x + b.vx * time, z: b.z + b.vz * time };
  }
  private player(side: Side): Player3D { return { x: 0, y: 0, z: side === 0 ? 10.8 : -10.8, vy: 0, swing: 0, speed: 0 }; }
  private travel(p: Player3D, dx: number, dz: number, speed: number, dt: number, side: Side): void {
    const norm = Math.hypot(dx, dz), distance = Math.min(norm, speed * dt);
    const x = p.x, z = p.z;
    if (norm > .015) { p.x += dx / norm * distance; p.z += dz / norm * distance; }
    p.x = clamp(p.x, -5.7, 5.7); p.z = side === 0 ? clamp(p.z, 1.1, 13) : clamp(p.z, -13, -1.1);
    p.speed = Math.hypot(p.x - x, p.z - z) / dt;
  }
  private step(dt: number, input: CourtControls): void {
    if (this.phase === 'point' || this.phase === 'fault' || this.phase === 'let') {
      this.delay -= dt;
      if (this.delay <= 0) { const fresh = this.phase === 'point'; this.players = [this.player(0), this.player(1)]; this.prepareServe(fresh); }
      return;
    }
    if (this.phase === 'serving') {
      if (this.server === 1) {
        this.delay -= dt;
        if (this.delay <= 0) this.strikeServe(this.random() < (this.serveAttempt === 1 ? .12 : .025) ? 1.1 : .5, (this.random() - .5) * 1.2);
      } else {
        // Require a release after a held rally stroke or a fault; never auto-submit a second serve.
        if (!input.shot && !this.serveHeld) this.serveArmed = true;
        if (input.shot && this.serveArmed) { this.serveHeld = true; this.serveCharge = Math.min(1.3, this.serveCharge + dt / 1.2); }
        else if (this.serveHeld) this.strikeServe(this.serveCharge, Number(input.right) - Number(input.left));
      }
      return;
    }
    if (this.phase !== 'playing') return;
    const human = this.players[0], cpu = this.players[1];
    const horizontal = Number(input.right) - Number(input.left), depth = Number(input.back) - Number(input.forward);
    if (horizontal || depth) this.travel(human, horizontal * 100, depth * 100, 5.5, dt, 0);
    else if (this.assist && this.hitter === 1) {
      const target = this.landing(1.05);
      this.travel(human, clamp(target.x, -4.5, 4.5) - human.x, clamp(target.z, 1.5, 12) - human.z, 5.1, dt, 0);
    } else human.speed = 0;
    if (input.jump && !this.jumpHeld && human.y <= 0) human.vy = 4.8;
    this.jumpHeld = input.jump;
    for (const p of this.players) { p.swing = Math.max(0, p.swing - dt); p.vy -= 14 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (!p.y) p.vy = 0; }
    const config = { easy: { speed: 3.7, delay: .28, error: 1.2, miss: .15 }, normal: { speed: 5.1, delay: .17, error: .48, miss: .055 }, hard: { speed: 6.1, delay: .08, error: .16, miss: .012 } }[this.difficulty];
    this.reaction -= dt;
    if (this.hitter === 0 && this.reaction <= 0) {
      const target = this.landing(1.05);
      this.cpuTarget = { x: clamp(target.x + (this.random() - .5) * config.error, -4.6, 4.6), z: clamp(target.z, -12, -1.5) };
      this.reaction = config.delay;
    } else if (this.hitter === 1) this.cpuTarget = { x: 0, z: -10.2 };
    this.travel(cpu, this.cpuTarget.x - cpu.x, this.cpuTarget.z - cpu.z, config.speed, dt, 1);
    if (input.shot) this.hit(0, input.shot, horizontal);
    if (this.canHit(1) && !this.cpuMiss) {
      this.cpuMiss = this.random() < config.miss;
      if (!this.cpuMiss) {
        if (this.ball.y > 2.1 && cpu.y <= 0) cpu.vy = 4;
        this.hit(1, this.ball.y > 1.95 ? 'smash' : this.random() < .14 ? 'lob' : 'drive');
      }
    }
    const b = this.ball, beforeZ = b.z;
    b.vy -= FIELD.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (beforeZ * b.z < 0) {
      if (b.y < FIELD.netHeight + .065) {
        if (this.serviceActive && b.y >= FIELD.netHeight - .025) { this.netTouched = true; b.vz *= .94; }
        else { if (this.serviceActive) this.serviceFault(); else this.award(opposite(this.hitter), 'net'); return; }
      }
      this.crossed = true;
    }
    if (b.y <= .065 && b.vy < 0) {
      if (this.bounces > 0) { this.award(this.hitter, 'bounce'); return; }
      const side: Side = b.z >= 0 ? 0 : 1;
      if (this.serviceActive && (!this.crossed || side === this.server || Math.abs(b.z) > FIELD.serviceLine || Math.abs(b.x) > FIELD.halfWidth || b.x * this.serviceBoxSign <= 0)) {
        this.serviceFault(); return;
      }
      if (this.serviceActive && this.netTouched) { this.phase = 'let'; this.delay = 1.05; this.emit('let'); return; }
      if (Math.abs(b.x) > FIELD.halfWidth || Math.abs(b.z) > FIELD.halfLength || !this.crossed || side === this.hitter) {
        this.award(opposite(this.hitter), 'out'); return;
      }
      this.bounces++; b.y = .065; b.vy *= -({ grass: .68, clay: .85, hard: .8 }[this.surface]);
      const friction = this.surface === 'clay' ? .84 : .95; b.vx *= friction; b.vz *= friction; this.emit('bounce');
    }
    if (Math.abs(b.x) > 12 || Math.abs(b.z) > 23) {
      if (this.serviceActive && !this.bounces) this.serviceFault();
      else this.award(this.bounces ? this.hitter : opposite(this.hitter), 'out');
    }
  }
  get serviceBoxSign(): number { return (this.server === 0 ? -1 : 1) * ((this.score[0] + this.score[1]) % 2 === 0 ? 1 : -1); }
  cancelServeCharge(): void { this.serveHeld = false; this.serveArmed = false; this.serveCharge = 0; }
  armServe(): void { if (this.phase === 'serving' && this.server === 0) this.serveArmed = true; }
  private prepareServe(fresh: boolean): void {
    if (fresh) this.serveAttempt = 1;
    this.phase = 'serving'; this.serveCharge = 0; this.serveHeld = false; this.serveArmed = false; this.delay = 1.15;
    this.serviceActive = true; this.netTouched = false; this.rally = 0; this.bounces = 0; this.crossed = false;
    this.hitter = this.server; this.pointWinner = null; this.reason = null; this.cpuMiss = false; this.reaction = 0;
    const p = this.players[this.server], sign = this.server === 0 ? 1 : -1;
    p.x = -this.serviceBoxSign * .85; p.z = sign * 12.35;
    this.players[opposite(this.server)].x = this.serviceBoxSign * 1.6;
    this.ball = { x: p.x, y: 1.2, z: p.z, vx: 0, vy: 0, vz: 0 };
  }
  /** Power is controlled before the outcome exists. The red zone deliberately risks a long serve. */
  strikeServe(power = .5, aim = 0): boolean {
    if (this.phase !== 'serving' || !Number.isFinite(power) || !Number.isFinite(aim)) return false;
    const p = this.players[this.server], sign = this.server === 0 ? 1 : -1;
    const strength = clamp(power, 0, 1.3), time = (this.serveAttempt === 2 ? 1.04 : .98) - Math.min(.85, strength) * .22;
    const targetX = this.serviceBoxSign * (2.05 + clamp(aim, -1, 1) * 1.35);
    const targetZ = -sign * (strength > .95 ? 8.4 : 4.7 + strength * .6);
    this.phase = 'playing'; this.serveHeld = false; p.swing = .4;
    this.ball = { x: p.x, y: 2.75, z: p.z - sign * .2, vx: (targetX - p.x) / time,
      vy: (.065 - 2.75 + .5 * FIELD.gravity * time ** 2) / time, vz: (targetZ - (p.z - sign * .2)) / time };
    this.emit('serve');
    return true;
  }
  private serviceFault(): void {
    if (this.serveAttempt === 2) { this.award(opposite(this.server), 'doubleFault'); return; }
    this.serveAttempt = 2; this.phase = 'fault'; this.delay = 1.15; this.players.forEach(p => p.speed = 0); this.emit('fault');
  }
  private award(side: Side, reason: 'net' | 'out' | 'bounce' | 'doubleFault'): void {
    if (this.phase !== 'playing') return;
    this.scoring.award(side); this.pointWinner = side; this.reason = reason; this.players.forEach(p => p.speed = 0);
    if (this.winner !== null) this.phase = 'over';
    else { this.phase = 'point'; this.delay = this.scoring.lastAward === 'set' ? 3 : this.scoring.lastAward === 'game' ? 2.3 : 1.65; }
    this.emit('point');
  }
  private emit(event: 'hit' | 'bounce' | 'point' | 'serve' | 'fault' | 'let'): void { this.event = event; this.eventId++; }
}
