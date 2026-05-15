import type { PageNumberFontId } from "@/features/pdf-tools/shared/pageNumberFonts";

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
  font: PageNumberFontId;
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
      files: PdfInputFile[];
    }
  | {
      kind: "watermark-pdf";
      files: PdfInputFile[];
      options: WatermarkOptions;
    }
  | {
      kind: "number-pages";
      files: PdfInputFile[];
      options: PageNumberOptions;
    }
  | {
      kind: "protect-pdf";
      files: PdfInputFile[];
      options: ProtectPdfOptions;
    }
  | {
      kind: "unlock-pdf";
      files: PdfInputFile[];
      password: string;
    }
  | {
      kind: "crop-pdf";
      files: PdfInputFile[];
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
      files: PdfInputFile[];
      pages: number[]; // applies to all if possible, or maybe we just rotate all pages if batch? 
      // Actually, if batching rotate, the UI usually applies to all pages or specific ranges. Let's keep `pages` for single file, and if batch, apply to all pages? No, the UI for SinglePdfOperationTool previews one file. If multiple are passed, we might just apply the rotation to ALL pages of ALL files, or to the same page indices. Let's just keep the type as is and we'll handle the logic in the worker.
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
    }
  | {
      kind: "view-metadata";
      file: PdfInputFile;
    }
  | {
      kind: "remove-metadata";
      files: PdfInputFile[];
    }
  | {
      kind: "extract-images";
      file: PdfInputFile;
    }
  | {
      kind: "pdf-to-text";
      file: PdfInputFile;
    }
  | {
      kind: "ocr-pdf";
      file: PdfInputFile;
    }
  | {
      kind: "sign-pdf";
      file: PdfInputFile;
      options: {
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
        signatureImage: ArrayBuffer;
      };
    };

export type PdfOperationResult =
  | {
      kind: "inspect";
      pageCount: number;
    }
  | {
      kind: "metadata";
      metadata: {
        title: string;
        author: string;
        subject: string;
        keywords: string;
        creator: string;
        producer: string;
        creationDate: string;
        modificationDate: string;
      };
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
