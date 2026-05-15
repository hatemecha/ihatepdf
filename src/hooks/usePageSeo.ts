import { useEffect } from "react";

import { applyPageSeo, type PageSeoOptions } from "@/lib/seo";
import { getAbsoluteUrl, getOgImageUrl } from "@/lib/site";

export function usePageSeo(options: PageSeoOptions): void {
  const { title, description, path, noIndex, jsonLd } = options;
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const parsedJsonLd = jsonLdKey
      ? (JSON.parse(jsonLdKey) as PageSeoOptions["jsonLd"])
      : undefined;

    return applyPageSeo(
      { title, description, path, noIndex, jsonLd: parsedJsonLd },
      {
        canonicalUrl: getAbsoluteUrl(path),
        ogImageUrl: getOgImageUrl(),
      },
    );
  }, [title, description, path, noIndex, jsonLdKey]);
}
