import type {
  PdfOperationRequest,
  PdfOperationResponse,
  PdfOperationResult,
} from "./pdfOperation.types";

export function createPdfOperationWorker(): Worker {
  return new Worker(new URL("./pdfOperation.worker.ts", import.meta.url), {
    type: "module",
  });
}

function getPdfOperationTransferList(
  request: PdfOperationRequest,
): Transferable[] {
  switch (request.kind) {
    case "inspect-pdf":
    case "compress-pdf":
    case "watermark-pdf":
    case "number-pages":
    case "protect-pdf":
    case "unlock-pdf":
    case "crop-pdf":
    case "split-pdf":
    case "extract-pages":
    case "delete-pages":
    case "reorder-pages":
    case "rotate-pages":
      return [request.file.buffer];
    case "merge-pdfs":
    case "images-to-pdf":
      return request.files.map((file) => file.buffer);
    case "images-to-pdf-layout":
      return request.images.map((image) => image.buffer);
  }
}

export function runPdfOperation(
  worker: Worker,
  request: PdfOperationRequest,
): Promise<PdfOperationResult> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<PdfOperationResponse>) => {
      if (event.data.type === "success") {
        resolve(event.data.result);
        return;
      }

      reject(new Error(event.data.message));
    };

    worker.onerror = (event) => {
      const detail = event.message ? ` ${event.message}` : "";
      reject(
        new Error(`No se pudo procesar el archivo en el navegador.${detail}`),
      );
    };

    worker.postMessage(request, getPdfOperationTransferList(request));
  });
}
