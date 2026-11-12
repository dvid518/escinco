# REPORTE AUDITORÍA DASHBOARD (continuación)

## 1. Estado actual — (resto)

### render() — detalle de innerHTML (evidencia)
`js/pages/dashboard.js:1733-1766`.
- Línea 1746: `const contenido = \`...` template literal que interpola `generarCardPatrimonio(...)` y `ordenRender.map(id => { const generador = GENERADORES_CARD[id]; ... return generador ? generador(config) : ""; }).join('')`.
- Línea 1764: `contenedor.innerHTML = contenido`.
- Línea 1765: `return contenedor.innerHTML`.

Todos los generadores de `GENERADORES_CARD` (`js/pages/dashboard.js:1596-1731`) devuelven strings de template literal con datos interpolados (`titulo`, `claseAdicional`, `skeletonText(...)`, `icono(...)`, etc.). Ninguno usa `document.importNode(template.content, true)`. Esto infringe AGENTS.md §1 (innerHTML con datos dinámicos). Los datos son del catálogo estático, por lo que el riesgo XSS es bajo, pero el patrón es inconsistente con `modal.js` y con las cards instanciadas (`montarCardsInstanciadas`, `pintarCardCuenta`, que sí usan `textContent`/`appendChild`).

### Grid/CSS — reglas encontradas (evidencia)
`css/dashboard.css:6-23`:
- `.dashboard { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); grid-auto-rows: var(--altura-celda); gap: var(--gap-card); ... }`
- `--unidad-card: 148px` (línea 7, sin uso claro en el grid), `--gap-card: 16px` (línea 8).
- `.dashboard > * { min-height: var(--altura-celda); ... }` (línea 25-32).

Problema: `--altura-celda` **no está definida** en ningún CSS ni JS del repo (grep sobre `css/` y `js/` solo encontró los dos usos en `css/dashboard.css:11,28`). Sin definición, `grid-auto-rows` se ignora y las filas no son uniformes.

Clases de span existentes (variable de altura/ancho): `.card-span-2` (línea 35-37), `.card-span-row-2` (línea 40-42), `.card-span-2x2` (línea 45-48).

Responsive `<=599px`: `grid-template-columns: 1fr`, spans reset a 1 (línea 59-69).

Veredicto: columnas uniformes (auto-fill/minmax), filas **no uniformes** por falta de `--altura-celda`. Ya existen clases para variantes de altura (1 y 2 filas); el modal permite alto hasta 3 filas (`js/pages/dashboard.js:1062-1063`).

### Menú de edición
- Existe `abrirSelectorCardsDashboard()` (`js/pages/dashboard.js:996`).
- Conectado en `configurarEdicionDashboard()` (`js/pages/dashboard.js:909-921`): `#dashboard-abrir-cards` → `activarModoEdicionDashboard()` + `abrirSelectorCardsDashboard()` (línea 916-918); `#dashboard-listo` → `guardarYSalirEdicionDashboard()` (línea 920).
- El botón se pinta desde `render()` (línea 1749).
- El editor es un modal (`abrirModal`, línea 1180) con template `tpl-dashboard-editor` (`dashboard.html:571-596`) y filas `tpl-dashboard-card` (`dashboard.html:598-617`).
- State: `modoEdicionDashboard` (línea 195), `cambiosPendientesDashboard` (línea 196).

Veredicto: existe y está conectado. No está roto.

### Persistencia
- Lectura: `cargarCardsVisiblesDashboard()` (`js/pages/dashboard.js:219-233`) via `obtenerPreferencias(uid)` / `sesion.getPreferencias()`; `configurarCardsDashboardDesdeSesión()` (`js/pages/dashboard.js:212-217`).
- Escritura: `guardarPreferenciasDashboard()` (`js/pages/dashboard.js:239-254`) via `actualizarPreferencias(uid, cambios)`, guarda `dashboard.cardsVisibles`, `dashboard.orden`, `dashboard.dimensiones`; refleja en sesión.
- `cardsVisiblesDashboard`, `cardsOrdenDashboard`, `cardsDimensionesDashboard` en `js/pages/dashboard.js:193-196`.
- `podarInstanciasInvalidas()` (`js/pages/dashboard.js:280-294`) limpia cards de cuenta/activo huérfanas y persiste.
- `guardarOrdenDashboard()` (`js/pages/dashboard.js:947-957`); `guardarYSalirEdicionDashboard()` (`js/pages/dashboard.js:959-967`).
- Sortable `onEnd` del grid (`js/pages/dashboard.js:858-892`) persiste `orden` en Firestore; `onConfirm` del modal (`js/pages/dashboard.js:1196-1211`) persiste `cardsVisibles`, `orden`, `dimensiones`.
- Normalizadores toleran campos ausentes: `normalizarCardsVisibles` (línea 199), `normalizarCardsOrden` (línea 205); `DEFAULT_CARDS_VISIBLES` / `DEFAULT_CARDS_ORDEN` (línea 118-124).

Veredicto: funciona y guarda las tres listas en Firestore + sesión.

