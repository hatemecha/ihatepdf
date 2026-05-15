const INVALID_FILE_NAME_CHARS = /[\\/:*?"<>|]/g;

function getDownloadExtension(fileName: string, mimeType?: string): string {
  const extensionMatch = fileName.match(/\.[^.]+$/);
  if (extensionMatch) {
    return extensionMatch[0].toLowerCase();
  }

  if (mimeType === "application/zip") {
    return ".zip";
  }

  return ".pdf";
}

export function sanitizeDownloadFileName(
  value: string,
  fallbackFileName: string,
  mimeType?: string,
): string {
  const fallbackExtension = getDownloadExtension(fallbackFileName, mimeType);
  const trimmedValue = value.trim().replace(INVALID_FILE_NAME_CHARS, "");
  const baseName = trimmedValue.replace(/\.[^.]+$/u, "").trim();

  if (!baseName) {
    return fallbackFileName;
  }

  return `${baseName}${fallbackExtension}`;
}
