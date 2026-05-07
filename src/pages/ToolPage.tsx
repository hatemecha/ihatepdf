import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getSinglePdfOperationConfig,
  SinglePdfOperationTool,
} from "@/features/pdf-tools/document/SinglePdfOperationTool";
import { ImageToPdfTool } from "@/features/pdf-tools/images/ImageToPdfTool";
import { PdfToImagesTool } from "@/features/pdf-tools/images/PdfToImagesTool";
import { MergePdfTool } from "@/features/pdf-tools/merge/MergePdfTool";
import { NotFoundPage } from "@/pages/NotFoundPage";
import {
  TOOL_STATUS_LABEL,
  getCategoryById,
  getToolBySlug,
} from "@/tools/toolCatalog";

export function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = slug ? getToolBySlug(slug) : undefined;

  if (!tool || tool.status !== "available") {
    return <NotFoundPage />;
  }

  const Icon = tool.icon;
  const category = getCategoryById(tool.category);

  return (
    <main className="container-page py-10 md:py-14">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <Button asChild variant="ghost" size="sm" className="w-fit self-start">
          <Link to="/#herramientas">
            <ArrowLeft data-icon="inline-start" aria-hidden />
            Herramientas
          </Link>
        </Button>

        <header className="flex w-full flex-col items-center gap-5 text-center md:flex-row md:items-start md:justify-between md:text-left">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-brand">
              <Icon className="size-7" aria-hidden />
            </div>
            <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
              <p className="ironic-tag justify-center sm:justify-start">
                <span className="size-1.5 rounded-full bg-brand" />
                {category?.label ?? "Herramienta PDF"}
              </p>
              <h1 className="heading-display text-balance text-4xl md:text-5xl">
                {tool.name}
              </h1>
              <p className="mt-1 max-w-3xl text-balance text-lg leading-relaxed text-muted-foreground sm:mt-3 sm:text-left">
                {tool.description} Los archivos se procesan en tu navegador y el
                resultado se descarga en tu equipo.
              </p>
            </div>
          </div>
          <Badge variant="brand" className="w-fit shrink-0 self-center md:self-start">
            {TOOL_STATUS_LABEL[tool.status]}
          </Badge>
        </header>

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
