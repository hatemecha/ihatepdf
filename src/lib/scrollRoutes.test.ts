import { describe, expect, it } from "vitest";

import { shouldUseSmoothPageScroll } from "./scrollRoutes";

describe("scrollRoutes", () => {
  it("uses smooth page scroll for marketing pages only", () => {
    expect(shouldUseSmoothPageScroll("/")).toBe(true);
    expect(shouldUseSmoothPageScroll("/about")).toBe(true);
    expect(shouldUseSmoothPageScroll("/herramientas/unir-pdf")).toBe(false);
  });
});
