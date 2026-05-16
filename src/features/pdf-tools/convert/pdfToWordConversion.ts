import type { PDFPageProxy } from "pdfjs-dist";
import {
  HorizontalPositionRelativeFrom,
  ImageRun,
  PageOrientation,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  TextWrappingSide,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  WidthType,
  type ISectionOptions,
} from "docx";

import {
  type PdfImageBounds,
  type PdfImageExtractionOperators,
  extractPageEmbeddedImages,
} from "@/features/pdf-tools/shared/pdfEmbeddedImages";

type PageTextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

interface PositionedTextRun {
  text: string;
  fontSize: number;
  fontName?: string;
  fontFamily?: string;
  bold: boolean;
  italic: boolean;
}

export interface PositionedTextItem extends PositionedTextRun {
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
  endX: number;
}

export interface PositionedTextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  runs: PositionedTextRun[];
  cells: string[];
  columnXs: number[];
  columnIndex?: number;
}

export interface PositionedImage {
  data: Uint8Array;
  width: number;
  height: number;
  type: "png";
  bounds?: PdfImageBounds;
}

export interface ConvertedPageLayout {
  width: number;
  height: number;
  lines: PositionedTextLine[];
  images: PositionedImage[];
  blocks: WordBlock[];
}

export interface ConvertedPageSection {
  section: ISectionOptions;
  hasContent: boolean;
  layout: ConvertedPageLayout;
}

export type WordBlock = Paragraph | Table;

const LINE_Y_TOLERANCE = 4;
const TABLE_COLUMN_TOLERANCE = 18;
const MIN_TABLE_CELL_GAP_PT = 24;
const COLUMN_CLUSTER_TOLERANCE_PT = 56;
const POINTS_TO_TWIPS = 20;
const POINTS_TO_PIXELS = 96 / 72;
const POINTS_TO_EMUS = 12700;

/** Ancho útil en Word (~6.5 in a 96 dpi). */
export const WORD_IMAGE_MAX_WIDTH_PX = 624;

export function pdfPointToTwip(value: number): number {
  return Math.round(value * POINTS_TO_TWIPS);
}

function pdfPointToPixel(value: number): number {
  return Math.max(1, Math.round(value * POINTS_TO_PIXELS));
}

function pdfPointToEmu(value: number): number {
  return Math.max(0, Math.round(value * POINTS_TO_EMUS));
}

function toRunSize(fontSize: number): number {
  return Math.max(2, Math.min(192, Math.round(fontSize * 2)));
}

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

