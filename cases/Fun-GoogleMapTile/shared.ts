import * as THREE from "three";

export const minimalTileSize = 256;

export const __reusable_vec3__ = new THREE.Vector3();
export const __resuable_vec3_1__ = new THREE.Vector3();
export const __resuable_q4__ = new THREE.Quaternion();
export const __resuable_q4_1__ = new THREE.Quaternion();

export type TilesGrid = {
  /** center */
  xy: { x: number; y: number };
  nx: number;
  ny: number;
};

export type GoogleLyrs = "m" | "s" | "t" | "y" | "h" | "p";

export const lyrsColors: Record<GoogleLyrs, number> = {
  m: 0xabeaf4,
  s: 0x96a7cd,
  t: 0x000000,
  y: 0x96a7cd,
  h: 0x000000,
  p: 0xabeaf4,
};

export const scaleBarMeters = [
  10,
  20,
  50,
  100,
  500,
  1 * 1e3,
  2 * 1e3,
  5 * 1e3,
  10 * 1e3,
  20 * 1e3,
  50 * 1e3,
  100 * 1e3,
  200 * 1e3,
  500 * 1e3,
  1000 * 1e3,
  2000 * 1e3,
  5000 * 1e3,
];

export type GoogleTileScale = 1 | 2 | 4;
