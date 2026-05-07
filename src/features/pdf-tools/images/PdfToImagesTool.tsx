import { useEffect, useRef, useState, type ChangeEvent } from "react";
import JSZip from "jszip";
import { Download, FileText, Loader2, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  formatFileSize,
  validateSinglePdfFile,
} from "@/features/pdf-tools/shared/fileValidation";
import {
  formatPageRangeHint,
  parsePageRange,
} from "@/features/pdf-tools/shared/pageRanges";

interface DownloadResult {
  url: string;
  fileName: string;
}

const PDFJS_WORKER_SRC = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();
const PNG_MIME_TYPE = "image/png";

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo generar la imagen de la pagina."));
        return;
      }

      resolve(blob);
    }, PNG_MIME_TYPE);
  });
}

async function loadPdfDocument(file: File) {
  // Intencional: import dinamico para no cargar pdfjs-dist en el bundle inicial.
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

  return pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
}

export function PdfToImagesTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [rangeValue, setRangeValue] = useState("");
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const canExport = Boolean(selectedFile && pageCount && !isProcessing);

  function replaceDownloadResult(nextResult: DownloadResult | null) {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }

    resultUrlRef.current = nextResult?.url ?? null;
    setDownloadResult(nextResult);
  }

  function clearDownloadResult() {
    replaceDownloadResult(null);
  }

  async function inspectSelectedFile(file: File) {
    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el PDF.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSelectedFile(null);
    setPageCount(null);
    clearDownloadResult();

    const pdf = await loadPdfDocument(file);
    try {
      setSelectedFile(file);
      setPageCount(pdf.numPages);
      setRangeValue(formatPageRangeHint(pdf.numPages));
    } finally {
      await pdf.destroy();
      setIsProcessing(false);
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    inspectSelectedFile(file).catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo abrir el PDF seleccionado.";
      setErrorMessage(message);
      setIsProcessing(false);
    });
  }

  async function handleExport() {
    if (!selectedFile || !pageCount) {
      return;
    }

    const rangeResult = parsePageRange(rangeValue, pageCount);
    if (!rangeResult.isValid) {
      setErrorMessage(rangeResult.error ?? "Selecciona paginas validas.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressLabel("Leyendo PDF");
    clearDownloadResult();

    const pdf = await loadPdfDocument(selectedFile);
    try {
      const zip = new JSZip();

      for (const [index, pageIndex] of rangeResult.pages.entries()) {
        const pageNumber = pageIndex + 1;
        setProgressLabel(
          `Renderizando pagina ${index + 1} de ${rangeResult.pages.length}`,
        );

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const canvasContext = canvas.getContext("2d");

        if (!canvasContext) {
          throw new Error(
            "El navegador no pudo crear el canvas de exportacion.",
          );
        }

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({
          canvas,
          canvasContext,
          viewport,
        }).promise;

        const imageBlob = await canvasToPngBlob(canvas);
        zip.file(`page-${String(pageNumber).padStart(3, "0")}.png`, imageBlob);
        canvas.width = 0;
        canvas.height = 0;
      }

      setProgressLabel("Generando ZIP");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      replaceDownloadResult({
        url,
        fileName: "ihatepdf-pages-as-images.zip",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron exportar las paginas.";
      setErrorMessage(message);
    } finally {
      await pdf.destroy();
      setProgressLabel(null);
      setIsProcessing(false);
    }
  }

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
    };
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-dashed border-border bg-muted p-7">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileSelection}
          />
          <div className="flex flex-col items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Upload className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Selecciona un PDF</h2>
              <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
                Exporta paginas del PDF como imagenes PNG dentro de un ZIP.
              </p>
            </div>
            <Button
              type="button"
              variant="brand"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload data-icon="inline-start" aria-hidden />
              Elegir PDF
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-7">
          <h2 className="text-lg font-semibold">Archivo</h2>
          {selectedFile ? (
            <div className="mt-4 flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-medium">
                  {selectedFile.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                  {pageCount ? ` - ${pageCount} paginas` : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-base text-muted-foreground">
              Todavia no seleccionaste ningun PDF.
            </p>
          )}
        </div>
      </div>

      {selectedFile ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <label className="flex flex-col gap-2">
            <span className="text-base font-medium">Paginas a exportar</span>
            <input
              className="h-12 rounded-md border border-input bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={rangeValue}
              onChange={(event) => {
                setRangeValue(event.target.value);
                setErrorMessage(null);
                clearDownloadResult();
              }}
            />
            <span className="text-sm text-muted-foreground">
              Ejemplo: 1,3-5. Deja vacio para exportar todas.
            </span>
          </label>
        </div>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo continuar</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="brand"
          size="lg"
          onClick={() => void handleExport()}
          disabled={!canExport}
        >
          {isProcessing ? (
            <Loader2
              className="animate-spin"
              data-icon="inline-start"
              aria-hidden
            />
          ) : (
            <Download data-icon="inline-start" aria-hidden />
          )}
          {progressLabel ?? "Exportar imagenes"}
        </Button>
      </div>

      {downloadResult ? (
        <Alert variant="brand">
          <Download />
          <AlertTitle>Imagenes listas</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span>Las paginas se exportaron como PNG.</span>
              <Button asChild variant="brand" size="sm">
                <a href={downloadResult.url} download={downloadResult.fileName}>
                  <Download data-icon="inline-start" aria-hidden />
                  Descargar ZIP
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
