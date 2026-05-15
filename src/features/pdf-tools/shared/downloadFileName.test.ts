import { describe, expect, it } from "vitest";

import { sanitizeDownloadFileName } from "./downloadFileName";

describe("sanitizeDownloadFileName", () => {
  it("removes invalid characters and keeps extension", () => {
    expect(
      sanitizeDownloadFileName(
        "informe:final.pdf",
        "ihatepdf-merged.pdf",
        "application/pdf",
      ),
    ).toBe("informefinal.pdf");
  });

  it("falls back when name is empty", () => {
    expect(
      sanitizeDownloadFileName("   ", "ihatepdf-merged.pdf", "application/pdf"),
    ).toBe("ihatepdf-merged.pdf");
  });

  it("preserves zip extension from fallback", () => {
    expect(
      sanitizeDownloadFileName(
        "paginas",
        "ihatepdf-split-pages.zip",
        "application/zip",
      ),
    ).toBe("paginas.zip");
  });
});
