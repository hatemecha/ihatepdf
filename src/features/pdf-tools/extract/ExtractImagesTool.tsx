import { useState } from "react";
import { Images, Loader2 } from "lucide-react";
import JSZip from "jszip";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import { extractPageEmbeddedImages } from "@/features/pdf-tools/shared/pdfEmbeddedImages";
import {
  getPdfjs,
  loadPdfDocument,
} from "@/features/pdf-tools/shared/pdfPreview";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";

export function ExtractImagesTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el PDF.");
      return;
    }

    setErrorMessage(null);
    setDownloadResult(null);
    setSelectedFile(file);
  }

  async function handleExtractImages() {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;

    try {
      const [loadedPdf, pdfjs] = await Promise.all([
        loadPdfDocument(selectedFile),
        getPdfjs(),
      ]);
      pdf = loadedPdf;
      const zip = new JSZip();
      let imageCount = 0;
      const paintImageOps = [
        pdfjs.OPS.paintImageXObject,
        pdfjs.OPS.paintImageXObjectRepeat,
      ] as const;

      const pagesImages = await Promise.all(
        Array.from({ length: pdf.numPages }, async (_, index) => {
          const pageNumber = index + 1;
          const page = await pdf!.getPage(pageNumber);

          try {
            return {
              pageNumber,
              images: await extractPageEmbeddedImages(page, paintImageOps),
            };
          } finally {
            page.cleanup();
          }
        }),
      );

      for (const { pageNumber, images } of pagesImages) {
        for (const image of images) {
          imageCount += 1;
          zip.file(`image-${pageNumber}-${imageCount}.png`, image.data);
        }
      }

      if (imageCount === 0) {
        throw new Error("No se encontraron imágenes en este PDF.");
      }

      const zipBytes = await zip.generateAsync({ type: "arraybuffer" });
      const blob = new Blob([zipBytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);

      const fileName =
        selectedFile.name.replace(/\.pdf$/i, "") + "-imagenes.zip";

      setDownloadResult({
        url,
        fileName,
        mimeType: "application/zip",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al extraer imágenes.",
      );
    } finally {
      await pdf?.destroy();
      setIsProcessing(false);
    }
  }

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleExtractImages}
      disabled={!selectedFile || isProcessing}
      className="w-full"
    >
      {isProcessing ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden
        />
      ) : (
        <Images data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Extrayendo imágenes" : "Extraer y descargar ZIP"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Extrae todas las imágenes incrustadas dentro del documento PDF."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border bg-card p-8 text-center text-muted-foreground">
            <Images className="size-16 opacity-50" />
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">Listo para extraer las imágenes.</p>
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="Extraer imágenes"
      sidebarDescription="Encuentra todas las imágenes del documento y descárgalas en un archivo ZIP."
      sidebar={
        <div className="text-sm text-muted-foreground">
          Esta herramienta extrae las imágenes originales del documento, tal
          como fueron insertadas (sin reducir la resolución).
        </div>
      }
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={
        downloadResult ? (
          <DownloadReadyBanner downloadResult={downloadResult} />
        ) : null
      }
    />
  );
}
