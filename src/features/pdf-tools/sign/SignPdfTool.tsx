import { useReducer } from "react";
import { PenTool, Loader2, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import { validateSinglePdfFile } from "@/features/pdf-tools/shared/fileValidation";
import { getPdfPageCount } from "@/features/pdf-tools/shared/pdfPreview";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";

interface SignPdfState {
  selectedFile: File | null;
  signatureImage: File | null;
  pageCount: number;
  page: number;
  xPos: number;
  yPos: number;
  width: number;
  height: number;
  isProcessing: boolean;
  errorMessage: string | null;
  downloadResult: DownloadResult | null;
}

type SignatureOptionsPatch = Partial<
  Pick<SignPdfState, "page" | "xPos" | "yPos" | "width" | "height">
>;

type SignPdfAction =
  | { type: "start-file-load" }
  | { type: "file-loaded"; file: File; pageCount: number }
  | { type: "signature-selected"; file: File }
  | { type: "clear-signature" }
  | { type: "signature-options"; patch: SignatureOptionsPatch }
  | { type: "start-processing" }
  | { type: "finish-processing" }
  | { type: "download-ready"; result: DownloadResult }
  | { type: "error"; message: string };

const initialSignPdfState: SignPdfState = {
  selectedFile: null,
  signatureImage: null,
  pageCount: 0,
  page: 1,
  xPos: 50,
  yPos: 50,
  width: 100,
  height: 50,
  isProcessing: false,
  errorMessage: null,
  downloadResult: null,
};

function signPdfReducer(
  state: SignPdfState,
  action: SignPdfAction,
): SignPdfState {
  switch (action.type) {
    case "start-file-load":
      return { ...state, errorMessage: null, downloadResult: null };
    case "file-loaded":
      return {
        ...state,
        selectedFile: action.file,
        pageCount: action.pageCount,
        page: Math.min(state.page, action.pageCount),
      };
    case "signature-selected":
      return { ...state, signatureImage: action.file, errorMessage: null };
    case "clear-signature":
      return { ...state, signatureImage: null };
    case "signature-options":
      return { ...state, ...action.patch };
    case "start-processing":
      return {
        ...state,
        isProcessing: true,
        errorMessage: null,
        downloadResult: null,
      };
    case "finish-processing":
      return { ...state, isProcessing: false };
    case "download-ready":
      return { ...state, downloadResult: action.result };
    case "error":
      return { ...state, errorMessage: action.message };
    default:
      return state;
  }
}

export function SignPdfTool() {
  const [state, dispatch] = useReducer(signPdfReducer, initialSignPdfState);
  const {
    selectedFile,
    signatureImage,
    pageCount,
    page,
    xPos,
    yPos,
    width,
    height,
    isProcessing,
    errorMessage,
    downloadResult,
  } = state;

  async function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateSinglePdfFile(file);
    if (!validation.isValid) {
      dispatch({
        type: "error",
        message: validation.errors[0] ?? "No se pudo leer el PDF.",
      });
      return;
    }

    dispatch({ type: "start-file-load" });

    try {
      const count = await getPdfPageCount(file);
      dispatch({ type: "file-loaded", file, pageCount: count });
    } catch {
      dispatch({
        type: "error",
        message: "Error al contar las páginas del PDF.",
      });
    }
  }

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      dispatch({ type: "signature-selected", file });
    } else {
      dispatch({
        type: "error",
        message: "La firma debe ser una imagen PNG o JPG.",
      });
    }
  }

  async function handleSignPdf() {
    if (!selectedFile || !signatureImage) return;

    dispatch({ type: "start-processing" });

    try {
      const pdfBuffer = await selectedFile.arrayBuffer();
      const imgBuffer = await signatureImage.arrayBuffer();

      const worker = createPdfOperationWorker();
      const result = await runPdfOperation(worker, {
        kind: "sign-pdf",
        file: { name: selectedFile.name, buffer: pdfBuffer },
        options: {
          page: page - 1, // 0-indexed in pdf-lib
          x: xPos,
          y: yPos,
          width,
          height,
          signatureImage: imgBuffer,
        },
      });

      if (result.kind === "file") {
        const blob = new Blob([result.buffer], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        dispatch({
          type: "download-ready",
          result: {
            url,
            fileName: selectedFile.name.replace(/\.pdf$/i, "") + "-firmado.pdf",
            mimeType: result.mimeType,
          },
        });
      } else {
        throw new Error("Respuesta inesperada");
      }
      worker.terminate();
    } catch (error) {
      dispatch({
        type: "error",
        message:
          error instanceof Error ? error.message : "Error al firmar PDF.",
      });
    } finally {
      dispatch({ type: "finish-processing" });
    }
  }

  const primaryAction = (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={handleSignPdf}
      disabled={!selectedFile || !signatureImage || isProcessing}
      className="w-full"
    >
      {isProcessing ? (
        <Loader2
          className="animate-spin"
          data-icon="inline-start"
          aria-hidden
        />
      ) : (
        <PenTool data-icon="inline-start" aria-hidden />
      )}
      {isProcessing ? "Firmando documento" : "Estampar firma"}
    </Button>
  );

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={Boolean(selectedFile)}
      isProcessing={isProcessing}
      onFilesSelected={handleFilesSelected}
      emptyTitle="Selecciona un PDF a firmar"
      emptyDescription="Sube un PDF y luego sube tu firma (PNG/JPG) para estamparla."
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={
        selectedFile ? (
          <div className="flex h-full items-center justify-center bg-card rounded-xl border flex-col gap-6 text-muted-foreground p-8 text-center overflow-y-auto">
            {!signatureImage ? (
              <div className="flex flex-col items-center gap-4">
                <ImageIcon className="size-16 opacity-50" />
                <p className="font-medium text-foreground">Sube tu firma</p>
                <label className="cursor-pointer bg-brand hover:bg-brand/90 text-primary-foreground px-4 py-2 rounded-md font-medium text-sm transition-colors">
                  Seleccionar imagen (PNG/JPG)
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    onChange={handleSignatureUpload}
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="border border-brand p-2 bg-white rounded flex items-center justify-center"
                  style={{ width: width, height: height }}
                >
                  <img
                    src={URL.createObjectURL(signatureImage)}
                    className="max-w-full max-h-full object-contain"
                    alt="Firma"
                  />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Configuración de firma
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-4 text-left">
                    <label className="flex flex-col gap-1">
                      Página (1-{pageCount})
                      <input
                        type="number"
                        min={1}
                        max={pageCount}
                        value={page}
                        onChange={(e) =>
                          dispatch({
                            type: "signature-options",
                            patch: { page: parseInt(e.target.value) || 1 },
                          })
                        }
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                    <div />
                    <label className="flex flex-col gap-1">
                      Posición X (puntos)
                      <input
                        type="number"
                        value={xPos}
                        onChange={(e) =>
                          dispatch({
                            type: "signature-options",
                            patch: { xPos: parseInt(e.target.value) || 0 },
                          })
                        }
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Posición Y (puntos)
                      <input
                        type="number"
                        value={yPos}
                        onChange={(e) =>
                          dispatch({
                            type: "signature-options",
                            patch: { yPos: parseInt(e.target.value) || 0 },
                          })
                        }
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Ancho (puntos)
                      <input
                        type="number"
                        value={width}
                        onChange={(e) =>
                          dispatch({
                            type: "signature-options",
                            patch: { width: parseInt(e.target.value) || 0 },
                          })
                        }
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      Alto (puntos)
                      <input
                        type="number"
                        value={height}
                        onChange={(e) =>
                          dispatch({
                            type: "signature-options",
                            patch: { height: parseInt(e.target.value) || 0 },
                          })
                        }
                        className="border rounded px-2 py-1 bg-background text-foreground"
                      />
                    </label>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch({ type: "clear-signature" })}
                >
                  Cambiar firma
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div />
        )
      }
      sidebarTitle="Firmar PDF"
      sidebarDescription="Añade tu firma o un sello visual al documento."
      sidebar={
        <div className="text-sm text-muted-foreground flex flex-col gap-2">
          <p>1. Selecciona el PDF.</p>
          <p>2. Sube una imagen de tu firma (preferiblemente PNG sin fondo).</p>
          <p>3. Ajusta la posición y tamaño.</p>
          <p>4. Guarda el documento.</p>
        </div>
      }
      primaryAction={primaryAction}
      errorMessage={errorMessage}
      resultBanner={
        downloadResult ? (
          <DownloadReadyBanner downloadResult={downloadResult} />
        ) : null
      }
    />
  );
}
