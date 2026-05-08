import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
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

type RenderResult =
  | { file: File; status: "ready" }
  | { file: File; status: "error" };

export function PdfFirstPageThumbnail({
  file,
  onPageCountResolved,
  className,
  targetWidth = 200,
}: PdfFirstPageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cancelRender: (() => void) | null = null;

    (async () => {
      try {
        const pdf = await loadPdfDocument(file);
        try {
          if (cancelled) {
            return;
          }
          onPageCountResolved?.(pdf.numPages);

          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }

          const handle = renderPdfPageToCanvas({
            pdf,
            pageNumber: 1,
            canvas,
            targetWidth,
          });
          cancelRender = handle.cancel;
          await handle.promise;
          if (!cancelled) {
            setRenderResult({ file, status: "ready" });
          }
        } finally {
          await pdf.destroy();
        }
      } catch {
        if (!cancelled) {
          setRenderResult({ file, status: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [file, onPageCountResolved, targetWidth]);

  const matchesCurrentFile = renderResult?.file === file;
  const status: "loading" | "ready" | "error" = matchesCurrentFile
    ? renderResult.status
    : "loading";

  return (
    <div
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
