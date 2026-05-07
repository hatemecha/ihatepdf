import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, FileText, Loader2, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";
import type {
  PdfInputFile,
  PdfOperationRequest,
} from "@/features/pdf-tools/shared/pdfOperation.types";
import {
  formatFileSize,
  validateSinglePdfFile,
} from "@/features/pdf-tools/shared/fileValidation";
import {
  formatPageRangeHint,
  parsePageOrder,
  parsePageRange,
} from "@/features/pdf-tools/shared/pageRanges";

type SinglePdfOperation =
  | "split-pdf"
  | "extract-pages"
  | "delete-pages"
  | "reorder-pages"
  | "rotate-pages";

interface SinglePdfOperationConfig {
  operation: SinglePdfOperation;
  pickerTitle: string;
  pickerDescription: string;
  actionLabel: string;
  processingLabel: string;
  rangeLabel?: string;
  rangeHelp?: string;
  defaultRange?: "all" | "first" | "order";
}

interface SinglePdfOperationToolProps {
  config: SinglePdfOperationConfig;
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
      pickerTitle: "Selecciona un PDF para dividir",
      pickerDescription:
        "Se generara un ZIP con un PDF independiente por cada pagina.",
      actionLabel: "Dividir y descargar ZIP",
      processingLabel: "Dividiendo PDF",
    },
    "extract-pages": {
      operation: "extract-pages",
      pickerTitle: "Selecciona un PDF",
      pickerDescription:
        "Indica las paginas que quieres conservar en un nuevo archivo.",
      actionLabel: "Extraer paginas",
      processingLabel: "Extrayendo paginas",
      rangeLabel: "Paginas a extraer",
      rangeHelp: "Ejemplo: 1,3-5. Deja vacio para usar todas.",
      defaultRange: "first",
    },
    "delete-pages": {
      operation: "delete-pages",
      pickerTitle: "Selecciona un PDF",
      pickerDescription: "Indica que paginas quieres quitar del documento.",
      actionLabel: "Eliminar paginas",
      processingLabel: "Eliminando paginas",
      rangeLabel: "Paginas a eliminar",
      rangeHelp: "Ejemplo: 2,4-6. Debe quedar al menos una pagina.",
      defaultRange: "first",
    },
    "reorder-pages": {
      operation: "reorder-pages",
      pickerTitle: "Selecciona un PDF",
      pickerDescription:
        "Escribe el orden final usando numeros separados por coma.",
      actionLabel: "Reordenar paginas",
      processingLabel: "Reordenando paginas",
      rangeLabel: "Nuevo orden",
      rangeHelp: "Ejemplo para 3 paginas: 3,1,2. Deben estar todas una vez.",
      defaultRange: "order",
    },
    "rotate-pages": {
      operation: "rotate-pages",
      pickerTitle: "Selecciona un PDF",
      pickerDescription: "Rota paginas puntuales o el documento completo.",
      actionLabel: "Rotar paginas",
      processingLabel: "Rotando paginas",
      rangeLabel: "Paginas a rotar",
      rangeHelp: "Ejemplo: 1,3-5. Deja vacio para rotar todas.",
      defaultRange: "all",
    },
  };

function getDefaultRange(
  pageCount: number,
  defaultRange: SinglePdfOperationConfig["defaultRange"],
): string {
  if (defaultRange === "order") {
    return Array.from({ length: pageCount }, (_, index) => index + 1).join(",");
  }

  if (defaultRange === "first") {
    return "1";
  }

  return formatPageRangeHint(pageCount);
}

function createInputFile(file: File, buffer: ArrayBuffer): PdfInputFile {
  return {
    name: file.name,
    buffer,
  };
}

export function getSinglePdfOperationConfig(
  operation: SinglePdfOperation,
): SinglePdfOperationConfig {
  return OPERATION_CONFIGS[operation];
}

