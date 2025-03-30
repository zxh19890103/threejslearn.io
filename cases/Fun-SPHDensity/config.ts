import { vec3 } from "cases/vec3.js";

const N = 300;
const h = 1;
const rhomin = 0.001;
const rho0 = 1;
const down: Vec3 = vec3.normalize([0, -1, 0]);
const m0 = [1, 0.3];
const damping = 0.7;

const variables = {
  /**
   * the larger k is, the higher the pressure will be.
   */
  k: 0.5,
  /**
   * the larger mu is, the higher the viscosity will be.
   */
  mu: 2e-1,
  /**
   * the gravity!
   */
  g: 9.81 * 1e-1,
  /**
   * time step
   */
  dt: 0.016,
};

export { damping, N, h, m0, rhomin, rho0, down, variables };
