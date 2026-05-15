import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadPdfDocument } from "@/features/pdf-tools/shared/pdfPreview";

const MIN_FIT_WIDTH = 320;
const MAX_FIT_WIDTH = 720;
const PREVIEW_PADDING = 48;
const ZOOM_STEP = 15;

export interface PdfFocusedPreviewMetrics {
  pageWidth: number;
  pageHeight: number;
  scale: number;
}

export interface PdfFocusedPreviewProps {
  file: File;
  pageNumber?: number;
  overlay?: (metrics: PdfFocusedPreviewMetrics) => ReactNode;
  pageLabel?: string;
  className?: string;
}

interface RenderedState {
  cssWidth: number;
  cssHeight: number;
  pageWidth: number;
  pageHeight: number;
  signature: string;
}

type LoadedState =
  | { file: File; pdf: PDFDocumentProxy }
  | { file: File; error: string };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function PdfFocusedPreview({
  file,
  pageNumber = 1,
  overlay,
  pageLabel,
  className,
}: PdfFocusedPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedState, setLoadedState] = useState<LoadedState | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [renderedState, setRenderedState] = useState<RenderedState | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    let loadedPdf: PDFDocumentProxy | null = null;

    (async () => {
      try {
        const document = await loadPdfDocument(file);
        if (cancelled) {
          await document.destroy();
          return;
        }
        loadedPdf = document;
        setLoadedState({ file, pdf: document });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadedState({
          file,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo abrir el PDF para vista previa.",
        });
      }
    })();

    return () => {
      cancelled = true;
      if (loadedPdf) {
        void loadedPdf.destroy();
      }
    };
  }, [file]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const matchesCurrentFile = loadedState?.file === file;
  const pdf =
    matchesCurrentFile && loadedState && "pdf" in loadedState
      ? loadedState.pdf
      : null;
  const error =
    matchesCurrentFile && loadedState && "error" in loadedState
      ? loadedState.error
      : null;

  const targetWidth = useMemo(() => {
    const fitWidth = clamp(
      Math.max(0, containerWidth - PREVIEW_PADDING),
      MIN_FIT_WIDTH,
      MAX_FIT_WIDTH,
    );
    return Math.round(fitWidth * (zoomPercent / 100));
  }, [containerWidth, zoomPercent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pdf) {
      return;
    }

    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let pageCleanup: (() => void) | null = null;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      pageCleanup = () => page.cleanup();

      if (cancelled) {
        page.cleanup();
        return;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const outputWidth = Math.ceil(viewport.width * devicePixelRatio);
      const outputHeight = Math.ceil(viewport.height * devicePixelRatio);
      const cssWidth = Math.ceil(viewport.width);
      const cssHeight = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("No se pudo crear el contexto 2D de la vista previa.");
      }

      canvas.width = outputWidth;
      canvas.height = outputHeight;
      canvas.style.cssText = `width: ${cssWidth}px; height: ${cssHeight}px;`;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
      });

      try {
        await renderTask.promise;
        if (!cancelled) {
          setRenderedState({
            cssWidth,
            cssHeight,
            pageWidth: baseViewport.width,
            pageHeight: baseViewport.height,
            signature: `${file.name}-${file.size}-${pageNumber}-${targetWidth}`,
          });
        }
      } finally {
        renderTask = null;
        page.cleanup();
      }
    })().catch((renderError) => {
      if (!cancelled) {
        setLoadedState({
          file,
          error:
            renderError instanceof Error
              ? renderError.message
              : "No se pudo renderizar la vista previa.",
        });
      }
    });

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
      pageCleanup?.();
    };
  }, [file, pageNumber, pdf, targetWidth]);

  const isReady =
    renderedState?.signature ===
    `${file.name}-${file.size}-${pageNumber}-${targetWidth}`;

  const metrics = renderedState
    ? {
        pageWidth: renderedState.pageWidth,
        pageHeight: renderedState.pageHeight,
        scale: renderedState.cssWidth / renderedState.pageWidth,
      }
    : null;
  const frameWidth = renderedState?.cssWidth ?? targetWidth;
  const frameHeight =
    renderedState?.cssHeight ?? Math.round(targetWidth * 1.414);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-panel",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">
          {pageLabel ?? `Página ${pageNumber}`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Reducir vista previa"
            onClick={() =>
              setZoomPercent((current) => clamp(current - ZOOM_STEP, 60, 180))
            }
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs tabular-nums"
            onClick={() => setZoomPercent(100)}
          >
            <Maximize2 className="size-3.5" aria-hidden />
            {zoomPercent}%
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Ampliar vista previa"
            onClick={() =>
              setZoomPercent((current) => clamp(current + ZOOM_STEP, 60, 180))
            }
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex min-h-full items-start justify-center">
          <div
            className="relative overflow-hidden rounded-sm bg-white shadow-2xl shadow-black/40 ring-1 ring-white/10"
            style={{
              width: frameWidth,
              height: frameHeight,
            }}
          >
            <canvas
              ref={canvasRef}
              className={cn(
                "block bg-white transition-opacity",
                isReady ? "opacity-100" : "opacity-0",
              )}
            />
            {metrics && isReady ? overlay?.(metrics) : null}
            {!isReady || error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white text-center text-sm text-neutral-600">
                {error ? (
                  <p className="max-w-xs px-6">{error}</p>
                ) : (
                  <Loader2 className="size-7 animate-spin text-neutral-500" />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
