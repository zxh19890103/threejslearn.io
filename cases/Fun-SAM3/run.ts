/**
 * Generated Automatically At Sun Apr 12 2026 09:50:09 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";

import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

import earcut from "earcut";
import { __useCSS2Renderer__ } from "cases/css2r.js";
import { DynVegetation } from "cases/Fun-DynTree/vegetation.js";

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

const polygonjsonpath = "polygons-16.json";

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
          0,
        ),
      );
    }

    return sampledPoints;
  };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1024, 1024),
    new THREE.MeshBasicMaterial({
      color: "#deae91",
      transparent: true,
      opacity: 0.87,
      side: THREE.DoubleSide,
      depthTest: true,
      // map: textureLoader.load("./exg_veg_mask.png"),
    }),
  );

  async function createSegments() {
    const polygons = (await fetch(`./${polygonjsonpath}?t=${Date.now()}`).then(
      (res) => res.json(),
    )) as PolygonData[];

    const offset = new THREE.Vector2(-512, -512);

    const noiseTexture = textureLoader.load("./noise512_0.png");

    type RoadEndpoint = {
      position: THREE.Vector3;
      direction: THREE.Vector3;
    };

    type RoadInfo = {
      id: number;
      curvePoints: THREE.Vector3[];
      halfWidth: number;
      start: RoadEndpoint;
      end: RoadEndpoint;
    };

    const roads: RoadInfo[] = [];
    let nextRoadId = 0;

    const buildRoadRibbon = (
      curvePoints: THREE.Vector3[],
      halfWidth: number,
      color = 0x444444,
      renderOrder = 250,
    ) => {
      if (curvePoints.length < 2) return;

      const positions: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i < curvePoints.length; i++) {
        const pPrev = curvePoints[Math.max(0, i - 1)];
        const pCurr = curvePoints[i];
        const pNext = curvePoints[Math.min(curvePoints.length - 1, i + 1)];

        const tangent = new THREE.Vector2(pNext.x - pPrev.x, pNext.y - pPrev.y);
        if (tangent.lengthSq() < 1e-8) continue;
        tangent.normalize();

        const normal = new THREE.Vector2(-tangent.y, tangent.x);
        const left = new THREE.Vector3(
          pCurr.x + normal.x * halfWidth,
          pCurr.y + normal.y * halfWidth,
          pCurr.z,
        );
        const right = new THREE.Vector3(
          pCurr.x - normal.x * halfWidth,
          pCurr.y - normal.y * halfWidth,
          pCurr.z,
        );

        positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      }

      const rowCount = positions.length / 6;
      if (rowCount < 2) return;

      for (let i = 0; i < rowCount - 1; i++) {
        const i0 = i * 2;
        const i1 = i0 + 1;
        const i2 = i0 + 2;
        const i3 = i0 + 3;

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(positions), 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const material = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        depthWrite: true,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = renderOrder;
      world.add(mesh);
    };

    const cross2 = (a: THREE.Vector2, b: THREE.Vector2) =>
      a.x * b.y - a.y * b.x;

    const rayRayIntersection = (
      originA: THREE.Vector2,
      dirA: THREE.Vector2,
      originB: THREE.Vector2,
      dirB: THREE.Vector2,
    ): { point: THREE.Vector2; ta: number; tb: number } | null => {
      const den = cross2(dirA, dirB);
      if (Math.abs(den) < 1e-7) return null;

      const ab = new THREE.Vector2().subVectors(originB, originA);
      const ta = cross2(ab, dirB) / den;
      const tb = cross2(ab, dirA) / den;
      if (ta < 0 || tb < 0) return null;

      return {
        point: originA.clone().addScaledVector(dirA, ta),
        ta,
        tb,
      };
    };

    const connectRoads = () => {
      const extensionDistance = 600;
      const usedEndpoints = new Set<string>();

      const endpointKey = (roadId: number, side: "start" | "end") =>
        `${roadId}:${side}`;

      const endpoints = roads.flatMap((road) => [
        { road, side: "start" as const, endpoint: road.start },
        { road, side: "end" as const, endpoint: road.end },
      ]);

      for (let i = 0; i < endpoints.length; i++) {
        const a = endpoints[i];
        const aKey = endpointKey(a.road.id, a.side);
        if (usedEndpoints.has(aKey)) continue;

        const aOrigin = new THREE.Vector2(
          a.endpoint.position.x,
          a.endpoint.position.y,
        );
        const aDir = new THREE.Vector2(
          a.endpoint.direction.x,
          a.endpoint.direction.y,
        ).normalize();

        let best: {
          point: THREE.Vector2;
          ta: number;
          tb: number;
          b: (typeof endpoints)[number];
        } | null = null;

        for (let j = i + 1; j < endpoints.length; j++) {
          const b = endpoints[j];
          if (a.road.id === b.road.id) continue;

          const bKey = endpointKey(b.road.id, b.side);
          if (usedEndpoints.has(bKey)) continue;

          const bOrigin = new THREE.Vector2(
            b.endpoint.position.x,
            b.endpoint.position.y,
          );
          const bDir = new THREE.Vector2(
            b.endpoint.direction.x,
            b.endpoint.direction.y,
          ).normalize();

          // Endpoints should face toward the potential junction, not away from each other.
          // if (aDir.dot(bDir) > -0.15) continue;

          const hit = rayRayIntersection(aOrigin, aDir, bOrigin, bDir);
          if (!hit) continue;
          if (hit.ta > extensionDistance || hit.tb > extensionDistance)
            continue;

          const score = hit.ta + hit.tb;
          if (!best || score < best.ta + best.tb) {
            best = { ...hit, b };
          }
        }

        if (!best) continue;

        const bKey = endpointKey(best.b.road.id, best.b.side);
        usedEndpoints.add(aKey);
        usedEndpoints.add(bKey);

        const connectorHalfWidth =
          (a.road.halfWidth + best.b.road.halfWidth) * 0.5;
        const mid = new THREE.Vector3(best.point.x, best.point.y, 0);
        const connectorCurve = new THREE.CatmullRomCurve3(
          [a.endpoint.position.clone(), mid, best.b.endpoint.position.clone()],
          false,
          "catmullrom",
          0.2,
        );
        const connectorLength = connectorCurve.getLength();
        const connectorSteps = Math.max(8, Math.ceil(connectorLength / 8));
        buildRoadRibbon(
          connectorCurve.getPoints(connectorSteps),
          connectorHalfWidth,
          0x444444,
          251,
        );
      }
    };

    const renderVegetation_as_mesh = (polygon: PolygonData) => {
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
        wireframe: false,
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

    const renderVegetation = (polygon: PolygonData) => {
      const candidates = generateRandomPointsInPolygon(
        polygon.coordinates,
        offset,
        30,
      );

      const density = 0.0001; // trees per square meter
      const treeCount = Math.max(1, Math.floor(polygon.area * density));

      const minDist = 2.5;
      const picked: THREE.Vector3[] = [];

      for (const p of candidates) {
        let ok = true;
        for (const q of picked) {
          if (p.distanceToSquared(q) < minDist * minDist) {
            ok = false;
            break;
          }
        }
        if (ok) picked.push(p);
        if (picked.length >= treeCount) break;
      }

      // const mesh = new DynVegetation({
      //   polygon: polygon.coordinates.map((coord) =>
      //     new THREE.Vector2(coord.x, 1024 - coord.y).add(offset).toArray(),
      //   ),
      //   density: 0.1,
      //   maxScale: 20.9,
      //   outlineStrength: 0.7,
      //   outlineColor: 0x000000,
      // });

      // mesh.renderOrder = 125;
      // mesh.rotateY(-Math.PI / 2);
      // world0.add(mesh);

      world.add(
        new THREE.Points(
          new THREE.BufferGeometry().setFromPoints(picked),
          new THREE.PointsMaterial({
            color: 0x2d5a27,
            size: 8,
            sizeAttenuation: false,
          }),
        ),
      );
    };

    const renderRoad = (polygon: PolygonData) => {
      if (!polygon.coordinates || polygon.coordinates.length < 3) {
        return;
      }

      const points2D = normalizePolygonPoints(polygon.coordinates, offset);
      if (points2D.length < 3) {
        return;
      }

      const points = points2D.map((p) => new THREE.Vector3(p.x, p.y, 0));

      const raySegmentDistance = (
        origin: THREE.Vector2,
        dir: THREE.Vector2,
        a: THREE.Vector2,
        b: THREE.Vector2,
      ): number | null => {
        const s = new THREE.Vector2().subVectors(b, a);
        const den = cross2(dir, s);
        if (Math.abs(den) < 1e-7) return null;

        const ao = new THREE.Vector2().subVectors(a, origin);
        const t = cross2(ao, s) / den;
        const u = cross2(ao, dir) / den;

        if (t >= 0 && u >= 0 && u <= 1) return t;
        return null;
      };

      const nearestHitDistance = (
        origin: THREE.Vector2,
        dir: THREE.Vector2,
        boundary: THREE.Vector2[],
      ): number | null => {
        let best: number | null = null;
        for (let i = 0; i < boundary.length; i++) {
          const a = boundary[i];
          const b = boundary[(i + 1) % boundary.length];
          const t = raySegmentDistance(origin, dir, a, b);
          if (t === null) continue;
          if (best === null || t < best) best = t;
        }
        return best;
      };

      // Find bounding box and principal axis
      let minX = Infinity,
        maxX = -Infinity;
      let minY = Infinity,
        maxY = -Infinity;
      for (const p of points) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }

      const bboxWidth = maxX - minX;
      const bboxHeight = maxY - minY;
      const isHorizontal = bboxWidth > bboxHeight;
      const defaultRoadWidth = Math.max(
        1.2,
        (isHorizontal ? bboxHeight : bboxWidth) * 0.65,
      );

      // Build a clean centerline
      const centerLine: THREE.Vector3[] = [];
      const samples = Math.max(
        4,
        Math.ceil(Math.max(bboxWidth, bboxHeight) / 4),
      );
      const minSegmentLen = Math.max(bboxWidth, bboxHeight) * 0.05;

      if (isHorizontal) {
        for (let i = 0; i < samples; i++) {
          const x = minX + (bboxWidth * i) / Math.max(1, samples - 1);
          const nearby = points.filter(
            (p) => Math.abs(p.x - x) < bboxWidth * 0.2,
          );
          const avgY =
            nearby.length > 0
              ? nearby.reduce((sum, p) => sum + p.y, 0) / nearby.length
              : (minY + maxY) / 2;
          const candidate = new THREE.Vector3(x, avgY, 0);

          if (
            centerLine.length === 0 ||
            candidate.distanceTo(centerLine[centerLine.length - 1]) >
              minSegmentLen
          ) {
            centerLine.push(candidate);
          }
        }
      } else {
        for (let i = 0; i < samples; i++) {
          const y = minY + (bboxHeight * i) / Math.max(1, samples - 1);
          const nearby = points.filter(
            (p) => Math.abs(p.y - y) < bboxHeight * 0.2,
          );
          const avgX =
            nearby.length > 0
              ? nearby.reduce((sum, p) => sum + p.x, 0) / nearby.length
              : (minX + maxX) / 2;
          const candidate = new THREE.Vector3(avgX, y, 0);

          if (
            centerLine.length === 0 ||
            candidate.distanceTo(centerLine[centerLine.length - 1]) >
              minSegmentLen
          ) {
            centerLine.push(candidate);
          }
        }
      }

      if (centerLine.length < 2) {
        return;
      }

      const maxSegmentLen = Math.max(3, Math.min(bboxWidth, bboxHeight) * 0.15);
      const smoothCurve = new THREE.CatmullRomCurve3(
        centerLine,
        false,
        "catmullrom",
        0.5,
      );
      const curveLength = smoothCurve.getLength();
      const steps = Math.max(16, Math.ceil(curveLength / maxSegmentLen));

      const curvePoints = smoothCurve.getPoints(steps);
      if (curvePoints.length < 2) {
        return;
      }

      // Measure width locally by shooting rays along +/- normal to the curve.
      const halfWidths: number[] = [];
      const boundary = points2D;

      for (let i = 0; i < curvePoints.length; i++) {
        const pPrev = curvePoints[Math.max(0, i - 1)];
        const pCurr = curvePoints[i];
        const pNext = curvePoints[Math.min(curvePoints.length - 1, i + 1)];

        const tangent = new THREE.Vector2(pNext.x - pPrev.x, pNext.y - pPrev.y);
        if (tangent.lengthSq() < 1e-8) {
          halfWidths.push(defaultRoadWidth * 0.5);
          continue;
        }
        tangent.normalize();

        const normal = new THREE.Vector2(-tangent.y, tangent.x);
        const origin = new THREE.Vector2(pCurr.x, pCurr.y);

        const tPos = nearestHitDistance(origin, normal, boundary);
        const tNeg = nearestHitDistance(
          origin,
          normal.clone().negate(),
          boundary,
        );

        const halfDefault = defaultRoadWidth * 0.5;
        const left = tPos ?? halfDefault;
        const right = tNeg ?? halfDefault;

        // Keep the centerline centered by using average half width.
        halfWidths.push(Math.max(0.6, (left + right) * 0.5));
      }

      // Smooth widths to reduce jitter from noisy polygon edges.
      const smoothHalfWidths = halfWidths.map((_, i) => {
        let sum = 0;
        let count = 0;
        for (let k = -2; k <= 2; k++) {
          const idx = i + k;
          if (idx < 0 || idx >= halfWidths.length) continue;
          sum += halfWidths[idx];
          count += 1;
        }
        return count > 0 ? sum / count : halfWidths[i];
      });

      const avgHalfWidth =
        smoothHalfWidths.reduce((sum, w) => sum + w, 0) /
        Math.max(1, smoothHalfWidths.length);

      buildRoadRibbon(curvePoints, avgHalfWidth, 0x444444, 250);

      const startDir = curvePoints[0]
        .clone()
        .sub(curvePoints[Math.min(1, curvePoints.length - 1)]);
      const endDir = curvePoints[curvePoints.length - 1]
        .clone()
        .sub(curvePoints[Math.max(0, curvePoints.length - 2)]);

      if (startDir.lengthSq() < 1e-8 || endDir.lengthSq() < 1e-8) {
        return;
      }

      roads.push({
        id: nextRoadId++,
        curvePoints,
        halfWidth: avgHalfWidth,
        start: {
          position: curvePoints[0].clone(),
          direction: startDir.normalize(),
        },
        end: {
          position: curvePoints[curvePoints.length - 1].clone(),
          direction: endDir.normalize(),
        },
      });
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
      const floorHeight = 16.5;

      return finalFloors * floorHeight;
    }

    const buildingTexture = textureLoader.load("./city-buildings.modern.png");

    buildingTexture.minFilter = THREE.LinearFilter;
    buildingTexture.magFilter = THREE.LinearFilter;
    buildingTexture.wrapS = THREE.RepeatWrapping;
    buildingTexture.wrapT = THREE.RepeatWrapping;

    polygons.forEach((polygon) => {
      console.log(polygon.label);
      if (!"building,vegetation,road,water".includes(polygon.label)) return;

      if (polygon.label === "vegetation") {
        renderVegetation(polygon);
      } else if (polygon.label === "building1") {
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
      } else if (polygon.label === "building") {
        if (polygon.coordinates && polygon.coordinates.length >= 3) {
          world.add(
            new Building(
              polygon.coordinates,
              polygon.hue,
              estimateBuildingHeight(
                polygon.area,
                polygon.solidity,
                polygon.extent,
              ),

              new THREE.Vector2(
                Math.floor(Math.random() * 8),
                Math.floor(Math.random() * 8),
              ).multiplyScalar(0.25),

              buildingTexture,
            ),
          );
        }
      } else if (polygon.label === "road") {
        renderRoad(polygon);
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

    connectRoads();
  }

  ground.renderOrder = 1;
  world.rotateX(-Math.PI / 2);
  world0.add(world);
  ground.translateZ(-10);
  world.add(ground);

  createSegments();

  // createSegmentsAsLine();

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

class Building extends THREE.Mesh {
  constructor(
    footprint: PolygonCoordinate[],
    hue: [number, number, number],
    height: number,
    offset: THREE.Vector2 = new THREE.Vector2(0, 0),
    map: THREE.Texture = null,
  ) {
    const shape = new THREE.Shape(
      footprint.map(
        (coord) => new THREE.Vector2(-512 + coord.x, -512 + coord.y),
      ),
    );

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 1,
      depth: height,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelSegments: 2,
      UVGenerator: {
        generateTopUV: (geometry, vertices, indexA, indexB, indexC) => {
          return [
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0, 0),
          ];
        },
        generateSideWallUV: (
          geometry,
          vertices,
          indexA,
          indexB,
          indexC,
          indexD,
        ) => {
          const j3 = indexB * 3;
          const i3 = indexA * 3;

          const horizontalLength = Math.hypot(
            vertices[j3] - vertices[i3],
            vertices[j3 + 1] - vertices[i3 + 1],
            vertices[j3 + 2] - vertices[i3 + 2],
          );

          return [
            new THREE.Vector2(0, 0),
            new THREE.Vector2(horizontalLength, 0),
            new THREE.Vector2(horizontalLength, height),
            new THREE.Vector2(0, height),
          ];
        },
      },
    };

    super(
      new THREE.ExtrudeGeometry(shape, extrudeSettings),
      new THREE.ShaderMaterial({
        vertexShader: /*glsl*/ `
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform sampler2D map;
          uniform vec2 offset;
          uniform vec2 scale;
          uniform vec2 insetUv;

          varying vec2 vUv;

          void main() {
            vec2 local = fract(vUv / 16.0); 
            vec2 tileMin = offset + insetUv;
            vec2 tileMax = offset + scale - insetUv;
            vec2 uv = mix(tileMin, tileMax, local);
            vec4 texColor = texture2D(map, uv);
            gl_FragColor = vec4(color * texColor.rgb, 1.0);
          }
        `,
        uniforms: {
          insetUv: { value: new THREE.Vector2(0.01, 0.005) },
          offset: { value: offset },
          scale: { value: new THREE.Vector2(0.25, 0.25) },
          color: {
            value: new THREE.Color(hue[0] / 256, hue[1] / 256, hue[2] / 256),
          },
          map: { value: map },
        },
      }),
      // new THREE.MeshBasicMaterial({
      //   side: THREE.DoubleSide,
      //   color: new THREE.Color(hue[0] / 256, hue[1] / 256, hue[2] / 256),
      //   wireframe: false,
      //   map: map,
      // }),
    );
  }
}
