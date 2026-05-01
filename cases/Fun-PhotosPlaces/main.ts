import { __useCSS2Renderer__ } from "cases/css2r.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { Marker } from "./Marker.js";
import * as THREE from "three";

let [lat, lon] = `24.86427976252972, 102.79516023338763`.split(",").map(Number);

let zoom = 11;
let scale = 1;
let extendScale = 1;
const tileWorldSize = 12;
const googleLyrs = "s";

function GetFootprints() {
  return fetch("./data/footprints0426-v2.json").then((r) => r.json());
}

function GetFootprintsGeoJSON() {
  return fetch("./data/footprints0426.geojson").then((r) => r.json());
}

function latLonToTile(lat: number, lon: number, currentZoom: number) {
  const latRad = THREE.MathUtils.degToRad(lat);
  const tilesCount = Math.pow(2, currentZoom);
  const worldX = ((lon + 180) / 360) * tilesCount;
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    tilesCount;

  return {
    x: Math.floor(worldX),
    y: Math.floor(worldY),
    offsetX: worldX - Math.floor(worldX),
    offsetY: worldY - Math.floor(worldY),
  };
}

function getViewCenterLatlng(camera: THREE.PerspectiveCamera) {
  if (!camera) {
    return {
      cLat: lat,
      cLon: lon,
    };
  }

  const raycaster = new THREE.Raycaster();
  const ndcCenter = new THREE.Vector2(0, 0);
  raycaster.setFromCamera(ndcCenter, camera);

  // Map tiles are laid on the world plane y = 0.
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(groundPlane, hit);

  if (!ok) {
    return {
      cLat: lat,
      cLon: lon,
    };
  }

  const { x: parentX, y: parentY } = latLonToTile(lat, lon, zoom);
  const tilesCount = Math.pow(2, zoom);

  // Inverse of footprintToWorld mapping:
  // wx = (worldX - parentX - 0.5) * tileWorldSize
  // wz = (worldY - parentY - 0.5) * tileWorldSize
  const worldX = parentX + 0.5 + hit.x / tileWorldSize;
  const worldY = parentY + 0.5 + hit.z / tileWorldSize;

  const cLon = (worldX / tilesCount) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * worldY) / tilesCount;
  const cLat = THREE.MathUtils.radToDeg(Math.atan(Math.sinh(n)));

  return {
    cLat: THREE.MathUtils.clamp(cLat, -85.05112878, 85.05112878),
    cLon,
  };
}

function createGoogleTileUrl(x: number, y: number, currentZoom: number) {
  return `https://mt1.google.com/vt/lyrs=${googleLyrs}&x=${x}&y=${y}&z=${currentZoom}&scale=4&hl=en`;
}

type Footprint = {
  file: string;
  lat: number | null;
  lon: number | null;
  datetime: string | null;
  blob?: string | null;
};

/**
 * Convert any lat/lon to world-space X/Z relative to the parent tile at `zoom`.
 * Returns null if the point has no coordinates.
 */
function footprintToWorld(
  fpLat: number,
  fpLon: number,
  parentX: number,
  parentY: number,
): { wx: number; wz: number } {
  const latRad = THREE.MathUtils.degToRad(fpLat);
  const tilesCount = Math.pow(2, zoom);
  const worldX = ((fpLon + 180) / 360) * tilesCount;
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    tilesCount;

  // Offset from the top-left corner of the parent tile → world units
  const wx = (worldX - parentX - 0.5) * tileWorldSize;
  const wz = (worldY - parentY - 0.5) * tileWorldSize;
  return { wx, wz };
}

