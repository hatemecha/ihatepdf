import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultBasePath = "/";

function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath) {
    return defaultBasePath;
  }

  const trimmedBasePath = basePath.trim();
  if (!trimmedBasePath || trimmedBasePath === defaultBasePath) {
    return defaultBasePath;
  }

  return `/${trimmedBasePath.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
