/**
 * Generated Automatically At Sun Apr 19 2026 18:30:46 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let enableGrid = false;
let enableAxes = false;

//#region reactive
__dev__();
__defineControl__("enableGrid", "bit", enableGrid);
__defineControl__("enableAxes", "bit", enableAxes);

__config__.camPos = [0, 2000, 0];
__config__.camFar = 1e4;
__config__.camNear = 0.1;
__config__.background = 0xffffff;

__updateControlsDOM__ = () => {
  __renderControls__({
    enableAxes,
    enableGrid,
    threhold,
    enableDistanceDarken,
    darkenNear,
    darkenFar,
    darkenStrength,
    enableOutline,
    outlineStrength,
    outlineInner,
    outlineOuter,
    outlineColor,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  cameraCtrls: OrbitControls,
) => {
  // your code
  const textureLoader = new THREE.TextureLoader(new THREE.LoadingManager());

  const tile = new THREE.Mesh(
    new THREE.PlaneGeometry(1024, 1024),
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: `
          varying vec2 vUv;
          
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
      fragmentShader: `
          uniform sampler2D tileMap;
          uniform float threhold;
          varying vec2 vUv;

          void main() {
            vec4 tileColor = texture2D(tileMap, vUv);
            gl_FragColor = vec4(0.9, 0.8, 1.0, 1.0);
          }
        `,
      uniforms: {
        threhold: {
          value: 0.35,
        },
        tileMap: {
          value: textureLoader.load("./tilepic-16-field.jpeg"),
        },
      },
    }),
  );

  const quadSize = 300;
  const treePositions = new Float32Array(4 * quadSize * quadSize);
  const pointPositions = new Float32Array(3 * quadSize * quadSize);

  for (let i = 0; i < quadSize; i++) {
    for (let j = 0; j < quadSize; j++) {
      const index = 4 * (i * quadSize + j);
      treePositions[index] = 10 + Math.random() * 60; // size
      treePositions[index + 1] = 0; //
      treePositions[index + 2] = 0; // z, can be used for depth-based effects in shader
      treePositions[index + 3] = Math.floor(Math.random() * 64); // w (for potential future use)

      const pIndex = 3 * (i * quadSize + j);
      // Keep points aligned with the 1024x1024 plane centered at world origin.
      pointPositions[pIndex] = Math.random() * 1024 - 512;
      pointPositions[pIndex + 1] = Math.random() * 1024 - 512;
      pointPositions[pIndex + 2] = 0; // z, can be used for depth-based effects in shader
    }
  }

  const geo = new THREE.BufferGeometry();

  const treeAtlasMap = textureLoader.load("./in-one.png");
  treeAtlasMap.minFilter = THREE.LinearFilter;
  treeAtlasMap.magFilter = THREE.LinearFilter;

  const drawingBufferSize = new THREE.Vector2();
  renderer.getDrawingBufferSize(drawingBufferSize);

  const cameraPosLive: THREE.Vector3 = new THREE.Vector3();
  let cameraPolarAngle: number = 90 * THREE.MathUtils.DEG2RAD;

  cameraPosLive.copy(camera.position);
  cameraPolarAngle = Math.PI / 2 - cameraCtrls.getPolarAngle();

  // cameraCtrls.addEventListener("change", () => {
  //   cameraPosLive.copy(camera.position);
  //   cameraPolarAngle = Math.PI / 2 - cameraCtrls.getPolarAngle();

  //   console.log(
  //     `Camera Pos: (${cameraPosLive.x.toFixed(2)}, ${cameraPosLive.y.toFixed(
  //       2,
  //     )}, ${cameraPosLive.z.toFixed(2)}), Polar Angle: ${(cameraPolarAngle * THREE.MathUtils.RAD2DEG).toFixed(2)}°`,
  //   );
  // });

  const pointTrees = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: true,
      vertexShader: `
        uniform float size;
        uniform float uViewportHeight;
        uniform vec3 uCameraPos;
        uniform float uCameraPolarAngle;

        attribute vec4 places; // x, y, z, randomValue

        varying vec2 vUv;
        varying float vCamDist;
        flat out float vType;
        flat out float vSize;
        
        void main() {
          vec4 vPos = modelViewMatrix * vec4(position.xyz, 1.0);
          
          vType = places.w;
          vSize = places.x;
          vUv = 0.5 + position.xy / 1024.0; // Assuming the tile is 1024x1024, adjust if different
          vec3 worldPos = (modelMatrix * vec4(position.xyz, 1.0)).xyz;
          vCamDist = distance(worldPos, uCameraPos);

          gl_PointSize = vSize * (300.0 / -vPos.z);
          vec4 clipPos = projectionMatrix * vPos;
          float topViewBlend = smoothstep(radians(55.0), radians(65.0), uCameraPolarAngle);

          // Disable the bottom-anchor lift near top view so circular crowns stay centered on ground.
          clipPos.y += (gl_PointSize / max(1.0, uViewportHeight)) * clipPos.w * (1.0 - topViewBlend);

          gl_Position = clipPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform sampler2D treeAtlasMap;
        uniform sampler2D tileMap;
        uniform float threhold;
        uniform float enableDistanceDarken;
        uniform float darkenNear;
        uniform float darkenFar;
        uniform float darkenStrength;
        uniform float enableOutline;
        uniform float outlineStrength;
        uniform float outlineInner;
        uniform float outlineOuter;
        uniform float uCameraPolarAngle;
        uniform vec3 outlineColor;

        varying vec2 vUv;
        varying float vCamDist;
        flat in float vType;

        void main() {
          float vegfactor = texture2D(map, vUv).r;
          vegfactor = step(threhold, vegfactor); // simple threshold to create a binary mask

          if (vegfactor < 0.5) discard; // discard non-vegetation points

          vec2 uv = gl_PointCoord;
          vec2 uv0 = uv;
          uv.y = 1.0 - uv.y;

          float column = mod(vType, 8.0);
          float row = floor(vType / 8.0);
          float topViewBlend = smoothstep(radians(55.0), radians(65.0), uCameraPolarAngle);

          // Use vType to select the appropriate tree from the atlas.
          uv.x = uv.x * 0.125 + column * 0.125;
          uv.y = uv.y * 0.125 + row * 0.125;

          vec4 baseColor = texture2D(treeAtlasMap, uv);
          vec2 atlasCenterUv = vec2((column + 0.5) * 0.125, (row + 0.5) * 0.125);
          vec3 atlasCenterColor = texture2D(treeAtlasMap, atlasCenterUv).rgb;
          vec2 circleCentered = gl_PointCoord - 0.5;
          float circleRadius = length(circleCentered) * 2.0;
          float circleMask = 1.0 - smoothstep(0.78, 1.0, circleRadius);

          if (baseColor.a < 0.1 && circleMask < 0.01) discard; // discard empty pixels in both render modes

          float alphaN = clamp(baseColor.a, 0.0, 1.0);
          vec2 centered = gl_PointCoord - 0.5;
          float uvRadius = clamp(length(centered) * 2.0, 0.0, 1.0);

          // Build an edge mask from alpha falloff and sprite rim for stable outlines.
          float alphaEdge = 1.0 - smoothstep(outlineInner, outlineOuter, alphaN);
          float uvEdge = smoothstep(0.62, 0.98, uvRadius);
          float bodyMask = smoothstep(0.08, 0.35, alphaN);
          float edgeMask = max(alphaEdge, uvEdge * bodyMask);
          edgeMask *= outlineStrength * enableOutline;

          vec3 mixColor = texture2D(tileMap, vUv).rgb;

          baseColor.rgb = mix(baseColor.rgb, mixColor, 0.5); // Blend tree color with tile color for better integration

          vec3 circleColor = mix(atlasCenterColor, mixColor, 0.35);
          circleColor *= 1.05 - smoothstep(0.0, 1.0, circleRadius) * 0.35;

          vec3 shadedBillboardColor = mix(baseColor.rgb, outlineColor, clamp(edgeMask, 0.0, 1.0));
          vec3 shadedCircleColor = mix(circleColor, outlineColor, smoothstep(0.72, 1.0, circleRadius) * 0.45 * enableOutline);

          vec3 finalColor = mix(shadedBillboardColor, shadedCircleColor, topViewBlend);
          float finalAlpha = mix(1.0, circleMask, topViewBlend);

          if (finalAlpha < 0.01) discard;

          float darkenT = smoothstep(darkenNear, max(darkenNear + 0.001, darkenFar), vCamDist);
          float darkenMul = mix(1.0, 1.0 - darkenStrength, darkenT * enableDistanceDarken);
          finalColor *= darkenMul;

          finalColor *= mix(1.0 - uv0.y, 1.0, topViewBlend);

          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `,
      uniforms: {
        tileMap: {
          value: textureLoader.load("./tilepic-16-field.jpeg"),
        },
        size: {
          value: 20,
        },
        uViewportHeight: {
          value: Math.max(1, drawingBufferSize.y),
        },
        threhold: {
          value: 0.35,
        },
        enableDistanceDarken: {
          value: enableDistanceDarken ? 1 : 0,
        },
        darkenNear: {
          value: darkenNear,
        },
        darkenFar: {
          value: darkenFar,
        },
        darkenStrength: {
          value: darkenStrength,
        },
        treeAtlasMap: {
          value: treeAtlasMap,
        },
        enableOutline: {
          value: enableOutline ? 1 : 0,
        },
        outlineStrength: {
          value: outlineStrength,
        },
        outlineInner: {
          value: outlineInner,
        },
        outlineOuter: {
          value: outlineOuter,
        },
        outlineColor: {
          value: new THREE.Color(outlineColor),
        },
        uCameraPos: {
          value: cameraPosLive,
        },
        uCameraPolarAngle: {
          value: cameraPolarAngle,
        },
        map: {
          // value: textureLoader.load("./veg_exg_mask-tilepic-16-field.png"),
          value: textureLoader.load("./veg_exgr_mask-tilepic-16-field.png"),
        },
      },
    }),
  );

  geo.setAttribute("places", new THREE.BufferAttribute(treePositions, 4));
  geo.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));

  world.add(pointTrees, tile);

  cameraCtrls.addEventListener("change", () => {
    cameraPosLive.copy(camera.position);
    cameraPolarAngle = Math.PI / 2 - cameraCtrls.getPolarAngle();

    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.uCameraPos.value.copy(cameraPosLive);
    material.uniforms.uCameraPolarAngle.value = cameraPolarAngle;
  });

  __add_nextframe_fn__((_s, _c, r) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    r.getDrawingBufferSize(drawingBufferSize);
    material.uniforms.uViewportHeight.value = Math.max(1, drawingBufferSize.y);
  });

  __updateTHREEJs__only__.threhold = (val) => {
    // const material = tile.material as THREE.ShaderMaterial;
    const material2 = pointTrees.material as THREE.ShaderMaterial;

    // material.uniforms.threhold.value = val;
    material2.uniforms.threhold.value = val;
  };

  __updateTHREEJs__only__.enableDistanceDarken = (val) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.enableDistanceDarken.value = val ? 1 : 0;
  };

  __updateTHREEJs__only__.darkenNear = (val) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.darkenNear.value = val;
  };

  __updateTHREEJs__only__.darkenFar = (val) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.darkenFar.value = val;
  };

  __updateTHREEJs__only__.darkenStrength = (val) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.darkenStrength.value = val;
  };

  __updateTHREEJs__only__.enableOutline = (val) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.enableOutline.value = val ? 1 : 0;
  };

  __updateTHREEJs__only__.outlineStrength = (val) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.outlineStrength.value = val;
  };

  __updateTHREEJs__only__.outlineInner = (val) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.outlineInner.value = val;
  };

  __updateTHREEJs__only__.outlineOuter = (val) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.outlineOuter.value = val;
  };

  __updateTHREEJs__only__.outlineColor = (val) => {
    const material = pointTrees.material as THREE.ShaderMaterial;
    material.uniforms.outlineColor.value.set(val);
  };

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

let threhold = 0.35;
let enableDistanceDarken = true;
let darkenNear = 400;
let darkenFar = 1000;
let darkenStrength = 0.55;
let enableOutline = false;
let outlineStrength = 0.8;
let outlineInner = 0.45;
let outlineOuter = 0.9;
let outlineColor = 0x0f2a0a;

__defineControl__("threhold", "range", threhold, {
  fixed: 2,
  ...__defineControl__.r01(),
});
__defineControl__("enableDistanceDarken", "bit", enableDistanceDarken);
__defineControl__("darkenNear", "range", darkenNear, {
  min: 0,
  max: 5000,
  fixed: 0,
});
__defineControl__("darkenFar", "range", darkenFar, {
  min: 200,
  max: 2000,
  fixed: 0,
});
__defineControl__("darkenStrength", "range", darkenStrength, {
  fixed: 2,
  ...__defineControl__.r01(),
});
__defineControl__("enableOutline", "bit", enableOutline);
__defineControl__("outlineStrength", "range", outlineStrength, {
  fixed: 2,
  ...__defineControl__.r01(),
});
__defineControl__("outlineInner", "range", outlineInner, {
  fixed: 2,
  ...__defineControl__.r01(),
});
__defineControl__("outlineOuter", "range", outlineOuter, {
  fixed: 2,
  ...__defineControl__.r01(),
});
__defineControl__("outlineColor", "color", outlineColor);
