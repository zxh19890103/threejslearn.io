import * as THREE from "three";

const rNumber = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

/**
 * for Water!
 */
export const SPH_CONSTs = {
  g: 9.81,
  /**
   * 粒子個數
   */
  N: 1000,
  /**
   * 時間段
   *
   * unit: s
   */
  dt: 0.008,
  /**
   * viscosity coefficient (controls the strength of the viscosity)
   * unit: Pa*s
   *  */
  mu: 1e3, // 1 * 1e2,
  /**
   * 標準密度
   *
   * unit: kg/m^3
   */
  rho0: 1e3,
  /**
   * the stillness value to compute pressure!
   */
  k: 1e2, // 3e3,
  /**
   * 有效半徑
   *
   * unit: m
   */
  h: 0.1, //rNumber(0.01, 0.05),
  /**
   * 粒子質量
   */
  // m: rNumber(0.001, 0.01),
  m: 80, // rNumber(0.1, 1),
  /** Polytropic Exponent */
  Y: 7,
};

let W_poly6_coef = 0;
let W_spiky_coef = 0;
let W_viscosity_coef = 0;

const { PI, pow, random, max, min, floor, abs } = Math;
// const { clamp } = THREE.MathUtils;

export const afterSettingSPH_CONSTs = () => {
  W_poly6_coef = 315 / (64 * PI * pow(SPH_CONSTs.h, 9));
  W_spiky_coef = 45 / (PI * pow(SPH_CONSTs.h, 6));
  W_viscosity_coef = 15 / (2 * PI * pow(SPH_CONSTs.h, 3));
};

afterSettingSPH_CONSTs();

let __particle_index__ = 0;

class Particle {
  readonly $i: number;

  mass: number = 0;

  velocity: Vec3 = [0, 0, 0];
  position: Vec3 = [0, 0, 0];

  density: number = 0;
  pressureForce: Vec3 = null;
  viscosityForce: Vec3 = null;
  externalForce: Vec3 = v3Zero;

  force: Vec3 = null;
  pressure: number = 0;

  constructor(x: number, y: number, z: number, mass: number) {
    this.position[0] = x;
    this.position[1] = y;
    this.position[2] = z;
    this.mass = mass + random() * 1e2;

    this.$i = __particle_index__;

    __particle_index__++;
  }
}

class LookUpGrid3D {
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

  rebuild(unit: number) {}

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

export class ParticleCloud {
  cloud: THREE.Points;
  line: THREE.Line;
  mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

  particles: Particle[] = [];

  boundary: THREE.Box3;

  private lookupGrid: LookUpGrid3D = null;

