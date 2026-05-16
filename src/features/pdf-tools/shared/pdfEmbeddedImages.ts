import type { PDFPageProxy } from "pdfjs-dist";

export interface PdfImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedPdfImage {
  data: Uint8Array;
  width: number;
  height: number;
  type: "png";
  bounds?: PdfImageBounds;
}

export interface PdfImageExtractionOperators {
  paintImageOps: readonly number[];
  saveOp?: number;
  restoreOp?: number;
  transformOp?: number;
}

interface PdfPaintedImage {
  width: number;
  height: number;
  bitmap?: ImageBitmap;
  data?: Uint8ClampedArray;
}

async function imageObjectToPngBytes(
  imgObj: PdfPaintedImage,
  bounds?: PdfImageBounds,
): Promise<ExtractedPdfImage | null> {
  if (!imgObj.width || !imgObj.height) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = imgObj.width;
  canvas.height = imgObj.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  if (imgObj.bitmap) {
    context.drawImage(imgObj.bitmap, 0, 0);
  } else if (imgObj.data) {
    const imageData = context.createImageData(imgObj.width, imgObj.height);
    const pixelCount = imgObj.width * imgObj.height;

    if (imgObj.data.length === pixelCount * 4) {
      imageData.data.set(imgObj.data);
    } else if (imgObj.data.length === pixelCount * 3) {
      for (let index = 0, offset = 0; index < imgObj.data.length; index += 3) {
        imageData.data[offset] = imgObj.data[index];
        imageData.data[offset + 1] = imgObj.data[index + 1];
        imageData.data[offset + 2] = imgObj.data[index + 2];
        imageData.data[offset + 3] = 255;
        offset += 4;
      }
    } else {
      return null;
    }

    context.putImageData(imageData, 0, 0);
  } else {
    return null;
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  canvas.width = 0;
  canvas.height = 0;

  if (!blob) {
    return null;
  }

  const buffer = await blob.arrayBuffer();
  return {
    data: new Uint8Array(buffer),
    width: imgObj.width,
    height: imgObj.height,
    type: "png",
    bounds,
  };
}

type PdfMatrix = [number, number, number, number, number, number];

const IDENTITY_MATRIX: PdfMatrix = [1, 0, 0, 1, 0, 0];

function isPdfPaintedImage(value: unknown): value is PdfPaintedImage {
  return (
    typeof value === "object" &&
    value !== null &&
    "width" in value &&
    "height" in value &&
    typeof (value as PdfPaintedImage).width === "number" &&
    typeof (value as PdfPaintedImage).height === "number"
  );
}

function normalizeOperators(
  operators: readonly number[] | PdfImageExtractionOperators,
): PdfImageExtractionOperators {
  return "paintImageOps" in operators
    ? operators
    : { paintImageOps: operators };
}

function toPdfMatrix(value: unknown): PdfMatrix | null {
  if (!Array.isArray(value) || value.length < 6) {
    return null;
  }

  const matrix = value.slice(0, 6).map(Number);
  if (matrix.some((entry) => !Number.isFinite(entry))) {
    return null;
  }

  return matrix as PdfMatrix;
}

function multiplyMatrices(left: PdfMatrix, right: PdfMatrix): PdfMatrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function transformPoint(
  matrix: PdfMatrix,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function boundsFromCurrentMatrix(
  matrix: PdfMatrix,
): PdfImageBounds | undefined {
  const points = [
    transformPoint(matrix, 0, 0),
    transformPoint(matrix, 1, 0),
    transformPoint(matrix, 0, 1),
    transformPoint(matrix, 1, 1),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) {
    return undefined;
  }

  return {
    x: minX,
    y: minY,
    width,
    height,
  };
}

async function resolvePaintedImage(
  page: PDFPageProxy,
  objectId: string,
): Promise<PdfPaintedImage | null> {
  if (page.objs.has(objectId)) {
    return page.objs.get(objectId) as PdfPaintedImage;
  }

  return new Promise<PdfPaintedImage | null>((resolve) => {
    page.objs.get(objectId, (value: unknown) => {
      resolve((value as PdfPaintedImage | null) ?? null);
    });
  });
}

export async function extractPageEmbeddedImages(
  page: PDFPageProxy,
  operatorsInput: readonly number[] | PdfImageExtractionOperators,
): Promise<ExtractedPdfImage[]> {
  const operatorList = await page.getOperatorList();
  const operators = normalizeOperators(operatorsInput);
  const paintImageOpSet = new Set(operators.paintImageOps);
  const occurrences: Array<{
    objectId?: string;
    imageObject?: PdfPaintedImage;
    bounds?: PdfImageBounds;
  }> = [];
  const matrixStack: PdfMatrix[] = [];
  let currentMatrix: PdfMatrix = [...IDENTITY_MATRIX];

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operator = operatorList.fnArray[index];
    const args = operatorList.argsArray[index] ?? [];

    if (operator === operators.saveOp) {
      matrixStack.push([...currentMatrix]);
      continue;
    }

    if (operator === operators.restoreOp) {
      currentMatrix = matrixStack.pop() ?? [...IDENTITY_MATRIX];
      continue;
    }

    if (operator === operators.transformOp) {
      const nextMatrix = toPdfMatrix(args);
      if (nextMatrix) {
        currentMatrix = multiplyMatrices(currentMatrix, nextMatrix);
      }
      continue;
    }

    if (!paintImageOpSet.has(operator)) {
      continue;
    }

    const imageArg = args[0];
    if (typeof imageArg === "string") {
      occurrences.push({
        objectId: imageArg,
        bounds: boundsFromCurrentMatrix(currentMatrix),
      });
      continue;
    }

    if (isPdfPaintedImage(imageArg)) {
      occurrences.push({
        imageObject: imageArg,
        bounds: boundsFromCurrentMatrix(currentMatrix),
      });
    }
  }

  const imageCache = new Map<string, Promise<ExtractedPdfImage | null>>();
  const images = await Promise.all(
    occurrences.map(async (occurrence) => {
      try {
        if (occurrence.imageObject) {
          return imageObjectToPngBytes(
            occurrence.imageObject,
            occurrence.bounds,
          );
        }

        if (!occurrence.objectId) {
          return null;
        }

        let imagePromise = imageCache.get(occurrence.objectId);
        if (!imagePromise) {
          imagePromise = resolvePaintedImage(page, occurrence.objectId).then(
            (imageObject) =>
              imageObject ? imageObjectToPngBytes(imageObject) : null,
          );
          imageCache.set(occurrence.objectId, imagePromise);
        }

        const imageObject = await imagePromise;
        if (!imageObject) {
          return null;
        }

        return {
          ...imageObject,
          bounds: occurrence.bounds,
        };
      } catch {
        return null;
      }
    }),
  );

  return images.flatMap((image) => (image ? [image] : []));
}
