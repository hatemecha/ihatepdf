import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="font-mono text-base uppercase text-brand">404</p>
        <h1 className="heading-display text-4xl md:text-5xl">
          Esa página no existe.
        </h1>
      </div>
      <p className="max-w-md text-muted-foreground">
        La ruta que pediste no está en iHatePDF. Puede ser una herramienta en
        desarrollo o un enlace viejo.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="brand">
          <Link to="/">Ir al inicio</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/#herramientas">Ver herramientas</Link>
        </Button>
      </div>
    </main>
  );
}
