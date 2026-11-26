# Plan: integración de viselect (selección visual) y anime.js (animaciones)

## Objetivo

Unificar la selección de elementos (movimientos, trades, posiciones, estrategias) en un solo módulo reutilizable que incluya:

1. **Selección visual tipo "marquee"** (arrastrar para seleccionar varios elementos como en el escritorio) mediante `@viselect/vanilla`.
2. **Animaciones de entrada/salida** de la clase `.seleccionado` mediante `anime.js`.
3. **Mantenimiento del comportamiento actual** (click, dblclick, clic sostenido, Shift+rango, Escape, Delete/Backspace, un-click por accesibilidad).

---

## Motivo (causa raíz)

La selección está **duplicada en 4 páginas** con lógica similar pero no compartida:

| Página | Estado | Handlers propios |
|--------|--------|------------------|
| `js/pages/movimientos.js` | `seleccionados` (Set) + `ordenSeleccion` | click/dblclick/teclado/gestos |
| `js/pages/trading.js` | `seleccionadas` (Set) + `ordenSeleccion` | click/dblclick/teclado/gestos |
| `js/pages/cuentas.js` | `seleccionadosCuenta` (Set) | click/dblclick/teclado/gestos |
| `js/pages/inversiones.js` | `seleccionadas` (Set) + `ordenSeleccion` | click/dblclick/teclado |

Cada página reimplementa `toggleSeleccion`, `limpiarSeleccion`, `aplicarSeleccionDOM`, listeners de `Escape`/`Delete`/`Backspace`, supresión de doble clic, etc. El módulo `js/ui/seleccion.js` solo expone helpers sueltos (`alternarSeleccion`, `expandirSeleccion`, etc.), pero cada página sigue manejando el DOM y los eventos por su cuenta. Además, no existe selección por arrastre (marquee).

---

## Alcance (archivos previstos)

### Crear

1. **`docs/PLAN_INTEGRACION_SELECCION_ANIMACIONES.md`** — este documento.
2. **`js/ui/seleccionVisual.js`** — módulo unificado que envuelve viselect + anime.js y expone:
   - `activarSeleccion(contenedor, selectorItems, onCambio)` — inicia la selección visual y los eventos de click/teclado.
   - `desactivarSeleccion()` — detiene y limpia.
   - `obtenerSeleccionados()` — devuelve los ids seleccionados.
   - `seleccionar(id)`, `deseleccionar(id)`, `toggle(id)`, `seleccionarTodos(ids)`, `limpiar()`.
   - Animación automática de entrada/salida de `.seleccionado` con anime.js.
3. **`tests/seleccionVisual.test.mjs`** — tests del nuevo módulo.

### Modificar

4. **`package.json`** — añadir dependencias `@viselect/vanilla` y `animejs`.
5. **`js/pages/movimientos.js`** — reemplazar lógica duplicada de selección por `seleccionVisual.js`.
6. **`js/pages/trading.js`** — idem.
7. **`js/pages/cuentas.js`** — idem.
8. **`js/pages/inversiones.js`** — idem.
9. **`js/ui/seleccion.js`** — mantener por compatibilidad (los helpers `expandirSeleccion`, `crearSeleccion`, etc. siguen siendo útiles), pero ya no duplicar lógica en páginas.

### No modificar (fuera de alcance)

- No se toca `firebase/`, modelos, servicios ni reglas de Firestore.
- No se cambia el esquema de datos.
- No se añade bundler ni proceso de compilación (AGENTS.md §5.1).
- No se introduce `!important` ni estilos inline (AGENTS.md §5.2).

---

## Dependencias

| Librería | Versión | Uso | Justificación |
|----------|---------|-----|---------------|
| `@viselect/vanilla` | ~3.10.1 | Selección visual por arrastre (marquee) | Cero dependencias, vanilla JS, ESM. Solicitado por el usuario. |
| `animejs` | ^4.x | Animaciones de entrada/salida de `.seleccionado` | ESM-first, modular, ligero (~24.5 KB completo, menos si se importa solo `animate`). Sin bundler necesario vía importmap o CDN. |

