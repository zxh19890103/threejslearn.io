import * as THREE from "three";

const { floor, abs } = Math;

export class LookUpGrid3D {
  readonly center: THREE.Vector3;
  private unit: number = 0;
  private min: THREE.Vector3;
  private max: THREE.Vector3;

  constructor(readonly box: THREE.Box3, unit: number) {
    this.center = new THREE.Vector3();
    box.getCenter(this.center);
    this.min = new THREE.Vector3().copy(box.min);
    this.max = new THREE.Vector3().copy(box.max);
    this.unit = unit;
  }

  setUnit(val: number) {
    this.unit = val;
  }

  private getGridIndex(i: Vec3): Vec3 {
    const ix = floor((i[0] - this.min.x) / this.unit);
    const iy = floor((i[1] - this.min.y) / this.unit);
    const iz = floor((i[2] - this.min.z) / this.unit);
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
