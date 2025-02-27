/**
 * Generated Automatically At Thu Feb 27 2025 21:11:58 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let enableGrid = false;
let enableAxes = false;

//#region reactive
// __dev__();
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

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  // your code

  const V3 = new THREE.Vector3(0, 1, 0);

  const Q = new THREE.Quaternion(1, 1, 1, 0.3);
  Q.normalize();

  const shape = new THREE.BoxGeometry(3, 2, 6, 3, 3, 2);
  const mats = [
    new THREE.MeshBasicMaterial({ color: 0xffe190 }),
    new THREE.MeshBasicMaterial({ color: 0xef9108 }),
    new THREE.MeshBasicMaterial({ color: 0x219f56 }),
    new THREE.MeshBasicMaterial({ color: 0xa10f3e }),
    new THREE.MeshBasicMaterial({ color: 0xae91e0 }),
    new THREE.MeshBasicMaterial({ color: 0xafdff1 }),
  ];
  const box = new THREE.Mesh(shape, mats);

  // s.add(box);

  __3__.crs(box, 5);

  const arrow = new THREE.ArrowHelper(V3, new THREE.Vector3(), 6);
  s.add(arrow);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__invoke__.apply = () => {
    V3.applyQuaternion(Q);
    arrow.setDirection(V3);
  };

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
    Q.set(Qx, Qy, Qz, Qw);
    Q.normalize();
  };
};

let Qx = 1;
let Qy = 1;
let Qz = 1;
let Qw = 1;

__defineControl__("Qx", "range", Qx, __defineControl__.rfloat(0, 1));
__defineControl__("Qy", "range", Qy, __defineControl__.rfloat(0, 1));
__defineControl__("Qz", "range", Qz, __defineControl__.rfloat(0, 1));
__defineControl__("Qw", "range", Qw, __defineControl__.rfloat(0, 1));

__defineControl__("apply", "btn", "Q");
