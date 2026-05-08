import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

const base = import.meta.env.BASE_URL;

/** PNG único en /public — el arte real con transparencia */
const LOGO_PNG = `${base}iHatePDF.png`;

export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="inline-flex size-8 shrink-0 items-center justify-center" aria-hidden>
        <img
          src={LOGO_PNG}
          width={32}
          height={32}
          alt=""
          className="size-8 max-h-8 max-w-8 object-contain"
          decoding="async"
        />
      </span>
      {showWordmark ? (
        <span className="whitespace-nowrap font-mono text-base font-semibold tracking-tight text-foreground sm:text-lg">
          iHate<span className="text-brand">PDF</span>
        </span>
      ) : null}
    </div>
  );
}
