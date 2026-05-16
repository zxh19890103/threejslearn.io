import { __useCSS2Renderer__ } from "cases/css2r.js";
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import earcut from "earcut";

function GetFootprints() {
  return fetch("./data/apr30.json").then((r) => r.json());
}

function GetFootprintsGeoJSON() {
  return fetch("./data/footprints0426.geojson").then((r) => r.json());
}

__defineControl__("orbit", "bit", false, {
  eval: false,
  help: "Toggle between MapControls and OrbitControls. MapControls is optimized for map-like navigation (panning and zooming), while OrbitControls allows free rotation around a target point. The switch happens automatically based on camera height, but you can also toggle it manually here.",
});

__defineControl__("xz", "bit", false, { eval: false, label: "xz lines " });
__defineControl__("buildings", "bit", false, {
  eval: false,
  label: "buildings ",
});

export function main(
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  controls: MapControls,
) {
  __useCSS2Renderer__();

  const orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = false;
  orbitControls.enabled = false;

  let isOrbitMode = false;

  type RenderWorldSnapshotResult = {
    target: THREE.WebGLRenderTarget;
    min: THREE.Vector2;
    max: THREE.Vector2;
  };

  /**
   * Goal: Generate a mask texture that includes:
   * - the main color for each building footprint (e.g., average color of the building in the satellite image)
   * @todo
   */
  function renderWorldSnapshot(): RenderWorldSnapshotResult {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const h = camera.position.y;
    const aspect = size.x / size.y;
    const fovY = THREE.MathUtils.degToRad(camera.fov);

    const halfZ = h * Math.tan(fovY / 2);
    const halfX = halfZ * aspect;

    const cx = camera.position.x;
    const cz = camera.position.z;

    console.log(
      "Rendering building hue with ortho camera:",
      JSON.stringify({ cx, cz, h, halfX, halfZ }),
    );

    // Ortho bounds must be in camera-space (relative), not absolute world coords.
    // rotation.x = -PI/2 makes the camera look straight down (-Y world axis).
    // With that rotation, camera-Y = world -Z, so top/bottom are intentionally
    // swapped so that UV.v=0 → world-Z=cz-halfZ and UV.v=1 → world-Z=cz+halfZ,
    // matching the geoUv computation in the building fragment shader.
    // 1. Set frustum planes to match the visible world area
    const orthoCamera = new THREE.OrthographicCamera(
      -halfX, // left
      halfX, // right
      halfZ, // top
      -halfZ, // bottom
      0.1, // near
      h + 1000, // far (must be deep enough to reach the ground)
    );

    // 2. Position the camera at the same XZ as the main camera
    orthoCamera.position.set(cx, h, cz);
    // 3. Look DOWN at the ground (y=0)
    orthoCamera.lookAt(cx, 0, cz);

    const rt = new THREE.WebGLRenderTarget(size.x, size.y);

    renderer.setRenderTarget(rt);
    renderer.render(world, orthoCamera);
    renderer.setRenderTarget(null);

    return {
      target: rt,
      min: new THREE.Vector2(cx - halfX, cz - halfZ),
      max: new THREE.Vector2(cx + halfX, cz + halfZ),
    };
  }

  const generatedTargets: Record<string, THREE.WebGLRenderTarget> = {};

  function runRenderWorldSnapshot({
    name,
    before,
    after,
  }: {
    name: string;
    before?: ({
      lastTarget,
    }: {
      lastTarget: THREE.WebGLRenderTarget | null;
    }) => void;
    after?: (result: RenderWorldSnapshotResult) => void;
  }) {
    const lastTarget = generatedTargets[name] ?? null;

    before?.({
      lastTarget,
    });

    lastTarget?.dispose(); // Dispose the previous render target to free GPU memory

    const result = renderWorldSnapshot();

    generatedTargets[name] = result.target;

    after?.(result);
  }

  function buildingMaskRender() {
    runRenderWorldSnapshot({
      name: "building mask",
      before: ({}) => {
        console.log("Rendering building mask");
        buildings.mesh1.material = buildings.maskMaterial;
      },
      after: ({ target, min, max }) => {
        console.log("Saving building mask texture");
        buildings.mesh1.material = buildings.defaultMaterial;
        gmap.saveBuildingMask(target.texture, min, max);
      },
    });
  }

  function buildingHueRender() {
    runRenderWorldSnapshot({
      name: "building hue",
      before: () => {
        console.log("Rendering building hue");
        buildings.visible = false;
        gmap.children.forEach((child) => {
          if (child instanceof GoogleMapTile) {
            child.material = child.buildingHueMaterial; // Use the default shader which samples the hue texture
          }
        });
      },
      after: ({ target, min, max }) => {
        gmap.children.forEach((child) => {
          if (child instanceof GoogleMapTile) {
            child.material = child.defaultMaterial; // Use the default shader which samples the hue texture
          }
        });

        buildings.visible = true;
        console.log("Rendering building ID map");
        const idTarget = buildings.renderIdMap(renderer, min, max);
        console.log("Updating building hue texture");
        buildings.applyHueFromSnapshot(renderer, target, idTarget);
        idTarget.dispose();
      },
    });
  }

  function vegetationRender() {
    runRenderWorldSnapshot({
      name: "vegetation",
      before: () => {
        console.log("Rendering vegetation mask");
        buildings.visible = false;
        gmap.children.forEach((child) => {
          if (child instanceof GoogleMapTile) {
            child.material = child.vegetationMaterial;
          }
        });
      },
      after: ({ target, min, max }) => {
        gmap.children.forEach((child) => {
          if (child instanceof GoogleMapTile) {
            child.material = child.defaultMaterial;
          }
        });
        buildings.visible = true;
        console.log("Building vegetation mesh from snapshot");
        // vegetation.buildFromSnapshot(renderer, target, min, max);
      },
    });
  }

  let xzLines: THREE.LineSegments = null;
  function createXZLines() {
    const campos = camera.position;
    const h = 100;

    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(
        [
          [campos.x, campos.z],
          [campos.x + 1e4, campos.z],
          [campos.x, campos.z],
          [campos.x, campos.z + 1e4],
        ].map((xz) => new THREE.Vector3(xz[0], h, xz[1])),
      ),
      new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 1,
        vertexColors: true,
        color: 0xffffff,
      }),
    );

    lines.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1], 3),
    );

    lines.renderOrder = 99999;
    lines.frustumCulled = false;

    xzLines = lines;

    world.add(lines);
  }

  __updateTHREEJs__only__.xz = (val) => {
    if (val) {
      createXZLines();
    } else {
      if (xzLines) {
        world.remove(xzLines);
      }
    }
  };

  __updateTHREEJs__only__.buildings = (val) => {
    buildings.visible = val;
  };

  __updateTHREEJs__only__.orbit = (val) => {
    isOrbitMode = val;

    if (val) {
      __renderers__.paused = true; // Pause main render loop to ensure we capture the hue without interference
      buildingMaskRender();
      buildingHueRender();
      // vegetationRender();
      __renderers__.paused = false; // Resume main render loop after capturing the hue

      controls.enabled = false;
      orbitControls.target.copy(controls.target);
      orbitControls.enabled = true;

      console.log("→ OrbitControls");
    } else {
      orbitControls.enabled = false;

      controls.target.copy(orbitControls.target);
      controls.enabled = true;
      controls.update();

      console.log("→ MapControls");
    }
  };

  __add_nextframe_fn__((w, c, r, delta) => {
    if (isOrbitMode) {
      orbitControls.update(delta);
    }
  });

  /**
   * @todo here to sync the map center with the camera.
   */
  controls.addEventListener("end", () => {
    gmap.zoom = resolveZoomLevel(camera.position.y);
    updateTiles();
  });

  console.log("Main2 loaded!");

  function setupCamera(latlng: string) {
    const [lat, lng] = latlng.split(",").map((s) => parseFloat(s.trim()));

    const position = latLngToPosition(lat, lng);

    camera.position.set(
      position.x,
      1e4, // Start with a default height; you can adjust this as needed
      position.y,
    );

    controls.target.set(position.x, 0, position.y);
    controls.update();
  }

  __usePanel__({
    width: 300,
    lines: 4,
    placement: "top",
  });

  __add_nextframe_fn__((w, c, r) => {
    __usePanel_write__(0, "cam height: " + c.position.y.toFixed(2));
    __usePanel_write__(1, "cam zoom: " + resolveZoomLevel(c.position.y));
  }, 0.3);

  const gmap = new GoogleMap();
  world.add(gmap);

  // DEM bbox matches topography.py: west, south, east, north
  const _demBboxLatLng = {
    west: 102.639515788,
    south: 24.959090156,
    east: 102.836238863,
    north: 25.085964203,
  };

  const _demBboxMin = latLngToPosition(
    _demBboxLatLng.south,
    _demBboxLatLng.west,
  );
  const _demBboxMax = latLngToPosition(
    _demBboxLatLng.north,
    _demBboxLatLng.east,
  );

  const bboxPoints = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(_demBboxMin.x, 50, _demBboxMin.y),
      new THREE.Vector3(_demBboxMin.x, 50, _demBboxMax.y),
      new THREE.Vector3(_demBboxMax.x, 50, _demBboxMax.y),
      new THREE.Vector3(_demBboxMax.x, 50, _demBboxMin.y),
      new THREE.Vector3(_demBboxMin.x, 50, _demBboxMin.y),
    ]),
    new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 1,
      depthTest: false,
    }),
  );

  bboxPoints.renderOrder = 99999;
  world.add(bboxPoints);

  const _demBbox = new THREE.Vector4(
    _demBboxMin.x, // west
    _demBboxMin.y, // south (note the swap due to Y-axis inversion in world coords)
    _demBboxMax.x, // east
    _demBboxMax.y, // north
  );

  console.log(
    "DEM bbox in world coords:",
    _demBbox
      .toArray()
      .map((v) => v.toFixed(2))
      .join(", "),
  );

  const max_elevation = 2277;
  const min_elevation = 1831;

  textureLoader.load("./topography.png", (demTexture) => {
    demTexture.minFilter = THREE.LinearFilter;
    demTexture.magFilter = THREE.LinearFilter;
    console.log("DEM texture loaded, applying to GoogleMap tiles");

    const span = max_elevation - min_elevation;
    gmap.setDemTexture(demTexture, _demBbox, 0, span);
    buildings.setDemTexture(demTexture, _demBbox, 0, span);
  });

  const buildings = new Buildings();
  world.add(buildings);

  __add_nextframe_fn__((w, c, r, delta) => {
    gmap.tick();
  }, 0.03);

  function updateTiles() {
    const visibleWorld = getVisibleWorldFromScreen(gmap.zoom, camera, renderer);

    console.log(
      "Visible world bbox: ",
      [
        visibleWorld.west.toFixed(9),
        visibleWorld.south.toFixed(9),
        visibleWorld.east.toFixed(9),
        visibleWorld.north.toFixed(9),
      ].join(", "),
    );

    const tiles = getAllTilesInView(visibleWorld, gmap.zoom);

    const { toAdd, toRemove } = diffTiles(oldTiles, tiles);
    oldTiles = tiles;

    console.log("Tiles to add:", toAdd.length);
    console.log("Tiles to remove:", toRemove.length);

    gmap.updateTiles(tiles);
  }

  let oldTiles: Gis.Tile[] = [];

  const guessedCenterLat = (_demBboxLatLng.north + _demBboxLatLng.south) / 2;
  const guessedCenterLon = (_demBboxLatLng.west + _demBboxLatLng.east) / 2;
  const gussedZoomLevel = 11;

  setupCamera(`${guessedCenterLat}, ${guessedCenterLon}`);
  gmap.zoom = gussedZoomLevel;
  updateTiles();
}

