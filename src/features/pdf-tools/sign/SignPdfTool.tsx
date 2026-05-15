import { useState } from "react";
import { PenTool, Loader2, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import { getPdfPageCount } from "@/features/pdf-tools/shared/pdfPreview";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";

export function SignPdfTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signatureImage, setSignatureImage] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const [page, setPage] = useState(1);
  const [xPos, setXPos] = useState(50);
  const [yPos, setYPos] = useState(50);
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(50);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  async function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el PDF.");
      return;
    }

    setErrorMessage(null);
    setDownloadResult(null);

    try {
      const count = await getPdfPageCount(file);
      setPageCount(count);
      setSelectedFile(file);
    } catch {
      setErrorMessage("Error al contar las páginas del PDF.");
    }
  }

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      setSignatureImage(file);
      setErrorMessage(null);
    } else {
      setErrorMessage("La firma debe ser una imagen PNG o JPG.");
    }
  }

  async function handleSignPdf() {
    if (!selectedFile || !signatureImage) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    try {
      const pdfBuffer = await selectedFile.arrayBuffer();
      const imgBuffer = await signatureImage.arrayBuffer();

      const worker = createPdfOperationWorker();
      const result = await runPdfOperation(worker, {
        kind: "sign-pdf",
        file: { name: selectedFile.name, buffer: pdfBuffer },
        options: {
          page: page - 1, // 0-indexed in pdf-lib
          x: xPos,
          y: yPos,
          width,
          height,
          signatureImage: imgBuffer,
        },
      });

      if (result.kind === "file") {
        const blob = new Blob([result.buffer], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        setDownloadResult({
          url,
          fileName: selectedFile.name.replace(/\.pdf$/i, "") + "-firmado.pdf",
          mimeType: result.mimeType,
        });
      } else {
        throw new Error("Respuesta inesperada");
      }
      worker.terminate();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al firmar PDF.",
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
      onClick={handleSignPdf}
      disabled={!selectedFile || !signatureImage || isProcessing}
      className="w-full"
    >
      {isProcessing ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden
        />
      ) : (
        <PenTool data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Firmando documento" : "Estampar firma"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF a firmar"
      emptyDescription="Sube un PDF y luego sube tu firma (PNG/JPG) para estamparla."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-6 text-muted-foreground p-8 text-center overflow-y-auto">
            {!signatureImage ? (
              <div className="flex flex-col items-center gap-4">
                <ImageIcon className="size-16 opacity-50" />
                <p className="font-medium text-foreground">Sube tu firma</p>
                <label className="cursor-pointer bg-brand hover:bg-brand/90 text-primary-foreground px-4 py-2 rounded-md font-medium text-sm transition-colors">
                  Seleccionar imagen (PNG/JPG)
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    onChange={handleSignatureUpload}
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="border border-brand p-2 bg-white rounded flex items-center justify-center"
                  style={{ width: width, height: height }}
                >
                  <img
                    src={URL.createObjectURL(signatureImage)}
                    className="max-w-full max-h-full object-contain"
                    alt="Firma"
                  />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Configuración de firma
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-4 text-left">
                    <label className="flex flex-col gap-1">
                      Página (1-{pageCount})
                      <input
                        type="number"
                        min={1}
                        max={pageCount}
                        value={page}
                        onChange={(e) => setPage(parseInt(e.target.value) || 1)}
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                    <div />
                    <label className="flex flex-col gap-1">
                      Posición X (puntos)
                      <input
                        type="number"
                        value={xPos}
                        onChange={(e) => setXPos(parseInt(e.target.value) || 0)}
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Posición Y (puntos)
                      <input
                        type="number"
                        value={yPos}
                        onChange={(e) => setYPos(parseInt(e.target.value) || 0)}
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Ancho (puntos)
                      <input
                        type="number"
                        value={width}
                        onChange={(e) =>
                          setWidth(parseInt(e.target.value) || 0)
                        }
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Alto (puntos)
                      <input
                        type="number"
                        value={height}
                        onChange={(e) =>
                          setHeight(parseInt(e.target.value) || 0)
                        }
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSignatureImage(null)}
                >
                  Cambiar firma
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="Firmar PDF"
      sidebarDescription="Añade tu firma o un sello visual al documento."
      sidebar={
        <div className="text-sm text-muted-foreground flex flex-col gap-2">
          <p>1. Selecciona el PDF.</p>
          <p>2. Sube una imagen de tu firma (preferiblemente PNG sin fondo).</p>
          <p>3. Ajusta la posición y tamaño.</p>
          <p>4. Guarda el documento.</p>
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
