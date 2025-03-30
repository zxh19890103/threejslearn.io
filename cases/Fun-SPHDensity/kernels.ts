const { PI, pow } = Math;

let alpha = 0;

export const computeAlpha = (h: number) => 1 / (120 * PI * pow(h, 3));

export const QuinticSplineKernel = (r: number, h: number): number => {
  const q = r / h;

  const alpha = 1 / (120 * PI * pow(h, 3));

  if (q >= 3) {
    return 0;
  } else if (q >= 2) {
    return alpha * pow(3 - q, 5);
  } else if (q >= 1) {
    return alpha * (pow(3 - q, 5) - 6 * pow(2 - q, 5));
  } else {
    return alpha * (pow(3 - q, 5) - 6 * pow(2 - q, 5) + 15 * pow(1 - q, 5));
  }
};

/**
 * the direction is `i to j`
 */
export const QuinticSplineKernelGradient = (r: number, h: number) => {
  const q = r / h;

  const alpha = 1 / (120 * PI * pow(h, 4));

  if (q >= 3) {
    return 0;
  } else if (q >= 2) {
    return alpha * (-5 * pow(3 - q, 4));
  } else if (q >= 1) {
    return alpha * (-5 * pow(3 - q, 4) + 30 * pow(2 - q, 4));
  } else {
    return (
      alpha * (-5 * pow(3 - q, 4) + 30 * pow(2 - q, 4) - 75 * pow(1 - q, 4))
    );
  }
};

export const QuinticSplineLaplacian3D = (r: number, h: number): number => {
  if (r >= 3 * h) return 0; // Kernel has compact support

  const q = r / h;
  const sigma = 1 / (120 * Math.PI * h ** 5); // Normalization constant for 3D

  // Compute Laplacian of the Quintic Spline Kernel for 3D
  let laplacian: number;
  if (q < 1) {
    laplacian =
      sigma * (60 * (3 - q) ** 3 - 240 * (2 - q) ** 3 + 450 * (1 - q) ** 3);
  } else if (q < 2) {
    laplacian = sigma * (60 * (3 - q) ** 3 - 240 * (2 - q) ** 3);
  } else if (q < 3) {
    laplacian = sigma * (60 * (3 - q) ** 3);
  } else {
    laplacian = 0;
  }

  return laplacian;
};

export const Poly6Kernel = (r: number, h: number): number => {
  if (r >= h) return 0;
  let coefficient = 315 / (64 * Math.PI * Math.pow(h, 9));
  let term = Math.pow(h * h - r * r, 3);
  return coefficient * term;
};

export const SpikyKernelGradient = (r: number, h: number): number => {
  if (r >= h || r === 0) return 0;
  let coefficient = -45 / (Math.PI * Math.pow(h, 6));
  let term = Math.pow(h - r, 2);
  return coefficient * term;
};

export const W_viscosity = (r: number, h: number) => {
  if (r >= h) return 0;
  const coef = 45 / (PI * pow(h, 6));
  return coef * (1 - r / h);
};