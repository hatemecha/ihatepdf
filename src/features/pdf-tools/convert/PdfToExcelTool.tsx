import { useState } from "react";
import { Table, Loader2 } from "lucide-react";
import ExcelJS from "exceljs";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import { loadPdfDocument } from "@/features/pdf-tools/shared/pdfPreview";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";

export function PdfToExcelTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el archivo.");
      return;
    }

    setErrorMessage(null);
    setDownloadResult(null);
    setSelectedFile(file);
  }

  async function handleConvert() {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;

    try {
      pdf = await loadPdfDocument(selectedFile);
      const numPages = pdf.numPages;

      const workbook = new ExcelJS.Workbook();

      for (let i = 1; i <= numPages; i++) {
        const worksheet = workbook.addWorksheet(`Página ${i}`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Group items by Y position roughly to form rows
        const rowsMap = new Map<number, { x: number; str: string }[]>();

        for (const item of textContent.items) {
          if ("str" in item && item.str.trim() !== "") {
            const x = item.transform[4];
            const y = Math.round(item.transform[5] / 5) * 5; // Group by 5pt intervals

            if (!rowsMap.has(y)) {
              rowsMap.set(y, []);
            }
            rowsMap.get(y)!.push({ x, str: item.str });
          }
        }

        // Sort rows by Y descending (PDF coordinates start from bottom)
        const sortedY = Array.from(rowsMap.keys()).sort((a, b) => b - a);

        for (const y of sortedY) {
          const rowItems = rowsMap.get(y)!;
          // Sort by X ascending
          rowItems.sort((a, b) => a.x - b.x);

          // Simple column mapping based on order
          const rowData = rowItems.map((item) => item.str);
          worksheet.addRow(rowData);
        }
      }

      const excelBuffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);

      setDownloadResult({
        url,
        fileName: selectedFile.name.replace(/\.pdf$/i, "") + "-convertido.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al convertir a Excel.",
      );
    } finally {
      await pdf?.destroy();
      setIsProcessing(false);
    }
  }

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleConvert}
      disabled={!selectedFile || isProcessing}
      className="w-full"
    >
      {isProcessing ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden
        />
      ) : (
        <Table data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Convirtiendo a Excel" : "Convertir PDF a Excel"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      experimental
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Sube un archivo PDF para extraer sus datos a una hoja de cálculo Excel (.xlsx)."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
            <Table className="size-16 opacity-50 text-green-600" />
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">Listo para extraer tablas a XLSX.</p>
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="PDF a Excel"
      sidebarDescription="Convierte documentos PDF a hojas de cálculo localmente."
      sidebar={
        <div className="text-sm text-muted-foreground">
          Extrae los datos de tu PDF agrupándolos en filas. Ideal para tablas y
          listados. Al ser un proceso local, el formato puede variar según la
          complejidad del documento.
        </div>
      }
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={
        downloadResult ? (
          <DownloadReadyBanner downloadResult={downloadResult} />
        ) : null
      }
    />
  );
}
