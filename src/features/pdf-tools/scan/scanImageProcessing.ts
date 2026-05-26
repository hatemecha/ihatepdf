export type ScanEnhancementMode = "color" | "mono";

export interface ScanProcessingOptions {
  autoCrop: boolean;
  enhance: boolean;
  enhancementMode: ScanEnhancementMode;
}

export interface Point {
  x: number;
  y: number;
}

export interface ProcessedDocumentImage {
  file: File;
  documentDetected: boolean;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
}

interface Component {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number[];
}

const JPEG_MIME_TYPE = "image/jpeg";
const SOURCE_MAX_EDGE = 3000;
const DETECTION_MAX_EDGE = 760;
const OUTPUT_MAX_EDGE = 2600;
const MIN_DOCUMENT_AREA_RATIO = 0.045;

export async function processDocumentImage(
  file: File,
  options: ScanProcessingOptions,
): Promise<ProcessedDocumentImage> {
  const image = await loadRasterImage(file);
  const { width: imageWidth, height: imageHeight } = getRasterImageSize(image);
  const sourceCanvas = drawImageToCanvas(image, SOURCE_MAX_EDGE);

  if ("close" in image) {
    image.close();
  }

  try {
    const detectedCorners = options.autoCrop
      ? detectDocumentCorners(sourceCanvas)
      : null;
    const outputCanvas = detectedCorners
      ? rectifyDocument(sourceCanvas, detectedCorners)
      : copyCanvasWithinMaxEdge(sourceCanvas, OUTPUT_MAX_EDGE);

    try {
      if (options.enhance) {
        enhanceDocumentCanvas(outputCanvas, options.enhancementMode);
      }

      const outputFile = await canvasToJpegFile(outputCanvas, file.name);
      const outputWidth = outputCanvas.width;
      const outputHeight = outputCanvas.height;

      return {
        file: outputFile,
        documentDetected: detectedCorners !== null,
        originalWidth: imageWidth,
        originalHeight: imageHeight,
        outputWidth,
        outputHeight,
      };
    } finally {
      outputCanvas.width = 0;
      outputCanvas.height = 0;
    }
  } finally {
    sourceCanvas.width = 0;
    sourceCanvas.height = 0;
  }
}

function loadRasterImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(
      () => loadImageElement(file),
    );
  }

  return loadImageElement(file);
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
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

function getRasterImageSize(image: ImageBitmap | HTMLImageElement) {
  if ("naturalWidth" in image) {
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  }

  return {
    width: image.width,
    height: image.height,
  };
}

function drawImageToCanvas(
  image: ImageBitmap | HTMLImageElement,
  maxEdge: number,
): HTMLCanvasElement {
  const { width, height } = getRasterImageSize(image);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  const context = getCanvasContext(canvas);

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
}

function copyCanvasWithinMaxEdge(
  sourceCanvas: HTMLCanvasElement,
  maxEdge: number,
): HTMLCanvasElement {
  const scale = Math.min(
    1,
    maxEdge / Math.max(sourceCanvas.width, sourceCanvas.height),
  );
  const outputCanvas = document.createElement("canvas");
  const outputContext = getCanvasContext(outputCanvas);

  outputCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  outputCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(
    sourceCanvas,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height,
  );

  return outputCanvas;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("El navegador no pudo preparar el escaneo.");
  }
  return context;
}

function detectDocumentCorners(
  sourceCanvas: HTMLCanvasElement,
): Point[] | null {
  const detectionCanvas = copyCanvasWithinMaxEdge(
    sourceCanvas,
    DETECTION_MAX_EDGE,
  );
  const context = getCanvasContext(detectionCanvas);
  const imageData = context.getImageData(
    0,
    0,
    detectionCanvas.width,
    detectionCanvas.height,
  );
  const mask = createPaperMask(imageData);
  const component = findLargestComponent(
    mask,
    detectionCanvas.width,
    detectionCanvas.height,
  );

  detectionCanvas.width = 0;
  detectionCanvas.height = 0;

  if (!component) {
    return null;
  }

  const imageArea = imageData.width * imageData.height;
  const boxWidth = component.maxX - component.minX + 1;
  const boxHeight = component.maxY - component.minY + 1;

  if (
    component.area / imageArea < MIN_DOCUMENT_AREA_RATIO ||
    boxWidth / imageData.width < 0.18 ||
    boxHeight / imageData.height < 0.18
  ) {
    return null;
  }

  const detectionCorners = expandCorners(
    estimateCornersFromComponent(component, imageData.width),
    imageData.width,
    imageData.height,
    1.018,
  );
  const scaleX = sourceCanvas.width / imageData.width;
  const scaleY = sourceCanvas.height / imageData.height;
  const sourceCorners = detectionCorners.map((point) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  }));

  if (
    !isUsableQuadrilateral(
      sourceCorners,
      sourceCanvas.width,
      sourceCanvas.height,
    )
  ) {
    return null;
  }

  return sourceCorners;
}

