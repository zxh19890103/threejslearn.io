import { Vector3 } from "three";

/**
 * - unmutable length: n
 * for high-performance computing!
 */
export class Float32ArrayVec3<Names extends string = string> {
  private readonly _data: Float32Array;

  /**temp */
  readonly _t: number;

  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
  readonly g: number;

  private cursor = -1;

  constructor(readonly count: number, readonly epsilon: number = 0) {
    this._data = new Float32Array((count + 8) * 3).fill(0);

    this.a = count;
    this.b = count + 1;
    this.c = count + 2;
    this.d = count + 3;
    this.e = count + 4;
    this.f = count + 5;
    this.g = count + 6;

    this._t = count + 7;
  }

  iter(each: (i: number, x: number, y: number, z: number) => void) {
    const _D = this._data;
    const n = this.count;

    let offset = 0;

    for (let i = 0; i < n; i++) {
      offset = i * 3;
      each(i, _D[offset], _D[offset + 1], _D[offset + 2]);
    }
  }

  reset() {
    this.cursor = -1;
  }

  alloc(name: Names = null) {
    this.cursor += 1;
    return this.cursor;
  }

  assign(name: number, i: number, from: Float32ArrayVec3 = this) {
    const _d = this._data;
    const _d2 = from._data;

    const offset1 = name * 3;
    const offset2 = i * 3;

    _d[offset1] = _d2[offset2];
    _d[offset1 + 1] = _d2[offset2 + 1];
    _d[offset1 + 2] = _d2[offset2 + 2];

    return this;
  }

  get(i: number, wt: Vec3 = [0, 0, 0]) {
    const _d = this._data;
    const offset = i * 3;

    wt[0] = _d[offset];
    wt[1] = _d[offset + 1];
    wt[2] = _d[offset + 2];

    return wt;
  }

  getX(i: number) {
    return this._data[i * 3];
  }
  getY(i: number) {
    return this._data[i * 3 + 1];
  }
  getZ(i: number) {
    return this._data[i * 3 + 2];
  }

  set(i: number, x: number, y: number, z: number) {
    const _d = this._data;
    const offset = i * 3;

    _d[offset] = x;
    _d[offset + 1] = y;
    _d[offset + 2] = z;

    return this;
  }

  setV3(i: number, value: Vec3) {
    const _d = this._data;
    const offset = i * 3;

    _d[offset] = value[0];
    _d[offset + 1] = value[1];
    _d[offset + 2] = value[2];

    return this;
  }

  setComponent(i: number, dim: number, value: number) {
    this._data[i * 3 + dim] = value;
    return this;
  }

  setX(i: number, value: number) {
    this._data[i * 3] = value;
    return this;
  }
  setY(i: number, value: number) {
    this._data[i * 3 + 1] = value;
    return this;
  }
  setZ(i: number, value: number) {
    this._data[i * 3 + 2] = value;
    return this;
  }

  distance(i: number, j: number): number {
    if (j >= this.count || i >= this.count) {
      // throw new Error("i or j got out of `count`");
      console.log("a?", i, j);
    }
    const r = Math.sqrt(this.distanceSq(i, j));
    if (this.epsilon <= 0) {
      return r;
    } else {
      return Math.max(this.epsilon, r);
    }
  }

  distanceSq(i: number, j: number): number {
    const _d = this._data;
    const offset1 = i * 3;
    const offset2 = j * 3;

    const dx = _d[offset2] - _d[offset1];
    const dy = _d[offset2 + 1] - _d[offset1 + 1];
    const dz = _d[offset2 + 2] - _d[offset1 + 2];

    return dx * dx + dy * dy + dz * dz;
  }

  dot(i: number, j: number): number {
    const _d = this._data;
    const offset1 = i * 3;
    const offset2 = j * 3;

    return (
      _d[offset1] * _d[offset2] +
      _d[offset1 + 1] * _d[offset2 + 1] +
      _d[offset1 + 2] * _d[offset2 + 2]
    );
  }

  zero(i: number) {
    const _d = this._data;
    const offset = i * 3;
    _d[offset] = 0;
    _d[offset + 1] = 0;
    _d[offset + 2] = 0;
    return this;
  }

