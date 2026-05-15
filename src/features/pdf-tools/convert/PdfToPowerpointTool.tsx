import { useState } from "react";
import { Presentation, Loader2 } from "lucide-react";
import pptxgen from "pptxgenjs";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import { loadPdfDocument } from "@/features/pdf-tools/shared/pdfPreview";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";

export function PdfToPowerpointTool() {
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

    let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;

    try {
      pdf = await loadPdfDocument(selectedFile);
      const numPages = pdf.numPages;

      const pptx = new pptxgen();

      for (let i = 1; i <= numPages; i++) {
        const slide = pptx.addSlide();
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        let allText = "";
        let currentY: number | null = null;
        let currentLine = "";

        for (const item of textContent.items) {
          if ("str" in item) {
            const y = Math.round(item.transform[5] / 10) * 10;
            if (currentY === null || Math.abs(y - currentY) < 5) {
              currentLine += item.str + " ";
              currentY = y;
            } else {
              if (currentLine.trim()) {
                allText += currentLine.trim() + "\n";
              }
              currentLine = item.str + " ";
              currentY = y;
            }
          }
        }
        if (currentLine.trim()) {
          allText += currentLine.trim() + "\n";
        }

        slide.addText(allText, {
          x: 0.5,
          y: 0.5,
          w: "90%",
          h: "90%",
          valign: "top",
        });
      }

      const pptxBuffer = (await pptx.write({
        outputType: "arraybuffer",
      })) as ArrayBuffer;
      const blob = new Blob([pptxBuffer], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(blob);

      setDownloadResult({
        url,
        fileName: selectedFile.name.replace(/\.pdf$/i, "") + "-convertido.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Error al convertir a PowerPoint.",
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
        <Presentation data-icon="inline-start" aria-hidden />
      )}
      {isProcessing
        ? "Convirtiendo a PowerPoint"
        : "Convertir PDF a PowerPoint"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      experimental
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Sube un archivo PDF para extraer sus páginas a diapositivas PowerPoint (.pptx)."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
            <Presentation className="size-16 opacity-50 text-orange-500" />
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">Listo para crear presentación PPTX.</p>
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="PDF a PowerPoint"
      sidebarDescription="Convierte documentos PDF a diapositivas localmente."
      sidebar={
        <div className="text-sm text-muted-foreground">
          Cada página del PDF se convertirá en una diapositiva con el texto
          extraído. El formato es básico para asegurar que toda la conversión
          ocurra 100% de manera privada en tu navegador.
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
