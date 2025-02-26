import * as THREE from "three";

export class GridCell {
  readonly pts: THREE.Vector3Tuple[] = [];

  line: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> = null;

  objects: THREE.Object3D[] = [];

  constructor(
    readonly iX: number,
    readonly iY: number,
    readonly x0: number,
    readonly y0: number,
    readonly x1: number,
    readonly y1: number
  ) {
    this.pts = [
      [x0, y0, 0],
      [x0, y1, 0],
      [x1, y1, 0],
      [x1, y0, 0],
    ];
  }

  isInGrid(obj3d: THREE.Object3D) {
    return true;
  }

  unhighlight() {
    if (!this.line) return;
    this.line.material.color.set(0xffffff);
    this.line.material.needsUpdate = true;
  }

  highlight() {
    if (!this.line) return;
    this.line.material.color.set(0xef9100);
    this.line.material.needsUpdate = true;
  }
}

export class Grid extends THREE.Object3D {
  private cells: GridCell[] = [];

  constructor(
    readonly nx: number,
    readonly ny: number,
    readonly sx: number,
    readonly sy: number
  ) {
    super();
    this.build();

    for (const cell of this.cells) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(cell.pts.flat()), 3)
      );
      const line = new THREE.LineLoop(
        geo,
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      this.add(line);
      cell.line = line;
    }
  }

  getCell(x: number, y: number) {
    const rx = x - this.position.x;
    const ry = y - this.position.y;

    const ix = Math.floor(rx / this.sx);
    const iy = Math.floor(ry / this.sy);
    const cell = this.cells[`${ix}.${iy}`] as GridCell;
    return cell ?? null;
  }

  getCells(x: number, y: number): GridCell[] {
    const cell = this.getCell(x, y);
    if (!cell) return [];
    const { iX, iY } = cell;
    return [
      `${iX - 1}.${iY - 1}`,
      `${iX - 1}.${iY}`,
      `${iX - 1}.${iY + 1}`,
      `${iX}.${iY - 1}`,
      `${iX}.${iY}`,
      `${iX}.${iY + 1}`,
      `${iX + 1}.${iY - 1}`,
      `${iX + 1}.${iY}`,
      `${iX + 1}.${iY + 1}`,
    ]
      .map((i) => this.cells[i])
      .filter(Boolean);
  }

  getObjectsAround(x: number, y: number) {
    const cells = this.getCells(x, y);
    return cells.flatMap((x) => x.objects);
  }

  put(obj3d: THREE.Object3D) {
    const cell = this.getCell(obj3d.position.x, obj3d.position.y);
    if (!cell) return;
    cell.objects.push(obj3d);
  }

  center() {
    const lx = this.nx * this.sx;
    const ly = this.ny * this.sy;
    this.position.set(-lx / 2, -ly / 2, 0);
  }

  private build() {
    for (let ix = 0; ix < this.nx; ix++) {
      for (let iy = 0; iy < this.ny; iy++) {
        const cell = new GridCell(
          ix,
          iy,
          ix * this.sx,
          iy * this.sy,
          (ix + 1) * this.sx,
          (iy + 1) * this.sy
        );
        this.cells[`${ix}.${iy}`] = cell;
        this.cells.push(cell);
      }
    }
  }
}