function isTextContentItem(
  item: PageTextContent["items"][number],
): item is PageTextContent["items"][number] & {
  str: string;
  transform: unknown[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
} {
  return (
    "str" in item &&
    "transform" in item &&
    Array.isArray(item.transform) &&
    item.transform.length >= 6 &&
    typeof item.str === "string"
  );
}

function normalizeFontFamily(
  fontFamily: string | undefined,
): string | undefined {
  if (!fontFamily) {
    return undefined;
  }

  const primaryFont = fontFamily.split(",")[0]?.replace(/["']/g, "").trim();

  if (
    !primaryFont ||
    /^(serif|sans-serif|monospace|fantasy|cursive)$/i.test(primaryFont)
  ) {
    return undefined;
  }

  return primaryFont;
}

function inferFontFlags(
  fontName: string | undefined,
  fontFamily: string | undefined,
) {
  const fontIdentity = `${fontName ?? ""} ${fontFamily ?? ""}`;

  return {
    bold: /(bold|black|heavy|semibold|semi-bold|demi|extrabold|extra-bold)/i.test(
      fontIdentity,
    ),
    italic: /(italic|oblique|kursiv)/i.test(fontIdentity),
  };
}

function getMedian(values: readonly number[]): number {
  if (values.length === 0) {
    return 12;
  }

  const sortedValues = values.toSorted((left, right) => left - right);
  return sortedValues[Math.floor(sortedValues.length / 2)] ?? 12;
}

function estimateTextEndX(item: {
  text: string;
  x: number;
  width?: number;
  fontSize: number;
}): number {
  return (
    item.x +
    (item.width && item.width > 0
      ? item.width
      : item.text.length * item.fontSize * 0.5)
  );
}

export function extractPositionedTextItems(
  textContent: PageTextContent,
): PositionedTextItem[] {
  return textContent.items.flatMap((item) => {
    if (!isTextContentItem(item) || !item.str.trim()) {
      return [];
    }

    const transform = item.transform.slice(0, 6).map(Number);
    if (transform.some((entry) => !Number.isFinite(entry))) {
      return [];
    }

    const text = item.str.replace(/\s+/g, " ").trim();
    const transformFontSize = Math.max(
      Math.hypot(transform[2] ?? 0, transform[3] ?? 0),
      Math.hypot(transform[0] ?? 0, transform[1] ?? 0),
      1,
    );
    const height =
      typeof item.height === "number" && item.height > 0
        ? item.height
        : transformFontSize;
    const width =
      typeof item.width === "number" && item.width > 0
        ? item.width
        : text.length * transformFontSize * 0.5;
    const fontSize = Math.max(1, Math.min(96, height || transformFontSize));
    const fontName =
      typeof item.fontName === "string" ? item.fontName : undefined;
    const fontFamily = normalizeFontFamily(
      fontName ? textContent.styles[fontName]?.fontFamily : undefined,
    );
    const fontFlags = inferFontFlags(fontName, fontFamily);
    const positionedItem: PositionedTextItem = {
      text,
      x: transform[4] ?? 0,
      y: transform[5] ?? 0,
      width,
      height,
      endX: estimateTextEndX({
        text,
        x: transform[4] ?? 0,
        width,
        fontSize,
      }),
      fontSize,
      fontName,
      fontFamily,
      hasEOL: Boolean(item.hasEOL),
      ...fontFlags,
    };

    return [positionedItem];
  });
}

function shouldStartNewLine(
  item: PositionedTextItem,
  currentY: number | null,
): boolean {
  return currentY !== null && Math.abs(item.y - currentY) > LINE_Y_TOLERANCE;
}

function createSpaceRun(reference: PositionedTextItem): PositionedTextRun {
  return {
    text: " ",
    fontSize: reference.fontSize,
    fontName: reference.fontName,
    fontFamily: reference.fontFamily,
    bold: false,
    italic: false,
  };
}

function createLineFromItems(
  items: readonly PositionedTextItem[],
): PositionedTextLine | null {
  if (items.length === 0) {
    return null;
  }

  const sortedItems = items.toSorted((left, right) => left.x - right.x);
  const runs: PositionedTextRun[] = [];
  const cells: string[] = [];
  const columnXs: number[] = [];
  let currentCellParts: string[] = [];
  let lastEndX: number | null = null;

  function flushCell() {
    const cellText = currentCellParts.join("").replace(/\s+/g, " ").trim();
    if (cellText) {
      cells.push(cellText);
    }
    currentCellParts = [];
  }

  for (const item of sortedItems) {
    const gap = lastEndX === null ? 0 : item.x - lastEndX;
    const startsNewCell =
      lastEndX !== null &&
      gap > Math.max(MIN_TABLE_CELL_GAP_PT, item.fontSize * 2);
    const needsSpace =
      lastEndX !== null &&
      (startsNewCell || gap > Math.max(item.fontSize * 0.2, 1.5));

    if (startsNewCell) {
      flushCell();
      columnXs.push(item.x);
    } else if (columnXs.length === 0) {
      columnXs.push(item.x);
    }

    if (needsSpace) {
      runs.push(createSpaceRun(item));
      currentCellParts.push(" ");
    }

    runs.push(item);
    currentCellParts.push(item.text);
    lastEndX = item.endX;
  }

  flushCell();

  const minX = Math.min(...sortedItems.map((item) => item.x));
  const maxEndX = Math.max(...sortedItems.map((item) => item.endX));
  const fontSize = getMedian(sortedItems.map((item) => item.fontSize));
  const text = runs
    .map((run) => run.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return null;
  }

  return {
    text,
    x: minX,
    y: sortedItems.reduce((sum, item) => sum + item.y, 0) / sortedItems.length,
    width: maxEndX - minX,
    height: Math.max(...sortedItems.map((item) => item.height), fontSize),
    fontSize,
    runs,
    cells,
    columnXs,
  };
}

export function groupTextItemsIntoLines(
  positionedItems: readonly PositionedTextItem[],
): PositionedTextLine[] {
  if (positionedItems.length === 0) {
    return [];
  }

  const sortedItems = positionedItems.toSorted((left, right) => {
    const yDiff = right.y - left.y;
    if (Math.abs(yDiff) > LINE_Y_TOLERANCE) {
      return yDiff;
    }
    return left.x - right.x;
  });

  const lines: PositionedTextLine[] = [];
  let currentItems: PositionedTextItem[] = [];
  let currentY: number | null = null;

  function flushLine() {
    const line = createLineFromItems(currentItems);
    if (line) {
      lines.push(line);
    }
    currentItems = [];
  }

  for (const item of sortedItems) {
    if (!shouldStartNewLine(item, currentY)) {
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

export function extractPositionedTextLines(
  textContent: PageTextContent,
): PositionedTextLine[] {
  return groupTextItemsIntoLines(extractPositionedTextItems(textContent));
}

function clusterLinesIntoColumns(
  lines: readonly PositionedTextLine[],
  pageWidth: number,
): PositionedTextLine[] {
  if (lines.length < 4) {
    return lines.toSorted(
      (left, right) => right.y - left.y || left.x - right.x,
    );
  }

  const clusters: Array<{ x: number; lines: PositionedTextLine[] }> = [];
  const clustersByBucket = new Map<
    number,
    Array<{ x: number; lines: PositionedTextLine[] }>
  >();
  const xTolerance = Math.max(COLUMN_CLUSTER_TOLERANCE_PT, pageWidth * 0.08);
  const bucketSize = Math.max(1, xTolerance);

  for (const line of lines.toSorted((left, right) => left.x - right.x)) {
    const bucket = Math.floor(line.x / bucketSize);
    let cluster: { x: number; lines: PositionedTextLine[] } | undefined;

    for (
      let bucketOffset = -1;
      bucketOffset <= 1 && !cluster;
      bucketOffset += 1
    ) {
      const bucketClusters = clustersByBucket.get(bucket + bucketOffset) ?? [];
      for (const candidate of bucketClusters) {
        if (Math.abs(candidate.x - line.x) <= xTolerance) {
          cluster = candidate;
          break;
        }
      }
    }

    if (cluster) {
      const previousBucket = Math.floor(cluster.x / bucketSize);
      cluster.lines.push(line);
      cluster.x =
        cluster.lines.reduce((sum, clusterLine) => sum + clusterLine.x, 0) /
        cluster.lines.length;
      const nextBucket = Math.floor(cluster.x / bucketSize);
      if (previousBucket !== nextBucket) {
        clustersByBucket.set(
          previousBucket,
          (clustersByBucket.get(previousBucket) ?? []).filter(
            (candidate) => candidate !== cluster,
          ),
        );
        clustersByBucket.set(nextBucket, [
          ...(clustersByBucket.get(nextBucket) ?? []),
          cluster,
        ]);
      }
    } else {
      const newCluster = { x: line.x, lines: [line] };
      clusters.push(newCluster);
      clustersByBucket.set(bucket, [
        ...(clustersByBucket.get(bucket) ?? []),
        newCluster,
      ]);
    }
  }

  if (
    clusters.length < 2 ||
    clusters.some((cluster) => cluster.lines.length < 2)
  ) {
    return lines.toSorted(
      (left, right) => right.y - left.y || left.x - right.x,
    );
  }

  const sortedClusters = clusters.toSorted((left, right) => left.x - right.x);
  const separatedClusters = sortedClusters.every((cluster, index) => {
    if (index === 0) {
      return true;
    }

    return cluster.x - sortedClusters[index - 1].x > pageWidth * 0.2;
  });

  if (!separatedClusters) {
    return lines.toSorted(
      (left, right) => right.y - left.y || left.x - right.x,
    );
  }

  return sortedClusters.flatMap((cluster, columnIndex) =>
    cluster.lines
      .map((line) => ({ ...line, columnIndex }))
      .toSorted((left, right) => right.y - left.y || left.x - right.x),
  );
}

function splitWideColumnLines(
  lines: readonly PositionedTextLine[],
  pageWidth: number,
): PositionedTextLine[] {
  return lines.flatMap((line) => {
    if (
      line.cells.length < 2 ||
      line.cells.length !== line.columnXs.length ||
      line.columnXs[1] - line.columnXs[0] <= pageWidth * 0.35
    ) {
      return [line];
    }

    const referenceRun =
      line.runs.find((run) => run.text.trim()) ?? line.runs[0];

    return line.cells.map((cell, index) => ({
      ...line,
      text: cell,
      x: line.columnXs[index],
      width:
        index + 1 < line.columnXs.length
          ? line.columnXs[index + 1] - line.columnXs[index]
          : Math.max(
              line.width / line.cells.length,
              cell.length * line.fontSize * 0.5,
            ),
      runs: [
        {
          text: cell,
          fontSize: referenceRun?.fontSize ?? line.fontSize,
          fontName: referenceRun?.fontName,
          fontFamily: referenceRun?.fontFamily,
          bold: referenceRun?.bold ?? false,
          italic: referenceRun?.italic ?? false,
        },
      ],
      cells: [cell],
      columnXs: [line.columnXs[index]],
      columnIndex: index,
    }));
  });
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
  if (
    lines.length < 2 ||
    lines[0].columnXs.length < 2 ||
    lines[0].columnXs.length > 8
  ) {
    return false;
  }

  const referenceColumns = lines[0].columnXs;
  return lines.every((line) =>
    hasCompatibleColumns(referenceColumns, line.columnXs),
  );
}

function createTable(lines: readonly PositionedTextLine[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: lines.map(
      (line) =>
        new TableRow({
          children: line.cells.map(
            (cellText) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cellText,
                        size: toRunSize(line.fontSize),
                      }),
                    ],
                  }),
                ],
              }),
          ),
        }),
    ),
  });
}

