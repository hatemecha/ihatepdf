import { useState } from "react";
import { ScanText, Loader2, Copy, Check } from "lucide-react";
import { createWorker } from "tesseract.js";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import {
  loadPdfDocument,
  renderPdfPageToCanvas,
} from "@/features/pdf-tools/shared/pdfPreview";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";

export function OcrTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [progress, setProgress] = useState<{
    page: number;
    total: number;
    status: string;
  } | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

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
    setProgress(null);
    setExtractedText(null);
    setSelectedFile(file);
  }

  async function handleOcr() {
    if (!selectedFile) return;

    setExtractedText(null);
    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    try {
      setProgress({
        page: 0,
        total: 0,
        status:
          "Cargando modelo Tesseract (puede tardar un poco la primera vez)…",
      });
      const worker = await createWorker("spa+eng");

      const pdf = await loadPdfDocument(selectedFile);
      setProgress({
        page: 0,
        total: pdf.numPages,
        status: "Preparando páginas…",
      });

      async function recognizePage(
        pageNumber: number,
        accumulatedText: string,
      ): Promise<string> {
        if (pageNumber > pdf!.numPages) {
          return accumulatedText;
        }

        setProgress({
          page: pageNumber,
          total: pdf.numPages,
          status: "Renderizando página a imagen…",
        });

        const canvas = document.createElement("canvas");

        // Render at a decent scale for OCR, e.g. targetWidth 1600
        const renderHandle = renderPdfPageToCanvas({
          pdf,
          pageNumber,
          canvas,
          targetWidth: 1600,
        });

        await renderHandle.promise;

        setProgress({
          page: pageNumber,
          total: pdf.numPages,
          status: "Ejecutando OCR (esto puede tardar unos segundos)…",
        });
        const {
          data: { text },
        } = await worker.recognize(canvas);

        return recognizePage(
          pageNumber + 1,
          `${accumulatedText}--- Página ${pageNumber} ---\n${text}\n\n`,
        );
      }

      const finalString = await recognizePage(1, "");

      await worker.terminate();

      const blob = new Blob([finalString], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const fileName = selectedFile.name.replace(/\.pdf$/i, "") + "-ocr.txt";

      setExtractedText(finalString);
      setDownloadResult({
        url,
        fileName,
        mimeType: "text/plain",
      });
      setProgress(null);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Error al procesar OCR.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCopyText() {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // fallback: select the text manually
    }
  }

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleOcr}
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
        <ScanText data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Procesando…" : "Ejecutar OCR local"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Extrae texto de documentos o imágenes escaneadas utilizando Reconocimiento Óptico de Caracteres (OCR)."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          extractedText ? (
            <div className="flex h-full flex-col bg-card rounded-xl border overflow-hidden">
              <div className="shrink-0 border-b border-border flex items-center justify-between px-4 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {selectedFile.name}: Texto extraído
                </span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copyFeedback ? (
                    <>
                      <Check className="size-3.5" aria-hidden />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
                {extractedText}
              </pre>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
              {isProcessing ? (
                <Loader2 className="size-16 animate-spin text-brand opacity-80" />
              ) : (
                <ScanText className="size-16 opacity-50" />
              )}
              <div>
                <p className="font-medium text-foreground">
                  {selectedFile.name}
                </p>
                {progress ? (
                  <div className="mt-2 text-sm text-brand">
                    <p>{progress.status}</p>
                    {progress.total > 0 && (
                      <p className="font-mono mt-1 text-xs">
                        Página {progress.page} / {progress.total}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm mt-1">
                    Listo para extraer texto de imágenes escaneadas.
                  </p>
                )}
              </div>
            </div>
          )
        ) : (
          <div />
        )
      }
      sidebarTitle="OCR PDF"
      sidebarDescription="Utiliza IA local (Tesseract.js) para extraer texto de imágenes o PDFs que no tienen texto seleccionable."
      sidebar={
        <div className="text-sm text-muted-foreground flex flex-col gap-2">
          <p>
            El motor analizará los pixeles de cada página para encontrar letras
            y palabras. El resultado se descargará como `.txt`.
          </p>
          <p>
            <strong>Nota importante:</strong> Esto puede consumir mucha batería
            y procesador porque se ejecuta directamente en tu dispositivo.
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
