import { StandardFonts } from "pdf-lib";

export type PageNumberFontId =
  | "helvetica"
  | "helvetica-bold"
  | "helvetica-italic"
  | "times"
  | "times-bold"
  | "times-italic"
  | "courier"
  | "courier-bold";

export const DEFAULT_PAGE_NUMBER_FONT: PageNumberFontId = "helvetica";

export const PAGE_NUMBER_FONT_OPTIONS: Array<{
  value: PageNumberFontId;
  label: string;
}> = [
  { value: "helvetica", label: "Helvetica" },
  { value: "helvetica-bold", label: "Helvetica negrita" },
  { value: "helvetica-italic", label: "Helvetica cursiva" },
  { value: "times", label: "Times New Roman" },
  { value: "times-bold", label: "Times New Roman negrita" },
  { value: "times-italic", label: "Times New Roman cursiva" },
  { value: "courier", label: "Courier" },
  { value: "courier-bold", label: "Courier negrita" },
];

export function getPageNumberStandardFont(
  font: PageNumberFontId,
): StandardFonts {
  switch (font) {
    case "helvetica":
      return StandardFonts.Helvetica;
    case "helvetica-bold":
      return StandardFonts.HelveticaBold;
    case "helvetica-italic":
      return StandardFonts.HelveticaOblique;
    case "times":
      return StandardFonts.TimesRoman;
    case "times-bold":
      return StandardFonts.TimesRomanBold;
    case "times-italic":
      return StandardFonts.TimesRomanItalic;
    case "courier":
      return StandardFonts.Courier;
    case "courier-bold":
      return StandardFonts.CourierBold;
  }
}

export function getPageNumberPreviewFontStyle(font: PageNumberFontId): {
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
} {
  switch (font) {
    case "helvetica":
      return {
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontWeight: 400,
        fontStyle: "normal",
      };
    case "helvetica-bold":
      return {
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontWeight: 700,
        fontStyle: "normal",
      };
    case "helvetica-italic":
      return {
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontWeight: 400,
        fontStyle: "italic",
      };
    case "times":
      return {
        fontFamily: '"Times New Roman", Times, serif',
        fontWeight: 400,
        fontStyle: "normal",
      };
    case "times-bold":
      return {
        fontFamily: '"Times New Roman", Times, serif',
        fontWeight: 700,
        fontStyle: "normal",
      };
    case "times-italic":
      return {
        fontFamily: '"Times New Roman", Times, serif',
        fontWeight: 400,
        fontStyle: "italic",
      };
    case "courier":
      return {
        fontFamily: '"Courier New", Courier, monospace',
        fontWeight: 400,
        fontStyle: "normal",
      };
    case "courier-bold":
      return {
        fontFamily: '"Courier New", Courier, monospace',
        fontWeight: 700,
        fontStyle: "normal",
      };
  }
}
