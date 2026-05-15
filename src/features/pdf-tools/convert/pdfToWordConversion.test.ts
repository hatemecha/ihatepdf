import { describe, expect, it } from "vitest";

import {
  WORD_IMAGE_MAX_WIDTH_PX,
  fitImageDimensions,
} from "./pdfToWordConversion";

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
