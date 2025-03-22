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
  grid: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial>;
  texLoaded: boolean = false;

  msElapseSinceToDispose: number = 0;

  constructor(
    readonly earth: Earth,
    readonly x: number,
    readonly y: number,
    readonly z: number
  ) {
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

  createGridLine() {
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

  createMesh() {
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

  private animations: CreateAnimationReturns[] = [];
  private isPlaying: boolean = false;

  private pushAnimation(animation: CreateAnimationReturns) {
    this.animations.push(animation);

    if (this.isPlaying) return;

    this.isPlaying = true;

    this.playAnimation();
  }

  private playAnimation = () => {
    const animation = this.animations.shift();

    if (!animation) {
      this.isPlaying = false;
      return;
    }

    if (this.mesh) {
      this.mesh.material.depthTest = false;
    }

    animation.start();
  };

  /**
   * @deprecated
   */
  fadeOut(ms: number, done: (tile: EarthTile) => void) {
    const mat = this.mesh.material;
    mat.transparent = true;

    const animation = __createAnimation__(
      mat,
      {
        opacity: 0,
      },
      ms,
      () => {
        done?.(this);
        mat.transparent = false;

        this.playAnimation();
      }
    );

    this.pushAnimation(animation);
  }

  /**
   * @deprecated
   */
  fadeIn(ms: number) {
    const mat = this.mesh.material;

    mat.transparent = true;
    mat.opacity = 0;

    const animation = __createAnimation__(
      mat,
      {
        opacity: 1,
      },
      ms,
      () => {
        mat.transparent = false;
        this.playAnimation();
      }
    );

    this.pushAnimation(animation);
  }

  dispose() {
    this.state = EarthTileState.disposed;

    const { mesh, grid } = this;

    if (mesh) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    if (grid) {
      grid.removeFromParent();
      grid.geometry.dispose();
      grid.material.dispose();
    }

    this.mesh = null;
    this.grid = null;
  }

  cannotUse() {
    return (
      this.state === EarthTileState.disposed ||
      this.state === EarthTileState.disposing
    );
  }

  toDispose() {
    const { mesh, grid } = this;

    mesh?.removeFromParent();
    grid?.removeFromParent();

    this.state = EarthTileState.todispose;
    this.msElapseSinceToDispose = 0;
  }

  toUse() {
    this.state = EarthTileState.using;
  }

  loadTex(done?: (tile: EarthTile) => void) {
    const lyrs = this.earth.getLyrs();
    const scale = this.earth.getTileScale();

    textloader.load(
      `https://mt3.google.com/vt/lyrs=${lyrs}&x=${this.x}&y=${this.y}&z=${this.z}&scale=${scale}&hl=en`,
      (texture) => {
        if (!this.mesh) return;

        const mat = this.mesh.material;
        if (mat.map) mat.map.dispose();

        texture.minFilter = THREE.NearestMipMapNearestFilter; // 或 THREE.NearestFilter
        texture.magFilter = THREE.NearestFilter; // 避免模糊
        texture.anisotropy =
          this.earth.renderer$.capabilities.getMaxAnisotropy(); // 提升細節

        mat.color.set(0xffffff);
        mat.map = texture;
        mat.needsUpdate = true;

        done?.(this);

        this.texLoaded = true;
      }
    );
  }
}

export enum EarthTileState {
  created = 1,
  using = 10,
  toremove = 15,
  todispose = 20,
  disposing = 25,
  disposed = 30,
}

const textloader = new THREE.TextureLoader(new THREE.LoadingManager());
