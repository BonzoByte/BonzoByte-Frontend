import * as THREE from 'three';
import { TennisCrowd, tennisAudienceSeats } from './tennis-crowd';

describe('Lightweight 3D tennis audience', () => {
  let scene: THREE.Scene, audience: TennisCrowd, meshes: THREE.InstancedMesh[], arms: THREE.InstancedMesh;

  beforeEach(() => {
    scene = new THREE.Scene(); audience = new TennisCrowd(scene);
    meshes = scene.children as THREE.InstancedMesh[];
    arms = scene.getObjectByName('tennis-crowd-arms') as THREE.InstancedMesh;
  });

  afterEach(() => {
    // Mirror renderer ownership: shared geometries/materials are disposed only once.
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    for (const mesh of meshes) {
      geometries.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
      mesh.dispose();
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    scene.clear();
  });

  function snapshot(mesh: THREE.InstancedMesh): number[] {
    return Array.from(mesh.instanceMatrix.array);
  }

  function changedSpectators(before: readonly number[]): number {
    const after = arms.instanceMatrix.array;
    let changed = 0;
    for (let spectator = 0; spectator < 248; spectator++) {
      for (let component = spectator * 64; component < (spectator + 1) * 64; component++) {
        if (before[component] !== after[component]) { changed++; break; }
      }
    }
    return changed;
  }

  function localHand(index: number, seat: ReturnType<typeof tennisAudienceSeats>[number]): THREE.Vector3 {
    const matrix = new THREE.Matrix4(); arms.getMatrixAt(index, matrix);
    const world = new THREE.Vector3(0, .5, 0).applyMatrix4(matrix);
    const dx = world.x - seat.x, dz = world.z - seat.z;
    return new THREE.Vector3(dx * Math.cos(seat.angle) - dz * Math.sin(seat.angle), world.y - seat.y,
      dx * Math.sin(seat.angle) + dz * Math.cos(seat.angle));
  }

  it('fills rear and both side stands without placing spectators on the playing surface', () => {
    const seats = tennisAudienceSeats(); expect(seats.length).toBe(248);
    expect(seats.filter(s => s.z < -20).length).toBe(88); expect(seats.filter(s => s.x < -11).length).toBe(80); expect(seats.filter(s => s.x > 11).length).toBe(80);
    expect(seats.every(s => Object.values(s).every(Number.isFinite) && s.y > 0)).toBeTrue();
    for (let row = 0; row < 4; row++) {
      const offset = row * 62;
      for (let i = 0; i < 22; i++) {
        expect(seats[offset + i]).toEqual({ x: -8.4 + i * .8, y: 1.08 + row * .5, z: -21 - row * .85, angle: Math.PI });
      }
      for (let side = 0; side < 2; side++) for (let i = 0; i < 20; i++) {
        const sign = side ? 1 : -1;
        expect(seats[offset + 22 + side * 20 + i]).toEqual({
          x: sign * (11.8 + row * .8), y: .72 + row * .46, z: -12 + i * 1.1, angle: sign * Math.PI / 2,
        });
      }
    }
    seats[0].x = 0;
    expect(tennisAudienceSeats()[0].x).toBe(-8.4);
  });

  it('keeps four draws, the original transform budget and fewer low-poly triangles', () => {
    expect(meshes.length).toBe(4);
    expect(meshes.every(child => child instanceof THREE.InstancedMesh)).toBeTrue();
    expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(248 * 8);
    const triangles = meshes.reduce((sum, mesh) => sum + mesh.geometry.getIndex()!.count / 3 * mesh.count, 0);
    // Original: two 8x6 spheres, two boxes, four five-sided capped cylinders per person.
    expect(triangles).toBeLessThan(248 * (80 * 2 + 12 * 2 + 20 * 4));
    expect(triangles).toBeLessThanOrEqual(60_512);
    expect(new Set(meshes.map(mesh => mesh.material)).size).toBe(2);
    expect(new Set(meshes.map(mesh => mesh.geometry)).size).toBe(4);
    const bufferBytes = meshes.reduce((sum, mesh) => sum + mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength
      + mesh.geometry.getIndex()!.array.byteLength
      + Object.values(mesh.geometry.attributes).reduce((bytes, attribute) => bytes + attribute.array.byteLength, 0), 0);
    expect(bufferBytes).toBeLessThan(180 * 1024);
    for (const mesh of meshes) {
      expect(Array.isArray(mesh.material)).toBeFalse();
      expect(mesh.castShadow).toBeFalse(); expect(mesh.receiveShadow).toBeFalse(); expect(mesh.frustumCulled).toBeFalse();
      const dynamic = mesh === arms || mesh.name === 'tennis-crowd-heads';
      expect(mesh.instanceMatrix.usage).toBe(dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
      expect(snapshot(mesh).every(Number.isFinite)).toBeTrue();
      expect(Array.from(mesh.instanceColor!.array).every(Number.isFinite)).toBeTrue();
    }
  });

  it('uses varied skin, hair, shirts and trousers without repeating a fixed row palette', () => {
    const heads = scene.getObjectByName('tennis-crowd-heads') as THREE.InstancedMesh;
    const shirts = scene.getObjectByName('tennis-crowd-shirts') as THREE.InstancedMesh;
    const legs = scene.getObjectByName('tennis-crowd-legs') as THREE.InstancedMesh;
    const skinColors = new Set<number>(), hairColors = new Set<number>(), shirtColors = new Set<number>(), trouserColors = new Set<number>();
    const skin = new THREE.Color(), color = new THREE.Color(), matrix = new THREE.Matrix4();
    const widths = new Set<number>(), heights = new Set<number>();
    let bald = 0;
    for (let i = 0; i < 248; i++) {
      heads.getColorAt(i * 2, skin); skinColors.add(skin.getHex());
      heads.getColorAt(i * 2 + 1, color); hairColors.add(color.getHex());
      shirts.getColorAt(i, color); shirtColors.add(color.getHex());
      legs.getColorAt(i, color); trouserColors.add(color.getHex());
      shirts.getMatrixAt(i, matrix); widths.add(matrix.elements[0]); heights.add(matrix.elements[5]);
      heads.getMatrixAt(i * 2 + 1, matrix);
      if (new THREE.Vector3().setFromMatrixScale(matrix).y < .01) bald++;
      for (let arm = 0; arm < 4; arm++) {
        arms.getColorAt(i * 4 + arm, color); expect(color.equals(skin)).toBeTrue();
      }
    }
    expect(skinColors.size).toBeGreaterThanOrEqual(5); expect(hairColors.size).toBeGreaterThanOrEqual(5);
    expect(shirtColors.size).toBe(10); expect(trouserColors.size).toBe(5);
    expect(widths.size).toBeGreaterThan(100); expect(heights.size).toBeGreaterThan(100);
    expect(bald).toBeGreaterThan(0); expect(bald).toBeLessThan(80);
    const firstRow = Array.from({ length: 22 }, (_, i) => { shirts.getColorAt(i, color); return color.getHex(); });
    const nextRow = Array.from({ length: 22 }, (_, i) => { shirts.getColorAt(i + 62, color); return color.getHex(); });
    expect(firstRow).not.toEqual(nextRow);
  });

  it('anchors seated bodies to the unchanged cushions with relaxed hands and bent, shod legs', () => {
    const seats = tennisAudienceSeats();
    const shirts = scene.getObjectByName('tennis-crowd-shirts') as THREE.InstancedMesh;
    const heads = scene.getObjectByName('tennis-crowd-heads') as THREE.InstancedMesh;
    const legs = scene.getObjectByName('tennis-crowd-legs') as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < seats.length; i++) {
      for (const mesh of [shirts, legs]) {
        mesh.getMatrixAt(i, matrix);
        expect(matrix.elements[12]).toBeCloseTo(seats[i].x, 5);
        expect(matrix.elements[13]).toBeCloseTo(seats[i].y, 5);
        expect(matrix.elements[14]).toBeCloseTo(seats[i].z, 5);
      }
      heads.getMatrixAt(i * 2, matrix);
      expect(matrix.elements[13] - seats[i].y).toBeGreaterThan(.76);
      expect(matrix.elements[13] - seats[i].y).toBeLessThan(.88);
      for (let arm = 0; arm < 2; arm++) {
        const hand = localHand(i * 4 + arm * 2 + 1, seats[i]);
        expect(hand.y).toBeGreaterThan(.15); expect(hand.y).toBeLessThan(.23);
        expect(hand.z).toBeGreaterThan(-.4); expect(hand.z).toBeLessThan(-.3);
        expect(Math.abs(hand.x)).toBeLessThan(.21);
      }
    }
    legs.geometry.computeBoundingBox();
    const bounds = legs.geometry.boundingBox!;
    expect(bounds.min.y).toBeCloseTo(-.4225, 5); expect(bounds.max.y).toBeCloseTo(.155, 5);
    expect(bounds.min.z).toBeCloseTo(-.67, 5); expect(bounds.max.z).toBeLessThan(0);
    const shades = Array.from(legs.geometry.getAttribute('color').array);
    expect(Math.min(...shades)).toBeCloseTo(.18, 5); expect(Math.max(...shades)).toBe(1);
  });

  it('keeps idle bodies and limbs still while throttling quiet head attention to two Hz', () => {
    const heads = scene.getObjectByName('tennis-crowd-heads') as THREE.InstancedMesh;
    const stillMeshes = meshes.filter(mesh => mesh !== heads);
    const versions = stillMeshes.map(mesh => mesh.instanceMatrix.version);
    const resting = snapshot(arms);
    audience.update(0, false);
    const headVersion = heads.instanceMatrix.version;
    audience.update(.1, false); audience.update(.25, false);
    expect(heads.instanceMatrix.version).toBe(headVersion);
    audience.update(.5, false);
    expect(heads.instanceMatrix.version).toBe(headVersion + 1);
    audience.update(100, false); audience.update(1, false);
    expect(snapshot(arms)).toEqual(resting);
    expect(stillMeshes.map(mesh => mesh.instanceMatrix.version)).toEqual(versions);
  });

  it('limits staggered attention to tiny glances without moving head height or body anchors', () => {
    const heads = scene.getObjectByName('tennis-crowd-heads') as THREE.InstancedMesh;
    const resting = snapshot(heads), matrix = new THREE.Matrix4(), base = new THREE.Matrix4();
    const rotation = new THREE.Quaternion(), baseRotation = new THREE.Quaternion();
    audience.update(0, false);
    let changed = 0;
    for (let i = 0; i < 248; i++) {
      const index = i * 2;
      heads.getMatrixAt(index, matrix); base.fromArray(resting, index * 16);
      if (matrix.elements.some((value, component) => value !== base.elements[component])) changed++;
      expect(matrix.elements[13]).toBe(base.elements[13]);
      const shift = Math.hypot(matrix.elements[12] - base.elements[12], matrix.elements[14] - base.elements[14]);
      expect(shift).toBeLessThan(.00601);
      matrix.decompose(new THREE.Vector3(), rotation, new THREE.Vector3());
      base.decompose(new THREE.Vector3(), baseRotation, new THREE.Vector3());
      expect(rotation.angleTo(baseRotation)).toBeLessThan(.07);
    }
    expect(changed).toBeGreaterThan(0); expect(changed).toBeLessThan(248 / 2);
  });

  it('staggers brief, seated reactions among only part of the crowd', () => {
    const resting = snapshot(arms);
    const staticMeshes = meshes.filter(mesh => mesh !== arms && mesh.name !== 'tennis-crowd-heads');
    const staticVersions = staticMeshes.map(mesh => mesh.instanceMatrix.version);
    const seats = tennisAudienceSeats();
    audience.update(7, true);
    expect(snapshot(arms)).toEqual(resting);
    audience.update(7.125, true);
    const early = changedSpectators(resting);
    audience.update(7.75, true);
    expect(early).toBeGreaterThan(0);
    expect(changedSpectators(resting)).toBeGreaterThan(early);
    expect(changedSpectators(resting)).toBeLessThan(248 * .65);
    for (let i = 0; i < seats.length; i++) for (let arm = 0; arm < 2; arm++) {
      const hand = localHand(i * 4 + arm * 2 + 1, seats[i]);
      expect(hand.y).toBeLessThan(.8); expect(Math.abs(hand.x)).toBeLessThan(.3);
    }
    expect(snapshot(arms).every(Number.isFinite)).toBeTrue();
    expect(staticMeshes.map(mesh => mesh.instanceMatrix.version)).toEqual(staticVersions);
  });

  it('limits celebration uploads to twelve per second without dropping a stop', () => {
    const resting = snapshot(arms);
    audience.update(0, true); audience.update(.5, true);
    const version = arms.instanceMatrix.version, pose = snapshot(arms);
    audience.update(.51, true); audience.update(.52, true);
    expect(arms.instanceMatrix.version).toBe(version); expect(snapshot(arms)).toEqual(pose);
    audience.update(.625, true);
    expect(arms.instanceMatrix.version).toBe(version + 1);
    audience.update(.626, false);
    expect(arms.instanceMatrix.version).toBe(version + 2); expect(snapshot(arms)).toEqual(resting);
    audience.update(.627, false);
    expect(arms.instanceMatrix.version).toBe(version + 2);
  });

  it('settles exactly back to rest even when the match-over flag stays true', () => {
    const resting = snapshot(arms);
    audience.update(10, true); audience.update(10.75, true);
    expect(changedSpectators(resting)).toBeGreaterThan(0);
    audience.update(12.5, true);
    expect(snapshot(arms)).toEqual(resting);
    const settledVersion = arms.instanceMatrix.version;
    audience.update(13, true); audience.update(100, true);
    expect(arms.instanceMatrix.version).toBe(settledVersion);
    expect(snapshot(arms)).toEqual(resting);
    audience.update(101, false); audience.update(102, true); audience.update(102.75, true);
    expect(changedSpectators(resting)).toBeGreaterThan(0);
  });

  it('fades individual applause before resetting the held celebration', () => {
    const resting = snapshot(arms);
    audience.update(0, true); audience.update(.75, true);
    const early = changedSpectators(resting);
    audience.update(2.125, true);
    const late = changedSpectators(resting);
    expect(late).toBeGreaterThan(0); expect(late).toBeLessThan(early);
    audience.update(2.5, true);
    expect(snapshot(arms)).toEqual(resting);
  });

  it('restarts a bounded reaction when the presentation clock rewinds', () => {
    const resting = snapshot(arms);
    audience.update(100, true); audience.update(100.75, true);
    const firstReaction = snapshot(arms);
    audience.update(1, true);
    expect(snapshot(arms)).toEqual(resting);
    audience.update(1.75, true);
    expect(snapshot(arms)).toEqual(firstReaction);
    audience.update(.5, false);
    expect(snapshot(arms)).toEqual(resting);
  });

  it('ignores invalid times without corrupting the pose or celebration latch', () => {
    const resting = snapshot(arms), version = arms.instanceMatrix.version;
    audience.update(NaN, true); audience.update(Infinity, true); audience.update(-Infinity, true);
    expect(snapshot(arms)).toEqual(resting); expect(arms.instanceMatrix.version).toBe(version);
    audience.update(10, true); audience.update(10.75, true);
    const active = snapshot(arms), activeVersion = arms.instanceMatrix.version;
    audience.update(NaN, false); audience.update(Infinity, false);
    expect(snapshot(arms)).toEqual(active); expect(arms.instanceMatrix.version).toBe(activeVersion);
    audience.update(11, false);
    expect(snapshot(arms)).toEqual(resting);
  });

  it('reuses vectors, meshes and static geometry through pose updates', () => {
    const clone = spyOn(THREE.Vector3.prototype, 'clone').and.callThrough();
    const objects = [...meshes], geometries = meshes.map(mesh => mesh.geometry);
    audience.update(1, true); audience.update(1.5, true); audience.update(2, true); audience.update(3.5, true);
    expect(clone).not.toHaveBeenCalled();
    expect(scene.children).toEqual(objects); expect(meshes.map(mesh => mesh.geometry)).toEqual(geometries);
  });

  it('constructs the same visible audience and reactions without consuming random state', () => {
    const random = spyOn(Math, 'random').and.callThrough();
    const otherScene = new THREE.Scene(), otherAudience = new TennisCrowd(otherScene);
    const otherMeshes = otherScene.children as THREE.InstancedMesh[];
    // Three.js uses Math.random for object/resource UUIDs; visual variation must not.
    random.calls.reset();
    audience.update(0, true); otherAudience.update(0, true);
    audience.update(.75, true); otherAudience.update(.75, true);
    expect(random).not.toHaveBeenCalled();
    try {
      for (let i = 0; i < meshes.length; i++) {
        expect(snapshot(otherMeshes[i])).toEqual(snapshot(meshes[i]));
        expect(Array.from(otherMeshes[i].instanceColor!.array)).toEqual(Array.from(meshes[i].instanceColor!.array));
      }
    } finally {
      const geometries = new Set(otherMeshes.map(mesh => mesh.geometry));
      const materials = new Set(otherMeshes.map(mesh => mesh.material as THREE.Material));
      for (const mesh of otherMeshes) mesh.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      otherScene.clear();
    }
  });
});
