import * as THREE from "three";
import { Boundary } from "./boundary.js";
import { vec3 } from "cases/vec3.js";

const { floor, abs } = Math;

export class LookUpGrid3D {
  private unit: number = 0;

  readonly min: Vec3;
  readonly max: Vec3;

  constructor(readonly b: Boundary, unit: number) {
    this.min = b.min;
    this.max = b.max;
    this.unit = unit;
  }

  setUnit(val: number) {
    this.unit = val;
  }

  private getGridIndex(i: Vec3): Vec3 {
    const ix = floor((i[0] - this.min[0]) / this.unit);
    const iy = floor((i[1] - this.min[1]) / this.unit);
    const iz = floor((i[2] - this.min[2]) / this.unit);
    return [ix, iy, iz];
  }

  isNeighbourhood(i: Vec3, j: Vec3) {
    const i3i = this.getGridIndex(i);
    const i3j = this.getGridIndex(j);

    const di3x = abs(i3i[0] - i3j[0]);
    const di3y = abs(i3i[1] - i3j[1]);
    const di3z = abs(i3i[2] - i3j[2]);

    return di3x < 2 && di3y < 2 && di3z < 2;
  }
}
