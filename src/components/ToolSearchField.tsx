import { useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface ToolSearchFieldProps {
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function ToolSearchField({
  onChange,
  className,
  placeholder = "Buscar herramienta…",
}: ToolSearchFieldProps) {
  const [draft, setDraft] = useState("");
  const debounceRef = useRef<number | null>(null);

  function scheduleChange(nextValue: string) {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      onChange(nextValue);
    }, 150);
  }

  function handleChange(nextValue: string) {
    setDraft(nextValue);
    scheduleChange(nextValue);
  }

  function handleClear() {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    setDraft("");
    onChange("");
  }

  return (
    <div className={cn("relative mx-auto w-full max-w-md", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Buscar herramienta"
        className="field-input h-11 w-full rounded-full pr-10 pl-10 text-sm focus-visible:shadow-none"
      />
      {draft ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Borrar búsqueda"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
