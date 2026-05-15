import { Link } from "react-router-dom";

import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { Logo } from "@/components/Logo";
import { REPO_URL } from "@/lib/site";

const COPYRIGHT_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-panel/70">
      <div className="container-page py-5 sm:py-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
          <Logo className="[&_img]:size-7 [&_span:first-child]:size-7 [&_span:last-child]:text-base" />

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>PDFs en tu navegador</span>
            <span aria-hidden className="text-brand">
              ·
            </span>
            <Link
              to="/#herramientas"
              className="font-medium text-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
            >
              Herramientas
            </Link>
            <span aria-hidden className="text-brand">
              ·
            </span>
            <Link
              to="/#preguntas-frecuentes"
              className="font-medium text-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
            >
              FAQ
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm shadow-black/10 transition-colors hover:border-brand/70 hover:text-brand"
            >
              <GitHubIcon className="size-3.5 shrink-0" aria-hidden />
              Código
            </a>
          </div>

          <p className="text-xs leading-none text-muted-foreground">
            hatemecha © {COPYRIGHT_YEAR}
          </p>
        </div>
      </div>
    </footer>
  );
}
