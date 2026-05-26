import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { Plus, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ToolWorkspaceProps {
  accept: string;
  multiple?: boolean;
  hasContent: boolean;
  isProcessing?: boolean;
  onFilesSelected: (files: File[]) => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel: string;
  emptyExtraAction?: ReactNode;
  emptyHint?: string;
  preview: ReactNode;
  sidebarTitle: string;
  sidebarDescription?: string;
  sidebar: ReactNode;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  addMore?: {
    label: string;
  };
  errorMessage?: string | null;
  resultBanner?: ReactNode;
}

export function ToolWorkspace({
  accept,
  multiple = false,
  hasContent,
  isProcessing,
  onFilesSelected,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  emptyExtraAction,
  emptyHint,
  preview,
  sidebarTitle,
  sidebarDescription,
  sidebar,
  primaryAction,
  secondaryAction,
  addMore,
  errorMessage,
  resultBanner,
}: ToolWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto lg:overflow-hidden">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInputChange}
      />

      {hasContent ? (
        <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-hidden lg:pr-6">
            <div className="min-h-[420px] lg:min-h-0 lg:flex-1 lg:overflow-hidden">
              {preview}
            </div>
            {errorMessage ? (
              <Alert variant="destructive" className="shrink-0">
                <AlertTitle>No se pudo continuar</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
            {resultBanner ? (
              <div className="shrink-0">{resultBanner}</div>
            ) : null}
          </div>

          <aside className="flex min-w-0 flex-col gap-4 border-t border-border pt-4 lg:min-h-0 lg:overflow-hidden lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <header className="shrink-0">
              <h2 className="text-base font-semibold leading-tight">
                {sidebarTitle}
              </h2>
              {sidebarDescription ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {sidebarDescription}
                </p>
              ) : null}
            </header>

            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
              {sidebar}
            </div>

            <footer className="flex shrink-0 flex-col gap-2 border-t border-border pt-4">
              {addMore ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openPicker}
                  disabled={isProcessing}
                  className="w-full"
                >
                  <Plus data-icon="inline-start" aria-hidden />
                  {addMore.label}
                </Button>
              ) : null}
              <div className="flex flex-col gap-2">{primaryAction}</div>
              {secondaryAction ? <div>{secondaryAction}</div> : null}
            </footer>
          </aside>
        </div>
      ) : (
        <EmptyDropzone
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          extraAction={emptyExtraAction}
          hint={emptyHint}
          accept={accept}
          multiple={multiple}
          isProcessing={isProcessing}
          onFilesSelected={onFilesSelected}
          onOpenPicker={openPicker}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
}

interface EmptyDropzoneProps {
  title: string;
  description: string;
  actionLabel: string;
  extraAction?: ReactNode;
  hint?: string;
  accept: string;
  multiple: boolean;
  isProcessing?: boolean;
  onFilesSelected: (files: File[]) => void;
  onOpenPicker: () => void;
  errorMessage?: string | null;
}

function EmptyDropzone({
  title,
  description,
  actionLabel,
  extraAction,
  hint,
  accept,
  multiple,
  isProcessing,
  onFilesSelected,
  onOpenPicker,
  errorMessage,
}: EmptyDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    function preventDefault(event: Event) {
      event.preventDefault();
    }
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  function filterAcceptedFiles(files: File[]): File[] {
    if (!accept) {
      return files;
    }
    const tokens = accept.split(",").flatMap((token) => {
      const normalizedToken = token.trim().toLowerCase();
      return normalizedToken ? [normalizedToken] : [];
    });

    return files.filter((file) => {
      const name = file.name.toLowerCase();
      const type = file.type.toLowerCase();
      return tokens.some((token) => {
        if (token.startsWith(".")) {
          return name.endsWith(token);
        }
        if (token.endsWith("/*")) {
          return type.startsWith(token.slice(0, -1));
        }
        return type === token;
      });
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    const accepted = multiple
      ? filterAcceptedFiles(files)
      : filterAcceptedFiles(files).slice(0, 1);
    if (accepted.length > 0) {
      onFilesSelected(accepted);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center py-6 sm:py-10">
      <div
        className={cn(
          "flex w-full max-w-3xl flex-col items-center gap-4 rounded-2xl border border-dashed bg-card/40 p-6 text-center transition-colors sm:p-10",
          isDragging
            ? "border-brand bg-brand/5"
            : "border-border hover:border-foreground/30",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) {
            return;
          }
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Upload className="size-6" aria-hidden />
        </div>
        <div className="flex max-w-xl flex-col gap-1.5">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
        <div className="flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="brand"
            size="lg"
            onClick={onOpenPicker}
            disabled={isProcessing}
          >
            <Upload data-icon="inline-start" aria-hidden />
            {actionLabel}
          </Button>
          {extraAction}
        </div>
        {hint ? (
          <p className="text-xs text-muted-foreground sm:text-sm">{hint}</p>
        ) : null}
        {errorMessage ? (
          <Alert variant="destructive" className="w-full max-w-xl text-left">
            <AlertTitle>No se pudo continuar</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
