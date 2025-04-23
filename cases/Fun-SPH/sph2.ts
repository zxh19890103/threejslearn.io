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

  buildLookupGrid() {
    this.lookupGrid.buildKeyArray(this.rArray);
    this.lookupGrid.buildGrid();
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

      color.setRGB(r, b, 0);
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
  private computeRhoForPi: Vec3 = [0, 0, 0];

  findNeighbors = () => {
    const lookupGrid = this.lookupGrid;
    for (let i = 0; i < config.N; i++) {
      lookupGrid.getPossibleNeighborsOfPartice(i);
    }
  };

  computeRhoFor = (P: Vec3) => {
    const { lookupGrid } = this;

    let rho = 0;

    const size = lookupGrid.getPossibleNeighborsByPosition(P);

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
      rArray,
    } = this;

    this.pMax = -Infinity;
    this.pMin = Infinity;
    this.rhoAvg = 0;

    let i = 0;
    let rho = 0;

    for (i = 0; i < N; i += 1) {
      rho = 0;
      let offset = i * lookupGrid.neighborsInOneDimensions[0];
      const size = lookupGrid.neighborsInOne[offset];

      offset++;

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

    const {
      rArray,
      vArray,
      fArray,
      lookupGrid,
      massArray,
      p_over_rhoSqArray,
      mass_over_rhoArray,
    } = this;

    const Pi: Vec3 = [0, 0, 0];
    const Pj: Vec3 = [0, 0, 0];
    const dPij: Vec3 = [0, 0, 0];
    const Vi: Vec3 = [0, 0, 0];
    const Vj: Vec3 = [0, 0, 0];
    const dVij: Vec3 = [0, 0, 0];

    const Fi: Vec3 = [0, 0, 0];

    let scalar = 0;

    for (let i = 0; i < N; i += 1) {
      vec3.zero(Fi);

      rArray.get(i, Pi);
      vArray.get(i, Vi);

      let offset = i * lookupGrid.neighborsInOneDimensions[0];
      const size = lookupGrid.neighborsInOne[offset];
      offset++;

      for (let k = 0; k < size; k++) {
        const j = lookupGrid.neighborsInOne[offset + k];
        if (i === j) continue;

        const r = rArray.r(i, j);
        if (r >= config.h) continue;

        rArray.get(j, Pj);
        vArray.get(j, Vj);

        rArray.dir(i, j).give(dPij);
        vArray.dir(i, j).give(dVij);

        scalar =
          (massArray[i] *
            (p_over_rhoSqArray[i] + p_over_rhoSqArray[j]) *
            SpikyKernelGradient(r, config.h) *
            massArray[j]) /
          r;

        vec3.multiplyScalar(dPij, scalar);
        vec3.add(Fi, dPij);

        scalar =
          config.variables.mu *
          W_viscosity(r, config.h) *
          mass_over_rhoArray[i] *
          mass_over_rhoArray[j];

        vec3.multiplyScalar(dVij, scalar);
        vec3.add(Fi, dVij);
      }

      fArray.setV3(i, Fi);
    }
  };

  obstacle: Obstacle;

  resolveCollisions = (i: number, P0: Vec3, V0: Vec3, P2: Vec3, V2: Vec3) => {
    const { rArray, vArray } = this;
    const { bmax: max, bmin: min } = this.boundary;

    for (let dim = 0; dim < 3; dim += 1) {
      let x = P0[dim];
      let v = V0[dim];

      let _x = P2[dim];
      let _v = V2[dim];

      if (_x <= min[dim] || _x >= max[dim]) {
        vArray.setComponent(i, dim, -v * config.damping);
      } else {
        rArray.setComponent(i, dim, _x);
        vArray.setComponent(i, dim, _v);
      }
    }
  };

  move = () => {
    const { rArray, fArray, vArray } = this;
    const { N } = config;
    const dt = config.variables.dt;

    const gravity: Vec3 = vec3.multiplyScalar(
      [...this.boundary.down],
      config.variables.g
    );

    const dtSq_half = 0.5 * pow(dt, 2);

    let velocityMax = Number.MIN_VALUE;

    const A: Vec3 = [0, 0, 0];
    const P: Vec3 = [0, 0, 0];
    const Pto: Vec3 = [0, 0, 0];
    const V: Vec3 = [0, 0, 0];
    const Vto: Vec3 = [0, 0, 0];
    const T: Vec3 = [0, 0, 0];
    const T2: Vec3 = [0, 0, 0];

    for (let i = 0; i < N; i += 1) {
      const m = this.rhoArray[i];

      fArray.mutiplyScalar(i, m, fArray._t).give(A);

      vec3.add(A, gravity);

      rArray.get(i, P);
      vArray.get(i, V);

      vec3.multiplyScalar(vec3.copy(T, V), dt);
      vec3.multiplyScalar(vec3.copy(T2, A), dtSq_half);

      Pto[0] = P[0] + T[0] + T2[0];
      Pto[1] = P[1] + T[1] + T2[1];
      Pto[2] = P[2] + T[2] + T2[2];

      vec3.multiplyScalar(vec3.copy(T, A), dt);
      Vto[0] = V[0] + T[0];
      Vto[1] = V[1] + T[1];
      Vto[2] = V[2] + T[2];

      this.resolveCollisions(i, P, V, Pto, Vto);

      const velocityScalar = vArray.mag(i);

      if (velocityScalar > velocityMax) velocityMax = velocityScalar;
    }

    this.velocityMax = velocityMax;
    __usePanel_write__(4, `vmax: ${velocityMax.toFixed(3)}`);
  };
}

class Obstacle {
  box: THREE.Box3;
  sharing = new THREE.Vector3();

  constructor(center: Vec3, size: number) {
    this.box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(...center),
      new THREE.Vector3(size, size, size)
    );
  }

  hitTest(p: Vec3, v: Vec3) {
    const sharing = this.sharing;

    sharing.set(...p);

    if (this.box.containsPoint(sharing)) {
      // 找出哪個面被撞（簡化：只判斷最近的）
      const normal = this.getBoxSurfaceNormal(sharing);

      sharing.set(...v);

      const reflected = sharing
        .clone()
        .sub(normal.clone().multiplyScalar(2 * sharing.dot(normal)));

      vec3.copy(v, reflected.toArray());
    }
  }

  // 這個函式粗略猜測碰到哪個面（你可以根據需求更精細處理）
  getBoxSurfaceNormal(point) {
    const box = this.box;
    const epsilon = 0.001;
    if (Math.abs(point.x - box.min.x) < epsilon)
      return new THREE.Vector3(-1, 0, 0);
    if (Math.abs(point.x - box.max.x) < epsilon)
      return new THREE.Vector3(1, 0, 0);
    if (Math.abs(point.y - box.min.y) < epsilon)
      return new THREE.Vector3(0, -1, 0);
    if (Math.abs(point.y - box.max.y) < epsilon)
      return new THREE.Vector3(0, 1, 0);
    if (Math.abs(point.z - box.min.z) < epsilon)
      return new THREE.Vector3(0, 0, -1);
    if (Math.abs(point.z - box.max.z) < epsilon)
      return new THREE.Vector3(0, 0, 1);

    return new THREE.Vector3(0, 1, 0); // 預設
  }
}

class ObstaclePlane {
  constructor() {}
}
