# Reglas de renderizado y mantenimiento — escinco
> Antes de crear cualquier componente visual, consultar DISENO.md para verificar si ya existe una clase reutilizable. Si no existe, seguir las convenciones de nombres y añadir el componente a css/componentes.css.


Este archivo rige cualquier modificación de la capa de UI del proyecto. Su objetivo es evitar regresiones a `innerHTML`, estilos inline y mezcla de lógica de negocio con renderizado.

## 1. Renderizado seguro (obligatorio)

- **Nunca** usar `element.innerHTML = \`...\`` con datos de usuario o dinámicos.
- **Nunca** usar `element.insertAdjacentHTML(...)` con datos dinámicos.
- Usar siempre `document.importNode(template.content, true)` o los helpers `contenidoDesdeTemplate(id, opciones)` / `contenidoDesdeFilas(id, filas, mapear)` de `js/ui/modal.js`.
- Rellenar datos con `.textContent = dato` (o `.value` para inputs). Nunca inyectar HTML del usuario.
- Si debe ir HTML dinámico (icono SVG del catálogo), usar la clave `html:` de `contenidoDesdeTemplate` o clonar el nodo correspondiente.

## 2. Templates

- Todo componente reutilizable o con datos dinámicos va en un `<template id="tpl-nombre-componente">` en `dashboard.html` (y replicarse idéntico en `demo.html`, verificado por `tests/plantillas.test.mjs`).
- Los IDs de templates, clases y funciones deben ir **en español**.
- Los huecos se declaran con `data-tpl="nombre"` (sin `@` dentro; los atributos van en `data-tpl-attr`).
- Un template no debe quedar sin uso (verificado por `plantillas.test.mjs`).

## 3. Estilos y DOM

- No usar estilos inline (`style="..."` o `element.style.x = ...`) salvo excepciones documentadas (CSS variables `--modal-x`/`--modal-y` para drag de modales persistentes).
- No usar `!important`.
- No introducir dependencias ni pasos de build (ES Modules vanilla, sin bundler).

## 4. Lógica de negocio

- No modificar lógica de negocio, solo la capa de renderizado.
- Mantener el mismo comportamiento exacto que antes (mismos IDs de DOM, mismos listeners, mismos nombres de clase CSS, mismas interacciones: click, doble click, clic sostenido, swipe).

## 5. Commits

- Uno por componente o página migrada: `refactor(ui): migrar [componente/página] a <template>`
- Si algo falla o el diagnóstico revela un problema mayor, parar y reportar antes de continuar.

## 6. Verificación

- Ejecutar `npm test` tras cada cambio (debe quedar TODO OK).
- No modificar tests existentes salvo que sea estrictamente necesario para cubrir un componente migrado.
- Antes de tocar una página, verificar que exista el `<template>` correspondiente en `dashboard.html` y `demo.html`.

## 7. Clave de Gemini (drov)

La API Key de Gemini **nunca** debe vivir en el cliente en producción.

### Desarrollo local (localhost)

1. Crear `.env.local` (gitignorado) con:
   ```
   GEMINI_API_KEY=TU_API_KEY_DE_GEMINI
   ```
2. Arrancar el servidor local con `npm run local`.
3. `drovServicio.js` detecta `localhost` y hace fetch directo a Gemini usando esa clave.

### Producción (Firebase Hosting)

1. Configurar el secreto en Secret Manager:
   ```
   firebase functions:secrets:set GEMINI_API_KEY
   ```
2. Desplegar la Cloud Function:
   ```
   firebase deploy --only functions
   ```
3. `drovServicio.js` detecta producción y llama a `drovProxy`, que lee la clave de Secret Manager y nunca la expone al navegador.

### Rotación de clave

La clave actual ya estuvo expuesta en el cliente. Rótenla en Google AI Studio antes de desplegar a producción.

### Nombre del asistente

El asistente se escribe siempre en minúsculas: **drov** (nunca "Drov" ni "DROV"). Esto aplica a:
- Textos de usuario (mensajes, bienvenida, avisos, placeholders).
- Comentarios de código.
- Nombres de variables y funciones (ej. `permisoDrov`, `obtenerPermisoDrov`).
- Nombres de clases CSS (`.drov-permisos-*`).

## Graphify (grafo de conocimiento)

- `graphify-out/` está en `.gitignore` (artefacto generado, 5.5 MB).
- Para regenerarlo: `graphify extract . --code-only`
- El reporte legible (`GRAPH_REPORT.md`) puede versionarse si es útil para el equipo.
- Los hooks de git (`graphify hook install`) se instalarán cuando el proyecto esté estable.

Las reglas de arquitectura, datos, seguridad y testing están en AGENTS-AGENTES.md. Aplican simultáneamente con este documento.
