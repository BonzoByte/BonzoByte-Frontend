import type { Shot } from './tennis-engine';

/** Keyboard hold only; power, aim and release buffering live in the replayed engine. */
export class TennisSpaceStroke {
  private held = false;
  get intent(): Shot | null { return this.held ? 'drive' : null; }
  press(now: number): void { if (Number.isFinite(now)) this.held = true; }
  release(): void { this.held = false; }
  read(): { shot: Shot | null; aiming: boolean } { return { shot: this.intent, aiming: this.held }; }
  clear(): void { this.held = false; }
}
