/**
 * Generated Automatically At Tue Mar 04 2025 16:40:01 GMT+0800 (China Standard Time);
 */

import {
  CelestialBody,
  checkRegress,
  cpCurrentToNext,
  cpNextToCurrent,
  createCelestialBody,
  doGravityBufferCompution,
  GRAVITY_AU,
  GravityCaringBody,
  MovingBody,
  shouldSaveTrajectoryPosition,
} from "../Fun-EarthSatellites/gravity.js";
import { Bodies13, BodyInfo } from "../Fun-SolarSystem/planets.js";
import {
  __useCSS2Renderer__,
  createCss2dObject,
  createCss2dObjectFor,
} from "../css2r.js";
import * as THREE from "three";
import { parseJPLHorizonData } from "../Fun-EarthSatellites/utils.js";

let enableGrid = false;
let enableAxes = false;

//#region reactive
__dev__();

__updateControlsDOM__ = () => {
  __renderControls__({
    enableAxes,
    enableGrid,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__config__.camPos = [0, Bodies13.Halley.peribelion * GRAVITY_AU * 0.01, 0];
__config__.camNear = 0.1;
__config__.camFar = 1e10;
__config__.camFov = 1e1;

let gravityDurUnit = 1e2;
let gravityComputationTimesPf = 1e2;
// computed!
let computationDurPf = gravityDurUnit * gravityComputationTimesPf;

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  r: THREE.WebGLRenderer
) => {
  __contact__();
  __info__(`
### **Comet: A Celestial Wanderer**  

A **comet** is a small celestial body in the Solar System, primarily composed of **ice, dust, and rocky materials**. These objects originate from the **Kuiper Belt** or the distant **Oort Cloud**. When a comet approaches the Sun, the heat causes its frozen components to **sublimate**, releasing gas and dust that form a glowing **coma** and a long **tail**, making it a spectacular sight in the night sky.  

### **Structure of a Comet**  
1. **Nucleus**  
   - The solid core, made up of ice (such as water ice and carbon dioxide ice), rock, and organic compounds.  

2. **Coma**  
   - A glowing cloud of gas and dust that surrounds the nucleus when the comet heats up. Its diameter can reach thousands of kilometers.  

3. **Tail**  
   - As the Sun's radiation and solar wind push material away from the comet, it develops two distinct tails:  
     - **Ion Tail:** Composed of ionized gases and always points directly away from the Sun due to solar wind.  
     - **Dust Tail:** Consists of small dust particles that curve along the comet’s orbital path.  

### **Famous Comets**  
- **Halley’s Comet (1P/Halley)**  
  - The most famous short-period comet, visible from Earth approximately every **76 years**. It was last seen in **1986** and will return in **2061**.  

- **Hale-Bopp (C/1995 O1)**  
  - A bright, long-period comet that was visible in **1997** for several months, becoming one of the most observed comets in history.  

- **Neowise (C/2020 F3)**  
  - A stunning comet visible to the naked eye in **2020**, featuring a long and bright dust tail.
    `);

  __useCSS2Renderer__();

  const sun = new THREE.Object3D();
  sun.position.set(0, 0, 0);
  createCss2dObjectFor(sun, "sun", { offset: 0, color: "#fe0190" });
  world.add(sun);

  const sunBody: GravityCaringBody = {
    inf: Bodies13.Sun,
    nextCoordinates: [0, 0, 0],
  };

  let earthBody: CelestialBody = null;
  let earthBody__move: () => void;

  {
    const points = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 5,
        sizeAttenuation: false,
      })
    );

    world.add(points);

    earthBody = createCelestialBody({
      inf: Bodies13.Earth,
      ...parseJPLHorizonData(` X =-1.115821888129376E+08 Y = 9.657174753907035E+07 Z = 3.146453982427716E+03
   VX=-1.999010382077296E+01 VY=-2.264326601796598E+01 VZ=-7.741886134198239E-04
   LT= 4.922380759058320E+02 RG= 1.475692626969999E+08 RR= 2.970792584818871E-01`),
      GCO: [sunBody],
    });

    const earthLabel = createCss2dObject("earth");
    world.add(earthLabel);

    earthBody__move = () => {
      cpCurrentToNext(earthBody);

      doGravityBufferCompution(
        earthBody,
        gravityComputationTimesPf,
        earthBody.nextCoordinates,
        earthBody.nextVelocity,
        gravityDurUnit
      );

      cpNextToCurrent(earthBody);

      earthLabel.position.x = earthBody._coordinates[0];
      earthLabel.position.y = earthBody._coordinates[1];
      earthLabel.position.z = earthBody._coordinates[2];

      points.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array([0, 0, 0, ...earthBody._coordinates]),
          3
        )
      );
    };
  }

  const comets: Comet[] = [];

  {
    const comet = new Comet(
      Bodies13.Halley,
      `
      X = 5.483117528350090E+07 Y =-6.383814844043256E+07 Z = 2.560193649440147E+07
   VX=-4.143134760867270E+01 VY=-3.493537149764291E+01 VZ=-5.570818295056732E+00
   LT= 2.934079939087061E+02 RG= 8.796150369074002E+07 RR=-2.093458842335387E+00
      `
    );
    comet.gravityCaringObjects = [sunBody];
    world.add(comet);
    world.add(comet.trajectoryUI);
    comets.push(comet);
    createCss2dObjectFor(comet, "1P/Halley");
  }

  {
    const comet = new Comet(
      Bodies13.HaleBopp,
      `X = 7.263046473470275E+08 Y =-3.446868487209121E+09 Z =-1.936900949342286E+09
   VX=-1.217629657745159E+00 VY= 5.979316393711298E+00 VZ= 5.060311572764439E+00
   LT= 1.340911320297751E+04 RG= 4.019951006720882E+09 RR=-7.785072397309539E+00`
    );
    comet.gravityCaringObjects = [sunBody];
    world.add(comet);
    world.add(comet.trajectoryUI);
    comets.push(comet);
    createCss2dObjectFor(comet, "HaleBopp");
  }

  {
    const comet = new Comet(
      Bodies13.Tempel1,
      `X =-2.349080083811602E+08 Y =-2.035593654763069E+08 Z = 3.183558847381380E+07
 VX= 1.220698134655384E+01 VY=-1.773335193700652E+01 VZ= 1.154443732325729E+00
 LT= 1.042256724545736E+03 RG= 3.124607053185951E+08 RR= 2.493192180387381E+00`
    );
    comet.gravityCaringObjects = [sunBody];
    world.add(comet);
    world.add(comet.trajectoryUI);
    comets.push(comet);
    createCss2dObjectFor(comet, "Tempel 1");
  }

  {
    const comet = new Comet(
      Bodies13.Holmes,
      `X =-1.842446026416576E+08 Y =-2.266772910266535E+08 Z =-3.365589945165545E+06
 VX= 1.612460676420583E+01 VY=-1.099797100953224E+01 VZ=-8.054732704741635E+00
 LT= 9.744411233788381E+02 RG= 2.921300995540231E+08 RR=-1.543054153200037E+00`
    );
    comet.gravityCaringObjects = [sunBody];
    world.add(comet);
    world.add(comet.trajectoryUI);
    comets.push(comet);
    createCss2dObjectFor(comet, "Holmes");
  }

  let lastCamPos: Vec3 = null;

  __add_nextframe_fn__((_1, _2, _3, dt) => {
    earthBody__move();

    if (configurableParams.lookAt) {
      camera.position.x = earthBody._coordinates[0];
      camera.position.y = earthBody._coordinates[1];
      camera.position.z = earthBody._coordinates[2];
    } else {
    }

    for (const comet of comets) {
      comet.move(computationDurPf);
      comet.camPos$ = camera.position;

      if (configurableParams.lookAt === comet.inf.name) {
        camera.lookAt(comet.position);
      }
    }
  });

  __add_nextframe_fn__(() => {
    for (const comet of comets) {
      comet.emitParticle();
    }
  }, 0.1);

  __updateTHREEJs__only__["configurableParams.fov"] = () => {
    camera.fov = configurableParams.fov;
    camera.updateProjectionMatrix();
  };

  __updateTHREEJs__only__["configurableParams.lookAt"] = () => {
    if (configurableParams.lookAt) {
      lastCamPos = camera.position.toArray();
    } else {
      camera.position.set(...lastCamPos);
      camera.lookAt(0, 0, 0);
    }
  };
  __updateTHREEJs__only__["configurableParams.durUnit"] = () => {
    gravityDurUnit = configurableParams.durUnit;
    computationDurPf = gravityDurUnit * gravityComputationTimesPf;
  };
  __updateTHREEJs__only__["configurableParams.computationTimesPf"] = () => {
    gravityComputationTimesPf = configurableParams.computationTimesPf;
    computationDurPf = gravityDurUnit * gravityComputationTimesPf;
  };
};

