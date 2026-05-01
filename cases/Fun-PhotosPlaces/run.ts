/**
 * Generated Automatically At 2026-04-27;
 */
import * as THREE from "three";

let enableGrid = false;
let enableAxes = false;

__config__.background = 0xffffff;
__config__.camFar = 1e9;
__config__.camNear = 0.1;
__config__.controls = "map";
__config__.camPos = [0, 0, 1e4];

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

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  controls: any,
) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  return import(`./main2.js?ts=${Date.now()}`).then(({ main }) =>
    main(world, camera, renderer, controls),
  );
};
