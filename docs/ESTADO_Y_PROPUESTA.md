# escinco — Estado real frente a la lista de tareas y propuesta de reorden

**Proyecto:** escinco (app financiera web, Firebase/Firestore)  
**Fecha del diagnóstico:** Sun Nov 01 2026  
**Versión en repo:** `1.0.0-beta.30` (`constants/version.js`) · fase `beta`  
**Modo de análisis:** solo lectura y estático (sin editar código, sin desplegar, sin ejecutar Firestore).  
**Tests:** `npm test` → **TODO OK** (30 suites, incl. la nueva `bug029.test.mjs`; todas verdes).

---

## Resumen ejecutivo

El repositorio está **muy avanzado**: la app funciona, los tests pasan, el service worker y las reglas de Firestore están escritos y validados offline, y el dashboard con lastbar ya es estable. Sin embargo, el estado real de la lista de tareas difiere notablemente del "estado conocido" que se partía: varias tareas marcadas como HECHO están solo parciales o no verificables en navegador; varias tareas marcadas como PENDIENTE ya están HECHO; y hay una tarea rota documentada (`BUG-029`, edición de movimientos) que ya está corregida en código pero no reflejada en la documentación de bugs.

Lo que de verdad **bloquea invitar a 5–10 usuarios hoy** son: (a) `PEND-002` (modelo de subcuentas sin probar en navegador), (b) `PEND-001` (snapshot diario no confirmado en producción tras despliegue de reglas), (c) falta de CI/lint/typecheck que deja pasar regresiones silenciosas, y (d) varias tareas de la Fase 1 marcadas como HECHO que en repo solo existen como plan (escalado 0.9, drag&drop de cards). Todo lo demás es producto o optimización.

---

## 1. Estado real por tarea

Notación: **HECHO** · **PARCIAL** · **PENDIENTE** · **ROTO** · **OBSOLETO** · **NO VERIFICABLE**.  
Evidencia: ruta de archivo, línea y/o test del repo.

