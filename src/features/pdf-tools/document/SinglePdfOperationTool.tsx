import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  CopyMinus,
  Download,
  ListOrdered,
  Loader2,
  RotateCcw,
  Scissors,
  Square,
  Trash2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PdfDocumentPreview,
  type PageDisplayMode,
} from "@/features/pdf-tools/shared/PdfDocumentPreview";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import {
  formatFileSize,
  validateSinglePdfFile,
} from "@/features/pdf-tools/shared/fileValidation";
import { getPdfPageCount } from "@/features/pdf-tools/shared/pdfPreview";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";
import type {
  PdfInputFile,
  PdfOperationRequest,
} from "@/features/pdf-tools/shared/pdfOperation.types";

type SinglePdfOperation =
  | "split-pdf"
  | "extract-pages"
  | "delete-pages"
  | "reorder-pages"
  | "rotate-pages";

interface SinglePdfOperationConfig {
  operation: SinglePdfOperation;
  toolTitle: string;
  toolDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel: string;
  emptyHint: string;
  actionLabel: string;
  processingLabel: string;
  actionIcon: typeof Scissors;
}

interface DownloadResult {
  url: string;
  fileName: string;
  mimeType: string;
}

const OPERATION_CONFIGS: Record<SinglePdfOperation, SinglePdfOperationConfig> =
  {
    "split-pdf": {
      operation: "split-pdf",
      toolTitle: "Dividir PDF",
      toolDescription:
        "Genera un ZIP con un PDF independiente por cada página.",
      emptyTitle: "Selecciona un PDF para dividir",
      emptyDescription:
        "Cada página se exporta como archivo independiente dentro de un ZIP.",
      emptyActionLabel: "Seleccionar PDF",
      emptyHint: "Hasta 50 MB por archivo",
      actionLabel: "Dividir y descargar ZIP",
      processingLabel: "Dividiendo PDF",
      actionIcon: Scissors,
    },
    "extract-pages": {
      operation: "extract-pages",
      toolTitle: "Extraer páginas",
      toolDescription: "Crea un PDF con las páginas que elijas.",
      emptyTitle: "Selecciona un PDF",
      emptyDescription:
        "Después marca las páginas que quieres conservar en un nuevo archivo.",
      emptyActionLabel: "Seleccionar PDF",
      emptyHint: "Hasta 50 MB por archivo",
      actionLabel: "Extraer páginas",
      processingLabel: "Extrayendo páginas",
      actionIcon: CopyMinus,
    },
    "delete-pages": {
      operation: "delete-pages",
      toolTitle: "Eliminar páginas",
      toolDescription: "Quita páginas y conserva el resto.",
      emptyTitle: "Selecciona un PDF",
      emptyDescription:
        "Después marca las páginas que quieres eliminar del documento.",
      emptyActionLabel: "Seleccionar PDF",
      emptyHint: "Hasta 50 MB por archivo",
      actionLabel: "Eliminar páginas",
      processingLabel: "Eliminando páginas",
      actionIcon: Trash2,
    },
    "reorder-pages": {
      operation: "reorder-pages",
      toolTitle: "Reordenar páginas",
      toolDescription: "Define el orden final del documento.",
      emptyTitle: "Selecciona un PDF",
      emptyDescription:
        "Después usa las flechas debajo de cada página para definir el nuevo orden.",
      emptyActionLabel: "Seleccionar PDF",
      emptyHint: "Hasta 50 MB por archivo",
      actionLabel: "Reordenar páginas",
      processingLabel: "Reordenando páginas",
      actionIcon: ListOrdered,
    },
    "rotate-pages": {
      operation: "rotate-pages",
      toolTitle: "Rotar páginas",
      toolDescription: "Gira páginas individuales o todo el PDF.",
      emptyTitle: "Selecciona un PDF",
      emptyDescription:
        "Después elige el ángulo y marca las páginas que quieres rotar.",
      emptyActionLabel: "Seleccionar PDF",
      emptyHint: "Hasta 50 MB por archivo",
      actionLabel: "Rotar páginas",
      processingLabel: "Rotando páginas",
      actionIcon: RotateCcw,
    },
  };

export function getSinglePdfOperationConfig(
  operation: SinglePdfOperation,
): SinglePdfOperationConfig {
  return OPERATION_CONFIGS[operation];
}

