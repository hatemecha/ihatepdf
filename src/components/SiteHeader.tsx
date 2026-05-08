import { NavLink, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { Logo } from "@/components/Logo";
import { getVisibleToolCategories } from "@/tools/toolCatalog";
import { cn } from "@/lib/utils";

const REPO_URL = "https://github.com/ihatepdf/ihatepdf";

export function SiteHeader() {
  const visibleCategories = getVisibleToolCategories();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <div className="container-page flex h-20 items-center justify-between gap-2 sm:gap-4 md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:justify-normal">
        <Link
          to="/"
          aria-label="iHatePDF inicio"
          className="min-w-0 shrink-0 md:justify-self-start"
        >
          <Logo />
        </Link>

        <nav
          className="hidden min-w-0 md:flex md:justify-self-center"
          aria-label="Categorias"
        >
          <div className="flex items-center gap-1">
            {visibleCategories.map((category) => (
              <NavLink
                key={category.id}
                to={`/#cat-${category.id}`}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:px-4 lg:text-base",
                    isActive && "text-foreground",
                  )
                }
              >
                {category.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 md:justify-self-end">
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
