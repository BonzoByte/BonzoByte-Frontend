import * as THREE from 'three';
import { FIELD } from './tennis-3d-engine';
import type { Tennis3DEngine } from './tennis-3d-engine';

export const TENNIS_BALL_CREW_STATIONS = [[-6.55, -1.3], [6.55, 1.3], [-5.7, 12.8], [5.7, -12.8]] as const;
type CrewGame = Pick<Tennis3DEngine, 'phase' | 'players' | 'eventId'>;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

/** Bake original cap, face, shirt and shorts into a single reusable, vertex-coloured body. */
function crewBody(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.SphereGeometry(1, 8, 6);
  const positions: number[] = [], normals: number[] = [], colours: number[] = [], indices: number[] = [];
  const matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), vertex = new THREE.Vector3();
  const part = (source: THREE.BufferGeometry, colour: number, position: number[], scale: number[]) => {
    matrix.compose(new THREE.Vector3(...position), new THREE.Quaternion(), new THREE.Vector3(...scale));
    normalMatrix.getNormalMatrix(matrix);
    const p = source.getAttribute('position'), n = source.getAttribute('normal'), colourValue = new THREE.Color(colour), offset = positions.length / 3;
    for (let i = 0; i < p.count; i++) {
      vertex.fromBufferAttribute(p, i).applyMatrix4(matrix); positions.push(vertex.x, vertex.y, vertex.z);
      vertex.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize(); normals.push(vertex.x, vertex.y, vertex.z);
      colours.push(colourValue.r, colourValue.g, colourValue.b);
    }
    const index = source.getIndex();
    for (let i = 0; i < (index?.count ?? p.count); i++) indices.push(offset + (index ? index.getX(i) : i));
  };
  part(box, 0x397c80, [0, .22, 0], [.32, .35, .21]);
  part(box, 0xd6dda1, [0, .27, -.108], [.29, .035, .012]);
  part(box, 0x263e4b, [0, -.015, 0], [.3, .14, .22]);
  part(sphere, 0xcda88c, [0, .51, -.015], [.115, .14, .112]);
  part(sphere, 0xe5dcc3, [0, .62, -.005], [.122, .045, .12]);
  part(box, 0xe5dcc3, [0, .625, -.12], [.22, .018, .14]);
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  result.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  result.setIndex(indices); result.computeBoundingSphere(); box.dispose(); sphere.dispose(); return result;
}

/** Three shared draws, no textures/lights/shadows. Only the visible dead ball is ever picked up. */
export class TennisBallCrew {
  private readonly actors = TENNIS_BALL_CREW_STATIONS.map(([x, z]) => ({
    home: new THREE.Vector3(x, 0, z), position: new THREE.Vector3(x, 0, z), yaw: Math.atan2(x, z),
  }));
  private readonly bodies: THREE.InstancedMesh;
  private readonly limbs: THREE.InstancedMesh;
  private readonly shoes: THREE.InstancedMesh;
  private readonly root = new THREE.Object3D();
  private readonly part = new THREE.Object3D();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly carryHand = new THREE.Vector3();
  private phase: CrewGame['phase'] | null = null;
  private event = -1;
  private player: unknown;
  private time: number | null = null;
  private collected = false;
  private retrieval: { actor: number; elapsed: number; travel: number; origin: THREE.Vector3; stop: THREE.Vector3 } | null = null;

