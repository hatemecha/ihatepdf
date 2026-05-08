# Auditoria inicial de iHatePDF

Fecha: 2026-05-07

## Revision UI/UX y accesibilidad

Revision hecha sobre la app renderizada en `http://127.0.0.1:5173` con viewport desktop `1440x1000` y mobile `390x844`. No hay errores de consola; solo warnings futuros de React Router.

### Correcciones aplicadas

- [x] Eliminado el overflow horizontal en mobile en tabs, grids y nombres largos.
- [x] Inputs `type=file` ocultos fuera del orden de tabulación.
- [x] Foco visible en cards de herramientas.
- [x] Contraste corregido en superficies rojas de marca y acciones destructivas.
- [x] `Alert` ya no anuncia todo como alerta urgente.
- [x] Grilla de herramientas centrada para filas incompletas.
- [x] Copy público normalizado con acentos y menos texto repetitivo.
- [x] Editor beta con selección por teclado y movimiento con flechas.
- [x] GitHub Pages preparado con base `/iHatePDF/`, fallback SPA y workflow de deploy.

### Hallazgos originales - prioridad alta

#### 1. Hay scroll horizontal en mobile en flujos con tabs o nombres largos

Archivos relevantes:

- `src/features/pdf-tools/images/ImageToPdfTool.tsx`
- `src/features/pdf-tools/document/SinglePdfOperationTool.tsx`
- `src/features/pdf-tools/images/ImageToPdfSimpleMode.tsx`
- `src/features/pdf-tools/images/PdfToImagesTool.tsx`
- `src/features/pdf-tools/merge/MergePdfTool.tsx`

Evidencia:

- `/herramientas/images-to-pdf` en mobile queda con `scrollWidth` mayor que `clientWidth` por el `TabsList` de "Modo simple / Editor (experimental)".
- `/herramientas/rotate` con un PDF de nombre largo queda con `scrollWidth: 671` sobre `clientWidth: 390`.
- El grid de resumen/selector usa `grid gap-6 lg:grid-cols-[1.2fr_0.8fr]`; en mobile el track conserva el ancho minimo de contenido si los hijos no tienen `min-w-0`.

Impacto:

- Rompe lectura y navegacion en telefono.
- Hace que footer, cards y formularios parezcan desalineados.
- Dificulta usuarios con zoom alto o pantallas estrechas.

Accion recomendada:

- Agregar `min-w-0` a los hijos directos de grids y a wrappers que contienen textos truncados.
- Usar tracks seguros: `grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]`.
- En tabs internas, permitir wrap o convertir a layout vertical en mobile: `w-full flex-wrap` y triggers flexibles.

#### 2. Los inputs `type=file` ocultos son focuseables y no tienen nombre accesible

Archivos relevantes:

- `src/features/pdf-tools/merge/MergePdfTool.tsx`
- `src/features/pdf-tools/document/SinglePdfOperationTool.tsx`
- `src/features/pdf-tools/images/ImageToPdfSimpleMode.tsx`
- `src/features/pdf-tools/images/PdfToImagesTool.tsx`
- `src/features/pdf-tools/images/layout/ImageToPdfLayoutEditor.tsx`

Evidencia:

- En `/herramientas/merge`, al tabular en mobile el foco cae en un `input` con `className="sr-only"`, caja de `1x1`, sin texto ni `aria-label`, antes del boton visible "Elegir archivos".

Impacto:

- Usuarios de teclado o lector de pantalla encuentran un control invisible y sin contexto.
- La accion queda duplicada: input oculto + boton visible.

Accion recomendada:

- Si el boton visible es el unico control previsto, poner el input fuera del orden de tabulacion (`tabIndex={-1}` y `aria-hidden="true"`), manteniendo el click programatico.
- Alternativamente, usar un `<label>` visible asociado al input y eliminar el boton duplicado.

#### 3. El foco de teclado en las cards no es visible

Archivo relevante:

- `src/components/ToolCard.tsx`

Evidencia:

- Las cards usan un link absoluto `className="absolute inset-0"` como area clickeable.
- Al tabular hasta "Abrir Unir PDFs" no se ve un borde/foco claro en la card.

Impacto:

- Un usuario de teclado no sabe que herramienta esta enfocada.
- La grilla parece mouse-first aunque semanticamente los links existen.

Accion recomendada:

- Agregar estilo `focus-visible` al link absoluto o usar `group-focus-within` en `Card`.
- El foco deberia verse como borde/ring completo de la card, no solo sobre un elemento invisible.

#### 4. El editor experimental no es accesible sin puntero

Archivos relevantes:

- `src/features/pdf-tools/images/layout/InteractivePage.tsx`
- `src/features/pdf-tools/images/layout/ImageToPdfLayoutEditor.tsx`

Evidencia:

- Mover, redimensionar y rotar dependen de `PointerEvent`.
- Los handles de resize tienen `role="button"` pero `tabIndex={-1}`.
- No hay handlers de teclado para seleccionar, mover, redimensionar, rotar o borrar elementos del lienzo.

Impacto:

- Usuarios de teclado, switch control o baja motricidad no pueden usar el editor completo.
- En mobile, los handles son muy chicos y requieren precision fina.

Accion recomendada:

- Mantener el editor como experimental, pero no presentarlo como flujo principal.
- Agregar controles equivalentes por formulario para todas las acciones criticas.
- Hacer el elemento seleccionado focusable y soportar teclado: flechas para mover, Shift+flechas para pasos grandes, Delete para borrar, botones para rotar y ajustar capas.

