import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ImagePlus,
  Loader2,
  Trash2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import {
  formatFileSize,
  validateImageFiles,
} from "@/features/pdf-tools/shared/fileValidation";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";
import type { ImageInputFile } from "@/features/pdf-tools/shared/pdfOperation.types";

interface SelectedImageFile {
  id: string;
  file: File;
  previewUrl: string;
}

interface DownloadResult {
  url: string;
  fileName: string;
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
  const workerRef = useRef<Worker | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedImageFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);

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

  function disposePreviewUrls(items: SelectedImageFile[]) {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }

  function updateSelectedFiles(nextFiles: SelectedImageFile[]) {
    setSelectedFiles(nextFiles);
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
    updateSelectedFiles([]);
  }

  function cancelConversion() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsProcessing(false);
    setErrorMessage("Operación cancelada.");
  }

  async function readFilesForWorker(): Promise<ImageInputFile[]> {
    return Promise.all(
      selectedFiles.map(async ({ file }) => ({
        name: file.name,
        mimeType: file.type,
        buffer: await file.arrayBuffer(),
      })),
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
    registerFilesForLayout?.(selectedFiles.map((item) => item.file));
  }, [registerFilesForLayout, selectedFiles]);

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
    <div className="h-full min-h-0 overflow-y-auto rounded-xl border border-border bg-muted/35 p-4">
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {selectedFiles.map((item, index) => (
          <li
            key={item.id}
            className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-[0_12px_24px_-20px_rgba(0,0,0,0.55)] transition-colors hover:border-foreground/35"
          >
            <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-inset ring-neutral-300/65">
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="max-h-full max-w-full object-contain"
              />
              <span className="absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold shadow">
                {index + 1}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium" title={item.file.name}>
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
        ))}
      </ol>
    </div>
  );

  const sidebar = (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/35 p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Imágenes
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {selectedFiles.length}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/35 p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Peso total
          </dt>
          <dd className="mt-1 text-lg font-semibold">
            {formatFileSize(totalSize)}
          </dd>
        </div>
      </dl>
      <p className="rounded-lg border border-border bg-background/55 px-3 py-2 text-sm text-muted-foreground">
        Cada imagen se inserta como una página del PDF, en el orden de la
        izquierda.
      </p>
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
    <Alert variant="brand" role="status">
      <Download />
      <AlertTitle>PDF listo</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span>Las imágenes se convirtieron correctamente.</span>
          <Button asChild variant="brand" size="sm">
            <a href={downloadResult.url} download={downloadResult.fileName}>
              <Download data-icon="inline-start" aria-hidden />
              Descargar PDF
            </a>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  ) : null;

  return (
    <ToolWorkspace
      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
      multiple
      hasContent={selectedFiles.length > 0}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona imágenes"
      emptyDescription="Arrastrá JPG o PNG acá o usá el botón. Respetamos el orden y generamos un PDF listo para descargar."
      emptyActionLabel="Seleccionar imágenes"
      emptyHint="Hasta 40 imágenes · 20 MB por imagen · 200 MB en total"
      preview={preview}
      sidebarTitle="Imagen a PDF"
      sidebarDescription="Convierte JPG o PNG en un PDF."
      sidebar={sidebar}
      primaryAction={primaryAction}
      addMore={{ label: "Agregar más imágenes" }}
      errorMessage={errorMessage}
      resultBanner={resultBanner}
    />
  );
}
