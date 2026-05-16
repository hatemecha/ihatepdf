import { ImageRun, Paragraph, Table } from "docx";
import { describe, expect, it } from "vitest";

import {
  WORD_IMAGE_MAX_WIDTH_PX,
  buildPageLayout,
  buildWordBlocksFromTextContent,
  buildWordBlocksFromTextLines,
  createPositionedImageRun,
  extractPositionedTextItems,
  extractPositionedTextLines,
  fitImageDimensions,
  groupTextItemsIntoLines,
  isSimpleTableRun,
  pdfPointToTwip,
  type PositionedImage,
  type PositionedTextLine,
} from "./pdfToWordConversion";

function createTextContent(
  items: Array<{
    str: string;
    x: number;
    y: number;
    width?: number;
    fontSize?: number;
    fontName?: string;
    fontFamily?: string;
  }>,
) {
  const styles = Object.fromEntries(
    items.map((item) => {
      const fontName = item.fontName ?? "Arial-Regular";
      return [
        fontName,
        {
          ascent: 0.8,
          descent: -0.2,
          vertical: false,
          fontFamily: item.fontFamily ?? "Arial",
        },
      ];
    }),
  );

  return {
    items: items.map((item) => {
      const fontSize = item.fontSize ?? 12;
      return {
        str: item.str,
        dir: "ltr",
        width: item.width ?? item.str.length * fontSize * 0.5,
        height: fontSize,
        fontName: item.fontName ?? "Arial-Regular",
        hasEOL: false,
        transform: [fontSize, 0, 0, fontSize, item.x, item.y],
      };
    }),
    styles,
    lang: null,
  } as never;
}

describe("fitImageDimensions", () => {
  it("scales wide images down to the Word content width", () => {
    expect(fitImageDimensions(1248, 1754)).toEqual({
      width: WORD_IMAGE_MAX_WIDTH_PX,
      height: Math.round((1754 * WORD_IMAGE_MAX_WIDTH_PX) / 1248),
    });
  });

  it("keeps small images at their original size", () => {
    expect(fitImageDimensions(400, 300)).toEqual({ width: 400, height: 300 });
  });
});

describe("extractPositionedTextItems", () => {
  it("preserves font size and infers bold and italic from font identity", () => {
    const [item] = extractPositionedTextItems(
      createTextContent([
        {
          str: "Heading",
          x: 40,
          y: 700,
          fontSize: 18,
          fontName: "MyFont-BoldItalic",
          fontFamily: "Inter Bold Italic",
        },
      ]),
    );

    expect(item).toMatchObject({
      text: "Heading",
      fontSize: 18,
      fontFamily: "Inter Bold Italic",
      bold: true,
      italic: true,
    });
  });
});

describe("groupTextItemsIntoLines", () => {
  it("orders lines top-to-bottom and fragments left-to-right", () => {
    const lines = extractPositionedTextLines(
      createTextContent([
        { str: "world", x: 80, y: 700 },
        { str: "Second", x: 20, y: 680 },
        { str: "Hello", x: 20, y: 700 },
      ]),
    );

    expect(lines.map((line) => line.text)).toEqual(["Hello world", "Second"]);
  });

  it("returns no lines for pages without selectable text", () => {
    const lines = groupTextItemsIntoLines([]);

    expect(lines).toEqual([]);
  });
});

describe("buildWordBlocksFromTextLines", () => {
  it("keeps nearby single-column lines as separate editable paragraphs", () => {
    const blocks = buildWordBlocksFromTextLines([
      createLine("First line", 40, 700),
      createLine("continues here", 40, 686),
      createLine("New paragraph", 40, 650),
    ]);

    expect(blocks).toHaveLength(3);
    expect(blocks.every((block) => block instanceof Paragraph)).toBe(true);
  });

  it("detects simple table rows with stable columns", () => {
    const lines = [
      createLine("Name Total", 40, 700, ["Name", "Total"], [40, 220]),
      createLine("Alice 10", 40, 680, ["Alice", "10"], [42, 218]),
      createLine("Bob 20", 40, 660, ["Bob", "20"], [41, 221]),
    ];

    expect(isSimpleTableRun(lines)).toBe(true);
    expect(buildWordBlocksFromTextLines(lines)[0]).toBeInstanceOf(Table);
  });

  it("creates no blocks for pages without lines", () => {
    expect(buildWordBlocksFromTextContent(createTextContent([]))).toEqual([]);
  });
});

describe("buildPageLayout", () => {
  it("keeps simple columns in column reading order instead of interleaving rows", () => {
    const layout = buildPageLayout(
      createTextContent([
        { str: "Right top", x: 340, y: 700 },
        { str: "Left bottom", x: 40, y: 680 },
        { str: "Right bottom", x: 340, y: 680 },
        { str: "Left top", x: 40, y: 700 },
      ]),
      { width: 600, height: 800 },
    );

    expect(layout.lines.map((line) => line.text)).toEqual([
      "Left top",
      "Left bottom",
      "Right top",
      "Right bottom",
    ]);
  });

  it("adds fallback image blocks when an image has no PDF bounds", () => {
    const layout = buildPageLayout(
      createTextContent([]),
      { width: 600, height: 800 },
      [createImage()],
    );

    expect(layout.blocks).toHaveLength(1);
    expect(layout.blocks[0]).toBeInstanceOf(Paragraph);
  });
});

describe("coordinates and image placement", () => {
  it("converts PDF points to Word twips", () => {
    expect(pdfPointToTwip(72)).toBe(1440);
  });

  it("creates positioned and fallback image runs", () => {
    expect(
      createPositionedImageRun(
        createImage({
          bounds: { x: 72, y: 144, width: 216, height: 72 },
        }),
        792,
      ),
    ).toBeInstanceOf(ImageRun);
    expect(createPositionedImageRun(createImage(), 792)).toBeInstanceOf(
      ImageRun,
    );
  });
});

function createLine(
  text: string,
  x: number,
  y: number,
  cells: string[] = [text],
  columnXs: number[] = [x],
): PositionedTextLine {
  return {
    text,
    x,
    y,
    width: text.length * 6,
    height: 12,
    cells,
    columnXs,
    fontSize: 12,
    runs: [
      {
        text,
        fontSize: 12,
        bold: false,
        italic: false,
      },
    ],
  };
}

function createImage(
  overrides: Partial<PositionedImage> = {},
): PositionedImage {
  return {
    data: new Uint8Array([1, 2, 3]),
    width: 300,
    height: 150,
    type: "png",
    ...overrides,
  };
}
