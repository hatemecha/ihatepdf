import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowLeft,
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

import { InteractivePage } from "./InteractivePage";
import {
  LAYOUT_ASSET_DRAG_MIME,
  PAGE_PRESETS,
  type LayoutImageAsset,
  type PagePresetId,
} from "./layoutTypes";
import { useLayoutEditor } from "./useLayoutEditor";

interface DownloadResult {
  url: string;
  fileName: string;
}

export interface ImageToPdfLayoutImageImport {
  token: number;
  files: File[];
}

interface ImageToPdfLayoutEditorProps {
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

const MIN_PAGE_DISPLAY_HEIGHT = 320;

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export function ImageToPdfLayoutEditor({
  onSwitchToSimple,
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
    const horizontalPadding = 48;
    const verticalPadding = 48;
    const availableWidth = Math.max(
      120,
      containerSize.width - horizontalPadding,
    );
    const availableHeight = Math.max(
      MIN_PAGE_DISPLAY_HEIGHT,
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

      const workerImages: WorkerLayoutImageAsset[] = await Promise.all(
        state.images
          .filter((image) => referencedImageIds.has(image.id))
          .map(async (image) => ({
            id: image.id,
            name: image.name,
            mimeType: image.mimeType,
            buffer: await image.file.arrayBuffer(),
          })),
      );

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
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
      {/* Toolbar compacto en una sola fila */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-border bg-card/95 px-2.5 py-2 shadow-[0_12px_24px_-20px_rgba(0,0,0,0.55)]">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2">
          <ol className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border/80 bg-background/70 p-1.5">
            {state.pages.map((page, index) => {
              const isActive = page.id === state.activePageId;
              return (
                <li key={page.id}>
                  <div
                    className={cn(
                      "flex items-center rounded-md border text-xs shadow-sm",
                      isActive
                        ? "border-brand bg-brand/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      className="px-2.5 py-1 text-[11px] font-semibold tabular-nums"
                      onClick={() => setActivePage(page.id)}
                    >
                      {index + 1}
                    </button>
                    {state.pages.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Eliminar página ${index + 1}`}
                        className="px-1.5 py-1 text-muted-foreground hover:text-destructive"
                        onClick={() => removePage(page.id)}
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
                className="size-7 rounded-md p-0"
                aria-label="Nueva página"
                onClick={handleAddPage}
                disabled={isProcessing}
              >
                <Plus className="size-3.5" aria-hidden />
              </Button>
            </li>
          </ol>

          <div className="hidden h-5 w-px bg-border sm:block" />

          <select
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium"
            value={activePage.presetId}
            onChange={(event) =>
              setPagePreset(activePage.id, event.target.value as PagePresetId)
            }
            aria-label="Tamaño de página"
          >
            {PAGE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/70 bg-background/65 px-2 py-1">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.round(activePage.width)} × {Math.round(activePage.height)} pt
            </span>
            <div className="flex h-7 items-center rounded-md border border-border bg-background">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 rounded-none rounded-l-md p-0"
                aria-label="Alejar lienzo"
                disabled={isProcessing || zoomPercent <= ZOOM_MIN}
                onClick={() =>
                  setZoomPercent((current) => clampZoom(current - ZOOM_STEP))
                }
              >
                <Minus className="size-3.5" aria-hidden />
              </Button>
              <span className="min-w-[2.75rem] px-1 text-center text-[11px] tabular-nums text-muted-foreground">
                {zoomPercent}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 rounded-none rounded-r-md p-0"
                aria-label="Acercar lienzo"
                disabled={isProcessing || zoomPercent >= ZOOM_MAX}
                onClick={() =>
                  setZoomPercent((current) => clampZoom(current + ZOOM_STEP))
                }
              >
                <Plus className="size-3.5" aria-hidden />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-muted-foreground"
              title="Restablecer zoom al encaje en el contenedor"
              disabled={isProcessing || zoomPercent === 100}
              onClick={() => setZoomPercent(100)}
            >
              Encajar
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant={snapEnabled ? "brand" : "outline"}
            size="sm"
            className="h-7 rounded-md px-2"
            onClick={() => setSnapEnabled((current) => !current)}
            title={snapEnabled ? "Guías activas" : "Guías libres"}
          >
            <Magnet className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Guías</span>
          </Button>

          {onSwitchToSimple ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md px-2 text-xs"
              onClick={onSwitchToSimple}
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Modo simple</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="brand"
            size="sm"
            className="h-7 rounded-md px-3"
            onClick={handleExport}
            disabled={isProcessing || totalElements === 0}
          >
            {isProcessing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
            <span>{isProcessing ? "Generando" : "Exportar"}</span>
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <Alert variant="destructive" className="max-h-40 shrink-0 overflow-y-auto">
          <AlertTitle>No se pudo continuar</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileSelection}
      />

      {/* Editor: aside imágenes | canvas | aside propiedades (solo si selección) */}
      <div
        className={cn(
          "grid min-h-0 min-w-0 flex-1 gap-2 overflow-hidden lg:grid-rows-1 lg:auto-rows-[minmax(0,1fr)] lg:items-stretch",
          showProperties
            ? "lg:grid-cols-[200px_minmax(0,1fr)_240px]"
            : "lg:grid-cols-[200px_minmax(0,1fr)]",
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
          className="relative h-full min-h-[280px] min-w-0 overflow-auto rounded-lg border border-border bg-[radial-gradient(circle_at_top,oklch(0.24_0_0),oklch(0.16_0_0)_60%)] lg:min-h-0"
        >
          <div className="box-border flex min-h-full w-max min-w-full items-center justify-center p-8">
            <InteractivePage
              page={activePage}
              images={state.images}
              selectedElementId={state.selectedElementId}
              snapEnabled={snapEnabled}
              displayScale={canvasScale}
              libraryEmpty={state.images.length === 0}
              onSelectElement={selectElement}
              onUpdateElement={updateElement}
              onDropImageFromLibrary={placeImageOnActivePageAt}
            />
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
        <Alert variant="brand" role="status" className="max-h-36 shrink-0 overflow-y-auto">
          <Download />
          <AlertTitle>PDF listo</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span>El layout se exportó correctamente.</span>
              <Button asChild variant="brand" size="sm">
                <a href={downloadResult.url} download={downloadResult.fileName}>
                  <Download data-icon="inline-start" aria-hidden />
                  Descargar PDF
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
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
  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-[0_14px_28px_-24px_rgba(0,0,0,0.6)]">
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Imágenes · {images.length}
        </h3>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 rounded-lg"
        onClick={onOpenPicker}
        disabled={isProcessing}
      >
        <Upload data-icon="inline-start" aria-hidden />
        Subir imágenes
      </Button>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Arrastrá miniaturas al lienzo. Doble clic o Enter las centra en la
        página activa.
      </p>

      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {images.length === 0 ? (
          <li className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            Aún no hay imágenes.
          </li>
        ) : null}
        {images.map((asset) => (
          <li
            key={asset.id}
            className="group flex items-center gap-2 rounded-lg border border-border bg-background/75 p-1.5 transition-colors hover:border-foreground/35 hover:bg-background"
          >
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "flex min-w-0 flex-1 cursor-grab items-center gap-2 text-left active:cursor-grabbing",
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
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-inset ring-foreground/8"
                style={{
                  backgroundImage: `url(${asset.previewUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {asset.name}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {asset.naturalWidth}×{asset.naturalHeight}
                  {" · "}
                  {formatFileSize(asset.file.size)}
                </span>
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              aria-label={`Quitar ${asset.name}`}
              onClick={() => onRemoveImage(asset.id)}
              disabled={isProcessing}
            >
              <X className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
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
    <aside className="flex h-full min-h-0 min-w-0 max-w-full flex-col gap-0 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card p-0 ring-1 ring-inset ring-foreground/[0.07]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/90">
          Propiedades
        </h3>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-lg border-border"
          aria-label="Deseleccionar"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="rounded-lg border border-border bg-muted/25 p-3 ring-1 ring-inset ring-foreground/[0.05]">
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

        <div className="rounded-lg border border-border bg-muted/25 p-3 ring-1 ring-inset ring-foreground/[0.05]">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rotación
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <input
              type="number"
              className="field-input h-9 min-w-0 flex-1 rounded-lg px-2.5 text-sm tabular-nums text-foreground"
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
              className="size-9 shrink-0 rounded-lg"
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
              className="size-9 shrink-0 rounded-lg"
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

        <div className="rounded-lg border border-border bg-muted/25 p-3 ring-1 ring-inset ring-foreground/[0.05]">
          <span className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Layers className="size-3" aria-hidden />
            Capas
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg px-2 text-xs"
              onClick={() => onMoveZ("front")}
            >
              <ChevronsUp className="size-3.5" aria-hidden />
              Frente
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg px-2 text-xs"
              onClick={() => onMoveZ("back")}
            >
              <ChevronsDown className="size-3.5" aria-hidden />
              Fondo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg px-2 text-xs"
              onClick={() => onMoveZ("forward")}
            >
              Subir
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg px-2 text-xs"
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
            className="h-9 rounded-lg"
            onClick={onDuplicate}
          >
            <Copy className="size-3.5" data-icon="inline-start" aria-hidden />
            Duplicar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-9 rounded-lg"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" data-icon="inline-start" aria-hidden />
            Eliminar
          </Button>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          <kbd className="rounded-md border border-border bg-muted px-1 py-px font-mono text-[10px] text-foreground/90">
            Shift
          </kbd>{" "}
          mantiene proporción al redimensionar y fija giros a 15°.{" "}
          <kbd className="rounded-md border border-border bg-muted px-1 py-px font-mono text-[10px] text-foreground/90">
            Alt
          </kbd>{" "}
          ignora guías al arrastrar.
        </p>
      </div>
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
        className="field-input h-9 px-2.5 text-sm tabular-nums text-foreground"
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
