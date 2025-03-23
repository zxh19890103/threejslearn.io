import * as THREE from "three";
import { Earth } from "./Earth.class.js";
import { earthConfig, latLngToSphere, tileXYToLatLng } from "./calc.js";
import { __reusable_vec3__ } from "./shared.js";

export class EarthTile {
  readonly color: THREE.Color;

  readonly latlng: LatLng;
  readonly pts: number[];
  readonly indices: number[];
  readonly uvs: number[];
  readonly normals: number[];

  readonly gridpts: number[];
  readonly gridindices: number[];

  state: EarthTileState = EarthTileState.created;
  readonly stateMgr: EarthTileStateManager;
  readonly cacheKey: string;

  grid: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial>;

  constructor(
    readonly earth: Earth,
    readonly uiGroup: THREE.Group,
    readonly cache: Map<string, EarthTile>,
    readonly x: number,
    readonly y: number,
    readonly z: number
  ) {
    this.cacheKey = getTileCacheKey(x, y, z);

    this.stateMgr = new EarthTileStateManager(this);

    this.cache.set(this.cacheKey, this);

    const latlngToUV = (lat: number, lng: number): Vec2 => {
      const u = (lng - leftBottom.lng) / lngSpan;
      const v = (lat - leftBottom.lat) / latSpan;
      return [u, v];
    };

    const calcLoopParams = () => {
      const maxStep = 3;

      let stepLat = Math.min(maxStep, latSpan);
      let stepLng = Math.min(maxStep, lngSpan);

      let nX = Math.max(2, Math.ceil(lngSpan / stepLng));
      let nY = Math.max(2, Math.ceil(latSpan / stepLat));

      stepLng = lngSpan / nX;
      stepLat = latSpan / nY;

      nX += 1;
      nY += 1;

      const ixLast = nX - 1;
      const iyLast = nY - 1;

      return {
        stepLat,
        stepLng,
        nX,
        ixLast,
        nY,
        iyLast,
      };
    };

    const isEdge = () => {
      return iy === 0 || iy === nY || ix === 0 || ix === nX;
    };

    const leftTop = tileXYToLatLng(x, y, z);
    const rightTop = tileXYToLatLng(x + 1, y, z);
    const rightBottom = tileXYToLatLng(x + 1, y + 1, z);
    const leftBottom = tileXYToLatLng(x, y + 1, z);

    const lngSpan = rightBottom.lng - leftBottom.lng;
    const latSpan = leftTop.lat - leftBottom.lat;

    const pts: number[] = [];
    const grid_pts: number[] = [];
    const grid_indices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    let uv: Vec2 = null;
    let coords: Vec3Like = null;
    let ibase = 0;
    let ix = 0;
    let iy = 0;

    const { nY, nX, ixLast, iyLast, stepLat, stepLng } = calcLoopParams();

    let lat: number;
    let lng: number;

    for (lat = leftBottom.lat; iy < nY; lat += stepLat) {
      ix = 0;

      for (lng = leftBottom.lng; ix < nX; lng += stepLng) {
        coords = latLngToSphere(lat, lng, earthConfig.R);
        uv = latlngToUV(lat, lng);

        if (isEdge()) grid_pts.push(coords.x, coords.y, coords.z);
        pts.push(coords.x, coords.y, coords.z);
        uvs.push(uv[0], uv[1]);

        __reusable_vec3__.copy(coords).normalize();
        normals.push(
          __reusable_vec3__.x,
          __reusable_vec3__.y,
          __reusable_vec3__.z
        );

        if (ix < ixLast && iy < iyLast) {
          indices.push(
            ibase,
            ibase + 1,
            ibase + 1 + nX,
            ibase + 1 + nX,
            ibase + nX,
            ibase
          );
        }

        ix += 1;
        ibase += 1;
      }

      iy += 1;
    }

    // bottom
    grid_indices.push(
      ...Array(nX)
        .fill(0)
        .map((x, i) => i)
    );

    // right
    grid_indices.push(
      ...Array(nY)
        .fill(0)
        .map((x, i) => {
          return nX * (i + 1) - 1;
        })
    );

    // top
    grid_indices.push(
      ...Array(nX)
        .fill(0)
        .map((x, i) => {
          return nX * (nY - 1) + i;
        })
        .sort((a, b) => b - a)
    );

    // left
    grid_indices.push(
      ...Array(nY)
        .fill(0)
        .map((x, i) => {
          return nX * i;
        })
        .sort((a, b) => b - a)
    );

    this.indices = indices;
    this.pts = pts;
    this.uvs = uvs;
    this.normals = normals;

    this.gridindices = grid_indices;
    this.gridpts = grid_pts;

    this.latlng = leftTop;
  }

