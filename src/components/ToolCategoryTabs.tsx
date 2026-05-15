import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolCard } from "@/components/ToolCard";
import { ToolSearchField } from "@/components/ToolSearchField";
import {
  getVisibleToolCategories,
  getToolsByCategory,
  searchTools,
  type Tool,
  type ToolCategoryId,
} from "@/tools/toolCatalog";
import { cn } from "@/lib/utils";

const ALL_VALUE: ToolCategoryId | "all" = "all";

const categoryTabsTriggerClassName = "rounded-full";

function filterToolsForCategory(
  tools: Tool[],
  category: ToolCategoryId | "all",
) {
  if (category === "all") {
    return tools;
  }

  return tools.filter((tool) => tool.category === category);
}

export function ToolCategoryTabs() {
  const [searchQuery, setSearchQuery] = useState("");
  const visibleCategories = getVisibleToolCategories();
  const matchingTools = searchTools(searchQuery);
  const hasAnyTools = visibleCategories.some(
    (category) => getToolsByCategory(category.id).length > 0,
  );
  const hasSearchResults = matchingTools.length > 0;

  return (
    <Tabs defaultValue={ALL_VALUE} className="w-full">
      <div className="mb-8 flex flex-col items-center gap-6">
        <ToolSearchField onChange={setSearchQuery} />
        <div className="max-w-full overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="h-auto min-h-11 w-max flex-nowrap justify-start gap-1 rounded-full whitespace-nowrap">
            <TabsTrigger
              value={ALL_VALUE}
              className={categoryTabsTriggerClassName}
            >
              Todas
            </TabsTrigger>
            {visibleCategories.map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className={categoryTabsTriggerClassName}
              >
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <TabsContent value={ALL_VALUE} className="mt-10">
        {visibleCategories.map((category, index) => {
          const tools = filterToolsForCategory(matchingTools, category.id);
          if (tools.length === 0) return null;
          return (
            <section
              key={category.id}
              id={`cat-${category.id}`}
              className={cn(
                "scroll-mt-24 pb-12 last:pb-0",
                index === 0 ? "pt-0" : "mt-14 border-t border-border pt-14",
              )}
            >
              <header className="mb-8 space-y-2 text-center">
                <h3 className="text-xl font-semibold">{category.label}</h3>
                <p className="mx-auto max-w-2xl text-balance text-base text-muted-foreground">
                  {category.description}
                </p>
              </header>
              <div className="flex flex-wrap justify-center gap-5">
                {tools.map((tool) => (
                  <div key={tool.slug} className="w-full sm:w-80">
                    <ToolCard tool={tool} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {!hasAnyTools ? (
          <p className="text-center text-base text-muted-foreground">
            Todavía no hay herramientas disponibles.
          </p>
        ) : null}
        {hasAnyTools && searchQuery && !hasSearchResults ? (
          <p className="text-center text-base text-muted-foreground">
            No hay herramientas que coincidan con «{searchQuery}».
          </p>
        ) : null}
      </TabsContent>

      {visibleCategories.map((category) => {
        const tools = filterToolsForCategory(matchingTools, category.id);
        return (
          <TabsContent key={category.id} value={category.id} className="mt-10">
            <header className="mb-8 space-y-2 text-center">
              <h3 className="text-xl font-semibold">{category.label}</h3>
              <p className="mx-auto max-w-2xl text-balance text-base text-muted-foreground">
                {category.description}
              </p>
            </header>
            {tools.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-5">
                {tools.map((tool) => (
                  <div key={tool.slug} className="w-full sm:w-80">
                    <ToolCard tool={tool} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-base text-muted-foreground">
                {searchQuery
                  ? `No hay herramientas que coincidan con «${searchQuery}».`
                  : "No hay herramientas en esta categoría."}
              </p>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
