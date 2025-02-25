export type vec4 = [number, number, number, number];

export const approximates = (basis: number, approximation: number) => {
  return basis + approximation * (1 - 2 * Math.random());
};

export const range = (min: number, max: number) => {
  return min + Math.random() * (max - min);
};

export const parseColor = (color: string): vec4 => {
  // validates
  if (!/^#[a-z0-9]{6}$/.test(color)) {
    throw new Error(`${color} is not a valid color`);
  }
  const [, r, g, b] = /^#(\w\w)(\w\w)(\w\w)$/.exec(color);
  return [r, g, b, "ff"].map((c, i) => {
    return parseInt(c, 16) / 256;
  }) as vec4;
};

export const debounce = (fn, ms = 300) => {
  let int = -1;
  return (...args) => {
    clearTimeout(int);
    int = setTimeout(fn, ms, ...args);
  };
};

export const isPowerOfTwo = (num: number) => {
  return 0 === ((num - 1) & num);
};

export const randColor = (basis?: vec4): vec4 => {
  if (basis) {
    const r = Math.random();
    const color = basis.map((x) => x * r);
    color[3] = 1;
    return color as vec4;
  }
  const color = Array(4).fill(0).map(Math.random) as vec4;
  color[3] = 1;
  return color;
};
