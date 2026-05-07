import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { Logo } from "@/components/Logo";
import { Separator } from "@/components/ui/separator";
import { TOOLS } from "@/tools/toolCatalog";

const REPO_URL = "https://github.com/ihatepdf/ihatepdf";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-muted">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
              Herramientas PDF para usar desde una web simple. Tus archivos se
              procesan en el navegador y no se guardan en nuestros servidores.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 text-base font-medium text-foreground hover:text-brand"
            >
              <GitHubIcon className="size-4" />
              Ver codigo fuente
            </a>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              Producto
            </h4>
            <ul className="grid gap-2 text-base sm:grid-cols-2 md:grid-cols-1">
              {TOOLS.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    to={`/herramientas/${tool.slug}`}
                    className="text-foreground hover:text-brand"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/privacidad"
                  className="text-foreground hover:text-brand"
                >
                  Privacidad
                </Link>
              </li>
              <li>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-foreground hover:text-brand"
                >
                  Codigo fuente
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              Principios
            </h4>
            <ul className="flex flex-col gap-2 text-base text-muted-foreground">
              <li>Sin cuentas obligatorias</li>
              <li>Sin subida de documentos</li>
              <li>Sin analytics invasivo</li>
              <li>Mensajes claros de error</li>
            </ul>
          </div>
        </div>

        <Separator className="my-10" />

        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <ShieldCheck className="size-4 text-brand" />
          Los archivos se procesan en tu navegador durante la sesion de uso.
        </p>
      </div>
    </footer>
  );
}
