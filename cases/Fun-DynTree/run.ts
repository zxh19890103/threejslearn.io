/**
 * Generated Automatically At Fri Apr 17 2026 00:12:50 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { DynTree } from "./tree.js";
import { DynVegetation } from "./vegetation.js";

let enableGrid = true;
let enableAxes = true;

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
__config__.camFar = 300;
__config__.camNear = 0.1;
__config__.camPos = [10, 10, 10];

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) => {
  __usePanel__({
    placement: "left-bottom",
    width: 300,
    lines: 3,
  });

  __3__.grid(true);
  __3__.axes(true);

  const vegetation = new DynVegetation({});
  world.add(vegetation);

  // const tree = new DynTree({
  //   leafRadius: 0.4,
  //   leafBumpFrequency: 1.5,
  //   leafBumpStrength: 0.2,
  //   minLeafDepth: 2,
  //   maxDepth: 3,
  //   leafBlobDetail: 1,
  // });

  // world.add(tree);

  __add_nextframe_fn__(() => {
    // Per-geometry vertex/triangle count
    // console.log(`tris: ${renderer.info.render.triangles}`);
    __usePanel_write__(
      0,
      `tris: ${renderer.info.render.triangles.toLocaleString()}`,
    );
  }, 1);

  __3__.ambLight(0xffffff, 0.5);
  __3__.dirLight(0xffffff, 1, [0, 1, 0]);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
