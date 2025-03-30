/**
 * Generated Automatically At Fri Mar 28 2025 15:35:14 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { ParticleCloud } from "./sph.js";
import * as config from "./config.js";

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
//#endregion

__config__.camPos = [0, 3, 7];
__config__.background = 0xffffff;

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __usePanel__({
    width: 300,
    lines: 5,
    placement: "top",
  });

  __usePanel_write__(3, `n: ${config.N}`);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__invoke__.move = () => {};

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  let added = false;
  __updateTHREEJs__invoke__.start = () => {
    if (added) return;
    added = true;
    __add_nextframe_fn__(iter);
  };

  __updateTHREEJs__invoke__.rotate = () => {
    fluid.boundary.rotate([0, 1, 1], 10);
    fluid.particles.forEach((i) => {
      fluid.boundary.moveChild(i);
    });
  };

  const fluid = new ParticleCloud();

  /**
   * @todo wrong way
   */
  fluid.buildBoundary([1, 0, 1], 4, 3, 3);

  const iter = () => {
    fluid.computeRho();
    fluid.computeAcc();
    fluid.move();

    fluid.render();
  };

  world.add(
    fluid.cloud,
    fluid.boundary.edge,
    new THREE.Box3Helper(fluid.boundary.model, 0xfe9100)
  );

  // fluid.boundary.edge.updateMatrixWorld();
  // fluid.boundary.edge.updateMatrix();
  // fluid.boundary.edge.updateWorldMatrix(true, true);
};

__defineControl__("start", "btn", "1-");
__defineControl__("rotate", "btn", "2-");
