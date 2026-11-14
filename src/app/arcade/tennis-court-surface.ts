import * as THREE from 'three';
import type { CourtSurface } from './tennis-engine';

export const TENNIS_COURT_COLOURS = { grass: 0x527745, clay: 0xb96b43, hard: 0x305f92 } as const;

function grain(x: number, y: number, salt: number): number {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ salt;
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 0x100000000;
}

/** Original physical colour maps, not the website's decorative tournament-theme wallpaper. */
export function createTennisCourtTexture(surface: CourtSurface): THREE.DataTexture {
  const size = 256, data = new Uint8Array(size * size * 4);
  const base = surface === 'grass' ? [82, 119, 69] : surface === 'clay' ? [185, 107, 67] : [48, 95, 146];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4, fine = grain(x, y, 71) - .5;
    let variation: number;
    if (surface === 'grass') {
      // Short, offset blades rather than a noisy carpet or a large repeating photograph.
      const blades = grain(Math.floor((x + (y % 5)) / 2), Math.floor(y / 6), 131) - .5;
      variation = blades * 19 + fine * 11;
    } else if (surface === 'clay') {
      const granule = grain(x, y, 197);
      variation = fine * 22 + (granule > .95 ? 20 : granule < .05 ? -14 : 0);
    } else variation = fine * 9 + (grain(x, y, 227) > .985 ? 10 : 0);
    for (let channel = 0; channel < 3; channel++) data[index + channel] = Math.round(base[channel] + variation * (surface === 'grass' && channel === 1 ? 1.15 : 1));
    data[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'original-tennis-' + surface + '-colour'; texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 4);
  texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true; return texture;
}
