# Auditoria inicial de iHatePDF

Fecha: 2026-05-07

## Estado de correccion

- [x] Limpiar copy publico y quitar self-hosting de la UI.
- [x] Ocultar herramientas no funcionales del catalogo publico.
- [x] Implementar el primer MVP real: `Unir PDFs`.
- [x] Agregar validaciones de tipo, peso, cantidad y errores claros.
- [x] Procesar PDFs en un Web Worker con `pdf-lib`.
- [x] Descargar el resultado y limpiar object URLs.
- [x] Implementar funciones iniciales completas: unir, dividir, extraer, eliminar, reordenar, rotar, imagen a PDF y PDF a imagenes.
- [x] Agregar `JSZip` para descargas multiples.
- [x] Agregar `pdfjs-dist` para exportar PDF a imagenes.
- [x] Quitar PWA/offline incompleto y fuentes externas de Google.
- [x] Agregar fallback SPA para dominio (`vercel.json` y `public/_redirects`).
- [x] Quitar `host: true` del dev server.
- [x] Agregar ESLint, Prettier y Vitest.
- [x] Actualizar Vite para dejar `npm audit` en cero vulnerabilidades.
- [ ] Inicializar Git si este directorio va a ser el repo definitivo.
- [ ] Agregar CI cuando exista repositorio remoto.
- [ ] Agregar pruebas e2e cuando haya mas flujos criticos.
- [x] Ampliar catalogo solo con herramientas terminadas.

## Resumen

La base ya dejo de ser una landing con placeholders. El catalogo publico tiene las 8 herramientas iniciales pedidas y cada una expone un flujo real con validaciones, procesamiento en navegador y descarga.

La siguiente prioridad es endurecer QA: pruebas e2e con archivos reales, CI y revision visual de los flujos principales antes de sumar herramientas nuevas.

## Estado verificado

- `npm run typecheck` pasa.
- `npm run test` pasa.
- `npm run lint` pasa.
- `npm run build` pasa.
- `npm audit --audit-level=moderate` pasa con 0 vulnerabilidades.
- No hay repositorio Git inicializado en esta carpeta (`git status` falla con "not a git repository").
- Existen `node_modules/` y `dist/` en la carpeta local; estan ignorados por `.gitignore`, pero no puedo confirmar tracking porque no hay `.git`.
- Hay tests unitarios, lint y formatter configurados.
- No hay CI configurado todavia.

## Bloqueantes antes de seguir

### 1. El producto promete funcionalidad que no existe

Archivos relevantes:

- `src/pages/HomePage.tsx`
- `src/pages/ToolPage.tsx`
- `src/tools/toolCatalog.ts`
- `README.md`

Estado:

- [x] Corregido. La UI publica lista solo herramientas disponibles.
- [x] `ToolPage` renderiza componentes reales por herramienta.
- [x] Las 8 herramientas iniciales tienen flujo funcional.

Accion recomendada:

- Publicar solo herramientas reales.
- Mientras no haya herramientas funcionales, cambiar el CTA a algo honesto como "Ver herramientas en desarrollo" o directamente no exponer la grilla como producto final.
- Para el MVP, elegir 1 o 2 herramientas iniciales y ocultar el resto hasta que funcionen.

### 2. Mensaje de self-hosting contrario al objetivo actual

Archivos relevantes:

- `src/pages/HomePage.tsx`
- `src/pages/PrivacyPage.tsx`
- `src/components/SiteFooter.tsx`
- `README.md`

Problema:

- Hay CTAs y textos como "Self-hostealo", "Self-hosting", "self-hosteable" y "propia maquina o servidor".
- Eso apunta a usuarios tecnicos, no a usuarios normales que entran a una web con dominio para resolver una tarea.

Accion recomendada:

- Eliminar self-hosting del mensaje publico.
- Mantenerlo, si se quiere, solo como nota secundaria en README o documentacion tecnica.
- Reencuadrar el producto como "web app con procesamiento en navegador", no como "app para levantar localmente".

### 3. El texto repite demasiado la misma idea

Patron repetido:

