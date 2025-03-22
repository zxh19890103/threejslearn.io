export function latLngToTileXY(lat: number, lng: number, zoom = 10) {
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      Math.pow(2, zoom)
  );
  return { x, y };
}

export function calculateZoomLevel(distance: number) {
  // 40,075.017
  const EarthCircumference = 40075017; // 地球赤道周長（米）
  // const tileSize = 256; // 瓦片大小
  const C = 1; // 常數，可根據不同地圖系統調整

  // 計算縮放級別 z
  const zoom = C + Math.log2(EarthCircumference / distance);

  return Math.max(0, Math.round(zoom)); // 確保不小於 0，並四捨五入取整
}

export function tileSizeInLatLng(zoom: number) {
  // 經度增量（每個瓦片覆蓋的經度範圍）
  const deltaLng = 360 / Math.pow(2, zoom);

  // 計算 `tileY` 0 和 1 的緯度範圍，求 `Δlat`
  const deltaLat = tileYToLat(0, zoom) - tileYToLat(1, zoom);

  return { deltaLng, deltaLat };
}

// 緯度計算函數
function tileYToLat(tileY, zoom) {
  const n = Math.PI - (2 * Math.PI * tileY) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