namespace Gis {
  export interface LatLng {
    lat: number;
    lon: number;
  }

  export interface Position {
    x: number;
    y: number;
    z?: number;
  }

  export type LonLat = [number, number]; // [lon, lat]
  export type PositionTuple = [number, number]; // [x, y]

  export interface VisibleWorld {
    north: number;
    south: number;
    east: number;
    west: number;
  }

  export type Bbox = {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  export interface Tile {
    id: string;
    x: number;
    y: number;
    z: number;
    bbox: Bbox;
    size: number;
    latDistance: number;
    yDistance?: number;
    lonDistance: number;
    xDistance?: number;
  }

  export type TileCorner = "ct" | "nw" | "ne" | "se" | "sw";

  export type TileOps = "add" | "remove";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clacTileBbox(tile: Gis.Tile): Gis.Bbox {
  const nw = tileToLatLng(tile, tile.z, "nw");
  const se = tileToLatLng(tile, tile.z, "se");

  return {
    north: nw.lat,
    west: nw.lon,
    south: se.lat,
    east: se.lon,
  };
}

/**
 * @todo
 */
function latLngToTile(lat: number, lon: number, zoom: number): Gis.Tile {
  const latClamped = clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT);
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = THREE.MathUtils.degToRad(latClamped);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );

  const wrappedX = ((x % n) + n) % n;
  const clampedY = clamp(y, 0, n - 1);

  const tile: Gis.Tile = {
    id: `${zoom}/${wrappedX}/${clampedY}`,
    x: wrappedX,
    y: clampedY,
    z: zoom,
    bbox: null,
    latDistance: 0,
    lonDistance: 0,
    size: (2 * Math.PI * mercator_scale) / n, // Size of the tile in world units at the given zoom level
  };

  tile.bbox = clacTileBbox(tile);

  tile.latDistance = tile.bbox.north - tile.bbox.south;
  tile.lonDistance = tile.bbox.east - tile.bbox.west;

  const centerLat = (tile.bbox.north + tile.bbox.south) / 2;
  tile.xDistance = meters_per_lon(centerLat) * tile.lonDistance;
  tile.yDistance = meters_per_lat * tile.latDistance;

  return tile;
}

/**
 * @todo
 * returns the center
 */
function tileToLatLng(
  tile: Gis.Tile,
  zoom: number,
  corner: Gis.TileCorner = "ct",
): Gis.LatLng {
  const n = 2 ** zoom;

  switch (corner) {
    case "nw":
      return {
        lat: THREE.MathUtils.radToDeg(
          Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n))),
        ),
        lon: (tile.x / n) * 360 - 180,
      };
    case "ne":
      return {
        lat: THREE.MathUtils.radToDeg(
          Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n))),
        ),
        lon: ((tile.x + 1) / n) * 360 - 180,
      };
    case "sw":
      return {
        lat: THREE.MathUtils.radToDeg(
          Math.atan(Math.sinh(Math.PI * (1 - (2 * (tile.y + 1)) / n))),
        ),
        lon: (tile.x / n) * 360 - 180,
      };
    case "se":
      return {
        lat: THREE.MathUtils.radToDeg(
          Math.atan(Math.sinh(Math.PI * (1 - (2 * (tile.y + 1)) / n))),
        ),
        lon: ((tile.x + 1) / n) * 360 - 180,
      };
  }

  const lon = ((tile.x + 0.5) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tile.y + 0.5)) / n)));

  return { lat: THREE.MathUtils.radToDeg(latRad), lon };
}

function latlngToMercator(lat: number, lon: number): { x: number; y: number } {
  const latClamped = clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT);
  const latRad = THREE.MathUtils.degToRad(latClamped);
  const lonRad = THREE.MathUtils.degToRad(lon);

  return {
    x: lonRad,
    y: Math.log(Math.tan(Math.PI / 4 + latRad / 2)),
  };
}

const MAX_MERCATOR_LAT = 85.05112878;
const mercator_scale = 6378137; // Earth's radius in meters
const meters_per_lat = (2 * Math.PI * mercator_scale) / 360;
const meters_per_lon = (lat: number) => {
  const latRad = THREE.MathUtils.degToRad(lat);
  return (2 * Math.PI * mercator_scale * Math.cos(latRad)) / 360;
};

function mercatorToLatLng(x: number, y: number): Gis.LatLng {
  const lon = THREE.MathUtils.radToDeg(x);
  const lat = THREE.MathUtils.radToDeg(
    2 * Math.atan(Math.exp(y)) - Math.PI / 2,
  );

  return {
    lat: clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT),
    lon,
  };
}

/**
 * @todo
 */
function latLngToPosition(lat: number, lon: number): Gis.Position {
  const { x, y } = latlngToMercator(lat, lon);
  return { x: x * mercator_scale, y: -y * mercator_scale, z: 0 };
}

/**
 * @todo
 */
function positionToLatLng(x: number, y: number): Gis.LatLng {
  return mercatorToLatLng(x / mercator_scale, -y / mercator_scale);
}

/**
 * @todo
 */
function getVisibleWorldFromScreen_old(
  zoom: number,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
): Gis.VisibleWorld {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  if (size.x <= 0 || size.y <= 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }

  const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  const ndcCorners = [
    new THREE.Vector2(-1, -1),
    new THREE.Vector2(1, -1),
    new THREE.Vector2(1, 1),
    new THREE.Vector2(-1, 1),
  ];

  const points = ndcCorners
    .map((ndc) => {
      const farPoint = new THREE.Vector3(ndc.x, ndc.y, 1).unproject(camera);
      const dir = farPoint.sub(camera.position).normalize();
      const ray = new THREE.Ray(camera.position.clone(), dir);
      return ray.intersectPlane(zPlane, new THREE.Vector3());
    })
    .filter((p): p is THREE.Vector3 => p !== null);

  console.log(
    "Frustum corners in world space:",
    points.length,
    points.map((p) => `x: ${p.x}, y: ${p.y}, z: ${p.z}\n`).join(""),
  );

  if (points.length === 0) {
    const center = positionToLatLng(camera.position.x, camera.position.y);
    return {
      north: center.lat,
      south: center.lat,
      east: center.lon,
      west: center.lon,
    };
  }

  const latLngs = points.map((p) => positionToLatLng(p.x, p.y));
  const north = Math.max(...latLngs.map((p) => p.lat));
  const south = Math.min(...latLngs.map((p) => p.lat));
  const east = Math.max(...latLngs.map((p) => p.lon));
  const west = Math.min(...latLngs.map((p) => p.lon));

  const padding = 1 / 2 ** zoom;

  return {
    north: clamp(north + padding, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT),
    south: clamp(south - padding, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT),
    east: east + padding,
    west: west - padding,
  };
}

function getVisibleWorldFromScreen(
  zoom: number,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
): Gis.VisibleWorld {
  const size = new THREE.Vector2();
  renderer.getSize(size);
  if (size.x <= 0 || size.y <= 0)
    return { north: 0, south: 0, east: 0, west: 0 };

  const h = camera.position.y;
  const aspect = size.x / size.y;
  const fovY = THREE.MathUtils.degToRad(camera.fov);

  // Half-extents of the visible ground area
  const halfZ = h * Math.tan(fovY / 2);
  const halfX = halfZ * aspect;

  const cx = camera.position.x;
  const cz = camera.position.z;

  const corners = [
    positionToLatLng(cx - halfX, cz + halfZ), // NW
    positionToLatLng(cx + halfX, cz + halfZ), // NE
    positionToLatLng(cx + halfX, cz - halfZ), // SE
    positionToLatLng(cx - halfX, cz - halfZ), // SW
  ];

  const padding = 1 / 2 ** zoom;
  return {
    north: clamp(
      Math.max(...corners.map((p) => p.lat)) + padding,
      -MAX_MERCATOR_LAT,
      MAX_MERCATOR_LAT,
    ),
    south: clamp(
      Math.min(...corners.map((p) => p.lat)) - padding,
      -MAX_MERCATOR_LAT,
      MAX_MERCATOR_LAT,
    ),
    east: Math.max(...corners.map((p) => p.lon)) + padding,
    west: Math.min(...corners.map((p) => p.lon)) - padding,
  };
}