  is0(i: number): boolean {
    const _d = this._data;
    const offset = i * 3;

    return _d[offset] === 0 && _d[offset + 1] === 0 && _d[offset + 2] === 0;
  }

  normalize(i: number, t: number = i) {
    const _d = this._data;

    let offset = i * 3;

    let x = _d[offset];
    let y = _d[offset + 1];
    let z = _d[offset + 2];

    const r = Math.sqrt(x * x + y * y + z * z);

    x /= r;
    y /= r;
    z /= r;

    offset = t * 3;
    _d[offset] = x;
    _d[offset + 1] = y;
    _d[offset + 2] = z;

    return this;
  }

  setLength(i: number, length: number, t: number = i) {
    const _d = this._data;

    let offset = i * 3;

    let x = _d[offset];
    let y = _d[offset + 1];
    let z = _d[offset + 2];

    const r = length / Math.sqrt(x * x + y * y + z * z);

    x *= r;
    y *= r;
    z *= r;

    offset = t * 3;
    _d[offset] = x;
    _d[offset + 1] = y;
    _d[offset + 2] = z;

    return this;
  }

  mutiplyScalar(i: number, scalar: number, t: number = i) {
    const _d = this._data;

    let offset = i * 3;

    let x = _d[offset];
    let y = _d[offset + 1];
    let z = _d[offset + 2];

    x *= scalar;
    y *= scalar;
    z *= scalar;

    offset = t * 3;
    _d[offset] = x;
    _d[offset + 1] = y;
    _d[offset + 2] = z;

    return this;
  }

  negate(i: number, t: number = i) {
    const _d = this._data;

    let offset = i * 3;

    let x = _d[offset];
    let y = _d[offset + 1];
    let z = _d[offset + 2];

    x *= -1;
    y *= -1;
    z *= -1;

    offset = t * 3;
    _d[offset] = x;
    _d[offset + 1] = y;
    _d[offset + 2] = z;
    return this;
  }

  length(i: number) {
    const _d = this._data;

    let offset = i * 3;

    let x = _d[offset];
    let y = _d[offset + 1];
    let z = _d[offset + 2];

    return Math.sqrt(x * x + y * y + z * z);
  }

  lengthSq(i: number) {
    const _d = this._data;

    let offset = i * 3;

    let x = _d[offset];
    let y = _d[offset + 1];
    let z = _d[offset + 2];

    return x * x + y * y + z * z;
  }

  /**
   * v(t) = v(j) - v(i)
   */
  dir(i: number, j: number, t: number = this._t) {
    const _D = this._data;
    const offset1 = i * 3;
    const offset2 = j * 3;
    const offset3 = t * 3;

    const dx = _D[offset2] - _D[offset1];
    const dy = _D[offset2 + 1] - _D[offset1 + 1];
    const dz = _D[offset2 + 2] - _D[offset1 + 2];

    _D[offset3] = dx;
    _D[offset3 + 1] = dy;
    _D[offset3 + 2] = dz;

    return this;
  }

  /**
   * normalize(dir());
   */
  dir1(i: number, j: number, t: number = this._t) {
    this.dir(i, j, t);
    this.normalize(t);
    return this;
  }

  /**
   * v(t) = v(i) - v(j)
   */
  sub(i: number, j: number, t: number = i) {
    const _D = this._data;
    const offset = i * 3;
    const offset2 = j * 3;
    const offset3 = t * 3;

    const dx = _D[offset] - _D[offset2];
    const dy = _D[offset + 1] - _D[offset2 + 1];
    const dz = _D[offset + 2] - _D[offset2 + 2];

    _D[offset3] = dx;
    _D[offset3 + 1] = dy;
    _D[offset3 + 2] = dz;

    return this;
  }

  add(i: number, j: number, t: number = i) {
    const _D = this._data;

    const offset1 = i * 3;
    const offset2 = j * 3;
    const offset3 = t * 3;

    const x = _D[offset1] + _D[offset2];
    const y = _D[offset1 + 1] + _D[offset2 + 1];
    const z = _D[offset1 + 2] + _D[offset2 + 2];

    _D[offset3] = x;
    _D[offset3 + 1] = y;
    _D[offset3 + 2] = z;

    return this;
  }

