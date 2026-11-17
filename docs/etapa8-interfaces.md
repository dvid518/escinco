# Etapa 8 — Contrato: Interfaces entre componentes

**Fase 0 — Preparación y Contratos Técnicos.**
Define cómo se comunican Editor, Preferencias, Grid y Drag & Drop. Solo describe el comportamiento; no modifica código de producción.

## 1. Editor ↔ Preferencias (lectura y escritura de los 3 campos)

Los tres campos del dashboard son `cardsVisibles`, `orden` y `dimensiones`, almacenados bajo `preferencias.dashboard` en Firestore.

**Lectura:**
- `cargarCardsVisiblesDashboard()` lee `preferencias.dashboard` (sesión o `obtenerPreferencias(uid)`) y asigna:
  - `cardsVisiblesDashboard = normalizarCardsVisibles(dashboard?.cardsVisibles)`
  - `cardsOrdenDashboard = normalizarCardsOrden(dashboard?.orden)`
  - `cardsDimensionesDashboard = clampDimensionesDashboard(dashboard?.dimensiones) || {}`
- `configurarCardsDashboardDesdeSesión()` hace lo mismo desde `sesion.getPreferencias()` (relectura al entrar, no solo al importar).

**Escritura:**
- `guardarPreferenciasDashboard({ cardsVisibles, orden, dimensiones })` escribe en Firestore con notación de punto (`dashboard.cardsVisibles`, `dashboard.orden`, `dashboard.dimensiones`) solo los campos definidos, y refleja el cambio en la sesión inmediatamente para evitar leer una copia vieja al volver al dashboard.
- Los 3 campos se guardan **juntos** en una sola operación al guardar el editor (`onConfirm` del selector de cards) y al reordenar (`guardarOrdenDashboard`).

## 2. Editor ↔ Grid (aplicación de dimensiones y orden)

El editor no renderiza el grid directamente; provee los datos y el grid los aplica.

**Datos que el editor expone al grid:**
- `cardsOrdenDashboard`: orden completo (Patrimonio primero, luego el resto).
- `cardsVisiblesDashboard`: qué cards se muestran.
- `cardsDimensionesDashboard`: `{ [id]: { columnas, filas } }` por card.

**Cómo el grid aplica dimensiones:**
- `dimensionesCard(id)` devuelve `{ ancho, alto }` priorizando `cardsDimensionesDashboard[id]` sobre el catálogo (`DASHBOARD_DIMENSIONES[id]`) y sobre `spanColumnas`/`spanFilas` de `DASHBOARD_CARDS`. Soporta formato legado `{ancho, alto}`.
- `clasesCard(id)` genera clases CSS (`card-span-2`, `card-span-row-2`, `card-span-2x2`, `card-con-scroll`) a partir de `dimensionesCard(id)`.
- `calcularDistribucion(cards, dimensiones, columnas, metadata, opciones)` reparte las cards en celdas explícitas del grid usando `dimensiones.[id]` (o `d.ancho`/`d.alto` legado) y respeta `ancho` limitado a `totalColumnas`.

## 3. Editor ↔ Drag & Drop (sincronización del arrastre con el estado)

El arrastre de cards reordena el dashboard en vivo y se sincroniza con el estado del editor.

- `inicializarSortableDashboard()` configura SortableJS en el grid del dashboard durante el modo edición.
- `configurarEventosReordenamientoDashboard()` gestiona `dragover`/`previsualizarDestinoDashboard` y el destino del arrastre.
- Al soltar, `cardsOrdenDashboard` se reconstruye desde el orden del DOM (`reordenarDashboard()`), Patrimonio queda fuera (fijo, primero) y se marca `cambiosPendientesDashboard = true`.
- `guardarOrdenDashboard()` persiste `cardsVisiblesDashboard`, `cardsOrdenDashboard` y `cardsDimensionesDashboard` juntos y pone `cambiosPendientesDashboard = false`.
- Mientras el modal del editor está abierto (`abrirSelectorCardsDashboard`), el reordenamiento dentro del modal no aplica: `ordenModal` es el orden completo y no se modifica al ocultar/mostrar tarjetas.

## 4. Preferencias ↔ Grid (lectura de `orden` y `dimensiones`)

El grid lee directamente del estado global cargado desde preferencias:

- `ordenRender = ["patrimonio", ...cardsOrdenDashboard.filter(id !== "patrimonio" && visibles.includes(id))]` define el orden de renderizado.
- `clasesCard(id)` / `dimensionesCard(id)` aplican las dimensiones leídas de `cardsDimensionesDashboard` (provenientes de `dashboard.dimensiones` en preferencias, normalizadas por `clampDimensionesDashboard`).
- `calcularDistribucion` recibe `cards` (orden de preferencia) y `dimensiones` (overrides por id) para calcular `col/row/ancho/alto` de cada celda.

## 5. Archivos relacionados

- `js/pages/dashboard.js`: estado global, `normalizarCardsVisibles`, `normalizarCardsOrden`, `clampDimensionesDashboard`, `dimensionesCard`, `clasesCard`, `calcularDistribucion`, `guardarPreferenciasDashboard`, `cargarCardsVisiblesDashboard`, `reordenarDashboard`, `inicializarSortableDashboard`, `configurarEventosReordenamientoDashboard`.
- `js/core/sesion.js`: `getPreferencias` / `setPreferencias` (caché de sesión).
- `firebase/firestore.js`: wrappers de acceso a Firestore (`actualizarPreferencias`, `obtenerPreferencias`).
