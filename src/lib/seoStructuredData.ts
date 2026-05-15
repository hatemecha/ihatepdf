import { getAbsoluteUrl, REPO_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import type { Tool } from "@/tools/toolCatalog";

export function buildHomeStructuredData(tools: Tool[]): Record<string, unknown>[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "es",
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description: SITE_DESCRIPTION,
      featureList: tools.map((tool) => tool.name),
      isAccessibleForFree: true,
      softwareHelp: REPO_URL,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Herramientas PDF de iHatePDF",
      itemListElement: tools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.name,
        url: getAbsoluteUrl(`/herramientas/${tool.slug}`),
        description: tool.longDescription ?? tool.description,
      })),
    },
  ];
}

export function buildToolStructuredData(tool: Tool): Record<string, unknown>[] {
  const toolUrl = getAbsoluteUrl(`/herramientas/${tool.slug}`);

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: `${tool.name} — ${SITE_NAME}`,
      url: toolUrl,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      description: tool.longDescription ?? tool.description,
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: tool.name,
          item: toolUrl,
        },
      ],
    },
  ];
}

export function buildFaqStructuredData(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Tengo que subir mis PDFs a un servidor?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. iHatePDF procesa tus archivos en el navegador. Tus documentos no se envían a servidores externos para unir, dividir, comprimir o convertir.",
        },
      },
      {
        "@type": "Question",
        name: "¿iHatePDF es gratis?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sí. Las herramientas son gratuitas y no requieren crear una cuenta.",
        },
      },
      {
        "@type": "Question",
        name: "¿En qué se diferencia iHatePDF de otras webs de PDF?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "iHatePDF prioriza la privacidad y la velocidad local: editas en tu dispositivo, sin colas de subida ni límites de cuenta. Es una alternativa ligera para tareas habituales con PDF.",
        },
      },
    ],
  };
}