  /**
   *
   * @param t save to
   * @param series
   * @returns
   */
  sum(t: number, ...series: number[]) {
    const _D = this._data;
    const offset = t * 3;

    let x = 0;
    let y = 0;
    let z = 0;

    for (const j of series) {
      const offset2 = j * 3;

      x += _D[offset2];
      y += _D[offset2 + 1];
      z += _D[offset2 + 2];
    }

    _D[offset] = x;
    _D[offset + 1] = y;
    _D[offset + 2] = z;

    return this;
  }

  cross(i: number, j: number, t: number = i) {
    const _D = this._data;

    const offset1 = i * 3;
    const offset2 = j * 3;
    const offset3 = t * 3;

    _D[offset3] =
      _D[offset1 + 1] * _D[offset2 + 2] - _D[offset1 + 2] * _D[offset2 + 1];
    _D[offset3] = _D[offset1 + 2] * _D[offset2] - _D[offset1] * _D[offset2 + 2];
    _D[offset3] = _D[offset1] * _D[offset2 + 1] - _D[offset1 + 1] * _D[offset2];

    return this;
  }

  clear() {
    this._data.fill(0);
  }

  /**
   * copy j to i
   */
  copy(i: number, j: number) {
    const _D = this._data;
    const offset = i * 3;
    const offset2 = j * 3;

    _D[offset] = _D[offset2];
    _D[offset + 1] = _D[offset2 + 1];
    _D[offset + 2] = _D[offset2 + 2];

    return this;
  }

  multiply(i: number, j: number, t: number = i) {
    const _D = this._data;

    const offset = i * 3;
    const offset2 = j * 3;
    const offset3 = t * 3;

    _D[offset3] = _D[offset] * _D[offset2];
    _D[offset3 + 1] = _D[offset + 1] * _D[offset2 + 1];
    _D[offset3 + 2] = _D[offset + 2] * _D[offset2 + 2];

    return this;
  }

  toVec3Like(i: number): Vec3Like {
    const _D = this._data;
    const offset = i * 3;
    return { x: _D[offset], y: _D[offset + 1], z: _D[offset + 2] };
  }

  toThreeVector3(i: number): Vector3 {
    const _D = this._data;
    const offset = i * 3;

    return new Vector3(_D[offset], _D[offset + 1], _D[offset + 2]);
  }

  divideScalar(i: number, scalar: number, t: number = i) {
    const _D = this._data;
    const offset1 = i * 3;
    const offset2 = t * 3;

    _D[offset2] = _D[offset1] / scalar;
    _D[offset2 + 1] = _D[offset1 + 1] / scalar;
    _D[offset2 + 2] = _D[offset1 + 2] / scalar;

    return this;
  }

  result(wt?: Vec3): Vec3 {
    const _d = this._data;
    const offset = this._t * 3;
    const v = wt ?? [0, 0, 0];
    v[0] = _d[offset];
    v[1] = _d[offset + 1];
    v[2] = _d[offset + 2];
    return v;
  }

  resultAsVec3Like(): Vec3Like {
    const _d = this._data;
    const offset = this._t * 3;
    return { x: _d[offset], y: _d[offset + 1], z: _d[offset + 2] };
  }

  resultAsVector3(): Vector3 {
    const _d = this._data;
    const offset = this._t * 3;
    return new Vector3(_d[offset], _d[offset + 1], _d[offset + 2]);
  }
}

export interface Float32ArrayVec3 {
  /** @alias length */
  mag(i: number): number;
  give(v: Vec3): Vec3;
  /** @alias distance */
  r(i: number, j: number): number;
  /** @alias distanceSq */
  rSq(i: number, j: number): number;
}

Float32ArrayVec3.prototype.r = Float32ArrayVec3.prototype.distance;
Float32ArrayVec3.prototype.mag = Float32ArrayVec3.prototype.length;
Float32ArrayVec3.prototype.rSq = Float32ArrayVec3.prototype.distanceSq;
Float32ArrayVec3.prototype.give = Float32ArrayVec3.prototype.result;
