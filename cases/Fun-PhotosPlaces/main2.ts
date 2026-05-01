import { __useCSS2Renderer__ } from "cases/css2r.js";
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { Marker } from "./Marker.js";

export function main(
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  controls: MapControls,
) {
  __useCSS2Renderer__();

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
    lines: 3,
    placement: "top",
  });

  __add_nextframe_fn__((w, c, r) => {
    __usePanel_write__(0, "cam height: " + c.position.y.toFixed(2));
    __usePanel_write__(1, "cam zoom: " + resolveZoomLevel(c.position.y));
  }, 0.3);

  const photos = new Photos(renderer);
  world.add(photos);

  photos.addEventListener("ready", () => {
    setupCamera(`${photos._lat}, ${photos._lon}`);
    gmap.zoom = photos._zoom;

    updateTiles();
  });

  const gmap = new GoogleMap();
  world.add(gmap);

  __add_nextframe_fn__((w, c, r, delta) => {
    photos.tick(delta);
    gmap.tick();
  }, 0.03);

  __updateTHREEJs__invoke__.play = () => {
    console.log("Playing animation");
    photos.play();
  };

  function updateTiles() {
    const visibleWorld = getVisibleWorldFromScreen(gmap.zoom, camera, renderer);
    const tiles = getAllTilesInView(visibleWorld, gmap.zoom);

    const { toAdd, toRemove } = diffTiles(oldTiles, tiles);
    oldTiles = tiles;

    console.log("Tiles to add:", toAdd.length);
    console.log("Tiles to remove:", toRemove.length);

    gmap.updateTiles(tiles);
  }

  /**
   * @todo here to sync the map center with the camera.
   */
  controls.addEventListener("end", () => {
    gmap.zoom = resolveZoomLevel(camera.position.y);
    updateTiles();
  });

  let oldTiles: Gis.Tile[] = [];
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

  constructor(
    tile: Gis.Tile,
    width = 256,
    height = 256,
    onReady?: (tileId: string) => void,
  ) {
    const material = new THREE.ShaderMaterial({
      wireframe: false,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0,
      depthTest: false,
      uniforms: {
        map: { value: null },
        useMap: { value: false },
      },
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

        float exgr(vec4 color) {
          // Simple heuristic: if the green channel is significantly higher than red and blue, consider it vegetation
          float exr = color.r * 1.3 - color.g;
          float exg = color.g * 2.0 - color.r - color.b;
          return exg - exr; // Adjust threshold as needed
        }

        void main() {
          if (useMap) {
            vec4 color = texture2D(map, vUv);

            vec3 finalColor = color.rgb;

            // finalColor = (finalColor - 0.2) * 0.8 + 0.2; // Simple contrast adjustment

            // float luminance = dot(finalColor, vec3(0.2126, 0.7152, 0.0722));
            // vec3 grayscale = vec3(luminance);

            // finalColor = mix(grayscale, color.rgb, 2.0); // Adjust the 0.7 factor to control how much to desaturate non-vegetation areas
            
            // float vegetation = exgr(color);
            // vegetation = smoothstep(0.0, 0.3, vegetation); // Adjust thresholds for better results
            // vec3 finalColor = mix(color.rgb, vec3(0.0, 0.8, 0.0), vegetation);

            gl_FragColor = vec4(finalColor, 1.0);
          } else {
            gl_FragColor = vec4(0.0, 0.5, 0.0, 0.6);
          }
        }
      `,
    });

    const geometry = new THREE.BufferGeometry();

    const nw = 0;
    const ne = 1;
    const sw = 2;
    const se = 3;

    /**
     * nw --- ne
     * |      |
     * sw --- se
     */
    const uv = {
      [nw]: { u: 0, v: 0 }, // top left
      [ne]: { u: 1, v: 0 }, // top right
      [sw]: { u: 0, v: 1 }, // bottom left
      [se]: { u: 1, v: 1 }, // bottom right
    };

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -width / 2,
          0,
          height / 2, // NW 0
          width / 2,
          0,
          height / 2, // NE 1
          -width / 2,
          0,
          -height / 2, // SW 2
          width / 2,
          0,
          -height / 2, // SE 3
        ],
        3,
      ),
    );

    geometry.setIndex([nw, ne, sw, ne, se, sw]);

    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        [
          uv[nw].u,
          uv[nw].v,
          uv[ne].u,
          uv[ne].v,
          uv[sw].u,
          uv[sw].v,
          uv[se].u,
          uv[se].v,
        ],
        2,
      ),
    );

    super(geometry, material);

    textureLoader.load(
      `https://mt.google.com/vt/lyrs=s&x=${tile.x}&y=${tile.y}&z=${tile.z}&scale=2`,
      (texture) => {
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

    // const label = document.createElement("div");
    // label.innerText = `${tile.id}\nlat: ${tile.bbox.north.toFixed(4)}, ${tile.bbox.west.toFixed(4)}\nlat: ${tile.bbox.south.toFixed(4)}, ${tile.bbox.east.toFixed(4)}`;

    // label.style.fontSize = "12px";
    // label.style.color = "red";
    // label.style.textAlign = "center";
    // label.style.whiteSpace = "pre";

    // const labelObj = new CSS2DObject(label);
    // this.add(labelObj);

    this.name = tile.id;
  }
}

function GetFootprints() {
  return fetch("./data/footprints0426-v2.json").then((r) => r.json());
}

function GetFootprintsGeoJSON() {
  return fetch("./data/footprints0426.geojson").then((r) => r.json());
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

    // Group that holds CSS2D markers + path line, rebuilt on zoom change
    const photoOverlays = new THREE.Group();
    photoOverlays.renderOrder = 1;
    this.add(photoOverlays);

    // Group for GeoJSON highway lines, rebuilt on zoom/pan change
    const highwayOverlays = new THREE.Group();
    highwayOverlays.renderOrder = 5;
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

    let footprints: FPs.Footprint[] = [];
    const cssMarkers: CSS2DObject[] = [];
    const photoMarkers3D: Marker[] = [];
    let orderedFootprints: any[] = [];
    let revealed: boolean[] = [];
    let timelineEndMs = 0;
    let currentAnimTimeMs = 0;
    let timelineStartMs = 0;
    let playing = false;

    const createPhotoMarkerEl = (fp: FPs.Footprint) => {
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

    const buildPhotoDots = (disabled = false) => {
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

      const pathCandidates = valid.map((fp, idx) => {
        const pos = latLngToPosition(fp.lat!, fp.lon!);
        const marker = new CSS2DObject(createPhotoMarkerEl(fp));
        marker.position.set(pos.x, 0.08, pos.y);
        // photoOverlays.add(marker);
        // cssMarkers.push(marker);

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

      // Place a Marker at each ordered footprint — hidden initially, revealed during animation
      for (const item of withCurveT) {
        const m = new Marker();
        m.position.set(item.point.x, 0, item.point.z);
        m.visible = false;

        photoOverlays.add(m);
        photoMarkers3D.push(m);
      }
    };

    const buildHighways = () => {
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
          const { x: x0, y: y0 } = latLngToPosition(lat0, lon0);
          const { x: x1, y: y1 } = latLngToPosition(lat1, lon1);
          positions.push(x0, 0.005, y0, x1, 0.005, y1);
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
          const css = cssMarkers[i];
          if (css && !css.parent) photoOverlays.add(css);
          const pin = photoMarkers3D[i];
          if (pin) pin.visible = true;
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
      for (const m of cssMarkers) m.removeFromParent();
      for (const m of photoMarkers3D) m.visible = false;
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

__defineControl__("play", "btn", "", { label: "play" });
