import { vec3 } from "cases/vec3.js";

/**
 * n = 300, h <= 1.4
 * n = 400, h <= 1.4
 * n = 500, h <= 1.2
 * n = 600, h <= 1.1
 * n = 900, h <= 1.1
 * n = 1000, h <= 1
 */
const N = 900;
const h = 1.2;
const rhomin = 1e-2;
const rmin = 0;
const rho0 = 1;
const down: Vec3 = vec3.normalize([0, -1, 0]);
const m0 = [1, 0.3];
const ballradius = 0.25 * h;
const damping = 0.1;

export const computeProperBoxSize = () => {
  return Math.ceil(Math.pow((N * 1000) / 500, 1 / 3));
};

const variables = {
  /**
   * the larger k is, the higher the pressure will be.
   */
  k: 1,
  /**
   * the larger mu is, the higher the viscosity will be.
   */
  mu: 1,
  /**
   * the gravity!
   */
  g: 9.81,
  /**
   * time step
   */
  dt: 0.016,
};

export { rmin, ballradius, damping, N, h, m0, rhomin, rho0, down, variables };
