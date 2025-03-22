import * as THREE from "three";

import * as tween from "@tweenjs/tween.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import "./controls.js";
import "./panel.js";
import { createDialog } from "./dialog.js";
import { debounce } from "./Fun-SolarSystem/utils.js";

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;

const tweenGroup = new tween.Group();

const setup = () => {
  const element = document.querySelector("#PgApp")!;

  // Create the scene
  scene = new THREE.Scene();

  // Create a camera (Field of view, aspect ratio, near and far clipping plane)
  camera = new THREE.PerspectiveCamera(
    __config__.camFov,
    1 / 1,
    __config__.camNear,
    __config__.camFar
  );

  // Create a WebGLRenderer and attach it to the DOM
  renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio); // 避免模糊

  __renderers__.push(renderer);

  element.appendChild(renderer.domElement);

  const whenClientViewResized = () => {
    const vW = element.clientWidth;
    const vH = element.clientHeight;

    __viewport__.width = vW;
    __viewport__.height = vH;

    camera.aspect = vW / vH;
    camera.updateProjectionMatrix();

    for (const r of __renderers__) r.setSize(vW, vH);
  };

  whenClientViewResized();

  // Position the camera so it's not inside the cube
  camera.position.set(...__config__.camPos);
  renderer.setClearColor(0x0d0f0e);

  const cameraCtrls = new OrbitControls(camera, renderer.domElement);

  cameraCtrls.enablePan = true;
  cameraCtrls.enableDamping = true;

  cameraCtrls.autoRotate = false;
  cameraCtrls.autoRotateSpeed = 0.07;
  cameraCtrls.update();

  __updateCameraControls__ = (rs: number, zs: number) => {
    cameraCtrls.rotateSpeed = rs;
    cameraCtrls.zoomSpeed = zs;
    cameraCtrls.update();
  };

  const clock = new THREE.Clock();

  const stats = new Stats();

  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  stats.dom.style.display = "block";
  stats.dom.style.position = "static";
  stats.dom.style.borderBottom = "1px dashed #ddd";
  stats.dom.style.paddingBottom = "4px";
  stats.dom.style.marginBottom = "4px";
  document.querySelector("#PgAppControls").appendChild(stats.dom);

  // Animation function
  const animate = () => {
    requestAnimationFrame(animate);

    stats.begin();

    renderer.clearColor();

    const delta = clock.getDelta();
    cameraCtrls.update(delta);

    for (const item of frameFnsAdded) {
      if (item.per) {
        item.skip++;
        item.delta += delta;
        if (item.delta >= item.per) {
          item.fn(scene, camera, renderer, item.delta, item.skip);
          item.delta = 0;
          item.skip = 0;
        }
      } else {
        item.fn(scene, camera, renderer, delta, 1);
      }
    }

    tweenGroup.update();

    // Render the scene from the perspective of the camera
    for (const k in __renderers__) __renderers__[k].render(scene, camera);

    stats.end();
  };

  window.onerror = (err) => {
    console.log("onerror", err);
  };

  window.onunhandledrejection = (err) => {
    console.log("onunhandledrejection", err);
  };

  const debounced_whenClientViewResized = debounce(whenClientViewResized);

  new ResizeObserver(debounced_whenClientViewResized).observe(element, {
    box: "border-box",
  });

  let nextframefnId = 0;
  const frameFnsAdded: AddNextFrameFnItem[] = [];

  __add_nextframe_fn__ = (fn: NextFrameFn, per?: number) => {
    const id = nextframefnId++;
    frameFnsAdded.push({ id, fn, per: per ?? null, delta: 0, skip: 0 });
    return id;
  };

  __remove_nextframe_fn__ = (id: number) => {
    const index = frameFnsAdded.findIndex((x) => x.id === id);
    if (index === -1) return;
    frameFnsAdded.splice(index, 1);
  };

  // Start the animation loop
  animate();
};

const bootstrap = () => {
  setup();

  __main__?.(scene, camera, renderer);
  __updateTHREEJs__?.(null, null);
  __updateControlsDOM__?.();
};

setTimeout(bootstrap);