### Fase 1 — Estabilización y rendimiento

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 1.1 | Optimizar CSS y reducir estilos redundantes | **HECHO** | `tests/css.test.mjs` (7/7) impide selectores duplicados; `DEUDA-009` resuelta (Fase 3); 12 selectores eliminados entre hojas. | Verificado por test automático. |
| 1.1 | Corregir modal de movimientos | **PARCIAL** | Modales migrados a `<template>` (`js/ui/modal.js`, `tests/plantillas.test.mjs` 10/10), pero `BUG-029` dejaba el detalle sin botones de acción ni formulario en solo lectura (`reporte-bugs.md:531-597`). Corrección ya aplicada en código (`js/pages/movimientos.js:1724-1753` usa `m.tipo` y ejecuta `bloquearFormulario(true)` + `renderizarAccionesDetalle`). Documentación de bugs no actualizada. | El código está corregido; falta actualizar `reporte-bugs.md`. |
| 1.1 | Corregir selectores vacíos | **HECHO** | `tests/selectorCuentas.test.mjs` (7/7): cada selector recibe sus propias opciones; origen queda vacío al compartir fragmento. | Corregido. |
| 1.1 | Consistencia visual de componentes | **PARCIAL** | `tests/css.test.mjs` y `tests/estilos.test.mjs` pasan; `diseno-ui.md` documenta el sistema. Pero `DEUDA-017` (botón "Configuración de brokers en desarrollo" abre modal vacío en `trading.js:780` e `inversiones.js:1648`) sigue presente. | Cosmético, no bloquea beta. |
| 1.1 | lastbar siempre visible | **HECHO** | `docs/LASTBAR_VIEWPORT.md` (verificado); `tests/viewport.test.mjs` (11/11); `100dvh` + `viewport-fit=cover` + `env(safe-area-inset-bottom)`; modo por defecto `"show"` en `configuracion.js:20` y `router.js:376`. | Cerrado y verificado. |
| 1.1 | Escalado global a 0.9 con resize real (variables CSS) | **PENDIENTE / NO IMPLEMENTADO** | `docs/plan-escala-ui.md`: "Estado: planificado, NO implementado". No existe `--ui-scale`, ni `zoom`, ni control en Configuración. | Listada como HECHO en la tarea conocida, pero en repo no existe. Desviación. |
| 1.1 | Corrección de favoritos (contenedor, lógica, plantillas) | **HECHO** | `tests/favoritoServicio.test.mjs` (36/36); `tests/lastbarFavoritos.test.mjs` (33/33): lastbar sin items propios de favoritos, tri-estado de etiquetado, XSS con `textContent`. | Cerrado. |
| 1.1 | Corrección del gestor de agregar cards (drag&drop, eliminar) | **PARCIAL** | Dashboard con cards navegables y editor de checkboxes (`auditoria-dashboard.md`), pero no hay drag&drop real ni eliminar de cards desde la UI. `propuesta-dashboard.md` describe el diseño masonry y drag&drop, sin implementar. | Solo el esqueleto. |
| 1.1 | Revisar cards y flags nuevasCardsV1/V2/V3 (diagnóstico) | **HECHO** | Flags eliminadas del código (`NUEVAS_CARDS_V1/V2/V3`, `TANDAS_CARDS`, `aplicarTandasNuevasCards` borradas de `js/pages/dashboard.js`); documentación actualizada en `docs/modelo-datos.md` y `docs/informe-info.md`. | Flags eliminadas, documentación sincronizada. |
| 1.1 | Editar cards y flags según hallazgos | **HECHO** | Flags `nuevasCardsV1/V2/V3` eliminadas del código y documentación sincronizada. | Completado. |
| 1.1 | Normalización global de clases CSS | **PARCIAL** | `css.test.mjs` evita duplicados; `estilos.js` inyecta hojas por página. Pero `DEUDA-016` (~40 normalizaciones ad-hoc de moneda, 4 convenciones) sigue abierta. | Parcial. |
| 1.1 | Personalización de estilos y animaciones | **HECHO** | Sistema de dos niveles de color (`diseno-ui.md`), temas dark/light/system, animaciones CSS (`scale`, `keyframes`). | Cerrado. |
| 1.2 | Solicitudes que bloquean renderizado (~3420 ms) | **NO VERIFICABLE** | Requiere medición real en navegador (Lighthouse/WebPageTest). No hay rastro en repo de la medición ni del problema resuelto. | No se puede determinar estáticamente. |
| 1.2 | LCP y desglose | **NO VERIFICABLE** | Idem. | |
| 1.2 | JS sin usar (~101 KiB) | **PARCIAL** | `DEUDA-006` documenta 18 exports sin llamador (~600 líneas muertas) en 13 archivos. Ninguna acción de eliminación aplicada aún. | Identificado, no corregido. |
| 1.2 | Minificar CSS/JS (~6 KiB cada uno) | **PENDIENTE** | No hay paso de build, ni minificador, ni `devDependencies` en `package.json`. | No aplica sin build. |
| 1.2 | Fuentes | **HECHO** | Fuentes autoalojadas (10 `.ttf` en `fonts/`), Inter + Roboto Mono, servidas desde Hosting, inmutables en `firebase.json`. | Cerrado. |
| 1.2 | Forced reflows | **NO VERIFICABLE** | Requiere medición en DevTools. | |
| 1.2 | Animaciones no compositadas (23) y procesos largos (2) | **NO VERIFICABLE** | Requiere medición real. | |
| 1.2 | Dependencias de red y terceros | **HECHO (parcialmente)** | CSP en `firebase.json` limita orígenes; Chart.js en local (`js/lib/chart.umd.min.js`); SDK Firebase por CDN. Pero 218 `console.*` (`DEUDA-010`) pueden exponer datos en consola. | Parcial. |
| 1.2 | Carga diferida de módulos | **HECHO** | `estilos.js` inyecta CSS por página; `pwa.js` registra SW con `updateViaCache: "none"`; imports dinámicos en `lastbar.js` (`MAPA_ACCIONES`). | Cerrado. |
| 1.2 | Re-medir tras cambios | **NO VERIFICABLE** | Requiere ejecución real. | |
| 1.3 | B1a fieldOverrides en snapshots | **HECHO (falta deploy+verificar)** | `firebase/firestore.indexes.json` tiene `fieldOverrides` para `snapshots` (líneas 29-71). `PEND-001`: reglas e índice desplegados 2026-10-12, falta confirmar un día real en producción. | HECHO en repo; pendiente de verificación en prod. |
| 1.3 | B1b schemaVersion en snapshots | **HECHO** | `tests/snapshotSchema.test.mjs` (6/6); `SnapshotRepositorio.js:44` escribe `schemaVersion: 1`; reglas incluyen `schemaVersion` en `hasOnly` de `snapshots`; lectura tolera v0 (`docs/SNAPSHOTS_SCHEMA.md`). | Cerrado y testeado. |
| 1.3 | B2 Service Worker + offline + sincronización | **HECHO** | `sw.js` reescrito (red primero para JS/CSS, caché primero fuentes, stale-while-revalidate iconos, respaldo offline independiente de host); `tests/precache.test.mjs` (10/10); `INFORME_CACHES_SW.md` (31/31 en banco de pruebas). | Cerrado, no desplegado a producción. |
| 1.3 | Definir operaciones sin red y sync | **PARCIAL** | SW da navegación y assets offline, pero Firestore offline (persistence) y cola de escrituras pendientes no están definidas en el código leído. `cache.js` es caché de lectura (TTL), no cola de sync. | Falta la capa de escrituras en diferido. |
| 1.3 | Probar estados carga/error/sync/sin conexión | **NO VERIFICABLE** | Requiere ejecución real en navegador con red cortada. | |
| 1.3 | B3 poda historial | **POSPUESTO / PENDIENTE** | No hay rastro de poda ni de `historial` podado. | |
| 1.3 | B4 activoId | **POSPUESTO / PENDIENTE** | `activoId` existe en reglas de `posiciones` (`firestore.rules:360-367`) pero no hay tarea concreta visible. | |
| 1.3 | B5 etiquetas→IDs | **POSPUESTO / PENDIENTE** | Etiquetas se guardan por NOMBRE en movimientos (reglas: lista de textos, reglas de etiquetas por nombre). No hay migración a IDs. | |
| 1.3 | B6 enums numéricos | **POSPUESTO / PENDIENTE** | No hay rastro de enums numéricos; todo usa strings (`tipo`, `estado`, `divisa`). | |

