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
let showPrediction = true;
let predictionHorizonSec = 120;
let predictionSamples = 180;
let freeCameraMode = false;

//#region reactive
__dev__();
__defineControl__("enableGrid", "bit", enableGrid, {
  help: "Show or hide the world grid for depth and scale reference.",
});
__defineControl__("enableAxes", "bit", enableAxes, {
  help: "Show or hide global XYZ axes at world origin.",
});
__defineControl__("timeScale", "range", timeScale, {
  ...__defineControl__.rint(1, 500),
  help: "Physics time multiplier. Higher values speed up motion, burns, and trajectory evolution.",
});
__defineControl__("burnSecondsPerBoost", "range", burnSecondsPerBoost, {
  ...__defineControl__.rint(1, 20),
  help: "Seconds added per Boost press. Used only when Hold Thrust is OFF.",
});
__defineControl__("thrustPitchDeg", "range", thrustPitchDeg, {
  ...__defineControl__.rint(-85, 85),
  help: "Pitch angle around body +X. Drives ORANGE pitch line; with yaw it also changes YELLOW thrust line.",
});
__defineControl__("thrustYawDeg", "range", thrustYawDeg, {
  ...__defineControl__.rint(-180, 180),
  help: "Yaw angle around body +Z. Drives WHITE yaw line; with pitch it also changes YELLOW thrust line.",
});
__defineControl__("thrustPower", "range", thrustPower, {
  ...__defineControl__.rfloat(0, 10),
  help: "Engine force multiplier. 0 means no acceleration even if direction lines still rotate.",
});
__defineControl__("holdThrust", "bit", holdThrust, {
  help: "Continuous burn toggle. ON ignores burnSecondsPerBoost timer and keeps thrust active.",
});
__defineControl__("showPrediction", "bit", showPrediction, {
  help: "Show future trajectory preview from current state, using current thrust direction/power settings.",
});
__defineControl__("predictionHorizonSec", "range", predictionHorizonSec, {
  ...__defineControl__.rint(10, 600),
  help: "How far ahead to predict. Longer horizon shows more orbit arc but updates may feel heavier.",
});
__defineControl__("predictionSamples", "range", predictionSamples, {
  ...__defineControl__.rint(16, 600),
  help: "Prediction resolution. More samples make the line smoother but cost more CPU.",
});

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
    showPrediction,
    predictionHorizonSec,
    predictionSamples,
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
const PREDICTION_MAX_POINTS = 600;
const PREDICTION_REFRESH_SEC = 0.1;
const SATELLITE_RELEASE_OFFSET_KM = 35;

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

const getThrustAccelerationKmS2 = (massKg: number) => {
  const thrustAccelerationMS2 =
    (ROCKET_THRUST_N * Math.max(0, thrustPower)) / massKg;
  return thrustAccelerationMS2 / 1000;
};

// Helper: Convert lat/lng to 3D position
const latLngToPosition = (
  lat: number,
  lng: number,
  altitudeKm: number = 0,
): THREE.Vector3 => {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = ((lng + 90) * Math.PI) / 180;
  const radiusKm = EARTH_RADIUS_KM + altitudeKm;

  // Keep the same axis convention used by other Earth demos in this repo:
  // x follows east-west (sin lng), z follows prime-meridian direction (cos lng).
  const x = radiusKm * Math.cos(latRad) * Math.sin(lngRad);
  const y = radiusKm * Math.sin(latRad);
  const z = radiusKm * Math.cos(latRad) * Math.cos(lngRad);

  return new THREE.Vector3(x, y, z);
};

