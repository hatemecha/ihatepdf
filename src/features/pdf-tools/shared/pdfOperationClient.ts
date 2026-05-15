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
  if ("file" in request) {
    return [request.file.buffer];
  } else if ("files" in request) {
    return request.files.map((file) => file.buffer);
  } else if ("images" in request) {
    return request.images.map((image) => image.buffer);
  }
  return [];
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
