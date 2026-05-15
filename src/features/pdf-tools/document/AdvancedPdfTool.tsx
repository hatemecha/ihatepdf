import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
} from "react";
import {
  Crop,
  FileArchive,
  Hash,
  Loader2,
  Lock,
  Stamp,
  Unlock,
  Eraser,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DownloadReadyBanner,
  type DownloadResult,
} from "@/features/pdf-tools/shared/DownloadReadyBanner";
import {
  PdfFocusedPreview,
  type PdfFocusedPreviewMetrics,
} from "@/features/pdf-tools/shared/PdfFocusedPreview";
import { ToolWorkspace } from "@/features/pdf-tools/shared/ToolWorkspace";
import {
  formatFileSize,
  validateSinglePdfFile,
} from "@/features/pdf-tools/shared/fileValidation";
import { getPdfPageCount } from "@/features/pdf-tools/shared/pdfPreview";
import {
  createPdfOperationWorker,
  runPdfOperation,
} from "@/features/pdf-tools/shared/pdfOperationClient";
import type {
  CropMargins,
  PageNumberPosition,
  PdfInputFile,
  PdfOperationRequest,
} from "@/features/pdf-tools/shared/pdfOperation.types";
import {
  DEFAULT_PAGE_NUMBER_FONT,
  PAGE_NUMBER_FONT_OPTIONS,
  type PageNumberFontId,
  getPageNumberPreviewFontStyle,
} from "@/features/pdf-tools/shared/pageNumberFonts";

export type AdvancedPdfOperation =
  | "compress-pdf"
  | "watermark-pdf"
  | "number-pages"
  | "protect-pdf"
  | "unlock-pdf"
  | "crop-pdf"
  | "remove-metadata";

interface AdvancedPdfOperationConfig {
  operation: AdvancedPdfOperation;
  toolTitle: string;
  toolDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel: string;
  processingLabel: string;
  actionIcon: LucideIcon;
  skipPreviewInspection?: boolean;
}

interface AdvancedPdfRuntimeState {
  selectedFiles: File[];
  pageCount: number;
  isProcessing: boolean;
  errorMessage: string | null;
  downloadResult: DownloadResult | null;
}

type AdvancedPdfRuntimeAction =
  | { type: "beginWork" }
  | { type: "endWork" }
  | { type: "setError"; message: string | null }
  | { type: "setDownloadResult"; result: DownloadResult | null }
  | { type: "setFiles"; files: File[]; pageCount: number }
  | { type: "clearFiles" };

const DEFAULT_RUNTIME_STATE: AdvancedPdfRuntimeState = {
  selectedFiles: [],
  pageCount: 0,
  isProcessing: false,
  errorMessage: null,
  downloadResult: null,
};

function runtimeReducer(
  state: AdvancedPdfRuntimeState,
  action: AdvancedPdfRuntimeAction,
): AdvancedPdfRuntimeState {
  switch (action.type) {
    case "beginWork":
      return {
        ...state,
        isProcessing: true,
        errorMessage: null,
        downloadResult: null,
      };
    case "endWork":
      return { ...state, isProcessing: false };
    case "setError":
      return { ...state, errorMessage: action.message };
    case "setDownloadResult":
      return { ...state, downloadResult: action.result };
    case "setFiles":
      return {
        ...state,
        selectedFiles: action.files,
        pageCount: action.pageCount,
      };
    case "clearFiles":
      return {
        ...state,
        selectedFiles: [],
        pageCount: 0,
        errorMessage: null,
        downloadResult: null,
      };
  }
}

interface WatermarkSettings {
  text: string;
  opacity: number;
  fontSize: number;
  rotation: number;
}

interface PageNumberSettings {
  startAt: number;
  fontSize: number;
  position: PageNumberPosition;
  margin: number;
  font: PageNumberFontId;
}

interface ProtectSettings {
  userPassword: string;
  ownerPassword: string;
  allowPrinting: boolean;
  allowCopying: boolean;
  allowModifying: boolean;
}

interface AdvancedPdfSettings {
  watermark: WatermarkSettings;
  pageNumbers: PageNumberSettings;
  protect: ProtectSettings;
  unlockPassword: string;
  cropMarginsMm: CropMargins;
}

