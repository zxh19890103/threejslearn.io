/**
 * Generated Automatically At Tue Mar 04 2025 16:40:01 GMT+0800 (China Standard Time);
 */

import { __useCSS2Renderer__, createCss2dObjectFor } from "../css2r.js";
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

__config__.camPos = [0, 60, 3];

__main__ = (world: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __useCSS2Renderer__();

  const sun = new THREE.Object3D();
  sun.position.set(0, 0, 0);
  createCss2dObjectFor(sun, "sun", { offset: 0, color: "#fe0190" });
  world.add(sun);

  const comet = new THREE.Mesh(
    new THREE.SphereGeometry(0.96, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
    })
  );

  comet.position.set(12, 0, 0);
  world.add(comet);

  __3__.crs(comet, 3);

  const ptLight = new THREE.PointLight(0xffffff, 1, 100, 0.01);
  ptLight.position.set(0, 0, 0);
  world.add(ptLight);

  const particleSize = 0.5;

  // const textLoader = new THREE.TextureLoader(new THREE.LoadingManager());

  const ionTail = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      transparent: true,
      vertexColors: true,
      color: 0xffffff,
      sizeAttenuation: true,
      size: particleSize,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    })
  );

  const dustTail = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      transparent: true,
      vertexColors: true,
      color: 0xffffff,
      sizeAttenuation: false,
      size: particleSize,
      blending: THREE.AdditiveBlending,
    })
  );

  let particles: Particle[] = [];

  const generate = () => {
    let n = Math.floor(Math.random() * 500 + 500);
    while (n--) {
      const type = Math.random() > 0.5 ? "dust" : "ion";
      particles.push(
        createParticle(
          type === "ion" ? Math.random() * 10 + 10 : Math.random() * 3 + 3,
          type
        )
      );
    }
  };

  const ballColor = new THREE.Color(0xffffff);
  const ionTailColor = new THREE.Color(0x4a90e2); // 蓝色离子尾
  const dustTailColor = new THREE.Color(0xffd27f); // 黄色尘埃尾

  __add_nextframe_fn__((s_, c_, r_, dt) => {
    const ptsIon: number[] = [];
    const colorsIon: number[] = [];

    const ptsDust: number[] = [];
    const colorsDust: number[] = [];

    const _particles: Particle[] = [];

    comet.position.applyAxisAngle(__3__.aY, 0.005);

    ionTail.lookAt(sun.position);
    dustTail.lookAt(sun.position);

    for (const particle of particles) {
      moveParticle(particle, dt);
      if (particle.remaining <= 0) continue;
      _particles.push(particle);
      const a = particle.remaining / particle.lifetime;

      if (particle.type === "dust") {
        ptsDust.push(particle.x, particle.y, particle.z);
        Color.copy(ballColor).lerp(dustTailColor, Math.pow(1 - a, 0.2));
        colorsDust.push(Color.r, Color.g, Color.b, Math.pow(a, 6));
      } else {
        ptsIon.push(particle.x, particle.y, particle.z);
        Color.copy(ballColor).lerp(ionTailColor, Math.pow(1 - a, 0.2));
        colorsIon.push(Color.r, Color.g, Color.b, Math.pow(a, 9));
      }
    }

    particles = _particles;

    ionTail.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(ptsIon), 3)
    );
    ionTail.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(colorsIon), 4)
    );

    dustTail.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(ptsDust), 3)
    );
    dustTail.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(colorsDust), 4)
    );
  });

  __add_nextframe_fn__(generate, 0.1);

  comet.add(ionTail, dustTail);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

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
  type: ParticleType;
  /** sec */
  lifetime: number;
  /** sec */
  remaining: number;
}

type ParticleType = "ion" | "dust";

const createParticle = (power: number, type: ParticleType): Particle => {
  // a circle on z-x plane
  q4.setFromAxisAngle(__3__.aZ, Math.random() * Math.PI * 2);
  const r = 0.2 + 0.8 * Math.random();
  v3.set(r, 0, 0).applyQuaternion(q4);
  const p = v3.toArray();

  v3.set(p[0], p[1], -r * 10.5).setLength(power);
  const v = v3.toArray();

  let a = [0, 0, 0];

  if (type === "dust") {
    a = v3.set(1, 0, 0).multiplyScalar(2).toArray();
  }

  const lifetime = 3 + Math.random() * 10;

  return {
    x: p[0],
    y: p[1],
    z: p[2],
    vx: v[0],
    vy: v[1],
    vz: v[2],
    ax: a[0],
    ay: a[1],
    az: a[2],
    type,
    lifetime,
    remaining: lifetime,
  };
};

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
  rV3.randomDirection().setLength(0.05);
  particle.x += rV3.x;
  particle.y += rV3.y;
  particle.z += rV3.z;

  particle.remaining -= dt;
};

const rV3 = new THREE.Vector3();
