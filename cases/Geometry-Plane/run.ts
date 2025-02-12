/**
 * Generated Automatically At Sun Feb 09 2025 15:31:33 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let side: THREE.Side = THREE.DoubleSide;
let opacity = 1;
let transparent = false;
let colorWrite = false;
let depthWrite = false;

//#region reactive
// __dev__();

__defineControl__("call", "btn", 0);

__defineControl__<THREE.Side>("side", "enum", side, {
  valueType: "number",
  options: [
    { label: "FrontSide", value: THREE.FrontSide },
    { label: "BackSide", value: THREE.BackSide },
    { label: "DoubleSide", value: THREE.DoubleSide },
  ],
});

__defineControl__("opacity", "range", opacity, {
  min: 0,
  max: 1,
});

__defineControl__("transparent", "bit", transparent);
__defineControl__("colorWrite", "bit", colorWrite);
__defineControl__("depthWrite", "bit", depthWrite);

__updateControlsDOM__ = () => {
  __renderControls__({
    side,
    opacity,
    transparent,
    colorWrite,
    depthWrite,
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

  const planeGeo = new THREE.PlaneGeometry(10, 10, 10);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0xfe9109,
    side: side,
    opacity: 0.5,
    colorWrite: colorWrite,
    transparent: transparent,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  s.add(plane);

  __3_objects__.dirLight(0xffffff, 0.9).helper(10, 0xfe9010);
  __3_objects__.ball([10, 0, 0], 10);

  __updateTHREEJs__only__.side = () => {
    planeMat.side = side;
  };

  __updateTHREEJs__after__ = () => {
    planeMat.needsUpdate = true;
  };

  __updateTHREEJs__invoke__.call = () => {
    s.rotateOnAxis(__3__.vec(0, 1, 1), __3__.deg2rad * 23);
  };

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!

    planeMat.setValues({
      side,
      opacity,
      transparent,
      colorWrite,
      depthWrite,
    });
  };
};
