import * as THREE from "three";
import { vec3 } from "../vec3.js";

interface BoundaryArgs {
  center: Vec3;
  width: number;
  height: number;
  depth: number;
}

export class Boundary {
  readonly edge: THREE.LineSegments;
  readonly model: THREE.Box3;

  readonly min: Vec3;
  readonly max: Vec3;

  private quaternionInvert: THREE.Quaternion = new THREE.Quaternion();

  constructor(readonly args: BoundaryArgs) {
    const box = new THREE.Box3();

    const boundaryBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(args.width, args.height, args.depth)
      ),
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );

    box.setFromObject(boundaryBox);

    boundaryBox.position.set(...args.center);

    this.max = box.max.toArray();
    this.min = box.min.toArray();

    this.edge = boundaryBox;

    __3__.crs(this.edge);

    this.model = box;
    this.quaternionInvert.copy(this.edge.quaternion).conjugate();
  }

  private vector3 = new THREE.Vector3();
  private localAxis = new THREE.Vector3();
  private rotationRad: number = 0;

  rotate(localAxis: Vec3, deg: number) {
    this.localAxis.set(...localAxis).normalize();
    this.rotationRad = deg * __3__.deg2rad;
    this.edge.rotateOnAxis(this.localAxis, this.rotationRad);
    this.quaternionInvert.copy(this.edge.quaternion).conjugate();
  }

  moveChild(i: BoundaryElement) {
    this.worldToLocal(i.position);

    const dV = this.vector3
      .clone()
      .crossVectors(
        this.localAxis.clone().setLength(this.rotationRad),
        vec3.toVLike(i.position)
      )
      .toArray();

    this.vector3
      .set(...i.position)
      .applyAxisAngle(this.localAxis, this.rotationRad);
    i.position = this.vector3.toArray();

    this.localToWorld(i.position);
    this.toWorld(dV);
    vec3.add(i.velocity, dV);
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
    this.vector3.applyQuaternion(this.edge.quaternion);

    localVec[0] = this.vector3.x;
    localVec[1] = this.vector3.y;
    localVec[2] = this.vector3.z;
  }

  worldToLocal(worldPosition: Vec3) {
    this.vector3.set(...worldPosition);
    this.edge.worldToLocal(this.vector3);

    worldPosition[0] = this.vector3.x;
    worldPosition[1] = this.vector3.y;
    worldPosition[2] = this.vector3.z;
  }

  localToWorld(localPosition: Vec3) {
    this.vector3.set(...localPosition);
    this.edge.localToWorld(this.vector3);

    localPosition[0] = this.vector3.x;
    localPosition[1] = this.vector3.y;
    localPosition[2] = this.vector3.z;
  }

  getRandomWorldPosition(): Vec3 {
    const { min, max } = this;
    const local: Vec3 = [
      min[0] + (max[0] - min[0]) * Math.random(),
      min[1] + (max[1] - min[1]) * Math.random(),
      min[2] + (max[2] - min[2]) * Math.random(),
    ];
    this.localToWorld(local);
    return local;
  }
}

interface BoundaryElement {
  position: Vec3;
  velocity: Vec3;
}
