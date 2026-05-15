import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { Logo } from "@/components/Logo";
import { REPO_URL } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="container-page flex h-16 items-center justify-between gap-2 sm:gap-4">
        <Link to="/" aria-label="iHatePDF inicio" className="min-w-0 shrink-0">
          <Logo />
        </Link>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
              <GitHubIcon />
              Código
            </a>
          </Button>
          <Button asChild variant="brand" size="sm">
            <Link to="/#herramientas">Herramientas</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
