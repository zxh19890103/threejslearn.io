import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export class DynVegetation extends THREE.Group {
  public readonly instanced: THREE.InstancedMesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  >;

  constructor(options: DynVegetation.Options = {}) {
    super();

    const polygon = options.polygon ?? [
      [-18, -14],
      [14, -18],
      [22, 4],
      [16, 20],
      [-12, 18],
      [-24, 2],
    ];

    const density = options.density ?? 0.22;
    const y = options.y ?? 0;
    const minScale = options.minScale ?? 1.1;
    const maxScale = options.maxScale ?? 2.8;
    const minDistance = options.minDistance ?? 0.6;

    const area = DynVegetation.polygonArea(polygon);
    const targetCount = Math.max(1, Math.floor(area * density));
    const maxCount = options.maxCount ?? 18000;
    const count = Math.min(targetCount, maxCount);

    const points = DynVegetation.samplePointsInPolygon(
      polygon,
      count,
      minDistance,
      options.seed ?? 12345,
    );

    const geometry = DynVegetation.createCrossCardsGeometry(
      options.cardWidth ?? 1.2,
      options.cardHeight ?? 2.8,
      options.cardCount ?? 3,
    );

    const map = DynVegetation.createCanopyTexture(
      options.textureSize ?? 64,
      options.seed ?? 12345,
    );

    const material = new THREE.MeshBasicMaterial({
      map,
      color: new THREE.Color(options.materialColor ?? 0xffffff),
      transparent: true,
      opacity: 0.55,
      alphaTest: options.alphaTest ?? 0.35,
      depthWrite: false,
      vertexColors: false,
      side: THREE.DoubleSide,
      fog: true,
      toneMapped: false,
    });

    const outlineColor = new THREE.Color(options.outlineColor ?? 0x1d3a18);
    const outlineStrength = options.outlineStrength ?? 0.6;
    const outlineInner = options.outlineInner ?? 0.56;
    const outlineOuter = options.outlineOuter ?? 0.94;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uOutlineColor = { value: outlineColor };
      shader.uniforms.uOutlineStrength = { value: outlineStrength };
      shader.uniforms.uOutlineInner = { value: outlineInner };
      shader.uniforms.uOutlineOuter = { value: outlineOuter };

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          `
uniform vec3 uOutlineColor;
uniform float uOutlineStrength;
uniform float uOutlineInner;
uniform float uOutlineOuter;
uniform sampler2D densityMap;

void main() {
`,
        )
        .replace(
          "#include <map_fragment>",
          `
#include <map_fragment>

float alphaN = clamp(diffuseColor.a / max(0.0001, opacity), 0.0, 1.0);
vec2 uvC = vMapUv - 0.5;
float uvRadius = clamp(length(uvC) * 2.0, 0.0, 1.0);

// Alpha-based edge can be too thin after alphaTest, so combine with UV rim.
float alphaEdge = 1.0 - smoothstep(uOutlineInner, uOutlineOuter, alphaN);
float uvEdge = smoothstep(0.58, 0.95, uvRadius);
float bodyMask = smoothstep(0.05, 0.35, alphaN);
float edgeMask = max(alphaEdge, uvEdge * bodyMask);

diffuseColor.rgb = mix(diffuseColor.rgb, uOutlineColor, edgeMask * uOutlineStrength);

`,
        );
    };

    this.instanced = new THREE.InstancedMesh(geometry, material, points.length);
    this.instanced.frustumCulled = false;

    // Base HSL: mid-green hue (~120°), moderate saturation
    const baseH = options.baseHue ?? 120 / 360;
    const baseS = options.baseSaturation ?? 0.52;
    const baseL = options.baseLightness ?? 0.36;
    const hueRange = options.hueRange ?? 0.055; // ±~20° of hue spread
    const satRange = options.satRange ?? 0.18; // ±saturation spread
    const lightRange = options.lightRange ?? 0.18; // ±lightness spread

    const tmpObj = new THREE.Object3D();
    const tmpColor = new THREE.Color();

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const r = DynVegetation.hash01(options.seed ?? 12345, i + 37);
      const s = minScale + (maxScale - minScale) * r;

      tmpObj.position.set(p.x, y, p.y);
      tmpObj.rotation.set(
        0,
        DynVegetation.hash01(options.seed ?? 12345, i + 199) * Math.PI * 2,
        0,
      );
      tmpObj.scale.setScalar(s);
      tmpObj.updateMatrix();
      this.instanced.setMatrixAt(i, tmpObj.matrix);

      const dh =
        (DynVegetation.hash01(options.seed ?? 12345, i + 101) - 0.5) *
        2 *
        hueRange;
      const ds =
        (DynVegetation.hash01(options.seed ?? 12345, i + 203) - 0.5) *
        2 *
        satRange;
      const dl =
        (DynVegetation.hash01(options.seed ?? 12345, i + 509) - 0.5) *
        2 *
        lightRange;
      tmpColor.setHSL(
        (((baseH + dh) % 1) + 1) % 1,
        Math.max(0, Math.min(1, baseS + ds)),
        Math.max(0.1, Math.min(0.9, baseL + dl)),
      );
      this.instanced.setColorAt(i, tmpColor);
    }

    this.instanced.instanceMatrix.needsUpdate = true;

    if (this.instanced.instanceColor) {
      this.instanced.instanceColor.needsUpdate = true;
    }

    this.add(this.instanced);
  }

  static createCrossCardsGeometry(
    width: number,
    height: number,
    cardCount: number,
  ): THREE.BufferGeometry {
    const n = Math.max(2, Math.floor(cardCount));
    const geos: THREE.BufferGeometry[] = [];

    for (let i = 0; i < n; i++) {
      const g = new THREE.PlaneGeometry(width, height, 1, 1);
      g.translate(0, height * 0.5, 0);
      g.rotateY((i / n) * Math.PI);
      geos.push(g);
    }

    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    return merged ?? new THREE.PlaneGeometry(width, height);
  }

  static createCanopyTexture(size: number, seed: number): THREE.DataTexture {
    const s = Math.max(16, Math.floor(size));
    const data = new Uint8Array(s * s * 4);
    const c = (s - 1) * 0.5;
    const inv = 1 / c;

    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const nx = (x - c) * inv;
        const ny = (y - c) * inv;
        const r = Math.sqrt(nx * nx + ny * ny);
        const n = DynVegetation.hash01(seed + x * 17, y * 31 + 11);
        const wobble = 0.08 * (n - 0.5);
        const edge = 1 - THREE.MathUtils.smoothstep(r + wobble, 0.62, 0.96);
        const alpha = Math.round(255 * Math.max(0, Math.min(1, edge)));
        const idx = (y * s + x) * 4;

        // Neutral light grey so instance color multiplies cleanly
        const tone =
          0.82 + 0.18 * DynVegetation.hash01(seed + x * 13, y * 19 + 7);
        const v = Math.round(220 * tone);
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = alpha;
      }
    }

    const tex = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  static polygonArea(poly: THREE.Vector2Tuple[]): number {
    if (poly.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum) * 0.5;
  }

  static pointInPolygon(
    x: number,
    z: number,
    poly: THREE.Vector2Tuple[],
  ): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0];
      const zi = poly[i][1];
      const xj = poly[j][0];
      const zj = poly[j][1];
      const intersects =
        zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  static samplePointsInPolygon(
    poly: THREE.Vector2Tuple[],
    targetCount: number,
    minDistance: number,
    seed: number,
  ): THREE.Vector2[] {
    if (poly.length < 3 || targetCount <= 0) return [];

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const [x, z] of poly) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    const cell = Math.max(1e-4, minDistance);
    const invCell = 1 / cell;
    const grid = new Map<string, THREE.Vector2[]>();
    const out: THREE.Vector2[] = [];
    const maxAttempts = Math.max(targetCount * 30, 500);

    for (
      let attempt = 0;
      attempt < maxAttempts && out.length < targetCount;
      attempt++
    ) {
      const rx = DynVegetation.hash01(seed, attempt * 2 + 1);
      const rz = DynVegetation.hash01(seed, attempt * 2 + 2);
      const x = minX + (maxX - minX) * rx;
      const z = minZ + (maxZ - minZ) * rz;
      if (!DynVegetation.pointInPolygon(x, z, poly)) continue;

      const gx = Math.floor(x * invCell);
      const gz = Math.floor(z * invCell);

      let ok = true;
      for (let dz = -1; dz <= 1 && ok; dz++) {
        for (let dx = -1; dx <= 1 && ok; dx++) {
          const key = `${gx + dx},${gz + dz}`;
          const bucket = grid.get(key);
          if (!bucket) continue;
          for (const q of bucket) {
            if (
              q.distanceToSquared(new THREE.Vector2(x, z)) <
              minDistance * minDistance
            ) {
              ok = false;
              break;
            }
          }
        }
      }
      if (!ok) continue;

      const p = new THREE.Vector2(x, z);
      out.push(p);
      const key = `${gx},${gz}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(p);
      else grid.set(key, [p]);
    }

    return out;
  }

  static hash01(seed: number, i: number): number {
    const s = Math.sin((seed + i * 1013.13) * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }
}

export namespace DynVegetation {
  export interface Options {
    polygon?: THREE.Vector2Tuple[]; // 2D polygon in XZ plane
    density?: number; // number of vegetation instances per unit area
    seed?: number;
    y?: number;
    minDistance?: number;
    maxCount?: number;
    minScale?: number;
    maxScale?: number;
    cardWidth?: number;
    cardHeight?: number;
    cardCount?: number;
    textureSize?: number;
    alphaTest?: number;
    materialColor?: number;
    color?: number;
    baseHue?: number;
    baseSaturation?: number;
    baseLightness?: number;
    hueRange?: number;
    satRange?: number;
    lightRange?: number;
    outlineColor?: number;
    outlineStrength?: number;
    outlineInner?: number;
    outlineOuter?: number;
  }
}
