import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Loader2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import {
  formatFileSize,
  validateImageFiles,
} from "@/features/pdf-tools/shared/fileValidation";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";
import type {
  ImageInputFile,
  ImageToPdfOptions,
} from "@/features/pdf-tools/shared/pdfOperation.types";

import { toPdfImageInputFile } from "./imageFileConversion";

interface SelectedImageFile {
  id: string;
  file: File;
  previewUrl: string;
}

const DEFAULT_PDF_OPTIONS: ImageToPdfOptions = {
  pageSize: "a4",
  orientation: "auto",
  margin: "normal",
};

const PAGE_SIZE_OPTIONS: Array<{
  value: ImageToPdfOptions["pageSize"];
  label: string;
}> = [
  { value: "a4", label: "A4" },
  { value: "letter", label: "Carta" },
  { value: "image", label: "Imagen" },
];

const ORIENTATION_OPTIONS: Array<{
  value: ImageToPdfOptions["orientation"];
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "portrait", label: "Vertical" },
  { value: "landscape", label: "Horizontal" },
];

const MARGIN_OPTIONS: Array<{
  value: ImageToPdfOptions["margin"];
  label: string;
}> = [
  { value: "none", label: "0" },
  { value: "small", label: "Chico" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Grande" },
];

const PDF_PREVIEW_PAGE_SIZES = {
  a4: {
    portrait: { width: 595.28, height: 841.89 },
    landscape: { width: 841.89, height: 595.28 },
  },
  letter: {
    portrait: { width: 612, height: 792 },
    landscape: { width: 792, height: 612 },
  },
};

const PDF_PREVIEW_MARGINS: Record<ImageToPdfOptions["margin"], number> = {
  none: 0,
  small: 18,
  normal: 36,
  large: 72,
};

interface ImageDimensions {
  width: number;
  height: number;
}

function resolveImageToPdfPreviewPage(
  options: ImageToPdfOptions,
  dimensions?: ImageDimensions,
) {
  const imageWidth = dimensions?.width ?? 595;
  const imageHeight = dimensions?.height ?? 842;
  const margin = PDF_PREVIEW_MARGINS[options.margin];

  if (options.pageSize === "image") {
    return {
      width: imageWidth + margin * 2,
      height: imageHeight + margin * 2,
      margin,
    };
  }

  const baseSize =
    PDF_PREVIEW_PAGE_SIZES[options.pageSize][
      imageWidth > imageHeight ? "landscape" : "portrait"
    ];
  const orientation =
    options.orientation === "auto"
      ? imageWidth > imageHeight
        ? "landscape"
        : "portrait"
      : options.orientation;

  return {
    width:
      orientation === "landscape"
        ? Math.max(baseSize.width, baseSize.height)
        : Math.min(baseSize.width, baseSize.height),
    height:
      orientation === "landscape"
        ? Math.min(baseSize.width, baseSize.height)
        : Math.max(baseSize.width, baseSize.height),
    margin,
  };
}

function createFileId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getSelectedFilesSize(files: SelectedImageFile[]): number {
  return files.reduce((sum, item) => sum + item.file.size, 0);
}

interface ImageToPdfSimpleModeProps {
  registerFilesForLayout?: (files: File[]) => void;
}

export function ImageToPdfSimpleMode({
  registerFilesForLayout,
}: ImageToPdfSimpleModeProps = {}) {
  return useImageToPdfSimpleMode({ registerFilesForLayout });
}

function useImageToPdfSimpleMode({
  registerFilesForLayout,
}: ImageToPdfSimpleModeProps) {
  const workerRef = useRef<Worker | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedImageFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfOptions, setPdfOptions] =
    useState<ImageToPdfOptions>(DEFAULT_PDF_OPTIONS);
  const [imageDimensionsById, setImageDimensionsById] = useState<
    Record<string, ImageDimensions>
  >({});

  const totalSize = useMemo(
    () => getSelectedFilesSize(selectedFiles),
    [selectedFiles],
  );
  const canConvert = selectedFiles.length > 0 && !isProcessing;

  function replaceDownloadResult(nextResult: DownloadResult | null) {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }
    resultUrlRef.current = nextResult?.url ?? null;
    setDownloadResult(nextResult);
  }

  function clearDownloadResult() {
    replaceDownloadResult(null);
  }

  function updatePdfOptions(patch: Partial<ImageToPdfOptions>) {
    setPdfOptions((current) => ({ ...current, ...patch }));
    setErrorMessage(null);
    clearDownloadResult();
  }

  function disposePreviewUrls(items: SelectedImageFile[]) {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }

  function updateSelectedFiles(nextFiles: SelectedImageFile[]) {
    setSelectedFiles(nextFiles);
    registerFilesForLayout?.(nextFiles.map((item) => item.file));
    setErrorMessage(null);
    clearDownloadResult();
  }

  function handleFilesSelected(incomingFiles: File[]) {
    const newItems: SelectedImageFile[] = incomingFiles.map((file) => ({
      id: createFileId(file),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    const nextFiles = [...selectedFiles, ...newItems];
    const validation = validateImageFiles(nextFiles.map(({ file }) => file));

    if (!validation.isValid) {
      disposePreviewUrls(newItems);
      setErrorMessage(
        validation.errors[0] ?? "No se pudieron agregar imágenes.",
      );
      return;
    }

    updateSelectedFiles(nextFiles);
  }

  function removeFile(fileId: string) {
    const removed = selectedFiles.find((item) => item.id === fileId);
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    setImageDimensionsById((current) => {
      const remaining = { ...current };
      delete remaining[fileId];
      return remaining;
    });
    updateSelectedFiles(selectedFiles.filter((item) => item.id !== fileId));
  }

  function moveFile(fileId: string, direction: -1 | 1) {
    const currentIndex = selectedFiles.findIndex((item) => item.id === fileId);
    const nextIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= selectedFiles.length
    ) {
      return;
    }
    const nextFiles = [...selectedFiles];
    const [moved] = nextFiles.splice(currentIndex, 1);
    nextFiles.splice(nextIndex, 0, moved);
    updateSelectedFiles(nextFiles);
  }

  function clearList() {
    disposePreviewUrls(selectedFiles);
    setImageDimensionsById({});
    updateSelectedFiles([]);
  }

  function rememberImageDimensions(fileId: string, image: HTMLImageElement) {
    const dimensions = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
    setImageDimensionsById((current) => {
      const previous = current[fileId];
      if (
        previous?.width === dimensions.width &&
        previous.height === dimensions.height
      ) {
        return current;
      }
      return { ...current, [fileId]: dimensions };
    });
  }

  function cancelConversion() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsProcessing(false);
    setErrorMessage("Operación cancelada.");
  }

  async function readFilesForWorker(): Promise<ImageInputFile[]> {
    return Promise.all(
      selectedFiles.map(({ file }) => toPdfImageInputFile(file)),
    );
  }

  async function handleConvert() {
    const validation = validateImageFiles(
      selectedFiles.map(({ file }) => file),
    );
    if (!validation.isValid) {
      setErrorMessage(
        validation.errors[0] ?? "No se pudo iniciar la conversión.",
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    clearDownloadResult();

    try {
      const worker = createPdfOperationWorker();
      workerRef.current = worker;
      const result = await runPdfOperation(worker, {
        kind: "images-to-pdf",
        files: await readFilesForWorker(),
        options: pdfOptions,
      });
      if (result.kind !== "file") {
        throw new Error("La conversión no generó un PDF descargable.");
      }
      const blob = new Blob([result.buffer], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      replaceDownloadResult({ url, fileName: result.fileName });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron convertir las imágenes.";
      setErrorMessage(message);
    } finally {
      workerRef.current?.terminate();
      workerRef.current = null;
      setIsProcessing(false);
    }
  }

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
      disposePreviewUrls(selectedFiles);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),300px))] justify-center gap-3 sm:gap-4">
        {selectedFiles.map((item, index) => {
          const page = resolveImageToPdfPreviewPage(
            pdfOptions,
            imageDimensionsById[item.id],
          );
          const marginStyle = `${(page.margin / page.height) * 100}% ${
            (page.margin / page.width) * 100
          }%`;

          return (
            <li
              key={item.id}
              className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/35"
            >
              <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md bg-neutral-950/25 p-3">
                <div
                  className="relative max-h-full w-full max-w-[240px] overflow-hidden rounded-sm bg-white shadow-xl shadow-black/30 ring-1 ring-white/20"
                  style={{ aspectRatio: `${page.width} / ${page.height}` }}
                >
                  <div className="absolute inset-0 bg-neutral-100" />
                  <div
                    className="absolute flex items-center justify-center overflow-hidden"
                    style={{
                      inset: marginStyle,
                    }}
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-full w-full object-contain"
                      onLoad={(event) =>
                        rememberImageDimensions(item.id, event.currentTarget)
                      }
                    />
                  </div>
                </div>
                <span className="absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold shadow">
                  {index + 1}
                </span>
              </div>
              <div className="min-w-0">
                <p
                  className="truncate text-xs font-medium"
                  title={item.file.name}
                >
                  {item.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.file.size)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Mover ${item.file.name} a la izquierda`}
                    onClick={() => moveFile(item.id, -1)}
                    disabled={index === 0 || isProcessing}
                  >
                    <ArrowLeft className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Mover ${item.file.name} a la derecha`}
                    onClick={() => moveFile(item.id, 1)}
                    disabled={
                      index === selectedFiles.length - 1 || isProcessing
                    }
                  >
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Quitar ${item.file.name}`}
                  onClick={() => removeFile(item.id)}
                  disabled={isProcessing}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const sidebar = (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2">
        <div className="stat-tile">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Imágenes
          </dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {selectedFiles.length}
          </dd>
        </div>
        <div className="stat-tile">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Peso total
          </dt>
          <dd className="text-lg font-semibold">{formatFileSize(totalSize)}</dd>
        </div>
      </dl>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Cada imagen se inserta como una página del PDF, en el orden de la
        izquierda.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Tamaño</legend>
        <SegmentedOptions
          options={PAGE_SIZE_OPTIONS}
          value={pdfOptions.pageSize}
          onChange={(pageSize) => updatePdfOptions({ pageSize })}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Orientación</legend>
        <SegmentedOptions
          options={ORIENTATION_OPTIONS}
          value={pdfOptions.orientation}
          onChange={(orientation) => updatePdfOptions({ orientation })}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Margen</legend>
        <SegmentedOptions
          options={MARGIN_OPTIONS}
          value={pdfOptions.margin}
          onChange={(margin) => updatePdfOptions({ margin })}
        />
      </fieldset>
      {selectedFiles.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearList}
          disabled={isProcessing}
        >
          Limpiar lista
        </Button>
      ) : null}
    </div>
  );

  const primaryAction = (
    <>
      <Button
        type="button"
        variant="brand"
        size="lg"
        onClick={handleConvert}
        disabled={!canConvert}
        className="w-full"
      >
        {isProcessing ? (
          <Loader2
            className="animate-spin"
            data-icon="inline-start"
            aria-hidden
          />
        ) : (
          <ImagePlus data-icon="inline-start" aria-hidden />
        )}
        {isProcessing ? "Convirtiendo imágenes" : "Crear PDF"}
      </Button>
      {isProcessing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={cancelConversion}
          className="w-full"
        >
          Cancelar
        </Button>
      ) : null}
    </>
  );

  const resultBanner = downloadResult ? (
    <DownloadReadyBanner downloadResult={downloadResult} />
  ) : null;

  return (
    <ToolWorkspace
      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
      multiple
      hasContent={selectedFiles.length > 0}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona imágenes"
      emptyDescription="Arrastrá JPG, PNG o WebP acá o usá el botón. Respetamos el orden y generamos un PDF listo para descargar."
      emptyActionLabel="Seleccionar imágenes"
      emptyHint="Hasta 40 imágenes · 20 MB por imagen · 200 MB en total"
      preview={preview}
      sidebarTitle="Imagen a PDF"
      sidebarDescription="Convierte JPG, PNG o WebP en un PDF."
      sidebar={sidebar}
      primaryAction={primaryAction}
      addMore={{ label: "Agregar más imágenes" }}
      errorMessage={errorMessage}
      resultBanner={resultBanner}
    />
  );
}

interface SegmentedOptionsProps<TValue extends string> {
  options: Array<{ value: TValue; label: string }>;
  value: TValue;
  onChange: (value: TValue) => void;
}

function SegmentedOptions<TValue extends string>({
  options,
  value,
  onChange,
}: SegmentedOptionsProps<TValue>) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "brand" : "outline"}
          size="sm"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
