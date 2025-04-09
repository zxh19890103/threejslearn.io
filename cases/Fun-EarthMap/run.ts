/**
 * Generated Automatically At Sun Mar 09 2025 22:24:02 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import * as Calc from "./calc.js";

let enableGrid = false;
let enableAxes = true;

const earthConfig: EarthMapConfig = {
  R: 6.371 * 1e6, // m
};

__config__.camNear = 1e3; // m
__config__.camPos = [0, 0, earthConfig.R * 1.64];

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

  __usePanel__({
    width: 300,
    placement: "top",
    lines: 1,
  });

  const earth = new EarthMap();
  // earth.rotateX(Math.PI);
  world.add(earth);

  __3__.dirLight(0xffffff, 1, [0, 1, 0.4]);

  // __add_nextframe_fn__(() => {
  //   earth.rotation.y += 0.001;
  // });

  __add_nextframe_fn__(() => {
    earth.computeDistance2Cam(camera);

    // console.log("zoom = ", earth.zoom);
    // console.log(Calc.tileSizeInLatLng(earth.zoom));

    earth.eachTile((tile) => {
      tile.standalone =
        earth.distance2surface < 1e6 && isTileInView(camera, tile);
    });
  }, 3);

  __add_nextframe_fn__(() => {
    earth.computeZoom(camera);
  }, 0.07);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

class EarthMap extends THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshBasicMaterial
> {
  tiles: Earth3DTile[] = [];
  Points: THREE.Points;

  LonLines: THREE.Group;
  LatLines: THREE.Group;

  distance2surface: number = -1;
  zoom: number = -1;

  constructor() {
    super(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        vertexColors: false,
        color: 0xffffff,
        wireframe: false,
        depthTest: true,
        depthWrite: true,
        side: THREE.FrontSide,
      })
    );

    __3__.crs(this, earthConfig.R * 1.4);

    const color_ = new THREE.Color();

    {
      this.LonLines = new THREE.Group();
      this.add(this.LonLines);

      for (let lon = -180; lon <= 180; lon += 10) {
        if (lon === 0) {
          color_.setHex(0xf00190);
        } else {
          color_.setHex(0x000000);
        }

        const lonLine = new THREE.LineSegments(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({
            color: color_.getHex(),
            transparent: true,
            opacity: 0.7,
            depthTest: true,
            depthWrite: true,
          })
        );

        const pts: number[] = [];
        for (let lat = -90; lat <= 90; lat += 1) {
          pts.push(...getCoordinatesByLatLng(earthConfig.R + 1e3, lat, lon));
        }
        lonLine.geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(pts), 3)
        );

        this.LonLines.add(lonLine);
      }
    }

    {
      this.LatLines = new THREE.Group();
      this.add(this.LatLines);

      for (let lat = -90; lat <= 90; lat += 3) {
        if (lat === 0) {
          color_.setHex(0xf00190);
        } else {
          color_.setHex(0x000000);
        }

        const latLine = new THREE.LineSegments(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({
            color: color_.getHex(),
            transparent: true,
            opacity: 0.7,
            depthTest: true,
            depthWrite: true,
          })
        );

        const pts: number[] = [];
        for (let lon = -180; lon <= 180; lon += 1) {
          pts.push(...getCoordinatesByLatLng(earthConfig.R + 2e4, lat, lon));
        }

        latLine.geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(pts), 3)
        );

        this.LatLines.add(latLine);

        // this.LatLines.renderOrder = 9999;
      }
    }

    this.add(this.tileMeshes);

    textloader.load("map.png", (texture) => {
      this.material.vertexColors = false;
      this.material.map = texture;
      this.material.needsUpdate = true;
    });
  }

  eachTile(arg0: (tile: Earth3DTile) => void) {
    this._currentTilesRendered.forEach(arg0);
  }

  private getSizeN(s: number) {
    const sn = Math.ceil(90 / s);
    const possibleN = [
      1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 25, 30, 36, 40, 45,
    ];

    let diff = Number.MAX_SAFE_INTEGER;
    let index = -1;

    for (let i = 0, l = possibleN.length; i < l; i++) {
      const diff1 = Math.abs(possibleN[i] - sn);
      if (diff > diff1) {
        diff = diff1;
        index = i;
      }
    }

    return possibleN[index];
  }

  computeZoom(camera: THREE.PerspectiveCamera) {
    const dist = camera.position.length();
    const dist2surface = dist - earthConfig.R;
    const zoom = Calc.calculateZoomLevel(dist2surface);
    this.zoom = zoom;
  }

  computeDistance2Cam(camera: THREE.PerspectiveCamera) {
    const d = earthConfig.R * 2;
    const dist = camera.position.length();
    const rad = d / dist;

    const dist2surface = dist - earthConfig.R;
    this.distance2surface = dist2surface;

    // __config__.orbitControlZoomSpeed = THREE.MathUtils.clamp(
    //   dist2surface < 0 ? 1 : dist2surface * 1e-6,
    //   0.0001,
    //   1
    // );

    // __updateCameraControls__()

    __usePanel_write__(0, `d2s:${dist2surface.toFixed(2)}m`);

    const ratio = (rad * rad2deg) / __config__.camFov;
    const pixels = Math.ceil(__viewport__.height * ratio);
    const unitInPixel = 20;
    const maxN = Math.ceil(__viewport__.height / unitInPixel);
    const n = THREE.MathUtils.clamp(Math.ceil(pixels / unitInPixel), 3, maxN);

    let size = rad2deg / (0.5 * n);
    const _size_n = this.getSizeN(size);
    size = 90 / _size_n;

    /**
     * 1. 計算屏幕可顯示完整球體時的最近相機與球心距離 D
     * 2. 大於 D，使用 SphereGeometry，合併 Tile，並使用一張 map
     * 3. 小於 D，使用 Tile，只加載屏幕可見區域的 map，需要計算合適的 map size，以保證視覺上的清晰
     * 4. 要計算出合適的 Tile Size，確保基本的球形
     * 5. 根據真實的地球曲率，繪製球體
     */
    this.build(n, size);
  }

  tileMeshes: THREE.Group = new THREE.Group();
  dist2tiles: Record<string, Earth3DTile[]> = {};

  private build(n, step: number) {
    if (this.dist2tiles[n]) {
      this.updateGeometry(this.dist2tiles[n]);
    } else {
      const tiles: Earth3DTile[] = [];
      this.dist2tiles[n] = tiles;

      for (let lat = -90; lat <= 90; lat += step) {
        for (let lng = -180; lng <= 180; lng += step) {
          const tile = new Earth3DTile(this, earthConfig.R, lat, lng, step);
          tiles.push(tile);
        }
      }

      this.updateGeometry(tiles);
    }
  }

  private _currentTilesRendered: Earth3DTile[] = [];

  private updateGeometry(tiles: Earth3DTile[]) {
    this._currentTilesRendered = tiles;

    const standablones: Earth3DTile[] = [];
    const pts: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let ibase = 0;
    for (const tile of tiles) {
      if (tile.standalone) {
        standablones.push(tile);
        continue;
      }

      const rgb = tile.color;
      for (let i = 0; i < 4; i++) {
        pts.push(tile.pts[i * 3], tile.pts[i * 3 + 1], tile.pts[i * 3 + 2]);
        colors.push(rgb.r, rgb.g, rgb.b);
        uvs.push(tile.uvs[i * 2], tile.uvs[i * 2 + 1]);
      }

      for (const i of tile.indices) {
        indices.push(i + ibase);
      }

      ibase += 4;
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pts), 3)
    );

    this.geometry.setIndex(indices);

    this.geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(uvs), 2)
    );

    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(colors), 3)
    );

    this.standaloneTiles = standablones;

    this.updateTileTexture();
  }

  private standaloneTiles: Earth3DTile[] = null;

  private updateTileTexture() {
    this.tileMeshes.clear();
    for (const tile of this.standaloneTiles) {
      if (!tile.mesh) tile.createMesh();
      tile.loadTileTexture();
      this.tileMeshes.add(tile.mesh);
    }
  }
}

