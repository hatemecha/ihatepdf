import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolCard } from "@/components/ToolCard";
import {
  getVisibleToolCategories,
  getToolsByCategory,
  type ToolCategoryId,
} from "@/tools/toolCatalog";
import { cn } from "@/lib/utils";

const ALL_VALUE: ToolCategoryId | "all" = "all";

const categoryTabsTriggerClassName = "rounded-full";

export function ToolCategoryTabs() {
  const visibleCategories = getVisibleToolCategories();
  const hasAnyTools = visibleCategories.some(
    (category) => getToolsByCategory(category.id).length > 0,
  );

  return (
    <Tabs defaultValue={ALL_VALUE} className="w-full">
      <div className="mb-10 flex justify-center px-1">
        <div className="max-w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          const tools = getToolsByCategory(category.id);
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
      </TabsContent>

      {visibleCategories.map((category) => {
        const tools = getToolsByCategory(category.id);
        return (
          <TabsContent key={category.id} value={category.id} className="mt-10">
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
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
