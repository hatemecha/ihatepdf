import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Loader2, RotateCw, Trash2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { cn } from "@/lib/utils";
import {
  loadPdfDocument,
  renderPdfPageToCanvas,
} from "@/features/pdf-tools/shared/pdfPreview";

const THUMBNAIL_RENDER_WIDTH = 220;

export type PageDisplayMode =
  | "neutral"
  | "selected"
  | "deletion"
  | "rotation";

export interface PdfDocumentPreviewProps {
  file: File;
  pageOrder: number[];
  selectedPages?: Set<number>;
  rotationByPage?: Record<number, number>;
  displayMode?: PageDisplayMode;
  pageLabels?: Record<number, string>;
  onPageClick?: (pageNumber: number) => void;
  onLoaded?: (pageCount: number) => void;
  onError?: (message: string) => void;
  renderPageActions?: (
    pageNumber: number,
    displayIndex: number,
  ) => ReactNode;
}

type LoadedState =
  | { file: File; pdf: PDFDocumentProxy }
  | { file: File; error: string };

export function PdfDocumentPreview({
  file,
  pageOrder,
  selectedPages,
  rotationByPage,
  displayMode = "neutral",
  pageLabels,
  onPageClick,
  onLoaded,
  onError,
  renderPageActions,
}: PdfDocumentPreviewProps) {
  const [loadedState, setLoadedState] = useState<LoadedState | null>(null);

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
        onLoaded?.(document.numPages);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo abrir el PDF para vista previa.";
        setLoadedState({ file, error: message });
        onError?.(message);
      }
    })();

    return () => {
      cancelled = true;
      if (loadedPdf) {
        void loadedPdf.destroy();
      }
    };
  }, [file, onError, onLoaded]);

  const matchesCurrentFile = loadedState?.file === file;
  const pdf =
    matchesCurrentFile && loadedState && "pdf" in loadedState
      ? loadedState.pdf
      : null;
  const loadError =
    matchesCurrentFile && loadedState && "error" in loadedState
      ? loadedState.error
      : null;

  if (loadError) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-destructive/40 p-8 text-center text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-brand" aria-hidden />
        <p className="text-sm">Generando vista previa…</p>
      </div>
    );
  }

  const interactive = Boolean(onPageClick);

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:gap-4">
        {pageOrder.map((pageNumber, displayIndex) => {
          const isSelected = selectedPages?.has(pageNumber) ?? false;
          const rotation = rotationByPage?.[pageNumber] ?? 0;
          const label = pageLabels?.[pageNumber] ?? `${displayIndex + 1}`;

          return (
            <li
              key={`${pageNumber}-${displayIndex}`}
              className="flex flex-col gap-1.5"
            >
              <PdfPageThumbnail
                pdf={pdf}
                pageNumber={pageNumber}
                rotation={rotation}
                label={label}
                isSelected={isSelected}
                displayMode={displayMode}
                interactive={interactive}
                onClick={
                  onPageClick ? () => onPageClick(pageNumber) : undefined
                }
              />
              {renderPageActions ? (
                <div className="flex items-center justify-center gap-1">
                  {renderPageActions(pageNumber, displayIndex)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface PdfPageThumbnailProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  rotation: number;
  label: string;
  isSelected: boolean;
  displayMode: PageDisplayMode;
  interactive: boolean;
  onClick?: () => void;
}

interface RenderedSignature {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  rotation: number;
}

function PdfPageThumbnail({
  pdf,
  pageNumber,
  rotation,
  label,
  isSelected,
  displayMode,
  interactive,
  onClick,
}: PdfPageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedSignature, setRenderedSignature] =
    useState<RenderedSignature | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const handle = renderPdfPageToCanvas({
      pdf,
      pageNumber,
      canvas,
      targetWidth: THUMBNAIL_RENDER_WIDTH,
      rotation,
    });

    handle.promise
      .then(() => {
        setRenderedSignature({ pdf, pageNumber, rotation });
      })
      .catch(() => {
        // ignore: cancellation or render error - canvas just stays empty
      });

    return () => {
      handle.cancel();
    };
  }, [pdf, pageNumber, rotation]);

  const isReady =
    renderedSignature !== null &&
    renderedSignature.pdf === pdf &&
    renderedSignature.pageNumber === pageNumber &&
    renderedSignature.rotation === rotation;

  const stateClass = (() => {
    if (!isSelected) {
      return "border-border bg-card hover:border-foreground/40";
    }
    switch (displayMode) {
      case "deletion":
        return "border-destructive ring-1 ring-destructive/50 bg-destructive/5";
      case "rotation":
        return "border-brand ring-1 ring-brand/50 bg-brand/5";
      case "selected":
      case "neutral":
      default:
        return "border-brand ring-1 ring-brand/50 bg-brand/5";
    }
  })();

  const Component = interactive ? "button" : "div";

  return (
    <Component
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col items-center gap-2 rounded-md border p-2 transition-colors",
        stateClass,
        interactive ? "cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "cursor-default",
      )}
      aria-pressed={interactive ? isSelected : undefined}
    >
      <div className="relative flex w-full items-center justify-center overflow-hidden rounded-sm bg-white">
        <canvas
          ref={canvasRef}
          className={cn(
            "block max-w-full transition-opacity",
            isReady ? "opacity-100" : "opacity-0",
          )}
        />
        {!isReady ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2
              className="size-5 animate-spin text-muted-foreground"
              aria-hidden
            />
          </div>
        ) : null}

        {isSelected && displayMode === "selected" ? (
          <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground shadow">
            <Check className="size-3.5" aria-hidden />
          </span>
        ) : null}
        {isSelected && displayMode === "deletion" ? (
          <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
            <Trash2 className="size-3.5" aria-hidden />
          </span>
        ) : null}
        {isSelected && displayMode === "rotation" ? (
          <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground shadow">
            <RotateCw className="size-3.5" aria-hidden />
          </span>
        ) : null}
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {label}
      </span>
    </Component>
  );
}
