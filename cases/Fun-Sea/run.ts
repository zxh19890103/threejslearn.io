/**
 * Generated Automatically At Mon May 26 2025 14:50:53 GMT+0800 (China Standard Time);
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

  world.background = new THREE.Color(0x87ceeb); // sky blue
  world.fog = new THREE.Fog(0x87ceeb, 30, 100); // fo

  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(10, 50, 10); // high above
  world.add(sun);

  // Optional: a soft ambient light
  world.add(new THREE.AmbientLight(0x404040));

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  // 1. Create geometry
  const geometry = new THREE.PlaneGeometry(10, 10, 128, 128);

  // 2. Create ShaderMaterial
  const material = new THREE.ShaderMaterial({
    vertexShader: `
    uniform float time;
    varying vec2 vUv;
    varying float vWave;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Simple sine wave based on position + time
      float wave1 = sin(pos.x * 2.0 + time * 1.5) * 0.1;
      float wave2 = cos(pos.y * 3.0 + time * 1.0) * 0.1;

      pos.z += wave1 + wave2;
      vWave = wave1 + wave2;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
    fragmentShader: `
    varying vec2 vUv;
    varying float vWave;

    void main() {
      // Simple blue water

      vec3 waterColor = vec3(0.0, 0.4 + vWave * 0.05, 0.9);
      float fresnel = pow(1.0 - dot(normalize(vec3(0,1,0)), normalize(cameraPosition)), 2.0);
      vec3 color = mix(waterColor, vec3(1.0), fresnel * 0.1); // slight reflectance
      gl_FragColor = vec4(color, 1.0);

      // gl_FragColor = vec4(0.0, 0.5 + 0.5 * vUv.y, 1.0, 1.0);
    }
  `,
    uniforms: {
      time: { value: 0 },
    },
    wireframe: false,
    side: THREE.DoubleSide,
  });

  const sunGeo = new THREE.SphereGeometry(3, 32, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd66 });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.set(-30, 40, -50); // far away in sky
  world.add(sunMesh);

  // 3. Create mesh
  const water = new THREE.Mesh(geometry, material);
  water.rotation.x = -Math.PI / 2;
  world.add(water);

  __add_nextframe_fn__(() => {
    material.uniforms.time.value = performance.now() * 0.001;
  });

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
