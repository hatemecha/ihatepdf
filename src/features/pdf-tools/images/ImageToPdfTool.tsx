import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ImageToPdfSimpleMode } from "./ImageToPdfSimpleMode";
import {
  ImageToPdfLayoutEditor,
  type ImageToPdfLayoutImageImport,
} from "./layout/ImageToPdfLayoutEditor";

export type ImageToPdfMode = "simple" | "layout";

const WORKSPACE_STORAGE_KEY = "ihatepdf-image-to-pdf-workspace-v1";

export function readStoredWorkspaceMode(): ImageToPdfMode {
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

export function persistWorkspaceMode(next: ImageToPdfMode) {
  try {
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

interface ImageToPdfToolProps {
  mode: ImageToPdfMode;
  layoutImageImport: ImageToPdfLayoutImageImport | null;
  onLayoutImportConsumed: () => void;
  onRegisterSimpleFiles: (files: File[]) => void;
  onSwitchToSimple: () => void;
}

export function ImageToPdfTool({
  mode,
  layoutImageImport,
  onLayoutImportConsumed,
  onRegisterSimpleFiles,
  onSwitchToSimple,
}: ImageToPdfToolProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === "layout" ? (
          <ImageToPdfLayoutEditor
            imageImport={layoutImageImport}
            onImageImportConsumed={onLayoutImportConsumed}
            onSwitchToSimple={onSwitchToSimple}
          />
        ) : (
          <ImageToPdfSimpleMode
            registerFilesForLayout={onRegisterSimpleFiles}
          />
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

export function ModeSwitch({ mode, onSimple, onLayout }: ModeSwitchProps) {
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
