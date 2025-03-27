/**
 * Generated Automatically At Wed Mar 26 2025 19:37:46 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { ParticleCloud, afterSettingSPH_CONSTs, SPH_CONSTs } from "./sph.js";

let enableGrid = false;
let enableAxes = false;

//#region reactive
__dev__();
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

__config__.camPos = [0, 1, 12];
__config__.camNear = 0.0001;

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__only__["SPH_CONSTs.h"] = (val) => {
    console.log(val, SPH_CONSTs.h);
    afterSettingSPH_CONSTs();
  };

  const pC = new ParticleCloud();

  pC.buildCube([0, 0, 0], 20, 10, 10);

  world.add(new THREE.Box3Helper(pC.boundary, 0xfe9100));

  console.log(pC.particles.length);

  // world.add(pC.mesh);
  world.add(pC.cloud);
  // world.add(pC.line);

  const loop = () => {
    // if (!go) return;
    if (!go) return;

    // console.time("computeDensity");
    pC.computeDensity();
    // console.timeEnd("computeDensity");
    // console.time("computeForce");
    pC.computeForce();
    // console.timeEnd("computeForce");
    pC.move();

    pC.render();
  };

  let go = false;

  renderer.domElement.addEventListener("click", () => {
    go = !go;
    // loop();
  });

  __add_nextframe_fn__(loop);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

__defineControl__("SPH_CONSTs.h", "range", SPH_CONSTs.h, {
  label: "h",
  ...__defineControl__.rfloat(1, 5),
});

__defineControl__("SPH_CONSTs.k", "range", SPH_CONSTs.k, {
  label: "k",
  ...__defineControl__.rfloat(0, 5),
});

__defineControl__("SPH_CONSTs.mu", "range", SPH_CONSTs.mu, {
  label: "mu",
  ...__defineControl__.rfloat(0, 5),
});

__defineControl__("SPH_CONSTs.m", "range", SPH_CONSTs.m, {
  label: "mass",
  ...__defineControl__.rfloat(20, 200),
});

const createPtsCloud = (pts: number[], color: number) => {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.PointsMaterial({
    color,
    sizeAttenuation: false,
    size: 2,
  });
  const cloud = new THREE.Points(geometry, material);

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));

  return cloud;
};