type AdvancedPdfSettingsAction =
  | { type: "watermark"; patch: Partial<WatermarkSettings> }
  | { type: "pageNumbers"; patch: Partial<PageNumberSettings> }
  | { type: "protect"; patch: Partial<ProtectSettings> }
  | { type: "unlockPassword"; value: string }
  | { type: "cropMargin"; side: keyof CropMargins; value: number };

const DEFAULT_ADVANCED_SETTINGS: AdvancedPdfSettings = {
  watermark: {
    text: "CONFIDENCIAL",
    opacity: 18,
    fontSize: 48,
    rotation: -35,
  },
  pageNumbers: {
    startAt: 1,
    fontSize: 12,
    position: "bottom-center",
    margin: 12,
    font: DEFAULT_PAGE_NUMBER_FONT,
  },
  protect: {
    userPassword: "",
    ownerPassword: "",
    allowPrinting: true,
    allowCopying: true,
    allowModifying: false,
  },
  unlockPassword: "",
  cropMarginsMm: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
};

function settingsReducer(
  state: AdvancedPdfSettings,
  action: AdvancedPdfSettingsAction,
): AdvancedPdfSettings {
  switch (action.type) {
    case "watermark":
      return { ...state, watermark: { ...state.watermark, ...action.patch } };
    case "pageNumbers":
      return {
        ...state,
        pageNumbers: { ...state.pageNumbers, ...action.patch },
      };
    case "protect":
      return { ...state, protect: { ...state.protect, ...action.patch } };
    case "unlockPassword":
      return { ...state, unlockPassword: action.value };
    case "cropMargin":
      return {
        ...state,
        cropMarginsMm: {
          ...state.cropMarginsMm,
          [action.side]: Number.isFinite(action.value)
            ? Math.max(0, action.value)
            : 0,
        },
      };
  }
}

const OPERATION_CONFIGS: Record<
  AdvancedPdfOperation,
  AdvancedPdfOperationConfig
> = {
  "compress-pdf": {
    operation: "compress-pdf",
    toolTitle: "Comprimir PDF",
    toolDescription: "Optimiza el archivo y descarga una copia más compacta.",
    emptyTitle: "Selecciona un PDF para comprimir",
    emptyDescription:
      "El procesamiento se hace en tu navegador y conserva el documento como PDF.",
    actionLabel: "Comprimir PDF",
    processingLabel: "Comprimiendo PDF",
    actionIcon: FileArchive,
  },
  "watermark-pdf": {
    operation: "watermark-pdf",
    toolTitle: "Marca de agua",
    toolDescription: "Aplica texto semitransparente sobre todas las páginas.",
    emptyTitle: "Selecciona un PDF",
    emptyDescription:
      "Después define el texto de la marca y descarga una copia marcada.",
    actionLabel: "Aplicar marca",
    processingLabel: "Aplicando marca",
    actionIcon: Stamp,
  },
  "number-pages": {
    operation: "number-pages",
    toolTitle: "Numerar páginas",
    toolDescription: "Agrega números visibles en la posición que elijas.",
    emptyTitle: "Selecciona un PDF",
    emptyDescription:
      "Después ajusta inicio, posición y tamaño de la numeración.",
    actionLabel: "Numerar páginas",
    processingLabel: "Numerando páginas",
    actionIcon: Hash,
  },
  "protect-pdf": {
    operation: "protect-pdf",
    toolTitle: "Proteger PDF",
    toolDescription: "Cifra el PDF con contraseña de apertura.",
    emptyTitle: "Selecciona un PDF",
    emptyDescription:
      "La contraseña se aplica localmente antes de descargar el archivo protegido.",
    actionLabel: "Proteger PDF",
    processingLabel: "Protegiendo PDF",
    actionIcon: Lock,
  },
  "unlock-pdf": {
    operation: "unlock-pdf",
    toolTitle: "Desbloquear PDF",
    toolDescription: "Quita la contraseña usando la clave actual conocida.",
    emptyTitle: "Selecciona un PDF protegido",
    emptyDescription:
      "Escribe la contraseña actual y descarga una copia sin bloqueo.",
    actionLabel: "Desbloquear PDF",
    processingLabel: "Desbloqueando PDF",
    actionIcon: Unlock,
    skipPreviewInspection: true,
  },
  "crop-pdf": {
    operation: "crop-pdf",
    toolTitle: "Recortar PDF",
    toolDescription: "Oculta márgenes de todas las páginas sin subir archivos.",
    emptyTitle: "Selecciona un PDF",
    emptyDescription:
      "Después define cuánto recortar desde cada borde del documento.",
    actionLabel: "Recortar PDF",
    processingLabel: "Recortando PDF",
    actionIcon: Crop,
  },
  "remove-metadata": {
    operation: "remove-metadata",
    toolTitle: "Eliminar metadatos",
    toolDescription: "Limpia la información oculta del archivo.",
    emptyTitle: "Selecciona un PDF",
    emptyDescription:
      "Elimina permanentemente el autor, creador y otros datos de rastreo del PDF.",
    actionLabel: "Eliminar metadatos",
    processingLabel: "Eliminando metadatos",
    actionIcon: Eraser,
  },
};

