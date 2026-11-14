import type { CourtShot as Shot } from './tennis-3d-engine';
import { tennisServeFollowThroughPose } from './tennis-serve-pose';
type Rotation = [number, number, number];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const TENNIS_ATHLETE_JOINTS = {
  torsoHeight: .95, shoulderWidth: .265, shoulderHeight: .48, shoulderForward: -.045,
  elbowDrop: .3, handDrop: .25, gripForward: -.025, racketHeadDrop: .41
} as const;

/** Shared shoe/leg dimensions, so render-only foot planting agrees with the procedural model. */
export const TENNIS_ATHLETE_FEET = {
  hipHeight: .83, kneeDrop: .38, ankleDrop: .35, anklePitch: .12,
  soleDrop: .10, toe: -.228, heel: .098
} as const;

function soleHeight(hip: number, knee: number): number {
  const lower = hip + knee, foot = lower + TENNIS_ATHLETE_FEET.anklePitch;
  const edge = Math.sin(foot) >= 0 ? TENNIS_ATHLETE_FEET.heel : TENNIS_ATHLETE_FEET.toe;
  return TENNIS_ATHLETE_FEET.hipHeight - TENNIS_ATHLETE_FEET.kneeDrop * Math.cos(hip)
    - TENNIS_ATHLETE_FEET.ankleDrop * Math.cos(lower) - TENNIS_ATHLETE_FEET.soleDrop * Math.cos(foot) - edge * Math.sin(foot);
}
const readySole = soleHeight(.24, -.36);

/** The model faces local -Z. Positive arm/elbow X bends towards the net. */
export function tennisAthletePose(speed: number, remaining: number, time: number, stroke: Shot | 'serve' = 'drive', forehand = true) {
  remaining = Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
  if (stroke === 'serve' && remaining > 0) return tennisServeFollowThroughPose(remaining);
  const moving = clamp(Number.isFinite(speed) ? speed / 5 : 0, 0, 1);
  const phase = (Number.isFinite(time) ? time % (Math.PI * 2) : 0) * 12;
  const progress = 1 - clamp(remaining / .34, 0, 1);
  const swing = remaining > 0 ? Math.sin((.2 + progress * .8) * Math.PI) : 0;
  // Weight transfers into contact, then the shoulder carries the racquet across the front.
  const through = swing * progress * progress * (3 - 2 * progress);
  const overhead = stroke === 'smash' || stroke === 'serve' ? swing : 0;
  const slice = stroke === 'drop' ? swing : 0;
  const lob = stroke === 'lob' ? swing : 0;
  const side = forehand ? 1 : -1;
  const travel = moving * (1 - swing * .7), step = Math.sin(phase) * travel;
  const legs = [.24 - travel * .1 + step * .44, .24 - travel * .1 - step * .44];
  // Knees flex backwards; the recovery leg folds while its opposite leg supports the body.
  const knees = [-.36 + travel * .16 - Math.max(0, Math.cos(phase)) ** 2 * travel,
    -.36 + travel * .16 - Math.max(0, -Math.cos(phase)) ** 2 * travel];
  return {
    // Ground one sole instead of lifting both feet with a sinusoidal root bounce.
    bounce: readySole - Math.min(soleHeight(legs[0], knees[0]), soleHeight(legs[1], knees[1])),
    // Lean towards local -Z (the net), not backwards into the back fence.
    torso: [-.09 - moving * .045 - swing * .035, side * (swing * .38 + through * .1) + step * .025,
      step * .015 + side * swing * .02] as Rotation,
    head: -.06 - moving * .015 + overhead * .14,
    arms: [[.65 - step * .12 + swing * .2 + overhead * .3, -side * swing * .14, .28 + swing * .18],
      [.55 + swing * .7 - slice * .32 + lob * .12 + overhead * 1.18 + step * .08,
        side * (.08 - swing * .49 - through * .16), -.28 - swing * .13]] as Rotation[],
    elbows: [1.15 - swing * .38, 1.15 - swing * .28 - overhead * .45 + through * .08],
    // The wrist stays attached to the gripping hand; recovery never flips the hoop behind the back.
    racket: .65 - swing * .83 + slice * .58 - overhead * .17 + through * .13,
    legs,
    knees
  };
}

/**
 * Optional human-held stroke preview only. Accepts game.strokeCharge directly (0..1.3),
 * saturating at full charge; it never starts a swing, toss, jump or service presentation.
 */
export function tennisAthleteStrokePreparationPose(charge: number, shot: Shot, forehand = true) {
  const value = clamp(Number.isFinite(charge) ? charge : 0, 0, 1), load = value * value * (3 - 2 * value);
  const pose = tennisAthletePose(0, 0, 0), side = forehand ? 1 : -1;
  if (load === 0) return pose;
  const overhead = shot === 'smash' ? load : 0, slice = shot === 'drop' ? load : 0;
  pose.torso = [-.09 - load * .025, -side * load * .18, side * load * .012];
  pose.arms = [[.65 + load * .08, side * load * .08, .28 + load * .04],
    [.55 - load * .08 - slice * .06 + overhead * .55, side * (.08 + load * .2), -.28 - load * .06]];
  pose.elbows = [1.15 - load * .06, 1.15 + load * .1];
  pose.racket = .65 - load * .1 + slice * .22;
  // A small weight transfer, with unchanged ankle heading and flat soles.
  pose.legs = [.24 + load * .035, .24 + load * .065];
  pose.knees = [-.36 - load * .035, -.36 - load * .065];
  pose.bounce = readySole - Math.min(soleHeight(pose.legs[0], pose.knees[0]), soleHeight(pose.legs[1], pose.knees[1]));
  return pose;
}
