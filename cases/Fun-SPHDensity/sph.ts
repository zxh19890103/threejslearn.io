import * as THREE from "three";
import { LookUpGrid3D } from "./LookupGrid.class.js";
import { Poly6Kernel, SpikyKernelGradient, W_viscosity } from "./kernels.js";
import { vec3 } from "../vec3.js";
import * as config from "./config.js";
import { Boundary } from "./boundary.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

const { pow, random } = Math;

export class ParticleCloud {
  readonly velocityArray = new Float32Array(config.N * 3).fill(0);
  readonly positionArray = new Float32Array(config.N * 3).fill(0);
  readonly forceArray = new Float32Array(config.N * 3).fill(0);
  readonly rhoArray = new Float32Array(config.N).fill(0);
  readonly massArray = new Float32Array(config.N).fill(0);
  readonly pressureArray = new Float32Array(config.N).fill(0);
  readonly p_over_rhoSqArray = new Float32Array(config.N).fill(0);
  readonly mass_over_rhoArray = new Float32Array(config.N).fill(0);

  cloud: THREE.Points;
  mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;
  cubes: MarchingCubes;

  boundary: Boundary;
  lookupGrid: LookUpGrid3D;

  each(arg0: (r: Vec3, v: Vec3, i: number) => void) {
    const { velocityArray, positionArray } = this;

    let iX = 0;
    let iY = 0;
    let iZ = 0;

    const V: Vec3 = [0, 0, 0];
    const P: Vec3 = [0, 0, 0];

    for (let i = 0; i < config.N; i += 1) {
      iX = i * 3;
      iY = iX + 1;
      iZ = iX + 2;

      V[0] = velocityArray[iX];
      V[1] = velocityArray[iY];
      V[2] = velocityArray[iZ];

      P[0] = positionArray[iX];
      P[1] = positionArray[iY];
      P[2] = positionArray[iZ];

      arg0(P, V, i);

      velocityArray[iX] = V[0];
      velocityArray[iY] = V[1];
      velocityArray[iZ] = V[2];

      positionArray[iX] = P[0];
      positionArray[iY] = P[1];
      positionArray[iZ] = P[2];
    }
  }

