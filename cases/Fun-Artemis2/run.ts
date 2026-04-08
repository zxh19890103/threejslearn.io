/**
 * Generated Automatically At Mon Apr 06 2026 00:00:29 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { spaceInformation } from "./space.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

let enableGrid = false;
let enableAxes = false;
let timeStep = 1; // simulation time step in seconds
let iterations = 100;
let rotationVisualScaleFactor = 0.1;
let craftBoostAngle = 0; // radians, 0 to 2π — controls boost direction in orbital plane
let boostPower = 1; // scales boost acceleration
let trajectoryPredictionTimeStep = 80;
let trajectoryPredictionSteps = 5000;

__config__.camPos = [0, spaceInformation.EARTH.meanRadiusKm * 3, 0];
__config__.camFar = spaceInformation.EARTH_MOON_DISTANCE.averageKm;

//#region reactive
__dev__();
__defineControl__("enableGrid", "bit", enableGrid);
__defineControl__("enableAxes", "bit", enableAxes);

__updateControlsDOM__ = () => {
  __renderControls__({
    enableAxes,
    enableGrid,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) => {
  // your code

  __contact__();
  __info__(`
You can check the content of **html**, 
which is the second menu item.
`);

  const distanceVisualScale = 1;
  const moonRadiusVisualScale = 10.0;

  const textloader = new THREE.TextureLoader(new THREE.LoadingManager());

  const earthGeo = new THREE.SphereGeometry(
    spaceInformation.EARTH.meanRadiusKm * moonRadiusVisualScale,
  );

  const earth = new THREE.Mesh(
    earthGeo,
    new THREE.MeshPhongMaterial({
      color: 0xffffff,
      map: textloader.load("Earth (A).jpg"),
    }),
  );
  const earthAxialTiltDeg = 23.439281;
  const earthTiltGroup = new THREE.Group();
  earthTiltGroup.rotation.z = THREE.MathUtils.degToRad(earthAxialTiltDeg);
  earthTiltGroup.add(earth);

  const moonOrbitRadius =
    spaceInformation.EARTH_MOON_DISTANCE.averageKm * distanceVisualScale;

  const moonGeo = new THREE.SphereGeometry(
    spaceInformation.MOON.meanRadiusKm * moonRadiusVisualScale,
  );

  const moon = new THREE.Mesh(
    moonGeo,
    new THREE.MeshPhongMaterial({
      color: 0xffffff,
      map: textloader.load("lroc_color_2k.jpg"),
    }),
  );
  const predictedMoon = new THREE.Mesh(
    moonGeo.clone(),
    new THREE.MeshPhongMaterial({
      color: 0xffff0f,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );

  const observationDate = new Date();
  const simStartMs = observationDate.getTime();
  let simElapsedSec = 0;
  const observerLat = 0;
  const observerLon = 0;
  const earthSiderealPeriodSec = 86164.0905;
  const moonSiderealPeriodSec = 2360591.5104;
  const earthSpinOmega = (Math.PI * 2) / earthSiderealPeriodSec;
  const moonSpinOmega = (Math.PI * 2) / moonSiderealPeriodSec;

  const formatSimDuration = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.round(seconds));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (days > 0) {
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    if (minutes > 0) {
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    }
    return `${secs}s`;
  };

  const sunCurrentPosition = (_lat: number, _lng: number, dt: Date) => {
    // Geocentric Sun direction in an Earth-centered inertial frame.
    // Returns a unit vector mapped to the scene's y-up convention.
    const t = dt ?? new Date();
    const msPerDay = 86400000;
    const jd = t.getTime() / msPerDay + 2440587.5;
    const n = jd - 2451545.0;

    const L = THREE.MathUtils.degToRad((280.46 + 0.9856474 * n) % 360);
    const g = THREE.MathUtils.degToRad((357.528 + 0.9856003 * n) % 360);
    const lambda =
      L +
      THREE.MathUtils.degToRad(1.915) * Math.sin(g) +
      THREE.MathUtils.degToRad(0.02) * Math.sin(2 * g);
    const epsilon = THREE.MathUtils.degToRad(23.439 - 0.0000004 * n);

    const xEq = Math.cos(lambda);
    const yEq = Math.cos(epsilon) * Math.sin(lambda);
    const zEq = Math.sin(epsilon) * Math.sin(lambda);

    const v = new THREE.Vector3(xEq, zEq, yEq).normalize();
    return [v.x, v.y, v.z] as Vec3;
  };

  const sunCalcSun = sunCurrentPosition(
    observerLat,
    observerLon,
    observationDate,
  );

  const sunDirLight = new THREE.DirectionalLight(0xffffff, 3);
  sunDirLight.position.set(...sunCalcSun);
  sunDirLight.target.position.set(0, 0, 0);
  world.add(sunDirLight);
  world.add(sunDirLight.target);

  __3__.ambLight(0xffffff, 0.1);

  const satellite = new THREE.Group();
  const satelliteVisualScaleFactor = 10000;
  const gltfLoader = new GLTFLoader();

  // 👇 create DRACO loader
  const dracoLoader = new DRACOLoader();
  // 👇 VERY IMPORTANT: decoder path
  dracoLoader.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.5/",
  );

  gltfLoader.setDRACOLoader(dracoLoader); // 👈

  gltfLoader.load(
    "./Stardust.glb",
    (gltf) => {
      const satelliteModel = gltf.scene;
      satelliteModel.scale.setScalar(satelliteVisualScaleFactor);
      satelliteModel.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;

          const materials = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          for (const material of materials) {
            material.polygonOffset = true;
            material.polygonOffsetFactor = -1;
            material.polygonOffsetUnits = -1;

            material.needsUpdate = true;
          }
        }
      });
      satellite.add(satelliteModel);
    },
    undefined,
    (err_) => {
      console.log(err_);
      // Fallback marker if model loading fails.
      const fallback = new THREE.Mesh(
        new THREE.SphereGeometry(3000, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x91de90 }),
      );
      satellite.add(fallback);
    },
  );

  const exhaustParticleCount = 2000;
  const exhaustPositions = new Float32Array(exhaustParticleCount * 3);
  const exhaustColors = new Float32Array(exhaustParticleCount * 3);
  const exhaustLifetimes = new Float32Array(exhaustParticleCount);
  const exhaustVelocities = Array.from(
    { length: exhaustParticleCount },
    () => new THREE.Vector3(),
  );
  let exhaustWriteIndex = 0;
  let exhaustBurnFrames = 0;
  let exhaustDirectionSign = -1;
  const exhaustBurnDirection = new THREE.Vector3(0, -1, 0);

  const exhaustGeometry = new THREE.BufferGeometry();
  exhaustGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(exhaustPositions, 3),
  );
  exhaustGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(exhaustColors, 3),
  );

  const exhaust = new THREE.Points(
    exhaustGeometry,
    new THREE.PointsMaterial({
      size: 2,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  exhaust.frustumCulled = false;

  for (let i = 0; i < exhaustParticleCount; i++) {
    const base = i * 3;
    exhaustPositions[base] = 0;
    exhaustPositions[base + 1] = 0;
    exhaustPositions[base + 2] = 0;
    exhaustColors[base] = 0;
    exhaustColors[base + 1] = 0;
    exhaustColors[base + 2] = 0;
    exhaustLifetimes[i] = 0;
  }

  // Physics-based orbital simulation with Earth fixed at origin
  const earthMass = spaceInformation.EARTH.massKg;
  const moonMass = spaceInformation.MOON.massKg;

  // Elliptical orbit parameters
  const apogeeKm = spaceInformation.EARTH_MOON_DISTANCE.apogeeKm;
  const perigeeKm = spaceInformation.EARTH_MOON_DISTANCE.perigeeKm;
  const semiMajorAxis = (apogeeKm + perigeeKm) / 2;

  // Use vis-viva to compute orbital speed at the current distance r: v = sqrt(mu(2/r - 1/a)).
  // G * M in SI units: m^3/s^2
  const GM = spaceInformation.G * earthMass;
  const semiMajorAxisM = semiMajorAxis * 1000; // convert to meters

  const moonCurrentPosition = (_lat: number, _lng: number, dt: Date) => {
    // Geocentric Moon position from low-precision orbital elements (Earth-centered).
    const t = dt ?? new Date();
    const msPerDay = 86400000;
    const jd = t.getTime() / msPerDay + 2440587.5;
    const d = jd - 2451543.5;

    const N = THREE.MathUtils.degToRad(125.1228 - 0.0529538083 * d);
    const i = THREE.MathUtils.degToRad(5.1454);
    const w = THREE.MathUtils.degToRad(318.0634 + 0.1643573223 * d);
    const a = 60.2666; // Earth radii
    const e = 0.0549;
    const M = THREE.MathUtils.degToRad(115.3654 + 13.0649929509 * d);

    const E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    const xv = a * (Math.cos(E) - e);
    const yv = a * (Math.sqrt(1 - e * e) * Math.sin(E));
    const v = Math.atan2(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);

    const xEcl =
      r *
      (Math.cos(N) * Math.cos(v + w) -
        Math.sin(N) * Math.sin(v + w) * Math.cos(i));
    const yEcl =
      r *
      (Math.sin(N) * Math.cos(v + w) +
        Math.cos(N) * Math.sin(v + w) * Math.cos(i));
    const zEcl = r * Math.sin(v + w) * Math.sin(i);

    const eps = THREE.MathUtils.degToRad(23.4393 - 3.563e-7 * d);
    const xEq = xEcl;
    const yEq = yEcl * Math.cos(eps) - zEcl * Math.sin(eps);
    const zEq = yEcl * Math.sin(eps) + zEcl * Math.cos(eps);

    const dir = new THREE.Vector3(xEq, zEq, yEq).normalize();
    const distKm = r * spaceInformation.EARTH.meanRadiusKm;

    return {
      xyz: [dir.x, dir.y, dir.z] as Vec3,
      dist: distKm,
    };
  };

  const sunCalcMoon = moonCurrentPosition(
    observerLat,
    observerLon,
    observationDate,
  );
  const moonDistanceKm = sunCalcMoon.dist;
  const worldUp = new THREE.Vector3(0, 1, 0);
  const sunDirection = new THREE.Vector3(...sunCalcSun).normalize();
  const moonObservedDirection = new THREE.Vector3(
    ...sunCalcMoon.xyz,
  ).normalize();

  // Build a Sun-referenced lunar orbital plane and place the Moon on it.
  const moonInclinationDeg = 5.145;
  const moonInclinationRad = THREE.MathUtils.degToRad(moonInclinationDeg);
  const nodeAxis = new THREE.Vector3().crossVectors(worldUp, sunDirection);
  if (nodeAxis.lengthSq() < 1e-9) {
    nodeAxis.set(1, 0, 0);
  } else {
    nodeAxis.normalize();
  }
  const eclipticNormal = new THREE.Vector3()
    .crossVectors(nodeAxis, sunDirection)
    .normalize();
  const moonPlaneNormal = eclipticNormal
    .clone()
    .applyAxisAngle(nodeAxis, moonInclinationRad)
    .normalize();

  const sunOnMoonPlane = sunDirection
    .clone()
    .addScaledVector(moonPlaneNormal, -sunDirection.dot(moonPlaneNormal))
    .normalize();

  const moonAngleFromSun = Math.atan2(
    new THREE.Vector3()
      .crossVectors(sunDirection, moonObservedDirection)
      .dot(moonPlaneNormal),
    THREE.MathUtils.clamp(sunDirection.dot(moonObservedDirection), -1, 1),
  );
  const moonDirection = sunOnMoonPlane
    .clone()
    .applyAxisAngle(moonPlaneNormal, moonAngleFromSun)
    .normalize();

  const moonInitialPosition = moonDirection
    .clone()
    .multiplyScalar(moonDistanceKm);

  const moonVelocityDirection = new THREE.Vector3().crossVectors(
    moonPlaneNormal,
    moonDirection,
  );
  if (moonVelocityDirection.lengthSq() < 1e-9) {
    moonVelocityDirection.crossVectors(
      new THREE.Vector3(1, 0, 0),
      moonDirection,
    );
  }
  moonVelocityDirection.normalize();
  const moonDistanceM = moonDistanceKm * 1000;
  const moonOrbitSpeedKmPerS =
    Math.sqrt(GM * (2 / moonDistanceM - 1 / semiMajorAxisM)) / 1000;
  const moonInitialVelocity =
    moonVelocityDirection.multiplyScalar(moonOrbitSpeedKmPerS);

  const satelliteMass = 1000;
  const satelliteOrbitRadiusKm =
    spaceInformation.EARTH.meanRadiusKm * moonRadiusVisualScale + 15000;
  const satelliteCircularVelocityKmPerS =
    Math.sqrt(
      (spaceInformation.G * earthMass) / (satelliteOrbitRadiusKm * 1000),
    ) / 1000;
  const satellitePlanePositionDirection = moonDirection
    .clone()
    .addScaledVector(moonPlaneNormal, -moonDirection.dot(moonPlaneNormal))
    .normalize();
  const satellitePlaneVelocityDirection = new THREE.Vector3()
    .crossVectors(moonPlaneNormal, satellitePlanePositionDirection)
    .normalize();
  const satelliteInitialPosition = satellitePlanePositionDirection
    .clone()
    .multiplyScalar(satelliteOrbitRadiusKm);
  const satelliteInitialVelocity = satellitePlaneVelocityDirection
    .clone()
    .multiplyScalar(satelliteCircularVelocityKmPerS);

  // State vectors for Earth and Moon: [x, y, z, vx, vy, vz]
  // Earth remains fixed at origin
  let earthState = new Float64Array([0, 0, 0, 0, 0, 0]);
  // Moon starts from a one-time SunCalc snapshot for this observer and date.
  let moonState = new Float64Array([
    moonInitialPosition.x,
    moonInitialPosition.y,
    moonInitialPosition.z,
    moonInitialVelocity.x,
    moonInitialVelocity.y,
    moonInitialVelocity.z,
  ]);

  let satelliteState = new Float64Array([
    satelliteInitialPosition.x,
    satelliteInitialPosition.y,
    satelliteInitialPosition.z,
    satelliteInitialVelocity.x,
    satelliteInitialVelocity.y,
    satelliteInitialVelocity.z,
  ]);

  world.add(earthTiltGroup);
  world.add(moon);
  world.add(predictedMoon);
  world.add(satellite);
  satellite.add(exhaust);

  camera.near = 1000;
  camera.far = moonOrbitRadius * 5;
  camera.updateProjectionMatrix();
  camera.position.set(
    moonOrbitRadius * 0.3,
    moonOrbitRadius * 1.2,
    moonOrbitRadius * 0.3,
  );
  camera.lookAt(0, 0, 0);
  const defaultCameraFov = camera.fov;
  const craftCameraOffset = new THREE.Vector3(0, 5000, 15000);
  const earthTargetLocal = new THREE.Vector3();
  let craftViewEnabled = false;
  const boostDirectionForward = new THREE.Vector3();
  const boostDirectionRight = new THREE.Vector3();
  const boostDirectionLive = new THREE.Vector3(0, -1, 0);
  const earthSafeDistanceKm =
    spaceInformation.EARTH.meanRadiusKm * moonRadiusVisualScale + 500;
  const moonSafeDistanceKm =
    spaceInformation.MOON.meanRadiusKm * moonRadiusVisualScale + 200;
  let satelliteDestroyed = false;
  let respawnCount = 0;

  const trajectoryMaxPoints = 8192;

  const trajectoryVertexShader = `
    uniform float uCount;
    varying float vAlpha;
    void main() {
      vAlpha = float(gl_VertexID) / max(uCount - 1.0, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const trajectoryFragmentShader = `
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
      gl_FragColor = vec4(uColor, vAlpha);
    }
  `;
  const predictedTrajectoryVertexShader = `
    uniform float uCount;
    varying float vAlpha;
    varying float vSpeedAlpha;
    varying float vLineDistance;
    attribute float lineDistance;
    attribute float aSpeedAlpha;
    void main() {
      vAlpha = float(gl_VertexID) / max(uCount - 1.0, 1.0);
      vSpeedAlpha = aSpeedAlpha;
      vLineDistance = lineDistance;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const predictedTrajectoryFragmentShader = `
    uniform float uDashSize;
    uniform float uGapSize;
    uniform float uOpacityMin;
    uniform float uOpacityMax;
    uniform float uMinVisibleAlpha;
    varying float vAlpha;
    varying float vSpeedAlpha;
    varying float vLineDistance;
    void main() {
      float cycle = uDashSize + uGapSize;
      if (cycle > 0.0) {
        float dashPhase = mod(vLineDistance, cycle);
        if (dashPhase > uDashSize) {
          discard;
        }
      }

      float speedAlpha = mix(uOpacityMin, uOpacityMax, vSpeedAlpha);
      float trailAlpha = 0.2 + vAlpha * 0.8;
      float finalAlpha = max(uMinVisibleAlpha, speedAlpha * trailAlpha);
      gl_FragColor = vec4(vec3(1.0), finalAlpha);
    }
  `;

  const moonTrajectoryUniforms = {
    uCount: { value: 0.0 },
    uColor: { value: new THREE.Color(0x00ffff) },
  };
  const satelliteTrajectoryUniforms = {
    uCount: { value: 0.0 },
    uColor: { value: new THREE.Color(0xffaa33) },
  };
  const predictedTrajectoryUniforms = {
    uCount: { value: 0.0 },
    uDashSize: { value: 12000.0 },
    uGapSize: { value: 7000.0 },
    uOpacityMin: { value: 0.35 },
    uOpacityMax: { value: 1.0 },
    uMinVisibleAlpha: { value: 0.22 },
  };

  const moonTrajectoryPositions = new Float32Array(trajectoryMaxPoints * 3);
  const moonTrajectoryPositionAttr = new THREE.BufferAttribute(
    moonTrajectoryPositions,
    3,
  );
  const moonTrajectoryGeometry = new THREE.BufferGeometry();
  moonTrajectoryGeometry.setAttribute("position", moonTrajectoryPositionAttr);
  moonTrajectoryGeometry.setDrawRange(0, 0);
  const moonTrajectory = new THREE.Line(
    moonTrajectoryGeometry,
    new THREE.ShaderMaterial({
      uniforms: moonTrajectoryUniforms,
      vertexShader: trajectoryVertexShader,
      fragmentShader: trajectoryFragmentShader,
      transparent: true,
      depthWrite: false,
    }),
  );
  const satelliteTrajectoryPositions = new Float32Array(
    trajectoryMaxPoints * 3,
  );
  const satelliteTrajectoryPositionAttr = new THREE.BufferAttribute(
    satelliteTrajectoryPositions,
    3,
  );
  const satelliteTrajectoryGeometry = new THREE.BufferGeometry();
  satelliteTrajectoryGeometry.setAttribute(
    "position",
    satelliteTrajectoryPositionAttr,
  );
  satelliteTrajectoryGeometry.setDrawRange(0, 0);
  const satelliteTrajectory = new THREE.Line(
    satelliteTrajectoryGeometry,
    new THREE.ShaderMaterial({
      uniforms: satelliteTrajectoryUniforms,
      vertexShader: trajectoryVertexShader,
      fragmentShader: trajectoryFragmentShader,
      transparent: true,
      depthWrite: false,
    }),
  );
  const predictedTrajectoryPositions = new Float32Array(
    trajectoryMaxPoints * 3,
  );
  const predictedTrajectoryPositionAttr = new THREE.BufferAttribute(
    predictedTrajectoryPositions,
    3,
  );
  const predictedTrajectoryAlphas = new Float32Array(trajectoryMaxPoints);
  const predictedTrajectoryAlphaAttr = new THREE.BufferAttribute(
    predictedTrajectoryAlphas,
    1,
  );
  const predictedTrajectoryGeometry = new THREE.BufferGeometry();
  predictedTrajectoryGeometry.setAttribute(
    "position",
    predictedTrajectoryPositionAttr,
  );
  predictedTrajectoryGeometry.setAttribute(
    "aSpeedAlpha",
    predictedTrajectoryAlphaAttr,
  );
  predictedTrajectoryGeometry.setDrawRange(0, 0);
  const predictedTrajectory = new THREE.Line(
    predictedTrajectoryGeometry,
    new THREE.ShaderMaterial({
      uniforms: predictedTrajectoryUniforms,
      vertexShader: predictedTrajectoryVertexShader,
      fragmentShader: predictedTrajectoryFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );

  moonTrajectory.frustumCulled = false;
  satelliteTrajectory.frustumCulled = false;
  predictedTrajectory.frustumCulled = false;
  moonTrajectory.renderOrder = 20;
  satelliteTrajectory.renderOrder = 20;
  predictedTrajectory.renderOrder = 30;

  const moonTrajectoryState = {
    lastSaved: null as THREE.Vector3 | null,
    count: 0,
    totalAngle: 0,
    angles: new Float32Array(trajectoryMaxPoints),
    positions: moonTrajectoryPositions,
    positionAttr: moonTrajectoryPositionAttr,
    geometry: moonTrajectoryGeometry,
    uniforms: moonTrajectoryUniforms,
  };
  const satelliteTrajectoryState = {
    lastSaved: null as THREE.Vector3 | null,
    count: 0,
    totalAngle: 0,
    angles: new Float32Array(trajectoryMaxPoints),
    positions: satelliteTrajectoryPositions,
    positionAttr: satelliteTrajectoryPositionAttr,
    geometry: satelliteTrajectoryGeometry,
    uniforms: satelliteTrajectoryUniforms,
  };
  const predictedTrajectoryState = {
    positions: predictedTrajectoryPositions,
    alphas: predictedTrajectoryAlphas,
    speeds: new Float32Array(trajectoryMaxPoints),
    positionAttr: predictedTrajectoryPositionAttr,
    alphaAttr: predictedTrajectoryAlphaAttr,
    geometry: predictedTrajectoryGeometry,
    uniforms: predictedTrajectoryUniforms,
  };

  const updateTrajectory = (
    position: THREE.Vector3,
    minDistance: number,
    state: {
      lastSaved: THREE.Vector3 | null;
      count: number;
      totalAngle: number;
      angles: Float32Array;
      positions: Float32Array;
      positionAttr: THREE.BufferAttribute;
      geometry: THREE.BufferGeometry;
      uniforms: { uCount: { value: number } };
    },
  ) => {
    const currentVec = position.clone();
    if (currentVec.lengthSq() <= 1e-9) {
      return;
    }

    if (
      !state.lastSaved ||
      state.lastSaved.distanceToSquared(currentVec) >= minDistance * minDistance
    ) {
      // Compute angle increment from last saved point to current
      let deltaAngle = 0;
      if (state.count > 0 && state.lastSaved) {
        const a = state.lastSaved.clone().normalize();
        const b = currentVec.clone().normalize();
        deltaAngle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
        state.totalAngle += deltaAngle;
      }

      // Evict oldest head points until trail spans <= one full orbit
      while (
        state.count > 0 &&
        (state.count >= trajectoryMaxPoints ||
          (state.totalAngle >= Math.PI * 2 && state.count > 1))
      ) {
        state.totalAngle -= state.angles[0];
        state.positions.copyWithin(0, 3);
        state.angles.copyWithin(0, 1);
        state.count -= 1;
      }

      // Write new point at tail
      state.positions[state.count * 3] = currentVec.x;
      state.positions[state.count * 3 + 1] = currentVec.y;
      state.positions[state.count * 3 + 2] = currentVec.z;
      if (state.count > 0) {
        state.angles[state.count - 1] = deltaAngle;
      }
      state.count += 1;

      state.geometry.setDrawRange(0, state.count);
      state.uniforms.uCount.value = state.count;
      state.positionAttr.needsUpdate = true;
      state.lastSaved = currentVec.clone();
    }
  };

  world.add(moonTrajectory);
  world.add(satelliteTrajectory);
  world.add(predictedTrajectory);

  const boostDirectionArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    50000,
    0xffffff,
    5000,
    2500,
  );
  boostDirectionArrow.renderOrder = 40;
  if (boostDirectionArrow.line.material instanceof THREE.Material) {
    boostDirectionArrow.line.material.depthTest = false;
  }
  if (boostDirectionArrow.cone.material instanceof THREE.Material) {
    boostDirectionArrow.cone.material.depthTest = false;
  }
  world.add(boostDirectionArrow);

  const explosionParticleCount = 300;
  const explosionPositions = new Float32Array(explosionParticleCount * 3);
  const explosionColors = new Float32Array(explosionParticleCount * 3);
  const explosionVelocities: THREE.Vector3[] = Array.from(
    { length: explosionParticleCount },
    () => new THREE.Vector3(),
  );
  const explosionLifetimes = new Float32Array(explosionParticleCount);
  let explosionActive = false;
  const explosionGeometry = new THREE.BufferGeometry();
  explosionGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(explosionPositions, 3),
  );
  explosionGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(explosionColors, 3),
  );
  const explosionMesh = new THREE.Points(
    explosionGeometry,
    new THREE.PointsMaterial({
      size: 8000,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  world.add(explosionMesh);

  const reduceMoonState = () => {
    const dx = moonState[0];
    const dy = moonState[1];
    const dz = moonState[2];
    const distanceKm = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Calculate gravitational force (Newtons)
    const gravityForce = spaceInformation.calculateGravityForce(
      earthMass,
      moonMass,
      distanceKm,
    );

    // Normalize direction vector (from Moon towards Earth at origin)
    const ux = -dx / distanceKm;
    const uy = -dy / distanceKm;
    const uz = -dz / distanceKm;

    // Acceleration on Moon (towards Earth) in km/s²
    // gravityForce is in N = kg⋅m/s², convert to km/s² by dividing by 1000
    const moonAccel = gravityForce / (moonMass * 1000);
    const moonAx = ux * moonAccel;
    const moonAy = uy * moonAccel;
    const moonAz = uz * moonAccel;

    // Update Moon velocity
    moonState[3] += moonAx * timeStep;
    moonState[4] += moonAy * timeStep;
    moonState[5] += moonAz * timeStep;

    // Update Moon position
    moonState[0] += moonState[3] * timeStep;
    moonState[1] += moonState[4] * timeStep;
    moonState[2] += moonState[5] * timeStep;
  };

  const reduceSatelliteState = () => {
    const dxEarth = satelliteState[0];
    const dyEarth = satelliteState[1];
    const dzEarth = satelliteState[2];
    const distanceEarthKm = Math.sqrt(
      dxEarth * dxEarth + dyEarth * dyEarth + dzEarth * dzEarth,
    );

    const dxMoon = moonState[0] - satelliteState[0];
    const dyMoon = moonState[1] - satelliteState[1];
    const dzMoon = moonState[2] - satelliteState[2];
    const distanceMoonKm = Math.sqrt(
      dxMoon * dxMoon + dyMoon * dyMoon + dzMoon * dzMoon,
    );

    let satelliteAx = 0;
    let satelliteAy = 0;
    let satelliteAz = 0;

    if (distanceEarthKm > 1e-6) {
      const earthGravityForce = spaceInformation.calculateGravityForce(
        earthMass,
        satelliteMass,
        distanceEarthKm,
      );
      const uxEarth = -dxEarth / distanceEarthKm;
      const uyEarth = -dyEarth / distanceEarthKm;
      const uzEarth = -dzEarth / distanceEarthKm;
      const earthAccel = earthGravityForce / (satelliteMass * 1000);

      satelliteAx += uxEarth * earthAccel;
      satelliteAy += uyEarth * earthAccel;
      satelliteAz += uzEarth * earthAccel;
    }

    if (distanceMoonKm > 1e-6) {
      const moonGravityForce = spaceInformation.calculateGravityForce(
        moonMass,
        satelliteMass,
        distanceMoonKm,
      );
      const uxMoon = dxMoon / distanceMoonKm;
      const uyMoon = dyMoon / distanceMoonKm;
      const uzMoon = dzMoon / distanceMoonKm;
      const moonAccel = moonGravityForce / (satelliteMass * 1000);

      satelliteAx += uxMoon * moonAccel;
      satelliteAy += uyMoon * moonAccel;
      satelliteAz += uzMoon * moonAccel;
    }

    satelliteState[3] += satelliteAx * timeStep;
    satelliteState[4] += satelliteAy * timeStep;
    satelliteState[5] += satelliteAz * timeStep;

    satelliteState[0] += satelliteState[3] * timeStep;
    satelliteState[1] += satelliteState[4] * timeStep;
    satelliteState[2] += satelliteState[5] * timeStep;
  };

  const computeBoostDirection = (out: THREE.Vector3) => {
    const speed = Math.hypot(
      satelliteState[3],
      satelliteState[4],
      satelliteState[5],
    );
    if (speed <= 1e-9) {
      return out.set(0, -1, 0);
    }

    boostDirectionForward
      .set(satelliteState[3], satelliteState[4], satelliteState[5])
      .normalize();
    boostDirectionRight.crossVectors(moonPlaneNormal, boostDirectionForward);
    if (boostDirectionRight.lengthSq() <= 1e-12) {
      boostDirectionRight.crossVectors(
        new THREE.Vector3(0, 1, 0),
        boostDirectionForward,
      );
      if (boostDirectionRight.lengthSq() <= 1e-12) {
        boostDirectionRight.crossVectors(
          new THREE.Vector3(1, 0, 0),
          boostDirectionForward,
        );
      }
    }
    boostDirectionRight.normalize();

    return out
      .copy(boostDirectionForward)
      .multiplyScalar(Math.cos(craftBoostAngle))
      .add(boostDirectionRight.multiplyScalar(Math.sin(craftBoostAngle)))
      .normalize();
  };

  const updatePredictedTrajectory = () => {
    const state = predictedTrajectoryState;
    state.positions.fill(0);
    state.alphas.fill(0);
    state.speeds.fill(0);

    if (satelliteDestroyed) {
      state.geometry.setDrawRange(0, 0);
      state.uniforms.uCount.value = 0;
      state.positionAttr.needsUpdate = true;
      state.alphaAttr.needsUpdate = true;
      predictedMoon.visible = false;
      return;
    }

    predictedMoon.visible = true;

    const shadowMoonState = new Float64Array(moonState);
    const shadowSatelliteState = new Float64Array(satelliteState);
    const sampleStride = 3;
    let count = 0;
    let minSpeed = Number.POSITIVE_INFINITY;
    let maxSpeed = 0;

    const reduceShadowMoonState = () => {
      const dx = shadowMoonState[0];
      const dy = shadowMoonState[1];
      const dz = shadowMoonState[2];
      const distanceKm = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const gravityForce = spaceInformation.calculateGravityForce(
        earthMass,
        moonMass,
        distanceKm,
      );
      const moonAccel = gravityForce / (moonMass * 1000);
      shadowMoonState[3] += (-dx / distanceKm) * moonAccel * trajectoryPredictionTimeStep;
      shadowMoonState[4] += (-dy / distanceKm) * moonAccel * trajectoryPredictionTimeStep;
      shadowMoonState[5] += (-dz / distanceKm) * moonAccel * trajectoryPredictionTimeStep;
      shadowMoonState[0] += shadowMoonState[3] * trajectoryPredictionTimeStep;
      shadowMoonState[1] += shadowMoonState[4] * trajectoryPredictionTimeStep;
      shadowMoonState[2] += shadowMoonState[5] * trajectoryPredictionTimeStep;
    };

    const reduceShadowSatelliteState = () => {
      const dxEarth = shadowSatelliteState[0];
      const dyEarth = shadowSatelliteState[1];
      const dzEarth = shadowSatelliteState[2];
      const distanceEarthKm = Math.sqrt(
        dxEarth * dxEarth + dyEarth * dyEarth + dzEarth * dzEarth,
      );

      const dxMoon = shadowMoonState[0] - shadowSatelliteState[0];
      const dyMoon = shadowMoonState[1] - shadowSatelliteState[1];
      const dzMoon = shadowMoonState[2] - shadowSatelliteState[2];
      const distanceMoonKm = Math.sqrt(
        dxMoon * dxMoon + dyMoon * dyMoon + dzMoon * dzMoon,
      );

      let ax = 0;
      let ay = 0;
      let az = 0;

      if (distanceEarthKm > 1e-6) {
        const earthGravityForce = spaceInformation.calculateGravityForce(
          earthMass,
          satelliteMass,
          distanceEarthKm,
        );
        const earthAccel = earthGravityForce / (satelliteMass * 1000);
        ax += (-dxEarth / distanceEarthKm) * earthAccel;
        ay += (-dyEarth / distanceEarthKm) * earthAccel;
        az += (-dzEarth / distanceEarthKm) * earthAccel;
      }

      if (distanceMoonKm > 1e-6) {
        const moonGravityForce = spaceInformation.calculateGravityForce(
          moonMass,
          satelliteMass,
          distanceMoonKm,
        );
        const moonAccel = moonGravityForce / (satelliteMass * 1000);
        ax += (dxMoon / distanceMoonKm) * moonAccel;
        ay += (dyMoon / distanceMoonKm) * moonAccel;
        az += (dzMoon / distanceMoonKm) * moonAccel;
      }

      shadowSatelliteState[3] += ax * trajectoryPredictionTimeStep;
      shadowSatelliteState[4] += ay * trajectoryPredictionTimeStep;
      shadowSatelliteState[5] += az * trajectoryPredictionTimeStep;
      shadowSatelliteState[0] += shadowSatelliteState[3] * trajectoryPredictionTimeStep;
      shadowSatelliteState[1] += shadowSatelliteState[4] * trajectoryPredictionTimeStep;
      shadowSatelliteState[2] += shadowSatelliteState[5] * trajectoryPredictionTimeStep;
    };

    for (let i = 0; i < trajectoryPredictionSteps && count < trajectoryMaxPoints; i++) {
      reduceShadowMoonState();
      reduceShadowSatelliteState();

      const distToEarth = Math.hypot(
        shadowSatelliteState[0],
        shadowSatelliteState[1],
        shadowSatelliteState[2],
      );
      const distToMoon = Math.hypot(
        shadowSatelliteState[0] - shadowMoonState[0],
        shadowSatelliteState[1] - shadowMoonState[1],
        shadowSatelliteState[2] - shadowMoonState[2],
      );
      if (
        distToEarth < earthSafeDistanceKm ||
        distToMoon < moonSafeDistanceKm
      ) {
        break;
      }

      if (i % sampleStride === 0) {
        const base = count * 3;
        state.positions[base] = shadowSatelliteState[0];
        state.positions[base + 1] = shadowSatelliteState[1];
        state.positions[base + 2] = shadowSatelliteState[2];
        const speed = Math.hypot(
          shadowSatelliteState[3],
          shadowSatelliteState[4],
          shadowSatelliteState[5],
        );
        state.speeds[count] = speed;
        minSpeed = Math.min(minSpeed, speed);
        maxSpeed = Math.max(maxSpeed, speed);
        count += 1;
      }
    }

    // Speed-to-opacity mapping: normalize speed and use higher alpha for higher speed.
    const speedRange = Math.max(1e-6, maxSpeed - minSpeed);
    for (let i = 0; i < count; i++) {
      const t = THREE.MathUtils.clamp((state.speeds[i] - minSpeed) / speedRange, 0, 1);
      state.alphas[i] = Math.pow(t, 0.8);
    }

    state.geometry.setDrawRange(0, count);
    if (count >= 2) {
      predictedTrajectory.computeLineDistances();
    }
    state.uniforms.uCount.value = count;
    state.positionAttr.needsUpdate = true;
    state.alphaAttr.needsUpdate = true;
    predictedMoon.position.set(
      shadowMoonState[0],
      shadowMoonState[1],
      shadowMoonState[2],
    );
  };

  const spawnExhaustParticle = (
    position: THREE.Vector3,
    backwardDirection: THREE.Vector3,
  ) => {
    const i = exhaustWriteIndex;
    const base = i * 3;

    exhaustPositions[base] = position.x + (Math.random() - 0.5) * 1800;
    exhaustPositions[base + 1] = position.y + (Math.random() - 0.5) * 1800;
    exhaustPositions[base + 2] = position.z + (Math.random() - 0.5) * 1800;

    const heat = Math.random();
    exhaustColors[base] = 1;
    exhaustColors[base + 1] = 0.4 + 0.6 * heat;
    exhaustColors[base + 2] = 0.1 + 0.2 * heat;

    const speed = 1800 + Math.random() * 2200;
    exhaustVelocities[i]
      .copy(backwardDirection)
      .multiplyScalar(speed)
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 240,
          (Math.random() - 0.5) * 240,
          (Math.random() - 0.5) * 240,
        ),
      );
    exhaustLifetimes[i] = 1.5 + Math.random() * 2.2;

    exhaustWriteIndex = (exhaustWriteIndex + 1) % exhaustParticleCount;
  };

  const updateExhaust = () => {
    const dt = 1 / 60;
    const satPos = new THREE.Vector3(0, 0, 0);
    const satVel = new THREE.Vector3(
      satelliteState[3],
      satelliteState[4],
      satelliteState[5],
    );
    const speed = satVel.length();
    const burnActive = exhaustBurnFrames > 0;
    const fallbackDirection =
      speed > 1e-6
        ? satVel.normalize().multiplyScalar(exhaustDirectionSign)
        : new THREE.Vector3(0, -1, 0);
    const plumeDirection = burnActive
      ? exhaustBurnDirection
      : fallbackDirection;

    if (burnActive) {
      for (let n = 0; n < 36; n++) {
        spawnExhaustParticle(satPos, plumeDirection);
      }
      exhaustBurnFrames -= 1;
    }

    const positionAttr = exhaustGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colorAttr = exhaustGeometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;

    for (let i = 0; i < exhaustParticleCount; i++) {
      if (exhaustLifetimes[i] <= 0) {
        continue;
      }

      const base = i * 3;
      const lifeDecay = burnActive ? 0.9 : 2.4;
      const travelScale = burnActive ? 36 : 12;
      const velocityDamping = burnActive ? 0.97 : 0.86;
      exhaustLifetimes[i] -= dt * lifeDecay;

      exhaustPositions[base] += exhaustVelocities[i].x * dt * travelScale;
      exhaustPositions[base + 1] += exhaustVelocities[i].y * dt * travelScale;
      exhaustPositions[base + 2] += exhaustVelocities[i].z * dt * travelScale;
      exhaustVelocities[i].multiplyScalar(velocityDamping);

      // Tail-off phase: collapse residual plume back toward the nozzle to avoid visual detachment.
      if (!burnActive) {
        exhaustPositions[base] *= 0.92;
        exhaustPositions[base + 1] *= 0.92;
        exhaustPositions[base + 2] *= 0.92;
      }

      if (exhaustLifetimes[i] <= 0) {
        exhaustPositions[base] = 0;
        exhaustPositions[base + 1] = 0;
        exhaustPositions[base + 2] = 0;
        exhaustColors[base] = 0;
        exhaustColors[base + 1] = 0;
        exhaustColors[base + 2] = 0;
        continue;
      }

      const life = Math.max(0, Math.min(1, exhaustLifetimes[i]));
      exhaustColors[base] = 1;
      exhaustColors[base + 1] = 0.25 + 0.75 * life;
      exhaustColors[base + 2] = 0.02 + 0.18 * life;
    }

    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  };

  __add_nextframe_fn__(() => {
    const simStepSeconds = iterations * timeStep;

    // Calculate distance vector from Earth (at origin) to Moon (in km)
    for (let i = 0; i < iterations; i++) {
      reduceMoonState();
      if (!satelliteDestroyed) reduceSatelliteState();
    }

    simElapsedSec += simStepSeconds;

    // Update mesh positions (Earth stays at origin)
    moon.position.set(moonState[0], moonState[1], moonState[2]);
    satellite.position.set(
      satelliteState[0],
      satelliteState[1],
      satelliteState[2],
    );

    if (!satelliteDestroyed) {
      const distToEarth = Math.hypot(
        satelliteState[0],
        satelliteState[1],
        satelliteState[2],
      );
      if (distToEarth < earthSafeDistanceKm) {
        triggerExplosion();
      } else {
        const distToMoon = Math.hypot(
          satelliteState[0] - moonState[0],
          satelliteState[1] - moonState[1],
          satelliteState[2] - moonState[2],
        );
        if (distToMoon < moonSafeDistanceKm) {
          triggerExplosion();
        }
      }
    }

    if (!satelliteDestroyed) {
      computeBoostDirection(boostDirectionLive);
      boostDirectionArrow.visible = true;
      boostDirectionArrow.position.copy(satellite.position);
      boostDirectionArrow.setDirection(boostDirectionLive);
      boostDirectionArrow.setLength(12000 + 18000 * boostPower, 4500, 2200);
    } else {
      boostDirectionArrow.visible = false;
    }

    updateTrajectory(moon.position, 80, moonTrajectoryState);

    updateTrajectory(satellite.position, 20, satelliteTrajectoryState);
    updatePredictedTrajectory();

    updateExhaust();
    updateExplosion();

    if (craftViewEnabled) {
      if (currentCraftViewMode === 0) {
        // look at earth
        earthTargetLocal.set(0, 0, 0);
      } else if (currentCraftViewMode === 1) {
        // look at moon
        earthTargetLocal.set(moonState[0], moonState[1], moonState[2]);
      }
      satellite.worldToLocal(earthTargetLocal);
      camera.lookAt(earthTargetLocal);
    }

    earth.rotateY(earthSpinOmega * simStepSeconds * rotationVisualScaleFactor);
    moon.rotateY(moonSpinOmega * simStepSeconds * rotationVisualScaleFactor);
  });

  __add_nextframe_fn__((x, y, z, delta, skip) => {
    __usePanel_write__(
      0,
      `spacecraft's position: (${satelliteState[0].toFixed(1)}, ${satelliteState[1].toFixed(1)}, ${satelliteState[2].toFixed(1)}) km`,
    );
    __usePanel_write__(
      1,
      `spacecraft's velocity: ${Math.hypot(satelliteState[3], satelliteState[4], satelliteState[5]).toFixed(3)} km/s`,
    );
    __usePanel_write__(
      2,
      `moon's position: (${moonState[0].toFixed(1)}, ${moonState[1].toFixed(1)}, ${moonState[2].toFixed(1)}) km`,
    );
    __usePanel_write__(
      3,
      `distance from the moon: ${Math.sqrt(
        (satelliteState[0] - moonState[0]) ** 2 +
          (satelliteState[1] - moonState[1]) ** 2 +
          (satelliteState[2] - moonState[2]) ** 2,
      ).toFixed(1)} km`,
    );
    __usePanel_write__(
      4,
      `screen time: ${new Date(simStartMs + simElapsedSec * 1000).toLocaleString()}`,
    );
    __usePanel_write__(
      5,
      `screen time: 1s = ${formatSimDuration(
        Math.floor((skip * iterations * timeStep) / delta),
      )}`,
    );
    __usePanel_write__(
      6,
      `boost dir: (${boostDirectionLive.x.toFixed(3)}, ${boostDirectionLive.y.toFixed(3)}, ${boostDirectionLive.z.toFixed(3)})`,
    );
  }, 1);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) =>
    __3__.axes(
      val,
      spaceInformation.EARTH.meanRadiusKm * moonRadiusVisualScale * 1.5,
    );

  __updateTHREEJs__invoke__.fire = (val) => {
    const rx = satelliteState[0];
    const ry = satelliteState[1];
    const rz = satelliteState[2];
    const radiusKm = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const speed = Math.hypot(
      satelliteState[3],
      satelliteState[4],
      satelliteState[5],
    );
    if (speed <= 1e-9) {
      return;
    }

    const boostDir = computeBoostDirection(new THREE.Vector3());

    // Use a small delta-v step to avoid unrealistic jumps.
    const deltaV = Math.max(0.05, speed * 0.02) * boostPower;
    let nextVx = satelliteState[3] + boostDir.x * deltaV;
    let nextVy = satelliteState[4] + boostDir.y * deltaV;
    let nextVz = satelliteState[5] + boostDir.z * deltaV;

    // Clamp to below local escape speed to keep trajectories stable.
    const localEscapeSpeedKmPerS =
      Math.sqrt((2 * spaceInformation.G * earthMass) / (radiusKm * 1000)) /
      1000;
    const maxAllowedSpeed = localEscapeSpeedKmPerS * 0.98;
    const nextSpeed = Math.hypot(nextVx, nextVy, nextVz);
    if (nextSpeed > maxAllowedSpeed && nextSpeed > 1e-9) {
      const scale = maxAllowedSpeed / nextSpeed;
      nextVx *= scale;
      nextVy *= scale;
      nextVz *= scale;
    }

    satelliteState[3] = nextVx;
    satelliteState[4] = nextVy;
    satelliteState[5] = nextVz;
    // Plume points opposite to thrust direction during boost.
    exhaustBurnDirection.copy(boostDir).multiplyScalar(-1).normalize();
    exhaustDirectionSign = -1;
    exhaustBurnFrames = 120;
  };

  __updateTHREEJs__invoke__.fire_down = (val) => {
    const vx = satelliteState[3];
    const vy = satelliteState[4];
    const vz = satelliteState[5];
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    if (speed <= 0) {
      return;
    }

    const rx = satelliteState[0];
    const ry = satelliteState[1];
    const rz = satelliteState[2];
    const radiusKm = Math.sqrt(rx * rx + ry * ry + rz * rz);

    // Keep direction stable: apply a small retrograde burn and avoid over-deceleration.
    const localCircularSpeedKmPerS =
      Math.sqrt((spaceInformation.G * earthMass) / (radiusKm * 1000)) / 1000;
    const targetSpeed = Math.max(speed * 0.98, localCircularSpeedKmPerS * 0.4);
    const scale = targetSpeed / speed;

    satelliteState[3] *= scale;
    satelliteState[4] *= scale;
    satelliteState[5] *= scale;
    // Brake burn: thrust is retrograde, so plume points prograde.
    const prograde = new THREE.Vector3(vx, vy, vz).normalize();
    exhaustBurnDirection.copy(prograde);
    exhaustDirectionSign = 1;
    exhaustBurnFrames = 120;
  };

  let craftviewClick = 0;
  let currentCraftViewMode = -1; // track which mode is active
  const initialCameraPos = new THREE.Vector3(
    moonOrbitRadius * 0.3,
    moonOrbitRadius * 1.2,
    moonOrbitRadius * 0.3,
  );
  __updateTHREEJs__invoke__.craftview = () => {
    switch (craftviewClick) {
      case 0: {
        // look at earth
        if (camera.parent !== satellite) {
          satellite.add(camera);
          camera.position.copy(craftCameraOffset);
        }
        camera.fov = 120;
        camera.updateProjectionMatrix();
        craftViewEnabled = true;
        currentCraftViewMode = 0;
        earthTargetLocal.set(0, 0, 0);
        satellite.worldToLocal(earthTargetLocal);
        camera.lookAt(earthTargetLocal);
        break;
      }
      case 1: {
        // look at moon
        if (camera.parent !== satellite) {
          satellite.add(camera);
          camera.position.copy(craftCameraOffset);
        }
        camera.fov = 120;
        camera.updateProjectionMatrix();
        craftViewEnabled = true;
        currentCraftViewMode = 1;
        earthTargetLocal.set(moonState[0], moonState[1], moonState[2]);
        satellite.worldToLocal(earthTargetLocal);
        camera.lookAt(earthTargetLocal);
        break;
      }
      case 2: {
        // restore
        craftViewEnabled = false;
        currentCraftViewMode = -1;
        camera.fov = defaultCameraFov;
        camera.updateProjectionMatrix();
        world.add(camera);
        camera.position.copy(initialCameraPos);
        camera.lookAt(0, 0, 0);
        break;
      }
    }

    craftviewClick++;
    craftviewClick = craftviewClick % 3;
  };

  const triggerExplosion = () => {
    if (satelliteDestroyed) return;
    satelliteDestroyed = true;

    if (craftViewEnabled) {
      craftViewEnabled = false;
      currentCraftViewMode = -1;
      craftviewClick = 0;
      camera.fov = defaultCameraFov;
      camera.updateProjectionMatrix();
      world.add(camera);
      camera.position.copy(initialCameraPos);
      camera.lookAt(0, 0, 0);
    }

    satellite.visible = false;

    const wx = satelliteState[0];
    const wy = satelliteState[1];
    const wz = satelliteState[2];

    for (let i = 0; i < explosionParticleCount; i++) {
      const base = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const sinPhi = Math.sin(phi);
      const dx = sinPhi * Math.cos(theta);
      const dy = sinPhi * Math.sin(theta);
      const dz = Math.cos(phi);

      explosionPositions[base] = wx;
      explosionPositions[base + 1] = wy;
      explosionPositions[base + 2] = wz;

      const speed = 20000 + Math.random() * 40000;
      explosionVelocities[i].set(dx * speed, dy * speed, dz * speed);
      explosionLifetimes[i] = 0.5 + Math.random() * 1.2;

      explosionColors[base] = 1.0;
      explosionColors[base + 1] = 0.3 + Math.random() * 0.5;
      explosionColors[base + 2] = 0.0;
    }

    (
      explosionGeometry.getAttribute("position") as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      explosionGeometry.getAttribute("color") as THREE.BufferAttribute
    ).needsUpdate = true;
    explosionActive = true;
  };

  const updateExplosion = () => {
    if (!explosionActive) return;
    const dt = 1 / 60;
    let anyAlive = false;
    const posAttr = explosionGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colAttr = explosionGeometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;

    for (let i = 0; i < explosionParticleCount; i++) {
      if (explosionLifetimes[i] <= 0) continue;
      anyAlive = true;
      const base = i * 3;
      explosionLifetimes[i] -= dt * 1.2;

      explosionPositions[base] += explosionVelocities[i].x * dt;
      explosionPositions[base + 1] += explosionVelocities[i].y * dt;
      explosionPositions[base + 2] += explosionVelocities[i].z * dt;
      explosionVelocities[i].multiplyScalar(0.94);

      if (explosionLifetimes[i] <= 0) {
        explosionPositions[base] = 0;
        explosionPositions[base + 1] = 0;
        explosionPositions[base + 2] = 0;
        explosionColors[base] = 0;
        explosionColors[base + 1] = 0;
        explosionColors[base + 2] = 0;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    if (!anyAlive) explosionActive = false;
  };

  const resetSatellite = (spawnAngleRad: number) => {
    const spawnDirection = satellitePlanePositionDirection
      .clone()
      .applyAxisAngle(moonPlaneNormal, spawnAngleRad)
      .normalize();
    const spawnVelocityDirection = new THREE.Vector3()
      .crossVectors(moonPlaneNormal, spawnDirection)
      .normalize();

    satelliteState[0] = spawnDirection.x * satelliteOrbitRadiusKm;
    satelliteState[1] = spawnDirection.y * satelliteOrbitRadiusKm;
    satelliteState[2] = spawnDirection.z * satelliteOrbitRadiusKm;
    satelliteState[3] =
      spawnVelocityDirection.x * satelliteCircularVelocityKmPerS;
    satelliteState[4] =
      spawnVelocityDirection.y * satelliteCircularVelocityKmPerS;
    satelliteState[5] =
      spawnVelocityDirection.z * satelliteCircularVelocityKmPerS;

    satellite.position.set(
      satelliteState[0],
      satelliteState[1],
      satelliteState[2],
    );
    satellite.visible = true;
    satelliteDestroyed = false;

    exhaustBurnFrames = 0;
    exhaustDirectionSign = -1;
    exhaustWriteIndex = 0;
    for (let i = 0; i < exhaustParticleCount; i++) {
      const base = i * 3;
      exhaustPositions[base] = 0;
      exhaustPositions[base + 1] = 0;
      exhaustPositions[base + 2] = 0;
      exhaustColors[base] = 0;
      exhaustColors[base + 1] = 0;
      exhaustColors[base + 2] = 0;
      exhaustLifetimes[i] = 0;
      exhaustVelocities[i].set(0, 0, 0);
    }
    (
      exhaustGeometry.getAttribute("position") as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      exhaustGeometry.getAttribute("color") as THREE.BufferAttribute
    ).needsUpdate = true;

    satelliteTrajectoryState.lastSaved = null;
    satelliteTrajectoryState.count = 0;
    satelliteTrajectoryState.totalAngle = 0;
    satelliteTrajectoryState.angles.fill(0);
    satelliteTrajectoryState.positions.fill(0);
    satelliteTrajectoryState.geometry.setDrawRange(0, 0);
    satelliteTrajectoryState.uniforms.uCount.value = 0;
    satelliteTrajectoryState.positionAttr.needsUpdate = true;

    predictedTrajectoryState.positions.fill(0);
    predictedTrajectoryState.alphas.fill(0);
    predictedTrajectoryState.speeds.fill(0);
    predictedTrajectoryState.geometry.setDrawRange(0, 0);
    predictedTrajectoryState.uniforms.uCount.value = 0;
    predictedTrajectoryState.positionAttr.needsUpdate = true;
    predictedTrajectoryState.alphaAttr.needsUpdate = true;
    predictedMoon.visible = false;

    explosionActive = false;
    for (let i = 0; i < explosionParticleCount; i++) {
      const base = i * 3;
      explosionPositions[base] = 0;
      explosionPositions[base + 1] = 0;
      explosionPositions[base + 2] = 0;
      explosionColors[base] = 0;
      explosionColors[base + 1] = 0;
      explosionColors[base + 2] = 0;
      explosionLifetimes[i] = 0;
      explosionVelocities[i].set(0, 0, 0);
    }
    (
      explosionGeometry.getAttribute("position") as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      explosionGeometry.getAttribute("color") as THREE.BufferAttribute
    ).needsUpdate = true;
  };

  __updateTHREEJs__invoke__.craftview_create = () => {
    if (!satelliteDestroyed) {
      return;
    }
    respawnCount += 1;
    resetSatellite((respawnCount * Math.PI) / 6);
  };

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  __usePanel__({
    placement: "left-bottom",
    width: 520,
    lines: 7,
  });
};

__defineControl__("craftBoostAngle", "range", craftBoostAngle, {
  min: 0,
  max: Math.PI * 2,
  fixed: 2,
  label: "boost angle",
  help: "relative to craft velocity: 0=prograde, PI=retrograde",
});
__defineControl__("boostPower", "range", boostPower, {
  min: 0.1,
  max: 5,
  fixed: 2,
  label: "boost power",
  help: "scales boost acceleration strength",
});
__defineControl__("fire", "btn", "fire", { label: "boost" });
__defineControl__("fire_down", "btn", "fire down", { label: "brake" });
__defineControl__("craftview", "btn", "craftview", { label: "craft view" });
__defineControl__("craftview_create", "btn", "add a", { label: "new craft" });
__defineControl__("iterations", "range", iterations, {
  min: 100,
  max: 2000,
  fixed: 0,
  label: "iterations",
  help: "physics steps per frame — higher values speed up simulation time",
});

__defineControl__(
  "trajectoryPredictionTimeStep",
  "range",
  trajectoryPredictionTimeStep,
  {
    min: 30,
    max: 100,
    fixed: 0,
    label: "predict timestep",
    help: "future trajectory simulation timestep (seconds)",
  },
);
__defineControl__(
  "trajectoryPredictionSteps",
  "range",
  trajectoryPredictionSteps,
  {
    min: 1000,
    max: 10000,
    fixed: 0,
    label: "predict steps",
    help: "future trajectory simulation step count",
  },
);

__defineControl__(
  "rotationVisualScaleFactor",
  "range",
  rotationVisualScaleFactor,
  {
    min: 0.01,
    max: 1,
    fixed: 2,
    label: "rotate",
    help: "scales Earth & Moon spin speed for visual clarity",
  },
);
