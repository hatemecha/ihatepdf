import { describe, expect, it } from "vitest";

import {
  formatPageRangeHint,
  parsePageOrder,
  parsePageRange,
} from "./pageRanges";

describe("pageRanges", () => {
  it("parses all pages from empty, all or todo", () => {
    expect(parsePageRange("", 3).pages).toEqual([0, 1, 2]);
    expect(parsePageRange("all", 2).pages).toEqual([0, 1]);
    expect(parsePageRange("todo", 2).pages).toEqual([0, 1]);
  });

  it("parses comma-separated pages and ranges", () => {
    const result = parsePageRange("1, 3-5, 2", 5);

    expect(result.isValid).toBe(true);
    expect(result.pages).toEqual([0, 1, 2, 3, 4]);
  });

  it("rejects inverted and out-of-bounds ranges", () => {
    expect(parsePageRange("4-2", 5).error).toBe("El rango 4-2 esta invertido.");
    expect(parsePageRange("1-9", 5).error).toBe(
      "El rango 1-9 esta fuera del PDF.",
    );
  });

  it("parses a full page order", () => {
    const result = parsePageOrder("3,1,2", 3);

    expect(result.isValid).toBe(true);
    expect(result.pages).toEqual([2, 0, 1]);
  });

  it("requires page order to include each page exactly once", () => {
    expect(parsePageOrder("1,2", 3).error).toBe(
      "El orden debe incluir las 3 paginas.",
    );
    expect(parsePageOrder("1,1,2", 3).error).toBe("La pagina 1 esta repetida.");
  });

  it("formats a helpful full-range hint", () => {
    expect(formatPageRangeHint(1)).toBe("1");
    expect(formatPageRangeHint(8)).toBe("1-8");
  });
});
