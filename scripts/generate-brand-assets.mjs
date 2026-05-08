import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const rootPng = path.join(root, "iHatePDF.png");
const publicPng = path.join(root, "public/iHatePDF.png");

const darkBg = { r: 10, g: 10, b: 10 };

async function main() {
  if (fs.existsSync(rootPng)) {
    fs.copyFileSync(rootPng, publicPng);
  }
  if (!fs.existsSync(publicPng)) {
    throw new Error(
      "Falta public/iHatePDF.png (copiá iHatePDF.png a la raíz del repo o a public/).",
    );
  }

  const base = sharp(publicPng).ensureAlpha();

  await base
    .clone()
    .resize(512, 512, { fit: "contain", background: { ...darkBg, alpha: 0 } })
    .png()
    .toFile(path.join(root, "public/brand/logo-512.png"));

  await base
    .clone()
    .resize(192, 192, { fit: "contain", background: { ...darkBg, alpha: 0 } })
    .png()
    .toFile(path.join(root, "public/brand/logo-192.png"));

  await base
    .clone()
    .resize(32, 32, { fit: "contain", background: { ...darkBg, alpha: 0 } })
    .png()
    .toFile(path.join(root, "public/favicon-32.png"));

  await base
    .clone()
    .resize(180, 180, {
      fit: "contain",
      background: { ...darkBg, alpha: 1 },
      position: "center",
    })
    .flatten({ background: "#0a0a0a" })
    .png()
    .toFile(path.join(root, "public/apple-touch-icon.png"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
