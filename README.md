# iHatePDF

Herramientas PDF que corren en el navegador. Los archivos se procesan en tu
equipo y no se suben a un servidor para unirlos, reorganizarlos o convertirlos.

**Sitio:** https://hatemecha.github.io/iHatePDF/  
**Código:** https://github.com/hatemecha/iHatePDF

## Herramientas incluidas

- Unir varios PDF en un solo archivo.
- Dividir un PDF en un ZIP con un archivo por página.
- Extraer, eliminar, reordenar y rotar páginas.
- Convertir imágenes JPG/PNG a PDF.
- Exportar páginas de PDF como imágenes PNG.

## Privacidad y límites

iHatePDF no requiere backend ni claves de API. El procesamiento ocurre del lado
del cliente con JavaScript y Web Workers, por lo que la capacidad real depende
de la memoria y el navegador del equipo que lo ejecuta. Los PDF protegidos con
contraseña o corruptos pueden no procesarse correctamente.

## Stack

- React 18 + TypeScript.
- Vite.
- Tailwind CSS.
- pdf-lib, pdfjs-dist y JSZip para las operaciones con archivos.
- Vitest y ESLint para verificación automática.

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0`.
- npm, usando el `package-lock.json` incluido.

## Desarrollo

```bash
npm ci
npm run dev
```

Comandos útiles:

```bash
npm run lint
npm run test
npm run typecheck
npm run build
npm run preview
npm run preview:pages
```

Antes de subir cambios al repo conviene ejecutar:

```bash
npm run lint
npm run test
npm run build:pages
npm run preview:pages
```

## Deploy

### GitHub Pages

El workflow de `.github/workflows/deploy-pages.yml` se ejecuta al hacer push a
`main` o manualmente desde GitHub Actions. Para usarlo, en el repositorio hay que
configurar:

`Settings -> Pages -> Build and deployment -> Source -> GitHub Actions`

El comando `npm run build:pages` genera el build con base `/iHatePDF/` y copia
`dist/index.html` a `dist/404.html` para que las rutas de la SPA funcionen al
recargar o abrir URLs internas directamente.

### Vercel

El proyecto también incluye `vercel.json` con fallback a `index.html`. En Vercel
se puede usar:

- Build command: `npm run build`
- Output directory: `dist`

## Estructura

- `src/app`: rutas y shell principal de la app.
- `src/components`: componentes compartidos de interfaz.
- `src/features/pdf-tools`: herramientas y lógica de procesamiento de PDF.
- `src/lib`: utilidades generales.
- `src/styles`: tokens, estilos globales y utilidades.
- `scripts`: tareas de build y generación de assets.

## Licencia

MIT. Ver [LICENSE.md](LICENSE.md).
