import { Link } from "react-router-dom";

import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { Logo } from "@/components/Logo";
import { REPO_URL } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-muted">
      <div className="container-page py-10 sm:py-11">
        <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:items-start sm:justify-between sm:gap-10 sm:text-left">
          <div className="flex w-full max-w-lg flex-col items-center gap-3 sm:items-start">
            <Logo />
            <p className="text-sm leading-relaxed text-muted-foreground">
              PDFs en tu navegador ·{" "}
              <Link
                to="/#herramientas"
                className="font-medium text-foreground underline-offset-4 hover:text-brand hover:underline"
              >
                Herramientas
              </Link>
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              © {new Date().getFullYear()} Alex Romero · aka hatemecha
            </p>
          </div>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-foreground transition-colors hover:text-brand sm:pt-0.5"
          >
            <GitHubIcon className="size-4 shrink-0" aria-hidden />
            Código
          </a>
        </div>
      </div>
    </footer>
  );
}
