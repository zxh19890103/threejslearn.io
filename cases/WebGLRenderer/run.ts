/**
 * Generated Automatically At Sun Feb 09 2025 18:20:17 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let clearAlpha = 1;

//#region reactive
// __dev__();
__defineControl__("clearAlpha", "range", clearAlpha, {
  min: 0,
  max: 1,
});

__updateControlsDOM__ = () => {
  __renderControls__({
    // key: val
    clearAlpha,
  });
};

__onControlsDOMChanged__iter__ = (exp) => {
  eval(exp);
};
//#endregion

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  // your code

  __3_objects__.ball([0, 0, 0], 3);
  __3_objects__.dirLight(0xffffff, 0.9)

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
    r.setClearAlpha(clearAlpha);
    r.setViewport(100, 100, 100, 100);
  };
};
