import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export interface PageSeoOptions {
  /** Document title without site suffix (added automatically). */
  title: string;
  description: string;
  /** Path relative to site root, e.g. `/` or `/herramientas/merge`. */
  path: string;
  /** When true, adds noindex for thin/error pages. */
  noIndex?: boolean;
  /** Optional JSON-LD object(s) injected as application/ld+json. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const META_IDS = {
  description: "ihatepdf-meta-description",
  robots: "ihatepdf-meta-robots",
  ogTitle: "ihatepdf-og-title",
  ogDescription: "ihatepdf-og-description",
  ogUrl: "ihatepdf-og-url",
  ogImage: "ihatepdf-og-image",
  ogType: "ihatepdf-og-type",
  ogLocale: "ihatepdf-og-locale",
  ogSiteName: "ihatepdf-og-site-name",
  twitterCard: "ihatepdf-twitter-card",
  twitterTitle: "ihatepdf-twitter-title",
  twitterDescription: "ihatepdf-twitter-description",
  twitterImage: "ihatepdf-twitter-image",
} as const;

const JSON_LD_ID = "ihatepdf-jsonld";
const CANONICAL_ID = "ihatepdf-canonical";

export function formatPageTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed.toLowerCase() === SITE_NAME.toLowerCase()) {
    return `${SITE_NAME} — ${SITE_TAGLINE}`;
  }
  return `${trimmed} | ${SITE_NAME}`;
}

function upsertMeta(
  attribute: "name" | "property",
  key: string,
  content: string,
  id: string,
): void {
  let element = document.getElementById(id) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.id = id;
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string, id: string): void {
  let element = document.getElementById(id) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.id = id;
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function upsertJsonLd(
  data: Record<string, unknown> | Record<string, unknown>[],
): void {
  let element = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.id = JSON_LD_ID;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(
    Array.isArray(data) && data.length === 1 ? data[0] : data,
  );
}

function removeJsonLd(): void {
  document.getElementById(JSON_LD_ID)?.remove();
}

interface PageSeoSnapshot {
  documentTitle: string;
  metaContents: Map<string, string>;
  canonicalHref: string | null;
  hadJsonLd: boolean;
}

function captureSnapshot(): PageSeoSnapshot {
  const metaContents = new Map<string, string>();
  for (const id of Object.values(META_IDS)) {
    const element = document.getElementById(id);
    if (element instanceof HTMLMetaElement && element.content) {
      metaContents.set(id, element.content);
    }
  }
  const canonical = document.getElementById(CANONICAL_ID);
  return {
    documentTitle: document.title,
    metaContents,
    canonicalHref: canonical instanceof HTMLLinkElement ? canonical.href : null,
    hadJsonLd: Boolean(document.getElementById(JSON_LD_ID)),
  };
}

function restoreSnapshot(snapshot: PageSeoSnapshot): void {
  document.title = snapshot.documentTitle;
  for (const id of Object.values(META_IDS)) {
    const saved = snapshot.metaContents.get(id);
    const element = document.getElementById(id);
    if (saved && element instanceof HTMLMetaElement) {
      element.content = saved;
    } else {
      element?.remove();
    }
  }
  const canonical = document.getElementById(CANONICAL_ID);
  if (snapshot.canonicalHref && canonical instanceof HTMLLinkElement) {
    canonical.href = snapshot.canonicalHref;
  } else {
    canonical?.remove();
  }
  if (!snapshot.hadJsonLd) {
    removeJsonLd();
  }
}

export function applyPageSeo(
  options: PageSeoOptions,
  context: {
    canonicalUrl: string;
    ogImageUrl: string;
  },
): () => void {
  const snapshot = captureSnapshot();
  const pageTitle = formatPageTitle(options.title);
  const robots = options.noIndex ? "noindex, follow" : "index, follow";

  document.title = pageTitle;

  upsertMeta("name", "description", options.description, META_IDS.description);
  upsertMeta("name", "robots", robots, META_IDS.robots);
  upsertMeta("property", "og:title", pageTitle, META_IDS.ogTitle);
  upsertMeta(
    "property",
    "og:description",
    options.description,
    META_IDS.ogDescription,
  );
  upsertMeta("property", "og:url", context.canonicalUrl, META_IDS.ogUrl);
  upsertMeta("property", "og:image", context.ogImageUrl, META_IDS.ogImage);
  upsertMeta("property", "og:type", "website", META_IDS.ogType);
  upsertMeta("property", "og:locale", "es_ES", META_IDS.ogLocale);
  upsertMeta("property", "og:site_name", SITE_NAME, META_IDS.ogSiteName);
  upsertMeta(
    "name",
    "twitter:card",
    "summary_large_image",
    META_IDS.twitterCard,
  );
  upsertMeta("name", "twitter:title", pageTitle, META_IDS.twitterTitle);
  upsertMeta(
    "name",
    "twitter:description",
    options.description,
    META_IDS.twitterDescription,
  );
  upsertMeta(
    "name",
    "twitter:image",
    context.ogImageUrl,
    META_IDS.twitterImage,
  );
  upsertLink("canonical", context.canonicalUrl, CANONICAL_ID);

  if (options.jsonLd) {
    upsertJsonLd(options.jsonLd);
  } else {
    removeJsonLd();
  }

  return () => restoreSnapshot(snapshot);
}

export function buildToolPageTitle(toolName: string): string {
  return `${toolName} online gratis`;
}

export function buildToolPageDescription(
  toolName: string,
  description: string,
  longDescription?: string,
): string {
  const detail = longDescription?.trim() || description.trim();
  return `${toolName}: ${detail} Con iHatePDF no subes archivos a ningún servidor; todo ocurre en tu navegador.`;
}
