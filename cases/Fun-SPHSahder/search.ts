import * as THREE from "three";
import { vec3 } from "cases/vec3.js";

const { floor } = Math;

export class LookUpGrid3D {
  private unit: number = 0;
  private min: Vec3;
  private max: Vec3;

  public readonly grid: THREE.Vector3 = new THREE.Vector3();
  public readonly particlesCount: number;

  constructor(
    readonly bbox: THREE.Box3,
    readonly texSize: number,
    unit: number
  ) {
    this.min = [...bbox.min] as Vec3;
    this.max = [...bbox.max] as Vec3;

    this.unit = unit;
    this.particlesCount = texSize * texSize;

    const grid = vec3.dR(this.min, this.max);
    vec3.ceil(vec3.divideScalar(grid, unit));
    this.grid.set(...grid);

    const total = grid[0] * grid[1] * grid[2];

    this.GOffset = new Int32Array(4 * total);
    this.GOffsetTex = new THREE.Data3DTexture(
      this.GOffset,
      grid[0],
      grid[1],
      grid[2]
    );
    this.GOffsetTex.format = THREE.RGBAIntegerFormat;
    this.GOffsetTex.type = THREE.IntType;
    this.GOffsetTex.needsUpdate = true;

    this.GData = new Int32Array(this.particlesCount);
    this.GDataTex = new THREE.DataTexture(
      this.GData,
      texSize,
      texSize,
      THREE.RedIntegerFormat,
      THREE.IntType
    );
    this.GDataTex.needsUpdate = true;

    this.GKey = new Int32Array(this.particlesCount * 4);
    this.GKeyTex = new THREE.DataTexture(
      this.GKey,
      texSize,
      texSize,
      THREE.RGBAIntegerFormat,
      THREE.IntType
    );
    this.GKeyTex.needsUpdate = true;
  }

  GOffset: Int32Array;
  public GOffsetTex: THREE.Data3DTexture;

  /**
   * the index of particles
   */
  GData: Int32Array;
  public GDataTex: THREE.DataTexture;

  public GKey: Int32Array;
  public GKeyTex: THREE.DataTexture;

  private getGridKeyXYZ(K: Vec3, x: number, y: number, z: number) {
    K[0] = floor((x - this.min[0]) / this.unit);
    K[1] = floor((y - this.min[1]) / this.unit);
    K[2] = floor((z - this.min[2]) / this.unit);
  }

  buildKeyArray(particles: Float32Array) {
    const GKey = this.GKey;
    const key: Vec3 = [0, 0, 0];

    let k = 0;
    let x = 0;
    let y = 0;
    let z = 0;

    GKey.fill(-1);

    for (let i = 0, L = particles.length; i < L; i += 4) {
      x = particles[i];
      y = particles[i + 1];
      z = particles[i + 2];

      this.getGridKeyXYZ(key, x, y, z);

      GKey[k++] = key[0];
      GKey[k++] = key[1];
      GKey[k++] = key[2];
      k++;
    }

    this.GKeyTex.needsUpdate = true;
  }

  buildGrid() {
    const { x: N0, y: N1, z: N2 } = this.grid;
    const { GData, GKey } = this;

    let k = 0;
    let cursor = 0;

    for (let x = 0; x < N0; x += 1) {
      for (let y = 0; y < N1; y += 1) {
        for (let z = 0; z < N2; z += 1) {
          const i4 = k * 4;

          this.GOffset[i4] = cursor;

          let count = 0;

          for (let i = 0; i < this.particlesCount; i++) {
            const o = i * 4;

            if (GKey[o] === x && GKey[o + 1] === y && GKey[o + 2] === z) {
              GData[cursor++] = i;
              count++;
            }
          }

          this.GOffset[i4 + 1] = count;
          k++;
        }
      }
    }

    this.GOffsetTex.needsUpdate = true;
    this.GDataTex.needsUpdate = true;
  }

  eachGridCell(fn: (x: number, y: number, z: number, index: number) => void) {
    const { x: N0, y: N1, z: N2 } = this.grid;
    let i = 0;

    for (let x = 0; x < N0; x++) {
      for (let y = 0; y < N1; y++) {
        for (let z = 0; z < N2; z++) {
          fn(x, y, z, i++);
        }
      }
    }
  }

  hl(x: number, y: number, z: number) {
    const { x: N0, y: N1, z: N2 } = this.grid;
    const index = z + y * N2 + x * N2 * N1;

    const offset = this.GOffset[index * 4];
    const count = this.GOffset[index * 4 + 1];

    const particles: number[] = [];

    for (let i = 0; i < count; i++) {
      const k = offset + i;
      const particle = this.GData[k];
      particles.push(particle);
    }

    return particles;
  }

  print() {
    console.log("[Grid] xyz", this.grid.toArray());
    console.log("[Grid] unit", this.unit);
  }

  visualize() {
    const { x: n1, y: n2, z: n3 } = this.grid;
    const lines = createGridLineSegments(n1, n2, n3, this.unit);
    lines.position.add(new THREE.Vector3(...this.min));
    return lines;
  }
}

function createGridLineSegments(n1, n2, n3, spacing = 1) {
  const positions = [];

  for (let i = 0; i <= n1; i++) {
    for (let j = 0; j <= n2; j++) {
      for (let k = 0; k <= n3; k++) {
        const x = i * spacing;
        const y = j * spacing;
        const z = k * spacing;

        // Line in X direction
        if (i < n1) {
          positions.push(x, y, z);
          positions.push(x + spacing, y, z);
        }
        // Line in Y direction
        if (j < n2) {
          positions.push(x, y, z);
          positions.push(x, y + spacing, z);
        }
        // Line in Z direction
        if (k < n3) {
          positions.push(x, y, z);
          positions.push(x, y, z + spacing);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  const material = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
  return new THREE.LineSegments(geometry, material);
}
