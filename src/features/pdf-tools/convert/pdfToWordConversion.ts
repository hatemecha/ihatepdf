import type { PDFPageProxy } from "pdfjs-dist";
import {
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import {
  type ExtractedPdfImage,
  extractPageEmbeddedImages,
} from "@/features/pdf-tools/shared/pdfEmbeddedImages";

type PageTextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

export interface PositionedTextLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  cells: string[];
  columnXs: number[];
}

export type WordBlock = Paragraph | Table;

const LINE_Y_TOLERANCE = 4;
const TABLE_COLUMN_TOLERANCE = 18;

/** Ancho útil en Word (~6.5 in a 96 dpi). */
export const WORD_IMAGE_MAX_WIDTH_PX = 624;

export function fitImageDimensions(
  width: number,
  height: number,
  maxWidth: number = WORD_IMAGE_MAX_WIDTH_PX,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(maxWidth / width, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function estimateTextEndX(item: {
  str: string;
  x: number;
  width?: number;
  fontSize: number;
}): number {
  return (
    item.x +
    (item.width && item.width > 0
      ? item.width
      : item.str.length * item.fontSize * 0.5)
  );
}

export function extractPositionedTextLines(
  textContent: PageTextContent,
): PositionedTextLine[] {
  const positionedItems = textContent.items.flatMap((item) => {
    if (!("str" in item) || !("transform" in item) || !item.str.trim()) {
      return [];
    }

    const transform = item.transform;
    const fontSize = Math.max(1, Math.hypot(transform[0], transform[1]));

    return [
      {
        str: item.str.trim(),
        x: transform[4],
        y: transform[5],
        width:
          "width" in item && typeof item.width === "number"
            ? item.width
            : undefined,
        fontSize,
      },
    ];
  });

  if (positionedItems.length === 0) {
    return [];
  }

  positionedItems.sort((left, right) => {
    const yDiff = right.y - left.y;
    if (Math.abs(yDiff) > LINE_Y_TOLERANCE) {
      return yDiff;
    }
    return left.x - right.x;
  });

  const lines: PositionedTextLine[] = [];
  let currentItems: typeof positionedItems = [];
  let currentY: number | null = null;

  function flushLine() {
    if (currentItems.length === 0) {
      return;
    }

    currentItems.sort((left, right) => left.x - right.x);

    const parts: string[] = [];
    const columnXs: number[] = [];
    let lastEndX: number | null = null;

    for (const item of currentItems) {
      if (lastEndX !== null && item.x - lastEndX > item.fontSize * 0.3) {
        parts.push(" ");
      }
      parts.push(item.str);
      columnXs.push(item.x);
      lastEndX = estimateTextEndX(item);
    }

    const fontSizes = currentItems
      .map((item) => item.fontSize)
      .toSorted((a, b) => a - b);
    const text = parts.join("").replace(/\s+/g, " ").trim();

    if (text) {
      lines.push({
        text,
        x: currentItems[0].x,
        y:
          currentItems.reduce((sum, item) => sum + item.y, 0) /
          currentItems.length,
        fontSize: fontSizes[Math.floor(fontSizes.length / 2)] ?? 12,
        cells: currentItems.map((item) => item.str),
        columnXs,
      });
    }

    currentItems = [];
  }

  for (const item of positionedItems) {
    if (currentY === null || Math.abs(item.y - currentY) <= LINE_Y_TOLERANCE) {
      currentItems.push(item);
      currentY = currentY === null ? item.y : (currentY + item.y) / 2;
      continue;
    }

    flushLine();
    currentItems = [item];
    currentY = item.y;
  }

  flushLine();
  return lines;
}

function hasCompatibleColumns(
  referenceColumns: readonly number[],
  nextColumns: readonly number[],
): boolean {
  if (
    referenceColumns.length < 2 ||
    nextColumns.length !== referenceColumns.length
  ) {
    return false;
  }

  for (let index = 0; index < referenceColumns.length; index += 1) {
    if (
      Math.abs(referenceColumns[index] - nextColumns[index]) >
      TABLE_COLUMN_TOLERANCE
    ) {
      return false;
    }
  }

  return true;
}

export function isSimpleTableRun(
  lines: readonly PositionedTextLine[],
): boolean {
  if (lines.length < 2 || lines[0].columnXs.length < 2) {
    return false;
  }

  const referenceColumns = lines[0].columnXs;
  return (
    lines.length > 0 &&
    lines.every((line) => hasCompatibleColumns(referenceColumns, line.columnXs))
  );
}

function createTable(lines: readonly PositionedTextLine[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: lines.map(
      (line) =>
        new TableRow({
          children: line.cells.map(
            (cellText) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: cellText })],
                  }),
                ],
              }),
          ),
        }),
    ),
  });
}

