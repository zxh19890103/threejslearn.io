import * as THREE from "three";

export const texSize = 120;
export const dt = 0.001;
export const damping = 0.98;
export const dx = 1 / texSize;
export const g = 1.81;
export const hbase = 0.001;
export const windStrength = 10.0;

const texTotal = texSize * texSize;

let defaultMinFilter: THREE.MinificationTextureFilter = THREE.LinearFilter;
let defaultMagFilter: THREE.MagnificationTextureFilter = THREE.LinearFilter;
let defaultWrap: THREE.Wrapping = THREE.RepeatWrapping;

export const createRT = (
  format: THREE.PixelFormat,
  type: THREE.TextureDataType
) => {
  return new THREE.WebGLRenderTarget(texSize, texSize, {
    format,
    type,
    wrapS: defaultWrap,
    wrapT: defaultWrap,
    minFilter: defaultMinFilter,
    magFilter: defaultMagFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
};

export const createPingPongRTPair = (
  format: THREE.PixelFormat,
  type: THREE.TextureDataType
) => {
  return {
    rt0: createRT(format, type),
    rt1: createRT(format, type),
    swap() {
      const rt1 = this.rt1;
      this.rt1 = this.rt0;
      this.rt0 = rt1;
    },
  };
};

export const createQuadGPUComputation = (renderer: THREE.WebGLRenderer) => {
  const computingScene = new THREE.Scene();
  const computingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  // const quadMatrial = new THREE.MeshPhongMaterial();
  const quadMesh = new THREE.Mesh<THREE.PlaneGeometry, any>(quadGeo, null);
  computingScene.add(quadMesh);

  return (mat: THREE.ShaderMaterial, uniforms: Record<string, any>) => {
    for (const name in uniforms) {
      mat.uniforms[name].value = uniforms[name];
    }
    quadMesh.material = mat;
    renderer.render(computingScene, computingCamera);
  };
};

export const createInitialDataTexture = () => {
  const data = new Float32Array(texTotal * 2);

  const width = texSize;
  const height = texSize;

  const peakHeight = 0.1,
    spread = 0.05;

  // 填充高斯波峰
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 將像素坐標歸一化到 [0, 1]
      const u = x / (width - 1);
      const v = 1 - y / (height - 1); // 翻轉 y 軸，匹配 uv 原點 (左下)

      // 計算到中心的距離
      const dist = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2);

      // 高斯函數：h = peakHeight * exp(-dist^2 / (2 * spread^2))
      const h = peakHeight * Math.exp(-(dist * dist) / (2 * spread * spread));

      // 存儲到數據數組
      const baseIndex = (y * width + x) * 2;
      data[baseIndex] = h; // R 通道：高度
      data[baseIndex + 1] = 0.0; // G 通道：默認 0
    }
  }

  const tex = new THREE.DataTexture(
    data,
    texSize,
    texSize,
    THREE.RGFormat,
    THREE.FloatType,
    null,
    defaultWrap,
    defaultWrap,
    defaultMagFilter,
    defaultMinFilter
  );

  tex.needsUpdate = true;
  return tex;
};

export function initializeSeaHeightMap(
  waveAmplitude = 0.01,
  waveFrequency = 10.0
) {
  // width, height: 紋理尺寸
  // waveAmplitude: 波浪最大高度（R 通道，建議 0.05，匹配 clamp(-0.5, 0.5)）
  // waveFrequency: 波浪頻率（控制波長，10.0 為中等波浪）

  const width = texSize;
  const height = texSize;

  const data = new Float32Array(texTotal * 2);

  // 隨機相位（模擬自然波浪）
  const phase = Math.random() * 2 * Math.PI;

  // 填充波浪高度
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 歸一化到 [0, 1]
      const u = x / (width - 1);
      const v = 1 - y / (height - 1); // 翻轉 y 軸，匹配 uv

      // 多頻正弦波疊加
      const h =
        waveAmplitude *
        (Math.sin(waveFrequency * u + phase) *
          Math.cos(waveFrequency * v + phase) +
          0.5 *
            Math.sin(2.0 * waveFrequency * u + phase * 1.5) *
            Math.cos(2.0 * waveFrequency * v + phase * 1.5));

      // 索引：每個像素占兩個值
      const baseIndex = (y * width + x) * 2;
      data[baseIndex] = h; // R 通道：高度
      data[baseIndex + 1] = 0.0; // G 通道：默認 0
    }
  }

  // 創建 DataTexture
  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGFormat,
    THREE.FloatType
  );

  texture.wrapS = defaultWrap;
  texture.wrapT = defaultWrap;
  texture.minFilter = defaultMinFilter;
  texture.magFilter = defaultMagFilter;
  texture.needsUpdate = true;

  return texture;
}

export function initializeRandomHeightMap() {
  const width = texSize;
  const height = texSize;

  const data = new Float32Array(texTotal * 2);

  for (let i = 0; i < texTotal; i++) {
    const baseIndex = i * 2;
    data[baseIndex] = Math.random() * 0.005 + 0.001;
    data[baseIndex + 1] = 0.0;
  }

  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGFormat,
    THREE.FloatType
  );

  texture.wrapS = defaultWrap;
  texture.wrapT = defaultWrap;
  texture.minFilter = defaultMinFilter;
  texture.magFilter = defaultMagFilter;

  texture.needsUpdate = true;
  return texture;
}

