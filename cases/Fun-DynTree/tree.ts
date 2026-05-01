import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export class DynTree extends THREE.Group {
  public readonly barkGeometry: THREE.BufferGeometry | null;
  public readonly barkMaterial: THREE.MeshStandardMaterial;
  public readonly leafGeometry: THREE.BufferGeometry | null;
  public readonly leafMaterial: THREE.MeshStandardMaterial;

  constructor(options: DynTree.Options = {}) {
    super();
    const segments: DynTree.SegStep[] = [];
    const leafPoints: DynTree.LeafPoint[] = [];

    DynTree.buildSegment(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
      options.trunkLength ?? 5,
      0,
      options,
      segments,
      leafPoints,
    );

    // Build a tapered cylinder for each step and merge into one draw call
    const up = new THREE.Vector3(0, 1, 0);
    const geos: THREE.BufferGeometry[] = [];

    for (const { start, end, rBottom, rTop } of segments) {
      const dir = end.clone().sub(start);
      const len = dir.length();
      if (len < 1e-6) continue;

      const unitDir = dir.clone().normalize();

      // Add a tiny overlap so neighboring steps interpenetrate slightly,
      // which helps hide seams when the trunk jitters between steps.
      const overlap = Math.min(len * 0.25, 0.02);
      const extendedLen = len + overlap * 2;
      const mid = start.clone().addScaledVector(dir, 0.5);
      const extendedMid = mid.clone().addScaledVector(unitDir, overlap * 0.5);

      // openEnded=true removes internal caps at every step joint.
      const geo = new THREE.CylinderGeometry(
        rTop,
        rBottom,
        extendedLen,
        12,
        1,
        true,
      );

      const q = new THREE.Quaternion().setFromUnitVectors(up, unitDir);
      const matrix = new THREE.Matrix4().makeRotationFromQuaternion(q);
      matrix.setPosition(extendedMid);
      geo.applyMatrix4(matrix);

      geos.push(geo);
    }

    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());

    if (merged) {
      merged.computeVertexNormals();
    }

    this.barkGeometry = merged ?? null;
    this.barkMaterial = new THREE.MeshStandardMaterial({
      color: options.color ?? 0x6b3d1e,
      roughness: 0.9,
      metalness: 0.0,
    });

    if (this.barkGeometry) {
      this.add(new THREE.Mesh(this.barkGeometry, this.barkMaterial));
    }

    // ---- Leaf clouds ----
    const minLeafDepth = options.minLeafDepth ?? 2;
    const maxDepth = options.maxDepth ?? 4;
    const leafBaseRadius = options.leafRadius ?? 0.8;
    const lightGreen = new THREE.Color(0xa8d864);
    const darkGreen = new THREE.Color(0x2a5e1e);
    const leafGeos: THREE.BufferGeometry[] = [];

    for (const { position, depth, weight, isTip } of leafPoints) {
      const t = Math.min(
        1,
        (depth - minLeafDepth) / Math.max(1, maxDepth - minLeafDepth),
      );
      const baseColor = new THREE.Color().lerpColors(lightGreen, darkGreen, t);

      // Leaves cluster near branch tips: tips get bigger/denser clouds than mid-branch points.
      const tipBoost = isTip ? 1.0 : 0.28;
      if (!isTip && Math.random() < 0.55) continue;

      const blobRadius =
        leafBaseRadius *
        Math.pow(0.74, depth - minLeafDepth) *
        (0.85 + tipBoost * 0.5);
      const blobCount = Math.max(
        isTip ? 3 : 1,
        Math.round((1.2 + t * 4.5) * weight * (isTip ? 1.35 : 0.45)),
      );

      for (let b = 0; b < blobCount; b++) {
        const spread = blobRadius * (isTip ? 2.2 : 1.1);
        const blobPos = position
          .clone()
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * spread,
              (Math.random() - 0.5) * spread,
              (Math.random() - 0.5) * spread,
            ),
          );
        const radius =
          blobRadius *
          (isTip ? 0.6 + Math.random() * 0.95 : 0.35 + Math.random() * 0.55);
        const geo = DynTree.createLeafBlobGeometry(radius, options);

        // Slight anisotropic scaling prevents overly symmetric cloud blobs.
        const anisotropy = options.leafAnisotropy ?? 0.28;
        const sx = 1 + (Math.random() - 0.5) * anisotropy;
        const sy = 1 + (Math.random() - 0.5) * anisotropy;
        const sz = 1 + (Math.random() - 0.5) * anisotropy;
        geo.scale(sx, sy, sz);

        // Per-blob slight hue/lightness variation encoded as vertex colors
        const blobColor = baseColor
          .clone()
          .offsetHSL(
            0,
            (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.12,
          );
        const vCount = (geo.getAttribute("position") as THREE.BufferAttribute)
          .count;
        const colors = new Float32Array(vCount * 3);
        for (let v = 0; v < vCount; v++) {
          colors[v * 3] = blobColor.r;
          colors[v * 3 + 1] = blobColor.g;
          colors[v * 3 + 2] = blobColor.b;
        }
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geo.translate(blobPos.x, blobPos.y, blobPos.z);
        leafGeos.push(geo);
      }
    }

    const leafMerged = leafGeos.length > 0 ? mergeGeometries(leafGeos) : null;
    leafGeos.forEach((g) => g.dispose());

    if (leafMerged) {
      leafMerged.computeVertexNormals();
    }

    this.leafGeometry = leafMerged ?? null;
    this.leafMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: options.leafOpacity ?? 0.72,
      roughness: 0.9,
      metalness: 0.0,
      depthWrite: false,
    });

    if (this.leafGeometry) {
      this.add(new THREE.Mesh(this.leafGeometry, this.leafMaterial));
    }
  }

  static createLeafBlobGeometry(
    radius: number,
    opts: DynTree.Options,
  ): THREE.BufferGeometry {
    const detail = opts.leafBlobDetail ?? 2;
    const bumpStrength = opts.leafBumpStrength ?? 0.2;
    const bumpFreq = opts.leafBumpFrequency ?? 5.5;
    const g = new THREE.IcosahedronGeometry(radius, detail);

    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      n.copy(p).normalize();

      const n1 = DynTree.hashNoise3(
        n.x * bumpFreq + 7.13,
        n.y * bumpFreq + 17.71,
        n.z * bumpFreq + 29.97,
      );
      const n2 = DynTree.hashNoise3(
        n.x * bumpFreq * 2.1 + 3.41,
        n.y * bumpFreq * 2.1 + 9.29,
        n.z * bumpFreq * 2.1 + 13.37,
      );

      const bump = (n1 * 0.65 + n2 * 0.35) * bumpStrength;
      p.addScaledVector(n, bump * radius);
      pos.setXYZ(i, p.x, p.y, p.z);
    }

    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }

  // Fast deterministic pseudo-noise in [-1, 1] from a 3D position.
  static hashNoise3(x: number, y: number, z: number): number {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const f = s - Math.floor(s);
    return f * 2 - 1;
  }

  /** Recursively build trunk/branch line segments.
   *
   * @param start   World-space start point of this segment
   * @param dir     Unit direction vector of this segment
   * @param length  Length of this segment
   * @param depth   Current recursion depth (0 = trunk)
   * @param opts    DynTree options
   * @param out     Output flat array of [x0,y0,z0, x1,y1,z1, ...] pairs
   */
  static buildSegment(
    start: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    depth: number,
    opts: DynTree.Options,
    out: DynTree.SegStep[],
    leafPoints: DynTree.LeafPoint[],
  ) {
    const maxDepth = opts.maxDepth ?? 4;
    const vibration = opts.vibrationFactor ?? 0.08;
    const lengthDecay = opts.lengthDecay ?? 0.6;
    const branchTilt = opts.branchTiltAngle ?? Math.PI / 4; // ~45°
    const growthForce = opts.growthForce ?? 0.1; // phototropism strength
    const trunkRadius = opts.trunkRadius ?? 0.15;
    const radiusDecay = opts.radiusDecay ?? 0.6;
    const minLeafDepth = opts.minLeafDepth ?? 4;

    // Branch spawn ratios along this segment
    const BRANCH_RATIOS = [0.382, 0.618, 0.9];

    // Split the segment into small sub-steps with jitter for a natural look
    const steps = Math.max(2, Math.round(length * 3));
    const stepLen = length / steps;

    // Radius tapers from this depth's value down to next depth's value
    const rBase = trunkRadius * Math.pow(radiusDecay, depth);
    const rTip = trunkRadius * Math.pow(radiusDecay, depth + 1);

    let current = start.clone();
    const segDir = dir.clone().normalize();

    for (let i = 0; i < steps; i++) {
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * vibration,
        0,
        (Math.random() - 0.5) * vibration,
      );
      const next = current.clone().addScaledVector(segDir, stepLen).add(jitter);

      // Interpolate radius along the segment for smooth taper
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const rBottom = rBase + (rTip - rBase) * t0;
      const rTop = rBase + (rTip - rBase) * t1;

      out.push({ start: current.clone(), end: next.clone(), rBottom, rTop });

      if (depth < maxDepth) {
        const branchLength = length * lengthDecay;

        for (const ratio of BRANCH_RATIOS) {
          if (i === Math.floor(steps * ratio)) {
            // Mid-branch leaf point at deeper levels (sparse)
            if (depth >= minLeafDepth) {
              leafPoints.push({
                position: current.clone(),
                depth,
                weight: 0.1 + Math.random() * 0.15,
                isTip: false,
              });
            }

            // Random azimuth for radial spread around parent axis
            const azimuth = Math.random() * Math.PI * 2;

            // Build a perpendicular vector to segDir for tilt
            const up = new THREE.Vector3(0, 1, 0);
            const perp = new THREE.Vector3()
              .crossVectors(segDir, up)
              .normalize();

            if (perp.lengthSq() < 1e-6) {
              perp.set(1, 0, 0); // fallback when segDir ≈ up
            }

            // Tilt away from parent axis, then rotate around it
            const branchDir = segDir.clone().applyAxisAngle(perp, branchTilt);
            branchDir.applyAxisAngle(segDir.clone().normalize(), azimuth);
            branchDir.normalize();

            // Phototropism: blend toward +Y (sunlight)
            branchDir
              .lerp(up, Math.max(0, growthForce + (Math.random() - 0.5) * 0.1))
              .normalize();

            DynTree.buildSegment(
              current.clone(),
              branchDir,
              branchLength,
              depth + 1,
              opts,
              out,
              leafPoints,
            );
          }
        }
      }

      current = next;
    }

    // Tip of this branch chain — deposit a full-weight leaf cloud if deep enough
    if (depth >= minLeafDepth) {
      leafPoints.push({
        position: current.clone(),
        depth,
        weight: 1.0,
        isTip: true,
      });
    }
  }
}