  private createGridLine() {
    const geometry = new THREE.BufferGeometry();

    this.grid = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.pts, 3)
    );

    geometry.setIndex(this.gridindices);
  }

  private createMesh() {
    const geometry = new THREE.BufferGeometry();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshPhongMaterial({
        transparent: false,
        opacity: 1,
        color: 0xffffff,
        depthTest: true,
        depthWrite: true,
        blending: THREE.NormalBlending,
      })
    );

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.pts), 3)
    );

    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(this.uvs), 2)
    );

    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(this.normals), 3)
    );

    geometry.setIndex(this.indices);

    this.mesh = mesh;
  }

  cannotUse() {
    return (
      this.state === EarthTileState.disposed ||
      this.state === EarthTileState.disposing
    );
  }

  private getUrl() {
    return this.earth.tileUrl
      .replace("{x}", this.x + "")
      .replace("{y}", this.y + "")
      .replace("{z}", this.z + "")
      .replace("{scale}", this.earth.getTileScale() + "")
      .replace("{lyrs}", this.earth.getLyrs());
  }

  /**
   * ms
   */
  _t: number = 0;

  toRemove() {
    switch (this.state) {
      case EarthTileState.created:
      case EarthTileState.texture:
      case EarthTileState.added:
      case EarthTileState.fadingIn:
      case EarthTileState.settled: {
        this.stateMgr.state = EarthTileState.toRemove;
        break;
      }
      case EarthTileState.toRemove:
      case EarthTileState.fadingOut:
      case EarthTileState.removed:
      case EarthTileState.toDispose:
      case EarthTileState.disposing:
      case EarthTileState.disposed:
      default: {
        break;
      }
    }
  }

  toReUse() {
    switch (this.state) {
      case EarthTileState.created:
      case EarthTileState.texture:
      case EarthTileState.added:
      case EarthTileState.fadingIn:
      case EarthTileState.settled: {
        return true;
      }
      case EarthTileState.toRemove:
      case EarthTileState.fadingOut: {
        this.stateMgr.state = EarthTileState.added;
        return true;
      }
      case EarthTileState.removed: {
        this.uiGroup.add(this.grid);
        if (this.mesh) {
          this.uiGroup.add(this.mesh);
        }
        this.stateMgr.state = EarthTileState.added;
        return true;
      }
      case EarthTileState.toDispose:
      case EarthTileState.disposing:
      case EarthTileState.disposed:
      default: {
        return false;
      }
    }
  }

  toReloadTex() {
    switch (this.state) {
      case EarthTileState.created:
      case EarthTileState.texture: {
        // nothing!
        break;
      }
      case EarthTileState.added:
      case EarthTileState.fadingIn:
      case EarthTileState.settled: {
        this.loadTexPhase = "ready";
        this.stateMgr.state = EarthTileState.texture;
        break;
      }
      default: {
        this.loadTexPhase = "ready";
        break;
      }
    }
  }

  /**
   *
   * @param dt: delta s
   * @param now: ms since the app's bootstrapped
   */
  checkTileState(dt: number, now: number) {
    this._t = now;

    switch (this.state) {
      case EarthTileState.created: {
        this.createGridLine();
        this.createMesh();
        this.stateMgr.state = EarthTileState.texture;
        break;
      }
      case EarthTileState.texture: {
        this.uiGroup.add(this.grid);

        if (this.loadTexPhase === "ready") {
          this.loadTex((_, tex) => {
            if (this.state === EarthTileState.texture) {
              if (tex) {
                const mat = this.mesh.material;

                mat.depthTest = false;
                mat.transparent = true;
                mat.opacity = 0;
                mat.needsUpdate = true;

                this.processTex(tex);
                this.uiGroup.add(this.mesh);
                this.stateMgr.state = EarthTileState.added;
              } else {
                this.stateMgr.state = EarthTileState.settled;
              }
            }
          });
        }

        break;
      }
      case EarthTileState.added: {
        this.stateMgr.state = EarthTileState.fadingIn;
        break;
      }
      case EarthTileState.fadingIn: {
        if (this.mesh) {
          const mat = this.mesh.material;
          mat.opacity += 0.03;

          if (mat.opacity >= 1) {
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthTest = true;
            this.stateMgr.state = EarthTileState.settled;
          }

          mat.needsUpdate = true;
        } else {
          this.stateMgr.state = EarthTileState.settled;
        }
        break;
      }
      case EarthTileState.settled: {
        break;
      }
      case EarthTileState.toRemove: {
        if (this.mesh) {
          const mat = this.mesh.material;

          mat.transparent = true;
          mat.opacity = 0.3;
          mat.depthTest = false;

          mat.needsUpdate = true;
        }

        this.stateMgr.state = EarthTileState.readyToFadingOut;
        break;
      }
      case EarthTileState.readyToFadingOut: {
        const elapse = this.stateMgr.getElapse("readyToFadingOutAt");
        // wait the texture to loaded and added!
        if (elapse > 500) {
          this.stateMgr.state = EarthTileState.fadingOut;
        }
        break;
      }
      case EarthTileState.fadingOut: {
        if (this.mesh) {
          const mat = this.mesh.material;
          mat.opacity -= 0.02;

          if (mat.opacity <= 0) {
            mat.transparent = false;
            mat.opacity = 0;
            mat.depthTest = true;

            this.uiGroup.remove(this.mesh, this.grid);
            this.stateMgr.state = EarthTileState.removed;
          }

          mat.needsUpdate = true;
        } else {
          this.uiGroup.remove(this.grid);
          this.stateMgr.state = EarthTileState.removed;
        }
        break;
      }
      case EarthTileState.removed: {
        const elapse = this.stateMgr.getElapse("removedAt");
        if (elapse >= 3000) {
          this.stateMgr.state = EarthTileState.toDispose;
        }
        break;
      }
      case EarthTileState.toDispose: {
        this.stateMgr.state = EarthTileState.disposing;
        break;
      }
      case EarthTileState.disposing: {
        const { mesh, grid } = this;

        if (mesh) {
          mesh.geometry.dispose();
          mesh.material.dispose();
        }

        if (grid) {
          grid.geometry.dispose();
          grid.material.dispose();
        }

        this.stateMgr.state = EarthTileState.disposed;
        break;
      }
      case EarthTileState.disposed: {
        this.mesh = null;
        this.grid = null;
        this.loadTexPhase = "ready";

        this.cache.delete(this.cacheKey);
        break;
      }
      default: {
        break;
      }
    }
  }

  private processTex(texture: THREE.Texture) {
    const mat = this.mesh.material;
    if (mat.map) mat.map.dispose();

    texture.minFilter = THREE.NearestMipMapNearestFilter; // 或 THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter; // 避免模糊
    texture.anisotropy = this.earth.renderer$.capabilities.getMaxAnisotropy(); // 提升細節

    mat.color.set(0xffffff);
    mat.map = texture;
    mat.needsUpdate = true;
  }

  loadTexPhase: LoadTexPhase = "ready";
  loadTex(done?: (tile: EarthTile, tex: THREE.Texture) => void) {
    this.loadTexPhase = "loading";

    textloader.load(
      this.getUrl(),
      (texture) => {
        if (this.loadTexPhase === "abort") return;
        this.loadTexPhase = "done";
        done?.(this, texture);
      },
      null,
      () => {
        if (this.loadTexPhase === "abort") return;
        this.loadTexPhase = "fail";
        done?.(this, null);
      }
    );
  }
}

