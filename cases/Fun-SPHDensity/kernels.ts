import { h } from "./config.js";
const { PI, pow } = Math;

const coef1 = 315 / (64 * Math.PI * Math.pow(h, 9));
const coef2 = -45 / (PI * pow(h, 6));
const coef3 = 45 / (PI * pow(h, 6));

export const Poly6Kernel = (r: number, h: number): number => {
  if (r >= h) return 0;
  const term = pow(h * h - r * r, 3);
  return coef1 * term;
};

export const SpikyKernelGradient = (r: number, h: number): number => {
  if (r >= h || r === 0) return 0;
  const term = pow(h - r, 2);
  return coef2 * term;
};

export const W_viscosity = (r: number, h: number) => {
  if (r >= h) return 0;
  return coef3 * (1 - r / h);
};
