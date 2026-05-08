import { copyFile, access } from "node:fs/promises";
import path from "node:path";

const distDirectory = path.resolve("dist");
const indexPath = path.join(distDirectory, "index.html");
const fallbackPath = path.join(distDirectory, "404.html");

try {
  await access(indexPath);
  await copyFile(indexPath, fallbackPath);
  console.log("Created dist/404.html for SPA routing.");
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown filesystem error.";
  console.error(`Could not create SPA fallback: ${message}`);
  process.exitCode = 1;
}