Ambas se importarán como ES Modules. Dado que el proyecto no usa bundler (AGENTS.md §5.1), se importarán desde CDN (`esm.sh` / `unpkg`) o se venderán los archivos ESM en `js/lib/`. Decisión pendiente: confirmar con el usuario.

---

## Diseño del módulo `js/ui/seleccionVisual.js`

```js
// API proposta (sujeta a ajuste en implementación)
export function activarSeleccion({ contenedor, selectorItem, onCambio })
export function desactivarSeleccion()
export function obtenerSeleccionados()          // Set de ids
export function seleccionar(id)
export function deseleccionar(id)
export function toggle(id)
export function seleccionarTodos(ids)
export function limpiar()
```

Responsabilidades del módulo:
- Instanciar `new Viselect(contenedor, {...})` con `selectables: selectorItem`.
- Exponer eventos `select`/`deselect` de viselect para mantener `ids` y `orden` sincronizados.
- Animar con `anime()` la entrada (opacidad 0→1, scale 0.95→1) y salida (1→0, 1→0.95) de la clase `.seleccionado`.
- Mantener listeners globales de `Escape`/`Delete`/`Backspace` y click fuera, delegados desde el contenedor.
- Mantener compatibilidad con `modoUnClickSeleccion()` (preferencia de accesibilidad).

---

## Plan de implementación (fases)

### Fase 1: Infraestructura y dependencias
- Añadir `@viselect/vanilla` y `animejs` a `package.json`.
- Instalar con `npm install`.
- Crear `js/ui/seleccionVisual.js`.
- Verificar import ESM funciona sin bundler (probar carga en navegador).

### Fase 2: Migrar páginas una a una
Para cada página (`movimientos.js`, `trading.js`, `cuentas.js`, `inversiones.js`):
- Reemplazar `seleccionadas`/`seleccionados` (Set local) por `seleccionVisual`.
- Reemplazar `toggleSeleccion`, `limpiarSeleccion`, `aplicarSeleccionDOM` por las API del módulo.
- Mantener los gestos de clic sostenido y swipe que son específicos de cada página (o unificarlos si tiene sentido).
- Mantener `expandirSeleccion` para Shift+rango (o integrarlo en `seleccionVisual`).

### Fase 3: Tests
- Crear `tests/seleccionVisual.test.mjs` usando `nuevoReporter` y `extraerFuncion` de `tests/helpers.mjs`.
- Probar: toggle, seleccionarTodos, limpiar, obtenerSeleccionados, animación no lanza errores.

### Fase 4: Verificación
- `npm test` (suite completa).
- `npm run lint` (eslint).
- Verificación visual en navegador (apariencia, selección por arrastre, animaciones).

---

## Riesgos y consideraciones

1. **Dependencias nuevas sin bundler**: `@viselect/vanilla` y `animejs` son paquetes npm. Sin bundler hay que importar desde CDN o vender los archivos ESM en `js/lib/`. Debe confirmarse el enfoque.
2. **Conflicto de eventos**: viselect gestiona `pointerdown`/`pointermove`/`pointerup` para el marquee. Las páginas ya tienen gestos de clic sostenido y swipe. Debe coordinarse para que el clic corto no entre en conflicto con el arrastre de selección.
3. **Compatibilidad hacia atrás**: `js/ui/seleccion.js` se mantiene para no romper imports existentes, pero las páginas dejarán de usarlo directamente para la lógica de selección (solo `expandirSeleccion` si se conserva).
4. **Rendimiento**: viselect promete alto rendimiento, pero con listas largas de movimientos podría requerir `throttle` en los eventos del DOM.

---

## Criterios de finalización

- `npm test` pasa (TODO OK).
- `npm run lint` limpio en archivos modificados.
- Selección por arrastre (marquee) funciona en al menos una página piloto.
- Animación de entrada/salida de `.seleccionado` visible en navegador.
- Las 4 páginas siguen funcionando: click, dblclick, Shift+rango, Escape, Delete/Backspace, un-click.
- Documentación del plan en `docs/`.