type LoadTexPhase = "ready" | "loading" | "done" | "fail" | "abort";

export enum EarthTileState {
  /**
   * # 1
   * just called the constructor.
   * where points/colors/normals/nvs are all computed!
   */
  created = 1,
  /**
   * # 2
   * mesh and grid lines are created!
   * next: loading texture!
   */
  texture = 3,
  /**
   * # 3
   * texture loaded succefully and added to uiGroup
   * if texture loading is failed! no this phase, nor fadingIn.
   * instead, directly step to `settled`
   * material are set to `transparent = true & opacity = 0`
   * next: fading in.
   */
  added = 5,
  /**
   * # 4
   *
   * fading in loop
   */
  fadingIn = 7,
  /**
   * # 5
   * `transparent = false & opacity = 1`
   * fading in animation are completed!
   * keep this state!
   */
  settled = 10,
  /**
   * # 6
   * tile should not be visible in the scene.
   * the tile will be removed, but still in the scene.
   * will play a fading-out animation
   */
  toRemove = 15,
  readyToFadingOut = 16,
  /**
   *  # 7
   * can switch to fading-in, no need to add.
   */
  fadingOut = 18,
  /**
   * # 8
   * removed from the scene.
   * you cannot see it at this time.
   * but it can be re-added!
   */
  removed = 20,
  /**
   * # 9
   * 3 second later,
   * cannot be re-added!
   */
  toDispose = 22,
  /**
   * # 10
   * cannot be re-used.
   */
  disposing = 25,
  /**
   * # 11
   * dead! it will be disposded totally from scene & memory.
   * cannot be re-used!
   */
  disposed = 30,
}

type StateMutationAtKey = `${keyof typeof EarthTileState}At`;

type StateMutationAt = Record<StateMutationAtKey, number>;

class EarthTileStateManager {
  constructor(readonly tile: EarthTile) {
    this.createdAt = performance.now();
  }

  set state(s: EarthTileState) {
    this.tile.state = s;
    const key = EarthTileState[s] + "At";
    this[key] = this.tile._t;
  }

  /** ms */
  getElapse(name: StateMutationAtKey) {
    if (this[name] === undefined) {
      return -1;
    }
    return this.tile._t - this[name];
  }
}

interface EarthTileStateManager extends StateMutationAt {}

const loadingMgr = new THREE.LoadingManager();
const textloader = new THREE.TextureLoader(loadingMgr);

export const getTileCacheKey = (x: number, y: number, z: number) => {
  return `${z}.${x}.${y}`;
};
