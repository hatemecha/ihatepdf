import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TOOL_STATUS_LABEL, type Tool } from "@/tools/toolCatalog";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  tool: Tool;
}

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = tool.icon;
  const statusLabel = TOOL_STATUS_LABEL[tool.status];
  const statusVariant = tool.status === "available" ? "brand" : "muted";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md",
        tool.highlight && "border-brand",
      )}
    >
      <Link
        to={`/herramientas/${tool.slug}`}
        className="absolute inset-0"
        aria-label={`Abrir ${tool.name}`}
      />
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-4">
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-lg border border-border bg-muted text-foreground transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-brand-foreground",
              tool.highlight && "border-brand bg-brand text-brand-foreground",
            )}
          >
            <Icon className="size-6" aria-hidden />
          </div>
          <ArrowUpRight
            className="size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">{tool.name}</CardTitle>
          {tool.highlight ? <Badge variant="brand">Destacada</Badge> : null}
        </div>
        <CardDescription className="leading-relaxed">
          {tool.description}
        </CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter className="pt-0">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </CardFooter>
    </Card>
  );
}
