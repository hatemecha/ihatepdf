import { describe, expect, it } from "vitest";

import {
  buildToolPageDescription,
  buildToolPageTitle,
  formatPageTitle,
} from "@/lib/seo";

describe("formatPageTitle", () => {
  it("appends site name for tool titles", () => {
    expect(formatPageTitle("Unir PDFs online gratis")).toBe(
      "Unir PDFs online gratis | iHatePDF",
    );
  });

  it("uses tagline when title is only the brand", () => {
    expect(formatPageTitle("iHatePDF")).toBe(
      "iHatePDF — Herramientas PDF gratis en el navegador, sin subir archivos",
    );
  });
});

describe("tool page copy helpers", () => {
  it("builds search-friendly tool title", () => {
    expect(buildToolPageTitle("Comprimir PDF")).toBe(
      "Comprimir PDF online gratis",
    );
  });

  it("mentions local processing in descriptions", () => {
    const description = buildToolPageDescription(
      "Dividir PDF",
      "Genera un ZIP con un PDF por página.",
      "Separa un documento completo en archivos individuales.",
    );
    expect(description).toContain("Dividir PDF");
    expect(description).toContain("navegador");
    expect(description).toContain("no subes");
  });
});
