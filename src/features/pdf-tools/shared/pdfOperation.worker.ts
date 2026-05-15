import JSZip from "jszip";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

import type {
  CropMargins,
  ImageInputFile,
  ImageToPdfOptions,
  LayoutImageAsset,
  LayoutPagePayload,
  PageNumberOptions,
  PdfInputFile,
  PdfOperationRequest,
  PdfOperationResponse,
  PdfOperationResult,
  ProtectPdfOptions,
  WatermarkOptions,
} from "./pdfOperation.types";
import { getPageNumberStandardFont } from "./pageNumberFonts";

const workerContext = self as unknown as DedicatedWorkerGlobalScope;
const PDF_MIME_TYPE = "application/pdf";
const ZIP_MIME_TYPE = "application/zip";
const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };
const LETTER_PORTRAIT = { width: 612, height: 792 };
const LETTER_LANDSCAPE = { width: 792, height: 612 };
const IMAGE_TO_PDF_MARGINS: Record<ImageToPdfOptions["margin"], number> = {
  none: 0,
  small: 18,
  normal: 36,
  large: 72,
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const outputBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(outputBuffer).set(bytes);
  return outputBuffer;
}

function createOutputFile(
  fileName: string,
  mimeType: string,
  bytes: Uint8Array,
): PdfOperationResult {
  return {
    kind: "file",
    fileName,
    mimeType,
    buffer: toArrayBuffer(bytes),
  };
}

function createErrorMessage(error: unknown): string {
  const rawMessage =
    error instanceof Error ? error.message : "No se pudo procesar el archivo.";
  const message = rawMessage.toLowerCase();

  if (message.includes("incorrect password")) {
    return "La contraseña no coincide con este PDF.";
  }

  if (message.includes("unsupported encryption")) {
    return "El cifrado de este PDF todavía no es compatible con el desbloqueo local.";
  }

  if (message.includes("not encrypted")) {
    return "El PDF no tiene contraseña para quitar.";
  }

  if (message.includes("encrypted")) {
    return "El PDF está protegido con contraseña. Desbloquéalo antes de usar esta herramienta.";
  }

  if (message.includes("invalid") || message.includes("parse")) {
    return "El archivo no parece ser un PDF válido.";
  }

  return "No se pudo procesar el archivo. Revisa que no esté corrupto o protegido.";
}

async function loadPdf(file: PdfInputFile): Promise<PDFDocument> {
  return PDFDocument.load(file.buffer);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function copyPagesToNewDocument(
  sourceDocument: PDFDocument,
  pageIndices: number[],
): Promise<PDFDocument> {
  const outputDocument = await PDFDocument.create();
  const copiedPages = await outputDocument.copyPages(
    sourceDocument,
    pageIndices,
  );
  copiedPages.forEach((page) => outputDocument.addPage(page));
  return outputDocument;
}

async function inspectPdf(file: PdfInputFile): Promise<PdfOperationResult> {
  const sourceDocument = await loadPdf(file);
  return {
    kind: "inspect",
    pageCount: sourceDocument.getPageCount(),
  };
}

async function compressPdf(files: PdfInputFile[]): Promise<PdfOperationResult> {
  if (files.length === 1) {
    const outputDocument = await loadPdf(files[0]);
    const bytes = await outputDocument.save({
      useObjectStreams: true,
      objectsPerTick: 50,
    });
    return createOutputFile("ihatepdf-compressed.pdf", PDF_MIME_TYPE, bytes);
  }

  const zip = new JSZip();
  await Promise.all(
    files.map(async (file, index) => {
      const outputDocument = await loadPdf(file);
      const bytes = await outputDocument.save({
        useObjectStreams: true,
        objectsPerTick: 50,
      });
      zip.file(`compressed-${index + 1}-${file.name}`, bytes);
    }),
  );
  return createOutputFile(
    "ihatepdf-compressed.zip",
    ZIP_MIME_TYPE,
    await zip.generateAsync({ type: "uint8array" }),
  );
}

async function watermarkPdf(
  files: PdfInputFile[],
  options: WatermarkOptions,
): Promise<PdfOperationResult> {
  const text = options.text.trim();
  if (!text) throw new Error("Escribe el texto de la marca de agua.");

  const processFile = async (file: PdfInputFile) => {
    const outputDocument = await loadPdf(file);
    const font = await outputDocument.embedFont(StandardFonts.HelveticaBold);
    for (const page of outputDocument.getPages()) {
      const { width, height } = page.getSize();
      const fontSize = clamp(options.fontSize, 12, 120);
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: (height - fontSize) / 2,
        size: fontSize,
        font,
        color: rgb(0.12, 0.12, 0.12),
        opacity: clamp(options.opacity, 0.05, 0.8),
        rotate: degrees(options.rotation),
      });
    }
    return outputDocument.save();
  };

  if (files.length === 1) {
    return createOutputFile(
      "ihatepdf-watermarked.pdf",
      PDF_MIME_TYPE,
      await processFile(files[0]),
    );
  }

  const zip = new JSZip();
  await Promise.all(
    files.map(async (file, index) => {
      zip.file(
        `watermarked-${index + 1}-${file.name}`,
        await processFile(file),
      );
    }),
  );
  return createOutputFile(
    "ihatepdf-watermarked.zip",
    ZIP_MIME_TYPE,
    await zip.generateAsync({ type: "uint8array" }),
  );
}

