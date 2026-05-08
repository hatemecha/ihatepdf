export interface PageRangeParseResult {
  isValid: boolean;
  pages: number[];
  error?: string;
}

function createError(error: string): PageRangeParseResult {
  return {
    isValid: false,
    pages: [],
    error,
  };
}

export function formatPageRangeHint(pageCount: number): string {
  if (pageCount <= 1) {
    return "1";
  }

  return `1-${pageCount}`;
}

export function parsePageRange(
  value: string,
  pageCount: number,
): PageRangeParseResult {
  const trimmedValue = value.trim().toLowerCase();

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return createError("El PDF no tiene páginas disponibles.");
  }

  if (
    trimmedValue === "" ||
    trimmedValue === "all" ||
    trimmedValue === "todo"
  ) {
    return {
      isValid: true,
      pages: Array.from({ length: pageCount }, (_, index) => index),
    };
  }

  const selectedPages = new Set<number>();
  const parts = trimmedValue.split(",");

  for (const rawPart of parts) {
    const part = rawPart.trim();

    if (!part) {
      return createError("Hay una coma sin página asociada.");
    }

    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      if (start > end) {
        return createError(`El rango ${part} está invertido.`);
      }

      if (start < 1 || end > pageCount) {
        return createError(`El rango ${part} está fuera del PDF.`);
      }

      for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
        selectedPages.add(pageNumber - 1);
      }

      continue;
    }

    const pageNumber = Number(part);
    if (!Number.isInteger(pageNumber)) {
      return createError(`"${part}" no es una página válida.`);
    }

    if (pageNumber < 1 || pageNumber > pageCount) {
      return createError(`La página ${pageNumber} está fuera del PDF.`);
    }

    selectedPages.add(pageNumber - 1);
  }

  if (selectedPages.size === 0) {
    return createError("Selecciona al menos una página.");
  }

  return {
    isValid: true,
    pages: [...selectedPages].sort((a, b) => a - b),
  };
}

export function parsePageOrder(
  value: string,
  pageCount: number,
): PageRangeParseResult {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return createError("Indica el nuevo orden de páginas.");
  }

  const pages = trimmedValue.split(",").map((part) => Number(part.trim()));

  if (pages.some((pageNumber) => !Number.isInteger(pageNumber))) {
    return createError(
      "El orden solo puede incluir números separados por coma.",
    );
  }

  if (pages.length !== pageCount) {
    return createError(`El orden debe incluir las ${pageCount} páginas.`);
  }

  const seenPages = new Set<number>();

  for (const pageNumber of pages) {
    if (pageNumber < 1 || pageNumber > pageCount) {
      return createError(`La página ${pageNumber} está fuera del PDF.`);
    }

    if (seenPages.has(pageNumber)) {
      return createError(`La página ${pageNumber} está repetida.`);
    }

    seenPages.add(pageNumber);
  }

  return {
    isValid: true,
    pages: pages.map((pageNumber) => pageNumber - 1),
  };
}
