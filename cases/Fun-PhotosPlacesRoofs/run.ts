/**
 * Generated Automatically At Wed May 06 2026 12:39:33 GMT+0800 (China Standard Time);
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
  renderer: THREE.WebGLRenderer,
) => {
  // your code

  function calculateGabledRoof(
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p3: THREE.Vector3,
    ridgeHeight: number,
  ) {
    // 1. Define Direction Vectors
    const v01 = new THREE.Vector3().subVectors(p1, p0); // Vector from P0 to P1
    const v03 = new THREE.Vector3().subVectors(p3, p0); // Vector from P0 to P3
    const hVec = new THREE.Vector3(0, 0, ridgeHeight); // Vertical "凸起" vector

    // 2. Calculate P4 (Your Formula: P0 + P03(0.5) + P01(0.2) + H)
    const p4 = new THREE.Vector3()
      .copy(p0)
      .addScaledVector(v01, 0.2)
      .addScaledVector(v03, 0.5)
      .add(hVec);

    // 3. Calculate P5 (Your Formula: P0 + P01(0.8) + P03(0.5) + H)
    const p5 = new THREE.Vector3()
      .copy(p0)
      .addScaledVector(v01, 0.8)
      .addScaledVector(v03, 0.5)
      .add(hVec);

    return [p4, p5];
  }

  const polygon = [
    [
      [102.5952761, 24.9642086],
      [102.5952358, 24.9641991],
      [102.5952462, 24.9641623],
      [102.5952866, 24.9641718],
      [102.5952761, 24.9642086],
    ],
  ];

  const p0 = new THREE.Vector3(0, 0, 0);
  const p1 = new THREE.Vector3(1, 0, 0);
  const p2 = new THREE.Vector3(1, 1, 0);
  const p3 = new THREE.Vector3(0, 1, 0);

  const coords = [p0, p1, p2, p3];

  const oneMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.ShaderMaterial({
      vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        void main() {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); 
        }
      `,
      wireframe: true,
    }),
  );

  const [p4, p5] = calculateGabledRoof(coords[0], coords[1], coords[3], 0.5);
  // const pointsArr: number[] = [];

  oneMesh.geometry.setFromPoints([p0, p1, p2, p3, p4, p5]);
  oneMesh.geometry.setIndex([
    0, 4, 5, 5, 1, 0, 1, 5, 2, 0, 3, 4, 2, 5, 4, 2, 4, 3,
  ]); // Triangles for walls and roof

  world.add(oneMesh);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