function createParagraphFromLines(
  lines: readonly PositionedTextLine[],
): Paragraph {
  const fontSizes = lines
    .map((line) => line.fontSize)
    .toSorted((a, b) => a - b);
  const bodyFontSize = fontSizes[Math.floor(fontSizes.length / 2)] ?? 12;
  const isHeading =
    lines.length === 1 && lines[0].fontSize >= bodyFontSize * 1.25;

  return new Paragraph({
    children: [
      new TextRun({
        text: lines.map((line) => line.text).join(" "),
        bold: isHeading,
        size: isHeading ? 28 : undefined,
      }),
    ],
    spacing: { after: isHeading ? 160 : 120 },
  });
}

export function buildWordBlocksFromTextLines(
  lines: readonly PositionedTextLine[],
): WordBlock[] {
  const blocks: WordBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const tableRun = [lines[index]];
    let nextIndex = index + 1;

    while (
      nextIndex < lines.length &&
      hasCompatibleColumns(tableRun[0].columnXs, lines[nextIndex].columnXs)
    ) {
      tableRun.push(lines[nextIndex]);
      nextIndex += 1;
    }

    if (isSimpleTableRun(tableRun)) {
      blocks.push(createTable(tableRun));
      index = nextIndex;
      continue;
    }

    const paragraphRun = [lines[index]];
    nextIndex = index + 1;

    while (nextIndex < lines.length) {
      const previous = lines[nextIndex - 1];
      const next = lines[nextIndex];
      const verticalGap = Math.abs(previous.y - next.y);
      const maxFontSize = Math.max(previous.fontSize, next.fontSize);
      const indentChanged = Math.abs(previous.x - next.x) > 24;
      const likelyNewParagraph =
        verticalGap > maxFontSize * 1.6 || indentChanged;

      if (likelyNewParagraph || next.columnXs.length > 1) {
        break;
      }

      paragraphRun.push(next);
      nextIndex += 1;
    }

    blocks.push(createParagraphFromLines(paragraphRun));
    index = nextIndex;
  }

  return blocks;
}

function createImageParagraph(image: ExtractedPdfImage): Paragraph {
  return new Paragraph({
    children: [
      new ImageRun({
        type: image.type,
        data: image.data,
        transformation: fitImageDimensions(image.width, image.height),
      }),
    ],
    spacing: { before: 120, after: 240 },
  });
}

export function buildWordBlocksFromTextContent(
  textContent: PageTextContent,
): WordBlock[] {
  return buildWordBlocksFromTextLines(extractPositionedTextLines(textContent));
}

export async function buildEditablePageBlocks(
  page: PDFPageProxy,
  pageNumber: number,
  totalPages: number,
  paintImageOps: readonly number[],
): Promise<WordBlock[]> {
  const [textContent, embeddedImagesResult] = await Promise.allSettled([
    page.getTextContent(),
    extractPageEmbeddedImages(page, paintImageOps),
  ]);

  if (textContent.status === "rejected") {
    throw new Error(
      "No se pudo leer el texto del PDF. Verifica que el archivo no esté protegido o dañado.",
    );
  }

  const blocks = buildWordBlocksFromTextContent(textContent.value);
  const embeddedImages =
    embeddedImagesResult.status === "fulfilled"
      ? embeddedImagesResult.value
      : [];

  blocks.push(...embeddedImages.map(createImageParagraph));

  if (blocks.length === 0) {
    return [];
  }

  if (totalPages > 1) {
    blocks.unshift(
      new Paragraph({
        children: [
          new TextRun({
            text: `Página ${pageNumber}`,
            bold: true,
            size: 24,
          }),
        ],
        spacing: { before: pageNumber === 1 ? 0 : 240, after: 160 },
      }),
    );
  }

  return blocks;
}
