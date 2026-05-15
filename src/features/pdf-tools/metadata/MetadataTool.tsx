import { useState } from "react";
import { Loader2 } from "lucide-react";

import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";

interface Metadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
}

export function MetadataTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);

  async function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el PDF.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setMetadata(null);
    setSelectedFile(file);

    try {
      const buffer = await file.arrayBuffer();
      const worker = createPdfOperationWorker();
      const result = await runPdfOperation(worker, {
        kind: "view-metadata",
        file: { name: file.name, buffer },
      });

      if (result.kind === "metadata") {
        setMetadata(result.metadata);
      } else {
        throw new Error("Respuesta inesperada del worker.");
      }
      worker.terminate();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al leer metadatos.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const preview = metadata ? (
    <div className="flex h-full flex-col p-4 sm:p-6 lg:p-8 bg-card text-card-foreground border rounded-xl overflow-y-auto">
      <h3 className="text-xl font-semibold mb-4 border-b pb-2">Metadatos del PDF</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Título</dt>
          <dd className="mt-1 text-sm">{metadata.title || "-"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Autor</dt>
          <dd className="mt-1 text-sm">{metadata.author || "-"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Asunto</dt>
          <dd className="mt-1 text-sm">{metadata.subject || "-"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Palabras clave</dt>
          <dd className="mt-1 text-sm">{metadata.keywords || "-"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Creador</dt>
          <dd className="mt-1 text-sm">{metadata.creator || "-"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Productor</dt>
          <dd className="mt-1 text-sm">{metadata.producer || "-"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Fecha de creación</dt>
          <dd className="mt-1 text-sm">
            {metadata.creationDate ? new Date(metadata.creationDate).toLocaleString() : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Fecha de modificación</dt>
          <dd className="mt-1 text-sm">
            {metadata.modificationDate ? new Date(metadata.modificationDate).toLocaleString() : "-"}
          </dd>
        </div>
      </dl>
    </div>
  ) : isProcessing ? (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  ) : (
    <div />
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Sube un archivo para inspeccionar sus metadatos internos."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={preview}
      sidebarTitle="Ver metadatos"
      sidebarDescription="Visualiza información oculta del PDF."
      sidebar={<div className="text-sm text-muted-foreground">El archivo se lee localmente, sin subirlo a ningún servidor.</div>}
      primaryAction={null}
      errorMessage={errorMessage}
    />
  );
}