export namespace DynTree {
  export interface LeafPoint {
    position: THREE.Vector3;
    /** Recursion depth this point was recorded at */
    depth: number;
    /** 0–1 blob density multiplier (1 = full tip, 0.4 = sparse mid-branch) */
    weight: number;
    /** True when this point is a branch tip endpoint */
    isTip: boolean;
  }

  export interface SegStep {
    start: THREE.Vector3;
    end: THREE.Vector3;
    rBottom: number;
    rTop: number;
  }

  export interface Options {
    /** Overall trunk height. Default: 5 */
    trunkLength?: number;
    /** Max recursion depth. Default: 4 */
    maxDepth?: number;
    /** XZ jitter amplitude per step. Default: 0.08 */
    vibrationFactor?: number;
    /** Length multiplier per depth level. Default: 0.65 */
    lengthDecay?: number;
    /** Branch tilt angle from parent axis (radians). Default: π/5 */
    branchTiltAngle?: number;
    /** Phototropism strength: 0 = no upward bias, 1 = fully vertical. Default: 0.4 */
    growthForce?: number;
    /** Base radius of the trunk bottom. Default: 0.15 */
    trunkRadius?: number;
    /** Radius shrink factor per depth level. Default: 0.6 */
    radiusDecay?: number;
    /** Minimum depth at which leaf clouds appear. Default: 2 */
    minLeafDepth?: number;
    /** Base radius of a single leaf cloud blob at minLeafDepth. Default: 0.8 */
    leafRadius?: number;
    /** Organic bump strength on each leaf blob. Default: 0.2 */
    leafBumpStrength?: number;
    /** Bump frequency on each leaf blob. Default: 5.5 */
    leafBumpFrequency?: number;
    /** Icosahedron subdivision detail for leaf blobs. Default: 2 */
    leafBlobDetail?: number;
    /** Random xyz scaling amplitude per blob. Default: 0.28 */
    leafAnisotropy?: number;
    /** Opacity of the leaf cloud material (0–1). Default: 0.72 */
    leafOpacity?: number;
    /** Mesh color. Default: 0x6b3d1e (dark brown) */
    color?: number;
  }
}
