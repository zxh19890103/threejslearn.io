/**
 * Generated Automatically At Wed Feb 12 2025 17:57:56 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let enableGrid = false;
let enableAxes = false;

let color = 0x888888;
let roughness = 0.8;
let metalness = 1;
let emissive: THREE.ColorRepresentation = 0xffffff;

//#region reactive
// __dev__();
__defineControl__("enableGrid", "bit", enableGrid);
__defineControl__("enableAxes", "bit", enableAxes);

__defineControl__("roughness", "range", roughness, { min: 0, max: 1 });
__defineControl__("metalness", "range", metalness, { min: 0, max: 1 });
__defineControl__("emissive", "color", emissive);
__defineControl__("color", "color", color);

__updateControlsDOM__ = () => {
  __renderControls__({
    roughness,
    metalness,
    emissive,
    color,
    enableAxes,
    enableGrid,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => {
    __3__.grid(val);
  };

  __updateTHREEJs__only__.enableAxes = (val) => {
    __3__.axes(val);
  };

  const ball = new THREE.SphereGeometry(1, 30, 30);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x930910,
    roughness,
    metalness,
    emissive,
  });
  s.add(new THREE.Mesh(ball, mat));

  __3__.dirLight(0xffffff, 0.7);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
    mat.roughness = roughness;
    mat.metalness = metalness;
    mat.emissive.set(emissive);
    mat.color.set(color);
  };

  __updateTHREEJs__after__ = () => {
    mat.needsUpdate = true;
  };
};
