import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  return files.reduce((totalSize, selectedFile) => {
    return totalSize + selectedFile.file.size;
  }, 0);
}

export function ImageToPdfTool() {
  const inputRef = useRef<HTMLInputElement>(null);
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

  function updateSelectedFiles(nextFiles: SelectedImageFile[]) {
    setSelectedFiles(nextFiles);
    setErrorMessage(null);
    clearDownloadResult();
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
    const validation = validateImageFiles(nextFiles.map(({ file }) => file));

    if (!validation.isValid) {
      setErrorMessage(
        validation.errors[0] ?? "No se pudieron agregar imagenes.",
      );
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

  function cancelConversion() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsProcessing(false);
    setErrorMessage("Operacion cancelada.");
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
        validation.errors[0] ?? "No se pudo iniciar la conversion.",
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
        throw new Error("La conversion no genero un PDF descargable.");
      }

      const blob = new Blob([result.buffer], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      replaceDownloadResult({ url, fileName: result.fileName });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron convertir las imagenes.";
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
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            multiple
            onChange={handleFileSelection}
          />
          <div className="flex flex-col items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Upload className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Selecciona imagenes</h2>
              <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
                Agrega JPG o PNG. Cada imagen se convierte en una pagina del PDF
                final, respetando el orden de la lista.
              </p>
            </div>
            <Button
              type="button"
              variant="brand"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload data-icon="inline-start" aria-hidden />
              Elegir imagenes
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-7">
          <h2 className="text-lg font-semibold">Resumen</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-base">
            <div>
              <dt className="text-muted-foreground">Imagenes</dt>
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
              <h2 className="font-semibold">Orden de paginas</h2>
              <p className="text-base text-muted-foreground">
                Cada imagen se inserta como una pagina.
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
                  <ImageIcon className="size-5" aria-hidden />
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
          onClick={handleConvert}
          disabled={!canConvert}
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
          {isProcessing ? "Convirtiendo imagenes" : "Crear PDF"}
        </Button>
        {isProcessing ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={cancelConversion}
          >
            Cancelar
          </Button>
        ) : null}
      </div>

      {downloadResult ? (
        <Alert variant="brand">
          <Download />
          <AlertTitle>PDF listo</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span>Las imagenes se convirtieron correctamente.</span>
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