interface SinglePdfOperationToolProps {
  config: SinglePdfOperationConfig;
}

function createInitialPageOrder(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, index) => index + 1);
}

export function SinglePdfOperationTool({
  config,
}: SinglePdfOperationToolProps) {
  return useSinglePdfOperationTool({ config });
}

function useSinglePdfOperationTool({ config }: SinglePdfOperationToolProps) {
  const workerRef = useRef<Worker | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  const hasContent = Boolean(selectedFile && pageCount > 0);

  const canProcess = useMemo(() => {
    if (!hasContent || isProcessing) {
      return false;
    }
    switch (config.operation) {
      case "split-pdf":
        return true;
      case "reorder-pages":
        return pageOrder.length === pageCount;
      case "extract-pages":
      case "delete-pages":
      case "rotate-pages":
        return selectedPages.size > 0;
    }
  }, [
    config.operation,
    hasContent,
    isProcessing,
    pageCount,
    pageOrder.length,
    selectedPages.size,
  ]);

  const replaceDownloadResult = useCallback(
    (nextResult: DownloadResult | null) => {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
      resultUrlRef.current = nextResult?.url ?? null;
      setDownloadResult(nextResult);
    },
    [],
  );

  const clearDownloadResult = useCallback(() => {
    replaceDownloadResult(null);
  }, [replaceDownloadResult]);

  function resetPageState(nextPageCount: number) {
    setPageCount(nextPageCount);
    setSelectedPages(new Set());
    setPageOrder(createInitialPageOrder(nextPageCount));
  }

  async function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) {
      return;
    }

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el PDF.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    clearDownloadResult();

    try {
      const count = await getPdfPageCount(file);
      setSelectedFile(file);
      resetPageState(count);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo abrir el PDF seleccionado.";
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleClear() {
    setSelectedFile(null);
    setPageCount(0);
    setSelectedPages(new Set());
    setPageOrder([]);
    setErrorMessage(null);
    clearDownloadResult();
  }

  function togglePage(pageNumber: number) {
    setSelectedPages((current) => {
      const next = new Set(current);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
    setErrorMessage(null);
    clearDownloadResult();
  }

  const selectAll = useCallback(() => {
    setSelectedPages(new Set(createInitialPageOrder(pageCount)));
    setErrorMessage(null);
    clearDownloadResult();
  }, [clearDownloadResult, pageCount]);

  const clearSelection = useCallback(() => {
    setSelectedPages(new Set());
    setErrorMessage(null);
    clearDownloadResult();
  }, [clearDownloadResult]);

  const invertSelection = useCallback(() => {
    setSelectedPages((current) => {
      const next = new Set<number>();
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        if (!current.has(pageNumber)) {
          next.add(pageNumber);
        }
      }
      return next;
    });
    setErrorMessage(null);
    clearDownloadResult();
  }, [clearDownloadResult, pageCount]);

  const movePageInOrder = useCallback(
    (pageNumber: number, direction: -1 | 1) => {
      setPageOrder((current) => {
        const currentIndex = current.indexOf(pageNumber);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
          return current;
        }
        const next = [...current];
        const [moved] = next.splice(currentIndex, 1);
        next.splice(nextIndex, 0, moved);
        return next;
      });
      setErrorMessage(null);
      clearDownloadResult();
    },
    [clearDownloadResult],
  );

  function resetOrder() {
    setPageOrder(createInitialPageOrder(pageCount));
    setErrorMessage(null);
    clearDownloadResult();
  }

  function cancelOperation() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsProcessing(false);
    setErrorMessage("Operación cancelada.");
  }

  function buildOperationRequest(file: PdfInputFile): PdfOperationRequest {
    const sortedSelection = Array.from(selectedPages)
      .toSorted((a, b) => a - b)
      .map((pageNumber) => pageNumber - 1);

    switch (config.operation) {
      case "split-pdf":
        return { kind: "split-pdf", file };
      case "extract-pages":
        return {
          kind: "extract-pages",
          file,
          pages: sortedSelection,
        };
      case "delete-pages":
        if (sortedSelection.length === pageCount) {
          throw new Error("No puedes eliminar todas las páginas del PDF.");
        }
        return {
          kind: "delete-pages",
          file,
          pages: sortedSelection,
        };
      case "reorder-pages":
        return {
          kind: "reorder-pages",
          file,
          pages: pageOrder.map((pageNumber) => pageNumber - 1),
        };
      case "rotate-pages":
        return {
          kind: "rotate-pages",
          file,
          pages: sortedSelection,
          angle,
        };
    }
  }

  async function handleProcess() {
    if (!selectedFile) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    clearDownloadResult();

    try {
      const buffer = await selectedFile.arrayBuffer();
      const request = buildOperationRequest({
        name: selectedFile.name,
        buffer,
      });
      const worker = createPdfOperationWorker();
      workerRef.current = worker;
      const result = await runPdfOperation(worker, request);
      if (result.kind !== "file") {
        throw new Error("La operación no generó un archivo descargable.");
      }
      const blob = new Blob([result.buffer], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      replaceDownloadResult({
        url,
        fileName: result.fileName,
        mimeType: result.mimeType,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo procesar el archivo.";
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

  const previewProps = (() => {
    switch (config.operation) {
      case "split-pdf":
        return {
          mode: "neutral" as PageDisplayMode,
          interactive: false,
          order: createInitialPageOrder(pageCount),
        };
      case "extract-pages":
        return {
          mode: "selected" as PageDisplayMode,
          interactive: true,
          order: createInitialPageOrder(pageCount),
        };
      case "delete-pages":
        return {
          mode: "deletion" as PageDisplayMode,
          interactive: true,
          order: createInitialPageOrder(pageCount),
        };
      case "reorder-pages":
        return {
          mode: "neutral" as PageDisplayMode,
          interactive: false,
          order: pageOrder,
        };
      case "rotate-pages":
        return {
          mode: "rotation" as PageDisplayMode,
          interactive: true,
          order: createInitialPageOrder(pageCount),
        };
    }
  })();

  const rotationByPage = useMemo(() => {
    if (config.operation !== "rotate-pages") {
      return undefined;
    }
    const map: Record<number, number> = {};
    for (const pageNumber of selectedPages) {
      map[pageNumber] = angle;
    }
    return map;
  }, [angle, config.operation, selectedPages]);

  const pageLabels = useMemo(() => {
    if (config.operation !== "reorder-pages") {
      return undefined;
    }
    const labels: Record<number, string> = {};
    pageOrder.forEach((pageNumber, displayIndex) => {
      labels[pageNumber] = `${displayIndex + 1} (orig. ${pageNumber})`;
    });
    return labels;
  }, [config.operation, pageOrder]);

  const pageActionsByPage = useMemo(() => {
    if (config.operation !== "reorder-pages") {
      return undefined;
    }

    return Object.fromEntries(
      pageOrder.map((pageNumber, displayIndex) => [
        pageNumber,
        <ReorderPageActions
          key={pageNumber}
          pageNumber={pageNumber}
          displayIndex={displayIndex}
          pageCount={pageOrder.length}
          isProcessing={isProcessing}
          onMovePage={movePageInOrder}
        />,
      ]),
    );
  }, [config.operation, isProcessing, movePageInOrder, pageOrder]);

  const preview = selectedFile ? (
    <PdfDocumentPreview
      file={selectedFile}
      pageOrder={previewProps.order}
      selectedPages={selectedPages}
      rotationByPage={rotationByPage}
      displayMode={previewProps.mode}
      pageLabels={pageLabels}
      onPageClick={previewProps.interactive ? togglePage : undefined}
      pageActionsByPage={pageActionsByPage}
    />
  ) : (
    <div />
  );

  const sidebar = (
    <div className="flex flex-col gap-4">
      {selectedFile ? (
        <FileSummary
          file={selectedFile}
          pageCount={pageCount}
          onChange={handleClear}
        />
      ) : null}

      {config.operation !== "split-pdf" &&
      config.operation !== "reorder-pages" ? (
        <SelectionControls
          selectedCount={selectedPages.size}
          totalCount={pageCount}
          onSelectAll={selectAll}
          onClear={clearSelection}
          onInvert={invertSelection}
          intent={config.operation === "delete-pages" ? "deletion" : "selected"}
        />
      ) : null}

      {config.operation === "rotate-pages" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Ángulo</legend>
          <div className="grid grid-cols-3 gap-2">
            {[90, 180, 270].map((value) => (
              <Button
                key={value}
                type="button"
                variant={angle === value ? "brand" : "outline"}
                size="sm"
                onClick={() => setAngle(value as 90 | 180 | 270)}
              >
                {value}°
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            El ángulo se aplica solo a las páginas seleccionadas.
          </p>
        </fieldset>
      ) : null}

      {config.operation === "reorder-pages" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Usa las flechas debajo de cada página para reordenarlas. El número
            grande es la posición final.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetOrder}
            disabled={isProcessing}
          >
            Restaurar orden original
          </Button>
        </div>
      ) : null}

      {config.operation === "split-pdf" ? (
        <p className="text-sm text-muted-foreground">
          Cada página del PDF se exporta como archivo independiente dentro de un
          ZIP llamado <code>{`${selectedFile?.name ?? "documento"}.zip`}</code>.
        </p>
      ) : null}
    </div>
  );

  const ActionIcon = config.actionIcon;
  const primaryAction = (
    <>
      <Button
        type="button"
        variant="brand"
        size="lg"
        onClick={handleProcess}
        disabled={!canProcess}
        className="w-full"
      >
        {isProcessing ? (
          <Loader2
            className="animate-spin"
            data-icon="inline-start"
            aria-hidden
          />
        ) : (
          <ActionIcon data-icon="inline-start" aria-hidden />
        )}
        {isProcessing ? config.processingLabel : config.actionLabel}
      </Button>
      {isProcessing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={cancelOperation}
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
      <AlertTitle>Archivo listo</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span>La operación terminó correctamente.</span>
          <Button asChild variant="brand" size="sm">
            <a href={downloadResult.url} download={downloadResult.fileName}>
              <Download data-icon="inline-start" aria-hidden />
              Descargar
            </a>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  ) : null;

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={hasContent}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle={config.emptyTitle}
      emptyDescription={config.emptyDescription}
      emptyActionLabel={config.emptyActionLabel}
      emptyHint={config.emptyHint}
      preview={preview}
      sidebarTitle={config.toolTitle}
      sidebarDescription={config.toolDescription}
      sidebar={sidebar}
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={resultBanner}
    />
  );
}

interface ReorderPageActionsProps {
  pageNumber: number;
  displayIndex: number;
  pageCount: number;
  isProcessing: boolean;
  onMovePage: (pageNumber: number, direction: -1 | 1) => void;
}

function ReorderPageActions({
  pageNumber,
  displayIndex,
  pageCount,
  isProcessing,
  onMovePage,
}: ReorderPageActionsProps) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`Mover página ${pageNumber} hacia atrás`}
        onClick={() => onMovePage(pageNumber, -1)}
        disabled={displayIndex === 0 || isProcessing}
      >
        <ArrowLeft className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`Mover página ${pageNumber} hacia adelante`}
        onClick={() => onMovePage(pageNumber, 1)}
        disabled={displayIndex === pageCount - 1 || isProcessing}
      >
        <ArrowRight className="size-3.5" />
      </Button>
    </>
  );
}

