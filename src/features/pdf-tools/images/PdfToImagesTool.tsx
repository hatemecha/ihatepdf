import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import {
  CheckSquare,
  Download,
  FileImage,
  Loader2,
  Square,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PdfDocumentPreview } from "@/features/pdf-tools/shared/PdfDocumentPreview";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import {
  formatFileSize,
  validateSinglePdfFile,
} from "@/features/pdf-tools/shared/fileValidation";
import { loadPdfDocument } from "@/features/pdf-tools/shared/pdfPreview";

interface DownloadResult {
  url: string;
  fileName: string;
}

type ImageExportFormat = "png" | "jpg" | "webp";

const IMAGE_EXPORT_FORMATS: Array<{
  value: ImageExportFormat;
  label: string;
  mimeType: string;
  extension: string;
  quality?: number;
}> = [
  { value: "png", label: "PNG", mimeType: "image/png", extension: "png" },
  {
    value: "jpg",
    label: "JPG",
    mimeType: "image/jpeg",
    extension: "jpg",
    quality: 0.88,
  },
  {
    value: "webp",
    label: "WebP",
    mimeType: "image/webp",
    extension: "webp",
    quality: 0.86,
  },
];

interface RenderedImagePage {
  fileName: string;
  imageBlob: Blob;
}

function getImageExportFormat(format: ImageExportFormat) {
  return (
    IMAGE_EXPORT_FORMATS.find((current) => current.value === format) ??
    IMAGE_EXPORT_FORMATS[0]
  );
}

function canvasToImageBlob(
  canvas: HTMLCanvasElement,
  format: ImageExportFormat,
): Promise<Blob> {
  const exportFormat = getImageExportFormat(format);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la imagen de la página."));
          return;
        }
        resolve(blob);
      },
      exportFormat.mimeType,
      exportFormat.quality,
    );
  });
}

function createInitialPageOrder(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, index) => index + 1);
}

async function renderPdfPageAsImage(
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageNumber: number,
  format: ImageExportFormat,
): Promise<RenderedImagePage> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) {
    throw new Error("El navegador no pudo crear el canvas de exportación.");
  }
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  try {
    if (format === "jpg") {
      canvasContext.fillStyle = "#ffffff";
      canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvas, canvasContext, viewport }).promise;
    const exportFormat = getImageExportFormat(format);
    return {
      fileName: `page-${String(pageNumber).padStart(3, "0")}.${
        exportFormat.extension
      }`,
      imageBlob: await canvasToImageBlob(canvas, format),
    };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}

export function PdfToImagesTool() {
  return usePdfToImagesTool();
}

