import fs from "fs";
import http from "http";
import querystring, { stringify } from "querystring";
import { GeoTIFF, fromFile, GeoTIFFImage } from "geotiff";
import { PNG } from "pngjs";

const parseQuery = (url) => {
  const Q = querystring.parse(url);

  let lat = parseFloat(Q["lat"]);
  if (isNaN(lat) || lat > 90 || lat < -90) return null;

  let lng = parseFloat(Q["lng"]);
  if (isNaN(lng) || lng > 180 || lng < -180) return null;

  let span = parseFloat(Q["span"]);
  if (isNaN(span)) return null;

  let width = parseInt(Q["w"]);
  if (isNaN(width)) return null;

  let height = parseInt(Q["h"]);
  if (isNaN(height)) return null;

  return { lat, lng, span, width, height };
};

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/map")) {
    const [raster, w, h] = await readMap(3960);
    const png = createPNG(raster, w, h);
    res.setHeader("Content-Type", "image/png");
    png.pack().pipe(res);
    return;
  }

  if (!req.url.startsWith("/tile")) {
    res.setHeader("Content-Type", "image/png");
    res.end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*"); // 允许所有域名访问
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE"); // 允许的方法
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // 允许的请求头

  console.log("url=", req.url);

  const Q = parseQuery(req.url.substring(6));
  console.log(JSON.stringify(Q));

  if (Q === null) {
    console.log("Q = null");
    res.setHeader("Content-Type", "image/png");
    res.end();
    return;
  }

  const [raster, w, h] = await readTile(
    { lat: Q.lat, lng: Q.lng },
    Q.span,
    Q.width,
    Q.height
  );

  const png = createPNG(raster, w, h);

  res.setHeader("Content-Type", "image/png");
  png.pack().pipe(res);
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}/`);
});

const tiff = await fromFile(
  "/Users/singhijohn/Downloads/HYP_HR_SR/HYP_HR_SR.tif"
);
const image = await tiff.getImage(0);
const W = image.getWidth();
const H = image.getHeight();

console.log("dimensions:", W, H);

/**
 * @param {number} R
 * @param {{ lat: number; lng: number }} latlng
 * @param {number} span
 * @param {number} width
 * @param {number} height
 */
const readTile = async (latlng, span, width, height) => {
  const latlng_ = { ...latlng };

  const uv_left_bottom = latlng2lefttop(latlng_);

  latlng_.lat += span;
  latlng_.lng += span;

  const uv_right_top = latlng2lefttop(latlng_);

  console.log(uv_left_bottom, uv_right_top);

  const win_left = Math.floor(uv_left_bottom[0] * W);
  const win_right = Math.floor(uv_right_top[0] * W);
  const win_top = Math.floor(uv_right_top[1] * H);
  const win_bottom = Math.floor(uv_left_bottom[1] * H);

  console.log("LT=", win_left, win_top);
  console.log("D=", W, H);
  console.log("W= ", win_right - win_left);
  console.log("H= ", win_bottom - win_top);

  const naturalW = win_right - win_left;
  const naturalH = win_bottom - win_top;

  const width_ = Math.min(naturalW, width);
  const height_ = Math.min(naturalH, height);

  const data = await image.readRasters({
    window: [win_left, win_top, win_right, win_bottom],
    width: width_,
    height: height_,
    resampleMethod: "nearest",
  });

  return [data, width_, height_];
};

/**
 *
 * @param {number} size
 * @returns {[import("geotiff").ReadRasterResult, number, number]}
 */
const readMap = async (size) => {
  const ratio = H / W;

  const h = size * ratio;

  const data = await image.readRasters({
    window: [0, 0, W, H],
    width: size,
    height: h,
    resampleMethod: "nearest",
  });

  return [data, size, h];
};

const createPNG = (raster, w, h) => {
  // 3. 创建 PNG 数据
  const png = new PNG({ width: w, height: h });
  const pixels = w * h;

  for (let i = 0; i < pixels; i++) {
    png.data[i * 4] = raster[0][i]; // R
    png.data[i * 4 + 1] = raster[1][i]; // G
    png.data[i * 4 + 2] = raster[2][i]; // B
    png.data[i * 4 + 3] = 255; // Alpha
  }

  return png;
};

// {"lat":-6,"lng":-12,"span":3,"width":800,"height":800}
// -3, -9
// [ 0.5333333333333333, 0.5333333333333333 ] [ 0.525, 0.5166666666666667 ]

const latlng2lefttop = ({ lat, lng }) => {
  const u = (180 + lng) / 360;
  const v = (90 - lat) / 180;
  return [u, v];
};