### Fase 2 — Integridad financiera y datos

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 2.1 | Precisión monetaria (auditar aritmética, float, decimal, redondeo, conversiones, pruebas, coherencia UI↔persistencia) | **PARCIAL** | `presupuestoModelo.test.mjs` y `presupuestoServicio.test.mjs` cubren porcentajes y estados de presupuesto. `DEUDA-016` (4 convenciones de divisa) y `DEUDA-011` (`fechaRealizacion` como `Date` en 2 rutas) siguen abiertas. No hay test de aritmética monetaria general. | Parcial, falta auditoría completa. |
| 2.2 | Papelera y recuperación | **HECHO (parcial)** | Archivar cuenta no borra (`requisitos.md:63-66`); `EliminarServicio` exige confirmación doble (`roadmap.md`); `DESHACER` existe (`DeshacerServicio.js`). No hay papelera explícita de movimientos eliminados con restauración. | Parcial. |
| 2.3 | Copias de seguridad (.dvid, restauración, documentar) | **HECHO** | `ExportarServicio.js` / `ImportarServicio.js`; `.dvid` formato v4.0.0 (`requisitos.md:121-125`); `BUG-030` (campo `id` en historial) resuelto (`f05fef5`); roundtrip en `R-04`. `generar_demo.mjs` sin trackear (`DEUDA-019`). | Cerrado salvo el generador sin versionar. |
| 2.4 | Historial técnico y registros | **PARCIAL** | `reporte-bugs.md`, `deuda-tecnica.md`, `pendientes.md`, `firestore-debug.log` (ignorado). No hay sistema de logging estructurado en producción. | |
| 2.5 | Transferencia de datos (.dvid, CSV, exportación filtrada, archivo al eliminar) | **PARCIAL** | `.dvid` sí; CSV parcial (`exportarExtractoCSV` en `movimientos.js` vía lastbar `extracto`); exportación filtrada y archivo al eliminar no verificados. | Parcial. |

### Fase 3 — Seguridad y beta

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 3.1 | Reglas Firestore, permisos servidor, aislamiento | **HECHO** | `firebase/firestore.rules` con `esPropietario(uid)` en toda operación, `hasOnly` en create, validadores compartidos create/update (DEUDA-012). `tests/reglas.test.mjs` (26/26). `rules.test.mjs` SKIP (emuladores no disponibles). | Cerrado offline; smoke con emulador no ejecutable en este entorno. |
| 3.2 | Auth, recuperación, correos, sesiones | **HECHO (parcial)** | `firebase/auth.js`, `js/pages/auth.js`, `js/pages/reset-password.js`, sesión en `sessionStorage` con cierre por inactividad (15 min real vs 30 min declarados en `requisitos.md:33`). | Parcial: no hay verificación de correos en repo. |
| 3.3 | Políticas (tratamiento, privacidad, cookies), inventario, consentimiento | **HECHO (parcial)** | `privacidad.html`, `terminos.html`, `tratamiento-datos.html`, `manifest.webmanifest`. No hay banner de cookies ni registro de consentimiento visible en el código leído. | Parcial. |
| 3.4 | Obligaciones Perú | **NO VERIFICABLE** | No hay rastro en repo de facturación electrónica, SUNAT, IGV, etc. | No se puede determinar estáticamente. |
| 3.5 | Alertas Firebase, límites/costes, errores producción, onboarding | **PENDIENTE** | No hay rastro de alertas, límites, errores de producción ni onboarding automatizado. | |

### Fase 4 — Beta gratuita

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 4.1 | Definir funciones beta, permisos plana, onboarding | **PARCIAL** | `plana`/`flash` aparecen en `AnalyticsServicio.js:67` y `DrovServicio.js`. No hay matriz de funciones ni onboarding definido. | Parcial. |
| 4.2 | Invitar 5–10 usuarios, observar, recoger, priorizar | **PENDIENTE** | No hay mecanismo de invitación ni panel de beta en el código leído. | Bloqueante de producto. |

