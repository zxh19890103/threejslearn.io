/**
 * Generated Automatically At Sat Mar 01 2025 20:29:11 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import { loadStatellites } from "./satellites.js";
import {
  checkRegress,
  ClassOfOrbit,
  doGravityBufferCompution,
  G,
  intervalPerFrame,
  MOMENT,
  MOMENT_N_PER_FRAME,
  MovingBody,
  Planet,
  resetRegress,
  setGravityParam,
  shouldSaveTrajectoryPosition,
  TypeOfOrbit,
} from "./gravity.js";
import * as Filters from "./filters.js";
import { tformat } from "../Fun-SolarSystem/utils.js";
import { parseJPLHorizonData } from "./utils.js";
import {
  __css2drenderer__,
  __useCSS2Renderer__,
  createCss2dObjectFor,
} from "../css2r.js";

//#region reactive
__dev__();

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__config__.camPos = [0, 0, 39];

__main__ = (
  world: THREE.Scene,
  mainCam: THREE.PerspectiveCamera,
  r_: THREE.WebGLRenderer
) => {
  // your code

  __info__(`
I downloaded satellite data from [USCUSA](https://www.ucsusa.org), specifically from this [file](https://www.ucsusa.org/sites/default/files/2024-01/UCS-Satellite-Database%205-1-2023%20%28text%29.txt), which contains records of **7,550 satellites** collected since **November 15, 1974**.  

What motivated me to start this project was a curiosity about the **current number of active satellites** and how that number has changed over time. Additionally, I wanted to analyze which countries have launched the most satellites.  

I've visualized **7,550 satellites** as points, colored based on categories such as:  

- **Country of origin**  
- **User type** (e.g., commercial, government, military)  
- **Orbit type & class**  
- **Mission purpose**  

The computation is based on Newton’s law of gravity, but I’ve ignored the complexity of the whole solar system to simplify the calculations.

This visualization provides an **intuitive overview of the current state of satellites** in Earth's orbit.  

It's incredible to see how far humanity has come in space technology! 🚀
`);

  __usePanel__({
    placement: "top",
    width: 400,
    lines: 3,
  });

  const earthInf = {
    // 1e+24 kg
    mass: 5.97237,
    // 1e+3 km
    radius: 6.371,
    // s
    rotationPeriod: 0.99 * 24 * 60 * 60,
  };

  const lunaInf = {
    aphelion: 405.4,
    peribelion: 362.6,
    semiMajorAxis: 384.399,
    avatar: "/nineplanets-org/moon.png",
    map: "/maps/moon-1024x512.jpg",
    mass: 0.07342,
    radius: 1.7374,
    inclination: 5.145 * __3__.deg2rad,
    rotationPeriod: 27.321661 * 24 * 60 * 60,
    axialTilt: 6.687 * __3__.deg2rad,
  };

  const txtloader = new THREE.TextureLoader(new THREE.LoadingManager());

  const earthUI = new THREE.Mesh(
    new THREE.SphereGeometry(earthInf.radius, 64, 64),
    new THREE.MeshPhongMaterial({
      wireframe: false,
      color: 0xffffff,
    })
  );

  txtloader.load(
    "https://solar.zhangxinghai.cn/maps/earth-1600x800.jpg",
    (texture) => {
      earthUI.material.map = texture;
      earthUI.material.needsUpdate = true;
    },
    null,
    () => {}
  );

  __3__.crs(earthUI, earthInf.radius * 1.5);

  world.add(earthUI);

  __useCSS2Renderer__();

  const earthBody: Planet = {
    nextCoordinates: [0, 0, 0],
    inf: earthInf,
  };

  const earthMove = () => {
    earthUI.rotation.y -=
      Math.PI * 2 * (intervalPerFrame / earthInf.rotationPeriod);
  };

  const lunaUI = new THREE.Mesh(
    new THREE.SphereGeometry(lunaInf.radius, 32, 32),
    new THREE.MeshStandardMaterial({
      wireframe: false,
      color: 0xffffff,
    })
  );

  __3__.crs(lunaUI, lunaInf.radius * 2);

  txtloader.load(
    "https://solar.zhangxinghai.cn/maps/moon-1024x512.jpg",
    (texture) => {
      lunaUI.material.map = texture;
      lunaUI.material.needsUpdate = true;
    },
    null,
    () => {}
  );

  const lunaTrajectoryUI = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
    })
  );

  lunaTrajectoryUI.frustumCulled = false;

  let lunaMove = (dt: number) => {};
  let lunaBody: SatelliteOrMoon = null;

  {
    createCss2dObjectFor(lunaUI, "moon");
    const q4 = new THREE.Quaternion();

    q4.setFromAxisAngle(aX, lunaInf.axialTilt);
    lunaUI.applyQuaternion(q4);

    // from JPL Horizon
    const JPLPV = parseJPLHorizonData(`
X =-1.699384780933159E+05 Y =-3.448397182960832E+05 Z =-8.704353091844852E+03
VX= 5.909382360925806E-01 VY=-7.093990580913949E-01 VZ= 1.885182644823649E-01
      `);

    const velocity: Vec3 = JPLPV.V;
    const position: Vec3 = JPLPV.P;

    lunaBody = {
      gravityCaringObjects: [earthBody],
      nextCoordinates: [...position],
      nextVelocity: [...velocity],
      _coordinates: position,
      _velocity: velocity,
      trajectory: [],
    };

    let lastSavedCoordinates: Vec3 = null;

    lunaMove = (dt: number) => {
      beforeMove(lunaBody);

      doGravityBufferCompution(
        lunaBody,
        MOMENT_N_PER_FRAME,
        lunaBody.nextCoordinates,
        lunaBody.nextVelocity
      );

      if (lunaBody._regressed) {
      } else {
        if (checkRegress(lunaBody)) {
          console.log("luna regressed!");
        }
      }

      afterMove(lunaBody);

      if (
        shouldSaveTrajectoryPosition(
          position,
          lastSavedCoordinates,
          mainCam.position
        )
      ) {
        lunaBody.trajectory.push(...position, 1);
        lastSavedCoordinates = [...position];

        if (lunaBody._regressed) {
          lunaBody.trajectory.shift();
          lunaBody.trajectory.shift();
          lunaBody.trajectory.shift();
          lunaBody.trajectory.shift();
        }
      }

      const trajectoryN = lunaBody.trajectory.length;

      lunaTrajectoryUI.geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          new Float32Array(lunaBody.trajectory),
          4
        )
      );
      lunaTrajectoryUI.geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(
          new Float32Array(
            lunaBody.trajectory.map((n, i) => {
              return i % 4 === 3 ? i / trajectoryN : 1;
            })
          ),
          4
        )
      );

      lunaUI.position.set(...position);
      lunaUI.rotation.y -=
        Math.PI * 2 * (intervalPerFrame / lunaInf.rotationPeriod);
    };
  }

  world.add(lunaUI, lunaTrajectoryUI);

  const AU = 149597.8707;
  const T = new Date();
  let clock = Filters.TheFirstDateOfLaunch;

  __3__.ambLight(0xffffff, 0.03);
  const sunLight = new THREE.PointLight(0xffffff, 1, 3 * AU, 0.001);
  sunLight.position.set(AU, 0, 0);
  world.add(sunLight);

  const earthQ4 = new THREE.Quaternion();
  const secsPerYear = 365 * 24 * 60 * 60;

  __add_nextframe_fn__((s, c, r, dt) => {
    clock += intervalPerFrame * 1000;
    T.setTime(clock);

    earthMove();
    lunaMove(dt);

    earthQ4.setFromAxisAngle(
      aY,
      -(Math.PI * 2 * intervalPerFrame) / secsPerYear
    );

    sunLight.position.applyQuaternion(earthQ4);
  });

  __add_nextframe_fn__(() => {
    __usePanel_write__(0, `screen date: ${T.toLocaleDateString()}`);
  }, 1);

  __updateTHREEJs__only__.launchDateBegin = () => {
    if (isNaN(launchDateBegin)) return;
    clock = launchDateBegin;
  };

  const loadSatellites = async () => {
    const data = await loadStatellites();

    const v3 = new THREE.Vector3();
    const q4 = new THREE.Quaternion();
    const q4_1 = new THREE.Quaternion();

    const R = earthInf.radius;

    const satellites: Satellite[] = [];

    let launchedSatellites: Satellite[] = [];
    let filtedSatellites: Satellite[] = [];

    for (const row of data.rows) {
      if (
        isNaN(row[12]) ||
        isNaN(row[11]) ||
        isNaN(row[14]) ||
        isNaN(row[19]) ||
        isNaN(row[10])
      ) {
        continue;
      }

      // A 49 - 353798
      const A = (R + row[12] * 1e-3) as number;
      const P = (R + row[11] * 1e-3) as number;
      const I = row[14] * __3__.deg2rad;

      // Period
      const LonOfGEO = row[10] * __3__.deg2rad;
      const S = (A + P) / 2;

      const speed = Math.sqrt(G * earthInf.mass * (2 / A - 1 / S));
      const Period = computeSatelliteOrbitalPeriod(
        row[12],
        row[11],
        earthInf.radius * 1e3
      );

      q4.setFromAxisAngle(aZ, I);
      q4_1.setFromAxisAngle(aY, LonOfGEO);

      q4.multiply(q4_1);

      const position = v3.set(A, 0, 0).applyQuaternion(q4).toArray();
      const velocity = v3.set(0, 0, speed).applyQuaternion(q4).toArray();

      satellites.push({
        name: row[1],
        dol: row[19],
        _coordinates: position,
        _velocity: velocity,
        nextCoordinates: [0, 0, 0],
        nextVelocity: [0, 0, 0],
        trajectory: [],
        gravityCaringObjects: [earthBody],
        color: [1, 1, 1, 1],
        typeOfOrbit: row[9],
        classOfOrbit: row[8],
        countryOfOperatorOrOwner: row[3],
        countryOrOrgOfUNRegistry: row[2],
        satelliteUser: row[5],
        satellitePurpose: row[6],
        needDrawTrajectory: row[9] === "Molniya" || Period > 1500,
      });
    }

    const satellitesUI = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2,
        vertexColors: true,
        sizeAttenuation: false,
      })
    );

    const trajectoriesUI = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
      })
    );

    trajectoriesUI.frustumCulled = false;

    const secsIn1day = 24 * 60 * 60;

    let throttle1day = 0;

    const move = (s_, c_: THREE.PerspectiveCamera, r_, dt) => {
      for (const sat of launchedSatellites) {
        beforeMove(sat);

        doGravityBufferCompution(
          sat,
          MOMENT_N_PER_FRAME,
          sat.nextCoordinates,
          sat.nextVelocity
        );

        if (sat.needDrawTrajectory) {
          if (sat._regressed) {
          } else {
            if (checkRegress(sat)) {
              console.log(`${sat.name} regressed!`);
            }
          }

          afterMove(sat);

          if (
            shouldSaveTrajectoryPosition(
              sat._coordinates,
              sat._lastSavedPos,
              c_.position
            )
          ) {
            if (sat._regressed) {
              sat.trajectory.shift();
              sat.trajectory.shift();
              sat.trajectory.shift();
            }

            sat.trajectory.push(...sat._coordinates);
            sat._lastSavedPos = [...sat._coordinates];
          }
        } else {
          afterMove(sat);
        }
      }

      drawPoints();

      if (drawSatelliteTrajectory) {
        drawTrajectories();
      }

      throttle1day += intervalPerFrame / dt;
      if (throttle1day > secsIn1day) {
        console.time("filter");
        launchedSatellites = satellites.filter((sat) => sat.dol < clock);
        doFilteSatellites();
        console.timeEnd("filter");
        throttle1day = 0;
      }
    };

    const drawPoints = () => {
      satellitesUI.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array(filtedSatellites.flatMap((s) => s._coordinates)),
          3
        )
      );

      satellitesUI.geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(
          new Float32Array(filtedSatellites.flatMap((s) => s.color)),
          4
        )
      );
    };

    const drawTrajectories = () => {
      let pts: number[] = [];
      const colors: number[] = [];

      const items = filtedSatellites.filter((s) => s.needDrawTrajectory);

      for (const sat of items) {
        const trajectory = sat.trajectory;
        const size = trajectory.length;
        const n = size / 3;

        // pts
        pts.push(trajectory[0], trajectory[1], trajectory[2]);
        pts = pts.concat(trajectory);
        pts.push(...sat._coordinates);

        // colors
        colors.push(0, 0, 0, 0);
        for (let i = 0; i < n; i++) {
          colors.push(
            sat.color[0],
            sat.color[1],
            sat.color[2],
            Math.pow(i / n, 1.2)
          );
        }
        colors.push(0, 0, 0, 0);
      }

      trajectoriesUI.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(pts), 3)
      );

      trajectoriesUI.geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(colors), 4)
      );
    };

    world.add(satellitesUI);
    world.add(trajectoriesUI);

    __add_nextframe_fn__(move);
    __add_nextframe_fn__((x, y, z, dt, skip) => {
      __usePanel_write__(
        2,
        `reality/screen: 1s=${tformat(
          Math.floor((skip * intervalPerFrame) / dt)
        )}`
      );
    }, 1);

    const sColor = new THREE.Color();

    const setColorForSatellites = (
      colored: boolean,
      key: keyof Satellite,
      colors: Record<string, string>
    ) => {
      if (colored) {
        for (const sat of launchedSatellites) {
          if (!sat[key]) continue;
          const color = sColor.set(colors[sat[key] as string]);
          sat.color = [color.r, color.g, color.b, 1];
        }
      } else {
        for (const sat of launchedSatellites) {
          sat.color = [1, 1, 1, 1];
        }
      }

      coloredByClassOfOrbit = false;
      coloredByCountryOfOperatorOrOwner = false;
      coloredByCountryOrOrgOfUNRegistry = false;
      coloredBySatellitePurpose = false;
      coloredBySatelliteUser = false;
      coloredByTypeOfOrbit = false;
    };

    __updateTHREEJs__only__.fov = () => {
      mainCam.fov = fov;
      mainCam.updateProjectionMatrix();
    };

    __updateTHREEJs__only__.satelliteSize = (size) => {
      satellitesUI.material.size = size;
      satellitesUI.material.needsUpdate = true;
    };

    let lookatMoonFrameFnId = -1;
    __updateTHREEJs__only__.lookAtMoon = () => {
      if (lookAtMoon) {
        const xyz = getXyzByLatLngAlt(90, 0, 3, earthInf.radius);
        mainCam.position.set(...xyz);
        earthUI.add(mainCam);
        lookatMoonFrameFnId = __add_nextframe_fn__(() => {
          mainCam.lookAt(lunaUI.position);
        });
      } else {
        __remove_nextframe_fn__(lookatMoonFrameFnId);

        earthUI.remove(mainCam);
        mainCam.position.set(...__config__.camPos);
        mainCam.lookAt(0, 0, 0);
      }
    };

    __updateTHREEJs__only__.coloredByCountryOfOperatorOrOwner = (val) => {
      setColorForSatellites(
        coloredByCountryOfOperatorOrOwner,
        "countryOfOperatorOrOwner",
        Filters.CountryOfOperator_Owner_Colors
      );

      coloredByCountryOfOperatorOrOwner = val;
      __updateControlsDOM__?.();
    };

    __updateTHREEJs__only__.coloredByCountryOrOrgOfUNRegistry = (val) => {
      setColorForSatellites(
        coloredByCountryOrOrgOfUNRegistry,
        "countryOrOrgOfUNRegistry",
        Filters.Country_OrgOfUNRegistry_Colors
      );

      coloredByCountryOrOrgOfUNRegistry = val;
      __updateControlsDOM__?.();
    };

    __updateTHREEJs__only__.coloredByClassOfOrbit = (val) => {
      setColorForSatellites(
        coloredByClassOfOrbit,
        "classOfOrbit",
        Filters.ClassesOfOrbit_Colors
      );

      coloredByClassOfOrbit = val;
      __updateControlsDOM__?.();
    };

    __updateTHREEJs__only__.coloredByTypeOfOrbit = (val) => {
      setColorForSatellites(
        coloredByTypeOfOrbit,
        "typeOfOrbit",
        Filters.TypesOfOrbit_Colors
      );

      coloredByTypeOfOrbit = val;
      __updateControlsDOM__?.();
    };

    __updateTHREEJs__only__.coloredBySatellitePurpose = (val) => {
      setColorForSatellites(
        coloredBySatellitePurpose,
        "satellitePurpose",
        Filters.Purpose_Colors
      );

      coloredBySatellitePurpose = val;
      __updateControlsDOM__?.();
    };

    __updateTHREEJs__only__.coloredBySatelliteUser = (val) => {
      setColorForSatellites(
        coloredBySatelliteUser,
        "satelliteUser",
        Filters.Users_Colors
      );

      coloredBySatelliteUser = val;
      __updateControlsDOM__?.();
    };

    __updateTHREEJs__only__.drawSatelliteTrajectory = () => {
      if (drawSatelliteTrajectory) {
        trajectoriesUI.visible = true;
      } else {
        trajectoriesUI.visible = false;
      }
    };

    __updateTHREEJs__many__.moment_momentN = (k, v) => {
      if (k === "moment") setGravityParam("MOMENT", v);
      else if (k === "momentN") setGravityParam("MOMENT_N_PER_FRAME", v);

      resetRegress(lunaBody);

      for (const sat of launchedSatellites) {
        if (sat.needDrawTrajectory) {
          resetRegress(sat);
        }
      }
    };

    __updateTHREEJs__ = (k: string, val: any) => {
      // variables changed, run your code!
    };

    const doFilteSatellites = () => {
      filtedSatellites = launchedSatellites.filter((sat) => {
        return (
          (!classOfOrbit || sat.classOfOrbit === classOfOrbit) &&
          (!typeOfOrbit || sat.typeOfOrbit === typeOfOrbit) &&
          (!countryOrOrgOfUNRegistry ||
            sat.countryOrOrgOfUNRegistry === countryOrOrgOfUNRegistry) &&
          (!countryOfOperatorOrOwner ||
            sat.countryOfOperatorOrOwner === countryOfOperatorOrOwner) &&
          (!satelliteUser || sat.satelliteUser === satelliteUser) &&
          (!satellitePurpose || sat.satellitePurpose === satellitePurpose)
        );
      });

      __usePanel_write__(1, `satellites total: ${filtedSatellites.length}`);
    };

    __updateTHREEJs__many__.classOfOrbit_satellitePurpose_satelliteUser_typeOfOrbit_countryOrOrgOfUNRegistry_countryOfOperatorOrOwner =
      doFilteSatellites;

    doFilteSatellites();
  };

  loadSatellites();
};

let fov = __config__.camFv;
let typeOfOrbit: string = null;
let coloredByTypeOfOrbit: boolean = false;
let classOfOrbit: string = null;
let coloredByClassOfOrbit: boolean = false;
let countryOrOrgOfUNRegistry: string = null;
let coloredByCountryOrOrgOfUNRegistry: boolean = false;
let countryOfOperatorOrOwner: string = null;
let coloredByCountryOfOperatorOrOwner = false;
let satelliteUser: string = null;
let coloredBySatelliteUser: boolean = false;
let satellitePurpose: string = null;
let coloredBySatellitePurpose: boolean = false;
let drawSatelliteTrajectory: boolean = false;
let launchDateBegin: number = Filters.TheFirstDateOfLaunch;
let lookAtMoon: boolean = false;
let satelliteSize: number = 2;

__updateControlsDOM__ = () => {
  __renderControls__({
    typeOfOrbit,
    coloredByTypeOfOrbit,
    classOfOrbit,
    coloredByClassOfOrbit,
    countryOfOperatorOrOwner,
    coloredByCountryOfOperatorOrOwner,
    countryOrOrgOfUNRegistry: countryOrOrgOfUNRegistry,
    coloredByCountryOrOrgOfUNRegistry,
    satelliteUser,
    coloredBySatelliteUser,
    satellitePurpose,
    coloredBySatellitePurpose,
    drawSatelliteTrajectory,
    lookAtMoon,
    fov,
    satelliteSize,
  });
};

__defineControl__("satelliteSize", "range", satelliteSize, {
  label: "satellite size",
  ...__defineControl__.rint(1, 4),
});
__defineControl__("launchDateBegin", "date", launchDateBegin, {
  label: "since",
  help: `
  Choose a date, list the satellites launched prior to it,
  and then add more as time progresses.
  `,
  helpWidth: 300,
});
__defineControl__("lookAtMoon", "bit", lookAtMoon, {
  label: "look at the moon",
  help: `Place the camera at the North Pole of Earth and observe the Moon; you will see its phase change over time.`,
  helpWidth: 300,
});
__defineControl__("fov", "range", fov, __defineControl__.rint(1, 150));

__defineControl__("moment", "range", MOMENT, {
  ...__defineControl__.rfloat(0.1, 30),
  eval: false,
  label: "compution unit (s)",
  help: `
  The minimum duration to compute the position/velocity of satellites and the Moon. The smaller it is, the more accurate the calculation.
  `,
  helpWidth: 400,
});
__defineControl__("momentN", "range", MOMENT_N_PER_FRAME, {
  ...__defineControl__.rint(0, 15),
  eval: false,
  label: "compution times per frame",
  help: `
  This can accelerate the movement of satellites and the Moon, including the self-rotation rates of the Earth and Moon. However, if the number of points is large, increasing the duration may cause performance issues.
  `,
  helpWidth: 400,
});

__defineControl__("typeOfOrbit", "enum", typeOfOrbit, {
  valueType: "string",
  label: "type of orbit",
  help: markdown.toHTML(
    `
- **Non-Polar Inclined**: Inclined between 0° and 90°, not passing over the poles; used for regional communications, Earth observation.  
- **Sun-Synchronous**: Precessing orbit maintaining constant angle with respect to the Sun; used for Earth observation, weather, environmental monitoring.  
- **Equatorial**: Orbit aligned with the equator (0° inclination); used for geostationary satellites, communication satellites.  
- **Polar**: Orbit with 90° inclination passing over both poles; used for Earth observation, reconnaissance satellites.  
- **Elliptical**: Orbit with varying altitudes, periapsis and apoapsis; used for satellites needing varying altitudes or special coverage.  
- **Deep Highly Eccentric**: Highly elliptical orbit with high eccentricity; used for planetary missions, special coverage satellites.  
- **Molniya**: Highly elliptical with 63.4° inclination, long duration over high latitudes; used for high-latitude communication (e.g., Russia).  
- **Retrograde**: Orbit in the opposite direction of Earth's rotation; used for specialized missions (e.g., military, science).  
- **Cislunar**: Orbits between Earth and Moon, inside the Earth-Moon system; used for lunar missions, space stations near the Moon.  
- **Sun-Synchronous Near Polar**: A near-polar orbit with constant angle relative to the Sun; used for Earth observation, imaging, weather satellites.
`
  ),
  options: Filters.TypesOfOrbit.map((x) => ({ label: x, value: x })),
});
__defineControl__("coloredByTypeOfOrbit", "bit", coloredByTypeOfOrbit, {
  help: filterColors2html(Filters.TypesOfOrbit_Colors),
  label: "colored (type of orbit)",
  helpWidth: 500,
});

__defineControl__("classOfOrbit", "enum", classOfOrbit, {
  valueType: "string",
  label: "class of orbit",
  help: markdown.toHTML(`
- **LEO**: Low Earth Orbit; typically 160 to 2,000 km above Earth's surface; used for satellites like ISS, Earth observation, and communication satellites.  
- **GEO**: Geostationary Orbit; located 35,786 km above Earth's equator; used for communication, weather satellites, and broadcasting.  
- **Elliptical**: Orbit with varying altitudes, periapsis and apoapsis; used for special satellite missions requiring different coverage areas.  
- **MEO**: Medium Earth Orbit; typically between 2,000 and 35,786 km; used for navigation satellites like GPS.  
                  `),
  options: Filters.ClassesOfOrbit.map((x) => ({ label: x, value: x })),
});
__defineControl__("coloredByClassOfOrbit", "bit", coloredByClassOfOrbit, {
  help: filterColors2html(Filters.ClassesOfOrbit_Colors),
  label: `colored (class of orbit)`,
});

__defineControl__(
  "countryOfOperatorOrOwner",
  "enum",
  countryOfOperatorOrOwner,
  {
    label: "country of operator/owner",
    valueType: "string",
    options: Filters.CountryOfOperator_Owner.map((x) => ({
      label: x,
      value: x,
    })),
  }
);
__defineControl__(
  "coloredByCountryOfOperatorOrOwner",
  "bit",
  coloredByCountryOfOperatorOrOwner,
  {
    label: "colored (country of operator/owner)",
    help: filterColors2html(Filters.CountryOfOperator_Owner_Colors),
    helpWidth: 600,
  }
);

__defineControl__(
  "countryOrOrgOfUNRegistry",
  "enum",
  countryOrOrgOfUNRegistry,
  {
    valueType: "string",
    label: "country/org of UN registry",
    options: Filters.Country_OrgOfUNRegistry.map((x) => ({
      label: x,
      value: x,
    })),
  }
);
__defineControl__(
  "coloredByCountryOrOrgOfUNRegistry",
  "bit",
  coloredByCountryOrOrgOfUNRegistry,
  {
    label: "colored (country/org of UN registry)",
    help: filterColors2html(Filters.Country_OrgOfUNRegistry_Colors),
    helpWidth: 500,
  }
);

__defineControl__("satelliteUser", "enum", satelliteUser, {
  valueType: "string",
  label: "users",
  options: Filters.Users.map((x) => ({ label: x, value: x })),
});
__defineControl__("coloredBySatelliteUser", "bit", coloredBySatelliteUser, {
  help: filterColors2html(Filters.Users_Colors),
  label: "colored (users)",
  helpWidth: 400,
});

__defineControl__("satellitePurpose", "enum", satellitePurpose, {
  valueType: "string",
  label: "purpose",
  options: Filters.Purpose.map((x) => ({ label: x, value: x })),
});
__defineControl__(
  "coloredBySatellitePurpose",
  "bit",
  coloredBySatellitePurpose,
  {
    label: "colored (purpose)",
    help: filterColors2html(Filters.Purpose_Colors),
    helpWidth: 500,
  }
);

__defineControl__("drawSatelliteTrajectory", "bit", drawSatelliteTrajectory, {
  label: "trajectories visible",
});

interface Satellite extends SatelliteOrMoon {
  name: string;
  /**
   * timestamp: date of Launch
   */
  dol: number;
  color: Vec4;
  typeOfOrbit: TypeOfOrbit;
  classOfOrbit: ClassOfOrbit;
  countryOfOperatorOrOwner: string;
  countryOrOrgOfUNRegistry: string;
  satelliteUser: string;
  satellitePurpose: string;
  needDrawTrajectory: boolean;
  _lastSavedPos?: Vec3;
}