export class Comet extends THREE.Object3D implements MovingBody {
  public coma: THREE.Points;
  public ionTail: THREE.Points;
  public dustTail: THREE.Points;

  public comaRadius: number;

  _angleScanned?: number;
  _regressed?: boolean;
  _coordinates: Vec3 = [0, 0, 0];
  _velocity: Vec3 = [0, 0, 0];
  gravityCaringObjects: GravityCaringBody[];
  nextCoordinates: THREE.Vector3Tuple = [0, 0, 0];
  nextVelocity: THREE.Vector3Tuple = [0, 0, 0];
  trajectory: number[] = [];
  _lastSavedPos: Vec3 = null;
  camPos$: THREE.Vector3 = null;

  public trajectoryUI: THREE.Line;

  readonly velocityPlane: THREE.Quaternion = new THREE.Quaternion();

  constructor(readonly inf: BodyInfo, jplDataStr: string) {
    super();

    this.build();

    const jplData = parseJPLHorizonData(jplDataStr);

    this._coordinates = jplData.P;
    this._velocity = jplData.V;

    this.add(this.coma, this.ionTail, this.dustTail);
  }

  private build() {
    const R = this.inf.radius;
    this.comaRadius = 1;

    this.coma = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        vertexColors: false,
        transparent: true,
        sizeAttenuation: false,
        size: 4,
        color: ComaColor,
        blending: THREE.AdditiveBlending,
      })
    );
    this.coma.frustumCulled = false;

    this.coma.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([this.comaRadius, 0, 0]), 3)
    );

    this.ionTail = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        vertexColors: true,
        transparent: true,
        sizeAttenuation: false,
        size: 4,
        color: IonTailColor,
        blending: THREE.AdditiveBlending,
      })
    );
    this.ionTail.frustumCulled = false;

    this.dustTail = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        vertexColors: true,
        transparent: true,
        sizeAttenuation: false,
        size: 4,
        color: DustTailColor,
        blending: THREE.AdditiveBlending,
      })
    );
    this.dustTail.frustumCulled = false;

    this.trajectoryUI = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ vertexColors: true, color: 0xffffff })
    );
    this.trajectoryUI.frustumCulled = false;
  }

  private particles: Record<ParticleType, CometParticle[]> = {
    coma: [],
    dust: [],
    ion: [],
  };

  particleNumPerTime = 42;

  public emitParticle() {
    const dist = this.camPos$.distanceTo(this.position);
    let n = Math.ceil(1e9 / (configurableParams.fov * dist));
    while (n--) {
      this.particles.coma.push(new ComaCometParticle(this));
      this.particles.dust.push(new DustTailCometParticle(this));
      this.particles.ion.push(new IonTailCometParticle(this));
    }
  }

  private _move(
    particles: CometParticle[],
    dt: number
  ): [number[], number[], CometParticle[]] {
    const particles_next: CometParticle[] = [];
    const colors: number[] = [];
    const pts: number[] = [];

    for (const particle of particles) {
      particle.move(dt);
      if (particle.remaining > 0) {
        particles_next.push(particle);
        pts.push(particle.x, particle.y, particle.z);

        const ratio = particle.remaining / particle.lifetime;

        const color =
          particle.type === "coma"
            ? ComaColor
            : Color.lerpColors(
                ComaColor,
                particle.type === "dust" ? DustTailColor : IonTailColor,
                1 - ratio
              );
        const alpha = Math.pow(ratio, 0.5);
        colors.push(color.r, color.g, color.b, alpha);
      }
    }

    return [pts, colors, particles_next];
  }

  private _move_ionTail(dt: number) {
    const [pts, colors, particles_] = this._move(this.particles.ion, dt);
    this.particles.ion = particles_;

    this.ionTail.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pts), 3)
    );
    this.ionTail.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(colors), 4)
    );
  }

  private _move_dustTail(dt: number) {
    const [pts, colors, particles_] = this._move(this.particles.dust, dt);
    this.particles.dust = particles_;

    this.dustTail.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pts), 3)
    );
    this.dustTail.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(colors), 4)
    );
  }

  private _move_coma(dt: number) {
    const [pts, _, particles_] = this._move(this.particles.coma, dt);
    this.particles.coma = particles_;

    this.coma.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pts), 3)
    );
  }

  move(dt: number) {
    cpCurrentToNext(this);

    doGravityBufferCompution(
      this,
      gravityComputationTimesPf,
      this.nextCoordinates,
      this.nextVelocity,
      gravityDurUnit
    );

    if (this._regressed) {
    } else {
      checkRegress(this);
    }

    cpNextToCurrent(this);

    if (
      shouldSaveTrajectoryPosition(
        this._coordinates,
        this._lastSavedPos,
        this.camPos$,
        1e-4,
        1e-6
      )
    ) {
      if (this._regressed) {
        this.trajectory.shift();
        this.trajectory.shift();
        this.trajectory.shift();
      }

      this.trajectory.push(...this._coordinates);
      this._lastSavedPos = [...this._coordinates];
    }

    this.position.set(...this._coordinates);

    this.velocityPlane.setFromUnitVectors(
      __3__.aZ,
      v3.set(...this._velocity).normalize()
    );

    this._move_coma(dt);
    this._move_ionTail(dt);
    this._move_dustTail(dt);

    this.trajectoryUI.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.trajectory), 3)
    );

    const trajectoryN = this.trajectory.length / 3;
    const colors: number[] = Array(trajectoryN)
      .fill([1, 1, 1, 1])
      .flatMap((c, i) => {
        c[3] = Math.pow(1 - i / trajectoryN, 0.5);
        return c;
      });

    this.trajectoryUI.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(colors), 4)
    );

    this.ionTail.lookAt(0, 0, 0);
  }
}

