import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ChevronsDown,
  ChevronsUp,
  Copy,
  Download,
  Layers,
  Loader2,
  Magnet,
  Minus,
  Plus,
  RotateCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import { cn } from "@/lib/utils";

import {
  formatFileSize,
  validateImageFiles,
} from "@/features/pdf-tools/shared/fileValidation";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";
import type {
  LayoutImageAsset as WorkerLayoutImageAsset,
  LayoutPagePayload,
} from "@/features/pdf-tools/shared/pdfOperation.types";

import { toPdfImageInputFile } from "../imageFileConversion";
import { InteractivePage } from "./InteractivePage";
import {
  LAYOUT_ASSET_DRAG_MIME,
  PAGE_PRESETS,
  type LayoutImageAsset,
  type PagePresetId,
} from "./layoutTypes";
import { useLayoutEditor } from "./useLayoutEditor";

export interface ImageToPdfLayoutImageImport {
  token: number;
  files: File[];
}

interface ImageToPdfLayoutEditorProps {
  /**
   * Kept for callers that may still pass it - the in-editor "back to simple"
   * affordance is now part of the global tool header, so this prop is
   * intentionally unused.
   */
  onSwitchToSimple?: () => void;
  imageImport?: ImageToPdfLayoutImageImport | null;
  onImageImportConsumed?: () => void;
}

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        previewUrl,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error(`No se pudo leer la imagen ${file.name}.`));
    };
    image.src = previewUrl;
  });
}

