import { useRef } from "react";
import { Download } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sanitizeDownloadFileName } from "@/features/pdf-tools/shared/downloadFileName";

export interface DownloadResult {
  url: string;
  fileName: string;
  mimeType?: string;
}

interface DownloadReadyBannerProps {
  downloadResult: DownloadResult;
}

export function DownloadReadyBanner({
  downloadResult,
}: DownloadReadyBannerProps) {
  return (
    <DownloadReadyBannerContent
      key={downloadResult.fileName}
      downloadResult={downloadResult}
    />
  );
}

function DownloadReadyBannerContent({
  downloadResult,
}: DownloadReadyBannerProps) {
  const fileNameInputRef = useRef<HTMLInputElement>(null);

  function resolveDownloadFileName(): string {
    const draftName =
      fileNameInputRef.current?.value ?? downloadResult.fileName;
    return sanitizeDownloadFileName(
      draftName,
      downloadResult.fileName,
      downloadResult.mimeType,
    );
  }

  return (
    <Alert variant="brand" role="status">
      <Download />
      <AlertTitle>Archivo listo</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-3">
          <p>La operación terminó correctamente.</p>
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-xs font-medium text-muted-foreground">
              Nombre del archivo
            </span>
            <input
              ref={fileNameInputRef}
              type="text"
              defaultValue={downloadResult.fileName}
              className="field-input h-9 rounded-md px-2.5 text-sm text-foreground"
              aria-label="Nombre del archivo a descargar"
            />
          </label>
          <Button asChild variant="brand" size="sm" className="self-start">
            <a
              href={downloadResult.url}
              download={downloadResult.fileName}
              onClick={(event) => {
                event.currentTarget.download = resolveDownloadFileName();
              }}
            >
              <Download data-icon="inline-start" aria-hidden />
              Descargar
            </a>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