  /**
   *
   * @param pos the center
   * @param width measure along X
   * @param height measure along Y
   * @param depth measure along Z
   */
  buildBoundary(pos: Vec3, width: number, height: number, depth: number) {
    this.boundary = new Boundary({
      center: pos,
      width,
      height,
      depth,
    });

    this.lookupGrid = new LookUpGrid3D(this.boundary, config.h);

    let iX = 0;
    let iY = 0;
    let iZ = 0;

    for (let i = 0; i < config.N; i++) {
      const pos = this.boundary.getRandomLocalPosition();

      iX = i * 3;
      iY = iX + 1;
      iZ = iX + 2;

      this.massArray[i] = config.m0[0] + random() * config.m0[1];
      this.positionArray[iX] = pos[0];
      this.positionArray[iY] = pos[1];
      this.positionArray[iZ] = pos[2];
    }

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
      //   const resolution = 32; // Grid resolution
      //   const effect = new MarchingCubes(
      //     resolution,
      //     new THREE.MeshStandardMaterial({
      //       color: 0x00aaff,
      //       transparent: true,
      //       opacity: 0.8,
      //     }),
      //     true,
      //     true
      //   );
      //   effect.isolation = 50; // Surface threshold
      //   this.cubes = effect;
    }
  }

  renderV2() {
    const colorAttrib = this.cloud.geometry.attributes.color;
    const positionAttrib = this.cloud.geometry.attributes.position;

    const N = config.N;
    const { positionArray, velocityArray } = this;

    const position: Vec3 = [0, 0, 0];
    const velocity: Vec3 = [0, 0, 0];

    let iX = 0;
    let iY = 0;
    let iZ = 0;

    for (let i = 0; i < N; i++) {
      iX = i * 3;
      iY = iX + 1;
      iZ = iX + 2;

      position[0] = positionArray[iX];
      position[1] = positionArray[iY];
      position[2] = positionArray[iZ];

      velocity[0] = velocityArray[iX];
      velocity[1] = velocityArray[iY];
      velocity[2] = velocityArray[iZ];

      this.boundary.localToWorld(position);

      positionAttrib.setXYZ(i, position[0], position[1], position[2]);

      const velocityScalar = vec3.length(velocity);
      const r = velocityScalar > 1 ? 1 : velocityScalar;
      const b = 1 - r;
      colorAttrib.setXYZ(i, r, 0, b);
    }

    colorAttrib.needsUpdate = true;
    positionAttrib.needsUpdate = true;
  }

  /**@todo */
  renderMarchingCubes() {
    const { N } = config;
    const { cubes, positionArray, boundary } = this;
    cubes.reset();

    let iX = 0;
    let iY = 0;
    let iZ = 0;

    const P: Vec3 = [0, 0, 0];

    for (let i = 0; i < N; i++) {
      iX = i * 3;
      iY = iX + 1;
      iZ = iX + 2;

      P[0] = positionArray[iX];
      P[1] = positionArray[iY];
      P[2] = positionArray[iZ];

      boundary.localToWorld(P);

      cubes.addBall(P[0], P[1], P[2], 1.0, 1.0); // (x, y, z, strength, subtract)
    }
  }

  renderMesh() {
    const N = config.N;
    const { positionArray, velocityArray, mesh } = this;

    const position: Vec3 = [0, 0, 0];

    let iX = 0;
    let iY = 0;
    let iZ = 0;

    let pX = 0;
    let pY = 0;
    let pZ = 0;

    let vX = 0;
    let vY = 0;
    let vZ = 0;

    const mat4 = new THREE.Matrix4();
    const color = new THREE.Color(0x0011fe);
    const colorTo = new THREE.Color(0xf34f10);

    for (let i = 0; i < N; i++) {
      iX = i * 3;
      iY = iX + 1;
      iZ = iX + 2;

      position[0] = positionArray[iX];
      position[1] = positionArray[iY];
      position[2] = positionArray[iZ];

      vX = velocityArray[iX];
      vY = velocityArray[iY];
      vZ = velocityArray[iZ];

      this.boundary.localToWorld(position);

      pX = position[0];
      pY = position[1];
      pZ = position[2];

      mat4.makeTranslation(pX, pY, pZ);
      mesh.setMatrixAt(i, mat4);

      const velocityScalar = Math.sqrt(vX * vX + vY * vY + vZ * vZ);

      color.setHex(0x0011fe);
      const alpha = velocityScalar / this.velocityMax;
      color.lerpHSL(colorTo, alpha);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  private pMax: number = 0;
  private pMin: number = -1;
  private rhoAvg = 0;
  private velocityMax: number = 0;
  private computationCache: Record<string, Vec3> = {};

  computeRhoV2() {
    const { N } = config;

    const {
      positionArray,
      rhoArray,
      pressureArray,
      massArray,
      p_over_rhoSqArray,
      mass_over_rhoArray,
    } = this;

    this.pMax = Number.NEGATIVE_INFINITY;
    this.pMin = Number.POSITIVE_INFINITY;
    this.rhoAvg = 0;

    let iX = 0;
    let iY = 0;
    let iZ = 0;

    let piX = 0;
    let piY = 0;
    let piZ = 0;

    let pjX = 0;
    let pjY = 0;
    let pjZ = 0;

    let dX = 0;
    let dY = 0;
    let dZ = 0;

    const pi: Vec3 = [0, 0, 0];
    const pj: Vec3 = [0, 0, 0];

    for (let i = 0; i < N; i += 1) {
      let rho = 0;

      // neighbors.set(i, new Uint16Array());

      iX = i * 3;
      iY = iX + 1;
      iZ = iX + 2;

      piX = positionArray[iX];
      piY = positionArray[iY];
      piZ = positionArray[iZ];

      pi[0] = piX;
      pi[1] = piY;
      pi[2] = piZ;

      for (let j = 0; j < N; j += 1) {
        if (i === j) continue;

        const jX = j * 3;

        pjX = positionArray[jX];
        pjY = positionArray[jX + 1];
        pjZ = positionArray[jX + 2];

        pj[0] = pjX;
        pj[1] = pjY;
        pj[2] = pjZ;

        // if (lookupGrid.isNeighbourhood(pi, pj)) {
        dX = pjX - piX;
        dY = pjY - piY;
        dZ = pjZ - piZ;

        const r = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
        rho += massArray[j] * Poly6Kernel(r, config.h);
        // }
      }

      const pressure = config.variables.k * (rho - config.rho0);
      rhoArray[i] = rho;
      pressureArray[i] = pressure;

      if (rho >= config.rhomin) {
        p_over_rhoSqArray[i] = pressure / pow(rho, 2);
        mass_over_rhoArray[i] = massArray[i] / rho;
      } else {
        //
      }

      this.rhoAvg += rho;

      if (this.pMax < pressure) this.pMax = pressure;
      if (this.pMin > pressure) this.pMin = pressure;
    }

    this.rhoAvg /= config.N;

    // console.timeEnd("computeRho");
    __usePanel_write__(0, `avg rho: ${this.rhoAvg.toFixed(3)}`);
    __usePanel_write__(1, `pmin: ${this.pMin.toFixed(3)}`);
    __usePanel_write__(2, `pmax: ${this.pMax.toFixed(3)}`);
  }

  computeForcesV2() {
    const { rhomin, N } = config;

    const gravity = vec3.multiplyScalar(
      [...this.boundary.down],
      config.variables.g
    );

    const {
      rhoArray,
      massArray,
      p_over_rhoSqArray,
      mass_over_rhoArray,
      forceArray: FArray,
      positionArray: PArray,
      velocityArray: VArray,
      computationCache,
    } = this;

    let Xi: number = 0;
    let Yi: number = 0;
    let Zi: number = 0;

    let Xj: number = 0;
    let Yj: number = 0;
    let Zj: number = 0;

    let Vxi: number = 0;
    let Vyi: number = 0;
    let Vzi: number = 0;

    let Vxj: number = 0;
    let Vyj: number = 0;
    let Vzj: number = 0;

    let dX: number = 0;
    let dY: number = 0;
    let dZ: number = 0;

    let dVx: number = 0;
    let dVy: number = 0;
    let dVz: number = 0;

    let fX: number = 0;
    let fY: number = 0;
    let fZ: number = 0;

    let scalar = 0;

    let iX = 0;
    let iY = 0;
    let iZ = 0;

    let jX = 0;
    let jY = 0;
    let jZ = 0;

    const pi: Vec3 = [0, 0, 0];
    const pj: Vec3 = [0, 0, 0];
    const fij: Vec3 = [0, 0, 0];

    for (let i = 0; i < N; i += 1) {
      fX = 0;
      fY = 0;
      fZ = 0;

      if (rhoArray[i] < rhomin) continue;

      iX = i * 3;
      iY = iX + 1;
      iZ = iX + 2;

      Xi = PArray[iX];
      Yi = PArray[iY];
      Zi = PArray[iZ];

      pi[0] = Xi;
      pi[1] = Yi;
      pi[2] = Zi;

      Vxi = VArray[iX];
      Vyi = VArray[iY];
      Vzi = VArray[iZ];

      for (let j = 0; j < N; j += 1) {
        if (i === j) continue;
        if (rhoArray[j] < rhomin) continue;

        jX = j * 3;
        jY = jX + 1;
        jZ = jX + 2;

        Xj = PArray[jX];
        Yj = PArray[jY];
        Zj = PArray[jZ];

        pj[0] = Xj;
        pj[1] = Yj;
        pj[2] = Zj;

        Vxj = VArray[jX];
        Vyj = VArray[jY];
        Vzj = VArray[jZ];

        dX = Xj - Xi;
        dY = Yj - Yi;
        dZ = Zj - Zi;

        dVx = Vxj - Vxi;
        dVy = Vyj - Vyi;
        dVz = Vzj - Vzi;

        const r = Math.sqrt(dX * dX + dY * dY + dZ * dZ);

        scalar =
          (massArray[i] *
            (p_over_rhoSqArray[i] + p_over_rhoSqArray[j]) *
            SpikyKernelGradient(r, config.h) *
            massArray[j]) /
          r;

        fij[0] = scalar * dX;
        fij[1] = scalar * dY;
        fij[2] = scalar * dZ;

        scalar =
          config.variables.mu *
          W_viscosity(r, config.h) *
          mass_over_rhoArray[i] *
          mass_over_rhoArray[j];

        fij[0] += scalar * dVx;
        fij[1] += scalar * dVy;
        fij[2] += scalar * dVz;

        fX += fij[0];
        fY += fij[1];
        fZ += fij[2];
      }

      FArray[iX] = fX + gravity[0];
      FArray[iY] = fY + gravity[1];
      FArray[iZ] = fZ + gravity[2];
    }
  }

  resolveCollisionsV2_dim(
    dim: number,
    x0: number,
    x: number,
    v0: number,
    v: number
  ) {
    const { max, min } = this.boundary;

    let _x = x0;
    let _v = v0;

    if (x <= min[dim] || x >= max[dim]) {
      _v = -v0 * config.damping;
    } else {
      _x = x;
      _v = v;
    }

    return [_x, _v];
  }

  moveV2() {
    const { positionArray, forceArray, velocityArray } = this;
    const { N } = config;
    const dt = config.variables.dt;

    const dtSq_half = 0.5 * pow(dt, 2);

    let velocityMax = Number.MIN_VALUE;

    let xTo = 0;
    let yTo = 0;
    let zTo = 0;

    let x0 = 0;
    let y0 = 0;
    let z0 = 0;

    let vxTo = 0;
    let vyTo = 0;
    let vzTo = 0;

    let vx0 = 0;
    let vy0 = 0;
    let vz0 = 0;

    let aX = 0;
    let aY = 0;
    let aZ = 0;

    let iX = 0;
    let iY = 0;
    let iZ = 0;

    for (let i = 0; i < N; i += 1) {
      iX = i * 3;
      iY = iX + 1;
      iZ = iX + 2;

      const m = this.massArray[i];

      aX = forceArray[iX] / m;
      aY = forceArray[iY] / m;
      aZ = forceArray[iZ] / m;

      x0 = positionArray[iX];
      y0 = positionArray[iY];
      z0 = positionArray[iZ];

      vx0 = velocityArray[iX];
      vy0 = velocityArray[iY];
      vz0 = velocityArray[iZ];

      vxTo = vx0 + aX * dt;
      vyTo = vy0 + aY * dt;
      vzTo = vz0 + aZ * dt;

      xTo = x0 + vx0 * dt + aX * dtSq_half;
      yTo = y0 + vy0 * dt + aY * dtSq_half;
      zTo = z0 + vz0 * dt + aZ * dtSq_half;

      const x = this.resolveCollisionsV2_dim(0, x0, xTo, vx0, vxTo);
      const y = this.resolveCollisionsV2_dim(1, y0, yTo, vy0, vyTo);
      const z = this.resolveCollisionsV2_dim(2, z0, zTo, vz0, vzTo);

      positionArray[iX] = x[0];
      positionArray[iY] = y[0];
      positionArray[iZ] = z[0];

      velocityArray[iX] = x[1];
      velocityArray[iY] = y[1];
      velocityArray[iZ] = z[1];

      const velocityScalar = Math.sqrt(x[1] * x[1] + y[1] * y[1] + z[1] * z[1]);

      if (velocityScalar > velocityMax) {
        velocityMax = velocityScalar;
      }
    }

    this.velocityMax = velocityMax;
    __usePanel_write__(4, `vmax: ${velocityMax.toFixed(3)}`);
  }
}
