import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ToolCategoryTabs } from "@/components/ToolCategoryTabs";

export function HomePage() {
  return (
    <main>
      <section className="border-b border-border bg-muted/35">
        <div className="container-page py-14 text-center md:py-20">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
            <Badge
              variant="outline"
              className="inline-flex items-center gap-2 border-brand bg-card px-3 py-1 text-brand"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              Todo en tu navegador
            </Badge>
            <h1 className="heading-display text-balance text-4xl text-foreground md:text-6xl">
              iHatePDF
            </h1>
            <p className="text-balance text-lg text-muted-foreground">
              Herramientas PDF sencillas: unir, dividir, extraer, reordenar,
              rotar y convertir. Nada se sube a servidores; trabajas sobre tus
              archivos en esta sesion.
            </p>
          </div>
        </div>
      </section>

      <section
        id="herramientas"
        className="container-page scroll-mt-20 py-12 md:py-16"
      >
        <ToolCategoryTabs />
      </section>
    </main>
  );
}
