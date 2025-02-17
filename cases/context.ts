import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import "./controls.js";

const element = document.querySelector("#PgApp")!;

// Create the scene
const scene = new THREE.Scene();

// Create a camera (Field of view, aspect ratio, near and far clipping plane)
const camera = new THREE.PerspectiveCamera(
  75,
  1 / 1,
  0.1,
  Number.MAX_SAFE_INTEGER
);

// Create a WebGLRenderer and attach it to the DOM
const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });

element.appendChild(renderer.domElement);

const onResize = () => {
  const vW = element.clientWidth;
  const vH = element.clientHeight;

  camera.aspect = vW / vH;
  camera.updateProjectionMatrix();

  renderer.setSize(vW, vH);
};

onResize();

// Position the camera so it's not inside the cube
camera.position.z = 1000;
renderer.setClearColor(0x000000);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

const clock = new THREE.Clock();

// Animation function
function animate() {
  requestAnimationFrame(animate);

  renderer.clearColor();
  controls.update(clock.getDelta());

  for (const fn of nextFrameFns) fn(scene, camera, renderer);
  // Render the scene from the perspective of the camera
  renderer.render(scene, camera);
}

new ResizeObserver((ents) => {
  onResize();
}).observe(element, { box: "border-box" });

const nextFrameFns: NextFrameFn[] = [];

__add_nextframe_fn__ = (fn: NextFrameFn) => {
  nextFrameFns.push(fn);
};

setTimeout(() => {
  __main__?.(scene, camera, renderer);
  __updateTHREEJs__?.(null, null);
  __updateControlsDOM__?.();
}, 0);

// Start the animation loop
animate();

{
  type Vec3 = [number, number, number];

  const Utils = {
    ambLight: (
      c: THREE.ColorRepresentation = 0xffffff,
      intensity: number = 0.6
    ) => {
      const light = new THREE.AmbientLight(c, intensity);
      scene.add(light);
    },
    dirLight: (
      c: THREE.ColorRepresentation = 0xffffff,
      intensity: number = 0.6
    ) => {
      const light = new THREE.DirectionalLight(c, intensity);
      scene.add(light);
      return {
        helper: (size: number, color: THREE.ColorRepresentation) => {
          const helper = new THREE.DirectionalLightHelper(light, size, color);
          scene.add(helper);
        },
      };
    },
    ptLight: (
      c: THREE.ColorRepresentation = 0xffffff,
      intensity: number = 0.6,
      dist: number = 1,
      decay: number = 0
    ) => {
      const light = new THREE.PointLight(c, intensity, dist, decay);
      scene.add(light);
      light.position.set(0, 0, 0);
      return {
        helper: (size: number, color: THREE.ColorRepresentation) => {
          const helper = new THREE.PointLightHelper(light, size, color);
          scene.add(helper);
        },
      };
    },
    cam: (on = true) => {
      const helper = new THREE.CameraHelper(camera);
      scene.add(helper);
      return helper;
    },
    grid: (on = true) => {
      if (on) {
        if (__3__cache__["grid"]) return;
        const grid = new THREE.GridHelper(10, 10);
        scene.add(grid);
        __3__cache__["grid"] = grid;
        return grid;
      } else {
        if (__3__cache__["grid"]) {
          scene.remove(__3__cache__["grid"]);
          __3__cache__["grid"] = null;
        }
      }
    },
    axes: (on = true) => {
      if (on) {
        if (__3__cache__["axes"]) return;
        const axesHelper = new THREE.AxesHelper(5); // 5 is the size of the axes
        scene.add(axesHelper);
        __3__cache__["axes"] = axesHelper;
        return axesHelper;
      } else {
        if (__3__cache__["axes"]) {
          scene.remove(__3__cache__["axes"]);
          __3__cache__["axes"] = null;
        }
      }
    },
    line: (...ps: Vec3[]): THREE.Line => {
      const points = ps.map((p) => new THREE.Vector3(...p));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0xffffff });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      return line;
    },

    ball: (
      p: Vec3,
      r: number,
      color?: THREE.ColorRepresentation,
      wire?: boolean
    ): THREE.Mesh => {
      const geometry = new THREE.SphereGeometry(r, 32, 32);
      const material = new THREE.MeshStandardMaterial({
        color: color ?? 0xffffff,
        wireframe: wire ?? false,
        metalness: 0.8,
        roughness: 0.6,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(...p);
      scene.add(sphere);
      return sphere;
    },

    box: (p0: Vec3, l: number, w: number, h: number): THREE.Mesh => {
      const geometry = new THREE.BoxGeometry(l, w, h);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
      });
      const box = new THREE.Mesh(geometry, material);
      box.position.set(...p0);
      scene.add(box);
      return box;
    },

    plane: (c: Vec3, l: number, w: number): THREE.Mesh => {
      const geometry = new THREE.PlaneGeometry(l, w);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        wireframe: true,
      });
      const plane = new THREE.Mesh(geometry, material);
      plane.position.set(...c);
      scene.add(plane);
      return plane;
    },
    vec: (x: number, y: number, z: number) => new THREE.Vector3(x, y, z),
    l: (color: THREE.ColorRepresentation, ...ps: Vec3[]) => {
      const points = ps.map((p) => new THREE.Vector3(...p));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color });
      const line = new THREE.Line(geometry, material);
      return line;
    },
    deg2rad: Math.PI / 180,
    rad2deg: 180 / Math.PI,
    grid3d: (size: number, divisions: number) => {},
    crs: (obj3d: THREE.Object3D) => {
      const lineX = __3__.l(0xe10191, [0, 0, 0], [5, 0, 0]);
      const lineY = __3__.l(0x02fe01, [0, 0, 0], [0, 5, 0]);
      const lineZ = __3__.l(0x3491fe, [0, 0, 0], [0, 0, 5]);
      obj3d.add(lineX, lineY, lineZ);
    },
  };

  const __3__cache__: { [k: string]: any } = {};

  Object.assign(__3_objects__, Utils);
}