// Helper: Get position data from 3D position
const positionToLatLngAltitude = (
  pos: THREE.Vector3,
): { lat: number; lng: number; altitudeKm: number } => {
  const radiusKm = pos.length();
  const altitudeKm = radiusKm - EARTH_RADIUS_KM;

  const lat = (Math.asin(pos.y / radiusKm) * 180) / Math.PI;
  const lng = (Math.atan2(pos.x, pos.z) * 180) / Math.PI;

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
  __contact__();

  __usePanel__({
    placement: "left-bottom",
    lines: 6,
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
      transparent: false,
      opacity: 1,
      map: textureLoader.load("/cases/Fun-Artemis2/Earth (A).jpg"),
    }),
  );

  const Rocket = new THREE.Group();
  Rocket.scale.setScalar(10);
  const rocketAxes = new THREE.AxesHelper(120);
  Rocket.add(rocketAxes);

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

  const satelliteState = {
    active: false,
    position: new THREE.Vector3(), // km
    velocity: new THREE.Vector3(), // km/s
    altitudeKm: 0,
  };

  const cameraLookTarget = new THREE.Vector3();
  const cameraBackDirection = new THREE.Vector3();
  let cameraInitialized = false;

  const createDebugLine = (color: number) => {
    const positions = new Float32Array(6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
      }),
    );
    line.frustumCulled = false;
    return line;
  };

  const setDebugLine = (
    line: THREE.Line,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
  ) => {
    const dir = direction.clone().normalize();
    const end = origin.clone().addScaledVector(dir, Math.max(1, length));
    const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(0, origin.x, origin.y, origin.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
  };

  // Requested debug colors:
  // body up: pink, yaw: white, pitch: orange, thrust direction: yellow
  const bodyUpLine = createDebugLine(0xff5fd1);
  const yawLine = createDebugLine(0xffffff);
  const pitchLine = createDebugLine(0xff8a3d);
  const thrustLine = createDebugLine(0xfff34a);

  world.add(Earth, Rocket, bodyUpLine, yawLine, pitchLine, thrustLine);

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
    size: 10,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    toneMapped: false,
  });

  const flameMesh = new THREE.Points(flameGeo, flameMat);
  // flameMesh.translateY(10);
  // Dynamic particle positions make default bounds stale; keep particles rendered.
  flameMesh.frustumCulled = false;
  world.add(flameMesh);

  const satellite = new THREE.Group();
  satellite.scale.setScalar(0.02);
  satellite.visible = false;
  world.add(satellite);
  gltfLoader.load(
    "./Active Cavity Irradiance Monitor Satellite (AcrimSAT) (B).glb",
    (gltf) => {
      satellite.add(gltf.scene);
    },
  );

  const trajectoryPositions = new Float32Array(PREDICTION_MAX_POINTS * 3);
  const trajectoryGeo = new THREE.BufferGeometry();
  trajectoryGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(trajectoryPositions, 3),
  );
  trajectoryGeo.setDrawRange(0, 0);
  const trajectoryLine = new THREE.Line(
    trajectoryGeo,
    new THREE.LineBasicMaterial({
      color: 0x7fd6ff,
      transparent: true,
      opacity: 0.85,
    }),
  );
  trajectoryLine.frustumCulled = false;
  world.add(trajectoryLine);
  let predictionRefreshAccumSec = 0;

  let _spawnAccum = 0;
  const FLAME_SPAWN_RATE = 120; // particles per second
  // ----------------------------------

  const moveRocketTo = (
    lat: number,
    lng: number,
    altitudeKm: number = 0,
    velocityMagnitudeKmS: number = 0,
  ) => {
    rocketState.lat = lat;
    rocketState.lng = lng;
    rocketState.altitudeKm = Math.max(0, altitudeKm);
    rocketState.position = latLngToPosition(lat, lng, rocketState.altitudeKm);

    if (velocityMagnitudeKmS > 0) {
      const radialUpDirection = rocketState.position.clone().normalize();
      const { forward } = buildRocketLocalBasis(radialUpDirection);
      rocketState.velocity
        .copy(forward)
        .setLength(Math.max(0, velocityMagnitudeKmS));
    } else {
      rocketState.velocity.set(0, 0, 0);
    }

    rocketState.isLanded =
      rocketState.altitudeKm <= 0 && velocityMagnitudeKmS <= 0;
    rocketState.remainingTrustTime = 0;
    rocketState.thrustApplied.set(0, 0, 0);
    Rocket.position.copy(rocketState.position);
  };

  const getBodyUpDirectionAtState = (
    positionKm: THREE.Vector3,
    velocityKmS: THREE.Vector3,
    fallbackThrustDirection?: THREE.Vector3,
  ) => {
    if (velocityKmS.lengthSq() > VELOCITY_VISUAL_EPSILON_KMPS ** 2) {
      return velocityKmS.clone().normalize();
    }
    if (fallbackThrustDirection && fallbackThrustDirection.lengthSq() > 1e-10) {
      return fallbackThrustDirection.clone().normalize();
    }
    return positionKm.clone().normalize();
  };

  const getBodyAxes = (bodyY: THREE.Vector3) => {
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      bodyY.clone().normalize(),
    );
    return {
      bodyX: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
      bodyZ: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
    };
  };

  const getThrustDirectionAtPosition = (
    positionKm: THREE.Vector3,
    velocityKmS: THREE.Vector3,
    fallbackThrustDirection?: THREE.Vector3,
  ) => {
    const bodyY = getBodyUpDirectionAtState(
      positionKm,
      velocityKmS,
      fallbackThrustDirection,
    );
    const { bodyX, bodyZ } = getBodyAxes(bodyY);

    const pitchRad = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(thrustPitchDeg, -89.9, 89.9),
    );
    const yawRad = THREE.MathUtils.degToRad(thrustYawDeg);

    // Intrinsic body rotations: yaw around body +Z, then pitch around the yawed body +X.
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(bodyZ, yawRad);
    const yawedBodyY = bodyY.clone().applyQuaternion(yawQuat).normalize();
    const yawedBodyX = bodyX.clone().applyQuaternion(yawQuat).normalize();
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
      yawedBodyX,
      pitchRad,
    );

    return yawedBodyY.applyQuaternion(pitchQuat).normalize();
  };

  const getThrustDirection = () =>
    getThrustDirectionAtPosition(
      rocketState.position,
      rocketState.velocity,
      rocketState.thrustApplied,
    );

  const updatePredictionTrajectory = () => {
    if (!showPrediction) {
      trajectoryLine.visible = false;
      return;
    }

    trajectoryLine.visible = true;

    const sampleCount = THREE.MathUtils.clamp(
      Math.floor(predictionSamples),
      16,
      PREDICTION_MAX_POINTS,
    );
    const horizonSec = Math.max(1, predictionHorizonSec);
    const dt = horizonSec / Math.max(1, sampleCount - 1);

    const simPos = rocketState.position.clone();
    const simVel = rocketState.velocity.clone();
    let simRemainingTrustTime = rocketState.remainingTrustTime;

    let writeCount = 0;
    for (let i = 0; i < sampleCount; i++) {
      const idx = i * 3;
      trajectoryPositions[idx] = simPos.x;
      trajectoryPositions[idx + 1] = simPos.y;
      trajectoryPositions[idx + 2] = simPos.z;
      writeCount++;

      if (i >= sampleCount - 1) {
        break;
      }

      const thrustActive = holdThrust || simRemainingTrustTime > 0;
      const thrustAccel = thrustActive
        ? getThrustDirectionAtPosition(simPos, simVel).multiplyScalar(
            getThrustAccelerationKmS2(rocketState.mass),
          )
        : new THREE.Vector3();

      if (simRemainingTrustTime > 0) {
        simRemainingTrustTime = Math.max(0, simRemainingTrustTime - dt);
      }

      const gravityAccel = calculateGravityAcceleration(simPos);
      const totalAccel = gravityAccel.add(thrustAccel);
      simVel.addScaledVector(totalAccel, dt);
      simPos.addScaledVector(simVel, dt);

      const simRadiusKm = simPos.length();
      if (simRadiusKm <= EARTH_RADIUS_KM) {
        simPos.normalize().multiplyScalar(EARTH_RADIUS_KM);
        const nextIdx = (i + 1) * 3;
        trajectoryPositions[nextIdx] = simPos.x;
        trajectoryPositions[nextIdx + 1] = simPos.y;
        trajectoryPositions[nextIdx + 2] = simPos.z;
        writeCount++;
        break;
      }
    }

    trajectoryGeo.setDrawRange(0, writeCount);
    trajectoryGeo.attributes.position.needsUpdate = true;
  };

  moveRocketTo(39.9041999, 116.4073963, 110, 7.9);
  updatePredictionTrajectory();

  const burnRocket = () => {
    // Each call extends burn duration by configurable seconds.
    rocketState.remainingTrustTime += burnSecondsPerBoost;

    // Allow takeoff from ground on next frame integration.
    if (rocketState.isLanded) rocketState.isLanded = false;
  };

  const emitSatellite = () => {
    const releaseNormal = rocketState.position.clone().normalize();
    const { right } = buildRocketLocalBasis(releaseNormal);

    satelliteState.active = true;
    satelliteState.position
      .copy(rocketState.position)
      .addScaledVector(right, SATELLITE_RELEASE_OFFSET_KM);
    satelliteState.velocity.copy(rocketState.velocity);
    satelliteState.altitudeKm =
      satelliteState.position.length() - EARTH_RADIUS_KM;
    satellite.visible = true;
    satellite.position.copy(satelliteState.position);
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
      const thrustAccelerationKmS2 = getThrustAccelerationKmS2(
        rocketState.mass,
      );
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

  const reduceSatelliteState = (dtSec: number) => {
    if (!satelliteState.active || dtSec <= 0) {
      return;
    }

    const gravityAccel = calculateGravityAcceleration(satelliteState.position); // km/s^2
    satelliteState.velocity.addScaledVector(gravityAccel, dtSec);
    satelliteState.position.addScaledVector(satelliteState.velocity, dtSec);
    satelliteState.altitudeKm =
      satelliteState.position.length() - EARTH_RADIUS_KM;
  };

  const updateDispay = (dtSec: number) => {
    Rocket.position.copy(rocketState.position);
    if (satelliteState.active) {
      satellite.position.copy(satelliteState.position);
    }

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
    quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      rocketUpDirection,
    );
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

    // Rocket.scale.setScalar(rocketScale);

    const bodyUpDirection = getBodyUpDirectionAtState(
      rocketState.position,
      rocketState.velocity,
      rocketState.thrustApplied,
    );
    const { bodyX: bodyX_steering, bodyZ: bodyZ_steering } =
      getBodyAxes(bodyUpDirection);
    const yawOnlyQuat = new THREE.Quaternion().setFromAxisAngle(
      bodyZ_steering,
      THREE.MathUtils.degToRad(thrustYawDeg),
    );
    const yawDirection = bodyUpDirection.clone().applyQuaternion(yawOnlyQuat);
    const pitchOnlyQuat = new THREE.Quaternion().setFromAxisAngle(
      bodyX_steering,
      THREE.MathUtils.degToRad(thrustPitchDeg),
    );
    const pitchDirection = bodyUpDirection
      .clone()
      .applyQuaternion(pitchOnlyQuat)
      .normalize();
    const thrustDirection = getThrustDirection();
    const lineLenBase = Math.max(80, rocketScale * 4);
    const lineOrigin = rocketState.position
      .clone()
      .addScaledVector(rocketUpDirection, -Math.max(8, rocketScale * 0.08));

    setDebugLine(bodyUpLine, lineOrigin, bodyUpDirection, lineLenBase * 0.85);
    setDebugLine(yawLine, lineOrigin, yawDirection, lineLenBase * 0.75);
    setDebugLine(pitchLine, lineOrigin, pitchDirection, lineLenBase * 0.8);
    setDebugLine(thrustLine, lineOrigin, thrustDirection, lineLenBase);

    if (freeCameraMode) {
      // camera.up.set(0, 1, 0);
      // cameraLookTarget.set(0, 0, 0);
      // camera.lookAt(cameraLookTarget);
      return;
    }

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

    if (!cameraInitialized) {
      cameraBackDirection
        .copy(camera.position)
        .sub(rocketState.position)
        .normalize();
      if (cameraBackDirection.lengthSq() < 1e-8) {
        cameraBackDirection.set(0, 0, 1);
      }
    }

    const desiredCameraPosition = rocketState.position
      .clone()
      .addScaledVector(radialUpDirection, upOffsetKm)
      .addScaledVector(cameraBackDirection, backOffsetKm);

    const desiredLookTarget = rocketState.position.clone();

    const alpha = THREE.MathUtils.clamp(
      1 - Math.exp(-CAMERA_DAMPING * Math.max(dtSec, 0)),
      0,
      1,
    );

    if (!cameraInitialized) {
      camera.position.copy(desiredCameraPosition);
      cameraLookTarget.copy(desiredLookTarget);
      camera.up.set(0, 1, 0);
      cameraInitialized = true;
    } else {
      camera.position.lerp(desiredCameraPosition, alpha);
      cameraLookTarget.lerp(desiredLookTarget, alpha);
    }

    camera.up.set(0, 1, 0);
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
      reduceSatelliteState(substepDtSec);
      updateFlame(substepDtSec);
    }

    predictionRefreshAccumSec += dt;
    if (predictionRefreshAccumSec >= PREDICTION_REFRESH_SEC) {
      predictionRefreshAccumSec = 0;
      updatePredictionTrajectory();
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
    __usePanel_write__(
      3,
      satelliteState.active
        ? `sat altitude: ${satelliteState.altitudeKm.toFixed(3)} km`
        : "satellite: waiting emit",
    );
    __usePanel_write__(
      4,
      satelliteState.active
        ? `sat speed: ${satelliteState.velocity.length().toFixed(6)} km/s`
        : "sat speed: -",
    );
    const _radialUp = rocketState.position.clone().normalize();
    const _velLen = rocketState.velocity.length();
    const _velAngleDeg = _velLen > 1e-9
      ? THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, _radialUp.dot(rocketState.velocity.clone().normalize())))))
      : 0;
    __usePanel_write__(5, `velocity ∠ radial-up: ${_velAngleDeg.toFixed(2)}°`);
  }, 1);

  __updateTHREEJs__invoke__.boost = () => {
    burnRocket();
  };
  __updateTHREEJs__invoke__.emitSatellite = () => {
    emitSatellite();
  };
  __updateTHREEJs__invoke__.moveToBeijing = () => {
    moveRocketTo(39.9041999, 116.4073963, 0, 0);
  };
  __updateTHREEJs__only__.freeCameraMode = () => {
    // freeCameraMode = !freeCameraMode;

    if (freeCameraMode) {
      const maxVisibleRadiusKm = Math.max(
        EARTH_RADIUS_KM,
        rocketState.position.length(),
        satelliteState.active ? satelliteState.position.length() : 0,
      );
      const fovRad = THREE.MathUtils.degToRad(camera.fov);
      const minDistanceKm =
        maxVisibleRadiusKm / Math.max(Math.sin(fovRad * 0.5), 1e-3);
      const cameraDistanceKm = minDistanceKm * 1.2;
      const freeViewDir = new THREE.Vector3(1, 0.4, 1).normalize();
      camera.position.copy(freeViewDir.multiplyScalar(cameraDistanceKm));
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    }

    cameraInitialized = false;
  };

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) => __3__.axes(val);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };
};

__defineControl__("boost", "btn", "", {
  freq: 200,
  help: "Trigger one timed burn pulse. Duration comes from burnSecondsPerBoost.",
});
__defineControl__("emitSatellite", "btn", "", {
  help: "Release the satellite with current rocket velocity for independent orbit.",
});
__defineControl__("moveToBeijing", "btn", "", {
  help: "Reset rocket to Beijing at ground level with zero velocity.",
});
__defineControl__("freeCameraMode", "bit", "", {
  help: "Switch to/from free camera framing instead of follow-camera behavior.",
});
