import * as THREE from 'three';
import { TennisCourtEffects } from './tennis-court-effects';
import { Tennis3DEngine } from './tennis-3d-engine';

describe('pooled tennis court presentation', () => {
  it('never mutates physics, scores or the random generator', () => {
    let calls = 0;
    const game = new Tennis3DEngine(() => { calls++; return .5; });
    game.start('clay'); game.phase = 'playing';
    const before = JSON.stringify(game), rngCalls = calls, scene = new THREE.Scene();
    const effects = new TennisCourtEffects(scene);
    for (let i = 0; i < 150; i++) effects.update(game, i / 30, new THREE.Vector3(i / 10, 1, 1), false);
    expect(JSON.stringify(game)).toBe(before); expect(calls).toBe(rngCalls);
    expect(scene.children.length).toBe(3);
  });
  it('does not draw a trail across a reset or a teleport', () => {
    const scene = new THREE.Scene(), game = new Tennis3DEngine(), effects = new TennisCourtEffects(scene);
    game.start(); game.phase = 'playing'; game.ball.vz = 24;
    effects.update(game, 0, new THREE.Vector3(0, 1, 0), false);
    effects.update(game, 1 / 30, new THREE.Vector3(0, 1, .7), false);
    expect(scene.children[0].visible).toBeTrue();
    effects.update(game, 2 / 30, new THREE.Vector3(0, 1, -10), false);
    expect(scene.children[0].visible).toBeFalse();
    game.start(); game.phase = 'playing'; game.ball.vz = 24;
    effects.update(game, 3 / 30, new THREE.Vector3(0, 1, 10), false);
    expect(scene.children[0].visible).toBeFalse();
  });
  it('keeps clay dust bounded and disables it in lighter graphics', () => {
    const scene = new THREE.Scene(), game = new Tennis3DEngine(), effects = new TennisCourtEffects(scene);
    game.start('clay'); game.phase = 'playing';
    effects.update(game, 0, new THREE.Vector3(), false);
    game.event = 'bounce'; game.eventId++;
    effects.update(game, .03, new THREE.Vector3(), false);
    expect(scene.children[1].visible).toBeTrue();
    expect((scene.children[1] as THREE.InstancedMesh).count).toBe(12);
    effects.update(game, .06, new THREE.Vector3(), true);
    expect(scene.children[1].visible).toBeFalse();
    effects.update(game, .5, new THREE.Vector3(), false);
    expect(scene.children[1].visible).toBeFalse(); expect(scene.children[2].visible).toBeFalse();
  });
  it('suppresses old effects after pauses and hides them between points', () => {
    const scene = new THREE.Scene(), game = new Tennis3DEngine(), effects = new TennisCourtEffects(scene);
    game.start('clay'); game.phase = 'playing'; effects.update(game, 0, new THREE.Vector3(), false);
    game.event = 'bounce'; game.eventId++; effects.update(game, .03, new THREE.Vector3(), false);
    effects.update(game, 12, new THREE.Vector3(), false);
    expect(scene.children.every(object => !object.visible)).toBeTrue();
    game.phase = 'point'; effects.update(game, 12.03, new THREE.Vector3(), false);
    expect(scene.children.every(object => !object.visible)).toBeTrue();
  });
});
