import { BodyInfo } from "../Fun-SolarSystem/planets.js";
import * as THREE from "three";

const v3$ = new THREE.Vector3();

/**
 * 1
 */
export let MOMENT_N_PER_FRAME = 1e1;
/**
 * s
 */
export let MOMENT = 1e1; // s
/**
 * s
 */
export let intervalPerFrame = MOMENT_N_PER_FRAME * MOMENT;

export const setGravityParam = (
  k: "MOMENT_N_PER_FRAME" | "MOMENT",
  val: number
) => {
  if (k === "MOMENT") MOMENT = val;
  else if (k === "MOMENT_N_PER_FRAME") MOMENT_N_PER_FRAME = val;

  intervalPerFrame = MOMENT_N_PER_FRAME * MOMENT;
};

export function doGravityBufferCompution(
  body: MovingBody,
  N: number,
  coordinates$: THREE.Vector3Tuple,
  velocity$: THREE.Vector3Tuple,
  durUnit: number = MOMENT
) {
  let n = N;

  while (n--) {
    const a = computeAccOfCelestialBody(body);
    if (a === null) {
      velocity$[0] = 0;
      velocity$[1] = 0;
      velocity$[2] = 0;
      break;
    }
    const dv = [a[0] * durUnit, a[1] * durUnit, a[2] * durUnit];
    const [vx, vy, vz] = velocity$;
    const [dvx, dvy, dvz] = dv;
    const ds = [
      vx * durUnit + 0.5 * dvx * durUnit,
      vy * durUnit + 0.5 * dvy * durUnit,
      vz * durUnit + 0.5 * dvz * durUnit,
    ];

    velocity$[0] += dv[0];
    velocity$[1] += dv[1];
    velocity$[2] += dv[2];

    coordinates$[0] += ds[0];
    coordinates$[1] += ds[1];
    coordinates$[2] += ds[2];
  }
}

function computeAccBy(
  position0: THREE.Vector3Tuple,
  position: THREE.Vector3Tuple,
  mass: number,
  radius: number
) {
  if (mass === 0) return ZERO_ACC;

  const [x, y, z] = position0;
  const [rx, ry, rz] = position;
  const dx = rx - x,
    dy = ry - y,
    dz = rz - z;
  const r2 = dx * dx + dy * dy + dz * dz;
  const length = Math.sqrt(r2);

  if (radius > length) return ZERO_ACC;

  const scalar = (GRAVITY_G * mass) / r2;
  const factor = scalar / length;
  return [dx * factor, dy * factor, dz * factor];
}

function computeAccOfCelestialBody(self: MovingBody) {
  const sum: THREE.Vector3Tuple = [0, 0, 0];
  const pos = self.nextCoordinates;
  for (const obj of self.gravityCaringObjects) {
    const a = computeAccBy(
      pos,
      obj.nextCoordinates,
      obj.inf.mass,
      obj.inf.radius
    );
    sum[0] += a[0];
    sum[1] += a[1];
    sum[2] += a[2];
  }
  return sum;
}

export const shouldSaveTrajectoryPosition = (
  currentPos: Vec3,
  lastSavedPos: Vec3,
  camPos: THREE.Vector3,
  minDistance = 0.8,
  camDistFactor = 1e-3
) => {
  if (!lastSavedPos) return true;

  const dx = lastSavedPos[0] - currentPos[0];
  const dy = lastSavedPos[1] - currentPos[1];
  const dz = lastSavedPos[2] - currentPos[2];

  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const camDist = v3$.set(...currentPos).distanceTo(camPos);
  const threhold = Math.max(minDistance, camDist * camDistFactor);

  return dist > threhold;
};

const angle360 = 2 * Math.PI;

export interface MovingBody {
  _angleScanned?: number;
  _regressed?: boolean;
  _coordinates: Vec3;
  _velocity: Vec3;
  gravityCaringObjects: GravityCaringBody[];
  nextCoordinates: THREE.Vector3Tuple;
  nextVelocity: THREE.Vector3Tuple;
  trajectory: number[];
}

export type CelestialBody = MovingBody & GravityCaringBody;

export interface GravityCaringBody {
  nextCoordinates: THREE.Vector3Tuple;
  inf: PlanetInf;
}

type PlanetInf = {
  mass: number;
  radius: number;
};

type CreateCelestialBodyInput = {
  V: Vec3;
  P: Vec3;
  GCO: GravityCaringBody[];
  inf: BodyInfo;
};

export const createCelestialBody = (
  input: CreateCelestialBodyInput
): CelestialBody => {
  return {
    _angleScanned: 0,
    _regressed: false,
    _coordinates: input.P,
    _velocity: input.V,
    gravityCaringObjects: input.GCO,
    nextCoordinates: [0, 0, 0],
    nextVelocity: [0, 0, 0],
    trajectory: [],
    inf: input.inf,
  };
};

const ZERO_ACC = [0, 0, 0];
// Gravity Constant
export const GRAVITY_G = 6.67e-5;
// 10^3 km
export const GRAVITY_AU = 149597.8707;

export type TypeOfOrbit =
  | "Non-Polar Inclined"
  | "Sun-Synchronous"
  | "Equatorial"
  | "Polar"
  | "Elliptical"
  | "Deep Highly Eccentric"
  | "Molniya"
  | "Retrograde"
  | "Cislunar"
  | "Sun-Synchronous Near Polar";
export type ClassOfOrbit = "LEO" | "GEO" | "Elliptical" | "MEO";

export const checkRegress = (b: MovingBody) => {
  if (b._angleScanned === undefined) b._angleScanned = 0;

  const [x0, y0, z0] = b._coordinates;
  const [x1, y1, z1] = b.nextCoordinates;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;

  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const avgX = (x1 + x0) / 2;
  const avgY = (y1 + y0) / 2;
  const avgZ = (z1 + z0) / 2;

  const R = Math.sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ);

  b._angleScanned += dist / R;

  if (b._angleScanned > angle360) {
    b._regressed = true;
    return true;
  }
  return false;
};

export const resetRegress = (b: MovingBody) => {
  b._angleScanned = 0;
  b._regressed = false;
  b.trajectory = [];
};

export const cpCurrentToNext = (movingBody: MovingBody) => {
  movingBody.nextCoordinates[0] = movingBody._coordinates[0];
  movingBody.nextCoordinates[1] = movingBody._coordinates[1];
  movingBody.nextCoordinates[2] = movingBody._coordinates[2];

  movingBody.nextVelocity[0] = movingBody._velocity[0];
  movingBody.nextVelocity[1] = movingBody._velocity[1];
  movingBody.nextVelocity[2] = movingBody._velocity[2];
};

export const cpNextToCurrent = (movingBody: MovingBody) => {
  movingBody._coordinates[0] = movingBody.nextCoordinates[0];
  movingBody._coordinates[1] = movingBody.nextCoordinates[1];
  movingBody._coordinates[2] = movingBody.nextCoordinates[2];

  movingBody._velocity[0] = movingBody.nextVelocity[0];
  movingBody._velocity[1] = movingBody.nextVelocity[1];
  movingBody._velocity[2] = movingBody.nextVelocity[2];
};