const POSITION_OPTIONS: Array<{
  value: PageNumberPosition;
  label: string;
}> = [
  { value: "bottom-left", label: "Abajo izquierda" },
  { value: "bottom-center", label: "Abajo centro" },
  { value: "bottom-right", label: "Abajo derecha" },
  { value: "top-left", label: "Arriba izquierda" },
  { value: "top-center", label: "Arriba centro" },
  { value: "top-right", label: "Arriba derecha" },
];

const MM_TO_POINTS = 72 / 25.4;

function mmToPoints(value: number): number {
  return Math.max(0, value) * MM_TO_POINTS;
}

function createCropMargins(marginsMm: CropMargins): CropMargins {
  return {
    top: mmToPoints(marginsMm.top),
    right: mmToPoints(marginsMm.right),
    bottom: mmToPoints(marginsMm.bottom),
    left: mmToPoints(marginsMm.left),
  };
}

function clampPreview(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function renderWatermarkPreview(
  settings: WatermarkSettings,
  metrics: PdfFocusedPreviewMetrics,
) {
  const text = settings.text.trim();
  if (!text) {
    return null;
  }

  return (
    <div
      className="pdf-preview-watermark"
      style={
        {
          "--pdf-preview-watermark-font-size": `${clampPreview(settings.fontSize, 12, 120) * metrics.scale}px`,
          "--pdf-preview-watermark-opacity": clampPreview(
            settings.opacity / 100,
            0.05,
            0.8,
          ),
          "--pdf-preview-watermark-rotation": `${settings.rotation}deg`,
        } as CSSProperties
      }
    >
      {text}
    </div>
  );
}

function renderPageNumberPreview(
  settings: PageNumberSettings,
  metrics: PdfFocusedPreviewMetrics,
) {
  const label = String(Math.max(1, Math.floor(settings.startAt)));
  const margin = clampPreview(mmToPoints(settings.margin), 12, 144);
  const previewFont = getPageNumberPreviewFontStyle(settings.font);

  return (
    <div
      className="pdf-preview-page-number"
      data-position={settings.position}
      style={
        {
          "--pdf-preview-font-size": `${clampPreview(settings.fontSize, 8, 48) * metrics.scale}px`,
          "--pdf-preview-margin": `${margin * metrics.scale}px`,
          fontFamily: previewFont.fontFamily,
          fontWeight: previewFont.fontWeight,
          fontStyle: previewFont.fontStyle,
        } as CSSProperties
      }
    >
      {label}
    </div>
  );
}

function renderCropPreview(
  marginsMm: CropMargins,
  metrics: PdfFocusedPreviewMetrics,
) {
  const margins = createCropMargins(marginsMm);
  const pageWidth = metrics.pageWidth * metrics.scale;
  const pageHeight = metrics.pageHeight * metrics.scale;
  const minVisibleSize = 36 * metrics.scale;
  const maxHorizontalCrop = Math.max(0, pageWidth - minVisibleSize);
  const maxVerticalCrop = Math.max(0, pageHeight - minVisibleSize);
  const left = clampPreview(margins.left * metrics.scale, 0, maxHorizontalCrop);
  const right = clampPreview(
    margins.right * metrics.scale,
    0,
    Math.max(0, maxHorizontalCrop - left),
  );
  const top = clampPreview(margins.top * metrics.scale, 0, maxVerticalCrop);
  const bottom = clampPreview(
    margins.bottom * metrics.scale,
    0,
    Math.max(0, maxVerticalCrop - top),
  );

  if (left + right + top + bottom <= 0) {
    return null;
  }

  return (
    <>
      {top > 0 ? (
        <div
          className="pointer-events-none absolute left-0 top-0 bg-brand/20"
          style={{ width: "100%", height: top }}
        />
      ) : null}
      {bottom > 0 ? (
        <div
          className="pointer-events-none absolute bottom-0 left-0 bg-brand/20"
          style={{ width: "100%", height: bottom }}
        />
      ) : null}
      {left > 0 ? (
        <div
          className="pointer-events-none absolute left-0 bg-brand/20"
          style={{ top, bottom, width: left }}
        />
      ) : null}
      {right > 0 ? (
        <div
          className="pointer-events-none absolute right-0 bg-brand/20"
          style={{ top, bottom, width: right }}
        />
      ) : null}
      <div
        className="pointer-events-none absolute border-2 border-brand shadow-[0_0_0_1px_rgba(255,255,255,0.75)]"
        style={{ left, right, top, bottom }}
      />
    </>
  );
}

function renderAdvancedPdfPreviewOverlay(
  operation: AdvancedPdfOperation,
  settings: AdvancedPdfSettings,
  metrics: PdfFocusedPreviewMetrics,
) {
  switch (operation) {
    case "watermark-pdf":
      return renderWatermarkPreview(settings.watermark, metrics);
    case "number-pages":
      return renderPageNumberPreview(settings.pageNumbers, metrics);
    case "crop-pdf":
      return renderCropPreview(settings.cropMarginsMm, metrics);
    case "compress-pdf":
    case "protect-pdf":
    case "unlock-pdf":
    case "remove-metadata":
      return null;
  }
}

export function getAdvancedPdfOperationConfig(
  operation: AdvancedPdfOperation,
): AdvancedPdfOperationConfig {
  return OPERATION_CONFIGS[operation];
}

interface AdvancedPdfToolProps {
  config: AdvancedPdfOperationConfig;
}

function useAdvancedPdfToolController(config: AdvancedPdfOperationConfig) {
  const workerRef = useRef<Worker | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [runtime, dispatchRuntime] = useReducer(
    runtimeReducer,
    DEFAULT_RUNTIME_STATE,
  );
  const [settings, dispatchSettings] = useReducer(
    settingsReducer,
    DEFAULT_ADVANCED_SETTINGS,
  );
  const {
    selectedFiles,
    pageCount,
    isProcessing,
    errorMessage,
    downloadResult,
  } = runtime;

  const hasContent = selectedFiles.length > 0;

  const canProcess = useMemo(() => {
    if (selectedFiles.length === 0 || isProcessing) {
      return false;
    }

    switch (config.operation) {
      case "watermark-pdf":
        return settings.watermark.text.trim().length > 0;
      case "protect-pdf":
        return settings.protect.userPassword.length > 0;
      case "unlock-pdf":
        return settings.unlockPassword.length > 0;
      case "crop-pdf":
        return (
          settings.cropMarginsMm.top +
            settings.cropMarginsMm.right +
            settings.cropMarginsMm.bottom +
            settings.cropMarginsMm.left >
          0
        );
      case "compress-pdf":
      case "number-pages":
      case "remove-metadata":
        return true;
    }
  }, [
    config.operation,
    isProcessing,
    selectedFiles.length,
    settings.cropMarginsMm.bottom,
    settings.cropMarginsMm.left,
    settings.cropMarginsMm.right,
    settings.cropMarginsMm.top,
    settings.protect.userPassword.length,
    settings.unlockPassword.length,
    settings.watermark.text,
  ]);

  const replaceDownloadResult = useCallback(
    (nextResult: DownloadResult | null) => {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
      resultUrlRef.current = nextResult?.url ?? null;
      dispatchRuntime({ type: "setDownloadResult", result: nextResult });
    },
    [],
  );

  const clearDownloadResult = useCallback(() => {
    replaceDownloadResult(null);
  }, [replaceDownloadResult]);

  function clearResultOnOptionChange() {
    dispatchRuntime({ type: "setError", message: null });
    clearDownloadResult();
  }

  function updateSettings(action: AdvancedPdfSettingsAction) {
    dispatchSettings(action);
    clearResultOnOptionChange();
  }

  async function handleFilesSelected(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const firstFile = files[0];
    const validation = validateSinglePdfFile(firstFile);
    if (!validation.isValid) {
      dispatchRuntime({
        type: "setError",
        message: validation.errors[0] ?? "No se pudo leer el PDF.",
      });
      return;
    }

    dispatchRuntime({ type: "beginWork" });
    clearDownloadResult();

    try {
      if (config.skipPreviewInspection) {
        dispatchRuntime({ type: "setFiles", files, pageCount: 0 });
        return;
      }
      dispatchRuntime({
        type: "setFiles",
        files,
        pageCount: await getPdfPageCount(firstFile),
      });
    } catch (error) {
      dispatchRuntime({ type: "clearFiles" });
      dispatchRuntime({
        type: "setError",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo abrir el PDF seleccionado.",
      });
    } finally {
      dispatchRuntime({ type: "endWork" });
    }
  }

  function handleClear() {
    dispatchRuntime({ type: "clearFiles" });
    clearDownloadResult();
  }

  function cancelOperation() {
    workerRef.current?.terminate();
    workerRef.current = null;
    dispatchRuntime({ type: "endWork" });
    dispatchRuntime({ type: "setError", message: "Operación cancelada." });
  }

  function buildOperationRequest(files: PdfInputFile[]): PdfOperationRequest {
    switch (config.operation) {
      case "compress-pdf":
        return { kind: "compress-pdf", files };
      case "watermark-pdf":
        return {
          kind: "watermark-pdf",
          files,
          options: {
            text: settings.watermark.text,
            opacity: settings.watermark.opacity / 100,
            fontSize: settings.watermark.fontSize,
            rotation: settings.watermark.rotation,
          },
        };
      case "number-pages":
        return {
          kind: "number-pages",
          files,
          options: {
            startAt: settings.pageNumbers.startAt,
            fontSize: settings.pageNumbers.fontSize,
            position: settings.pageNumbers.position,
            margin: mmToPoints(settings.pageNumbers.margin),
            font: settings.pageNumbers.font,
          },
        };
      case "protect-pdf":
        return {
          kind: "protect-pdf",
          files,
          options: {
            userPassword: settings.protect.userPassword,
            ownerPassword: settings.protect.ownerPassword || undefined,
            allowPrinting: settings.protect.allowPrinting,
            allowCopying: settings.protect.allowCopying,
            allowModifying: settings.protect.allowModifying,
          },
        };
      case "unlock-pdf":
        return {
          kind: "unlock-pdf",
          files,
          password: settings.unlockPassword,
        };
      case "crop-pdf":
        return {
          kind: "crop-pdf",
          files,
          margins: createCropMargins(settings.cropMarginsMm),
        };
      case "remove-metadata":
        return {
          kind: "remove-metadata",
          files,
        };
    }
  }

  async function handleProcess() {
    if (selectedFiles.length === 0) {
      return;
    }

    dispatchRuntime({ type: "beginWork" });
    clearDownloadResult();

    try {
      const inputFiles = await Promise.all(
        selectedFiles.map(async (f) => ({
          name: f.name,
          buffer: await f.arrayBuffer(),
        }))
      );
      const worker = createPdfOperationWorker();
      workerRef.current = worker;
      const result = await runPdfOperation(
        worker,
        buildOperationRequest(inputFiles),
      );

      if (result.kind !== "file") {
        throw new Error("La operación no generó un archivo descargable.");
      }

      const blob = new Blob([result.buffer], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      replaceDownloadResult({
        url,
        fileName: result.fileName,
        mimeType: result.mimeType,
      });
    } catch (error) {
      dispatchRuntime({
        type: "setError",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo procesar el PDF.",
      });
    } finally {
      workerRef.current?.terminate();
      workerRef.current = null;
      dispatchRuntime({ type: "endWork" });
    }
  }

  function updateCropMargin(side: keyof CropMargins, value: number) {
    updateSettings({ type: "cropMargin", side, value });
  }

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
    };
  }, []);

  const preview =
    selectedFiles.length > 0 && pageCount > 0 && !config.skipPreviewInspection ? (
      <PdfFocusedPreview
        file={selectedFiles[0]}
        pageLabel={pageCount > 1 ? `Página 1 de ${pageCount}` : "Página 1"}
        overlay={(metrics) =>
          renderAdvancedPdfPreviewOverlay(config.operation, settings, metrics)
        }
      />
    ) : (
      <FileOnlyPreview
        title={config.toolTitle}
        description={
          selectedFiles.length > 1
            ? `${selectedFiles.length} PDFs seleccionados`
            : selectedFiles[0]?.name ?? "PDF seleccionado"
        }
        Icon={config.actionIcon}
      />
    );

  const sidebar = (
    <AdvancedPdfSidebar
      config={config}
      selectedFile={selectedFiles[0] ?? null}
      pageCount={pageCount}
      settings={settings}
      onChangeFile={handleClear}
      onUpdateSettings={updateSettings}
      onUpdateCropMargin={updateCropMargin}
    />
  );

  const primaryAction = (
    <AdvancedPdfActions
      config={config}
      canProcess={canProcess}
      isProcessing={isProcessing}
      onProcess={handleProcess}
      onCancel={cancelOperation}
    />
  );

  const resultBanner = downloadResult ? (
    <DownloadReadyBanner downloadResult={downloadResult} />
  ) : null;

  return {
    errorMessage,
    hasContent,
    isProcessing,
    onFilesSelected: handleFilesSelected,
    preview,
    primaryAction,
    resultBanner,
    sidebar,
  };
}

