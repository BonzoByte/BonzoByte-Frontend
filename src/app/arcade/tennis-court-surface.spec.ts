import * as THREE from 'three';
import { createTennisCourtTexture } from './tennis-court-surface';

describe('physical court surface maps', () => {
  it('keeps original colour maps small, opaque and identical despite unrelated graphics UUID randomness', () => {
    const random = spyOn(Math, 'random').and.callThrough();
    for (const surface of ['grass','clay','hard'] as const) {
      random.and.returnValue(.1); const a = createTennisCourtTexture(surface);
      random.and.returnValue(.9); const b = createTennisCourtTexture(surface);
      const values = a.image.data!;
      expect(values).not.toBeNull();
      expect(a.image.width).toBe(256); expect(a.image.height).toBe(256); expect(values.byteLength).toBe(256*256*4);
      expect(a.image.data).toEqual(b.image.data); expect(a.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(a.wrapS).toBe(THREE.RepeatWrapping); expect(a.generateMipmaps).toBeTrue();
      for (let i=3;i<values.length;i+=4) { if(values[i]!==255) fail('Surface alpha must remain opaque.'); }
      a.dispose(); b.dispose();
    }
  });
  it('uses a green lawn, red clay and blue acrylic rather than near-black theme wallpaper', () => {
    for (const surface of ['grass','clay','hard'] as const) {
      const texture=createTennisCourtTexture(surface), values=texture.image.data!, totals=[0,0,0];
      for(let i=0;i<values.length;i+=4) for(let channel=0;channel<3;channel++)totals[channel]+=values[i+channel];
      const means=totals.map(total=>total/(256*256));
      expect(Math.min(...means)).toBeGreaterThan(35);
      if(surface==='grass')expect(means[1]).toBeGreaterThan(means[0]);
      if(surface==='clay')expect(means[0]).toBeGreaterThan(means[1]);
      if(surface==='hard')expect(means[2]).toBeGreaterThan(means[1]);
      texture.dispose();
    }
  });
});