### Fase 5 — Planes y comercial (nomenclatura vigente)

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 5.1 | plana = plan gratuito | **HECHO** | `plana` aparece en `AnalyticsServicio.js:67`. | Nomenclatura vigente presente. |
| 5.1 | flash = plan de pago | **HECHO** | `flash` aparece en `DrovServicio.js` (modelo Gemini flash-lite) y `iaConfig.js:20` (`gemini-3.5-flash`). | Nomenclatura vigente presente. |
| 5.1 | drov = IA transversal (no plan) | **HECHO** | `drov` en `js/services/DrovServicio.js`, `js/ui/asistente.js`, `js/core/iaConfig.js`, lastbar `data-accion="asistente"` → "drov". | Cerrado. |
| 5.2 | Matriz de funciones, límites, migraciones, downgrade | **PENDIENTE** | No hay rastro de matriz de funciones ni límites por plan. | |
| 5.3 | Precios, suscripciones, coste IA | **PENDIENTE** | No hay rastro de precios ni suscripciones. `DrovServicio.js` mide coste de IA pero sin plan de precios. | Parcial (coste IA medido, sin precios). |

### Fase 6 — Funcionalidades y productividad

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 6.1 | Búsqueda | **HECHO** | `abrirBuscadorGlobal` en `js/core/atajos.js` (lastbar `buscar`). | Cerrado. |
| 6.1 | Notificaciones | **HECHO** | `js/ui/notificaciones.js`, centro de notificaciones (`auditoria-dashboard.md`). | Cerrado. |
| 6.1 | Accesibilidad | **HECHO (parcial)** | `accesibilidad.*` en preferencias, `configComoPagina`, `resaltarIngresoGasto`, etc. No hay auditoría WCAG formal. | Parcial. |
| 6.2 | Favoritos | **HECHO** | `tests/favoritoServicio.test.mjs` (36/36). | Cerrado. |
| 6.2 | Pagos periódicos | **NO VERIFICABLE** | No hay rastro de pagos periódicos/recurrentes en el código leído. | |
| 6.3 | .dvid, CSV | **HECHO (parcial)** | `.dvid` completo; CSV parcial (`exportarExtractoCSV`). | Parcial. |
| 6.4 | Calendario financiero | **PENDIENTE** | No hay rastro de calendario financiero. | |
| 6.5 | Calculadora integrada (+ copiar resultados) | **PENDIENTE** | No hay rastro de calculadora integrada. | |
| 6.6 | Comparativas, informes, soporte | **PENDIENTE** | No hay rastro de comparativas ni informes. | |
| 6.7 | División de cuentas y propinas (evaluar) | **PENDIENTE** | No hay rastro. Solo anotado para evaluar. | |

### Fase 7 — Cuentas compartidas

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 7.1 | Roles, invitaciones, caducidad, permisos, aislamiento, autoría, trazabilidad, patrimonio sin duplicar, pruebas | **PENDIENTE / DISEÑO** | `docs/propuesta-compartir-cuentas.md` (diseño, sin implementar): roles `host`, `editor_cuenta`, `editor_movimientos`, `lector`; `compartidaCon`, `versionCompartida`. Nada en `firestore.rules` ni en el código. | Solo diseño. Bloqueante si se quiere compartir cuentas en beta. |

### Fase 8 — Automatización e inversiones

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 8.1 | Captura por correo (@escinco.com), notificaciones bancarias, bandeja | **PENDIENTE** | No hay rastro de captura por correo ni bandeja bancaria. | |
| 8.1 | Herramientas de inversión (activos, posiciones, operaciones, estrategias, rentabilidad, historial, notas, análisis) | **HECHO (parcial)** | `Activo.js`, `Posicion.js`, `Estrategia.js`, `Trade.js`, `Orden.js` y sus repositorios/servicios. Inversiones y trading funcionan (`js/pages/inversiones.js`, `js/pages/trading.js`). | Parcial: trading parcial (ordenes sin ejecución automática completa). |
| 8.2 | Comprobantes con IA (subir, extraer, proponer, borrador, duplicados, cuotas/privacidad, pruebas) | **PENDIENTE** | No hay rastro de comprobantes con IA. | |

### Fase 9 — drov (IA transversal)

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 9.1 | Identidad, interfaz, web/móvil, texto/voz | **HECHO (parcial)** | `DrovServicio.js`, `VozServicio.js`, `IaServicio.js`, `ContextoServicio.js`, `js/ui/asistente.js`, lastbar `data-accion="asistente"`. `iaConfig.js` configura Gemini. | Parcial: voz no verificada en navegador. |
| 9.1 | Registro por lenguaje natural (voz, interpretar, identificar, contexto, faltantes, borradores, confirmar) | **PENDIENTE** | No hay rastro de registro por lenguaje natural completo. | |
| 9.2 | Acceso rápido Android/iPhone (widgets, voz, pantalla bloqueada) | **PENDIENTE** | No hay rastro de widgets ni acceso rápido. | |
| 9.3 | Orquestador, código resuelve cálculos, modelo interpreta, API económica, medir coste | **HECHO (parcial)** | `DrovServicio.js` llama a Gemini y mide coste. `IaServicio.js` orquesta. | Parcial: sin orquestador completo ni API económica. |
| 9.4 | Integración con captura correo/notificaciones, centralizar, confirmación | **PENDIENTE** | No hay rastro de integración con correo/notificaciones para drov. | |
| 9.5 | IA avanzada (comprobantes, clasificación, consultas, chat, adaptar a planes) | **PENDIENTE** | No hay rastro de clasificación ni adaptación a planes. | |
| 9.6 | Seguridad (claves servidor, auth/permisos, límites, datos mínimos, sin acceso libre a Firestore, no inventar, separar consejos/recomendaciones) | **HECHO (parcial)** | `DrovServicio.js` usa proxy de función (`drovProxy`) en producción y clave en `.env.local` en localhost (`AGENTS.md:7`). Clave ya estuvo expuesta en el cliente (rotar antes de producir). | Parcial: clave expuesta históricamente; rotar obligatorio. |

