/**
 * Generated Automatically At Sun Feb 09 2025 15:32:12 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

//#region reactive
// __dev__();
// __defineControl__("[key]", "[type]", [val]);

__updateControlsDOM__ = () => {
  __renderControls__({
    // key: val
  });
};

__onControlsDOMChanged__iter__ = (exp) => {
  eval(exp);
};
//#endregion

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  // your code
  __3__.grid3d(4, 4);
  __3__.axes();

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
