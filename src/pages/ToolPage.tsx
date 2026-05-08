import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  getSinglePdfOperationConfig,
  SinglePdfOperationTool,
} from "@/features/pdf-tools/document/SinglePdfOperationTool";
import { ImageToPdfTool } from "@/features/pdf-tools/images/ImageToPdfTool";
import { PdfToImagesTool } from "@/features/pdf-tools/images/PdfToImagesTool";
import { MergePdfTool } from "@/features/pdf-tools/merge/MergePdfTool";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { getToolBySlug, type Tool } from "@/tools/toolCatalog";

export function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = slug ? getToolBySlug(slug) : undefined;
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  if (!tool || tool.status !== "available") {
    return <NotFoundPage />;
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <ToolHeader tool={tool} actions={headerActions} />
      <div className="container-tool min-h-0 flex-1 overflow-hidden pb-4 pt-3">
        {tool.implementation === "merge-pdfs" ? <MergePdfTool /> : null}
        {tool.implementation === "split-pdf" ||
        tool.implementation === "extract-pages" ||
        tool.implementation === "delete-pages" ||
        tool.implementation === "reorder-pages" ||
        tool.implementation === "rotate-pages" ? (
          <SinglePdfOperationTool
            config={getSinglePdfOperationConfig(tool.implementation)}
          />
        ) : null}
        {tool.implementation === "images-to-pdf" ? (
          <ImageToPdfTool onHeaderActionsChange={setHeaderActions} />
        ) : null}
        {tool.implementation === "pdf-to-images" ? <PdfToImagesTool /> : null}
      </div>
    </main>
  );
}

interface ToolHeaderProps {
  tool: Tool;
  actions: ReactNode;
}

function ToolHeader({ tool, actions }: ToolHeaderProps) {
  const Icon = tool.icon;
  return (
    <div className="shrink-0 border-b border-border bg-background">
      <div className="container-tool flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 shrink-0">
            <Link to="/#herramientas">
              <ArrowLeft data-icon="inline-start" aria-hidden />
              Volver
            </Link>
          </Button>
          <span aria-hidden className="text-border">
            /
          </span>
          <div className="flex min-w-0 items-center gap-2 text-foreground">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-sm font-medium">{tool.name}</span>
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
