// convert-to-webp.mjs
import sharp from "sharp";
import fs from "fs-extra";
import path from "path";

const inputDir = "../assets/images/cases"; // input folder with .png/.jpg
const outputDir = "../assets/images/cases-gen"; // output folder for .webp

async function convertImagesToWebp() {
  await fs.ensureDir(outputDir);

  const files = await fs.readdir(inputDir);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const basename = path.basename(file, ext);

    if (![".jpg", ".jpeg", ".png"].includes(ext)) continue;

    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, `${basename}.webp`);

    try {
      await sharp(inputPath)
        .webp({ quality: 80 }) // adjust quality as needed (0–100)
        .toFile(outputPath);

      console.log(`✅ Converted: ${file} → ${basename}.webp`);
    } catch (err) {
      console.error(`❌ Failed to convert ${file}:`, err.message);
    }
  }

  console.log("🎉 Done!");
}

convertImagesToWebp();
