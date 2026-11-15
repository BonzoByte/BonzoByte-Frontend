import * as THREE from 'three';
import { FIELD } from './tennis-3d-engine';
import { Tennis3DRenderer } from './tennis-3d-renderer';

describe('tennis court presentation geometry without a WebGL context', () => {
  let renderer: any;
  beforeEach(() => {
    renderer = Object.create(Tennis3DRenderer.prototype);
    Object.assign(renderer, {scene:new THREE.Scene(),unitBox:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,8,6),
      apronMaterial:new THREE.MeshStandardMaterial(),courtMaterial:new THREE.MeshStandardMaterial(),textures:new Set(),mowing:new THREE.Group()});
  });
  afterEach(() => {
    const geometries=new Set<THREE.BufferGeometry>(), materials=new Set<THREE.Material>();
    renderer.scene.traverse((item:THREE.Object3D)=>{
      if(!(item instanceof THREE.Mesh || item instanceof THREE.LineSegments))return;
      geometries.add(item.geometry);(Array.isArray(item.material)?item.material:[item.material]).forEach(m=>materials.add(m));
      if(item instanceof THREE.InstancedMesh)item.dispose();
    });
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.textures.forEach((t:THREE.Texture)=>t.dispose());
    renderer.unitBox.dispose();renderer.sphere.dispose();renderer.apronMaterial.dispose();renderer.courtMaterial.dispose();
  });
  it('leaves a full rectangular opening for the textured court instead of covering it', () => {
    renderer.buildGround();
    const apron=renderer.scene.getObjectByName('court-run-off-with-opening') as THREE.Mesh;
    renderer.scene.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(0,10,0),new THREE.Vector3(0,-1,0));
    for(const x of [-4,0,4]) for(const z of [-11,0,11]) { ray.ray.origin.set(x,10,z);expect(ray.intersectObject(apron).length).toBe(0); }
    for(const x of [-9,9]) for(const z of [-17,0,17]) { ray.ray.origin.set(x,10,z);const hits=ray.intersectObject(apron);expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.y).toBeCloseTo(.0225,5); }
    const positions=apron.geometry.getAttribute('position'), indices=apron.geometry.index!;
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let area=0;
    for(let i=0;i<indices.count;i+=3) {a.fromBufferAttribute(positions,indices.getX(i));b.fromBufferAttribute(positions,indices.getX(i+1));c.fromBufferAttribute(positions,indices.getX(i+2));area+=b.sub(a).cross(c.sub(a)).length()/2;}
    expect(area).toBeCloseTo(21*37-10.97*23.77,3);
  });
  it('keeps the visible headband within the unchanged collision height', () => {
    renderer.buildNet();
    const headband=renderer.scene.getObjectByName('tennis-net-headband') as THREE.Mesh;
    const positions=headband.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++) {
      expect(positions.getY(i)).toBeLessThanOrEqual(FIELD.netHeight+.000001);
      expect(positions.getY(i)).toBeGreaterThan(FIELD.netHeight-.061);
    }
    const net=renderer.scene.getObjectByName('tennis-net-mesh') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
    expect(net.material.transparent).toBeTrue();expect(net.material.alphaTest).toBe(0);expect(net.material.forceSinglePass).toBeTrue();
  });
  it('offsets the subtle grass mowing stripes to avoid coplanar flicker', () => {
    renderer.buildCourt();expect(renderer.mowing.children.length).toBe(6);
    const stripe=renderer.mowing.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
    expect(stripe.material.polygonOffset).toBeTrue();expect(stripe.material.depthWrite).toBeFalse();
    expect(stripe.material.opacity).toBeLessThan(.1);expect(renderer.textures.size).toBe(1);
  });
});
