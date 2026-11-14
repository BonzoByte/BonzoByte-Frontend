import * as THREE from 'three';
import { FIELD, Player3D, Tennis3DEngine } from './tennis-3d-engine';
import type { CourtSurface } from './tennis-engine';
import { TennisCrowd } from './tennis-crowd';
import { tennisAthletePose, TENNIS_ATHLETE_JOINTS as JOINTS } from './tennis-athlete-pose';

export type TennisCamera = 'broadcast' | 'baseline';
interface Athlete {
  root: THREE.Group; torso: THREE.Group; head: THREE.Group;
  arms: THREE.Group[]; elbows: THREE.Group[]; legs: THREE.Group[]; knees: THREE.Group[]; racket: THREE.Group;
}

/** Original procedural scene. No external avatars, game assets or remote services. */
export class Tennis3DRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1000 / 540, .1, 180);
  private readonly gl: THREE.WebGLRenderer;
  private readonly sunlight = new THREE.DirectionalLight(0xfff0cf, 3.1);
  private readonly textures = new Set<THREE.Texture>();
  private readonly courtMaterial = new THREE.MeshStandardMaterial({ color: 0x608343, roughness: .96 });
  private readonly apronMaterial = new THREE.MeshStandardMaterial({ color: 0x4a7355, roughness: 1 });
  private readonly maps: Partial<Record<CourtSurface, THREE.Texture>> = {};
  private treeCards?: THREE.InstancedMesh;
  private readonly trees: { x: number; z: number; height: number }[] = [];
  private readonly athletes: Athlete[] = [];
  private readonly ball = new THREE.Group();
  private readonly ballShadow: THREE.Mesh;
  private readonly playerRing: THREE.Mesh;
  private readonly bounceRing: THREE.Mesh;
  private readonly serveMarker = new THREE.Group();
  private readonly serveGuide: THREE.LineSegments;
  private readonly serveMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xf2eea0, transparent: true, opacity: .9, depthWrite: false });
  private surface: CourtSurface | null = null;
  private dead = false;
  private cameraMode: TennisCamera = 'broadcast';
  private readonly crowd: TennisCrowd;
  private lightweight = false;
  private viewportWidth = 1000;
  private viewportHeight = 540;
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly sphere = new THREE.SphereGeometry(1, 12, 10);
  private readonly limb = new THREE.CapsuleGeometry(.065, .21, 4, 8);

  constructor(canvas: HTMLCanvasElement, invalidate: () => void) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'default' });
    this.gl.setPixelRatio(1); this.gl.setSize(1000, 540, false);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1;
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0xb3c9cb); this.scene.fog = new THREE.Fog(0xb3c9cb, 45, 100);
    this.scene.add(new THREE.HemisphereLight(0xe7f2ff, 0x557445, 2.2));
    this.sunlight.position.set(-14, 24, 10); this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sunlight.shadow.camera, { left: -18, right: 18, top: 21, bottom: -21, near: 1, far: 70 });
    this.sunlight.shadow.bias = -.0006; this.sunlight.shadow.normalBias = .035;
    this.scene.add(this.sunlight);
    const fill = new THREE.DirectionalLight(0xd5e6ff, .65); fill.position.set(8, 8, -10); this.scene.add(fill);
    this.buildGround(); this.buildCourt(); this.buildNet(); this.buildClub(); this.buildUmpire();
    this.crowd = new TennisCrowd(this.scene);
    this.athletes.push(this.athlete(false), this.athlete(true));
    const aimRing = new THREE.Mesh(new THREE.RingGeometry(.26, .34, 28), this.serveMarkerMaterial);
    aimRing.rotation.x = -Math.PI / 2; this.serveMarker.add(aimRing);
    const cross = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.47, 0, 0), new THREE.Vector3(.47, 0, 0),
      new THREE.Vector3(0, 0, -.47), new THREE.Vector3(0, 0, .47)
    ]);
    this.serveMarker.add(new THREE.LineSegments(cross, new THREE.LineBasicMaterial({ color: 0xf2eea0, transparent: true, opacity: .8, depthWrite: false })));
    this.serveGuide = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3)),
      new THREE.LineBasicMaterial({ color: 0xf2eea0, transparent: true, opacity: .35, depthWrite: false }));
    this.serveGuide.frustumCulled = false; this.serveMarker.visible = this.serveGuide.visible = false;
    this.scene.add(this.serveMarker, this.serveGuide);
    const ballMesh = this.mesh(this.sphere, this.material(0xd5f03e), [0, 0, 0], [.125, .125, .125]);
    ballMesh.material = new THREE.MeshStandardMaterial({ color: 0xd8f12a, roughness: .92, emissive: 0x657712, emissiveIntensity: .16 });
    this.ball.add(ballMesh);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(.123, .006, 4, 28), this.material(0xf4f5c4));
    seam.rotation.set(.65, .3, .2); this.ball.add(seam); this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.19, 16), new THREE.MeshBasicMaterial({ color: 0x172c19, transparent: true, opacity: .3, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2; this.ballShadow.position.y = .033; this.scene.add(this.ballShadow);
    this.playerRing = this.ring(.47, .51, 0xe6edac); this.bounceRing = this.ring(.25, .3, 0xffed91);
    this.setCamera('broadcast');
    const loader = new THREE.TextureLoader();
    loader.load('/assets/arcade/oak-cutout-v1.png', texture => {
      if (this.dead) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
      if (this.treeCards) {
        const material = this.treeCards.material as THREE.MeshBasicMaterial;
        material.map = texture; material.needsUpdate = true; this.treeCards.visible = true;
      }
      invalidate();
    }, undefined, () => { /* Scenery may be absent; the match remains playable. */ });
    const sources: Record<CourtSurface, string> = { grass: 'surface-wimbledon-v1.png', clay: 'surface-roland-garros-v1.png', hard: 'surface-us-open-v2.png' };
    for (const surface of Object.keys(sources) as CourtSurface[]) {
      loader.load('/assets/backgrounds/' + sources[surface], texture => {
        if (this.dead) { texture.dispose(); return; }
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 8);
        texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, this.gl.capabilities.getMaxAnisotropy());
        this.textures.add(texture); this.maps[surface] = texture;
        if (this.surface === surface) { this.courtMaterial.map = texture; this.courtMaterial.needsUpdate = true; }
        invalidate();
      }, undefined, () => { /* A coloured physical surface still works when a texture is missing. */ });
    }
  }

  setCamera(mode: TennisCamera): void {
    this.cameraMode = mode;
    if (mode === 'baseline') this.camera.position.set(0, 13.8, 25.5);
    else this.camera.position.set(12.8, 17, 23.5);
    const target = new THREE.Vector3(0, .4, -.5);
    this.camera.lookAt(target);
    // Fit all court corners and the chair umpire at any viewport aspect ratio.
    const direction = this.camera.position.clone().sub(target).normalize(), rotation = this.camera.quaternion.clone().invert();
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), tanH = tanV * this.camera.aspect;
    let distance = 0;
    for (const x of [-8.3, 8.3]) for (const y of [0, 3.7]) for (const z of [-14, 14]) {
      const point = new THREE.Vector3(x, y, z).sub(target).applyQuaternion(rotation);
      distance = Math.max(distance, point.z + Math.abs(point.x) / (tanH * .91), point.z + Math.abs(point.y) / (tanV * .91));
    }
    this.camera.position.copy(target).addScaledVector(direction, Math.max(25, distance)); this.camera.lookAt(target); this.camera.updateProjectionMatrix();
    this.faceTrees();
  }
  resize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || this.dead) return;
    this.viewportWidth = width; this.viewportHeight = height;
    const scale = Math.min(1, Math.sqrt((this.lightweight ? 350000 : 850000) / (width * height)));
    this.gl.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), false);
    this.camera.aspect = width / height; this.setCamera(this.cameraMode);
  }
  setLightweight(on: boolean): void {
    this.lightweight = on; this.gl.shadowMap.enabled = !on; this.resize(this.viewportWidth, this.viewportHeight);
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.needsUpdate = true);
      }
    });
  }
  draw(game: Tennis3DEngine, time: number): void {
    if (this.dead) return;
    if (this.surface !== game.surface) {
      this.surface = game.surface;
      this.courtMaterial.color.setHex({ grass: 0xa0b987, clay: 0xe8ae8b, hard: 0x9dbbd5 }[game.surface]);
      this.apronMaterial.color.setHex({ grass: 0x456c48, clay: 0x875d41, hard: 0x44655b }[game.surface]);
      this.courtMaterial.map = this.maps[game.surface] ?? null; this.courtMaterial.needsUpdate = true;
    }
    game.players.forEach((p, i) => this.animate(this.athletes[i], p, i, time));
    const b = game.ball;
    this.ball.position.set(b.x, Math.max(.13, b.y), b.z);
    this.ball.rotation.set(time * 7, time * 10, time * 3);
    this.ballShadow.position.set(b.x, .033, b.z); this.ballShadow.scale.setScalar(1 + Math.max(0, b.y) * .2);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(.08, .34 - b.y * .045);
    this.playerRing.position.set(game.players[0].x, .04, game.players[0].z);
    this.playerRing.visible = game.phase !== 'ready';
    const landing = game.landing();
    this.bounceRing.visible = game.phase === 'playing' && Math.abs(landing.x) < 6 && Math.abs(landing.z) < 14;
    this.bounceRing.position.set(landing.x, .04, landing.z);
    this.serveMarker.visible = this.serveGuide.visible = game.phase === 'serving' && game.server === 0;
    if (this.serveMarker.visible) {
      const target = game.serveTarget, server = game.players[0];
      this.serveMarker.position.set(target.x, .055, target.z);
      this.serveMarkerMaterial.color.setHex(game.serveCharge > .95 || Math.abs(game.serveAim) > 1 ? 0xff927e : 0xf2eea0);
      const points = this.serveGuide.geometry.getAttribute('position') as THREE.BufferAttribute;
      points.setXYZ(0, server.x, .05, server.z - .2); points.setXYZ(1, target.x, .05, target.z); points.needsUpdate = true;
    }
    this.crowd.update(time, game.phase === 'point' || game.phase === 'over');
    this.gl.render(this.scene, this.camera);
  }
  dispose(): void {
    this.dead = true;
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
    this.sunlight.shadow.dispose(); this.gl.dispose(); this.gl.forceContextLoss(); this.scene.clear();
  }
  private material(color: number): THREE.MeshStandardMaterial { return new THREE.MeshStandardMaterial({ color, roughness: .84 }); }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: number[], scale: number[] = [1, 1, 1]): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(position[0], position[1], position[2]); mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = this.scene): THREE.Mesh {
    const mesh = this.mesh(this.unitBox, material, [x, y, z], [w, h, d]); parent.add(mesh); return mesh;
  }
  private instances(geometry: THREE.BufferGeometry, material: THREE.Material, transforms: number[][], shadows = false): void {
    const group = new THREE.InstancedMesh(geometry, material, transforms.length), matrix = new THREE.Matrix4(), dummy = new THREE.Object3D();
    transforms.forEach((t, i) => { dummy.position.set(t[0], t[1], t[2]); dummy.scale.set(t[3], t[4], t[5]); dummy.updateMatrix(); matrix.copy(dummy.matrix); group.setMatrixAt(i, matrix); });
    group.instanceMatrix.needsUpdate = true; group.receiveShadow = true; group.castShadow = shadows; this.scene.add(group);
  }
  private ring(inner: number, outer: number, color: number): THREE.Mesh {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .6, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; this.scene.add(ring); return ring;
  }
  private buildGround(): void {
    this.box(this.material(0x688061), 0, -.16, 0, 160, .2, 160);
    this.box(this.apronMaterial, 0, -.045, 0, 21, .14, 37);
    this.box(this.material(0xc2b9a0), 0, -.01, -19.1, 23, .1, 1.5);
  }
  private buildCourt(): void {
    this.box(this.courtMaterial, 0, .005, 0, 10.97, .035, 23.77);
    const white = this.material(0xe9e8d6), lines: number[][] = [];
    for (const x of [-5.485, -FIELD.halfWidth, FIELD.halfWidth, 5.485]) lines.push([x, .029, 0, .045, .008, 23.77]);
    for (const z of [-11.885, 11.885]) lines.push([0, .029, z, 10.97, .008, .05]);
    for (const z of [-6.4, 6.4]) lines.push([0, .029, z, 8.23, .008, .045]);
    lines.push([0, .029, 0, .045, .008, 12.8], [0, .029, 11.78, .05, .008, .22], [0, .029, -11.78, .05, .008, .22]);
    this.instances(this.unitBox, white, lines);
    // Small-scale bump catches the sunlight without a heavy material or post-processing pass.
    const data = new Uint8Array(128 * 128 * 4);
    for (let i = 0; i < data.length; i += 4) { const n = 90 + ((i * 73 ^ i >>> 3) % 90); data[i] = data[i + 1] = data[i + 2] = n; data[i + 3] = 255; }
    const bump = new THREE.DataTexture(data, 128, 128); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(9, 20); bump.needsUpdate = true;
    this.textures.add(bump); this.courtMaterial.bumpMap = bump; this.courtMaterial.bumpScale = .018;
  }
  private buildNet(): void {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.strokeStyle = '#233b35'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, 64, 64); }
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(100, 8); this.textures.add(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(12, .91), new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .25, side: THREE.DoubleSide, roughness: 1 }));
    mesh.position.y = .5; this.scene.add(mesh);
    const poles = this.material(0x213e36);
    for (const x of [-6, 6]) this.box(poles, x, .56, 0, .11, 1.12, .11);
    this.box(this.material(0xe9e6d8), 0, .973, 0, 12.1, .065, .035);
    this.box(this.material(0xcecebc), 0, .49, .01, .035, .96, .035);
  }
  private buildClub(): void {
    const posts: number[][] = [], rails: number[][] = [], seats: number[][] = [];
    for (const x of [-10.3, 10.3]) {
      for (let z = -18; z <= 18; z += 3) posts.push([x, 1.6, z, .07, 3.2, .07]);
      for (const y of [.45, 1.5, 2.9]) rails.push([x, y, 0, .035, .035, 36]);
    }
    for (let x = -10; x <= 10; x += 2) posts.push([x, 1.6, -18, .07, 3.2, .07]);
    for (const y of [.45, 1.5, 2.9]) rails.push([0, y, -18, 20.6, .035, .035]);
    this.instances(this.unitBox, this.material(0x344f48), posts);
    this.instances(this.unitBox, this.material(0x788b7a), rails);
    // Back windscreen and low stands keep the setting recognisably a tennis club.
    this.box(this.material(0x254b3c), 0, .95, -18.1, 20.6, 1.8, .04);
    for (const x of [-8.2, 8.2]) {
      this.box(this.material(0x9a8f72), x, .4, 2, 1.15, .12, 3.5);
      this.box(this.material(0x4a5a49), x, .2, .8, .12, .4, .15);
      this.box(this.material(0x4a5a49), x, .2, 3.2, .12, .4, .15);
    }
    for (let row = 0; row < 4; row++) {
      this.box(this.material(0x9eaa9f), 0, .82 + row * .5, -21 - row * .85, 18.1, .18, .85);
      for (let i = 0; i < 22; i++) seats.push([-8.4 + i * .8, 1 + row * .5, -21 - row * .85, .58, .16, .5]);
      for (const side of [-1, 1]) {
        this.box(this.material(0x8e9b91), side * (11.8 + row * .8), .47 + row * .46, -1.9, .8, .18, 22.6);
        for (let i = 0; i < 20; i++) seats.push([side * (11.8 + row * .8), .64 + row * .46, -12 + i * 1.1, .5, .16, .58]);
      }
    }
    this.instances(this.unitBox, this.material(0x304e55), seats);
    for (let i = 0; i < 28; i++) {
      const angle = i * 2.399, radius = 30 + i % 3 * 5;
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      if (z > 12) continue;
      this.trees.push({ x, z, height: 8 + i % 4 * 1.15 });
    }
    // Photographic alpha-tested cards: one shared texture and draw, no per-leaf geometry.
    this.treeCards = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xc6c9bd, alphaTest: .48, side: THREE.DoubleSide, toneMapped: false }), this.trees.length);
    this.treeCards.visible = false; this.treeCards.frustumCulled = false; this.scene.add(this.treeCards);
    const board = document.createElement('canvas'); board.width = 1024; board.height = 128;
    const ctx = board.getContext('2d');
    if (ctx) { ctx.fillStyle = '#183a30'; ctx.fillRect(0, 0, 1024, 128); ctx.textAlign = 'center'; ctx.fillStyle = '#e5e8ce'; ctx.font = '500 48px sans-serif'; ctx.fillText('B O N Z O B Y T E   T E N N I S   C L U B', 512, 81); }
    const texture = new THREE.CanvasTexture(board); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.25), new THREE.MeshBasicMaterial({ map: texture })); sign.position.set(0, 1.22, -18.05); this.scene.add(sign);
  }
  private faceTrees(): void {
    if (!this.treeCards) return;
    const dummy = new THREE.Object3D();
    this.trees.forEach((tree, i) => {
      dummy.position.set(tree.x, tree.height / 2, tree.z);
      dummy.rotation.set(0, Math.atan2(this.camera.position.x - tree.x, this.camera.position.z - tree.z), 0);
      dummy.scale.set(tree.height * 1.16, tree.height, 1); dummy.updateMatrix(); this.treeCards!.setMatrixAt(i, dummy.matrix);
    });
    this.treeCards.instanceMatrix.needsUpdate = true;
  }
  private buildUmpire(): void {
    const frame = this.material(0xe5e5d7), blue = this.material(0x2e5369), skin = this.material(0xc49a75);
    for (const x of [-7.8, -6.85]) for (const z of [-.48, .48]) this.box(frame, x, 1.18, z, .065, 2.36, .065);
    this.box(blue, -7.32, 2.24, 0, 1.1, .16, 1.05);
    this.box(blue, -7.77, 2.66, 0, .12, .8, 1.05);
    for (let step = 0; step < 6; step++) this.box(frame, -7.32, .2 + step * .35, .5, .86, .045, .06);
    this.scene.add(this.mesh(this.sphere, blue, [-7.4, 2.73, 0], [.2, .3, .17]));
    this.scene.add(this.mesh(this.sphere, skin, [-7.39, 3.14, 0], [.13, .16, .13]));
    this.scene.add(this.mesh(this.sphere, frame, [-7.4, 3.25, 0], [.16, .065, .16]));
    for (const z of [-.13, .13]) {
      this.box(blue, -7.06, 2.39, z, .5, .14, .13); this.box(skin, -6.86, 2.16, z, .12, .45, .12);
      this.box(skin, -7.12, 2.76, z * 1.6, .44, .07, .075);
    }
    this.box(this.material(0x263b35), -6.92, 2.9, -.23, .025, .4, .025);
    this.scene.add(this.mesh(this.sphere, this.material(0x1c2b2b), [-6.92, 3.08, -.23], [.05, .045, .045]));
  }
  private athlete(opponent: boolean): Athlete {
    const root = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group();
    const skin = this.material(opponent ? 0x9a6040 : 0xd0a07b), shirt = this.material(opponent ? 0x497d99 : 0xe9e6d5), shorts = this.material(0x1d303d);
    const shoes = this.material(0xe6e6dc), hair = this.material(opponent ? 0x30241f : 0x59402b);
    root.add(torso); torso.position.y = JOINTS.torsoHeight;
    torso.add(this.mesh(this.sphere, shirt, [0, .28, 0], [.24, .36, .13]));
    this.box(shorts, 0, -.02, 0, .39, .23, .25, torso);
    torso.add(this.mesh(this.sphere, skin, [0, .66, 0], [.065, .11, .065]));
    head.position.y = .81; torso.add(head);
    head.add(this.mesh(this.sphere, skin, [0, 0, 0], [.135, .165, .135]));
    head.add(this.mesh(this.sphere, hair, [0, .065, .02], [.138, .118, .13]));
    head.add(this.mesh(this.sphere, skin, [0, -.005, -.134], [.027, .035, .032]));
    const band = this.material(opponent ? 0xd7d2bd : 0x244e5a);
    this.box(band, 0, .45, -.119, .34, .018, .014, torso);
    const arms: THREE.Group[] = [], elbows: THREE.Group[] = [], legs: THREE.Group[] = [], knees: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(), elbow = new THREE.Group(); arm.position.set(side * JOINTS.shoulderWidth, JOINTS.shoulderHeight, JOINTS.shoulderForward);
      arm.add(this.mesh(this.limb, shirt, [0, -.095, 0], [1.2, .72, 1.2]));
      arm.add(this.mesh(this.limb, skin, [0, -.18, 0], [.82, .8, .82]));
      elbow.position.y = -JOINTS.elbowDrop; elbow.add(this.mesh(this.limb, skin, [0, -.11, 0], [.78, .8, .78]));
      elbow.add(this.mesh(this.sphere, skin, [0, -JOINTS.handDrop, 0], [.06, .075, .055]));
      arm.add(elbow); torso.add(arm); arms.push(arm); elbows.push(elbow);
      const leg = new THREE.Group(), knee = new THREE.Group(); leg.position.set(side * .12, .83, 0);
      leg.add(this.mesh(this.limb, shorts, [0, -.12, 0], [1.5, 1.22, 1.5]));
      leg.add(this.mesh(this.limb, skin, [0, -.25, 0], [1.13, 1.2, 1.13]));
      knee.position.y = -.38; knee.add(this.mesh(this.limb, skin, [0, -.16, 0], [.95, 1.45, .95]));
      knee.add(this.mesh(this.limb, shoes, [0, -.28, 0], [1.02, .53, 1.02]));
      knee.add(this.mesh(this.sphere, shoes, [0, -.36, -.06], [.09, .065, .18]));
      leg.add(knee); root.add(leg); legs.push(leg); knees.push(knee);
    }
    const racquet = new THREE.Group(); racquet.position.set(0, -JOINTS.handDrop, JOINTS.gripForward); racquet.rotation.x = .65;
    const frame = this.material(opponent ? 0xdc874e : 0x8cb87b);
    this.box(this.material(0xe4e0d5), 0, -.02, 0, .037, .26, .037, racquet);
    for (const side of [-1, 1]) { const throat = this.box(frame, side * .032, -.19, 0, .018, .15, .018, racquet); throat.rotation.z = side * .42; }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.17, .013, 5, 28), frame); rim.scale.y = 1.3; rim.position.y = -JOINTS.racketHeadDrop; racquet.add(rim);
    const strings: THREE.Vector3[] = [];
    for (let x = -.12; x <= .121; x += .04) { const y = .21 * Math.sqrt(1 - (x / .17) ** 2); strings.push(new THREE.Vector3(x, -JOINTS.racketHeadDrop - y, 0), new THREE.Vector3(x, -JOINTS.racketHeadDrop + y, 0)); }
    for (let y = -.16; y <= .161; y += .04) { const x = .17 * Math.sqrt(1 - (y / .22) ** 2); strings.push(new THREE.Vector3(-x, -JOINTS.racketHeadDrop + y, 0), new THREE.Vector3(x, -JOINTS.racketHeadDrop + y, 0)); }
    racquet.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strings), new THREE.LineBasicMaterial({ color: 0xcacfc4, transparent: true, opacity: .65 })));
    elbows[1].add(racquet); this.scene.add(root);
    return { root, torso, head, arms, elbows, legs, knees, racket: racquet };
  }
  private animate(rig: Athlete, p: Player3D, index: number, time: number): void {
    const pose = tennisAthletePose(p.speed, p.swing, time, p.stroke, p.forehand);
    rig.root.position.set(p.x, p.y + pose.bounce, p.z); rig.root.rotation.y = index === 0 ? 0 : Math.PI;
    rig.torso.rotation.set(...pose.torso); rig.head.rotation.x = pose.head;
    rig.legs.forEach((leg, i) => { leg.rotation.x = pose.legs[i]; rig.knees[i].rotation.x = pose.knees[i]; });
    rig.arms.forEach((arm, i) => { arm.rotation.set(...pose.arms[i]); rig.elbows[i].rotation.x = pose.elbows[i]; });
    rig.racket.rotation.x = pose.racket;
  }
}
