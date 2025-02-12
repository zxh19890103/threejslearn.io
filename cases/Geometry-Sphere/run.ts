/**
 * Generated Automatically At Sun Feb 09 2025 15:30:41 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let enableGrid = false;
let enableAxes = false;

let radius: number = 4;
let widthSegments: number = 10;
let heightSegments: number = 10;
let phiStart: number = 0;
let phiLength: number = Math.PI * 2;
let thetaStart: number = 0;
let thetaLength: number = Math.PI;

//#region reactive
// __dev__();
__defineControl__("enableGrid", "bit", enableGrid);
__defineControl__("enableAxes", "bit", enableAxes);

__defineControl__("radius", "range", radius, { min: 0, max: 30 });
__defineControl__("widthSegments", "range", widthSegments, {
  min: 2,
  max: 10,
  valueType: "int",
});
__defineControl__("heightSegments", "range", heightSegments, {
  min: 2,
  max: 10,
  valueType: "int",
});
__defineControl__("phiStart", "range", phiStart, {
  min: 0,
  max: Math.PI * 2,
  valueType: "number",
});
__defineControl__("phiLength", "range", phiLength, {
  min: 0,
  max: Math.PI * 2,
  valueType: "number",
});
__defineControl__("thetaStart", "range", thetaStart, {
  min: 0,
  max: Math.PI,
  valueType: "number",
});
__defineControl__("thetaLength", "range", thetaLength, {
  min: 0,
  max: Math.PI,
  valueType: "number",
});

__updateControlsDOM__ = () => {
  __renderControls__({
    enableGrid,
    enableAxes,
    radius,
    widthSegments,
    heightSegments,
    phiStart,
    phiLength,
    thetaStart,
    thetaLength,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__main__ = (
  s: THREE.Scene,
  c: THREE.PerspectiveCamera,
  r: THREE.WebGLRenderer
) => {
  // your code
  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  let ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> = null;

  const material = new THREE.MeshBasicMaterial({
    color: 0xed99e9,
    wireframe: true,
  });

  const create = () => {
    ball && s.remove(ball);
    const ballGeo = new THREE.SphereGeometry(
      radius,
      widthSegments,
      heightSegments,
      phiStart,
      phiLength,
      thetaStart,
      thetaLength
    );
    ball = new THREE.Mesh(ballGeo, material);
    __3__.crs(ball);
    s.add(ball);
  };

  create();

  __3__.dirLight(0xffffff, 0.6);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
    create();
  };
};
