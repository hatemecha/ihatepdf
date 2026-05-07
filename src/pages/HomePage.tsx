import { Cpu, Download, Lock, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToolCard } from "@/components/ToolCard";
import { ToolCategoryTabs } from "@/components/ToolCategoryTabs";
import { TOOLS, getHighlightedTools } from "@/tools/toolCatalog";

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: "Web para usuarios finales",
    description:
      "Entras al dominio, elegis tus PDFs y descargas el resultado. No hay que instalar ni levantar servicios.",
  },
  {
    icon: Lock,
    title: "Sin subida de documentos",
    description:
      "Los archivos se procesan en la sesion actual del navegador y no quedan guardados en nuestros servidores.",
  },
  {
    icon: Cpu,
    title: "Procesamiento en navegador",
    description:
      "Las herramientas trabajan del lado del cliente para evitar enviar documentos privados a terceros.",
  },
  {
    icon: Download,
    title: "Resultado descargable",
    description:
      "Cuando termina la operacion, el PDF generado queda listo para descargar en tu equipo.",
  },
];

export function HomePage() {
  const highlightedTools = getHighlightedTools();
  const availableToolsCount = TOOLS.length;

  return (
    <main>
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div className="container-page py-20 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="outline"
              className="mb-6 inline-flex items-center gap-2 border-brand bg-card px-3 py-1 text-brand"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              Web app privada para PDFs
            </Badge>
            <h1 className="heading-display text-balance text-5xl text-foreground md:text-7xl">
              Edita PDFs desde el navegador
            </h1>
            <p className="mt-6 text-balance text-xl text-muted-foreground md:text-2xl">
              iHatePDF incluye herramientas reales para unir, dividir,
              reorganizar, rotar y convertir PDFs. Tus archivos se procesan en
              tu navegador y no se suben a nuestros servidores.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="brand">
                <a href="#herramientas">Ver herramientas</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/privacidad">Ver privacidad</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-base text-muted-foreground">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4" aria-hidden /> Sin cuenta
              </span>
              <span className="flex items-center gap-2">
                <Lock className="size-4" aria-hidden /> Sin subir documentos
              </span>
              <span className="flex items-center gap-2">
                <Download className="size-4" aria-hidden /> Descarga directa
              </span>
            </div>
          </div>

          <div className="mt-14">
            <p className="mb-4 ironic-tag justify-center text-center">
              <span className="size-1.5 rounded-full bg-brand" />
              Herramientas destacadas
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {highlightedTools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((principle) => {
            const Icon = principle.icon;
            return (
              <Card key={principle.title}>
                <CardHeader>
                  <div className="inline-flex size-12 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="text-lg">{principle.title}</CardTitle>
                  <CardDescription className="leading-relaxed">
                    {principle.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section
        id="herramientas"
        className="container-page scroll-mt-20 py-12 md:py-16"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="ironic-tag mb-2">
              <span className="size-1.5 rounded-full bg-brand" />
              {availableToolsCount} herramientas disponibles
            </p>
            <h2 className="text-4xl font-bold md:text-5xl">
              Herramientas PDF listas para usar
            </h2>
            <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
              Cada herramienta tiene selector de archivos, validaciones, manejo
              de errores y descarga del resultado.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/privacidad">Como funciona la privacidad</Link>
          </Button>
        </div>

        <ToolCategoryTabs />
      </section>

      <section className="border-y border-border bg-muted text-foreground">
        <div className="container-page py-16">
          <div className="grid items-center gap-10 md:grid-cols-[1fr_0.8fr]">
            <div>
              <p className="ironic-tag mb-2">
                <span className="size-1.5 rounded-full bg-brand" />
                Suite inicial
              </p>
              <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">
                Las operaciones basicas de PDF ya estan cubiertas.
              </h2>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Puedes unir archivos, dividirlos por pagina, extraer o eliminar
                rangos, reordenar, rotar y convertir entre PDF e imagenes.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="brand" size="lg">
                  <Link to="/herramientas/merge">Probar Unir PDFs</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/privacidad">Privacidad</Link>
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Incluido en esta version</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-base text-muted-foreground sm:grid-cols-2">
                  {TOOLS.map((tool) => (
                    <li key={tool.slug} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-brand" />
                      {tool.name}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
