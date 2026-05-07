# iHatePDF

iHatePDF es una web app de herramientas PDF privadas para usuarios finales.

La idea es simple: entrar desde un dominio, elegir archivos, procesarlos en el
navegador y descargar el resultado sin subir documentos a servidores de
procesamiento.

## Estado actual

Herramientas disponibles:

- Unir PDFs
- Dividir PDF
- Extraer paginas
- Eliminar paginas
- Reordenar paginas
- Rotar paginas
- Imagen a PDF
- PDF a imagenes

La grilla publica muestra herramientas con procesamiento real, validaciones,
errores claros y descarga del resultado.

## Principios

- Los documentos no se suben a servidores para procesarse.
- La experiencia debe funcionar desde una web publica, sin pedirle al usuario
  que instale o levante nada.
- Cada herramienta debe validar tipo, peso y cantidad de archivos.
- Los errores deben explicar que paso y como continuar.
- El codigo debe mantenerse modular, tipado y facil de auditar.

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
npm run build         # build de produccion
npm run preview       # servir el build
npm run typecheck     # verificacion de tipos
npm run lint          # analisis estatico
npm run test          # tests unitarios
npm run format:check  # verificar formato
```

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
    pages/      # paginas principales
    styles/     # globals, tokens y utilidades CSS
    tools/      # catalogo publico de herramientas
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
- Numerar paginas
- OCR
- PDF a texto
- Modo batch

## Licencia

Pendiente de definir.