export function AdvancedPdfTool({ config }: AdvancedPdfToolProps) {
  const controller = useAdvancedPdfToolController(config);

  return (
    <ToolWorkspace
      accept="application/pdf,.pdf"
      hasContent={controller.hasContent}
      isProcessing={controller.isProcessing}
      onFilesSelected={controller.onFilesSelected}
      emptyTitle={config.emptyTitle}
      emptyDescription={config.emptyDescription}
      emptyActionLabel="Seleccionar PDF"
      emptyHint="Hasta 50 MB por archivo"
      preview={controller.preview}
      sidebarTitle={config.toolTitle}
      sidebarDescription={config.toolDescription}
      sidebar={controller.sidebar}
      primaryAction={controller.primaryAction}
      errorMessage={controller.errorMessage}
      resultBanner={controller.resultBanner}
      multiple={true}
    />
  );
}

interface AdvancedPdfSidebarProps {
  config: AdvancedPdfOperationConfig;
  selectedFile: File | null;
  pageCount: number;
  settings: AdvancedPdfSettings;
  onChangeFile: () => void;
  onUpdateSettings: (action: AdvancedPdfSettingsAction) => void;
  onUpdateCropMargin: (side: keyof CropMargins, value: number) => void;
}

function AdvancedPdfSidebar({
  config,
  selectedFile,
  pageCount,
  settings,
  onChangeFile,
  onUpdateSettings,
  onUpdateCropMargin,
}: AdvancedPdfSidebarProps) {
  return (
    <div className="flex flex-col gap-4">
      {selectedFile ? (
        <FileSummary
          file={selectedFile}
          pageCount={pageCount}
          onChange={onChangeFile}
        />
      ) : null}

      {config.operation === "compress-pdf" ? (
        <p className="text-sm text-muted-foreground">
          Se compactan objetos internos del PDF. Si el archivo ya estaba muy
          optimizado, la diferencia puede ser mínima.
        </p>
      ) : null}

      {config.operation === "watermark-pdf" ? (
        <WatermarkControls
          text={settings.watermark.text}
          opacity={settings.watermark.opacity}
          fontSize={settings.watermark.fontSize}
          rotation={settings.watermark.rotation}
          onTextChange={(text) =>
            onUpdateSettings({ type: "watermark", patch: { text } })
          }
          onOpacityChange={(opacity) =>
            onUpdateSettings({ type: "watermark", patch: { opacity } })
          }
          onFontSizeChange={(fontSize) =>
            onUpdateSettings({ type: "watermark", patch: { fontSize } })
          }
          onRotationChange={(rotation) =>
            onUpdateSettings({ type: "watermark", patch: { rotation } })
          }
        />
      ) : null}

      {config.operation === "number-pages" ? (
        <NumberPageControls
          startAt={settings.pageNumbers.startAt}
          fontSize={settings.pageNumbers.fontSize}
          margin={settings.pageNumbers.margin}
          position={settings.pageNumbers.position}
          font={settings.pageNumbers.font}
          onStartAtChange={(startAt) =>
            onUpdateSettings({ type: "pageNumbers", patch: { startAt } })
          }
          onFontSizeChange={(fontSize) =>
            onUpdateSettings({ type: "pageNumbers", patch: { fontSize } })
          }
          onMarginChange={(margin) =>
            onUpdateSettings({ type: "pageNumbers", patch: { margin } })
          }
          onPositionChange={(position) =>
            onUpdateSettings({ type: "pageNumbers", patch: { position } })
          }
          onFontChange={(font) =>
            onUpdateSettings({ type: "pageNumbers", patch: { font } })
          }
        />
      ) : null}

      {config.operation === "protect-pdf" ? (
        <ProtectControls
          userPassword={settings.protect.userPassword}
          ownerPassword={settings.protect.ownerPassword}
          allowPrinting={settings.protect.allowPrinting}
          allowCopying={settings.protect.allowCopying}
          allowModifying={settings.protect.allowModifying}
          onUserPasswordChange={(userPassword) =>
            onUpdateSettings({ type: "protect", patch: { userPassword } })
          }
          onOwnerPasswordChange={(ownerPassword) =>
            onUpdateSettings({ type: "protect", patch: { ownerPassword } })
          }
          onAllowPrintingChange={(allowPrinting) =>
            onUpdateSettings({ type: "protect", patch: { allowPrinting } })
          }
          onAllowCopyingChange={(allowCopying) =>
            onUpdateSettings({ type: "protect", patch: { allowCopying } })
          }
          onAllowModifyingChange={(allowModifying) =>
            onUpdateSettings({ type: "protect", patch: { allowModifying } })
          }
        />
      ) : null}

      {config.operation === "unlock-pdf" ? (
        <PasswordField
          label="Contraseña actual"
          value={settings.unlockPassword}
          onChange={(value) =>
            onUpdateSettings({ type: "unlockPassword", value })
          }
        />
      ) : null}

      {config.operation === "crop-pdf" ? (
        <CropControls
          margins={settings.cropMarginsMm}
          onChange={onUpdateCropMargin}
        />
      ) : null}
    </div>
  );
}