function createPaperMask(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const histogram = new Uint32Array(256);
  const luminance = new Uint8Array(width * height);

  for (let pixel = 0, index = 0; index < data.length; pixel += 1, index += 4) {
    const value = getLuminance(data[index], data[index + 1], data[index + 2]);
    luminance[pixel] = value;
    histogram[value] += 1;
  }

  const threshold = clamp(otsuThreshold(histogram) + 8, 116, 224);
  const mask = new Uint8Array(width * height);

  for (let pixel = 0, index = 0; index < data.length; pixel += 1, index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const saturation =
      maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
    const value = luminance[pixel];

    if (value >= threshold && (saturation < 0.42 || value > 184)) {
      mask[pixel] = 1;
    }
  }

  return closeMask(mask, width, height);
}

function closeMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  return erodeMask(dilateMask(mask, width, height), width, height);
}

function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const output = new Uint8Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] === 1) {
        output[index] = 1;
        continue;
      }

      for (
        let offsetY = -1;
        offsetY <= 1 && output[index] === 0;
        offsetY += 1
      ) {
        const neighborY = y + offsetY;
        if (neighborY < 0 || neighborY >= height) continue;
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const neighborX = x + offsetX;
          if (neighborX < 0 || neighborX >= width) continue;
          if (mask[neighborY * width + neighborX] === 1) {
            output[index] = 1;
            break;
          }
        }
      }
    }
  }

  return output;
}

function erodeMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const output = new Uint8Array(mask.length);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let keep = true;

      for (let offsetY = -1; offsetY <= 1 && keep; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (mask[(y + offsetY) * width + x + offsetX] === 0) {
            keep = false;
            break;
          }
        }
      }

      output[y * width + x] = keep ? 1 : 0;
    }
  }

  return output;
}

function findLargestComponent(
  mask: Uint8Array,
  width: number,
  height: number,
): Component | null {
  const visited = new Uint8Array(mask.length);
  let bestComponent: Component | null = null;

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0 || visited[index] === 1) {
      continue;
    }

    const component = floodFillComponent(index, mask, visited, width, height);
    if (!bestComponent || component.area > bestComponent.area) {
      bestComponent = component;
    }
  }

  return bestComponent;
}

function floodFillComponent(
  startIndex: number,
  mask: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
): Component {
  const stack = [startIndex];
  const pixels: number[] = [];
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  visited[startIndex] = 1;

  while (stack.length > 0) {
    const index = stack.pop();
    if (index === undefined) {
      break;
    }

    pixels.push(index);
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    visitNeighbor(index - 1, x > 0);
    visitNeighbor(index + 1, x < width - 1);
    visitNeighbor(index - width, y > 0);
    visitNeighbor(index + width, y < height - 1);
  }

  function visitNeighbor(neighborIndex: number, isInside: boolean) {
    if (isInside && mask[neighborIndex] === 1 && visited[neighborIndex] === 0) {
      visited[neighborIndex] = 1;
      stack.push(neighborIndex);
    }
  }

  return {
    area: pixels.length,
    minX,
    minY,
    maxX,
    maxY,
    pixels,
  };
}

function estimateCornersFromComponent(
  component: Component,
  width: number,
): Point[] {
  return [
    averageExtremePoint(component.pixels, width, "min-sum"),
    averageExtremePoint(component.pixels, width, "max-diff"),
    averageExtremePoint(component.pixels, width, "max-sum"),
    averageExtremePoint(component.pixels, width, "min-diff"),
  ];
}

type ExtremeMode = "min-sum" | "max-sum" | "min-diff" | "max-diff";

function averageExtremePoint(
  pixels: number[],
  width: number,
  mode: ExtremeMode,
): Point {
  let extreme = mode.startsWith("min") ? Number.POSITIVE_INFINITY : 0;

  for (const index of pixels) {
    const x = index % width;
    const y = Math.floor(index / width);
    const value = mode.endsWith("sum") ? x + y : x - y;

    if (mode.startsWith("min")) {
      extreme = Math.min(extreme, value);
    } else {
      extreme = Math.max(extreme, value);
    }
  }

  const tolerance = Math.max(3, Math.sqrt(pixels.length) * 0.045);
  let totalX = 0;
  let totalY = 0;
  let count = 0;

  for (const index of pixels) {
    const x = index % width;
    const y = Math.floor(index / width);
    const value = mode.endsWith("sum") ? x + y : x - y;
    const isExtreme = mode.startsWith("min")
      ? value <= extreme + tolerance
      : value >= extreme - tolerance;

    if (isExtreme) {
      totalX += x;
      totalY += y;
      count += 1;
    }
  }

  if (count === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: totalX / count,
    y: totalY / count,
  };
}

