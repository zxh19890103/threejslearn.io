// import * as THREE from "three";
import { Boundary } from "./boundary.js";
import { vec3 } from "cases/vec3.js";
import { Float32ArrayVec3 } from "cases/Shared/Float32ArrayVec3.class.js";

const { floor } = Math;

export class LookUpGrid3D {
  private unit: number = 0;
  private N: Vec3 = [0, 0, 0];

  private min: Vec3;
  private max: Vec3;

  constructor(readonly b: Boundary, readonly particles: number, unit: number) {
    this.min = b.min;
    this.max = b.max;

    this.unit = unit;

    this.computeN();
  }

  setSpace(min: Vec3, max: Vec3) {
    this.min = min;
    this.max = max;
    this.computeN();
  }

  getSpace() {
    const { min, max } = this;
    return [...min, ...max];
  }

  private computeN() {
    const { min, max, unit } = this;
    const N = vec3.dR(min, max);

    vec3.ceil(vec3.divideScalar(N, unit));

    this.N = N;

    if (this.GOffset) return;

    const total = N[0] * N[1] * N[2];
    this.GOffset = new Uint32Array(total * 3);
    this.GData = new Uint32Array(this.particles);
    this.neighbors = new Uint32Array(this.particles);
    this.neighborsInOne = new Uint32Array((this.particles + 1) * this.particles);
  }

  setUnit(val: number) {
    if (val === this.unit) return;
    this.unit = val;
    this.computeN();
  }

  /**
   * Array<[key, offset, count]>
   */
  GOffset: Uint32Array;
  /**
   * the index of particles
   * means no particle setting.
   */
  GData: Uint32Array;
  /**
   * current neighbors.
   */
  neighborsInOne: Uint32Array;
  /**
   * the count of neighbors
   */
  neighborsCount: number;
  neighbors: Uint32Array;

  private sharingKeyVec3: Vec3 = [0, 0, 0];

  buildGrid(kArray: Float32ArrayVec3) {
    const [N0, N1, N2] = this.N;

    const { GOffset, GData } = this;

    GOffset.fill(0);

    let cursor = 0;
    let o1 = 0;
    let key = -1;

    for (let x = 0; x < N0; x += 1) {
      for (let y = 0; y < N1; y += 1) {
        for (let z = 0; z < N2; z += 1) {
          o1 = cursor * 3;

          key = cantorTri(x, y, z);

          GOffset[o1] = key;
          GOffset[o1 + 1] = cursor;

          let count = 0;

          for (let i = 0, s = kArray.count; i < s; i += 1) {
            const gridKey = kArray.get(i, this.sharingKeyVec3);
            if (x === gridKey[0] && y === gridKey[1] && z === gridKey[2]) {
              GData[cursor++] = i;
              count++;
            }
          }

          GOffset[o1 + 2] = count;
        }
      }
    }
  }

  getPossibleNeighborsByK(k: Vec3, particle: number = 0) {
    const { GOffset } = this;
    const start = particle * this.particles;

    let cursor = 0;

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          const key = cantorTri(k[0] + x, k[1] + y, k[2] + z);
          const i = indexOf(GOffset, key, 0);
          if (i === -1) continue;

          const offset = GOffset[i + 1];
          const count = GOffset[i + 2];

          for (let p = offset, s = offset + count; p < s; p++) {
            this.neighborsInOne[start + cursor++] = this.GData[p];
          }
        }
      }
    }

    this.neighborsInOne[start + this.particles - 1] = cursor;
    return cursor;
  }

  getPossibleNeighborsByK2(k: Vec3) {
    const { GOffset } = this;

    let cursor = 0;

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          const key = cantorTri(k[0] + x, k[1] + y, k[2] + z);
          const i = indexOf(GOffset, key, 0);
          if (i === -1) continue;

          const offset = GOffset[i + 1];
          const count = GOffset[i + 2];

          for (let p = offset, s = offset + count; p < s; p++) {
            this.neighbors[cursor++] = this.GData[p];
          }
        }
      }
    }

    this.neighborsCount = cursor;
    return cursor;
  }

  getPossibleNeighbors(i: number, kArray: Float32ArrayVec3) {
    kArray.get(i, this.sharingKeyVec3);
    return this.getPossibleNeighborsByK(this.sharingKeyVec3, i);
  }

  public getGridKey(i: Vec3, key: Vec3) {
    key[0] = floor((i[0] - this.min[0]) / this.unit);
    key[1] = floor((i[1] - this.min[1]) / this.unit);
    key[2] = floor((i[2] - this.min[2]) / this.unit);
  }
}

function cantorTri(k1: number, k2: number, k3: number) {
  const k4 = ((k1 + k2) * (k1 + k2 + 1)) / 2 + k2;
  return ((k4 + k3) * (k4 + k3 + 1)) / 2 + k3;
}

function indexOf(
  intArray: Uint32Array,
  value: number,
  offset: number,
  dimensions = 3
) {
  for (let i = 0, s = intArray.length; i < s; i += dimensions) {
    if (intArray[i + offset] === value) {
      return i;
    }
  }

  return -1;
}
