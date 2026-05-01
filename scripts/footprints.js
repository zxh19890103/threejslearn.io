import sharp from "sharp";
import exifReader from "exif-reader";
import { readdir, writeFile } from "fs/promises";
import path from "path";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
  ".heif",
  ".heic",
]);

/**
 * Convert DMS (degrees, minutes, seconds) array + ref to decimal degrees.
 * @param {[number, number, number]} dms
 * @param {string} ref  e.g. 'N','S','E','W'
 * @returns {number}
 */
function dmsToDecimal([degrees, minutes, seconds], ref) {
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
}

/**
 * Parse an EXIF Buffer returned by sharp and extract lat, lon, datetime.
 * @param {Buffer} exifBuffer
 * @returns {{ lat: number|null, lon: number|null, datetime: string|null }}
 */
function parseExif(exifBuffer) {
  let lat = null;
  let lon = null;
  let datetime = null;

  try {
    const exif = exifReader(exifBuffer);

    const gps = exif.gps ?? exif.GPSInfo;
    if (gps) {
      const {
        GPSLatitude,
        GPSLatitudeRef,
        GPSLongitude,
        GPSLongitudeRef,
      } = gps;
      if (GPSLatitude && GPSLongitude) {
        lat = dmsToDecimal(GPSLatitude, GPSLatitudeRef ?? "N");
        lon = dmsToDecimal(GPSLongitude, GPSLongitudeRef ?? "E");
      }
    }

    const exifSub = exif.exif ?? exif.Photo;
    const image = exif.image ?? exif.Image;

    const rawDatetime =
      exifSub?.DateTimeOriginal ??
      exifSub?.DateTimeDigitized ??
      image?.DateTime;

    if (rawDatetime instanceof Date) {
      // 2026-04-26T19:41:29.000Z
      datetime = rawDatetime.toISOString().replace(/[TZ]/g, " ").trim();
    } else if (typeof rawDatetime === "string") {
      // EXIF datetime format: "YYYY:MM:DD HH:MM:SS" → ISO
      datetime = rawDatetime.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
    }
  } catch (err) {
    // silently ignore unparseable EXIF
  }

  return { lat, lon, datetime };
}

/**
 * Scan a folder of photos, extract geo + datetime from EXIF, and write JSON.
 *
 * @param {string} folderPath  Absolute or relative path to the photos folder.
 * @param {string} outputPath  Absolute or relative path for the output JSON file.
 * @returns {Promise<Array>}   The array of records written to disk.
 */
export async function extractPhotoFootprints(folderPath, outputPath) {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const imageFiles = entries
    .filter(
      (e) =>
        e.isFile() &&
        IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()),
    )
    .map((e) => path.join(folderPath, e.name));

  const records = [];

  for (const filePath of imageFiles) {
    try {
      const image = sharp(filePath);
      const { exif: exifBuffer } = await image.metadata();
      const blobBuffer = await image
        .clone()
        .rotate()
        .resize(64, 64, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
      const blob = blobBuffer.toString("base64");

      const { lat, lon, datetime } = exifBuffer
        ? parseExif(exifBuffer)
        : { lat: null, lon: null, datetime: null };

      records.push({
        file: path.basename(filePath),
        lat,
        lon,
        datetime,
        blob,
      });
    } catch (err) {
      console.warn(`[skip] ${path.basename(filePath)}: ${err.message}`);
    }
  }

  await writeFile(outputPath, JSON.stringify(records, null, 2), "utf-8");
  console.log(`Saved ${records.length} record(s) → ${outputPath}`);
  return records;
}

// ── CLI usage ──────────────────────────────────────────────────────────────
// node footprints.js <folderPath> <outputPath>
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [, , folderPath, outputPath] = process.argv;

  if (!folderPath || !outputPath) {
    console.error("Usage: node footprints.js <folderPath> <outputPath>");
    process.exit(1);
  }

  extractPhotoFootprints(
    path.resolve(folderPath),
    path.resolve(outputPath),
  ).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
