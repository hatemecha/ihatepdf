import { useState } from "react";
import { Wrench, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";

export function RepairPdfTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    // We don't strictly validate structure because it might be corrupt, but we validate type/size
    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el archivo.");
      return;
    }

    setErrorMessage(null);
    setDownloadResult(null);
    setSelectedFile(file);
  }

  async function handleRepair() {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const worker = createPdfOperationWorker();
      const result = await runPdfOperation(worker, {
        kind: "repair-pdf",
        file: { name: selectedFile.name, buffer },
      });

      if (result.kind === "file") {
        const blob = new Blob([result.buffer], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        setDownloadResult({
          url,
          fileName: selectedFile.name.replace(/\.pdf$/i, "") + "-reparado.pdf",
          mimeType: result.mimeType,
        });
      } else {
        throw new Error("Respuesta inesperada del worker.");
      }
      worker.terminate();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al reparar PDF.",
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
      onClick={handleRepair}
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
        <Wrench data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Reparando documento" : "Reparar PDF"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Sube un archivo PDF corrupto o que no se puede abrir."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
            <Wrench className="size-16 opacity-50 text-destructive" />
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">Listo para intentar reconstrucción.</p>
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="Reparar PDF"
      sidebarDescription="Intenta arreglar un PDF dañado reconstruyendo su estructura interna."
      sidebar={
        <div className="text-sm text-muted-foreground">
          La reparación funciona mejor con tablas de referencias cruzadas (XRef)
          dañadas. Si el archivo está completamente ilegible (no es PDF real),
          no se podrá reparar.
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
