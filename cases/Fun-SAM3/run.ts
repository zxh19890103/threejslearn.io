/**
 * Generated Automatically At Sun Apr 12 2026 09:50:09 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/addons/renderers/CSS2DRenderer.js";

import earcut from "earcut";
import { __useCSS2Renderer__ } from "cases/css2r.js";

type PolygonCoordinate = {
  x: number;
  y: number;
};

type PolygonData = {
  area: number;
  center: [number, number];
  centroid: [number, number];
  hue: [number, number, number];
  bbox: { x: number; y: number; width: number; height: number };
  extent: number;
  solidity: number;
  label: string;
  coordinates: PolygonCoordinate[];
};

__config__.background = 0xffffff;
__config__.camFar = 5e3;
__config__.camNear = 10;

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
  world0: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) => {
  const world = new THREE.Group();

  __useCSS2Renderer__();

  // your code
  const textureLoader = new THREE.TextureLoader(new THREE.LoadingManager());

  const normalizePolygonPoints = (
    coordinates: PolygonCoordinate[],
    offset: THREE.Vector2,
  ) => {
    const points = coordinates
      .map((coord) => new THREE.Vector2(coord.x, coord.y).add(offset))
      .filter(
        (point, index, array) => index === 0 || !point.equals(array[index - 1]),
      );

    if (points.length > 1 && points[0].equals(points[points.length - 1])) {
      points.pop();
    }

    return points;
  };

  const generateRandomPointsInPolygon = (
    coordinates: PolygonCoordinate[],
    offset: THREE.Vector2,
    sampleCount: number,
  ) => {
    const points = normalizePolygonPoints(coordinates, offset);
    if (points.length < 3) {
      return [] as THREE.Vector3[];
    }

    const data: number[] = [];
    points.forEach((point) => data.push(point.x, point.y));

    const triangles = earcut(data);
    if (triangles.length < 3) {
      return [] as THREE.Vector3[];
    }

    const triangleAreas: number[] = [];
    let totalArea = 0;

    for (let i = 0; i < triangles.length; i += 3) {
      const a = points[triangles[i]];
      const b = points[triangles[i + 1]];
      const c = points[triangles[i + 2]];

      const area =
        Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) * 0.5;

      totalArea += area;
      triangleAreas.push(totalArea);
    }

    if (totalArea <= 0) {
      return [] as THREE.Vector3[];
    }

    const sampledPoints: THREE.Vector3[] = points.map(
      (point) => new THREE.Vector3(point.x, point.y, 0),
    );

    if (sampleCount <= 0) {
      return sampledPoints;
    }

    for (let i = 0; i < sampleCount; i += 1) {
      const areaSelector = Math.random() * totalArea;
      let triIndex = 0;
      while (
        triIndex < triangleAreas.length - 1 &&
        triangleAreas[triIndex] < areaSelector
      ) {
        triIndex += 1;
      }

      const triOffset = triIndex * 3;
      const a = points[triangles[triOffset]];
      const b = points[triangles[triOffset + 1]];
      const c = points[triangles[triOffset + 2]];

      // Uniformly sample in a triangle using barycentric coordinates.
      const r1 = Math.random();
      const r2 = Math.random();
      const sqrtR1 = Math.sqrt(r1);
      const wA = 1 - sqrtR1;
      const wB = sqrtR1 * (1 - r2);
      const wC = sqrtR1 * r2;

      sampledPoints.push(
        new THREE.Vector3(
          wA * a.x + wB * b.x + wC * c.x,
          wA * a.y + wB * b.y + wC * c.y,
          0.3 + Math.random() * 0.7,
        ),
      );
    }

    return sampledPoints;
  };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1024, 1024),
    new THREE.MeshBasicMaterial({
      color: "#deae91",
      transparent: false,
      opacity: 0.87,
      side: THREE.DoubleSide,
      depthTest: false,
      // map: textureLoader.load("./exg_veg_mask.png"),
    }),
  );

  async function createSegments() {
    const polygons = (await fetch(`./polygons-15.json?t=${Date.now()}`).then(
      (res) => res.json(),
    )) as PolygonData[];

    const offset = new THREE.Vector2(-512, -512);

    const noiseTexture = textureLoader.load("./noise512_0.png");

    const renderVegetation = (polygon: PolygonData) => {
      const randomInnerVertices2D = generateRandomPointsInPolygon(
        polygon.coordinates,
        offset,
        600,
      );

      if (randomInnerVertices2D.length < 3) {
        return;
      }

      const delaunay = d3.Delaunay.from(
        randomInnerVertices2D.map(
          (point) => [point.x, point.y] as [number, number],
        ),
      );

      const positions = new Float32Array(randomInnerVertices2D.length * 3);
      randomInnerVertices2D.forEach((point, index) => {
        const positionIndex = index * 3;
        positions[positionIndex] = point.x;
        positions[positionIndex + 1] = point.y;
        positions[positionIndex + 2] = point.z;
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setIndex(Array.from(delaunay.triangles));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const material = new THREE.ShaderMaterial({
        wireframe: true,
        side: THREE.DoubleSide,
        // depthWrite: false,
        // depthTest: false,
        uniforms: {
          color: { value: new THREE.Color(0x2d5a27) },
          color0: { value: new THREE.Color(0x013110) },
          noise: { value: noiseTexture },
        },
        vertexShader: /*glsl*/ `
          uniform sampler2D noise;

          varying float vHeight;
          varying vec2 vNoiseUv;

          void main() {
            vec3 pos = position.xyz;
            vec2 uv0 = position.xy / 1024.0;
            vNoiseUv = uv0;

            pos.z *= 22.0 * texture2D(noise, uv0).r;

            vHeight = pos.z;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
        uniform vec3 color;
        uniform vec3 color0;
        uniform sampler2D noise;

        varying float vHeight;
        varying vec2 vNoiseUv;

        void main() {
          float alpha = smoothstep(0.0, 16.0, vHeight);
          float n = texture2D(noise, vNoiseUv).r;
          float tint = smoothstep(0.2, 0.8, n) * 0.25;
          vec3 base = mix(color0, color, alpha);

          gl_FragColor = vec4(base + vec3(tint * 0.5, tint * 0.7, tint * 0.2), 1.0);
        }
        `,
      });

      const mesh = new THREE.Mesh(geometry, material);

      mesh.renderOrder = 125;

      world.add(mesh);
    };

    /**
     * Estimates building height based on geometry features.
     * @param {number} area - The actual area of the polygon (in sq meters).
     * @param {number} solidity - Area / Convex Hull Area (0.0 to 1.0).
     * @param {number} extent - Area / Bounding Box Area (0.0 to 1.0).
     * @param {number} clustering - Number of neighbors within 50m (default to 1).
     */
    function estimateBuildingHeight(area, solidity, extent, clustering = 1) {
      if (area > 5000) {
        return 1; // Likely a park, plaza, or industrial shed - flat and wide
      }

      // 1. Base Floors (Start with 1 floor)
      let floors = 1.0;

      // 2. Area Logic (Primary Driver)
      // Small: <100m², Medium: 100-800m², Large: >800m²
      if (area > 2500) {
        floors += 5; // Potential mid/high-rise
      } else if (area > 1000) {
        floors += 2; // Standard residential/commercial
      }

      // 3. Shape Profile (Solidity & Extent)
      // High Solidity + High Extent = High efficiency (Modern towers or urban blocks)
      // Low values = Complex, sprawling shapes (Schools, factories, villas)
      const shapeEfficiency = (solidity + extent) / 2;

      if (shapeEfficiency > 0.8) {
        floors *= 2.5; // Multiply for efficient "tower" shapes
      } else if (shapeEfficiency < 0.5) {
        floors *= 0.8; // Penalize for sprawling/complex shapes
      }

      // 4. Clustering (The "Urban Context" Factor)
      // If buildings are packed tight (High Clustering), they are likely taller
      // to maximize land use (like in Guangzhou's Urban Villages).
      if (clustering > 8) {
        floors += 3; // "Urban Village" boost
      } else if (clustering < 2 && area > 10000) {
        floors = 2; // Large isolated buildings are usually warehouses/factories
      }

      // 5. Random Variance (Reality isn't perfect)
      // Adds +/- 10% so the skyline doesn't look like a flat grid
      const variance = 0.9 + Math.random() * 0.2;
      floors *= variance;

      // 6. Constraints & Conversion
      // Clamp between 1 floor and 100 floors
      const finalFloors = Math.min(Math.max(floors, 1), 100);

      // Standard floor height is ~3.5 meters
      const floorHeight = 6.5;

      return finalFloors * floorHeight;
    }

    polygons.forEach((polygon) => {
      console.log(polygon.label);
      if (!"building,vegetation,road,water".includes(polygon.label)) return;

      if (polygon.label === "vegetation") {
        // renderVegetation(polygon);
      } else if (polygon.label === "building") {
        if (!polygon.coordinates || polygon.coordinates.length < 3) {
          console.warn(
            "Skipping building with insufficient coordinates:",
            polygon,
          );
          return;
        }

        if (polygon.solidity < 0.55) {
          console.warn("Skipping building with low solidity:", polygon);
          return;
        }

        const height = estimateBuildingHeight(
          polygon.area,
          polygon.solidity,
          polygon.extent,
        );

        const extrudeSettings = {
          steps: 1,
          depth: height, // This is the 'height' of your vegetation
          bevelEnabled: true,
          bevelThickness: 0.5,
          bevelSize: 0.5,
          bevelSegments: 2,
        };

        const geometry = new THREE.ExtrudeGeometry(
          new THREE.Shape(
            polygon.coordinates.map((x) =>
              new THREE.Vector2(x.x, x.y).add(offset),
            ),
          ),
          extrudeSettings,
        );

        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(
              polygon.hue[0] / 256,
              polygon.hue[1] / 256,
              polygon.hue[2] / 256,
            ),
          }),
        );

        const outline = new THREE.Line(
          new THREE.EdgesGeometry(geometry, 30),
          new THREE.LineBasicMaterial({
            color: 0x000000,
          }),
        );

        mesh.add(outline);

        const label = document.createElement("div");

        label.innerText = `a:${polygon.area.toFixed(2)} e:${polygon.extent.toFixed(2)} s:${polygon.solidity.toFixed(2)}`;
        label.style.cssText = `font-size: 12px; color: #000`;
        const labelObj = new CSS2DObject(label);

        labelObj.position.set(
          polygon.centroid[0] + offset.x,
          1024 - polygon.centroid[1] + offset.y,
          height + 10,
        );

        outline.renderOrder = 131;
        mesh.renderOrder = 130;
        mesh.add(labelObj);

        world.add(mesh);
      } else if (polygon.label === "road") {
        const roadMesh = new THREE.Mesh(
          new THREE.ShapeGeometry(
            new THREE.Shape(
              polygon.coordinates.map((coord) =>
                new THREE.Vector2(coord.x, coord.y).add(offset),
              ),
            ),
          ),
          new THREE.MeshBasicMaterial({
            color: 0x333333,
            depthWrite: false,
          }),
        );

        roadMesh.renderOrder = 120;
        world.add(roadMesh);
      } else if (polygon.label === "water") {
        const waterMesh = new THREE.Mesh(
          new THREE.ShapeGeometry(
            new THREE.Shape(
              polygon.coordinates.map((coord) =>
                new THREE.Vector2(coord.x, coord.y).add(offset),
              ),
            ),
          ),
          new THREE.MeshBasicMaterial({
            color: 0x4060a0,
            depthWrite: false,
          }),
        );
        waterMesh.renderOrder = 190;
        world.add(waterMesh);
      }
    });
  }

  ground.renderOrder = 99;
  world.add(ground);

  world.rotateX(-Math.PI / 2);
  world0.add(world);

  createSegments();

  // createSegmentsAsLine();

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};
