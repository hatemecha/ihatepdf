import {
  Combine,
  CopyMinus,
  Crop,
  Eraser,
  FileImage,
  FileArchive,
  FileText,
  Hash,
  ImagePlus,
  Images,
  Info,
  ListOrdered,
  Lock,
  PenTool,
  RotateCcw,
  Camera,
  ScanText,
  Scissors,
  Stamp,
  Trash2,
  Unlock,
  type LucideIcon,
} from "lucide-react";

type ToolStatus = "available";

export type ToolCategoryId = "organize" | "convert" | "edit";

type ToolImplementation =
  | "compress-pdf"
  | "watermark-pdf"
  | "number-pages"
  | "protect-pdf"
  | "unlock-pdf"
  | "crop-pdf"
  | "merge-pdfs"
  | "split-pdf"
  | "extract-pages"
  | "delete-pages"
  | "reorder-pages"
  | "rotate-pages"
  | "images-to-pdf"
  | "pdf-to-images"
  | "view-metadata"
  | "remove-metadata"
  | "extract-images"
  | "pdf-to-text"
  | "scan-to-pdf"
  | "ocr-pdf"
  | "sign-pdf";

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

const TOOL_CATEGORIES: ToolCategory[] = [
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

const TOOLS: Tool[] = [
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
    slug: "compress",
    name: "Comprimir PDF",
    description: "Reduce y optimiza el archivo PDF.",
    longDescription:
      "Compacta la estructura del PDF en el navegador y descarga una copia optimizada.",
    category: "organize",
    status: "available",
    implementation: "compress-pdf",
    icon: FileArchive,
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
    slug: "watermark",
    name: "Marca de agua",
    description: "Agrega texto visible a todas las páginas.",
    longDescription:
      "Escribe una marca, ajusta opacidad y ángulo, y descarga un PDF marcado.",
    category: "edit",
    status: "available",
    implementation: "watermark-pdf",
    icon: Stamp,
  },
  {
    slug: "page-numbers",
    name: "Numerar páginas",
    description: "Añade números en la posición que elijas.",
    longDescription:
      "Configura inicio, tamaño y ubicación de la numeración antes de descargar la copia final.",
    category: "edit",
    status: "available",
    implementation: "number-pages",
    icon: Hash,
  },
  {
    slug: "protect",
    name: "Proteger PDF",
    description: "Cifra el PDF con contraseña.",
    longDescription:
      "Define una contraseña de apertura y permisos básicos sin enviar el archivo a un servidor.",
    category: "edit",
    status: "available",
    implementation: "protect-pdf",
    icon: Lock,
  },
  {
    slug: "unlock",
    name: "Desbloquear PDF",
    description: "Quita la contraseña conocida.",
    longDescription:
      "Usa la contraseña actual para descargar una copia desbloqueada del PDF.",
    category: "edit",
    status: "available",
    implementation: "unlock-pdf",
    icon: Unlock,
  },
  {
    slug: "crop",
    name: "Recortar PDF",
    description: "Oculta márgenes de todas las páginas.",
    longDescription:
      "Define el recorte superior, inferior y lateral en milímetros y genera una copia ajustada.",
    category: "edit",
    status: "available",
    implementation: "crop-pdf",
    icon: Crop,
  },
  {
    slug: "images-to-pdf",
    name: "Imagen a PDF",
    description: "Convierte JPG, PNG o WebP en PDF.",
    longDescription:
      "Carga imágenes, define orden, margen, orientación y tamaño de página antes de crear el PDF.",
    category: "convert",
    status: "available",
    implementation: "images-to-pdf",
    icon: ImagePlus,
    highlight: true,
  },
  {
    slug: "pdf-to-images",
    name: "PDF a imágenes",
    description: "Exporta páginas como PNG, JPG o WebP.",
    longDescription:
      "Selecciona páginas del PDF y expórtalas como imágenes PNG, JPG o WebP empaquetadas en un ZIP.",
    category: "convert",
    status: "available",
    implementation: "pdf-to-images",
    icon: FileImage,
  },
  {
    slug: "view-metadata",
    name: "Ver metadatos",
    description: "Visualiza información oculta del PDF.",
    longDescription:
      "Lee el título, autor, creador y fechas de creación o modificación del documento.",
    category: "edit",
    status: "available",
    implementation: "view-metadata",
    icon: Info,
  },
  {
    slug: "remove-metadata",
    name: "Eliminar metadatos",
    description: "Limpia la información oculta del archivo.",
    longDescription:
      "Elimina permanentemente el autor, creador y otros datos de rastreo del PDF.",
    category: "edit",
    status: "available",
    implementation: "remove-metadata",
    icon: Eraser,
  },
  {
    slug: "extract-images",
    name: "Extraer imágenes",
    description: "Saca todas las imágenes de un PDF.",
    longDescription:
      "Detecta y extrae todas las fotos e imágenes incrustadas en el documento y las empaqueta en un ZIP.",
    category: "convert",
    status: "available",
    implementation: "extract-images",
    icon: Images,
  },
  {
    slug: "pdf-to-text",
    name: "PDF a texto",
    description: "Extrae el texto de un PDF.",
    longDescription:
      "Lee y extrae todo el contenido de texto seleccionable del documento en un archivo de texto plano.",
    category: "convert",
    status: "available",
    implementation: "pdf-to-text",
    icon: FileText,
  },
  {
    slug: "scan-to-pdf",
    name: "Escanear a PDF",
    description: "Crea un PDF usando tu cámara.",
    longDescription:
      "Toma fotos de tus documentos físicos con la cámara de tu dispositivo y conviértelos directamente en PDF.",
    category: "convert",
    status: "available",
    implementation: "scan-to-pdf",
    icon: Camera,
  },
  {
    slug: "ocr-pdf",
    name: "OCR PDF",
    description: "Extrae texto de PDFs escaneados.",
    longDescription:
      "Utiliza reconocimiento óptico de caracteres para extraer texto de imágenes o PDFs escaneados (localmente).",
    category: "convert",
    status: "available",
    implementation: "ocr-pdf",
    icon: ScanText,
  },
  {
    slug: "sign-pdf",
    name: "Firmar PDF",
    description: "Añade tu firma visual al documento.",
    longDescription:
      "Dibuja tu firma en la pantalla y estámpala en cualquier página y posición del PDF.",
    category: "edit",
    status: "available",
    implementation: "sign-pdf",
    icon: PenTool,
  },
];

