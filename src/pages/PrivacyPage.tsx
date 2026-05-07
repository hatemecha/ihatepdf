import { Cpu, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { Separator } from "@/components/ui/separator";

const REPO_URL = "https://github.com/ihatepdf/ihatepdf";

const NEVER_LIST = [
  "contenido de documentos",
  "nombres de archivo",
  "metadatos internos",
  "imagenes",
  "texto extraido",
  "contrasenas",
  "resultados generados",
];

const PILLARS = [
  {
    icon: Lock,
    title: "Sin subida de documentos",
    description:
      "Las herramientas activas no envian PDFs a servidores para procesarlos.",
  },
  {
    icon: Cpu,
    title: "Procesamiento en navegador",
    description:
      "Las operaciones PDF ocurren en la sesion actual del navegador del usuario.",
  },
  {
    icon: ShieldCheck,
    title: "Sin almacenamiento de archivos",
    description:
      "No guardamos documentos, resultados ni copias temporales en backend.",
  },
  {
    icon: EyeOff,
    title: "Sin analytics invasivo",
    description: "No usamos cookies de publicidad ni perfilado de usuarios.",
  },
];

export function PrivacyPage() {
  return (
    <main className="container-page py-16 md:py-20">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-4 text-center">
          <Badge
            variant="outline"
            className="inline-flex items-center gap-2 border-brand bg-card px-3 py-1 text-brand"
          >
            <ShieldCheck className="size-3.5" />
            Privacidad clara
          </Badge>
          <h1 className="heading-display text-4xl md:text-5xl">
            Tus PDFs se procesan en el navegador.
          </h1>
          <p className="text-lg text-muted-foreground">
            iHatePDF esta pensado como una web publica para usuarios finales.
            Las herramientas disponibles trabajan del lado del cliente y
            descargan resultados sin subir tus documentos a nuestros servidores.
          </p>
        </header>

        <Alert variant="brand">
          <ShieldCheck />
          <AlertTitle>Promesa verificable</AlertTitle>
          <AlertDescription>
            Las herramientas se publican solo cuando tienen flujo real,
            validaciones y manejo de errores. Si una funcion futura necesita
            infraestructura propia, se va a explicar antes de usarla.
          </AlertDescription>
        </Alert>

        <section className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-lg border border-border bg-card p-6"
              >
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h2 className="text-lg font-semibold">{pillar.title}</h2>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">No tenemos acceso a:</h2>
          <ul className="grid gap-2 text-base md:grid-cols-2">
            {NEVER_LIST.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-foreground"
              >
                <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-base text-muted-foreground">
            Tampoco usamos tus documentos para entrenar modelos de IA.
          </p>
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Como verificarlo</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-base text-foreground">
            <li>
              Revisa el codigo fuente publico y busca llamadas de red durante el
              procesamiento de archivos.
            </li>
            <li>
              Abri las DevTools del navegador y mira la pestana Network al usar
              una herramienta.
            </li>
            <li>
              Usa un PDF de prueba y confirma que el resultado se descarga desde
              el navegador.
            </li>
          </ol>
        </section>

        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-semibold">Auditable por diseno.</p>
            <p className="text-base text-muted-foreground">
              La privacidad se sostiene con codigo y comportamiento verificable,
              no con promesas repetidas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="brand">
              <Link to="/#herramientas">Ver herramientas</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
                <GitHubIcon />
                Codigo
              </a>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
