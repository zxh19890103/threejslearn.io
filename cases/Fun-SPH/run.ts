/**
 * Generated Automatically At Fri Mar 28 2025 15:35:14 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { ParticleCloud } from "./sph2.js";
import * as config from "./config.js";
import { MarchingCubes } from "cases/Shared/MarchingCubes.class.js";
import { vec3 } from "cases/vec3.js";
import { computeProperBoxSize } from "./config.js";

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

__config__.camPos = [0, 10, 30];
__config__.background = 0xffffff;

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __contact__();
  __info__(`
It's A Complex Project Simulating Fluid Effects with the SPH Model

This project took me two weeks to complete — quite a long time for me.

Honestly, I’m exhausted.

I’ve decided to pause the project due to WebGL performance bottlenecks, even though I’ve optimized it over and over again.  
The final result still isn’t as good as I expected.  
But one thing I’ve truly achieved is a much deeper understanding of the SPH (Smoothed Particle Hydrodynamics) model — which was a bit complicated for me — and how **Marching Cubes** works.

During the development, I created a class called \`Float32ArrayVec3\` to handle vector operations more efficiently.

With \`Float32ArrayVec3\`, all vectors are stored in a \`Float32Array\`, and it provides nearly all the standard vector operations.  
It’s much more efficient than regular JavaScript arrays, which have no type constraints or fixed length.

Another thing I built from scratch is \`MarchingCubes\`.  
Implementing it myself was quite a journey.  
In the end, **Marching Cubes** turned out to be an amazing approach for rendering the surface of dynamic fluids.

Below are the links to the key parts:

1. [\`Float32ArrayVec3\`](https://github.com/zxh19890103/threejslearn.io/tree/main/cases/Shared/Float32ArrayVec3.class.ts)  
2. [\`MarchingCubes\`](https://github.com/zxh19890103/threejslearn.io/tree/main/cases/Shared/MarchingCubes.class.ts)


    `);

  __usePanel__({
    width: 300,
    lines: 5,
    placement: "top",
  });

  __usePanel_write__(3, `n: ${config.N}`);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  let added = -1;
  __updateTHREEJs__invoke__.start = () => {
    if (added !== -1) {
      __remove_nextframe_fn__(added);
      added = -1;
    } else {
      added = __add_nextframe_fn__(_iter);
    }
  };

  __updateTHREEJs__invoke__.rotate = () => {
    fluid.boundary.rotate([0, 0, 1], 6);
    fluid.each((r: Vec3, v: Vec3) => {
      fluid.boundary.affectAfterRotation(r, v);
    });
  };

  __updateTHREEJs__invoke__.move = () => {
    fluid.boundary.move([0, -0.3, 0]);
    fluid.each((r: Vec3, v: Vec3) => {
      fluid.boundary.affectAfterMove(r, v);
    });
  };

  __updateTHREEJs__invoke__.step = () => {
    _iter();
  };

  __updateTHREEJs__only__.renderAs = (val) => {
    renderAs = val ?? "ball";

    __renderControls__({ renderAs });

    fluid.boundary.mesh.remove(_shape);

    if (renderAs === "surface") {
      _iter = iter;
      _shape = marchingCubes.surface;
    } else if (renderAs === "point") {
      _iter = iter3;
      _shape = fluid.cloud;
    } else {
      _iter = iter2;
      _shape = fluid.mesh;
    }

    fluid.boundary.mesh.add(_shape);

    if (added !== -1) {
      __remove_nextframe_fn__(added);
      added = __add_nextframe_fn__(_iter);
    }
  };

  __updateTHREEJs__only__.obstacle = (val) => {
    console.log(val);
  };

  __3__.dirLight(0xffffff, 2, [0, 0, -1]);
  __3__.ambLight(0xffffff, 0.6);

  const fluid = new ParticleCloud();
  const size = computeProperBoxSize();
  console.log("size = ", size);
  fluid.buildBoundary([0, 0, 0], size);

  const resolution = 2;
  const marchingCubes = new MarchingCubes({
    fieldFunc: fluid.computeRhoFor,
    resolution,
    isoValue: config.rho0,
    box: {
      min: vec3.addScalar(fluid.boundary.min, -resolution),
      max: vec3.addScalar(fluid.boundary.max, resolution),
    },
  });

  // surface
  const iter = () => {
    fluid.buildLookupGrid();

    console.time("findNeighers");
    fluid.findNeighbors();
    console.timeEnd("findNeighers");

    console.time("march");
    marchingCubes.march();
    console.timeEnd("march");
    marchingCubes.renderAsSurface();

    console.time("computeRho");
    fluid.computeRho();
    console.timeEnd("computeRho");
    console.time("computeForce");
    fluid.computeForce();
    console.timeEnd("computeForce");
    fluid.move();
  };

  // ball
  const iter2 = () => {
    // Quick
    // console.time("buildKeyArray");
    fluid.buildLookupGrid();
    // console.timeEnd("buildKeyArray");
    fluid.renderGrid();

    // Quick
    // console.time("findNeighbors");
    fluid.findNeighbors();
    // console.timeEnd("findNeighbors");

    fluid.renderBalls();

    // console.time("computeRho");
    fluid.computeRho();
    // console.timeEnd("computeRho");
    // console.time("computeForce");
    fluid.computeForce();
    // console.timeEnd("computeForce");
    fluid.move();
  };

  // points
  const iter3 = () => {
    fluid.buildLookupGrid();
    fluid.renderGrid();

    // console.time("findNeighers");
    fluid.findNeighbors();
    // console.timeEnd("findNeighers");

    fluid.renderCloud();

    // console.time("computeRho");
    fluid.computeRho();
    // console.timeEnd("computeRho");
    // console.time("computeForce");
    fluid.computeForce();
    // console.timeEnd("computeForce");
    fluid.move();
  };

  let _iter = iter2;
  let _shape: THREE.Object3D = fluid.mesh;

  fluid.boundary.mesh.add(fluid.mesh, fluid.lookupGridLines);

  world.add(fluid.boundary.mesh);
};

let renderAs = "ball";
let obstacle: "ball" | "cube" = null;

__defineControl__("renderAs", "enum", renderAs, {
  valueType: "string",
  options: [
    {
      label: "point",
      value: "point",
    },
    {
      label: "surface",
      value: "surface",
    },
    {
      label: "ball",
      value: "ball",
    },
  ],
});
__defineControl__("obstacle", "enum", obstacle, {
  valueType: "string",
  options: [
    { label: "ball", value: "ball" },
    { label: "cube", value: "cube" },
  ],
});
__defineControl__("start", "btn", "1-");
__defineControl__("rotate", "btn", "2-");
__defineControl__("move", "btn", "3-");
__defineControl__("step", "btn", "4-", { perf: true });

__defineControl__("config.variables.k", "range", config.variables.k, {
  label: "k",
  help: "",
  helpWidth: 300,
  ...__defineControl__.rfloat(0.1, 10),
});

__defineControl__("config.variables.mu", "range", config.variables.mu, {
  label: "mu",
  help: "",
  helpWidth: 300,
  ...__defineControl__.rfloat(0.1, 10),
});

__defineControl__("config.variables.g", "range", config.variables.g, {
  label: "g",
  help: "",
  helpWidth: 300,
  fixed: 3,
  ...__defineControl__.rfloat(0.1, 1),
});

__defineControl__("config.variables.dt", "range", config.variables.dt, {
  label: "dt",
  help: "",
  helpWidth: 300,
  fixed: 3,
  ...__defineControl__.rfloat(0.01, 0.04),
});
