import { useState } from "react";
import { Images, Loader2 } from "lucide-react";
import JSZip from "jszip";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import { loadPdfDocument } from "@/features/pdf-tools/shared/pdfPreview";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import * as pdfjsLib from "pdfjs-dist";

export function ExtractImagesTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);

  function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] ?? "No se pudo leer el PDF.");
      return;
    }

    setErrorMessage(null);
    setDownloadResult(null);
    setSelectedFile(file);
  }

  async function handleExtractImages() {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setDownloadResult(null);

    try {
      const pdf = await loadPdfDocument(selectedFile);
      const zip = new JSZip();
      let imageCount = 0;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const ops = await page.getOperatorList();

        for (let j = 0; j < ops.fnArray.length; j++) {
          const fn = ops.fnArray[j];
          if (
            fn === pdfjsLib.OPS.paintImageXObject ||
            fn === pdfjsLib.OPS.paintImageXObjectRepeat
          ) {
            const objId: string = ops.argsArray[j][0];
            try {
              let imgObj: any;
              if (page.objs.has(objId)) {
                imgObj = page.objs.get(objId);
              } else {
                imgObj = await new Promise<any>((resolve) => {
                  page.objs.get(objId, (data: any) => resolve(data));
                });
              }

              if (!imgObj || !imgObj.width || !imgObj.height) continue;

              const canvas = document.createElement("canvas");
              canvas.width = imgObj.width;
              canvas.height = imgObj.height;
              const ctx = canvas.getContext("2d");
              if (!ctx) continue;

              if (imgObj.bitmap) {
                ctx.drawImage(imgObj.bitmap, 0, 0);
              } else if (imgObj.data) {
                const imgData = ctx.createImageData(imgObj.width, imgObj.height);
                if (imgObj.data.length === imgObj.width * imgObj.height * 4) {
                  imgData.data.set(imgObj.data);
                } else if (imgObj.data.length === imgObj.width * imgObj.height * 3) {
                  for (let k = 0, l = 0; k < imgObj.data.length; k += 3, l += 4) {
                    imgData.data[l] = imgObj.data[k];
                    imgData.data[l + 1] = imgObj.data[k + 1];
                    imgData.data[l + 2] = imgObj.data[k + 2];
                    imgData.data[l + 3] = 255;
                  }
                } else {
                  continue;
                }
                ctx.putImageData(imgData, 0, 0);
              } else {
                continue;
              }

              const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/png")
              );
              if (blob) {
                imageCount++;
                zip.file(`image-${i}-${imageCount}.png`, blob);
              }
            } catch (e) {
              console.warn("Could not extract image object", objId, e);
            }
          }
        }
      }

      if (imageCount === 0) {
        throw new Error("No se encontraron imágenes en este PDF.");
      }

      const zipBytes = await zip.generateAsync({ type: "uint8array" });
      const blob = new Blob([zipBytes as any], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      
      const fileName = selectedFile.name.replace(/\.pdf$/i, "") + "-imagenes.zip";
      
      setDownloadResult({
        url,
        fileName,
        mimeType: "application/zip",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Error al extraer imágenes.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleExtractImages}
      disabled={!selectedFile || isProcessing}
      className="w-full"
    >
      {isProcessing ? (
        <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
      ) : (
        <Images data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Extrayendo imágenes" : "Extraer y descargar ZIP"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF"
      emptyDescription="Extrae todas las imágenes incrustadas dentro del documento PDF."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-4 text-muted-foreground p-8 text-center">
            <Images className="size-16 opacity-50" />
            <div>
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm">Listo para extraer las imágenes.</p>
            </div>
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="Extraer imágenes"
      sidebarDescription="Encuentra todas las imágenes del documento y descárgalas en un archivo ZIP."
      sidebar={<div className="text-sm text-muted-foreground">Esta herramienta extrae las imágenes originales del documento, tal como fueron insertadas (sin reducir la resolución).</div>}
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={downloadResult ? <DownloadReadyBanner downloadResult={downloadResult} /> : null}
    />
  );
}
