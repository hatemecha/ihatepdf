import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import { loadPdfDocument } from "@/features/pdf-tools/shared/pdfPreview";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";

export function ExtractTextTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);

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

  async function handleExtractText() {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    try {
      const pdf = await loadPdfDocument(selectedFile);
      const textParts: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          // @ts-ignore - The types are slightly tricky with TextItem vs TextMark
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        textParts.push(`--- Página ${i} ---\n${pageText}\n`);
      }

      const finalString = textParts.join("\n");
      const blob = new Blob([finalString], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const fileName = selectedFile.name.replace(/\.pdf$/i, "") + "-texto.txt";
      
      setDownloadResult({
        url,
        fileName,
        mimeType: "text/plain",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al extraer texto.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleExtractText}
      disabled={!selectedFile || isProcessing}
      className="w-full"
    >
      {isProcessing ? (
        <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
      ) : (
        <FileText data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Extrayendo texto" : "Extraer texto a TXT"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Extrae todo el texto seleccionable de las páginas del PDF."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
            <FileText className="size-16 opacity-50" />
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">Listo para extraer el texto.</p>
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="PDF a texto"
      sidebarDescription="Convierte el contenido a un archivo de texto plano (.txt)."
      sidebar={<div className="text-sm text-muted-foreground">Nota: Solo se extraerá texto real, no texto dentro de imágenes escaneadas. Usa OCR para imágenes.</div>}
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={downloadResult ? <DownloadReadyBanner downloadResult={downloadResult} /> : null}
    />
  );
}
