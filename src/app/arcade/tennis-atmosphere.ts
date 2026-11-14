/** Upper bounds shared with finite audio buffers; playback variation only shortens them. */
export const TENNIS_CROWD_SECONDS = { applause: 1.18, longApplause: 3.2, gasp: .7 } as const;

/** Crowd state follows game time, so a pause cannot produce a delayed umpire call. */
export class TennisAtmosphere {
  noiseRemaining = 0;
  private cooldown = 0;
  private sustainedCrowd = false;

  point(rally: number): void {
    this.sustainedCrowd = Number.isFinite(rally) && rally >= 5;
    this.noiseRemaining = this.sustainedCrowd ? TENNIS_CROWD_SECONDS.longApplause : TENNIS_CROWD_SECONDS.applause;
  }

  reset(): void { this.noiseRemaining = 0; this.cooldown = 0; this.sustainedCrowd = false; }

  update(seconds: number, phase: string): boolean {
    if (phase === 'ready' || phase === 'over' || phase === 'paused') { this.reset(); return false; }
    // A paint-only update or invalid clock step cannot age the crowd or trigger a call.
    if (!Number.isFinite(seconds) || seconds <= 0) return false;
    const dt = Math.min(.05, seconds);
    this.noiseRemaining = Math.max(0, this.noiseRemaining - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.noiseRemaining === 0) this.sustainedCrowd = false;
    if ((phase === 'serving' || phase === 'playing') && this.sustainedCrowd && this.noiseRemaining > .25 && this.cooldown === 0) {
      this.noiseRemaining = 0; this.sustainedCrowd = false; this.cooldown = 12;
      return true;
    }
    return false;
  }
}
