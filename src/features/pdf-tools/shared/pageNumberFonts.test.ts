import { StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  getPageNumberPreviewFontStyle,
  getPageNumberStandardFont,
} from "./pageNumberFonts";

describe("pageNumberFonts", () => {
  it("maps font ids to pdf-lib standard fonts", () => {
    expect(getPageNumberStandardFont("helvetica")).toBe(
      StandardFonts.Helvetica,
    );
    expect(getPageNumberStandardFont("times-bold")).toBe(
      StandardFonts.TimesRomanBold,
    );
    expect(getPageNumberStandardFont("courier")).toBe(StandardFonts.Courier);
  });

  it("provides preview styles for bold and italic variants", () => {
    expect(getPageNumberPreviewFontStyle("helvetica-bold").fontWeight).toBe(
      700,
    );
    expect(getPageNumberPreviewFontStyle("times-italic").fontStyle).toBe(
      "italic",
    );
  });
});
