import { ShieldCheck } from "lucide-react";
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
      <div className="container-page flex h-20 items-center justify-between gap-6">
        <Link to="/" aria-label="iHatePDF inicio" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {visibleCategories.map((category) => (
            <NavLink
              key={category.id}
              to={`/#cat-${category.id}`}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-base font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  isActive && "text-foreground",
                )
              }
            >
              {category.label}
            </NavLink>
          ))}
          <NavLink
            to="/privacidad"
            className={({ isActive }) =>
              cn(
                "rounded-full px-4 py-2 text-base font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                isActive && "text-foreground",
              )
            }
          >
            Privacidad
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
              <GitHubIcon />
              Codigo
            </a>
          </Button>
          <Button asChild variant="brand" size="sm">
            <Link to="/privacidad">
              <ShieldCheck />
              Privacidad
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
