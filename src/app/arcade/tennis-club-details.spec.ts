import * as THREE from 'three';
import { TennisClubDetails } from './tennis-club-details';
import { Tennis3DEngine } from './tennis-3d-engine';

describe('original tennis club scenery', () => {
  it('batches static architecture into a small number of draws', () => {
    const scene = new THREE.Scene(), textures: THREE.Texture[] = [];
    new TennisClubDetails(scene, texture => textures.push(texture));
    expect(scene.children.length).toBeLessThan(20);
    expect(scene.children.filter(item => item instanceof THREE.InstancedMesh).length).toBeGreaterThan(3);
    expect(textures.length).toBe(2);
    expect(scene.children.every(item => (item as THREE.Mesh).geometry != null)).toBeTrue();
  });
  it('only repaints the in-world scoreboard when the visible score changes', () => {
    const scene = new THREE.Scene(), textures: THREE.Texture[] = [];
    const club = new TennisClubDetails(scene, texture => textures.push(texture)), game = new Tennis3DEngine();
    game.start(); const before = JSON.stringify(game);
    club.update(game); const version = textures[0].version;
    for (let i = 0; i < 300; i++) club.update(game);
    expect(textures[0].version).toBe(version); expect(JSON.stringify(game)).toBe(before);
    game.scoring.award(0); club.update(game);
    expect(textures[0].version).toBe(version + 1);
  });
  it('updates both match and first-to-seven scoring without account data', () => {
    const scene = new THREE.Scene(), textures: THREE.Texture[] = [];
    const club = new TennisClubDetails(scene, texture => textures.push(texture));
    const game = new Tennis3DEngine(undefined, 'match'); game.start(); club.update(game);
    game.scoring.award(1); club.update(game); expect(textures[0].version).toBeGreaterThan(1);
    const challenge = new Tennis3DEngine(undefined, 'challenge'); challenge.start(); club.update(challenge);
    challenge.scoring.award(0); club.update(challenge);
    expect(challenge.scoring.pointLabels).toEqual(['1', '0']);
  });
});