export function SinglePdfOperationTool({
  config,
}: SinglePdfOperationToolProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [rangeValue, setRangeValue] = useState("");
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  const canProcess = useMemo(() => {
    if (!selectedFile || !pageCount || isProcessing) {
      return false;
    }

    if (config.operation === "split-pdf") {
      return true;
    }

    if (
      config.operation === "delete-pages" ||
      config.operation === "reorder-pages"
    ) {
      return rangeValue.trim().length > 0;
    }

    return true;
  }, [config.operation, isProcessing, pageCount, rangeValue, selectedFile]);

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

  function cancelOperation() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsProcessing(false);
    setErrorMessage("Operacion cancelada.");
  }

  async function inspectSelectedFile(file: File) {
    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el PDF.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setPageCount(null);
    clearDownloadResult();

    try {
      const worker = createPdfOperationWorker();
      workerRef.current = worker;
      const result = await runPdfOperation(worker, {
        kind: "inspect-pdf",
        file: createInputFile(file, await file.arrayBuffer()),
      });

      if (result.kind !== "inspect") {
        throw new Error("No se pudo leer la cantidad de paginas.");
      }

      setSelectedFile(file);
      setPageCount(result.pageCount);
      setRangeValue(getDefaultRange(result.pageCount, config.defaultRange));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo leer el PDF seleccionado.";
      setErrorMessage(message);
      setSelectedFile(null);
    } finally {
      workerRef.current?.terminate();
      workerRef.current = null;
      setIsProcessing(false);
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    void inspectSelectedFile(file);
  }

  function buildOperationRequest(file: PdfInputFile): PdfOperationRequest {
    if (config.operation === "split-pdf") {
      return {
        kind: "split-pdf",
        file,
      };
    }

    if (!pageCount) {
      throw new Error("No se pudo leer la cantidad de paginas.");
    }

    if (config.operation === "reorder-pages") {
      const orderResult = parsePageOrder(rangeValue, pageCount);
      if (!orderResult.isValid) {
        throw new Error(orderResult.error);
      }

      return {
        kind: "reorder-pages",
        file,
        pages: orderResult.pages,
      };
    }

    const rangeResult = parsePageRange(rangeValue, pageCount);
    if (!rangeResult.isValid) {
      throw new Error(rangeResult.error);
    }

    if (
      config.operation === "delete-pages" &&
      rangeResult.pages.length === pageCount
    ) {
      throw new Error("No puedes eliminar todas las paginas del PDF.");
    }

    if (config.operation === "rotate-pages") {
      return {
        kind: "rotate-pages",
        file,
        pages: rangeResult.pages,
        angle,
      };
    }

    return {
      kind: config.operation,
      file,
      pages: rangeResult.pages,
    };
  }

  async function handleProcess() {
    if (!selectedFile) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    clearDownloadResult();

    try {
      const worker = createPdfOperationWorker();
      workerRef.current = worker;
      const request = buildOperationRequest(
        createInputFile(selectedFile, await selectedFile.arrayBuffer()),
      );
      const result = await runPdfOperation(worker, request);

      if (result.kind !== "file") {
        throw new Error("La operacion no genero un archivo descargable.");
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

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-dashed border-border bg-muted p-7">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileSelection}
          />
          <div className="flex flex-col items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Upload className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{config.pickerTitle}</h2>
              <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
                {config.pickerDescription}
              </p>
            </div>
            <Button
              type="button"
              variant="brand"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload data-icon="inline-start" aria-hidden />
              Elegir PDF
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-7">
          <h2 className="text-lg font-semibold">Archivo</h2>
          {selectedFile ? (
            <div className="mt-4 flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-medium">
                  {selectedFile.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                  {pageCount ? ` - ${pageCount} paginas` : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-base text-muted-foreground">
              Todavia no seleccionaste ningun PDF.
            </p>
          )}
        </div>
      </div>

      {selectedFile && config.operation !== "split-pdf" ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="flex flex-col gap-2">
              <span className="text-base font-medium">{config.rangeLabel}</span>
              <input
                className="h-12 rounded-md border border-input bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={rangeValue}
                onChange={(event) => {
                  setRangeValue(event.target.value);
                  setErrorMessage(null);
                  clearDownloadResult();
                }}
              />
              <span className="text-sm text-muted-foreground">
                {config.rangeHelp}
              </span>
            </label>

            {config.operation === "rotate-pages" ? (
              <label className="flex flex-col gap-2">
                <span className="text-base font-medium">Rotacion</span>
                <select
                  className="h-12 rounded-md border border-input bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={angle}
                  onChange={(event) =>
                    setAngle(Number(event.target.value) as 90 | 180 | 270)
                  }
                >
                  <option value={90}>90 grados</option>
                  <option value={180}>180 grados</option>
                  <option value={270}>270 grados</option>
                </select>
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo continuar</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="brand"
          size="lg"
          onClick={handleProcess}
          disabled={!canProcess}
        >
          {isProcessing ? (
            <Loader2
              className="animate-spin"
              data-icon="inline-start"
              aria-hidden
            />
          ) : (
            <Download data-icon="inline-start" aria-hidden />
          )}
          {isProcessing ? config.processingLabel : config.actionLabel}
        </Button>
        {isProcessing ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={cancelOperation}
          >
            Cancelar
          </Button>
        ) : null}
      </div>

      {downloadResult ? (
        <Alert variant="brand">
          <Download />
          <AlertTitle>Archivo listo</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span>La operacion termino correctamente.</span>
              <Button asChild variant="brand" size="sm">
                <a href={downloadResult.url} download={downloadResult.fileName}>
                  <Download data-icon="inline-start" aria-hidden />
                  Descargar
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
