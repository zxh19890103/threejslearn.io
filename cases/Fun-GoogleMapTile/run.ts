/**
 * Generated Automatically At Sat Mar 15 2025 14:58:33 GMT+0800 (China Standard Time);
 */

import * as THREE from "three";
import {
  earthConfig,
  moonCurrentPosition,
  sunCurrentPosition,
} from "./calc.js";
import { getEarthHorizonCRS } from "./Space.class.js";
import { __useCSS2Renderer__, createCss2dObjectFor } from "../css2r.js";
import {
  __default_tileurl__,
  __resuable_q4_1__,
  __resuable_q4__,
  __resuable_vec3_1__,
  __reusable_vec3__,
  GoogleLyrs,
  GoogleTileScale,
} from "./shared.js";
import { Earth } from "./Earth.class.js";

//#region reactive
__dev__();

__updateControlsDOM__ = () => {
  __renderControls__({
    lat,
    lng,
    zoom,
    lyrs,
    tileScale,
  });
};

__onControlsDOMChanged__iter__ = (exp) => eval(exp);
//#endregion

__config__.camPos = [earthConfig.R * 1.5, 0, 0];
__config__.camFar = 38000 * 1e3;
__config__.camNear = 1e3;

__main__ = (
  world: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) => {
  // your code

  __contact__();

  __info__(`
I attempted to create a 3D map, similar to Google Maps.  

Thanks to ChatGPT and Three.js, I was able to implement the basic functionalities.  

### Features include:  
- Basic grid rendering with corresponding tile textures  
- Users can set the location they want to visit  
- Users can adjust the current center position and zoom level using controls and Three.js' \`OrbitControls\`  
- Sun positioning and its lighting effects on Earth, allowing for realistic day/night transitions  
- Configurable Google Tiles resolution, language, and type  
- Real-time location measurement  
- Real-time scale indicator  
- Real-time distance measurement from the observation point to the ground  
- Dynamic tile calculation and loading  
- Real-time moon positioning  
- Geolocation support  

### What were the challenges in implementing this?  

First, I had to understand how zoom levels and tiles work in GIS. After consulting ChatGPT multiple times, I got a mostly correct answer. By following its explanations step by step, I eventually achieved the desired results. The key aspects involved:  

- Converting latitude and longitude to Earth-centered coordinates  
- Converting Earth-centered coordinates back to latitude and longitude  
- Calculating tile \`x, y\` based on zoom level (\`z\`) and coordinates to request the correct tile  
- Computing the grid’s vertices, normals, indices, and UVs for rendering tiles  
- Implementing smooth tile transition animations  
- Efficient tile caching to ensure smooth performance during rapid movement and zooming  

This project may seem simple at first glance, but it involves a lot of GIS and WebGL texture mapping knowledge. It took me about a week of exploration to finally present this result to you.
    `);

  __updateTHREEJs__ = (k: string, val: any) => {
    // variables changed, run your code!
  };

  const ambLight = new THREE.AmbientLight(0xffffff, 2);
  world.add(ambLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 4);

  const tiles = new THREE.Group();
  world.add(tiles);

  const earth = new Earth(world, camera, renderer);
  world.add(earth);

  earth.addEventListener("latlng", ({ latlng }) => {
    lat = latlng.lat;
    lng = latlng.lng;
    __renderControls__({ lat, lng });
  });

  earth.addEventListener("zoom", ({ zoom: _zoom }) => {
    const dist = camera.position.length();
    const near = Math.pow(2, 23 - _zoom);
    camera.near = near;
    camera.far = dist + earthConfig.R * 2;
    camera.updateProjectionMatrix();

    zoom = _zoom;
    __renderControls__({ zoom });
  });

  __usePanel__({
    width: 500,
    lines: 5,
    placement: "top",
  });

  __useCSS2Renderer__();

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(earthConfig.R_of_moon, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xfe9100,
    })
  );

  createCss2dObjectFor(moon, "moon");

  const sunMove = () => {
    if (!useSunLight) return;

    const dt = new Date();
    const sunPos = sunCurrentPosition(0, 0, dt);
    const earthSurfaceCRS = getEarthHorizonCRS(0, 0);

    const moonPos = moonCurrentPosition(0, 0, dt);

    const sunPosInWorld = earthSurfaceCRS
      .toWorld(sunPos)
      .setLength(earthConfig.AU);

    sunLight.position.copy(sunPosInWorld);

    const moonPosInWorld = earthSurfaceCRS
      .toWorld(moonPos.xyz)
      .setLength(moonPos.dist);

    moon.position.copy(moonPosInWorld);

    __usePanel_write__(0, dt.toLocaleString());

    setTimeout(sunMove, 30 * 1000);
  };

  sunLight.target = earth;

  __updateTHREEJs__only__.useSunLight = () => {
    if (useSunLight) {
      ambLight.intensity = 0.1;
      world.add(sunLight, moon);
      sunMove();
    } else {
      ambLight.intensity = 3;
      world.remove(sunLight, moon);
    }
  };

  __updateTHREEJs__many__.lat_lng = (val) => {
    earth.flyTo(lat, lng);
  };

  __updateTHREEJs__only__.zoom = () => {
    earth.zoomTo(zoom);
  };

  __updateTHREEJs__only__.lyrs = () => {
    earth.setLyrs(lyrs);
  };

  __updateTHREEJs__invoke__.locate = () => {
    earth.locate();
  };

  __updateTHREEJs__only__.tileScale = () => {
    if (tileScale === null) {
      tileScale = 1;
      __renderControls__({ tileScale });
    }

    earth.calcMinLatLngChangeThreshold();
    earth.setTileScale(tileScale);
  };

  __updateTHREEJs__only__.tileSource = () => {
    const _val = tileSource || __default_tileurl__;
    const { data, value } = tileSourceOptions.find((opt) => opt.value === _val);

    earth.setTileArgs(data.zoom, data.zoomFix);
    earth.setTileUrl(value);
  };

  __updateTHREEJs__only__.showLonLines = () => {
    earth.LonLines.visible = showLonLines;
  };
  __updateTHREEJs__only__.showLonLines();

  __updateTHREEJs__only__.showTileGrids = () => {
    earth.tileGridlinesGroup.visible = showTileGrids;
  };
  __updateTHREEJs__only__.showTileGrids();

  __add_nextframe_fn__((s, c, r, dt) => {
    earth.checkCenterLoop();
    earth.checkZoomLoop();
    earth.calcTilesGrid();

    earth.updateDiff(dt);
    earth.checkTileStateLoop(dt);
  });

  __add_nextframe_fn__(() => {
    earth.measureMetersPerPixelAtCenter();

    const alt = camera.position.length() - earthConfig.R;
    __usePanel_write__(
      1,
      `eye alt: ${
        alt > 1000 ? Math.ceil(alt * 1e-3) + "km" : Math.ceil(alt) + "m"
      }`
    );

    const center = earth.getCenter();

    const { lat, lng } = center;
    __usePanel_write__(2, `center: ${lat.toFixed(2)},${lng.toFixed(2)}`);

    earth.checkLonLines();
  }, 0.2);

  __add_nextframe_fn__(() => {
    earth.drawScaleBar();
  }, 0.5);
};

