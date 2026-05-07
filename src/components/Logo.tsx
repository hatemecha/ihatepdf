import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="relative inline-flex size-10 items-center justify-center rounded-md bg-brand font-mono text-base font-bold text-brand-foreground"
      >
        iH
        <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-foreground" />
      </span>
      {showWordmark ? (
        <span className="font-mono text-lg font-semibold text-foreground">
          iHate<span className="text-brand">PDF</span>
        </span>
      ) : null}
    </div>
  );
}