- "sin subir archivos"
- "local"
- "en tu navegador"
- "offline"
- "open source"
- "sin IA"
- "codigo fuente"
- "odiamos subir PDFs"

Problema:

- La privacidad es importante, pero esta repetida en hero, badges, principios, tool cards, footer, pagina de privacidad y README.
- La repeticion hace que parezca contenido generado de relleno.

Accion recomendada:

- Dejar una sola promesa principal en el hero: "Edita PDFs desde el navegador sin subirlos a servidores".
- Dejar detalles tecnicos solo en `/privacidad`.
- Quitar el badge `local` de cada tarjeta; no aporta si todas las herramientas comparten el mismo principio.
- Reducir el tono "odiamos" a marca puntual, no a texto repetido en varias secciones.

### 4. PWA/offline esta prometido pero incompleto

Archivos relevantes:

- `vite.config.ts`
- `index.html`
- `public/`

Problemas:

- El manifest PWA referencia `/icons/icon-192.png`, `/icons/icon-512.png` y `/icons/icon-512-maskable.png`, pero esos archivos no existen en `public/`.
- `index.html` carga Google Fonts desde dominios externos. Eso contradice parcialmente la narrativa de privacidad/offline y agrega requests de terceros.
- No hay prueba real de instalacion/offline.

Accion recomendada:

- O completar PWA de verdad: iconos, fuentes locales, prueba offline, estrategia clara de cache.
- O quitar temporalmente la promesa "offline first" hasta que sea verificable.
- Para una web publica, PWA puede quedarse si suma, pero no debe sonar como self-hosting ni ser una excusa para no pensar en hosting real.

### 5. Hosting con dominio requiere configuracion SPA

Archivos relevantes:

- `src/main.tsx`
- `src/app/routes.tsx`

Problema:

- Se usa `BrowserRouter`. Eso esta bien para una web con dominio, pero el hosting debe redirigir rutas como `/privacidad` y `/herramientas/merge` a `index.html`.
- Si se sube como archivos estaticos sin fallback SPA, refrescar una ruta interna puede dar 404.

Accion recomendada:

- Definir hosting objetivo: Vercel, Netlify, Cloudflare Pages, servidor propio, etc.
- Agregar configuracion de rewrites segun proveedor.
- Documentar "deploy a dominio" en vez de "self-host local".

## Hallazgos tecnicos

### Vite/esbuild vulnerable en entorno de desarrollo

`npm audit` reporta una vulnerabilidad moderada en `esbuild` usada por `vite`. La correccion automatica sugerida fuerza una version mayor de Vite, asi que no conviene aplicar `npm audit fix --force` sin revisar compatibilidad.

Ademas, `vite.config.ts` tiene:

```ts
server: {
  port: 5173,
  host: true,
}
```

`host: true` expone el servidor de desarrollo en la red local. Para este proyecto no parece necesario.

Accion recomendada:

- Quitar `host: true` salvo que haya una razon concreta.
- Planificar upgrade de Vite y plugin PWA en una tarea separada.

### No hay librerias reales de PDF instaladas

Estado: corregido para el alcance inicial.

Ya estan instaladas las librerias que sostienen las 8 herramientas publicas:

- `pdf-lib` para modificar y generar PDFs.
- `JSZip` para salidas multiples.
- `pdfjs-dist` para renderizar paginas a imagenes.

Accion recomendada:

- [x] Instalar solo las librerias necesarias para las herramientas reales.
- [x] Cargar `pdfjs-dist` en la herramienta de PDF a imagenes.
- [x] Usar Web Workers para operaciones de PDF con `pdf-lib`.

### Catalogo de herramientas sobredimensionado para el estado actual

`src/tools/toolCatalog.ts` esta bien tipado y centralizado, pero lista demasiadas herramientas futuras.

Accion recomendada:

- [x] Separar herramientas publicas de backlog interno.
- [x] Exponer solo herramientas `available`.
- [x] Eliminar la categoria "Futuras" de la UI publica.

### ToolPage es un placeholder generico

`src/pages/ToolPage.tsx` muestra el mismo mensaje para todas las herramientas.

