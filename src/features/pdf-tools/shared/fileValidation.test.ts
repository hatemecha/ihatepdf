import { describe, expect, it } from "vitest";

import {
  MAX_MERGE_FILE_COUNT,
  MAX_MERGE_TOTAL_SIZE_BYTES,
  MAX_PDF_FILE_SIZE_BYTES,
  formatFileSize,
  isPdfFile,
  isSupportedImageFile,
  validateImageFiles,
  validateMergePdfFiles,
  validateSinglePdfFile,
  type PdfFileLike,
} from "./fileValidation";

function createFile(overrides: Partial<PdfFileLike> = {}): PdfFileLike {
  return {
    name: "document.pdf",
    size: 1024,
    type: "application/pdf",
    ...overrides,
  };
}

describe("fileValidation", () => {
  it("detects PDFs by MIME type or extension", () => {
    expect(isPdfFile(createFile({ type: "application/pdf" }))).toBe(true);
    expect(isPdfFile(createFile({ name: "scan.PDF", type: "" }))).toBe(true);
    expect(isPdfFile(createFile({ name: "scan.png", type: "image/png" }))).toBe(
      false,
    );
  });

  it("requires two files before merging", () => {
    const result = validateMergePdfFiles([createFile()]);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Selecciona al menos 2 archivos PDF.");
  });

  it("allows file picking before the minimum count is reached", () => {
    const result = validateMergePdfFiles([createFile()], {
      requireMinimumFileCount: false,
    });

    expect(result.isValid).toBe(true);
  });

  it("rejects too many files", () => {
    const files = Array.from({ length: MAX_MERGE_FILE_COUNT + 1 }, (_, index) =>
      createFile({ name: `file-${index}.pdf` }),
    );

    const result = validateMergePdfFiles(files);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      `Puedes unir hasta ${MAX_MERGE_FILE_COUNT} PDFs por vez.`,
    );
  });

  it("rejects oversized files and oversized batches", () => {
    const result = validateMergePdfFiles([
      createFile({ size: MAX_PDF_FILE_SIZE_BYTES + 1 }),
      createFile({ size: MAX_MERGE_TOTAL_SIZE_BYTES }),
    ]);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Cada PDF debe pesar menos de 50 MB.");
    expect(result.errors).toContain(
      "El lote completo debe pesar menos de 200 MB.",
    );
  });

  it("formats file sizes for user-facing messages", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
  });

  it("validates a single PDF", () => {
    expect(validateSinglePdfFile(createFile()).isValid).toBe(true);
    expect(
      validateSinglePdfFile(
        createFile({ name: "image.png", type: "image/png" }),
      ).errors,
    ).toContain("Solo se admiten archivos PDF.");
  });

  it("detects supported image files", () => {
    expect(
      isSupportedImageFile({
        name: "photo.jpg",
        size: 1024,
        type: "image/jpeg",
      }),
    ).toBe(true);
    expect(
      isSupportedImageFile({
        name: "photo.webp",
        size: 1024,
        type: "image/webp",
      }),
    ).toBe(false);
  });

  it("validates image batches", () => {
    const result = validateImageFiles([
      { name: "scan.png", size: 1024, type: "image/png" },
    ]);

    expect(result.isValid).toBe(true);
    expect(validateImageFiles([]).errors).toContain(
      "Selecciona al menos una imagen.",
    );
  });
});
