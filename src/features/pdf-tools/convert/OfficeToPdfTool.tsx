import { useRef, useState } from "react";
import ExcelJS from "exceljs";
import html2pdf from "html2pdf.js";
import JSZip from "jszip";
import { FileUp, Loader2 } from "lucide-react";
import mammoth from "mammoth";

import { Button } from "@/components/ui/button";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";

const SUPPORTED_OFFICE_EXTENSIONS = ["docx", "xlsx", "pptx"] as const;
const MAX_OFFICE_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const EMUS_PER_INCH = 914400;
const DEFAULT_PPTX_WIDTH_EMU = 12192000;
const DEFAULT_PPTX_HEIGHT_EMU = 6858000;
const PPTX_RENDER_WIDTH_PX = 1120;
const MAX_EXCEL_RENDER_COLUMNS = 36;
type SupportedOfficeExtension = (typeof SUPPORTED_OFFICE_EXTENSIONS)[number];

interface PptxSlideSize {
  width: number;
  height: number;
}

interface PptxBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function getMimeTypeFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  if (extension === "gif") {
    return "image/gif";
  }
  if (extension === "svg") {
    return "image/svg+xml";
  }
  if (extension === "webp") {
    return "image/webp";
  }

  return "image/png";
}

function wrapOfficeHtml(content: string): string {
  return `
    <style>
      .office-document {
        box-sizing: border-box;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.35;
        padding: 28px;
      }
      .office-document img {
        max-width: 100%;
        height: auto;
      }
      .office-document table {
        border-collapse: collapse;
        width: 100%;
      }
      .office-document th,
      .office-document td {
        border: 1px solid #d1d5db;
        padding: 6px 8px;
        vertical-align: top;
      }
      .office-sheet {
        break-after: page;
        margin-bottom: 24px;
      }
      .office-sheet h2 {
        font-size: 18px;
        margin: 0 0 12px;
      }
      .office-sheet-table {
        table-layout: fixed;
      }
      .pptx-slide {
        background: #fff;
        border: 1px solid #d1d5db;
        box-sizing: border-box;
        margin: 0 auto 24px;
        overflow: hidden;
        page-break-after: always;
        position: relative;
      }
      .pptx-shape {
        box-sizing: border-box;
        color: #111827;
        overflow: hidden;
        position: absolute;
        white-space: pre-wrap;
      }
      .pptx-image {
        object-fit: contain;
        position: absolute;
      }
    </style>
    <div class="office-document">${content}</div>
  `;
}

function getElementsByLocalName(
  root: ParentNode,
  localName: string,
): Element[] {
  const elements =
    root instanceof Document
      ? root.documentElement.getElementsByTagName("*")
      : root.querySelectorAll("*");
  const matches: Element[] = [];

  for (const element of Array.from(elements)) {
    if (
      element.localName === localName ||
      element.tagName.endsWith(`:${localName}`)
    ) {
      matches.push(element);
    }
  }

  return matches;
}

function getFirstElementByLocalName(
  root: ParentNode,
  localName: string,
): Element | null {
  for (const element of getElementsByLocalName(root, localName)) {
    return element;
  }

  return null;
}

function getXmlAttribute(element: Element, localName: string): string | null {
  for (const attribute of Array.from(element.attributes)) {
    if (
      attribute.localName === localName ||
      attribute.name === localName ||
      attribute.name.endsWith(`:${localName}`)
    ) {
      return attribute.value;
    }
  }

  return null;
}

function parseXml(xmlText: string): Document {
  return new DOMParser().parseFromString(xmlText, "text/xml");
}

function normalizeZipPath(path: string): string {
  const parts: string[] = [];

  for (const part of path.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.join("/");
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async("text") : null;
}

function readPptxSlideSize(presentationXml: string | null): PptxSlideSize {
  if (!presentationXml) {
    return { width: DEFAULT_PPTX_WIDTH_EMU, height: DEFAULT_PPTX_HEIGHT_EMU };
  }

  const document = parseXml(presentationXml);
  const slideSize = getFirstElementByLocalName(document, "sldSz");
  const width = Number(slideSize?.getAttribute("cx"));
  const height = Number(slideSize?.getAttribute("cy"));

  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_PPTX_WIDTH_EMU,
    height:
      Number.isFinite(height) && height > 0 ? height : DEFAULT_PPTX_HEIGHT_EMU,
  };
}

