/** Crowd state follows game time, so a pause cannot produce a delayed umpire call. */
export class TennisAtmosphere {
  noiseRemaining = 0;
  private cooldown = 0;
  point(rally: number): void { this.noiseRemaining = rally >= 5 ? 3.2 : 1; }
  reset(): void { this.noiseRemaining = 0; this.cooldown = 0; }
  update(seconds: number, phase: string): boolean {
    const dt = Number.isFinite(seconds) ? Math.max(0, Math.min(.05, seconds)) : 0;
    this.noiseRemaining = Math.max(0, this.noiseRemaining - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if ((phase === 'serving' || phase === 'playing') && this.noiseRemaining > .25 && this.cooldown === 0) {
      this.noiseRemaining = 0; this.cooldown = 12; return true;
    }
    return false;
  }
}
