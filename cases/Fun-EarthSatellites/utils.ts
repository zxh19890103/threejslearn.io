import { Vector3 } from "three";

export function angleBetweenVectors(A: Vec3, B: Vec3, normal: Vector3): number {
  const dotProduct = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
  const magA = Math.sqrt(A[0] ** 2 + A[1] ** 2 + A[2] ** 2);
  const magB = Math.sqrt(B[0] ** 2 + B[1] ** 2 + B[2] ** 2);
  let cosTheta = dotProduct / (magA * magB);
  cosTheta = Math.max(-1, Math.min(1, cosTheta));
  let angleRad = Math.acos(cosTheta);
  const crossProduct: Vec3 = [
    A[1] * B[2] - A[2] * B[1],
    A[2] * B[0] - A[0] * B[2],
    A[0] * B[1] - A[1] * B[0],
  ];
  const crossDotNormal =
    crossProduct[0] * normal.x +
    crossProduct[1] * normal.y +
    crossProduct[2] * normal.z;
  let angleDeg = angleRad * (180 / Math.PI);
  if (crossDotNormal < 0) angleDeg = 360 - angleDeg;
  return angleDeg;
}

/**
 * ```
 * X =-1.699384780933159E+05 Y =-3.448397182960832E+05 Z =-8.704353091844852E+03
 * VX= 5.909382360925806E-01 VY=-7.093990580913949E-01 VZ= 1.885182644823649E-01
 * ```
 * @param dataString
 * @returns
 */
export function parseJPLHorizonData(dataString: string): { P: Vec3; V: Vec3 } {
  // Split the input string into individual values
  const values = dataString.split(/\n*\s*[A-Z]{1,2}\s*=\s*/);

  // Extract position (X, Y, Z) and velocity (VX, VY, VZ)
  const X = parseFloat(values[1]);
  const Y = parseFloat(values[2]);
  const Z = parseFloat(values[3]);

  const VX = parseFloat(values[4]);
  const VY = parseFloat(values[5]);
  const VZ = parseFloat(values[6]);

  // Apply the scale (0.001) to the position values

  return {
    P: [Z * 1e-3, X * 1e-3, Y * 1e-3],
    V: [VZ * 1e-3, VX * 1e-3, VY * 1e-3],
  };
}
