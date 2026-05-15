import type { ImageInputFile } from "@/features/pdf-tools/shared/pdfOperation.types";

const PNG_MIME_TYPE = "image/png";
const JPEG_MIME_TYPE = "image/jpeg";
const WEBP_MIME_TYPE = "image/webp";

function getNormalizedImageMimeType(file: File): string {
  const normalizedName = file.name.toLowerCase();

  if (file.type === PNG_MIME_TYPE || normalizedName.endsWith(".png")) {
    return PNG_MIME_TYPE;
  }

  if (
    file.type === JPEG_MIME_TYPE ||
    normalizedName.endsWith(".jpg") ||
    normalizedName.endsWith(".jpeg")
  ) {
    return JPEG_MIME_TYPE;
  }

  if (file.type === WEBP_MIME_TYPE || normalizedName.endsWith(".webp")) {
    return WEBP_MIME_TYPE;
  }

  return file.type || JPEG_MIME_TYPE;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(previewUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error(`No se pudo leer la imagen ${file.name}.`));
    };
    image.src = previewUrl;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo preparar la imagen para el PDF."));
        return;
      }
      resolve(blob);
    }, PNG_MIME_TYPE);
  });
}

async function convertWebpToPng(file: File): Promise<ImageInputFile> {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("El navegador no pudo convertir la imagen WebP.");
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  const blob = await canvasToPngBlob(canvas);
  const buffer = await blob.arrayBuffer();
  const convertedName = file.name.replace(/\.webp$/i, ".png");

  canvas.width = 0;
  canvas.height = 0;

  return {
    name: convertedName,
    mimeType: PNG_MIME_TYPE,
    buffer,
  };
}

export async function toPdfImageInputFile(file: File): Promise<ImageInputFile> {
  const mimeType = getNormalizedImageMimeType(file);

  if (mimeType === WEBP_MIME_TYPE) {
    return convertWebpToPng(file);
  }

  return {
    name: file.name,
    mimeType,
    buffer: await file.arrayBuffer(),
  };
}