interface FileSummaryProps {
  file: File;
  pageCount: number;
  onChange: () => void;
}

function FileSummary({ file, pageCount, onChange }: FileSummaryProps) {
  return (
    <div className="surface-inset">
      <p className="truncate text-sm font-medium" title={file.name}>
        {file.name}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatFileSize(file.size)} · {pageCount} páginas
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 -ml-2"
        onClick={onChange}
      >
        Cambiar archivo
      </Button>
    </div>
  );
}

interface SelectionControlsProps {
  selectedCount: number;
  totalCount: number;
  intent: "selected" | "deletion";
  onSelectAll: () => void;
  onClear: () => void;
  onInvert: () => void;
}

function SelectionControls({
  selectedCount,
  totalCount,
  intent,
  onSelectAll,
  onClear,
  onInvert,
}: SelectionControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p
        className={cn(
          "text-sm font-semibold",
          intent === "deletion" ? "text-destructive" : "text-foreground",
        )}
      >
        {selectedCount} de {totalCount} páginas seleccionadas
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
          <CheckSquare data-icon="inline-start" aria-hidden />
          Todas
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={selectedCount === 0}
        >
          <Square data-icon="inline-start" aria-hidden />
          Ninguna
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onInvert}
          className="col-span-2"
        >
          Invertir selección
        </Button>
      </div>
    </div>
  );
}
