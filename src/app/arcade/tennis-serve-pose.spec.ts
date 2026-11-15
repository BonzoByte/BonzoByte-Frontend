import * as THREE from 'three';
import { CourtControls, SERVE_TOSS, Tennis3DEngine } from './tennis-3d-engine';
import { tennisAthletePose, TENNIS_ATHLETE_JOINTS as JOINTS } from './tennis-athlete-pose';
import { TennisServePresentation, tennisServePreparationPose, tennisServeFollowThroughPose, ServeAthletePose } from './tennis-serve-pose';

describe('Physics-synchronised overarm service presentation', () => {
  const idle: CourtControls = { left: false, right: false, forward: false, back: false, jump: false, shot: null };
  const held: CourtControls = { ...idle, shot: 'drive' };
  function advance(game: Tennis3DEngine, seconds: number, input = idle) {
    for (let remaining = seconds; remaining > 1e-8;) { const dt = Math.min(1 / 120, remaining); game.update(dt, input); remaining -= dt; }
  }
  function values(pose: ServeAthletePose) {
    return [pose.bounce, ...pose.torso, pose.head, ...pose.arms.flat(), ...pose.elbows, pose.racket, ...pose.legs, ...pose.knees];
  }
  function samePose(actual: ServeAthletePose, expected: ServeAthletePose) {
    values(actual).forEach((value, i) => expect(value).toBeCloseTo(values(expected)[i], 10));
  }
  function rig() {
    const root = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group(), racket = new THREE.Group();
    root.add(torso); torso.position.y = JOINTS.torsoHeight; torso.add(head); head.position.y = .975;
    const arms = [new THREE.Group(), new THREE.Group()], elbows = [new THREE.Group(), new THREE.Group()];
    const legs = [new THREE.Group(), new THREE.Group()], knees = [new THREE.Group(), new THREE.Group()];
    arms.forEach((arm, i) => {
      torso.add(arm); arm.position.set((i ? 1 : -1) * JOINTS.shoulderWidth, JOINTS.shoulderHeight, JOINTS.shoulderForward);
      arm.add(elbows[i]); elbows[i].position.y = -JOINTS.elbowDrop;
      root.add(legs[i]); legs[i].add(knees[i]);
    });
    elbows[1].add(racket); racket.position.set(0, -JOINTS.handDrop, JOINTS.gripForward);
    return { root, torso, head, arms, elbows, legs, knees, racket };
  }
  function joints(pose: ServeAthletePose, side: 0 | 1, arm: 0 | 1) {
    const result = rig(); result.root.position.y = pose.bounce; result.root.rotation.y = side ? Math.PI : 0;
    result.torso.rotation.set(...pose.torso);
    result.arms.forEach((value, i) => { value.rotation.set(...pose.arms[i]); result.elbows[i].rotation.x = pose.elbows[i]; });
    result.racket.rotation.x = pose.racket; result.root.updateMatrixWorld(true);
    return {
      hand: result.elbows[arm].localToWorld(new THREE.Vector3(0, -JOINTS.handDrop, 0)),
      head: result.head.getWorldPosition(new THREE.Vector3()),
      face: result.racket.localToWorld(new THREE.Vector3(0, -JOINTS.racketHeadDrop, 0)),
    };
  }

  it('holds the idle and windup ball at the actual release position for either server', () => {
    for (const side of [0, 1] as const) for (const progress of [0, SERVE_TOSS.windup / SERVE_TOSS.contact]) {
      const hand = joints(tennisServePreparationPose(progress), side, 0).hand, sign = side ? -1 : 1;
      expect(hand.distanceTo(new THREE.Vector3(-sign * .22, SERVE_TOSS.height, -sign * .2))).toBeLessThan(.002);
    }
  });
  it('shows a raised trophy, a bent-elbow racket drop, then full overhead extension', () => {
    const trophy = tennisServePreparationPose(.58), drop = tennisServePreparationPose(.76), extension = tennisServePreparationPose(1);
    expect(trophy.arms[0][0]).toBeGreaterThan(3);
    expect(drop.elbows[1]).toBeGreaterThan(trophy.elbows[1] + .8);
    expect(extension.elbows[1]).toBeLessThan(.1);
    expect(extension.bounce).toBeGreaterThan(drop.bounce + .3);
    for (const side of [0, 1] as const) expect(joints(trophy, side, 0).hand.y).toBeGreaterThan(joints(trophy, side, 0).head.y);
  });
  it('meets the physical toss within one centimetre at contact for both mirrored players', () => {
    const flight = SERVE_TOSS.contact - SERVE_TOSS.windup;
    const height = SERVE_TOSS.height + SERVE_TOSS.velocity * flight - .5 * 9.81 * flight ** 2;
    for (const side of [0, 1] as const) {
      const strike = joints(tennisServePreparationPose(1), side, 1);
      expect(strike.face.distanceTo(new THREE.Vector3(0, height, side ? .2 : -.2))).toBeLessThan(.01);
      expect(strike.hand.y).toBeGreaterThan(strike.head.y);
      samePose(tennisServePreparationPose(1), tennisServeFollowThroughPose(.4));
    }
  });
  it('keeps both hands overhead at contact and bends knees backwards throughout', () => {
    for (const side of [0, 1] as const) for (const arm of [0, 1] as const) {
      const strike = joints(tennisServeFollowThroughPose(.4), side, arm); expect(strike.hand.y).toBeGreaterThan(strike.head.y);
    }
    for (let step = 0; step <= 100; step++) {
      expect(tennisServePreparationPose(step / 100).knees.every(value => value <= 0)).toBeTrue();
      expect(tennisServeFollowThroughPose(step / 250).knees.every(value => value <= 0)).toBeTrue();
    }
  });
  it('lands and settles into the unchanged rally-ready pose', () => {
    expect(tennisServeFollowThroughPose(.192).bounce).toBeLessThan(.05);
    samePose(tennisServeFollowThroughPose(0), tennisAthletePose(0, 0, 0));
    samePose(tennisAthletePose(0, .4, 0, 'serve'), tennisServePreparationPose(1));
    samePose(tennisAthletePose(0, 0, 0, 'serve'), tennisAthletePose(0, 0, 0));
  });
  it('keeps every interpolation finite and continuous at each preparation boundary', () => {
    for (const value of [-100, 0, .1, .58, .76, 1, 100, NaN, Infinity, -Infinity]) {
      expect(values(tennisServePreparationPose(value)).every(Number.isFinite)).toBeTrue();
      expect(values(tennisServeFollowThroughPose(value)).every(Number.isFinite)).toBeTrue();
    }
    for (const boundary of [SERVE_TOSS.windup / SERVE_TOSS.contact, .58, .76, 1]) {
      values(tennisServePreparationPose(boundary - 1e-7)).forEach((value, i) => expect(value).toBeCloseTo(values(tennisServePreparationPose(boundary))[i], 5));
    }
  });
  it('does not animate an idle human serve from charge, repeated renders or waiting', () => {
    const game = new Tennis3DEngine(), presentation = new TennisServePresentation(); game.start(); advance(game, 2);
    game.serveCharge = 1.2;
    for (let frame = 0; frame < 200; frame++) expect(presentation.preparation(game)).toBe(0);
    expect(game.serveTossActive).toBeFalse();
  });
  it('continues the actual toss after a human release queues contact', () => {
    const game = new Tennis3DEngine(), presentation = new TennisServePresentation(); game.start(); advance(game, .02); advance(game, .6, held); advance(game, .01);
    expect(game.phase).toBe('serving'); expect(game.serveReleaseQueued).toBeTrue();
    const before = presentation.preparation(game)!;
    for (let frame = 0; frame < 100; frame++) expect(presentation.preparation(game)).toBe(before);
    advance(game, .2); expect(presentation.preparation(game)).toBe(game.serveTossProgress); expect(presentation.preparation(game)!).toBeGreaterThan(before);
    advance(game, .3); expect(game.phase).toBe('playing'); expect(presentation.preparation(game)).toBeNull();
  });
  it('uses the CPU engine toss, not an independent presentation timer', () => {
    const game = new Tennis3DEngine(() => .5), presentation = new TennisServePresentation(); game.start(); game.server = 1;
    expect(presentation.preparation(game)).toBe(0); advance(game, .5);
    const progress = game.serveTossProgress; expect(progress).toBeGreaterThan(0); expect(progress).toBeLessThan(1);
    for (let frame = 0; frame < 100; frame++) expect(presentation.preparation(game)).toBe(progress);
    advance(game, .7); expect(game.phase).toBe('playing'); expect(presentation.preparation(game)).toBeNull();
  });
  it('resets cleanly after a caught toss, a fault, or a new match', () => {
    const game = new Tennis3DEngine(), presentation = new TennisServePresentation(); game.start(); advance(game, .02); advance(game, 1.7, held);
    expect(game.serveTossActive).toBeFalse(); expect(presentation.preparation(game)).toBe(0);
    game.phase = 'fault'; expect(presentation.preparation(game)).toBeNull();
    game.start(); expect(presentation.preparation(game)).toBe(0);
    for (const progress of [NaN, Infinity, -Infinity, -2, 2]) {
      expect(presentation.preparation({ phase: 'serving', serveTossActive: true, serveTossProgress: progress })).toBe(Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0);
    }
  });
  it('never mutates physics, scoring, RNG, service attempts, queued inputs or replay data', () => {
    const random = jasmine.createSpy('random').and.returnValue(.5), game = new Tennis3DEngine(random), presentation = new TennisServePresentation();
    game.start(); advance(game, .02); advance(game, .5, held); advance(game, .01); random.calls.reset();
    const before = JSON.stringify(game);
    for (let frame = 0; frame < 300; frame++) presentation.preparation(game);
    expect(JSON.stringify(game)).toBe(before); expect(random).not.toHaveBeenCalled();
  });
});
