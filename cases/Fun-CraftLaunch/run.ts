/**
 * Generated Automatically At Wed Apr 08 2026 22:53:19 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { spaceInformation } from "cases/Fun-Artemis2/space.js";

let enableGrid = false;
let enableAxes = false;
let timeScale = 8;
let burnSecondsPerBoost = 1;
let thrustPitchDeg = 0;
let thrustYawDeg = 0;
let thrustPower = 0;
let holdThrust = false;

//#region reactive
__dev__();
__defineControl__("enableGrid", "bit", enableGrid);
__defineControl__("enableAxes", "bit", enableAxes);
__defineControl__("timeScale", "range", timeScale, {
  ...__defineControl__.rint(1, 100),
});
__defineControl__("burnSecondsPerBoost", "range", burnSecondsPerBoost, {
  ...__defineControl__.rint(1, 20),
});
__defineControl__("thrustPitchDeg", "range", thrustPitchDeg, {
  ...__defineControl__.rint(0, 85),
});
__defineControl__("thrustYawDeg", "range", thrustYawDeg, {
  ...__defineControl__.rint(-180, 180),
});
__defineControl__("thrustPower", "range", thrustPower, {
  ...__defineControl__.rint(0, 50),
});
__defineControl__("holdThrust", "bit", holdThrust);

__updateControlsDOM__ = () => {
  __renderControls__({
    enableAxes,
    enableGrid,
    timeScale,
    burnSecondsPerBoost,
    thrustPitchDeg,
    thrustYawDeg,
    thrustPower,
    holdThrust,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

// Constants
const ROCKET_MASS_KG = 50000; // 50 metric tons
const ROCKET_THRUST_N = 8e5; // 800 kN (Newton)
const EARTH_RADIUS_KM = spaceInformation.EARTH.meanRadiusKm;
const EARTH_MASS_KG = spaceInformation.EARTH.massKg;
const G = spaceInformation.G;
const MAX_PHYSICS_STEP_SEC = 1 / 60;
const MAX_PHYSICS_SUBSTEPS = 60;

// Viewport behavior tuning
const ALTITUDE_NEAR_KM = 0;
const ALTITUDE_FAR_KM = 1200;
const ROCKET_SCALE_GROUND = 1;
const ROCKET_SCALE_SPACE = 30;
const CAMERA_NEAR_UP_OFFSET_KM = 35;
const CAMERA_NEAR_BACK_OFFSET_KM = 120;
const CAMERA_FAR_UP_OFFSET_KM = 1200;
const CAMERA_FAR_BACK_OFFSET_KM = 3600;
const CAMERA_DAMPING = 4.5;
const CAMERA_LOOKAHEAD_SEC = 0.6;
const VELOCITY_VISUAL_EPSILON_KMPS = 1e-4;

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const buildRocketLocalBasis = (upDirection: THREE.Vector3) => {
  const reference =
    Math.abs(upDirection.y) > 0.98
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3()
    .crossVectors(reference, upDirection)
    .normalize();
  const forward = new THREE.Vector3()
    .crossVectors(upDirection, right)
    .normalize();
  return { right, forward };
};

// Helper: Convert lat/lng to 3D position
const latLngToPosition = (
  lat: number,
  lng: number,
  altitudeKm: number = 0,
): THREE.Vector3 => {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const radiusKm = EARTH_RADIUS_KM + altitudeKm;

  const x = radiusKm * Math.cos(latRad) * Math.cos(lngRad);
  const y = radiusKm * Math.sin(latRad);
  const z = radiusKm * Math.cos(latRad) * Math.sin(lngRad);

  return new THREE.Vector3(x, y, z);
};

// Helper: Get position data from 3D position
const positionToLatLngAltitude = (
  pos: THREE.Vector3,
): { lat: number; lng: number; altitudeKm: number } => {
  const radiusKm = pos.length();
  const altitudeKm = radiusKm - EARTH_RADIUS_KM;

  const lat = (Math.asin(pos.y / radiusKm) * 180) / Math.PI;
  const lng = (Math.atan2(pos.z, pos.x) * 180) / Math.PI;

  return { lat, lng, altitudeKm };
};

// Helper: Calculate gravity force on rocket at given position
const calculateGravityAcceleration = (
  positionKm: THREE.Vector3,
): THREE.Vector3 => {
  const distanceKm = positionKm.length();
  const distanceMeters = distanceKm * 1000;

  // F = G * M * m / r^2, then a = F / m = G * M / r^2
  const accelerationMs2 = (G * EARTH_MASS_KG) / Math.pow(distanceMeters, 2);
  const accelerationKmS2 = accelerationMs2 / 1000; // Convert m/s² to km/s²

  // Direction: toward Earth center (negative of position vector)
  const gravityVector = positionKm
    .clone()
    .normalize()
    .multiplyScalar(-accelerationKmS2);
  return gravityVector;
};

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) => {
  __usePanel__({
    placement: "left-bottom",
    lines: 3,
    width: 300,
  });

  // your code
  const textureLoader = new THREE.TextureLoader(new THREE.LoadingManager());

  camera.far = spaceInformation.EARTH_MOON_DISTANCE.apogeeKm * 1.5;
  camera.near = 1;
  camera.position.set(0, 0, spaceInformation.EARTH.meanRadiusKm * 2.0);

  __3__.ambLight(0xffffff, 0.7);

  const Earth = new THREE.Mesh(
    new THREE.SphereGeometry(spaceInformation.EARTH.meanRadiusKm, 64, 64),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.2,
      map: textureLoader.load("/cases/Fun-Artemis2/Earth (A).jpg"),
    }),
  );

  const Rocket = new THREE.Group();
  Rocket.scale.setScalar(1);

  const dracoLoader = new DRACOLoader();

  dracoLoader.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.5/",
  );
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.load("./Explorer Jupiter-C Rocket.glb", (gltf) => {
    const model = gltf.scene;
    // Align model so its nose points along +Y (away from Earth)
    // model.rotation.x = Math.PI / 2;
    Rocket.add(model);
  });

  // Rocket state object
  const rocketState = {
    position: new THREE.Vector3(), // km
    velocity: new THREE.Vector3(), // km/s
    mass: ROCKET_MASS_KG,
    lat: 0,
    lng: 0,
    altitudeKm: 0,
    isLanded: false,
    thrustApplied: new THREE.Vector3(), // Current frame's thrust
    remainingTrustTime: 0, // seconds
  };

  const cameraLookTarget = new THREE.Vector3();
  let cameraInitialized = false;

  world.add(Earth, Rocket);

  // ---- Flame Particle System ----
  const FLAME_COUNT = 5000;
  const _fPos = new Float32Array(FLAME_COUNT * 3);
  const _fColor = new Float32Array(FLAME_COUNT * 3);

  const flamePool = Array.from({ length: FLAME_COUNT }, () => ({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0, // normalized remaining life 0-1
    maxLife: 1, // seconds
    active: false,
  }));

  const flameGeo = new THREE.BufferGeometry();
  flameGeo.setAttribute("position", new THREE.BufferAttribute(_fPos, 3));
  flameGeo.setAttribute("color", new THREE.BufferAttribute(_fColor, 3));

  const flameMat = new THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    toneMapped: false,
  });

  const flameMesh = new THREE.Points(flameGeo, flameMat);
  flameMesh.translateY(10);
  // Dynamic particle positions make default bounds stale; keep particles rendered.
  flameMesh.frustumCulled = false;
  world.add(flameMesh);

  let _spawnAccum = 0;
  const FLAME_SPAWN_RATE = 120; // particles per second
  // ----------------------------------

  const moveRocketTo = (lat: number, lng: number) => {
    rocketState.lat = lat;
    rocketState.lng = lng;
    rocketState.altitudeKm = 0; // Start at surface
    rocketState.position = latLngToPosition(lat, lng, 0);
    rocketState.velocity.set(0, 0, 0);
    rocketState.isLanded = true; // Initially on ground
    Rocket.position.copy(rocketState.position);
  };

  const getThrustDirection = () => {
    const radialUpDirection = rocketState.position.clone().normalize();
    const { right, forward } = buildRocketLocalBasis(radialUpDirection);

    const yawRad = THREE.MathUtils.degToRad(thrustYawDeg);
    const pitchRad = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(thrustPitchDeg, 0, 89.9),
    );

    const tangentDirection = right
      .clone()
      .multiplyScalar(Math.cos(yawRad))
      .add(forward.clone().multiplyScalar(Math.sin(yawRad)))
      .normalize();

    return radialUpDirection
      .clone()
      .multiplyScalar(Math.cos(pitchRad))
      .add(tangentDirection.multiplyScalar(Math.sin(pitchRad)))
      .normalize();
  };

  moveRocketTo(39.9041999, 116.4073963);

  const burnRocket = () => {
    // Each call extends burn duration by configurable seconds.
    rocketState.remainingTrustTime += burnSecondsPerBoost;

    // Allow takeoff from ground on next frame integration.
    if (rocketState.isLanded) rocketState.isLanded = false;
  };

  const isThrustActive = () => holdThrust || rocketState.remainingTrustTime > 0;

  const reduceRocketState = (dtSec: number) => {
    if (rocketState.isLanded && rocketState.velocity.length() < 0.001) {
      if (!isThrustActive()) {
        rocketState.thrustApplied.set(0, 0, 0);
        return; // Not moving and no burn request
      }
      rocketState.isLanded = false;
    }

    if (isThrustActive()) {
      const thrustDirection = getThrustDirection();
      const thrustAccelerationMS2 =
        (ROCKET_THRUST_N * Math.max(0, thrustPower)) / rocketState.mass; // m/s^2
      const thrustAccelerationKmS2 = thrustAccelerationMS2 / 1000; // km/s^2
      rocketState.thrustApplied
        .copy(thrustDirection)
        .multiplyScalar(thrustAccelerationKmS2);
      if (rocketState.remainingTrustTime > 0) {
        rocketState.remainingTrustTime = Math.max(
          0,
          rocketState.remainingTrustTime - dtSec,
        );
      }
    } else {
      rocketState.thrustApplied.set(0, 0, 0);
    }

    if (dtSec <= 0) {
      return; // Not moving
    }

    // Calculate gravity acceleration at current position
    const gravityAccel = calculateGravityAcceleration(rocketState.position); // km/s^2

    // Total acceleration = gravity + thrust
    const totalAccel = gravityAccel.clone().add(rocketState.thrustApplied); // km/s^2

    // Update velocity: v = v + a * dt
    rocketState.velocity.addScaledVector(totalAccel, dtSec);

    // Update position: x = x + v * dt
    rocketState.position.addScaledVector(rocketState.velocity, dtSec);

    // Get altitude
    const radiusKm = rocketState.position.length();
    rocketState.altitudeKm = radiusKm - EARTH_RADIUS_KM;

    // Check landing (altitude <= 0)
    if (rocketState.altitudeKm <= 0) {
      rocketState.altitudeKm = 0;
      rocketState.position = latLngToPosition(
        rocketState.lat,
        rocketState.lng,
        0,
      );
      rocketState.velocity.set(0, 0, 0);
      rocketState.isLanded = true;
      rocketState.remainingTrustTime = 0;
      rocketState.thrustApplied.set(0, 0, 0); // Clear thrust on landing
    } else {
      rocketState.isLanded = false;
    }
  };

  const updateDispay = (dtSec: number) => {
    Rocket.position.copy(rocketState.position);

    const radialUpDirection = rocketState.position.clone().normalize();
    const burnActive = isThrustActive();
    const velocitySpeed = rocketState.velocity.length();
    // Prefer prograde attitude for visuals; fallback to thrust vector during burn,
    // then local radial-up when velocity is near zero.
    const rocketUpDirection =
      velocitySpeed > VELOCITY_VISUAL_EPSILON_KMPS
        ? rocketState.velocity.clone().normalize()
        : burnActive
          ? getThrustDirection()
          : radialUpDirection;
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rocketUpDirection);
    Rocket.quaternion.copy(quaternion);

    const altitudeT = smoothstep(
      ALTITUDE_NEAR_KM,
      ALTITUDE_FAR_KM,
      rocketState.altitudeKm,
    );
    const rocketScale = THREE.MathUtils.lerp(
      ROCKET_SCALE_GROUND,
      ROCKET_SCALE_SPACE,
      altitudeT,
    );
    Rocket.scale.setScalar(rocketScale);

    const { forward } = buildRocketLocalBasis(radialUpDirection);
    const backDirection = forward.clone().negate();
    const upOffsetKm = THREE.MathUtils.lerp(
      CAMERA_NEAR_UP_OFFSET_KM,
      CAMERA_FAR_UP_OFFSET_KM,
      altitudeT,
    );
    const backOffsetKm = THREE.MathUtils.lerp(
      CAMERA_NEAR_BACK_OFFSET_KM,
      CAMERA_FAR_BACK_OFFSET_KM,
      altitudeT,
    );

    const desiredCameraPosition = rocketState.position
      .clone()
      .addScaledVector(radialUpDirection, upOffsetKm)
      .addScaledVector(backDirection, backOffsetKm);

    const desiredLookTarget = rocketState.position
      .clone()
      .addScaledVector(rocketState.velocity, CAMERA_LOOKAHEAD_SEC);

    const alpha = THREE.MathUtils.clamp(
      1 - Math.exp(-CAMERA_DAMPING * Math.max(dtSec, 0)),
      0,
      1,
    );

    if (!cameraInitialized) {
      camera.position.copy(desiredCameraPosition);
      cameraLookTarget.copy(desiredLookTarget);
      cameraInitialized = true;
    } else {
      camera.position.lerp(desiredCameraPosition, alpha);
      cameraLookTarget.lerp(desiredLookTarget, alpha);
    }

    camera.lookAt(cameraLookTarget);
  };

  const updateFlame = (dtSec: number) => {
    const burning = isThrustActive();
    const up = getThrustDirection();
    const down = up.clone().negate();
    const altitudeT = smoothstep(
      ALTITUDE_NEAR_KM,
      ALTITUDE_FAR_KM,
      rocketState.altitudeKm,
    );
    const rocketScale = THREE.MathUtils.lerp(
      ROCKET_SCALE_GROUND,
      ROCKET_SCALE_SPACE,
      altitudeT,
    );
    // Emit from below the rocket; tie offset to visual scale to keep alignment.
    const nozzleOffsetKm = Math.max(8, rocketScale * 0.08);
    const nozzle = rocketState.position
      .clone()
      .addScaledVector(down, nozzleOffsetKm);

    if (burning) {
      _spawnAccum += FLAME_SPAWN_RATE * dtSec;
      const toSpawn = Math.floor(_spawnAccum);
      _spawnAccum -= toSpawn;
      let spawned = 0;
      for (let i = 0; i < FLAME_COUNT && spawned < toSpawn; i++) {
        if (flamePool[i].active) continue;
        const p = flamePool[i];
        p.active = true;
        p.maxLife = 0.8 + Math.random() * 1.2;
        p.life = 1;
        p.pos.copy(nozzle);
        // Random lateral spread perpendicular to thrust axis
        const tang = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        )
          .projectOnPlane(up)
          .normalize()
          .multiplyScalar(Math.random() * 80);
        // Main velocity: downward + lateral + inherit 50% of rocket velocity
        p.vel
          .copy(down)
          .multiplyScalar(120 + Math.random() * 220)
          .add(tang)
          .add(rocketState.velocity.clone().multiplyScalar(0.5));
        spawned++;
      }
    }

    for (let i = 0; i < FLAME_COUNT; i++) {
      const p = flamePool[i];
      const idx = i * 3;
      if (!p.active) {
        _fPos[idx] = _fPos[idx + 1] = _fPos[idx + 2] = 0;
        _fColor[idx] = _fColor[idx + 1] = _fColor[idx + 2] = 0;
        continue;
      }
      p.life -= dtSec / p.maxLife;
      if (p.life <= 0) {
        p.active = false;
        _fColor[idx] = _fColor[idx + 1] = _fColor[idx + 2] = 0;
        continue;
      }
      // Slight drag
      p.vel.multiplyScalar(1 - 1.5 * dtSec);
      p.pos.addScaledVector(p.vel, dtSec);

      _fPos[idx] = p.pos.x;
      _fPos[idx + 1] = p.pos.y;
      _fPos[idx + 2] = p.pos.z;

      // Color gradient: white (core) → yellow → orange → dark red (tail)
      const t = p.life;
      let r: number, g: number, b: number;
      if (t > 0.7) {
        // white → yellow
        r = 1;
        g = 1;
        b = (t - 0.7) / 0.3;
      } else if (t > 0.4) {
        // yellow → orange
        const s = (t - 0.4) / 0.3;
        r = 1;
        g = s * 0.5 + 0.3;
        b = 0;
      } else {
        // orange → dark red
        const s = t / 0.4;
        r = s * 0.9 + 0.1;
        g = s * 0.1;
        b = 0;
      }
      // Multiply by life for natural fade-out (additive blending: dark = transparent)
      _fColor[idx] = r * t;
      _fColor[idx + 1] = g * t;
      _fColor[idx + 2] = b * t;
    }

    flameGeo.attributes.position.needsUpdate = true;
    flameGeo.attributes.color.needsUpdate = true;
  };

  __add_nextframe_fn__((x, y, z, dt) => {
    const scaledDtSec = Math.max(0, dt * Math.max(0.01, timeScale));
    const substeps = THREE.MathUtils.clamp(
      Math.ceil(scaledDtSec / MAX_PHYSICS_STEP_SEC),
      1,
      MAX_PHYSICS_SUBSTEPS,
    );
    const substepDtSec = scaledDtSec / substeps;

    for (let i = 0; i < substeps; i++) {
      reduceRocketState(substepDtSec);
      updateFlame(substepDtSec);
    }

    updateDispay(dt);
  });

  __add_nextframe_fn__(() => {
    __usePanel_write__(
      0,
      `distance from surface: ${rocketState.altitudeKm.toFixed(3)} km`,
    );
    __usePanel_write__(
      1,
      `velocity length: ${rocketState.velocity.length().toFixed(6)} km/s`,
    );
    __usePanel_write__(2, `time scale: ${timeScale.toFixed(1)}x`);
  }, 1);

  __updateTHREEJs__invoke__.boost = () => {
    burnRocket();
  };

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

__defineControl__("boost", "btn", "", {
  freq: 200,
});
