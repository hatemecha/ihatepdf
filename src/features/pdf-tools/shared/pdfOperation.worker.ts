import JSZip from "jszip";
import { PDFDocument, degrees } from "pdf-lib";

import type {
  ImageInputFile,
  PdfInputFile,
  PdfOperationRequest,
  PdfOperationResponse,
  PdfOperationResult,
} from "./pdfOperation.types";

const workerContext = self as unknown as DedicatedWorkerGlobalScope;
const PDF_MIME_TYPE = "application/pdf";
const ZIP_MIME_TYPE = "application/zip";
const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };
const PAGE_MARGIN = 36;

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

  if (message.includes("encrypted")) {
    return "El PDF esta protegido con contrasena. Desbloquealo antes de usar esta herramienta.";
  }

  if (message.includes("invalid") || message.includes("parse")) {
    return "El archivo no parece ser un PDF valido.";
  }

  return "No se pudo procesar el archivo. Revisa que no este corrupto o protegido.";
}

async function loadPdf(file: PdfInputFile): Promise<PDFDocument> {
  return PDFDocument.load(file.buffer);
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

async function mergePdfs(files: PdfInputFile[]): Promise<PdfOperationResult> {
  const outputDocument = await PDFDocument.create();

  for (const file of files) {
    const sourceDocument = await loadPdf(file);
    const copiedPages = await outputDocument.copyPages(
      sourceDocument,
      sourceDocument.getPageIndices(),
    );
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

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageDocument = await copyPagesToNewDocument(sourceDocument, [
      pageIndex,
    ]);
    const pageBytes = await pageDocument.save();
    zip.file(`page-${String(pageIndex + 1).padStart(3, "0")}.pdf`, pageBytes);
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
    throw new Error("No puedes eliminar todas las paginas del PDF.");
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
  file: PdfInputFile,
  pages: number[],
  angle: 90 | 180 | 270,
): Promise<PdfOperationResult> {
  const outputDocument = await loadPdf(file);
  const pagesToRotate = new Set(pages);

  outputDocument.getPages().forEach((page, pageIndex) => {
    if (!pagesToRotate.has(pageIndex)) {
      return;
    }

    const currentAngle = page.getRotation().angle;
    page.setRotation(degrees((currentAngle + angle) % 360));
  });

  return createOutputFile(
    "ihatepdf-rotated.pdf",
    PDF_MIME_TYPE,
    await outputDocument.save(),
  );
}

async function embedImage(outputDocument: PDFDocument, file: ImageInputFile) {
  const normalizedName = file.name.toLowerCase();

  if (file.mimeType === "image/png" || normalizedName.endsWith(".png")) {
    return outputDocument.embedPng(file.buffer);
  }

  return outputDocument.embedJpg(file.buffer);
}

async function imagesToPdf(
  files: ImageInputFile[],
): Promise<PdfOperationResult> {
  const outputDocument = await PDFDocument.create();

  for (const file of files) {
    const embeddedImage = await embedImage(outputDocument, file);
    const pageSize =
      embeddedImage.width > embeddedImage.height ? A4_LANDSCAPE : A4_PORTRAIT;
    const page = outputDocument.addPage([pageSize.width, pageSize.height]);
    const availableWidth = pageSize.width - PAGE_MARGIN * 2;
    const availableHeight = pageSize.height - PAGE_MARGIN * 2;
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

async function runOperation(
  request: PdfOperationRequest,
): Promise<PdfOperationResult> {
  switch (request.kind) {
    case "inspect-pdf":
      return inspectPdf(request.file);
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
      return rotatePages(request.file, request.pages, request.angle);
    case "images-to-pdf":
      return imagesToPdf(request.files);
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
