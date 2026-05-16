import { Paragraph, Table } from "docx";
import { describe, expect, it } from "vitest";

import {
  WORD_IMAGE_MAX_WIDTH_PX,
  buildWordBlocksFromTextContent,
  buildWordBlocksFromTextLines,
  extractPositionedTextLines,
  fitImageDimensions,
  isSimpleTableRun,
  type PositionedTextLine,
} from "./pdfToWordConversion";

function createTextContent(
  items: Array<{
    str: string;
    x: number;
    y: number;
    width?: number;
    fontSize?: number;
  }>,
) {
  return {
    items: items.map((item) => ({
      str: item.str,
      width: item.width ?? item.str.length * 6,
      transform: [
        item.fontSize ?? 12,
        0,
        0,
        item.fontSize ?? 12,
        item.x,
        item.y,
      ],
    })),
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

describe("extractPositionedTextLines", () => {
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
    const lines = extractPositionedTextLines(createTextContent([]));

    expect(lines).toEqual([]);
  });
});

describe("buildWordBlocksFromTextLines", () => {
  it("groups nearby single-column lines into editable paragraphs", () => {
    const blocks = buildWordBlocksFromTextLines([
      createLine("First line", 40, 700),
      createLine("continues here", 40, 686),
      createLine("New paragraph", 40, 650),
    ]);

    expect(blocks).toHaveLength(2);
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
    cells,
    columnXs,
    fontSize: 12,
  };
}
