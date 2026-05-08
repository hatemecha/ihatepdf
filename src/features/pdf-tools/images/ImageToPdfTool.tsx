import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { ImageToPdfSimpleMode } from "./ImageToPdfSimpleMode";
import {
  ImageToPdfLayoutEditor,
  type ImageToPdfLayoutImageImport,
} from "./layout/ImageToPdfLayoutEditor";

type ImageToPdfMode = "simple" | "layout";

const WORKSPACE_STORAGE_KEY = "ihatepdf-image-to-pdf-workspace-v1";

function readStoredWorkspaceMode(): ImageToPdfMode {
  try {
    const value = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (value === "simple" || value === "layout") {
      return value;
    }
  } catch {
    /* ignore */
  }
  return "simple";
}

function persistWorkspaceMode(next: ImageToPdfMode) {
  try {
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

export function ImageToPdfTool() {
  const [mode, setMode] = useState<ImageToPdfMode>(() =>
    readStoredWorkspaceMode(),
  );
  const [layoutImageImport, setLayoutImageImport] =
    useState<ImageToPdfLayoutImageImport | null>(null);
  const importTokenRef = useRef(0);
  const simpleFilesRef = useRef<File[]>([]);

  const registerSimpleFiles = useCallback((files: File[]) => {
    simpleFilesRef.current = files;
  }, []);

  const goToSimple = useCallback(() => {
    persistWorkspaceMode("simple");
    setLayoutImageImport(null);
    setMode("simple");
  }, []);

  const goToLayout = useCallback(() => {
    persistWorkspaceMode("layout");
    const files = [...simpleFilesRef.current];
    if (files.length > 0) {
      importTokenRef.current += 1;
      setLayoutImageImport({
        token: importTokenRef.current,
        files,
      });
    } else {
      setLayoutImageImport(null);
    }
    setMode("layout");
  }, []);

  const consumeLayoutImport = useCallback(() => {
    setLayoutImageImport(null);
  }, []);

  const switchMode = useCallback(() => {
    if (mode === "simple") {
      goToLayout();
    } else {
      goToSimple();
    }
  }, [goToLayout, goToSimple, mode]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">Modo:</span>
          <div
            className="inline-flex rounded-md border border-border bg-background p-0.5"
            role="group"
            aria-label="Elegir modo de trabajo"
          >
            <Button
              type="button"
              variant={mode === "simple" ? "brand" : "ghost"}
              size="sm"
              className="h-7 rounded-sm px-2 text-xs"
              onClick={goToSimple}
              aria-pressed={mode === "simple"}
            >
              Simple
            </Button>
            <Button
              type="button"
              variant={mode === "layout" ? "brand" : "ghost"}
              size="sm"
              className="h-7 rounded-sm px-2 text-xs"
              onClick={goToLayout}
              aria-pressed={mode === "layout"}
            >
              Editor libre (beta)
            </Button>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={switchMode}
        >
          Cambiar modo
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === "layout" ? (
          <ImageToPdfLayoutEditor
            imageImport={layoutImageImport}
            onImageImportConsumed={consumeLayoutImport}
            onSwitchToSimple={goToSimple}
          />
        ) : (
          <ImageToPdfSimpleMode registerFilesForLayout={registerSimpleFiles} />
        )}
      </div>
    </div>
  );
}
