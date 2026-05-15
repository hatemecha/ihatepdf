import { FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ExperimentalToolBadgeProps {
  className?: string;
}

export function ExperimentalToolBadge({
  className,
}: ExperimentalToolBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200",
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
      Experimental
    </Badge>
  );
}