/**
 * @todo
 */
function getAllTilesInView(
  visibleWorld: Gis.VisibleWorld,
  zoom: number,
): Gis.Tile[] {
  const n = 2 ** zoom;
  const nw = latLngToTile(visibleWorld.north, visibleWorld.west, zoom);
  const se = latLngToTile(visibleWorld.south, visibleWorld.east, zoom);

  const tiles: Gis.Tile[] = [];
  for (let y = nw.y; y <= se.y; y++) {
    for (let x = nw.x; x <= se.x; x++) {
      const wrappedX = ((x % n) + n) % n;

      const tile: Gis.Tile = {
        id: `${zoom}/${wrappedX}/${y}`,
        x: wrappedX,
        y,
        z: zoom,
        bbox: null,
        latDistance: 0,
        lonDistance: 0,
        size: (2 * Math.PI * mercator_scale) / n, // Size of the tile in world units at the given zoom level
      };

      tile.bbox = clacTileBbox(tile);
      tile.latDistance = tile.bbox.north - tile.bbox.south;
      tile.lonDistance = tile.bbox.east - tile.bbox.west;

      const centerLat = (tile.bbox.north + tile.bbox.south) / 2;
      tile.xDistance = meters_per_lon(centerLat) * tile.lonDistance;
      tile.yDistance = meters_per_lat * tile.latDistance;

      tiles.push(tile);
    }
  }

  return tiles;
}

/**
 * @todo
 */
function diffTiles(oldTiles: Gis.Tile[], newTiles: Gis.Tile[]) {
  const oldById = new Map(oldTiles.map((t) => [t.id, t]));
  const newById = new Map(newTiles.map((t) => [t.id, t]));

  return {
    toAdd: newTiles.filter((tile) => !oldById.has(tile.id)),
    toRemove: oldTiles.filter((tile) => !newById.has(tile.id)),
  };
}

const zoom_level_offset = 2;

function resolveZoomLevel(cameraHeight: number): number {
  const zoom = Math.floor(
    Math.log2((2 * Math.PI * mercator_scale) / cameraHeight),
  );
  return clamp(zoom, 0, 19) + zoom_level_offset;
}

/**
 * @todo
 */
class GoogleMap extends THREE.Group {
  center: Gis.LatLng = { lat: 0, lon: 0 };
  zoom = 12;
  tileSize = 1e4;

  private readonly tilesPositionPoints: THREE.Points;
  private readonly targetTileIds = new Set<string>();
  private readonly staleTileIds = new Set<string>();
  private readonly fadingInTileIds = new Set<string>();

  private transitionStartMs = 0;
  private readonly minCoverageToCommit = 0.85;
  private readonly maxTransitionWaitMs = 900;

  getTileSizeInWorldUnits(zoom: number): number {
    return this.tileSize / 2 ** zoom;
  }

  constructor() {
    super();

    this.tilesPositionPoints = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: 0xff0000,
        size: 10,
        sizeAttenuation: false,
        depthTest: false,
      }),
    );

    this.add(this.tilesPositionPoints);
  }

  #buildTile(tile: Gis.Tile): GoogleMapTile {
    const tileMesh = new GoogleMapTile(
      tile,
      tile.size,
      tile.size,
      this.#onTileReady,
    );
    this.add(tileMesh);

    const latLng = tileToLatLng(tile, this.zoom);
    const pos = latLngToPosition(latLng.lat, latLng.lon);
    tileMesh.position.set(pos.x, 0, pos.y);

    tileMesh.renderOrder = ++tileRenderCounter;
    this.fadingInTileIds.add(tile.id);

    if (this._dem) {
      tileMesh.applyDemTexture(
        this._dem.texture,
        this._dem.bbox,
        this._dem.displacementBias,
        this._dem.displacementScale,
      );
    }

    return tileMesh;
  }

  #onTileReady = (tileId: string) => {
    this.#tryCommitTransition();
  };

  #getTileById(tileId: string): GoogleMapTile | null {
    const obj = this.getObjectByName(tileId);
    if (!obj || !(obj instanceof GoogleMapTile)) return null;
    return obj;
  }

  #getCoverageForTargetTiles(): number {
    if (this.targetTileIds.size === 0) return 1;

    let loaded = 0;
    for (const tileId of this.targetTileIds) {
      const tile = this.#getTileById(tileId);
      if (tile?.isReady) loaded++;
    }

    return loaded / this.targetTileIds.size;
  }

  #tryCommitTransition() {
    if (this.staleTileIds.size === 0) return;

    const coverage = this.#getCoverageForTargetTiles();
    const elapsed = performance.now() - this.transitionStartMs;
    const canCommit =
      coverage >= this.minCoverageToCommit ||
      elapsed >= this.maxTransitionWaitMs;

    if (!canCommit) return;

    for (const tileId of this.staleTileIds) {
      const tile = this.#getTileById(tileId);
      if (!tile) continue;
      this.remove(tile);
    }
    this.staleTileIds.clear();
  }

  getTargetCoverage(): number {
    return this.#getCoverageForTargetTiles();
  }

  tick() {
    for (const tileId of [...this.fadingInTileIds]) {
      const tile = this.#getTileById(tileId);
      if (!tile) {
        this.fadingInTileIds.delete(tileId);
        continue;
      }

      if (!tile.isReady) continue;

      const mat = tile.material;
      mat.opacity = Math.min(1, mat.opacity + 0.12);
      if (mat.opacity >= 1) {
        this.fadingInTileIds.delete(tileId);
      }
    }

    this.#tryCommitTransition();
  }

  /**
   * @todo
   */
  updateTiles(tiles: Gis.Tile[]) {
    const nextById = new Map(tiles.map((tile) => [tile.id, tile]));
    this.targetTileIds.clear();
    for (const tile of tiles) this.targetTileIds.add(tile.id);

    for (const tile of tiles) {
      if (this.#getTileById(tile.id)) continue;
      this.#buildTile(tile);
    }

    for (const child of this.children) {
      if (!(child instanceof GoogleMapTile)) continue;
      if (nextById.has(child.name)) continue;
      this.staleTileIds.add(child.name);
    }

    this.transitionStartMs = performance.now();
    this.#tryCommitTransition();
  }

  /**
   * @todo
   */
  addTiles(tiles: Gis.Tile[]) {
    for (const tile of tiles) {
      if (this.getObjectByName(tile.id)) continue;
      this.#buildTile(tile);
    }
  }

  /**
   * @todo
   */
  removeTiles(tiles: Gis.Tile[]) {
    for (const tile of tiles) {
      const tileMesh = this.getObjectByName(tile.id);
      if (!tileMesh) continue;
      this.remove(tileMesh);
    }
  }

  private buildingMask: {
    texture: THREE.Texture;
    min: THREE.Vector2;
    max: THREE.Vector2;
  } = null;

  saveBuildingMask(
    texture: THREE.Texture,
    min: THREE.Vector2,
    max: THREE.Vector2,
  ) {
    this.buildingMask = {
      texture,
      min,
      max,
    };
  }

  private _dem: {
    texture: THREE.Texture;
    bbox: THREE.Vector4;
    displacementBias: number;
    displacementScale: number;
  } | null = null;

  setDemTexture(
    texture: THREE.Texture,
    bbox: THREE.Vector4,
    displacementBias = 0,
    displacementScale = 1,
  ): void {
    this._dem = { texture, bbox, displacementBias, displacementScale };

    for (const child of this.children) {
      if (child instanceof GoogleMapTile) {
        child.applyDemTexture(
          texture,
          bbox,
          displacementBias,
          displacementScale,
        );
      }
    }
  }
}

let tileRenderCounter = 0; // Global counter to assign renderOrder to tiles in the order they are added

const textureLoader = new THREE.TextureLoader(
  new THREE.LoadingManager(() => {
    console.log("All textures loaded");
  }),
);

class GoogleMapTile extends THREE.Mesh<
  THREE.BufferGeometry,
  THREE.ShaderMaterial