interface AdvancedPdfActionsProps {
  config: AdvancedPdfOperationConfig;
  canProcess: boolean;
  isProcessing: boolean;
  onProcess: () => void;
  onCancel: () => void;
}

function AdvancedPdfActions({
  config,
  canProcess,
  isProcessing,
  onProcess,
  onCancel,
}: AdvancedPdfActionsProps) {
  const ActionIcon = config.actionIcon;

  return (
    <>
      <Button
        type="button"
        variant="brand"
        size="lg"
        onClick={() => void onProcess()}
        disabled={!canProcess}
        className="w-full"
      >
        {isProcessing ? (
          <Loader2
            className="animate-spin"
            data-icon="inline-start"
            aria-hidden
          />
        ) : (
          <ActionIcon data-icon="inline-start" aria-hidden />
        )}
        {isProcessing ? config.processingLabel : config.actionLabel}
      </Button>
      {isProcessing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="w-full"
        >
          Cancelar
        </Button>
      ) : null}
    </>
  );
}

interface FileSummaryProps {
  file: File;
  pageCount: number;
  onChange: () => void;
}

function FileSummary({ file, pageCount, onChange }: FileSummaryProps) {
  return (
    <div className="surface-inset">
      <p className="truncate text-sm font-medium" title={file.name}>
        {file.name}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatFileSize(file.size)}
        {pageCount > 0 ? ` · ${pageCount} páginas` : ""}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 -ml-2"
        onClick={onChange}
      >
        Cambiar archivo
      </Button>
    </div>
  );
}

