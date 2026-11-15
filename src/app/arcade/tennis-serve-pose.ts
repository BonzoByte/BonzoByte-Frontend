import { SERVE_TOSS } from './tennis-3d-engine';
import type { Tennis3DEngine } from './tennis-3d-engine';

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
  legs: [.24, .24], knees: [-.36, -.36],
};
const holding: ServeAthletePose = {
  ...ready, torso: [.015, .23, -.035], head: .06,
  // The free palm agrees with the engine's idle/windup ball: (-.22, 1.3, -.2).
  arms: [[-.0171, 0, .5629], ready.arms[1]], elbows: [2.1637, 1.15],
};
const load: ServeAthletePose = {
  bounce: 0, torso: [.015, .23, -.035], head: .12,
  arms: [holding.arms[0], [1.6, -.16, -.42]], elbows: [2.1637, .85], racket: -.2,
  legs: [.3, .25], knees: [-.44, -.38],
};
const trophy: ServeAthletePose = {
  bounce: 0, torso: [.025, .2, -.035], head: .22,
  // The free arm points up at the toss; the hitting arm is already raised.
  arms: [[3.02, 0, .17], [2.35, -.15, -.4]], elbows: [.08, .7], racket: -.35,
  legs: [.32, .28], knees: [-.46, -.4],
};
const racketDrop: ServeAthletePose = {
  bounce: .045, torso: [.065, .25, -.025], head: .24,
  arms: [[3.02, 0, .17], [2.25, -.18, -.38]], elbows: [.08, 1.65], racket: -.65,
  legs: [.3, .26], knees: [-.43, -.38],
};
const contact: ServeAthletePose = {
  bounce: .413, torso: [.015, .08, 0], head: .18,
  arms: [[3.02, 0, .17], [2.8183, -.05, -.2692]], elbows: [.08, .08], racket: .08,
  legs: [-.04, .04], knees: [-.03, -.03],
};
const follow: ServeAthletePose = {
  bounce: .04, torso: [-.2, -.14, 0], head: .04,
  arms: [[1.25, 0, .3], [1.82, -.45, -.3]], elbows: [.6, .35], racket: .02,
  legs: [.28, -.06], knees: [-.44, -.18],
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
  const release = SERVE_TOSS.windup / SERVE_TOSS.contact;
  if (p < release) return mix(holding, load, p / release);
  if (p < .58) return mix(load, trophy, (p - release) / (.58 - release));
  if (p < .76) return mix(trophy, racketDrop, (p - .58) / .18);
  return mix(racketDrop, contact, (p - .76) / .24);
}

export function tennisServeFollowThroughPose(remaining: number): ServeAthletePose {
  const p = 1 - clamp(Number.isFinite(remaining) ? remaining / .4 : 0);
  return p < .52 ? mix(contact, follow, p / .52) : mix(follow, ready, (p - .52) / .48);
}

/** A read-only adapter: human, queued release and CPU all use the same physics clock. */
export class TennisServePresentation {
  preparation(game: Pick<Tennis3DEngine, 'phase' | 'serveTossActive' | 'serveTossProgress'>): number | null {
    if (game.phase !== 'serving') return null;
    return game.serveTossActive && Number.isFinite(game.serveTossProgress) ? clamp(game.serveTossProgress) : 0;
  }
}