abstract class CometParticle {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  vx: number = 0;
  vy: number = 0;
  vz: number = 0;
  /** s */
  lifetime: number = 1;
  /** s */
  remaining: number = 1;

  readonly noiseSize: number = 500;

  constructor(readonly comet: Comet, readonly type: ParticleType = "ion") {
    this.randomXYZ();
    this.lifetime = this.getLifetime();
    this.remaining = this.lifetime;
  }

  getLifetime() {
    return (
      (Math.random() * 20 + 10) * gravityDurUnit * gravityComputationTimesPf
    );
  }

  abstract randomXYZ(): void;
  move(dt: number) {
    this._move(dt);

    const rv = rV3.randomDirection().setLength(this.noiseSize);

    this.x += rv.x;
    this.y += rv.y;
    this.z += rv.z;

    this.remaining -= dt;
  }

  abstract _move(dt: number): void;
}

const fullRad = Math.PI * 2;

class ComaCometParticle extends CometParticle {
  readonly noiseSize = 100;

  constructor(comet: Comet) {
    super(comet, "coma");
  }

  randomXYZ(): void {
    const R = this.comet.comaRadius;
    const xzRad = Math.random() * fullRad;
    const yRad = Math.random() * fullRad;

    this.x = R * Math.cos(yRad) * Math.cos(xzRad);
    this.z = R * Math.cos(yRad) * Math.sin(xzRad);
    this.y = R * Math.sin(yRad);
  }

