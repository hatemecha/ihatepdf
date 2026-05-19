import { useState } from "react";
import { Loader2, Presentation } from "lucide-react";
import pptxgen from "pptxgenjs";

import { Button } from "@/components/ui/button";
import {
  buildPageLayout,
  type ConvertedPageLayout,
  type PositionedImage,
} from "@/features/pdf-tools/convert/pdfToWordConversion";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import { extractPageEmbeddedImages } from "@/features/pdf-tools/shared/pdfEmbeddedImages";
import {
  loadPdfDocument,
  getPdfjs,
} from "@/features/pdf-tools/shared/pdfPreview";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";

const PDF_POINTS_PER_INCH = 72;
const MIN_TEXT_BOX_HEIGHT_IN = 0.12;
const MIN_TEXT_BOX_WIDTH_IN = 0.18;

function pointsToInches(points: number, scale: number): number {
  return Math.max(0, points * scale);
}

function bytesToDataUri(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

function getSlideMetrics(
  layout: ConvertedPageLayout,
  slideWidth: number,
  slideHeight: number,
) {
  const scale = Math.min(
    slideWidth / layout.width,
    slideHeight / layout.height,
  );
  const contentWidth = layout.width * scale;
  const contentHeight = layout.height * scale;

  return {
    scale,
    fontScale: scale * PDF_POINTS_PER_INCH,
    offsetX: (slideWidth - contentWidth) / 2,
    offsetY: (slideHeight - contentHeight) / 2,
  };
}

function addImageToSlide(
  slide: pptxgen.Slide,
  image: PositionedImage,
  layout: ConvertedPageLayout,
  slideWidth: number,
  slideHeight: number,
) {
  const metrics = getSlideMetrics(layout, slideWidth, slideHeight);
  const imageData = bytesToDataUri(image.data, "image/png");

  if (image.bounds) {
    slide.addImage({
      data: imageData,
      x: metrics.offsetX + pointsToInches(image.bounds.x, metrics.scale),
      y:
        metrics.offsetY +
        pointsToInches(
          layout.height - image.bounds.y - image.bounds.height,
          metrics.scale,
        ),
      w: Math.max(
        MIN_TEXT_BOX_WIDTH_IN,
        pointsToInches(image.bounds.width, metrics.scale),
      ),
      h: Math.max(
        MIN_TEXT_BOX_HEIGHT_IN,
        pointsToInches(image.bounds.height, metrics.scale),
      ),
    });
    return;
  }

  const maxWidth = slideWidth * 0.7;
  const maxHeight = slideHeight * 0.55;
  const imageRatio = image.width / Math.max(image.height, 1);
  const width = Math.min(maxWidth, maxHeight * imageRatio);
  const height = width / Math.max(imageRatio, 0.01);

  slide.addImage({
    data: imageData,
    x: (slideWidth - width) / 2,
    y: (slideHeight - height) / 2,
    w: width,
    h: height,
  });
}

function addTextLineToSlide(
  slide: pptxgen.Slide,
  layout: ConvertedPageLayout,
  line: ConvertedPageLayout["lines"][number],
  slideWidth: number,
  slideHeight: number,
) {
  const metrics = getSlideMetrics(layout, slideWidth, slideHeight);
  const y = layout.height - line.y - line.height;
  const richText = line.runs.map((run) => ({
    text: run.text,
    options: {
      bold: run.bold || undefined,
      italic: run.italic || undefined,
      fontFace: run.fontFamily,
      fontSize: Math.max(1, Math.round(run.fontSize * metrics.fontScale)),
      color: "111827",
    },
  }));

  slide.addText(richText.length > 0 ? richText : line.text, {
    x: metrics.offsetX + pointsToInches(line.x, metrics.scale),
    y: metrics.offsetY + pointsToInches(y, metrics.scale),
    w: Math.max(
      MIN_TEXT_BOX_WIDTH_IN,
      pointsToInches(line.width, metrics.scale),
    ),
    h: Math.max(
      MIN_TEXT_BOX_HEIGHT_IN,
      pointsToInches(line.height * 1.35, metrics.scale),
    ),
    margin: 0,
    breakLine: false,
    fit: "shrink",
    valign: "top",
  });
}

export function PdfToPowerpointTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null,
  );
  const [progress, setProgress] = useState<string | null>(null);

  function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el archivo.");
      return;
    }

    setErrorMessage(null);
    setDownloadResult(null);
    setSelectedFile(file);
  }

  async function handleConvert() {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);
    setProgress(null);

    let pdf: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;

    try {
      const [loadedPdf, pdfjs] = await Promise.all([
        loadPdfDocument(selectedFile),
        getPdfjs(),
      ]);
      pdf = loadedPdf;
      const numPages = pdf.numPages;
      let completedPages = 0;
      const imageOperators = {
        saveOp: pdfjs.OPS.save,
        restoreOp: pdfjs.OPS.restore,
        transformOp: pdfjs.OPS.transform,
        paintImageOps: [
          pdfjs.OPS.paintImageXObject,
          pdfjs.OPS.paintImageXObjectRepeat,
          pdfjs.OPS.paintInlineImageXObject,
        ].filter(
          (operator): operator is number => typeof operator === "number",
        ),
      };

      setProgress(
        numPages > 1
          ? `Procesando 0 de ${numPages} páginas…`
          : "Analizando diseño de la página…",
      );
      const pageLayouts = await Promise.all(
        Array.from({ length: numPages }, async (_, index) => {
          const pageNumber = index + 1;
          const page = await pdf!.getPage(pageNumber);

          try {
            const [textContent, imagesResult] = await Promise.allSettled([
              page.getTextContent(),
              extractPageEmbeddedImages(page, imageOperators),
            ]);

            if (textContent.status === "rejected") {
              throw new Error(
                "No se pudo leer el texto del PDF. Verifica que el archivo no esté protegido o dañado.",
              );
            }

            const viewport = page.getViewport({ scale: 1 });
            return buildPageLayout(
              textContent.value,
              { width: viewport.width, height: viewport.height },
              imagesResult.status === "fulfilled" ? imagesResult.value : [],
            );
          } finally {
            page.cleanup();
            completedPages += 1;
            if (numPages > 1) {
              setProgress(
                `Procesando ${completedPages} de ${numPages} páginas…`,
              );
            }
          }
        }),
      );

      if (
        pageLayouts.every(
          (layout) => layout.lines.length === 0 && layout.images.length === 0,
        )
      ) {
        throw new Error(
          "No se encontró texto ni imágenes editables para crear diapositivas. Si el PDF es un escaneo, usa OCR PDF primero.",
        );
      }

      const firstLayout = pageLayouts[0];
      const slideWidth = firstLayout.width / PDF_POINTS_PER_INCH;
      const slideHeight = firstLayout.height / PDF_POINTS_PER_INCH;
      const pptx = new pptxgen();
      pptx.author = "iHatePDF";
      pptx.subject = "PDF convertido a PowerPoint";
      pptx.title = selectedFile.name.replace(/\.pdf$/i, "");
      pptx.company = "iHatePDF";
      pptx.defineLayout({
        name: "PDF_PAGE",
        width: slideWidth,
        height: slideHeight,
      });
      pptx.layout = "PDF_PAGE";

      setProgress("Construyendo presentación editable…");
      for (const layout of pageLayouts) {
        const slide = pptx.addSlide();
        slide.background = { color: "FFFFFF" };

        for (const image of layout.images) {
          addImageToSlide(slide, image, layout, slideWidth, slideHeight);
        }

        for (const line of layout.lines) {
          addTextLineToSlide(slide, layout, line, slideWidth, slideHeight);
        }
      }

      const pptxBuffer = (await pptx.write({
        outputType: "arraybuffer",
      })) as ArrayBuffer;
      const blob = new Blob([pptxBuffer], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(blob);

      setDownloadResult({
        url,
        fileName: selectedFile.name.replace(/\.pdf$/i, "") + "-convertido.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Error al convertir a PowerPoint.",
      );
    } finally {
      await pdf?.destroy();
      setIsProcessing(false);
      setProgress(null);
    }
  }

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleConvert}
      disabled={!selectedFile || isProcessing}
      className="w-full"
    >
      {isProcessing ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden
        />
      ) : (
        <Presentation data-icon="inline-start" aria-hidden />
      )}
      {isProcessing
        ? "Convirtiendo a PowerPoint"
        : "Convertir PDF a PowerPoint"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Crea diapositivas PPTX editables conservando texto, tamaños, posiciones e imágenes lo mejor posible."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
            {isProcessing ? (
              <Loader2 className="size-16 animate-spin text-brand opacity-80" />
            ) : (
              <Presentation className="size-16 opacity-50 text-orange-500" />
            )}
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">
                {progress ?? "Listo para crear presentación PPTX editable."}
              </p>
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="PDF a PowerPoint"
      sidebarDescription="Diapositivas editables con diseño conservado."
      sidebar={
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Cada página se transforma en una diapositiva con texto editable,
            fuentes aproximadas, cajas posicionadas e imágenes independientes.
          </p>
          <p>
            PDFs escaneados necesitan{" "}
            <strong className="text-foreground">OCR PDF</strong> primero para
            generar texto editable.
          </p>
        </div>
      }
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={
        downloadResult ? (
          <DownloadReadyBanner
            downloadResult={downloadResult}
            onDismiss={() => setDownloadResult(null)}
          />
        ) : null
      }
    />
  );
}
