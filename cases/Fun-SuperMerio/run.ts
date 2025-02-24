/**
 * Generated Automatically At Sat Feb 22 2025 14:19:40 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

let enableGrid = false;
let enableAxes = false;

//#region reactive
// __dev__();
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

__config__.camPos = [0, 0, 10];

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  let $merio: THREE.Mesh;

  const buildings = new THREE.Object3D();

  const createBuilding = (
    pos: Vec3,
    w: number,
    l: number,
    h: number,
    color: THREE.ColorRepresentation,
    texture: THREE.Texture = null
  ) => {
    const geo = new THREE.BoxGeometry(w, l, h);
    const mat = new THREE.MeshStandardMaterial({ color, map: texture });
    const building = new THREE.Mesh(geo, mat);
    buildings.add(building);
    building.position.set(...pos);
    return building;
  };

  const createSuperMerio = () => {
    const geo = new THREE.SphereGeometry(2, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x33ff91 });
    const merio = new THREE.Mesh(geo, material);
    merio.up.set(0, 0, 1);
    s.add(merio);
    $merio = merio;
    merio.position.set(0, 0, 2);
    return merio;
  };

  const createRandomWorld = () => {
    const geo = new THREE.PlaneGeometry(100, 100, 30, 30);
    const material = new THREE.MeshStandardMaterial({
      color: 0xe91009,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(geo, material);
    s.add(plane);

    const wlimited = 6;
    const llimited = 4;

    const nX = Math.ceil(100 / 12);
    const nY = Math.ceil(100 / 8);

    new THREE.TextureLoader(new THREE.LoadingManager()).load(
      "/assets/images/wall.png",
      (texture) => {
        for (let x = 0; x < nX; x++) {
          for (let y = 0; y < nY; y++) {
            const left = -50 + x * 2 * wlimited;
            const top = -50 + y * 2 * llimited;
            const h = 3 + 6 * Math.random();
            const coord = [
              left + wlimited * Math.random(),
              top + llimited * Math.random(),
              h / 2,
            ] as Vec3;
            createBuilding(coord, wlimited, llimited, h, 0xffffff, texture);
          }
        }
      }
    );

    s.add(buildings);
  };

  __3__.ambLight(0xffffff, 0.9);
  __3__.dirLight(0xffffff, 0.8);

  const speed = new THREE.Vector3(0, 0, 0);
  const step = 0.1;

  const ray = new THREE.Raycaster();
  ray.near = 0;
  ray.far = 2 + step;

  let _intersects: any[] = [];

  const rayVis = __3__.line([0, 0, 0], [1, 1, 1]);
  const rayVis2 = __3__.line([0, 0, 0], [1, 1, 1]);

  __add_nextframe_fn__(() => {
    if (isKeyDown["ArrowUp"]) {
      speed.set(0, step, 0);
    } else if (isKeyDown["ArrowDown"]) {
      speed.set(0, -step, 0);
    } else if (isKeyDown["ArrowLeft"]) {
      speed.set(-step, 0, 0);
    } else if (isKeyDown["ArrowRight"]) {
      speed.set(step, 0, 0);
    } else {
      speed.set(0, 0, 0);
    }

    const leftBoundPosition = new THREE.Vector3()
      .crossVectors($merio.up, speed)
      .setLength(2)
      .add($merio.position);

    ray.set(leftBoundPosition, speed);

    rayVis2.update2(
      leftBoundPosition,
      new THREE.Vector3()
        .copy(speed)
        .setLength(ray.far * 100)
        .add($merio.position)
    );

    const intersects: any[] = [];

    intersects.push(...ray.intersectObject(buildings, true));

    const rightBoundPosition = new THREE.Vector3()
      .crossVectors(speed, $merio.up)
      .setLength(2)
      .add($merio.position);

    ray.set(rightBoundPosition, speed);

    rayVis.update2(
      rightBoundPosition,
      new THREE.Vector3()
        .copy(speed)
        .setLength(ray.far * 100)
        .add($merio.position)
    );

    intersects.push(...ray.intersectObject(buildings, true));

    _intersects.forEach((intersect) => {
      (
        intersect.object as THREE.Mesh<
          THREE.BoxGeometry,
          THREE.MeshStandardMaterial
        >
      ).material.color.set(0xffffff);
    });

    intersects.forEach((intersect) => {
      (
        intersect.object as THREE.Mesh<
          THREE.BoxGeometry,
          THREE.MeshStandardMaterial
        >
      ).material.color.set(0xef9100);
    });

    _intersects = intersects;

    if (intersects.length === 0) {
      if (speed.length() >= 0) {
        $merio.position.add(speed);
      }
    }
  });

  const isKeyDown: Record<string, boolean> = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
  };

  const interctive = () => {
    (document.querySelector(".Content") as HTMLDivElement).style.overflowY =
      "hidden";

    window.addEventListener("keydown", (event) => {
      isKeyDown[event.key] = true;
    });

    window.addEventListener("keyup", (event) => {
      isKeyDown[event.key] = false;
    });
  };

  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  createSuperMerio();
  createRandomWorld();
  interctive();
};
