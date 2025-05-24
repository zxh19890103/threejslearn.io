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

const sphConfig = {
  /** smooth radius */
  h: 1.2,
  /** coeff for pressure force. */
  k: 50,
  /** coeff for viscosity*/
  mu: 60,
  g: 9.81,
  delta: 0.016,
  /** rest density */
  rho0: 1,
  texSize: 70,
  boxSize: 4,
};

__main__ = async (
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

  const lookUpGrid = new sphSearch.LookUpGrid3D(
    BBOX,
    sphConfig.texSize,
    sphConfig.h
  );

  lookUpGrid.print();

  const computingScene = new THREE.Scene();
  const computingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const pingPong = {
    p0: createQuadRenderTarget(),
    p1: createQuadRenderTarget(),
    v0: createQuadRenderTarget(),
    v1: createQuadRenderTarget(),
    rho0: createQuadRenderTarget(),
    rho1: createQuadRenderTarget(),
    swap: (which: "v" | "p" | "rho" | "nbr") => {
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

  /**
   * compute rho & pressure for each particle.
   */
  const updateRhoMatShaderFrag = await httpGet("./rho.frag");
  const updateRhoMat = new THREE.ShaderMaterial({
    precision: "highp",
    uniforms: {
      uPositionTex: { value: null },
      uRhoTex: { value: null },
      uGKeyTex: { value: null },
      uGDataTex: { value: null },
      uGOffsetTex: { value: null },
      uMaxNeighborsPerParticle: { value: MAX_NEIGHBORS_PER_PARTICLE },
      uParticlesCount: { value: PARTICLE_COUNT },
      uH: { value: sphConfig.h },
      uK: { value: sphConfig.k },
      uMu: { value: sphConfig.mu },
      uRho0: { value: sphConfig.rho0 },
      uDelta: { value: sphConfig.delta },
      uTexSize: { value: sphConfig.texSize },
      uTime: { value: null },
    },
    vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
    `,
    fragmentShader: updateRhoMatShaderFrag,
  });

  /**
   * compute forces and next velocities for each particle
   */
  const updateVelocityMatShaderFrag = await httpGet("./velocity.frag");
  const updateVelocityMat = new THREE.ShaderMaterial({
    precision: "highp",
    uniforms: {
      uPositionTex: { value: null },
      uVelocityTex: { value: null },
      uRhoTex: { value: null },
      uGKeyTex: { value: null },
      uGDataTex: { value: null },
      uGOffsetTex: { value: null },
      uParticlesCount: { value: PARTICLE_COUNT },
      uMaxNeighborsPerParticle: { value: MAX_NEIGHBORS_PER_PARTICLE },
      uBMin: { value: BBOX.min },
      uBMax: { value: BBOX.max },
      uGridSize: { value: lookUpGrid.grid },
      uH: { value: sphConfig.h },
      uK: { value: sphConfig.k },
      uMu: { value: sphConfig.mu },
      uRho0: { value: sphConfig.rho0 },
      uDelta: { value: sphConfig.delta },
      uGravity: { value: sphConfig.g },
      uTexSize: { value: sphConfig.texSize },
      uTime: { value: null },
    },
    vertexShader: `
    out vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
    `,
    fragmentShader: updateVelocityMatShaderFrag,
  });

  const updatePositionMatShaderFrag = await httpGet("./position.frag");
  const updatePosMat = new THREE.ShaderMaterial({
    precision: "highp",
    uniforms: {
      uPositionTex: { value: null },
      uVelocityTex: { value: null },
      uRhoTex: { value: null },
      uParticlesCount: { value: PARTICLE_COUNT },
      uH: { value: sphConfig.h },
      uK: { value: sphConfig.k },
      uMu: { value: sphConfig.mu },
      uRho0: { value: sphConfig.rho0 },
      uDelta: { value: sphConfig.delta },
      uTime: { value: null },
      uBMin: { value: BBOX.min },
      uBMax: { value: BBOX.max },
    },
    vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
    `,
    fragmentShader: updatePositionMatShaderFrag,
  });

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadMesh = new THREE.Mesh<THREE.PlaneGeometry, any>(
    quadGeo,
    updateVelocityMat
  );
  computingScene.add(quadMesh);

  let displayPositionMat: THREE.ShaderMaterial;
  let displayRhoMat: THREE.ShaderMaterial;

  const positions = generatePositions(sphConfig.texSize);
  const uvs = generateUVs(sphConfig.texSize);

  const displayPositionMatFragShader = await httpGet("./display.frag");
  const displayPositionMatVertShader = await httpGet("./display.vert");

  //#region display position
  {
    const displayGeo = new THREE.BufferGeometry();
    displayPositionMat = new THREE.ShaderMaterial({
      transparent: true,
      precision: "highp",
      uniforms: {
        uPositionTex: { value: null },
        uVelocityTex: { value: null },
        uRhoTex: { value: null },
        uTexSize: { value: sphConfig.texSize },
      },
      vertexShader: displayPositionMatVertShader,
      fragmentShader: displayPositionMatFragShader,
    });

    displayGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    displayGeo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    const displayPts = new THREE.Points(displayGeo, displayPositionMat);
    displayPts.frustumCulled = false;
    world.add(displayPts);
  }
  //#endregion

  //#region  display rho
  {
    const displayGeo = new THREE.PlaneGeometry(2, 2);
    displayRhoMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uPositionTex: { value: null },
        uVelocityTex: { value: null },
        uRhoTex: { value: null },
        rhoMax: { value: 1.5 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
      uniform float rhoMax;
      uniform sampler2D uRhoTex;
      varying vec2 vUv;

      void main() {
        vec4 rho = texture2D(uRhoTex, vUv);
        float normalized = rho.x;
        vec3 color = vec3(normalized); // or use heatmap(normalized)
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    });
    // const mesh = new THREE.Mesh(displayGeo, displayRhoMat);
    // world.add(mesh);
  }
  //#endregion

  const particlePositions = generatePositions(sphConfig.texSize, 4);

  // console.log("---lookUpGrid.GOffset---");
  // console.log(lookUpGrid.GOffset);
  // console.log("---lookUpGrid.GKey---");
  // console.log(lookUpGrid.GKey);
  // console.log("---lookUpGrid.GData---");
  // console.log(lookUpGrid.GData);

  {
    const size = new THREE.Vector3();
    BBOX.getSize(size);
    const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ visible: true, color: 0x000000 })
    );
    world.add(edge);
  }

  renderer.debug.checkShaderErrors = true;

  __updateTHREEJs__invoke__.step = () => {
    // animate(world, camera, renderer, 0.0016);
  };

  world.add(lookUpGrid.visualize());

  const animate = (world, camera, renderer: THREE.WebGLRenderer) => {
    const now = performance.now();

    // renderer.readRenderTargetPixels(
    //   pingPong.p0,
    //   0,
    //   0,
    //   sphConfig.texSize,
    //   sphConfig.texSize,
    //   particlePositions
    // );

    // console.time("lookup");
    // lookUpGrid.buildKeyArray(particlePositions);
    // lookUpGrid.buildGrid();
    // console.timeEnd("lookup");

    //#region Rho & Pressure Pass
    quadMesh.material = updateRhoMat;
    updateRhoMat.uniforms.uTime.value = now;
    updateRhoMat.uniforms.uPositionTex.value = pingPong.p0.texture;
    updateRhoMat.uniforms.uRhoTex.value = pingPong.rho0.texture;
    updateRhoMat.uniforms.uGKeyTex.value = lookUpGrid.GKeyTex;
    updateRhoMat.uniforms.uGDataTex.value = lookUpGrid.GDataTex;
    updateRhoMat.uniforms.uGOffsetTex.value = lookUpGrid.GOffsetTex;

    renderer.setRenderTarget(pingPong.rho1);
    renderer.render(computingScene, computingCamera);
    pingPong.swap("rho");
    //#endregion

    //#region Forces & Velocity Pass
    quadMesh.material = updateVelocityMat;
    updateVelocityMat.uniforms.uTime.value = now;
    updateVelocityMat.uniforms.uPositionTex.value = pingPong.p0.texture;
    updateVelocityMat.uniforms.uVelocityTex.value = pingPong.v0.texture;
    updateVelocityMat.uniforms.uRhoTex.value = pingPong.rho0.texture;
    updateVelocityMat.uniforms.uGKeyTex.value = lookUpGrid.GKeyTex;
    updateVelocityMat.uniforms.uGDataTex.value = lookUpGrid.GDataTex;
    updateVelocityMat.uniforms.uGOffsetTex.value = lookUpGrid.GOffsetTex;

    renderer.setRenderTarget(pingPong.v1);
    renderer.render(computingScene, computingCamera);
    pingPong.swap("v");
    //#endregion

    //#region Position Pass
    quadMesh.material = updatePosMat;
    updatePosMat.uniforms.uTime.value = now;
    updatePosMat.uniforms.uPositionTex.value = pingPong.p0.texture;
    updatePosMat.uniforms.uVelocityTex.value = pingPong.v0.texture;

    renderer.setRenderTarget(pingPong.p1);
    renderer.render(computingScene, computingCamera);
    pingPong.swap("p");
    //#endregion

    //#region  Display
    renderer.setRenderTarget(null);

    displayPositionMat.uniforms.uPositionTex.value = pingPong.p0.texture;
    displayPositionMat.uniforms.uVelocityTex.value = pingPong.v0.texture;
    displayPositionMat.uniforms.uRhoTex.value = pingPong.rho0.texture;
    //#endregion
  };

  __add_nextframe_fn__(animate);
};

