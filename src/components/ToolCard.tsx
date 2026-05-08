import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Tool } from "@/tools/toolCatalog";

interface ToolCardProps {
  tool: Tool;
}

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = tool.icon;

  return (
    <Card className="group relative h-full min-h-52 overflow-hidden transition-colors duration-200 hover:border-brand focus-within:border-brand focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
      <Link
        to={`/herramientas/${tool.slug}`}
        className="absolute inset-0 focus-visible:outline-none"
        aria-label={`Abrir ${tool.name}`}
      />
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
            <Icon className="size-5" aria-hidden />
          </div>
          <ArrowUpRight
            className="size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{tool.name}</CardTitle>
          {tool.highlight ? <Badge variant="brand">Destacada</Badge> : null}
        </div>
        <CardDescription className="text-sm leading-relaxed">
          {tool.description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
