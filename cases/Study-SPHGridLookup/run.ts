/**
 * Generated Automatically At Sun May 25 2025 21:29:51 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { LookUpGrid3D } from "cases/Fun-SPHSahder/search.js";

let enableGrid = false;
let enableAxes = false;

//#region reactive
__dev__();
__defineControl__("enableGrid", "bit", enableGrid);
__defineControl__("enableAxes", "bit", enableAxes);

__updateControlsDOM__ = () => {
  __renderControls__({
    enableAxes,
    enableGrid,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  const texSize = 3;
  const particlesCount = texSize * texSize;
  const h = 3;

  const bbox = new THREE.Box3(
    new THREE.Vector3(-3, -3, -3),
    new THREE.Vector3(3, 3, 3)
  );

  const particles = generateParticles(particlesCount, bbox);
  const lookupGrid = new LookUpGrid3D(bbox, texSize, h);

  lookupGrid.buildKeyArray(particles);
  lookupGrid.buildGrid();

  world.add(lookupGrid.visualize());

  let displayParticles: THREE.Points;

  const show = () => {
    if (displayParticles) world.remove(displayParticles);

    displayParticles = createParticlesPoints(particles);
    world.add(displayParticles);
  };

  show();

  const grids: Vec3[] = [];

  lookupGrid.eachGridCell((x, y, z, i) => {
    grids.push([x, y, z]);
  });

  const getParticlesByGridKey = (x: number, y: number, z: number): number[] => {
    const index = z + y * texSize + x * texSize * texSize;
    const offset = lookupGrid.GOffset[index * 4];
    const count = lookupGrid.GOffset[index * 4 + 1];
    const particles: number[] = [];

    for (let i = 0; i < count; i++) {
      const k = offset + i;
      const particle = lookupGrid.GData[k];
      particles.push(particle);
    }

    return particles;
  };

  const getGridCell = (i: number): Vec3 => {
    const x = i % texSize;
    const y = Math.floor(i / texSize);
    const index = y * texSize + x;

    const gx = lookupGrid.GKey[index * 4];
    const gy = lookupGrid.GKey[index * 4 + 1];
    const gz = lookupGrid.GKey[index * 4 + 2];

    return [gx, gy, gz];
  };

  let particleId = 0;

  __updateTHREEJs__invoke__.hl = () => {
    // const cell = grids.shift();

    const cell = getGridCell(particleId);

    const particles1 = lookupGrid.hl(...cell);
    console.log(particles1);

    for (let i = 0; i < particlesCount; i++) {
      particles[i * 4 + 3] = 0;
    }

    particles[particleId * 4 + 3] = 0.5;

    for (let i of particles1) {
      particles[i * 4 + 3] = 1;
    }

    show();

    particleId++;
  };
};

__defineControl__("hl", "btn", "ha");

/**
 * Generate a Float32Array of 4D particle positions inside a bounding box.
 * @param {number} count - Number of particles to generate.
 * @param {THREE.Box3} bbox - Bounding box within which to generate particles.
 * @returns {Float32Array} A flat array of [x, y, z, w] * count (w = 0).
 */
function generateParticles(count, bbox) {
  const array = new Float32Array(count * 4); // 4 floats per particle

  const min = bbox.min;
  const max = bbox.max;

  for (let i = 0; i < count; i++) {
    const x = THREE.MathUtils.lerp(min.x, max.x, Math.random());
    const y = THREE.MathUtils.lerp(min.y, max.y, Math.random());
    const z = THREE.MathUtils.lerp(min.z, max.z, Math.random());

    array[i * 4 + 0] = x;
    array[i * 4 + 1] = y;
    array[i * 4 + 2] = z;
    array[i * 4 + 3] = 0; // unused 4th component
  }

  return array;
}

/**
 * Create a THREE.Points object to display particle positions.
 * @param {Float32Array} data - A flat array of [x, y, z, w] values (w is ignored).
 * @returns {THREE.Points} - A renderable Points object.
 */
function createParticlesPoints(data: Float32Array) {
  const count = data.length / 4; // Each particle has 4 values

  const geometry = new THREE.BufferGeometry();

  // Extract x, y, z from each 4D group and put into a Float32Array for position attribute
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3).fill(1);

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = data[i * 4 + 0]; // x
    positions[i * 3 + 1] = data[i * 4 + 1]; // y
    positions[i * 3 + 2] = data[i * 4 + 2]; // z

    const w = data[i * 4 + 3];
    if (w === 1) {
      colors[i * 3 + 0] = 1;
      colors[i * 3 + 1] = 0;
      colors[i * 3 + 2] = 0;
    } else if (w === 0.5) {
      colors[i * 3 + 0] = 0;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 0;
    } else {
      colors[i * 3 + 0] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  // Material for the particles
  const material = new THREE.PointsMaterial({
    size: 0.1,
    color: 0xffffff,
    transparent: true,
    opacity: 0.68,
    vertexColors: true,
    sizeAttenuation: true, // makes particles scale by distance
  });

  // Create and return the Points object
  return new THREE.Points(geometry, material);
}
