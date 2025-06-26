/**
 * Generated Automatically At Mon Mar 24 2025 19:28:16 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import {
  AysncShaderMaterial,
  createInitialDataTexture,
  createPingPongRTPair,
  createQuadGPUComputation,
  Water,
  dt as timeDelta,
  hbase,
  initializeSeaHeightMap,
  texSize,
  initializeRandomHeightMap,
} from "./water.js";
import { Sky } from "cases/Fun-Sky/sky.js";

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

// __config__.camPos = [-0.2, -0.2, 0.15];
__config__.background = 0xffffff;

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code
  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  camera.up.set(0, 0, 1);

  __contact__();
  __info__(``);

  const pingpong = {
    h: createPingPongRTPair(THREE.RGFormat, THREE.FloatType),
    v: createPingPongRTPair(THREE.RGFormat, THREE.FloatType),
  };

  const renderLoop = createQuadGPUComputation(renderer);
  let timeFlyBy = 0;

  const updateHeightMapMat = new AysncShaderMaterial(
    {
      uTime: 0,
      uHeightTex: null,
      uVelocityTex: null,
    },
    "./h.frag"
  );

  const updateVelocityMapMat = new AysncShaderMaterial(
    {
      uTime: 0,
      uHeightTex: null,
      uVelocityTex: null,
      impactPos: new THREE.Vector2(0.5, 0.5),
      impactStrength: 0,
    },
    "./v.frag"
  );

  const waterplane = new Water(10, 1);
  waterplane.position.set(0, 0, 0);
  waterplane.rotateX(70 * __3__.deg2rad);
  world.add(waterplane);
  waterplane.material.uniforms.viewPos.value = camera.position;

  const Grid = new THREE.GridHelper(10, 10, 0x10ae01, 0xd3d3d3);
  Grid.rotateX(90 * __3__.deg2rad);

  world.add(Grid);
  const sky = new Sky();
  // sky.rotateZ(90 * __3__.deg2rad);
  world.add(sky);

  const bootstrapHeightMapTex = initializeRandomHeightMap();

  renderer.clear();
  renderer.initTexture(bootstrapHeightMapTex);
  renderer.initRenderTarget(pingpong.h.rt0);
  renderer.copyTextureToTexture(bootstrapHeightMapTex, pingpong.h.rt0.texture);

  __add_nextframe_fn__(() => {
    // update the velocity first
    if (updateVelocityMapMat.ready && updateHeightMapMat.ready) {
      renderer.setRenderTarget(pingpong.v.rt1);
      renderLoop(updateVelocityMapMat, {
        uHeightTex: pingpong.h.rt0.texture,
        uVelocityTex: pingpong.v.rt0.texture,
        uTime: timeFlyBy,
      });
      pingpong.v.swap();

      renderer.setRenderTarget(pingpong.h.rt1);
      renderLoop(updateHeightMapMat, {
        uHeightTex: pingpong.h.rt0.texture,
        uVelocityTex: pingpong.v.rt0.texture,
        uTime: timeFlyBy,
      });
      pingpong.h.swap();

      renderer.setRenderTarget(null);
      waterplane.material.uniforms.uHeightTex.value = pingpong.h.rt0.texture;
      waterplane.material.uniforms.viewPos.value = camera.position;

      timeFlyBy += timeDelta;
    }
  });

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
