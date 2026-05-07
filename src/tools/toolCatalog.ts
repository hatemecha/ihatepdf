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
    description: "Unir, dividir, extraer, eliminar y ordenar paginas.",
  },
  {
    id: "convert",
    label: "Convertir PDF",
    description: "Pasar entre PDF e imagenes desde el navegador.",
  },
  {
    id: "edit",
    label: "Editar PDF",
    description: "Rotar paginas y ajustar documentos existentes.",
  },
];

export const TOOLS: Tool[] = [
  {
    slug: "merge",
    name: "Unir PDFs",
    description: "Combina varios PDFs en un solo archivo descargable.",
    category: "organize",
    status: "available",
    implementation: "merge-pdfs",
    icon: Combine,
    highlight: true,
  },
  {
    slug: "split",
    name: "Dividir PDF",
    description: "Genera un ZIP con cada pagina como PDF independiente.",
    category: "organize",
    status: "available",
    implementation: "split-pdf",
    icon: Scissors,
  },
  {
    slug: "extract-pages",
    name: "Extraer paginas",
    description: "Crea un nuevo PDF solo con las paginas que elijas.",
    category: "organize",
    status: "available",
    implementation: "extract-pages",
    icon: CopyMinus,
  },
  {
    slug: "delete-pages",
    name: "Eliminar paginas",
    description: "Quita paginas seleccionadas y descarga el PDF resultante.",
    category: "organize",
    status: "available",
    implementation: "delete-pages",
    icon: Trash2,
  },
  {
    slug: "reorder",
    name: "Reordenar paginas",
    description: "Define el orden final de todas las paginas del documento.",
    category: "organize",
    status: "available",
    implementation: "reorder-pages",
    icon: ListOrdered,
  },
  {
    slug: "rotate",
    name: "Rotar paginas",
    description: "Rota paginas individuales o todo el documento.",
    category: "edit",
    status: "available",
    implementation: "rotate-pages",
    icon: RotateCcw,
  },
  {
    slug: "images-to-pdf",
    name: "Imagen a PDF",
    description: "Convierte JPG o PNG en un PDF listo para compartir.",
    category: "convert",
    status: "available",
    implementation: "images-to-pdf",
    icon: ImagePlus,
    highlight: true,
  },
  {
    slug: "pdf-to-images",
    name: "PDF a imagenes",
    description: "Exporta paginas del PDF como imagenes PNG en un ZIP.",
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
