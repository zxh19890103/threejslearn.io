import * as THREE from "three";
import { vec3 } from "cases/vec3.js";

const { floor } = Math;

export class LookUpGrid3D {
  private unit: number = 0;
  private N: Vec3 = [0, 0, 0];
  private min: Vec3;
  private max: Vec3;

  public readonly particlesCount: number;
  public gridKeyArray: Int32Array;
  public neighborsAsTexture: THREE.DataTexture;

  constructor(readonly b: THREE.Box3, readonly texSize: number, unit: number) {
    this.min = [...b.min] as Vec3;
    this.max = [...b.max] as Vec3;

    this.unit = unit;
    this.particlesCount = texSize * texSize;

    this.neighborsAsTexture = new THREE.DataTexture(
      null,
      texSize,
      texSize,
      THREE.RedIntegerFormat,
      THREE.IntType
    );

    this.computeN();
  }

  getSpace() {
    const { min, max } = this;
    return [...min, ...max];
  }

  computeN() {
    const { min, max, unit } = this;
    const N = vec3.dR(min, max);

    vec3.ceil(vec3.divideScalar(N, unit));

    this.N = N;
    const total = N[0] * N[1] * N[2];

    if (this.GOffset) return;

    const half = Math.ceil(this.particlesCount);
    this.neighborsInOneDimensions = [half + 1, this.particlesCount];

    this.GOffset = new Int32Array(total * 3);
    this.GData = new Int32Array(this.particlesCount);

    this.neighbors = new Int32Array(half);
    this.neighborsInOne = new Int32Array((half + 1) * this.particlesCount);

    this.gridKeyArray = new Int32Array(this.particlesCount * 3).fill(-1);

    this.neighborsAsTexture.image.data = this.neighbors;
    this.neighborsAsTexture.needsUpdate = true;
  }

  setUnit(val: number) {
    if (val === this.unit) return;
    this.unit = val;
    this.computeN();
  }

  /**
   * Array<[key, offset, count]>
   */
  GOffset: Int32Array;
  /**
   * the index of particles
   * means no particle setting.
   */
  GData: Int32Array;
  /**
   * current neighbors.
   */
  neighborsInOne: Int32Array;
  /**
   * 0 - how many neighbors in max for one particle
   * 1 - rows for all particles.
   */
  neighborsInOneDimensions: Vec2 = [0, 0];
  /**
   * the count of neighbors
   */
  neighborsCount: number;
  /**
   * possible neighbors of particle `i`
   */
  neighbors: Int32Array;

  private getGridKeyXYZ(K: Vec3, x: number, y: number, z: number) {
    K[0] = floor((x - this.min[0]) / this.unit);
    K[1] = floor((y - this.min[1]) / this.unit);
    K[2] = floor((z - this.min[2]) / this.unit);
  }

  buildKeyArray(particles: Float32Array) {
    const gridKeyArray = this.gridKeyArray;
    const key: Vec3 = [0, 0, 0];

    let x = 0;
    let y = 0;
    let z = 0;

    gridKeyArray.fill(-1);

    for (let i = 0, L = particles.length; i < L; i += 4) {
      this.getGridKeyXYZ(key, x, y, z);

      gridKeyArray[i] = key[0];
      gridKeyArray[i + 1] = key[1];
      gridKeyArray[i + 2] = key[2];
    }
  }

  buildGrid() {
    const [N0, N1, N2] = this.N;
    const { GOffset, GData, gridKeyArray } = this;

    GOffset.fill(0);

    let cursor = 0;
    let key = -1;
    let o1 = 0;

    for (let x = 0; x < N0; x += 1) {
      for (let y = 0; y < N1; y += 1) {
        for (let z = 0; z < N2; z += 1) {
          key = cantorTri(x, y, z);

          GOffset[o1] = key;
          GOffset[o1 + 1] = cursor;

          let count = 0;

          for (let i = 0; i < this.particlesCount; i++) {
            const o = i * 3;

            if (
              gridKeyArray[o] === x &&
              gridKeyArray[o + 1] === y &&
              gridKeyArray[o + 2] === z
            ) {
              GData[cursor++] = i;
              count++;
            }
          }

          GOffset[o1 + 2] = count;
          o1 += 3;
        }
      }
    }
  }

  indexOfGOffsetKey(key: number) {
    for (let i = 0, s = this.GOffset.length; i < s; i += 3) {
      if (this.GOffset[i] === key) {
        if (this.GOffset[i + 2] === 0) return -1;
        return i;
      }
    }
    return -1;
  }

  private getPossibleNeighborsOfPartice(particle: number = 0) {
    const { GOffset, gridKeyArray } = this;
    const start = 1 + particle * this.neighborsInOneDimensions[0];

    const gk: Vec3 = [0, 0, 0];

    const o1 = particle * 3;
    gk[0] = gridKeyArray[o1];
    gk[1] = gridKeyArray[o1 + 1];
    gk[2] = gridKeyArray[o1 + 2];

    let gkx = 0;
    let gky = 0;
    let gkz = 0;

    let cursor = 0;

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          gkx = gk[0] + x;
          gky = gk[1] + y;
          gkz = gk[2] + z;

          if (gkx < 0 || gky < 0 || gkz < 0) continue;

          const key = cantorTri(gkx, gky, gkz);
          const i = this.indexOfGOffsetKey(key);

          if (i === -1) continue;

          const offset = GOffset[i + 1];
          const count = GOffset[i + 2];

          for (let p = offset, s = offset + count; p < s; p++) {
            this.neighborsInOne[start + cursor++] = this.GData[p];
          }
        }
      }
    }

    this.neighborsInOne[start - 1] = cursor;
    return cursor;
  }

  findNeighbors() {
    for (let i = 0; i < this.particlesCount; i++) {
      this.getPossibleNeighborsOfPartice(i);
    }
  }
}

function cantorTri(k1: number, k2: number, k3: number) {
  const k4 = ((k1 + k2) * (k1 + k2 + 1)) / 2 + k2;
  return ((k4 + k3) * (k4 + k3 + 1)) / 2 + k3;
}
