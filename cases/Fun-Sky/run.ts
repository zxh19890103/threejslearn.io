/**
 * Generated Automatically At Sat Jun 21 2025 19:26:21 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { Sky } from "./sky.js";

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

__config__.background = 0xffffff;

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  let time = 0;

  const sky = new Sky();

  __add_nextframe_fn__((s, c, r, delta) => {
    sky.material.uniforms.time.value = performance.now() * 0.001;
    sky.material.needsUpdate = true;
    time += delta;
  });

  world.add(sky);
};
