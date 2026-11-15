import * as THREE from 'three';
import { createTennisAthlete, type TennisAthlete } from './tennis-athlete-model';
import { tennisAthletePose, tennisAthleteStrokePreparationPose, TENNIS_ATHLETE_JOINTS as JOINTS, TENNIS_ATHLETE_FEET as FEET } from './tennis-athlete-pose';
import { tennisServeFollowThroughPose } from './tennis-serve-pose';

describe('Lightweight procedural tennis athlete', () => {
  const created: TennisAthlete[] = [];
  function athlete(opponent = false): TennisAthlete {
    const result = createTennisAthlete(opponent); created.push(result); return result;
  }
  function resources(rig: TennisAthlete) {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    rig.root.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
    return { geometries, materials };
  }
  function pose(rig: TennisAthlete, value = tennisAthletePose(0, 0, 0)): void {
    rig.root.position.y = value.bounce; rig.torso.rotation.set(...value.torso); rig.head.rotation.x = value.head;
    rig.arms.forEach((arm, i) => { arm.rotation.set(...value.arms[i]); rig.elbows[i].rotation.x = value.elbows[i]; });
    rig.legs.forEach((leg, i) => { leg.rotation.x = value.legs[i]; rig.knees[i].rotation.x = value.knees[i]; });
    rig.racket.rotation.x = value.racket; rig.root.updateMatrixWorld(true);
  }
  afterEach(() => {
    created.splice(0).forEach(rig => {
      const retained = resources(rig); retained.geometries.forEach(geometry => geometry.dispose()); retained.materials.forEach(material => material.dispose());
    });
  });

  it('returns the existing animation contract without attaching to a scene', () => {
    for (const opponent of [false, true]) {
      const rig = athlete(opponent);
      expect(rig.root.parent).toBeNull(); expect(rig.torso.parent).toBe(rig.root); expect(rig.head.parent).toBe(rig.torso);
      expect(rig.torso.position.y).toBe(JOINTS.torsoHeight); expect(rig.racket.parent).toBe(rig.elbows[1]);
      expect(rig.arms.length).toBe(2); expect(rig.elbows.length).toBe(2); expect(rig.legs.length).toBe(2); expect(rig.knees.length).toBe(2);
      for (let i = 0; i < 2; i++) {
        expect(rig.arms[i].position.toArray()).toEqual([(i ? 1 : -1) * JOINTS.shoulderWidth, JOINTS.shoulderHeight, JOINTS.shoulderForward]);
        expect(rig.elbows[i].position.y).toBe(-JOINTS.elbowDrop);
        expect(rig.legs[i].position.y).toBe(FEET.hipHeight); expect(rig.knees[i].position.y).toBe(-FEET.kneeDrop);
      }
      expect(rig.racket.position.toArray()).toEqual([0, -JOINTS.handDrop, JOINTS.gripForward]);
    }
  });

  it('batches facial, clothing and shoe detail into a small draw-call and triangle budget', () => {
    const rig = athlete(); let meshes = 0, lines = 0, triangles = 0;
    rig.root.traverse(object => {
      expect(object instanceof THREE.SkinnedMesh).toBeFalse();
      if (object instanceof THREE.Mesh) { meshes++; triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3; }
      if (object instanceof THREE.LineSegments) lines++;
    });
    expect(meshes).toBeLessThanOrEqual(14); expect(lines).toBe(1); expect(triangles).toBeLessThan(12000);
    expect(resources(rig).materials.size).toBe(3);
  });

  it('retains only finite ordinary geometry, vertex colours and texture-free materials', () => {
    const retained = resources(athlete(true));
    retained.geometries.forEach(geometry => {
      const position = geometry.getAttribute('position');
      for (let i = 0; i < position.array.length; i++) expect(Number.isFinite(position.array[i])).toBeTrue();
    });
    retained.materials.forEach(material => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return;
      expect(material.vertexColors).toBeTrue(); expect(material.map).toBeNull(); expect(material.normalMap).toBeNull();
    });
  });

  it('uses adult head proportions with face details on local -Z', () => {
    const rig = athlete(), headBounds = new THREE.Box3().setFromObject(rig.head), size = headBounds.getSize(new THREE.Vector3());
    expect(size.y).toBeLessThan(.29); expect(size.x).toBeLessThan(.26); expect(size.y).toBeGreaterThan(.23);
    expect(headBounds.min.z).toBeLessThan(-.12); // Nose projects in the forward direction.
    pose(rig); const full = new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3());
    expect(full.y / size.y).toBeGreaterThan(6.8);
  });

  it('holds the grip at the wrist and keeps the hand attached when the wrist opens', () => {
    const rig = athlete(); pose(rig);
    const hand = rig.racket.getObjectByName('closed-racket-grip-and-thumb')!;
    expect(hand.parent).toBe(rig.racket);
    const wrist = rig.elbows[1].localToWorld(new THREE.Vector3(0, -JOINTS.handDrop, 0));
    expect(rig.racket.getWorldPosition(new THREE.Vector3()).distanceTo(wrist)).toBeLessThan(.03);
    const local = hand.position.clone(); rig.racket.rotation.x -= .5; rig.root.updateMatrixWorld(true);
    expect(hand.position.equals(local)).toBeTrue();
    expect(rig.racket.getWorldPosition(new THREE.Vector3()).distanceTo(wrist)).toBeLessThan(.03);
  });

  it('keeps both hands above the actual head at service contact for either facing direction', () => {
    for (const side of [0, 1]) {
      const rig = athlete(Boolean(side)); rig.root.rotation.y = side ? Math.PI : 0; pose(rig, tennisServeFollowThroughPose(.4));
      const headTop = new THREE.Box3().setFromObject(rig.head).max.y;
      for (const elbow of rig.elbows) expect(elbow.localToWorld(new THREE.Vector3(0, -JOINTS.handDrop, 0)).y).toBeGreaterThan(headTop);
    }
  });

  it('has a contact sole near the court through the running cycle', () => {
    const rig = athlete();
    for (let frame = 0; frame < 32; frame++) {
      pose(rig, tennisAthletePose(5, 0, frame / 32 * Math.PI / 6));
      const shoes = rig.knees.map(knee => new THREE.Box3().setFromObject(knee.children.find(child => child.name.endsWith('-shoe'))!, true).min.y);
      expect(Math.min(...shoes)).toBeLessThan(.02);
      expect(Math.min(...shoes)).toBeGreaterThan(0);
    }
  });

  it('does not share disposed scene resources with a later match', () => {
    const first = resources(athlete()), second = resources(athlete());
    first.geometries.forEach(geometry => expect(second.geometries.has(geometry)).toBeFalse());
    first.materials.forEach(material => expect(second.materials.has(material)).toBeFalse());
  });
  it('keeps held-stroke preparation hands below the head and a shoe planted', () => {
    const rig = athlete();
    for (const shot of ['drive', 'drop', 'lob', 'smash'] as const) for (const charge of [0, .25, .5, .75, 1, 1.3]) {
      pose(rig, tennisAthleteStrokePreparationPose(charge, shot, true));
      const head = new THREE.Box3().setFromObject(rig.head);
      for (const elbow of rig.elbows) expect(elbow.localToWorld(new THREE.Vector3(0, -JOINTS.handDrop, 0)).y).toBeLessThan(head.min.y);
      const shoes = rig.knees.map(knee => new THREE.Box3().setFromObject(knee.children.find(child => child.name.endsWith('-shoe'))!, true).min.y);
      expect(Math.min(...shoes)).toBeGreaterThan(0); expect(Math.min(...shoes)).toBeLessThan(.02);
    }
  });
});