### SortableJS
- Librería: `js/lib/sortable.min.js` (Sortable 1.15.0).
- Cargada en `dashboard.html:3055` y `demo.html:3120`; precachada en `sw.js:104`; `eslint.config.js:32-33` (`Sortable: "readonly"`).
- `AGENTS-AGENTES.md:11` advertía que no estaba aprobado (el usuario ya aprobó su uso para esta tarea).
- Dos instancias activas:
  1. `inicializarSortableDashboard()` (`js/pages/dashboard.js:836-895`) sobre `.dashboard`, `handle: "[data-dashboard-drag-handle]"`, `draggable: "[data-dashboard-card]"`, `onEnd` lee orden del DOM y persiste `cardsOrdenDashboard`.
  2. Dentro del modal (`js/pages/dashboard.js:1236-1257`) sobre `.modal-dashboard-lista`, reordena `ordenModal`.

Veredicto: ya cargado e integrado en dos sitios. SortableJS solo maneja el **orden** (drag & drop), no el redimensionado interactivo de bordes; el ancho/alto por carta se elige desde el modal mediante variantes predefinidas (`dimensionesModal`, `js/pages/dashboard.js:1024-1063`).

---

## 2. Carencias y riesgos

### Falta para edición completa (arrastrar, redimensionar, ocultar)
1. **Altura de celda no definida:** `--altura-celda` no existe en CSS (`css/dashboard.css:11,28`), por lo que no hay celdas de altura uniforme real.
2. **Sin redimensionado interactivo:** no existe un handle para arrastrar bordes de una card y cambiar su ancho/alto sobre la marcha; solo variantes predefinidas (1×1, 2×1, 1×2, 1×3 filas) elegidas en el modal (`js/pages/dashboard.js:1013-1063`).
3. **Ocultar rápido desde la grid:** solo se puede desactivar una card abriendo el modal del editor; no hay un botón "ocultar" directo sobre la card en el grid (salvo eliminar en modo edición, `js/pages/dashboard.js:712-728`).
4. **`render()` con innerHTML:** `js/pages/dashboard.js:1764` interpola strings en vez de clonar templates (`document.importNode(template.content, true)`), rompiendo la regla de AGENTS.md §1 y el test `tests/plantillas.test.mjs` (§2: "los valores se escriben con textContent", líneas 265-270).
5. **SortableJS solo reordena, no persiste dimensiones en el grid:** el `onEnd` del grid (`js/pages/dashboard.js:866-892`) solo persiste `orden`, no `dimensiones`.

### Riesgos de SortableJS + innerHTML actual
1. **Destrucción de listeners/nodos:** `render()` recrea todo el HTML del dashboard (`js/pages/dashboard.js:1764-1765`). Si `render()` se ejecuta mientras SortableJS está inicializado sobre `.dashboard`, la instancia `sortableDashboard` apunta a nodos ya eliminados (`js/pages/dashboard.js:838-842` reutiliza `sortableDashboard` si existe, sin re-vincular nodos nuevos).
2. **`prepararEdicionCardsDashboard()` añade controles al DOM (`js/pages/dashboard.js:730-793`), pero `render()` los borra al volver a pintar, desincronizando el estado de edición con el DOM.**
3. **`inicializarSortableDashboard()` (`js/pages/dashboard.js:836`) guarda `sortableDashboard` en una variable de módulo y la reusa (`if (sortableDashboard) return` en 838). Si el grid se reconstruye con `innerHTML`, la instancia sigue ligada al antiguo contenedor/nodos.**
4. **El `onEnd` de Sortable lee `grid.querySelectorAll("[data-dashboard-card]")` (`js/pages/dashboard.js:867`); si `render()` limpió y repintó, esos nodos son nuevos y la correspondencia con `cardsOrdenDashboard` puede romperse.**

### Riesgo tests de plantillas (`tests/plantillas.test.mjs`)
**Sí.** El test exige que todo `contenidoDesdeTemplate` apunte a templates existentes en `dashboard.html` y `demo.html` (líneas 241-242), que todos los huecos `data-tpl` se declaren sin `@` (líneas 248-254), que ningún template quede sin uso (líneas 257-259), y que `rellenarHuecos` use `textContent` para valores y `innerHTML` solo para iconos (líneas 265-273). Mover el HTML de las cards de `render()` (strings) a templates en `dashboard.html` implica:
- Declarar nuevos `<template id="tpl-...">` en `dashboard.html` **y** replicarlos idénticos en `demo.html` (sincronía, línea 216).
- Añadir llamadas a `contenidoDesdeTemplate` en `js/` para esos templates, o el test los marca como huérfanos.
- Si el rediseño introduce huecos con `@` en `data-tpl`, el test falla (línea 250-254).