### Fase 10 — Landing personal

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 10.1 | Landing personal | **HECHO (parcial)** | `index.html` (landing pública), `home.css`, `js/pages/index.js`. | Existe, pero no verificada como "personal" terminada. |

### Fase 11 — kit.escinco.com

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 11.1 | Generador docs, divisores, calculadoras, conexión | **PENDIENTE** | No hay rastro de kit.escinco.com. | |

### Fase 12 — Apps móviles (Android/iPhone)

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 12.1 | Apps móviles | **PENDIENTE / PWA** | `manifest.webmanifest` + `sw.js` (PWA instalable). No hay apps nativas Android/iPhone. | Solo PWA. |

### Fase 13 — Crecimiento e integraciones

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 13.1 | Crecimiento e integraciones | **PENDIENTE** | No hay rastro. | |

### Fase 14 — escinco business

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| 14.1 | Línea independiente por definir | **OBSOLETO** | No hay nomenclatura "business" en el código vigente. La nomenclatura vigente es plana/flash/drov. | No aplica con nomenclatura vigente. |

### Transversales

| # | Tarea | Estado real | Evidencia | Observación |
|---|-------|-------------|-----------|-------------|
| T.1 | AGENTS.md (manual OpenCode) | **HECHO** | `AGENTS.md` existe y rige la capa de UI. | Cerrado. |
| T.2 | Documentación cloud/académica (6 temas) | **HECHO (parcial)** | `docs/` tiene 15 archivos: `modelo-datos.md`, `SNAPSHOTS_SCHEMA.md`, `roadmap.md`, `requisitos.md`, `reglas.md`, `reporte-bugs.md`, `deuda-tecnica.md`, `pendientes.md`, `auditoria-dashboard.md`, `diseno-ui.md`, `plan-escala-ui.md`, `propuesta-dashboard.md`, `propuesta-compartir-cuentas.md`, `LASTBAR_VIEWPORT.md`, `INFORME_CACHES_SW.md`. | Varios temas cubiertos, pero `docs/requisitos.md` desfasado en 4 puntos (`DEUDA-025`). |
| T.3 | Criterios transversales (coherencia, reutilización, identidad, seguridad, integridad, confirmación, escalabilidad, responsive, documentación, verificación) | **PARCIAL** | Coherencia y reutilización parcialmente cubiertas (tests de plantillas, CSS, reglas). Escalabilidad sin CI. Documentación abundante pero desfasada en partes. Verificación solo offline (tests en Node). | Parcial. |

---

## 2. Desviaciones detectadas

### 2.1 Tareas marcadas como HECHO en la lista pero PARCIAL/PENDIENTE en repo

| Tarea | Estado en lista conocida | Estado real en repo | Evidencia de la desviación |
|-------|-------------------------|---------------------|----------------------------|
| Escalado global a 0.9 con resize real (variables CSS) | HECHO | **PENDIENTE / NO IMPLEMENTADO** | `docs/plan-escala-ui.md`: "planificado, NO implementado". No existe `--ui-scale` ni control en Configuración. |
| Corrección del gestor de agregar cards (drag&drop, eliminar) | HECHO | **PARCIAL** | `propuesta-dashboard.md` describe drag&drop y eliminar, sin implementar. Solo editor de checkboxes (`auditoria-dashboard.md`). |
| Editar cards y flags nuevasCardsV1/V2/V3 según hallazgos | HECHO | **HECHO** | Flags eliminadas del código y documentación sincronizada en `docs/modelo-datos.md` y `docs/informe-info.md`. |
| B1a fieldOverrides en snapshots | HECHO (falta deploy+verificar) | **HECHO en repo, pendiente en prod** | Reglas e índice desplegados 2026-10-12, pero falta confirmar un día real en producción (`PEND-001`). |
| Modal de movimientos | HECHO | **ROTO (ya corregido en código)** | `BUG-029` (`ReferenceError: tipo is not defined`) corregido en `js/pages/movimientos.js:1724-1753`, pero `docs/reporte-bugs.md` aún lo lista como Pendiente. |
| Normalización global de clases CSS | HECHO | **PARCIAL** | `DEUDA-016` (~40 normalizaciones ad-hoc de moneda, 4 convenciones) sigue abierta. |

