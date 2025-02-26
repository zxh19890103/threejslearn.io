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

/**
 *
 * @param t unit: s
 */
export const tformat = (t: number) => {
  let seconds = t;

  const years = Math.floor(seconds / (365.25 * 24 * 3600));
  seconds %= 365.25 * 24 * 3600; // 剩余秒数

  const months = Math.floor(seconds / (30.44 * 24 * 3600));
  seconds %= 30.44 * 24 * 3600; // 剩余秒数

  const days = Math.floor(seconds / (24 * 3600));
  seconds %= 24 * 3600; // 剩余秒数

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600; // 剩余秒数

  const minutes = Math.floor(seconds / 60);
  seconds %= 60; // 剩余秒数

  let result = "";
  if (years > 0) result += years + " yrs ";
  if (months > 0) result += months + " months ";
  if (days > 0) result += days + " days ";
  if (hours > 0) result += hours + " hrs ";
  if (minutes > 0) result += minutes + " mins ";
  if (seconds >= 1) result += Math.floor(seconds) + " secs";

  return result.trim();
};

console.log(tformat(24 * 3600 + 0.5));