function createAssetId(file: File): string {
  return `asset-${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

const MIN_PAGE_FIT_HEIGHT = 180;

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export function ImageToPdfLayoutEditor({
  imageImport,
  onImageImportConsumed,
}: ImageToPdfLayoutEditorProps = {}) {
  return useImageToPdfLayoutEditor({ imageImport, onImageImportConsumed });
}

function useImageToPdfLayoutEditor({
  imageImport,
  onImageImportConsumed,
}: ImageToPdfLayoutEditorProps = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    state,
    activePage,
    selectedElement,
    setActivePage,
    addPage,
    removePage,
    setPagePreset,
    addImageAssets,
    removeImageAsset,
    placeImageOnActivePage,
    placeImageOnActivePageAt,
    updateElement,
    removeElement,
    duplicateElement,
    moveElementInZOrder,
    selectElement,
  } = useLayoutEditor();

  useEffect(() => {
    if (!imageImport?.files.length) {
      return;
    }

    const incomingFiles = imageImport.files;
    let cancelled = false;

    (async () => {
      const validation = validateImageFiles(incomingFiles);
      if (!validation.isValid) {
        if (!cancelled) {
          setErrorMessage(
            validation.errors[0] ?? "No se pudieron importar las imágenes.",
          );
          onImageImportConsumed?.();
        }
        return;
      }

      try {
        const newAssets: LayoutImageAsset[] = await Promise.all(
          incomingFiles.map(async (file) => {
            const { width, height, previewUrl } =
              await readImageDimensions(file);
            return {
              id: createAssetId(file),
              name: file.name,
              mimeType: file.type || "image/jpeg",
              file,
              naturalWidth: width,
              naturalHeight: height,
              previewUrl,
            };
          }),
        );
        if (cancelled) {
          for (const asset of newAssets) {
            URL.revokeObjectURL(asset.previewUrl);
          }
          return;
        }
        addImageAssets(newAssets);
        onImageImportConsumed?.();
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "No se pudieron importar las imágenes.",
          );
          onImageImportConsumed?.();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addImageAssets, imageImport, onImageImportConsumed]);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
    };
  }, []);

  const baseFitScale = useMemo(() => {
    const horizontalPadding = containerSize.width < 640 ? 32 : 48;
    const verticalPadding = containerSize.height < 360 ? 32 : 48;
    const availableWidth = Math.max(
      120,
      containerSize.width - horizontalPadding,
    );
    const availableHeight = Math.max(
      MIN_PAGE_FIT_HEIGHT,
      containerSize.height - verticalPadding,
    );

    return Math.min(
      availableWidth / activePage.width,
      availableHeight / activePage.height,
      1.6,
    );
  }, [activePage.height, activePage.width, containerSize]);

  const canvasScale = baseFitScale * (zoomPercent / 100);

  function replaceDownloadResult(nextResult: DownloadResult | null) {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }
    resultUrlRef.current = nextResult?.url ?? null;
    setDownloadResult(nextResult);
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (incomingFiles.length === 0) {
      return;
    }

    const validation = validateImageFiles([
      ...state.images.map((image) => image.file),
      ...incomingFiles,
    ]);
    if (!validation.isValid) {
      setErrorMessage(
        validation.errors[0] ?? "No se pudieron agregar imágenes.",
      );
      return;
    }

    try {
      const newAssets: LayoutImageAsset[] = await Promise.all(
        incomingFiles.map(async (file) => {
          const { width, height, previewUrl } = await readImageDimensions(file);
          return {
            id: createAssetId(file),
            name: file.name,
            mimeType: file.type || "image/jpeg",
            file,
            naturalWidth: width,
            naturalHeight: height,
            previewUrl,
          };
        }),
      );
      addImageAssets(newAssets);
      setErrorMessage(null);
      replaceDownloadResult(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron leer las imágenes seleccionadas.",
      );
    }
  }

  const handleAddPage = useCallback(() => {
    addPage(activePage.presetId);
    replaceDownloadResult(null);
  }, [activePage.presetId, addPage]);

  const handleExport = useCallback(async () => {
    if (state.images.length === 0) {
      setErrorMessage("Sube al menos una imagen para exportar.");
      return;
    }

    const totalElements = state.pages.reduce(
      (count, page) => count + page.elements.length,
      0,
    );
    if (totalElements === 0) {
      setErrorMessage(
        "Agrega al menos una imagen a una página antes de exportar.",
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    replaceDownloadResult(null);

    try {
      const referencedImageIds = new Set<string>();
      for (const page of state.pages) {
        for (const element of page.elements) {
          referencedImageIds.add(element.imageId);
        }
      }

      const workerImagePromises = state.images.flatMap((image) =>
        referencedImageIds.has(image.id)
          ? [
              toPdfImageInputFile(image.file).then((convertedImage) => ({
                id: image.id,
                name: convertedImage.name,
                mimeType: convertedImage.mimeType,
                buffer: convertedImage.buffer,
              })),
            ]
          : [],
      );

      const workerImages: WorkerLayoutImageAsset[] =
        await Promise.all(workerImagePromises);

      const workerPages: LayoutPagePayload[] = state.pages.map((page) => ({
        width: page.width,
        height: page.height,
        elements: page.elements.map((element) => ({
          imageId: element.imageId,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          rotation: element.rotation,
        })),
      }));

      const worker = createPdfOperationWorker();
      workerRef.current = worker;
      const result = await runPdfOperation(worker, {
        kind: "images-to-pdf-layout",
        images: workerImages,
        pages: workerPages,
      });

      if (result.kind !== "file") {
        throw new Error("La exportación no generó un PDF descargable.");
      }

      const blob = new Blob([result.buffer], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      replaceDownloadResult({ url, fileName: result.fileName });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo generar el PDF.",
      );
    } finally {
      workerRef.current?.terminate();
      workerRef.current = null;
      setIsProcessing(false);
    }
  }, [state.images, state.pages]);

  const totalElements = state.pages.reduce(
    (count, page) => count + page.elements.length,
    0,
  );
  const showProperties = selectedElement !== null;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <EditorToolbar
        pages={state.pages}
        activePageId={state.activePageId}
        activePage={activePage}
        zoomPercent={zoomPercent}
        snapEnabled={snapEnabled}
        isProcessing={isProcessing}
        canExport={totalElements > 0}
        onActivatePage={setActivePage}
        onRemovePage={removePage}
        onAddPage={handleAddPage}
        onChangePreset={(preset) => setPagePreset(activePage.id, preset)}
        onZoomIn={() =>
          setZoomPercent((current) => clampZoom(current + ZOOM_STEP))
        }
        onZoomOut={() =>
          setZoomPercent((current) => clampZoom(current - ZOOM_STEP))
        }
        onZoomReset={() => setZoomPercent(100)}
        onToggleSnap={() => setSnapEnabled((current) => !current)}
        onExport={handleExport}
      />

      {errorMessage ? (
        <Alert
          variant="destructive"
          className="mt-3 max-h-40 shrink-0 overflow-y-auto"
        >
          <AlertTitle>No se pudo continuar</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileSelection}
      />

      <div
        className={cn(
          "relative mt-2 flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden lg:grid lg:gap-0 lg:grid-rows-1 lg:auto-rows-[minmax(0,1fr)] lg:items-stretch",
          showProperties
            ? "lg:grid-cols-[220px_minmax(0,1fr)_240px]"
            : "lg:grid-cols-[220px_minmax(0,1fr)]",
        )}
      >
        <ImagesPanel
          images={state.images}
          onOpenPicker={() => inputRef.current?.click()}
          onPlaceImage={placeImageOnActivePage}
          onRemoveImage={removeImageAsset}
          isProcessing={isProcessing}
        />

        <div
          ref={canvasContainerRef}
          className="relative order-2 min-h-0 min-w-0 flex-1 overflow-auto rounded-md bg-[radial-gradient(circle_at_top,oklch(0.21_0_0),oklch(0.13_0_0)_60%)] lg:order-none lg:h-full lg:rounded-none lg:border-x lg:border-border"
        >
          <div
            className={cn(
              "flex min-h-full w-full flex-col items-center p-3 sm:p-5 lg:p-6",
              showProperties ? "pb-52 lg:pb-6" : null,
              state.images.length === 0
                ? "gap-6 pb-8 pt-2 justify-start"
                : "min-h-0 justify-start",
            )}
          >
            {state.images.length === 0 ? (
              <p className="max-w-sm shrink-0 text-center text-sm leading-relaxed text-muted-foreground">
                Subí imágenes desde el panel y arrastrá una hasta la hoja
                blanca. Doble clic o Enter en una miniatura la centra en la
                página.
              </p>
            ) : null}
            <div
              className={cn(
                "flex w-full min-w-0 justify-center",
                state.images.length === 0
                  ? "shrink-0"
                  : "min-h-0 flex-1 items-center",
              )}
            >
              <InteractivePage
                page={activePage}
                images={state.images}
                selectedElementId={state.selectedElementId}
                snapEnabled={snapEnabled}
                displayScale={canvasScale}
                onSelectElement={selectElement}
                onUpdateElement={updateElement}
                onDropImageFromLibrary={placeImageOnActivePageAt}
              />
            </div>
          </div>
        </div>

        {showProperties && selectedElement ? (
          <PropertiesPanel
            element={selectedElement}
            onUpdate={updateElement}
            onDuplicate={() => duplicateElement(selectedElement.id)}
            onRemove={() => removeElement(selectedElement.id)}
            onMoveZ={(direction) =>
              moveElementInZOrder(selectedElement.id, direction)
            }
            onClose={() => selectElement(null)}
          />
        ) : null}
      </div>

      {downloadResult ? (
        <DownloadReadyBanner
          downloadResult={downloadResult}
          onDismiss={() => replaceDownloadResult(null)}
        />
      ) : null}
    </section>
  );
}

interface EditorToolbarProps {
  pages: ReturnType<typeof useLayoutEditor>["state"]["pages"];
  activePageId: string;
  activePage: ReturnType<typeof useLayoutEditor>["activePage"];
  zoomPercent: number;
  snapEnabled: boolean;
  isProcessing: boolean;
  canExport: boolean;
  onActivatePage: (pageId: string) => void;
  onRemovePage: (pageId: string) => void;
  onAddPage: () => void;
  onChangePreset: (preset: PagePresetId) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleSnap: () => void;
  onExport: () => void;
}

function EditorToolbar({
  pages,
  activePageId,
  activePage,
  zoomPercent,
  snapEnabled,
  isProcessing,
  canExport,
  onActivatePage,
  onRemovePage,
  onAddPage,
  onChangePreset,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToggleSnap,
  onExport,
}: EditorToolbarProps) {
  return (
    <div className="shrink-0 border-b border-border py-2">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 lg:flex lg:flex-wrap">
        <div className="min-w-0 max-w-28 sm:max-w-40 lg:max-w-none lg:flex-1">
          <ol className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {pages.map((page, index) => {
              const isActive = page.id === activePageId;
              return (
                <li key={page.id} className="shrink-0">
                  <div
                    className={cn(
                      "flex items-center rounded-full text-xs transition-colors",
                      isActive
                        ? "bg-brand/15 text-foreground ring-1 ring-inset ring-brand/40"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      className="px-2.5 py-1 text-[11px] font-semibold tabular-nums"
                      onClick={() => onActivatePage(page.id)}
                    >
                      {index + 1}
                    </button>
                    {pages.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Eliminar página ${index + 1}`}
                        className="px-1.5 py-1 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemovePage(page.id)}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
            <li>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 rounded-full p-0"
                aria-label="Nueva página"
                onClick={onAddPage}
                disabled={isProcessing}
              >
                <Plus className="size-3.5" aria-hidden />
              </Button>
            </li>
          </ol>
        </div>

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto lg:flex-none lg:overflow-visible">
          <span className="tool-divider" aria-hidden />

          <select
            className="h-8 w-32 shrink-0 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40 lg:w-auto"
            value={activePage.presetId}
            onChange={(event) =>
              onChangePreset(event.target.value as PagePresetId)
            }
            aria-label="Tamaño de página"
          >
            {PAGE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>

          <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
            {Math.round(activePage.width)} × {Math.round(activePage.height)} pt
          </span>

          <span className="tool-divider" aria-hidden />

          <div className="hidden h-8 shrink-0 items-center rounded-full bg-muted min-[520px]:flex">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 rounded-full p-0"
              aria-label="Alejar lienzo"
              disabled={isProcessing || zoomPercent <= ZOOM_MIN}
              onClick={onZoomOut}
            >
              <Minus className="size-3.5" aria-hidden />
            </Button>
            <span className="min-w-[3.1rem] px-1 text-center text-[11px] tabular-nums text-muted-foreground">
              {zoomPercent}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 rounded-full p-0"
              aria-label="Acercar lienzo"
              disabled={isProcessing || zoomPercent >= ZOOM_MAX}
              onClick={onZoomIn}
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden h-8 shrink-0 px-2 text-[11px] text-muted-foreground min-[520px]:inline-flex"
            title="Restablecer zoom al encaje en el contenedor"
            disabled={isProcessing || zoomPercent === 100}
            onClick={onZoomReset}
          >
            Encajar
          </Button>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 lg:ml-auto">
          <button
            type="button"
            onClick={onToggleSnap}
            title={snapEnabled ? "Guías activas" : "Guías libres"}
            aria-pressed={snapEnabled}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
              snapEnabled
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Magnet className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Guías</span>
          </button>

          <Button
            type="button"
            variant="brand"
            size="sm"
            className="h-8 w-10 rounded-full px-0 min-[520px]:w-auto min-[520px]:px-3"
            aria-label={isProcessing ? "Generando PDF" : "Exportar PDF"}
            onClick={onExport}
            disabled={isProcessing || !canExport}
          >
            {isProcessing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
            <span className="hidden min-[520px]:inline">
              {isProcessing ? "Generando" : "Exportar"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ImagesPanelProps {
  images: LayoutImageAsset[];
  onOpenPicker: () => void;
  onPlaceImage: (id: string) => void;
  onRemoveImage: (id: string) => void;
  isProcessing: boolean;
}

function ImagesPanel({
  images,
  onOpenPicker,
  onPlaceImage,
  onRemoveImage,
  isProcessing,
}: ImagesPanelProps) {
  const isEmpty = images.length === 0;
  return (
    <aside className="order-1 flex min-h-0 min-w-0 shrink-0 items-center gap-2 border-b border-border pb-2 lg:order-none lg:h-full lg:flex-col lg:items-stretch lg:gap-3 lg:overflow-hidden lg:border-b-0 lg:pb-0 lg:pr-4">
      <div className="flex shrink-0 items-center gap-2 lg:justify-between lg:items-start">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Imágenes</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 tabular-nums text-[10px] text-foreground">
            {images.length}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-full px-2.5 text-xs"
          onClick={onOpenPicker}
          disabled={isProcessing}
        >
          <Upload className="size-3.5" aria-hidden />
          <span>Subir</span>
        </Button>
      </div>

      {!isEmpty ? (
        <p className="hidden text-[11px] leading-relaxed text-muted-foreground lg:block">
          Arrastrá miniaturas al lienzo. Doble clic o Enter para centrarlas.
        </p>
      ) : null}

      {isEmpty ? null : (
        <ul className="flex max-h-14 min-h-0 min-w-0 flex-1 flex-row gap-1.5 overflow-x-auto pb-1 lg:max-h-none lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0">
          {images.map((asset) => (
            <li key={asset.id} className="group shrink-0 lg:shrink">
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "flex min-w-28 items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-muted active:cursor-grabbing lg:w-full",
                  "cursor-grab",
                  isProcessing ? "pointer-events-none opacity-50" : null,
                )}
                draggable={!isProcessing}
                aria-label={`${asset.name}. Arrastrá al lienzo o pulsá Enter para centrar en la página.`}
                title="Arrastrá al lienzo. Doble clic o Enter para centrar."
                onDragStart={(event) => {
                  event.dataTransfer.setData(LAYOUT_ASSET_DRAG_MIME, asset.id);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onDoubleClick={() => {
                  if (!isProcessing) {
                    onPlaceImage(asset.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (isProcessing) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPlaceImage(asset.id);
                  }
                }}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
                  style={{
                    backgroundImage: `url(${asset.previewUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <span className="hidden min-w-0 flex-1 lg:block">
                  <span className="block truncate text-xs font-medium">
                    {asset.name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {asset.naturalWidth}×{asset.naturalHeight}
                    {" · "}
                    {formatFileSize(asset.file.size)}
                  </span>
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="inline-flex size-7 lg:hidden"
                    aria-label={`Agregar ${asset.name} a la página`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPlaceImage(asset.id);
                    }}
                    disabled={isProcessing}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 opacity-100 transition-opacity lg:size-6 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                    aria-label={`Quitar ${asset.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveImage(asset.id);
                    }}
                    disabled={isProcessing}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

interface PropertiesPanelProps {
  element: NonNullable<ReturnType<typeof useLayoutEditor>["selectedElement"]>;
  onUpdate: ReturnType<typeof useLayoutEditor>["updateElement"];
  onDuplicate: () => void;
  onRemove: () => void;
  onMoveZ: (direction: "front" | "forward" | "backward" | "back") => void;
  onClose: () => void;
}

function PropertiesPanel({
  element,
  onUpdate,
  onDuplicate,
  onRemove,
  onMoveZ,
  onClose,
}: PropertiesPanelProps) {
  return (
    <aside className="absolute inset-x-2 bottom-2 z-20 order-3 flex max-h-[min(10rem,22dvh)] min-h-0 min-w-0 max-w-full flex-col gap-3 overflow-y-auto rounded-md border border-border bg-background/95 p-3 shadow-2xl backdrop-blur lg:static lg:inset-auto lg:h-full lg:max-h-none lg:gap-4 lg:overflow-y-auto lg:rounded-none lg:border-x-0 lg:border-y-0 lg:border-l lg:bg-transparent lg:p-0 lg:pl-4 lg:shadow-none lg:backdrop-blur-none">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Propiedades
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-full"
          aria-label="Deseleccionar"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="surface-inset">
        <div className="grid min-w-0 grid-cols-2 gap-3">
          <NumberField
            label="X"
            value={element.x}
            onChange={(value) => onUpdate(element.id, { x: value })}
          />
          <NumberField
            label="Y"
            value={element.y}
            onChange={(value) => onUpdate(element.id, { y: value })}
          />
          <NumberField
            label="W"
            value={element.width}
            min={4}
            onChange={(value) => onUpdate(element.id, { width: value })}
          />
          <NumberField
            label="H"
            value={element.height}
            min={4}
            onChange={(value) => onUpdate(element.id, { height: value })}
          />
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Rotación
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <input
            type="number"
            className="field-input h-9 min-w-0 flex-1 rounded-md px-2.5 text-sm tabular-nums text-foreground"
            value={Math.round(element.rotation)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) {
                onUpdate(element.id, { rotation: next });
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Rotar -90 grados"
            onClick={() =>
              onUpdate(element.id, {
                rotation: (element.rotation - 90) % 360,
              })
            }
          >
            <RotateCw className="size-3.5 -scale-x-100" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Rotar +90 grados"
            onClick={() =>
              onUpdate(element.id, {
                rotation: (element.rotation + 90) % 360,
              })
            }
          >
            <RotateCw className="size-3.5" />
          </Button>
        </div>
      </div>

      <div>
        <span className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Layers className="size-3" aria-hidden />
          Capas
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2 text-xs"
            onClick={() => onMoveZ("front")}
          >
            <ChevronsUp className="size-3.5" aria-hidden />
            Frente
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2 text-xs"
            onClick={() => onMoveZ("back")}
          >
            <ChevronsDown className="size-3.5" aria-hidden />
            Fondo
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs"
            onClick={() => onMoveZ("forward")}
          >
            Subir
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs"
            onClick={() => onMoveZ("backward")}
          >
            Bajar
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={onDuplicate}
        >
          <Copy className="size-3.5" data-icon="inline-start" aria-hidden />
          Duplicar
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-9"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" data-icon="inline-start" aria-hidden />
          Eliminar
        </Button>
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
        <kbd className="rounded-sm bg-muted px-1 py-px font-mono text-[10px] text-foreground/90">
          Shift
        </kbd>{" "}
        mantiene proporción al redimensionar y fija giros a 15°.{" "}
        <kbd className="rounded-sm bg-muted px-1 py-px font-mono text-[10px] text-foreground/90">
          Alt
        </kbd>{" "}
        ignora guías al arrastrar.
      </p>
    </aside>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (value: number) => void;
}

function NumberField({
  label,
  value,
  step = 1,
  min,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        className="field-input h-9 rounded-md px-2.5 text-sm tabular-nums text-foreground"
        value={Math.round(value)}
        step={step}
        min={min}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
      />
    </label>
  );
}
