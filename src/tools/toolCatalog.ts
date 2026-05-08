import {
  Combine,
  CopyMinus,
  FileImage,
  ImagePlus,
  ListOrdered,
  RotateCcw,
  Scissors,
  Trash2,
  type LucideIcon,
} from "lucide-react";

export type ToolStatus = "available";

export type ToolCategoryId = "organize" | "convert" | "edit";

export type ToolImplementation =
  | "merge-pdfs"
  | "split-pdf"
  | "extract-pages"
  | "delete-pages"
  | "reorder-pages"
  | "rotate-pages"
  | "images-to-pdf"
  | "pdf-to-images";

export interface ToolCategory {
  id: ToolCategoryId;
  label: string;
  description: string;
}

export interface Tool {
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  category: ToolCategoryId;
  status: ToolStatus;
  implementation: ToolImplementation;
  icon: LucideIcon;
  highlight?: boolean;
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "organize",
    label: "Organizar PDF",
    description: "Une, separa y reordena páginas sin salir del navegador.",
  },
  {
    id: "convert",
    label: "Convertir PDF",
    description: "Convierte entre PDF e imágenes con descargas listas.",
  },
  {
    id: "edit",
    label: "Editar PDF",
    description: "Ajustes puntuales para documentos que ya existen.",
  },
];

export const TOOLS: Tool[] = [
  {
    slug: "merge",
    name: "Unir PDFs",
    description: "Combina varios PDFs en un solo archivo.",
    longDescription:
      "Ordena tus documentos, une las páginas y descarga un PDF final sin subir archivos a un servidor.",
    category: "organize",
    status: "available",
    implementation: "merge-pdfs",
    icon: Combine,
    highlight: true,
  },
  {
    slug: "split",
    name: "Dividir PDF",
    description: "Genera un ZIP con un PDF por página.",
    longDescription:
      "Separa un documento completo en archivos individuales, uno por cada página del PDF original.",
    category: "organize",
    status: "available",
    implementation: "split-pdf",
    icon: Scissors,
  },
  {
    slug: "extract-pages",
    name: "Extraer páginas",
    description: "Crea un PDF con las páginas que elijas.",
    longDescription:
      "Elige rangos o páginas sueltas y crea un nuevo PDF solo con ese contenido.",
    category: "organize",
    status: "available",
    implementation: "extract-pages",
    icon: CopyMinus,
  },
  {
    slug: "delete-pages",
    name: "Eliminar páginas",
    description: "Quita páginas y conserva el resto.",
    longDescription:
      "Marca las páginas que sobran y descarga una copia del documento sin ellas.",
    category: "organize",
    status: "available",
    implementation: "delete-pages",
    icon: Trash2,
  },
  {
    slug: "reorder",
    name: "Reordenar páginas",
    description: "Define el orden final del documento.",
    longDescription:
      "Escribe el orden de páginas que necesitas y genera una copia organizada del PDF.",
    category: "organize",
    status: "available",
    implementation: "reorder-pages",
    icon: ListOrdered,
  },
  {
    slug: "rotate",
    name: "Rotar páginas",
    description: "Gira páginas individuales o todo el PDF.",
    longDescription:
      "Corrige la orientación de páginas puntuales o del documento completo antes de descargarlo.",
    category: "edit",
    status: "available",
    implementation: "rotate-pages",
    icon: RotateCcw,
  },
  {
    slug: "images-to-pdf",
    name: "Imagen a PDF",
    description: "Convierte JPG o PNG en PDF.",
    longDescription:
      "Carga imágenes, define el orden de páginas y crea un PDF listo para compartir.",
    category: "convert",
    status: "available",
    implementation: "images-to-pdf",
    icon: ImagePlus,
    highlight: true,
  },
  {
    slug: "pdf-to-images",
    name: "PDF a imágenes",
    description: "Exporta páginas como PNG en un ZIP.",
    longDescription:
      "Selecciona páginas del PDF y expórtalas como imágenes PNG empaquetadas en un ZIP.",
    category: "convert",
    status: "available",
    implementation: "pdf-to-images",
    icon: FileImage,
  },
];

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function getCategoryById(
  categoryId: ToolCategoryId,
): ToolCategory | undefined {
  return TOOL_CATEGORIES.find((category) => category.id === categoryId);
}

export function getToolsByCategory(category: ToolCategoryId): Tool[] {
  return TOOLS.filter((tool) => tool.category === category);
}

export function getVisibleToolCategories(): ToolCategory[] {
  return TOOL_CATEGORIES.filter((category) =>
    TOOLS.some((tool) => tool.category === category.id),
  );
}

export function getHighlightedTools(): Tool[] {
  return TOOLS.filter((tool) => tool.highlight);
}

export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  available: "Disponible",
};
