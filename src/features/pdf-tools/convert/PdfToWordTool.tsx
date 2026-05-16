import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Document, Packer, type ISectionOptions } from "docx";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import {
  getPdfjs,
  loadPdfDocument,
} from "@/features/pdf-tools/shared/pdfPreview";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import { buildEditablePageSection } from "@/features/pdf-tools/convert/pdfToWordConversion";

export function PdfToWordTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [progress, setProgress] = useState<string | null>(null);

  function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el archivo.");
      return;
    }

    setErrorMessage(null);
    setDownloadResult(null);
    setSelectedFile(file);
  }

  async function handleConvert() {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);
    setProgress(null);

    let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;

    try {
      const [loadedPdf, pdfjs] = await Promise.all([
        loadPdfDocument(selectedFile),
        getPdfjs(),
      ]);
      pdf = loadedPdf;
      const numPages = pdf.numPages;
      let completedPages = 0;
      const imageOperators = {
        saveOp: pdfjs.OPS.save,
        restoreOp: pdfjs.OPS.restore,
        transformOp: pdfjs.OPS.transform,
        paintImageOps: [
          pdfjs.OPS.paintImageXObject,
          pdfjs.OPS.paintImageXObjectRepeat,
          pdfjs.OPS.paintInlineImageXObject,
        ].filter(
          (operator): operator is number => typeof operator === "number",
        ),
      };

      setProgress(
        numPages > 1
          ? `Procesando 0 de ${numPages} páginas…`
          : "Analizando diseño de la página…",
      );
      const convertedPages = await Promise.all(
        Array.from({ length: numPages }, async (_, index) => {
          const pageNumber = index + 1;
          const page = await pdf!.getPage(pageNumber);

          try {
            return await buildEditablePageSection(
              page,
              pageNumber,
              imageOperators,
            );
          } finally {
            page.cleanup();
            completedPages += 1;
            if (numPages > 1) {
              setProgress(
                `Procesando ${completedPages} de ${numPages} páginas…`,
              );
            }
          }
        }),
      );
      const sections: ISectionOptions[] = [];
      let pagesWithContent = 0;

      for (const convertedPage of convertedPages) {
        sections.push(convertedPage.section);
        if (convertedPage.hasContent) {
          pagesWithContent += 1;
        }
      }

      if (pagesWithContent === 0) {
        throw new Error(
          "No se encontró texto ni imágenes editables. Prueba con la herramienta OCR si el PDF es un escaneo.",
        );
      }

      setProgress("Empaquetando DOCX…");
      const docx = new Document({
        sections,
      });

      const blob = await Packer.toBlob(docx);
      const url = URL.createObjectURL(blob);

      setDownloadResult({
        url,
        fileName: `${selectedFile.name.replace(/\.pdf$/i, "")}-convertido.docx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al convertir a Word.",
      );
    } finally {
      await pdf?.destroy();
      setIsProcessing(false);
      setProgress(null);
    }
  }

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleConvert}
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
        <FileText data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Convirtiendo a Word" : "Convertir PDF a Word"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Genera un DOCX editable con el diseño conservado lo mejor posible."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border bg-card p-8 text-center text-muted-foreground">
            {isProcessing ? (
              <Loader2 className="size-16 animate-spin text-brand opacity-80" />
            ) : (
              <FileText className="size-16 text-blue-500 opacity-50" />
            )}
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              {progress ? (
                <p className="mt-1 text-sm text-brand">{progress}</p>
              ) : (
                <p className="mt-1 text-sm">
                  Listo para generar DOCX editable con diseño conservado.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="PDF a Word"
      sidebarDescription="DOCX editable con diseño conservado lo mejor posible."
      sidebar={
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Reconstruye cada página con texto editable, tamaños de fuente,
            espaciado, columnas simples e imágenes ubicadas cerca de su posición
            original.
          </p>
          <p>
            El resultado no será idéntico al píxel en PDFs complejos con capas,
            formas o fuentes especiales. Para PDFs escaneados sin texto, usa{" "}
            <strong className="text-foreground">OCR PDF</strong> primero.
          </p>
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