/**
 * __3__
 */
{
  type Vec3 = [number, number, number];

  const deaultLightDir = new THREE.Vector3(0, 0, 1);

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
      intensity: number = 0.6,
      direction: THREE.Vector3 = deaultLightDir
    ) => {
      const light = new THREE.DirectionalLight(c, intensity);
      light.position.copy(direction);

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
    axes: (on = true, size: number = 5) => {
      if (on) {
        if (__3__cache__["axes"]) return;
        const axesHelper = new THREE.AxesHelper(size); // 5 is the size of the axes
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
    line: (...ps: Vec3[]) => {
      const points = ps.map((p) => new THREE.Vector3(...p));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0xffffff });
      const line = new THREE.Line(geometry, material);
      scene.add(line);

      return {
        update: (...pts: Vec3[]) => {},
        update2: (...vs: THREE.Vector3[]) => {
          geometry.setFromPoints(vs);
        },
      };
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
    track: (p: Vec3, color: THREE.ColorRepresentation) => {
      const pts = [p];

      const geometry = new THREE.BufferGeometry();

      const points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ color })
      );

      const build = () => {
        const array = new Float32Array(pts.flat());
        geometry.setAttribute("position", new THREE.BufferAttribute(array, 3));
      };

      scene.add(points);

      return {
        position: new THREE.Vector3(...p),
        userData: {},
        append: (_pts: Vec3[]) => {
          pts.push(..._pts);
          build();
        },
      };
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
    L: (color: THREE.ColorRepresentation, ...ps: Vec3[]) => {
      const points = ps.map((p) => new THREE.Vector3(...p));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color });
      const line = new THREE.Line(geometry, material);
      return line;
    },
    crs: (obj3d: THREE.Object3D, size = 5) => {
      const lineX = __3__.L(0xe10191, [0, 0, 0], [size, 0, 0]);
      const lineY = __3__.L(0x02fe01, [0, 0, 0], [0, size, 0]);
      const lineZ = __3__.L(0x3491fe, [0, 0, 0], [0, 0, size]);
      obj3d.add(lineX, lineY, lineZ);
    },
    deg2rad: Math.PI / 180,
    rad2deg: 180 / Math.PI,
    aX: new THREE.Vector3(1, 0, 0),
    aY: new THREE.Vector3(0, 1, 0),
    aZ: new THREE.Vector3(0, 0, 1),
  };

  const __3__cache__: { [k: string]: any } = {};

  Object.assign(__3_objects__, Utils);
}

__info__ = (md: string) => {
  const button = document.createElement("a");
  button.innerText = "Info";
  button.className = "MenuButton";
  button.onclick = () => {
    createDialog({
      width: 860,
      title: "Info",
      content: markdown.toHTML(md),
    });
  };

  document.querySelector("#Menu .MenuButtons").appendChild(button);
};

__contact__ = () => {
  const button = document.createElement("a");
  button.innerText = "Touch";
  button.className = "MenuButton";
  button.onclick = () => {
    createDialog({
      css: `img  { width: 200px; vertical-align: middle; } `,
      width: 420,
      title: "Contact",
      content: markdown.toHTML(`
- mail: zhangxinghai79@gmail.com
- wx: ![wx](https://zxh1989.oss-cn-qingdao.aliyuncs.com/20181105/151627_71615.jpg)
- tel: +86-18742538743
- github: [https://github.com/zxh19890103](https://github.com/zxh19890103)
- blog: [https://www.zhangxinghai.cn/](https://www.zhangxinghai.cn/)
        `),
    });
  };

  document.querySelector("#Menu .MenuButtons").appendChild(button);
};

__relativeURL__ = (path: string) => {
  if (path.startsWith("/")) return path;

  const segments = location.pathname.split(/\//g).filter(Boolean);
  const segmentsTojoin = path.split(/\//g).filter(Boolean);

  for (const seg of segmentsTojoin) {
    if (seg === "..") {
      segments.pop();
      continue;
    }

    if (seg === ".") continue;

    segments.push(seg);
  }

  return "/" + segments.join("/");
};

__createAnimation__ = (
  target: any,
  to: Record<string, number>,
  duration: number,
  overFn?: VoidFunction,
  updateFn?: VoidFunction
) => {
  const t = new tween.Tween(target).to(to, duration);

  overFn && t.onComplete(overFn);
  updateFn && t.onUpdate(updateFn);

  tweenGroup.add(t);

  return t;
};
