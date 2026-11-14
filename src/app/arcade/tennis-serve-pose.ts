import type { Tennis3DEngine, Player3D } from './tennis-3d-engine';

type Rotation = [number, number, number];
export interface ServeAthletePose {
  bounce: number; torso: Rotation; head: number; arms: Rotation[];
  elbows: number[]; racket: number; legs: number[]; knees: number[];
}
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

const ready: ServeAthletePose = {
  bounce: 0, torso: [-.09, 0, 0], head: -.06,
  arms: [[.65, 0, .28], [.55, .08, -.28]], elbows: [1.15, 1.15], racket: .65,
  legs: [0, 0], knees: [0, 0],
};
const load: ServeAthletePose = {
  bounce: 0, torso: [.015, .23, -.035], head: .12,
  arms: [[1.65, 0, .2], [1.6, -.16, -.42]], elbows: [.35, .85], racket: -.2,
  legs: [0, 0], knees: [.16, .2],
};
const trophy: ServeAthletePose = {
  bounce: 0, torso: [.025, .2, -.035], head: .22,
  // The free arm points up at the toss; the hitting arm is already raised.
  arms: [[3.02, 0, .17], [2.35, -.15, -.4]], elbows: [.08, .7], racket: -.35,
  legs: [0, 0], knees: [.16, .2],
};
const contact: ServeAthletePose = {
  bounce: .34, torso: [.015, .08, 0], head: .18,
  arms: [[3.02, 0, .17], [2.85, -.05, -.16]], elbows: [.08, .08], racket: .08,
  legs: [-.04, .04], knees: [.03, .03],
};
const follow: ServeAthletePose = {
  bounce: .12, torso: [-.2, -.14, 0], head: .04,
  arms: [[1.25, 0, .3], [1.82, -.45, -.3]], elbows: [.6, .35], racket: .02,
  legs: [.1, -.1], knees: [.12, .08],
};

function mix(a: ServeAthletePose, b: ServeAthletePose, amount: number): ServeAthletePose {
  const t = smooth(amount), number = (from: number, to: number) => from + (to - from) * t;
  const vector = (from: number[], to: number[]) => from.map((value, i) => number(value, to[i]));
  return {
    bounce: number(a.bounce, b.bounce), torso: vector(a.torso, b.torso) as Rotation, head: number(a.head, b.head),
    arms: a.arms.map((arm, i) => vector(arm, b.arms[i]) as Rotation), elbows: vector(a.elbows, b.elbows),
    racket: number(a.racket, b.racket), legs: vector(a.legs, b.legs), knees: vector(a.knees, b.knees),
  };
}

/** Presentation only: these poses never change a shot, a score or a replay. */
export function tennisServePreparationPose(progress: number): ServeAthletePose {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  return p < .35 ? mix(ready, load, p / .35) : mix(load, trophy, (p - .35) / .65);
}

export function tennisServeFollowThroughPose(remaining: number): ServeAthletePose {
  const p = 1 - clamp(remaining / .4);
  return p < .52 ? mix(contact, follow, p / .52) : mix(follow, ready, (p - .52) / .48);
}

/** The ball leaves the free hand and reaches the existing 2.75 m contact point. */
export function tennisServeToss(progress: number): number {
  return smooth((progress - .24) / .76);
}

/** Independent render clock: the computer's 1.15 s preparation does not expose its intended shot. */
export class TennisServePresentation {
  private server?: Player3D;
  private previousTime?: number;
  private elapsed = 0;

  preparation(game: Pick<Tennis3DEngine, 'phase' | 'server' | 'players' | 'serveCharge'>, time: number): number | null {
    const now = Number.isFinite(time) ? time : this.previousTime ?? 0;
    const dt = this.previousTime === undefined ? 0 : clamp(now - this.previousTime, 0, .05);
    this.previousTime = now;
    if (game.phase !== 'serving') { this.server = undefined; this.elapsed = 0; return null; }
    const server = game.players[game.server];
    if (server !== this.server) { this.server = server; this.elapsed = 0; }
    else this.elapsed += dt;
    // Charging keeps existing Space timing; a release still strikes immediately.
    return game.server === 0 ? clamp(game.serveCharge / .85) : smooth((this.elapsed - .1) / .85);
  }
}
