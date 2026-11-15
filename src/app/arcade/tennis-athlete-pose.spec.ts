import { tennisAthletePose, tennisAthleteStrokePreparationPose, TENNIS_ATHLETE_JOINTS as JOINTS, TENNIS_ATHLETE_FEET as FEET } from './tennis-athlete-pose';
import * as THREE from 'three';

describe('Forward-facing tennis arms and racquet', () => {
  // The same joint offsets as the rendered athlete, without a WebGL context.
  function rig(remaining: number, side: number, stroke: 'drive' | 'lob' | 'smash' | 'serve' | 'drop' = 'drive', forehand = true, speed = 0, time = 0) {
    return poseRig(tennisAthletePose(speed, remaining, time, stroke, forehand), side);
  }
  function poseRig(pose: ReturnType<typeof tennisAthletePose>, side: number) {
    const root = new THREE.Group(), torso = new THREE.Group(), arm = new THREE.Group(), elbow = new THREE.Group(), racket = new THREE.Group();
    root.rotation.y = side ? Math.PI : 0; root.add(torso); torso.position.y = JOINTS.torsoHeight; torso.rotation.set(...pose.torso);
    torso.add(arm); arm.position.set(JOINTS.shoulderWidth, JOINTS.shoulderHeight, JOINTS.shoulderForward); arm.rotation.set(...pose.arms[1]);
    arm.add(elbow); elbow.position.y = -JOINTS.elbowDrop; elbow.rotation.x = pose.elbows[1];
    elbow.add(racket); racket.position.set(0, -JOINTS.handDrop, JOINTS.gripForward); racket.rotation.x = pose.racket;
    root.updateMatrixWorld(true);
    const rim = Array.from({ length: 24 }, (_, index) => {
      const angle = index / 24 * Math.PI * 2;
      return racket.localToWorld(new THREE.Vector3(Math.cos(angle) * .183, -JOINTS.racketHeadDrop + Math.sin(angle) * .238, 0));
    });
    return { hand: elbow.localToWorld(new THREE.Vector3(0, -JOINTS.handDrop, 0)), face: racket.localToWorld(new THREE.Vector3(0, -JOINTS.racketHeadDrop, 0)), grip: racket.localToWorld(new THREE.Vector3()), rim };
  }
  it('holds the near-side hands and racquet in front, towards the net', () => {
    const p = rig(0, 0); expect(p.hand.z).toBeLessThan(-.2); expect(p.face.z).toBeLessThan(p.hand.z);
  });
  it('mirrors the far-side stance towards the net instead of its back fence', () => {
    const p = rig(0, 1); expect(p.hand.z).toBeGreaterThan(.2); expect(p.face.z).toBeGreaterThan(p.hand.z);
  });
  it('keeps groundstroke contact in front throughout the swing', () => {
    for (const time of [.34, .26, .17, .08, .01]) {
      expect(rig(time, 0).face.z).toBeLessThan(0); expect(rig(time, 1).face.z).toBeGreaterThan(0);
    }
  });
  it('raises the hitting hand and racquet for a smash and a serve', () => {
    const ready = rig(0, 0);
    for (const stroke of ['smash', 'serve'] as const) {
      const p = rig(stroke === 'serve' ? .4 : .2, 0, stroke); expect(p.hand.y).toBeGreaterThan(ready.hand.y + .2); expect(p.face.y).toBeGreaterThan(ready.face.y + .3);
    }
  });
  it('uses different torso rotation for forehand and backhand', () => {
    expect(tennisAthletePose(0, .17, 0, 'drive', true).torso[1]).toBeGreaterThan(0);
    expect(tennisAthletePose(0, .17, 0, 'drive', false).torso[1]).toBeLessThan(0);
  });
  it('holds the racquet upright above the grip, not hanging behind the back', () => {
    for (const side of [0, 1]) {
      const p = rig(0, side);
      expect(p.face.y).toBeGreaterThan(p.hand.y + .2);
      expect(p.grip.distanceTo(p.hand)).toBeLessThan(.03);
      for (const point of p.rim) expect(point.z * (side ? 1 : -1)).toBeGreaterThan(.1);
    }
  });
  it('keeps the whole racquet head in front during forehand, backhand and overhead strokes', () => {
    for (const side of [0, 1]) for (const forehand of [true, false]) for (const stroke of ['drive', 'lob', 'smash', 'serve', 'drop'] as const) {
      for (const remaining of [.34, .28, .2, .12, .04, .001]) {
        for (const point of rig(remaining, side, stroke, forehand).rim) expect(point.z * (side ? 1 : -1)).toBeGreaterThan(0);
      }
    }
  });
  it('leans towards the net while ready and moving, not towards the back fence', () => {
    expect(tennisAthletePose(0, 0, 0).torso[0]).toBeLessThan(0);
    expect(tennisAthletePose(5, 0, 0).torso[0]).toBeLessThan(0);
  });
  it('uses a shorter, open-faced racket motion for the drop shot',()=>{
    const drive=tennisAthletePose(0,.17,0,'drive'),drop=tennisAthletePose(0,.17,0,'drop');
    expect(drop.racket).toBeGreaterThan(drive.racket);expect(drop.arms[1][0]).toBeLessThan(drive.arms[1][0]);
  });
  it('keeps the hoop ahead of the athlete during moving contact, carry-through and recovery', () => {
    for (const stroke of ['drive', 'drop', 'lob', 'smash'] as const) for (const forehand of [true, false]) {
      for (let frame = 0; frame <= 34; frame++) {
        const value = rig(.34 - frame / 100, 0, stroke, forehand, 5, frame / 60);
        expect(Math.max(...value.rim.map(point => point.z))).toBeLessThan(0);
      }
    }
  });
  it('flexes knees backwards and alternates the recovery leg, not both legs together', () => {
    const left = tennisAthletePose(5, 0, 0), right = tennisAthletePose(5, 0, Math.PI / 12);
    expect(left.knees.every(value => value < 0)).toBeTrue(); expect(right.knees.every(value => value < 0)).toBeTrue();
    expect(left.knees[0]).toBeLessThan(left.knees[1]); expect(right.knees[1]).toBeLessThan(right.knees[0]);
  });
  it('plants the lowest actual sole edge without making both feet float', () => {
    function soles(speed: number, time: number, remaining: number) {
      const value = tennisAthletePose(speed, remaining, time), root = new THREE.Group(); root.position.y = value.bounce;
      const heights: number[] = [];
      for (let i = 0; i < 2; i++) {
        const hip = new THREE.Group(), knee = new THREE.Group(), ankle = new THREE.Group();
        hip.position.y = FEET.hipHeight; hip.rotation.x = value.legs[i]; knee.position.y = -FEET.kneeDrop; knee.rotation.x = value.knees[i];
        ankle.position.y = -FEET.ankleDrop; ankle.rotation.x = FEET.anklePitch; root.add(hip); hip.add(knee); knee.add(ankle);
        root.updateMatrixWorld(true);
        for (const z of [FEET.toe, FEET.heel]) heights.push(ankle.localToWorld(new THREE.Vector3(0, -FEET.soleDrop, z)).y);
      }
      return Math.min(...heights);
    }
    const ready = soles(0, 0, 0); expect(ready).toBeGreaterThanOrEqual(0); expect(ready).toBeLessThan(.02);
    for (const speed of [0, .1, 2.5, 5, 9]) for (const remaining of [0, .34, .17, .03]) for (let frame = 0; frame < 32; frame++) {
      expect(soles(speed, frame / 32 * Math.PI / 6, remaining)).toBeCloseTo(ready, 8);
    }
  });
  it('returns smoothly to ready at the end of a groundstroke', () => {
    for (const stroke of ['drive', 'drop', 'lob', 'smash'] as const) {
      const before = tennisAthletePose(0, .0000001, 0, stroke), ready = tennisAthletePose(0, 0, 0, stroke);
      before.arms.flat().forEach((value, i) => expect(value).toBeCloseTo(ready.arms.flat()[i], 4));
      expect(before.racket).toBeCloseTo(ready.racket, 4); expect(before.torso[1]).toBeCloseTo(ready.torso[1], 4);
    }
  });
  it('keeps presentation transforms finite when render inputs are invalid or stale', () => {
    for (const value of [NaN, Infinity, -Infinity, -100, 0, 1e300]) {
      const pose = tennisAthletePose(value, value, value);
      expect([pose.bounce, ...pose.torso, pose.head, ...pose.arms.flat(), ...pose.elbows, pose.racket, ...pose.legs, ...pose.knees].every(Number.isFinite)).toBeTrue();
    }
  });
  it('starts a held-stroke preparation at ready and safely caps the visual load', () => {
    const ready = tennisAthletePose(0, 0, 0);
    for (const shot of ['drive', 'drop', 'lob', 'smash'] as const) {
      for (const value of [-1, 0, NaN, Infinity]) expect(tennisAthleteStrokePreparationPose(value, shot, true)).toEqual(ready);
      expect(tennisAthleteStrokePreparationPose(1.3, shot, true)).toEqual(tennisAthleteStrokePreparationPose(1, shot, true));
    }
    expect(tennisAthleteStrokePreparationPose(1, 'drive', true).torso[1]).toBeLessThan(0);
    expect(tennisAthleteStrokePreparationPose(1, 'drive', false).torso[1]).toBeGreaterThan(0);
  });
  it('keeps charged preparations in front without inventing an overhead strike', () => {
    for (const shot of ['drive', 'drop', 'lob', 'smash'] as const) for (const forehand of [false, true]) {
      for (const side of [0, 1]) for (let step = 0; step <= 10; step++) {
        const pose = tennisAthleteStrokePreparationPose(step / 10, shot, forehand), value = poseRig(pose, side);
        expect(value.hand.y).toBeLessThan(1.65);
        expect(value.grip.distanceTo(value.hand)).toBeLessThan(.03);
        for (const point of value.rim) expect(point.z * (side ? 1 : -1)).toBeGreaterThan(0);
        expect(Math.abs(pose.bounce)).toBeLessThan(.015);
      }
    }
  });
});
