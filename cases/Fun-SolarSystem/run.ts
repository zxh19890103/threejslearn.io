/**
 * Generated Automatically At Mon Feb 17 2025 01:11:45 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

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

__config__.camFv = 145;
__config__.camPos = [0, 1, 8];

__main__ = async (
  s: THREE.Scene,
  c: THREE.PerspectiveCamera,
  r: THREE.WebGLRenderer
) => {
  // your code
  const solarSysDat = await fetch("./solar.json").then((r) => r.json());

  const planets = solarSysDat.planets
    .map((inf: any) => {
      if (inf.name === "Earth") {
        const planet = new Planet(inf);
        s.add(planet);
        return planet;
      }
      return null;
    })
    .filter(Boolean) as Planet[];

  __add_nextframe_fn__((s, c, r, dt) => {
    const delta = dt * 100000; // 10ms = 1s
    // for (const planet of planets) planet.move(delta);
  });

  __3__.ambLight(0xffffff, 0.3);
  __3__.ptLight(0xffffff, 1, 50000, 0.001);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

class Planet extends THREE.Line {
  public readonly _speed: THREE.Vector3 = new THREE.Vector3();
  public readonly _position: THREE.Vector3 = new THREE.Vector3();
  private _positionArr: number[] = [];

  constructor(private inf: PlanetInfo) {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.LineBasicMaterial({ color: inf.color });

    super(geo, mat);

    this._speed.set(0, inf.speed * SPEEDUNIT, 0);
    this._position.set(inf.distance_from_sun * AU, 0, 0);
  }

  move(dt: number) {
    reduceSpatialChangeAfter(this, dt);

    this._positionArr.push(
      this._position.x / AU,
      this._position.y / AU,
      this._position.z / AU
    );

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this._positionArr), 3)
    );
  }
}

type PlanetInfo = {
  name: string;
  /** "3.301 x 10^23 kg"  */
  mass: string;
  /**  km */
  speed: number;
  /** km  */
  diameter: number;
  /** au */
  distance_from_sun: number;
  /** color */
  color: string;
  moons: any[];
};

const MOMENT = 400; // s

const reduceSpatialChangeDurMoment = (planet: Planet) => {
  const { _position, _speed: speed } = planet;

  const farSq = _position.lengthSq();
  const acc = GxSUNMASS / farSq;
  const accV = _sv_.copy(_position).negate().setLength(acc);
  const dP = speed.multiplyScalar(MOMENT);
  const dS = accV.multiplyScalar(MOMENT);

  speed.add(dS);

  dP.add(dS.multiplyScalar(0.5 * MOMENT));
  _position.add(dP);
};

const reduceSpatialChangeAfter = (planet: Planet, after: number) => {
  let steps = Math.ceil(after / MOMENT);
  if (steps < 1) return;
  while (steps--) reduceSpatialChangeDurMoment(planet);
};

const _sv_ = new THREE.Vector3();

const SPEEDUNIT = Math.pow(10, 3); // m/s
const AU = 1.496 * Math.pow(10, 11); // m
const SUNMASS = 1.989 * Math.pow(10, 30); // kg
const G = 6.673 * Math.pow(10, -11);
const GxSUNMASS = 1.989 * 6.673 * Math.pow(10, 19);

// G = 6.67430×10−11
// M = 1.989×10+30
// 1.521 AU