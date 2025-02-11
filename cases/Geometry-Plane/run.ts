/**
 * Generated Automatically At Sun Feb 09 2025 15:31:33 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let side = THREE.DoubleSide;

//#region reactive
// __dev__();
__defineControl__("side", "enum", side, {
  options: [
    { label: "FrontSide", value: THREE.FrontSide },
    { label: "BackSide", value: THREE.BackSide },
    { label: "DoubleSide", value: THREE.DoubleSide },
  ],
});

__updateControlsDOM__ = () => {
  __renderControls__({
    side,
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
  const planeMat = new THREE.MeshBasicMaterial({ color: 0xfe9109, side: side });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  s.add(plane);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
    planeMat.side = side;
    planeMat.needsUpdate = true;
  };
};