interface FileOnlyPreviewProps {
  title: string;
  description: string;
  Icon: LucideIcon;
}

function FileOnlyPreview({ title, description, Icon }: FileOnlyPreviewProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Icon className="size-6" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 break-all text-xs">{description}</p>
        </div>
      </div>
    </div>
  );
}

interface WatermarkControlsProps {
  text: string;
  opacity: number;
  fontSize: number;
  rotation: number;
  onTextChange: (value: string) => void;
  onOpacityChange: (value: number) => void;
  onFontSizeChange: (value: number) => void;
  onRotationChange: (value: number) => void;
}

function WatermarkControls({
  text,
  opacity,
  fontSize,
  rotation,
  onTextChange,
  onOpacityChange,
  onFontSizeChange,
  onRotationChange,
}: WatermarkControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Texto" value={text} onChange={onTextChange} />
      <NumberField
        label="Tamaño"
        value={fontSize}
        min={12}
        max={120}
        onChange={onFontSizeChange}
      />
      <NumberField
        label="Rotación"
        value={rotation}
        min={-90}
        max={90}
        onChange={onRotationChange}
      />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Opacidad {opacity}%
        <input
          type="range"
          min={5}
          max={60}
          value={opacity}
          onChange={(event) => onOpacityChange(Number(event.target.value))}
        />
      </label>
    </div>
  );
}

