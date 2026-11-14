import * as THREE from 'three';
import { TENNIS_ATHLETE_JOINTS as JOINTS, TENNIS_ATHLETE_FEET as FEET } from './tennis-athlete-pose';

export interface TennisAthlete {
  root: THREE.Group; torso: THREE.Group; head: THREE.Group;
  arms: THREE.Group[]; elbows: THREE.Group[]; legs: THREE.Group[]; knees: THREE.Group[];
  racket: THREE.Group;
}

type Triple = [number, number, number];
type Ring = [height: number, width: number, depth: number, forward?: number];

/** Bake static detail into one vertex-coloured mesh per animated joint, not one draw call per detail. */
class JointSurface {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];

  constructor(private readonly material: THREE.MeshStandardMaterial) {}

  part(geometry: THREE.BufferGeometry, color: number, position: Triple = [0, 0, 0], scale: Triple = [1, 1, 1], rotation: Triple = [0, 0, 0]): void {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    this.transformed(geometry, color, matrix);
  }

  segment(geometry: THREE.BufferGeometry, color: number, start: Triple, end: Triple, radius: number): void {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), direction = b.clone().sub(a);
    this.transformed(geometry, color, new THREE.Matrix4().compose(a.add(b).multiplyScalar(.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
      new THREE.Vector3(radius, direction.length(), radius)));
  }

  private transformed(geometry: THREE.BufferGeometry, hex: number, matrix: THREE.Matrix4): void {
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    const offset = this.positions.length / 3, normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const vertex = new THREE.Vector3(), colour = new THREE.Color(hex);
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(matrix); this.positions.push(vertex.x, vertex.y, vertex.z);
      vertex.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize(); this.normals.push(vertex.x, vertex.y, vertex.z);
      this.colors.push(colour.r, colour.g, colour.b);
    }
    const index = geometry.getIndex();
    for (let i = 0; i < (index?.count ?? position.count); i++) this.indices.push(offset + (index ? index.getX(i) : i));
  }

  attach(group: THREE.Group, name: string): void {
    if (!this.positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material); mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
}

/** Elliptical cross-sections give cloth, muscle and shoe silhouettes without cylinder-shaped limbs. */
function contour(rings: Ring[], segments = 12): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  for (const [y, width, depth, z = 0] of rings) for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
    positions.push(Math.cos(angle) * width, y, z + Math.sin(angle) * depth);
  }
  for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < segments; i++) {
    const a = row * segments + i, b = row * segments + (i + 1) % segments, c = a + segments, d = b + segments;
    indices.push(a, c, b, b, c, d);
  }
  const bottom = positions.length / 3, top = bottom + 1;
  positions.push(0, rings[0][0], rings[0][3] ?? 0, 0, rings[rings.length - 1][0], rings[rings.length - 1][3] ?? 0);
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments, last = (rings.length - 1) * segments;
    indices.push(bottom, i, next, top, last + next, last + i);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/**
 * Local -Z is the face/net direction. The factory owns no scene, textures, animations or global GPU cache.
 * Templates are reused while baking; retained meshes share just two materials within this athlete.
 * Everything retained is an ordinary Mesh/LineSegments, disposable by the existing scene traversal.
 */