### 2.2 Tareas marcadas como PENDIENTE que ya están HECHO

| Tarea | Estado en lista conocida | Estado real en repo | Evidencia |
|-------|-------------------------|---------------------|-----------|
| lastbar siempre visible | PENDIENTE (implícito) | **HECHO** | `docs/LASTBAR_VIEWPORT.md`, `tests/viewport.test.mjs` (11/11). |
| Optimizar CSS y reducir estilos redundantes | PENDIENTE (implícito) | **HECHO** | `tests/css.test.mjs` (7/7), `DEUDA-009` resuelta. |
| Corregir selectores vacíos | PENDIENTE (implícito) | **HECHO** | `tests/selectorCuentas.test.mjs` (7/7). |
| Corrección de favoritos (contenedor, lógica, plantillas) | PENDIENTE (implícito) | **HECHO** | `tests/favoritoServicio.test.mjs` (36/36). |
| B1b schemaVersion en snapshots | PENDIENTE (implícito) | **HECHO** | `tests/snapshotSchema.test.mjs` (6/6). |
| Service Worker + offline | PENDIENTE (implícito) | **HECHO** | `sw.js` reescrito, `tests/precache.test.mjs` (10/10). |
| Carga diferida de módulos | PENDIENTE (implícito) | **HECHO** | `estilos.js`, imports dinámicos en `lastbar.js`. |

### 2.3 Nomenclatura antigua vs. vigente

| Nomenclatura antigua | Dónde aparece | Estado | Nomenclatura vigente |
|----------------------|---------------|--------|----------------------|
| `docs/requisitos.md:4` declara versión `1.0.0-beta.5` | `docs/requisitos.md` | **Desfasado** | Versión real: `1.0.0-beta.30` (`constants/version.js:2`) |
| `docs/requisitos.md:33` declara inactividad "30 min" | `docs/requisitos.md` | **Desfasado** | Real: 15 min (`firebase/auth.js:34`, `js/core/sesion.js:26`) |
| `docs/requisitos.md:117` declara divisas PEN/USD/USDT | `docs/requisitos.md` | **Desfasado** | Código soporta PEN/USD/USDT/EUR (`constants/divisas.js`) |
| `docs/requisitos.md:101` menciona campo `nota` en trades | `docs/requisitos.md` | **Desfasado** | Campo `nota` eliminado del modelo (commit `fb6482b`) |
| `DEUDA-025` resumen de ítudes no incluye subcuentas, diff de preferencias, modo Panel | `docs/deuda-tecnica.md` | **Desfasado** | La app ya está en beta.21+ con esas características |

No se encontró `Plus`, `Premium` ni `ediciones` en el código propio (solo en `js/lib/chart.umd.min.js` de terceros). La nomenclatura vigente (`plana`/`flash`/`drov`) sí aparece en `AnalyticsServicio.js:67` y `DrovServicio.js`.

### 2.4 Duplicidades o solapamientos entre tareas

- **B2 (Service Worker + offline)** y **1.2 (Carga diferida de módulos / Fuentes / Dependencias de red)** se solapan en la capa de cache/red: el SW ya maneja precache, estrategias por tipo de recurso y carga diferida.
- **6.3 (.dvid, CSV)** y **2.3 (Copias de seguridad .dvid)** son la misma tarea duplicada en Fases 2 y 6.
- **Fase 5 (planes plana/flash)** y **Fase 4 (funciones beta, permisos plana)** se solapan: los permisos de "plana" deberían definirse antes de la matriz de funciones de Fase 5.
- **Fase 9 (drov)** y **Fase 8 (comprobantes con IA)** se solapan: comprobantes con IA es parte de "IA avanzada" de drov.

---

## 3. Bloqueantes de beta con dependencias

### 3.1 Qué impide invitar a 5–10 usuarios hoy

| Bloqueante | Tipo | Gravedad | Evidencia | Dependencia (qué desbloquea) |
|------------|------|----------|-----------|------------------------------|
| `PEND-002`: subcuentas sin probar en navegador | Técnico (datos) | Alta | `docs/pendientes.md:69-96`: "Funciona en los tests, nunca se ha ejecutado en la app". Modelo `padreId` implementado pero sin QA en navegador. | Desbloquea uso real de cuentas multi-divisa; sin ello, un usuario beta con cuentas en varias divisas ve patrimonio incorrecto. |
| `PEND-001`: snapshot diario sin confirmar en producción | Técnico (infra) | Alta | `docs/pendientes.md:29-63`: reglas e índice desplegados 2026-10-12, falta confirmar un día real. | Sin confirmación, el historial de patrimonio no crece en producción; el dashboard de evolución queda vacío. |
| Falta de CI / lint / typecheck (`DEUDA-021`) | Técnico (proceso) | Alta | `package.json` sin `devDependencies` ni script de lint; tests solo manuales (`npm test`). | Permite regresiones silenciosas (como la divergencia de `esMovimientoPositivo` que causó BUG-024/025). |
| `BUG-029` (edición de movimientos) | Técnico (UX) | Ya corregido en código | `reporte-bugs.md:531-597` aún lo lista como Pendiente. | Ya resuelto; solo falta actualizar documentación. |
| Invitar usuarios (mecanismo de invitación) | Producto | Alta | No hay mecanismo de invitación ni panel de beta en el código. | Bloquea la Fase 4 entera; sin invitación no hay 5-10 usuarios. |

