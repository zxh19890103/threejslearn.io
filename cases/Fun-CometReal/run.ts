/**
 * Generated Automatically At Tue Mar 04 2025 22:47:27 GMT+0800 (China Standard Time);
 */

import {
  cpCurrentToNext,
  cpNextToCurrent,
  doGravityBufferCompution,
  GRAVITY_AU,
  GravityCaringBody,
  intervalPerFrame,
  MOMENT_N_PER_FRAME,
  MovingBody,
} from "../Fun-EarthSatellites/gravity.js";
import { parseJPLHorizonData } from "../Fun-EarthSatellites/utils.js";
import { Bodies13 } from "../Fun-SolarSystem/planets.js";
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

__config__.camPos = [
  Bodies13.Halley.peribelion * GRAVITY_AU * 0.4,
  0,
  Bodies13.Halley.peribelion * GRAVITY_AU * 0.4,
];

__main__ = (
  world: THREE.Scene,
  maincam: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val, GRAVITY_AU);

  const Sun: GravityCaringBody = {
    nextCoordinates: [0, 0, 0],
    inf: Bodies13.Sun,
  };

  // on date: 1989-02-08 (my birthday.), data On JPL Horizon!

  const jplData_halley = parseJPLHorizonData(
    ` X =-1.280997583918991E+09 Y = 7.277412481800931E+08 Z =-4.714750193329351E+08
 VX=-7.261814084592768E+00 VY= 7.676788032692305E+00 VZ=-3.258980464742084E+00
 LT= 5.159850393262025E+03 RG= 1.546884232308289E+09 RR= 1.061851245019614E+01`
  );

  const halleyBody: MovingBody = {
    _coordinates: jplData_halley.P,
    _velocity: jplData_halley.V,
    gravityCaringObjects: [Sun],
    nextCoordinates: [0, 0, 0],
    nextVelocity: [0, 0, 0],
    trajectory: [],
  };

  const jplData_earth = parseJPLHorizonData(
    ` X =-1.119859463921117E+08 Y = 9.611922945976862E+07 Z = 1.809333540730178E+03
 VX=-1.989082804427416E+01 VY=-2.272690873079080E+01 VZ=-1.830234615866289E-03
 LT= 4.922727849111313E+02 RG= 1.475796681950134E+08 RR= 2.913697060652847E-01`
  );

  const earthBody: MovingBody = {
    _coordinates: jplData_earth.P,
    _velocity: jplData_earth.V,
    gravityCaringObjects: [Sun],
    nextCoordinates: [0, 0, 0],
    nextVelocity: [0, 0, 0],
    trajectory: [],
  };

  const sun = new THREE.PointLight(0xffffff, 1, 103, 0.01);

  const comet = new Comet(halleyBody);
  comet.earth = earthBody;
  world.add(comet);

  let camPosDid = false;

  __add_nextframe_fn__((s, c, r, dt) => {
    comet.move(dt);

    if (!camPosDid) {
      console.log("hhaa", comet.orbitPlane.length());
      maincam.position.copy(comet.orbitPlane.setLength(10 * GRAVITY_AU));
      camPosDid = true;
    }

    // maincam.lookAt(...halleyBody._coordinates);
    // maincam.updateProjectionMatrix();
  });

  __add_nextframe_fn__((s, c, r, dt) => {
    comet.emitParticles();
  });

  world.add(sun, comet);

  __updateTHREEJs__many__.fov_fov1 = (k, val) => {
    maincam.fov = val;
    maincam.updateProjectionMatrix();
  };

  __updateTHREEJs__only__.lookatHalley = () => {
    console.log(...comet.movingBody._coordinates);
  };

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

class Comet extends THREE.Object3D {
  private particles: Particle[] = [];
  private tracjectory: number[] = [];
  public orbitPlane: THREE.Vector3 = null;

  readonly ptUI: THREE.Points;
  readonly particlesUI: THREE.Points;
  readonly trajectoryUI: THREE.Line;

  readonly toSunV3Normal: THREE.Vector3 = new THREE.Vector3();

  earth: MovingBody = null;