  constructor(scene: THREE.Scene) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96 });
    const limb = new THREE.CylinderGeometry(1, 1, 1, 6), shoe = new THREE.BoxGeometry(1, 1, 1);
    for (const geometry of [limb, shoe]) {
      const colour = new Float32Array(geometry.getAttribute('position').count * 3); colour.fill(1);
      geometry.setAttribute('color', new THREE.BufferAttribute(colour, 3));
    }
    this.bodies = new THREE.InstancedMesh(crewBody(), material, 4);
    this.limbs = new THREE.InstancedMesh(limb, material, 32);
    this.shoes = new THREE.InstancedMesh(shoe, material, 8);
    const group = new THREE.Group(); group.name = 'tennis-ball-crew';
    for (const [i, mesh] of [this.bodies, this.limbs, this.shoes].entries()) {
      mesh.name = ['crew-capped-bodies', 'crew-articulated-limbs', 'crew-shoes'][i];
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(mesh);
    }
    for (let actor = 0; actor < 4; actor++) for (let limbIndex = 0; limbIndex < 8; limbIndex++) {
      this.limbs.setColorAt(actor * 8 + limbIndex, new THREE.Color(limbIndex < 4 ? 0x263e4b : 0xcda88c));
    }
    for (let i = 0; i < 8; i++) this.shoes.setColorAt(i, new THREE.Color(0xe5dcc3));
    scene.add(group); this.writeActors();
  }

  /** Returns ball visibility; shownBall is a render transform, never the engine's ball object. */
  update(game: CrewGame, time: number, shownBall: THREE.Vector3, lightweight: boolean): boolean {
    const previousPhase = this.phase, changed = game.phase !== this.phase || game.eventId !== this.event;
    const interrupted = this.player !== game.players[0] || this.time === null || !Number.isFinite(time) || time < this.time || time - this.time > .5;
    const dt = interrupted ? 0 : Math.min(.05, Math.max(0, time - this.time!));
    this.player = game.players[0]; this.phase = game.phase; this.event = game.eventId; this.time = Number.isFinite(time) ? time : null;
    const between = game.phase === 'point' || game.phase === 'fault' || game.phase === 'let';
    if (interrupted || lightweight || !between) { this.park(); return true; }
    if (changed) {
      this.park();
      if (previousPhase === 'playing' || previousPhase === 'serving') this.begin(shownBall);
    }
    const job = this.retrieval;
    if (!job) return !this.collected;
    job.elapsed += dt;
    const pickup = .08 + job.travel, returning = pickup + .1, finish = returning + job.travel;
    if (job.elapsed >= finish) { this.park(); this.collected = true; return false; }
    const forward = smooth((job.elapsed - .08) / job.travel), back = smooth((job.elapsed - returning) / job.travel);
    const amount = forward * (1 - back), actor = this.actors[job.actor];
    actor.position.lerpVectors(actor.home, job.stop, amount);
    const moving = amount > 0 && amount < 1 ? Math.sin(Math.PI * amount) : 0;
    this.writeActors(job.actor, forward * (1 - back), moving, job.elapsed);
    if (job.elapsed >= pickup) shownBall.copy(this.carryHand);
    else shownBall.set(job.origin.x, Math.max(.13, job.origin.y - .5 * FIELD.gravity * job.elapsed ** 2), job.origin.z);
    return true;
  }

  private begin(ball: THREE.Vector3): void {
    if (![ball.x, ball.y, ball.z].every(Number.isFinite) || ball.y > 1.4 || ball.y < 0) return;
    let nearest = -1, distance = 2.6;
    this.actors.forEach((actor, index) => {
      const candidate = Math.hypot(actor.home.x - ball.x, actor.home.z - ball.z);
      if (candidate < distance) { nearest = index; distance = candidate; }
    });
    if (nearest < 0 || distance < .4) return;
    const actor = this.actors[nearest], origin = ball.clone();
    const stop = actor.home.clone().sub(new THREE.Vector3(ball.x, 0, ball.z)).normalize().multiplyScalar(.32).add(new THREE.Vector3(ball.x, 0, ball.z));
    actor.yaw = Math.atan2(actor.home.x - ball.x, actor.home.z - ball.z);
    this.retrieval = { actor: nearest, elapsed: 0, travel: Math.max(.24, (distance - .32) / 6.5), origin, stop };
  }

  private park(): void {
    if (!this.retrieval && !this.collected) return;
    this.retrieval = null; this.collected = false;
    this.actors.forEach(actor => { actor.position.copy(actor.home); actor.yaw = Math.atan2(actor.home.x, actor.home.z); });
    this.writeActors();
  }

  private point(x: number, y: number, z: number, target: THREE.Vector3): THREE.Vector3 {
    return target.set(x, y, z).applyMatrix4(this.root.matrix);
  }

  private segment(index: number, radius: number): void {
    this.direction.subVectors(this.b, this.a);
    this.part.position.copy(this.a).add(this.b).multiplyScalar(.5);
    this.part.scale.set(radius, this.direction.length(), radius);
    this.part.quaternion.setFromUnitVectors(this.up, this.direction.normalize()); this.part.updateMatrix();
    this.limbs.setMatrixAt(index, this.part.matrix);
  }

  private writeActors(active = -1, reach = 0, moving = 0, elapsed = 0): void {
    this.actors.forEach((actor, index) => {
      const motion = index === active ? moving : 0, hip = .49 + motion * .24;
      this.root.position.set(actor.position.x, hip, actor.position.z); this.root.rotation.set(-motion * .09, actor.yaw, 0);
      this.root.scale.setScalar(1); this.root.updateMatrix(); this.bodies.setMatrixAt(index, this.root.matrix);
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1, stride = Math.sin(elapsed * 24 + side * Math.PI) * .12 * motion;
        const lift = Math.max(0, Math.sin(elapsed * 24 + side * Math.PI)) * .045 * motion;
        this.point(sign * .105, -.025, 0, this.a); this.point(sign * .13, -hip * .52, -.24 + stride * .4, this.b);
        this.segment(index * 8 + side * 2, .058);
        this.a.copy(this.b); this.point(sign * .13, .105 + lift - hip, .04 + stride, this.b); this.segment(index * 8 + side * 2 + 1, .043);
        this.point(sign * .13, .065 + lift - hip, stride - .025, this.part.position);
        this.part.rotation.set(0, actor.yaw, 0); this.part.scale.set(.13, .085, .25); this.part.updateMatrix();
        this.shoes.setMatrixAt(index * 2 + side, this.part.matrix);
        const reaching = index === active && side === 1 ? reach : 0;
        this.point(sign * .18, .34, -.015, this.a); this.point(sign * .22, .08 - reaching * .14, -.17, this.b);
        this.segment(index * 8 + 4 + side * 2, .036);
        this.a.copy(this.b);
        this.point(sign * .19 * (1 - reaching), -.13 + (.13 - hip + .13) * reaching, -.29 - .03 * reaching, this.b);
        this.segment(index * 8 + 5 + side * 2, .031);
        if (index === active && side === 1) this.carryHand.copy(this.b);
      }
    });
    for (const mesh of [this.bodies, this.limbs, this.shoes]) mesh.instanceMatrix.needsUpdate = true;
  }
}