### Prioridad media

#### 5. El color blanco sobre rojo no alcanza contraste AA en superficies de marca

Archivos relevantes:

- `src/styles/tokens.css`
- `src/components/Logo.tsx`
- `src/components/ui/button.tsx`

Evidencia:

- `--brand: oklch(0.66 0.24 25)` con `--brand-foreground: oklch(0.99 0 0)` da contraste aproximado 3.5:1.
- El mismo patron aparece en logo, iconos sobre fondo rojo y hover/active de botones brand.
- `--destructive` con texto blanco queda alrededor de 3.9:1.

Impacto:

- Texto pequeno como `iH` del logo y botones en estado hover no cumple WCAG AA para texto normal.
- Usuarios con baja vision o pantallas con brillo bajo pierden legibilidad.

Accion recomendada:

- Oscurecer el rojo de fondos que llevan texto blanco, o cambiar `brand-foreground` a un color oscuro cuando el fondo sea rojo vivo.
- Validar tambien `destructive` para botones con texto.

#### 6. `Alert` usa `role="alert"` para mensajes informativos y de exito

Archivo relevante:

- `src/components/ui/alert.tsx`

Evidencia:

- El componente base siempre renderiza `role="alert"`.
- Se usa para errores, exito y aviso informativo "Modo experimental".

Impacto:

- Lectores de pantalla anuncian mensajes no urgentes como alertas interruptivas.
- Puede resultar ruidoso en flujos con cambios de estado frecuentes.

Accion recomendada:

- Separar variantes semanticas: `role="alert"` solo para errores.
- Usar `role="status"` o `aria-live="polite"` para exito/progreso.
- Usar `role="note"` o sin live region para informacion estatica.

#### 7. La grilla de herramientas queda asimetrica en desktop

Archivo relevante:

- `src/components/ToolCategoryTabs.tsx`

Evidencia:

- El grid `xl:grid-cols-4` deja huerfanos alineados a la izquierda: 5 herramientas muestran una card sola en la segunda fila; 2 y 1 herramientas quedan pegadas a la izquierda de secciones anchas.

Impacto:

- La home se siente menos ordenada y rompe la expectativa de simetria visual.
- Se nota especialmente en "Convertir PDF" y "Editar PDF".

Accion recomendada:

- Centrar filas incompletas con una clase de grid/lista adaptada a cantidad de items.
- Alternativa simple: limitar ancho por seccion y usar columnas segun cantidad (`max-w-3xl` para 2 items, `max-w-sm` para 1 item).

#### 8. La UI en espanol omite acentos de forma generalizada

Archivos relevantes:

- `src/pages/HomePage.tsx`
- `src/tools/toolCatalog.ts`
- Componentes de herramientas en `src/features/pdf-tools/**`

Impacto:

- Baja la percepcion de calidad.
- Puede afectar pronunciacion en lectores de pantalla.
- Hace que el producto se sienta menos cuidado para usuarios hispanohablantes.

Accion recomendada:

- Corregir copy visible usando las versiones con tilde de `Codigo`, `paginas`, `imagenes`, `sesion`, `operacion`, etc.
- Definir una regla: codigo/identificadores en ingles, texto visible en espanol natural.

### Prioridad baja

#### 9. Los botones deshabilitados quedan demasiado apagados

Archivos relevantes:

- `src/components/ui/button.tsx`
- Flujos de herramientas PDF

Impacto:

- En dark mode, el boton principal deshabilitado comunica estado, pero el texto queda con poca legibilidad.
- Para usuarios nuevos puede parecer un bug si no ven el motivo cerca.

Accion recomendada:

- Mantener el boton deshabilitado pero acompanarlo siempre con una razon persistente.
- Considerar una variante disabled con borde/texto mas legible que `opacity-50`.

#### 10. El texto de ayuda del editor experimental se parte de forma incomoda

Archivo relevante:

- `src/features/pdf-tools/images/layout/ImageToPdfLayoutEditor.tsx`

Evidencia:

- En desktop y mobile, el texto "Manten Shift..." se corta dejando `Shift` en una linea aislada.

Accion recomendada:

- Reescribir el copy en bullets cortos.
- Estilizar `kbd` con `whitespace-nowrap` y separar atajos en una lista.

## Orden recomendado de correccion UI/UX

1. Eliminar overflow horizontal mobile en tabs, grids y nombres largos.
2. Corregir foco de teclado: inputs file ocultos y cards.
3. Ajustar contraste de marca/destructive.
4. Separar semantica de alertas.
5. Centrar grillas incompletas y revisar simetria de home.
6. Normalizar copy visible en espanol natural.
7. Mejorar el editor experimental con equivalentes por teclado o dejarlo claramente secundario.

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
- [x] Inicializar Git si este directorio va a ser el repo definitivo.
- [x] Agregar CI cuando exista repositorio remoto.
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
- Hay repositorio Git inicializado y remoto `origin` en `https://github.com/hatemecha/iHatePDF.git`.
- Existen `node_modules/` y `dist/` en la carpeta local; estan ignorados por `.gitignore`, pero no puedo confirmar tracking porque no hay `.git`.
- Hay tests unitarios, lint y formatter configurados.
- Hay workflow de GitHub Pages con lint, tests y build antes de publicar.

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