  constructor(readonly movingBody: MovingBody) {
    super();

    this.ptUI = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: 0xfef190,
        vertexColors: true,
        sizeAttenuation: false,
        size: 4,
      })
    );

    this.ptUI.frustumCulled = false;

    this.particlesUI = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        transparent: true,
        vertexColors: true,
        color: 0xffffff,
        size: 3,
        sizeAttenuation: false,
        blending: THREE.AdditiveBlending,
      })
    );

    this.particlesUI.frustumCulled = false;

    this.trajectoryUI = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );

    this.trajectoryUI.frustumCulled = false;

    this.add(this.ptUI, this.particlesUI, this.trajectoryUI);
  }

  createParticle(power: number, type: ParticleType): Particle {
    const lifetime =
      type === "ion"
        ? (100 + Math.random() * 10) * intervalPerFrame
        : (200 + Math.random() * 10) * intervalPerFrame;
    const p = this.movingBody._coordinates;
    const v = this.movingBody._velocity;

    const t = Math.random() * Math.PI * 2;
    const r = Math.random() * 100 + 10;
    const poffset = v3.set(r * Math.cos(t), 0, r * Math.sin(t)).clone();
    q4.setFromUnitVectors(__3__.aY, v3.set(...v).normalize());
    poffset.applyQuaternion(q4);

    const a = [0, 0, 0];

    return {
      type,
      free: false,
      x: p[0] + poffset.x,
      y: p[1] + poffset.y,
      z: p[2] + poffset.z,
      vx: v[0],
      vy: v[1],
      vz: v[2],
      ax: a[0],
      ay: a[1],
      az: a[2],
      lifetime,
      deadtime: lifetime,
    };
  }

  emitParticles() {
    let n = Math.floor(30 + Math.random() * 200);
    while (n--) {
      const particle = this.createParticle(
        10,
        Math.random() > 0.5 ? "ion" : "dust"
      );
      this.particles.push(particle);
    }
  }

  move(dt: number) {
    let _particles: Particle[] = [];

    const movingBody = this.movingBody;

    cpCurrentToNext(movingBody);
    cpCurrentToNext(this.earth);

    doGravityBufferCompution(
      movingBody,
      MOMENT_N_PER_FRAME,
      movingBody.nextCoordinates,
      movingBody.nextVelocity
    );

    doGravityBufferCompution(
      this.earth,
      MOMENT_N_PER_FRAME,
      this.earth.nextCoordinates,
      this.earth.nextVelocity
    );

    if (!this.orbitPlane) {
      this.orbitPlane = v3
        .set(...movingBody._coordinates)
        .cross({
          x: movingBody.nextCoordinates[0],
          y: movingBody.nextCoordinates[1],
          z: movingBody.nextCoordinates[2],
        })
        .normalize()
        .clone();
    }

    cpNextToCurrent(movingBody);
    cpNextToCurrent(this.earth);

    // this.tracjectory = [0, 0, 0, ...movingBody._coordinates];

    const pts: number[] = [];
    const colors: number[] = [];

    for (const particle of this.particles) {
      moveParticle(particle, intervalPerFrame);
      if (particle.deadtime > 0) {
        _particles.push(particle);
        pts.push(particle.x, particle.y, particle.z);
        const color = particle.type === "ion" ? ionTailColor : dustTailColor;
        colors.push(
          color.r,
          color.g,
          color.b,
          particle.deadtime / particle.lifetime
        );
      }
    }

    this.particles = _particles;

    this.ptUI.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([
          0,
          0,
          0,
          ...movingBody._coordinates,
          ...this.earth._coordinates,
        ]),
        3
      )
    );
    this.ptUI.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array([1, 1, 1, 0.8, 0.4, 0.1, 0.3, 1, 0.1]),
        3
      )
    );

    this.particlesUI.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pts), 3)
    );
    this.particlesUI.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(colors), 4)
    );

    this.trajectoryUI.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.tracjectory), 3)
    );
  }
}

const ionTailColor = new THREE.Color(0x4a90e2); // 蓝色离子尾
const dustTailColor = new THREE.Color(0xffd27f); // 黄色尘埃尾

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
  let sunImpactV = v3.set(0, 0, 0);
  sunImpactV = v3.set(particle.x, particle.y, particle.z).normalize();

  if (particle.type === "ion") sunImpactV.setLength(1e-8);
  else sunImpactV.setLength(0);

  particle.ax = sunImpactV.x;
  particle.ay = sunImpactV.y;
  particle.az = sunImpactV.z;

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

  // v = 0.01 -

  // console.log(v3.set(particle.vx, particle.vy, particle.vz).length());

  // random
  rV3.randomDirection().setLength(GRAVITY_AU * 0.2);
  particle.x += rV3.x;
  particle.y += rV3.y;
  particle.z += rV3.z;

  particle.deadtime -= dt;
};

const rV3 = new THREE.Vector3();

let fov = __config__.camFov;
let fov1 = 1;
let lookatHalley = false;

__defineControl__("fov", "range", fov, __defineControl__.rfloat(1, 160));
__defineControl__("fov1", "range", fov1, __defineControl__.rfloat(0.01, 1));
__defineControl__("lookatHalley", "bit", lookatHalley);
