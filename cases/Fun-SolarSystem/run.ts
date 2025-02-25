/**
 * Generated Automatically At Mon Feb 17 2025 01:11:45 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
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
  SECONDS_IN_A_DAY,
  setConst,
  ZERO_ACC,
} from "./constants.js";

let enableGrid = false;
let enableAxes = false;

//#region reactive
// __dev__();
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

__config__.camFv = 120;
__config__.camPos = [0, CAMERA_POSITION_Y, 0];

__main__ = async (
  s: THREE.Scene,
  c: THREE.PerspectiveCamera,
  r: THREE.WebGLRenderer
) => {
  const dispalyCanvas = document.createElement("div");
  dispalyCanvas.style.cssText = `padding: 1em; border-radius: 6px 8px; font-size: 12px; position: absolute; left: 0; bottom: 0; width: fit-content; height: fit-content; min-height: 60px; background: rgba(255,255,255, 0.78); color: #000`;
  document.querySelector("#SectionPgAppWrap").appendChild(dispalyCanvas);

  const dispalyCanvasLegend = document.createElement("div");
  const _color_ = new THREE.Color();
  dispalyCanvasLegend.innerHTML = `
  <ul style="list-style: none">
  ${Object.entries(Bodies13).map(([name, inf]) => {
    _color_.set(inf.color[0], inf.color[1], inf.color[2]);
    return `<li style="padding-left: 2px; border-left: 5px solid ${_color_.getStyle()}; margin: 0">${name}</li>`;
  }).join('')}
  </ul>
  `;
  dispalyCanvas.appendChild(dispalyCanvasLegend);

  const dispalyCanvasDataDiv = document.createElement("div");
  dispalyCanvas.appendChild(dispalyCanvasDataDiv);

  const objectsKvs: Record<string, Planet> = {};
  let Sun: Planet;

  let T = new Date("2021-06-30").getTime();
  let t = performance.now();

  const planets = Object.entries(Bodies13)
    .map(([name, inf]) => {
      if (!BOOTSTRAP_STATE[name]) return null;

      const planet = new Planet(inf, BOOTSTRAP_STATE[name]);
      s.add(planet);

      objectsKvs[name] = planet;

      if (name === "Sun") {
        Sun = planet;
        return null;
      }

      return planet;
    })
    .filter(Boolean);

  planets.forEach((planet) => {
    planet.gravityCaringObjects.push(Sun);
  });

  let trottle = 0;
  let controlByUser = true;

  __add_nextframe_fn__(() => {
    const now = performance.now();

    const deltaT = now - t;

    for (const planet of planets) {
      const distToCam = c.position.distanceTo(planet.P.position);

      if (distToCam < planet.inf.radius * 10) {
        planet.P.visible = false;
        planet.Ball.visible = true;
      } else {
        planet.P.visible = true;
        planet.Ball.visible = false;
      }

      planet.rotate();
      planet.move();
    }

    if (tracingX && tracingX !== "Sun") {
      const planet = objectsKvs[tracingX];
      c.position.copy(
        planet.transformLatLngToWorldPosition(0, 0, planet.inf.radius * 2.6)
      );
      c.lookAt(planet.P.position);

      controlByUser = false;
    } else {
      if (!controlByUser) {
        c.position.set(...__config__.camPos);
        c.lookAt(Sun.P.position);
        controlByUser = true;
      }
    }

    t = now;
    T += BUFFER_MOMENT * 1000;

    trottle++;

    if (trottle === 100) {
      trottle = 0;
      _t_.setTime(T);

      dispalyCanvasDataDiv.innerHTML = `
        1s = ${((BUFFER_MOMENT * 1000) / deltaT).toFixed(0)}s;
        <br/>
        ${_t_.toLocaleDateString()}
      `;
    }
  });

  const _t_ = new Date();

  __3__.ambLight(0xffffff, 0.4);
  __3__.ptLight(0xffffff, 1, AU * 100, 0.001);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__only__.moment = () => {
    setConst("MOMENT", moment);
  };
  __updateTHREEJs__only__.bufferSize = () => {
    setConst("BUFFER_SIZE", bufferSize);
  };

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

const textureLoader = new THREE.TextureLoader(new THREE.LoadingManager());

class Planet extends THREE.Line {
  public readonly _speed: THREE.Vector3 = new THREE.Vector3();
  public readonly _position: THREE.Vector3 = new THREE.Vector3();

  readonly gravityCaringObjects: Planet[] = [];
  readonly _coordinates: THREE.Vector3Tuple;
  readonly _velocity: THREE.Vector3Tuple;

  private _positionArr: number[] = [];

  readonly P: THREE.Points;
  readonly Ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;

  readonly regressedRad: number;

  constructor(readonly inf: BodyInfo, private iniState: BODY_BOOTSTRAP_STATE) {
    const color = new THREE.Color(inf.color[0], inf.color[1], inf.color[2]);

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.LineDashedMaterial({
      color,
      dashSize: 3,
      gapSize: 9,
    });

    super(geo, mat);

    const position = new THREE.Vector3(...iniState.position).applyMatrix4(
      toThreeJSCSMat
    );
    const velocity = new THREE.Vector3(
      ...iniState.velocity.map((x) => x / SECONDS_IN_A_DAY)
    ).applyMatrix4(toThreeJSCSMat);

    this._coordinates = position.toArray();
    this._velocity = velocity.toArray();

    this.position.set(0, 0, 0);

    {
      this.P = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),
        new THREE.PointsMaterial({
          sizeAttenuation: false,
          size: 4,
          color,
        })
      );

      this.P.position.set(...this._coordinates);

      this.add(this.P);
      this.P.visible = true;
    }

    {
      const geometry = new THREE.SphereGeometry(inf.radius, 60, 60);

      geometry.rotateY(this.inf.axialTilt);

      const material = new THREE.MeshPhongMaterial({
        color,
        wireframe: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotateX(inf.axialTilt + inf.inclination);

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

    this.regressedRad = Math.atan2(this._coordinates[1], this._coordinates[0]);
  }

  transformLatLngToWorldPosition(lat: number, lng: number, alt: number) {
    const { radius } = this.inf;

    const latRad = RAD_PER_DEGREE * lat;
    const lngRad = RAD_PER_DEGREE * lng;

    const R_s = radius + alt;

    const x = R_s * Math.cos(latRad) * Math.cos(lngRad);
    const y = R_s * Math.cos(latRad) * Math.sin(lngRad);
    const z = R_s * Math.sin(latRad);

    const [x0, y0, z0] = this._coordinates;

    return { x: x0 + x, y: y0 + y, z: z0 + z };
  }

  rotate() {
    if (!this.Ball.visible) return;
    const r = BUFFER_MOMENT / (this.inf.rotationPeriod * SECONDS_IN_A_DAY);
    this.Ball.rotation.y += CIRCLE_RAD * r;
  }

  private regressingState = 1;

  move() {
    this.buffer(BUFFER_SIZE);

    this._positionArr.push(...this._coordinates);

    this.P.position.set(...this._coordinates);
    this.Ball.position.set(...this._coordinates);

    switch (this.regressingState) {
      case 1: {
        const diffRad = Math.abs(
          Math.atan2(this._coordinates[1], this._coordinates[0]) -
            this.regressedRad
        );
        if (diffRad > Math.PI) {
          this.regressingState = 2;
        }
        break;
      }
      case 2: {
        const diffRad = Math.abs(
          Math.atan2(this._coordinates[1], this._coordinates[0]) -
            this.regressedRad
        );
        if (diffRad < 0.01) {
          this.regressingState = 3;
        }
        break;
      }
      case 3: {
        this._positionArr.shift();
        this._positionArr.shift();
        this._positionArr.shift();
        break;
      }
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this._positionArr), 3)
    );
  }

  private buffer(N = 1) {
    let n = N;
    const posiArr = this._coordinates;
    const veloArr = this._velocity;

    while (n--) {
      const a = computeAccOfCelestialBody(this);
      if (a === null) {
        veloArr[0] = 0;
        veloArr[1] = 0;
        veloArr[2] = 0;
        break;
      }
      const dv = [a[0] * MOMENT, a[1] * MOMENT, a[2] * MOMENT];
      const [vx, vy, vz] = veloArr;
      const [dvx, dvy, dvz] = dv;
      const ds = [
        vx * MOMENT + 0.5 * dvx * MOMENT,
        vy * MOMENT + 0.5 * dvy * MOMENT,
        vz * MOMENT + 0.5 * dvz * MOMENT,
      ];

      veloArr[0] += dv[0];
      veloArr[1] += dv[1];
      veloArr[2] += dv[2];

      posiArr[0] += ds[0];
      posiArr[1] += ds[1];
      posiArr[2] += ds[2];
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
  const pos = self._coordinates;
  for (const obj of self.gravityCaringObjects) {
    const a = computeAccBy(pos, obj._coordinates, obj.inf.mass, obj.inf.radius);
    sum[0] += a[0];
    sum[1] += a[1];
    sum[2] += a[2];
  }
  return sum;
}

let tracingX: string = null;
let moment: number = MOMENT;
let bufferSize: number = BUFFER_SIZE;

__defineControl__("tracingX", "enum", tracingX, {
  valueType: "string",
  options: Object.keys(Bodies13).map((n) => ({ value: n, label: n })),
});

__defineControl__("moment", "range", moment, __defineControl__.rint(10, 1000));
__defineControl__(
  "bufferSize",
  "range",
  bufferSize,
  __defineControl__.rint(1, 1000)
);
