import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Document, Packer, Paragraph, Table } from "docx";

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
import { buildEditablePageBlocks } from "@/features/pdf-tools/convert/pdfToWordConversion";

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
      const documentBlocks: Array<Paragraph | Table> = [];
      const paintImageOps = [
        pdfjs.OPS.paintImageXObject,
        pdfjs.OPS.paintImageXObjectRepeat,
      ] as const;

      setProgress("Extrayendo contenido de las páginas…");
      const pagesBlocks = await Promise.all(
        Array.from({ length: numPages }, async (_, index) => {
          const pageNumber = index + 1;
          const page = await pdf!.getPage(pageNumber);

          try {
            return buildEditablePageBlocks(
              page,
              pageNumber,
              numPages,
              paintImageOps,
            );
          } finally {
            page.cleanup();
          }
        }),
      );

      for (const pageBlocks of pagesBlocks) {
        if (pageBlocks.length === 0) {
          continue;
        }
        if (documentBlocks.length > 0) {
          documentBlocks.push(new Paragraph({ pageBreakBefore: true }));
        }
        documentBlocks.push(...pageBlocks);
      }

      if (documentBlocks.length === 0) {
        throw new Error(
          "No se encontró texto ni imágenes editables. Prueba con la herramienta OCR si el PDF es un escaneo.",
        );
      }

      const docx = new Document({
        sections: [{ properties: {}, children: documentBlocks }],
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
      emptyDescription="Genera un DOCX con texto editable e imágenes incrustadas listas para modificar en Word."
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
                  Listo para generar DOCX editable.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="PDF a Word"
      sidebarDescription="Texto e imágenes editables, sin capturas de página."
      sidebar={
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Extrae el texto seleccionable del PDF y las imágenes incrustadas
            como objetos independientes en Word. Puedes editar párrafos,
            reemplazar fotos y mover contenido libremente.
          </p>
          <p>
            El diseño exacto del PDF no se conserva al píxel (tablas complejas o
            columnas pueden reordenarse). Para PDFs escaneados sin texto, usa{" "}
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
