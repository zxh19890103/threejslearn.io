import * as THREE from "three";
import { vec3 } from "../vec3.js";
import * as config from "./config.js";

interface BoundaryArgs {
  center: Vec3;
  width: number;
  height: number;
  depth: number;
}

export class Boundary {
  readonly mesh: THREE.Mesh;
  readonly edge: THREE.LineSegments;
  readonly model: THREE.Box3;

  readonly bmin: Vec3;
  readonly bmax: Vec3;

  readonly emin: Vec3;
  readonly emax: Vec3;

  readonly min: Vec3;
  readonly max: Vec3;

  readonly down: Vec3 = [0, -1, 0];

  private quaternionInvert: THREE.Quaternion = new THREE.Quaternion();

  constructor(readonly args: BoundaryArgs) {
    const box = new THREE.Box3();

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(args.width, args.height, args.depth),
      new THREE.MeshStandardMaterial({
        color: 0x01fe90,
        visible: false,
        transparent: true,
        opacity: 0.2, // 調整透明度
        depthWrite: false,
      })
    );

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ visible: true, color: 0x000000 })
    );

    // set before the mesh moves, so the box is static in the local state.
    box.setFromObject(mesh);

    mesh.position.set(...args.center);

    this.max = box.max.toArray();
    this.min = box.min.toArray();

    box.expandByScalar(-config.ballradius);

    this.bmax = box.max.toArray();
    this.bmin = box.min.toArray();

    this.edge = edge;
    this.mesh = mesh;
    this.mesh.add(edge);

    __3__.crs(this.mesh);

    this.model = box;

    this.quaternionInvert.copy(this.mesh.quaternion).conjugate();

    vec3.copy(this.down, config.down);
    this.toLocal(this.down);
  }

  private vector3 = new THREE.Vector3();
  private vector3_1 = new THREE.Vector3();

  private rotationLocalAxis = new THREE.Vector3();
  private rotationRad: number = 0;
  private moveDelta: Vec3 = null;
  private transformDt: number = 1;

  rotate(localAxis: Vec3, deg: number, dt = config.variables.dt) {
    this.rotationLocalAxis.set(...localAxis).normalize();
    this.rotationRad = deg * __3__.deg2rad;
    this.transformDt = dt;
    this.mesh.rotateOnAxis(this.rotationLocalAxis, this.rotationRad);
    this.quaternionInvert.copy(this.mesh.quaternion).conjugate();

    vec3.copy(this.down, config.down);
    this.toLocal(this.down);
  }

  move(delta: Vec3, dt = config.variables.dt) {
    this.moveDelta = delta;
    this.transformDt = dt;

    this.mesh.position.x += delta[0];
    this.mesh.position.y += delta[1];
    this.mesh.position.z += delta[2];
  }

  affectAfterMove(r: Vec3, v: Vec3) {
    this.toLocal(this.moveDelta);
    vec3.add(v, this.moveDelta);
  }

  affectAfterRotation(r: Vec3, v: Vec3) {
    const omega = this.rotationLocalAxis
      .clone()
      .multiplyScalar(this.rotationRad);
    this.vector3.crossVectors(omega, vec3.toV3Like(r));

    v[0] += this.vector3.x;
    v[1] += this.vector3.y;
    v[2] += this.vector3.z;
  }

  toLocal(worldVec: Vec3) {
    this.vector3.set(...worldVec);
    this.vector3.applyQuaternion(this.quaternionInvert);

    worldVec[0] = this.vector3.x;
    worldVec[1] = this.vector3.y;
    worldVec[2] = this.vector3.z;
  }

  toWorld(localVec: Vec3) {
    this.vector3.set(...localVec);
    this.vector3.applyQuaternion(this.mesh.quaternion);

    localVec[0] = this.vector3.x;
    localVec[1] = this.vector3.y;
    localVec[2] = this.vector3.z;
  }

  worldToLocal(worldPosition: Vec3) {
    this.vector3.set(...worldPosition);
    this.mesh.worldToLocal(this.vector3);

    worldPosition[0] = this.vector3.x;
    worldPosition[1] = this.vector3.y;
    worldPosition[2] = this.vector3.z;
  }

  localToWorld(localPosition: Vec3) {
    this.vector3.set(...localPosition);
    this.mesh.localToWorld(this.vector3);

    localPosition[0] = this.vector3.x;
    localPosition[1] = this.vector3.y;
    localPosition[2] = this.vector3.z;
  }

  arrange(
    each: (i: number, x: number, y: number, z: number) => void,
    n: number,
    gap: number,
    size: Vec3
  ) {
    const [width, height, depth] = size;
    const dV = vec3.normalize(size);
    const vol = dV[0] + dV[1] + dV[2];

    const nX = Math.ceil(Math.pow(n, dV[0] / vol));
    const nY = Math.ceil(Math.pow(n, dV[1] / vol));
    const nZ = Math.ceil(Math.pow(n, dV[2] / vol));

    const gapX = Math.min(gap, width / nX);
    const gapY = Math.min(gap, height / nY);
    const gapZ = Math.min(gap, depth / nZ);

    const tx = (-gapX * nX) / 2;
    const ty = -(gapY * nY) / 2;
    const tz = (-gapZ * nZ) / 2;

    console.log(nX, nY, nZ);
    console.log(gapX, gapY, gapZ, gap);

    let i = 0;
    let px = 0;
    let py = 0;
    let pz = 0;

    for (let x = 0; x < nX; x++) {
      for (let y = 0; y < nY; y++) {
        for (let z = 0; z < nZ; z++) {
          if (i === n) return;

          px = tx + (x + 0.5) * gapX;
          py = ty + (y + 0.5) * gapY;
          pz = tz + (z + 0.5) * gapZ;

          each(i, px, py, pz);

          i++;
        }
      }
    }
  }

  getRandomLocalPosition(P: Vec3): Vec3 {
    const { bmin: min, bmax: max } = this;
    P[0] = min[0] + (max[0] - min[0]) * Math.random();
    P[1] = min[1] + (max[1] - min[1]) * Math.random();
    P[2] = min[2] + (max[2] - min[2]) * Math.random();
    return P;
  }
}