export function createTennisAthlete(opponent: boolean): TennisAthlete {
  const root = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group();
  root.name = opponent ? 'tennis-athlete-opponent' : 'tennis-athlete-player';
  torso.name = 'torso'; head.name = 'head'; root.add(torso); torso.position.y = JOINTS.torsoHeight;
  head.position.y = .81; head.scale.set(.88, .84, .9); torso.add(head);
  const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82, metalness: 0 });
  const racketMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .43, metalness: .24 });
  const templates = new Map<string, THREE.BufferGeometry>();
  const shape = (name: string, rings: Ring[], segments = 12) => {
    let geometry = templates.get(name);
    if (!geometry) { geometry = contour(rings, segments); templates.set(name, geometry); }
    return geometry;
  };
  const sphere = new THREE.SphereGeometry(1, 10, 7), box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const hairCap = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * .39);
  const rim = new THREE.TorusGeometry(.17, .011, 6, 32);
  [sphere, box, cylinder, hairCap, rim].forEach((geometry, i) => templates.set(`primitive-${i}`, geometry));
  const skin = opponent ? 0x9d694d : 0xd5a583, skinShade = opponent ? 0x80543e : 0xba8769;
  const shirt = opponent ? 0x377d94 : 0xebe8dd, panel = opponent ? 0x22546c : 0xd2d7ce;
  const trim = opponent ? 0xf1d9a9 : 0x25596a, shorts = 0x233743, seam = 0x405460;
  const hair = opponent ? 0x241d1a : 0x4a3327, sole = 0xc7cec9, shoe = 0xf1f1e7;
  const body = new JointSurface(bodyMaterial);
  body.part(shape('shirt', [[-.015, .176, .113], [.12, .181, .111], [.28, .218, .135], [.43, .239, .128], [.49, .218, .115], [.55, .085, .069]]), shirt);
  // Woven side panels, a restrained chest mark and a separate collar/neck silhouette.
  for (const side of [-1, 1]) {
    body.part(sphere, panel, [side * .183, .22, .012], [.039, .205, .104]);
    body.part(box, trim, [side * .128, .405, -.124], [.06, .012, .009]);
  }
  body.part(shape('collar', [[.535, .086, .071], [.559, .079, .067]]), trim);
  body.part(shape('neck', [[.55, .061, .057, .012], [.65, .063, .06, .014], [.72, .072, .066, .008]]), skin);
  body.part(shape('waist', [[-.13, .184, .128], [-.045, .188, .132], [.013, .177, .116]]), shorts);
  body.part(shape('waistband', [[-.019, .18, .119], [.005, .179, .118]]), seam);
  body.attach(torso, 'tailored-shirt-and-waist');

  const face = new JointSurface(bodyMaterial);
  face.part(shape('face', [[-.147, .05, .055], [-.119, .085, .08], [-.065, .109, .101], [.02, .12, .109], [.086, .111, .099], [.139, .077, .071], [.16, .025, .025]]), skin);
  for (const side of [-1, 1]) {
    face.part(sphere, skin, [side * .119, -.008, .006], [.023, .044, .025]);
    face.part(sphere, skinShade, [side * .131, -.009, -.008], [.008, .024, .01]);
    face.part(sphere, skin, [side * .059, -.025, -.087], [.044, .044, .029]);
    face.part(sphere, 0xf0eade, [side * .045, .026, -.103], [.022, .009, .008]);
    face.part(sphere, 0x393a31, [side * .044, .025, -.11], [.007, .007, .003]);
    face.part(box, hair, [side * .045, .049, -.104], [.043, .008, .009], [0, 0, side * -.09]);
    face.part(sphere, hair, [side * .105, .044, .016], [.018, .055, .056]);
  }
  face.part(sphere, skin, [0, -.011, -.112], [.021, .036, .031]);
  face.part(sphere, skinShade, [0, -.034, -.133], [.022, .009, .009]);
  face.part(box, skinShade, [0, -.072, -.097], [.037, .004, .007]);
  face.part(sphere, skin, [0, -.105, -.074], [.048, .022, .025]);
  face.part(hairCap, hair, [0, .006, .008], [.125, .164, .114], [0, 0, opponent ? -.06 : .08]);
  face.part(sphere, hair, [0, .06, .072], [.11, .102, .052]);
  face.part(shape('headband', [[.065, .119, .108, .006], [.083, .116, .105, .006]]), trim);
  face.attach(head, 'sculpted-face-hair-and-headband');

  const arms: THREE.Group[] = [], elbows: THREE.Group[] = [], legs: THREE.Group[] = [], knees: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(), elbow = new THREE.Group(), upper = new JointSurface(bodyMaterial), lower = new JointSurface(bodyMaterial);
    arm.name = side < 0 ? 'toss-arm' : 'racket-arm'; elbow.name = `${arm.name}-elbow`;
    arm.position.set(side * JOINTS.shoulderWidth, JOINTS.shoulderHeight, JOINTS.shoulderForward);
    elbow.position.y = -JOINTS.elbowDrop; torso.add(arm); arm.add(elbow); arms.push(arm); elbows.push(elbow);
    upper.part(sphere, shirt, [0, -.021, .005], [.094, .095, .091]);
    upper.part(shape('sleeve', [[-.15, .075, .071], [-.12, .081, .077], [-.025, .092, .085], [.025, .074, .07]]), shirt);
    upper.part(shape('sleeve-hem', [[-.155, .076, .072], [-.137, .078, .074]]), trim);
    upper.part(shape('upper-arm', [[-.3, .047, .048], [-.25, .056, .057], [-.185, .067, .063], [-.12, .069, .065]]), skin);
    upper.attach(arm, 'sleeve-and-shaped-upper-arm');
    lower.part(sphere, skin, [0, 0, 0], [.049, .051, .049]);
    lower.part(shape('forearm', [[-.237, .031, .032], [-.18, .037, .036], [-.09, .053, .047], [0, .048, .048]]), skin);
    lower.part(shape('wristband', [[-.228, .037, .038], [-.189, .041, .039]]), opponent ? trim : shoe);
    if (side < 0) {
      lower.part(sphere, skin, [0, -.26, -.002], [.039, .054, .025]);
      lower.part(sphere, skin, [.03, -.25, -.02], [.016, .035, .016], [0, 0, -.32]);
      for (let finger = 0; finger < 4; finger++) {
        lower.part(sphere, skin, [-.025 + finger * .016, -.303 + Math.abs(finger - 1.5) * .006, -.004], [.009, .026, .012], [.14, 0, 0]);
      }
    } else lower.part(sphere, skin, [0, -.237, 0], [.033, .024, .033]);
    lower.attach(elbow, 'forearm-wrist-and-hand');

    const leg = new THREE.Group(), knee = new THREE.Group(), foot = new THREE.Group();
    leg.name = side < 0 ? 'left-hip' : 'right-hip'; knee.name = `${leg.name}-knee`; foot.name = `${leg.name}-shoe`;
    leg.position.set(side * .12, FEET.hipHeight, 0); knee.position.y = -FEET.kneeDrop;
    foot.position.y = -FEET.ankleDrop; foot.rotation.x = FEET.anklePitch;
    root.add(leg); leg.add(knee); knee.add(foot); legs.push(leg); knees.push(knee);
    const thigh = new JointSurface(bodyMaterial), shin = new JointSurface(bodyMaterial), footwear = new JointSurface(bodyMaterial);
    thigh.part(shape('thigh', [[-.38, .065, .068], [-.3, .08, .084], [-.22, .094, .094], [-.12, .102, .101]]), skin);
    thigh.part(shape('short-leg', [[-.205, .109, .109], [-.16, .115, .116], [-.04, .123, .127], [.075, .1, .11]]), shorts);
    thigh.part(box, seam, [side * .114, -.086, -.014], [.009, .205, .122]);
    thigh.part(shape('short-hem', [[-.208, .11, .11], [-.193, .111, .111]]), seam);
    thigh.attach(leg, 'shorts-and-athletic-thigh');
    shin.part(sphere, skin, [0, -.007, -.011], [.067, .065, .069]);
    shin.part(sphere, skin, [0, -.014, -.058], [.043, .047, .021]);
    shin.part(shape('calf', [[-.35, .034, .037, .005], [-.25, .044, .047, .012], [-.15, .063, .07, .017], [-.07, .066, .064, .008], [0, .059, .06]]), skin);
    shin.part(shape('sock', [[-.36, .038, .042], [-.31, .04, .045], [-.23, .049, .052, .008]]), shoe);
    shin.part(shape('sock-stripe', [[-.251, .048, .052, .008], [-.24, .05, .053, .008]]), trim);
    shin.attach(knee, 'knee-calf-and-sock');
    footwear.part(shape('outsole', [[-FEET.soleDrop, .077, .163, -.065], [-.075, .081, .163, -.065]]), sole);
    footwear.part(shape('shoe-upper', [[-.074, .079, .158, -.065], [-.041, .073, .144, -.052], [-.002, .05, .092, -.01], [.014, .039, .055, .013]]), shoe);
    footwear.part(sphere, trim, [side * .062, -.041, -.04], [.008, .018, .077], [0, side * -.12, 0]);
    footwear.part(box, seam, [0, -.012, -.059], [.035, .01, .073], [-.26, 0, 0]);
    for (let lace = 0; lace < 4; lace++) footwear.part(box, shoe, [0, -.004 - lace * .006, -.038 - lace * .018], [.046, .006, .006], [0, 0, (lace % 2 ? 1 : -1) * .1]);
    footwear.attach(foot, 'court-shoe-outsole-laces-and-heel');
  }

  const racket = new THREE.Group(); racket.name = 'racket-and-gripping-hand';
  racket.position.set(0, -JOINTS.handDrop, JOINTS.gripForward); racket.rotation.x = .65; elbows[1].add(racket);
  const frame = new JointSurface(racketMaterial), grip = new JointSurface(bodyMaterial), accent = opponent ? 0xe48e54 : 0x88b38e;
  frame.part(rim, accent, [0, -JOINTS.racketHeadDrop, 0], [1, 1.3, 1]);
  for (const side of [-1, 1]) frame.segment(cylinder, accent, [side * .014, -.107, 0], [side * .073, -.216, 0], .009);
  frame.part(cylinder, 0x263b42, [0, -.049, 0], [.019, .172, .017]);
  frame.part(cylinder, accent, [0, .039, 0], [.023, .012, .021]);
  // Diagonal wrap and a closed continental grip move with the wrist, never through the palm.
  for (let wrap = 0; wrap < 7; wrap++) frame.part(box, 0x647575, [0, -.12 + wrap * .021, -.017], [.038, .0035, .002], [0, 0, .28]);
  frame.attach(racket, 'racket-hoop-throat-and-wrapped-handle');
  grip.part(sphere, skin, [.017, -.005, .023], [.033, .052, .024]);
  for (let finger = 0; finger < 4; finger++) {
    const y = -.039 + finger * .023;
    // Five short sections wrap around the handle; all bake into the same hand mesh.
    for (let section = 0; section < 5; section++) {
      const a = -.2 + section * .53, b = a + .53;
      grip.segment(cylinder, skin, [Math.cos(a) * .024, y, Math.sin(a) * .024], [Math.cos(b) * .024, y - .002, Math.sin(b) * .024], .009);
    }
  }
  grip.part(sphere, skin, [-.017, .018, .012], [.015, .036, .016], [0, 0, -.48]);
  grip.attach(racket, 'closed-racket-grip-and-thumb');
  const strings: THREE.Vector3[] = [];
  for (let x = -.14; x < .141; x += .035) {
    const extent = .213 * Math.sqrt(1 - (x / .163) ** 2);
    strings.push(new THREE.Vector3(x, -JOINTS.racketHeadDrop - extent, 0), new THREE.Vector3(x, -JOINTS.racketHeadDrop + extent, 0));
  }
  for (let y = -.175; y < .176; y += .035) {
    const extent = .163 * Math.sqrt(1 - (y / .213) ** 2);
    strings.push(new THREE.Vector3(-extent, -JOINTS.racketHeadDrop + y, 0), new THREE.Vector3(extent, -JOINTS.racketHeadDrop + y, 0));
  }
  const stringBed = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strings), new THREE.LineBasicMaterial({ color: 0xcbd4c8 }));
  stringBed.name = 'racket-strings'; racket.add(stringBed);
  templates.forEach(geometry => geometry.dispose());
  return { root, torso, head, arms, elbows, legs, knees, racket };
}
