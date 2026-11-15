import * as THREE from 'three';
import { CourtControls, Tennis3DEngine } from './tennis-3d-engine';
import { Tennis3DRenderer } from './tennis-3d-renderer';
import { createTennisAthlete } from './tennis-athlete-model';
import { TENNIS_ATHLETE_JOINTS as JOINTS } from './tennis-athlete-pose';
import { TennisServePresentation } from './tennis-serve-pose';

/** Renderer-only checks: deliberately excluded from the pure exact-physics Node runner. */
describe('Tennis renderer service contract', () => {
  const idle: CourtControls = { left: false, right: false, forward: false, back: false, jump: false, shot: null };
  const held: CourtControls = { ...idle, shot: 'drive' };
  function advance(game: Tennis3DEngine, seconds: number, input = idle) {
    for (let remaining = seconds; remaining > 1e-8;) { const dt = Math.min(1 / 120, remaining); game.update(dt, input); remaining -= dt; }
  }
  // Invoke the real draw/animation methods with real rigs, but no WebGL context or assets.
  function rendererFor(game: Tennis3DEngine) {
    const ball = new THREE.Group(), athletes = [createTennisAthlete(false), createTennisAthlete(true)];
    const shadow = () => ({ position: new THREE.Vector3(), scale: new THREE.Vector3(), material: { opacity: 1 }, visible: true });
    const guide = { visible: false, geometry: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3)) };
    const marker = new THREE.Group(), markerMaterial = new THREE.MeshBasicMaterial();
    const renderer: Tennis3DRenderer = Object.assign(Object.create(Tennis3DRenderer.prototype), {
      dead: false, surface: game.surface, servePresentation: new TennisServePresentation(), serveHand: new THREE.Vector3(),
      athletes, ball, ballSpinPlayer: null, ballSpinTime: -1,
      athleteLook: game.players.map(() => ({ player: null, time: -1, yaw: 0, pitch: 0 })), athleteShadows: [shadow(), shadow()],
      ballShadow: shadow(), playerRing: new THREE.Group(), bounceRing: new THREE.Group(), serveMarker: marker,
      serveGuide: guide, serveMarkerMaterial: markerMaterial, ballCrew: { update: () => true }, lightweight: false,
      crowd: { update: () => undefined }, effects: { update: () => undefined }, clubDetails: { update: () => undefined },
      gl: { render: () => undefined }, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
    });
    const dispose = () => {
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      athletes.forEach(athlete => athlete.root.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
        geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
      }));
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      guide.geometry.dispose(); markerMaterial.dispose();
    };
    return { renderer, ball, athletes, marker, markerMaterial, dispose };
  }

  it('renders the authoritative ball throughout windup, flight, queued release and late descent', () => {
    const game = new Tennis3DEngine(); game.start(); const view = rendererFor(game);
    try {
      advance(game, .02); advance(game, .05, held);
      for (const seconds of [0, .2, .3, .3, .4, .25]) {
        advance(game, seconds, held); expect(game.serveTossActive).toBeTrue();
        const before = JSON.stringify(game); view.renderer.draw(game, seconds + 100);
        expect(view.ball.position.toArray()).toEqual([game.ball.x, game.ball.y, game.ball.z]); expect(JSON.stringify(game)).toBe(before);
      }
      game.cancelServeCharge(); advance(game, .02); advance(game, .6, held); advance(game, .01);
      expect(game.serveReleaseQueued).toBeTrue(); view.renderer.draw(game, -20);
      expect(view.ball.position.toArray()).toEqual([game.ball.x, game.ball.y, game.ball.z]);
    } finally { view.dispose(); }
  });
  it('only places an idle ball in the free hand and reflects depth without changing the target', () => {
    const game = new Tennis3DEngine(); game.start(); const view = rendererFor(game);
    try {
      const before = JSON.stringify(game); view.renderer.draw(game, 0);
      view.athletes[0].root.updateMatrixWorld(true);
      const hand = view.athletes[0].elbows[0].localToWorld(new THREE.Vector3(0, -JOINTS.handDrop, 0));
      expect(view.ball.position.distanceTo(hand)).toBeLessThan(1e-8); expect(JSON.stringify(game)).toBe(before);
      game.setServeDepth(1.2); const target = game.serveTarget; view.renderer.draw(game, .02);
      expect(view.marker.position.x).toBe(target.x); expect(view.marker.position.z).toBe(target.z);
      expect(view.markerMaterial.color.getHex()).toBe(0xff927e); expect(game.serveDepth).toBe(1.2);
    } finally { view.dispose(); }
  });
});
