import * as THREE from "three";

/**
 * for Water!
 */
const SPH_CONSTs = {
  /**
   * 粒子個數
   */
  N: 50,
  /**
   * 有效半徑
   */
  H: 3,
  /**
   * 時間段
   */
  dt: 0.016,
  /**
   * 是壓縮指數 (通常取 7)
   */
  Y: 7,
  /**
   * 標準粒子質量
   */
  M0: 2e5,
  /** 標準密度 */
  density0: 1e3,
  /**
   * 是參考聲速 (確保壓縮率低於 1%)
   * for water: 30∼50
   */
  C0: 40,
  /**參考壓力  1000∼5000, */
  P0: 1000,
};

class Particle {
  mass: number = 0;

  velocity: Vec3 = [0, 0, 0];
  position: Vec3 = [0, 0, 0];

  density: number = 0;
  pressureForce: Vec3 = null;
  viscosityForce: Vec3 = null;
  externalForce: Vec3 = v3Zero;

  force: Vec3 = null;

  constructor(x: number, y: number, z: number, mass: number) {
    this.position[0] = x;
    this.position[1] = y;
    this.position[2] = z;

    this.mass = mass;
  }
}

const { PI, pow, random } = Math;
// const { clamp } = THREE.MathUtils;

export class ParticleCloud {
  cloud: THREE.Points;
  mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

  particles: Particle[] = [];

  boundary: THREE.Box3;

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