const TOOL_SEARCH_SYNONYMS: Record<string, string[]> = {
  merge: ["unir", "combinar", "juntar"],
  compress: ["comprimir", "reducir", "optimizar"],
  split: ["dividir", "separar", "partir"],
  "extract-pages": ["extraer", "sacar", "copiar"],
  "delete-pages": ["eliminar", "borrar", "quitar"],
  reorder: ["reordenar", "ordenar", "mover"],
  rotate: ["rotar", "girar", "orientacion"],
  watermark: ["marca", "sello", "estampar"],
  "page-numbers": ["numerar", "numeracion", "paginas"],
  protect: ["proteger", "cifrar", "password", "contraseña"],
  unlock: ["desbloquear", "quitar contraseña"],
  crop: ["recortar", "margen", "margenes"],
  "images-to-pdf": ["imagen", "jpg", "png", "foto"],
  "pdf-to-images": ["exportar", "png", "jpg", "webp"],
  "view-metadata": ["ver", "metadatos", "propiedades", "autor"],
  "remove-metadata": ["eliminar", "borrar", "limpiar", "metadatos", "propiedades"],
  "extract-images": ["extraer", "sacar", "imagenes", "fotos"],
  "pdf-to-text": ["convertir", "texto", "txt", "extraer texto"],
  "scan-to-pdf": ["escanear", "camara", "foto", "digitalizar"],
  "ocr-pdf": ["ocr", "reconocimiento", "texto", "escaner", "escaneado"],
  "sign-pdf": ["firmar", "firma", "rubrica", "dibujar"],
};

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function getToolSearchHaystack(tool: Tool): string {
  const category = TOOL_CATEGORIES.find((item) => item.id === tool.category);
  const synonyms = TOOL_SEARCH_SYNONYMS[tool.slug] ?? [];

  return normalizeSearchText(
    [
      tool.name,
      tool.description,
      tool.longDescription ?? "",
      tool.slug,
      category?.label ?? "",
      category?.description ?? "",
      ...synonyms,
    ].join(" "),
  );
}

export function getAllTools(): Tool[] {
  return [...TOOLS];
}

export function searchTools(query: string): Tool[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return getAllTools();
  }

  return TOOLS.filter((tool) =>
    getToolSearchHaystack(tool).includes(normalizedQuery),
  );
}

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function getToolsByCategory(category: ToolCategoryId): Tool[] {
  return TOOLS.filter((tool) => tool.category === category);
}

export function getVisibleToolCategories(): ToolCategory[] {
  return TOOL_CATEGORIES.filter((category) =>
    TOOLS.some((tool) => tool.category === category.id),
  );
}
