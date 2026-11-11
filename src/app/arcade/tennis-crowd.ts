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

/** Shared geometry and four instanced draws, rather than hundreds of separate character meshes. */
export class TennisCrowd {
  private readonly seats = tennisAudienceSeats();
  private readonly arms: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private cheering = false;
  private lastPose = -Infinity;
  constructor(scene: THREE.Scene) {
    const sphere = new THREE.SphereGeometry(1, 8, 6), box = new THREE.BoxGeometry(1, 1, 1);
    const heads = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), this.seats.length);
    const bodies = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95 }), this.seats.length);
    const legs = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0x354453, roughness: .95 }), this.seats.length * 2);
    this.arms = new THREE.InstancedMesh(new THREE.CylinderGeometry(.037, .046, 1, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), this.seats.length * 4);
    const shirts = [0xdbcab0, 0x597c99, 0xe3d9c1, 0xa2675b, 0x4b7170, 0xb5a65e, 0x69758a, 0xb1b7b2];
    const skins = [0xd1a27c, 0x8c5c43, 0xe3b994, 0xa87751, 0x704b39];
    this.seats.forEach((seat, i) => {
      this.setPart(heads, i, seat, 0, 1.02, 0, .12, .145, .12);
      this.setPart(bodies, i, seat, 0, .66, .015, .195, .29, .12);
      heads.setColorAt(i, new THREE.Color(skins[i % skins.length])); bodies.setColorAt(i, new THREE.Color(shirts[(i * 7) % shirts.length]));
      for (let side = 0; side < 2; side++) {
        this.setPart(legs, i * 2 + side, seat, (side ? 1 : -1) * .105, .19, -.19, .095, .36, .28);
        this.arms.setColorAt(i * 4 + side * 2, new THREE.Color(skins[i % skins.length]));
        this.arms.setColorAt(i * 4 + side * 2 + 1, new THREE.Color(skins[i % skins.length]));
      }
    });
    for (const mesh of [heads, bodies, legs, this.arms]) {
      mesh.instanceMatrix.setUsage(mesh === this.arms ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    }
    this.poseArms(0, false);
  }
  update(time: number, celebrate: boolean): void {
    if (!celebrate && !this.cheering) return;
    if (celebrate && this.cheering && time >= this.lastPose && time - this.lastPose < 1 / 12) return;
    this.lastPose = time;
    this.poseArms(time, celebrate); this.cheering = celebrate;
  }
  private point(seat: SpectatorSeat, x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(seat.x + x * Math.cos(seat.angle) + z * Math.sin(seat.angle), seat.y + y, seat.z - x * Math.sin(seat.angle) + z * Math.cos(seat.angle));
  }
  private setPart(mesh: THREE.InstancedMesh, index: number, seat: SpectatorSeat, x: number, y: number, z: number, sx: number, sy: number, sz: number): void {
    this.dummy.position.copy(this.point(seat, x, y, z)); this.dummy.rotation.set(0, seat.angle, 0); this.dummy.scale.set(sx, sy, sz); this.dummy.updateMatrix();
    mesh.setMatrixAt(index, this.dummy.matrix);
  }
  private segment(index: number, from: THREE.Vector3, to: THREE.Vector3): void {
    const direction = to.clone().sub(from);
    this.dummy.position.copy(from).add(to).multiplyScalar(.5); this.dummy.quaternion.setFromUnitVectors(this.up, direction.clone().normalize());
    this.dummy.scale.set(1, direction.length(), 1); this.dummy.updateMatrix(); this.arms.setMatrixAt(index, this.dummy.matrix);
  }
  private poseArms(time: number, cheer: boolean): void {
    this.seats.forEach((seat, i) => {
      const raised = cheer && i % 3 === 0, clap = Math.sin(time * 13 + i * 1.7);
      for (let arm = 0; arm < 2; arm++) {
        const sign = arm ? 1 : -1;
        const shoulder = this.point(seat, sign * .19, .8, 0);
        const elbow = this.point(seat, sign * (raised ? .29 : .22), raised ? 1.05 : .54, -.19);
        const hand = this.point(seat, sign * (cheer ? .065 + .055 * clap : .16), raised ? 1.42 + .05 * clap : cheer ? .85 : .34, -.34);
        this.segment(i * 4 + arm * 2, shoulder, elbow); this.segment(i * 4 + arm * 2 + 1, elbow, hand);
      }
    });
    this.arms.instanceMatrix.needsUpdate = true;
  }
}
