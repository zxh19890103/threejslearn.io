/**
 * Generated Automatically At Mon Mar 24 2025 19:28:16 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import {
  createPingPongRTPair,
  createQuadComputingScene,
  Water,
} from "./water.js";

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

__config__.camPos = [4, 0, 0];
__config__.background = 0xffffff;

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code
  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __contact__();
  __info__(``);

  const pingpong = {
    h: createPingPongRTPair(THREE.RedFormat, THREE.FloatType),
    v: createPingPongRTPair(THREE.RGFormat, THREE.FloatType),
  };

  const renderLoop = createQuadComputingScene(renderer);
  const timeDelta = 0.016;
  let timeFlyBy = 0;

  const updateHeightMapMat = new THREE.ShaderMaterial({
    precision: "highp",
    uniforms: {
      uTime: { value: 0 },
      uDt: { value: timeDelta },
      uHeightTex: { value: null },
      uVelocityTex: { value: null },
    },
    vertexShader: `
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }`,
    fragmentShader: `
    uniform sampler2D uHeightTex;
    uniform sampler2D uVelocityTex;
    uniform float uDt;
    uniform float uTime;

    in vec2 vUv;

    float hash(float x) {
        return fract(sin(x) * 43758.5453123);
    }

    float noise1D(float x) {
        float i = floor(x);
        float f = fract(x);
        
        // Smoothstep-like interpolation
        float u = f * f * (3.0 - 2.0 * f);
        
        // Interpolate between hash(i) and hash(i + 1)
        return mix(hash(i), hash(i + 1.0), u);
    }    

    void main() {
      gl_FragColor = vec4(noise1D(uTime + vUv.x * vUv.y), 0.0, 0.0, 1.0);
    }`,
  });

  const updateVelocityMapMat = new THREE.ShaderMaterial({
    precision: "highp",
    uniforms: {
      uDt: { value: timeDelta },
      uHeightTex: { value: null },
      uVelocityTex: { value: null },
    },
    vertexShader: `
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }`,
    fragmentShader: `
    uniform sampler2D uHeightTex;
    uniform sampler2D uVelocityTex;
    uniform float uDt;

    in vec2 vUv;

    void main() {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
    `,
  });

  const waterplane = new Water();
  world.add(waterplane);

  renderer.initRenderTarget(pingpong.h.rt0);

  __add_nextframe_fn__(() => {
    // update the velocity first
    // renderer.setRenderTarget(pingpong.v.rt1);
    // renderLoop(updateVelocityMapMat, {
    //   uHeightTex: pingpong.h.rt0.texture,
    //   uVelocityTex: pingpong.v.rt0.texture,
    // });
    // pingpong.v.swap();

    renderer.setRenderTarget(pingpong.h.rt1);
    renderLoop(updateHeightMapMat, {
      uHeightTex: pingpong.h.rt0.texture,
      uVelocityTex: pingpong.v.rt0.texture,
      uTime: timeFlyBy,
    });
    pingpong.h.swap();

    renderer.setRenderTarget(null);
    waterplane.material.uniforms.uHeightTex.value = pingpong.h.rt0.texture;

    timeFlyBy += timeDelta;
  });

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