> {
  isReady = false;

  readonly defaultMaterial: THREE.ShaderMaterial;
  readonly vegetationMaterial: THREE.ShaderMaterial;
  readonly soilMaterial: THREE.ShaderMaterial;
  readonly buildingHueMaterial: THREE.ShaderMaterial;

  constructor(
    tile: Gis.Tile,
    width = 256,
    height = 256,
    onReady?: (tileId: string) => void,
  ) {
    const sharedUniforms = {
      map: { value: null },
      buildingMask: { value: null },
      useMap: { value: false },
      demMap: { value: null as THREE.Texture | null },
      demBbox: { value: new THREE.Vector4(0, 0, 1, 1) }, // (westX, southZ, eastX, northZ) in world units
      demdisplacementBias: { value: 1.0 },
      demDisplacementScale: { value: 2000.0 },
      useDem: { value: false },
    };

    const material = new THREE.ShaderMaterial({
      wireframe: false,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0,
      depthTest: true,
      uniforms: sharedUniforms,
      vertexShader: /**glsl */ `
        uniform float demdisplacementBias;
        uniform float demDisplacementScale;
        uniform sampler2D demMap;
        uniform vec4 demBbox; // (westX, southZ, eastX, northZ) in world units
        uniform bool useDem;

        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 world_pos = modelMatrix * vec4(position, 1.0);

          if (useDem) {
            vec2 demUv = (world_pos.xz - demBbox.xy) / (demBbox.zw - demBbox.xy);

            if (demUv.x < 0.0 || demUv.x > 1.0 || demUv.y < 0.0 || demUv.y > 1.0) {
              gl_Position = projectionMatrix * viewMatrix * world_pos;
              return;
            }

            float demHeight = texture2D(demMap, demUv).r;
            world_pos.y += demHeight * demDisplacementScale + demdisplacementBias;
          }
          
          gl_Position = projectionMatrix * viewMatrix * world_pos;
        }
      `,
      fragmentShader: /**glsl */ `
        uniform sampler2D map;
        uniform bool useMap; // Explicitly set this to true/false in your app
        varying vec2 vUv;

        void main() {
          if (useMap) {
            vec4 color = texture2D(map, vUv);
            gl_FragColor = vec4(color.rgb, 1.0);
          } else {
            gl_FragColor = vec4(0.0, 0.5, 0.0, 0.6);
          }
        }
      `,
    });

    // Subdivided plane for DEM displacement (32×32 segments).
    // PlaneGeometry lies in XY; rotating -π/2 around X maps it to XZ (y=0 ground plane).
    // UV layout after rotation: NW=(0,0), NE=(1,0), SW=(0,1), SE=(1,1) — same as original.
    const geometry = new THREE.PlaneGeometry(width, height, 64, 64);
    geometry.rotateX(-Math.PI / 2);

    super(geometry, material);

    this.defaultMaterial = material;

    this.vegetationMaterial = new THREE.ShaderMaterial({
      wireframe: false,
      side: THREE.FrontSide,
      transparent: false,
      opacity: 1,
      depthTest: true,
      uniforms: sharedUniforms,
      vertexShader: /**glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /**glsl */ `
        uniform sampler2D map;
        varying vec2 vUv;

        float exgr(vec4 color) {
          // Simple heuristic: if the green channel is significantly higher than red and blue, consider it vegetation
          float exr = color.r * 1.3 - color.g;
          float exg = color.g * 2.0 - color.r - color.b;
          return exg - exr; // Adjust threshold as needed
        }

        void main() {
            vec4 color = texture2D(map, vUv);
            
            float vegetation = exgr(color);
            vegetation = smoothstep(0.0, 0.3, vegetation); // Adjust thresholds for better results
            vec3 finalColor = mix(vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), vegetation);

            gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    this.soilMaterial = new THREE.ShaderMaterial({
      wireframe: false,
      side: THREE.FrontSide,
      transparent: false,
      opacity: 1,
      depthTest: true,
      uniforms: sharedUniforms,
      vertexShader: /**glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /**glsl */ `
        uniform sampler2D map;
        uniform bool useMap; // Explicitly set this to true/false in your app
        varying vec2 vUv;

        vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.y, q.z);
          float e = 1.0e-10;
          return vec3(abs(q.z + (q.y - q.z) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        void main() {
          vec4 color = texture2D(map, vUv);

          vec3 hsv = rgb2hsv(color.rgb);

          // Soil check: Hue is brownish (approx 0.05 - 0.15), 
          // Saturation is moderate, Value is not too dark.
          bool isBrown = hsv.x > 0.05 && hsv.x < 0.15;
          bool isNotDull = hsv.y > 0.1 && hsv.z > 0.4;

          vec3 finalColor = color.rgb;

          if (isBrown && isNotDull) {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // Highlight soil in Red
          } else {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          }
        }
      `,
    });

    this.buildingHueMaterial = new THREE.ShaderMaterial({
      wireframe: false,
      uniforms: sharedUniforms,
      vertexShader: /**glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
      fragmentShader: `
          uniform sampler2D map;
          varying vec2 vUv;

          void main() {
            vec4 color = texture2D(map, vUv);

            vec3 finalColor = color.rgb;

            finalColor = (finalColor - 0.2) * 0.8 + 0.2; // Simple contrast adjustment
            float luminance = dot(finalColor, vec3(0.2126, 0.7152, 0.0722));
            vec3 grayscale = vec3(luminance);
            finalColor = mix(grayscale, color.rgb, 4.0); // Adjust the 0.7 factor to control how much to desaturate non-vegetation areas

            float levels = 5.0; // Number of discrete levels
            finalColor = floor(finalColor * levels) / levels;

            gl_FragColor = vec4(finalColor, 1.0);
          }
        `,
    });

    textureLoader.load(
      `https://mt.google.com/vt/lyrs=s&x=${tile.x}&y=${tile.y}&z=${tile.z}&scale=2&hl=en`,
      (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        material.uniforms.map.value = texture;
        material.uniforms.useMap.value = true;

        material.needsUpdate = true;
        this.isReady = true;
        onReady?.(tile.id);
      },
      undefined,
      () => {
        this.isReady = true;
        material.opacity = 1;
        onReady?.(tile.id);
      },
    );

    this.name = tile.id;
  }

  /**
   * Apply a DEM displacement texture to this tile.
   * bbox is a Vector4 of (westX, northZ, eastX, southZ) in world units.
   */
  applyDemTexture(
    texture: THREE.Texture,
    bbox: THREE.Vector4,
    displacementBias: number,
    displacementScale: number,
  ): void {
    const u = this.defaultMaterial.uniforms;
    u.demMap.value = texture;
    u.demBbox.value = bbox;
    u.demdisplacementBias.value = displacementBias;
    u.demDisplacementScale.value = displacementScale;
    u.useDem.value = true;
    this.defaultMaterial.needsUpdate = true;
  }
}

namespace FPs {
  export type Footprint = {
    file: string;
    lat: number | null;
    lon: number | null;
    datetime: string | null;
    blob?: string | null;
  };
}

const SIM_MS_PER_SECOND = 30 * 60 * 1000; // 30 real minutes = 1 sim day

class Photos extends THREE.Group<THREE.Object3DEventMap & { ready: {} }> {
  _lat: number;
  _lon: number;
  _zoom: number;

  constructor(renderer: THREE.WebGLRenderer) {
    super();

    const photosPoints = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: 0xf09ff0,
        size: 10,
        sizeAttenuation: false,
        depthTest: true,
      }),
    );

    photosPoints.frustumCulled = false;
    photosPoints.renderOrder = 999999;
    this.add(photosPoints);

    // Group for GeoJSON highway lines, rebuilt on zoom/pan change
    const highwayOverlays = new THREE.Group();
    highwayOverlays.renderOrder = 5;
    this.add(highwayOverlays);

    let footprints: FPs.Footprint[] = [];
    let orderedFootprints: any[] = [];
    let revealed: boolean[] = [];
    let timelineEndMs = 0;
    let currentAnimTimeMs = 0;
    let timelineStartMs = 0;
    let playing = false;

    // Fetch footprints, compute centroid + best-fit zoom, then render
    GetFootprints()
      .then((data: FPs.Footprint[]) => {
        footprints = data;

        console.log("Loaded footprints:", footprints.length);

        const valid = footprints.filter(
          (fp) => fp.lat != null && fp.lon != null,
        );
        if (valid.length > 0) {
          // Centroid
          this._lat = valid.reduce((s, fp) => s + fp.lat!, 0) / valid.length;
          this._lon = valid.reduce((s, fp) => s + fp.lon!, 0) / valid.length;

          // Bounding box → find the largest zoom where all points share one tile
          const latMin = Math.min(...valid.map((fp) => fp.lat!));
          const latMax = Math.max(...valid.map((fp) => fp.lat!));
          const lonMin = Math.min(...valid.map((fp) => fp.lon!));
          const lonMax = Math.max(...valid.map((fp) => fp.lon!));

          let bestZoom = this._zoom;
          for (let z = 21; z >= 0; z--) {
            const tl = latLngToTile(latMax, lonMin, z);
            const br = latLngToTile(latMin, lonMax, z);
            if (tl.x === br.x && tl.y === br.y) {
              bestZoom = z;
              break;
            }
          }

          this._zoom = bestZoom;

          this.dispatchEvent({ type: "ready" });
        }

        buildPhotoDots();
      })
      .catch((err) => {
        console.warn("Could not load footprints.json:", err);
      });

    const buildPhotoDots = (disabled = false) => {
      if (disabled) {
        return;
      }

      revealed = [];
      currentAnimTimeMs = timelineStartMs;

      const valid = footprints.filter((fp) => fp.lat != null && fp.lon != null);
      if (valid.length === 0) return;

      const pathCandidates = valid.map((fp, idx) => {
        const pos = latLngToPosition(fp.lat!, fp.lon!);
        const time = fp.datetime ? Date.parse(fp.datetime) : Number.NaN;
        return {
          idx,
          time,
          point: new THREE.Vector3(pos.x, 0.04, pos.y),
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
    };

    const tick = (delta: number) => {
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
          /**
           * @todo
           */
        }
      }

      if (currentAnimTimeMs >= timelineEndMs) playing = false;
    };

    this.tick = tick;
    this.play = () => {
      if (orderedFootprints.length === 0) return;
      if (playing) return;

      currentAnimTimeMs = timelineStartMs;
      revealed = new Array(orderedFootprints.length).fill(false);
      playing = true;
    };

    __add_nextframe_fn__((s, c, r, delta) => {
      const simDate = new Date(currentAnimTimeMs);
      const simTimeStr = simDate.toLocaleString();
      __usePanel_write__(2, "Sim Time: " + simTimeStr);
    }, 0.1);
  }

  public play: () => void;
  public tick: (delta: number) => void;
}

