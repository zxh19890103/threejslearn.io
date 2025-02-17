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
  const R = solarSysDat.diameter * diameter_scale / 2;
  __3__.ball([0, 0, 0], R, solarSysDat.color, true);

  const AU = 149597870.7;

  const planets = solarSysDat.planets.map((planet: any) => {
    const ball = __3__.ball(
      [planet.distance_from_sun * AU * diameter_scale, 0, 0],
      planet.diameter * diameter_scale / 2,
      planet.color
    );
    ball.userData = { inf: planet };
    return ball;
  });

  const { sin, cos } = Math;

  let rad = 0;
  __add_nextframe_fn__(() => {
    for (const planet of planets) {
      const r = planet.userData.inf.distance_from_sun;
      planet.position.set(r * cos(rad), r * sin(rad), 0);
    }
    rad += 0.001;
  });

  __3__.ambLight(0xffffff, 0.4);
  __3__.dirLight(0xffffff, 0.7);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
