/**
 * Generated Automatically At Mon Feb 17 2025 22:39:33 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

__config__.camPos = [0, 0, 5];

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

  __updateTHREEJs__invoke__.addScalar = () => {
    v3.v.copy(v1.v).addScalar(1);
    v3.render();
  };

  __updateTHREEJs__invoke__.subScalar = () => {
    v3.v.copy(v1.v).subScalar(1);
    v3.render();
  };

  __updateTHREEJs__invoke__.divide = () => {
    v3.v.copy(v1.v).divide({ x: 2, y: 2, z: 2 });
    v3.render();
  };

  __updateTHREEJs__invoke__.multiply = () => {
    v3.v.copy(v1.v).multiply({ x: 2, y: 2, z: 2 });
    v3.render();
  };

  let lerpAlpha = 0;
  __updateTHREEJs__invoke__.lerp = () => {
    v3.v.copy(v1.v).lerp(v2.v, lerpAlpha);
    v3.render();
    lerpAlpha += 0.1;
    if (lerpAlpha > 1) lerpAlpha = 0;
  };

  __updateTHREEJs__invoke__.project = () => {
    v3.v.copy(v1.v).project(c);
    v3.render();
  };

  {
    __updateTHREEJs__invoke__.clamp = () => {
      const vmin = visibleVector3(s, 0x819021, 0, 10, 4);
      const vmax = visibleVector3(s, 0xf19021, 0, 10, 10);

      v3.v.copy(v1.v).clamp(vmin.v, vmax.v);
      v3.render();
    };
  }

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

__defineControl__("add", "btn", "0");
__defineControl__("sub", "btn", "0");
__defineControl__("multiply", "btn", "0");
__defineControl__("cross", "btn", "0");
__defineControl__("dot", "btn", "0");
__defineControl__("addScalar", "btn", "add 1");
__defineControl__("subScalar", "btn", "sub 1");
__defineControl__("divide", "btn", "divide 2");
__defineControl__("multiply", "btn", "multiply 2");
__defineControl__("lerp", "btn", "lerp v2 alpha=0.1");
__defineControl__("project", "btn", ".", {
  help: "Vector3.project in Three.js is used to project a 3D vector onto the 2D space of the camera's view. Essentially, it transforms a 3D point from world space into screen space (or normalized device coordinates), which is useful for determining where objects appear in the camera's viewport.",
});
__defineControl__("clamp", "btn", "clamp", {
  help: `The clamp method in Three.js is used to restrict a value to be within a specified range. It ensures that the value is not less than a minimum value or greater than a maximum value. If the value is outside this range, it will be clamped to the closest boundary (either the minimum or maximum).`,
});

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
      const n = v.clone().normalize();
      arrow.setDirection(n);
      arrow.setLength(v.length());
    },
  };
};