interface SatelliteOrMoon extends MovingBody {
  trajectory: number[];
}

/**
 * ```
 * 0 - not
 * 1 - regressed
 * ```
 */
type RegressState = 0 | 1;

function beforeMove(s: MovingBody) {
  s.nextCoordinates[0] = s._coordinates[0];
  s.nextCoordinates[1] = s._coordinates[1];
  s.nextCoordinates[2] = s._coordinates[2];

  s.nextVelocity[0] = s._velocity[0];
  s.nextVelocity[1] = s._velocity[1];
  s.nextVelocity[2] = s._velocity[2];
}

function afterMove(s: MovingBody) {
  s._coordinates[0] = s.nextCoordinates[0];
  s._coordinates[1] = s.nextCoordinates[1];
  s._coordinates[2] = s.nextCoordinates[2];

  s._velocity[0] = s.nextVelocity[0];
  s._velocity[1] = s.nextVelocity[1];
  s._velocity[2] = s.nextVelocity[2];
}

function filterColors2html(colors: Record<string, string>) {
  return `<ul style="padding: 0; list-style: none; font-size: .84rem; display: inline-flex; flex-wrap: wrap; gap:4px;">
${Object.entries(colors)
  .map(([name, color]) => {
    return `<li style="margin: 0;">
    <em style="border-radius: .5em; background:${color};padding: 0 .5em">&nbsp;</em>
    <label>${name}</label>
    </li>`;
  })
  .join("")}
</ul>`;
}

/**
 *
 * @param apogee km
 * @param perigee km
 * @param R km
 * @returns minutes
 */
function computeSatelliteOrbitalPeriod(
  apogee: number,
  perigee: number,
  R: number
): number {
  const MU = 398600; // Earth's standard gravitational parameter in km³/s²

  // Compute semi-major axis (a)
  const ra = apogee + R;
  const rp = perigee + R;
  const a = (ra + rp) / 2;

  // Compute orbital period (T in seconds)
  const T = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU);

  // Convert seconds to minutes
  return T / 60;
}

function getXyzByLatLngAlt(
  lat: number,
  lng: number,
  alt: number,
  radius: number
): Vec3 {
  const R = alt + radius;

  const latRad = lat * __3__.deg2rad;
  const lngRad = lng * __3__.deg2rad;

  const x = R * Math.cos(latRad) * Math.cos(lngRad);
  const y = R * Math.cos(latRad) * Math.sin(lngRad);
  const z = R * Math.sin(latRad);

  return [x, z, y];
}

const aY = new THREE.Vector3(0, 1, 0);
const aZ = new THREE.Vector3(0, 0, 1);
const aX = new THREE.Vector3(1, 0, 0);
