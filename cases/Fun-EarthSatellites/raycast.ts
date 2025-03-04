import * as THREE from "three";

let raycaster: THREE.Raycaster;
let camera: THREE.PerspectiveCamera;
let domElement: HTMLDivElement;

export const useRayCast = (_camera: THREE.PerspectiveCamera) => {
  camera = _camera;
  domElement = document.querySelector("#PgApp");
  raycaster = new THREE.Raycaster();

  const mouse = new THREE.Vector2();

  let group: THREE.Object3D = null;
  let every: VoidFunction = null;
  let casting = false;

  const beginCast = (event: PointerEvent) => {
    domElement.addEventListener("pointermove", doCasting);
    domElement.addEventListener("pointerleave", endCast);
    domElement.addEventListener("pointerout", endCast);
    casting = true;
  };

  const doCasting = (event: PointerEvent) => {
    mouse.x = (event.clientX / domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / domElement.clientHeight) * 2 + 1;
    // camera.updateProjectionMatrix();
    raycaster.setFromCamera(mouse, camera);
    every?.();
    raycast();
  };

  const endCast = (event: PointerEvent) => {
    casting = false;

    if (closestPickObjIndex !== -1) {
      mouseOut?.(closestPickObjIndex, mouseInReturns);
    }

    closestPickObjIndex = -1;
    mouseInReturns = null;
    domElement.style.cursor = "default";

    domElement.removeEventListener("pointermove", doCasting);
    domElement.removeEventListener("pointerleave", endCast);
    domElement.removeEventListener("pointerout", endCast);
  };

  domElement.addEventListener("pointerenter", beginCast);

  const raycast = () => {
    if (!casting || !group) return;

    const intersects = raycaster.intersectObject(group, true);

    if (intersects.length > 0) {
      console.log(intersects.length);
      intersects.sort((a, b) => a.distance - b.distance);
      const intersect = intersects[0];
      const index = intersect.index;

      domElement.style.cursor = "pointer";

      if (closestPickObjIndex === index) {
      } else {
        if (closestPickObjIndex !== -1) {
          mouseOut?.(closestPickObjIndex, mouseInReturns);
        }
        mouseInReturns = mouseIn?.(
          index,
          intersects.map((i) => i.index)
        );
        closestPickObjIndex = index;
      }
    } else {
      if (closestPickObjIndex !== -1) {
        mouseOut?.(closestPickObjIndex, mouseInReturns);
      }
      closestPickObjIndex = -1;
      domElement.style.cursor = "default";
      mouseInReturns = null;
    }
  };

  raycaster.params.Points.threshold = 0.1;

  let closestPickObjIndex: number = -1;

  let mouseInReturns: any = null;
  let mouseIn: RayCastedMouseEventFn = null;
  let mouseOut: RayCastedMouseEventFn = null;

  return {
    hover: ($in: RayCastedMouseEventFn, $out: RayCastedMouseEventFn) => {
      mouseIn = $in;
      mouseOut = $out;
    },
    click: (fn: RayCastedMouseEventFn) => {
      let objIndex = -1;
      domElement.addEventListener("pointerdown", () => {
        objIndex = closestPickObjIndex;
      });
      domElement.addEventListener("pointerup", () => {
        if (objIndex === -1) return;
        fn(objIndex);
      });
    },
    bind: (group_: THREE.Object3D, every_?: VoidFunction) => {
      group = group_;
      every = every_;
    },
    setThreshold: (val: number) => {
      raycaster.params.Points.threshold = val; // Adjust based on point size
      console.log("threhold", val);
    },
  };
};

type RayCastedMouseEventFn = (index: number, data?: any) => any;
