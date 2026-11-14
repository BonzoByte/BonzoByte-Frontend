import * as THREE from 'three';

export interface SpectatorSeat { x: number; y: number; z: number; angle: number; }
export function tennisAudienceSeats(): SpectatorSeat[] {
  const seats: SpectatorSeat[] = [];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 22; i++) seats.push({ x: -8.4 + i * .8, y: 1.08 + row * .5, z: -21 - row * .85, angle: Math.PI });
    for (const side of [-1, 1]) for (let i = 0; i < 20; i++) {
      seats.push({ x: side * (11.8 + row * .8), y: .72 + row * .46, z: -12 + i * 1.1, angle: side * Math.PI / 2 });
    }
  }
  return seats;
}

interface Spectator {
  seat: SpectatorSeat;
  cos: number; sin: number;
  height: number; width: number; lean: number; rest: number;
  reaction: number; delay: number; duration: number; cadence: number;
}

/** Stable, unrelated variation channels; no randomness or replay state is consumed. */
function variation(index: number, salt: number): number {
  let value = Math.imul((index + 1) ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

// x, y, z, width, height, depth, shade, bottom-width ratio (optional).
type CrowdBox = readonly [number, number, number, number, number, number, number, number?];

/** Bake static clothing/legs together, not one Object3D or instance per small detail. */
function packedBoxes(box: THREE.BoxGeometry, parts: readonly CrowdBox[]): THREE.BufferGeometry {
  const source = box.getAttribute('position'), sourceIndex = box.getIndex()!;
  const positions = new Float32Array(parts.length * source.count * 3);
  const colors = new Float32Array(positions.length);
  const indices = new Uint16Array(parts.length * sourceIndex.count);
  for (let part = 0; part < parts.length; part++) {
    const [x, y, z, width, height, depth, shade, bottom = 1] = parts[part];
    for (let vertex = 0; vertex < source.count; vertex++) {
      const offset = (part * source.count + vertex) * 3;
      const taper = bottom + (1 - bottom) * (source.getY(vertex) + .5);
      positions[offset] = x + source.getX(vertex) * width * taper;
      positions[offset + 1] = y + source.getY(vertex) * height;
      positions[offset + 2] = z + source.getZ(vertex) * depth;
      colors[offset] = colors[offset + 1] = colors[offset + 2] = shade;
    }
    for (let index = 0; index < sourceIndex.count; index++) {
      indices[part * sourceIndex.count + index] = sourceIndex.getX(index) + part * source.count;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** Hard cap: four draws, 60,512 triangles, 1,984 transforms; no crowd shadow passes. */
export class TennisCrowd {
  private readonly spectators: Spectator[] = tennisAudienceSeats().map((seat, i) => ({
    seat, cos: Math.cos(seat.angle), sin: Math.sin(seat.angle),
    height: .94 + variation(i, 11) * .13, width: .91 + variation(i, 23) * .18,
    lean: -.035 - variation(i, 37) * .09, rest: variation(i, 43),
    reaction: Math.floor(variation(i, 59) * 10), delay: .08 + variation(i, 61) * .42,
    duration: 1.25 + variation(i, 73) * .65, cadence: 10 + variation(i, 89) * 4,
  }));
  private readonly heads: THREE.InstancedMesh;
  private readonly arms: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly shoulder = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private wasCelebrating = false;
  private resting = true;
  private celebrationStart = 0;
  private lastTime = -Infinity;
  private lastPose = -Infinity;
  private lastAttention = -Infinity;

  constructor(scene: THREE.Scene) {
    const count = this.spectators.length;
    const sphere = new THREE.SphereGeometry(1, 6, 4), box = new THREE.BoxGeometry(1, 1, 1);
    const fabric = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .94 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .96, vertexColors: true });
    const heads = this.heads = new THREE.InstancedMesh(sphere, fabric, count * 2);
    const shirts = new THREE.InstancedMesh(packedBoxes(box, [
      [0, .405, -.015, .39, .54, .25, 1, .84],
      [-.205, .585, -.015, .14, .17, .22, 1],
      [.205, .585, -.015, .14, .17, .22, 1],
    ]), fabric, count);
    const legs = new THREE.InstancedMesh(packedBoxes(box, [
      [-.105, .085, -.235, .15, .14, .43, 1], [.105, .085, -.22, .15, .14, .43, 1],
      [-.105, -.16, -.49, .115, .4, .12, 1], [.105, -.16, -.475, .115, .4, .12, 1],
      [-.105, -.385, -.55, .13, .075, .24, .18], [.105, -.385, -.535, .13, .075, .24, .18],
    ]), trousers, count);
    box.dispose();
    this.arms = new THREE.InstancedMesh(new THREE.CylinderGeometry(.034, .041, 1, 4), fabric, count * 4);
    heads.name = 'tennis-crowd-heads'; shirts.name = 'tennis-crowd-shirts';
    legs.name = 'tennis-crowd-legs'; this.arms.name = 'tennis-crowd-arms';
    const shirtColors = [0xddd2b8, 0x597c99, 0xe5e1d2, 0xa2675b, 0x4b7170, 0xb5a65e, 0x69758a, 0x83988d, 0x9a879c, 0x344c65];
    const skinColors = [0xd1a27c, 0x8c5c43, 0xe3b994, 0xa87751, 0x704b39, 0xc18a65];
    const hairColors = [0x302b29, 0x594236, 0x9b7751, 0xc2b291, 0x898984, 0x45312c];
    const trouserColors = [0x354453, 0x4a5149, 0x69635a, 0x42434b, 0x687282];
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const person = this.spectators[i], height = person.height;
      const skin = skinColors[Math.floor(variation(i, 101) * skinColors.length)];
      this.setPart(shirts, i, person, 0, 0, 0, person.width, height, 1, Math.atan(person.lean));
      this.setPart(legs, i, person, 0, 0, 0, person.width, 1, 1);
      heads.setColorAt(i * 2, color.setHex(skin));
      heads.setColorAt(i * 2 + 1, color.setHex(hairColors[Math.floor(variation(i, 109) * hairColors.length)]));
      shirts.setColorAt(i, color.setHex(shirtColors[Math.floor(variation(i, 127) * shirtColors.length)]));
      legs.setColorAt(i, color.setHex(trouserColors[Math.floor(variation(i, 131) * trouserColors.length)]));
      color.setHex(skin);
      for (let arm = 0; arm < 4; arm++) this.arms.setColorAt(i * 4 + arm, color);
    }
    for (const mesh of [heads, shirts, legs, this.arms]) {
      mesh.instanceMatrix.setUsage(mesh === heads || mesh === this.arms ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    }
    this.poseHeads(0, true);
    this.poseArms(0, true);
    // Ownership stays with the renderer's scene-wide, deduplicated resource disposal.
  }

  update(time: number, celebrate: boolean): void {
    if (!Number.isFinite(time)) return;
    const rewound = time < this.lastTime;
    this.lastTime = time;
    // Tiny, infrequent glances, not continuous body movement. One head-buffer upload at most 2 Hz.
    if (rewound || time - this.lastAttention >= .5) {
      this.poseHeads(time, false); this.lastAttention = time;
    }
    if (celebrate && (!this.wasCelebrating || rewound)) {
      this.celebrationStart = time; this.lastPose = -Infinity; this.resting = false;
    }
    this.wasCelebrating = celebrate;
    if (this.resting) return;
    const elapsed = time - this.celebrationStart;
    // A held 'over' phase must not produce an endless, synchronised stadium wave.
    if (!celebrate || elapsed >= 2.5) {
      this.poseArms(0, true); this.resting = true; this.lastPose = time;
      return;
    }
    if (time - this.lastPose < 1 / 12) return;
    this.poseArms(elapsed, false); this.lastPose = time;
  }

  private point(target: THREE.Vector3, person: Spectator, x: number, y: number, z: number): void {
    x *= person.width; y *= person.height; z += person.lean * y;
    target.set(person.seat.x + x * person.cos + z * person.sin, person.seat.y + y,
      person.seat.z - x * person.sin + z * person.cos);
  }

  private setPart(mesh: THREE.InstancedMesh, index: number, person: Spectator, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, pitch = 0, turn = 0): void {
    this.point(this.dummy.position, person, x, y, z);
    this.dummy.rotation.set(pitch, person.seat.angle + turn, 0, 'YXZ');
    this.dummy.scale.set(sx, sy, sz); this.dummy.updateMatrix();
    mesh.setMatrixAt(index, this.dummy.matrix);
  }

  private segment(index: number, person: Spectator, from: THREE.Vector3, to: THREE.Vector3): void {
    this.direction.subVectors(to, from);
    const length = this.direction.length();
    this.direction.multiplyScalar(1 / Math.max(length, .000001));
    this.dummy.position.copy(from).add(to).multiplyScalar(.5);
    this.dummy.quaternion.setFromUnitVectors(this.up, this.direction);
    this.dummy.scale.set(person.width, length, 1); this.dummy.updateMatrix();
    this.arms.setMatrixAt(index, this.dummy.matrix);
  }

  private poseHeads(time: number, resting: boolean): void {
    for (let i = 0; i < this.spectators.length; i++) {
      const person = this.spectators[i], height = person.height;
      const cycle = (time % 11 + variation(i, 149) * 11 + 11) % 11;
      const attention = !resting && cycle < 2.4 ? Math.sin(cycle * Math.PI / 2.4) ** 2 : 0;
      const turn = (variation(i, 107) - .5) * .22 + attention * .055 * (variation(i, 151) < .5 ? -1 : 1);
      const pitch = person.lean * .5 - attention * .028, shift = attention * -.006;
      const hair = variation(i, 103), bald = hair < .14;
      this.setPart(this.heads, i * 2, person, 0, .82, -.025 + shift, .113, .142 * height, .108, pitch, turn);
      // Half-embedded crowns leave the face exposed; cropped, fuller and bald silhouettes.
      this.setPart(this.heads, i * 2 + 1, person, 0, bald ? .82 : .90, (bald ? -.025 : .006) + shift,
        bald ? .001 : .119, bald ? .001 : (.065 + hair * .025) * height, bald ? .001 : .114, pitch, turn);
    }
    this.heads.instanceMatrix.needsUpdate = true;
  }

  private poseArms(elapsed: number, resting: boolean): void {
    for (let i = 0; i < this.spectators.length; i++) {
      const person = this.spectators[i];
      if (!resting && person.reaction >= 5) continue;
      const age = elapsed - person.delay;
      let activity = 0;
      if (!resting && age > 0 && age < person.duration) {
        const attack = Math.min(1, age / .22), release = Math.min(1, (person.duration - age) / .4);
        activity = attack * attack * (3 - 2 * attack) * release * release * (3 - 2 * release);
      }
      const clap = .5 + .5 * Math.sin(Math.max(0, age) * person.cadence + person.rest * Math.PI);
      for (let arm = 0; arm < 2; arm++) {
        const sign = arm ? 1 : -1;
        const restX = .15 + person.rest * .035, restY = .17 + (arm ? person.rest : 1 - person.rest) * .035;
        let elbowX = .225, elbowY = .35, elbowZ = -.15;
        let handX = restX, handY = restY, handZ = -.35 + person.rest * .03;
        if (person.reaction < 4) {
          elbowX += activity * .015; elbowY += activity * .045; elbowZ -= activity * .04;
          handX += activity * (.035 + clap * .065 - handX);
          handY += activity * (.48 - handY); handZ += activity * (-.32 - handZ);
        } else if (person.reaction === 4 && arm === (i % 2)) {
          elbowX += activity * .04; elbowY += activity * .10; elbowZ -= activity * .04;
          handX += activity * (.25 - handX); handY += activity * (.72 - handY);
          handZ += activity * (-.24 - handZ);
        }
        this.point(this.shoulder, person, sign * .19, .61, -.015);
        this.point(this.elbow, person, sign * elbowX, elbowY, elbowZ);
        this.point(this.hand, person, sign * handX, handY, handZ);
        this.segment(i * 4 + arm * 2, person, this.shoulder, this.elbow);
        this.segment(i * 4 + arm * 2 + 1, person, this.elbow, this.hand);
      }
    }
    this.arms.instanceMatrix.needsUpdate = true;
  }
}
