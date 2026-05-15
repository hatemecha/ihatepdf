import { useState } from "react";
import { ArrowLeftRight, Layers, PenLine, type LucideIcon } from "lucide-react";

import { ToolCard } from "@/components/ToolCard";
import { ToolSearchField } from "@/components/ToolSearchField";
import {
  getVisibleToolCategories,
  searchTools,
  type Tool,
  type ToolCategory,
  type ToolCategoryId,
} from "@/tools/toolCatalog";
import { cn } from "@/lib/utils";

type CategoryFilter = ToolCategoryId | "all";

const CATEGORY_ICONS: Record<ToolCategoryId, LucideIcon> = {
  organize: Layers,
  convert: ArrowLeftRight,
  edit: PenLine,
};

function filterToolsForCategory(
  tools: Tool[],
  category: ToolCategoryId | "all",
) {
  if (category === "all") {
    return tools;
  }

  return tools.filter((tool) => tool.category === category);
}

interface CategoryFilterChipProps {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}

function CategoryFilterChip({
  active,
  label,
  count,
  onClick,
}: CategoryFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand/10 text-foreground"
          : "border-border bg-card/40 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
          active ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

interface CategorySectionProps {
  category: ToolCategory;
  tools: Tool[];
}

function CategorySection({ category, tools }: CategorySectionProps) {
  const Icon = CATEGORY_ICONS[category.id];

  return (
    <section
      id={`cat-${category.id}`}
      className="scroll-mt-24"
      aria-labelledby={`heading-${category.id}`}
    >
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {category.tagline}
            </p>
            <h3
              id={`heading-${category.id}`}
              className="text-xl font-semibold text-foreground sm:text-2xl"
            >
              {category.label}
            </h3>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {category.description}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground sm:pt-1">
          {tools.length} {tools.length === 1 ? "herramienta" : "herramientas"}
        </p>
      </header>

      {tools.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ninguna herramienta coincide con tu búsqueda en esta sección.
        </p>
      )}
    </section>
  );
}

export function ToolCategoryTabs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>("all");
  const visibleCategories = getVisibleToolCategories();
  const matchingTools = searchTools(searchQuery);
  const hasAnyTools = visibleCategories.some((category) =>
    filterToolsForCategory(matchingTools, category.id),
  );

  const categoriesToShow =
    activeFilter === "all"
      ? visibleCategories
      : visibleCategories.filter((category) => category.id === activeFilter);

  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">
          ¿Qué quieres hacer con tu PDF?
        </h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          Busca por nombre o explora por tipo de tarea. Todo se procesa en tu
          navegador.
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-5">
        <ToolSearchField
          className="max-w-xl"
          placeholder="Ej.: unir, comprimir, word, firmar…"
          onChange={setSearchQuery}
        />

        <div
          role="group"
          aria-label="Filtrar por tipo de tarea"
          className="flex max-w-full flex-wrap justify-center gap-2 px-1"
        >
          <CategoryFilterChip
            active={activeFilter === "all"}
            label="Ver todo"
            count={matchingTools.length}
            onClick={() => setActiveFilter("all")}
          />
          {visibleCategories.map((category) => (
            <CategoryFilterChip
              key={category.id}
              active={activeFilter === category.id}
              label={category.label}
              count={filterToolsForCategory(matchingTools, category.id).length}
              onClick={() => setActiveFilter(category.id)}
            />
          ))}
        </div>
      </div>

      <div className="mt-12 space-y-14 md:mt-14 md:space-y-16">
        {!hasAnyTools ? (
          <p className="text-center text-base text-muted-foreground">
            {searchQuery
              ? `No hay herramientas que coincidan con «${searchQuery}».`
              : "Todavía no hay herramientas disponibles."}
          </p>
        ) : (
          categoriesToShow.map((category) => {
            const tools = filterToolsForCategory(matchingTools, category.id);
            if (tools.length === 0 && activeFilter !== "all") {
              return null;
            }

            return (
              <CategorySection
                key={category.id}
                category={category}
                tools={tools}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