function expandCorners(
  corners: Point[],
  width: number,
  height: number,
  amount: number,
): Point[] {
  const center = corners.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x / corners.length,
      y: accumulator.y + point.y / corners.length,
    }),
    { x: 0, y: 0 },
  );

  return corners.map((point) => ({
    x: clamp(center.x + (point.x - center.x) * amount, 0, width - 1),
    y: clamp(center.y + (point.y - center.y) * amount, 0, height - 1),
  }));
}

function isUsableQuadrilateral(
  corners: Point[],
  sourceWidth: number,
  sourceHeight: number,
): boolean {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const area = Math.abs(
    corners.reduce((total, point, index) => {
      const next = corners[(index + 1) % corners.length];
      return total + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
  const minSide = Math.min(
    distance(topLeft, topRight),
    distance(topRight, bottomRight),
    distance(bottomRight, bottomLeft),
    distance(bottomLeft, topLeft),
  );

  return (
    Number.isFinite(area) &&
    area > sourceWidth * sourceHeight * MIN_DOCUMENT_AREA_RATIO &&
    minSide > Math.min(sourceWidth, sourceHeight) * 0.12
  );
}

function rectifyDocument(
  sourceCanvas: HTMLCanvasElement,
  corners: Point[],
): HTMLCanvasElement {
  const outputSize = resolveDocumentOutputSize(corners);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputSize.width;
  outputCanvas.height = outputSize.height;

  const sourceContext = getCanvasContext(sourceCanvas);
  const sourceData = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );
  const outputContext = getCanvasContext(outputCanvas);
  const outputData = outputContext.createImageData(
    outputCanvas.width,
    outputCanvas.height,
  );
  const transform = computeHomography(
    [
      { x: 0, y: 0 },
      { x: outputCanvas.width - 1, y: 0 },
      { x: outputCanvas.width - 1, y: outputCanvas.height - 1 },
      { x: 0, y: outputCanvas.height - 1 },
    ],
    corners,
  );

  warpPerspective(sourceData, outputData, transform);
  outputContext.putImageData(outputData, 0, 0);

  return outputCanvas;
}

export function resolveDocumentOutputSize(corners: Point[]) {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const width = Math.max(
    distance(topLeft, topRight),
    distance(bottomLeft, bottomRight),
  );
  const height = Math.max(
    distance(topLeft, bottomLeft),
    distance(topRight, bottomRight),
  );
  const scale = Math.min(1, OUTPUT_MAX_EDGE / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function warpPerspective(
  sourceData: ImageData,
  outputData: ImageData,
  transform: number[],
) {
  const source = sourceData.data;
  const output = outputData.data;
  const sourceWidth = sourceData.width;
  const sourceHeight = sourceData.height;
  const outputWidth = outputData.width;
  const outputHeight = outputData.height;

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const denominator = transform[6] * x + transform[7] * y + 1;
      const sourceX = clamp(
        (transform[0] * x + transform[1] * y + transform[2]) / denominator,
        0,
        sourceWidth - 1,
      );
      const sourceY = clamp(
        (transform[3] * x + transform[4] * y + transform[5]) / denominator,
        0,
        sourceHeight - 1,
      );
      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      const x1 = Math.min(sourceWidth - 1, x0 + 1);
      const y1 = Math.min(sourceHeight - 1, y0 + 1);
      const dx = sourceX - x0;
      const dy = sourceY - y0;
      const topLeftIndex = (y0 * sourceWidth + x0) * 4;
      const topRightIndex = (y0 * sourceWidth + x1) * 4;
      const bottomLeftIndex = (y1 * sourceWidth + x0) * 4;
      const bottomRightIndex = (y1 * sourceWidth + x1) * 4;
      const outputIndex = (y * outputWidth + x) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        const top =
          source[topLeftIndex + channel] * (1 - dx) +
          source[topRightIndex + channel] * dx;
        const bottom =
          source[bottomLeftIndex + channel] * (1 - dx) +
          source[bottomRightIndex + channel] * dx;
        output[outputIndex + channel] = top * (1 - dy) + bottom * dy;
      }
    }
  }
}

export function computeHomography(from: Point[], to: Point[]): number[] {
  const matrix: number[][] = [];
  const vector: number[] = [];

  for (let index = 0; index < 4; index += 1) {
    const source = from[index];
    const target = to[index];

    matrix.push([
      source.x,
      source.y,
      1,
      0,
      0,
      0,
      -target.x * source.x,
      -target.x * source.y,
    ]);
    vector.push(target.x);

    matrix.push([
      0,
      0,
      0,
      source.x,
      source.y,
      1,
      -target.y * source.x,
      -target.y * source.y,
    ]);
    vector.push(target.y);
  }

  return solveLinearSystem(matrix, vector);
}

export function applyHomography(transform: number[], point: Point): Point {
  const denominator = transform[6] * point.x + transform[7] * point.y + 1;
  return {
    x:
      (transform[0] * point.x + transform[1] * point.y + transform[2]) /
      denominator,
    y:
      (transform[3] * point.x + transform[4] * point.y + transform[5]) /
      denominator,
  };
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row;
      }
    }

    [augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ];

    const pivot = augmented[column][column];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error("No se pudo calcular la perspectiva del documento.");
    }

    for (let valueIndex = column; valueIndex <= size; valueIndex += 1) {
      augmented[column][valueIndex] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }
      const factor = augmented[row][column];
      for (let valueIndex = column; valueIndex <= size; valueIndex += 1) {
        augmented[row][valueIndex] -= factor * augmented[column][valueIndex];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function enhanceDocumentCanvas(
  canvas: HTMLCanvasElement,
  mode: ScanEnhancementMode,
) {
  const context = getCanvasContext(canvas);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const histogram = new Uint32Array(256);

  for (let index = 0; index < data.length; index += 4) {
    histogram[getLuminance(data[index], data[index + 1], data[index + 2])] += 1;
  }

  const low = percentile(
    histogram,
    data.length / 4,
    mode === "mono" ? 0.025 : 0.01,
  );
  const high = percentile(
    histogram,
    data.length / 4,
    mode === "mono" ? 0.985 : 0.995,
  );
  const span = Math.max(28, high - low);

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = getLuminance(red, green, blue);
    const normalized = clamp(((luminance - low) / span) * 255, 0, 255);
    const lifted = 255 * Math.pow(normalized / 255, 0.92);

    if (mode === "mono") {
      const value = lifted < 145 ? lifted * 0.72 : 255 - (255 - lifted) * 0.48;
      const byte = clampByte(value);
      data[index] = byte;
      data[index + 1] = byte;
      data[index + 2] = byte;
    } else {
      const factor = lifted / Math.max(luminance, 1);
      data[index] = clampByte((red * factor - 128) * 1.05 + 131);
      data[index + 1] = clampByte((green * factor - 128) * 1.05 + 131);
      data[index + 2] = clampByte((blue * factor - 128) * 1.05 + 131);
    }

    data[index + 3] = 255;
  }

  sharpenImageData(imageData, mode === "mono" ? 0.16 : 0.1);
  context.putImageData(imageData, 0, 0);
}