  _move(dt: number): void {
    const A = 1e-3;
    this.x += -Math.random() * 2 * A + A;
    this.y += -Math.random() * 2 * A + A;
    this.z += -Math.random() * 2 * A + A;
  }
}

class IonTailCometParticle extends CometParticle {
  constructor(comet: Comet) {
    super(comet, "ion");

    this.vx = 0;
    this.vy = 0;

    const far = (Math.random() * 3 + 1) * 1e5;

    this.vz = -far / this.lifetime;
  }

  // along Y-axe
  randomXYZ(): void {
    const a = Math.random() * fullRad;
    const R = this.comet.comaRadius;
    this.x = Math.random() * R * Math.cos(a);
    this.y = Math.random() * R * Math.sin(a);
    this.z = 0;
  }

  _move(dt: number): void {
    this.z += dt * this.vz;
    this.x += dt * this.vx;
    this.y += dt * this.vy;
  }
}

class DustTailCometParticle extends CometParticle {
  constructor(comet: Comet) {
    super(comet, "dust");

    v3.set(this.x, this.y, this.z).applyQuaternion(comet.velocityPlane);

    this.x = v3.x;
    this.y = v3.y;
    this.z = v3.z;

    const far = (Math.random() * 6 + 1) * 1e5;
    const speed = far / this.lifetime;

    v3.set(...comet._velocity)
      .negate()
      .setLength(speed);

    this.vx = v3.x;
    this.vy = v3.y;
    this.vz = v3.z;
  }

