import * as THREE from 'three';

// Small, deterministic material maps. The architecture is live geometry;
// these textures add surface grain without loading photographic scenery.
function surfaceMap(kind, size = 256) {
  const data = new Uint8Array(size * size * 4);
  let seed = 826471;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = random() - 0.5;
      let value;
      if (kind === 'wood') {
        const wave = Math.sin(y * 0.2 + Math.sin(x * 0.012) * 2.4);
        const fine = Math.sin(y * 1.5 + Math.sin(x * 0.027) * 2.2);
        value = 209 + wave * 13 + fine * 4 + n * 13;
      } else if (kind === 'carpet') {
        value = 176 + n * 53 + ((x + y) % 2 ? 7 : -7);
      } else {
        const broad = Math.sin(x * 0.055) * Math.cos(y * 0.047) * 6;
        value = 211 + n * 22 + broad;
      }
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, value));
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createCampusTextures() {
  const concrete = surfaceMap('concrete');
  concrete.repeat.set(9, 8);
  const oak = surfaceMap('wood');
  oak.repeat.set(1.5, 1);
  const carpet = surfaceMap('carpet');
  carpet.repeat.set(14, 7);
  return { concrete, oak, carpet };
}
