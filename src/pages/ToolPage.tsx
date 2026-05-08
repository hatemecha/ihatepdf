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
import { getToolBySlug } from "@/tools/toolCatalog";

export function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = slug ? getToolBySlug(slug) : undefined;

  if (!tool || tool.status !== "available") {
    return <NotFoundPage />;
  }

  const Icon = tool.icon;

  return (
    <main className="container-page flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 py-2.5">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/#herramientas">
            <ArrowLeft data-icon="inline-start" aria-hidden />
            Volver
          </Link>
        </Button>
        <span aria-hidden className="text-muted-foreground">
          /
        </span>
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate text-sm font-medium">{tool.name}</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden pb-4">
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
        {tool.implementation === "images-to-pdf" ? <ImageToPdfTool /> : null}
        {tool.implementation === "pdf-to-images" ? <PdfToImagesTool /> : null}
      </div>
    </main>
  );
}
