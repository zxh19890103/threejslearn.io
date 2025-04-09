import * as THREE from "three";
import { LookUpGrid3D } from "./LookupGrid.class.js";
import { Poly6Kernel, SpikyKernelGradient, W_viscosity } from "./kernels.js";
import { vec3 } from "../vec3.js";
import * as config from "./config.js";
import { Boundary } from "./boundary.js";
import { Float32ArrayVec3 } from "cases/Shared/Float32ArrayVec3.class.js";

const { pow, random } = Math;

export class ParticleCloud {
  readonly rhoArray = new Float32Array(config.N).fill(0);
  readonly massArray = new Float32Array(config.N).fill(0);
  readonly pressureArray = new Float32Array(config.N).fill(0);
  readonly p_over_rhoSqArray = new Float32Array(config.N).fill(0);
  readonly mass_over_rhoArray = new Float32Array(config.N).fill(0);

  /** particle's positions */
  readonly rArray = new Float32ArrayVec3(config.N, config.rmin);
  /** particle's velocities */
  readonly vArray = new Float32ArrayVec3(config.N);
  /** particle's force */
  readonly fArray = new Float32ArrayVec3(config.N);
  /**
   * grid key (coordinates) for each particle
   */
  readonly keyArray = new Float32ArrayVec3(config.N);

  readonly sharedArray = new Float32ArrayVec3(32);

  cloud: THREE.Points;
  mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;

  boundary: Boundary;
  lookupGrid: LookUpGrid3D;
  lookupGridLines: THREE.Line;

  each(arg0: (r: Vec3, v: Vec3, i: number) => void) {
    const { rArray, vArray } = this;

    const V: Vec3 = [0, 0, 0];
    const P: Vec3 = [0, 0, 0];

    for (let i = 0; i < config.N; i += 1) {
      vArray.get(i, V);
      rArray.get(i, P);

      arg0(P, V, i);

      vArray.set(i, ...V);
      rArray.set(i, ...P);
    }
  }

  /**
   * @param pos the center
   * @param width measure along X
   * @param height measure along Y
   * @param depth measure along Z
   */
  buildBoundary(
    pos: Vec3,
    width: number,
    height: number = width,
    depth: number = width
  ) {
    this.boundary = new Boundary({
      center: pos,
      width,
      height,
      depth,
    });

    this.lookupGrid = new LookUpGrid3D(this.boundary, config.N, config.h);

    const minDim = 0.98 * Math.min(width, height, depth);

    this.boundary.arrange(
      (i, x, y, z) => {
        this.massArray[i] = config.m0[0] + random() * config.m0[1];
        this.rArray.set(i, x, y, z);
      },
      config.N,
      config.h * 0.5,
      [minDim, minDim, minDim]
    );

    const vertexArray = new Float32Array(config.N * 3);
    const colorArray = new Float32Array(config.N * 3);

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
        new THREE.BufferAttribute(vertexArray, 3)
      );