      particles.push(new Particle(x, y, z, SPH_CONSTs.M0));
    }

    {
      this.mesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x12e099 }),
        N
      );
      // this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    this.cloud = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        size: 2,
        sizeAttenuation: false,
        color: 0x12e099,
      })
    );

    this.cloud.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        particles.flatMap((i) => i.position),
        3
      )
    );

    this.boundary = new THREE.Box3(
      new THREE.Vector3(fromX, fromY, fromZ),
      new THREE.Vector3(toX, toY, toZ)
    );

    this.boundary.expandByScalar(0.5);
  }

  simulateStaticFluid() {
    for (const i of this.particles) {
      i.velocity = [0, 0, 0];
    }
  }

  render2() {
    const particles = this.particles;
    const count = particles.length;

    const matrix = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      const pos = particles[i].position;
      matrix.makeTranslation(pos[0], pos[1], pos[2]);
      this.mesh.setMatrixAt(i, matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  render() {
    const positionAttrib = this.cloud.geometry.attributes.position;
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

  computeDensity() {
    for (const i of this.particles) {
      i.density = this.computeDensityAt(i);
    }
  }

  computeForce() {
    // console.time("compute");

    for (const i of this.particles) {
      i.pressureForce = this.computePressureForceAt(i);
      i.viscosityForce = this.computeViscosityForceAt(i);
      i.externalForce = this.computeExternalForceAt(i);

      console.log(length(i.pressureForce), length(i.viscosityForce));

      i.force = add(i.pressureForce, i.viscosityForce, i.externalForce);
    }

    // console.timeEnd("compute");
  }

  move() {
    const p: Vec3 = [0, 0, 0];
    const v: Vec3 = [0, 0, 0];
    const a: Vec3 = [0, 0, 0];
    const dt = SPH_CONSTs.dt;
    const dtSq_half = 0.5 * pow(dt, 2);

    const { min, max } = this.boundary;

    for (const i of this.particles) {
      a[0] = i.force[0] / i.mass;
      a[1] = i.force[1] / i.mass;
      a[2] = i.force[2] / i.mass;

      v[0] = i.velocity[0] + a[0] * dt;
      v[1] = i.velocity[1] + a[1] * dt;
      v[2] = i.velocity[2] + a[2] * dt;

      p[0] = i.position[0] + i.velocity[0] * dt + a[0] * dtSq_half;
      p[1] = i.position[1] + i.velocity[1] * dt + a[1] * dtSq_half;
      p[2] = i.position[2] + i.velocity[2] * dt + a[2] * dtSq_half;

      if (p[0] <= min.x || p[0] >= max.x) {
        i.velocity[0] = -v[0];
      } else {
        i.position[0] = p[0];
        i.velocity[0] = v[0];
      }

      if (p[1] <= min.y) {
        i.velocity[1] = -v[1];
      } else {
        i.position[1] = p[1];
        i.velocity[1] = v[1];
      }

      if (p[2] <= min.z || p[2] >= max.z) {
        i.velocity[2] = -v[2];
      } else {
        i.position[2] = p[2];
        i.velocity[2] = v[2];
      }
    }
  }

  private computeDensityAt(i: Particle): number {
    let density = 0;

    for (const j of this.particles) {
      if (i === j) continue;
      density += j.mass * W_poly6(R(i.position, j.position), SPH_CONSTs.H);
    }

    return density;
  }

  private computePressureAt(i: Particle) {
    return Math.max(
      SPH_CONSTs.P0 * (pow(i.density / SPH_CONSTs.density0, SPH_CONSTs.Y) - 1),
      0
    );
  }

  private computePressureForceAt(i: Particle): Vec3 {
    const force: Vec3 = [0, 0, 0];
    const Pi = this.computePressureAt(i);
    const Pi2 = Pi / pow(i.density, 2);
    ifVec3NaN([0, 0, Pi], "Pi");

    for (const j of this.particles) {
      if (i === j) continue;

      const Pj = this.computePressureAt(j);
      const W = W_spiky(j, i, SPH_CONSTs.H);
      const Pj2 = Pj / pow(j.density, 2);

      ifVec3NaN([0, 0, Pj], "Pj");
      ifVec3NaN([0, 0, Pj2], "Pj2");
      ifVec3NaN(W, "w");

      const f = multiplyScalar(W, j.mass * (Pi2 + Pj2));

      ifVec3NaN(f, "f");

      force[0] += f[0];
      force[1] += f[1];
      force[2] += f[2];
    }

    return force;
  }

  private computeMu_ij(i: Particle, j: Particle) {
    const dv = dR(i.velocity, j.velocity);
    const dp = dR(i.position, j.position);
    const minimal = 1;
    return (SPH_CONSTs.H * dot(dv, dp)) / (lengthSq(dp) + minimal);
  }

  private computeViscosityForceAt(i: Particle): Vec3 {
    const force: Vec3 = [0, 0, 0];

    for (const j of this.particles) {
      if (i === j) continue;

      const W = W_viscosity(R(i.position, j.position), SPH_CONSTs.H);
      const mu_ij = this.computeMu_ij(i, j);
      const ro_ij = (i.density + j.density) / 2;
      const T =
        (-1 * SPH_CONSTs.C0 * SPH_CONSTs.H * mu_ij + 2 * pow(mu_ij, 2)) / ro_ij;

      const f = multiplyScalar(dR(i.velocity, j.velocity), j.mass * T * W);
      ifVec3NaN(f, "vf");

      force[0] += f[0];
      force[1] += f[1];
      force[2] += f[2];
    }

    return force;
  }

  private computeExternalForceAt(particle: Particle): Vec3 {
    return [0, 0, 0];
    // return [0, -9.81 * particle.mass, 0];
  }
}

/**
 * Poly6 Kernel (Density Estimation)
 * */
const W_poly6 = (r: number, h: number) => {
  if (r >= h || r <= 0) return 0;
  const coef = 315 / (64 * PI * pow(h, 9));
  return coef * pow(h * h - r * r, 3);
};

/**
 * Spiky Kernel (Pressure Force)
 */
const W_spiky = (i: Particle, j: Particle, h: number): Vec3 => {
  const r = R(i.position, j.position);
  if (r >= h || r <= 0) return [0, 0, 0];
  const coef = -45 / (PI * pow(h, 6));
  const scalar = coef * pow(h - r, 2);
  return setLength(dR(i.position, j.position), scalar);
};

/**
 * Viscosity Kernel (Viscosity Force)
 */
const W_viscosity = (r: number, h: number) => {
  if (r >= h || r <= 0) return 0;
  const coef = 45 / (PI * pow(h, 6));
  return coef * (h - r);
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
