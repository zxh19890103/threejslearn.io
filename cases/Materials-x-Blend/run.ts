/**
 * Generated Automatically At Thu Feb 13 2025 19:54:26 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import * as blendingOpts from "./opts.js";

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
    blendAlpha,
    blendColor,
    blendDst,
    blendDstAlpha,
    blendEquation,
    blendEquationAlpha,
    blending,
    blendSrc,
    blendSrcAlpha,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  const geo = new THREE.BoxGeometry(3, 3, 3);
  const material = new THREE.MeshBasicMaterial({
    color: 0x349910,
    wireframe: true,
    blendAlpha,
    blendColor,
    blendDst,
    blendDstAlpha,
    blendEquation,
    blendEquationAlpha,
    blending,
    blendSrc,
    blendSrcAlpha,
    opacity,
    transparent,
  });
  const box = new THREE.Mesh(geo, material);
  s.add(box);

  __3__.dirLight(0xffffff, 0.7);
  __3__.ptLight(0xff0000, 0.9);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
    material.setValues({
      blendAlpha,
      blendColor,
      blendDst,
      blendDstAlpha,
      blendEquation,
      blendEquationAlpha,
      blending,
      blendSrc,
      blendSrcAlpha,
      opacity,
      transparent,
    });

    console.log(k, val);

    material.needsUpdate = true;
  };
};

let transparent = false;
let blendAlpha = 0.8;
let blendColor = 0x234012;
let blendDst = THREE.DstAlphaFactor;
let blendDstAlpha = 0.9;
let blendEquation = THREE.AddEquation;
let blendEquationAlpha = 0.7;
let blending = THREE.NoBlending;
let blendSrc = THREE.ZeroFactor;
let blendSrcAlpha = 0.9;
let opacity: number = 1;

__defineControl__("transparent", "bit", transparent);
__defineControl__("opacity", "range", opacity, __defineControl__.r01());

__defineControl__("blending", "enum", blending, {
  options: blendingOpts.blendings,
  valueType: "int",
});
__defineControl__("blendEquation", "enum", blendEquation, {
  options: blendingOpts.blendEqs,
  valueType: "int",
});
__defineControl__(
  "blendEquationAlpha",
  "range",
  blendEquationAlpha,
  __defineControl__.r01()
);

__defineControl__("blendColor", "color", blendColor);
__defineControl__("blendAlpha", "range", blendAlpha, __defineControl__.r01());

__defineControl__("blendSrc", "enum", blendSrc, {
  options: blendingOpts.blendSrcFactors,
  valueType: "int",
});
__defineControl__(
  "blendSrcAlpha",
  "range",
  blendSrcAlpha,
  __defineControl__.r01()
);

__defineControl__("blendDst", "enum", blendDst, {
  options: blendingOpts.blendDistFactors,
  valueType: "int",
});
__defineControl__(
  "blendDstAlpha",
  "range",
  blendDstAlpha,
  __defineControl__.r01()
);
