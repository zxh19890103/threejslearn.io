/**
 * Generated Automatically At Sat Feb 22 2025 14:19:40 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { Grid, GridCell } from "./grid.js";

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

__config__.camPos = [0, 0, 10];

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  const marioScale = 0.2;

  let $mario: THREE.Group;

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

  const textureLoader = new THREE.TextureLoader(new THREE.LoadingManager());
  const objLoader = new OBJLoader(new THREE.LoadingManager());
  const mtlLoader = new MTLLoader(new THREE.LoadingManager());

  const createSuperMario = () => {
    mtlLoader.load("/cases/Fun-SuperMerio/Mario/mario.mtl", (mat) => {
      mat.preload();
      objLoader.setMaterials(mat);
      objLoader.load("/cases/Fun-SuperMerio/Mario/mario.obj", (obj) => {
        obj.scale.set(marioScale, marioScale, marioScale);
        obj.rotateX(Math.PI / 2);
        obj.up = new THREE.Vector3(0, 0, 1);
        s.add(obj);
        $mario = obj;
      });
    });
  };

  const createRandomWorld = () => {
    const geo = new THREE.PlaneGeometry(100, 100, 30, 30);
    const material = new THREE.MeshStandardMaterial({
      color: 0xe91009,
      side: THREE.DoubleSide,
      visible: false,
    });
    const plane = new THREE.Mesh(geo, material);
    s.add(plane);

    const wlimited = 6;
    const llimited = 4;

    const nX = Math.ceil(100 / 12);
    const nY = Math.ceil(100 / 8);

    textureLoader.load("/assets/images/wall.png", (texture) => {
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

          grid.put(
            createBuilding(coord, wlimited, llimited, h, 0xffffff, texture)
          );
        }
      }
    });

    s.add(buildings);
  };

  __3__.ambLight(0xffffff, 0.9);
  __3__.dirLight(0xffffff, 0.8);

  const speed = new THREE.Vector3(0, 0, 0);

  const face = new THREE.Vector3();

  const step = 3;
  const gravityAcc = new THREE.Vector3(0, 0, -100);
  const jumpAcc = new THREE.Vector3(0, 0, 300);
  const jumpAccCopy = new THREE.Vector3(0, 0, 0);
  let jumpAccTime = 0; // ms;

  let t = performance.now();
  let dt = 0;

  __add_nextframe_fn__(() => {
    const now = performance.now();
    dt = (now - t) / 1000;
    t = now;

    jumpAccTime -= dt;

    if (!$mario) return;

    if (isKeyDown["ArrowUp"]) {
      speed.y = step;
      speed.x = 0;
      face.set(0, step, 0).add($mario.position);
    } else if (isKeyDown["ArrowDown"]) {
      speed.y = -step;
      speed.x = 0;
      face.set(0, -step, 0).add($mario.position);
    } else if (isKeyDown["ArrowLeft"]) {
      speed.x = -step;
      speed.y = 0;
      face.set(-step, 0, 0).add($mario.position);
    } else if (isKeyDown["ArrowRight"]) {
      speed.x = step;
      speed.y = 0;
      face.set(step, 0, 0).add($mario.position);
    } else if (isKeyDown["j"]) {
      //
    } else {
      speed.x = 0;
      speed.y = 0;
      face.setLength(0);
    }

    jumpAccCopy.copy(gravityAcc);

    if (jumpAccTime > 0) {
      jumpAccCopy.add(jumpAcc);
    }

    jumpAccCopy.multiplyScalar(dt);
    speed.add(jumpAccCopy);

    if (face.length() > 0) {
      $mario.lookAt(face);
    }

    const objects = grid.getObjectsAround(
      $mario.position.x,
      $mario.position.y
    ) as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[];

    mariobox.setFromObject($mario);

    if (_intersectObjs) {
      _intersectObjs.forEach((obj) => {
        obj.material.color.set(0xffffff);
      });
    }

    intersectObjs = objects.filter((obj) => {
      const intersected = mariobox.intersectsBox(objbox.setFromObject(obj));
      if (!intersected) return false;
      if (isFront.subVectors(obj.position, $mario.position).dot(speed) > 0) {
        return true;
      }
      return false;
    });

    intersectObjs.forEach((obj) => {
      obj.material.color.set(0xed1211);
    });

    if (intersectObjs.length === 0) {
      speed.multiplyScalar(dt);
      $mario.position.add(speed);
      if ($mario.position.z < 0) {
        $mario.position.z = 0;
        speed.z = 0;
      }
    }

    _intersectObjs = intersectObjs;
  });

  let intersectObjs: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[] =
    [];

  let _intersectObjs: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[] =
    null;
  const mariobox: THREE.Box3 = new THREE.Box3();
  const objbox: THREE.Box3 = new THREE.Box3();
  const isFront: THREE.Vector3 = new THREE.Vector3();

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
      if (event.key === "j") {
        jumpAccTime = 3;
      }
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

  const grid = new Grid(30, 40, 12, 8);
  grid.center();
  s.add(grid);

  createSuperMario();
  // createRandomWorld();
  interctive();
};
