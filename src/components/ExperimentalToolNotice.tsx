import { FlaskConical } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ExperimentalToolNoticeProps {
  className?: string;
}

export function ExperimentalToolNotice({
  className,
}: ExperimentalToolNoticeProps) {
  return (
    <Alert
      variant="info"
      className={cn(
        "border-amber-500/35 bg-amber-500/8 text-left text-foreground",
        className,
      )}
    >
      <FlaskConical className="text-amber-700 dark:text-amber-300" />
      <AlertTitle className="text-amber-950 dark:text-amber-100">
        Conversión experimental
      </AlertTitle>
      <AlertDescription className="text-amber-950/85 dark:text-amber-50/90">
        Esta herramienta aún no está verificada de punta a punta. El resultado
        puede variar según el archivo; revísalo antes de usarlo en producción.
      </AlertDescription>
    </Alert>
  );
}
