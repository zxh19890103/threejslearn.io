import * as THREE from "three";

let outGridIndices: Float32Array;
let neighbors: THREE.DataTexture;

export const initialize = (texSize: number) => {
  const count = texSize * texSize * 4;
  outGridIndices = new Float32Array(count);

  const data = new Uint32Array((texSize + 1) * texSize);

  neighbors = new THREE.DataTexture(
    data,
    texSize,
    texSize,
    THREE.RedIntegerFormat,
    THREE.UnsignedIntType
  );
};

export const buildGrid = (
  particles: Float32Array, // each particle has 4 floats (x, y, z, w)
  boundary: THREE.Box3,
  H: number // smoothing radius
): Float32Array /* returns gridRes */ => {
  const count = particles.length / 4;
  const min = boundary.min;
  const size = new THREE.Vector3().subVectors(boundary.max, boundary.min);

  // Step 1: Compute grid resolution
  const gridRes = new THREE.Vector3(
    Math.ceil(size.x / H),
    Math.ceil(size.y / H),
    Math.ceil(size.z / H)
  );

  // Step 3: For each particle, compute grid index
  for (let i = 0; i < count; i++) {
    const idx = i * 4;
    const x = particles[idx];
    const y = particles[idx + 1];
    const z = particles[idx + 2];

    // Relative position inside boundary
    const relX = (x - min.x) / size.x;
    const relY = (y - min.y) / size.y;
    const relZ = (z - min.z) / size.z;

    // Grid index
    const gx = Math.min(
      gridRes.x - 1,
      Math.max(0, Math.floor(relX * gridRes.x))
    );
    const gy = Math.min(
      gridRes.y - 1,
      Math.max(0, Math.floor(relY * gridRes.y))
    );
    const gz = Math.min(
      gridRes.z - 1,
      Math.max(0, Math.floor(relZ * gridRes.z))
    );

    outGridIndices[idx] = gx;
    outGridIndices[idx + 1] = gy;
    outGridIndices[idx + 2] = gz;
    outGridIndices[idx + 3] = 0;
  }

  return outGridIndices;
};

export const findNeighbors = (particles: Float32Array): THREE.DataTexture => {
  return neighbors;
};
