import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist";

const PDFJS_WORKER_SRC = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

let pdfjsModule: typeof import("pdfjs-dist") | null = null;

async function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (pdfjsModule) {
    return pdfjsModule;
  }
  const mod = await import("pdfjs-dist");
  mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
  pdfjsModule = mod;
  return mod;
}

export async function loadPdfDocument(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  return pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const pdf = await loadPdfDocument(file);
  try {
    return pdf.numPages;
  } finally {
    await pdf.destroy();
  }
}

interface RenderPageOptions {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  targetWidth: number;
  rotation?: number;
}

export interface RenderPageHandle {
  cancel: () => void;
  promise: Promise<void>;
}

export function renderPdfPageToCanvas({
  pdf,
  pageNumber,
  canvas,
  targetWidth,
  rotation = 0,
}: RenderPageOptions): RenderPageHandle {
  let renderTask: RenderTask | null = null;
  let cancelled = false;
  let pageProxy: PDFPageProxy | null = null;

  const promise = (async () => {
    const page = await pdf.getPage(pageNumber);
    pageProxy = page;

    if (cancelled) {
      page.cleanup();
      return;
    }

    const baseViewport = page.getViewport({ scale: 1, rotation });
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale, rotation });

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const outputWidth = Math.ceil(viewport.width * devicePixelRatio);
    const outputHeight = Math.ceil(viewport.height * devicePixelRatio);

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No se pudo crear el contexto 2D del thumbnail.");
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    renderTask = page.render({
      canvas,
      canvasContext: context,
      viewport,
    });

    try {
      await renderTask.promise;
    } finally {
      renderTask = null;
      page.cleanup();
    }
  })();

  return {
    cancel() {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
      if (pageProxy) {
        pageProxy.cleanup();
      }
    },
    promise,
  };
}
