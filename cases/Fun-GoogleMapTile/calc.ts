import * as THREE from "three";
import { ZoomLevel_MetersPerPixels_Mapping } from "./table.js";

const { floor, pow, sin, cos, tan, PI, log, atan, atan2, exp, asin } = Math;
const { clamp } = THREE.MathUtils;

export const earthConfig = {
  /**
   * the unit of ...(m)
   */
  AU: 149597870.7 * 1e3,
  /**
   * the radius of moon! (m)
   */
  R_of_moon: 1737.4 * 1e3,
  /**
   * average
   */
  R: 6.371 * 1e6, // m
  /**
   * on equator
   */
  R2: 6.378137 * 1e6,
  /**
   * on polar
   */
  R3: 6.356752 * 1e6,
};

/**
 *
 * z = zoom.
 *
 * total: 2 ^ z tiles
 *
 * x: -180 to + 180 => 0 - 2^z - 1
 * y: 85 to -85 => 0 -  2^z - 1
 */
export function latLngToTileXY(lat: number, lng: number, zoom: number) {
  const latRad = (lat * PI) / 180;
  const lng_ = ((lng + 180) % 360) / 360;
  const n = pow(2, zoom);

  const x = floor(lng_ * n);
  const y = floor(((1 - log(tan(latRad) + 1 / cos(latRad)) / PI) / 2) * n);
  return { x, y };
}

/**
 * the top-left corner.
 */
export function tileXYToLatLng(x: number, y: number, zoom: number) {
  let lng = (x / pow(2, zoom)) * 360 - 180;
  let n = PI - (2 * PI * y) / pow(2, zoom);
  let lat = (180 / PI) * atan(0.5 * (exp(n) - exp(-n)));
  return { lat, lng };
}

/**
 *
 * @param camera
 * @param R the radius of earth.
 * @returns
 */
export const getZoomLevel = (
  camera: THREE.PerspectiveCamera,
  R: number,
  max = 22,
  fix = -1
) => {
  return getZoomLevel_internal(camera.position, camera.fov, R, max, fix);
};

const getZoomLevel_internal = (
  pos: THREE.Vector3,
  fov: number,
  R: number,
  max: number,
  fix: number
) => {
  const dist = pos.length() - R;
  const distPerPixel = getPixelWorldSize(fov, dist);

  for (const item of ZoomLevel_MetersPerPixels_Mapping) {
    if (distPerPixel >= item[1]) {
      return clamp(item[0] + fix, 0, max);
    }
  }

  return max;
};

export const getCameraDistanceForZoom = (
  fov: number,
  R: number,
  zoom: number
) => {
  const viewportHeight = __viewport__.height; // or a specific render target height
  const fovRad = fov * deg2rad; // Convert FOV to radians

  const metersPerPixel = ZoomLevel_MetersPerPixels_Mapping.find(
    (item) => item[0] === zoom
  )?.[1];

  if (!metersPerPixel) return null; // Handle invalid zoom levels

  const distance = (metersPerPixel * viewportHeight) / (2 * tan(fovRad / 2));

  return Math.max(distance * 0.9 + R, 0);
};

function getPixelWorldSize(fov: number, distance: number) {
  const fovRad = fov * deg2rad; // Convert FOV to radians
  // Compute the height of the view at the given distance
  const viewHeight = 2 * distance * tan(fovRad / 2);
  // Compute the world size of one pixel
  return viewHeight / __viewport__.height;
}

export const deg2rad = PI / 180;
export const rad2deg = 180 / PI;

export function latLngToSphere(lat: number, lng: number, R?: number): Vec3Like {
  const latRad = lat * deg2rad;
  const lngRad = lng * deg2rad;

  const realR = R ? R : earthConfig.R;

  const r = realR * cos(latRad);

  const z = r * cos(lngRad);
  const x = r * sin(lngRad);
  const y = realR * sin(latRad);

  return {
    x,
    y,
    z,
  };
}

const getRadiusOnLat = (lat: number) => {
  const dR = earthConfig.R2 - earthConfig.R3;
  return earthConfig.R2 - dR * Math.pow(sin(lat * deg2rad), 2);
};

export function sphereToLatlng(coords: Vec3Like, R: number): LatLng {
  const { x, y, z } = coords;
  const lat = clamp(asin(y / R) * rad2deg, -85, 85);
  const lng = atan2(x, z) * rad2deg;
  return { lat, lng };
}

export const sunCurrentPosition = (lat: number, lng: number, dt: Date) => {
  const { altitude, azimuth } = SunCalc.getPosition(dt ?? new Date(), lat, lng);
  const r = cos(altitude);
  const xyz = [r * cos(azimuth), r * sin(azimuth), -sin(altitude)] as Vec3;
  return xyz;
};

export const moonCurrentPosition = (lat: number, lng: number, dt: Date) => {
  const { altitude, azimuth, distance } = SunCalc.getMoonPosition(
    dt ?? new Date(),
    lat,
    lng
  );
  const r = cos(altitude);
  const xyz = [r * cos(azimuth), r * sin(azimuth), -sin(altitude)] as Vec3;
  return {
    xyz,
    dist: distance * 1e3,
  };
};

export { clamp };
