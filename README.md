# iHatePDF

iHatePDF es una web app de herramientas PDF privadas para usuarios finales.

La idea es simple: entrar desde un dominio, elegir archivos, procesarlos en el
navegador y descargar el resultado sin subir documentos a servidores de
procesamiento.

## Estado actual

Herramientas disponibles:

- Unir PDFs
- Dividir PDF
- Extraer páginas
- Eliminar páginas
- Reordenar páginas
- Rotar páginas
- Imagen a PDF
- PDF a imágenes

La grilla pública muestra herramientas con procesamiento real, validaciones,
errores claros y descarga del resultado.

## Principios

- Los documentos no se suben a servidores para procesarse.
- La experiencia debe funcionar desde una web pública, sin pedirle al usuario
  que instale o levante nada.
- Cada herramienta debe validar tipo, peso y cantidad de archivos.
- Los errores deben explicar qué pasó y cómo continuar.
- El código debe mantenerse modular, tipado y fácil de auditar.

## Stack

- React 18
- Vite 8
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui style components
- React Router 6
- pdf-lib
- pdfjs-dist
- JSZip
- Vitest
- ESLint
- Prettier

## Desarrollo

```bash
npm install
npm run dev
```

### Comandos

```bash
npm run build         # build de producción
npm run build:pages   # build para GitHub Pages con fallback SPA
npm run preview       # servir el build
npm run typecheck     # verificación de tipos
npm run lint          # análisis estático
npm run test          # tests unitarios
npm run format:check  # verificar formato
```

## Deploy en GitHub Pages

El repositorio incluye `.github/workflows/deploy-pages.yml` para publicar en
GitHub Pages desde `main`.

Pasos en GitHub:

1. Ir a `Settings` -> `Pages`.
2. En `Build and deployment`, seleccionar `GitHub Actions`.
3. Hacer push a `main` o ejecutar el workflow manualmente desde `Actions`.

Para este repo (`hatemecha/iHatePDF`), el workflow compila con:

```bash
VITE_BASE_PATH=/iHatePDF/ npm run build:pages
```

El build copia `dist/index.html` a `dist/404.html` para que rutas como
`/iHatePDF/herramientas/merge` funcionen al refrescar la página.

## Deploy con dominio

La app es una SPA con `BrowserRouter`. El hosting debe redirigir cualquier ruta
interna a `index.html`.

Ya se incluyen configuraciones para hosts comunes:

- `vercel.json` para Vercel.
- `public/_redirects` para Netlify y Cloudflare Pages.

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

## Estructura

```text
iHatePDF/
  public/
    _redirects
    favicon.svg
    robots.txt
  src/
    app/        # shell de la app y router
    components/ # componentes propios + ui base
    features/   # herramientas PDF reales
    lib/        # utilidades compartidas
    pages/      # páginas principales
    styles/     # globals, tokens y utilidades CSS
    tools/      # catálogo público de herramientas
    main.tsx    # entrada React
  vercel.json
  vite.config.ts
  tsconfig.json
```

## Backlog no publico

- Comprimir PDF
- Proteger PDF
- Desbloquear PDF
- Ver y eliminar metadatos
- Marca de agua
- Numerar páginas
- OCR
- PDF a texto
- Modo batch

## Licencia

Pendiente de definir.
