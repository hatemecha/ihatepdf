/** Public site URL without trailing slash (canonical origin). */
export const SITE_URL =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, "") ??
  (import.meta.env.DEV
    ? `http://localhost:5173${normalizeBaseForUrl(import.meta.env.BASE_URL)}`
    : `https://hatemecha.github.io${normalizeBaseForUrl(import.meta.env.BASE_URL)}`);

export const SITE_NAME = "iHatePDF";
export const SITE_TAGLINE =
  "Herramientas PDF gratis en el navegador, sin subir archivos";
export const SITE_DESCRIPTION =
  "Une, divide, comprime y convierte PDFs en tu navegador. iHatePDF es gratis, privado y no requiere cuenta: tus archivos no salen de tu dispositivo.";
export const SITE_KEYWORDS = [
  "ihatepdf",
  "herramientas pdf online",
  "editar pdf sin subir",
  "unir pdf gratis",
  "comprimir pdf navegador",
  "dividir pdf online",
  "pdf privado local",
  "alternativa pdf gratis",
  "convertir pdf word",
  "pdf a imagenes",
].join(", ");

export const REPO_URL = "https://github.com/hatemecha/iHatePDF";

export function getAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base =
    import.meta.env.BASE_URL === "/"
      ? ""
      : import.meta.env.BASE_URL.replace(/\/$/, "");
  const suffix = normalizedPath === "/" ? "" : normalizedPath;
  return `${SITE_URL}${base}${suffix}`;
}

export function getOgImageUrl(): string {
  return getAbsoluteUrl("/brand/logo-512.png");
}

function normalizeBaseForUrl(baseUrl: string): string {
  if (!baseUrl || baseUrl === "/") {
    return "";
  }
  return baseUrl.replace(/\/$/, "");
}
