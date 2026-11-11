# AGENTS-AGENTES.md — Base de trabajo para agentes (escinco)

> Documento complementario al AGENTS.md existente (que rige la capa de UI/renderizado). Ambos aplican simultáneamente: AGENTS.md para todo lo visual/renderizado, y este documento para arquitectura, lógica, datos, seguridad, testing y dependencias.

## 1. Respetar la arquitectura existente

- No crear capas, wrappers o abstracciones nuevas sin justificación. Usar la estructura de capas actual:
  - `js/pages/` → `js/ui/` → `js/services/` → `js/repositories/` → `js/models/` → `firebase/`
- Un cambio toca la capa mínima necesaria. Si la tarea es de lógica de negocio, modificar `services/` o `repositories/`, no duplicar lógica en `pages/` o `ui/`.
- No introducir dependencias ni pasos de build (ES Modules vanilla, sin bundler). El proyecto tiene una sola dependencia de producción (`@firecms/neat`); no añadir npm packages sin evaluar impacto.
- **SortableJS NO está aprobado.** Cualquier tarea que lo requiera debe ser aprobada explícitamente por el usuario antes de instalar.

## 2. Reutilizar antes de duplicar

- Antes de crear una función, componente o servicio, buscar si ya existe uno equivalente en `js/core/`, `js/services/`, `js/repositories/`, `js/ui/` o `css/componentes.css`.
- Consultar `DISENO.md` antes de crear cualquier clase CSS: verificar si existe una clase reutilizable (`.btn`, `.card-item`, `.modal`, `.form-input`, `.badge`, `.glass`, etc.). Si no existe, seguir las convenciones de nombres y añadirla a `css/componentes.css`.
- Reutilizar los wrappers de `firebase/firestore.js` para acceso a Firestore; no importar desde la CDN directamente.
- Reutilizar `cacheCapa` de `js/core/cache.js` para cache por usuario+clave; invalidar tras escrituras en repositorios.

## 3. Mantener consistencia con las convenciones del código

- JavaScript: ES Modules, `const` por defecto, `let` solo si se reasigna, `camelCase` para funciones/variables, comentarios en español, logs con `[INFO]`/`[WARN]`/`[ERROR]`.
- CSS: clases e IDs en español, kebab-case para IDs, tokens en `css/style.css`, componentes en `css/componentes.css`, estilos de página en `css/[pagina].css`. No estilos inline, no `!important`.
- Firestore: campos en `camelCase`, tipos en minúsculas, divisas en mayúsculas (`PEN`, `USD`), fechas como `Timestamp`, IDs personalizados en minúsculas con guiones bajos, todo bajo `usuarios/{uid}`.
- Templates: `<template id="tpl-nombre-componente">` en `dashboard.html` y `demo.html` (idénticos), rellenar con `.textContent`, nunca `innerHTML` con datos dinámicos (ver AGENTS.md existente).
- Nombre del asistente: siempre en minúsculas `drov` (textos, comentarios, variables, clases CSS).

## 4. Analizar dependencias antes de modificar módulos

- Antes de editar un archivo, identificar quién lo importa (grep de `from`/`import`) y a qué importa él.
- Verificar que el cambio no rompa el contrato de interfaces esperadas por otros módulos (firmas de funciones, formas de objetos devueltos, nombres de eventos DOM).
- Si se modifica un repositorio o servicio, comprobar que `cacheCapa.invalidar` se llama tras escrituras y que el modelo correspondiente (`js/models/`) sigue siendo válido.
- No cambiar nombres de IDs de DOM, listeners, nombres de clase CSS ni interacciones (click, doble click, clic sostenido, swipe) sin actualizar todos los consumidores.

## 5. Validar los cambios con pruebas apropiadas

