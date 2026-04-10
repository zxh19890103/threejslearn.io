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
  ...__defineControl__.rint(0, 120),
});
__defineControl__("thrustYawDeg", "range", thrustYawDeg, {
  ...__defineControl__.rint(-180, 180),
});
__defineControl__("thrustPower", "range", thrustPower, {
  ...__defineControl__.rint(0, 50),
});
__defineControl__("holdThrust", "bit", holdThrust);
__defineControl__("showPrediction", "bit", showPrediction);
__defineControl__("predictionHorizonSec", "range", predictionHorizonSec, {
  ...__defineControl__.rint(10, 600),
});
__defineControl__("predictionSamples", "range", predictionSamples, {
  ...__defineControl__.rint(16, 600),
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
  const thrustAccelerationMS2 = (ROCKET_THRUST_N * Math.max(0, thrustPower)) / massKg;
  return thrustAccelerationMS2 / 1000;
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
    lines: 5,
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

  const satelliteState = {
    active: false,
    position: new THREE.Vector3(), // km
    velocity: new THREE.Vector3(), // km/s
    altitudeKm: 0,
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

  const satellite = new THREE.Mesh(
    new THREE.SphereGeometry(12, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xfff27a,
      transparent: true,
      opacity: 0.98,
    }),
  );
  satellite.visible = false;
  world.add(satellite);

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

  const moveRocketTo = (lat: number, lng: number) => {
    rocketState.lat = lat;
    rocketState.lng = lng;
    rocketState.altitudeKm = 0; // Start at surface
    rocketState.position = latLngToPosition(lat, lng, 0);
    rocketState.velocity.set(0, 0, 0);
    rocketState.isLanded = true; // Initially on ground
    Rocket.position.copy(rocketState.position);
  };

  const getThrustDirectionAtPosition = (positionKm: THREE.Vector3) => {
    const radialUpDirection = positionKm.clone().normalize();
    const { right, forward } = buildRocketLocalBasis(radialUpDirection);

    const yawRad = THREE.MathUtils.degToRad(thrustYawDeg);
    const pitchRad = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(thrustPitchDeg, 0, 120),
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

  const getThrustDirection = () => getThrustDirectionAtPosition(rocketState.position);

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
        ? getThrustDirectionAtPosition(simPos).multiplyScalar(
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

  moveRocketTo(39.9041999, 116.4073963);
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
    satelliteState.altitudeKm = satelliteState.position.length() - EARTH_RADIUS_KM;
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
      const thrustAccelerationKmS2 = getThrustAccelerationKmS2(rocketState.mass);
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
    satelliteState.altitudeKm = satelliteState.position.length() - EARTH_RADIUS_KM;
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
  }, 1);

  __updateTHREEJs__invoke__.boost = () => {
    burnRocket();
  };
  __updateTHREEJs__invoke__.emitSatellite = () => {
    emitSatellite();
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
__defineControl__("emitSatellite", "btn", "", {
  freq: 200,
});