function getPageNumberPosition(
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  fontSize: number,
  options: PageNumberOptions,
) {
  const margin = clamp(options.margin, 12, 144);
  const isTop = options.position.startsWith("top");
  const isCenter = options.position.endsWith("center");
  const isRight = options.position.endsWith("right");

  const x = isCenter
    ? (pageWidth - textWidth) / 2
    : isRight
      ? pageWidth - margin - textWidth
      : margin;
  const y = isTop ? pageHeight - margin - fontSize : margin;

  return { x, y };
}

async function numberPages(
  files: PdfInputFile[],
  options: PageNumberOptions,
): Promise<PdfOperationResult> {
  const processFile = async (file: PdfInputFile) => {
    const outputDocument = await loadPdf(file);
    const font = await outputDocument.embedFont(
      getPageNumberStandardFont(options.font),
    );
    const fontSize = clamp(options.fontSize, 8, 48);
    const startAt = Math.max(1, Math.floor(options.startAt));

    outputDocument.getPages().forEach((page, pageIndex) => {
      const label = String(startAt + pageIndex);
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(label, fontSize);
      const { x, y } = getPageNumberPosition(
        width,
        height,
        textWidth,
        fontSize,
        options,
      );

      page.drawText(label, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.12, 0.12, 0.12),
      });
    });
    return outputDocument.save();
  };

  if (files.length === 1) {
    return createOutputFile(
      "ihatepdf-numbered.pdf",
      PDF_MIME_TYPE,
      await processFile(files[0]),
    );
  }

  const zip = new JSZip();
  await Promise.all(
    files.map(async (file, index) => {
      zip.file(`numbered-${index + 1}-${file.name}`, await processFile(file));
    }),
  );
  return createOutputFile(
    "ihatepdf-numbered.zip",
    ZIP_MIME_TYPE,
    await zip.generateAsync({ type: "uint8array" }),
  );
}

async function cropPdf(
  files: PdfInputFile[],
  margins: CropMargins,
): Promise<PdfOperationResult> {
  const processFile = async (file: PdfInputFile) => {
    const outputDocument = await loadPdf(file);
    for (const page of outputDocument.getPages()) {
      const { width, height } = page.getSize();
      const left = Math.max(0, margins.left);
      const right = Math.max(0, margins.right);
      const top = Math.max(0, margins.top);
      const bottom = Math.max(0, margins.bottom);
      const croppedWidth = width - left - right;
      const croppedHeight = height - top - bottom;

      if (croppedWidth < 36 || croppedHeight < 36) {
        throw new Error(
          "Los márgenes de recorte dejan una página demasiado pequeña.",
        );
      }

      page.setCropBox(left, bottom, croppedWidth, croppedHeight);
      page.setTrimBox(left, bottom, croppedWidth, croppedHeight);
    }
    return outputDocument.save();
  };

  if (files.length === 1) {
    return createOutputFile(
      "ihatepdf-cropped.pdf",
      PDF_MIME_TYPE,
      await processFile(files[0]),
    );
  }

  const zip = new JSZip();
  await Promise.all(
    files.map(async (file, index) => {
      zip.file(`cropped-${index + 1}-${file.name}`, await processFile(file));
    }),
  );
  return createOutputFile(
    "ihatepdf-cropped.zip",
    ZIP_MIME_TYPE,
    await zip.generateAsync({ type: "uint8array" }),
  );
}

