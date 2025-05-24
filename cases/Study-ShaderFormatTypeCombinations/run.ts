/**
 * Generated Automatically At Sun May 18 2025 14:13:06 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let enableGrid = false;
let enableAxes = false;

__config__.background = 0xffffff;

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

  __info__(`
Thia project is to study the correct combinations of format and type for \`DataTexture\`

    `);

  const texSize = 100;
  const pixelsCount = texSize * texSize;
  const dimensions = 4;

  const makeData = (
    Type: "f" | "i" | "ui",
    size: 8 | 16 | 32,
    dimensions: 1 | 2 | 3 | 4
  ) => {};

  const data = new Float32Array(pixelsCount * dimensions);
  let cursor = 0;
  let offset = 0;

  for (let x = 0; x < texSize; x += 1) {
    for (let y = 0; y < texSize; y += 1) {
      offset = cursor * dimensions;

      data[offset + 0] = 0;
      data[offset + 1] = 1;
      data[offset + 2] = 0;
      data[offset + 3] = 1;

      cursor++;
    }
  }

  /**
   * the correct format-type combinations
   */
  const geo = new THREE.PlaneGeometry(5, 5);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: null },
    },
    side: THREE.DoubleSide,
    vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    uniform sampler2D uTex;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(uTex, vUv);
      gl_FragColor = color;
    }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  world.add(mesh);

  let dataTex: THREE.DataTexture = null;

  __updateTHREEJs__many__.format_datatype = () => {
    dataTex?.dispose();

    dataTex = new THREE.DataTexture(data, texSize, texSize, format, datatype);
    dataTex.needsUpdate = true;

    mat.uniforms.uTex.value = dataTex;
  };
};

let format: THREE.PixelFormat = THREE.RGBAFormat;
let datatype: THREE.TextureDataType = THREE.FloatType;

__defineControl__("format", "enum", format, {
  options: [
    { value: THREE.AlphaFormat, label: "AlphaFormat" },
    { value: THREE.RGBFormat, label: "RGBFormat" },
    { value: THREE.RGBAFormat, label: "RGBAFormat" },
    { value: THREE.LuminanceFormat, label: "LuminanceFormat" },
    { value: THREE.LuminanceAlphaFormat, label: "LuminanceAlphaFormat" },
    { value: THREE.DepthFormat, label: "DepthFormat" },
    { value: THREE.DepthStencilFormat, label: "DepthStencilFormat" },
    { value: THREE.RedFormat, label: "RedFormat" },
    { value: THREE.RedIntegerFormat, label: "RedIntegerFormat" },
    { value: THREE.RGFormat, label: "RGFormat" },
    { value: THREE.RGIntegerFormat, label: "RGIntegerFormat" },
    { value: THREE.RGBIntegerFormat, label: "RGBIntegerFormat" },
    { value: THREE.RGBAIntegerFormat, label: "RGBAIntegerFormat" },
  ],
});

__defineControl__("datatype", "enum", datatype, {
  options: [
    { value: THREE.UnsignedByteType, label: "UnsignedByteType" },
    { value: THREE.ByteType, label: "ByteType" },
    { value: THREE.ShortType, label: "ShortType" },
    { value: THREE.UnsignedShortType, label: "UnsignedShortType" },
    { value: THREE.IntType, label: "IntType" },
    { value: THREE.UnsignedIntType, label: "UnsignedIntType" },
    { value: THREE.FloatType, label: "FloatType" },
    { value: THREE.HalfFloatType, label: "HalfFloatType" },
    { value: THREE.UnsignedShort4444Type, label: "UnsignedShort4444Type" },
    { value: THREE.UnsignedShort5551Type, label: "UnsignedShort5551Type" },
    { value: THREE.UnsignedInt248Type, label: "UnsignedInt248Type" },
    { value: THREE.UnsignedInt5999Type, label: "UnsignedInt5999Type" },
  ],
});