  randomXYZ(): void {
    const a = Math.random() * fullRad;
    const R = this.comet.comaRadius;
    this.x = Math.random() * R * Math.cos(a);
    this.y = Math.random() * R * Math.sin(a);
    this.z = 0;
  }

  _move(dt: number): void {
    this.z += dt * this.vz;
    this.x += dt * this.vx;
    this.y += dt * this.vy;
  }
}

type ParticleType = "ion" | "dust" | "coma";

const Color = new THREE.Color();

const ComaColor = new THREE.Color(0xffffff); // 蓝色离子尾
const IonTailColor = new THREE.Color(0x4a90e2); // 蓝色离子尾
const DustTailColor = new THREE.Color(0xffd27f); // 黄色尘埃尾

const v3 = new THREE.Vector3();
const q4 = new THREE.Quaternion();
const rV3 = new THREE.Vector3();

const configurableParams = {
  fov: __config__.camFov,
  lookAt: null,
  durUnit: gravityDurUnit,
  computationTimesPf: gravityComputationTimesPf,
};

__defineControl__("configurableParams.fov", "range", configurableParams.fov, {
  label: "fov",
  ...__defineControl__.rfloat(1, 120),
});

__defineControl__(
  "configurableParams.durUnit",
  "range",
  configurableParams.durUnit,
  {
    label: "computation unit (s)",
    ...__defineControl__.rint(1, 1e2),
    help: `
    The minimum duration to compute the position/velocity of satellites and the Moon. The smaller it is, the more accurate the calculation.
    `,
    helpWidth: 400,
  }
);

__defineControl__(
  "configurableParams.computationTimesPf",
  "range",
  configurableParams.computationTimesPf,
  {
    ...__defineControl__.rint(1, 300),
    label: "computation times per frame",
    help: `
    This can accelerate the movement of satellites and the Moon, including the self-rotation rates of the Earth and Moon. However, if the number of points is large, increasing the duration may cause performance issues.
    `,
    helpWidth: 400,
  }
);

__defineControl__("configurableParams.lookAt", "enum", null, {
  valueType: "string",
  label: "look at",
  helpWidth: 300,
  help: markdown.toHTML(`
select a comet to look at,
and observe the shape of it from the earth. 
    `),
  options: [
    Bodies13.HaleBopp,
    Bodies13.Halley,
    Bodies13.Tempel1,
    Bodies13.Holmes,
  ].map((comet) => {
    return { label: comet.name, value: comet.name };
  }),
});
