/**
 * Generated Automatically At Thu Apr 10 2025 06:37:48 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

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

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  const computingScene = new THREE.Scene();
  const computingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const rT0 = createRenderTarget();

  const initialPosData = generateInitialData();
  initialPosData.needsUpdate = true;
  renderer.clear();
  renderer.copyTextureToTexture(initialPosData, rT0.texture);

  const quadMat = new THREE.ShaderMaterial({
    uniforms: {
      uPosition: { value: null },
    },
    vertexShader: `
    
    `,
    fragmentShader: `

    `,
  });

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadMesh = new THREE.Mesh(quadGeo, quadMat);
  computingScene.add(quadMesh);

  __add_nextframe_fn__(
    (world, camera, renderer: THREE.WebGLRenderer, delta) => {
      quadMat.uniforms.uPosition.value = rT0.texture;
      renderer.setRenderTarget(rT0);
      renderer.render(computingScene, computingCamera);

      renderer.setRenderTarget(null);
    }
  );
};

const WIDTH = 100;
const PARTICLE_COUNT = WIDTH * WIDTH;

// 🌈 初始化位置纹理数据
function generateInitialData() {
  const data = new Float32Array(PARTICLE_COUNT * 4);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = Math.random() * 2 - 1; // 如果你想限定在 [-1, 1] 显示区域
    const y = Math.random() * 2 - 1;
    const z = Math.random() * 2 - 1;

    data[i * 4 + 0] = x;
    data[i * 4 + 1] = y;
    data[i * 4 + 2] = z;
    data[i * 4 + 3] = 1.0;
  }

  return new THREE.DataTexture(
    data,
    WIDTH,
    WIDTH,
    THREE.RGBAFormat,
    THREE.FloatType
  );
}
// 📦 创建位置和速度的 render target
function createRenderTarget() {
  return new THREE.WebGLRenderTarget(WIDTH, WIDTH, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
  });
}