function readPptxBounds(root: Element): PptxBounds | null {
  const transform = getFirstElementByLocalName(root, "xfrm");
  const offset = transform
    ? getFirstElementByLocalName(transform, "off")
    : null;
  const extent = transform
    ? getFirstElementByLocalName(transform, "ext")
    : null;
  const x = Number(offset?.getAttribute("x"));
  const y = Number(offset?.getAttribute("y"));
  const width = Number(extent?.getAttribute("cx"));
  const height = Number(extent?.getAttribute("cy"));

  if (
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { x, y, width, height };
}

function pptxBoundsToStyle(
  bounds: PptxBounds,
  slideSize: PptxSlideSize,
): string {
  return [
    `left:${(bounds.x / slideSize.width) * 100}%`,
    `top:${(bounds.y / slideSize.height) * 100}%`,
    `width:${(bounds.width / slideSize.width) * 100}%`,
    `height:${(bounds.height / slideSize.height) * 100}%`,
  ].join(";");
}

function getPptxShapeText(shape: Element): string {
  const paragraphs: string[] = [];

  for (const paragraph of getElementsByLocalName(shape, "p")) {
    const parts: string[] = [];
    for (const textNode of getElementsByLocalName(paragraph, "t")) {
      if (textNode.textContent) {
        parts.push(textNode.textContent);
      }
    }
    const paragraphText = parts.join("").trim();
    if (paragraphText) {
      paragraphs.push(paragraphText);
    }
  }

  return paragraphs.join("\n");
}

function getPptxShapeTextStyle(shape: Element, bounds: PptxBounds): string {
  const runProperties = getFirstElementByLocalName(shape, "rPr");
  const fontSizeValue = Number(runProperties?.getAttribute("sz"));
  const fontSize =
    Number.isFinite(fontSizeValue) && fontSizeValue > 0
      ? fontSizeValue / 100
      : Math.max(10, Math.min(30, (bounds.height / EMUS_PER_INCH) * 18));
  const isBold = runProperties?.getAttribute("b") === "1";
  const isItalic = runProperties?.getAttribute("i") === "1";

  return [
    `font-size:${fontSize}pt`,
    isBold ? "font-weight:700" : "",
    isItalic ? "font-style:italic" : "",
  ]
    .filter(Boolean)
    .join(";");
}

async function readSlideRelationships(
  zip: JSZip,
  slidePath: string,
): Promise<Map<string, string>> {
  const slideFileName = slidePath.split("/").pop() ?? "";
  const relationshipPath = slidePath.replace(
    `/slides/${slideFileName}`,
    `/slides/_rels/${slideFileName}.rels`,
  );
  const xmlText = await readZipText(zip, relationshipPath);
  const relationships = new Map<string, string>();

  if (!xmlText) {
    return relationships;
  }

  const document = parseXml(xmlText);
  const baseDirectory = slidePath.slice(0, slidePath.lastIndexOf("/"));

  for (const relationship of getElementsByLocalName(document, "Relationship")) {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");
    if (!id || !target || target.startsWith("http")) {
      continue;
    }

    relationships.set(id, normalizeZipPath(`${baseDirectory}/${target}`));
  }

  return relationships;
}

async function createPptxSlideHtml(
  zip: JSZip,
  slidePath: string,
  slideSize: PptxSlideSize,
): Promise<string> {
  const xmlText = await readZipText(zip, slidePath);
  if (!xmlText) {
    return "";
  }

  const document = parseXml(xmlText);
  const relationships = await readSlideRelationships(zip, slidePath);
  const slideHeight =
    PPTX_RENDER_WIDTH_PX * (slideSize.height / Math.max(slideSize.width, 1));
  let html = `<section class="pptx-slide" style="width:${PPTX_RENDER_WIDTH_PX}px;height:${slideHeight}px;">`;

  for (const picture of getElementsByLocalName(document, "pic")) {
    const bounds = readPptxBounds(picture);
    const blip = getFirstElementByLocalName(picture, "blip");
    const embedId = blip ? getXmlAttribute(blip, "embed") : null;
    const targetPath = embedId ? relationships.get(embedId) : undefined;
    const imageFile = targetPath ? zip.file(targetPath) : null;

    if (!bounds || !targetPath || !imageFile) {
      continue;
    }

    const imageBuffer = await imageFile.async("arraybuffer");
    html += `<img class="pptx-image" src="data:${getMimeTypeFromPath(
      targetPath,
    )};base64,${arrayBufferToBase64(imageBuffer)}" style="${pptxBoundsToStyle(
      bounds,
      slideSize,
    )}" />`;
  }

  for (const shape of getElementsByLocalName(document, "sp")) {
    const text = getPptxShapeText(shape);
    const bounds = readPptxBounds(shape);
    if (!text || !bounds) {
      continue;
    }

    html += `<div class="pptx-shape" style="${pptxBoundsToStyle(
      bounds,
      slideSize,
    )};${getPptxShapeTextStyle(shape, bounds)}">${escapeHtml(text)}</div>`;
  }

  html += "</section>";
  return html;
}

async function createPptxHtml(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const presentationXml = await readZipText(zip, "ppt/presentation.xml");
  const slideSize = readPptxSlideSize(presentationXml);
  const slideFiles = Object.keys(zip.files)
    .filter((fileName) => /^ppt\/slides\/slide\d+\.xml$/i.test(fileName))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/slide(\d+)\.xml$/i)?.[1] ?? 0);
      const rightNumber = Number(right.match(/slide(\d+)\.xml$/i)?.[1] ?? 0);
      return leftNumber - rightNumber;
    });
  const slides = await Promise.all(
    slideFiles.map((slidePath) =>
      createPptxSlideHtml(zip, slidePath, slideSize),
    ),
  );

  return wrapOfficeHtml(slides.join(""));
}

