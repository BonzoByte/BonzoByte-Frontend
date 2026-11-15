import { CourtControls, Tennis3DEngine } from './tennis-3d-engine';
import type { CourtSurface } from './tennis-engine';
import { ArcadeRecorder, applyArcadeCommand, quantizedStep } from './tennis-replay';
import { arcadeRandom } from './tennis-skill';

const idle: CourtControls = {
  left: false, right: false, forward: false, back: false, jump: false, shot: null,
};

/** Small source-level checks: no Angular fixture, WebGL context or match sweeps. */
describe('Tennis realism regression sidecar', () => {
  for (const surface of ['grass', 'clay', 'hard'] as const) {
    for (const attempt of [1, 2] as const) {
      it(`allows an assisted return of a wide ${surface} serve, attempt ${attempt}`, () => {
        const game = new Tennis3DEngine(() => .5);
        game.start(surface);
        // Arrange the two legal CPU service parities without playing a whole match.
        // This fixture-only access does not bypass canHit(), hit() or ball motion.
        game.score = [attempt, 0];
        game.server = 1;
        (game as unknown as { prepareServe(fresh: boolean): void }).prepareServe(true);
        game.serveAttempt = attempt;
        const scoreBefore = [...game.score];
        const aim = game.serviceBoxSign * .6; // The CPU's existing outer aim limit.
        expect(game.strikeServe(.5, aim)).toBeTrue();
        expect(game.canHit(0)).toBeFalse();

        let sawBounce = false;
        let prematureContact = false;
        // At most two simulated seconds for this one fixed trajectory.
        for (let tick = 0; tick < 240 && game.phase === 'playing'; tick++) {
          if (game.event === 'bounce') sawBounce = true;
          if (game.canHit(0)) {
            prematureContact = !sawBounce;
            break;
          }
          game.update(1 / 120, idle);
        }

        expect(prematureContact).toBeFalse();
        expect(sawBounce).toBeTrue();
        expect(game.score).toEqual(scoreBefore);
        expect(game.canHit(0)).toBeTrue();
        expect(game.hit(0, 'drive', 0, .4)).toBeTrue();
        expect(game.hits).toBe(1);
        expect(Object.values(game.ball).every(Number.isFinite)).toBeTrue();
      });
    }
  }

  it('buffers an ordinary charged return of the wide grass serve without a direct-hit shortcut', () => {
    const game = new Tennis3DEngine(() => .5);
    game.start('grass');
    game.score = [1, 0];
    game.server = 1;
    (game as unknown as { prepareServe(fresh: boolean): void }).prepareServe(true);
    game.strikeServe(.5, game.serviceBoxSign * .6);
    for (let tick = 0; tick < 240 && game.phase === 'playing' && !game.hits; tick++) {
      // Charge for .6 s after launch, then let the existing .65 s buffer meet the ball.
      game.update(1 / 120, tick < 72 ? { ...idle, shot: 'drive', aiming: true } : idle);
    }
    expect(game.hits).toBe(1);
    expect(game.score).toEqual([1, 0]);
    expect(game.strokeCharging).toBeFalse();
    expect(game.strokePending).toBeFalse();
    expect(game.players[0].stroke).toBe('drive');
  });

  it('does not let repeated presentation queries consume RNG or change recorded play', () => {
    const observedRandom = jasmine.createSpy('observed RNG').and.callFake(arcadeRandom(417));
    const controlRandom = jasmine.createSpy('control RNG').and.callFake(arcadeRandom(417));
    const observed = new Tennis3DEngine(observedRandom);
    const control = new Tennis3DEngine(controlRandom);
    const observedRecorder = new ArcadeRecorder();
    const controlRecorder = new ArcadeRecorder();
    const surface: CourtSurface = 'clay';
    for (const game of [observed, control]) {
      game.opponentStrength = .63;
      game.start(surface, 'normal', 'challenge');
      applyArcadeCommand(game, 1);
    }
    observedRecorder.command(1);
    controlRecorder.command(1);

    let queriesChangedState = false;
    // Preserve the exact frame partition; equivalence across frame rates is NOT promised.
    for (let frame = 0; frame < 120; frame++) {
      const input: CourtControls = {
        ...idle, shot: frame < 30 ? 'drive' : null, aiming: frame < 30,
      };
      const dt = quantizedStep([1 / 60, 1 / 120, 1 / 30][frame % 3]);
      const before = JSON.stringify(observed);
      for (let read = 0; read < 3; read++) {
        const landing = observed.landing();
        const target = observed.serveTarget;
        observed.canHit(0);
        observed.canHit(1);
        // Returned marker coordinates must not alias mutable engine coordinates.
        landing.x = target.x = 999;
        landing.z = target.z = 999;
      }
      queriesChangedState ||= JSON.stringify(observed) !== before;
      observedRecorder.capture(dt, input);
      controlRecorder.capture(dt, input);
      observed.update(dt, input);
      control.update(dt, input);
    }

    expect(queriesChangedState).toBeFalse();
    expect(observedRandom.calls.count()).toBe(controlRandom.calls.count());
    expect(JSON.stringify(observed)).toBe(JSON.stringify(control));
    expect(Array.from(observedRecorder.exportBytes())).toEqual(Array.from(controlRecorder.exportBytes()));
  });

  it('keeps the seven-byte frame contract with all movement flags and six commands', () => {
    const recorder = new ArcadeRecorder();
    for (const command of [1, 2, 3, 4, 5, 1] as const) recorder.command(command);
    const input: CourtControls = Object.freeze({
      left: true, right: true, forward: true, back: true, jump: true,
      shot: 'drop', aim: -1, aiming: true,
    });
    recorder.capture(quantizedStep(.5), input);
    expect(Array.from(recorder.exportBytes())).toEqual([80, 195, 31, 52, 33, 67, 21]);
    // Commands belong only to the next captured frame, not later repaints/frames.
    recorder.capture(0, idle);
    expect(Array.from(recorder.exportBytes()).slice(7)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(recorder.valid).toBeTrue();
  });

  it('uses the recorded cancellation to prevent a pending return firing after an interruption', () => {
    const game = new Tennis3DEngine(() => .5);
    game.start();
    game.strikeServe(.5);
    // The ball is still on the server's side, so this release must remain queued.
    for (let tick = 0; tick < 12; tick++) {
      game.update(1 / 120, { ...idle, shot: 'drop', aiming: true });
    }
    game.update(1 / 120, idle);
    expect(game.strokePending).toBeTrue();
    expect(game.hits).toBe(0);
    applyArcadeCommand(game, 2);
    expect(game.strokePending).toBeFalse();
    expect(game.strokeCharging).toBeFalse();
    expect(game.strokeCharge).toBe(0);

    // A reachable incoming ball arriving after resume must not resurrect the release.
    Object.assign(game, { hitter: 1, crossed: true, bounces: 1, serviceActive: false });
    game.players[0].swing = 0;
    game.ball = {
      x: game.players[0].x, y: 1.2, z: game.players[0].z,
      vx: 0, vy: 0, vz: 0,
    };
    expect(game.canHit(0)).toBeTrue();
    game.update(1 / 120, idle);
    expect(game.hits).toBe(0);
  });
});
