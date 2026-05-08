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
    <div className={cn("flex min-w-0 items-center gap-1.5 sm:gap-2", className)}>
      <span className="inline-flex size-10 shrink-0 items-center justify-center" aria-hidden>
        <img
          src={LOGO_PNG}
          width={40}
          height={40}
          alt=""
          className="size-10 max-h-10 max-w-10 object-contain"
          decoding="async"
        />
      </span>
      {showWordmark ? (
        <span className="whitespace-nowrap font-mono text-lg font-semibold tracking-tight text-foreground">
          iHate<span className="text-brand/90">PDF</span>
        </span>
      ) : null}
    </div>
  );
}
