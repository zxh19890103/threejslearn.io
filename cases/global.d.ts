type ControlType =
  | "number"
  | "range"
  | "enum"
  | "color"
  | "string"
  | "bit"
  | "btn";
type ControlValueType = "number" | "string" | "bit";

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
  renderer: THREE.WebGLRenderer
) => void;

let __add_nextframe_fn__: (fn: NextFrameFn) => void;
const JekyllEnv: "development" | "production";

let __main__: NextFrameFn;
let __dev__: () => void;
let __onControlsDOMChanged__: (data: Record<string, any>) => void;
let __onControlsDOMChanged__iter__: (
  evalExp: string,
  k: string,
  val: any
) => void;
let __updateControlsDOM__: () => void;

let __defineControl__: <T>(
  name: string,
  type: ControlType,
  initialVal: T,
  extras?: Partial<DefCtrlExtras<T>>
) => void;

let __renderControls__: (data: Record<string, any>) => void;

type UpdateTHREEJs = {
  (k: string, val: any): void;
};

let __updateTHREEJs__: UpdateTHREEJs;
let __updateTHREEJs__after__: () => void;
const __updateTHREEJs__invoke__: Record<string, (val: any) => void>;
const __updateTHREEJs__only__: Record<string, (val: any) => void>;

type ThreeObjects = {
  ambLight: (c: THREE.ColorRepresentation, intensity: number) => void;
  dirLight: (
    c: THREE.ColorRepresentation,
    intensity: number
  ) => { helper: (size: number, color: number) => void };
  ptLight: (
    c?: THREE.ColorRepresentation,
    intensity?: number
  ) => {
    helper: (size: number, color: number, dist: number, decay: number) => void;
  };
  cam: () => THREE.CameraHelper;
  grid: () => THREE.GridHelper;
  grid3d: (size: number, divisions: number) => void;
  axes: () => THREE.AxesHelper;
  line: (...ps: Vec3[]) => THREE.Line;
  ball: (p: Vec3, r: number) => THREE.Mesh;
  box: (p0: Vec3, l: number, w: number, h: number) => THREE.Mesh;
  plane: (c: Vec3, l: number, w: number) => THREE.Mesh;
  vec: (x: number, y: number, z: number) => THREE.Vector3;
  deg2rad: number;
  rad2deg: number;
};

const __3_objects__: ThreeObjects;
/**
 * @alias `__3_objects__`
 */
const __3__: ThreeObjects;

interface HTMLElement {
  $meta4ctrl: Control;
}
