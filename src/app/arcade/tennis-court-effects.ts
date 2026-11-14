import * as THREE from 'three';
import type { Tennis3DEngine } from './tennis-3d-engine';

/** Small, pooled visual effects. They only observe the match; no gameplay state is changed. */
export class TennisCourtEffects {
  private readonly streak: THREE.Mesh;
  private readonly dust: THREE.InstancedMesh;
  private readonly contact: THREE.Mesh;
  private readonly matrix = new THREE.Object3D();
  private readonly direction = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly previousBall = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();
  private lastTime: number | null = null;
  private lastEvent = -1;
  private player: unknown;
  private remaining = 0;
  private clay = false;
  private hasPreviousBall = false;

  constructor(scene: THREE.Scene) {
    this.streak = new THREE.Mesh(new THREE.CylinderGeometry(.028, .004, 1, 5, 1),
      new THREE.MeshBasicMaterial({ color: 0xe5f786, transparent: true, opacity: .28, depthWrite: false }));
    this.streak.visible = false; this.streak.frustumCulled = false;
    this.dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xc99472, transparent: true, opacity: .19, depthWrite: false, side: THREE.DoubleSide }), 12);
    this.dust.visible = false; this.dust.frustumCulled = false;
    this.dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.contact = new THREE.Mesh(new THREE.RingGeometry(.11, .14, 24),
      new THREE.MeshBasicMaterial({ color: 0xe2dcc0, transparent: true, opacity: .22, depthWrite: false }));
    this.contact.rotation.x = -Math.PI / 2; this.contact.visible = false;
    scene.add(this.streak, this.dust, this.contact);
  }

  update(game: Tennis3DEngine, time: number, shownBall: THREE.Vector3, lightweight: boolean): void {
    const changedMatch = this.player !== game.players[0];
    if (changedMatch || !Number.isFinite(time) || this.lastTime === null || time < this.lastTime || time - this.lastTime > .5) {
      this.player = game.players[0]; this.remaining = 0; this.hasPreviousBall = false;
      this.lastEvent = game.eventId;
    }
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(.5, time - this.lastTime));
    this.lastTime = Number.isFinite(time) ? time : null;
    this.remaining = Math.max(0, this.remaining - dt);
    if (game.eventId !== this.lastEvent) {
      this.lastEvent = game.eventId;
      if (game.event === 'bounce' && game.phase === 'playing') {
        this.origin.set(game.ball.x, .043, game.ball.z);
        this.remaining = .34; this.clay = game.surface === 'clay';
      }
    }
    if (game.phase !== 'playing') this.remaining = 0;
    const speed = Math.hypot(game.ball.vx, game.ball.vy, game.ball.vz);
    this.direction.copy(shownBall).sub(this.previousBall);
    const distance = this.direction.length();
    this.streak.visible = !lightweight && this.hasPreviousBall && game.phase === 'playing' && speed > 16 && distance > .02 && distance < 2.5;
    if (this.streak.visible) {
      const length = Math.min(.5, speed * .012);
      this.direction.normalize();
      this.streak.position.copy(shownBall).addScaledVector(this.direction, -length / 2);
      this.streak.quaternion.setFromUnitVectors(this.up, this.direction);
      this.streak.scale.set(1, length, 1);
    }
    this.previousBall.copy(shownBall); this.hasPreviousBall = game.phase === 'playing';
    const age = 1 - this.remaining / .34;
    this.contact.visible = this.remaining > 0;
    this.contact.position.copy(this.origin); this.contact.scale.setScalar(1 + age * 2.8);
    (this.contact.material as THREE.MeshBasicMaterial).opacity = (1 - age) * .32;
    this.dust.visible = this.remaining > 0 && this.clay && !lightweight;
    if (this.dust.visible) {
      (this.dust.material as THREE.MeshBasicMaterial).opacity = (1 - age) * .22;
      for (let i = 0; i < 12; i++) {
        const angle = i * 2.39996, radius = .035 + age * (.28 + i % 3 * .035);
        this.matrix.position.set(this.origin.x + Math.cos(angle) * radius, .055 + Math.sin(age * Math.PI) * (.07 + i % 4 * .018), this.origin.z + Math.sin(angle) * radius);
        this.matrix.rotation.set(-Math.PI / 2 + Math.sin(angle) * .4, 0, angle);
        this.matrix.scale.setScalar((.04 + i % 3 * .015) * (1 + age * 1.6)); this.matrix.updateMatrix();
        this.dust.setMatrixAt(i, this.matrix.matrix);
      }
      this.dust.instanceMatrix.needsUpdate = true;
    }
  }
}