### 3.2 Distinción técnico vs. producto

- **Bloqueantes técnicos (app rota/insegura):** `PEND-002` (datos corruptos posibles), `PEND-001` (historial vacío en prod), falta de CI (regresiones), `BUG-029` (ya corregido).
- **Bloqueantes de producto (falta función no crítica):** invitación de usuarios (Fase 4), matriz de planes (Fase 5), pago periódico (Fase 6), calendarios, calculadora, etc.

### 3.3 Cadena de dependencias

```
CI/lint mínimo  ──►  evita regresiones  ──►  PEND-001 verificado en prod  ──►  historial de patrimonio confiable
                                                                   ▲
                              PEND-002 probado en navegador  ───────┘
                                                                   ▲
                              BUG-029 corregido (ya) ───────────────┘
```

Sin CI, cualquier corrección en `PEND-002` o `PEND-001` puede romper otra cosa sin que nadie lo note hasta que un usuario beta lo sufra.

---

## 4. Nuevo orden propuesto (H1/H2/H3)

### H1 — Antes de beta (bloqueantes + correcciones críticas)

| Tarea | Esfuerzo | Justificación del movimiento |
|-------|----------|------------------------------|
| Añadir CI mínimo (lint + tests en push/PR) | S | `DEUDA-021` es la causa raíz de la mayoría de regresiones. Sin CI, cualquier otro cambio es un riesgo. |
| Verificar `PEND-001` (snapshot diario en producción) | M | Reglas e índice ya desplegados; falta confirmar un día real. Es el último paso antes de que el historial de patrimonio sea confiable en prod. |
| Probar `PEND-002` (subcuentas) en navegador | M | Modelo implementado y testeado offline, pero nunca ejecutado en la app. Crítico para usuarios con cuentas multi-divisa. |
| Actualizar `docs/reporte-bugs.md` (BUG-029 ya corregido) | S | Desviación de documentación; el código ya está bien, solo falta reflejarlo. |
| Rotar clave de Gemini (ya estuvo expuesta en cliente) | S | `AGENTS.md:7` advierte que la clave actual debió rotarse antes de producir. Bloqueante de seguridad para cualquier despliegue. |

**En paralelo en H1:** rotar clave de Gemini + actualizar documentación (son independientes y triviales).

### H2 — Post-beta temprana (alto impacto, no bloquea)

| Tarea | Esfuerzo | Justificación del movimiento |
|-------|----------|------------------------------|
| Escalado global a 0.9 (`--ui-scale`) | L | `docs/plan-escala-ui.md` requiere QA visual en navegador antes de activarse. No bloquea beta (es preferencia visual), pero es una demanda conocida del usuario. |
| Drag&drop y eliminar de cards del dashboard | M | `propuesta-dashboard.md` ya tiene el diseño; solo falta implementar. Mejora la productividad del usuario beta. |
| Eliminar exports muertos (`DEUDA-006`, ~600 líneas) | S | Reduce JS sin usar y ruido de mantenimiento. Bajo riesgo, alto beneficio de higiene. |
| Minificar CSS/JS (añadir build) | M | Requiere introducir un paso de build (bundler/minificador), lo que rompe la regla de "sin dependencias ni pasos de build" de `AGENTS.md:3`. Evaluar si vale la pena. |
| Normalización global de clases CSS (`DEUDA-016`) | M | 4 convenciones de divisa causan filtros silenciosos vacíos. Afecta la integridad financiera (Fase 2). |
| Matriz de funciones y límites plana/flash | M | Requerido antes de invitar usuarios si se quiere diferenciar qué pueden hacer en beta. |

**En paralelo en H2:** escalado 0.9 y drag&drop de cards son independientes; eliminar exports muertos y normalización CSS también pueden ir en paralelo.

### H3 — Futuro (optimización y nuevas líneas)

| Tarea | Esfuerzo | Justificación del movimiento |
|-------|----------|------------------------------|
| Operaciones sin red y sync (colita de escrituras pendientes) | L | Requiere arquitectura de cola de sync en Firestore; no bloquea beta inicial. |
| Poda historial (B3), activoId (B4), etiquetas→IDs (B5), enums numéricos (B6) | M/L | Todas pospuestas explícitamente en la lista conocida. |
| Cuentas compartidas (Fase 7) | L | Solo diseño (`docs/propuesta-compartir-cuentas.md`); requiere cambios estructurales en reglas y aislamiento. |
| Captura por correo, notificaciones bancarias (Fase 8) | L | Infraestructura de correo entrante y bandeja; no es MVP de beta. |
| Comprobantes con IA (Fase 8 / Fase 9) | L | Depende de drov maduro y de flujo de subida/extracción. |
| Apps móviles nativas (Fase 12) | L | La app es PWA; las apps nativas son una línea aparte. |
| kit.escinco.com (Fase 11) | M | Línea independiente, sin relación con la app beta. |
| escinco business (Fase 14) | L | Por definir; nomenclatura vigente no incluye "business". |