export function main(
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) {
  __useCSS2Renderer__();

  const root = new THREE.Group();
  world.add(root);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(6, 10, 8);
  root.add(ambientLight, dirLight);

  const subTiles = new THREE.Group();
  root.add(subTiles);

  // Group that holds CSS2D markers + path line, rebuilt on zoom change
  const photoOverlays = new THREE.Group();
  photoOverlays.renderOrder = 1;
  root.add(photoOverlays);

  // Group for GeoJSON highway lines, rebuilt on zoom/pan change
  const highwayOverlays = new THREE.Group();
  highwayOverlays.renderOrder = 5;
  root.add(highwayOverlays);

  const HIGHWAY_STYLE: Record<string, number> = {
    motorway: 0xe8692a,
    motorway_link: 0xe8692a,
    trunk: 0xf5a623,
    trunk_link: 0xf5a623,
    primary: 0xfcd34d,
    primary_link: 0xfcd34d,
    secondary: 0x86efac,
    secondary_link: 0x86efac,
    tertiary: 0xcbd5e1,
    tertiary_link: 0xcbd5e1,
    residential: 0x94a3b8,
    unclassified: 0x94a3b8,
    service: 0x94a3b8,
    footway: 0xa78bfa,
    pedestrian: 0xa78bfa,
    path: 0xa78bfa,
    cycleway: 0x67e8f9,
    steps: 0xa78bfa,
    living_street: 0x94a3b8,
  };

  let geojsonData: any = null;

  let footprints: Footprint[] = [];
  const cssMarkers: CSS2DObject[] = [];
  const photoMarkers3D: Marker[] = [];
  let orderedFootprints: any[] = [];
  let revealed: boolean[] = [];
  let timelineStartMs = 0;
  let timelineEndMs = 0;
  let currentAnimTimeMs = 0;
  const SIM_MS_PER_SECOND = 30 * 60 * 1000;

  const createPhotoMarkerEl = (fp: Footprint) => {
    const rootEl = document.createElement("div");
    rootEl.style.display = "flex";
    rootEl.style.flexDirection = "column";
    rootEl.style.alignItems = "center";
    rootEl.style.gap = "4px";

    const dateEl = document.createElement("div");
    dateEl.style.fontSize = "10px";
    dateEl.style.lineHeight = "1";
    dateEl.style.padding = "3px 6px";
    dateEl.style.borderRadius = "999px";
    dateEl.style.background = "rgba(0,0,0,0.72)";
    dateEl.style.color = "#fff";
    dateEl.style.whiteSpace = "nowrap";

    if (fp.datetime) {
      const dt = new Date(fp.datetime);
      dateEl.innerText = Number.isNaN(dt.getTime())
        ? fp.datetime
        : dt.toLocaleString();
    } else {
      dateEl.innerText = "Unknown date";
    }

    const imgEl = document.createElement("img");
    imgEl.style.width = "64px";
    imgEl.style.height = "64px";
    imgEl.style.borderRadius = "8px";
    imgEl.style.objectFit = "cover";
    imgEl.style.border = "2px solid rgba(255,255,255,0.92)";
    imgEl.style.boxShadow = "0 6px 16px rgba(0,0,0,0.38)";

    if (fp.blob) {
      imgEl.src = `data:image/jpeg;base64,${fp.blob}`;
    } else {
      imgEl.alt = fp.file;
      imgEl.style.background = "rgba(0,0,0,0.25)";
    }

    rootEl.append(dateEl, imgEl);
    return rootEl;
  };

  function buildPhotoDots(disabled = false) {
    if (disabled) {
      return;
    }

    for (const marker of cssMarkers) {
      marker.removeFromParent();
    }
    cssMarkers.length = 0;

    for (const m of photoMarkers3D) {
      m.removeFromParent();
    }
    photoMarkers3D.length = 0;

    revealed = [];
    currentAnimTimeMs = timelineStartMs;

    const valid = footprints.filter((fp) => fp.lat != null && fp.lon != null);
    if (valid.length === 0) return;

    const { x, y } = latLonToTile(lat, lon, zoom);
    const pathCandidates = valid.map((fp, idx) => {
      const { wx, wz } = footprintToWorld(fp.lat!, fp.lon!, x, y);
      const marker = new CSS2DObject(createPhotoMarkerEl(fp));
      marker.position.set(wx, 0.08, wz);
      // photoOverlays.add(marker);
      cssMarkers.push(marker);

      const time = fp.datetime ? Date.parse(fp.datetime) : Number.NaN;
      return {
        idx,
        time,
        point: new THREE.Vector3(wx, 0.04, wz),
      };
    });

    const ordered = [...pathCandidates].sort((a, b) => {
      const aValid = Number.isFinite(a.time);
      const bValid = Number.isFinite(b.time);

      if (aValid && bValid) return a.time - b.time;
      if (aValid) return -1;
      if (bValid) return 1;
      return a.idx - b.idx;
    });

    if (ordered.length < 2) return;

    const withCurveT = ordered.map((item, i) => {
      const curveT = ordered.length <= 1 ? 0 : i / (ordered.length - 1);
      return { ...item, curveT };
    });
    const validTimes = withCurveT
      .map((item) => item.time)
      .filter((t) => Number.isFinite(t));
    if (validTimes.length > 0) {
      timelineStartMs = Math.min(...validTimes);
      timelineEndMs = Math.max(...validTimes);
    } else {
      timelineStartMs = 0;
      timelineEndMs = 1000;
    }
    orderedFootprints = withCurveT;
    revealed = new Array(withCurveT.length).fill(false);
    currentAnimTimeMs = timelineStartMs;

    // Place a Marker at each ordered footprint — hidden initially, revealed during animation
    for (const item of withCurveT) {
      const m = new Marker();
      m.position.set(item.point.x, 0, item.point.z);
      m.visible = false;
      photoOverlays.add(m);
      photoMarkers3D.push(m);
    }
  }

  // Fetch footprints, compute centroid + best-fit zoom, then render
  GetFootprints()
    .then((data: Footprint[]) => {
      footprints = data;

      console.log("Loaded footprints:", footprints.length);

      const valid = footprints.filter((fp) => fp.lat != null && fp.lon != null);
      if (valid.length > 0) {
        // Centroid
        lat = valid.reduce((s, fp) => s + fp.lat!, 0) / valid.length;
        lon = valid.reduce((s, fp) => s + fp.lon!, 0) / valid.length;

        // Bounding box → find the largest zoom where all points share one tile
        const latMin = Math.min(...valid.map((fp) => fp.lat!));
        const latMax = Math.max(...valid.map((fp) => fp.lat!));
        const lonMin = Math.min(...valid.map((fp) => fp.lon!));
        const lonMax = Math.max(...valid.map((fp) => fp.lon!));

        console.log(
          "Footprint bbox:",
          `${latMin}, ${lonMin} ${latMax}, ${lonMax}`,
        );
        __usePanel_write__(
          2,
          `Bounds: ${latMin.toFixed(4)}, ${lonMin.toFixed(4)} - ${latMax.toFixed(4)}, ${lonMax.toFixed(4)}`,
        );

        let bestZoom = zoom;
        for (let z = 21; z >= 0; z--) {
          const tl = latLonToTile(latMax, lonMin, z);
          const br = latLonToTile(latMin, lonMax, z);
          if (tl.x === br.x && tl.y === br.y) {
            bestZoom = z;
            break;
          }
        }

        zoom = bestZoom;

        __renderControls__({ zoom });
      }

      buildTiles();
      buildPhotoDots();
    })
    .catch((err) => {
      console.warn("Could not load footprints.json:", err);
      buildTiles();
    });

  GetFootprintsGeoJSON()
    .then((data) => {
      geojsonData = data;
      buildHighways();
    })
    .catch((err) => {
      console.warn("Could not load highway GeoJSON:", err);
    });

  // Highway type → width bucket: 0=thin(1px) 1=medium(2px) 2=thick(3px)
  const HIGHWAY_WIDTH_BUCKET: Record<string, number> = {
    motorway: 2,
    motorway_link: 1,
    trunk: 2,
    trunk_link: 1,
    primary: 1,
    primary_link: 1,
  };

  function buildHighways() {
    // Dispose old single LineSegments2
    for (const child of highwayOverlays.children) {
      const ls = child as LineSegments2;
      ls.geometry.dispose();
      (ls.material as LineMaterial).dispose();
    }
    highwayOverlays.clear();

    if (!geojsonData) return;

    const { x: parentX, y: parentY } = latLonToTile(lat, lon, zoom);
    const res = renderer.getSize(new THREE.Vector2());
    const tmpColor = new THREE.Color();

    // 3 buckets: thin (1px), medium (2px), thick (3px)
    const buckets: { positions: number[]; colors: number[] }[] = [
      { positions: [], colors: [] },
      { positions: [], colors: [] },
      { positions: [], colors: [] },
    ];

    const pushSegments = (
      coords: number[][],
      colorHex: number,
      bucketIdx: number,
    ) => {
      const { positions, colors } = buckets[bucketIdx];
      tmpColor.set(colorHex);
      for (let i = 0; i < coords.length - 1; i++) {
        const [lon0, lat0] = coords[i];
        const [lon1, lat1] = coords[i + 1];
        const { wx: x0, wz: z0 } = footprintToWorld(
          lat0,
          lon0,
          parentX,
          parentY,
        );
        const { wx: x1, wz: z1 } = footprintToWorld(
          lat1,
          lon1,
          parentX,
          parentY,
        );
        positions.push(x0, 0.005, z0, x1, 0.005, z1);
        colors.push(
          tmpColor.r,
          tmpColor.g,
          tmpColor.b,
          tmpColor.r,
          tmpColor.g,
          tmpColor.b,
        );
      }
    };

    for (const feature of geojsonData.features) {
      const geom = feature.geometry;
      const highway: string = feature.properties?.highway ?? "";
      const colorHex = HIGHWAY_STYLE[highway] ?? 0x94a3b8;
      const bucket = HIGHWAY_WIDTH_BUCKET[highway] ?? 0;

      const rings: number[][][] =
        geom.type === "LineString"
          ? [geom.coordinates]
          : geom.type === "MultiLineString"
            ? geom.coordinates
            : geom.type === "Polygon"
              ? [geom.coordinates[0]]
              : geom.type === "MultiPolygon"
                ? geom.coordinates.map((p: number[][][]) => p[0])
                : [];

      for (const ring of rings) {
        const coords =
          geom.type === "Polygon" || geom.type === "MultiPolygon"
            ? [...ring, ring[0]]
            : ring;
        if (coords.length < 2) continue;
        pushSegments(coords, colorHex, bucket);
      }
    }

    const linewidths = [3, 6, 8];
    for (let b = 0; b < 3; b++) {
      const { positions, colors } = buckets[b];
      if (positions.length === 0) continue;
      const geo = new LineSegmentsGeometry();
      geo.setPositions(positions);
      geo.setColors(colors);
      const mat = new LineMaterial({
        linewidth: linewidths[b],
        vertexColors: true,
        opacity: 0.9,
        transparent: true,
        resolution: res,
        depthTest: false,
        worldUnits: false,
      });
      const ls = new LineSegments2(geo, mat);
      ls.renderOrder = 998; // Just below photo markers
      ls.computeLineDistances();
      highwayOverlays.add(ls);
    }
  }

  function buildTiles() {
    // Dispose previous tile planes (geometry + material + texture)
    for (const child of subTiles.children) {
      const plane = child as THREE.Mesh;
      const mat = plane.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      plane.geometry.dispose();
    }
    subTiles.clear();

    // scale 1 → 1×1 sub-tiles at zoom+0 per neighbor tile
    // scale 2 → 2×2 sub-tiles at zoom+1 per neighbor tile
    // scale 3 → 4×4 sub-tiles at zoom+2 per neighbor tile
    const gridCount = Math.pow(2, scale - 1);
    const subTileZoom = zoom + (scale - 1);
    const subTileWorldSize = tileWorldSize / gridCount;

    // Center tile coords at `zoom`
    const { x, y, offsetX, offsetY } = latLonToTile(lat, lon, zoom);

    // extendScale 0 → 1×1 neighbor grid (center only)
    // extendScale 1 → 3×3 neighbor grid
    // extendScale 2 → 5×5 neighbor grid
    for (let dr = -extendScale; dr <= extendScale; dr++) {
      for (let dc = -extendScale; dc <= extendScale; dc++) {
        // This neighbor's top-left sub-tile index at subTileZoom
        const neighborBaseX = (x + dc) * gridCount;
        const neighborBaseY = (y + dr) * gridCount;

        for (let row = 0; row < gridCount; row++) {
          for (let col = 0; col < gridCount; col++) {
            // World center: neighbor offset (dc, dr) + sub-tile offset within tile
            const centerX =
              (dc + (col + 0.5) / gridCount - 0.5) * tileWorldSize;
            const centerZ =
              (dr + (row + 0.5) / gridCount - 0.5) * tileWorldSize;

            const plane = new THREE.Mesh(
              new THREE.PlaneGeometry(subTileWorldSize, subTileWorldSize, 1, 1),
              new THREE.MeshBasicMaterial({
                color: 0xe8edf2,
                side: THREE.DoubleSide,
              }),
            );
            plane.renderOrder = 10;
            plane.rotation.x = -Math.PI / 2;
            plane.position.set(centerX, 0, centerZ);
            subTiles.add(plane);

            const tileUrl = createGoogleTileUrl(
              neighborBaseX + col,
              neighborBaseY + row,
              subTileZoom,
            );
            const tileLoader = new THREE.TextureLoader(
              new THREE.LoadingManager(),
            );
            tileLoader.setCrossOrigin("anonymous");
            tileLoader.load(
              tileUrl,
              (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.generateMipmaps = false;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;

                plane.material = new THREE.MeshBasicMaterial({
                  map: texture,
                  side: THREE.DoubleSide,
                });
              },
              undefined,
              () => {
                console.warn(`Failed to load Google tile: ${tileUrl}`);
              },
            );
          }
        }
      }
    }

    // Marker sits at offsetX/offsetY inside the center tile — unaffected by extendScale
    // marker.position.set(
    //   (offsetX - 0.5) * tileWorldSize,
    //   0.02,
    //   (offsetY - 0.5) * tileWorldSize,
    // );
  }

  __updateTHREEJs__only__.zoom = (val: number) => {
    zoom = val;
    buildTiles();
    buildPhotoDots();
    buildHighways();
  };

  __updateTHREEJs__only__.scale = (val: number) => {
    scale = val;
    buildTiles();
    // photo dot positions depend on zoom, not scale — no rebuild needed
  };

  __updateTHREEJs__only__.extendScale = (val: number) => {
    extendScale = val;
    buildTiles();
    // photo dot positions depend on zoom, not extendScale — no rebuild needed
  };

  __updateTHREEJs__invoke__.centerView = () => {
    const { cLat, cLon } = getViewCenterLatlng(camera);
    console.log("Center view at", cLat, cLon);

    lat = cLat;
    lon = cLon;

    buildTiles();
    buildPhotoDots();
    buildHighways();
  };

  let playing = false;

  __updateTHREEJs__invoke__.play = () => {
    currentAnimTimeMs = timelineStartMs;
    revealed = new Array(orderedFootprints.length).fill(false);
    for (const m of cssMarkers) m.removeFromParent();
    for (const m of photoMarkers3D) m.visible = false;
    playing = true;
  };

  __add_nextframe_fn__((s, c, r, delta) => {
    if (!playing) return;

    currentAnimTimeMs = Math.min(
      currentAnimTimeMs + delta * SIM_MS_PER_SECOND,
      timelineEndMs,
    );

    // Reveal markers (CSS2D cards + 3D Marker pins) as simulated time passes each footprint
    const n = orderedFootprints.length;
    for (let i = 0; i < n; i++) {
      const fp = orderedFootprints[i];
      const fpTime = Number.isFinite(fp.time)
        ? fp.time
        : fp.curveT * (timelineEndMs - timelineStartMs) + timelineStartMs;
      if (currentAnimTimeMs >= fpTime && !revealed[i]) {
        revealed[i] = true;
        // const css = cssMarkers[i];
        // if (css && !css.parent) photoOverlays.add(css);
        const pin = photoMarkers3D[i];
        if (pin) pin.visible = true;
      }
    }

    if (currentAnimTimeMs >= timelineEndMs) playing = false;
  });

  __usePanel__({
    width: 300,
    lines: 3,
    placement: "top",
  });

  __add_nextframe_fn__((s, c, r, delta) => {
    __usePanel_write__(0, "Playing: " + (playing ? "Yes" : "No"));
    const simDate = new Date(currentAnimTimeMs);
    const simTimeStr = simDate.toLocaleString();
    __usePanel_write__(1, "Sim Time: " + simTimeStr);
  }, 0.1);
}

__defineControl__("zoom", "range", zoom, {
  ...__defineControl__.rint(8, 21),
  eval: false,
});

__defineControl__("scale", "range", scale, {
  ...__defineControl__.rint(1, 3),
  eval: false,
});

__defineControl__("extendScale", "range", extendScale, {
  ...__defineControl__.rint(0, 6),
  eval: false,
});

__defineControl__("centerView", "btn", "", {});

__defineControl__("play", "btn", "", {});
