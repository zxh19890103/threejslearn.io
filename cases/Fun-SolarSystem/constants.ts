export const RAD_PER_DEGREE = Math.PI / 180;
export const CIRCLE_RAD = Math.PI * 2;
export const AU = 149597.8707;
export const SECONDS_IN_A_DAY = 24 * 60 * 60;

export const CAMERA_POSITION_Y = 2 * AU;
export const G = 6.67 * 0.00001; // be sure the velocity's unit is km/s
export const ROTATION_SCALE = 0.001;

export let BUFFER_SIZE = 10;
/**
 * the smaller the moment is, the more presice the compution is.
 */
export let MOMENT = 100; // s

/**
 * seconds
 */
export let BUFFER_MOMENT = BUFFER_SIZE * MOMENT; // s
export const SECONDS_IN_HOUR = 60 * 60;
export const ZERO_ACC = [0, 0, 0];

export const setConst = (name: "BUFFER_SIZE" | "MOMENT", val: number) => {
  if (name === "BUFFER_SIZE") BUFFER_SIZE = val;
  else if (name === "MOMENT") MOMENT = val;

  BUFFER_MOMENT = BUFFER_SIZE * MOMENT; // s
};
