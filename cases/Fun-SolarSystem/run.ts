/**
 * Generated Automatically At Mon Feb 17 2025 01:11:45 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { mergeAttributes } from "three/addons/utils/BufferGeometryUtils.js";
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
import { createDialog } from "../dialog.js";
import {
  checkRegress,
  resetRegress,
  shouldSaveTrajectoryPosition,
  type MovingBody,
} from "../Fun-EarthSatellites/gravity.js";

//#region reactive
__dev__();

__updateControlsDOM__ = () => {
  __renderControls__({
    moment,
    bufferSize,
    hideMoonLabels,
    hidePlanetLabels,
    camFov,
    camFov2,
    camFov3,
    startTracingX,
    tracingX,
    tracingAlt,
    tracingLat,
    tracingLng,
    tracingLookat,
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
  __usePanel__({
    placement: "top",
    width: 450,
    lines: 4,
  });

  __info__(
    `
### Solar System 3D Simulation

I created this [project](https://solar.zhangxinghai.cn) many years ago, inspired by my passion for data, computing, and physics. My goal was to see if Newton’s theories were truly accurate in predicting the motion of celestial bodies.

To do this, I used real data from [NASA’s JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) and computed the positions and velocities of planets based on Newton’s law of gravity. The results were nearly accurate.

However, there’s a catch. While the formula works well, it's simply a mathematical result derived from years of data collection. It doesn't explain why things happen this way. In fact, we may never fully know.

For this project, I’ve included all the planets (including Pluto), many comets, and the moons of each planet. The initial state (position and velocity) of each planet was obtained from JPL Horizons on June 28, 2021.

If the observed data wasn’t available, I placed the bodies at their aphelion and calculated their velocities using **Kepler’s Third Law** and **Newton’s Law of Universal Gravitation**.

### Core APIs used

- \`CSS2Renderer\` for labels
- \`THREE.Points\` for bodies too far to see
- \`THREE.Line\` for bodies' moving track
- \`THREE.Mesh<THREE.SphereGeometry>\` for bodies close enough to see
- \`THREE.Vector3\` for velocity, coordinates, force
- \`THREE.Matrix4\` for transform JPL data to ThreeJs system
- \`THREE.Texture\` for bodies surfaces
`
  );

  const PgAppDiv = renderer.domElement.parentElement as HTMLDivElement;

  const css2drenderer = new CSS2DRenderer({});
  css2drenderer.setSize(PgAppDiv.clientWidth, PgAppDiv.clientHeight);

  __renderers__.push(css2drenderer);

  css2drenderer.domElement.style.position = "absolute";
  css2drenderer.domElement.style.top = "0px";
  css2drenderer.domElement.style.pointerEvents = "none";
  PgAppDiv.appendChild(css2drenderer.domElement);

  const dispalyCanvasLegend = document.createElement("div");
  dispalyCanvasLegend.className = "panel panel-left-bottom";
  dispalyCanvasLegend.style.cssText = `font-size: 12px; width: fit-content; height: fit-content; min-height: 60px;`;
  document.querySelector("#SectionPgAppWrap").appendChild(dispalyCanvasLegend);

  dispalyCanvasLegend.onclick = (event) => {
    const a = event.target as HTMLElement;
    if (a.tagName === "A") {
      const name = a.innerText;
      const body = Bodies13[name];
      createDialog({
        title: name,
        content:
          `
        <pre>
Units: 
- space: 1,000 km
- mass: 10^24 kg
- angle: rad
- period: 1 earth's year
        </pre>
        <div style="width: 520px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;">` +
          Object.entries(body)
            .map(([key, value]) => {
              if (["ref", "map", "rings"].includes(key)) return null;
              let str = `<div style="width: 30%;padding: .1em">${key}:</div>`;
              if (key === "color") {
                _color_.set(value[0], value[1], value[2]);
                str += ` <div style="width: 70%; padding: .1em"><span style="border-radius: 2px 3px; border: 1px solid #666; padding: 0 .5em; background:${_color_.getStyle()}">#</span></div>`;
              } else if (key === "avatar") {
                str += `<div style="width: 70%; padding: .1em"><img style="border-radius: 2px 3px; border: 1px solid #666;  width: 45px; vertical-align:  middle" src="https://solar.zhangxinghai.cn${value}" /></div>`;
              } else {
                str += `<div style="width: 70%; padding: .1em">${value}</div>`;
              }
              return str;
            })
            .filter(Boolean)
            .join("") +
          "</div>",
      });
    } else if (a.tagName === "BUTTON") {
      const name = a.dataset.name;
      const mapSrc = a.dataset.src;
      const mapIndex = a.dataset.index;

      const bo = objectsKvs[name];

      (a as HTMLButtonElement).disabled = true;

      bo.loadTexture(mapSrc).then(
        () => {
          a.parentElement.setAttribute("data-selected", mapIndex);
          (a as HTMLButtonElement).disabled = false;
        },
        () => {
          (a as HTMLButtonElement).disabled = false;
        }
      );
    }
  };

  const _color_ = new THREE.Color();
  dispalyCanvasLegend.innerHTML = `
  <ul style="list-style: none">
  ${Object.entries(Bodies13)
    .map(([name, inf]) => {
      if (name === "Sun") return null;
      _color_.set(inf.color[0], inf.color[1], inf.color[2]);
      return `<li style="padding-left: 2px; border-left: 5px solid ${_color_.getStyle()}; margin: 0; font-size: ${
        inf.ref === Bodies13.Sun ? "1em" : "0.7em"
      }">
        <a style="color: #fff" href="javascript:void(0);">${name}</a>
        <span class="textures" data-selected="0">
        ${
          inf.maps
            ? Object.entries(inf.maps)
                .map((ent, i) => {
                  return `<button class="texture index-${i}" data-index="${i}" data-name="${name}" data-src="${ent[1]}">${ent[0]}</button>`;
                })
                .join("")
            : ""
        }
            </span>
      </li>`;
    })
    .filter(Boolean)
    .join("")}
  </ul>
  `;

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

  //#region points
  let PointsCloudMove: VoidFunction = null;

  {
    Planet.Points = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: 0xffffff,
        vertexColors: true,
        sizeAttenuation: false,
        size: 4,
      })
    );

    PointsCloudMove = () => {
      Planet.Points.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array(planets.flatMap((x) => x._coordinates)),
          3
        )
      );
    };

    Planet.Points.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array(planets.flatMap((x) => x._color)),
        3
      )
    );

    world.add(Planet.Points);
  }

  //#endregion

  //#region lines

  let LinesMove: VoidFunction = null;

  {
    Planet.Lines = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        linewidth: 4,
        vertexColors: true,
        transparent: true,
        linecap: "round",
        linejoin: "round",
      })
    );
    Planet.Lines.frustumCulled = false;
    world.add(Planet.Lines);

    LinesMove = () => {
      Planet.Lines.geometry.setAttribute(
        "position",
        mergeAttributes(planets.map((p) => p.attribute_positions))
      );

      __usePanel_write__(
        3,
        `trajectories sampling count: ${Planet.Lines.geometry.attributes.position.count}`
      );

      Planet.Lines.geometry.setAttribute(
        "color",
        mergeAttributes(planets.map((p) => p.attribute_colors))
      );
    };
  }

  //#endregion

  let throttle = 0;
  let isCamControlledByUser = true;

  const _sV3_ = new THREE.Vector3();

  /**
   * @todo
   */
  const isBallVisibleOnScreen = (planet: Planet, camWp: THREE.Vector3) => {
    const ball = planet.Ball;
    const dist = ball.position.distanceTo(camWp);
    const dimeter = planet.inf.radius * 2;
    const fa = (dimeter / dist) * __3__.rad2deg;
    const r = fa / camFov;
    return r > 0.001;
  };

  __add_nextframe_fn__(() => {
    const now = performance.now();

    const deltaT = now - t;

    for (const planet of planets) {
      planet.beforeComputeMove();
    }

    let n = bufferSize;
    while (n-- && n > 0) {
      for (const planet of planets) {
        buffer(planet, 1, planet.nextCoordinates, planet.nextVelocity);
      }
    }

    camera.getWorldPosition(_sV3_);

    for (const planet of planets) {
      planet._cameraReadonlyWorldPosition = _sV3_;
      planet.move();
      planet.rotate();
    }

    LinesMove();
    PointsCloudMove();

    if (tracingX) {
      if (startTracingX) {
        const planet = objectsKvs[tracingX];

        planet.Ball.add(camera);

        const localCoords = planet.transformLatLngToLocalPosition(
          tracingLat,
          tracingLng,
          tracingAlt
        );
        camera.position.copy(localCoords);

        if (tracingLookat) {
          const lookat = objectsKvs[tracingLookat];
          camera.lookAt(lookat.Ball.position);
        } else {
          camera.lookAt(planet.Ball.position);
        }

        isCamControlledByUser = false;
      } else {
        if (!isCamControlledByUser) {
          camera.removeFromParent();
          camera.position.copy(camPosBeforeTracing);
          camera.quaternion.copy(camLookatBeforeTracing);
          isCamControlledByUser = true;
        }
      }
    } else {
      if (!isCamControlledByUser) {
        camera.removeFromParent();
        camera.position.set(...__config__.camPos);
        camera.lookAt(Sun.Ball.position);
        isCamControlledByUser = true;
      }
    }

    for (const planet of planets) {
      planet.Ball.visible = isBallVisibleOnScreen(planet, _sV3_);
    }

    t = now;
    T += BUFFER_MOMENT * 1000;

    throttle += deltaT;

    // per sec
    if (throttle > 1000) {
      throttle = 0;
      _t_.setTime(T);

      __usePanel_write__(
        0,
        `camera far from sun: ${(
          camera.getWorldPosition(_sV3_).length() / AU
        ).toFixed(2)} au;`
      );
      __usePanel_write__(
        1,
        `reality/screen: 1s = ${tformat((BUFFER_MOMENT * 1000) / deltaT)};`
      );
      __usePanel_write__(2, `screen date: ${_t_.toLocaleDateString()}`);
    }

    css2drenderer.render(world, camera);
  });

  const _t_ = new Date();

  __3__.ambLight(0xffffff, 0.1);
  __3__.ptLight(0xffffff, 1, AU * 100, 0.000001);

  __updateTHREEJs__many__.moment_bufferSize = (k) => {
    if (k === "moment") setConst("MOMENT", moment);
    else if (k === "bufferSize") setConst("BUFFER_SIZE", bufferSize);

    for (const planet of planets) {
      resetRegress(planet);
    }
  };

  __updateTHREEJs__only__.hideMoonLabels = () => {
    css2drenderer.domElement.classList.toggle("hideMoonLabels");
  };
  __updateTHREEJs__only__.hidePlanetLabels = () => {
    css2drenderer.domElement.classList.toggle("hidePlanetLabels");
  };

  __updateTHREEJs__only__.camFov = () => {
    camera.fov = camFov;
    camera.updateProjectionMatrix();
  };

  __updateTHREEJs__only__.camFov2 = () => {
    camera.fov = camFov2;
    camera.updateProjectionMatrix();
  };

  __updateTHREEJs__only__.camFov3 = () => {
    camera.fov = camFov3;
    camera.updateProjectionMatrix();
  };

  const camPosBeforeTracing: THREE.Vector3 = new THREE.Vector3();
  const camLookatBeforeTracing: THREE.Quaternion = new THREE.Quaternion();

  __updateTHREEJs__only__.startTracingX = () => {
    if (startTracingX) {
      camPosBeforeTracing.copy(camera.position);
      camLookatBeforeTracing.copy(camera.quaternion);
    }
  };

  __updateTHREEJs__ = (k: string, val: any) => {};
};

