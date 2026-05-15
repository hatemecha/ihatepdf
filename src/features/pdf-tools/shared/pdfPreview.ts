import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

/** Legacy build includes Map polyfills required by pdf.js 5.5+. */
const PDFJS_WORKER_SRC = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url,
).toString();

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsModule: PdfJsModule | null = null;
let pdfjsLoadPromise: Promise<PdfJsModule> | null = null;

/** Shared pdf.js entry (legacy build for broader browser support). */
export async function getPdfjs(): Promise<PdfJsModule> {
  if (pdfjsModule) {
    return pdfjsModule;
  }

  if (!pdfjsLoadPromise) {
    pdfjsLoadPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
      pdfjsModule = mod;
      return mod;
    });
  }

  return pdfjsLoadPromise;
}

export async function loadPdfDocument(file: File): Promise<PDFDocumentProxy> {
  const [pdfjs, buffer] = await Promise.all([getPdfjs(), file.arrayBuffer()]);
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
    canvas.style.cssText = `width: ${Math.ceil(
      viewport.width,
    )}px; height: ${Math.ceil(viewport.height)}px;`;

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
