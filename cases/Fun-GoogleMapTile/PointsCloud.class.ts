import * as THREE from "three";

export class PointsCloud extends THREE.Points {
  constructor(world: THREE.Scene) {
    super(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        transparent: true,
        sizeAttenuation: false,
        size: 8,
        vertexColors: true,
        color: 0xff8109,
      })
    );

    world.add(this);
  }

  private indexCursor = -1;
  private pts: number[] = [];
  private colors: number[] = [];

  rmPt(index: number) {
    this.colors[index * 4 + 3] = 0;
    this.updateGeo();
  }

  setPt(index: number, pt: Vec3Like, color: number) {
    if (index <= this.indexCursor) {
      this._setPt(index, pt, color);
    } else {
      this.addPt(pt, color);
    }
  }

  private _setPt(index: number, pt: Vec3Like, color: number) {
    const ibase = index * 3;
    const ibase2 = index * 4;

    this.pts[ibase] = pt.x;
    this.pts[ibase + 1] = pt.y;
    this.pts[ibase + 2] = pt.z;

    __color__.set(color);

    this.colors[ibase2] = __color__.r;
    this.colors[ibase2 + 1] = __color__.g;
    this.colors[ibase2 + 2] = __color__.b;
    this.colors[ibase2 + 3] = 1;

    this.updateGeo();
  }

  addPt(pt: Vec3Like, color: number) {
    this.indexCursor += 1;

    this.pts.push(pt.x, pt.y, pt.z);
    __color__.setHex(color);
    this.colors.push(__color__.r, __color__.g, __color__.b, 1);

    this.updateGeo();
  }

  updateGeo() {
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.pts, 3)
    );

    this.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(this.colors, 4)
    );
  }

  twink(index: number) {
    const perS = 0.1;
    // const deltaA = 1 / perS;
    let a = 0;
    const attributes = this.geometry.attributes;

    const anf = __add_nextframe_fn__(() => {
      if (this.indexCursor < index) return;

      attributes.color.setW(index, 0.4 + 0.6 * Math.cos(a));
      attributes.color.needsUpdate = true;

      a += 0.1;
    });
  }
}

const __color__ = new THREE.Color();
