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
// __config__.background = 0x000000;

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
    fluid.boundary.rotate([0, 0, 1], 6);
    fluid.each((r: Vec3, v: Vec3) => {
      fluid.boundary.affectAfterRotation(r, v);
    });
  };

  __updateTHREEJs__invoke__.move = () => {
    fluid.boundary.move([0, -0.3, 0]);
    fluid.each((r: Vec3, v: Vec3) => {
      fluid.boundary.affectAfterMove(r, v);
    });
  };

  __3__.dirLight(0xffffff, 2);
  __3__.ambLight(0xffffff, 0.6);

  const fluid = new ParticleCloud();
  fluid.buildBoundary([0, 0, 0], 10, 10, 10);

  const iter = () => {
    // console.time("computeRho");
    fluid.computeRhoV2();
    // console.timeEnd("computeRho");
    // fluid.computeForces();
    // console.time("computeForcesV2");
    fluid.computeForcesV2();
    // console.timeEnd("computeForcesV2");
    // fluid.move();
    // console.time("moveV2");
    fluid.moveV2();
    // console.timeEnd("moveV2");

    // fluid.render();
    // fluid.renderV2();
    fluid.renderMesh();
    // fluid.renderMarchingCubes();
  };

  world.add(fluid.mesh, fluid.boundary.mesh);
};

__defineControl__("start", "btn", "1-");
__defineControl__("rotate", "btn", "2-");
__defineControl__("move", "btn", "3-");
