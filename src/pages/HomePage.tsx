import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ToolCategoryTabs } from "@/components/ToolCategoryTabs";
import { usePageSeo } from "@/hooks/usePageSeo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import {
  buildFaqStructuredData,
  buildHomeStructuredData,
} from "@/lib/seoStructuredData";
import { getAllTools } from "@/tools/toolCatalog";

const FAQ_ITEMS = [
  {
    question: "¿Tengo que subir mis PDFs a un servidor?",
    answer:
      "No. iHatePDF procesa tus archivos en el navegador. Tus documentos no se envían a servidores externos para unir, dividir, comprimir o convertir.",
  },
  {
    question: "¿Es gratis y sin cuenta?",
    answer:
      "Sí. Puedes usar las herramientas sin registrarte ni pagar suscripciones.",
  },
  {
    question: "¿Para qué sirve iHatePDF frente a otras webs de PDF?",
    answer:
      "Está pensado para tareas habituales con PDF de forma rápida y privada: sin colas de subida, sin límites de cuenta y con el procesamiento en tu dispositivo.",
  },
] as const;

export function HomePage() {
  const tools = useMemo(() => getAllTools(), []);
  const structuredData = useMemo(
    () => [...buildHomeStructuredData(tools), buildFaqStructuredData()],
    [tools],
  );

  usePageSeo({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    path: "/",
    jsonLd: structuredData,
  });

  return (
    <main>
      <section className="border-b border-border bg-muted/35">
        <div className="container-page py-9 text-center sm:py-11 md:py-14">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-2.5">
            <Badge
              variant="outline"
              className="inline-flex items-center gap-2 border-brand bg-card px-3 py-1 text-brand"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              Todo en tu navegador · Sin subir archivos
            </Badge>
            <h1 className="heading-display text-balance text-4xl text-foreground md:text-6xl">
              {SITE_NAME}
            </h1>
            <p className="text-balance text-lg font-medium text-foreground/90">
              {SITE_TAGLINE}
            </p>
            <p className="text-balance text-base text-muted-foreground">
              Une, divide, comprime, convierte y firma PDFs gratis. Alternativa
              ligera a otras herramientas PDF: tus archivos se procesan en tu
              dispositivo, sin cuentas ni colas.
            </p>
          </div>
        </div>
      </section>

      <section
        id="herramientas"
        className="container-page scroll-mt-20 py-8 md:py-10"
        aria-labelledby="tools-heading"
      >
        <h2 id="tools-heading" className="sr-only">
          Herramientas PDF disponibles
        </h2>
        <ToolCategoryTabs />
      </section>

      <section
        id="privacidad"
        className="border-t border-border bg-muted/20"
        aria-labelledby="privacy-heading"
      >
        <div className="container-page py-8 md:py-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="privacy-heading"
              className="text-lg font-semibold text-foreground"
            >
              PDF online con privacidad real
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Cada herramienta (unir PDF, dividir, comprimir, convertir a Word o
              imágenes) se ejecuta localmente. Ideal si buscas editar PDF sin
              subirlos a servidores de terceros.
            </p>
            <p className="mt-3">
              <Link
                to="/#herramientas"
                className="text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                Ver todas las herramientas PDF
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section
        id="preguntas-frecuentes"
        className="container-page border-t border-border py-10 md:py-12"
        aria-labelledby="faq-heading"
      >
        <div className="mx-auto max-w-2xl">
          <h2
            id="faq-heading"
            className="heading-display text-2xl text-foreground md:text-3xl"
          >
            Preguntas frecuentes
          </h2>
          <p className="mt-2 text-muted-foreground">
            Respuestas rápidas sobre cómo funciona iHatePDF.
          </p>
          <dl className="mt-6 space-y-5">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question}>
                <dt className="text-sm font-semibold text-foreground">
                  {item.question}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
