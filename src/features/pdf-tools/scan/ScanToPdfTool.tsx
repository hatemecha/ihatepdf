import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import {
  Camera,
  CheckCircle2,
  Crop,
  Download,
  FileImage,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DownloadResult } from "@/features/pdf-tools/shared/DownloadReadyBanner";
import { sanitizeDownloadFileName } from "@/features/pdf-tools/shared/downloadFileName";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
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

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length > 0) {
        void prepareFiles(files);
      }
    },
    [prepareFiles],
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
    images.length === 1 ? "1 página" : `${images.length} páginas`;
  const hasContent = stream !== null || images.length > 0;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto lg:overflow-hidden">
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInputChange}
      />

      {hasContent ? (
        <div className="grid grid-cols-1 gap-4 pb-28 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-0 lg:pb-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-hidden lg:pr-6">
            <ScanPreview
              stream={stream}
              videoRef={videoRef}
              images={images}
              selectedImage={selectedImage}
              scanOptions={scanOptions}
              isPreparingImages={isPreparingImages}
              isGeneratingPdf={isGeneratingPdf}
              isBusy={isBusy}
              onCapture={() => void captureImage()}
              onStopCamera={stopCamera}
              onStartCamera={startCamera}
              onGeneratePdf={() => void handleGeneratePdf()}
              onSelectImage={setSelectedImageId}
              onRemoveImage={removeImage}
            />

            {errorMessage ? (
              <Alert variant="destructive" className="shrink-0">
                <AlertTitle>No se pudo continuar</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <details className="rounded-lg border border-border bg-card p-3 lg:hidden">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Ajustes de escaneo
              </summary>
              <div className="mt-4">
                <ScanSidebar
                  imageCount={images.length}
                  scanOptions={scanOptions}
                  isBusy={isBusy}
                  onScanOptionsChange={setScanOptions}
                  onReprocessImages={() => void reprocessImages()}
                />
              </div>
            </details>
          </div>

          <aside className="hidden min-w-0 flex-col gap-4 border-l border-border pl-6 lg:flex lg:min-h-0 lg:overflow-hidden">
            <header className="shrink-0">
              <h2 className="text-base font-semibold leading-tight">
                Escanear a PDF
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Crea un PDF limpio desde fotos tomadas con la cámara o subidas.
              </p>
            </header>

            {downloadResult ? (
              <ScanDownloadPanel
                downloadResult={downloadResult}
                onDismiss={clearDownloadResult}
              />
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <ScanSidebar
                imageCount={images.length}
                scanOptions={scanOptions}
                isBusy={isBusy}
                onScanOptionsChange={setScanOptions}
                onReprocessImages={() => void reprocessImages()}
              />
            </div>

            <footer className="flex shrink-0 flex-col gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openFilePicker}
                disabled={isBusy}
                className="w-full"
              >
                <Upload data-icon="inline-start" aria-hidden />
                Subir más imágenes
              </Button>
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
              <Button
                type="button"
                variant="brand"
                size="lg"
                onClick={handleGeneratePdf}
                disabled={images.length === 0 || isBusy}
                className="w-full"
              >
                <PrimaryActionIcon
                  isBusy={isBusy}
                  isPreparingImages={isPreparingImages}
                />
                {isPreparingImages
                  ? "Mejorando escaneos"
                  : isGeneratingPdf
                    ? "Generando PDF"
                    : `Crear PDF con ${pageCountLabel}`}
              </Button>
            </footer>
          </aside>

          <MobileScanActionBar
            imageCount={images.length}
            stream={stream}
            downloadResult={downloadResult}
            isBusy={isBusy}
            isPreparingImages={isPreparingImages}
            isGeneratingPdf={isGeneratingPdf}
            onOpenCamera={startCamera}
            onOpenFilePicker={openFilePicker}
            onGeneratePdf={() => void handleGeneratePdf()}
            onDismissDownload={clearDownloadResult}
          />
        </div>
      ) : (
        <ScanEmptyState
          isBusy={isBusy}
          errorMessage={errorMessage}
          onOpenCamera={startCamera}
          onOpenFilePicker={openFilePicker}
        />
      )}
    </div>
  );
}

interface ScanPreviewProps {
  stream: MediaStream | null;
  videoRef: RefObject<HTMLVideoElement>;
  images: ScanImage[];
  selectedImage: ScanImage | null;
  scanOptions: ScanProcessingOptions;
  isPreparingImages: boolean;
  isGeneratingPdf: boolean;
  isBusy: boolean;
  onCapture: () => void;
  onStopCamera: () => void;
  onStartCamera: () => void;
  onGeneratePdf: () => void;
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
  isGeneratingPdf,
  isBusy,
  onCapture,
  onStopCamera,
  onStartCamera,
  onGeneratePdf,
  onSelectImage,
  onRemoveImage,
}: ScanPreviewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {stream ? (
        <div className="relative min-h-[calc(100svh-18rem)] flex-1 overflow-hidden rounded-lg border border-border bg-neutral-950 shadow-sm lg:min-h-[320px]">
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
            {images.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={onGeneratePdf}
                disabled={isBusy}
                className="border-white/15 bg-black/55 text-white hover:bg-black/70"
              >
                {isGeneratingPdf ? (
                  <Loader2
                    className="animate-spin"
                    data-icon="inline-start"
                    aria-hidden
                  />
                ) : (
                  <FileImage data-icon="inline-start" aria-hidden />
                )}
                PDF
              </Button>
            ) : null}
          </div>
        </div>
      ) : selectedImage ? (
        <div className="relative min-h-[calc(100svh-19rem)] flex-1 overflow-hidden rounded-lg border border-border bg-panel lg:min-h-[320px]">
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

interface ScanEmptyStateProps {
  isBusy: boolean;
  errorMessage: string | null;
  onOpenCamera: () => void;
  onOpenFilePicker: () => void;
}

function ScanEmptyState({
  isBusy,
  errorMessage,
  onOpenCamera,
  onOpenFilePicker,
}: ScanEmptyStateProps) {
  return (
    <div className="flex min-h-full items-center justify-center px-3 py-6 sm:px-6">
      <div className="flex w-full max-w-md flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex size-12 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Camera className="size-6" aria-hidden />
          </div>
          <h2 className="text-2xl font-semibold leading-tight">
            Escanear a PDF
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Usa la cámara como escáner: detecta la hoja, corrige perspectiva y
            mejora la imagen antes de armar el PDF.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="brand"
            size="lg"
            onClick={onOpenCamera}
            disabled={isBusy}
            className="h-14 w-full"
          >
            <Camera data-icon="inline-start" aria-hidden />
            Escanear con cámara
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onOpenFilePicker}
            disabled={isBusy}
            className="h-14 w-full"
          >
            <Upload data-icon="inline-start" aria-hidden />
            Subir fotos
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Todo el procesamiento ocurre en tu navegador.
        </p>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo continuar</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}

interface MobileScanActionBarProps {
  imageCount: number;
  stream: MediaStream | null;
  downloadResult: DownloadResult | null;
  isBusy: boolean;
  isPreparingImages: boolean;
  isGeneratingPdf: boolean;
  onOpenCamera: () => void;
  onOpenFilePicker: () => void;
  onGeneratePdf: () => void;
  onDismissDownload: () => void;
}

function MobileScanActionBar({
  imageCount,
  stream,
  downloadResult,
  isBusy,
  isPreparingImages,
  isGeneratingPdf,
  onOpenCamera,
  onOpenFilePicker,
  onGeneratePdf,
  onDismissDownload,
}: MobileScanActionBarProps) {
  if (downloadResult) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden">
        <ScanDownloadPanel
          downloadResult={downloadResult}
          onDismiss={onDismissDownload}
          compact
        />
      </div>
    );
  }

  if (stream || imageCount === 0) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {imageCount === 1
              ? "1 página lista"
              : `${imageCount} páginas listas`}
          </span>
          <span>{isPreparingImages ? "Mejorando..." : "Listo para PDF"}</span>
        </div>
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenCamera}
            disabled={isBusy}
            aria-label="Añadir con cámara"
          >
            <Camera aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenFilePicker}
            disabled={isBusy}
            aria-label="Subir fotos"
          >
            <Upload aria-hidden />
          </Button>
          <Button
            type="button"
            variant="brand"
            size="lg"
            onClick={onGeneratePdf}
            disabled={imageCount === 0 || isBusy}
            className="h-12 min-w-0 px-3 text-base"
          >
            <PrimaryActionIcon
              isBusy={isBusy}
              isPreparingImages={isPreparingImages}
            />
            <span className="truncate">
              {isPreparingImages
                ? "Mejorando"
                : isGeneratingPdf
                  ? "Generando"
                  : "Crear PDF"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ScanDownloadPanelProps {
  downloadResult: DownloadResult;
  onDismiss: () => void;
  compact?: boolean;
}

function ScanDownloadPanel({
  downloadResult,
  onDismiss,
  compact = false,
}: ScanDownloadPanelProps) {
  const fileNameInputRef = useRef<HTMLInputElement>(null);

  function resolveDownloadFileName(): string {
    const draftName =
      fileNameInputRef.current?.value ?? downloadResult.fileName;
    return sanitizeDownloadFileName(
      draftName,
      downloadResult.fileName,
      downloadResult.mimeType,
    );
  }

  return (
    <section
      role="status"
      className={cn(
        "relative rounded-lg border border-brand/55 bg-brand/10 text-foreground shadow-sm",
        compact ? "p-3" : "p-4",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-8 rounded-full"
        aria-label="Cerrar descarga"
        onClick={onDismiss}
      >
        <X className="size-4" aria-hidden />
      </Button>
      <div className="flex flex-col gap-3 pr-8">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <Download className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">PDF listo</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tu escaneo ya se puede descargar.
            </p>
          </div>
        </div>

        {!compact ? (
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-xs font-medium text-muted-foreground">
              Nombre del archivo
            </span>
            <input
              ref={fileNameInputRef}
              type="text"
              defaultValue={downloadResult.fileName}
              className="field-input h-10 rounded-md px-2.5 text-sm text-foreground"
              aria-label="Nombre del archivo a descargar"
            />
          </label>
        ) : null}

        <Button asChild variant="brand" size="lg" className="w-full">
          <a
            href={downloadResult.url}
            download={downloadResult.fileName}
            onClick={(event) => {
              event.currentTarget.download = resolveDownloadFileName();
            }}
          >
            <Download data-icon="inline-start" aria-hidden />
            Descargar PDF
          </a>
        </Button>
      </div>
    </section>
  );
}

function PrimaryActionIcon({
  isBusy,
  isPreparingImages,
}: {
  isBusy: boolean;
  isPreparingImages: boolean;
}) {
  if (isBusy) {
    return (
      <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
    );
  }

  return isPreparingImages ? (
    <Sparkles data-icon="inline-start" aria-hidden />
  ) : (
    <FileImage data-icon="inline-start" aria-hidden />
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