function lineTopFromPage(
  line: PositionedTextLine,
  pageHeight?: number,
): number {
  if (!pageHeight) {
    return 0;
  }

  return Math.max(0, pageHeight - line.y - line.height);
}

function calculateSpacingBefore(
  line: PositionedTextLine,
  previousLine: PositionedTextLine | null,
  pageHeight?: number,
): number {
  if (!pageHeight) {
    if (!previousLine) {
      return 0;
    }

    return pdfPointToTwip(
      Math.max(0, Math.abs(previousLine.y - line.y) - previousLine.height),
    );
  }

  const lineTop = lineTopFromPage(line, pageHeight);
  if (!previousLine) {
    return pdfPointToTwip(lineTop);
  }

  const previousBottom =
    lineTopFromPage(previousLine, pageHeight) + previousLine.height;
  return pdfPointToTwip(Math.max(0, lineTop - previousBottom));
}

function createTextRun(run: PositionedTextRun): TextRun {
  return new TextRun({
    text: run.text,
    size: toRunSize(run.fontSize),
    font: run.fontFamily,
    bold: run.bold || undefined,
    italics: run.italic || undefined,
  });
}

function createParagraphFromLine(
  line: PositionedTextLine,
  previousLine: PositionedTextLine | null,
  pageHeight?: number,
): Paragraph {
  return new Paragraph({
    children: line.runs.map(createTextRun),
    indent: { left: pdfPointToTwip(Math.max(0, line.x)) },
    spacing: {
      before: calculateSpacingBefore(line, previousLine, pageHeight),
      after: 0,
    },
  });
}

