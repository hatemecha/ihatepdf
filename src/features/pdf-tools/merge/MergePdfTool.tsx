import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Combine, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import { PdfFirstPageThumbnail } from "@/features/pdf-tools/shared/PdfFirstPageThumbnail";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import {
  formatFileSize,
  validateMergePdfFiles,
} from "@/features/pdf-tools/shared/fileValidation";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";
import type { PdfInputFile } from "@/features/pdf-tools/shared/pdfOperation.types";

interface SelectedPdfFile {
  id: string;
  file: File;
  pageCount: number | null;
}

const MERGED_FILE_NAME = "ihatepdf-merged.pdf";

function createFileId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getSelectedFilesSize(files: SelectedPdfFile[]): number {
  return files.reduce((sum, item) => sum + item.file.size, 0);
}

export function MergePdfTool() {
  return useMergePdfTool();
}

function useMergePdfTool() {
  const workerRef = useRef<Worker | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedPdfFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const totalSize = useMemo(
    () => getSelectedFilesSize(selectedFiles),
    [selectedFiles],
  );
  const totalPages = useMemo(
    () => selectedFiles.reduce((sum, item) => sum + (item.pageCount ?? 0), 0),
    [selectedFiles],
  );
  const canMerge = selectedFiles.length >= 2 && !isProcessing;

  function replaceDownloadResult(nextResult: DownloadResult | null) {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }
    resultUrlRef.current = nextResult?.url ?? null;
    setDownloadResult(nextResult);
  }

  function clearResult() {
    replaceDownloadResult(null);
  }

  function updateSelectedFiles(nextFiles: SelectedPdfFile[]) {
    setSelectedFiles(nextFiles);
    setErrorMessage(null);
    clearResult();
  }

  function handleFilesSelected(incomingFiles: File[]) {
    const nextFiles: SelectedPdfFile[] = [
      ...selectedFiles,
      ...incomingFiles.map((file) => ({
        id: createFileId(file),
        file,
        pageCount: null,
      })),
    ];

    const validation = validateMergePdfFiles(
      nextFiles.map((item) => item.file),
      { requireMinimumFileCount: false },
    );

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudieron agregar PDFs.");
      return;
    }

    updateSelectedFiles(nextFiles);
  }

  function removeFile(fileId: string) {
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

  const handlePageCountResolved = useCallback(
    (id: string, pageCount: number) => {
      setSelectedFiles((current) =>
        current.map((item) => (item.id === id ? { ...item, pageCount } : item)),
      );
    },
    [],
  );

  function cancelMerge() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsProcessing(false);
    setErrorMessage("Operación cancelada.");
  }

  async function readFilesForWorker(): Promise<PdfInputFile[]> {
    return Promise.all(
      selectedFiles.map(async (item) => ({
        name: item.file.name,
        buffer: await item.file.arrayBuffer(),
      })),
    );
  }

  async function handleMerge() {
    const files = selectedFiles.map((item) => item.file);
    const validation = validateMergePdfFiles(files);

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo iniciar la unión.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    clearResult();

    try {
      const workerFiles = await readFilesForWorker();
      const worker = createPdfOperationWorker();
      workerRef.current = worker;
      const result = await runPdfOperation(worker, {
        kind: "merge-pdfs",
        files: workerFiles,
      });
      if (result.kind !== "file") {
        throw new Error("La unión no generó un archivo descargable.");
      }
      const blob = new Blob([result.buffer], { type: "application/pdf" });
      replaceDownloadResult({
        url: URL.createObjectURL(blob),
        fileName: MERGED_FILE_NAME,
        mimeType: "application/pdf",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo unir el PDF. Intentalo con otros archivos.";
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
    };
  }, []);

  const preview = (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),300px))] justify-center gap-3 sm:gap-4">
        {selectedFiles.map((item, index) => (
          <li
            key={item.id}
            className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm"
          >
            <div className="relative">
              <PdfFirstPageThumbnail
                key={`${item.id}-${item.file.lastModified}`}
                file={item.file}
                targetWidth={160}
                onPageCountResolved={(count) =>
                  handlePageCountResolved(item.id, count)
                }
              />
              <span className="absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold shadow">
                {index + 1}
              </span>
            </div>
            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium"
                title={item.file.name}
              >
                {item.file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(item.file.size)}
                {item.pageCount ? ` · ${item.pageCount} pág.` : ""}
              </p>
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Mover ${item.file.name} a la izquierda`}
                  onClick={() => moveFile(item.id, -1)}
                  disabled={index === 0 || isProcessing}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Mover ${item.file.name} a la derecha`}
                  onClick={() => moveFile(item.id, 1)}
                  disabled={index === selectedFiles.length - 1 || isProcessing}
                >
                  <ArrowRight className="size-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Quitar ${item.file.name}`}
                onClick={() => removeFile(item.id)}
                disabled={isProcessing}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );

  const sidebar = (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2">
        <div className="stat-tile">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Archivos
          </dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {selectedFiles.length}
          </dd>
        </div>
        <div className="stat-tile">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Páginas
          </dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {totalPages || "—"}
          </dd>
        </div>
        <div className="stat-tile col-span-2">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Peso total
          </dt>
          <dd className="text-lg font-semibold">{formatFileSize(totalSize)}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        El PDF final respeta el orden de la izquierda. Reordena los archivos con
        las flechas de cada tarjeta antes de unir.
      </p>
      {selectedFiles.length === 1 ? (
        <p className="text-sm text-muted-foreground">
          Agrega al menos otro PDF para habilitar la unión.
        </p>
      ) : null}
      {selectedFiles.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => updateSelectedFiles([])}
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
        onClick={handleMerge}
        disabled={!canMerge}
        className="w-full"
      >
        {isProcessing ? (
          <Loader2
            className="animate-spin"
            data-icon="inline-start"
            aria-hidden
          />
        ) : (
          <Combine data-icon="inline-start" aria-hidden />
        )}
        {isProcessing ? "Uniendo PDFs" : "Unir PDFs"}
      </Button>
      {isProcessing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={cancelMerge}
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
      accept="application/pdf,.pdf"
      multiple
      hasContent={selectedFiles.length > 0}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona PDFs para unir"
      emptyDescription="Arrastra entre 2 y 20 PDFs aquí o usa el botón. El orden de los archivos define el orden final del documento."
      emptyActionLabel="Seleccionar PDFs"
      emptyHint="Hasta 20 archivos · 50 MB por archivo · 200 MB en total"
      preview={preview}
      sidebarTitle="Unir PDFs"
      sidebarDescription="Combina varios PDFs en un solo archivo."
      sidebar={sidebar}
      primaryAction={primaryAction}
      addMore={{ label: "Agregar más PDFs" }}
      errorMessage={errorMessage}
      resultBanner={resultBanner}
    />
  );
}
