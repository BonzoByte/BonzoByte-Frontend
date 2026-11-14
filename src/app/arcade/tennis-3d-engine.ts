import type { CourtSurface, Difficulty, Shot, Side } from './tennis-engine';
import { TennisFormat, TennisScoring } from './tennis-scoring';
export type CourtShot = Shot | 'drop';
export interface CourtControls { left: boolean; right: boolean; forward: boolean; back: boolean; jump: boolean; shot: CourtShot | null; aim?: number; aiming?: boolean; }
export interface Player3D { x: number; y: number; z: number; vy: number; swing: number; speed: number; stroke?: CourtShot | 'serve'; forehand?: boolean; }
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
  /** Arcade-only TS-scaled AI level, never a real player's TS record. */
  opponentStrength: number | null = null;
  assist = true;
  get server(): Side { return this.scoring.server; }
  set server(value: Side) { this.scoring.server = value; }
  get winner(): Side | null { return this.scoring.winner; }
  pointWinner: Side | null = null;
  reason: 'net' | 'out' | 'bounce' | 'doubleFault' | null = null;
  serveAttempt: 1 | 2 = 1;
  serveCharge = 0;
  serveAim = 0;
  strokeCharge = 0;
  strokeAim = 0;
  strokeCharging = false;
  get strokePending(): boolean { return this.pendingStroke !== null; }
  private pendingStroke: { shot: CourtShot; power: number; aim: number; remaining: number } | null = null;
  private heldStroke: CourtShot = 'drive';
  private dropShot = false;
  private humanTarget = { x: 0, z: 10.8 };
  private humanPlanning = 0;
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
  private cpuAware = false;
  private cpuVelocity = { x: 0, z: 0 };
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
  hit(side: Side, shot: CourtShot, aim = 0, power = .6): boolean {
    if (![aim, power].every(Number.isFinite)) return false;
    if (!this.canHit(side)) return false;
    const b = this.ball, p = this.players[side];
    const raised = shot === 'smash' && b.y > 1.9;
    const strength = clamp(power, 0, 1.3);
    const time = shot === 'drop' ? 1.55 - Math.min(strength, .95) * .2 : shot === 'lob' ? 1.95 - Math.min(strength, .95) * .2 : raised ? 1.05 - Math.min(strength, .95) * .24 : 1.42 - Math.min(strength, .95) * .4;
    // The green zones describe landing targets, not a guarantee that a badly timed shot clears the net.
    const targetX = Math.abs(aim) <= 1 ? aim * 3.7 : Math.sign(aim) * (FIELD.halfWidth + .16 + (Math.abs(aim) - 1) * 4);
    const targetZ = (side === 0 ? -1 : 1) * (strength > .95 ? FIELD.halfLength + .65 + (strength - .95) * 3 : shot === 'drop' ? 2.2 + strength * 2 : 7.8 + strength * 3);
    b.vx = (targetX - b.x) / time; b.vz = (targetZ - b.z) / time;
    b.vy = (.065 - b.y + .5 * FIELD.gravity * time ** 2) / time;
    this.hitter = side; this.crossed = false; this.bounces = 0; this.cpuMiss = false; this.serviceActive = false;
    this.dropShot = shot === 'drop';
    p.swing = .34; p.stroke = shot === 'smash' && !raised ? 'drive' : shot; p.forehand = (b.x - p.x) * (side === 0 ? 1 : -1) >= 0;
    if (side === 0) { this.hits++; this.awaitComputerReaction(); }
    else this.humanPlanning = 0;
    this.rally++;
    this.bestRally = Math.max(this.bestRally, this.rally); this.emit('hit'); return true;
  }
  landing(height = .065): { x: number; z: number } {
    const b = this.ball;
    const time = Math.max(0, (b.vy + Math.sqrt(Math.max(0, b.vy ** 2 + 2 * FIELD.gravity * (b.y - height)))) / FIELD.gravity);
    return { x: b.x + b.vx * time, z: b.z + b.vz * time };
  }
  /** Plan an intercept from the observed ball, including its first bounce. Called at 10 Hz, not per render. */
  private returnTarget(side: Side, speed: number): { x: number; z: number } {
    const p = this.players[side], b = { ...this.ball }, sign = side === 0 ? 1 : -1;
    const dt = 1 / 60, friction = this.surface === 'clay' ? .84 : .95;
    let bounces = this.bounces, best = { x: p.x, z: sign * 10.8 }, bestCost = Infinity;
    for (let t = dt; t <= 2.4; t += dt) {
      b.vy -= FIELD.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.y <= .065 && b.vy < 0) {
        if (bounces || Math.abs(b.x) > FIELD.halfWidth || Math.abs(b.z) > FIELD.halfLength) break;
        bounces++; b.y = .065; b.vy *= -this.bounceRestitution; b.vx *= friction * (this.dropShot ? .55 : 1); b.vz *= friction * (this.dropShot ? .55 : 1);
      }
      if (b.z * sign < 1.1 || b.z * sign > 13 || Math.abs(b.x) > 5.7 || b.y < .3 || b.y > 2.65 || (this.serviceActive && !bounces)) continue;
      const travel = Math.hypot(b.x - p.x, b.z - p.z);
      const cost = Math.max(0, travel - speed * Math.max(0, t - .08) - 1.1) * 12 + travel * .2 + Math.abs(b.y - 1.2) * .3 + t * .08;
      if (cost < bestCost) { bestCost = cost; best = { x: b.x, z: b.z }; }
    }
    return best;
  }
  private chargeStroke(dt: number, input: CourtControls): void {
    if (input.aiming && input.shot) {
      if (!this.strokeCharging) { this.strokeCharge = 0; this.strokeAim = 0; this.pendingStroke = null; }
      this.strokeCharging = true; this.heldStroke = input.shot;
      this.strokeCharge = Math.min(1.3, this.strokeCharge + dt / .9);
      this.strokeAim = clamp(this.strokeAim + (Number(input.right) - Number(input.left)) * dt * 2.1, -1.3, 1.3);
    } else if (this.strokeCharging) {
      this.strokeCharging = false;
      this.pendingStroke = { shot: this.heldStroke, power: this.strokeCharge, aim: this.strokeAim, remaining: .65 };
    }
    if (this.pendingStroke) {
      const queued = this.pendingStroke;
      if (this.hit(0, queued.shot, queued.aim, queued.power) || (queued.remaining -= dt) <= 0) this.pendingStroke = null;
    }
  }
  private player(side: Side): Player3D { return { x: 0, y: 0, z: side === 0 ? 10.8 : -10.8, vy: 0, swing: 0, speed: 0 }; }
  private get bounceRestitution(): number { return ({ grass: .68, clay: .85, hard: .8 }[this.surface]) * (this.dropShot ? .6 : 1); }
  private travel(p: Player3D, dx: number, dz: number, speed: number, dt: number, side: Side): void {
    const norm = Math.hypot(dx, dz), distance = Math.min(norm, speed * dt);
    const x = p.x, z = p.z;
    if (norm > .015) { p.x += dx / norm * distance; p.z += dz / norm * distance; }
    p.x = clamp(p.x, -5.7, 5.7); p.z = side === 0 ? clamp(p.z, 1.1, 13) : clamp(p.z, -13, -1.1);
    p.speed = Math.hypot(p.x - x, p.z - z) / dt;
  }
  private get cpuConfig() {
    if (this.opponentStrength !== null && Number.isFinite(this.opponentStrength)) {
      const t = clamp(this.opponentStrength, 0, 1);
      return { speed: 3.7 + 2.4 * t, delay: .38 - .18 * t, error: 1.2 - 1.04 * t, miss: .15 - .138 * t };
    }
    return { easy: { speed: 3.7, delay: .38, error: 1.2, miss: .15 },
      normal: { speed: 5.1, delay: .28, error: .48, miss: .055 },
      hard: { speed: 6.1, delay: .2, error: .16, miss: .012 } }[this.difficulty];
  }
  private awaitComputerReaction(): void {
    // Only the struck ball is observed. Never read a queued shot or the aim keys.
    this.cpuAware = false; this.reaction = this.cpuConfig.delay + this.random() * .04;
  }
  private moveComputer(dt: number): void {
    const p = this.players[1], dx = this.cpuTarget.x - p.x, dz = this.cpuTarget.z - p.z;
    const distance = Math.hypot(dx, dz), speed = Math.min(this.cpuConfig.speed, distance * 8);
    const vx = distance > .015 ? dx / distance * speed : 0, vz = distance > .015 ? dz / distance * speed : 0;
    const changeX = vx - this.cpuVelocity.x, changeZ = vz - this.cpuVelocity.z;
    const change = Math.hypot(changeX, changeZ), fraction = change ? Math.min(1, 16 * dt / change) : 0;
    this.cpuVelocity.x += changeX * fraction; this.cpuVelocity.z += changeZ * fraction;
    const x = p.x, z = p.z;
    p.x = clamp(p.x + this.cpuVelocity.x * dt, -5.7, 5.7); p.z = clamp(p.z + this.cpuVelocity.z * dt, -13, -1.1);
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
        const direction = Number(input.right) - Number(input.left);
        this.serveAim = clamp(this.serveAim + direction * dt * 1.8, -1.3, 1.3);
        // Require a release after a held rally stroke or a fault; never auto-submit a second serve.
        if (!input.shot && !this.serveHeld) this.serveArmed = true;
        if (input.shot && this.serveArmed) { this.serveHeld = true; this.serveCharge = Math.min(1.3, this.serveCharge + dt / 1.2); }
        else if (this.serveHeld) this.strikeServe(this.serveCharge, this.serveAim);
      }
      return;
    }
    if (this.phase !== 'playing') return;
    const human = this.players[0], cpu = this.players[1];
    const horizontal = input.aiming ? 0 : Number(input.right) - Number(input.left), depth = Number(input.back) - Number(input.forward);
    if (horizontal || depth) this.travel(human, horizontal * 100, depth * 100, 5.5, dt, 0);
    else if (this.assist && this.hitter === 1) {
      this.humanPlanning -= dt;
      if (this.humanPlanning <= 0) { this.humanTarget = this.returnTarget(0, 5.1); this.humanPlanning = .1; }
      this.travel(human, this.humanTarget.x - human.x, this.humanTarget.z - human.z, 5.1, dt, 0);
    } else human.speed = 0;
    if (input.jump && !this.jumpHeld && human.y <= 0) human.vy = 4.8;
    this.jumpHeld = input.jump;
    for (const p of this.players) { p.swing = Math.max(0, p.swing - dt); p.vy -= 14 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (!p.y) p.vy = 0; }
    const config = this.cpuConfig;
    this.reaction -= dt;
    if (this.hitter === 0 && this.reaction <= 0) {
      const target = this.returnTarget(1, config.speed);
      this.cpuTarget = { x: clamp(target.x + (this.random() - .5) * config.error, -4.6, 4.6), z: clamp(target.z, -12, -1.5) };
      this.reaction = .1; this.cpuAware = true;
    } else if (this.hitter === 1) this.cpuTarget = { x: 0, z: -10.2 };
    this.moveComputer(dt);
    this.chargeStroke(dt, input);
    // Explicit X/C/Z shortcuts retain their direct action; Space and touch Hit use hold/release.
    if (input.shot && !input.aiming) this.hit(0, input.shot, input.aim ?? horizontal);
    if (this.cpuAware && this.canHit(1) && !this.cpuMiss) {
      this.cpuMiss = this.random() < config.miss;
      if (!this.cpuMiss) {
        if (this.ball.y > 2.1 && cpu.y <= 0) cpu.vy = 4;
        this.hit(1, this.ball.y > 1.95 ? 'smash' : this.random() < .14 ? 'lob' : 'drive', (this.random() - .5) * 1.8, .35 + this.random() * .5);
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
      this.bounces++; b.y = .065; b.vy *= -this.bounceRestitution;
      const friction = (this.surface === 'clay' ? .84 : .95) * (this.dropShot ? .55 : 1); b.vx *= friction; b.vz *= friction; this.emit('bounce');
    }
    if (Math.abs(b.x) > 12 || Math.abs(b.z) > 23) {
      if (this.serviceActive && !this.bounces) this.serviceFault();
      else this.award(this.bounces ? this.hitter : opposite(this.hitter), 'out');
    }
  }
  get serviceBoxSign(): number { return (this.server === 0 ? -1 : 1) * ((this.score[0] + this.score[1]) % 2 === 0 ? 1 : -1); }
  setServeAim(value: number): void {
    if (this.phase === 'serving' && this.server === 0 && Number.isFinite(value)) this.serveAim = clamp(value, -1.3, 1.3);
  }
  /** World-space left/right, within the correct diagonal singles service box. */
  get serveTarget(): { x: number; z: number } { return this.serviceTarget(this.serveCharge, this.serveAim); }
  private serviceTarget(power: number, aim: number): { x: number; z: number } {
    const x = Math.abs(aim) <= 1 ? this.serviceBoxSign * 2.05 + aim * 1.65 :
      Math.sign(aim) === this.serviceBoxSign ? this.serviceBoxSign * (FIELD.halfWidth + .15 + (Math.abs(aim) - 1) * 3) : -this.serviceBoxSign * (.15 + (Math.abs(aim) - 1) * 3);
    return { x,
      z: (this.server === 0 ? -1 : 1) * (power > .95 ? 8.4 : 4.7 + power * .6) };
  }
  cancelServeCharge(): void {
    this.serveHeld = false; this.serveArmed = false; this.serveCharge = 0;
    this.strokeCharging = false; this.pendingStroke = null; this.strokeCharge = 0; this.strokeAim = 0;
  }
  armServe(): void { if (this.phase === 'serving' && this.server === 0) this.serveArmed = true; }
  private prepareServe(fresh: boolean): void {
    if (fresh) this.serveAttempt = 1;
    this.phase = 'serving'; this.serveCharge = 0; this.serveAim = 0; this.serveHeld = false; this.serveArmed = false; this.delay = 1.15;
    this.strokeCharging = false; this.pendingStroke = null; this.strokeCharge = 0; this.strokeAim = 0; this.humanPlanning = 0;
    this.serviceActive = true; this.netTouched = false; this.dropShot = false; this.rally = 0; this.bounces = 0; this.crossed = false;
    this.hitter = this.server; this.pointWinner = null; this.reason = null; this.cpuMiss = false; this.reaction = 0;
    this.cpuAware = false; this.cpuVelocity = { x: 0, z: 0 }; this.cpuTarget = { x: 0, z: -10.2 };
    const p = this.players[this.server], sign = this.server === 0 ? 1 : -1;
    p.x = -this.serviceBoxSign * .85; p.z = sign * 12.35;
    this.players[opposite(this.server)].x = this.serviceBoxSign * 1.6;
    this.ball = { x: p.x, y: 1.2, z: p.z, vx: 0, vy: 0, vz: 0 };
  }
  /** Power is controlled before the outcome exists. The red zone deliberately risks a long serve. */
  strikeServe(power = .5, aim = this.serveAim): boolean {
    if (this.phase !== 'serving' || !Number.isFinite(power) || !Number.isFinite(aim)) return false;
    const p = this.players[this.server], sign = this.server === 0 ? 1 : -1;
    const strength = clamp(power, 0, 1.3), time = (this.serveAttempt === 2 ? 1.04 : .98) - Math.min(.85, strength) * .22;
    this.serveAim = clamp(aim, -1.3, 1.3);
    const { x: targetX, z: targetZ } = this.serviceTarget(strength, this.serveAim);
    this.phase = 'playing'; this.serveHeld = false; this.dropShot = false; p.swing = .4; p.stroke = 'serve'; p.forehand = true;
    this.humanPlanning = 0;
    this.ball = { x: p.x, y: 2.75, z: p.z - sign * .2, vx: (targetX - p.x) / time,
      vy: (.065 - 2.75 + .5 * FIELD.gravity * time ** 2) / time, vz: (targetZ - (p.z - sign * .2)) / time };
    if (this.server === 0) this.awaitComputerReaction();
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
