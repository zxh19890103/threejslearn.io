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

  const initialPosData = generateInitialData();
  initialPosData.needsUpdate = true;

  // 6. shader 顯示位置貼圖（將 RGB 當作顏色顯示）
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: initialPosData },
    },
    vertexShader: `
    precision highp float;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    precision highp float;
    uniform sampler2D uTex;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(uTex, vUv);
      gl_FragColor = color; // 將 [-1,1] 映射到 [0,1]
    }
  `,
  });

  if (
    !renderer.capabilities.isWebGL2 &&
    !renderer.extensions.has("OES_texture_float")
  ) {
    alert("Your browser does not support floating point textures.");
  }

  // 🌍 全屏 quad（用于 shader 更新）
  // const quadGeo = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const uvs = new Float32Array(PARTICLE_COUNT * 2);
  const spacing = 0.01;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const xi = i % WIDTH;
    const zi = Math.floor(i / WIDTH);

    const x = xi * spacing;
    const y = 0;
    const z = zi * spacing;

    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = z;

    const u = ((i % WIDTH) + 0.5) / WIDTH;
    const v = (Math.floor(i / WIDTH) + 0.5) / WIDTH;

    uvs[i * 2 + 0] = u;
    uvs[i * 2 + 1] = v;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  const posMesh = new THREE.Line(geometry, material);
  world.add(posMesh);

  __add_nextframe_fn__(
    (world, camera, renderer: THREE.WebGLRenderer, delta) => {}
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
