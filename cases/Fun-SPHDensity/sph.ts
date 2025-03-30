import * as THREE from "three";
import { LookUpGrid3D } from "./LookupGrid.class.js";
import { Poly6Kernel, SpikyKernelGradient, W_viscosity } from "./kernels.js";
import { vec3 } from "../vec3.js";
import * as config from "./config.js";
import { Boundary } from "./boundary.js";

const { pow, random } = Math;

class Particle {
  neighbours: Particle[];
  mass: number = 0;

  velocity: Vec3 = [0, 0, 0];
  position: Vec3 = [0, 0, 0];
  acceleration: Vec3 = [0, 0, 0];

  rho: number = 0;
  pressure: number = 0;

  accelerationScalar: number = 0;
  velocityScalar: number = 0;

  constructor(readonly $i: number, position: Vec3, mass: number) {
    vec3.copy(this.position, position);
    this.mass = mass;
  }

  r(j: Particle): Vec3 {
    return [
      j.position[0] - this.position[0],
      j.position[1] - this.position[1],
      j.position[2] - this.position[2],
    ];
  }

  dir(j: Particle): Vec3 {
    const dx = j.position[0] - this.position[0];
    const dy = j.position[1] - this.position[1];
    const dz = j.position[2] - this.position[2];
    const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return [dx / mag, dy / mag, dz / mag];
  }

  dist(j: Particle) {
    const [x, y, z] = this.position;
    const [x1, y1, z1] = j.position;
    return Math.sqrt(pow(x - x1, 2) + pow(y - y1, 2) + pow(z - z1, 2));
  }
}

export class ParticleCloud {
  cloud: THREE.Points;
  particles: Particle[] = [];

  boundary: Boundary;
  lookupGrid: LookUpGrid3D;

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

    this.particles = [];

    const particles = this.particles;

    for (let i = 0; i < config.N; i++) {
      const pos = this.boundary.getRandomWorldPosition();
      const mass = config.m0[0] + random() * config.m0[1];
      particles.push(new Particle(i, pos, mass));
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
  }

  render() {
    const colorAttrib = this.cloud.geometry.attributes.color;
    const positionAttrib = this.cloud.geometry.attributes.position;
    const count = positionAttrib.count;
    const particles = this.particles;

    let particle: Particle = null;
    let pos: Vec3 = null;

    for (let i = 0; i < count; i++) {
      particle = particles[i];
      pos = particle.position;
      positionAttrib.setXYZ(i, pos[0], pos[1], pos[2]);
      colorAttrib.setXYZ(i, 1, 0, 1);
    }

    colorAttrib.needsUpdate = true;
    positionAttrib.needsUpdate = true;
  }

  private pMax: number = 0;
  private pMin: number = -1;
  private rhoAvg = 0;

  computeRho() {
    this.pMax = Number.NEGATIVE_INFINITY;
    this.pMin = Number.POSITIVE_INFINITY;
    this.rhoAvg = 0;

    for (const i of this.particles) {
      let rho = 0;

      i.neighbours = [];

      for (const j of this.particles) {
        if (i === j) continue;

        rho += j.mass * Poly6Kernel(i.dist(j), config.h);
      }

      i.rho = rho;
      i.pressure = config.variables.k * (i.rho - config.rho0);

      this.rhoAvg += rho;

      if (this.pMax < i.pressure) this.pMax = i.pressure;
      if (this.pMin > i.pressure) this.pMin = i.pressure;
    }

    this.rhoAvg /= config.N;

    __usePanel_write__(0, `avg rho: ${this.rhoAvg.toFixed(3)}`);
    __usePanel_write__(1, `pmin: ${this.pMin.toFixed(3)}`);
    __usePanel_write__(2, `pmax: ${this.pMax.toFixed(3)}`);
  }

  computeAcc() {
    const gravity = vec3.setLength(vec3.clone(config.down), config.variables.g);

    for (const i of this.particles) {
      i.acceleration = vec3.clone(gravity);
      const pressure: Vec3 = [0, 0, 0];
      const viscosity: Vec3 = [0, 0, 0];

      if (i.rho < config.rhomin) continue;

      for (const j of this.particles) {
        if (i === j) continue;
        if (j.rho < config.rhomin) continue;

        // const r = i.dist(j);
        const r = vec3.R(i.position, j.position);

        const influence0 = vec3.setLength(
          vec3.dR(i.position, j.position),
          (i.pressure / pow(i.rho, 2) + j.pressure / pow(j.rho, 2)) *
            SpikyKernelGradient(r, config.h) *
            j.mass
        );
        vec3.add(pressure, influence0);

        const influence1 = vec3.multiplyScalar(
          vec3.dR(i.velocity, j.velocity),
          (config.variables.mu * W_viscosity(r, config.h) * j.mass) / j.rho
        );

        vec3.add(viscosity, influence1);
      }

      vec3.add(i.acceleration, pressure);
      vec3.add(i.acceleration, viscosity);
    }
  }

  resolveCollisions(i: Particle, Pto: Vec3, Vto: Vec3) {
    const Pi = i.position;
    const Vi = i.velocity;

    this.boundary.worldToLocal(Pi);
    this.boundary.toLocal(Vi);

    this.boundary.worldToLocal(Pto);
    this.boundary.toLocal(Vto);

    const { max, min } = this.boundary;

    for (let dim = 0; dim < 3; dim++) {
      if (Pto[dim] <= min[dim] || Pto[dim] >= max[dim]) {
        Vi[dim] = -Vto[dim] * config.damping;
      } else {
        Pi[dim] = Pto[dim];
        Vi[dim] = Vto[dim];
      }
    }

    this.boundary.localToWorld(Pi);
    this.boundary.toWorld(Vi);
  }

  move() {
    const dt = config.variables.dt;

    const pTo: Vec3 = [0, 0, 0];
    const vTo: Vec3 = [0, 0, 0];
    const dtSq_half = 0.5 * Math.pow(dt, 2);

    for (const i of this.particles) {
      const a = i.acceleration;

      vTo[0] = i.velocity[0] + a[0] * dt;
      vTo[1] = i.velocity[1] + a[1] * dt;
      vTo[2] = i.velocity[2] + a[2] * dt;

      pTo[0] = i.position[0] + i.velocity[0] * dt + a[0] * dtSq_half;
      pTo[1] = i.position[1] + i.velocity[1] * dt + a[1] * dtSq_half;
      pTo[2] = i.position[2] + i.velocity[2] * dt + a[2] * dtSq_half;

      this.resolveCollisions(i, pTo, vTo);
      i.velocityScalar = vec3.length(i.velocity);
    }
  }
}
