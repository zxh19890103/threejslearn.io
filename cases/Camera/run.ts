/**
 * Generated Automatically At Sun Feb 09 2025 14:58:02 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let cFar = 10000;
let cNear = 0.1;
let aspect = 1;
let fov = 45;
let cUpz = 1;

//#region reactive
// __dev__();
__defineControl__("cFar", "number", cFar);
__defineControl__("cNear", "number", cNear);
__defineControl__("aspect", "number", aspect);
__defineControl__("fov", "number", fov);
__defineControl__("cUpz", "number", cUpz);

__updateControlsDOM__ = () => {
  __renderControls__({
    cFar,
    cNear,
    aspect,
    fov,
    cUpz,
  });
};

__onControlsDOMChanged__iter__ = (exp) => {
  eval(exp);
};
//#endregion

__main__ = (
  s: THREE.Scene,
  c: THREE.PerspectiveCamera,
  r: THREE.WebGLRenderer
) => {
  // your code
  __3_objects__.axes();
  __3_objects__.grid();
  __3_objects__.cam();

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
    c.far = cFar;
    c.near = cNear;
    c.aspect = aspect;
    c.fov = fov;
    c.up.set(0, 0, cUpz);

    c.updateProjectionMatrix();
  };
};
