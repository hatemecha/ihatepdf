import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { ExperimentalToolBadge } from "@/components/ExperimentalToolBadge";
import { Badge } from "@/components/ui/badge";
import { isExperimentalTool } from "@/tools/toolCatalog";
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
    <Link
      to={`/herramientas/${tool.slug}`}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      title={`${tool.name} — ${tool.description}`}
      aria-label={`${tool.name}: ${tool.description}`}
    >
      <Card className="h-full min-h-52 overflow-hidden transition-colors duration-200 group-hover:border-brand group-focus-visible:border-brand">
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
            {isExperimentalTool(tool) ? <ExperimentalToolBadge /> : null}
          </div>
          <CardDescription className="text-sm leading-relaxed">
            {tool.description}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
