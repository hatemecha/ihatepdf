export type PdfOperationKind =
  | "inspect-pdf"
  | "merge-pdfs"
  | "split-pdf"
  | "extract-pages"
  | "delete-pages"
  | "reorder-pages"
  | "rotate-pages"
  | "images-to-pdf";

export interface PdfInputFile {
  name: string;
  buffer: ArrayBuffer;
}

export interface ImageInputFile extends PdfInputFile {
  mimeType: string;
}

export type PdfOperationRequest =
  | {
      kind: "inspect-pdf";
      file: PdfInputFile;
    }
  | {
      kind: "merge-pdfs";
      files: PdfInputFile[];
    }
  | {
      kind: "split-pdf";
      file: PdfInputFile;
    }
  | {
      kind: "extract-pages";
      file: PdfInputFile;
      pages: number[];
    }
  | {
      kind: "delete-pages";
      file: PdfInputFile;
      pages: number[];
    }
  | {
      kind: "reorder-pages";
      file: PdfInputFile;
      pages: number[];
    }
  | {
      kind: "rotate-pages";
      file: PdfInputFile;
      pages: number[];
      angle: 90 | 180 | 270;
    }
  | {
      kind: "images-to-pdf";
      files: ImageInputFile[];
    };

export type PdfOperationResult =
  | {
      kind: "inspect";
      pageCount: number;
    }
  | {
      kind: "file";
      fileName: string;
      mimeType: string;
      buffer: ArrayBuffer;
    };

export type PdfOperationResponse =
  | {
      type: "success";
      result: PdfOperationResult;
    }
  | {
      type: "error";
      message: string;
    };