enum BuildingType {
  SKYSCRAPER = 0, // Blue/Silver glass curtain wall
  SLAB_RESIDENTIAL = 1, // Beige concrete, repeated balconies (Kunming style)
  POINT_TOWER = 2, // Modular white/gray grid
  RETAIL_MALL = 3, // Large storefronts and signage
  URBAN_VILLAGE = 4, // Weathered brick, irregular windows (Handshake houses)
  MODERN_OFFICE = 5, // Dark glass with horizontal louvers
  INDUSTRIAL_LOFT = 6, // Red brick with large multi-pane windows
  CIVIC_PUBLIC = 7, // Smooth stone/marble with large vertical spans
}

class Buildings extends THREE.Group {
  private _dem: {
    texture: THREE.Texture;
    bbox: THREE.Vector4;
    displacementBias: number;
    displacementScale: number;
  } | null = null;

  readonly defaultMaterial: THREE.ShaderMaterial;
  readonly maskMaterial: THREE.ShaderMaterial;
  readonly idMaskMaterial: THREE.ShaderMaterial;
  readonly mesh1: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly buildingInfos: Array<{
    wx: number;
    wz: number;
    startVertex: number;
    vertexCount: number;
  }> = [];

  readonly buildingAtlasTypeOffset: Record<BuildingType, THREE.Vector2> = {
    [BuildingType.SKYSCRAPER]: new THREE.Vector2(0, 0.5),
    [BuildingType.SLAB_RESIDENTIAL]: new THREE.Vector2(0.25, 0.5),
    [BuildingType.POINT_TOWER]: new THREE.Vector2(0.5, 0.5),
    [BuildingType.RETAIL_MALL]: new THREE.Vector2(0.75, 0.5),
    [BuildingType.URBAN_VILLAGE]: new THREE.Vector2(0, 0),
    [BuildingType.MODERN_OFFICE]: new THREE.Vector2(0.25, 0),
    [BuildingType.INDUSTRIAL_LOFT]: new THREE.Vector2(0.5, 0),
    [BuildingType.CIVIC_PUBLIC]: new THREE.Vector2(0.75, 0),
  };

  readonly buildingAtlasScale = new THREE.Vector2(0.25, 0.5); // Each building type occupies a 0.25 x 0.5 region in the texture atlas

