/**
 * Generated Automatically At Mon Feb 17 2025 22:39:33 GMT+0800 (China Standard Time);
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

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  const v1 = visibleVector3(s, 0xffffff, 1, 1, 1);
  const v2 = visibleVector3(s, 0xfe9000, 1, 1, 0);

  const v3 = visibleVector3(s, 0x930010, 0, 0, 0);

  __updateTHREEJs__invoke__.add = () => {
    v3.v.copy(v1.v).add(v2.v);
    v3.render();
  };

  __updateTHREEJs__invoke__.sub = () => {
    v3.v.copy(v1.v).sub(v2.v);
    v3.render();
  };

  __updateTHREEJs__invoke__.multiply = () => {
    v3.v.copy(v1.v).multiply(v2.v);
    v3.render();
  };

  __updateTHREEJs__invoke__.cross = () => {
    v3.v.copy(v1.v).cross(v2.v);
    v3.render();
  };

  __updateTHREEJs__invoke__.dot = () => {
    const val = v3.v.copy(v1.v).dot(v2.v);
    alert(`val: ${val}`);
  };

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

__defineControl__("add", "btn", "0");
__defineControl__("sub", "btn", "0");
__defineControl__("multiply", "btn", "0");
__defineControl__("cross", "btn", "0");
__defineControl__("dot", "btn", "0");

const origin = new THREE.Vector3(0, 0, 0);

const visibleVector3 = (
  scene: THREE.Scene,
  color: THREE.ColorRepresentation,
  x: number,
  y: number,
  z: number
) => {
  const v = new THREE.Vector3(x, y, z);

  const arrow = new THREE.ArrowHelper(
    v.normalize(),
    origin,
    v.length(),
    color,
    0.1,
    0.05
  );

  scene.add(arrow);

  return {
    v,
    render: () => {
      arrow.setDirection(v.normalize());
      arrow.setLength(v.length());
    },
  };
};
