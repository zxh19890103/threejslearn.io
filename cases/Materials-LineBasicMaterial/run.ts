/**
 * Generated Automatically At Sat Feb 08 2025 11:56:23 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";


let lineColor: number = 0xff0000;
let linewidth = 100;

//#region reactive
// __dev__();

__defineControl__("lineColor", "color", lineColor);
__defineControl__("linewidth", "number", linewidth);

__updateControlsDOM__ = () => {
  __renderControls__({
    lineColor,
    linewidth,
  });
};

__onControlsDOMChanged__iter__ = (exp) => {
  eval(exp);
};
//#endregion

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  const geometry = new THREE.BufferGeometry(); // Radius 1, 32 widthSegments, 32 heightSegments

  geometry.setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 10, 0),
    new THREE.Vector3(10, 0, 0),
  ]);

  const material = new THREE.LineBasicMaterial({
    color: lineColor,
    linewidth: linewidth,
  });
  const line = new THREE.Line(geometry, material);
  s.add(line);

  c.position.z = 10;

  __updateTHREEJs__ = () => {
    material.color.set(lineColor);
    material.linewidth = linewidth;
  };
};
