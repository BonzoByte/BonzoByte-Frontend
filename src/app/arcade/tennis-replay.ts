import { CourtControls, Tennis3DEngine } from './tennis-3d-engine';
import { CourtSurface } from './tennis-engine';
import { arcadeRandom } from './tennis-skill';

export const ARCADE_REPLAY = { bytesPerFrame: 7, maxFrames: 90000, maxSeconds: 1200, maxCommands: 6 } as const;
export type ArcadeCommand = 1 | 2 | 3 | 4 | 5; // arm, cancel, aim left/centre/right
const shots = [null, 'drive', 'lob', 'smash', 'drop'] as const;
export function quantizedStep(seconds: number): number { return Math.round(Math.max(0, Math.min(.05, seconds)) * 1e6) / 1e6; }
export function applyArcadeCommand(game: Tennis3DEngine, command: ArcadeCommand): void {
  if (command === 1) game.armServe();
  else if (command === 2) game.cancelServeCharge();
  else game.setServeAim(command - 4);
}
export class ArcadeRecorder {
  private bytes = new Uint8Array(ARCADE_REPLAY.bytesPerFrame * ARCADE_REPLAY.maxFrames);
  private commands: ArcadeCommand[] = [];
  private frames = 0;
  private seconds = 0;
  valid = true;
  command(value: ArcadeCommand): void {
    if (this.commands.at(-1) === value) return;
    if (this.commands.length >= ARCADE_REPLAY.maxCommands) { this.valid = false; return; }
    this.commands.push(value);
  }
  capture(seconds: number, input: CourtControls): void {
    if (!this.valid) return;
    seconds = quantizedStep(seconds); this.seconds += seconds;
    if (this.frames >= ARCADE_REPLAY.maxFrames || this.seconds > ARCADE_REPLAY.maxSeconds) { this.valid = false; return; }
    const pos = this.frames++ * 7, micros = Math.round(seconds * 1e6);
    this.bytes[pos] = micros & 255; this.bytes[pos + 1] = micros >>> 8;
    this.bytes[pos + 2] = Number(input.left) | Number(input.right) << 1 | Number(input.forward) << 2 | Number(input.back) << 3 | Number(input.jump) << 4;
    const aim = input.aim === undefined ? 0 : input.aim === -1 ? 1 : input.aim === 0 ? 2 : 3;
    const shot = shots.indexOf(input.shot);
    this.bytes[pos + 3] = (shot & 3) | aim << 2 | Number(!!input.aiming) << 4 | Number(shot === 4) << 5;
    for (let i = 0; i < 3; i++) this.bytes[pos + 4 + i] = (this.commands[2 * i] ?? 0) | (this.commands[2 * i + 1] ?? 0) << 4;
    this.commands = [];
  }
  exportBytes(): Uint8Array {
    if (!this.valid || !this.frames) throw Error('Replay not available');
    return this.bytes.slice(0, this.frames * 7);
  }
}
export function replayArcade(bytes: Uint8Array, config: { seed: number; strength: number; surface: CourtSurface }) {
  if (!bytes.length || bytes.length % 7 || bytes.length > ARCADE_REPLAY.maxFrames * 7 ||
      !Number.isFinite(config.strength) || config.strength < 0 || config.strength > 1 || !['grass', 'clay', 'hard'].includes(config.surface)) throw Error('Invalid replay');
  const game = new Tennis3DEngine(arcadeRandom(config.seed), 'challenge');
  game.assist = true; game.opponentStrength = config.strength; game.start(config.surface, 'normal', 'challenge');
  let seconds = 0;
  for (let pos = 0; pos < bytes.length; pos += 7) {
    if (game.phase === 'over') throw Error('Replay continues after completion');
    const micros = bytes[pos] | bytes[pos + 1] << 8, flags = bytes[pos + 2], stroke = bytes[pos + 3];
    const shot = (stroke & 3) | ((stroke & 32) ? 4 : 0);
    if (micros > 50000 || flags > 31 || stroke > 63 || shot > 4) throw Error('Invalid replay controls');
    seconds += micros / 1e6;
    if (seconds > ARCADE_REPLAY.maxSeconds) throw Error('Replay exceeds duration');
    let ended = false;
    for (let i = 0; i < 6; i++) {
      const command = (bytes[pos + 4 + Math.floor(i / 2)] >>> ((i % 2) * 4)) & 15;
      if (!command) { ended = true; continue; }
      if (ended || command > 5) throw Error('Invalid replay command');
      applyArcadeCommand(game, command as ArcadeCommand);
    }
    const aim = (stroke >>> 2) & 3;
    game.update(micros / 1e6, { left: !!(flags & 1), right: !!(flags & 2), forward: !!(flags & 4), back: !!(flags & 8), jump: !!(flags & 16),
      shot: shots[shot], aim: aim === 0 ? undefined : aim === 1 ? -1 : aim === 2 ? 0 : 1, aiming: !!(stroke & 16) });
  }
  if (game.phase !== 'over' || game.winner === null) throw Error('Replay is incomplete');
  return { winner: game.winner, score: [...game.score], seconds, frames: bytes.length / 7, bestRally: game.bestRally };
}