  constructor() {
    super();

    this.renderOrder = 1e6;

    function estimateHeightFromFootprintArea(
      area: number,
      aspectRatio: number,
    ): number {
      // 1. Urban Village / "Handshake" Houses
      // Very small footprints, typically 5-8 floors (15-25m)
      if (area < 120) {
        return 15 + Math.random() * 10;
      }

      // 2. High-Density Residential (Point Towers)
      // Small to medium footprint, but almost always 30+ floors in modern China
      if (area >= 120 && area < 450 && aspectRatio < 1.5) {
        return 80 + Math.random() * 40; // 80m to 120m
      }

      // 3. Slab Residential Blocks
      // Long, rectangular footprints. Usually 18-26 floors.
      if (area >= 450 && area < 900 && aspectRatio >= 2.0) {
        return 50 + Math.random() * 30; // 50m to 80m
      }

      // 4. Large Commercial Podiums / Malls
      // Massive footprints but relatively low height.
      if (area > 2000) {
        return 12 + Math.random() * 10; // 12m to 22m (3-5 floors)
      }

      // 5. Modern Office Towers
      // Large footprints that are tall.
      if (area >= 900 && area <= 2000 && aspectRatio < 2.0) {
        return 100 + Math.random() * 100; // 100m to 200m
      }

      // Default fallback for mid-sized mixed use
      return 30 + Math.random() * 20;
    }

    function polygonArea(polygon: number[][]) {
      var i = -1,
        n = polygon.length,
        a,
        b = polygon[n - 1],
        area = 0;

      while (++i < n) {
        a = b;
        b = polygon[i];
        area += a[1] * b[0] - a[0] * b[1];
      }

      return area / 2;
    }

    function polygonPerimeter(polygon: number[][]): number {
      let perimeter = 0;
      const n = polygon.length;
      for (let i = 0; i < n; i++) {
        const [x1, z1] = polygon[i];
        const [x2, z2] = polygon[(i + 1) % n];
        perimeter += Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
      }
      return perimeter;
    }

    function guessBuildingType(
      area: number,
      ratio: number,
      perimeter: number,
      height: number,
    ): BuildingType {
      // Shape Index: 1.0 is a perfect circle; higher values mean irregular/complex footprints
      const shapeIndex = (perimeter * perimeter) / (4 * Math.PI * area);

      // 1. Urban Village (The "Handshake" Houses)
      // Characterized by tiny footprints and mid-range height (6-9 floors)
      if (area < 130 && height < 30) {
        return BuildingType.URBAN_VILLAGE;
      }

      // 2. Industrial / Logistics
      // Massive area, simple "box" shape (low shape index), and very low height
      if (area > 2500 && shapeIndex < 1.5 && height < 15) {
        return BuildingType.INDUSTRIAL_LOFT;
      }

      // 3. Retail Malls / Podium Bases
      // Large area, often complex shapes (high shape index), and low-to-mid height
      if (area > 1500 && height < 25) {
        return BuildingType.RETAIL_MALL;
      }

      // 4. High-Rise Residential: Slab vs. Point Tower
      // Slabs are long rectangles (high ratio); Point Towers are square/compact (low ratio)
      if (height > 40 && height < 100) {
        return ratio > 2.2
          ? BuildingType.SLAB_RESIDENTIAL
          : BuildingType.POINT_TOWER;
      }

      // 5. Skyscrapers / CBD Landmarks
      // Massive height (100m+) regardless of footprint
      if (height >= 100) {
        return BuildingType.SKYSCRAPER;
      }

      // 6. Civic / Public Institutional
      // Complex footprints (U or H shapes) and mid-range height
      if (shapeIndex > 2.0 && height < 35) {
        return BuildingType.CIVIC_PUBLIC;
      }

      // 7. Standard Modern Office
      // Default for everything else that fits the "office pod" profile
      return BuildingType.MODERN_OFFICE;
    }

    function calculateAspectRatio(coords: [number, number][]): number {
      let minX = Infinity,
        maxX = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      coords.forEach(([x, z]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      });

      const width = maxX - minX;
      const length = maxZ - minZ;
      return Math.max(width, length) / (Math.min(width, length) || 1);
    }

    function calculateGabledRoof(
      p0: THREE.Vector3,
      p1: THREE.Vector3,
      p3: THREE.Vector3,
      ridgeHeight: number,
    ) {
      // 1. Define Direction Vectors
      const v01 = new THREE.Vector3().subVectors(p1, p0); // Vector from P0 to P1
      const v03 = new THREE.Vector3().subVectors(p3, p0); // Vector from P0 to P3
      const hVec = new THREE.Vector3(0, ridgeHeight, 0); // Vertical "凸起" vector

      // 2. Calculate P4 (Your Formula: P0 + P03(0.5) + P01(0.2) + H)
      const p4 = new THREE.Vector3()
        .copy(p0)
        .addScaledVector(v01, 0.2)
        .addScaledVector(v03, 0.5)
        .add(hVec);

      // 3. Calculate P5 (Your Formula: P0 + P01(0.8) + P03(0.5) + H)
      const p5 = new THREE.Vector3()
        .copy(p0)
        .addScaledVector(v01, 0.8)
        .addScaledVector(v03, 0.5)
        .add(hVec);

      return [p4, p5];
    }

    const distSq = (a: Gis.PositionTuple, b: Gis.PositionTuple) => {
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      return dx * dx + dy * dy;
    };

    function rotateRectPoints(
      points: Gis.PositionTuple[],
      startIndex: number,
    ): Gis.PositionTuple[] {
      return points
        .slice(startIndex)
        .concat(points.slice(0, startIndex)) as Gis.PositionTuple[];
    }

    function comparePointsLexicographically(
      a: Gis.PositionTuple,
      b: Gis.PositionTuple,
    ): number {
      if (a[0] !== b[0]) {
        return a[0] - b[0];
      }

      return a[1] - b[1];
    }

    function sortCoordsOnlyForRect(coords: number[]): number[] {
      const points: Gis.PositionTuple[] = [
        [coords[0], coords[1]],
        [coords[2], coords[3]],
        [coords[4], coords[5]],
        [coords[6], coords[7]],
      ];

      const centerX = points.reduce((sum, point) => sum + point[0], 0) / 4;
      const centerY = points.reduce((sum, point) => sum + point[1], 0) / 4;

      const ccwPoints = points
        .slice()
        .sort(
          (a, b) =>
            Math.atan2(a[1] - centerY, a[0] - centerX) -
            Math.atan2(b[1] - centerY, b[0] - centerX),
        ) as Gis.PositionTuple[];

      let bestRotation: Gis.PositionTuple[] | null = null;

      for (let i = 0; i < ccwPoints.length; i++) {
        const candidate = rotateRectPoints(ccwPoints, i);
        const firstEdgeLength = distSq(candidate[0], candidate[1]);
        const secondEdgeLength = distSq(candidate[1], candidate[2]);

        if (firstEdgeLength < secondEdgeLength) {
          continue;
        }

        if (
          bestRotation == null ||
          comparePointsLexicographically(candidate[0], bestRotation[0]) < 0
        ) {
          bestRotation = candidate;
        }
      }

      const orderedPoints = bestRotation ?? ccwPoints;

      return orderedPoints.flat();
    }

    function pushTriangleFacingOutward(
      triangles: number[],
      roofVertices: THREE.Vector3[],
      roofIndices: number[],
      a: number,
      b: number,
      c: number,
      roofCenter: THREE.Vector3,
    ) {
      const vertexA = roofVertices[a];
      const vertexB = roofVertices[b];
      const vertexC = roofVertices[c];
      const edgeAB = new THREE.Vector3().subVectors(vertexB, vertexA);
      const edgeAC = new THREE.Vector3().subVectors(vertexC, vertexA);
      const faceNormal = new THREE.Vector3().crossVectors(edgeAB, edgeAC);
      const faceCenter = new THREE.Vector3()
        .add(vertexA)
        .add(vertexB)
        .add(vertexC)
        .multiplyScalar(1 / 3);
      const outward = new THREE.Vector3().subVectors(faceCenter, roofCenter);

      if (faceNormal.dot(outward) < 0) {
        triangles.push(roofIndices[a], roofIndices[c], roofIndices[b]);
        return;
      }

      triangles.push(roofIndices[a], roofIndices[b], roofIndices[c]);
    }

    fetch("./__tmp/kunming_buildings.geojson")
      .then((res) => res.json())
      .then((data) => {
        const pointsArr: number[] = [];
        const btypesArr: number[] = [];
        const indexArr: number[] = [];
        const trianglesArr: number[] = [];
        const colorsArr: number[] = [];
        const uvArr: number[] = [];

        const color = new THREE.Color(0xed9a01);
        const geometry = new THREE.BufferGeometry();

        let globalIndex = 0;
        let localShape2D: number[] = [];
        let localIndexStart = -1;
        let shapePointCount = -1;

        const map = textureLoader.load(
          "Gemini_Generated_Image_mqbdhfmqbdhfmqbd.png",
        );

        map.wrapS = THREE.RepeatWrapping;
        map.wrapT = THREE.RepeatWrapping;

        const roofMap = textureLoader.load("brickroof.jpg");

        roofMap.wrapS = THREE.RepeatWrapping;
        roofMap.wrapT = THREE.RepeatWrapping;

        console.log(
          "use dem in building shader: ",
          this._dem != null,
          this._dem.bbox?.toArray().join(),
          this._dem?.displacementBias,
          this._dem?.displacementScale,
        );

        const material = new THREE.ShaderMaterial({
          transparent: true,
          opacity: 1,
          uniforms: {
            map: {
              value: map,
            },
            roofMap: {
              value: roofMap,
            },
            atlasScale: {
              value: this.buildingAtlasScale,
            },
            demTexture: {
              value: this._dem ? this._dem.texture : null,
            },
            demBBox: {
              value: this._dem ? this._dem.bbox : new THREE.Vector4(0, 0, 0, 0),
            },
            displacementBias: {
              value: this._dem ? this._dem.displacementBias : 0,
            },
            displacementScale: {
              value: this._dem ? this._dem.displacementScale : 1,
            },
            useDem: {
              value: this._dem != null,
            },
          },
          vertexShader: /**glsl */ `
              uniform bool useDem;
              uniform sampler2D demTexture;
              uniform vec4 demBBox;
              uniform float displacementBias;
              uniform float displacementScale;

              attribute vec2 btype;
              attribute vec3 hue;

              varying vec2 vUv;
              varying vec2 vBtype;
              varying vec3 vHue;

              void main() {
                vUv = uv;
                vBtype = btype;
                vHue = hue;

                vec4 world_pos = modelMatrix * vec4(position, 1.0);

                if (useDem) {
                  vec2 demUv = (world_pos.xz - demBBox.xy) / (demBBox.zw - demBBox.xy);

                  // if (demUv.x < 0.0 || demUv.x > 1.0 || demUv.y < 0.0 || demUv.y > 1.0) {
                  //   gl_Position = projectionMatrix * viewMatrix * world_pos;
                  //   return;
                  // }

                  float demHeight = texture2D(demTexture, demUv).r;
                  world_pos.y += demHeight * displacementScale + displacementBias;
                }
                
                gl_Position = projectionMatrix * viewMatrix * world_pos;
              }
            `,
          fragmentShader: /**glsl */ `
              uniform sampler2D map;
              uniform sampler2D roofMap;
              uniform vec2 atlasScale;

              varying vec2 vUv;
              varying vec2 vBtype;
              varying vec3 vHue;

              void main() {
                if (vBtype.x == 2.0) {
                  // Roof fragment
                  vec2 uv = fract(vUv); // Tile the roof texture more densely
                  vec4 roofColor = texture2D(roofMap, uv);
                  gl_FragColor = vec4(roofColor.rgb * 0.7, 1.0);
                } else if (vBtype.x == 3.0) {
                  gl_FragColor = vec4(0.2, 0.2, 0.2, 1.0); // Simple dark color for urban village roofs
                } else {
                  vec4 hueColor = vec4(vHue, 1.0);
                  vec2 uv = vBtype + fract(vUv) * atlasScale;
                  vec4 texColor = texture2D(map, uv);
                  // Best way: Soft Light or Overlay
                  // This keeps the texture's character but shifts the color
                  vec3 finalColor = mix(texColor.rgb, texColor.rgb * hueColor.rgb, 0.8);

                  gl_FragColor = vec4(finalColor, 1.0);
                }
              }
            `,
          wireframe: false,
          depthTest: true,
          side: THREE.FrontSide,
        });

        const oneMesh = new THREE.Mesh(geometry, material);

        // @ts-expect-error
        this.defaultMaterial = material;

        // @ts-expect-error
        this.maskMaterial = new THREE.ShaderMaterial({
          transparent: true,
          opacity: 1,
          vertexShader: /**glsl */ `
              void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
          fragmentShader: /**glsl */ `
              void main() {
                gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
              }
            `,
          depthTest: false,
          side: THREE.FrontSide,
        });

        // @ts-expect-error
        this.idMaskMaterial = new THREE.ShaderMaterial({
          vertexShader: /**glsl */ `
              attribute float buildingId;
              varying float vBuildingId;
              void main() {
                vBuildingId = buildingId;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
          fragmentShader: /**glsl */ `
              varying float vBuildingId;
              void main() {
                float id = floor(vBuildingId + 0.5);
                float r = mod(id, 256.0) / 255.0;
                float g = mod(floor(id / 256.0), 256.0) / 255.0;
                float b = mod(floor(id / 65536.0), 256.0) / 255.0;
                gl_FragColor = vec4(r, g, b, 1.0);
              }
            `,
          depthTest: false,
          side: THREE.FrontSide,
        });

        this.add(oneMesh);

        // @ts-expect-error
        this.mesh1 = oneMesh;

        console.log(
          "Processing building GeoJSON with",
          data.features.length,
          "features",
        );

        __usePanel_write__(3, "buildings: " + data.features.length);

        console.time("Process building GeoJSON");

        let uvScale = 0.05; // Adjust this to control the tiling of the texture on the building

        const buildingIdArr: number[] = [];
        let buildingIndex = 0;

        for (const feature of data.features) {
          const geom = feature.geometry;
          if (geom.type !== "Polygon") continue;

          const coords = geom.coordinates[0];
          const isRect = coords.length === 5; // GeoJSON polygons repeat the first vertex at the end, so rectangles will have 5 coordinates with the first and last being the same

          const footprintCoords = coords.map(([lon, lat]) => {
            const pos = latLngToPosition(lat, lon);
            return [pos.x, pos.y];
          });

          const positions = footprintCoords;

          const areaInMeters = polygonArea(footprintCoords);
          const aspectRatio = calculateAspectRatio(footprintCoords);

          const estimatedHeight = estimateHeightFromFootprintArea(
            areaInMeters,
            aspectRatio,
          );

          const perimeter = polygonPerimeter(footprintCoords);

          const buildingType = guessBuildingType(
            areaInMeters,
            aspectRatio,
            perimeter,
            estimatedHeight,
          );

          const isSlab = buildingType === BuildingType.SLAB_RESIDENTIAL;

          const bOffset = this.buildingAtlasTypeOffset[buildingType];

          const buildingVertexStart = globalIndex;
          localShape2D = [];
          localIndexStart = globalIndex;
          shapePointCount = coords.length - 1; // Exclude the repeated last point

          let x = 0;
          let y = 0;
          let s = 0; // cumulative distance along the footprint perimeter, used for UV mapping
          let t = 0; // cumulative height, used for UV mapping

          uvScale = 0.05;

          // footprint vertices
          for (let i = 0; i < shapePointCount; i++) {
            x = positions[i][0];
            y = positions[i][1];

            s =
              i === 0
                ? 0
                : s +
                  Math.sqrt(
                    (x - localShape2D[(i - 1) * 2]) ** 2 +
                      (y - localShape2D[(i - 1) * 2 + 1]) ** 2,
                  );

            pointsArr.push(x, 0, y);
            btypesArr.push(bOffset.x, bOffset.y);

            uvArr.push(s * uvScale, t * uvScale); // Simple UV mapping based on position
            colorsArr.push(color.r, color.g, color.b);
            indexArr.push(globalIndex);

            localShape2D.push(x, y);

            globalIndex++;
          }

          t = estimatedHeight; // top of the building in UV space

          // roof vertices for sidewalls
          for (let i = 0; i < shapePointCount; i++) {
            x = localShape2D[i * 2];
            y = localShape2D[i * 2 + 1];

            s =
              i === 0
                ? 0
                : s +
                  Math.sqrt(
                    (x - localShape2D[(i - 1) * 2]) ** 2 +
                      (y - localShape2D[(i - 1) * 2 + 1]) ** 2,
                  );

            pointsArr.push(x, estimatedHeight, y);
            btypesArr.push(bOffset.x, bOffset.y);

            uvArr.push(s * uvScale, t * uvScale); // Simple UV mapping based on position
            colorsArr.push(color.r, color.g, color.b);
            indexArr.push(globalIndex);

            globalIndex++;
          }

          const earcutIndices = earcut(localShape2D);

          // floor triangles
          for (const idx of earcutIndices) {
            trianglesArr.push(indexArr[localIndexStart + idx]);
          }

          // sidewalls triangles
          for (let i = 0; i < shapePointCount; i++) {
            const next = (i + 1) % shapePointCount;
            const idx0 = indexArr[localIndexStart + i];
            const idx1 = indexArr[localIndexStart + next];
            const idx2 = indexArr[localIndexStart + i + shapePointCount];
            const idx3 = indexArr[localIndexStart + next + shapePointCount];

            trianglesArr.push(idx0, idx1, idx2);
            trianglesArr.push(idx1, idx3, idx2);
          }

          const withXXXRoofs = isRect && isSlab;
          //#region roofs
          const sortedLocalShape2D = withXXXRoofs
            ? sortCoordsOnlyForRect(localShape2D)
            : localShape2D;

          localIndexStart = globalIndex;
          uvScale = 2;

          s = 0;
          t = 0;
          // for roof uv mapping, we want to tile the texture based on the perimeter of the roof, so we continue incrementing s as if we were walking along the roof perimeter. This way, the texture will wrap around the roof nicely instead of being stretched/squashed.
          for (let i = 0; i < shapePointCount; i++) {
            x = sortedLocalShape2D[i * 2];
            y = sortedLocalShape2D[i * 2 + 1];

            pointsArr.push(x, estimatedHeight, y);

            if (withXXXRoofs) {
              btypesArr.push(2, 2);
            } else {
              btypesArr.push(3, 3);
            }

            s = withXXXRoofs ? (i % 2 === 0 ? 0 : 1) : 0;

            uvArr.push(s * uvScale, t * uvScale); // Simple UV mapping based on position
            colorsArr.push(color.r, color.g, color.b);
            indexArr.push(globalIndex);

            globalIndex++;
          }

          if (withXXXRoofs) {
            s = 0;
            t = 1;

            console.log(
              "Applying gabled roof optimization for quadrilateral footprint",
            );

            // earcutIndices
            const p0index = localIndexStart;
            const p1index = localIndexStart + 1;
            const p2index = localIndexStart + 2;
            const p3index = localIndexStart + 3;

            // Special case for quadrilaterals: we can create a simple gabled roof with just 2 triangles instead of a complex triangulation
            const p0 = new THREE.Vector3(
              sortedLocalShape2D[0],
              estimatedHeight,
              sortedLocalShape2D[1],
            );

            const p1 = new THREE.Vector3(
              sortedLocalShape2D[2],
              estimatedHeight,
              sortedLocalShape2D[3],
            );

            const p2 = new THREE.Vector3(
              sortedLocalShape2D[4],
              estimatedHeight,
              sortedLocalShape2D[5],
            );

            const p3 = new THREE.Vector3(
              sortedLocalShape2D[6],
              estimatedHeight,
              sortedLocalShape2D[7],
            );

            const [p4, p5] = calculateGabledRoof(
              p0,
              p1,
              p3,
              6, // ridge height - adjust this to make the roof more or less steep
            );

            pointsArr.push(p4.x, p4.y, p4.z);
            btypesArr.push(2, 2);
            uvArr.push(s * uvScale, t * uvScale); // UVs for the roof peak
            colorsArr.push(color.r, color.g, color.b);
            const p4index = globalIndex;
            indexArr.push(globalIndex);
            globalIndex++;

            s = 1;
            t = 1;

            pointsArr.push(p5.x, p5.y, p5.z);
            btypesArr.push(2, 2);
            uvArr.push(s * uvScale, t * uvScale); // UVs for the roof peak
            colorsArr.push(color.r, color.g, color.b);
            const p5index = globalIndex;
            indexArr.push(globalIndex);
            globalIndex++;

            const roofVertices = [p0, p1, p2, p3, p4, p5];
            const roofIndices = [
              p0index,
              p1index,
              p2index,
              p3index,
              p4index,
              p5index,
            ];
            const roofCenter = new THREE.Vector3()
              .add(p0)
              .add(p1)
              .add(p2)
              .add(p3)
              .add(p4)
              .add(p5)
              .multiplyScalar(1 / roofVertices.length);

            pushTriangleFacingOutward(
              trianglesArr,
              roofVertices,
              roofIndices,
              0,
              1,
              5,
              roofCenter,
            );
            pushTriangleFacingOutward(
              trianglesArr,
              roofVertices,
              roofIndices,
              0,
              5,
              4,
              roofCenter,
            );
            pushTriangleFacingOutward(
              trianglesArr,
              roofVertices,
              roofIndices,
              1,
              2,
              5,
              roofCenter,
            );
            pushTriangleFacingOutward(
              trianglesArr,
              roofVertices,
              roofIndices,
              3,
              4,
              5,
              roofCenter,
            );
            pushTriangleFacingOutward(
              trianglesArr,
              roofVertices,
              roofIndices,
              3,
              5,
              2,
              roofCenter,
            );
            pushTriangleFacingOutward(
              trianglesArr,
              roofVertices,
              roofIndices,
              0,
              4,
              3,
              roofCenter,
            );
          } else {
            for (let i = earcutIndices.length - 1; i >= 0; i--) {
              const idx = earcutIndices[i];
              trianglesArr.push(indexArr[localIndexStart + idx]);
            }
          }

          //#endregion

          // Record per-building info for hue sampling
          let centX = 0;
          let centZ = 0;
          for (let i = 0; i < shapePointCount; i++) {
            centX += localShape2D[i * 2];
            centZ += localShape2D[i * 2 + 1];
          }
          centX /= shapePointCount;
          centZ /= shapePointCount;

          const encodedId = buildingIndex + 1; // 0 = background
          const buildingVertexCount = globalIndex - buildingVertexStart;
          for (let i = 0; i < buildingVertexCount; i++) {
            buildingIdArr.push(encodedId);
          }
          buildingIndex++;

          this.buildingInfos.push({
            wx: centX,
            wz: centZ,
            startVertex: buildingVertexStart,
            vertexCount: buildingVertexCount,
          });
        }

        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(pointsArr, 3),
        );

        console.log("building triangles", trianglesArr.length / 3);

        geometry.setIndex(trianglesArr);
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(colorsArr, 3),
        );
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
        geometry.setAttribute(
          "btype",
          new THREE.Float32BufferAttribute(btypesArr, 2),
        );
        geometry.setAttribute(
          "buildingId",
          new THREE.Float32BufferAttribute(new Float32Array(buildingIdArr), 1),
        );

        const hueAttr = new THREE.Float32BufferAttribute(
          new Float32Array(pointsArr.length).fill(1),
          3,
        );
        hueAttr.usage = THREE.DynamicDrawUsage;
        geometry.setAttribute("hue", hueAttr);

        console.timeEnd("Process building GeoJSON");
      })
      .catch((err) => {
        console.warn("Could not load building GeoJSON:", err);
      });
  }

  setDemTexture(
    demTexture: THREE.Texture,
    demBbox: THREE.Vector4,
    bias: number,
    scale: number,
  ) {
    this._dem = {
      texture: demTexture,
      bbox: demBbox,
      displacementBias: bias,
      displacementScale: scale,
    };

    if (!this.defaultMaterial) {
      console.warn(
        "Default material not initialized yet; cannot set DEM texture",
      );
      return;
    }

    this.defaultMaterial.uniforms.demTexture.value = demTexture;
    this.defaultMaterial.uniforms.demBBox.value = demBbox;
    this.defaultMaterial.uniforms.displacementBias.value = bias;
    this.defaultMaterial.uniforms.displacementScale.value = scale;
    this.defaultMaterial.uniforms.useDem.value = true;

    this.defaultMaterial.needsUpdate = true;
  }

  /**
   * Render building footprints into a render target where each pixel's RGB
   * encodes the building's integer ID (ID+1, so 0 = background).
   * Uses the same ortho bounds as the hue render pass.
   */
  renderIdMap(
    renderer: THREE.WebGLRenderer,
    min: THREE.Vector2,
    max: THREE.Vector2,
  ): THREE.WebGLRenderTarget {
    const size = new THREE.Vector2();
    renderer.getSize(size);

    const cx = (min.x + max.x) / 2;
    const cz = (min.y + max.y) / 2;
    const halfX = (max.x - min.x) / 2;
    const halfZ = (max.y - min.y) / 2;

    const orthoCamera = new THREE.OrthographicCamera(
      -halfX,
      halfX,
      halfZ,
      -halfZ,
      0.1,
      1e6,
    );
    orthoCamera.position.set(cx, 1e4, cz);
    orthoCamera.lookAt(cx, 0, cz);

    const rt = new THREE.WebGLRenderTarget(size.x, size.y);

    const prevMaterial = this.mesh1.material;
    this.mesh1.material = this.idMaskMaterial;

    const prevClearColor = new THREE.Color();
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(prevClearColor);
    renderer.setClearColor(0x000000, 1);

    // Move mesh1 to a temporary scene so nothing else is rendered
    this.remove(this.mesh1);
    const tempScene = new THREE.Scene();
    tempScene.add(this.mesh1);

    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(tempScene, orthoCamera);
    renderer.setRenderTarget(null);

    renderer.setClearColor(prevClearColor, prevClearAlpha);

    tempScene.remove(this.mesh1);
    this.add(this.mesh1);
    this.mesh1.material = prevMaterial;

    return rt;
  }

  /**
   * O(pixels) average color per building using a pre-rendered ID map.
   * No nested loop over buildings — each pixel is processed exactly once.
   */
  /** Convert RGB (0-1) to HSV (H: 0-360, S: 0-1, V: 0-1). */
  private rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s, v];
  }

  /** Convert HSV (H: 0-360, S: 0-1, V: 0-1) back to RGB (0-1). */
  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i) {
      case 0:
        return [v, t, p];
      case 1:
        return [q, v, p];
      case 2:
        return [p, v, t];
      case 3:
        return [p, q, v];
      case 4:
        return [t, p, v];
      default:
        return [v, p, q];
    }
  }

  applyHueFromSnapshot(
    renderer: THREE.WebGLRenderer,
    hueTarget: THREE.WebGLRenderTarget,
    idTarget: THREE.WebGLRenderTarget,
  ) {
    if (!this.mesh1) return;

    const w = hueTarget.width;
    const h = hueTarget.height;

    const huePixels = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(hueTarget, 0, 0, w, h, huePixels);

    const idPixels = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(idTarget, 0, 0, w, h, idPixels);

    const hueAttr = this.mesh1.geometry.getAttribute(
      "hue",
    ) as THREE.BufferAttribute;
    if (!hueAttr) return;

    const N = this.buildingInfos.length;
    // Accumulate in HSV space to avoid hue-cancellation artifacts.
    // Hue is circular so we accumulate sin/cos components separately.
    const sumHueSin = new Float64Array(N); // sin(hue)
    const sumHueCos = new Float64Array(N); // cos(hue)
    const sumSat = new Float64Array(N);
    const sumVal = new Float64Array(N);
    const count = new Int32Array(N);

    // Single O(pixels) pass — no nested building loop
    const pixelCount = w * h;
    for (let p = 0; p < pixelCount; p++) {
      const i4 = p * 4;
      const encodedId =
        idPixels[i4] + idPixels[i4 + 1] * 256 + idPixels[i4 + 2] * 65536;
      if (encodedId === 0) continue; // background pixel
      const bIdx = encodedId - 1;
      if (bIdx >= N) continue; // safety guard

      const r = huePixels[i4] / 255;
      const g = huePixels[i4 + 1] / 255;
      const b = huePixels[i4 + 2] / 255;

      const [hDeg, s, v] = this.rgbToHsv(r, g, b);
      const hRad = (hDeg * Math.PI) / 180;
      sumHueSin[bIdx] += Math.sin(hRad);
      sumHueCos[bIdx] += Math.cos(hRad);
      sumSat[bIdx] += s;
      sumVal[bIdx] += v;
      count[bIdx]++;
    }

    // Apply averaged color to each building's vertices
    for (let bIdx = 0; bIdx < N; bIdx++) {
      const info = this.buildingInfos[bIdx];
      const c = count[bIdx];
      let r = 1.0,
        g = 1.0,
        b = 1.0;
      if (c > 0) {
        // Circular mean for hue, arithmetic mean for S and V
        const avgHRad = Math.atan2(sumHueSin[bIdx] / c, sumHueCos[bIdx] / c);
        const avgHDeg = ((avgHRad * 180) / Math.PI + 360) % 360;
        const avgS = sumSat[bIdx] / c;
        const avgV = sumVal[bIdx] / c;
        [r, g, b] = this.hsvToRgb(avgHDeg, avgS, avgV);
      }
      for (
        let v = info.startVertex;
        v < info.startVertex + info.vertexCount;
        v++
      ) {
        hueAttr.setXYZ(v, r, g, b);
      }
    }

    hueAttr.needsUpdate = true;
  }
}

