import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultBasePath = "/";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'none'",
  "font-src 'self' data:",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join("; ");

function createBuildCspMetaPlugin(): Plugin {
  return {
    name: "ihatepdf-build-csp-meta",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: contentSecurityPolicy,
          },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

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
  plugins: [createBuildCspMetaPlugin(), react(), tailwindcss()],
  optimizeDeps: {
    include: [
      "@pdfsmaller/pdf-decrypt",
      "@pdfsmaller/pdf-encrypt",
      "jszip",
      "pdf-lib",
      "pdfjs-dist/legacy/build/pdf.mjs",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
