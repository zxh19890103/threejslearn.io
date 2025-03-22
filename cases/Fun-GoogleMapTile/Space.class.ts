import * as THREE from "three";
import { earthConfig, latLngToSphere } from "./calc.js";

export class Space {
  readonly origin: THREE.Vector3 = new THREE.Vector3();
  readonly xAxis: THREE.Vector3 = new THREE.Vector3();
  readonly yAxis: THREE.Vector3 = new THREE.Vector3();
  readonly zAxis: THREE.Vector3 = new THREE.Vector3();

  constructor(o: Vec3, x: Vec3, y: Vec3, z: Vec3) {
    this.origin.set(...o);
    this.xAxis.set(...x).normalize();
    this.yAxis.set(...y).normalize();
    this.zAxis.set(...z).normalize();
  }

  visualize(size: number): THREE.LineSegments {
    const line = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        vertexColors: true,
      })
    );

    const pts: number[] = [];
    const colors: number[] = [];

    // x
    pts.push(
      ...this.origin,
      ...__reusable_vec3__.copy(this.xAxis).setLength(size).add(this.origin)
    );

    colors.push(1, 0, 0, 1, 0, 0);

    // x
    pts.push(
      ...this.origin,
      ...__reusable_vec3__.copy(this.yAxis).setLength(size).add(this.origin)
    );

    colors.push(0, 1, 0, 0, 1, 0);

    // x
    pts.push(
      ...this.origin,
      ...__reusable_vec3__.copy(this.zAxis).setLength(size).add(this.origin)
    );

    colors.push(0, 0, 1, 0, 0, 1);

    line.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(pts, 3)
    );

    line.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    return line;
  }

  toWorld(pt: Vec3) {
    const m = new THREE.Matrix4().makeBasis(this.xAxis, this.yAxis, this.zAxis);

    return __reusable_vec3__
      .set(...pt)
      .applyMatrix4(m)
      .clone();
  }

  toSpace(pt: Vec3, space: Space): THREE.Vector3 {
    return null;
  }
}

export const getEarthHorizonCRS = (lat: number, lon: number) => {
  const coords = latLngToSphere(lat, lon, earthConfig.R);

  const toSouth = latLngToSphere(lat - 1, lon, earthConfig.R);
  const toWest = latLngToSphere(lat, lon - 1, earthConfig.R);
  const toEarth = latLngToSphere(lat, lon, earthConfig.R * 0.8);

  const xAxis = [
    toSouth.x - coords.x,
    toSouth.y - coords.y,
    toSouth.z - coords.z,
  ] as Vec3;

  const yAxis = [
    toWest.x - coords.x,
    toWest.y - coords.y,
    toWest.z - coords.z,
  ] as Vec3;

  const zAxis = [
    toEarth.x - coords.x,
    toEarth.y - coords.y,
    toEarth.z - coords.z,
  ] as Vec3;

  const origin = [coords.x, coords.y, coords.z] as Vec3;

  return new Space(origin, xAxis, yAxis, zAxis);
};

const __reusable_vec3__ = new THREE.Vector3();