- Ejecutar `npm test` tras cada cambio relevante; debe mostrar `TODO OK` y salir con código 0.
- Ejecutar `npm run lint` sobre los archivos modificados; no introducir nuevas violaciones de reglas de corrección.
- Si se agrega lógica no trivial (rama, bucle, parser, manejo de dinero, seguridad), agregar o extender un test en `tests/` siguiendo el patrón de `tests/helpers.mjs` (`nuevoReporter`, `extraerFuncion`, `export default`).
- Los tests leen el **código real** del repo, no copias. Un cambio que rompa una regla debe hacer fallar la suite.

## 6. No inventar resultados de pruebas

- Nunca afirmar que `npm test` pasó si no se ejecutó realmente.
- Nunca afirmar que un cambio está probado sin ejecutar los tests correspondientes.
- Si un test falla por una causa preexistente no relacionada con el cambio, reportarlo antes de continuar; no silenciar ni eliminar aserciones para ocultar el fallo.

## 7. Evitar refactorizaciones ajenas a la tarea

- Hacer solo lo necesario para completar la tarea solicitada.
- No reformatear, renombrar ni reestructurar código que no esté relacionado con la tarea (incluso si parece mejorable).
- Si se detecta deuda técnica relacionada, anotarla y reportarla; no corregir de golpe sin solicitud explícita.

## 8. Claves y secretos

firebaseConfig.apiKey (en firebase/config.js): pública por diseño de Firebase. Se protege con reglas de Firestore y API key restrictions en Google Cloud, no moviéndola al servidor. Un agente no debe intentar ocultarla ni eliminarla del cliente.

GEMINI_API_KEY: secreta. Solo en Secret Manager / Cloud Function drovProxy (functions/index.js usa defineSecret("GEMINI_API_KEY")). Nunca en js/, firebase/, *.html ni en tools/. Verificado en Fase 1: no aparece en cliente.

## 9. Informar archivos afectados y decisiones técnicas

- Al finalizar una tarea, listar:
  1. Archivos modificados, creados o eliminados.
  2. Decisiones técnicas tomadas (por qué se eligió ese enfoque, qué alternativas se descartaron).
  3. Resultados de `npm test` y `npm run lint`.
  4. Cualquier riesgo o deuda técnica detectada.

## Validación

npm test ejecuta 36 suites y debe salir TODO OK (exit 0). Verificado.

npm run lint ejecuta ESLint. Estado real en esta sesión: 0 errores, 0 warnings, exit code 0. Ver docs/DEUDA-021.md para deuda preexistente (~7600 errores declarados).

El estado del CI no es verificable desde OpenCode (falta gh). Se comprueba manualmente en https://github.com/dvid518/escinco/actions.

## Convenciones Firebase / Firestore

- `firebase/config.js`: `firebaseConfig` con claves públicas (apiKey es pública por diseño de Firebase).
- `firebase/firestore.js`: wrapper único de acceso a Firestore (`db`, `doc`, `getDoc`, `addDoc`, etc.), re-exportado para no importar desde CDN directamente.
- Persistencia offline: `getFirestore` sin `enablePersistence` (por defecto del SDK, memoria).
- Modelo de datos: todo bajo `usuarios/{uid}`, colecciones `cuentas`, `movimientos`, `activos`, `posiciones`, `pendientes`, `estrategias`, `metas`, `ordenes`, `trades`, `snapshots/{YYYY-MM-DD}`, `config/version`.
- Campos en `camelCase`, tipos en minúsculas, divisas en mayúsculas (`PEN`, `USD`), fechas como `Timestamp`, IDs personalizados en minúsculas con guiones bajos.
- Reglas en `firebase/firestore.rules` (validación MEDIA, aislamiento por `uid`).
- `cacheCapa` en `js/core/cache.js`: cache por usuario + clave, invalidada en repositorios tras escrituras.
- Cloud Functions en `functions/` (proxy `drovProxy` que lee `GEMINI_API_KEY` de Secret Manager).
- Modelo Gemini: el código usa `gemini-3.5-flash-lite` (functions/index.js). No cambiar a `2.5-flash-lite` sin verificar contra la API y sin aprobación explícita.