export class AysncShaderMaterial<
  T extends Record<string, any>
> extends THREE.ShaderMaterial {
  ready = false;

  constructor(inputs: T, fragShaderUrl: string, vertShaderUrl: string = null) {
    super({
      precision: "highp",
      uniforms: objToUniforms({
        dt: dt,
        dx: dx,
        g: g,
        hbase: hbase,
        windStrength: windStrength,
        damping: damping,
        texSize,
        texTotal,
        ...inputs,
      }),
      vertexShader: `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
      `,
      fragmentShader: `
      void main() {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      }
      `,
    });

    (async () => {
      if (vertShaderUrl) {
        this.vertexShader = await httpGet(vertShaderUrl);
      }

      this.fragmentShader = await httpGet(fragShaderUrl);

      this.needsUpdate = true;
      this.ready = true;
    })();
  }
}

function objToUniforms(
  inputs: Record<string, any>
): Record<string, THREE.IUniform<any>> {
  return Object.fromEntries(
    Object.entries(inputs).map((ent) => {
      return [ent[0], { value: ent[1] }];
    })
  );
}

function httpGet(url: string) {
  return fetch(url).then((r) => r.text());
}

export class Water extends THREE.Mesh<
  THREE.PlaneGeometry,
  THREE.ShaderMaterial
> {
  constructor(readonly scaleXy: number = 50, readonly scaleZ = 3) {
    const geo = new THREE.PlaneGeometry(1, 1, texSize - 1, texSize - 1);
    super(
      geo,
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        precision: "highp",
        uniforms: {
          dx: { value: dx },
          dy: { value: dx },
          scaleXy: { value: scaleXy },
          scaleZ: { value: scaleZ },
          uHeightTex: { value: null },
          viewPos: { value: null }, // 攝影機位置
          lightPos: { value: new THREE.Vector3(10.0, 10.0, 10.0) }, // 光源位置
          lightColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, // 白色光
          waterColor: { value: new THREE.Vector3(0.0, 0.3, 0.5) }, // 水藍色
        },
        vertexShader: `
      uniform sampler2D uHeightTex;
      uniform float scaleXy;
      uniform float scaleZ;

      out vec2 vUv;

      void main() {
        vUv = uv;
        float z = texture(uHeightTex, vec2(position)).r;
        vec3 pos = vec3(position.x * scaleXy, position.y * scaleXy, z * scaleZ);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
      `,
        fragmentShader: `
        uniform sampler2D uHeightTex;
        uniform float dx;
        uniform float dy;
        
        uniform vec3 lightPos;      // 光源位置 (世界空間)
        uniform vec3 viewPos;       // 攝影機位置
        uniform vec3 lightColor;    // 光源顏色
        uniform vec3 waterColor;    // 水面顏色

        in vec2 vUv;

        vec3 calcNormal(vec2 uv) {
          vec2 texelSize = vec2(dx, dy);
          float h_left = texture(uHeightTex, uv + vec2(-texelSize.x, 0.0)).r;
          float h_right = texture(uHeightTex, uv + vec2(texelSize.x, 0.0)).r;
          float h_up = texture(uHeightTex, uv + vec2(0.0, texelSize.y)).r;
          float h_down = texture(uHeightTex, uv + vec2(0.0, -texelSize.y)).r;
          return normalize(vec3((h_right - h_left) / (2.0 * dx), (h_up - h_down) / (2.0 * dx), 1.0));
        }

        void main() {
          vec3 normal = calcNormal(vUv);
          float h = texture(uHeightTex, vUv).r;
          vec3 fragPos = vec3(vUv.x, vUv.y, h);

          // 光照計算
          vec3 lightDir = normalize(lightPos - fragPos); // 光源方向
          vec3 viewDir = normalize(viewPos - fragPos);   // 觀察方向

          // 漫反射
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = diff * lightColor;

          // 高光 (Blinn-Phong)
          vec3 halfwayDir = normalize(lightDir + viewDir);
          float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);
          vec3 specular = spec * lightColor * 0.5;

          // 菲涅耳
          float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);
          vec3 reflectColor = vec3(0.8, 0.9, 1.0); // 環境反射顏色
          vec3 finalColor = mix(waterColor, reflectColor, fresnel);

          // 組合光照
          vec3 color = finalColor * (diffuse + specular);

          gl_FragColor =  vec4(color, 1.0);
          // gl_FragColor= vec4(vUv, 0.0, 1.0);
        }
        `,
      })
    );

    this.frustumCulled = false;

    // const pts: number[] = [];

    // for (let x = 0; x < texSize; x++) {
    //   for (let y = 0; y < texSize; y++) {
    //     pts.push((x + 0.5) / texSize, (y + 0.5) / texSize, 0);
    //   }
    // }

    // geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  }
}
