/**
 * Generated Automatically At Thu Apr 10 2025 06:37:48 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import * as sphSearch from "./search.js";

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

__config__.background = 0xffffff;

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

  const sphConfig = {
    /** smooth radius */
    h: 2,
    /** coeff for pressure force. */
    k: 1,
    /** coeff for viscosity*/
    mu: 1,
    /** rest density */
    rho0: 1,
  };

  BBOX.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10));

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

  renderer.clear();
  renderer.initTexture(initialPosTex);
  renderer.initRenderTarget(pingPong.p0);
  renderer.copyTextureToTexture(initialPosTex, pingPong.p0.texture);

  const updateVelocityMat = new THREE.ShaderMaterial({
    uniforms: {
      uPosition: { value: null },
      uNeighbors: { value: null },
      uVelocity: { value: null },
      uH: { value: sphConfig.h },
      uK: { value: sphConfig.k },
      uMu: { value: sphConfig.mu },
      uRho0: { value: sphConfig.rho0 },
      uTexSize: { value: TEX_SIZE },
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
    uniform isampler2D uNeighbors;

    uniform int uTexSize;
    uniform float uTime;
    uniform float uDelta;

    varying vec2 vUv;

    float rand(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    float randMinusOneToOne(vec2 co) {
      return rand(co) * 2.0 - 1.0;
    }

    int uv2index(vec2 uv) {
      ivec2 pixelCoord = ivec2(floor(uv * vec2(uTexSize)));
      int index = pixelCoord.y * uTexSize + pixelCoord.x;
      return index;
    }

    vec2 index2uv(int index) {
      int x = index %uTexSize;
      int y = index / uTexSize;
      vec2 uv = (vec2(x, y) + 0.5) / vec2(uTexSize);
      return uv;
    }

    int getNeighbor(int particleIndex, int neighborSlot) {
      ivec2 coord = ivec2(neighborSlot, particleIndex);
      int neighborIndex = texelFetch(uNeighbors, coord, 0).r;
      return neighborIndex;
    }

    void main() {
      vec4 coords = texture2D(uPosition, vUv);
      vec4 velocity = texture2D(uVelocity, vUv);

      int particleIndex = uv2index(vUv);

      int neighborCount = texelFetch(uNeighbors, ivec2(0, particleIndex), 0).r;

      for (int i = 1; i <= neighborCount; i++) {
        int neighbor = getNeighbor(particleIndex, i);
        vec2 neighborUv = index2uv(neighbor);
        vec4 neighborCoord =  texture2D(uPosition, neighborUv);
      }

      velocity.x = randMinusOneToOne(vUv);
      velocity.y = randMinusOneToOne(vUv + 0.1);
      velocity.z = randMinusOneToOne(vUv + 0.3);

      gl_FragColor = velocity;
    }
    `,
  });

  const updatePosMat = new THREE.ShaderMaterial({
    uniforms: {
      uPosition: { value: null },
      uVelocity: { value: null },
      uH: { value: sphConfig.h },
      uK: { value: sphConfig.k },
      uMu: { value: sphConfig.mu },
      uRho0: { value: sphConfig.rho0 },
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

      coords.xyz += velocity.xyz * uDelta;

      gl_FragColor = coords;
    }
    `,
  });

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadMesh = new THREE.Mesh(quadGeo, updateVelocityMat);
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
      gl_PointSize = 4.0;
      vec3 pos = texture2D(uPosition, uv).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
    `,
    fragmentShader: `
    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5));
      if (dist > 0.5) discard;

      gl_FragColor = vec4(0.8, 0.1, 0.1, 0.56);
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

  const particlePositions = generatePositions(TEX_SIZE, 4);

  sphSearch.initialize(TEX_SIZE);

  __add_nextframe_fn__(
    (world, camera, renderer: THREE.WebGLRenderer, delta) => {
      const now = performance.now();

      renderer.readRenderTargetPixels(
        pingPong.p0,
        0,
        0,
        TEX_SIZE,
        TEX_SIZE,
        particlePositions
      );

      sphSearch.buildGrid(particlePositions, BBOX, sphConfig.h);
      const neighbors = sphSearch.findNeighbors(particlePositions);

      quadMesh.material = updateVelocityMat;
      updateVelocityMat.uniforms.uTime.value = now;
      updateVelocityMat.uniforms.uDelta.value = delta;
      updateVelocityMat.uniforms.uNeighbors.value = neighbors;
      updateVelocityMat.uniforms.uPosition.value = pingPong.p0.texture;
      updateVelocityMat.uniforms.uVelocity.value = pingPong.v0.texture;

      renderer.setRenderTarget(pingPong.v1);
      renderer.render(computingScene, computingCamera);
      pingPong.swap("v");

      quadMesh.material = updatePosMat;
      updatePosMat.uniforms.uTime.value = now;
      updatePosMat.uniforms.uDelta.value = delta;
      updatePosMat.uniforms.uPosition.value = pingPong.p0.texture;
      updatePosMat.uniforms.uVelocity.value = pingPong.v0.texture;

      renderer.setRenderTarget(pingPong.p1);
      renderer.render(computingScene, computingCamera);
      pingPong.swap("p");

      renderer.setRenderTarget(null);

      displayMat.uniforms.uPosition.value = pingPong.p0.texture;
    }
  );
};

const BBOX = new THREE.Box3();
const TEX_SIZE = 900;
const PARTICLE_COUNT = TEX_SIZE * TEX_SIZE;

// 🌈 初始化位置纹理数据
function generateInitialPositions() {
  const data = new Float32Array(PARTICLE_COUNT * 4);

  const { min, max } = BBOX;

  const size = new THREE.Vector3();
  BBOX.getSize(size);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = Math.random() * size.x + min.x;
    const y = Math.random() * size.y + min.y;
    const z = Math.random() * size.z + min.z;

    data[i * 4 + 0] = x;
    data[i * 4 + 1] = y;
    data[i * 4 + 2] = z;
    data[i * 4 + 3] = i;
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

function generatePositions(texSize: number, dim = 3) {
  const count = texSize * texSize * dim;
  return new Float32Array(count).fill(0);
}

// read positions:  renderer.readRenderTargetPixels:
// compute grid index and neighbors for each particle and write the data to datatexture, and then upload it to GPU?
