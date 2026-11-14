import * as THREE from 'three';
import { CourtShot, FIELD, Player3D, Tennis3DEngine } from './tennis-3d-engine';
import type { CourtSurface } from './tennis-engine';
import { TennisCrowd } from './tennis-crowd';
import { tennisAthletePose, tennisAthleteStrokePreparationPose, TENNIS_ATHLETE_JOINTS as JOINTS } from './tennis-athlete-pose';
import { TennisServePresentation, tennisServePreparationPose, tennisServeToss } from './tennis-serve-pose';
import { TennisCourtEffects } from './tennis-court-effects';
import { TennisClubDetails } from './tennis-club-details';
import { createTennisAthlete, TennisAthlete as Athlete } from './tennis-athlete-model';
import { createTennisCourtTexture, TENNIS_COURT_COLOURS } from './tennis-court-surface';

export type TennisCamera = 'broadcast' | 'baseline';

/** Original procedural scene. No external avatars, game assets or remote services. */
export class Tennis3DRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1000 / 540, .1, 180);
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
  private ballSpinPlayer: Player3D | null = null;
  private ballSpinTime = -1;
  private readonly servePresentation = new TennisServePresentation();
  private readonly serveHand = new THREE.Vector3();
  private readonly ballShadow: THREE.Mesh;
  private readonly playerRing: THREE.Mesh;
  private readonly bounceRing: THREE.Mesh;
  private readonly serveMarker = new THREE.Group();
  private readonly mowing = new THREE.Group();
  private readonly serveGuide: THREE.LineSegments;
  private readonly serveMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xf2eea0, transparent: true, opacity: .9, depthWrite: false });
  private surface: CourtSurface | null = null;
  private dead = false;
  private cameraMode: TennisCamera = 'baseline';
  private readonly crowd: TennisCrowd;
  private readonly effects: TennisCourtEffects;
  private readonly clubDetails: TennisClubDetails;
  private readonly athleteShadows: THREE.Mesh[] = [];
  private readonly athleteLook = [{ player: null as Player3D | null, time: -1, yaw: 0, pitch: 0 }, { player: null as Player3D | null, time: -1, yaw: 0, pitch: 0 }];
  private lightweight = false;
  private viewportWidth = 1000;
  private viewportHeight = 540;
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly sphere = new THREE.SphereGeometry(1, 12, 10);

  constructor(canvas: HTMLCanvasElement, invalidate: () => void) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'default' });
    this.gl.setPixelRatio(1); this.gl.setSize(1000, 540, false);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = .94;
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0xbcccd1); this.scene.fog = new THREE.Fog(0xbcccd1, 48, 100);
    this.scene.add(new THREE.HemisphereLight(0xe7f2ff, 0x455b40, 1.65));
    this.sunlight.position.set(-14, 24, 10); this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sunlight.shadow.camera, { left: -18, right: 18, top: 21, bottom: -21, near: 1, far: 70 });
    this.sunlight.shadow.bias = -.0006; this.sunlight.shadow.normalBias = .035;
    this.scene.add(this.sunlight);
    const fill = new THREE.DirectionalLight(0xd5e6ff, .65); fill.position.set(8, 8, -10); this.scene.add(fill);
    this.buildGround(); this.buildCourt(); this.buildNet(); this.buildClub(); this.buildUmpire();
    this.clubDetails = new TennisClubDetails(this.scene, texture => this.textures.add(texture));
    this.crowd = new TennisCrowd(this.scene);
    this.effects = new TennisCourtEffects(this.scene);
    this.athletes.push(this.athlete(false), this.athlete(true));
    const shadowMap = this.contactShadowTexture();
    for (let i = 0; i < 2; i++) {
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .95), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: .38, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = .035; this.athleteShadows.push(shadow); this.scene.add(shadow);
    }
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
    const felt = new Uint8Array(64 * 64 * 4);
    for (let i = 0; i < felt.length; i += 4) { const value = 96 + ((Math.imul(i + 19, 1103515245) >>> 19) & 127); felt[i] = felt[i + 1] = felt[i + 2] = value; felt[i + 3] = 255; }
    const feltMap = new THREE.DataTexture(felt, 64, 64); feltMap.needsUpdate = true; this.textures.add(feltMap);
    const ballMesh = this.mesh(this.sphere, new THREE.MeshStandardMaterial({ color: 0xdbf04e, roughness: 1, bumpMap: feltMap, bumpScale: .0013, emissive: 0x657712, emissiveIntensity: .09 }), [0, 0, 0], [.105, .105, .105]);
    this.ball.add(ballMesh);
    const seamPoints: THREE.Vector3[] = [];
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2, twist = .72 + Math.cos(angle * 2) * .7;
      seamPoints.push(new THREE.Vector3(Math.cos(angle), Math.sin(angle) * Math.cos(twist), Math.sin(angle) * Math.sin(twist)).multiplyScalar(.1045));
    }
    const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPoints, true), 64, .0025, 3, true), this.material(0xf4f5c4));
    seam.rotation.set(.65, .3, .2); this.ball.add(seam); this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(.48, .48), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: .44, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2; this.ballShadow.position.y = .033; this.scene.add(this.ballShadow);
    this.playerRing = this.ring(.47, .485, 0xe6edac); this.bounceRing = this.ring(.23, .255, 0xffed91);
    this.setCamera('baseline');
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
    for (const surface of ['grass', 'clay', 'hard'] as const) {
      const texture = createTennisCourtTexture(surface); texture.anisotropy = Math.min(4, this.gl.capabilities.getMaxAnisotropy());
      this.textures.add(texture); this.maps[surface] = texture;
    }
  }

  setCamera(mode: TennisCamera): void {
    this.cameraMode = mode;
    if (mode === 'baseline') this.camera.position.set(0, 11.7, 26.2);
    else this.camera.position.set(11.6, 15.2, 25.5);
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
  draw(game: Tennis3DEngine, time: number, heldShot: CourtShot = 'drive'): void {
    if (this.dead) return;
    if (this.surface !== game.surface) {
      this.surface = game.surface;
      this.courtMaterial.color.setHex(this.maps[game.surface] ? 0xffffff : TENNIS_COURT_COLOURS[game.surface]);
      this.apronMaterial.color.setHex({ grass: 0x456c48, clay: 0x9d684a, hard: 0x44655b }[game.surface]);
      this.courtMaterial.map = this.maps[game.surface] ?? null; this.courtMaterial.needsUpdate = true;
      this.courtMaterial.bumpScale = { grass: .013, clay: .026, hard: .006 }[game.surface];
      this.mowing.visible = game.surface === 'grass';
    }
    const preparation = this.servePresentation.preparation(game, time);
    game.players.forEach((p, i) => {
      this.animate(this.athletes[i], p, i, time, i === game.server ? preparation : null,
        i === 0 && game.phase === 'playing' && game.strokeCharging ? game : null, heldShot);
      const look = this.athleteLook[i], sign = i === 0 ? 1 : -1;
      if (look.player !== p || time < look.time || time - look.time > .5) { look.player = p; look.yaw = look.pitch = 0; look.time = time; }
      const damping = 1 - Math.exp(-Math.min(.05, Math.max(0, time - look.time)) * 9); look.time = time;
      const facing = (p.z - game.ball.z) * sign;
      const yaw = game.phase === 'playing' && facing > .3 ? THREE.MathUtils.clamp(Math.atan2((p.x - game.ball.x) * sign, facing), -.4, .4) : 0;
      const pitch = game.phase === 'playing' ? THREE.MathUtils.clamp(Math.atan2(game.ball.y - 1.7, Math.max(2, Math.hypot(p.x - game.ball.x, p.z - game.ball.z))) * .25, -.10, .13) : 0;
      look.yaw += (yaw - look.yaw) * damping; look.pitch += (pitch - look.pitch) * damping;
      this.athletes[i].head.rotation.y = look.yaw; this.athletes[i].head.rotation.x += look.pitch;
      const shadow = this.athleteShadows[i]; shadow.position.set(p.x, .035, p.z);
      shadow.scale.setScalar(1 + p.y * .25); (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(.13, .38 - p.y * .16);
    });
    const b = game.ball;
    this.ball.position.set(b.x, Math.max(.13, b.y), b.z);
    if (preparation !== null) {
      const rig = this.athletes[game.server], server = game.players[game.server], sign = game.server === 0 ? 1 : -1;
      rig.root.updateMatrixWorld(true);
      rig.elbows[0].localToWorld(this.serveHand.set(0, -JOINTS.handDrop, 0));
      const toss = tennisServeToss(preparation);
      this.ball.position.set(
        THREE.MathUtils.lerp(this.serveHand.x, server.x, toss),
        THREE.MathUtils.lerp(this.serveHand.y, 2.75, toss) + Math.sin(toss * Math.PI) * .12,
        THREE.MathUtils.lerp(this.serveHand.z, server.z - sign * .2, toss),
      );
    }
    if (this.ballSpinPlayer !== game.players[0] || time < this.ballSpinTime || time - this.ballSpinTime > .5) {
      this.ballSpinPlayer = game.players[0]; this.ballSpinTime = time; this.ball.rotation.set(.5, .2, .3);
    }
    const spinDt = Math.max(0, Math.min(.06, time - this.ballSpinTime)); this.ballSpinTime = time;
    if (game.phase === 'playing') {
      this.ball.rotation.x -= spinDt * (8 + Math.hypot(b.vx, b.vy, b.vz) * .6) * Math.sign(b.vz);
      this.ball.rotation.z += spinDt * b.vx * .6;
    } else if (preparation !== null && tennisServeToss(preparation) > .1) this.ball.rotation.x += spinDt * .8;
    const shownBall = this.ball.position;
    this.ballShadow.position.set(shownBall.x, .033, shownBall.z); this.ballShadow.scale.setScalar(1 + Math.max(0, shownBall.y) * .2);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(.10, .48 - shownBall.y * .055);
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
    this.effects.update(game, time, shownBall, this.lightweight);
    this.clubDetails.update(game);
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
  private contactShadowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(32, 32, 3, 32, 32, 31);
      gradient.addColorStop(0, '#101c18c4'); gradient.addColorStop(.4, '#101c1866'); gradient.addColorStop(1, '#101c1800');
      context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas); this.textures.add(texture); return texture;
  }
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
    this.box(this.material(0x526a4b), 0, -.16, 0, 160, .2, 160);
    // A rectangular run-off, not a full slab over the textured court. The former slab's
    // top was 2.5 mm ABOVE the court and hid the texture / z-fought at distant cameras.
    const outline = new THREE.Shape(); outline.moveTo(-10.5, -18.5); outline.lineTo(10.5, -18.5);
    outline.lineTo(10.5, 18.5); outline.lineTo(-10.5, 18.5); outline.closePath();
    const opening = new THREE.Path(); opening.moveTo(-5.485, -11.885); opening.lineTo(-5.485, 11.885);
    opening.lineTo(5.485, 11.885); opening.lineTo(5.485, -11.885); opening.closePath(); outline.holes.push(opening);
    const apron = new THREE.Mesh(new THREE.ShapeGeometry(outline), this.apronMaterial);
    apron.name = 'court-run-off-with-opening'; apron.rotation.x = -Math.PI / 2; apron.position.y = .0225;
    apron.receiveShadow = true; this.scene.add(apron);
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
    const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x102b14, transparent: true, opacity: .075, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const stripeGeometry = new THREE.PlaneGeometry(10.86, 23.66 / 12);
    for (let i = 0; i < 12; i += 2) {
      const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, .024, -11.83 + (i + .5) * (23.66 / 12)); this.mowing.add(stripe);
    }
    this.scene.add(this.mowing);
    // Small-scale bump catches the sunlight without a heavy material or post-processing pass.
    const data = new Uint8Array(128 * 128 * 4);
    for (let i = 0; i < data.length; i += 4) { const n = 90 + ((i * 73 ^ i >>> 3) % 90); data[i] = data[i + 1] = data[i + 2] = n; data[i + 3] = 255; }
    const bump = new THREE.DataTexture(data, 128, 128); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(9, 20); bump.needsUpdate = true;
    this.textures.add(bump); this.courtMaterial.bumpMap = bump; this.courtMaterial.bumpScale = .018;
  }
  private buildNet(): void {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.strokeStyle = '#243b32'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, 64, 64); }
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(160, 12); this.textures.add(texture);
    // Match the existing uniform collision height: decorative sag must not invent a higher
    // sideline obstacle that otherwise-legal replay trajectories would visibly pass through.
    const top = (_x: number) => FIELD.netHeight - .03;
    const geometry = new THREE.PlaneGeometry(12, 1, 48, 1), positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) positions.setY(i, positions.getY(i) > 0 ? top(positions.getX(i)) - .024 : .055);
    positions.needsUpdate = true; geometry.computeVertexNormals();
    // Blend minified grid coverage instead of discarding it: a high alpha-test threshold makes
    // a regulation fine mesh disappear entirely at the fitted broadcast camera distance.
    const netMaterial = new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, opacity: .88 });
    netMaterial.forceSinglePass = true;
    const mesh = new THREE.Mesh(geometry, netMaterial);
    mesh.name = 'tennis-net-mesh';
    this.scene.add(mesh);
    const poles = this.material(0x213e36);
    for (const x of [-6, 6]) {
      this.scene.add(this.mesh(new THREE.CylinderGeometry(.055, .065, 1.11, 10), poles, [x, .555, 0]));
      this.scene.add(this.mesh(this.sphere, poles, [x, 1.11, 0], [.064, .035, .064]));
    }
    const tape = new THREE.PlaneGeometry(12.08, .06, 48, 1), tapePositions = tape.getAttribute('position');
    for (let i = 0; i < tapePositions.count; i++) tapePositions.setY(i, top(tapePositions.getX(i)) + tapePositions.getY(i));
    tapePositions.needsUpdate = true; tape.computeVertexNormals();
    const headband = new THREE.Mesh(tape, new THREE.MeshStandardMaterial({ color: 0xf3f0df, roughness: 1, side: THREE.DoubleSide }));
    headband.name = 'tennis-net-headband'; this.scene.add(headband);
    this.box(this.material(0xcecebc), 0, FIELD.netHeight / 2, .012, .035, FIELD.netHeight, .035);
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
    this.treeCards = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xa9b3a4, alphaTest: .48, side: THREE.DoubleSide, toneMapped: false }), this.trees.length);
    this.treeCards.visible = false; this.treeCards.frustumCulled = false; this.scene.add(this.treeCards);
    const board = document.createElement('canvas'); board.width = 1024; board.height = 128;
    const ctx = board.getContext('2d');
    if (ctx) { ctx.fillStyle = '#183a30'; ctx.fillRect(0, 0, 1024, 128); ctx.textAlign = 'center'; ctx.fillStyle = '#e5e8ce'; ctx.font = '500 48px sans-serif'; ctx.fillText('B O N Z O B Y T E   T E N N I S   C L U B', 512, 81); }
    const texture = new THREE.CanvasTexture(board); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 1.03), new THREE.MeshBasicMaterial({ map: texture })); sign.position.set(0, 1.22, -18.05); this.scene.add(sign);
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
    const frame = this.material(0xe5e5d7), blue = this.material(0x2e5369);
    for (const x of [-7.8, -6.85]) for (const z of [-.48, .48]) this.box(frame, x, 1.18, z, .065, 2.36, .065);
    this.box(blue, -7.32, 2.24, 0, 1.1, .16, 1.05);
    this.box(blue, -7.77, 2.66, 0, .12, .8, 1.05);
    for (let step = 0; step < 6; step++) this.box(frame, -7.32, .2 + step * .35, .5, .86, .045, .06);
    const official = createTennisAthlete(false);
    official.root.name = 'seated-chair-umpire'; official.root.position.set(-7.4, 1.38, 0); official.root.rotation.y = -Math.PI / 2;
    official.torso.rotation.x = -.06; official.head.rotation.x = -.05;
    official.legs.forEach((leg, i) => { leg.rotation.x = 1.35; official.knees[i].rotation.x = -1.43; });
    official.arms.forEach((arm, i) => { arm.rotation.set(.62, 0, i === 0 ? .13 : -.13); official.elbows[i].rotation.x = .92; });
    official.racket.children.forEach(part => part.visible = part.name === 'closed-racket-grip-and-thumb');
    official.head.add(this.mesh(this.sphere, frame, [0, .12, 0], [.134, .065, .128]));
    this.box(frame, 0, .1, -.13, .2, .012, .16, official.head); this.scene.add(official.root);
    this.box(this.material(0x263b35), -6.92, 2.9, -.23, .025, .4, .025);
    this.scene.add(this.mesh(this.sphere, this.material(0x1c2b2b), [-6.92, 3.08, -.23], [.05, .045, .045]));
  }
  private athlete(opponent: boolean): Athlete {
    const athlete = createTennisAthlete(opponent);
    this.scene.add(athlete.root); return athlete;
  }
  private animate(rig: Athlete, p: Player3D, index: number, time: number, servePreparation: number | null = null, charging: Tennis3DEngine | null = null, heldShot: CourtShot = 'drive'): void {
    let pose = servePreparation === null ? tennisAthletePose(p.speed, p.swing, time, p.stroke, p.forehand) : tennisServePreparationPose(servePreparation);
    if (charging && p.swing <= 0) {
      const preparation = tennisAthleteStrokePreparationPose(charging.strokeCharge, heldShot, charging.ball.x >= p.x);
      if (p.speed > .2) { preparation.legs = pose.legs; preparation.knees = pose.knees; preparation.bounce = pose.bounce; }
      pose = preparation;
    }
    rig.root.position.set(p.x, p.y + pose.bounce, p.z); rig.root.rotation.y = index === 0 ? 0 : Math.PI;
    rig.torso.rotation.set(...pose.torso); rig.head.rotation.x = pose.head;
    rig.legs.forEach((leg, i) => { leg.rotation.x = pose.legs[i]; rig.knees[i].rotation.x = pose.knees[i]; });
    rig.arms.forEach((arm, i) => { arm.rotation.set(...pose.arms[i]); rig.elbows[i].rotation.x = pose.elbows[i]; });
    rig.racket.rotation.x = pose.racket;
  }
}