  /**
   *
   * @param pos the center
   * @param width measure along X
   * @param height measure along Y
   * @param depth measure along Z
   */
  buildCube(pos: Vec3, width: number, height: number, depth: number) {
    const N = SPH_CONSTs.N;

    const fromX = -width / 2 + pos[0];
    const fromY = -height / 2 + pos[1];
    const fromZ = -depth / 2 + pos[2];

    const toX = width / 2 + pos[0];
    const toY = height / 2 + pos[1];
    const toZ = depth / 2 + pos[2];

    this.particles = [];

    const particles = this.particles;

    for (let i = 0; i < N; i++) {
      const x = random() * width + fromX;
      const y = random() * height + fromY;
      const z = random() * depth + fromZ;

      particles.push(new Particle(x, y, z, SPH_CONSTs.m));
    }

    {
      this.mesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x12e099 }),
        N
      );
    }

    const pts = particles.flatMap((i) => i.position);

    {
      this.cloud = new THREE.Points(
        new THREE.BufferGeometry(),
        new THREE.PointsMaterial({
          size: 3,
          vertexColors: true,
          sizeAttenuation: false,
          color: 0xffffff,
        })
      );

      this.cloud.geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(pts, 3)
      );

      this.cloud.geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(
          particles.flatMap((i) => [1, 0, 0]),
          3
        )
      );
    }

    {
      this.line = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );

      this.line.geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(pts, 3)
      );
    }

    this.boundary = new THREE.Box3(
      new THREE.Vector3(fromX, fromY, fromZ),
      new THREE.Vector3(toX, toY, toZ)
    );

    this.boundary.expandByScalar(0.1);

    this.lookupGrid = new LookUpGrid3D(this.boundary, SPH_CONSTs.h);
  }

  render2() {
    const particles = this.particles;
    const count = particles.length;

    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      const particle = particles[i];
      position.set(...particle.position);
      const s = 1e-2 * (particle.density / SPH_CONSTs.rho0);
      scale.set(s, s, s);
      matrix.compose(position, q, scale);
      this.mesh.setMatrixAt(i, matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  render3() {
    const positionAttrib = this.line.geometry.attributes.position;
    const count = positionAttrib.count;
    const particles = this.particles;

    let particle: Particle = null;
    let pos: Vec3 = null;

    for (let i = 0; i < count; i++) {
      particle = particles[i];
      pos = particle.position;
      positionAttrib.setXYZ(i, pos[0], pos[1], pos[2]);
    }

    positionAttrib.needsUpdate = true;
  }

  render() {
    const colorAttrib = this.cloud.geometry.attributes.color;
    const positionAttrib = this.cloud.geometry.attributes.position;
    const count = positionAttrib.count;
    const particles = this.particles;

    let particle: Particle = null;
    let pos: Vec3 = null;
    let density_ratio = 0;

    for (let i = 0; i < count; i++) {
      particle = particles[i];
      pos = particle.position;

      density_ratio = particle.density / SPH_CONSTs.rho0;

      positionAttrib.setXYZ(i, pos[0], pos[1], pos[2]);
      const r = max(0, min(1, 2 * density_ratio));
      const b = max(0, min(1, 2 * (1 - density_ratio)));
      colorAttrib.setXYZ(i, r, 0, b);
    }

    colorAttrib.needsUpdate = true;
    positionAttrib.needsUpdate = true;
  }

  computeDensity() {
    for (const i of this.particles) {
      this.densitySum = 0;

      for (const j of this.particles) {
        if (i === j) continue;
        this.computeDensityAtIter(i, j);
      }

      i.density = SPH_CONSTs.m * this.densitySum;
      i.pressure = calcPressureScalarAt(i);
    }
  }

  computeForce() {
    for (const i of this.particles) {
      this.pressureForceSum = [0, 0, 0];
      this.viscosityForceSum = [0, 0, 0];

      for (const j of this.particles) {
        if (i === j) continue;

        if (this.lookupGrid.isNeighbourhood(i.position, j.position)) {
          this.computePressureForceAtIter(i, j);
          this.computeViscosityForceAtIter(i, j);
        }
      }

      i.pressureForce = multiplyScalar(this.pressureForceSum, SPH_CONSTs.m);
      i.viscosityForce = multiplyScalar(this.viscosityForceSum, SPH_CONSTs.m);
      i.externalForce = this.computeExternalForceAt(i);

      ifVec3NaN(i.pressureForce, "pressureForce");
      ifVec3NaN(i.viscosityForce, "viscosityForce");

      i.force = add(i.pressureForce, i.viscosityForce, i.externalForce);
    }
  }

  move() {
    const p: Vec3 = [0, 0, 0];
    const v: Vec3 = [0, 0, 0];
    const a: Vec3 = [0, 0, 0];
    const dt = SPH_CONSTs.dt;
    const dtSq_half = 0.5 * pow(dt, 2);

    const { min, max } = this.boundary;

    const damping = 0.4;

    for (const i of this.particles) {
      a[0] = i.force[0] / SPH_CONSTs.m;
      a[1] = i.force[1] / SPH_CONSTs.m;
      a[2] = i.force[2] / SPH_CONSTs.m;

      v[0] = i.velocity[0] + a[0] * dt;
      v[1] = i.velocity[1] + a[1] * dt;
      v[2] = i.velocity[2] + a[2] * dt;

      p[0] = i.position[0] + i.velocity[0] * dt + a[0] * dtSq_half;
      p[1] = i.position[1] + i.velocity[1] * dt + a[1] * dtSq_half;
      p[2] = i.position[2] + i.velocity[2] * dt + a[2] * dtSq_half;

      if (p[0] <= min.x || p[0] >= max.x) {
        i.velocity[0] = -v[0] * damping;
      } else {
        i.position[0] = p[0];
        i.velocity[0] = v[0];
      }

      if (p[1] <= min.y || p[1] >= max.y) {
        i.velocity[1] = -v[1] * damping;
      } else {
        i.position[1] = p[1];
        i.velocity[1] = v[1];
      }

      if (p[2] <= min.z || p[2] >= max.z) {
        i.velocity[2] = -v[2] * damping;
      } else {
        i.position[2] = p[2];
        i.velocity[2] = v[2];
      }
    }
  }

  private densitySum: number = 0;
  private computeDensityAtIter(i: Particle, j: Particle) {
    const w = cubicSplineKernel(R(i.position, j.position), SPH_CONSTs.h);
    this.densitySum += w;
  }

  private pressureForceSum: Vec3 = [0, 0, 0];
  private computePressureForceAtIter(i: Particle, j: Particle) {
    const w = spikyKernelGradient(R(i.position, j.position), SPH_CONSTs.h);

    const scalar = (w * 0.5 * (i.pressure + j.pressure)) / j.density;

    const f = setLength(
      dR(i.position, j.position),
      i.pressure > j.pressure ? scalar : -scalar
    );

    this.pressureForceSum[0] += f[0];
    this.pressureForceSum[1] += f[1];
    this.pressureForceSum[2] += f[2];
  }

  private viscosityForceSum: Vec3 = [0, 0, 0];
  private computeViscosityForceAtIter(i: Particle, j: Particle) {
    const w = W_viscosity(R(i.position, j.position), SPH_CONSTs.h);
    const scalar = (w * SPH_CONSTs.m) / j.density;
    const f = multiplyScalar(dR(i.velocity, j.velocity), scalar);

    /**
     * @todo
     */
    if (isNaN(length(f))) return;

    this.viscosityForceSum[0] += f[0];
    this.viscosityForceSum[1] += f[1];
    this.viscosityForceSum[2] += f[2];
  }

  private computeExternalForceAt(i: Particle): Vec3 {
    return [0, -SPH_CONSTs.g * SPH_CONSTs.m, 0];
  }
}

/**
 * Poly6 Kernel (Density Estimation)
 * */
export const W_poly6 = (r: number, h: number) => {
  if (r >= h) return 0;
  // const coef = 315 / (64 * PI * pow(h, 9));
  return W_poly6_coef * pow(h * h - r * r, 3);
};

const cubicSplineKernel = (r: number, h: number): number => {
  const q = r / h;
  const sigma = 8 / (Math.PI * Math.pow(h, 3)); // Normalization factor in 3D

  if (q >= 0 && q < 1) {
    return sigma * (1 - 1.5 * Math.pow(q, 2) + 0.75 * Math.pow(q, 3));
  } else if (q >= 1 && q < 2) {
    return sigma * (0.25 * Math.pow(2 - q, 3));
  }
  return 0;
};

const spikyKernelGradient = (r: number, h: number): number => {
  if (r <= 0 || r >= h) return 0;

  const sigma = -15 / (Math.PI * Math.pow(h, 4)); // Normalization factor in 3D
  const q = r / h;
  return sigma * Math.pow(1 - q, 2);
};

export const W_spiky = (r: number, h: number) => {
  if (r >= h) return 0;
  // const coef = 45 / (PI * pow(h, 6));
  return W_spiky_coef * pow(h - r, 2);
};

/**
 * Viscosity Kernel (Viscosity Force)
 */
export const W_viscosity = (r: number, h: number) => {
  if (r >= h) return 0;
  // const coef = 45 / (PI * pow(h, 6));
  return W_viscosity_coef * (1 - r / h);
};

/**
 * - When ( rho = rho_0), ( P = 0 ) (normal pressure state).
 * - If ( rho > rho_0 ), ( P > 0 ) (compression, particles push outward).
 * - If ( rho < rho_0 ), ( P < 0 ) (expansion, particles pull inward).
 */
const calcPressureScalarAt = (i: Particle) => {
  return SPH_CONSTs.k * (i.density - SPH_CONSTs.rho0);
};

const v3Zero: Vec3 = [0, 0, 0];

const normalize = (v: Vec3) => {
  const l = length(v);
  if (l === 0) return v3Zero;
  v[0] = v[0] / l;
  v[1] = v[1] / l;
  v[2] = v[2] / l;
  return v;
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
 * returns a new one
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

const R = (p0: Vec3, p1: Vec3) => {
  const x = p1[0] - p0[0];
  const y = p1[1] - p0[1];
  const z = p1[2] - p0[2];

  return Math.sqrt(x * x + y * y + z * z);
};

/**
 * returns a new one
 * @returns
 */
const add = (...v3s: Vec3[]): Vec3 => {
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

let ifVec3NaNLabelsOrder = 0;
const ifVec3NaNLabels: Record<string, number> = {};

const ifVec3NaN = (v: Vec3, label: string) => {
  if (!Object.hasOwn(ifVec3NaNLabels, label) && isNaN(length(v))) {
    ifVec3NaNLabels[label] = ifVec3NaNLabelsOrder;
    console.log(label, ifVec3NaNLabelsOrder);
    ifVec3NaNLabelsOrder++;
  }
};
