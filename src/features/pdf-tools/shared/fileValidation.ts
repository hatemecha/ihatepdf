export interface PdfFileLike {
  name: string;
  size: number;
  type?: string;
}

export interface ImageFileLike {
  name: string;
  size: number;
  type?: string;
}

export interface PdfValidationOptions {
  requireMinimumFileCount?: boolean;
}

export interface PdfValidationResult {
  isValid: boolean;
  errors: string[];
}

export const MIN_MERGE_FILE_COUNT = 2;
export const MAX_MERGE_FILE_COUNT = 20;
export const MAX_PDF_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_MERGE_TOTAL_SIZE_BYTES = 200 * 1024 * 1024;
export const MAX_IMAGE_FILE_COUNT = 40;
export const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_TOTAL_SIZE_BYTES = 200 * 1024 * 1024;

export function isPdfFile(file: PdfFileLike): boolean {
  const normalizedName = file.name.toLowerCase();
  return file.type === "application/pdf" || normalizedName.endsWith(".pdf");
}

export function isSupportedImageFile(file: ImageFileLike): boolean {
  const normalizedName = file.name.toLowerCase();
  return (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    normalizedName.endsWith(".jpg") ||
    normalizedName.endsWith(".jpeg") ||
    normalizedName.endsWith(".png")
  );
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function validateMergePdfFiles(
  files: PdfFileLike[],
  options: PdfValidationOptions = {},
): PdfValidationResult {
  const errors: string[] = [];
  const requireMinimumFileCount = options.requireMinimumFileCount ?? true;

  if (requireMinimumFileCount && files.length < MIN_MERGE_FILE_COUNT) {
    errors.push("Selecciona al menos 2 archivos PDF.");
  }

  if (files.length > MAX_MERGE_FILE_COUNT) {
    errors.push(`Puedes unir hasta ${MAX_MERGE_FILE_COUNT} PDFs por vez.`);
  }

  const invalidFiles = files.filter((file) => !isPdfFile(file));
  if (invalidFiles.length > 0) {
    errors.push("Solo se admiten archivos PDF.");
  }

  const oversizedFiles = files.filter(
    (file) => file.size > MAX_PDF_FILE_SIZE_BYTES,
  );
  if (oversizedFiles.length > 0) {
    errors.push(
      `Cada PDF debe pesar menos de ${formatFileSize(MAX_PDF_FILE_SIZE_BYTES)}.`,
    );
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_MERGE_TOTAL_SIZE_BYTES) {
    errors.push(
      `El lote completo debe pesar menos de ${formatFileSize(
        MAX_MERGE_TOTAL_SIZE_BYTES,
      )}.`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateSinglePdfFile(file: PdfFileLike): PdfValidationResult {
  const errors: string[] = [];

  if (!isPdfFile(file)) {
    errors.push("Solo se admiten archivos PDF.");
  }

  if (file.size > MAX_PDF_FILE_SIZE_BYTES) {
    errors.push(
      `El PDF debe pesar menos de ${formatFileSize(MAX_PDF_FILE_SIZE_BYTES)}.`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateImageFiles(
  files: ImageFileLike[],
): PdfValidationResult {
  const errors: string[] = [];

  if (files.length === 0) {
    errors.push("Selecciona al menos una imagen.");
  }

  if (files.length > MAX_IMAGE_FILE_COUNT) {
    errors.push(
      `Puedes convertir hasta ${MAX_IMAGE_FILE_COUNT} imagenes por vez.`,
    );
  }

  const invalidFiles = files.filter((file) => !isSupportedImageFile(file));
  if (invalidFiles.length > 0) {
    errors.push("Solo se admiten imagenes JPG o PNG.");
  }

  const oversizedFiles = files.filter(
    (file) => file.size > MAX_IMAGE_FILE_SIZE_BYTES,
  );
  if (oversizedFiles.length > 0) {
    errors.push(
      `Cada imagen debe pesar menos de ${formatFileSize(
        MAX_IMAGE_FILE_SIZE_BYTES,
      )}.`,
    );
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_IMAGE_TOTAL_SIZE_BYTES) {
    errors.push(
      `El lote completo debe pesar menos de ${formatFileSize(
        MAX_IMAGE_TOTAL_SIZE_BYTES,
      )}.`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
