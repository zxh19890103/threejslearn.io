type ControlType =
  | "number"
  | "range"
  | "enum"
  | "color"
  | "string"
  | "bit"
  | "date"
  | "btn";
type ControlValueType = "number" | "int" | "string" | "bit";

type ControlOption<T> = { label: string; value: T; data?: any };
type DefCtrlExtras<T> = Omit<
  Control<T>,
  "value" | "$el" | "type" | "name" | "value"
>;

interface Control<T extends ControlValueType = any> {
  $el?: HTMLDivElement;
  value?: T;
  valueType?: ControlValueType;
  fixed?: number;
  options?: ControlOption<T>[];
  min?: number;
  max?: number;
  freq?: number;
  /**
   * @default true
   */
  eval?: boolean;
  /** turn on performace monitor by calling console.time/
   *
   * only if the control is with type of `invoke`.
   * @default false
   */
  perf?: boolean;
  help?: string;
  helpWidth?: number;
  type: ControlType;
  label: string;
  name: string;
}

interface ControlDefineProps {
  type: ControlType;
  label: string;
}

type NextFrameFn = (
  /**the unique world scene */
  scene: THREE.Scene,
  /** the main camera */
  camera: THREE.Camera,
  /** the canvas renderer */
  renderer: THREE.WebGLRenderer,
  /** the delta of time delta, unit: s */
  delta: number,
  /** frames skipped */
  skip: number,
) => void;

type AddNextFrameFnItem = {
  id: number;
  delta: number;
  skip: number;
  fn: NextFrameFn;
  /** seconds */
  per: number;
};

type MainFunc = (
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  cameraCtrls: OrbitControls | MapControls,
) => Promise<void> | void;

type Config = {
  camFov: number;
  camFar: number;
  camNear: number;
  camPos: Vec3;
  background: number;
  controls: "orbit" | "map" | "fly";
};

type UsePanelConfig = {
  placement:
    | "left"
    | "left-top"
    | "top"
    | "right-top"
    | "right"
    | "right-bottom"
    | "bottom"
    | "left-bottom";
  width: number;
  lines: number;
  nokeep?: boolean;
};

let __usePanel__: (cfg: UsePanelConfig) => void;
let __usePanel_write__: (lineno: number, str: string) => void;

let __add_nextframe_fn__: (fn: NextFrameFn, per?: number) => number;
let __remove_nextframe_fn__: (id: number) => void;

const JekyllEnv: "development" | "production";
const __renderers__: THREE.Renderer[] & { active: THREE.Renderer[] };

let __config__: Config;
let __main__: MainFunc;
let __dev__: (clsN?: string) => void;
let __enter_vr__: (event: MouseEvent) => void;
let __onControlsDOMChanged__iter__: (
  evalExp: string,
  k: string,
  val: any,
) => void;
let __updateControlsDOM__: () => void;

let __createAnimation__: <T>(
  target: T,
  to: Partial<Record<keyof T, number>>,
  duration: number,
  overFn?: VoidFunction,
  updateFn?: VoidFunction,
) => CreateAnimationReturns;

interface CreateAnimationReturns {
  stop: () => void;
  start: () => void;
  isPlaying: () => boolean;
}

let __viewport__: {
  width: readonly number;
  height: readonly number;
};

type DefineControl = {
  <T>(
    name: string,
    type: ControlType,
    initialVal: T,
    extras?: Partial<DefCtrlExtras<T>>,
  ): void;
  r01: () => Partial<DefCtrlExtras<T>>;
  rint: (min: number, max: number) => Partial<DefCtrlExtras<T>>;
  rfloat: (min: number, max: number) => Partial<DefCtrlExtras<T>>;
};

let __defineControl__: DefineControl;

let __renderControls__: (data: Record<string, any>) => void;

let __relativeURL__: (path: string) => string;

let __info__: (md: string) => void;
let __contact__: () => void;
let __fail__: () => void;
let __updateCameraControls__: (rotateSpeed: number, zoomSpeed: number) => void;

interface CameraControls {
  panSpeed: number;
  zoomSpeed: number;
}

type UpdateTHREEJs = {
  (k: string, val: any): void;
};

let __updateTHREEJs__: UpdateTHREEJs;
let __updateTHREEJs__after__: () => void;

const __updateTHREEJs__invoke__: Record<string, (val: any) => void>;
const __updateTHREEJs__only__: Record<
  string,
  (val?: any) => Promise<unknown> | boolean | void
