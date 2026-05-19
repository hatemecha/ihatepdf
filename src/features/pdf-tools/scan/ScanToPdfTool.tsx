import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, FileImage, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";

interface ScanImage {
  id: string;
  file: File;
}

export function ScanToPdfTool() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [images, setImages] = useState<ScanImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      setErrorMessage(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setErrorMessage(
        "No se pudo acceder a la cámara. Asegúrate de dar permisos.",
      );
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `scan-${images.length + 1}.jpg`, {
                type: "image/jpeg",
              });
              setImages((prev) => [...prev, createScanImage(file)]);
            }
          },
          "image/jpeg",
          0.9,
        );
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleGeneratePdf() {
    if (images.length === 0) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    try {
      const inputFiles = await Promise.all(
        images.map(async ({ file }) => ({
          name: file.name,
          mimeType: file.type,
          buffer: await file.arrayBuffer(),
        })),
      );

      const worker = createPdfOperationWorker();
      const result = await runPdfOperation(worker, {
        kind: "images-to-pdf",
        files: inputFiles,
        options: {
          pageSize: "a4",
          orientation: "auto",
          margin: "small",
        },
      });

      if (result.kind === "file") {
        const blob = new Blob([result.buffer], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        setDownloadResult({
          url,
          fileName: "ihatepdf-escaneado.pdf",
          mimeType: result.mimeType,
        });
      } else {
        throw new Error("Respuesta inesperada");
      }
      worker.terminate();
      stopCamera();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al generar PDF.",
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
      onClick={handleGeneratePdf}
      disabled={images.length === 0 || isProcessing}
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
      {isProcessing
        ? "Generando PDF"
        : `Convertir ${images.length} fotos a PDF`}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="image/*"
      multiple={true}
      hasContent={stream !== null || images.length > 0}
      isProcessing={isProcessing}
      onFilesSelected={(files) =>
        setImages((prev) => [...prev, ...files.map(createScanImage)])
      }
      emptyTitle="Escanear con Cámara"
      emptyDescription="Toma fotos con tu cámara y conviértelas en un solo documento PDF."
      emptyActionLabel="Abrir Cámara"
      emptyHint="El procesamiento es 100% local."
      preview={
        <div className="flex h-full flex-col gap-4 overflow-hidden">
          {stream ? (
            <div className="relative flex-1 bg-neutral-950 rounded-xl overflow-hidden shadow-sm border border-border/50 group">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                <Button variant="destructive" onClick={stopCamera}>
                  Cerrar
                </Button>
                <Button
                  size="lg"
                  variant="default"
                  onClick={captureImage}
                  className="size-14 rounded-full p-0"
                >
                  <Camera className="size-6" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 border rounded-xl flex items-center justify-center bg-card text-muted-foreground flex-col gap-4">
              <Camera className="size-12 opacity-50" />
              <p>Cámara apagada</p>
              <Button onClick={startCamera}>Reanudar cámara</Button>
            </div>
          )}

          {images.length > 0 && (
            <div className="h-32 shrink-0 border rounded-xl bg-card p-3 flex gap-3 overflow-x-auto">
              {images.map((image, idx) => (
                <div
                  key={image.id}
                  className="relative h-full shrink-0 aspect-[3/4] border rounded-md overflow-hidden group"
                >
                  <img
                    src={URL.createObjectURL(image.file)}
                    alt={`Scan ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      }
      sidebarTitle="Escanear a PDF"
      sidebarDescription="Crea un archivo PDF a partir de fotos tomadas con tu cámara o subidas."
      sidebar={
        <div className="text-sm text-muted-foreground">
          <p>Instrucciones:</p>
          <ul className="list-disc pl-4 mt-2 flex flex-col gap-1">
            <li>Otorga permisos a la cámara.</li>
            <li>Enfoca el documento y pulsa capturar.</li>
            <li>Repite para todas las páginas.</li>
            <li>Las imágenes se ajustarán automáticamente a tamaño A4.</li>
          </ul>
        </div>
      }
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={
        downloadResult ? (
          <DownloadReadyBanner
            downloadResult={downloadResult}
            onDismiss={() => setDownloadResult(null)}
          />
        ) : null
      }
      addMore={stream ? undefined : { label: "Subir más imágenes" }}
    />
  );
}

function createScanImage(file: File): ScanImage {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
  };
}
