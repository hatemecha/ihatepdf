export type PagePresetId =
  | "a4-portrait"
  | "a4-landscape"
  | "letter-portrait"
  | "letter-landscape";

export interface PagePreset {
  id: PagePresetId;
  label: string;
  width: number;
  height: number;
}

export const PAGE_PRESETS: PagePreset[] = [
  { id: "a4-portrait", label: "A4 vertical", width: 595.28, height: 841.89 },
  { id: "a4-landscape", label: "A4 horizontal", width: 841.89, height: 595.28 },
  {
    id: "letter-portrait",
    label: "Carta vertical",
    width: 612,
    height: 792,
  },
  {
    id: "letter-landscape",
    label: "Carta horizontal",
    width: 792,
    height: 612,
  },
];

export const DEFAULT_PRESET: PagePreset = PAGE_PRESETS[0];

/** MIME type for native drag-and-drop from the layout image library to the canvas. */
export const LAYOUT_ASSET_DRAG_MIME = "application/x-ihatepdf-layout-asset";

export const SNAP_GRID_SIZE = 20;
export const CENTER_SNAP_THRESHOLD = 6;

export interface LayoutImageAsset {
  id: string;
  name: string;
  mimeType: string;
  file: File;
  naturalWidth: number;
  naturalHeight: number;
  previewUrl: string;
}

export interface LayoutImageElement {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface LayoutPage {
  id: string;
  presetId: PagePresetId;
  width: number;
  height: number;
  elements: LayoutImageElement[];
}