async function protectPdf(
  files: PdfInputFile[],
  options: ProtectPdfOptions,
): Promise<PdfOperationResult> {
  if (!options.userPassword) {
    throw new Error("Escribe una contraseña para proteger el PDF.");
  }

  const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");

  const processFile = async (file: PdfInputFile) => {
    return encryptPDF(new Uint8Array(file.buffer), options.userPassword, {
      ownerPassword: options.ownerPassword || options.userPassword,
      algorithm: "AES-256",
      allowPrinting: options.allowPrinting,
      allowCopying: options.allowCopying,
      allowModifying: options.allowModifying,
    });
  };

  if (files.length === 1) {
    return createOutputFile(
      "ihatepdf-protected.pdf",
      PDF_MIME_TYPE,
      await processFile(files[0]),
    );
  }

  const zip = new JSZip();
  await Promise.all(
    files.map(async (file, index) => {
      zip.file(`protected-${index + 1}-${file.name}`, await processFile(file));
    }),
  );
  return createOutputFile(
    "ihatepdf-protected.zip",
    ZIP_MIME_TYPE,
    await zip.generateAsync({ type: "uint8array" }),
  );
}

async function unlockPdf(
  files: PdfInputFile[],
  password: string,
): Promise<PdfOperationResult> {
  if (!password) {
    throw new Error("Escribe la contraseña actual del PDF.");
  }

  const { decryptPDF } = await import("@pdfsmaller/pdf-decrypt");

  const processFile = async (file: PdfInputFile) => {
    return decryptPDF(new Uint8Array(file.buffer), password);
  };

  if (files.length === 1) {
    return createOutputFile(
      "ihatepdf-unlocked.pdf",
      PDF_MIME_TYPE,
      await processFile(files[0]),
    );
  }

  const zip = new JSZip();
  await Promise.all(
    files.map(async (file, index) => {
      zip.file(`unlocked-${index + 1}-${file.name}`, await processFile(file));
    }),
  );
  return createOutputFile(
    "ihatepdf-unlocked.zip",
    ZIP_MIME_TYPE,
    await zip.generateAsync({ type: "uint8array" }),
  );
}

async function mergePdfs(files: PdfInputFile[]): Promise<PdfOperationResult> {
  const [outputDocument, sourceDocuments] = await Promise.all([
    PDFDocument.create(),
    Promise.all(files.map((file) => loadPdf(file))),
  ]);
  const copiedPagesByDocument = await Promise.all(
    sourceDocuments.map((sourceDocument) =>
      outputDocument.copyPages(sourceDocument, sourceDocument.getPageIndices()),
    ),
  );

  for (const copiedPages of copiedPagesByDocument) {
    copiedPages.forEach((page) => outputDocument.addPage(page));
  }

  return createOutputFile(
    "ihatepdf-merged.pdf",
    PDF_MIME_TYPE,
    await outputDocument.save(),
  );
}

async function splitPdf(file: PdfInputFile): Promise<PdfOperationResult> {
  const sourceDocument = await loadPdf(file);
  const zip = new JSZip();
  const pageCount = sourceDocument.getPageCount();

  const splitPages = await Promise.all(
    Array.from({ length: pageCount }, async (_, pageIndex) => {
      const pageDocument = await copyPagesToNewDocument(sourceDocument, [
        pageIndex,
      ]);
      const pageBytes = await pageDocument.save();
      return {
        fileName: `page-${String(pageIndex + 1).padStart(3, "0")}.pdf`,
        pageBytes,
      };
    }),
  );

  for (const page of splitPages) {
    zip.file(page.fileName, page.pageBytes);
  }

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  return createOutputFile("ihatepdf-split-pages.zip", ZIP_MIME_TYPE, zipBytes);
}