export function buildWordBlocksFromTextLines(
  lines: readonly PositionedTextLine[],
  pageHeight?: number,
): WordBlock[] {
  const blocks: WordBlock[] = [];
  let index = 0;
  let previousLine: PositionedTextLine | null = null;

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
      previousLine = tableRun[tableRun.length - 1];
      index = nextIndex;
      continue;
    }

    blocks.push(
      createParagraphFromLine(lines[index], previousLine, pageHeight),
    );
    previousLine = lines[index];
    index += 1;
  }

  return blocks;
}

function createImageParagraph(
  image: PositionedImage,
  pageHeight: number,
): Paragraph {
  return new Paragraph({
    children: [createPositionedImageRun(image, pageHeight)],
    spacing: {
      before: image.bounds ? 0 : 120,
      after: image.bounds ? 0 : 240,
    },
  });
}

export function createPositionedImageRun(
  image: PositionedImage,
  pageHeight?: number,
): ImageRun {
  if (image.bounds && pageHeight) {
    const top = Math.max(0, pageHeight - image.bounds.y - image.bounds.height);

    return new ImageRun({
      type: image.type,
      data: image.data,
      transformation: {
        width: pdfPointToPixel(image.bounds.width),
        height: pdfPointToPixel(image.bounds.height),
      },
      floating: {
        horizontalPosition: {
          relative: HorizontalPositionRelativeFrom.PAGE,
          offset: pdfPointToEmu(image.bounds.x),
        },
        verticalPosition: {
          relative: VerticalPositionRelativeFrom.PAGE,
          offset: pdfPointToEmu(top),
        },
        allowOverlap: true,
        layoutInCell: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        wrap: {
          type: TextWrappingType.SQUARE,
          side: TextWrappingSide.BOTH_SIDES,
        },
      },
    });
  }

  return new ImageRun({
    type: image.type,
    data: image.data,
    transformation: fitImageDimensions(image.width, image.height),
  });
}

