/**
 * Generated Automatically At Tue Mar 04 2025 22:47:27 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let enableGrid = false;
let enableAxes = false;

//#region reactive
__dev__();
__defineControl__("enableGrid", "bit", enableGrid);
__defineControl__("enableAxes", "bit", enableAxes);

__updateControlsDOM__ = () => {
  __renderControls__({
    enableAxes,
    enableGrid,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__main__ = (
  world: THREE.Scene,
  maincam: THREE.Camera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  const sun = new THREE.PointLight(0xffffff, 1, 103, 0.01);

  const comet = new Comet();

  world.add(comet.particlesUI, comet.trajectoryUI);

  __add_nextframe_fn__((s, c, r, dt) => {
    comet.emitParticles();
  }, 0.3);

  __add_nextframe_fn__((s, c, r, dt) => {
    comet.velocity.randomDirection().setLength(20);
    comet.move(dt);
  });

  world.add(sun, comet);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

class Comet extends THREE.Object3D {
  velocity: THREE.Vector3 = new THREE.Vector3();
  private particles: Particle[] = [];
  private tracjectory: number[] = [];
  readonly particlesUI: THREE.Points;
  readonly trajectoryUI: THREE.Line;

  constructor() {
    super();

    this.particlesUI = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        transparent: true,
        vertexColors: false,
        color: 0xffffff,
        size: 2,
        sizeAttenuation: false,
        blending: THREE.AdditiveBlending,
      })
    );

    this.trajectoryUI = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
  }

  createParticle(power: number, type: ParticleType): Particle {
    const lifetime = 3 + Math.random() * 10;
    const p = this.position;
    const v = this.velocity;
    const a = [0, 0, 0];

    return {
      type,
      free: false,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: v.x,
      vy: v.y,
      vz: v.z,
      ax: a[0],
      ay: a[1],
      az: a[2],
      lifetime,
      deadtime: lifetime,
    };
  }

  emitParticles() {
    let n = 300;
    while (n--) {
      const particle = this.createParticle(10, "ion");
      this.particles.push(particle);
    }
  }

  move(dt: number) {
    let _particles: Particle[] = [];
    this.position.add(this.velocity.multiplyScalar(dt));

    this.tracjectory.push(this.position.x, this.position.y, this.position.z);

    const pts: number[] = [];

    for (const particle of this.particles) {
      moveParticle(particle, dt);
      if (particle.deadtime > 0) {
        _particles.push(particle);
        pts.push(particle.x, particle.y, particle.z);
      }
    }

    this.particles = _particles;

    this.particlesUI.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pts), 3)
    );

    this.trajectoryUI.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.tracjectory), 3)
    );
  }
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ax: number;
  ay: number;
  az: number;
  free: boolean;
  type: ParticleType;
  /** sec */
  lifetime: number;
  /** sec */
  deadtime: number;
}

type ParticleType = "ion" | "dust";

const Color = new THREE.Color();
const v3 = new THREE.Vector3();
const q4 = new THREE.Quaternion();

const moveParticle = (particle: Particle, dt: number) => {
  const dv = v3.set(particle.ax, particle.ay, particle.az).multiplyScalar(dt);

  let { x: vx, y: vy, z: vz } = dv;

  const ds = v3
    .set(particle.vx + vx * 0.5, particle.vy + vy * 0.5, particle.vz + vz * 0.5)
    .multiplyScalar(dt);

  particle.vx += vx;
  particle.vy += vy;
  particle.vz += vz;

  particle.x += ds.x;
  particle.y += ds.y;
  particle.z += ds.z;

  // random
  rV3.randomDirection().setLength(0.02);
  particle.x += rV3.x;
  particle.y += rV3.y;
  particle.z += rV3.z;

  particle.deadtime -= dt;
};

const rV3 = new THREE.Vector3();