const noop = () => {};

class BuildingsStub extends THREE.Group {
  constructor() {
    super();
  }

  defaultMaterial: THREE.ShaderMaterial = {
    dispose: noop,
  } as any;
  maskMaterial: THREE.ShaderMaterial = {
    dispose: noop,
  } as any;
  idMaskMaterial: THREE.ShaderMaterial = {
    dispose: noop,
  } as any;
  mesh1: THREE.Mesh<
    THREE.BufferGeometry<THREE.NormalBufferAttributes>,
    THREE.ShaderMaterial,
    THREE.Object3DEventMap
  > = {
    material: null,
  } as any;
  buildingAtlasTypeOffset: Record<BuildingType, THREE.Vector2> = {} as any;
  buildingAtlasScale: THREE.Vector2 = new THREE.Vector2(1, 1);

  renderIdMap(
    renderer: THREE.WebGLRenderer,
    min: THREE.Vector2,
    max: THREE.Vector2,
  ): THREE.WebGLRenderTarget {
    return {
      dispose: noop,
    } as any;
  }

  applyHueFromSnapshot(
    renderer: THREE.WebGLRenderer,
    hueTarget: THREE.WebGLRenderTarget,
    idTarget: THREE.WebGLRenderTarget,
  ): void {}
}

class Vegetation extends THREE.Group {
  private mesh: THREE.Mesh | null = null;

