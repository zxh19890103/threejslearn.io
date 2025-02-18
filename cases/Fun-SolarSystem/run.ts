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

__main__ = async (
  s: THREE.Scene,
  c: THREE.PerspectiveCamera,
  r: THREE.WebGLRenderer
) => {
  // your code
  const solarSysDat = await fetch("./solar.json").then((r) => r.json());

  const diameter_scale = 0.00001;
  const R = (solarSysDat.diameter * diameter_scale) / 2;

  __3__.ball([0, 0, 0], R, solarSysDat.color, true);

  const AU = 149597870.7; // 149597870.7;
  const aFactor = 5.93 * 0.001; // m/s²

  const _s_: THREE.Vector3 = new THREE.Vector3();

  const reduce = (p: THREE.Vector3, s: THREE.Vector3, dt: number) => {
    const D = p.length();

    const ds = _s_
      .copy(p)
      .setLength(D * aFactor)
      .multiplyScalar(dt);

    const dp = _s_
      .copy(s)
      .multiplyScalar(dt)
      .add(_s_.copy(ds).multiplyScalar(0.5 * dt));

    p.add(dp);
    s.add(ds);
  };

  const planets = solarSysDat.planets.map((planet: any) => {
    const far = planet.distance_from_sun * AU * diameter_scale;
    const r = (planet.diameter * 0.01) / 2;
    const ball = __3__.ball([far, 0, 0], r, planet.color, false);
    ball.userData = {
      inf: planet,
      sunfar: far,
      s: new THREE.Vector3(0, planet.speed, 0),
    };
    console.log(`${planet.name}`, far, r);
    return ball;
  });

  __add_nextframe_fn__((s, c, r, dt) => {
    const delta = dt * 900;
    for (const planet of planets) {
      reduce(planet.position, planet.userData.s, delta);
    }
  });

  __3__.ambLight(0xffffff, 0.3);
  __3__.ptLight(0xffffff, 1, 50000, 0.001);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
