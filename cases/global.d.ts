type ControlType =
  | "number"
  | "range"
  | "enum"
  | "color"
  | "string"
  | "bit"
  | "btn";
type ControlValueType = "number" | "int" | "string" | "bit";

type ControlOption<T> = { label: string; value: T };
type DefCtrlExtras<T> = Omit<
  Control,
  "value" | "$el" | "type" | "name" | "value"
>;

interface Control<T extends ControlValueType = any> {
  $el?: HTMLDivElement;
  value?: T;
  valueType?: ControlValueType;
  options?: ControlOption<T>[];
  min?: number;
  max?: number;
  help?: string;
  type: ControlType;
  label: string;
  name: string;
}

interface ControlDefineProps {
  type: ControlType;
  label: string;
}

type NextFrameFn = (
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  delta: number
) => void;

type MainFunc = (
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer
) => void;

type Config = {
  camFv: number;
  camFar: number;
  camPos: Vec3;
};

let __add_nextframe_fn__: (fn: NextFrameFn) => void;
const JekyllEnv: "development" | "production";

let __config__: Config;
let __main__: MainFunc;
let __dev__: () => void;
let __onControlsDOMChanged__iter__: (
  evalExp: string,
  k: string,
  val: any
) => void;
let __updateControlsDOM__: () => void;

type DefineControl = {
  <T>(
    name: string,
    type: ControlType,
    initialVal: T,
    extras?: Partial<DefCtrlExtras<T>>
  ): void;
  r01: () => Partial<DefCtrlExtras<T>>;
  rint: (min: number, max: number) => Partial<DefCtrlExtras<T>>;
  rfloat: (min: number, max: number) => Partial<DefCtrlExtras<T>>;
};

let __defineControl__: DefineControl;

let __renderControls__: (data: Record<string, any>) => void;

type UpdateTHREEJs = {
  (k: string, val: any): void;
};

let __updateTHREEJs__: UpdateTHREEJs;
let __updateTHREEJs__after__: () => void;
const __updateTHREEJs__invoke__: Record<string, (val: any) => void>;
const __updateTHREEJs__only__: Record<
  string,
  (val: any) => Promise<unknown> | boolean | void
>;

type ThreeObjects = {
  ambLight: (c: THREE.ColorRepresentation, intensity: number) => void;
  dirLight: (
    c?: THREE.ColorRepresentation,
    intensity?: number,
    direction?: THREE.Vector3
  ) => { helper: (size: number, color: number) => void };
  ptLight: (
    c?: THREE.ColorRepresentation,
    intensity?: number,
    dist?: number,
    decay?: number
  ) => {
    helper: (size: number, color: number, dist: number, decay: number) => void;
  };
  cam: (on?: boolean) => THREE.CameraHelper;
  grid: (on?: boolean) => THREE.GridHelper;
  grid3d: (size: number, divisions: number) => void;
  axes: (on?: boolean) => THREE.AxesHelper;
  /** local coordinated system for an object */
  crs: (obj3d: THREE.Object3D, size?: number) => void;
  l: (color: THREE.ColorRepresentation, ...ps: Vec3[]) => THREE.Line;
  line: (...ps: Vec3[]) => {
    update: (...pts: Vec3[]) => void;
    update2: (...vs: THREE.Vector3[]) => void;
  };
  track: (
    p: Vec3,
    color: THREE.ColorRepresentation
  ) => {
    userData: Record<string, any>;
    append: (...pts: Vec3[]) => void;
    position: THREE.Vector3;
  };
  ball: (
    p: Vec3,
    r: number,
    color?: ColorRepresentation,
    wire?: boolean
  ) => THREE.Mesh;
  box: (p0: Vec3, l: number, w: number, h: number) => THREE.Mesh;
  plane: (c: Vec3, l: number, w: number) => THREE.Mesh;
  vec: (x: number, y: number, z: number) => THREE.Vector3;
  deg2rad: number;
  rad2deg: number;
};

type Vec3 = [number, number, number];

const __3_objects__: ThreeObjects;
/**
 * @alias `__3_objects__`
 */
const __3__: ThreeObjects;

interface HTMLElement {
  $meta4ctrl: Control;
}
