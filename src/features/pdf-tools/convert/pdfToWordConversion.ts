import type { PDFPageProxy } from "pdfjs-dist";
import { ImageRun, Paragraph, TextRun } from "docx";

import {
  type ExtractedPdfImage,
  extractPageEmbeddedImages,
} from "@/features/pdf-tools/shared/pdfEmbeddedImages";

type PageTextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

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

export function extractPageTextParagraphs(
  textContent: PageTextContent,
): Paragraph[] {
  const positioned = textContent.items.flatMap((item) => {
    if (!("str" in item) || !("transform" in item) || !item.str.trim()) {
      return [];
    }

    return [
      {
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        fontSize: Math.hypot(item.transform[0], item.transform[1]),
      },
    ];
  });

  if (positioned.length === 0) {
    return [];
  }

  positioned.sort((left, right) => {
    const yDiff = right.y - left.y;
    if (Math.abs(yDiff) > 4) {
      return yDiff;
    }
    return left.x - right.x;
  });

  const fontSizes = positioned
    .map((item) => item.fontSize)
    .filter((size) => size > 0)
    .toSorted((a, b) => a - b);
  const bodyFontSize = fontSizes[Math.floor(fontSizes.length / 2)] ?? 12;
  const headingThreshold = bodyFontSize * 1.35;

  const paragraphs: Paragraph[] = [];
  let currentY: number | null = null;
  let currentLine = "";
  let currentLineIsHeading = false;

  function flushLine() {
    const trimmed = currentLine.trim();
    if (!trimmed) {
      return;
    }

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: trimmed,
            bold: currentLineIsHeading,
            size: currentLineIsHeading ? 28 : undefined,
          }),
        ],
        spacing: { after: currentLineIsHeading ? 160 : 120 },
      }),
    );
    currentLine = "";
    currentLineIsHeading = false;
  }

  for (const item of positioned) {
    const lineY = Math.round(item.y / 4) * 4;
    const itemIsHeading = item.fontSize >= headingThreshold;

    if (currentY === null || Math.abs(lineY - currentY) <= 4) {
      currentLine += item.str;
      currentY = lineY;
      currentLineIsHeading = currentLineIsHeading || itemIsHeading;
      continue;
    }

    flushLine();
    currentLine = item.str;
    currentY = lineY;
    currentLineIsHeading = itemIsHeading;
  }

  flushLine();
  return paragraphs;
}

export async function buildEditablePageParagraphs(
  page: PDFPageProxy,
  pageNumber: number,
  totalPages: number,
  paintImageOps: readonly number[],
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];

  if (totalPages > 1) {
    paragraphs.push(
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

  const [textContent, embeddedImages] = await Promise.all([
    page.getTextContent(),
    extractPageEmbeddedImages(page, paintImageOps),
  ]);

  paragraphs.push(...extractPageTextParagraphs(textContent));

  for (const image of embeddedImages) {
    paragraphs.push(createImageParagraph(image));
  }

  return paragraphs;
}
