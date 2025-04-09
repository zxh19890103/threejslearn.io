import * as THREE from "three";

export class Surface extends THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshPhongMaterial
> {
  constructor() {
    super();
  }
}
