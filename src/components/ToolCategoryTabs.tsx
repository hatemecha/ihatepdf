import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolCard } from "@/components/ToolCard";
import {
  TOOLS,
  getVisibleToolCategories,
  getToolsByCategory,
  type ToolCategoryId,
} from "@/tools/toolCatalog";

const ALL_VALUE: ToolCategoryId | "all" = "all";

export function ToolCategoryTabs() {
  const visibleCategories = getVisibleToolCategories();
  const hasAnyTools = visibleCategories.some(
    (category) => getToolsByCategory(category.id).length > 0,
  );

  return (
    <Tabs defaultValue={ALL_VALUE} className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Herramientas disponibles</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Solo mostramos herramientas que ya se pueden usar.
          </p>
        </div>
        <div className="overflow-x-auto">
          <TabsList className="h-auto flex-wrap gap-1 rounded-full">
            <TabsTrigger value={ALL_VALUE}>Todas</TabsTrigger>
            {visibleCategories.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <TabsContent value={ALL_VALUE}>
        {visibleCategories.map((category) => {
          const tools = getToolsByCategory(category.id);
          if (tools.length === 0) return null;
          return (
            <section
              key={category.id}
              id={`cat-${category.id}`}
              className="scroll-mt-24 pt-8 first:pt-0"
            >
              <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-xl font-semibold">{category.label}</h3>
                <p className="text-base text-muted-foreground">
                  {category.description}
                </p>
              </header>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tools.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} />
                ))}
              </div>
            </section>
          );
        })}
        {!hasAnyTools ? (
          <p className="text-base text-muted-foreground">
            Todavia no hay herramientas disponibles.
          </p>
        ) : null}
      </TabsContent>

      {visibleCategories.map((category) => {
        const tools = getToolsByCategory(category.id);
        return (
          <TabsContent key={category.id} value={category.id}>
            <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-xl font-semibold">{category.label}</h3>
              <p className="text-base text-muted-foreground">
                {category.description}
              </p>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
