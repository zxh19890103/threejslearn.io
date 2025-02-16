/**
 * Generated Automatically At Sat Feb 15 2025 21:53:17 GMT+0800 (China Standard Time);
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
    map,
    color,
    aoMap,
    aoMapIntensity,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  const loader = new THREE.TextureLoader(new THREE.LoadingManager());

  const geo = new THREE.SphereGeometry(0.3, 32, 32);
  const mat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    // emissive: 0xffffff,
    // emissiveIntensity: 0.1,
    aoMapIntensity,
  });
  const ball = new THREE.Mesh(geo, mat);

  __3__.dirLight(0xffffff, 0.9);
  __3__.ambLight(0xffffff, 0.4);

  s.add(ball);

  __add_nextframe_fn__(() => {
    ball.rotation.x += 0.001;
  });

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  __updateTHREEJs__after__ = () => {};

  __updateTHREEJs__only__.color = () => {
    mat.color.set(color);
    mat.needsUpdate = true;
  };

  __updateTHREEJs__only__.aoMap = () => {
    loader.load("/assets/images/2k_earth_clouds.jpg", (texture) => {
      mat.aoMap = texture;
      mat.needsUpdate = true;
    });
  };

  __updateTHREEJs__only__.aoMapIntensity = () => {
    mat.aoMapIntensity = aoMapIntensity;
    mat.needsUpdate = true;
  };

  __updateTHREEJs__only__.map = (on) => {
    if (on) {
      loader.load("/assets/images/2k_earth_daymap.jpg", (texture) => {
        mat.map = texture;
        mat.needsUpdate = true;
      });
    } else {
      mat.map = null;
      mat.needsUpdate = true;
    }
  };
};

let map = false;
let aoMap = false;
let aoMapIntensity = 0.1;
let color = 0xfeffef;

__defineControl__("map", "bit", map);
__defineControl__("aoMap", "bit", aoMap);
__defineControl__(
  "aoMapIntensity",
  "range",
  aoMapIntensity,
  __defineControl__.r01()
);
__defineControl__("color", "color", color);
