import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import "./controls.js";

const element = document.querySelector("#PgApp")!;

// Create the scene
const scene = new THREE.Scene();

// Create a camera (Field of view, aspect ratio, near and far clipping plane)
const camera = new THREE.PerspectiveCamera(75, 1 / 1, 0.1, 1000);

// Create a WebGLRenderer and attach it to the DOM
const renderer = new THREE.WebGLRenderer({});
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
camera.position.z = 5;
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
    cam: () => {
      const helper = new THREE.CameraHelper(camera);
      scene.add(helper);
      return helper;
    },
    grid: () => {
      const grid = new THREE.GridHelper(10, 10);
      scene.add(grid);
      return grid;
    },
    axes: () => {
      const axesHelper = new THREE.AxesHelper(5); // 5 is the size of the axes
      scene.add(axesHelper);
      return axesHelper;
    },
    line: (...ps: Vec3[]): THREE.Line => {
      const points = ps.map((p) => new THREE.Vector3(...p));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0xffffff });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      return line;
    },

    ball: (p: Vec3, r: number): THREE.Mesh => {
      const geometry = new THREE.SphereGeometry(r, 32, 32);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
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
  };

  Object.assign(__3_objects__, Utils);
}
