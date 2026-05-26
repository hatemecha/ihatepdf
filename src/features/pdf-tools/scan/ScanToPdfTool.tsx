import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Camera,
  CheckCircle2,
  Crop,
  FileImage,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

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
import {
  processDocumentImage,
  type ProcessedDocumentImage,
  type ScanEnhancementMode,
  type ScanProcessingOptions,
} from "@/features/pdf-tools/scan/scanImageProcessing";
import { cn } from "@/lib/utils";

interface ScanImage {
  id: string;
  file: File;
  originalFile: File;
  previewUrl: string;
  originalName: string;
  documentDetected: boolean;
  enhanced: boolean;
  enhancementMode: ScanEnhancementMode;
  outputWidth: number;
  outputHeight: number;
}

const DEFAULT_SCAN_OPTIONS: ScanProcessingOptions = {
  autoCrop: true,
  enhance: true,
  enhancementMode: "color",
};

export function ScanToPdfTool() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [images, setImages] = useState<ScanImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [scanOptions, setScanOptions] =
    useState<ScanProcessingOptions>(DEFAULT_SCAN_OPTIONS);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const imagesRef = useRef<ScanImage[]>([]);
  const downloadResultRef = useRef<DownloadResult | null>(null);

  const isBusy = isPreparingImages || isGeneratingPdf;
  const selectedImage = useMemo(
    () =>
      images.find((image) => image.id === selectedImageId) ??
      images[images.length - 1] ??
      null,
    [images, selectedImageId],
  );

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    downloadResultRef.current = downloadResult;
  }, [downloadResult]);

  const stopCamera = useCallback(() => {
    setStream((currentStream) => {
      currentStream?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      imagesRef.current.forEach(revokeScanImage);
      if (downloadResultRef.current) {
        URL.revokeObjectURL(downloadResultRef.current.url);
      }
    };
  }, [stopCamera]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => undefined);

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  const clearDownloadResult = useCallback(() => {
    setDownloadResult((currentResult) => {
      if (currentResult) {
        URL.revokeObjectURL(currentResult.url);
      }
      return null;
    });
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setErrorMessage(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(mediaStream);
    } catch {
      setErrorMessage(
        "No se pudo acceder a la camara. Asegurate de dar permisos.",
      );
    }
  }, []);

  const prepareFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      setIsPreparingImages(true);
      setErrorMessage(null);
      clearDownloadResult();

      const preparedImages: ScanImage[] = [];

      try {
        for (const file of files) {
          const processed = await processDocumentImage(file, scanOptions);
          preparedImages.push(createScanImage(file, processed, scanOptions));
        }

        if (preparedImages.length > 0) {
          setImages((currentImages) => [...currentImages, ...preparedImages]);
          setSelectedImageId(preparedImages[preparedImages.length - 1].id);
        }
      } catch (error) {
        preparedImages.forEach(revokeScanImage);
        setErrorMessage(
          createErrorMessage(error, "No se pudo preparar la imagen."),
        );
      } finally {
        setIsPreparingImages(false);
      }
    },
    [clearDownloadResult, scanOptions],
  );

  const captureImage = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setErrorMessage("La camara todavia no esta lista para capturar.");
      return;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      setErrorMessage("El navegador no pudo capturar la imagen.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
      const file = new File([blob], `scan-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      await prepareFiles([file]);
    } catch (error) {
      setErrorMessage(
        createErrorMessage(error, "No se pudo capturar la imagen."),
      );
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }, [prepareFiles]);

  const removeImage = useCallback(
    (imageId: string) => {
      const imageToRemove = images.find((image) => image.id === imageId);
      const nextImages = images.filter((image) => image.id !== imageId);

      if (imageToRemove) {
        revokeScanImage(imageToRemove);
      }

      setImages(nextImages);
      setSelectedImageId((currentId) => {
        if (currentId !== imageId) {
          return currentId;
        }
        return nextImages[nextImages.length - 1]?.id ?? null;
      });
      clearDownloadResult();
    },
    [clearDownloadResult, images],
  );

  const reprocessImages = useCallback(async () => {
    if (images.length === 0 || isBusy) {
      return;
    }

    setIsPreparingImages(true);
    setErrorMessage(null);
    clearDownloadResult();

    const nextImages: ScanImage[] = [];

    try {
      for (const image of images) {
        const processed = await processDocumentImage(
          image.originalFile,
          scanOptions,
        );
        nextImages.push(
          createScanImage(image.originalFile, processed, scanOptions, image.id),
        );
      }

      setImages(nextImages);
      setSelectedImageId((currentId) =>
        currentId && nextImages.some((image) => image.id === currentId)
          ? currentId
          : (nextImages[nextImages.length - 1]?.id ?? null),
      );
      images.forEach(revokeScanImage);
    } catch (error) {
      nextImages.forEach(revokeScanImage);
      setErrorMessage(
        createErrorMessage(error, "No se pudieron reaplicar los ajustes."),
      );
    } finally {
      setIsPreparingImages(false);
    }
  }, [clearDownloadResult, images, isBusy, scanOptions]);

  async function handleGeneratePdf() {
    if (images.length === 0 || isBusy) return;

    setIsGeneratingPdf(true);
    setErrorMessage(null);
    clearDownloadResult();

    const worker = createPdfOperationWorker();

    try {
      const inputFiles = await Promise.all(
        images.map(async ({ file }) => ({
          name: file.name,
          mimeType: file.type,
          buffer: await file.arrayBuffer(),
        })),
      );

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
      stopCamera();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al generar PDF.",
      );
    } finally {
      worker.terminate();
      setIsGeneratingPdf(false);
    }
  }

  const pageCountLabel =
    images.length === 1 ? "1 pagina" : `${images.length} paginas`;
  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleGeneratePdf}
      disabled={images.length === 0 || isBusy}
      className="w-full"
    >
      {isBusy ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden
        />
      ) : (
        <FileImage data-icon="inline-start" aria-hidden />
      )}
      {isPreparingImages
        ? "Mejorando escaneos"
        : isGeneratingPdf
          ? "Generando PDF"
          : `Crear PDF con ${pageCountLabel}`}
    </Button>
  );

  const secondaryAction =
    !stream && images.length > 0 ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={startCamera}
        disabled={isBusy}
        className="w-full"
      >
        <Camera data-icon="inline-start" aria-hidden />
        Añadir con cámara
      </Button>
    ) : null;

  return (
    <ToolWorkspace
      accept="image/*"
      multiple={true}
      hasContent={stream !== null || images.length > 0}
      isProcessing={isBusy}
      onFilesSelected={(files) => void prepareFiles(files)}
      emptyTitle="Escanear a PDF"
      emptyDescription="Toma fotos o sube imagenes; la hoja se recorta, endereza y mejora localmente."
      emptyActionLabel="Subir fotos"
      emptyExtraAction={
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={startCamera}
          disabled={isBusy}
          className="w-full sm:w-auto"
        >
          <Camera data-icon="inline-start" aria-hidden />
          Abrir cámara
        </Button>
      }
      emptyHint="El procesamiento es 100% local."
      preview={
        <ScanPreview
          stream={stream}
          videoRef={videoRef}
          images={images}
          selectedImage={selectedImage}
          scanOptions={scanOptions}
          isPreparingImages={isPreparingImages}
          onCapture={() => void captureImage()}
          onStopCamera={stopCamera}
          onStartCamera={startCamera}
          onSelectImage={setSelectedImageId}
          onRemoveImage={removeImage}
        />
      }
      sidebarTitle="Escanear a PDF"
      sidebarDescription="Crea un PDF limpio desde fotos tomadas con la camara o subidas."
      sidebar={
        <ScanSidebar
          imageCount={images.length}
          scanOptions={scanOptions}
          isBusy={isBusy}
          onScanOptionsChange={setScanOptions}
          onReprocessImages={() => void reprocessImages()}
        />
      }
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      errorMessage={errorMessage}
      resultBanner={
        downloadResult ? (
          <DownloadReadyBanner
            downloadResult={downloadResult}
            onDismiss={clearDownloadResult}
          />
        ) : null
      }
      addMore={stream ? undefined : { label: "Subir más imágenes" }}
    />
  );
}

interface ScanPreviewProps {
  stream: MediaStream | null;
  videoRef: RefObject<HTMLVideoElement>;
  images: ScanImage[];
  selectedImage: ScanImage | null;
  scanOptions: ScanProcessingOptions;
  isPreparingImages: boolean;
  onCapture: () => void;
  onStopCamera: () => void;
  onStartCamera: () => void;
  onSelectImage: (imageId: string) => void;
  onRemoveImage: (imageId: string) => void;
}

function ScanPreview({
  stream,
  videoRef,
  images,
  selectedImage,
  scanOptions,
  isPreparingImages,
  onCapture,
  onStopCamera,
  onStartCamera,
  onSelectImage,
  onRemoveImage,
}: ScanPreviewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {stream ? (
        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-lg border border-border bg-neutral-950 shadow-sm">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <CameraGuide scanOptions={scanOptions} />
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 px-4">
            <Button
              type="button"
              variant="outline"
              onClick={onStopCamera}
              className="border-white/15 bg-black/55 text-white hover:bg-black/70"
            >
              Cerrar
            </Button>
            <Button
              type="button"
              size="lg"
              variant="brand"
              onClick={onCapture}
              disabled={isPreparingImages}
              className="size-16 rounded-full border-4 border-white/20 bg-brand p-0 text-brand-foreground hover:bg-brand"
              aria-label="Capturar pagina"
            >
              {isPreparingImages ? (
                <Loader2 className="size-6 animate-spin" aria-hidden />
              ) : (
                <Camera className="size-7" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      ) : selectedImage ? (
        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-lg border border-border bg-panel">
          <img
            src={selectedImage.previewUrl}
            alt={`Pagina escaneada desde ${selectedImage.originalName}`}
            className="h-full w-full object-contain"
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <ScanStatusBadge image={selectedImage} />
            <ScanEnhancementBadge image={selectedImage} />
            <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
              {selectedImage.outputWidth} x {selectedImage.outputHeight}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onStartCamera}
            className="absolute bottom-3 right-3 border-white/15 bg-black/60 text-white hover:bg-black/75"
          >
            <Camera data-icon="inline-start" aria-hidden />
            Cámara
          </Button>
        </div>
      ) : (
        <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-panel text-muted-foreground">
          <Camera className="size-12 opacity-50" aria-hidden />
          <p>Cámara apagada</p>
          <Button type="button" onClick={onStartCamera}>
            Reanudar cámara
          </Button>
        </div>
      )}

      {images.length > 0 ? (
        <div className="flex h-32 shrink-0 gap-3 overflow-x-auto rounded-lg border border-border bg-card p-3">
          {images.map((image, index) => {
            const isSelected = image.id === selectedImage?.id;
            return (
              <div
                key={image.id}
                className={cn(
                  "group relative h-full shrink-0 overflow-hidden rounded-md border bg-background text-left transition",
                  "aspect-[3/4] hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-brand ring-2 ring-brand/45"
                    : "border-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectImage(image.id)}
                  className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Ver pagina ${index + 1}`}
                >
                  <img
                    src={image.previewUrl}
                    alt={`Pagina ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveImage(image.id);
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Quitar pagina ${index + 1}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CameraGuide({ scanOptions }: { scanOptions: ScanProcessingOptions }) {
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <span className="rounded-md bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
          {scanOptions.autoCrop ? "Recorte auto" : "Marco completo"}
        </span>
        <span className="rounded-md bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
          {scanOptions.enhance
            ? scanOptions.enhancementMode === "mono"
              ? "B/N nitido"
              : "Color mejorado"
            : "Sin mejora"}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-5 rounded-md border border-white/40 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]">
        <span className="absolute -left-px -top-px size-8 border-l-2 border-t-2 border-white" />
        <span className="absolute -right-px -top-px size-8 border-r-2 border-t-2 border-white" />
        <span className="absolute -bottom-px -left-px size-8 border-b-2 border-l-2 border-white" />
        <span className="absolute -bottom-px -right-px size-8 border-b-2 border-r-2 border-white" />
      </div>
    </>
  );
}

function ScanStatusBadge({ image }: { image: ScanImage }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
      {image.documentDetected ? (
        <CheckCircle2 className="size-3.5" aria-hidden />
      ) : (
        <ImageIcon className="size-3.5" aria-hidden />
      )}
      {image.documentDetected ? "Hoja detectada" : "Marco completo"}
    </span>
  );
}

function ScanEnhancementBadge({ image }: { image: ScanImage }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
      <Sparkles className="size-3.5" aria-hidden />
      {image.enhanced
        ? image.enhancementMode === "mono"
          ? "B/N nitido"
          : "Color mejorado"
        : "Sin mejora"}
    </span>
  );
}

interface ScanSidebarProps {
  imageCount: number;
  scanOptions: ScanProcessingOptions;
  isBusy: boolean;
  onScanOptionsChange: (options: ScanProcessingOptions) => void;
  onReprocessImages: () => void;
}

function ScanSidebar({
  imageCount,
  scanOptions,
  isBusy,
  onScanOptionsChange,
  onReprocessImages,
}: ScanSidebarProps) {
  function updateOptions(nextOptions: Partial<ScanProcessingOptions>) {
    onScanOptionsChange({
      ...scanOptions,
      ...nextOptions,
    });
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <section className="flex flex-col gap-3 border-b border-hairline pb-5">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Crop className="size-4 text-brand" aria-hidden />
          Recorte
        </div>
        <SwitchRow
          label="Detectar hoja"
          checked={scanOptions.autoCrop}
          disabled={isBusy}
          onCheckedChange={(checked) => updateOptions({ autoCrop: checked })}
        />
      </section>

      <section className="flex flex-col gap-3 border-b border-hairline pb-5">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Sparkles className="size-4 text-brand" aria-hidden />
          Mejora
        </div>
        <SwitchRow
          label="Mejorar imagen"
          checked={scanOptions.enhance}
          disabled={isBusy}
          onCheckedChange={(checked) => updateOptions({ enhance: checked })}
        />
        <div className="grid grid-cols-2 rounded-md border border-border bg-background p-1">
          <ModeButton
            label="Color"
            isActive={scanOptions.enhancementMode === "color"}
            disabled={isBusy || !scanOptions.enhance}
            onClick={() => updateOptions({ enhancementMode: "color" })}
          />
          <ModeButton
            label="B/N"
            isActive={scanOptions.enhancementMode === "mono"}
            disabled={isBusy || !scanOptions.enhance}
            onClick={() => updateOptions({ enhancementMode: "mono" })}
          />
        </div>
      </section>

      {imageCount > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReprocessImages}
          disabled={isBusy}
          className="w-full"
        >
          <RefreshCw data-icon="inline-start" aria-hidden />
          Reaplicar ajustes
        </Button>
      ) : null}

      <div className="flex flex-col gap-2 text-muted-foreground">
        <p className="font-medium text-foreground">Captura</p>
        <ol className="flex list-decimal flex-col gap-1 pl-4">
          <li>Ubica la hoja completa dentro del marco.</li>
          <li>Evita sombras duras sobre los bordes.</li>
          <li>Repite una foto por cada pagina.</li>
        </ol>
      </div>
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SwitchRow({
  label,
  checked,
  disabled,
  onCheckedChange,
}: SwitchRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="font-medium text-foreground">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 rounded-full border transition",
          checked
            ? "border-brand bg-brand"
            : "border-border bg-muted text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white transition",
            checked ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

interface ModeButtonProps {
  label: string;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ModeButton({ label, isActive, disabled, onClick }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {label}
    </button>
  );
}

function createScanImage(
  originalFile: File,
  processed: ProcessedDocumentImage,
  options: ScanProcessingOptions,
  stableId?: string,
): ScanImage {
  return {
    id:
      stableId ??
      `${processed.file.name}-${processed.file.size}-${processed.file.lastModified}-${crypto.randomUUID()}`,
    file: processed.file,
    originalFile,
    previewUrl: URL.createObjectURL(processed.file),
    originalName: originalFile.name,
    documentDetected: processed.documentDetected,
    enhanced: options.enhance,
    enhancementMode: options.enhancementMode,
    outputWidth: processed.outputWidth,
    outputHeight: processed.outputHeight,
  };
}

function revokeScanImage(image: ScanImage) {
  URL.revokeObjectURL(image.previewUrl);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo crear la foto escaneada."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function createErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}
