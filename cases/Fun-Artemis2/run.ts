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
let iterations = 1000;
let rotationVisualScaleFactor = 0.1;

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

  const sunCurrentPosition = (lat: number, lng: number, dt: Date) => {
    const { altitude, azimuth } = SunCalc.getPosition(
      dt ?? new Date(),
      lat,
      lng,
    );
    const r = Math.cos(altitude);
    const xyz = [
      r * Math.cos(azimuth),
      r * Math.sin(azimuth),
      -Math.sin(altitude),
    ] as Vec3;
    return xyz;
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

  // Calculate Moon's velocity at apogee: v = sqrt(GM(2/r - 1/a))
  // G * M in SI units: m^3/s^2
  const GM = spaceInformation.G * earthMass;
  const apogeeM = apogeeKm * 1000; // convert to meters
  const semiMajorAxisM = semiMajorAxis * 1000; // convert to meters
  const velocityAtApogeeMs = Math.sqrt(GM * (2 / apogeeM - 1 / semiMajorAxisM));
  const velocityAtApogeeKmPerS = velocityAtApogeeMs / 1000; // convert to km/s

  const moonCurrentPosition = (lat: number, lng: number, dt: Date) => {
    const { altitude, azimuth, distance } = SunCalc.getMoonPosition(
      dt ?? new Date(),
      lat,
      lng,
    );
    const r = Math.cos(altitude);
    const xyz = [
      r * Math.cos(azimuth),
      r * Math.sin(azimuth),
      -Math.sin(altitude),
    ] as Vec3;
    return {
      xyz,
      dist: distance,
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
    worldUp,
    moonDirection,
  );
  if (moonVelocityDirection.lengthSq() < 1e-9) {
    moonVelocityDirection.crossVectors(
      new THREE.Vector3(1, 0, 0),
      moonDirection,
    );
  }
  moonVelocityDirection.normalize();
  const moonInitialVelocity = moonVelocityDirection.multiplyScalar(
    velocityAtApogeeKmPerS,
  );

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
    .negate()
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

  const moonTrajectoryUniforms = {
    uCount: { value: 0.0 },
    uColor: { value: new THREE.Color(0x00ffff) },
  };
  const satelliteTrajectoryUniforms = {
    uCount: { value: 0.0 },
    uColor: { value: new THREE.Color(0xffaa33) },
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

  moonTrajectory.frustumCulled = false;
  satelliteTrajectory.frustumCulled = false;
  moonTrajectory.renderOrder = 20;
  satelliteTrajectory.renderOrder = 20;

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
    const backward =
      speed > 1e-6
        ? satVel.normalize().multiplyScalar(exhaustDirectionSign)
        : new THREE.Vector3(0, -1, 0);
    const burnActive = exhaustBurnFrames > 0;

    if (burnActive) {
      for (let n = 0; n < 36; n++) {
        spawnExhaustParticle(satPos, backward);
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
      reduceSatelliteState();
    }

    simElapsedSec += simStepSeconds;

    // Update mesh positions (Earth stays at origin)
    moon.position.set(moonState[0], moonState[1], moonState[2]);
    satellite.position.set(
      satelliteState[0],
      satelliteState[1],
      satelliteState[2],
    );

    updateTrajectory(moon.position, 80, moonTrajectoryState);

    updateTrajectory(satellite.position, 20, satelliteTrajectoryState);

    updateExhaust();

    earth.rotateY(earthSpinOmega * simStepSeconds * rotationVisualScaleFactor);
    moon.rotateY(moonSpinOmega * simStepSeconds * rotationVisualScaleFactor);
  });

  __add_nextframe_fn__(() => {
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
      `screen time: ${new Date(simStartMs + simElapsedSec * 1000).toLocaleString()} | 1s = ${formatSimDuration(simElapsedSec / Math.max((Date.now() - simStartMs) / 1000, 1e-6))}`,
    );
  }, 0.3);

  __updateTHREEJs__only__.enableGrid = (val) => __3__.grid(val);
  __updateTHREEJs__only__.enableAxes = (val) =>
    __3__.axes(
      val,
      spaceInformation.EARTH.meanRadiusKm * moonRadiusVisualScale * 1.5,
    );

  __updateTHREEJs__invoke__.fire = (val) => {
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

    // Keep it bound: apply a small prograde boost but clamp below local escape speed.
    const localEscapeSpeedKmPerS =
      Math.sqrt((2 * spaceInformation.G * earthMass) / (radiusKm * 1000)) /
      1000;
    const targetSpeed = Math.min(speed * 1.02, localEscapeSpeedKmPerS * 0.98);
    const scale = targetSpeed / speed;

    satelliteState[3] *= scale;
    satelliteState[4] *= scale;
    satelliteState[5] *= scale;
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
    exhaustDirectionSign = 1;
    exhaustBurnFrames = 120;
  };

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  __usePanel__({
    placement: "top",
    width: 600,
    lines: 5,
  });
};

__defineControl__("fire", "btn", "fire", { label: "boost" });
__defineControl__("fire_down", "btn", "fire down", { label: "brake" });
__defineControl__("iterations", "range", iterations, {
  min: 100,
  max: 2000,
  fixed: 0,
  label: "iterations",
  help: "iteration",
});

__defineControl__("rotationVisualScaleFactor", "range", rotationVisualScaleFactor, {
  min: 0.01,
  max: 1,
  fixed: 2,
  label: "rotate",
  help: "iteration",
});
