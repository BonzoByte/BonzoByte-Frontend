import type { CourtShot as Shot } from './tennis-3d-engine';
type Rotation = [number, number, number];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const TENNIS_ATHLETE_JOINTS = {
  torsoHeight: .95, shoulderWidth: .265, shoulderHeight: .48, shoulderForward: -.045,
  elbowDrop: .3, handDrop: .25, gripForward: -.025, racketHeadDrop: .41
} as const;

/** The model faces local -Z. Positive arm/elbow X bends towards the net. */
export function tennisAthletePose(speed: number, remaining: number, time: number, stroke: Shot | 'serve' = 'drive', forehand = true) {
  const moving = clamp(speed / 5, 0, 1), step = Math.sin(time * 12) * moving;
  const progress = 1 - clamp(remaining / (stroke === 'serve' ? .4 : .34), 0, 1);
  const swing = remaining > 0 ? Math.sin((.2 + progress * .8) * Math.PI) : 0;
  const overhead = stroke === 'smash' || stroke === 'serve' ? swing : 0;
  const slice = stroke === 'drop' ? swing : 0;
  const side = forehand ? 1 : -1;
  return {
    bounce: Math.abs(step) * .035,
    // Lean towards local -Z (the net), not backwards into the back fence.
    torso: [-.09 - moving * .04, side * swing * .38, 0] as Rotation,
    head: -.06,
    arms: [[.65 - step * .1 + overhead * .45, 0, .28],
      [.55 + swing * .65 - slice * .35 + overhead * 1.3 + step * .08, side * (.08 - swing * .55), -.28 - swing * .12]] as Rotation[],
    elbows: [1.15, 1.15 - swing * .25 - overhead * .45],
    // Upright ready racquet; the wrist opens into contact and the overhead.
    racket: .65 - swing * .9 + slice * .7 - overhead * .2,
    legs: [step * .48, -step * .48],
    knees: [Math.max(0, -step) * .6, Math.max(0, step) * .6]
  };
}