async function extractPages(
  file: PdfInputFile,
  pages: number[],
): Promise<PdfOperationResult> {
  const sourceDocument = await loadPdf(file);
  const outputDocument = await copyPagesToNewDocument(sourceDocument, pages);

  return createOutputFile(
    "ihatepdf-extracted-pages.pdf",
    PDF_MIME_TYPE,
    await outputDocument.save(),
  );
}

async function deletePages(
  file: PdfInputFile,
  pagesToDelete: number[],
): Promise<PdfOperationResult> {
  const sourceDocument = await loadPdf(file);
  const pagesToDeleteSet = new Set(pagesToDelete);
  const pagesToKeep = sourceDocument
    .getPageIndices()
    .filter((pageIndex) => !pagesToDeleteSet.has(pageIndex));

  if (pagesToKeep.length === 0) {
    throw new Error("No puedes eliminar todas las páginas del PDF.");
  }

  const outputDocument = await copyPagesToNewDocument(
    sourceDocument,
    pagesToKeep,
  );
  return createOutputFile(
    "ihatepdf-without-pages.pdf",
    PDF_MIME_TYPE,
    await outputDocument.save(),
  );
}

async function reorderPages(
  file: PdfInputFile,
  pages: number[],
): Promise<PdfOperationResult> {
  const sourceDocument = await loadPdf(file);
  const outputDocument = await copyPagesToNewDocument(sourceDocument, pages);

  return createOutputFile(
    "ihatepdf-reordered.pdf",
    PDF_MIME_TYPE,
    await outputDocument.save(),
  );
}

async function rotatePages(
  files: PdfInputFile[],
  pages: number[],
  angle: 90 | 180 | 270,
): Promise<PdfOperationResult> {
  const processFile = async (file: PdfInputFile) => {
    const outputDocument = await loadPdf(file);
    const pagesToRotate = new Set(pages);

    outputDocument.getPages().forEach((page, pageIndex) => {
      if (!pagesToRotate.has(pageIndex)) return;
      const currentAngle = page.getRotation().angle;
      page.setRotation(degrees((currentAngle + angle) % 360));
    });

    return outputDocument.save();
  };

  if (files.length === 1) {
    return createOutputFile(
      "ihatepdf-rotated.pdf",
      PDF_MIME_TYPE,
      await processFile(files[0]),
    );
  }

  const zip = new JSZip();
  await Promise.all(
    files.map(async (file, index) => {
      zip.file(`rotated-${index + 1}-${file.name}`, await processFile(file));
    }),
  );
  return createOutputFile(
    "ihatepdf-rotated.zip",
    ZIP_MIME_TYPE,
    await zip.generateAsync({ type: "uint8array" }),
  );
}

async function embedImage(outputDocument: PDFDocument, file: ImageInputFile) {
  const normalizedName = file.name.toLowerCase();

  if (file.mimeType === "image/png" || normalizedName.endsWith(".png")) {
    return outputDocument.embedPng(file.buffer);
  }

  return outputDocument.embedJpg(file.buffer);
}

function resolveImageToPdfPageSize(
  imageWidth: number,
  imageHeight: number,
  options: ImageToPdfOptions,
) {
  const margin = IMAGE_TO_PDF_MARGINS[options.margin];

  if (options.pageSize === "image") {
    return {
      width: imageWidth + margin * 2,
      height: imageHeight + margin * 2,
      margin,
    };
  }

  const pageSize =
    options.pageSize === "letter"
      ? imageWidth > imageHeight
        ? LETTER_LANDSCAPE
        : LETTER_PORTRAIT
      : imageWidth > imageHeight
        ? A4_LANDSCAPE
        : A4_PORTRAIT;

  const shouldUseLandscape =
    options.orientation === "landscape" ||
    (options.orientation === "auto" && imageWidth > imageHeight);
  const shouldUsePortrait =
    options.orientation === "portrait" ||
    (options.orientation === "auto" && imageWidth <= imageHeight);
  const width = shouldUseLandscape
    ? Math.max(pageSize.width, pageSize.height)
    : shouldUsePortrait
      ? Math.min(pageSize.width, pageSize.height)
      : pageSize.width;
  const height = shouldUseLandscape
    ? Math.min(pageSize.width, pageSize.height)
    : shouldUsePortrait
      ? Math.max(pageSize.width, pageSize.height)
      : pageSize.height;

  return { width, height, margin };
}

