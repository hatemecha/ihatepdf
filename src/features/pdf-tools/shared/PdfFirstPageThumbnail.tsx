import { useEffect, useReducer, useRef } from "react";
import { FileText, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { pdfThumbnailRenderQueue } from "@/features/pdf-tools/shared/pdfRenderQueue";
import {
  loadPdfDocument,
  renderPdfPageToCanvas,
} from "@/features/pdf-tools/shared/pdfPreview";

interface PdfFirstPageThumbnailProps {
  file: File;
  onPageCountResolved?: (pageCount: number) => void;
  className?: string;
  targetWidth?: number;
}

type RenderStatus = "loading" | "ready" | "error";

type ThumbnailState = {
  status: RenderStatus;
};

type ThumbnailAction =
  | { type: "reset" }
  | { type: "ready" }
  | { type: "error" };

function thumbnailReducer(
  _state: ThumbnailState,
  action: ThumbnailAction,
): ThumbnailState {
  switch (action.type) {
    case "reset":
      return { status: "loading" };
    case "ready":
      return { status: "ready" };
    case "error":
      return { status: "error" };
  }
}

function getFileCacheKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

const thumbnailDataUrlCache = new Map<string, string>();

function waitForCanvas(
  getCanvas: () => HTMLCanvasElement | null,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function tryResolve() {
      const canvas = getCanvas();
      if (canvas) {
        resolve(canvas);
        return;
      }

      attempts += 1;
      if (attempts >= 20) {
        reject(new Error("No se pudo preparar el lienzo de vista previa."));
        return;
      }

      requestAnimationFrame(tryResolve);
    }

    tryResolve();
  });
}

export function PdfFirstPageThumbnail({
  file,
  onPageCountResolved,
  className,
  targetWidth = 200,
}: PdfFirstPageThumbnailProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onPageCountResolvedRef = useRef(onPageCountResolved);
  const [{ status }, dispatch] = useReducer(thumbnailReducer, {
    status: "loading",
  });

  useEffect(() => {
    onPageCountResolvedRef.current = onPageCountResolved;
  });

  useEffect(() => {
    let cancelled = false;
    let cancelRender: (() => void) | null = null;
    const cacheKey = getFileCacheKey(file);

    dispatch({ type: "reset" });

    async function renderThumbnail() {
      try {
        const canvas = await waitForCanvas(() => canvasRef.current);
        if (cancelled) {
          return;
        }

        const cachedDataUrl = thumbnailDataUrlCache.get(cacheKey);
        if (cachedDataUrl) {
          const image = new Image();
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () =>
              reject(new Error("No se pudo restaurar la miniatura."));
            image.src = cachedDataUrl;
          });
          if (cancelled) {
            return;
          }
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          context?.drawImage(image, 0, 0);
          dispatch({ type: "ready" });
          return;
        }

        await pdfThumbnailRenderQueue(async () => {
          const pdf = await loadPdfDocument(file);
          try {
            if (cancelled) {
              return;
            }

            onPageCountResolvedRef.current?.(pdf.numPages);

            const handle = renderPdfPageToCanvas({
              pdf,
              pageNumber: 1,
              canvas,
              targetWidth,
            });
            cancelRender = handle.cancel;
            await handle.promise;

            if (!cancelled) {
              thumbnailDataUrlCache.set(
                cacheKey,
                canvas.toDataURL("image/jpeg", 0.82),
              );
              dispatch({ type: "ready" });
            }
          } finally {
            await pdf.destroy();
          }
        });
      } catch {
        if (!cancelled) {
          dispatch({ type: "error" });
        }
      }
    }

    const element = rootRef.current;
    if (!element) {
      void renderThumbnail();
      return () => {
        cancelled = true;
        cancelRender?.();
      };
    }

    let started = false;
    function startRender() {
      if (started || cancelled) {
        return;
      }
      started = true;
      void renderThumbnail();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          startRender();
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );

    observer.observe(element);

    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      startRender();
    }

    const fallbackTimeoutId = window.setTimeout(startRender, 250);

    return () => {
      cancelled = true;
      cancelRender?.();
      observer.disconnect();
      window.clearTimeout(fallbackTimeoutId);
    };
  }, [file, targetWidth]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md border border-border bg-white",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "max-h-full max-w-full transition-opacity",
          status === "ready" ? "opacity-100" : "opacity-0",
        )}
      />
      {status === "loading" ? (
        <Loader2
          className="absolute size-6 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}
      {status === "error" ? (
        <FileText
          className="absolute size-8 text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