      this.cloud.geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colorArray, 3)
      );
    }

    {
      this.mesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(config.ballradius, 16, 16),
        new THREE.MeshPhongMaterial({
          transparent: true,
          opacity: 0.8,
          color: 0xffffff,
          depthWrite: true,
          depthTest: true,
          blending: THREE.NormalBlending,
        }),
        config.N
      );
    }

    {
      this.lookupGridLines = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: 0x000000,
        })
      );
    }
  }

  renderBalls() {
    const N = config.N;
    const { pow } = Math;
    const { rArray, vArray, velocityMax, massArray, mesh } = this;

    const position: Vec3 = [0, 0, 0];

    const mat4 = new THREE.Matrix4();
    const color = new THREE.Color(0x0011fe);

    for (let i = 0; i < N; i++) {
      rArray.get(i, position);
      mat4.makeTranslation(...position);
      mesh.setMatrixAt(i, mat4);

      const kineticEnergy = massArray[i] * vArray.lengthSq(i);
      const alpha = kineticEnergy / (pow(velocityMax, 2) * 1.15);
      const r = alpha;
      const b = 1 - alpha;

      color.setRGB(r, 0, b);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  renderCloud() {
    const N = config.N;
    const { pow } = Math;
    const { rArray, vArray, velocityMax, massArray, cloud } = this;

    const posAttrib = cloud.geometry.attributes.position;
    const colorAttrib = cloud.geometry.attributes.color;

    const position: Vec3 = [0, 0, 0];
    // const color = new THREE.Color(0x0011fe);

    for (let i = 0; i < N; i++) {
      rArray.get(i, position);

      const kineticEnergy = massArray[i] * vArray.lengthSq(i);
      const alpha = kineticEnergy / (pow(velocityMax, 2) * 1.15);
      const r = alpha;
      const b = 1 - alpha;

      colorAttrib.setXYZ(i, r, 0, b);
      posAttrib.setXYZ(i, ...position);
    }

    colorAttrib.needsUpdate = true;
    posAttrib.needsUpdate = true;
  }

  renderGrid() {
    const vertex = this.lookupGrid.getSpace();
    this.lookupGridLines.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertex, 3)
    );
  }

  private pMax: number = 0;
  private pMin: number = -1;
  private rhoAvg = 0;
  private velocityMax: number = 0;
  private sharingGridKey: Vec3 = [0, 0, 0];
  private computeRhoForPi: Vec3 = [0, 0, 0];

  buildKeyArray = () => {
    const { N } = config;
    const { rArray, lookupGrid, keyArray } = this;

    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];

    rArray.iter((i, x, y, z) => {
      if (min[0] > x) min[0] = x;
      if (min[1] > y) min[1] = y;
      if (min[2] > z) min[2] = z;

      if (max[0] < x) max[0] = x;
      if (max[1] < y) max[1] = y;
      if (max[2] < z) max[2] = z;
    });

    vec3.addScalar(min, -config.h);
    vec3.addScalar(max, config.h);

    lookupGrid.setSpace(min, max);

    const pi: Vec3 = [0, 0, 0];
    const ki: Vec3 = [0, 0, 0];

    for (let i = 0; i < N; i += 1) {
      rArray.get(i, pi);
      lookupGrid.getGridKey(pi, ki);
      keyArray.set(i, ...ki);
    }
  };

  findNeighbors = () => {
    for (let i = 0; i < config.N; i++) {
      this.lookupGrid.getPossibleNeighbors(i, this.keyArray);
    }
  };

  computeRhoFor = (P: Vec3) => {
    const { lookupGrid, sharingGridKey: sharingGridkey } = this;

    let rho = 0;

    lookupGrid.getGridKey(P, sharingGridkey);
    const size = lookupGrid.getPossibleNeighborsByK2(sharingGridkey);

    for (let k = 0; k < size; k++) {
      const i = lookupGrid.neighbors[k];
      this.rArray.get(i, this.computeRhoForPi);
      const r = vec3.R(P, this.computeRhoForPi);
      if (r >= config.h) continue;
      rho += this.massArray[i] * Poly6Kernel(r, config.h);
    }

    return rho;
  };

  computeRho = () => {
    const { N } = config;

    const {
      rhoArray,
      pressureArray,
      massArray,
      p_over_rhoSqArray,
      mass_over_rhoArray,
      lookupGrid,
      keyArray,
      rArray,
    } = this;

    this.pMax = -Infinity;
    this.pMin = Infinity;
    this.rhoAvg = 0;

    let i = 0;
    let rho = 0;

    for (i = 0; i < N; i += 1) {
      rho = 0;
      keyArray.get(i, this.sharingGridKey);

      const offset = i * N;
      const size = lookupGrid.neighborsInOne[offset + N - 1];

      for (let k = 0; k < size; k += 1) {
        const j = lookupGrid.neighborsInOne[offset + k];
        if (i === j) continue;

        const r = rArray.r(i, j);
        if (r >= config.h) continue;

        rho += massArray[j] * Poly6Kernel(r, config.h);
      }

      rho = Math.max(rho, config.rhomin);
      const pressure = config.variables.k * (rho - config.rho0);

      rhoArray[i] = rho;
      pressureArray[i] = pressure;

      p_over_rhoSqArray[i] = pressure / pow(rho, 2);
      mass_over_rhoArray[i] = massArray[i] / rho;

      this.rhoAvg += rho;

      if (this.pMax < pressure) this.pMax = pressure;
      if (this.pMin > pressure) this.pMin = pressure;
    }

    this.rhoAvg /= config.N;

    __usePanel_write__(0, `avg rho: ${this.rhoAvg.toFixed(3)}`);
    __usePanel_write__(1, `pmin: ${this.pMin.toFixed(3)}`);
    __usePanel_write__(2, `pmax: ${this.pMax.toFixed(3)}`);
  };

  computeForce = () => {
    const { N } = config;

    const gravity = vec3.multiplyScalar(
      [...this.boundary.down],
      config.variables.g
    );

    const {
      rArray,
      vArray,
      fArray,
      lookupGrid,
      massArray,
      sharedArray,
      p_over_rhoSqArray,
      mass_over_rhoArray,
    } = this;

    sharedArray.reset();
    const G$ = sharedArray.alloc();
    const Pi$ = sharedArray.alloc();
    const Vi$ = sharedArray.alloc();
    const Fi$ = sharedArray.alloc();

    const Pj$ = sharedArray.alloc();
    const dPij$ = sharedArray.alloc();
    const Vj$ = sharedArray.alloc();
    const dVij$ = sharedArray.alloc();
    const Fij0$ = sharedArray.alloc();
    const Fij1$ = sharedArray.alloc();

    sharedArray.set(G$, ...gravity);

    let scalar = 0;

    for (let i = 0; i < N; i += 1) {
      sharedArray.zero(Fi$);

      sharedArray.assign(Pi$, i, rArray);
      sharedArray.assign(Vi$, i, vArray);

      const offset = i * N;
      const size = lookupGrid.neighborsInOne[offset + N - 1];

      for (let k = 0; k < size; k++) {
        const j = lookupGrid.neighborsInOne[offset + k];
        if (i === j) continue;

        const r = rArray.r(i, j);
        if (r >= config.h) continue;

        sharedArray.assign(Pj$, j, rArray);
        sharedArray.assign(Vj$, j, vArray);

        sharedArray.dir(Pi$, Pj$, dPij$);
        sharedArray.dir(Vi$, Vj$, dVij$);

        scalar =
          (massArray[i] *
            (p_over_rhoSqArray[i] + p_over_rhoSqArray[j]) *
            SpikyKernelGradient(r, config.h) *
            massArray[j]) /
          r;

        sharedArray.mutiplyScalar(dPij$, scalar, Fij0$);

        scalar =
          config.variables.mu *
          W_viscosity(r, config.h) *
          mass_over_rhoArray[i] *
          mass_over_rhoArray[j];

        sharedArray.mutiplyScalar(dVij$, scalar, Fij1$);

        sharedArray.add(Fi$, Fij0$);
        sharedArray.add(Fi$, Fij1$);
      }

      sharedArray.add(Fi$, G$);
      fArray.assign(i, Fi$, sharedArray);
    }
  };

  resolveCollisions = (
    i: number,
    p0: number,
    v0: number,
    p2: number,
    v2: number
  ) => {
    const { sharedArray, rArray, vArray } = this;
    const { bmax: max, bmin: min } = this.boundary;

    const P0 = sharedArray.get(p0);
    const V0 = sharedArray.get(v0);
    const P2 = sharedArray.get(p2);
    const V2 = sharedArray.get(v2);

    for (let dim = 0; dim < 3; dim += 1) {
      let x = P0[dim];
      let v = V0[dim];

      let _x = P2[dim];
      let _v = V2[dim];

      if (_x <= min[dim] || _x >= max[dim]) {
        v = -v * config.damping;
      } else {
        x = _x;
        v = _v;
      }

      rArray.setComponent(i, dim, x);
      vArray.setComponent(i, dim, v);
    }
  };

  move = () => {
    const { rArray, fArray, vArray, sharedArray } = this;
    const { N } = config;
    const dt = config.variables.dt;

    const dtSq_half = 0.5 * pow(dt, 2);

    let velocityMax = Number.MIN_VALUE;

    sharedArray.reset();
    const A$ = sharedArray.alloc();
    const P$ = sharedArray.alloc();
    const Pto$ = sharedArray.alloc();
    const V$ = sharedArray.alloc();
    const Vto$ = sharedArray.alloc();
    const T$ = sharedArray.alloc();
    const T2$ = sharedArray.alloc();

    for (let i = 0; i < N; i += 1) {
      const m = this.rhoArray[i];

      sharedArray.assign(A$, i, fArray);
      sharedArray.divideScalar(A$, m);

      sharedArray.assign(P$, i, rArray);
      sharedArray.assign(V$, i, vArray);

      sharedArray.mutiplyScalar(V$, dt, T$);
      sharedArray.mutiplyScalar(A$, dtSq_half, T2$);
      sharedArray.sum(Pto$, P$, T$, T2$);

      sharedArray.mutiplyScalar(A$, dt, T$);
      sharedArray.add(V$, T$, Vto$);

      this.resolveCollisions(i, P$, V$, Pto$, Vto$);

      const velocityScalar = vArray.mag(i);

      if (velocityScalar > velocityMax) velocityMax = velocityScalar;
    }

    this.velocityMax = velocityMax;
    __usePanel_write__(4, `vmax: ${velocityMax.toFixed(3)}`);
  };
}
