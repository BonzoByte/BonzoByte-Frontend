import { TennisAtmosphere, TENNIS_CROWD_SECONDS } from './tennis-atmosphere';

describe('Chair umpire crowd policy', () => {
  it('never calls during a point, fault, let or unknown phase', () => {
    for (const phase of ['point', 'fault', 'let', 'unknown']) {
      const atmosphere = new TennisAtmosphere(); atmosphere.point(7);
      expect(atmosphere.update(.02, phase)).toBeFalse();
    }
  });

  it('calls only if sustained cheering reaches an active serve or rally', () => {
    for (const phase of ['serving', 'playing']) {
      const atmosphere = new TennisAtmosphere();
      expect(atmosphere.update(.02, phase)).toBeFalse();
      atmosphere.point(7);
      expect(atmosphere.update(.02, phase)).toBeTrue();
      expect(atmosphere.noiseRemaining).toBe(0);
      expect(atmosphere.update(.02, phase)).toBeFalse();
    }
  });

  it('does not reprimand a brief normal crowd response even if play starts immediately', () => {
    const atmosphere = new TennisAtmosphere(); atmosphere.point(4);
    expect(atmosphere.noiseRemaining).toBe(TENNIS_CROWD_SECONDS.applause);
    expect(atmosphere.update(.02, 'serving')).toBeFalse();
    expect(atmosphere.update(.02, 'playing')).toBeFalse();
  });

  it('allows normal applause to finish before the next serve', () => {
    const atmosphere = new TennisAtmosphere(); atmosphere.point(1);
    for (let i = 0; i < 34; i++) atmosphere.update(.05, 'point');
    expect(atmosphere.noiseRemaining).toBe(0);
    expect(atmosphere.update(.02, 'serving')).toBeFalse();
  });

  it('ages extended applause through a normal point break before asking for quiet', () => {
    const atmosphere = new TennisAtmosphere(); atmosphere.point(5);
    expect(atmosphere.noiseRemaining).toBe(TENNIS_CROWD_SECONDS.longApplause);
    for (let i = 0; i < 33; i++) expect(atmosphere.update(.05, 'point')).toBeFalse();
    expect(atmosphere.noiseRemaining).toBeCloseTo(1.55, 6);
    expect(atmosphere.update(.02, 'serving')).toBeTrue();
  });

  it('does not call for quiet over a crowd tail that has already faded', () => {
    const atmosphere = new TennisAtmosphere(); atmosphere.point(8);
    for (let i = 0; i < 60; i++) atmosphere.update(.05, 'point');
    expect(atmosphere.noiseRemaining).toBeLessThan(.25);
    expect(atmosphere.update(.02, 'serving')).toBeFalse();
    for (let i = 0; i < 10; i++) atmosphere.update(.05, 'point');
    expect(atmosphere.noiseRemaining).toBe(0);
    expect(atmosphere.update(.02, 'playing')).toBeFalse();
  });

  it('applies a game-time cooldown rather than repeating every point', () => {
    const atmosphere = new TennisAtmosphere(); atmosphere.point(8);
    expect(atmosphere.update(.01, 'playing')).toBeTrue();
    atmosphere.point(8); expect(atmosphere.update(.01, 'playing')).toBeFalse();
    for (let i = 0; i < 250; i++) atmosphere.update(.05, 'point');
    atmosphere.point(8); expect(atmosphere.update(.01, 'playing')).toBeTrue();
  });

  it('does not age crowd or trigger a call for paint-only, negative or invalid time steps', () => {
    const atmosphere = new TennisAtmosphere(); atmosphere.point(8);
    for (const elapsed of [0, -1, NaN, Infinity, -Infinity]) {
      expect(atmosphere.update(elapsed, 'serving')).toBeFalse();
      expect(atmosphere.noiseRemaining).toBe(TENNIS_CROWD_SECONDS.longApplause);
    }
    expect(atmosphere.update(.02, 'serving')).toBeTrue();
  });

  it('clamps large elapsed steps to the same fifty milliseconds as the game', () => {
    const atmosphere = new TennisAtmosphere(); atmosphere.point(8);
    expect(atmosphere.update(120, 'point')).toBeFalse();
    expect(atmosphere.noiseRemaining).toBeCloseTo(TENNIS_CROWD_SECONDS.longApplause - .05, 6);
  });

  it('clears residual crowd at ready, over or paused, even on a zero-time update', () => {
    for (const phase of ['ready', 'over', 'paused']) {
      const atmosphere = new TennisAtmosphere(); atmosphere.point(8);
      expect(atmosphere.update(0, phase)).toBeFalse();
      expect(atmosphere.noiseRemaining).toBe(0);
      expect(atmosphere.update(.01, 'serving')).toBeFalse();
    }
  });

  it('replaces previous crowd state rather than accumulating applause between points', () => {
    const atmosphere = new TennisAtmosphere(); atmosphere.point(8); atmosphere.point(1);
    expect(atmosphere.noiseRemaining).toBe(TENNIS_CROWD_SECONDS.applause);
    expect(atmosphere.update(.02, 'serving')).toBeFalse();
  });

  it('normalizes malformed rally counts to a restrained response', () => {
    for (const rally of [NaN, Infinity, -Infinity, -4]) {
      const atmosphere = new TennisAtmosphere(); atmosphere.point(rally);
      expect(Number.isFinite(atmosphere.noiseRemaining)).toBeTrue();
      expect(atmosphere.noiseRemaining).toBe(TENNIS_CROWD_SECONDS.applause);
      expect(atmosphere.update(.02, 'playing')).toBeFalse();
    }
  });

  it('resets crowd and cooldown for a new match or component pause', () => {
    const atmosphere = new TennisAtmosphere(); atmosphere.point(8);
    expect(atmosphere.update(.01, 'playing')).toBeTrue();
    atmosphere.point(8); atmosphere.reset();
    expect(atmosphere.noiseRemaining).toBe(0);
    expect(atmosphere.update(.01, 'playing')).toBeFalse();
    atmosphere.point(8); expect(atmosphere.update(.01, 'playing')).toBeTrue();
  });
});
