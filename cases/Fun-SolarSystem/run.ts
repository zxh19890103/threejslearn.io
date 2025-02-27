/**
 * Generated Automatically At Mon Feb 17 2025 01:11:45 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/addons/renderers/CSS2DRenderer.js";
import {
  BODY_BOOTSTRAP_STATE,
  BOOTSTRAP_STATE,
  toThreeJSCSMat,
} from "./jpl.js";
import { Bodies13, BodyInfo } from "./planets.js";
import {
  AU,
  BUFFER_MOMENT,
  BUFFER_SIZE,
  CAMERA_POSITION_Y,
  CIRCLE_RAD,
  G,
  MOMENT,
  RAD_PER_DEGREE,
  ROTATION_SCALE,
  SECONDS_IN_A_DAY,
  setConst,
  ZERO_ACC,
} from "./constants.js";
import { tformat } from "./utils.js";

type RegressedState = 1 | 2 | 3 | 4;

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
    moment,
    bufferSize,
    hideMoonLabels,
    hidePlanetLabels,
    camViewField,
    tracingX,
    tracingAlt,
    tracingLat,
    tracingLng,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__config__.camFv = 120;
__config__.camPos = [0, CAMERA_POSITION_Y, 0];

__main__ = async (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  __info__(
    markdown.toHTML(
      `
### Solar System 3D Simulation

I created this [project](https://solar.zhangxinghai.cn) many years ago, inspired by my passion for data, computing, and physics. My goal was to see if Newton’s theories were truly accurate in predicting the motion of celestial bodies.

To do this, I used real data from [NASA’s JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) and computed the positions and velocities of planets based on Newton’s law of gravity. The results were nearly accurate.

However, there’s a catch. While the formula works well, it's simply a mathematical result derived from years of data collection. It doesn't explain why things happen this way. In fact, we may never fully know.

For this project, I’ve included all the planets (including Pluto), many comets, and the moons of each planet. The initial state (position and velocity) of each planet was obtained from JPL Horizons on June 28, 2021.

If the observed data wasn’t available, I placed the bodies at their aphelion and calculated their velocities using **Kepler’s Third Law** and **Newton’s Law of Universal Gravitation**.
`
    )
  );

  renderer.setPixelRatio(window.devicePixelRatio);

  const PgAppDiv = renderer.domElement.parentElement as HTMLDivElement;

  const css2drenderer = new CSS2DRenderer({});
  css2drenderer.setSize(PgAppDiv.clientWidth, PgAppDiv.clientHeight);

  __renderers__.push(css2drenderer);

  css2drenderer.domElement.style.position = "absolute";
  css2drenderer.domElement.style.top = "0px";
  css2drenderer.domElement.style.pointerEvents = "none";
  PgAppDiv.appendChild(css2drenderer.domElement);

  const dispalyCanvas = document.createElement("div");
  dispalyCanvas.style.cssText = `z-index: 100;padding: 1em; border: 1px solid #fff; border-radius: 6px 8px; font-size: 12px; position: absolute; left: 0; bottom: 0; width: fit-content; height: fit-content; min-height: 60px; background: rgba(0,0,0, 0.78); color: #fff`;
  document.querySelector("#SectionPgAppWrap").appendChild(dispalyCanvas);

  const dispalyCanvasLegend = document.createElement("div");
  const _color_ = new THREE.Color();
  dispalyCanvasLegend.innerHTML = `
  <ul style="list-style: none">
  ${Object.entries(Bodies13)
    .map(([name, inf]) => {
      if (name === "Sun") return null;
      _color_.set(inf.color[0], inf.color[1], inf.color[2]);
      return `<li style="padding-left: 2px; border-left: 5px solid ${_color_.getStyle()}; margin: 0; font-size: ${
        inf.ref === Bodies13.Sun ? "1em" : "0.7em"
      }">${name}</li>`;
    })
    .filter(Boolean)
    .join("")}
  </ul>
  `;
  dispalyCanvas.appendChild(dispalyCanvasLegend);

  const dispalyCanvasDataDiv = document.createElement("div");
  dispalyCanvas.appendChild(dispalyCanvasDataDiv);

  const objectsKvs: Record<string, Planet> = {};
  let Sun: Planet;

  let T = new Date("2021-06-30").getTime();
  let t = performance.now();

  const Inf2Planet = new Map<BodyInfo, Planet>();

  const planets = Object.entries(Bodies13)
    .map(([name, inf]) => {
      const planet = new Planet(inf, BOOTSTRAP_STATE[name] ?? null, Inf2Planet);
      world.add(planet);

      planet.name = name;

      objectsKvs[name] = planet;
      Inf2Planet.set(inf, planet);

      if (name === "Sun") {
        Sun = planet;
        return null;
      }

      return planet;
    })
    .filter(Boolean);

  // build connections.
  planets.forEach((body) => {
    body.gravityCaringObjects.push(Sun);
    if (body.inf.ref && body.inf.ref !== Bodies13.Sun) {
      const moon = body;
      const planet = Inf2Planet.get(body.inf.ref);

      planet.gravityCaringObjects.push(moon);
      moon.gravityCaringObjects.push(planet);
    }
  });

  let trottle = 0;
  let controlByUser = true;

  __add_nextframe_fn__(() => {
    const now = performance.now();

    const deltaT = now - t;

    for (const planet of planets) planet.beforeComputeMove();

    let n = bufferSize;
    while (n-- && n > 0) {
      for (const planet of planets) planet.computeMove(1);
    }

    for (const planet of planets) {
      planet.move();

      const distToCam = camera.position.distanceTo(planet.Pt.position);

      if (distToCam < planet.inf.radius * 100) {
        planet.Pt.visible = false;
        planet.Ball.visible = true;
      } else {
        planet.Pt.visible = true;
        planet.Ball.visible = false;
      }

      planet.rotate();
    }

    if (tracingX && tracingX !== "Sun") {
      const planet = objectsKvs[tracingX];

      camera.position.copy(
        planet.transformLatLngToWorldPosition(
          tracingLat,
          tracingLng,
          tracingAlt
        )
      );
      camera.lookAt(planet.Pt.position);

      controlByUser = false;
    } else {
      if (!controlByUser) {
        camera.position.set(...__config__.camPos);
        camera.lookAt(Sun.Pt.position);
        controlByUser = true;
      }
    }

    t = now;
    T += BUFFER_MOMENT * 1000;

    trottle += deltaT;

    // per sec
    if (trottle > 1000) {
      trottle = 0;
      _t_.setTime(T);

      dispalyCanvasDataDiv.innerHTML = `
        camera far from sun: ${(camera.position.length() / AU).toFixed(2)} au;
        <br />
        reality/screen: 1s = ${tformat((BUFFER_MOMENT * 1000) / deltaT)};
        <br/>
        screen date: ${_t_.toLocaleDateString()}
      `;
    }

    css2drenderer.render(world, camera);
  });

  const _t_ = new Date();

  __3__.ambLight(0xffffff, 0.1);
  __3__.ptLight(0xffffff, 1, AU * 100, 0.000001);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__only__.moment = () => {
    setConst("MOMENT", moment);
  };
  __updateTHREEJs__only__.bufferSize = () => {
    setConst("BUFFER_SIZE", bufferSize);
  };
  __updateTHREEJs__only__.hideMoonLabels = () => {
    css2drenderer.domElement.classList.toggle("hideMoonLabels");
  };
  __updateTHREEJs__only__.hidePlanetLabels = () => {
    css2drenderer.domElement.classList.toggle("hidePlanetLabels");
  };

  __updateTHREEJs__only__.camViewField = () => {
    camera.fov = camViewField;
    camera.updateProjectionMatrix();
  };

  __updateTHREEJs__ = (k: string, val: any) => {};
};

const textureLoader = new THREE.TextureLoader(new THREE.LoadingManager());

class Planet extends THREE.Object3D {
  public readonly _speed: THREE.Vector3 = new THREE.Vector3();
  public readonly _position: THREE.Vector3 = new THREE.Vector3();

  readonly planetsQuery: Map<BodyInfo, Planet>;
  readonly gravityCaringObjects: Planet[] = [];
  readonly _coordinates: THREE.Vector3Tuple;
  readonly _velocity: THREE.Vector3Tuple;

  private _positionHistory: number[] = [];

  readonly isSun: boolean;
  readonly isMoon: boolean;
  readonly Line: THREE.Line;
  readonly Pt: THREE.Points;
  readonly Ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;

  private readonly initialCoordinates: THREE.Vector2 = new THREE.Vector2();
  private readonly currentCoordinates: THREE.Vector2 = new THREE.Vector2();
  readonly nextCoordinates: THREE.Vector3Tuple = [0, 0, 0];
  readonly nextVelocity: THREE.Vector3Tuple = [0, 0, 0];

  constructor(
    readonly inf: BodyInfo,
    private iniState: BODY_BOOTSTRAP_STATE,
    query: Map<BodyInfo, Planet>
  ) {
    const color = new THREE.Color(inf.color[0], inf.color[1], inf.color[2]);

    super();

    this.planetsQuery = query;
    this.isSun = inf.name === "Sun";
    this.isMoon = Boolean(inf.ref) && inf.ref !== Bodies13.Sun;

    let position: THREE.Vector3;
    let velocity: THREE.Vector3;

    if (iniState) {
      position = new THREE.Vector3(...iniState.position).applyMatrix4(
        toThreeJSCSMat
      );
      velocity = new THREE.Vector3(
        ...iniState.velocity.map((x) => x / SECONDS_IN_A_DAY)
      ).applyMatrix4(toThreeJSCSMat);
    } else {
      const speed = Math.sqrt((G * inf.ref.mass) / inf.aphelion);

      position = new THREE.Vector3(inf.aphelion, 0, 0);
      velocity = new THREE.Vector3(0, speed, 0);

      const matrix = new THREE.Matrix4().makeRotationX(
        0.5 * Math.PI + inf.inclination
      );

      velocity.applyMatrix4(matrix);
      position.applyMatrix4(matrix);

      if (this.isMoon) {
        const planet = this.planetsQuery.get(this.inf.ref);

        velocity.applyEuler(planet.Ball.rotation);
        position.add(planet.Ball.position);

        velocity.add(new THREE.Vector3(...planet._velocity));
      }
    }

    this._coordinates = position.toArray();
    this._velocity = velocity.toArray();

    this.initialCoordinates.set(this._coordinates[0], this._coordinates[1]);
    this.currentCoordinates.copy(this.initialCoordinates);

    this.position.set(0, 0, 0);

    // tracing
    {
      const geo = new THREE.BufferGeometry();
      const mat = new THREE.LineBasicMaterial({
        color,
        fog: true,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = true;
      line.frustumCulled = false;
      this.add(line);

      this.Line = line;
    }

    // as point
    {
      this.Pt = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),
        new THREE.PointsMaterial({
          sizeAttenuation: false,
          size: 4,
          color,
        })
      );

      this.Pt.position.set(...this._coordinates);

      this.add(this.Pt);
      this.Pt.visible = true;
    }

    // as ball
    {
      const geometry = new THREE.SphereGeometry(inf.radius, 60, 60);

      const material = new THREE.MeshPhongMaterial({
        color,
        wireframe: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      if (this.inf.axialTilt) {
        mesh.rotateX(this.inf.axialTilt);
      }

      this.Ball = mesh;

      this.add(this.Ball);
      this.Ball.visible = false;
      this.Ball.position.set(...this._coordinates);

      __3__.crs(this.Ball, this.inf.radius * 1.2);

      if (this.inf.map) {
        textureLoader.load(
          `https://solar.zhangxinghai.cn${this.inf.map}`,
          (texture) => {
            this.Ball.material.color.set(0xffffff);
            this.Ball.material.map = texture;
            this.Ball.material.needsUpdate = true;
          }
        );
      }
    }

    // text
    {
      const textElement = document.createElement("div");
      textElement.className = `label body ${this.isMoon ? "moon" : "planet"}`;
      textElement.style.position = "absolute";
      textElement.style.top = this.isMoon ? "14px" : "-14px";
      textElement.style.color = color.getStyle();
      textElement.style.fontSize = this.isMoon ? "11px" : "12px";
      textElement.innerText = this.isMoon
        ? `${this.inf.name}(${this.inf.ref.name}'s moon)`
        : this.inf.name;

      const textObject = new CSS2DObject(textElement);
      textObject.position.set(...this._coordinates);
      this.add(textObject);
      this.Label = textObject;
    }
  }

  readonly Label: CSS2DObject;

  transformLatLngToWorldPosition(lat: number, lng: number, alt: number) {
    const { radius } = this.inf;

    const latRad = RAD_PER_DEGREE * lat;
    const lngRad = RAD_PER_DEGREE * lng;

    const R_s = radius + alt;

    const x = R_s * Math.cos(latRad) * Math.cos(lngRad);
    const y = R_s * Math.cos(latRad) * Math.sin(lngRad);
    const z = R_s * Math.sin(latRad);

    const coord = new THREE.Vector3(x, z, y).applyEuler(this.Ball.rotation);

    const [x0, y0, z0] = this._coordinates;

    return { x: x0 + coord.x, y: y0 + coord.y, z: z0 + coord.z };
  }

  rotate() {
    if (!this.Ball.visible) return;
    const r = BUFFER_MOMENT / (this.inf.rotationPeriod * SECONDS_IN_A_DAY);
    this.Ball.rotation.y += CIRCLE_RAD * r * ROTATION_SCALE;
  }

  move() {
    this._coordinates[0] = this.nextCoordinates[0];
    this._coordinates[1] = this.nextCoordinates[1];
    this._coordinates[2] = this.nextCoordinates[2];

    this._velocity[0] = this.nextVelocity[0];
    this._velocity[1] = this.nextVelocity[1];
    this._velocity[2] = this.nextVelocity[2];

    this.Pt.position.set(...this._coordinates);
    this.Ball.position.set(...this._coordinates);
    this.Label.position.set(...this._coordinates);

    this._positionHistory.push(...this._coordinates);
    this.currentCoordinates.x = this._coordinates[0];
    this.currentCoordinates.y = this._coordinates[1];

    if (this.regressedState === 4) {
      this._positionHistory.shift();
      this._positionHistory.shift();
      this._positionHistory.shift();
    } else {
      this.checkRegressedAngle();
    }

    this.Line.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this._positionHistory), 3)
    );
  }

  beforeComputeMove() {
    this.nextCoordinates[0] = this._coordinates[0];
    this.nextCoordinates[1] = this._coordinates[1];
    this.nextCoordinates[2] = this._coordinates[2];

    this.nextVelocity[0] = this._velocity[0];
    this.nextVelocity[1] = this._velocity[1];
    this.nextVelocity[2] = this._velocity[2];
  }

  computeMove(n: number) {
    this.buffer(n, this.nextCoordinates, this.nextVelocity);
  }

  private regressedState: RegressedState = 1;

  private checkRegressedAngle() {
    const angle = this.initialCoordinates.angleTo(this.currentCoordinates);

    switch (this.regressedState) {
      case 1: {
        if (angle > Math.PI * 0.5) {
          this.regressedState = 2;
        }
        break;
      }
      case 2: {
        if (angle < Math.PI * 0.5) {
          this.regressedState = 3;
        }
        break;
      }
      case 3: {
        this.regressedState = 4;
        break;
      }
    }
  }

  private buffer(
    N: number,
    coordinates$: THREE.Vector3Tuple,
    velocity$: THREE.Vector3Tuple
  ) {
    let n = N;

    while (n--) {
      const a = computeAccOfCelestialBody(this);
      if (a === null) {
        velocity$[0] = 0;
        velocity$[1] = 0;
        velocity$[2] = 0;
        break;
      }
      const dv = [a[0] * MOMENT, a[1] * MOMENT, a[2] * MOMENT];
      const [vx, vy, vz] = velocity$;
      const [dvx, dvy, dvz] = dv;
      const ds = [
        vx * MOMENT + 0.5 * dvx * MOMENT,
        vy * MOMENT + 0.5 * dvy * MOMENT,
        vz * MOMENT + 0.5 * dvz * MOMENT,
      ];

      velocity$[0] += dv[0];
      velocity$[1] += dv[1];
      velocity$[2] += dv[2];

      coordinates$[0] += ds[0];
      coordinates$[1] += ds[1];
      coordinates$[2] += ds[2];
    }
  }
}

export function computeAccBy(
  position0: THREE.Vector3Tuple,
  position: THREE.Vector3Tuple,
  mass: number,
  radius: number
) {
  if (mass === 0) return ZERO_ACC;

  const [x, y, z] = position0;
  const [rx, ry, rz] = position;
  const dx = rx - x,
    dy = ry - y,
    dz = rz - z;
  const r2 = dx * dx + dy * dy + dz * dz;
  const length = Math.sqrt(r2);

  if (radius > length) return ZERO_ACC;

  const scalar = (G * mass) / r2;
  const factor = scalar / length;
  return [dx * factor, dy * factor, dz * factor];
}

function computeAccOfCelestialBody(self: Planet) {
  const sum: THREE.Vector3Tuple = [0, 0, 0];
  const pos = self.nextCoordinates;
  for (const obj of self.gravityCaringObjects) {
    const a = computeAccBy(
      pos,
      obj.nextCoordinates,
      obj.inf.mass,
      obj.inf.radius
    );
    sum[0] += a[0];
    sum[1] += a[1];
    sum[2] += a[2];
  }
  return sum;
}

let tracingX: string = null;
let tracingLat: number = 0;
let tracingLng: number = 0;
let tracingAlt: number = 3;
let moment: number = MOMENT;
let bufferSize: number = BUFFER_SIZE;
let hideMoonLabels: boolean = false;
let hidePlanetLabels: boolean = false;
let camViewField: number = __config__.camFv;

__defineControl__(
  "camViewField",
  "range",
  camViewField,
  __defineControl__.rint(45, 160)
);
__defineControl__("hideMoonLabels", "bit", hideMoonLabels);
__defineControl__("hidePlanetLabels", "bit", hidePlanetLabels);

__defineControl__("tracingX", "enum", tracingX, {
  valueType: "string",
  options: Object.entries(Bodies13)
    .filter((x) => {
      return x[1].ref == Bodies13.Sun || x[0] === "Sun";
    })
    .map((n) => ({ value: n[0], label: n[0] })),
});

__defineControl__(
  "tracingAlt",
  "range",
  tracingAlt,
  __defineControl__.rfloat(3, 1000)
);

__defineControl__(
  "tracingLat",
  "range",
  tracingLat,
  __defineControl__.rfloat(-90, 90)
);

__defineControl__(
  "tracingLng",
  "range",
  tracingLng,
  __defineControl__.rfloat(0, 180)
);

__defineControl__("moment", "range", moment, __defineControl__.rint(10, 1000));
__defineControl__(
  "bufferSize",
  "range",
  bufferSize,
  __defineControl__.rint(1, 4000)
);
