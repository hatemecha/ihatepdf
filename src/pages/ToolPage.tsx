import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ExperimentalToolBadge } from "@/components/ExperimentalToolBadge";
import { Button } from "@/components/ui/button";
import {
  AdvancedPdfTool,
  getAdvancedPdfOperationConfig,
} from "@/features/pdf-tools/document/AdvancedPdfTool";
import {
  getSinglePdfOperationConfig,
  SinglePdfOperationTool,
} from "@/features/pdf-tools/document/SinglePdfOperationTool";
import {
  ImageToPdfTool,
  ModeSwitch,
  persistWorkspaceMode,
  readStoredWorkspaceMode,
  type ImageToPdfMode,
} from "@/features/pdf-tools/images/ImageToPdfTool";
import type { ImageToPdfLayoutImageImport } from "@/features/pdf-tools/images/layout/ImageToPdfLayoutEditor";
import { PdfToImagesTool } from "@/features/pdf-tools/images/PdfToImagesTool";
import { MergePdfTool } from "@/features/pdf-tools/merge/MergePdfTool";
import { MetadataTool } from "@/features/pdf-tools/metadata/MetadataTool";
import { ExtractTextTool } from "@/features/pdf-tools/extract/ExtractTextTool";
import { ExtractImagesTool } from "@/features/pdf-tools/extract/ExtractImagesTool";
import { ScanToPdfTool } from "@/features/pdf-tools/scan/ScanToPdfTool";
import { OcrTool } from "@/features/pdf-tools/ocr/OcrTool";
import { SignPdfTool } from "@/features/pdf-tools/sign/SignPdfTool";
import { PdfToWordTool } from "@/features/pdf-tools/convert/PdfToWordTool";
import { PdfToExcelTool } from "@/features/pdf-tools/convert/PdfToExcelTool";
import { PdfToPowerpointTool } from "@/features/pdf-tools/convert/PdfToPowerpointTool";
import { OfficeToPdfTool } from "@/features/pdf-tools/convert/OfficeToPdfTool";
import { RepairPdfTool } from "@/features/pdf-tools/repair/RepairPdfTool";
import { FormsPdfTool } from "@/features/pdf-tools/forms/FormsPdfTool";
import { usePageSeo } from "@/hooks/usePageSeo";
import {
  buildToolPageDescription,
  buildToolPageTitle,
} from "@/lib/seo";
import { buildToolStructuredData } from "@/lib/seoStructuredData";
import { NotFoundPage } from "@/pages/NotFoundPage";
import {
  getToolBySlug,
  isExperimentalTool,
  type Tool,
} from "@/tools/toolCatalog";

export function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = slug ? getToolBySlug(slug) : undefined;
  const imageToPdfImportTokenRef = useRef(0);
  const imageToPdfSimpleFilesRef = useRef<File[]>([]);
  const [imageToPdfMode, setImageToPdfMode] = useState<ImageToPdfMode>(() =>
    readStoredWorkspaceMode(),
  );
  const [layoutImageImport, setLayoutImageImport] =
    useState<ImageToPdfLayoutImageImport | null>(null);

  const registerImageToPdfSimpleFiles = useCallback((files: File[]) => {
    imageToPdfSimpleFilesRef.current = files;
  }, []);

  const switchImageToPdfToSimple = useCallback(() => {
    persistWorkspaceMode("simple");
    setLayoutImageImport(null);
    setImageToPdfMode("simple");
  }, []);

  const switchImageToPdfToLayout = useCallback(() => {
    persistWorkspaceMode("layout");
    const files = [...imageToPdfSimpleFilesRef.current];

    if (files.length > 0) {
      imageToPdfImportTokenRef.current += 1;
      setLayoutImageImport({
        token: imageToPdfImportTokenRef.current,
        files,
      });
    } else {
      setLayoutImageImport(null);
    }

    setImageToPdfMode("layout");
  }, []);

  const consumeLayoutImageImport = useCallback(() => {
    setLayoutImageImport(null);
  }, []);

  const seo = useMemo(() => {
    if (!tool || tool.status !== "available") {
      return null;
    }
    return {
      title: buildToolPageTitle(tool.name),
      description: buildToolPageDescription(
        tool.name,
        tool.description,
        tool.longDescription,
      ),
      path: `/herramientas/${tool.slug}`,
      jsonLd: buildToolStructuredData(tool),
    };
  }, [tool]);

  usePageSeo(
    seo ?? {
      title: "Herramienta no encontrada",
      description: "La herramienta PDF solicitada no existe en iHatePDF.",
      path: slug ? `/herramientas/${slug}` : "/herramientas",
      noIndex: true,
    },
  );

  if (!tool || tool.status !== "available") {
    return <NotFoundPage />;
  }

  const headerActions =
    tool.implementation === "images-to-pdf" ? (
      <ModeSwitch
        mode={imageToPdfMode}
        onSimple={switchImageToPdfToSimple}
        onLayout={switchImageToPdfToLayout}
      />
    ) : null;

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <h1 className="sr-only">
        {tool.name} online gratis — iHatePDF
      </h1>
      <ToolHeader tool={tool} actions={headerActions} />
      <div className="container-tool min-h-0 flex-1 overflow-hidden pb-4 pt-3">
        {tool.implementation === "merge-pdfs" ? <MergePdfTool /> : null}
        {tool.implementation === "compress-pdf" ||
        tool.implementation === "watermark-pdf" ||
        tool.implementation === "number-pages" ||
        tool.implementation === "protect-pdf" ||
        tool.implementation === "unlock-pdf" ||
        tool.implementation === "crop-pdf" ||
        tool.implementation === "remove-metadata" ? (
          <AdvancedPdfTool
            config={getAdvancedPdfOperationConfig(tool.implementation)}
          />
        ) : null}
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
          <ImageToPdfTool
            mode={imageToPdfMode}
            layoutImageImport={layoutImageImport}
            onLayoutImportConsumed={consumeLayoutImageImport}
            onRegisterSimpleFiles={registerImageToPdfSimpleFiles}
            onSwitchToSimple={switchImageToPdfToSimple}
          />
        ) : null}
        {tool.implementation === "pdf-to-images" ? <PdfToImagesTool /> : null}
        {tool.implementation === "view-metadata" ? <MetadataTool /> : null}
        {tool.implementation === "pdf-to-text" ? <ExtractTextTool /> : null}
        {tool.implementation === "extract-images" ? (
          <ExtractImagesTool />
        ) : null}
        {tool.implementation === "scan-to-pdf" ? <ScanToPdfTool /> : null}
        {tool.implementation === "ocr-pdf" ? <OcrTool /> : null}
        {tool.implementation === "sign-pdf" ? <SignPdfTool /> : null}
        {tool.implementation === "pdf-to-word" ? <PdfToWordTool /> : null}
        {tool.implementation === "pdf-to-excel" ? <PdfToExcelTool /> : null}
        {tool.implementation === "pdf-to-powerpoint" ? (
          <PdfToPowerpointTool />
        ) : null}
        {tool.implementation === "office-to-pdf" ? <OfficeToPdfTool /> : null}
        {tool.implementation === "repair-pdf" ? <RepairPdfTool /> : null}
        {tool.implementation === "forms-pdf" ? <FormsPdfTool /> : null}
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
            <Icon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate text-sm font-medium">{tool.name}</span>
            {isExperimentalTool(tool) ? <ExperimentalToolBadge /> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