>;
const __updateTHREEJs__many__: Record<
  string,
  (k: string, val: any) => Promise<unknown> | boolean | void
>;

type ThreeObjects = {
  ambLight: (c: THREE.ColorRepresentation, intensity: number) => void;
  dirLight: (
    c?: THREE.ColorRepresentation,
    intensity?: number,
    direction?: Vec3,
  ) => { helper: (size: number, color: number) => void };
  ptLight: (
    c?: THREE.ColorRepresentation,
    intensity?: number,
    dist?: number,
    decay?: number,
  ) => {
    helper: (size: number, color: number, dist: number, decay: number) => void;
  };
  cam: (on?: boolean) => THREE.CameraHelper;
  grid: (on?: boolean) => THREE.GridHelper;
  axes: (on?: boolean, size?: number) => THREE.AxesHelper;
  /**
   *  local coordinated system for an object
   * ```
   * x - red: #e10191
   * y - green: #02fe01
   * z - blue: #3491fe
   *```
   */
  crs: (obj3d: THREE.Object3D, size?: number) => void;
  L: (color: THREE.ColorRepresentation, ...ps: Vec3[]) => THREE.Line;
  line: (...ps: Vec3[]) => {
    update: (...pts: Vec3[]) => void;
    update2: (...vs: THREE.Vector3[]) => void;
  };
  track: (
    p: Vec3,
    color: THREE.ColorRepresentation,
  ) => {
    userData: Record<string, any>;
    append: (...pts: Vec3[]) => void;
    position: THREE.Vector3;
  };
  ball: (
    p: Vec3,
    r: number,
    color?: ColorRepresentation,
    wire?: boolean,
  ) => THREE.Mesh;
  box: (p0: Vec3, l: number, w: number, h: number) => THREE.Mesh;
  plane: (c: Vec3, l: number, w: number) => THREE.Mesh;
  vec: (x: number, y: number, z: number) => THREE.Vector3;
  aX: THREE.Vector3;
  aY: THREE.Vector3;
  aZ: THREE.Vector3;
  deg2rad: number;
  rad2deg: number;
};

type Dim = 1 | 2 | 3 | 4;
type Vec2 = [number, number];
type Vec2Like = { x: number; y: number };
type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];
type Vec3Like = { x: number; y: number; z: number };
type LatLng = { lat: number; lng: number };

const __3_objects__: ThreeObjects;
/**
 * @alias `__3_objects__`
 */
const __3__: ThreeObjects;

interface HTMLInputElement {
  $meta4ctrl: Control;
}

interface HTMLSelectElement {
  $meta4ctrl: Control;
}

declare class Stats {
  readonly dom: HTMLDivElement;
  showPanel(mode: 0 | 1 | 2 | 3 | 4): void;
  begin(): void;
  end(): void;
}

namespace markdown {
  class Markdown {}
  const parse: (a: string, b?) => string;
  const renderJsonML: (a, b) => string;
  const toHTML: (a: string, c?, d?) => string;
}

namespace SunCalc {
  type GetPositionRes = {
    /**
     * sun azimuth in radians (direction along the horizon, measured from south to west), e.g. 0 is south and Math.PI * 3/4 is northwest
     */
    azimuth: number;
    /**
     * sun altitude above the horizon in radians, e.g. 0 at the horizon and PI/2 at the zenith (straight over your head)
     */
    altitude: number;
  };

  type GetMoonPositionRes = GetPositionRes & {
    /**
     * distance to moon in kilometers
     */
    distance: number;
    /**
     * parallactic angle of the moon in radians
     */
    parallacticAngle;
  };

  type GetTimesRes = {};

  const getMoonPosition: (
    dt: Date,
    lat: number,
    lon: number,
  ) => GetMoonPositionRes;

  const getTimes: (dt: Date, lat: number, lon: number) => GetTimesRes;
  const getPosition: (dt: Date, lat: number, lon: number) => GetPositionRes;
}

declare class Noise {
  constructor(seed: number): Noise;
  perlin3(x: number, y: number, z: number): any;
  simplex3(x: number, y: number, z: number): any;
}

declare function shp(data: any): Promise<any>;

interface Delaunay {
  triangles;
  halfedges;
  points;
}

declare var d3: {
  Delaunay: {
    from: (pts: [number, number][]) => Delaunay;
  };
};
