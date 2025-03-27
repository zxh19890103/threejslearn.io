/**
 * Generated Automatically At Mon Mar 24 2025 19:28:16 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { ParticleCloud } from "./sph.js";

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

__config__.camPos = [4, 0, 0];

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  const pC = new ParticleCloud();

  pC.buildCube([0, 0, 0], 0.2, 0.2, 0.2);

  world.add(new THREE.Box3Helper(pC.boundary, 0xfe9100));

  console.log(pC.particles.length);

  // world.add(pC.mesh);
  world.add(pC.cloud);

  const loop = () => {
    if (!go) return;
    pC.computeDensity();
    pC.computeForce();
    pC.move();
    pC.render();
  };

  let go = false;

  renderer.domElement.addEventListener("click", () => {
    go = !go;
  });

  __add_nextframe_fn__(loop);

  __contact__();
  __info__(`
This is a failed project!
    `);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
