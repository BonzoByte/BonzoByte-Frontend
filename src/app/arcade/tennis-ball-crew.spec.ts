import * as THREE from 'three';
import { FIELD, Tennis3DEngine } from './tennis-3d-engine';
import { TennisBallCrew, TENNIS_BALL_CREW_STATIONS } from './tennis-ball-crew';

describe('Original lightweight tennis ball assistants', () => {
  const scenes: THREE.Scene[] = [];
  function setup() {
    const scene = new THREE.Scene(), crew = new TennisBallCrew(scene), game = new Tennis3DEngine(() => .5);
    scenes.push(scene); game.start(); game.phase = 'playing';
    game.ball = { x: -5.1, y: .13, z: -1.3, vx: 0, vy: -1, vz: 0 };
    const ball = new THREE.Vector3();
    const meshes = scene.getObjectByName('tennis-ball-crew')!.children as THREE.InstancedMesh[];
    const frame = (time: number, lightweight = false) => { ball.set(game.ball.x, Math.max(.13, game.ball.y), game.ball.z); return crew.update(game, time, ball, lightweight); };
    frame(0); return { scene, crew, game, ball, meshes, frame };
  }
  function translations(mesh: THREE.InstancedMesh): THREE.Vector3[] {
    const matrix = new THREE.Matrix4();
    return Array.from({ length: mesh.count }, (_, i) => { mesh.getMatrixAt(i, matrix); return new THREE.Vector3().setFromMatrixPosition(matrix); });
  }
  function parked(mesh: THREE.InstancedMesh) {
    translations(mesh).forEach((position, i) => {
      expect(position.x).toBeCloseTo(TENNIS_BALL_CREW_STATIONS[i][0], 5);
      expect(position.z).toBeCloseTo(TENNIS_BALL_CREW_STATIONS[i][1], 5);
    });
  }
  afterEach(() => {
    for (const scene of scenes.splice(0)) {
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (!(object instanceof THREE.InstancedMesh)) return;
        geometries.add(object.geometry); materials.add(object.material as THREE.Material); object.dispose();
      });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    }
  });

  it('keeps four capped, crouched assistants outside the singles court in three shared draws', () => {
    const { meshes } = setup(); expect(meshes.length).toBe(3); expect(meshes[0].count).toBe(4); parked(meshes[0]);
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    meshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial; materials.add(material);
      expect(material.map).toBeNull(); expect(material.bumpMap).toBeNull(); expect(material.normalMap).toBeNull();
      expect(mesh.castShadow).toBeFalse(); expect(mesh.receiveShadow).toBeFalse();
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3 * mesh.count;
      expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
    });
    expect(materials.size).toBe(1); expect(triangles).toBeLessThan(2200);
    TENNIS_BALL_CREW_STATIONS.forEach(([x]) => expect(Math.abs(x)).toBeGreaterThan(FIELD.halfWidth + .8));
  });
  for (const phase of ['point', 'fault', 'let'] as const) {
    it(`briefly picks up the nearby visible dead ball during ${phase}, then returns home`, () => {
      const { game, ball, meshes, frame } = setup(); game.phase = phase; game.eventId++;
      const before = JSON.stringify(game); let visible = true, movedBall = false, movedCrew = false;
      for (let step = 1; step <= 58; step++) {
        visible = frame(step / 60);
        movedBall ||= ball.distanceTo(new THREE.Vector3(game.ball.x, .13, game.ball.z)) > .01;
        movedCrew ||= translations(meshes[0])[0].distanceTo(new THREE.Vector3(-6.55, .49, -1.3)) > .01;
        expect(JSON.stringify(game)).toBe(before);
      }
      expect(movedCrew).toBeTrue(); expect(movedBall).toBeTrue(); expect(visible).toBeFalse(); parked(meshes[0]);
      for (let step = 59; step <= 100; step++) expect(frame(step / 60)).toBeFalse();
    });
  }
  it('moves only the nearest assistant, with no ball copies or extra scene objects', () => {
    const { game, meshes, scene, frame } = setup(), initial = translations(meshes[0]), count = scene.children[0].children.length;
    game.phase = 'point'; game.eventId++;
    for (let step = 1; step <= 12; step++) frame(step / 60);
    const moved = translations(meshes[0]).filter((position, i) => position.distanceTo(initial[i]) > .01);
    expect(moved.length).toBe(1); expect(scene.children[0].children.length).toBe(count);
  });
  it('never moves, hides or collects a live serve/rally ball', () => {
    const { game, meshes, ball, frame } = setup(), versions = meshes.map(mesh => mesh.instanceMatrix.version);
    for (const phase of ['ready', 'serving', 'playing', 'over'] as const) {
      game.phase = phase;
      for (let step = 1; step <= 40; step++) {
        expect(frame(step / 60)).toBeTrue(); expect(ball.toArray()).toEqual([game.ball.x, .13, game.ball.z]); parked(meshes[0]);
      }
    }
    expect(meshes.map(mesh => mesh.instanceMatrix.version)).toEqual(versions);
  });
  it('parks immediately when serving or rally play interrupts a pickup', () => {
    for (const phase of ['serving', 'playing'] as const) {
      const { game, meshes, ball, frame } = setup(); game.phase = 'point'; game.eventId++;
      for (let step = 1; step <= 15; step++) frame(step / 60);
      expect(translations(meshes[0])[0].x).not.toBeCloseTo(-6.55, 3);
      game.phase = phase; game.ball = { x: .8, y: 3.1, z: 12, vx: 0, vy: 2, vz: 0 };
      expect(frame(.27)).toBeTrue(); parked(meshes[0]); expect(ball.toArray()).toEqual([.8, 3.1, 12]);
    }
  });
  it('makes lightweight mode fully static, including after toggling during a pickup', () => {
    const { game, meshes, frame } = setup(); game.phase = 'fault'; game.eventId++;
    for (let step = 1; step <= 10; step++) frame(step / 60);
    expect(frame(.18, true)).toBeTrue(); parked(meshes[0]); const versions = meshes.map(mesh => mesh.instanceMatrix.version);
    for (let step = 12; step <= 80; step++) expect(frame(step / 60, true)).toBeTrue();
    expect(meshes.map(mesh => mesh.instanceMatrix.version)).toEqual(versions);
    expect(frame(1.35)).toBeTrue(); parked(meshes[0]);
  });
  it('does not chase distant, airborne or invalid balls or invent a pickup on initial load', () => {
    for (const position of [[0, .13, 0], [-5.1, 3, -1.3], [NaN, .13, 0]]) {
      const { game, meshes, frame } = setup(); game.ball.x = position[0]; game.ball.y = position[1]; game.ball.z = position[2];
      game.phase = 'point'; game.eventId++;
      for (let step = 1; step <= 80; step++) expect(frame(step / 60)).toBeTrue();
      parked(meshes[0]);
    }
    const scene = new THREE.Scene(), crew = new TennisBallCrew(scene), game = new Tennis3DEngine(); scenes.push(scene);
    game.start(); game.phase = 'point';
    for (let step = 0; step < 100; step++) expect(crew.update(game, step / 60, new THREE.Vector3(-5.1, .13, -1.3), false)).toBeTrue();
  });
  it('cancels a pickup after stale/reset/invalid timestamps or replacement match players', () => {
    for (const interruption of ['pause', 'rewind', 'invalid', 'restart'] as const) {
      const { game, meshes, frame } = setup(); game.phase = 'let'; game.eventId++;
      for (let step = 1; step <= 10; step++) frame(step / 60);
      if (interruption === 'restart') game.start();
      const time = interruption === 'pause' ? 100 : interruption === 'rewind' ? 0 : interruption === 'invalid' ? NaN : .18;
      expect(frame(time)).toBeTrue(); parked(meshes[0]);
      expect(meshes.every(mesh => Array.from(mesh.instanceMatrix.array).every(Number.isFinite))).toBeTrue();
    }
  });
  it('keeps all ordinary idle frames static without changing RNG or gameplay data', () => {
    const scene = new THREE.Scene(), crew = new TennisBallCrew(scene), random = jasmine.createSpy('random').and.returnValue(.5), game = new Tennis3DEngine(random);
    scenes.push(scene); game.start(); random.calls.reset();
    const before = JSON.stringify(game), shown = new THREE.Vector3(game.ball.x, game.ball.y, game.ball.z);
    for (let frame = 0; frame < 300; frame++) crew.update(game, frame / 60, shown, false);
    expect(JSON.stringify(game)).toBe(before); expect(random).not.toHaveBeenCalled();
  });
});
