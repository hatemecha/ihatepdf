import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
}

const MERGED_FILE_NAME = "ihatepdf-merged.pdf";

function createFileId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getSelectedFilesSize(files: SelectedPdfFile[]): number {
  return files.reduce((totalSize, selectedFile) => {
    return totalSize + selectedFile.file.size;
  }, 0);
}

export function MergePdfTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedPdfFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalSize = useMemo(
    () => getSelectedFilesSize(selectedFiles),
    [selectedFiles],
  );

  const canMerge = selectedFiles.length >= 2 && !isProcessing;

  function replaceResultUrl(nextUrl: string | null) {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }

    resultUrlRef.current = nextUrl;
    setResultUrl(nextUrl);
  }

  function clearResult() {
    replaceResultUrl(null);
  }

  function updateSelectedFiles(nextFiles: SelectedPdfFile[]) {
    setSelectedFiles(nextFiles);
    setErrorMessage(null);
    clearResult();
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []);
    const nextFiles = [
      ...selectedFiles,
      ...incomingFiles.map((file) => ({
        id: createFileId(file),
        file,
      })),
    ];

    const validation = validateMergePdfFiles(
      nextFiles.map((selectedFile) => selectedFile.file),
      { requireMinimumFileCount: false },
    );

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudieron agregar PDFs.");
      event.target.value = "";
      return;
    }

    updateSelectedFiles(nextFiles);
    event.target.value = "";
  }

  function removeFile(fileId: string) {
    updateSelectedFiles(
      selectedFiles.filter((selectedFile) => selectedFile.id !== fileId),
    );
  }

  function moveFile(fileId: string, direction: -1 | 1) {
    const currentIndex = selectedFiles.findIndex(
      (selectedFile) => selectedFile.id === fileId,
    );
    const nextIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= selectedFiles.length
    ) {
      return;
    }

    const nextFiles = [...selectedFiles];
    const [movedFile] = nextFiles.splice(currentIndex, 1);
    nextFiles.splice(nextIndex, 0, movedFile);
    updateSelectedFiles(nextFiles);
  }

  function cancelMerge() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsProcessing(false);
    setErrorMessage("Operacion cancelada.");
  }

  async function readFilesForWorker(): Promise<PdfInputFile[]> {
    return Promise.all(
      selectedFiles.map(async (selectedFile) => ({
        name: selectedFile.file.name,
        buffer: await selectedFile.file.arrayBuffer(),
      })),
    );
  }

  async function runMergeWorker(files: PdfInputFile[]): Promise<ArrayBuffer> {
    const worker = createPdfOperationWorker();
    workerRef.current = worker;
    const result = await runPdfOperation(worker, {
      kind: "merge-pdfs",
      files,
    });

    if (result.kind !== "file") {
      throw new Error("La union no genero un archivo descargable.");
    }

    return result.buffer;
  }

  async function handleMerge() {
    const files = selectedFiles.map((selectedFile) => selectedFile.file);
    const validation = validateMergePdfFiles(files);

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo iniciar la union.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    clearResult();

    try {
      const workerFiles = await readFilesForWorker();
      const mergedBuffer = await runMergeWorker(workerFiles);
      const mergedBlob = new Blob([mergedBuffer], {
        type: "application/pdf",
      });
      const downloadUrl = URL.createObjectURL(mergedBlob);
      replaceResultUrl(downloadUrl);
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

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-dashed border-border bg-muted p-7">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleFileSelection}
          />

          <div className="flex flex-col items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Upload className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Selecciona tus PDFs</h2>
              <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
                Agrega entre 2 y 20 archivos. El PDF final respeta el orden de
                esta lista y se descarga al terminar.
              </p>
            </div>
            <Button
              type="button"
              variant="brand"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload data-icon="inline-start" aria-hidden />
              Elegir archivos
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-7">
          <h2 className="text-lg font-semibold">Resumen</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-base">
            <div>
              <dt className="text-muted-foreground">Archivos</dt>
              <dd className="mt-1 text-2xl font-semibold">
                {selectedFiles.length}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Peso total</dt>
              <dd className="mt-1 text-2xl font-semibold">
                {formatFileSize(totalSize)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Todo se procesa en la sesion actual del navegador. No hay cuentas,
            colas ni servidores recibiendo tus documentos.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo continuar</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {selectedFiles.length > 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Orden de union</h2>
              <p className="text-base text-muted-foreground">
                Usa las flechas para ajustar el orden antes de unir.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateSelectedFiles([])}
              disabled={isProcessing}
            >
              Limpiar lista
            </Button>
          </div>

          <ol className="divide-y divide-border">
            {selectedFiles.map((selectedFile, index) => (
              <li
                key={selectedFile.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <FileText className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">
                    {index + 1}. {selectedFile.file.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(selectedFile.file.size)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Subir ${selectedFile.file.name}`}
                    onClick={() => moveFile(selectedFile.id, -1)}
                    disabled={index === 0 || isProcessing}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Bajar ${selectedFile.file.name}`}
                    onClick={() => moveFile(selectedFile.id, 1)}
                    disabled={
                      index === selectedFiles.length - 1 || isProcessing
                    }
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar ${selectedFile.file.name}`}
                    onClick={() => removeFile(selectedFile.id)}
                    disabled={isProcessing}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="brand"
          size="lg"
          onClick={handleMerge}
          disabled={!canMerge}
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
          {isProcessing ? "Uniendo PDFs" : "Unir y descargar"}
        </Button>
        {isProcessing ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={cancelMerge}
          >
            Cancelar
          </Button>
        ) : null}
        {selectedFiles.length === 1 ? (
          <p className="text-base text-muted-foreground">
            Agrega otro PDF para habilitar la union.
          </p>
        ) : null}
      </div>

      {resultUrl ? (
        <Alert variant="brand">
          <Download />
          <AlertTitle>PDF listo</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span>El archivo unido esta listo para descargar.</span>
              <Button asChild variant="brand" size="sm">
                <a href={resultUrl} download={MERGED_FILE_NAME}>
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