const deg2rad = Math.PI / 180;
const rad2deg = 180 / Math.PI;
const Q4 = new THREE.Quaternion();
const V3 = new THREE.Vector3();
const V32 = new THREE.Vector3();

class Earth3DTile {
  readonly position: THREE.Vector3 = new THREE.Vector3();
  readonly normal: THREE.Vector3 = new THREE.Vector3();
  readonly pts: number[];
  readonly indices: number[];
  readonly uvs: number[];
  readonly color: THREE.Color;

  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> = null;

  standalone: boolean = false;

  private loadingTexture = false;

  constructor(
    readonly earth: EarthMap,
    readonly R: number,
    readonly lat: number,
    readonly lng: number,
    readonly size: number
  ) {
    this.color = new THREE.Color(Math.ceil(Math.random() * 0xffffff));
    const uvs: number[] = [];

    let _lat = lat;
    let _lng = lng;

    // 0 - left - bottom
    uvs.push(...latlng2uv(_lat, _lng));
    const pt0 = getCoordinatesByLatLng(R, _lat, _lng);

    // 1 - left - top
    _lat += size;
    uvs.push(...latlng2uv(_lat, _lng));
    const pt1 = getCoordinatesByLatLng(R, _lat, _lng);

    // 2 - right - top
    _lng += size;
    uvs.push(...latlng2uv(_lat, _lng));
    const pt2 = getCoordinatesByLatLng(R, _lat, _lng);

    // 3 - right - bottom
    _lat -= size;
    uvs.push(...latlng2uv(_lat, _lng));
    const pt3 = getCoordinatesByLatLng(R, _lat, _lng);

    this.pts = [...pt0, ...pt1, ...pt2, ...pt3];
    // this.indices = [0, 1, 2, 2, 3, 0];
    this.indices = [0, 3, 2, 2, 1, 0];
    this.uvs = uvs;

    this.position.set(
      ...getCoordinatesByLatLng(R, lat + 0.5 * size, lng + 0.5 * size)
    );

    this.normal.copy(this.position).normalize();
  }

