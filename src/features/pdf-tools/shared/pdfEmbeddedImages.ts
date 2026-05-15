import type { PDFPageProxy } from "pdfjs-dist";

export interface ExtractedPdfImage {
  data: Uint8Array;
  width: number;
  height: number;
  type: "png";
}

interface PdfPaintedImage {
  width: number;
  height: number;
  bitmap?: ImageBitmap;
  data?: Uint8ClampedArray;
}

async function imageObjectToPngBytes(
  imgObj: PdfPaintedImage,
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
  paintImageOps: readonly number[],
): Promise<ExtractedPdfImage[]> {
  const operatorList = await page.getOperatorList();
  const seenObjectIds = new Set<string>();
  const images: ExtractedPdfImage[] = [];

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operator = operatorList.fnArray[index];
    if (!paintImageOps.includes(operator)) {
      continue;
    }

    const objectId = operatorList.argsArray[index]?.[0];
    if (typeof objectId !== "string" || seenObjectIds.has(objectId)) {
      continue;
    }
    seenObjectIds.add(objectId);

    try {
      const imageObject = await resolvePaintedImage(page, objectId);
      if (!imageObject) {
        continue;
      }

      const pngImage = await imageObjectToPngBytes(imageObject);
      if (pngImage) {
        images.push(pngImage);
      }
    } catch {
      // Skip images that cannot be decoded in this environment.
    }
  }

  return images;
}