function excelColorToHex(
  color: Partial<ExcelJS.Color> | undefined,
): string | null {
  if (!color || !("argb" in color) || typeof color.argb !== "string") {
    return null;
  }

  return color.argb.slice(-6);
}

function getExcelCellStyle(cell: ExcelJS.Cell): string {
  const styles: string[] = [];
  const fontColor = excelColorToHex(cell.font?.color);
  const fillColor =
    cell.fill && "fgColor" in cell.fill
      ? excelColorToHex(cell.fill.fgColor)
      : null;

  if (cell.font?.bold) {
    styles.push("font-weight:700");
  }
  if (cell.font?.italic) {
    styles.push("font-style:italic");
  }
  if (cell.font?.size) {
    styles.push(`font-size:${cell.font.size}pt`);
  }
  if (cell.font?.name) {
    styles.push(`font-family:${escapeHtml(cell.font.name)}`);
  }
  if (fontColor) {
    styles.push(`color:#${fontColor}`);
  }
  if (fillColor && fillColor !== "000000") {
    styles.push(`background:#${fillColor}`);
  }
  if (cell.alignment?.horizontal) {
    styles.push(`text-align:${cell.alignment.horizontal}`);
  }
  if (cell.alignment?.vertical) {
    styles.push(`vertical-align:${cell.alignment.vertical}`);
  }

  return styles.join(";");
}

function createXlsxHtml(workbook: ExcelJS.Workbook): string {
  let content = "";

  workbook.eachSheet((worksheet) => {
    const columnCount = Math.min(
      Math.max(worksheet.columnCount, worksheet.actualColumnCount, 1),
      MAX_EXCEL_RENDER_COLUMNS,
    );

    content += `<section class="office-sheet"><h2>${escapeHtml(
      worksheet.name,
    )}</h2><table class="office-sheet-table"><colgroup>`;

    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      const width = worksheet.getColumn(columnIndex).width ?? 12;
      content += `<col style="width:${Math.min(Math.max(width * 7, 64), 220)}px" />`;
    }

    content += "</colgroup><tbody>";

    worksheet.eachRow((row) => {
      content += "<tr>";
      for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
        const cell = row.getCell(columnIndex);
        content += `<td style="${getExcelCellStyle(cell)}">${escapeHtml(
          cell.text,
        )}</td>`;
      }
      content += "</tr>";
    });

    content += "</tbody></table></section>";
  });

  return wrapOfficeHtml(content);
}

async function createDocxHtml(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "table => table.office-word-table:fresh",
      ],
    },
  );

  return wrapOfficeHtml(
    `<article class="office-word">${result.value}</article>`,
  );
}

export function OfficeToPdfTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [progress, setProgress] = useState<string | null>(null);

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
    setProgress(null);

    const ext = selectedFile.name.split(".").pop()?.toLowerCase() as
      | SupportedOfficeExtension
      | undefined;

    try {
      const buffer = await selectedFile.arrayBuffer();
      let htmlContent = "";

      setProgress("Leyendo estructura del documento…");
      if (ext === "docx") {
        htmlContent = await createDocxHtml(buffer);
      } else if (ext === "xlsx") {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        htmlContent = createXlsxHtml(workbook);
      } else if (ext === "pptx") {
        htmlContent = await createPptxHtml(buffer);
      } else {
        throw new Error("Formato Office no soportado.");
      }

      hiddenContainerRef.current.innerHTML = htmlContent;

      const fileName =
        selectedFile.name.replace(/\.(docx|xlsx|pptx)$/i, "") +
        "-convertido.pdf";

      setProgress("Renderizando PDF…");
      const pdfBlob = await html2pdf()
        .set({
          margin: ext === "pptx" ? 4 : 10,
          filename: fileName,
          image: { type: "jpeg" as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation:
              ext === "pptx" ? ("landscape" as const) : ("portrait" as const),
          },
        })
        .from(hiddenContainerRef.current)
        .outputPdf("blob");
      const url = URL.createObjectURL(pdfBlob);

      setDownloadResult({
        url,
        fileName,
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
      emptyDescription="Convierte Word, Excel o PowerPoint a PDF local con mejor conservación visual."
      emptyActionLabel="Seleccionar archivo"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
            {isProcessing ? (
              <Loader2 className="size-16 animate-spin text-brand opacity-80" />
            ) : (
              <FileUp className="size-16 opacity-50 text-brand" />
            )}
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">
                {progress ?? "Listo para convertir a PDF de forma local."}
              </p>
            </div>
            <div
              ref={hiddenContainerRef}
              aria-hidden="true"
              className="pointer-events-none fixed left-[-10000px] top-0 w-[1200px] bg-white text-black"
            />
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="Office a PDF"
      sidebarDescription="Convierte archivos Office a PDF con estilos e imágenes."
      sidebar={
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Word conserva estructura, tablas e imágenes. Excel mantiene hojas,
            columnas y estilos básicos. PowerPoint reconstruye diapositivas con
            texto e imágenes posicionadas.
          </p>
          <p>
            Todo se procesa en tu navegador, por lo que efectos avanzados,
            animaciones o fuentes no disponibles pueden variar.
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
