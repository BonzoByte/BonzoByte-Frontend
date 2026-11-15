import { CourtControls, FIELD, SERVE_TOSS, Tennis3DEngine } from './tennis-3d-engine';
import { ArcadeCommand, ArcadeRecorder, applyArcadeCommand, replayArcade } from './tennis-replay';

const flightIdle: CourtControls = { left: false, right: false, forward: false, back: false, jump: false, shot: null };
const flightHold: CourtControls = { ...flightIdle, shot: 'drive', aiming: true };
const flightStep = 1 / 120;

describe('Deterministic service flight and service rules', () => {
  function createGame(): Tennis3DEngine {
    const game = new Tennis3DEngine(() => .5);
    game.start('hard', 'hard');
    game.assist = false;
    return game;
  }

  function advance(game: Tennis3DEngine, seconds: number, input = flightIdle): void {
    for (let tick = 0; tick < Math.round(seconds / flightStep); tick++) game.update(flightStep, input);
  }

  function until(game: Tennis3DEngine, done: () => boolean, seconds: number, context: string, input = flightIdle): void {
    for (let tick = 0; tick < Math.ceil(seconds / flightStep) && !done(); tick++) game.update(flightStep, input);
    expect(done()).withContext(context).toBeTrue();
  }

  function firstFault(game: Tennis3DEngine): void {
    expect(game.strikeServe(.5, 0, 1.2)).toBeTrue();
    until(game, () => game.phase !== 'playing', 1.3, 'deep red target must produce a service fault');
    expect(game.phase).toBe('fault');
    expect(game.serveAttempt).toBe(2);
  }

  function secondServe(game: Tennis3DEngine): void {
    firstFault(game);
    until(game, () => game.phase === 'serving', 1.5, 'second service must become available');
  }

  // Exact boundary fixtures replace only the public ball (and, below, score).
  // Crossed/net-touch/service flags and scoring methods are never injected.
  function crossNetCord(game: Tennis3DEngine, from: 1 | -1 = 1): void {
    game.ball = { x: game.serviceBoxSign, y: FIELD.netHeight + .03, z: from * .01, vx: 0, vy: 0, vz: -from * 8 };
    game.update(flightStep, flightIdle);
    expect(game.phase).withContext('a top-net crossing must not immediately end play').toBe('playing');
  }

  function landAt(game: Tennis3DEngine, x: number, z: number): void {
    game.ball = { x, y: .07, z, vx: 0, vy: -2, vz: 0 };
    game.update(flightStep, flightIdle);
  }

  it('retains a stationary ball indefinitely until the human actually holds Hit', () => {
    const game = createGame(), ball = { ...game.ball }, eventId = game.eventId;
    advance(game, 3);
    expect(game.phase).toBe('serving');
    expect(game.ball).toEqual(ball);
    expect(game.serveTossActive).toBeFalse();
    expect(game.serveTossProgress).toBe(0);
    expect(game.serveReleaseQueued).toBeFalse();
    expect(game.eventId).toBe(eventId);
    expect(game.score).toEqual([0, 0]);
  });

  it('deepens with Up and shortens with Down without moving the server or changing width', () => {
    const game = createGame(), player = { ...game.players[0] }, target = game.serveTarget;
    advance(game, .3, { ...flightIdle, forward: true });
    expect(game.serveDepth).toBeGreaterThan(0);
    expect(Math.abs(game.serveTarget.z)).toBeGreaterThan(Math.abs(target.z));
    expect(game.serveTarget.x).toBe(target.x);
    advance(game, .6, { ...flightIdle, back: true });
    expect(game.serveDepth).toBeLessThan(0);
    expect(Math.abs(game.serveTarget.z)).toBeLessThan(Math.abs(target.z));
    expect(game.players[0]).toEqual(player);
    expect(game.serveTossActive).toBeFalse();
    const depth = game.serveDepth;
    advance(game, .1);
    expect(game.serveDepth).toBe(depth);
  });

  it('clamps finite depth and ignores invalid, non-serving and computer-turn changes', () => {
    const game = createGame();
    game.setServeDepth(99); expect(game.serveDepth).toBe(1.3);
    game.setServeDepth(-99); expect(game.serveDepth).toBe(-1.3);
    for (const value of [NaN, Infinity, -Infinity]) game.setServeDepth(value);
    expect(game.serveDepth).toBe(-1.3);
    game.setServeDepth(.4);
    expect(game.strikeServe(.5)).toBeTrue();
    game.setServeDepth(-1); expect(game.serveDepth).toBe(.4);
    game.start(); game.server = 1;
    game.setServeDepth(1); expect(game.serveDepth).toBe(0);
  });

  it('has independent width and depth targets in both diagonal boxes', () => {
    for (const parity of [0, 1]) {
      const game = createGame();
      game.score = [parity, 0];
      game.setServeAim(.35);
      const targets = [-1, 0, 1].map(depth => { game.setServeDepth(depth); return game.serveTarget; });
      expect(Math.abs(targets[0].z)).toBeLessThan(Math.abs(targets[1].z));
      expect(Math.abs(targets[1].z)).toBeLessThan(Math.abs(targets[2].z));
      for (const target of targets) {
        expect(target.x).toBeCloseTo(targets[0].x, 10);
        expect(target.x * game.serviceBoxSign).toBeGreaterThan(0);
        expect(Math.abs(target.x)).toBeLessThan(FIELD.halfWidth);
        expect(target.z).toBeLessThan(0);
        expect(Math.abs(target.z)).toBeLessThan(FIELD.serviceLine);
      }
      const depth = game.serveTarget.z;
      game.setServeAim(-.7); const left = game.serveTarget;
      game.setServeAim(.7); const right = game.serveTarget;
      expect(left.x).toBeLessThan(right.x);
      expect(left.z).toBe(depth); expect(right.z).toBe(depth);
    }
  });

  it('launches immediate deterministic serves at the selected depth without promising net clearance', () => {
    for (const parity of [0, 1]) for (const depth of [-1, 0, 1, 1.2]) {
      const game = createGame(); game.score = [parity, 0];
      expect(game.strikeServe(.5, .35, depth)).toBeTrue();
      const landing = game.landing();
      const reference = createGame(); reference.score = [parity, 0];
      reference.strikeServe(.5, .35, 0);
      expect(landing.x).toBeCloseTo(reference.landing().x, 8);
      if (depth < 0) expect(Math.abs(landing.z)).toBeLessThan(Math.abs(reference.landing().z));
      if (depth > 0) expect(Math.abs(landing.z)).toBeGreaterThan(Math.abs(reference.landing().z));
      if (depth > 1) expect(Math.abs(landing.z)).toBeGreaterThan(FIELD.serviceLine);
      expect(game.phase).toBe('playing');
      expect(game.event).toBe('serve');
      expect(game.serveTossActive).toBeFalse();
      expect(Object.values(game.ball).every(Number.isFinite)).toBeTrue();
    }
    const implicit = createGame(), explicit = createGame();
    implicit.setServeDepth(.7); implicit.strikeServe(.6, -.4);
    explicit.strikeServe(.6, -.4, .7);
    expect(implicit.ball).toEqual(explicit.ball);
  });

  it('rejects invalid immediate depth without consuming an attempt or starting a toss', () => {
    const game = createGame(), ball = { ...game.ball }, eventId = game.eventId;
    for (const depth of [NaN, Infinity, -Infinity]) expect(game.strikeServe(.5, 0, depth)).toBeFalse();
    expect(game.phase).toBe('serving'); expect(game.ball).toEqual(ball);
    expect(game.serveAttempt).toBe(1); expect(game.score).toEqual([0, 0]);
    expect(game.eventId).toBe(eventId); expect(game.serveTossActive).toBeFalse();
  });

  it('winds up, rises, then descends before the contact window', () => {
    const game = createGame(), initialHeight = game.ball.y;
    game.armServe();
    advance(game, .1, flightHold);
    expect(game.serveTossActive).toBeTrue();
    expect(game.serveTossProgress).toBeCloseTo(.1 / SERVE_TOSS.contact, 8);
    expect(game.ball.y).toBeCloseTo(initialHeight, 8);
    advance(game, .3, flightHold);
    expect(game.ball.y).toBeGreaterThan(initialHeight);
    expect(game.ball.vy).toBeGreaterThan(0);
    advance(game, .4, flightHold); const high = game.ball.y;
    advance(game, .2, flightHold);
    expect(game.ball.y).toBeLessThan(high);
    expect(game.ball.vy).toBeLessThan(0);
    expect(game.serveTossProgress).toBeCloseTo(1 / SERVE_TOSS.contact, 8);
    expect(game.phase).toBe('serving'); expect(game.serveReleaseQueued).toBeFalse();
    expect(game.score).toEqual([0, 0]); expect(game.event).not.toBe('serve');
  });

  it('queues an early release and makes exactly one contact with a falling toss', () => {
    const game = createGame(); game.armServe();
    advance(game, .3, flightHold); const eventId = game.eventId;
    game.update(flightStep, flightIdle);
    expect(game.phase).toBe('serving'); expect(game.serveReleaseQueued).toBeTrue();
    advance(game, .65);
    expect(game.phase).toBe('serving'); expect(game.eventId).toBe(eventId);
    let beforeContact = { ...game.ball }, elapsed = .3 + flightStep + .65;
    for (let tick = 0; tick < 30 && game.phase === 'serving'; tick++) {
      beforeContact = { ...game.ball }; game.update(flightStep, flightIdle); elapsed += flightStep;
    }
    expect(elapsed).toBeGreaterThanOrEqual(SERVE_TOSS.contact - 1e-8);
    expect(elapsed).toBeLessThan(SERVE_TOSS.contact + 2 * flightStep);
    expect(beforeContact.vy).toBeLessThan(0);
    expect(game.phase).toBe('playing'); expect(game.event).toBe('serve');
    expect(game.eventId).toBe(eventId + 1); expect(game.serveTossActive).toBeFalse();
    expect(game.serveReleaseQueued).toBeFalse(); expect(game.ball.vz).toBeLessThan(0);
    advance(game, .05);
    expect(game.eventId).toBe(eventId + 1);
  });

  it('freezes released power, width and depth despite later arrows and target commands', () => {
    const game = createGame(); game.armServe(); game.setServeAim(.45); game.setServeDepth(.4);
    advance(game, .55, flightHold);
    const target = game.serveTarget, power = game.serveCharge;
    game.update(flightStep, flightIdle);
    game.setServeAim(-1); game.setServeDepth(-1);
    advance(game, .25, { ...flightIdle, left: true, back: true });
    expect(game.serveReleaseQueued).toBeTrue();
    expect(game.serveCharge).toBe(power); expect(game.serveAim).toBe(.45); expect(game.serveDepth).toBe(.4);
    expect(game.serveTarget).toEqual(target);
    until(game, () => game.phase === 'playing', .4, 'queued serve must contact the falling toss');
    expect(game.landing().x).toBeCloseTo(target.x, 7);
    expect(game.landing().z).toBeCloseTo(target.z, 7);
  });

  it('still strikes a release after nominal contact but inside the last-contact window', () => {
    const game = createGame(); game.armServe();
    advance(game, 1.1, flightHold);
    expect(game.serveTossActive).toBeTrue(); expect(game.ball.vy).toBeLessThan(0);
    expect(game.phase).toBe('serving'); expect(game.serveReleaseQueued).toBeFalse();
    game.update(flightStep, flightIdle);
    // The high charge can subsequently go long; the swing itself is not a missed-toss fault.
    expect(game.phase).toBe('playing'); expect(game.event).toBe('serve');
    expect(game.serveAttempt).toBe(1); expect(game.score).toEqual([0, 0]);
    expect(game.serveTossActive).toBeFalse(); expect(game.serveReleaseQueued).toBeFalse();
  });

  it('does not advance a toss on invalid elapsed time and caps a suspended frame', () => {
    const game = createGame(); game.armServe(); advance(game, .3, flightHold);
    const ball = { ...game.ball }, progress = game.serveTossProgress;
    for (const seconds of [NaN, Infinity, -1, 0]) game.update(seconds, flightIdle);
    expect(game.ball).toEqual(ball); expect(game.serveTossProgress).toBe(progress);
    expect(game.serveReleaseQueued).toBeFalse();
    game.update(600, flightHold);
    expect(game.serveTossProgress).toBeCloseTo(progress + .05 / SERVE_TOSS.contact, 8);
    expect(game.phase).toBe('serving');
  });

  for (const attempt of [1, 2] as const) {
    it('catches an unhit toss without a fault on attempt ' + attempt, () => {
      const game = createGame(); if (attempt === 2) secondServe(game);
      game.armServe(); const score = [...game.score], eventId = game.eventId;
      advance(game, 1.3, flightHold);
      expect(game.serveTossActive).toBeTrue(); expect(game.serveTossProgress).toBe(1);
      advance(game, .4, flightHold);
      expect(game.phase).toBe('serving'); expect(game.serveAttempt).toBe(attempt);
      expect(game.score).toEqual(score); expect(game.eventId).toBe(eventId);
      expect(game.serveTossActive).toBeFalse(); expect(game.serveReleaseQueued).toBeFalse();
      advance(game, .2); advance(game, .2, flightHold);
      expect(game.serveTossActive).toBeTrue(); expect(game.serveAttempt).toBe(attempt);
    });

    for (const queued of [false, true]) {
      it('cancels a ' + (queued ? 'released' : 'held') + ' toss without consuming attempt ' + attempt, () => {
        const game = createGame(); if (attempt === 2) secondServe(game);
        game.setServeAim(.6); game.setServeDepth(-.4); game.armServe();
        advance(game, .3, flightHold);
        if (queued) game.update(flightStep, flightIdle);
        expect(game.serveReleaseQueued).toBe(queued);
        const score = [...game.score], server = game.server, eventId = game.eventId;
        // This is the same engine boundary used by pause/resume; a paused scene supplies no updates.
        game.cancelServeCharge();
        expect(game.serveTossActive).toBeFalse(); expect(game.serveTossProgress).toBe(0);
        expect(game.serveReleaseQueued).toBeFalse(); expect(game.serveCharge).toBe(0);
        expect(game.serveAim).toBe(.6); expect(game.serveDepth).toBe(-.4);
        advance(game, 1.8);
        expect(game.phase).toBe('serving'); expect(game.serveAttempt).toBe(attempt);
        expect(game.score).toEqual(score); expect(game.server).toBe(server); expect(game.eventId).toBe(eventId);
      });
    }

    it('counts an attempted late swing as ' + (attempt === 1 ? 'a first fault' : 'a double fault'), () => {
      const game = createGame(); if (attempt === 2) secondServe(game);
      game.armServe(); advance(game, 1.2, flightHold);
      expect(game.serveTossActive).toBeTrue(); expect(game.phase).toBe('serving');
      game.update(flightStep, flightIdle);
      if (attempt === 1) {
        expect(game.phase).toBe('fault'); expect(game.serveAttempt).toBe(2);
        expect(game.score).toEqual([0, 0]); expect(game.event).toBe('fault');
      } else {
        expect(game.phase).toBe('point'); expect(game.reason).toBe('doubleFault');
        expect(game.score).toEqual([0, 1]); expect(game.pointWinner).toBe(1);
      }
    });
  }

  it('keeps the receiver still through opposed hidden targets, tosses and queued releases', () => {
    const left = createGame(), right = createGame();
    left.armServe(); right.armServe();
    const receiver = { ...left.players[1] };
    advance(left, .4, { ...flightHold, left: true, back: true });
    advance(right, .4, { ...flightHold, right: true, forward: true });
    expect(left.serveTarget.x).toBeLessThan(right.serveTarget.x);
    expect(Math.abs(left.serveTarget.z)).toBeLessThan(Math.abs(right.serveTarget.z));
    left.update(flightStep, flightIdle); right.update(flightStep, flightIdle);
    advance(left, .55); advance(right, .55);
    expect(left.serveReleaseQueued).toBeTrue(); expect(right.serveReleaseQueued).toBeTrue();
    expect(left.players[1]).toEqual(receiver); expect(right.players[1]).toEqual(receiver);
    until(left, () => left.phase === 'playing', .2, 'left serve must make contact');
    until(right, () => right.phase === 'playing', .2, 'right serve must make contact');
    advance(left, .15); advance(right, .15);
    expect(left.players[1].x).toBe(receiver.x); expect(left.players[1].z).toBe(receiver.z);
    expect(right.players[1].x).toBe(receiver.x); expect(right.players[1].z).toBe(receiver.z);
    until(right, () => Math.hypot(right.players[1].x - receiver.x, right.players[1].z - receiver.z) > .01,
      .3, 'receiver must eventually react to a struck ball');
  });

  it('keeps score, server and service box after one depth fault, then awards exactly one double fault', () => {
    const game = createGame(), server = game.server, box = game.serviceBoxSign;
    firstFault(game);
    expect(game.score).toEqual([0, 0]); expect(game.scoring.totalPoints).toBe(0);
    expect(game.server).toBe(server); expect(game.serviceBoxSign).toBe(box);
    until(game, () => game.phase === 'serving', 1.5, 'second attempt must use the same service box');
    expect(game.server).toBe(server); expect(game.serviceBoxSign).toBe(box);
    expect(game.serveDepth).toBe(0); expect(game.serveTossActive).toBeFalse();
    expect(game.strikeServe(.5, 0, 1.2)).toBeTrue();
    until(game, () => game.phase !== 'playing', 1.3, 'second depth fault must end the point');
    expect(game.phase).toBe('point'); expect(game.reason).toBe('doubleFault');
    expect(game.score).toEqual([0, 1]); expect(game.scoring.totalPoints).toBe(1);
    const eventId = game.eventId; advance(game, .05);
    expect(game.score).toEqual([0, 1]); expect(game.eventId).toBe(eventId);
  });

  it('does not automatically toss a second serve while Hit remains held after a fault', () => {
    const game = createGame(); firstFault(game);
    advance(game, 2, flightHold);
    expect(game.phase).toBe('serving'); expect(game.serveTossActive).toBeFalse();
    expect(game.serveCharge).toBe(0); expect(game.serveAttempt).toBe(2); expect(game.score).toEqual([0, 0]);
    game.update(flightStep, flightIdle); advance(game, .2, flightHold);
    expect(game.serveTossActive).toBeTrue();
  });

  // ITF 2026 Rules 19/20/22: an unhit toss is not a fault; a service let
  // requires an otherwise-good service and never cancels an earlier fault.
  // https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf
  for (const attempt of [1, 2] as const) {
    it('replays a genuine net-touch let on the same attempt ' + attempt, () => {
      const game = createGame(); if (attempt === 2) secondServe(game);
      const score = [...game.score], server = game.server, box = game.serviceBoxSign;
      expect(game.strikeServe(.5, 0, 0)).toBeTrue(); crossNetCord(game);
      landAt(game, box * 2, -5);
      expect(game.phase).toBe('let'); expect(game.event).toBe('let');
      expect(game.serveAttempt).toBe(attempt); expect(game.score).toEqual(score);
      expect(game.server).toBe(server); expect(game.serviceBoxSign).toBe(box);
      until(game, () => game.phase === 'serving', 1.4, 'a service let must replay that particular attempt');
      expect(game.serveAttempt).toBe(attempt); expect(game.score).toEqual(score);
      expect(game.server).toBe(server); expect(game.serviceBoxSign).toBe(box);
      expect(game.serveReleaseQueued).toBeFalse(); expect(game.serveTossActive).toBeFalse();
      if (attempt === 2) {
        game.strikeServe(.5, 0, 1.2);
        until(game, () => game.phase !== 'playing', 1.3, 'second-serve let must not erase the earlier fault');
        expect(game.reason).toBe('doubleFault'); expect(game.score).toEqual([0, 1]);
      }
    });

    for (const boundary of ['long', 'wide', 'wrong box'] as const) {
      it('keeps net plus ' + boundary + ' a fault on attempt ' + attempt, () => {
        const game = createGame(); if (attempt === 2) secondServe(game);
        game.strikeServe(.5, 0, 0); crossNetCord(game);
        const box = game.serviceBoxSign;
        landAt(game, boundary === 'wide' ? box * (FIELD.halfWidth + .02) : boundary === 'wrong box' ? -box * 2 : box * 2,
          boundary === 'long' ? -FIELD.serviceLine - .02 : -5);
        expect(game.phase).toBe(attempt === 1 ? 'fault' : 'point');
        expect(game.event).not.toBe('let');
        expect(game.score).toEqual(attempt === 1 ? [0, 0] : [0, 1]);
        if (attempt === 2) expect(game.reason).toBe('doubleFault');
      });
    }
  }

  it('includes the service line, singles sideline and centreline in an otherwise-good net let', () => {
    for (const parity of [0, 1]) for (const edge of ['service line', 'sideline', 'centreline'] as const) {
      const game = createGame(); game.score = [parity, 0];
      game.strikeServe(.5, 0, 0); crossNetCord(game);
      landAt(game, edge === 'centreline' ? 0 : game.serviceBoxSign * (edge === 'sideline' ? FIELD.halfWidth : 2),
        edge === 'service line' ? -FIELD.serviceLine : -5);
      expect(game.phase).withContext('parity ' + parity + ', ' + edge).toBe('let');
      expect(game.score).toEqual([parity, 0]); expect(game.serveAttempt).toBe(1);
    }
  });

  it('uses interpolated height at the net rather than the height at the end of a step', () => {
    for (const crossing of ['clear', 'cord', 'below'] as const) {
      const game = createGame(); game.strikeServe(.5, 0, 0);
      game.ball = { x: -1, y: FIELD.netHeight + (crossing === 'clear' ? .12 : crossing === 'cord' ? .03 : -.05),
        z: .001, vx: 0, vy: crossing === 'below' ? 18 : -18, vz: -12 };
      game.update(flightStep, flightIdle);
      if (crossing === 'below') {
        expect(game.phase).toBe('fault'); expect(game.score).toEqual([0, 0]);
      } else {
        expect(game.phase).toBe('playing'); landAt(game, -2, -5);
        expect(game.phase).toBe(crossing === 'cord' ? 'let' : 'playing');
        expect(game.event).toBe(crossing === 'cord' ? 'let' : 'bounce');
      }
    }
  });

  it('plays a rally net-cord crossing and bounce without invoking service let rules', () => {
    const game = createGame(); game.strikeServe(.5, 0, 0);
    until(game, () => game.rally > 0 || game.phase !== 'playing', 2, 'receiver must return the ordinary serve');
    expect(game.phase).toBe('playing'); expect(game.rally).toBeGreaterThan(0);
    crossNetCord(game, -1);
    landAt(game, .3, 8); // Legal rally court, deliberately beyond the service line.
    expect(game.phase).toBe('playing'); expect(game.event).toBe('bounce');
    expect(game.score).toEqual([0, 0]); expect(game.reason).toBeNull();
  });

  it('maps and accepts replay depth commands 6/7/8 without changing width or frame size', () => {
    const config = { seed: 417, strength: .6, surface: 'hard' as const };
    for (const command of [6, 7, 8] as ArcadeCommand[]) {
      const game = createGame(); game.setServeAim(.4);
      applyArcadeCommand(game, command);
      expect(game.serveDepth).toBe(command - 7); expect(game.serveAim).toBe(.4);
      const recorder = new ArcadeRecorder(); recorder.command(command); recorder.capture(.02, flightIdle);
      const bytes = recorder.exportBytes();
      expect(bytes.length).toBe(7); expect(bytes[4] & 15).toBe(command);
      // A bounded one-frame replay is intentionally incomplete, not an invalid command.
      expect(() => replayArcade(bytes, config)).toThrowError('Replay is incomplete');
    }
    for (const command of [9, 15]) {
      expect(() => replayArcade(new Uint8Array([1, 0, 0, 0, command, 0, 0]), config)).toThrowError('Invalid replay command');
    }
  });
});