async function imagesToPdf(
  files: ImageInputFile[],
  options: ImageToPdfOptions = {
    pageSize: "a4",
    orientation: "auto",
    margin: "normal",
  },
): Promise<PdfOperationResult> {
  const outputDocument = await PDFDocument.create();
  const embeddedImages = await Promise.all(
    files.map((file) => embedImage(outputDocument, file)),
  );

  for (const embeddedImage of embeddedImages) {
    const pageSize = resolveImageToPdfPageSize(
      embeddedImage.width,
      embeddedImage.height,
      options,
    );
    const page = outputDocument.addPage([pageSize.width, pageSize.height]);
    const availableWidth = pageSize.width - pageSize.margin * 2;
    const availableHeight = pageSize.height - pageSize.margin * 2;
    const scale = Math.min(
      availableWidth / embeddedImage.width,
      availableHeight / embeddedImage.height,
    );
    const imageWidth = embeddedImage.width * scale;
    const imageHeight = embeddedImage.height * scale;

    page.drawImage(embeddedImage, {
      x: (pageSize.width - imageWidth) / 2,
      y: (pageSize.height - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight,
    });
  }

  return createOutputFile(
    "ihatepdf-images.pdf",
    PDF_MIME_TYPE,
    await outputDocument.save(),
  );
}

async function embedLayoutImage(
  outputDocument: PDFDocument,
  asset: LayoutImageAsset,
) {
  const normalizedName = asset.name.toLowerCase();

  if (asset.mimeType === "image/png" || normalizedName.endsWith(".png")) {
    return outputDocument.embedPng(asset.buffer);
  }

  return outputDocument.embedJpg(asset.buffer);
}

async function imagesToPdfLayout(
  images: LayoutImageAsset[],
  pages: LayoutPagePayload[],
): Promise<PdfOperationResult> {
  if (pages.length === 0) {
    throw new Error("Agrega al menos una página con imágenes.");
  }

  const outputDocument = await PDFDocument.create();
  const embeddedByImageId = new Map<
    string,
    Awaited<ReturnType<typeof embedLayoutImage>>
  >();
  const embeddedImages = await Promise.all(
    images.map(async (asset) => ({
      id: asset.id,
      embeddedImage: await embedLayoutImage(outputDocument, asset),
    })),
  );

  for (const { id, embeddedImage } of embeddedImages) {
    embeddedByImageId.set(id, embeddedImage);
  }

  for (const pageData of pages) {
    const page = outputDocument.addPage([pageData.width, pageData.height]);

    for (const element of pageData.elements) {
      const embedded = embeddedByImageId.get(element.imageId);
      if (!embedded) {
        continue;
      }

      const radians = (element.rotation * Math.PI) / 180;
      const cosTheta = Math.cos(radians);
      const sinTheta = Math.sin(radians);

      const centerX = element.x + element.width / 2;
      const centerYPdf = pageData.height - (element.y + element.height / 2);

      const drawX =
        centerX -
        (element.width / 2) * cosTheta -
        (element.height / 2) * sinTheta;
      const drawY =
        centerYPdf +
        (element.width / 2) * sinTheta -
        (element.height / 2) * cosTheta;

      page.drawImage(embedded, {
        x: drawX,
        y: drawY,
        width: element.width,
        height: element.height,
        rotate: degrees(-element.rotation),
      });
    }
  }

  return createOutputFile(
    "ihatepdf-images-layout.pdf",
    PDF_MIME_TYPE,
    await outputDocument.save(),
  );
}

async function viewMetadata(file: PdfInputFile): Promise<PdfOperationResult> {
  const document = await loadPdf(file);
  return {
    kind: "metadata",
    metadata: {
      title: document.getTitle() ?? "",
      author: document.getAuthor() ?? "",
      subject: document.getSubject() ?? "",
      keywords: document.getKeywords() ?? "",
      creator: document.getCreator() ?? "",
      producer: document.getProducer() ?? "",
      creationDate: document.getCreationDate()?.toISOString() ?? "",
      modificationDate: document.getModificationDate()?.toISOString() ?? "",
    },
  };
}

async function removeMetadata(
  files: PdfInputFile[],
): Promise<PdfOperationResult> {
  const processFile = async (file: PdfInputFile) => {
    const document = await loadPdf(file);
    document.setTitle("");
    document.setAuthor("");
    document.setSubject("");
    document.setKeywords([]);
    document.setCreator("");
    document.setProducer("");
    return document.save();
  };

  if (files.length === 1) {
    return createOutputFile(
      "ihatepdf-no-metadata.pdf",
      PDF_MIME_TYPE,
      await processFile(files[0]),
    );
  }

  const zip = new JSZip();
  await Promise.all(
    files.map(async (file, index) => {
      zip.file(
        `no-metadata-${index + 1}-${file.name}`,
        await processFile(file),
      );
    }),
  );
  return createOutputFile(
    "ihatepdf-no-metadata.zip",
    ZIP_MIME_TYPE,
    await zip.generateAsync({ type: "uint8array" }),
  );
}

async function signPdf(
  file: PdfInputFile,
  options: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    signatureImage: ArrayBuffer;
  },
): Promise<PdfOperationResult> {
  const document = await loadPdf(file);
  const pages = document.getPages();
  const targetPage = pages[options.page];

  if (!targetPage) {
    throw new Error("Página no encontrada.");
  }

  const signatureImage = await document.embedPng(options.signatureImage);

  targetPage.drawImage(signatureImage, {
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
  });

  return createOutputFile(
    "ihatepdf-signed.pdf",
    PDF_MIME_TYPE,
    await document.save(),
  );
}

