/**
 * Generated Automatically At 2026-04-26 19:02:33 CST;
 */
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

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
  renderer: THREE.WebGLRenderer,
) => {
  // your code

  const helloWorld = new HelloWorld();
  world.add(helloWorld);

  helloWorld.sayHello();

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

interface IHelloWorld {
  sayHello(): void;
}

class HelloWorld extends THREE.Mesh implements IHelloWorld {
  private textMesh: THREE.Mesh | null = null;

  constructor() {
    super(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    );
  }

  /**
   * use THREE.TextGeometry to create text geometry and add it to the scene
   */
  sayHello() {
    if (this.textMesh) return;

    const loader = new FontLoader();
    loader.load(
      "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json",
      (font) => {
        const geometry = new TextGeometry("Hello THREE.js", {
          font,
          size: 0.22,
          depth: 0.04,
          curveSegments: 8,
          bevelEnabled: false,
        });

        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox;
        if (bounds) {
          const width = bounds.max.x - bounds.min.x;
          geometry.translate(-width / 2, 0, 0);
        }

        const material = new THREE.MeshBasicMaterial({ color: 0xff9933 });
        const textMesh = new THREE.Mesh(geometry, material);
        textMesh.position.set(0, 0.9, 0);

        this.add(textMesh);
        this.textMesh = textMesh;
      },
      undefined,
      () => {
        console.warn("Failed to load font for TextGeometry.");
      },
    );
  }
}