---

## 5. Riesgos y huecos

### 5.1 Tareas que no están en la lista pero que el repo sugiere que faltan

- **Mecanismo de invitación de usuarios beta:** no existe en el código; es requisito previo a la Fase 4.
- **Banner de cookies y registro de consentimiento:** `privacidad.html`/`terminos.html` existen pero no hay mecanismo de consentimiento activo.
- **Sistema de logging estructurado en producción:** `firestore-debug.log` es ignorado por `.gitignore`; no hay envío de errores a Firebase Crashlytics ni similar.
- **Verificación de emuladores de reglas:** `tests/rules.test.mjs` SKIP porque no hay emuladores levantados en este entorno. Las reglas no se validan contra Firestore real en CI.
- **Migración de datos legacy:** hay documentos con `fechaRealizacion` como `Date` (`DEUDA-011`) y snapshots v0 sin `schemaVersion`; no hay plan de migración.

### 5.2 Deuda técnica visible

| Ítem | Dónde | Impacto |
|------|-------|---------|
| 18 exports sin llamador (~600 líneas muertas) | `DEUDA-006`, `deuda-tecnica.md:338-372` | Mantenimiento y confusión; `obtenerMovimientosConFiltros` hace creer que existe filtrado que no se usa. |
| 218 `console.*` en 35 archivos | `DEUDA-010`, `deuda-tecnica.md:575-604` | Ruido en consola; 3 `console.warn` silencian fallos reales (snapshot, historial, cards). |
| ~40 normalizaciones ad-hoc de moneda, 4 convenciones | `DEUDA-016`, `deuda-tecnica.md:441-471` | Filtros de divisa silenciosamente vacíos; misma cuenta puede mostrar `PEN` y `Pen`. |
| 7 copias de formateo de fecha | `DEUDA-014`, `deuda-tecnica.md:415-439` | Duplicación ~90 líneas; riesgo de fechas distintas entre vistas. |
| `fechaRealizacion` como `Date` en 2 rutas | `DEUDA-011`, `BUG-020` | Datos heterogéneos; `normalizarFechaFutura` no actúa sobre `Date`. |
| `generar_demo.mjs` sin trackear | `DEUDA-019` | Puede perderse en una limpieza de directorio. |
| `docs/requisitos.md` desfasado en 4 puntos | `DEUDA-025` | Induce a decisiones equivocadas para nuevos miembros. |
| Sin lint, typecheck ni CI | `DEUDA-021` | Causa raíz de la mayoría de la deuda anterior. |

### 5.3 Inconsistencias entre documentación y código

- `docs/requisitos.md` declara beta.5, inactividad 30 min, divisas PEN/USD/USDT, campo `nota` en trades; el código real es beta.30, 15 min, PEN/USD/USDT/EUR, sin `nota`.
- `docs/roadmap.md` dice v1.0.0-beta.5 (≈86 %); la app va en beta.30.
- `docs/deuda-tecnica.md` no incluye subcuentas, diff de preferencias ni modo Panel en su resumen de ítems.
- `docs/reporte-bugs.md` lista BUG-029 como Pendiente, pero el código ya lo tiene corregido.

---

## 6. Preguntas abiertas

1. **¿Se rotará la clave de Gemini antes de cualquier despliegue a producción?** `AGENTS.md:7` indica que la clave actual ya estuvo expuesta en el cliente y debe rotarse en Google AI Studio.
2. **¿Se introduce un paso de build (bundler/minificador) para la minificación de CSS/JS?** Esto contradice `AGENTS.md:3` (sin dependencias ni pasos de build).
3. **¿Se invitará a los 5-10 usuarios beta antes o después de verificar `PEND-001` y `PEND-002`?** Se recomienda después, para no exponer usuarios a datos de patrimonio incompletos o subcuentas no probadas.
4. **¿Se actualiza `docs/reporte-bugs.md` para marcar BUG-029 como corregido?** Es una desviación de documentación pendiente.
5. **¿Qué mecanismo de invitación se usará para la beta (Fase 4)?** No existe en el código; hay que definirlo (invitaciones por email, códigos, etc.).
6. **¿Se prioriza la normalización de moneda (`DEUDA-016`) antes de invitar usuarios?** Afecta la integridad financiera (Fase 2) y podría generar filtros de divisa vacíos para usuarios beta.
7. **¿Se considera el escalado al 0.9 (`--ui-scale`) como requisito para la beta o como mejora post-beta?** `docs/plan-escala-ui.md` lo deja como decisión del usuario, con QA visual pendiente.

---