function buildWordBlocksFromPageLayout(
  layout: ConvertedPageLayout,
): WordBlock[] {
  const textBlocks = buildWordBlocksFromTextLines(layout.lines, layout.height);
  const positionedImageBlocks: Paragraph[] = [];
  const fallbackImageBlocks: Paragraph[] = [];

  for (const image of layout.images) {
    const imageBlock = createImageParagraph(image, layout.height);
    if (image.bounds) {
      positionedImageBlocks.push(imageBlock);
    } else {
      fallbackImageBlocks.push(imageBlock);
    }
  }

  return [...positionedImageBlocks, ...textBlocks, ...fallbackImageBlocks];
}

export function buildPageLayout(
  textContent: PageTextContent,
  pageSize: { width: number; height: number },
  images: readonly PositionedImage[] = [],
): ConvertedPageLayout {
  const rawLines = groupTextItemsIntoLines(
    extractPositionedTextItems(textContent),
  );
  const lines = clusterLinesIntoColumns(
    splitWideColumnLines(rawLines, pageSize.width),
    pageSize.width,
  );
  const layoutWithoutBlocks: ConvertedPageLayout = {
    width: pageSize.width,
    height: pageSize.height,
    lines,
    images: [...images],
    blocks: [],
  };

  return {
    ...layoutWithoutBlocks,
    blocks: buildWordBlocksFromPageLayout(layoutWithoutBlocks),
  };
}

export function buildWordBlocksFromTextContent(
  textContent: PageTextContent,
): WordBlock[] {
  return buildWordBlocksFromTextLines(extractPositionedTextLines(textContent));
}

export async function buildEditablePageSection(
  page: PDFPageProxy,
  pageNumber: number,
  imageOperators: readonly number[] | PdfImageExtractionOperators,
): Promise<ConvertedPageSection> {
  const viewport = page.getViewport({ scale: 1 });
  const pageSize = {
    width: viewport.width,
    height: viewport.height,
  };
  const [textContent, embeddedImagesResult] = await Promise.allSettled([
    page.getTextContent(),
    extractPageEmbeddedImages(page, imageOperators),
  ]);

  if (textContent.status === "rejected") {
    throw new Error(
      "No se pudo leer el texto del PDF. Verifica que el archivo no esté protegido o dañado.",
    );
  }

  const embeddedImages =
    embeddedImagesResult.status === "fulfilled"
      ? embeddedImagesResult.value
      : [];
  const layout = buildPageLayout(textContent.value, pageSize, embeddedImages);
  const hasContent = layout.lines.length > 0 || layout.images.length > 0;

  return {
    section: {
      properties: {
        ...(pageNumber > 1 ? { type: SectionType.NEXT_PAGE } : {}),
        page: {
          size: {
            width: pdfPointToTwip(pageSize.width),
            height: pdfPointToTwip(pageSize.height),
            orientation:
              pageSize.width > pageSize.height
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
          },
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            header: 0,
            footer: 0,
          },
        },
      },
      children: layout.blocks.length > 0 ? layout.blocks : [new Paragraph({})],
    },
    hasContent,
    layout,
  };
}

export async function buildEditablePageBlocks(
  page: PDFPageProxy,
  pageNumber: number,
  totalPages: number,
  imageOperators: readonly number[] | PdfImageExtractionOperators,
): Promise<WordBlock[]> {
  const convertedSection = await buildEditablePageSection(
    page,
    pageNumber,
    imageOperators,
  );
  const blocks = convertedSection.layout.blocks;

  if (blocks.length === 0) {
    return [];
  }

  if (totalPages > 1) {
    return [
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
      ...blocks,
    ];
  }

  return blocks;
}
