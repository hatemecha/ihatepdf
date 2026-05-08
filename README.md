# iHatePDF

Herramientas PDF que corren en el navegador: los archivos se procesan en tu
equipo y no se suben a un servidor para convertirlos.

**Sitio:** https://hatemecha.github.io/iHatePDF/  
**Código:** https://github.com/hatemecha/iHatePDF

## Qué incluye

Unir y dividir PDF, extraer o eliminar páginas, reordenar y rotar, imagen a PDF,
PDF a imágenes, y la UI del catálogo de herramientas.

## Desarrollo

```bash
npm install
npm run dev
```

```bash
npm run build         # producción
npm run build:pages   # GitHub Pages (base `/iHatePDF/`)
npm run preview
npm run typecheck
npm run lint
npm run test
```

## GitHub Pages

En el repo: Settings → Pages → Build and deployment → GitHub Actions. El
workflow usa `VITE_BASE_PATH=/iHatePDF/` y genera `404.html` para la SPA.

## Licencia

MIT — ver [LICENSE.md](LICENSE.md).
