
/**
* Generated Automatically At Tue Apr 01 2025 20:11:13 GMT+0800 (China Standard Time);
*/

import * as THREE from "three";

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

__main__ = (world: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
  // your code

  __updateTHREEJs__only__.enableGrid = val => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = val => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

