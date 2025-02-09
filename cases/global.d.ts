type ControlType = "number" | "enum" | "color" | "string" | "bit";

type ControlOption<T> = { label: string; value: T };

interface Control<T = any> {
  $el?: HTMLDivElement;
  value?: T;
  options?: ControlOption<T>;
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
let __defineControl__: (
  name: string,
  type: ControlType,
  initialVal?: any
) => void;
let __renderControls__: (data: Record<string, any>) => void;
let __updateTHREEJs__: (k: string, val: any) => void;

const __3_objects__: {
  cam: () => THREE.CameraHelper;
  grid: () => THREE.GridHelper;
  axes: () => THREE.AxesHelper;
  line: (...ps: Vec3[]) => THREE.Line;
  ball: (p: Vec3, r: number) => THREE.Mesh;
  box: (p0: Vec3, l: number, w: number, h: number) => THREE.Mesh;
  plane: (c: Vec3, l: number, w: number) => THREE.Mesh;
};
