import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

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

interface ImageToPdfToolProps {
  /**
   * The Image→PDF tool exposes a Simple/Layout switcher that should live in
   * the global tool header instead of a stacked toolbar inside the workspace.
   * The host page provides this callback to receive the actions node.
   */
  onHeaderActionsChange?: (node: ReactNode) => void;
}

export function ImageToPdfTool({ onHeaderActionsChange }: ImageToPdfToolProps = {}) {
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

  useEffect(() => {
    if (!onHeaderActionsChange) {
      return;
    }
    onHeaderActionsChange(
      <ModeSwitch
        mode={mode}
        onSimple={goToSimple}
        onLayout={goToLayout}
      />,
    );
    return () => onHeaderActionsChange(null);
  }, [goToLayout, goToSimple, mode, onHeaderActionsChange]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
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

interface ModeSwitchProps {
  mode: ImageToPdfMode;
  onSimple: () => void;
  onLayout: () => void;
}

function ModeSwitch({ mode, onSimple, onLayout }: ModeSwitchProps) {
  return (
    <div
      className="inline-flex items-center rounded-full bg-muted p-0.5 text-xs"
      role="group"
      aria-label="Elegir modo de trabajo"
    >
      <ModeChip active={mode === "simple"} onClick={onSimple}>
        Simple
      </ModeChip>
      <ModeChip active={mode === "layout"} onClick={onLayout}>
        Editor libre
        <span className="ml-1 hidden text-[10px] uppercase tracking-wide opacity-70 sm:inline">
          beta
        </span>
      </ModeChip>
    </div>
  );
}

interface ModeChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ModeChip({ active, onClick, children }: ModeChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