let lat = 40;
let lng = 116;
let zoom = 4;
let lyrs: GoogleLyrs = "m";
let tileScale: GoogleTileScale = 1;
let useSunLight = false;
let showLonLines = false;
let showTileGrids = false;
let tileSource = __default_tileurl__;

const tileSourceOptions = [
  {
    label: "google",
    value: __default_tileurl__,
    data: { zoom: 22, zoomFix: -1 },
  },
  {
    label: "openstreet",
    value: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    data: { zoom: 19, zoomFix: -2 },
  },
  {
    label: "nasa",
    value:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
    data: { zoom: 8, zoomFix: 0 },
  },
  {
    label: "stadiamaps",
    value:
      "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}@2x.png",
    data: { zoom: 22, zoomFix: -1 },
  },
  {
    value: "https://basemaps.cartocdn.com/positron/{z}/{x}/{y}@2x.png",
    label: "carto",
    data: { zoom: 22, zoomFix: 0 },
  },
];

__defineControl__("tileSource", "enum", tileSource, {
  valueType: "string",
  label: "tiles provider",
  options: [...tileSourceOptions],
});

__defineControl__("showTileGrids", "bit", showTileGrids, {});
__defineControl__("showLonLines", "bit", showLonLines, {});

__defineControl__("locate", "btn", "1");

__defineControl__("useSunLight", "bit", useSunLight, {
  label: "sun light",
  helpWidth: 300,
  help: `Display real-time sunlight shining on Earth, updating every 30 seconds.`,
});

__defineControl__("lat", "range", lat, {
  label: "center (latitude)",
  ...__defineControl__.rfloat(-85, 85),
});

__defineControl__("lng", "range", lng, {
  label: "center (longitude)",
  ...__defineControl__.rfloat(-180, 180),
});

__defineControl__("zoom", "range", zoom, {
  ...__defineControl__.rint(0, 22),
});

__defineControl__("lyrs", "enum", lyrs, {
  valueType: "string",
  label: "map type",
  help: markdown.toHTML(`
- **m:** Standard Map (Map): Displays a normal map with roads, buildings, place names, and labels.
- **s:** Satellite Map (Satellite): Shows only satellite imagery without labels.
- **y:** Hybrid Map (Satellite + Labels): Displays satellite imagery with roads, place names, and labels.
- **t:** Terrain Map (Terrain): Shows terrain features like mountains, rivers, and elevation.
- **h:** Roads and Labels Only (Hybrid without satellite): Similar to y, but without satellite imagery—only labels are displayed.
- **p:** Labels Only (Places Overlay): Shows only place names, roads, and labels without a base map (useful in specific scenarios).
    `),
  helpWidth: 500,
  options: [
    { label: "standard", value: "m" },
    { label: "satellite", value: "s" },
    { label: "terrian", value: "t" },
    { label: "hybrid(with satellite)", value: "y" },
    { label: "hybrid(roads and labels)", value: "h" },
    { label: "labels", value: "p" },
  ],
});

__defineControl__("tileScale", "enum", tileScale, {
  valueType: "int",
  label: "scale",
  helpWidth: 200,
  help: `You can set the tile scale to 1, 2, or 4.`,
  options: [1, 2, 4].map((r) => ({ label: "x" + r, value: r })),
});