async function repairPdf(file: PdfInputFile): Promise<PdfOperationResult> {
  const { PDFDocument } = await import("pdf-lib");
  try {
    const doc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });

    // Create new doc and copy pages to rebuild structure
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach((page) => newDoc.addPage(page));

    return createOutputFile(
      "ihatepdf-repaired.pdf",
      PDF_MIME_TYPE,
      await newDoc.save(),
    );
  } catch (error) {
    throw new Error(
      "No se pudo reparar el documento. El archivo podría estar demasiado dañado.",
      { cause: error },
    );
  }
}

async function runOperation(
  request: PdfOperationRequest,
): Promise<PdfOperationResult> {
  switch (request.kind) {
    case "inspect-pdf":
      return inspectPdf(request.file);
    case "compress-pdf":
      return compressPdf(request.files);
    case "watermark-pdf":
      return watermarkPdf(request.files, request.options);
    case "number-pages":
      return numberPages(request.files, request.options);
    case "protect-pdf":
      return protectPdf(request.files, request.options);
    case "unlock-pdf":
      return unlockPdf(request.files, request.password);
    case "crop-pdf":
      return cropPdf(request.files, request.margins);
    case "merge-pdfs":
      return mergePdfs(request.files);
    case "split-pdf":
      return splitPdf(request.file);
    case "extract-pages":
      return extractPages(request.file, request.pages);
    case "delete-pages":
      return deletePages(request.file, request.pages);
    case "reorder-pages":
      return reorderPages(request.file, request.pages);
    case "rotate-pages":
      return rotatePages(request.files, request.pages, request.angle);
    case "images-to-pdf":
      return imagesToPdf(request.files, request.options);
    case "images-to-pdf-layout":
      return imagesToPdfLayout(request.images, request.pages);
    case "view-metadata":
      return viewMetadata(request.file);
    case "remove-metadata":
      return removeMetadata(request.files);
    case "sign-pdf":
      return signPdf(request.file, request.options);
    case "repair-pdf":
      return repairPdf(request.file);
    case "extract-images":
    case "pdf-to-text":
    case "ocr-pdf":
      throw new Error("Operation should be handled on the main thread.");
  }
}

workerContext.onmessage = async (event: MessageEvent<PdfOperationRequest>) => {
  try {
    const result = await runOperation(event.data);
    const response: PdfOperationResponse = {
      type: "success",
      result,
    };

    if (result.kind === "file") {
      workerContext.postMessage(response, [result.buffer]);
      return;
    }

    workerContext.postMessage(response);
  } catch (error) {
    const response: PdfOperationResponse = {
      type: "error",
      message: createErrorMessage(error),
    };

    workerContext.postMessage(response);
  }
};