  constructor() {
    super();
    this.renderOrder = 5e5;
  }

  buildFromSnapshot(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget,
    min: THREE.Vector2,
    max: THREE.Vector2,
  ) {
    if (this.mesh) {
      this.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }

    const w = target.width;
    const h = target.height;
    const pixels = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(target, 0, 0, w, h, pixels);

    // Subsample white pixels (vegetation) - take every 4th pixel to reduce point count
    const points: number[] = [];
    const subsample = 2;
    for (let row = 0; row < h; row += subsample) {
      for (let col = 0; col < w; col += subsample) {
        const idx = (row * w + col) * 4;
        const r = pixels[idx];
        // White = 255 (vegetation), black = 0 (non-vegetation)
        if (r > 200) {
          const u = col / (w - 1);
          const v = 1 - row / (h - 1);
          const wx = min.x + u * (max.x - min.x);
          const wz = min.y + v * (max.y - min.y);
          points.push(wx, wz);
        }
      }
    }

    if (points.length < 3) {
      console.log("Vegetation: not enough points to triangulate");
      return;
    }

    // Triangulate with d3-delaunay
    const delaunay = d3.Delaunay.from(
      points,
      (p: any, i: number) => points[i * 2],
      (p: any, i: number) => points[i * 2 + 1],
    );

    // Alpha-shape filtering: discard long edges
    const maxEdge = (max.x - min.x) / 20; // threshold
    const maxEdgeSq = maxEdge * maxEdge;
    const survivingTriangles: number[] = [];

    for (let i = 0; i < delaunay.triangles.length; i += 3) {
      const t0 = delaunay.triangles[i];
      const t1 = delaunay.triangles[i + 1];
      const t2 = delaunay.triangles[i + 2];

      const x0 = points[t0 * 2];
      const z0 = points[t0 * 2 + 1];
      const x1 = points[t1 * 2];
      const z1 = points[t1 * 2 + 1];
      const x2 = points[t2 * 2];
      const z2 = points[t2 * 2 + 1];

      const dx01 = x1 - x0;
      const dz01 = z1 - z0;
      const dx12 = x2 - x1;
      const dz12 = z2 - z1;
      const dx20 = x0 - x2;
      const dz20 = z0 - z2;

      const d01 = dx01 * dx01 + dz01 * dz01;
      const d12 = dx12 * dx12 + dz12 * dz12;
      const d20 = dx20 * dx20 + dz20 * dz20;

      if (d01 <= maxEdgeSq && d12 <= maxEdgeSq && d20 <= maxEdgeSq) {
        survivingTriangles.push(t0, t1, t2);
      }
    }

    if (survivingTriangles.length === 0) {
      console.log("Vegetation: no triangles survived alpha-shape filter");
      return;
    }

    // Build mesh
    const positions: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      positions.push(points[i], 2, points[i + 1]); // y=2 (above ground)
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(
      new THREE.BufferAttribute(new Uint32Array(survivingTriangles), 1),
    );

    const material = new THREE.MeshBasicMaterial({
      color: 0x2d7d32,
      opacity: 0.55,
      transparent: true,
      depthTest: false,
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.add(this.mesh);

    console.log(
      "Vegetation: created mesh with",
      survivingTriangles.length / 3,
      "triangles",
    );
  }
}

class Roads extends THREE.Group {
  constructor(renderer: THREE.WebGLRenderer) {
    super();

    // Group for GeoJSON highway lines, rebuilt on zoom/pan change
    const highwayOverlays = new THREE.Group();
    this.add(highwayOverlays);

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
          const { x: x0, y: z0 } = latLngToPosition(lat0, lon0);
          const { x: x1, y: z1 } = latLngToPosition(lat1, lon1);
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
          depthTest: true,
          worldUnits: false,
        });
        const ls = new LineSegments2(geo, mat);
        ls.computeLineDistances();
        highwayOverlays.add(ls);
      }
    }
  }
}

export class Marker extends THREE.Group {
  constructor() {
    super();

    const markerBase = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff4d4f,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      }),
    );

    const markerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.3, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );

    markerBase.renderOrder = 1000;
    markerRing.renderOrder = 999;

    markerBase.rotateX(-Math.PI / 2);
    markerRing.rotateX(-Math.PI / 2);
    this.scale.multiplyScalar(300);

    this.add(markerBase, markerRing);
  }
}

__defineControl__("play", "btn", "", { label: "play" });
