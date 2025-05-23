const v0: Vec3 = [0, 0, 0];

const isZero = (v: Vec3) => {
  return v === v0;
};

const zero = (v: Vec3) => {
  v[0] = 0;
  v[1] = 0;
  v[2] = 0;

  return v;
};

/** will change v */
const clamp = (v: Vec3, min: number, max: number) => {
  const l = length(v);

  if (l < min) setLength(v, l);
  else if (l > max) setLength(v, max);
  return v;
};

const normalize = (v: Vec3, refv?: Vec3) => {
  const l = length(v);

  if (l === 0) {
    return v0;
  }

  const _v = refv ?? v;

  _v[0] = v[0] / l;
  _v[1] = v[1] / l;
  _v[2] = v[2] / l;
  return _v;
};

const setLength = (v: Vec3, len: number): Vec3 => {
  normalize(v);
  v[0] = v[0] * len;
  v[1] = v[1] * len;
  v[2] = v[2] * len;
  return v;
};

/**
 * will change v
 */
const multiplyScalar = (v: Vec3, scalar: number): Vec3 => {
  v[0] = v[0] * scalar;
  v[1] = v[1] * scalar;
  v[2] = v[2] * scalar;
  return v;
};

const negate = (v: Vec3) => {
  v[0] = -v[0];
  v[1] = -v[1];
  v[2] = -v[2];
  return v;
};

const length = (v: Vec3) => {
  const [x, y, z] = v;
  return Math.sqrt(x * x + y * y + z * z);
};

/**
 * the diff vec3
 * returns a new one
 *
 * @param v1 from
 * @param v2 to
 */
const dR = (v1: Vec3, v2: Vec3): Vec3 => {
  const v: Vec3 = [0, 0, 0];

  v[0] = v2[0] - v1[0];
  v[1] = v2[1] - v1[1];
  v[2] = v2[2] - v1[2];

  return v;
};

/**
 * v1 will be the result!
 *
 * = v1 - v2
 * @returns v1
 */
const sub = (v1: Vec3, v2: Vec3): Vec3 => {
  v1[0] -= v2[0];
  v1[1] -= v2[1];
  v1[2] -= v2[2];
  return v1;
};

/**
 * distance
 */
const R = (p0: Vec3, p1: Vec3) => {
  const x = p1[0] - p0[0];
  const y = p1[1] - p0[1];
  const z = p1[2] - p0[2];
  return Math.sqrt(x * x + y * y + z * z);
};

/**
 * v1 will be changed
 *
 *  = v1 + v2
 *
 * @returns v1
 */
const add = (v1: Vec3, v2: Vec3): Vec3 => {
  v1[0] += v2[0];
  v1[1] += v2[1];
  v1[2] += v2[2];
  return v1;
};

const addScalar = (v: Vec3, scalar: number) => {
  v[0] += scalar;
  v[1] += scalar;
  v[2] += scalar;
  return v;
};

/**
 * create a new one
 */
const sum = (...v3s: Vec3[]) => {
  const v: Vec3 = [0, 0, 0];

  for (const _v of v3s) {
    v[0] += _v[0];
    v[1] += _v[1];
    v[2] += _v[2];
  }

  return v;
};

const lengthSq = (v: Vec3) => {
  const [x, y, z] = v;
  return x * x + y * y + z * z;
};

const dot = (v1: Vec3, v2: Vec3) => {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
};

const cross = (v1: Vec3, v2: Vec3): Vec3 => {
  return [
    v1[1] * v2[2] - v1[2] * v2[1], // x-component
    v1[2] * v2[0] - v1[0] * v2[2], // y-component
    v1[0] * v2[1] - v1[1] * v2[0], // z-component
  ];
};

const clone = (v: Vec3): Vec3 => {
  return [...v];
};

const copy = (v1: Vec3, v2: Vec3): Vec3 => {
  v1[0] = v2[0];
  v1[1] = v2[1];
  v1[2] = v2[2];

  return v1;
};

export const multiply = (v1: Vec3, v2: Vec3): Vec3 => {
  return [v1[0] * v2[0], v1[1] * v2[1], v1[2] * v2[2]];
};

export const chain = () => {
  return vec3;
};

const toV3Like = (v: Vec3) => {
  return {
    x: v[0],
    y: v[1],
    z: v[2],
  };
};

const divideScalar = (v: Vec3, scalar: number) => {
  v[0] /= scalar;
  v[1] /= scalar;
  v[2] /= scalar;

  // v[0] += 1e-6;
  // v[1] += 1e-6;
  // v[2] += 1e-6;
  return v;
};

const ceil = (v: Vec3) => {
  v[0] = Math.ceil(v[0]);
  v[1] = Math.ceil(v[1]);
  v[2] = Math.ceil(v[2]);
  return v;
};

export const vec3 = {
  divideScalar,
  ceil,
  chain,
  toV3Like,
  isZero,
  zero,
  copy,
  length,
  normalize,
  lengthSq,
  add,
  addScalar,
  multiply,
  sum,
  sub,
  dot,
  cross,
  R,
  dR,
  clamp,
  clone,
  negate,
  multiplyScalar,
  setLength,
};
