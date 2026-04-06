/**
 * Celestial body constants and physics calculations.
 * Radii are in kilometers, Mass in kilograms.
 */

interface CelestialBody {
  readonly name: string;
  readonly meanRadiusKm: number;
  readonly massKg: number;
  readonly surfaceGravityMs2: number;
}

const EARTH: CelestialBody = {
  name: "Earth",
  meanRadiusKm: 6371,
  massKg: 5.972e24,
  surfaceGravityMs2: 9.807,
};

const MOON: CelestialBody = {
  name: "Moon",
  meanRadiusKm: 1737,
  massKg: 7.346e22,
  surfaceGravityMs2: 1.622,
};

const EARTH_MOON_DISTANCE = {
  perigeeKm: 363300,
  apogeeKm: 405500,
  averageKm: 384400,
};

// Gravitational Constant (m^3 kg^-1 s^-2)
const G = 6.6743e-11;

/**
 * Calculates the gravitational force between two bodies.
 * @param m1 Mass of first body (kg)
 * @param m2 Mass of second body (kg)
 * @param r Distance between centers (km)
 * @returns Force in Newtons (N)
 */
const calculateGravityForce = (m1: number, m2: number, rKm: number): number => {
  const rMeters = rKm * 1000;
  return (G * m1 * m2) / Math.pow(rMeters, 2);
};

export const spaceInformation = {
  EARTH,
  MOON,
  calculateGravityForce,
  EARTH_MOON_DISTANCE,
  G,
};
