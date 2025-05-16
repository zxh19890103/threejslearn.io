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

// __config__.background = 0xffffff;

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

  const pingPong = {
    p0: createRenderTarget(),
    p1: createRenderTarget(),
    v0: createRenderTarget(),
    v1: createRenderTarget(),
    swap: (which: "v" | "p") => {
      const [rt0, rt1] = [pingPong[which + "0"], pingPong[which + "1"]];
      pingPong[which + "0"] = rt1;
      pingPong[which + "1"] = rt0;
    },
  };

  const initialPosTex = generateInitialPositions();
  initialPosTex.needsUpdate = true;

  const initialVelTex = generateInitialVelocities();
  initialVelTex.needsUpdate = true;

  renderer.clear();
  renderer.initTexture(initialPosTex);
  renderer.initRenderTarget(pingPong.p0);
  renderer.copyTextureToTexture(initialPosTex, pingPong.p0.texture);

  const quadMat = new THREE.ShaderMaterial({
    uniforms: {
      uPosition: { value: null },
      uVelocity: { value: initialVelTex },
      uTime: { value: null },
      uDelta: { value: null },
    },
    vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    uniform sampler2D uPosition;
    uniform sampler2D uVelocity;

    uniform float uTime;
    uniform float uDelta;

    varying vec2 vUv;

    void main() {
      vec4 coords = texture2D(uPosition, vUv);
      vec4 velocity = texture2D(uVelocity, vUv);

      coords += velocity * uDelta;

      gl_FragColor = coords;
    }
    `,
  });

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadMesh = new THREE.Mesh(quadGeo, quadMat);
  computingScene.add(quadMesh);

  const displayGeo = new THREE.BufferGeometry();
  const displayMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uPosition: { value: null },
    },
    vertexShader: `
    uniform sampler2D uPosition;

    void main() {
      gl_PointSize = 1.0;
      vec3 pos = texture2D(uPosition, uv).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
    `,
    fragmentShader: `

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5));
      if (dist > 0.5) discard;

      gl_FragColor = vec4(0.3, 0.9, 0.1, 1.0);
    }
    `,
  });

  displayGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(generatePositions(TEX_SIZE), 3)
  );
  displayGeo.setAttribute(
    "uv",
    new THREE.BufferAttribute(generateUVs(TEX_SIZE), 2)
  );

  const displayPts = new THREE.Points(displayGeo, displayMat);
  world.add(displayPts);

  __add_nextframe_fn__(
    (world, camera, renderer: THREE.WebGLRenderer, delta) => {
      quadMat.uniforms.uTime.value = performance.now();
      quadMat.uniforms.uDelta.value = delta;
      quadMat.uniforms.uPosition.value = pingPong.p0.texture;

      renderer.setRenderTarget(pingPong.p1);
      renderer.render(computingScene, computingCamera);

      renderer.setRenderTarget(null);

      pingPong.swap("p");
      pingPong.swap("v");

      displayMat.uniforms.uPosition.value = pingPong.p0.texture;
    }
  );
};

const TEX_SIZE = 1000;
const PARTICLE_COUNT = TEX_SIZE * TEX_SIZE;

// 🌈 初始化位置纹理数据
function generateInitialPositions() {
  const data = new Float32Array(PARTICLE_COUNT * 4);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = Math.random() * 10 - 1;
    const y = Math.random() * 10 - 1;
    const z = Math.random() * 10 - 1;

    data[i * 4 + 0] = x;
    data[i * 4 + 1] = y;
    data[i * 4 + 2] = z;
    data[i * 4 + 3] = 1.0;
  }

  return new THREE.DataTexture(
    data,
    TEX_SIZE,
    TEX_SIZE,
    THREE.RGBAFormat,
    THREE.FloatType
  );
}

// 🌈 初始化位置纹理数据
function generateInitialVelocities() {
  const data = new Float32Array(PARTICLE_COUNT * 4);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = 2 * (Math.random() * 2 - 1);
    const y = 2 * (Math.random() * 2 - 1);
    const z = 2 * (Math.random() * 2 - 1);

    data[i * 4 + 0] = x;
    data[i * 4 + 1] = y;
    data[i * 4 + 2] = z;
    data[i * 4 + 3] = 1.0;
  }

  return new THREE.DataTexture(
    data,
    TEX_SIZE,
    TEX_SIZE,
    THREE.RGBAFormat,
    THREE.FloatType
  );
}

// 📦 创建位置和速度的 render target
function createRenderTarget() {
  return new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    internalFormat: "RGBA32F",
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

function generateUVs(texSize: number) {
  const count = texSize * texSize * 2;
  const uvs = new Float32Array(count);
  const invTexSize = 1 / texSize;

  let ptr = 0;
  for (let i = 0; i < texSize; i++) {
    for (let j = 0; j < texSize; j++) {
      uvs[ptr * 2] = (j + 0.5) * invTexSize; // u
      uvs[ptr * 2 + 1] = (i + 0.5) * invTexSize; // v
      ptr++;
    }
  }

  return uvs;
}

function generatePositions(texSize: number) {
  const count = texSize * texSize * 3;
  return new Float32Array(count).fill(0);
}