### Riesgo persistencia
**No.** El esquema actual (`dashboard.cardsVisibles`, `dashboard.orden`, `dashboard.dimensiones` en Firestore, `js/pages/dashboard.js:239-254`) ya soporta variantes de altura/ ancho (`dimensiones` con `columnas`/`filas`, `js/pages/dashboard.js:131-143`) y cards instanciadas (`cuenta:/activo:`, `js/pages/dashboard.js:154-156`). Los normalizadores (`normalizarCardsVisibles`, `normalizarCardsOrden`, `js/pages/dashboard.js:199-210`) toleran campos ausentes y aplican defaults. Un rediseño del grid **no requiere migración de datos**, solo garantizar que `dimensiones` siga siendo `{ id: { columnas, filas } }` y que `clasesCard` (`js/pages/dashboard.js:131-143`) siga produciendo las clases CSS correctas.

---

## 3. Plan propuesto (3-5 pasos)

### Paso 1: Definir `--altura-celda` y clases de variantes uniformes
- **Archivos:** `css/dashboard.css`.
- **Riesgo:** cambiar `grid-auto-rows` afecta a todas las cards existentes; probar en móviles (`<=599px`, `css/dashboard.css:59-69`).
- **Tests:** prueba visual/assert de que `--altura-celda` tiene valor y `.dashboard > *` aplica `min-height`.

### Paso 2: Migrar `render()` de innerHTML a templates (sin cambiar comportamiento)
- **Archivos:** `js/pages/dashboard.js` (`render()`, `js/pages/dashboard.js:1733-1766`), `dashboard.html` y `demo.html` (nuevos `<template>` para cada card: `tpl-card-métrica`, `tpl-card-lista`, `tpl-card-patrimonio`, `tpl-card-grafico`, etc.).
- **Riesgo:** romper `tests/plantillas.test.mjs` si los templates no se replican en `demo.html` o si quedan sin uso.
- **Tests:** `npm test` (plantillas.test.mjs) + test que verifique que `render()` devuelve nodos con `data-dashboard-card` y clases de span correctas.

### Paso 3: Añadir redimensionado por variantes desde el modal (altura 1/2/3 filas, ancho 1/2 columnas)
- **Archivos:** `js/pages/dashboard.js` (`abrirSelectorCardsDashboard`, `renderizarCardsActivas`, líneas 1021-1080; `guardarPreferenciasDashboard` ya soporta `dimensiones`), `css/dashboard.css` (clases `.card-span-row-3` si faltan).
- **Riesgo:** `dimensionesModal` solo vive en el modal; al cerrar sin guardar se descarta (correcto). Al guardar, `clasesCard` (`js/pages/dashboard.js:131-143`) debe reflejar `cardsDimensionesDashboard`.
- **Tests:** test unitaria de `clasesCard(id)` con dimensiones personalizadas; test de que el modal guarda `dimensiones` en Firestore.

### Paso 4: Integrar SortableJS sobre el grid de celdas uniformes (solo orden)
- **Archivos:** `js/pages/dashboard.js` (`inicializarSortableDashboard`, `js/pages/dashboard.js:836-895`), llamar tras render y destruir en `salirModoEdicionDashboard` (`desactivarEdicionCardsDashboard`, `js/pages/dashboard.js:795-805`).
- **Riesgo:** `render()` recrea el grid y deja a Sortable con nodos huérfanos; destruir/reinicializar tras cada render.
- **Tests:** test de que `onEnd` actualiza `cardsOrdenDashboard` y persiste en Firestore; test de que Sortable se destruye al salir del modo edición.

### Paso 5: Botón "ocultar" directo en la card (modo edición) + limpieza de innerHTML residual
- **Archivos:** `js/pages/dashboard.js` (`prepararEdicionCardsDashboard`, `js/pages/dashboard.js:730-793`; `quitarCardDashboard`, `js/pages/dashboard.js:712-728`), `css/dashboard.css`.
- **Riesgo:** `quitarCardDashboard` ya elimina del DOM y de `cardsVisiblesDashboard`/`cardsOrdenDashboard`; reusarlo como "ocultar" es coherente.
- **Tests:** test de que ocultar una card la quita de `cardsVisiblesDashboard` y persiste; test de que `patrimonio` no se puede ocultar (`js/pages/dashboard.js:712-713`).

---

## Recomendaciones de Ponytail (anti sobre-ingeniería)
1. **No implementar redimensionado libre por arrastre de bordes.** Ya existen variantes predefinidas de ancho/alto en el modal (`js/pages/dashboard.js:1013-1063`). Un handle de resize nativo es mucho más código y no fue pedido.
2. **No crear un sistema de "widgets" genérico.** Las cards ya están tipificadas por `DASHBOARD_CARDS` (`js/pages/dashboard.js:93-115`) y las instancias `cuenta:/activo:` (`js/pages/dashboard.js:154-156`).
3. **No añadir dependencias.** SortableJS ya está cargado (`js/lib/sortable.min.js`, `dashboard.html:3055`, `sw.js:104`).
4. **No migrar todas las páginas a templates de una vez.** Solo `render()` del dashboard (`js/pages/dashboard.js:1733-1766`).
5. **No tocar `AGENTS-AGENTES.md` ni `AGENTS.md`.** El usuario ya aprobó SortableJS; el archivo de restricciones no necesita cambios.

---

## Confirmaciones
- NO modifiqué archivos: sí
- NO hice commit ni push: sí