  loadTileTexture(tileUrl?: string) {
    if (this.loadingTexture || this.mesh?.material.map) return;

    this.loadingTexture = true;

    textloader.load(
      tileUrl ??
        `http://localhost:3000/tile?lat=${this.lat}&lng=${this.lng}&span=${this.size}&w=800&h=800`,
      (texture) => {
        this.loadingTexture = false;

        this.mesh.geometry.setAttribute(
          "uv",
          new THREE.BufferAttribute(
            new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
            2
          )
        );

        this.mesh.material.map = texture;
        this.mesh.material.needsUpdate = true;
      }
    );
  }

  createMesh() {
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        vertexColors: false,
        color: 0xffffff,
      })
    );

    mesh.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.pts), 3)
    );

    mesh.geometry.setIndex(this.indices);

    mesh.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array(
          Array<THREE.Color>(4)
            .fill(this.color)
            .flatMap((c) => {
              return c.toArray();
            })
        ),
        3
      )
    );

    this.mesh = mesh;
  }
}

const getCoordinatesByLatLng = (R: number, lat: number, lng: number): Vec3 => {
  const latRad = lat * deg2rad;
  const lngRad = lng * deg2rad;

  const r = R * Math.cos(latRad);

  const z = r * Math.cos(lngRad);
  const x = r * Math.sin(lngRad);
  const y = R * Math.sin(latRad);

  return [x, y, z];
};

type EarthMapConfig = {
  R: number;
};
type LatLng = { lat: number; lng: number };
type LatLngTuple = [number, number];

const latlng2uv = (lat: number, lng: number) => {
  // 归一化经纬度
  const u = (180 + lng) / 360; // 经度映射到 [0, 1]
  const v = (90 + lat) / 180; // 纬度映射到 [0, 1]
  return [u, v];
};

const textloader = new THREE.TextureLoader(new THREE.LoadingManager());

const isPointInView = (
  camera: THREE.PerspectiveCamera,
  point: THREE.Vector3
) => {
  V3.copy(point).project(camera);

  return (
    V3.x <= 1 &&
    V3.x >= -1 &&
    V3.y <= 1 &&
    V3.y >= -1 &&
    V3.z <= 1 &&
    V3.z >= -1
  );
};

const isTileInView = (camera: THREE.PerspectiveCamera, tile: Earth3DTile) => {
  const { normal, pts, position } = tile;
  const Q = tile.earth.quaternion;

  V3.copy(normal).applyQuaternion(Q);
  V32.copy(position).applyQuaternion(Q);

  if (V3.dot(camera.position.clone().sub(V32).normalize()) <= 0.03)
    return false;

  let inScreen = 0;

  for (let i = 0; i < 4; i++) {
    V3.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
    V3.applyQuaternion(Q);
    inScreen += isPointInView(camera, V3) ? 1 : 0;
  }

  if (inScreen === 0) return false;

  return true;
};
