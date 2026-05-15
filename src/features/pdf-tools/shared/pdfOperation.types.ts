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

interface LayoutPageElement {
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

export interface ImageToPdfOptions {
  pageSize: "a4" | "letter" | "image";
  orientation: "auto" | "portrait" | "landscape";
  margin: "none" | "small" | "normal" | "large";
}

export interface WatermarkOptions {
  text: string;
  opacity: number;
  fontSize: number;
  rotation: number;
}

export type PageNumberPosition =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "top-left"
  | "top-center"
  | "top-right";

export interface PageNumberOptions {
  startAt: number;
  fontSize: number;
  position: PageNumberPosition;
  margin: number;
}

export interface CropMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ProtectPdfOptions {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting: boolean;
  allowCopying: boolean;
  allowModifying: boolean;
}

export type PdfOperationRequest =
  | {
      kind: "inspect-pdf";
      file: PdfInputFile;
    }
  | {
      kind: "compress-pdf";
      file: PdfInputFile;
    }
  | {
      kind: "watermark-pdf";
      file: PdfInputFile;
      options: WatermarkOptions;
    }
  | {
      kind: "number-pages";
      file: PdfInputFile;
      options: PageNumberOptions;
    }
  | {
      kind: "protect-pdf";
      file: PdfInputFile;
      options: ProtectPdfOptions;
    }
  | {
      kind: "unlock-pdf";
      file: PdfInputFile;
      password: string;
    }
  | {
      kind: "crop-pdf";
      file: PdfInputFile;
      margins: CropMargins;
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
      options?: ImageToPdfOptions;
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
