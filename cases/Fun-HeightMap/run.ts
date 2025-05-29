/**
 * Generated Automatically At Tue May 27 2025 20:22:06 GMT+0800 (China Standard Time);
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

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  const geometry = new THREE.PlaneGeometry(100, 100, 256, 256);
  const loader = new THREE.TextureLoader();

  loader.load("/assets/images/iceland_heightmap.png", (texture) => {
    const canvas = document.createElement("canvas");
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(texture.image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const x = i % canvas.width;
      const y = Math.floor(i / canvas.width);
      const pixelIndex = (y * canvas.width + x) * 4;
      const height = (imageData[pixelIndex] / 255) * 100; // 高度放大系数
      geometry.attributes.position.setZ(i, height);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x88cc88,
      wireframe: false,
    });

    const terrain = new THREE.Mesh(geometry, material);
    // terrain.rotateX(-Math.PI / 2);
    world.add(terrain);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(100, 100, 100).normalize();
    world.add(light);
  });
};