const textureLoader = new THREE.TextureLoader(new THREE.LoadingManager());

class Planet extends THREE.Object3D implements MovingBody {
  _angleScanned: number = 0;
  _regressed: boolean = false;
  trajectory: number[] = [];

  readonly planetsQuery: Map<BodyInfo, Planet>;
  readonly gravityCaringObjects: Planet[] = [];

  readonly _color: THREE.Vector3Tuple;
  readonly _coordinates: THREE.Vector3Tuple;
  readonly _velocity: THREE.Vector3Tuple;

  readonly isSun: boolean;
  readonly isMoon: boolean;
  readonly isComet: boolean;

  readonly LoadingIndicator: CSS2DObject;
  readonly Label: CSS2DObject;
  readonly Avatar: CSS2DObject;
  readonly Ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;

  readonly nextCoordinates: THREE.Vector3Tuple = [0, 0, 0];
  readonly nextVelocity: THREE.Vector3Tuple = [0, 0, 0];
  readonly bodyColor: THREE.Color;

  static Points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  static Lines: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;

  constructor(
    readonly inf: BodyInfo,
    readonly iniState: BODY_BOOTSTRAP_STATE,
    query: Map<BodyInfo, Planet>
  ) {
    super();

    const color = new THREE.Color(inf.color[0], inf.color[1], inf.color[2]);
    this.bodyColor = color;
    this._color = [color.r, color.g, color.b];
    this.planetsQuery = query;
    this.isSun = inf.name === "Sun";
    this.isMoon = Boolean(inf.ref) && inf.ref !== Bodies13.Sun;
    this.isComet = inf.isComet === true;

    inf.rotationPeriod = this.calculateOrbitalPeriod();

    this.rotationDelta =
      BUFFER_MOMENT / (inf.rotationPeriod * SECONDS_IN_A_DAY);
    this.rotationDelta *= CIRCLE_RAD * ROTATION_SCALE;

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
      const speed = Math.sqrt(
        G * inf.ref.mass * (2 / inf.aphelion - 1 / inf.semiMajorAxis)
      );

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

    this.position.set(0, 0, 0);

    this.LoadingIndicator = this.createLoadingIndicator();

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
        this.loadTexture(this.inf.map);
      }
    }

    // text
    this.Label = this.createLabel();
    this.add(this.Label);
  }

  private createLabel() {
    const textElement = document.createElement("div");
    textElement.className = `label body ${this.isMoon ? "moon" : "planet"}`;
    textElement.style.position = "absolute";
    textElement.style.top = this.isMoon ? "14px" : "-14px";
    textElement.style.color = this.bodyColor.getStyle();
    textElement.style.fontSize = this.isMoon ? "11px" : "12px";
    textElement.innerText = this.isMoon
      ? `${this.inf.name}(${this.inf.ref.name}'s moon)`
      : this.inf.name;

    const textObject = new CSS2DObject(textElement);
    textObject.position.set(...this._coordinates);
    return textObject;
  }

  private createLoadingIndicator() {
    const textElement = document.createElement("div");
    textElement.className = `label`;
    textElement.style.position = "absolute";
    textElement.style.top = "0";
    textElement.style.opacity = "0.78";
    textElement.style.color = this.bodyColor.getStyle();
    textElement.style.fontSize = "13px";
    textElement.innerText = "loading texture...";

    const textObject = new CSS2DObject(textElement);
    textObject.position.set(...this._coordinates);

    return textObject;
  }

  public loadTexture(mapSrc: string) {
    return new Promise((done, fail) => {
      this.add(this.LoadingIndicator);

      textureLoader.load(
        mapSrc.startsWith("https://")
          ? mapSrc
          : `https://solar.zhangxinghai.cn${mapSrc}`,
        (texture) => {
          this.Ball.material.color.set(0xffffff);
          this.Ball.material.map = texture;
          this.Ball.material.needsUpdate = true;

          this.remove(this.LoadingIndicator);

          done(1);
        },
        (event) => {
          if (!event.lengthComputable) return;
          this.LoadingIndicator.element.innerText = `${event.loaded}/${event.total}`;
        },
        () => {
          this.LoadingIndicator.element.innerText = "Err.";
          this.remove(this.LoadingIndicator);

          fail(2);
        }
      );
    });
  }

  private calculateOrbitalPeriod() {
    const periodInSeconds =
      2 *
      Math.PI *
      Math.sqrt(Math.pow(this.inf.semiMajorAxis, 3) / (G * Bodies13.Sun.mass));
    const periodInYears = periodInSeconds / (60 * 60 * 24 * 365.25);

    return periodInYears;
  }

  transformLatLngToLocalPosition(lat: number, lng: number, alt: number) {
    const { radius } = this.inf;

    const latRad = RAD_PER_DEGREE * lat;
    const lngRad = RAD_PER_DEGREE * lng;

    const R_s = radius + alt;

    const x = R_s * Math.cos(latRad) * Math.cos(lngRad);
    const y = R_s * Math.cos(latRad) * Math.sin(lngRad);
    const z = R_s * Math.sin(latRad);

    return new THREE.Vector3(x, z, y);
  }

  transformLatLngToWorldPosition(lat: number, lng: number, alt: number) {
    const localCoords = this.transformLatLngToLocalPosition(lat, lng, alt);
    localCoords.applyQuaternion(this.Ball.quaternion);

    const [x0, y0, z0] = this._coordinates;

    localCoords.x += x0;
    localCoords.y += y0;
    localCoords.z += z0;

    return localCoords;
  }

  private readonly rotationDelta: number = 0;

  rotate() {
    if (!this.Ball.visible) return;
    this.Ball.rotation.y += this.rotationDelta;
  }

  private _lastSavedCoordinates: Vec3 = null;
  /**
   * don't modify it!
   */
  public _cameraReadonlyWorldPosition: THREE.Vector3 = null;

  move() {
    if (!this._regressed) {
      checkRegress(this);
    }

    this._coordinates[0] = this.nextCoordinates[0];
    this._coordinates[1] = this.nextCoordinates[1];
    this._coordinates[2] = this.nextCoordinates[2];

    this._velocity[0] = this.nextVelocity[0];
    this._velocity[1] = this.nextVelocity[1];
    this._velocity[2] = this.nextVelocity[2];

    this.Ball.position.set(...this._coordinates);
    this.Label.position.set(...this._coordinates);
    this.LoadingIndicator.position.set(...this._coordinates);

    if (
      shouldSaveTrajectoryPosition(
        this._coordinates,
        this._lastSavedCoordinates,
        this._cameraReadonlyWorldPosition
      )
    ) {
      if (this._regressed) {
        this.trajectory.shift();
        this.trajectory.shift();
        this.trajectory.shift();
      }

      this.trajectory.push(...this._coordinates);
      this._lastSavedCoordinates = [...this._coordinates];
    }

    this.setTrajectoryAttributes();
  }

  attribute_positions: THREE.BufferAttribute;
  attribute_colors: THREE.BufferAttribute;

  private setTrajectoryAttributes() {
    const trajectory = this.trajectory;
    const n = trajectory.length;
    const n1 = n - 1;
    const size = n / 3;

    let pts: number[] = [];
    const colors: number[] = [];

    pts.push(trajectory[0], trajectory[1], trajectory[2]);
    colors.push(0, 0, 0, 0);

    pts = pts.concat(trajectory);
    for (let i = 0; i < size; i++) {
      colors.push(...this._color, Math.pow(i / n, 0.7));
    }

    pts.push(trajectory[n1 - 2], trajectory[n1 - 1], trajectory[n1]);
    colors.push(0, 0, 0, 0);

    this.attribute_positions = new THREE.BufferAttribute(
      new Float32Array(pts),
      3
    );

    this.attribute_colors = new THREE.BufferAttribute(
      new Float32Array(colors),
      4
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
}

function buffer(
  body: Planet,
  N: number,
  coordinates$: THREE.Vector3Tuple,
  velocity$: THREE.Vector3Tuple
) {
  let n = N;

  while (n--) {
    const a = computeAccOfCelestialBody(body);
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

function computeAccBy(
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
let startTracingX: boolean = false;
let tracingLat: number = 0;
let tracingLng: number = 0;
let tracingAlt: number = 3;
let tracingLookat: string = null;
let moment: number = MOMENT;
let bufferSize: number = BUFFER_SIZE;
let hideMoonLabels: boolean = false;
let hidePlanetLabels: boolean = false;
let camFov: number = __config__.camFv;
let camFov2: number = 1;
let camFov3: number = 0.1;

__defineControl__("camFov", "range", camFov, {
  ...__defineControl__.rint(1, 160),
  label: "fov",
});

__defineControl__("camFov2", "range", camFov2, {
  ...__defineControl__.rfloat(0.1, 1),
  label: "fov (for huge distance)",
});

__defineControl__("camFov3", "range", camFov3, {
  ...__defineControl__.rfloat(0.01, 0.1),
  label: "fov (for extremely huge distance)",
});

__defineControl__("hideMoonLabels", "bit", hideMoonLabels, {
  label: "hide moon's labels",
});
__defineControl__("hidePlanetLabels", "bit", hidePlanetLabels, {
  label: "hide planet's labels",
});

__defineControl__("tracingX", "enum", tracingX, {
  valueType: "string",
  label: "following [x]",
  help: `Select a celestial body, and the camera will prepare to follow it. Please check for the 'following' button.`,
  helpWidth: 120,
  options: Object.entries(Bodies13)
    .filter((x) => {
      return x[1].ref == Bodies13.Sun || x[0] === "Sun";
    })
    .map((n) => ({ value: n[0], label: n[0] })),
});

__defineControl__("startTracingX", "bit", startTracingX, {
  label: "following",
});

__defineControl__("tracingAlt", "range", tracingAlt, {
  ...__defineControl__.rfloat(3, 1000),
  label: "following position (alt)",
});

__defineControl__("tracingLat", "range", tracingLat, {
  ...__defineControl__.rfloat(-90, 90),
  label: "following position (lat)",
});

__defineControl__("tracingLng", "range", tracingLng, {
  ...__defineControl__.rfloat(0, 180),
  label: "following position (lon)",
});

__defineControl__("tracingLookat", "enum", tracingLookat, {
  valueType: "string",
  label: "following look at",
  options: Object.entries(Bodies13).map((n) => ({ value: n[0], label: n[0] })),
});

__defineControl__("moment", "range", moment, {
  ...__defineControl__.rint(1, 1000),
  label: "unit(s)",
  help: `
  It is the smallest time interval (in seconds) used to calculate the next position and velocity of celestial bodies.
  The larger the value, the less accurate the calculations will be.
  `,
  helpWidth: 360,
});
__defineControl__("bufferSize", "range", bufferSize, {
  ...__defineControl__.rint(1, 500),
  label: "calculation times",
  help: `
    Number of calculations per frame
    `,
});
