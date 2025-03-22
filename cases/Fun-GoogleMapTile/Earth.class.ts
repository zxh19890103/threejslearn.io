import * as THREE from "three";
import { EarthTile, EarthTileState } from "./EarthTile.class.js";
import {
  clamp,
  deg2rad,
  earthConfig,
  getCameraDistanceForZoom,
  getZoomLevel,
  latLngToSphere,
  latLngToTileXY,
  rad2deg,
  sphereToLatlng,
  tileXYToLatLng,
} from "./calc.js";
import {
  __resuable_q4_1__,
  __resuable_q4__,
  __resuable_vec3_1__,
  __reusable_vec3__,
  GoogleLyrs,
  GoogleTileScale,
  lyrsColors,
  minimalTileSize,
  scaleBarMeters,
  TilesGrid,
} from "./shared.js";
import { createCss2dObject } from "../css2r.js";
import { PointsCloud } from "./PointsCloud.class.js";

type EarthEventMap = THREE.Object3DEventMap & {
  latlng: {
    latlng: LatLng;
  };
  zoom: {
    zoom: number;
  };
};

export class Earth extends THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshBasicMaterial,
  EarthEventMap
> {
  private tilesToFadeIn: EarthTile[] = [];
  private tilesToKeep: EarthTile[] = [];
  private tilesToFadeOut: EarthTile[] = [];

  private inputByUI = false;

  private Core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private Points: PointsCloud;
  readonly LonLines: THREE.Group;
  readonly LatLines: THREE.Group;

  constructor(
    readonly world$: THREE.Scene,
    readonly camera$: THREE.PerspectiveCamera,
    readonly renderer$: THREE.WebGLRenderer
  ) {
    super(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        wireframe: true,
        color: 0xf1ef90,
      })
    );

    this.Points = new PointsCloud(world$);
    this.Points.twink(0);

    this.Core = new THREE.Mesh(
      new THREE.SphereGeometry(earthConfig.R3, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0xabeaf4,
        transparent: false,
        wireframe: false,
        opacity: 1,
        visible: true,
        depthTest: true,
        depthWrite: true,
      })
    );

    this.LatLines = new THREE.Group();
    this.LonLines = new THREE.Group();

    {
      for (let lng = -180; lng <= 180; lng += 15) {
        this.LonLines.add(new LonLine(lng));
      }
    }

    this.add(this.Core, this.tilesMeshGroup, this.LatLines, this.LonLines);

    {
      const raycaster = new THREE.Raycaster();

      const vec2 = new THREE.Vector2();

      const domElement = this.renderer$.domElement;

      const raycast = (x: number, y: number) => {
        const ndc = this.viewportXYToNDC({ x, y });
        vec2.set(ndc.x, ndc.y);
        raycaster.setFromCamera(vec2, camera$);

        const intersection = raycaster.intersectObject(this.Core, false);

        if (intersection[0] !== undefined) {
          const coords = intersection[0].point;
          return sphereToLatlng(coords, this.Core.geometry.parameters.radius);
        }

        return null;
      };

      let isClick = 0;

      const pMove = (event) => {
        isClick += 1;
      };

      domElement.addEventListener("mousemove", (event) => {
        const x = event.offsetX;
        const y = event.offsetY;

        const latlng = raycast(x, y);

        if (latlng) {
          __usePanel_write__(
            4,
            `cursor: ${latlng.lat.toFixed(2)},${latlng.lng.toFixed(2)}`
          );
        } else {
          __usePanel_write__(4, "cursor: --");
        }
      });

      const pUp = (event) => {
        if (isClick === 0) {
          pClick(event);
        } else {
          console.log("it's not a click action!");
        }

        domElement.removeEventListener("pointermove", pMove);
        domElement.removeEventListener("pointerup", pUp);
        domElement.removeEventListener("pointerleave", pUp);
      };

      const pDown = () => {
        isClick = 0;

        domElement.addEventListener("pointermove", pMove);
        domElement.addEventListener("pointerup", pUp);
        domElement.addEventListener("pointerleave", pUp);
      };

      domElement.addEventListener("pointerdown", pDown);

      const pClick = (event) => {
        let x = event.offsetX;
        let y = event.offsetY;

        const latlng = raycast(x, y);

        if (latlng) {
          this.flyTo(latlng.lat, latlng.lng);
        }
      };
    }

    {
      this.scaleBarElement = {
        label: document.querySelector("#PgAppScaleBar label"),
        div: document.querySelector("#PgAppScaleBar div"),
      };
    }
  }

  setMarker(name: string, latlng: LatLng, color: number) {
    const coords = latLngToSphere(latlng.lat, latlng.lng, earthConfig.R);
    this.Points.setPt(0, coords, color);
  }

  private scaleBarElement: {
    label: HTMLLabelElement;
    div: HTMLDivElement;
  };

  drawScaleBar() {
    if (!this.metersPerPixelChanged) return;

    const mpp = this.metersPerPixel;

    let suitable = scaleBarMeters.find((m) => m / mpp > 30);

    if (!suitable) {
      suitable = scaleBarMeters[0];
    }

    const pixelsPerUnit = Math.ceil(suitable / mpp);
    const { label, div } = this.scaleBarElement;
    div.style.width = `${pixelsPerUnit + 2}px`;
    label.innerText = suitable > 1000 ? suitable / 1000 + "km" : suitable + "m";
  }

  locate() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("緯度:", position.coords.latitude);
          console.log("經度:", position.coords.longitude);

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          this.setMarker("locate", { lat, lng }, 0x0eff91);
          this.flyTo(position.coords.latitude, position.coords.longitude);

          console.log("準確度:", position.coords.accuracy, "公尺");
        },
        (error) => {
          console.error("獲取定位失敗:", error.message);
        }
      );
    } else {
      console.error("瀏覽器不支持 Geolocation API");
    }
  }

  /**
   * @todo
   */
  isLonLineInView(lon: LonLine) {
    // const { lat, lng } = this.centerLatLng;
    // const dist = this.camera$.position.length();
    // const t = Math.sin(Math.abs(lat * deg2rad));
    // let r = this.camera$.aspect * (Math.atan(earthConfig.R / dist) * rad2deg);
    // r += (90 - r) * t;
    // const diff = Math.abs(lng - lon.lng) % 360;
    // return diff < r;
    return false;
  }

  measureMetersPerPixelAtCenter() {
    const center = this.getCenterCoordinates();
    const ndc = __reusable_vec3__.copy(center).project(this.camera$);
    const sXY = this.ndcToViewportXY(ndc);

    sXY.x += 1;
    sXY.y += 1;

    const ndc2 = this.viewportXYToNDC(sXY);

    ndc.set(ndc2.x, ndc2.y, ndc.z);

    ndc.unproject(this.camera$);

    const pixels = Math.sqrt(2);
    const dist = ndc.distanceTo(center);

    const metersPerPixel = dist / pixels;

    this.metersPerPixelChanged =
      Math.abs(metersPerPixel - this.metersPerPixel) > 0;

    this.metersPerPixel = metersPerPixel;

    __usePanel_write__(3, `1pixel=${this.metersPerPixel.toFixed(2)} meters`);
    return dist;
  }

  private metersPerPixel: number = 0;
  private metersPerPixelChanged = false;

  private ndcToViewportXY(ndc: THREE.Vector3): Vec2Like {
    let x = (1 + ndc.x) / 2;
    let y = 1 - (1 + ndc.y) / 2;

    x = x * __viewport__.width;
    y = y * __viewport__.height;

    return { x, y };
  }

  private viewportXYToNDC(xy: Vec2Like) {
    let x = xy.x / __viewport__.width;
    let y = xy.y / __viewport__.height;

    x = 2 * x - 1;
    y = 2 * (1 - y) - 1;

    return { x, y };
  }

  checkLonLines() {
    for (const child of this.LonLines.children) {
      if (this.isLonLineInView(child as LonLine)) {
        child.visible = true;
      } else {
        child.visible = false;
      }
    }
  }

  flyTo(lat: number, lng: number, byUI: boolean = false) {
    const initialPos = this.camera$.position.toArray();
    __reusable_vec3__.copy(this.camera$.position).normalize();
    const dist = this.camera$.position.length();

    const coords = latLngToSphere(lat, lng, dist);
    __resuable_vec3_1__.copy(coords).normalize();

    __resuable_q4__.setFromUnitVectors(__reusable_vec3__, __resuable_vec3_1__);
    __resuable_q4_1__.identity();

    const angle = __resuable_q4_1__.angleTo(__resuable_q4__) * __3__.rad2deg;

    const to = {
      t: 0,
    };

    __createAnimation__(
      to,
      {
        t: 1,
      },
      angle * 60,
      null,
      () => {
        __resuable_q4_1__.identity().slerp(__resuable_q4__, to.t);

        this.camera$.position
          .set(...initialPos)
          .applyQuaternion(__resuable_q4_1__);
      }
    ).start();

    this.inputByUI = byUI;
  }

  zoomTo(zoom: number) {
    const dist = getCameraDistanceForZoom(
      this.camera$.fov,
      earthConfig.R,
      zoom
    );

    const newpos = __reusable_vec3__
      .copy(this.camera$.position)
      .setLength(dist);

    __createAnimation__(
      this.camera$.position,
      {
        x: newpos.x,
        y: newpos.y,
        z: newpos.z,
      },
      Math.abs(zoom - this.zoom) * 300
    ).start();

    this.camera$.position.setLength(dist);
    this.inputByUI = true;
  }

  calcTilesGrid() {
    const { x, y } = latLngToTileXY(
      this.centerLatLng.lat,
      this.centerLatLng.lng,
      this.zoom
    );

    const tilesN = this.tilesN;

    const leftTopLatlng = tileXYToLatLng(x, y, this.zoom);
    const rightBottomLatlng = tileXYToLatLng(
      (x + 1) % tilesN,
      (y + 1) % tilesN,
      this.zoom
    );

    const leftTopCoords = latLngToSphere(leftTopLatlng.lat, leftTopLatlng.lng);
    const rightBottomCoords = latLngToSphere(
      rightBottomLatlng.lat,
      rightBottomLatlng.lng
    );

    const { x: lt_x, y: lt_y } = __reusable_vec3__
      .copy(leftTopCoords)
      .project(this.camera$);
    const { x: rb_x, y: rb_y } = __reusable_vec3__
      .copy(rightBottomCoords)
      .project(this.camera$);

    const nextTilesGrid = {
      xy: { x, y },
      nx: clamp(1 + Math.ceil(1 / Math.abs(rb_x - lt_x)), 1, 10),
      ny: clamp(1 + Math.ceil(1 / Math.abs(lt_y - rb_y)), 1, 10),
    };

    this.tilesGridChanged = this.compareTilesGrid(
      this.tilesGrid,
      nextTilesGrid
    );

    this.tilesGrid = nextTilesGrid;
  }

  private tilesGridChanged = false;
  private tilesGrid: TilesGrid;

  private compareTilesGrid(grid1: TilesGrid, grid2: TilesGrid) {
    if (!grid1) return true;

    return !(
      grid1.xy.x === grid2.xy.x &&
      grid1.xy.y === grid2.xy.y &&
      grid1.nx === grid2.nx &&
      grid1.ny === grid2.ny
    );
  }

  build() {
    const tiles: EarthTile[] = [];

    const tilesN = this.tilesN;
    const tilesNx100 = 100 * tilesN;
    const { xy, nx, ny } = this.tilesGrid;

    for (let i = -nx; i <= nx; i += 1) {
      const x = (xy.x + i + tilesNx100) % tilesN;

      for (let j = -ny; j <= ny; j += 1) {
        const y = (xy.y + j + tilesNx100) % tilesN;

        const cacheKey = `${x}.${y}.${this.zoom}`;
        let tile: EarthTile;

        if (this.tilesCache.has(cacheKey)) {
          tile = this.tilesCache.get(cacheKey);
          if (tile.cannotUse()) {
            tile = null;
          }
        }

        if (!tile) {
          tile = new EarthTile(this, x, y, this.zoom);
        }

        this.tilesCache.set(cacheKey, tile);
        tile.toUse();
        tiles.push(tile);
      }
    }

    this.pushTilesToFadeOut(
      ...this.tilesToFadeIn.filter((t) => !tiles.includes(t))
    );

    this.tilesToKeep = tiles.filter((tile) =>
      this.tilesToFadeIn.includes(tile)
    );

    this.tilesToFadeIn = tiles;
  }

  private centerCoordinates: THREE.Vector3 = new THREE.Vector3();
  private centerLatLng: LatLng = null;
  private centerLatLngChanged = false;

  getLatRadius(lat: number) {
    const { R, R2, R3 } = earthConfig;
    return R2 - (R2 - R3) * Math.sin(lat * __3__.deg2rad);
  }

  getCenter(): LatLng {
    return this.centerLatLng;
  }

  getCenterCoordinates() {
    return this.centerCoordinates;
  }

  setCenter(latlng: LatLng) {
    if (
      this.centerLatLng &&
      Math.abs(latlng.lat - this.centerLatLng.lat) <=
        this.minLatChangeThreshold &&
      Math.abs(latlng.lng - this.centerLatLng.lng) <= this.minLngChangeThreshold
    ) {
      return;
    }

    this.centerLatLng = latlng;
    this.centerLatLngChanged = true;

    if (this.inputByUI) {
      this.inputByUI = false;
    } else {
      this.dispatchEvent({
        type: "latlng",
        latlng: latlng,
      });
    }

    const coordinates = latLngToSphere(latlng.lat, latlng.lng);

    this.centerCoordinates.copy(coordinates);
  }

  getZoom() {
    return this.zoom;
  }

  private zoom: number = -1;
  private zoomChanged = false;
  private tilesN: number = 0;
  private minLatChangeThreshold = 0;
  private minLngChangeThreshold = 0;

  setZoom(z: number) {
    if (z === this.zoom) {
      return;
    }

    this.tilesN = Math.pow(2, z);
    this.calcMinLatLngChangeThreshold();

    this.zoom = z;
    this.zoomChanged = true;

    if (this.inputByUI) {
      this.inputByUI = false;
    } else {
      this.dispatchEvent({ type: "zoom", zoom: z });
    }

    /**@todo */
    __updateCameraControls__(
      z === 0 ? 1 : clamp(Math.pow(1 / z, z / 5), 1e-4, 1),
      z === 0 ? 1 : clamp(Math.pow(1 / z, z / 5), 1e-5, 1)
    );
  }

  private tileScale: GoogleTileScale = 1;

  getTileScale() {
    return this.tileScale;
  }

  setTileScale(val: GoogleTileScale) {
    if (val === this.tileScale) return;
    this.tileScale = val;
    this.updateLyrs();
  }

  calcMinLatLngChangeThreshold() {
    const w = this.tilesN * minimalTileSize * this.tileScale;

    this.minLatChangeThreshold = 180 / w;
    this.minLngChangeThreshold = 360 / w;
  }

  checkZoomLoop() {
    const zoomlevel = getZoomLevel(this.camera$, earthConfig.R);
    this.setZoom(zoomlevel);
  }

  checkCenterLoop() {
    const coords = this.calcCenterCoords();
    const latlng = sphereToLatlng(coords, earthConfig.R);
    this.setCenter(latlng);
  }

  private calcCenterCoords(): Vec3Like {
    const coords = __reusable_vec3__
      .copy(this.camera$.position)
      .setLength(earthConfig.R);

    return {
      x: coords.x,
      y: coords.y,
      z: coords.z,
    };
  }

  readonly tilesCache: Map<string, EarthTile> = new Map();
  readonly tilesMeshGroup = new THREE.Group();

  /**
   * unit: s
   */
  private idleLast = null;

  /**
   *
   */
  updateDiff(t: number) {
    const changed =
      this.centerLatLngChanged || this.zoomChanged || this.tilesGridChanged;

    if (changed) {
      this.idleLast = 0;

      this.centerLatLngChanged = false;
      this.zoomChanged = false;
      this.tilesGridChanged = false;
    } else {
      if (this.idleLast === null) {
      } else {
        this.idleLast += t;
        if (this.idleLast > 0.3) {
          this._doUpdateDiff();
          this.idleLast = null;
        }
      }
    }
  }

  private lyrs: GoogleLyrs = "m";

  getLyrs() {
    return this.lyrs;
  }

  setLyrs(val: GoogleLyrs) {
    if (val === this.lyrs) return;
    this.lyrs = val;
    this.updateLyrs();
  }

  private updateLyrs() {
    console.log("render! [force]");

    this.Core.material.color.set(lyrsColors[this.lyrs]);
    this.Core.material.needsUpdate = true;

    this.tilesCache.forEach((tile) => {
      tile.texLoaded = false;
    });

    for (const tile of this.tilesToFadeIn) {
      tile.loadTex(null);
    }
  }

  private _doUpdateDiff() {
    console.log("render!");
    this.build();
    this.renderTiles();
  }

  private renderTiles() {
    const eachFn = (tile: EarthTile) => {
      this.tilesMeshGroup.add(tile.mesh);
      tile.fadeIn(900);
      size--;
      if (size === 0) this.toDiposeTiles();
    };

    let size = this.tilesToFadeIn.length;

    for (const tile of this.tilesToFadeOut) {
      if (!tile.mesh) continue;

      tile.mesh.material.transparent = true;
      tile.mesh.material.opacity = 0.67;
    }

    for (const tile of this.tilesToFadeIn) {
      if (this.tilesToKeep.includes(tile)) {
        continue;
      }

      if (!tile.grid) {
        tile.createGridLine();
        this.tilesMeshGroup.add(tile.grid);
      }

      if (!tile.mesh) {
        tile.createMesh();
      }

      if (tile.texLoaded) {
        eachFn(tile);
      } else {
        tile.loadTex(eachFn);
      }
    }

    this.tilesToKeep = [];
  }

  private pushTilesToFadeOut(...tiles: EarthTile[]) {
    for (const tile of tiles) {
      tile.state = EarthTileState.toremove;
      this.tilesToFadeOut.push(tile);
    }
  }

  private toDiposeTiles() {
    const done = (tile) => {
      tile.toDispose();
    };

    for (const tile of this.tilesToFadeOut) {
      if (tile.state === EarthTileState.toremove) {
        tile.fadeOut(800, done);
      }
    }

    this.tilesToFadeOut = [];
  }

  checkDisposeLoop(dt: number) {
    let c = 0;
    for (const [k, tile] of this.tilesCache) {
      if (tile.state === EarthTileState.todispose) {
        tile.msElapseSinceToDispose += dt;
        /**
         * 1s later, if this tile is not in using, remove it from cache!
         */
        if (tile.msElapseSinceToDispose > 3) {
          tile.state = EarthTileState.disposing;

          tile.dispose();
          this.tilesCache.delete(k);
          c++;
        }
      }
    }

    if (c > 0) {
      console.log("disposed!", c);
      console.log("remaining!", this.tilesCache.size);
    }
  }
}

const getLabel = (lng: number) => {
  if (lng === 0) return "0°";
  if (lng < 0) return `W${-lng}°`;
  if (lng > 0) return `E${lng}°`;
};

class LonLine extends THREE.Line {
  readonly centerCoords: Vec3Like;

  constructor(readonly lng: number) {
    const pts: number[] = [];

    super(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        transparent: false,
        color: lng === 0 ? 0xfe1010 : 0x000000,
        depthTest: true,
        depthWrite: true,
      })
    );

    for (let lat = -90; lat <= 90; lat += 3) {
      const coords = latLngToSphere(
        lat,
        lng,
        earthConfig.R + 2 * __config__.camNear
      );
      pts.push(coords.x, coords.y, coords.z);
    }

    const labelPos = latLngToSphere(0, lng, earthConfig.R);

    this.centerCoords = labelPos;

    const text = createCss2dObject(getLabel(lng), {
      fontsize: 11,
      color: "#fe2310",
      offset: 0,
    });
    text.position.copy(labelPos);
    this.add(text);

    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(pts, 3)
    );
  }
}
