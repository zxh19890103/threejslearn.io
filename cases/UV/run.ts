/**
 * Generated Automatically At Sun Feb 23 2025 15:34:01 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { createDialog } from "../dialog.js";

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

__main__ = (s: THREE.Scene, c: THREE.Camera, r: THREE.WebGLRenderer) => {
  // your code

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        0,
        1,
        0, // Vertex 1 (x, y, z)
        -1,
        -1,
        0, // Vertex 2 (x, y, z)
        1,
        -1,
        0,
      ]),
      3
    )
  );

  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(
      new Float32Array([
        0,
        0,
        1, // Vertex 1 (x, y, z)
        0,
        0,
        1, // Vertex 2 (x, y, z)
        0,
        0,
        1,
      ]),
      3
    )
  );

  const uvs = [0.5, 1, 0, 0, 1, 0];

  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(uvs), 2)
  );

  __updateTHREEJs__only__.map = (on) => {
    if (on) {
      return new Promise((done, fail) => {
        new THREE.TextureLoader(new THREE.LoadingManager()).load(
          "/assets/images/3lbg.jpg",
          (texture) => {
            material.map = texture;
            material.needsUpdate = true;
            done(1);
          },
          null,
          () => {
            fail();
          }
        );
      });
    } else {
      material.map = null;
      material.needsUpdate = true;
    }
  };

  const onColorChange = () => {
    const rgb0 = new THREE.Color(color0);
    const rgb1 = new THREE.Color(color1);
    const rgb2 = new THREE.Color(color2);

    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array([
          rgb0.r,
          rgb0.g,
          rgb0.b, //
          rgb1.r,
          rgb1.g,
          rgb1.b,
          rgb2.r,
          rgb2.g,
          rgb2.b, //
        ]),
        3
      )
    );
  };
  onColorChange();

  __updateTHREEJs__only__.color0 = onColorChange;
  __updateTHREEJs__only__.color1 = onColorChange;
  __updateTHREEJs__only__.color2 = onColorChange;

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: null,
    color: 0xeff132,
  });
  const mesh = new THREE.Mesh(geometry, material);
  s.add(mesh);

  __3__.dirLight(0xfffffff, 0.9).helper(2, 0xfe9910);
  __3__.ambLight(0xffffff, 0.4);

  __updateTHREEJs__invoke__.texture = () => {
    createDialog({
      title: "Texture",
      width: 600,
      height: 500,
      mounted: ($, $1) => {
        $(".uvControl").forEach((element) => {
          const container = $1("#uvTexture");

          const uvIndex = +element.dataset.uv;

          const cW = container.clientWidth;
          const cH = container.clientHeight;

          console.log(cW, cH);

          let x0 = 0;
          let y0 = 0;
          let top = 0;
          let left = 0;

          const move = (event: PointerEvent) => {
            const x = event.pageX;
            const y = event.pageY;

            const deltaX = x - x0;
            const deltaY = y - y0;

            left += deltaX;
            top += deltaY;

            x0 = x;
            y0 = y;

            element.style.top = top + "px";
            element.style.left = left + "px";

            uvs[2 * uvIndex] = left / cW;
            uvs[2 * uvIndex + 1] = 1 - top / cH;

            // dom
            $1("#uvsText").innerText = `uvs = ${uvs}`;

            // threejs
            geometry.setAttribute(
              "uv",
              new THREE.BufferAttribute(new Float32Array(uvs), 2)
            );
          };

          const up = (event: PointerEvent) => {
            container.removeEventListener("pointermove", move);
            container.removeEventListener("pointerup", up);
            container.removeEventListener("pointerleave", up);
          };

          element.addEventListener("pointerdown", (event) => {
            x0 = event.pageX;
            y0 = event.pageY;

            top = element.offsetTop;
            left = element.offsetLeft;

            container.addEventListener("pointermove", move);
            container.addEventListener("pointerup", up);
            container.addEventListener("pointerleave", up);
          });
        });
      },
      content: `
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%">
        <div id="uvsText">
          uvs = ${uvs}
        </div>
        <div style="flex: 1; height: 0;">
          <div id="uvTexture" style="user-select: none; position: relative;width: 400px; height: fit-content;">
            <img src="/assets/images/3lbg.jpg" class="img" />
            ${new Array(uvs.length / 2)
              .fill(0)
              .map((_, i) => {
                const u = uvs[2 * i];
                const v = uvs[2 * i + 1];
                const top = 100 * (1 - v) + "%";
                const left = 100 * u + "%";
                return `<div class="uvControl" data-uv="${i}" style="cursor: pointer; position: absolute; top: ${top}; left: ${left}; transform: translate(-50%, -50%); width: 10px; height: 10px; background-color: #e01990; border-radius: 50%;"></div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
      `,
    });
  };

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

let map = false;
let color0 = 0xef9103;
let color1 = 0xff2103;
let color2 = 0xfe0199;

__defineControl__("texture", "btn", "see picture!");
__defineControl__("map", "bit", map);
__defineControl__("color0", "color", color0);
__defineControl__("color1", "color", color1);
__defineControl__("color2", "color", color2);