__defineControl__("step", "btn", "fire");

const BBOX = new THREE.Box3(
  new THREE.Vector3(-sphConfig.boxSize, -sphConfig.boxSize, -sphConfig.boxSize),
  new THREE.Vector3(sphConfig.boxSize, sphConfig.boxSize, sphConfig.boxSize)
);
const PARTICLE_COUNT = sphConfig.texSize * sphConfig.texSize;
const MAX_NEIGHBORS_PER_PARTICLE = 256;

// 🌈 初始化位置纹理数据
function generateInitialPositions() {
  const N = PARTICLE_COUNT;
  const data = new Float32Array(N * 4);

  const min = BBOX.min;
  const size = new THREE.Vector3();
  BBOX.getSize(size);
  size.divideScalar(3);

  let volume = size.x * size.y * size.z;
  let density = N / volume;
  let idealSpacing = Math.pow(1 / density, 1.0 / 3.0);

  console.log("idealSpacing", idealSpacing);

  const cols = Math.ceil(size.x / idealSpacing);
  const rows = Math.ceil(size.y / idealSpacing);
  const layers = Math.ceil(size.z / idealSpacing);

  let i = 0;

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      for (let z = 0; z < layers; z++) {
        if (i >= N) break;

        data[i * 4 + 0] = min.x + x * idealSpacing * 1;
        data[i * 4 + 1] = min.y + y * idealSpacing * 1;
        data[i * 4 + 2] = min.z + z * idealSpacing * 1;
        data[i * 4 + 3] = i;

        i++;
      }
    }
  }

  return new THREE.DataTexture(
    data,
    sphConfig.texSize,
    sphConfig.texSize,
    THREE.RGBAFormat,
    THREE.FloatType
  );
}

// 📦 创建位置和速度的 render target
function createQuadRenderTarget(n = 1) {
  return new THREE.WebGLRenderTarget(sphConfig.texSize, sphConfig.texSize, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    internalFormat: "RGBA32F",
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
    count: n,
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

function httpGet(url: string) {
  return fetch(url).then((r) => r.text());
}

// read positions:  renderer.readRenderTargetPixels:
// compute grid index and neighbors for each particle and write the data to datatexture, and then upload it to GPU?