interface NumberPageControlsProps {
  startAt: number;
  fontSize: number;
  margin: number;
  position: PageNumberPosition;
  font: PageNumberFontId;
  onStartAtChange: (value: number) => void;
  onFontSizeChange: (value: number) => void;
  onMarginChange: (value: number) => void;
  onPositionChange: (value: PageNumberPosition) => void;
  onFontChange: (value: PageNumberFontId) => void;
}

function NumberPageControls({
  startAt,
  fontSize,
  margin,
  position,
  font,
  onStartAtChange,
  onFontSizeChange,
  onMarginChange,
  onPositionChange,
  onFontChange,
}: NumberPageControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <NumberField
        label="Iniciar en"
        value={startAt}
        min={1}
        max={9999}
        onChange={onStartAtChange}
      />
      <NumberField
        label="Tamaño"
        value={fontSize}
        min={8}
        max={48}
        onChange={onFontSizeChange}
      />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Fuente
        <select
          value={font}
          onChange={(event) =>
            onFontChange(event.target.value as PageNumberFontId)
          }
          className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {PAGE_NUMBER_FONT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <NumberField
        label="Margen (mm)"
        value={margin}
        min={4}
        max={60}
        onChange={onMarginChange}
      />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Posición
        <select
          value={position}
          onChange={(event) =>
            onPositionChange(event.target.value as PageNumberPosition)
          }
          className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {POSITION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

interface ProtectControlsProps {
  userPassword: string;
  ownerPassword: string;
  allowPrinting: boolean;
  allowCopying: boolean;
  allowModifying: boolean;
  onUserPasswordChange: (value: string) => void;
  onOwnerPasswordChange: (value: string) => void;
  onAllowPrintingChange: (value: boolean) => void;
  onAllowCopyingChange: (value: boolean) => void;
  onAllowModifyingChange: (value: boolean) => void;
}

function ProtectControls({
  userPassword,
  ownerPassword,
  allowPrinting,
  allowCopying,
  allowModifying,
  onUserPasswordChange,
  onOwnerPasswordChange,
  onAllowPrintingChange,
  onAllowCopyingChange,
  onAllowModifyingChange,
}: ProtectControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <PasswordField
        label="Contraseña de apertura"
        value={userPassword}
        onChange={onUserPasswordChange}
      />
      <PasswordField
        label="Contraseña de permisos"
        value={ownerPassword}
        onChange={onOwnerPasswordChange}
      />
      <div className="flex flex-col gap-2 text-sm">
        <CheckboxField
          label="Permitir impresión"
          checked={allowPrinting}
          onChange={onAllowPrintingChange}
        />
        <CheckboxField
          label="Permitir copia"
          checked={allowCopying}
          onChange={onAllowCopyingChange}
        />
        <CheckboxField
          label="Permitir edición"
          checked={allowModifying}
          onChange={onAllowModifyingChange}
        />
      </div>
    </div>
  );
}

interface CropControlsProps {
  margins: CropMargins;
  onChange: (side: keyof CropMargins, value: number) => void;
}

function CropControls({ margins, onChange }: CropControlsProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Recorte en mm</legend>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Arriba"
          value={margins.top}
          min={0}
          max={200}
          onChange={(value) => onChange("top", value)}
        />
        <NumberField
          label="Derecha"
          value={margins.right}
          min={0}
          max={200}
          onChange={(value) => onChange("right", value)}
        />
        <NumberField
          label="Abajo"
          value={margins.bottom}
          min={0}
          max={200}
          onChange={(value) => onChange("bottom", value)}
        />
        <NumberField
          label="Izquierda"
          value={margins.left}
          min={0}
          max={200}
          onChange={(value) => onChange("left", value)}
        />
      </div>
    </fieldset>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function PasswordField({ label, value, onChange }: PasswordFieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, min, max, onChange }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-border"
      />
      {label}
    </label>
  );
}
