import { useState, useRef } from "react";
import { FileUp, Loader2 } from "lucide-react";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import html2pdf from "html2pdf.js";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";

const SUPPORTED_OFFICE_EXTENSIONS = ["docx", "xlsx", "pptx"] as const;
const MAX_OFFICE_FILE_SIZE_BYTES = 50 * 1024 * 1024;
type SupportedOfficeExtension = (typeof SUPPORTED_OFFICE_EXTENSIONS)[number];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSupportedOfficeExtension(
  extension: string | undefined,
): extension is SupportedOfficeExtension {
  return SUPPORTED_OFFICE_EXTENSIONS.includes(
    extension as SupportedOfficeExtension,
  );
}

export function OfficeToPdfTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );

  const hiddenContainerRef = useRef<HTMLDivElement>(null);

  function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!isSupportedOfficeExtension(ext)) {
      setErrorMessage("Por favor selecciona un archivo .docx, .xlsx o .pptx");
      return;
    }
    if (file.size > MAX_OFFICE_FILE_SIZE_BYTES) {
      setErrorMessage("El archivo supera el límite de 50 MB.");
      return;
    }

    setErrorMessage(null);
    setDownloadResult(null);
    setSelectedFile(file);
  }

  async function handleConvert() {
    if (!selectedFile || !hiddenContainerRef.current) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    let htmlContent = "";

    try {
      const buffer = await selectedFile.arrayBuffer();

      if (ext === "docx") {
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        htmlContent = `<div style="padding: 20px; font-family: sans-serif;">${result.value}</div>`;
      } else if (ext === "xlsx") {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        htmlContent = `<div style="padding: 20px; font-family: sans-serif;">`;

        workbook.eachSheet((worksheet) => {
          htmlContent += `<h2>${escapeHtml(worksheet.name)}</h2><table border="1" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">`;
          worksheet.eachRow((row) => {
            htmlContent += `<tr>`;
            row.eachCell((cell) => {
              htmlContent += `<td style="padding: 5px;">${escapeHtml(cell.text)}</td>`;
            });
            htmlContent += `</tr>`;
          });
          htmlContent += `</table>`;
        });
        htmlContent += `</div>`;
      } else if (ext === "pptx") {
        const zip = await JSZip.loadAsync(buffer);
        htmlContent = `<div style="padding: 20px; font-family: sans-serif;">`;

        const slideFiles = Object.keys(zip.files).filter(
          (f) => f.startsWith("ppt/slides/slide") && f.endsWith(".xml"),
        );
        // Sort slides numerically
        slideFiles.sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0");
          const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0");
          return numA - numB;
        });

        const slideHtml = await Promise.all(
          slideFiles.map(async (slideFile) => {
            const xmlText = await zip.files[slideFile].async("text");
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const texts = Array.from(
              xmlDoc.getElementsByTagName("a:t"),
            ).flatMap((node) => (node.textContent ? [node.textContent] : []));

            let content = `<div style="border: 1px solid #ccc; padding: 20px; margin-bottom: 20px; aspect-ratio: 16/9; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; font-size: 24px; page-break-after: always;">`;
            for (const text of texts) {
              content += `<p>${escapeHtml(text)}</p>`;
            }
            content += `</div>`;
            return content;
          }),
        );
        htmlContent += slideHtml.join("");
        htmlContent += `</div>`;
      }

      hiddenContainerRef.current.innerHTML = htmlContent;

      const opt = {
        margin: 10,
        filename:
          selectedFile.name.replace(/\.(docx|xlsx|pptx)$/i, "") +
          "-convertido.pdf",
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation:
            ext === "pptx" ? ("landscape" as const) : ("portrait" as const),
        },
      };

      const pdfBlob = await html2pdf()
        .set(opt)
        .from(hiddenContainerRef.current)
        .outputPdf("blob");
      const url = URL.createObjectURL(pdfBlob);

      setDownloadResult({
        url,
        fileName: opt.filename,
        mimeType: "application/pdf",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al convertir a PDF.",
      );
    } finally {
      if (hiddenContainerRef.current) {
        hiddenContainerRef.current.innerHTML = "";
      }
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
        <FileUp data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Convirtiendo a PDF" : "Convertir Office a PDF"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept=".docx,.xlsx,.pptx"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un archivo Office"
      emptyDescription="Sube un archivo Word (.docx), Excel (.xlsx) o PowerPoint (.pptx)."
      emptyActionLabel="Seleccionar archivo"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
            <FileUp className="size-16 opacity-50 text-brand" />
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">
                Listo para convertir a PDF de forma local.
              </p>
            </div>
            <div
              ref={hiddenContainerRef}
              aria-hidden="true"
              className="pointer-events-none fixed left-[-10000px] top-0 w-[794px] bg-white text-black"
            />
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="Office a PDF"
      sidebarDescription="Convierte archivos de Word, Excel y PowerPoint a PDF localmente."
      sidebar={
        <div className="text-sm text-muted-foreground">
          La conversión se realiza 100% en tu navegador extrayendo el contenido.
          El formato y diseño visual serán básicos, priorizando la retención de
          datos sin enviarlos a servidores de terceros.
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
