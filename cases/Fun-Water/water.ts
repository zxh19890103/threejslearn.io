import * as THREE from "three";

export const texSize = 60;

const texTotal = texSize * texSize;

export const createRT = (
  format: THREE.PixelFormat,
  type: THREE.TextureDataType
) => {
  return new THREE.WebGLRenderTarget(texSize, texSize, {
    format,
    type,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
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

export const createQuadComputingScene = (renderer: THREE.WebGLRenderer) => {
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

export const createInitialDataTexture = () => {};

export class Water extends THREE.Points<
  THREE.BufferGeometry,
  THREE.ShaderMaterial
> {
  constructor(gap: number = 100) {
    const geo = new THREE.BufferGeometry();
    super(
      geo,
      new THREE.ShaderMaterial({
        precision: "highp",
        uniforms: {
          uGap: { value: gap },
          uHeightTex: { value: null },
        },
        vertexShader: `
      uniform sampler2D uHeightTex;
      uniform float uGap;

      void main() {
        float z = texture2D(uHeightTex, vec2(position.x, position.y)).r;
        vec4 pos = vec4(position.x, position.y, z, 1.0);

        gl_PointSize = 10.0;
        gl_Position = projectionMatrix * modelViewMatrix * pos;
      }
      `,
        fragmentShader: `
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if(dist > 0.5)
            discard;
          gl_FragColor = vec4(0.7, 0.5, 0.0, 1.0);
        }
        `,
      })
    );

    const pts: number[] = [];

    for (let x = 0; x < texSize; x++) {
      for (let y = 0; y < texSize; y++) {
        pts.push((x + 0.5) / texSize, (y + 0.5) / texSize, 0);
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  }
}
