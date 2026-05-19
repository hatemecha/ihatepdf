import { useState } from "react";
import { Loader2, Table } from "lucide-react";
import ExcelJS from "exceljs";

import { Button } from "@/components/ui/button";
import {
  extractPositionedTextLines,
  type PositionedTextLine,
} from "@/features/pdf-tools/convert/pdfToWordConversion";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import { loadPdfDocument } from "@/features/pdf-tools/shared/pdfPreview";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";

interface SpreadsheetCell {
  value: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  fontFamily?: string;
}

interface SpreadsheetRow {
  cells: SpreadsheetCell[];
}

const COLUMN_CLUSTER_TOLERANCE = 18;
const MAX_WORKSHEET_NAME_LENGTH = 31;

function createEmptyCell(): SpreadsheetCell {
  return {
    value: "",
    fontSize: 12,
    bold: false,
    italic: false,
  };
}

function getLineStyle(
  line: PositionedTextLine,
): Omit<SpreadsheetCell, "value"> {
  const styledRun = line.runs.find((run) => run.text.trim()) ?? line.runs[0];

  return {
    fontSize: Math.max(8, Math.round(styledRun?.fontSize ?? line.fontSize)),
    bold: styledRun?.bold ?? false,
    italic: styledRun?.italic ?? false,
    fontFamily: styledRun?.fontFamily,
  };
}

function getColumnAnchors(lines: readonly PositionedTextLine[]): number[] {
  const rawAnchors: number[] = [];

  for (const line of lines) {
    if (line.columnXs.length > 1) {
      rawAnchors.push(...line.columnXs);
    } else {
      rawAnchors.push(line.x);
    }
  }

  const anchors: number[] = [];
  for (const x of rawAnchors.toSorted((left, right) => left - right)) {
    const lastAnchor = anchors[anchors.length - 1];
    if (
      lastAnchor === undefined ||
      Math.abs(lastAnchor - x) > COLUMN_CLUSTER_TOLERANCE
    ) {
      anchors.push(x);
    } else {
      anchors[anchors.length - 1] = (lastAnchor + x) / 2;
    }
  }

  return anchors.length > 0 ? anchors : [0];
}

function findNearestColumnIndex(anchors: readonly number[], x: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < anchors.length; index += 1) {
    const distance = Math.abs(anchors[index] - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function buildSpreadsheetRows(
  lines: readonly PositionedTextLine[],
): SpreadsheetRow[] {
  const anchors = getColumnAnchors(lines);

  return lines.map((line) => {
    const rowCells = Array.from({ length: anchors.length }, createEmptyCell);
    const style = getLineStyle(line);
    const values = line.cells.length > 0 ? line.cells : [line.text];
    const valueAnchors =
      line.columnXs.length === values.length ? line.columnXs : [line.x];

    values.forEach((value, index) => {
      const columnIndex = findNearestColumnIndex(
        anchors,
        valueAnchors[index] ?? line.x,
      );
      rowCells[columnIndex] = {
        value,
        ...style,
      };
    });

    return { cells: rowCells };
  });
}

function applyWorksheetLayout(
  worksheet: ExcelJS.Worksheet,
  rows: readonly SpreadsheetRow[],
) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.properties.defaultRowHeight = 18;

  for (const row of rows) {
    const worksheetRow = worksheet.addRow(row.cells.map((cell) => cell.value));
    row.cells.forEach((cell, index) => {
      const excelCell = worksheetRow.getCell(index + 1);
      excelCell.alignment = {
        vertical: "top",
        wrapText: true,
      };
      excelCell.font = {
        name: cell.fontFamily,
        size: cell.fontSize,
        bold: cell.bold,
        italic: cell.italic,
      };
    });
  }

  worksheet.columns.forEach((column) => {
    const values = Array.isArray(column.values) ? column.values.slice(1) : [];
    const maxLength = values.reduce<number>((max, value) => {
      return Math.max(max, String(value ?? "").length);
    }, 10);
    column.width = Math.min(Math.max(maxLength + 2, 10), 54);
  });
}

function createWorksheetName(pageNumber: number): string {
  return `Pagina ${pageNumber}`.slice(0, MAX_WORKSHEET_NAME_LENGTH);
}

export function PdfToExcelTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [progress, setProgress] = useState<string | null>(null);

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
    setProgress(null);

    let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;

    try {
      pdf = await loadPdfDocument(selectedFile);
      const numPages = pdf.numPages;
      let completedPages = 0;

      setProgress(
        numPages > 1
          ? `Analizando 0 de ${numPages} páginas…`
          : "Analizando tablas y columnas…",
      );
      const pagesRows = await Promise.all(
        Array.from({ length: numPages }, async (_, index) => {
          const pageNumber = index + 1;
          const page = await pdf!.getPage(pageNumber);

          try {
            const textContent = await page.getTextContent();
            return {
              pageNumber,
              rows: buildSpreadsheetRows(
                extractPositionedTextLines(textContent),
              ),
            };
          } finally {
            page.cleanup();
            completedPages += 1;
            if (numPages > 1) {
              setProgress(
                `Analizando ${completedPages} de ${numPages} páginas…`,
              );
            }
          }
        }),
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "iHatePDF";
      workbook.created = new Date();
      let extractedRows = 0;

      setProgress("Construyendo hojas de cálculo…");
      for (const { pageNumber, rows } of pagesRows) {
        const worksheet = workbook.addWorksheet(
          createWorksheetName(pageNumber),
        );
        applyWorksheetLayout(worksheet, rows);
        extractedRows += rows.length;
      }

      if (extractedRows === 0) {
        throw new Error(
          "No se encontró texto seleccionable para exportar. Si el PDF es un escaneo, usa OCR PDF primero.",
        );
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
      setProgress(null);
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
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Extrae tablas y columnas del PDF a una hoja XLSX editable."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
            {isProcessing ? (
              <Loader2 className="size-16 animate-spin text-brand opacity-80" />
            ) : (
              <Table className="size-16 opacity-50 text-green-600" />
            )}
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">
                {progress ?? "Listo para detectar tablas y crear XLSX."}
              </p>
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="PDF a Excel"
      sidebarDescription="Tablas y columnas editables, detectadas localmente."
      sidebar={
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Detecta columnas por coordenadas, conserva filas visibles y aplica
            estilos básicos como tamaño, negrita e itálica.
          </p>
          <p>
            Para documentos escaneados sin texto seleccionable, usa{" "}
            <strong className="text-foreground">OCR PDF</strong> primero.
          </p>
        </div>
      }
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={
        downloadResult ? (
          <DownloadReadyBanner
            downloadResult={downloadResult}
            onDismiss={() => setDownloadResult(null)}
          />
        ) : null
      }
    />
  );
}