function sharpenImageData(imageData: ImageData, amount: number) {
  const { data, width, height } = imageData;
  const original = new Uint8ClampedArray(data);
  const centerWeight = 1 + amount * 4;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      const left = index - 4;
      const right = index + 4;
      const top = index - width * 4;
      const bottom = index + width * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        data[index + channel] = clampByte(
          original[index + channel] * centerWeight -
            (original[left + channel] +
              original[right + channel] +
              original[top + channel] +
              original[bottom + channel]) *
              amount,
        );
      }
    }
  }
}

function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  originalName: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo preparar la imagen escaneada."));
          return;
        }

        resolve(
          new File([blob], createScanFileName(originalName), {
            type: JPEG_MIME_TYPE,
            lastModified: Date.now(),
          }),
        );
      },
      JPEG_MIME_TYPE,
      0.92,
    );
  });
}

function createScanFileName(originalName: string): string {
  const baseName = originalName.replace(/\.[^.]+$/u, "").trim() || "scan";
  return `${baseName}-escaneado.jpg`;
}

function otsuThreshold(histogram: Uint32Array): number {
  const total = histogram.reduce((sum, value) => sum + value, 0);
  let weightedTotal = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    weightedTotal += index * histogram[index];
  }

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = 0;
  let threshold = 128;

  for (let index = 0; index < histogram.length; index += 1) {
    backgroundWeight += histogram[index];
    if (backgroundWeight === 0) continue;

    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;

    backgroundSum += index * histogram[index];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight;
    const variance =
      backgroundWeight *
      foregroundWeight *
      (backgroundMean - foregroundMean) *
      (backgroundMean - foregroundMean);

    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = index;
    }
  }

  return threshold;
}

function percentile(
  histogram: Uint32Array,
  totalPixels: number,
  ratio: number,
): number {
  const target = totalPixels * ratio;
  let cumulative = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= target) {
      return index;
    }
  }

  return histogram.length - 1;
}

function getLuminance(red: number, green: number, blue: number): number {
  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
}

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampByte(value: number): number {
  return clamp(Math.round(value), 0, 255);
}
