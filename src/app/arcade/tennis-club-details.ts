import * as THREE from 'three';
import type { Tennis3DEngine } from './tennis-3d-engine';

/** Original club architecture, kept static and batched wherever possible. */
export class TennisClubDetails {
  private readonly board: HTMLCanvasElement;
  private readonly boardTexture: THREE.CanvasTexture;
  private scoreKey = '';

  constructor(scene: THREE.Scene, register: (texture: THREE.Texture) => void) {
    const box = new THREE.BoxGeometry(1, 1, 1), cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
    const steel = new THREE.MeshStandardMaterial({ color: 0xa9b4b0, roughness: .58, metalness: .38 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b3437, roughness: .88 });
    const wood = new THREE.MeshStandardMaterial({ color: 0xb7a58a, roughness: .94 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe9eadb, roughness: .9 });
    const staticParts: THREE.Mesh[] = [];
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, rotateY = 0) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.rotation.y = rotateY;
      mesh.castShadow = true; mesh.receiveShadow = true; staticParts.push(mesh); return mesh;
    };
    // Open side windscreens, seams and tidy low court-side benches, outside the singles run-off.
    const panels: number[][] = [], stitch: number[][] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++) {
        const z = -16.5 + i * 3;
        panels.push([side * 10.29, .93, z, .025, 1.55, 2.88]);
        stitch.push([side * 10.265, 1.69, z, .035, .025, 2.88]);
      }
      for (let slat = 0; slat < 4; slat++) add(box, wood, side * 8.15, .45, .3 + slat * .19, 1.08, .075, .14);
      for (const z of [.2, .93]) add(box, steel, side * 8.15, .22, z, .91, .4, .065);
      const back = add(box, wood, side * 8.64, .76, .59, .075, .53, 1.02); back.rotation.z = side * -.12;
      const bag = add(box, dark, side * 8.1, .2, 1.7, .46, .32, .85); bag.rotation.y = side * .16;
      add(box, white, side * 8.15, .51, .65, .53, .045, .43);
      add(cylinder, white, side * 8.45, .22, 2.45, .075, .42, .075);
      // Discreet floodlight fixtures are scenery, not additional real-time lights.
      for (const z of [-16, 16]) {
        add(cylinder, dark, side * 10.65, 4.7, z, .095, 9.4, .095);
        add(box, steel, side * 10.65, 9.3, z, 1.42, .09, .16);
        for (const x of [-.43, .43]) {
          const hood = add(box, dark, side * 10.65 + x, 9.23, z, .61, .32, .38); hood.rotation.x = z > 0 ? -.2 : .2;
          add(box, white, side * 10.65 + x, 9.07, z, .5, .02, .26).castShadow = false;
        }
      }
    }
    const batch = (material: THREE.Material, rows: number[][]) => {
      const mesh = new THREE.InstancedMesh(box, material, rows.length), dummy = new THREE.Object3D();
      for (let i = 0; i < rows.length; i++) { const p = rows[i]; dummy.position.set(p[0], p[1], p[2]); dummy.scale.set(p[3], p[4], p[5]); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); }
      mesh.instanceMatrix.needsUpdate = true; mesh.receiveShadow = true; scene.add(mesh);
    };
    batch(new THREE.MeshStandardMaterial({ color: 0x315749, roughness: 1 }), panels);
    batch(new THREE.MeshStandardMaterial({ color: 0x82918a, roughness: 1 }), stitch);

    // A real in-world scoreboard changes only after a score/phase change, never on every frame.
    this.board = document.createElement('canvas'); this.board.width = 768; this.board.height = 256;
    this.boardTexture = new THREE.CanvasTexture(this.board); this.boardTexture.colorSpace = THREE.SRGBColorSpace; register(this.boardTexture);
    add(box, dark, 7.1, 3.19, -18.2, 5.6, 1.96, .14);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.8), new THREE.MeshBasicMaterial({ map: this.boardTexture, toneMapped: false }));
    screen.position.set(7.1, 3.19, -18.11); scene.add(screen);
    for (const x of [5.2, 9]) add(cylinder, dark, x, 1.5, -18.2, .055, 3, .055);

    // Club crests are original geometry and typography, not borrowed tournament branding.
    const crest = document.createElement('canvas'); crest.width = 512; crest.height = 256;
    const context = crest.getContext('2d');
    if (context) {
      context.fillStyle = '#244a3d'; context.fillRect(0, 0, 512, 256);
      context.strokeStyle = '#a7b77c'; context.lineWidth = 3; context.strokeRect(18, 18, 476, 220);
      context.textAlign = 'center'; context.fillStyle = '#eee7d2'; context.font = '600 48px sans-serif'; context.fillText('BONZOBYTE', 256, 119);
      context.fillStyle = '#b6c58a'; context.font = '20px sans-serif'; context.fillText('T E N N I S   C L U B', 256, 163);
    }
    const crestMap = new THREE.CanvasTexture(crest); crestMap.colorSpace = THREE.SRGBColorSpace; register(crestMap);
    for (const x of [-6.5, 6.5]) {
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), new THREE.MeshBasicMaterial({ map: crestMap }));
      banner.position.set(x, 1.06, -18.04); scene.add(banner);
    }
    const batches = new Map<string, THREE.Mesh[]>();
    for (const part of staticParts) {
      const material = part.material as THREE.Material, key = part.geometry.uuid + material.uuid + part.castShadow;
      const batch = batches.get(key) ?? []; batch.push(part); batches.set(key, batch);
    }
    for (const parts of batches.values()) {
      const first = parts[0], mesh = new THREE.InstancedMesh(first.geometry, first.material, parts.length);
      parts.forEach((part, i) => { part.updateMatrix(); mesh.setMatrixAt(i, part.matrix); });
      mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = first.castShadow; mesh.receiveShadow = true; scene.add(mesh);
    }
  }

  update(game: Tennis3DEngine): void {
    const score = game.scoring, labels = score.pointLabels;
    const key = `${game.phase}|${game.server}|${score.sets.join()}|${score.games.join()}|${labels.join()}|${score.format}`;
    if (key === this.scoreKey) return;
    this.scoreKey = key;
    const ctx = this.board.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#102c2b'; ctx.fillRect(0, 0, 768, 256);
    ctx.fillStyle = '#b6c58a'; ctx.font = '500 22px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('B O N Z O B Y T E   /   C E N T R E   C O U R T', 30, 36);
    ctx.fillStyle = '#91a9a4'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SET', 470, 73); ctx.fillText('GAME', 575, 73); ctx.fillText('POINT', 690, 73);
    ctx.fillStyle = '#385651'; ctx.fillRect(28, 86, 711, 1); ctx.fillRect(28, 166, 711, 1);
    for (const side of [0, 1] as const) {
      const y = 140 + side * 79;
      ctx.fillStyle = '#e8ecd8'; ctx.textAlign = 'left'; ctx.font = '600 31px sans-serif'; ctx.fillText(side === 0 ? '01   HOME' : '02   AWAY', 36, y);
      if (game.server === side) { ctx.fillStyle = '#d8ed8b'; ctx.beginPath(); ctx.arc(347, y - 11, 7, 0, Math.PI * 2); ctx.fill(); }
      ctx.textAlign = 'center'; ctx.font = '500 43px sans-serif'; ctx.fillStyle = '#e8ecd8';
      ctx.fillText(String(score.sets[side]), 470, y); ctx.fillText(String(score.games[side]), 575, y);
      ctx.fillStyle = '#d8ed8b'; ctx.fillText(labels[side], 690, y);
    }
    this.boardTexture.needsUpdate = true;
  }
}
