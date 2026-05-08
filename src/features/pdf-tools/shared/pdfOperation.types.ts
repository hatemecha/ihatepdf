export type PdfOperationKind =
  | "inspect-pdf"
  | "merge-pdfs"
  | "split-pdf"
  | "extract-pages"
  | "delete-pages"
  | "reorder-pages"
  | "rotate-pages"
  | "images-to-pdf"
  | "images-to-pdf-layout";

export interface PdfInputFile {
  name: string;
  buffer: ArrayBuffer;
}

export interface ImageInputFile extends PdfInputFile {
  mimeType: string;
}

export interface LayoutImageAsset {
  id: string;
  name: string;
  mimeType: string;
  buffer: ArrayBuffer;
}

export interface LayoutPageElement {
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface LayoutPagePayload {
  width: number;
  height: number;
  elements: LayoutPageElement[];
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
    }
  | {
      kind: "images-to-pdf-layout";
      images: LayoutImageAsset[];
      pages: LayoutPagePayload[];
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