Problema:

- [x] Corregido. `ToolPage` renderiza el componente real segun `tool.implementation`.
- [x] Las herramientas muestran input, limites, validaciones y errores.

Accion recomendada:

- [x] Reemplazar placeholder por componentes reales por herramienta.
- [x] Si una herramienta no existe, no queda en el catalogo publico.

### Falta capa de dominio para herramientas PDF

Hoy no hay estructura para:

- [x] validacion de archivos;
- [x] limites de peso/cantidad;
- [x] errores de archivos corruptos/protegidos;
- [x] procesamiento en worker para operaciones PDF;
- [x] progreso/cancelacion en flujos pesados;
- [x] descarga segura;
- [x] limpieza de memoria/object URLs.

Accion recomendada:

- Crear una estructura por herramienta cuando se implemente el primer MVP:
  - `src/features/pdf-tools/...`
  - `src/features/pdf-tools/shared/...`
  - `src/workers/...`
- No crear abstracciones grandes antes de tener la primera herramienta funcionando.

### Falta tooling de calidad

No hay:

- [x] ESLint;
- [x] Prettier;
- [x] tests unitarios;
- tests e2e;
- CI;
- chequeo de accesibilidad;
- chequeo de bundle.

Accion recomendada:

- Agregar ESLint + Prettier antes de crecer el codigo.
- Agregar Vitest para utilidades y validaciones.
- Agregar Playwright cuando haya al menos una herramienta real.

## Limpieza de contenido recomendada

Eliminar o reescribir:

- `Self-hostealo` en `HomePage`.
- `Self-hosting` en `SiteFooter`.
- pasos de privacidad que recomiendan self-hostear.
- "Funciona offline" hasta que este probado.
- "Web Workers y WebAssembly hacen el trabajo" hasta que haya workers/wasm reales.
- "No entrenamos modelos con tus archivos" repetido en varias zonas; dejarlo solo en privacidad si se mantiene.
- comparacion directa "iLovePDF sube tus archivos" para evitar una landing agresiva y dependiente de otra marca.
- placeholders genericos de herramientas no disponibles.

Mantener, pero con menos repeticion:

- "Los archivos se procesan en tu navegador".
- "No se suben a nuestros servidores".
- "Codigo fuente auditable" si el repo va a ser publico.

## Plan incremental sugerido

### Etapa 1: limpiar base publica

- [x] Quitar self-hosting de la UI.
- [x] Reescribir hero, footer y privacidad con una sola promesa clara.
- [x] Ocultar herramientas no funcionales.
- [x] Quitar o completar PWA/offline.
- [x] Agregar configuracion de deploy para dominio.

### Etapa 2: preparar calidad minima

- [ ] Inicializar Git si corresponde.
- [x] Mantener `.gitignore` y asegurar que `node_modules/` y `dist/` no se versionen.
- [x] Agregar ESLint + Prettier.
- [x] Agregar scripts `lint`, `format`, `test`.
- [x] Resolver o planificar upgrade por `npm audit`.

### Etapa 3: construir el primer MVP real

Recomendacion: empezar por `merge` o `images-to-pdf`.

Debe incluir:

- [x] selector de archivos;
- [x] validacion de tipo, peso y cantidad;
- [x] estados vacio/cargando/procesando/error/listo;
- [x] mensajes de error claros;
- [x] procesamiento client-side real;
- [x] descarga del resultado;
- [x] limpieza de memoria;
- [x] tests de validacion.

### Etapa 4: ampliar herramientas

- [x] Agregar herramientas de a una.
- [x] Reutilizar componentes compartidos solo cuando haya duplicacion real.
- [x] No listar herramientas futuras como si fueran producto.

## Orden de correccion recomendado

1. [x] Limpiar copy y quitar self-hosting de la web publica.
2. [x] Decidir si PWA/offline queda o se desactiva temporalmente.
3. [x] Definir hosting con dominio y fallback SPA.
4. [x] Agregar lint/format.
5. [x] Construir una herramienta real.
6. [x] Recien despues volver a expandir catalogo.