function usePdfToImagesTool() {
  const resultUrlRef = useRef<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState<ImageExportFormat>("png");

  const hasContent = Boolean(selectedFile && pageCount > 0);
  const canExport = hasContent && selectedPages.size > 0 && !isProcessing;

  const replaceDownloadResult = useCallback(
    (nextResult: DownloadResult | null) => {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
      resultUrlRef.current = nextResult?.url ?? null;
      setDownloadResult(nextResult);
    },
    [],
  );

  const clearDownloadResult = useCallback(() => {
    replaceDownloadResult(null);
  }, [replaceDownloadResult]);

  function changeExportFormat(nextFormat: ImageExportFormat) {
    setExportFormat(nextFormat);
    setErrorMessage(null);
    clearDownloadResult();
  }

  async function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) {
      return;
    }

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el PDF.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    clearDownloadResult();

    try {
      const pdf = await loadPdfDocument(file);
      try {
        setSelectedFile(file);
        setPageCount(pdf.numPages);
        setSelectedPages(new Set(createInitialPageOrder(pdf.numPages)));
      } finally {
        await pdf.destroy();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo abrir el PDF seleccionado.";
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleClear() {
    setSelectedFile(null);
    setPageCount(0);
    setSelectedPages(new Set());
    setErrorMessage(null);
    clearDownloadResult();
  }

  function togglePage(pageNumber: number) {
    setSelectedPages((current) => {
      const next = new Set(current);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
    setErrorMessage(null);
    clearDownloadResult();
  }

  const selectAll = useCallback(() => {
    setSelectedPages(new Set(createInitialPageOrder(pageCount)));
    setErrorMessage(null);
    clearDownloadResult();
  }, [clearDownloadResult, pageCount]);

  const clearSelection = useCallback(() => {
    setSelectedPages(new Set());
    setErrorMessage(null);
    clearDownloadResult();
  }, [clearDownloadResult]);

  async function handleExport() {
    if (!selectedFile || pageCount === 0 || selectedPages.size === 0) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressLabel("Leyendo PDF");
    clearDownloadResult();

    const pdf = await loadPdfDocument(selectedFile);
    try {
      const zip = new JSZip();
      const sortedPages = Array.from(selectedPages).toSorted((a, b) => a - b);
      let completedPages = 0;

      const renderedPages = await Promise.all(
        sortedPages.map(async (pageNumber) => {
          const renderedPage = await renderPdfPageAsImage(
            pdf,
            pageNumber,
            exportFormat,
          );
          completedPages += 1;
          setProgressLabel(
            `Renderizando página ${completedPages} de ${sortedPages.length}`,
          );
          return renderedPage;
        }),
      );

      for (const renderedPage of renderedPages) {
        zip.file(renderedPage.fileName, renderedPage.imageBlob);
      }

      setProgressLabel("Generando ZIP");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const formatLabel = getImageExportFormat(exportFormat).label;
      replaceDownloadResult({
        url,
        fileName: `ihatepdf-pages-as-${formatLabel.toLowerCase()}.zip`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron exportar las páginas.";
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

  const preview = selectedFile ? (
    <PdfDocumentPreview
      file={selectedFile}
      pageOrder={createInitialPageOrder(pageCount)}
      selectedPages={selectedPages}
      displayMode="selected"
      onPageClick={togglePage}
    />
  ) : (
    <div />
  );

  const sidebar = (
    <div className="flex flex-col gap-4">
      {selectedFile ? (
        <div className="surface-inset">
          <p className="truncate text-sm font-medium" title={selectedFile.name}>
            {selectedFile.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatFileSize(selectedFile.size)} · {pageCount} páginas
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 -ml-2"
            onClick={handleClear}
          >
            Cambiar archivo
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">
          {selectedPages.size} de {pageCount} páginas seleccionadas
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAll}>
            <CheckSquare data-icon="inline-start" aria-hidden />
            Todas
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSelection}
            disabled={selectedPages.size === 0}
          >
            <Square data-icon="inline-start" aria-hidden />
            Ninguna
          </Button>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Formato</legend>
        <div className="grid grid-cols-3 gap-2">
          {IMAGE_EXPORT_FORMATS.map((format) => (
            <Button
              key={format.value}
              type="button"
              variant={exportFormat === format.value ? "brand" : "outline"}
              size="sm"
              onClick={() => changeExportFormat(format.value)}
              disabled={isProcessing}
            >
              {format.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <p className="text-sm text-muted-foreground">
        Cada página seleccionada se exporta a 2x escala dentro de un ZIP.
      </p>
    </div>
  );

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={() => void handleExport()}
      disabled={!canExport}
      className="w-full"
    >
      {isProcessing ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden
        />
      ) : (
        <FileImage data-icon="inline-start" aria-hidden />
      )}
      {progressLabel ?? "Exportar imágenes"}
    </Button>
  );

  const resultBanner = downloadResult ? (
    <Alert variant="brand" role="status">
      <Download />
      <AlertTitle>Imágenes listas</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span>
            Las páginas se exportaron como{" "}
            {getImageExportFormat(exportFormat).label}.
          </span>
          <Button asChild variant="brand" size="sm">
            <a href={downloadResult.url} download={downloadResult.fileName}>
              <Download data-icon="inline-start" aria-hidden />
              Descargar ZIP
            </a>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  ) : null;

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={hasContent}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Después marca las páginas que quieres exportar como imágenes."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={preview}
      sidebarTitle="PDF a imágenes"
      sidebarDescription="Exporta páginas como PNG, JPG o WebP dentro de un ZIP."
      sidebar={sidebar}
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={resultBanner}
    />
  );
}
