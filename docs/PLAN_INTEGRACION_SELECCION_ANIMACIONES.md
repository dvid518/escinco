# Plan: integración de viselect (selección visual) y anime.js (animaciones)

## Objetivo

Implementar dos sistemas independientes en escinco:

1. **Sistema de selección visual** — selección de elementos tipo "marquee" (arrastrar para seleccionar varios) mediante `@viselect/vanilla`, centralizada en `js/ui/seleccionVisual.js` y adoptada por las páginas `movimientos.js`, `trading.js`, `cuentas.js` e `inversiones.js`.

2. **Sistema global de animaciones** — infraestructura reutilizable basada en Anime.js, disponible para toda la aplicación, independiente del sistema de selección. Permite incorporar progresivamente transiciones entre vistas, modales, paneles, aparición/desaparición de componentes, tarjetas y listas dinámicas, estados de carga, microinteracciones, selección y deselección, y otros componentes.

---

## Sistemas

### Sistema de selección visual

**Módulo:** `js/ui/seleccionVisual.js`

Responsabilidades:
- Instanciar `new Viselect(contenedor, {...})` con `selectables: selectorItem`.
- Mantener el estado de selección (`seleccionados` Set, `ordenSeleccion` array).
- Sincronizar con eventos `select`/`deselect`/`stop` de viselect.
- Exponer API pública: `activarSeleccion`, `desactivarSeleccion`, `obtenerSeleccionados`, `obtenerOrdenSeleccion`, `estaSeleccionado`, `seleccionar`, `deseleccionar`, `toggle`, `seleccionarTodos`, `limpiar`, `expandirSeleccion`.
- Delegar las animaciones de entrada/salida de `.seleccionado` al sistema global de animaciones (`js/ui/animaciones.js`).
- Mantener `singleTap.allow: false` en Viselect para que solo gestione marqueo por arrastre; el clic sigue gestionándose en cada página.

Páginas integradas:
- `js/pages/movimientos.js`
- `js/pages/trading.js`
- `js/pages/cuentas.js`
- `js/pages/inversiones.js`

Comportamiento conservado: click, dblclick, clic sostenido, Shift+rango, Escape, Delete/Backspace, un-click por accesibilidad.

### Sistema global de animaciones

**Módulo:** `js/ui/animaciones.js`

Responsabilidades:
- Importación centralizada de Anime.js desde `js/lib/anime.esm.min.js`.
- Primitivas reutilizables: `animarEntrada`, `animarSalida`, `animarToggle`, `animarColeccion`.
- Gestión de ciclo de vida: registro automático, desregistro al finalizar, cancelación individual (`cancelarAnimacion`), por contexto (`cancelarPorContexto`) y global (`cancelarTodasLasAnimaciones`).
- Consulta: `estaAnimando(elemento)`.
- Accesibilidad: respeta `prefers-reduced-motion` (las animaciones se resuelven inmediatamente sin movimiento).
- Múltiples animaciones concurrentes con ciclo de vida independiente.
- Limpieza automática de referencias a elementos retirados del DOM.

API pública:
```js
export function animarEntrada(elemento, { duracion, contexto })
export function animarSalida(elemento, { duracion, contexto })
export function animarToggle(elemento, activo, { duracion, contexto })
export function animarColeccion(elementos, { duracion, estagger, delay, contexto })
export function cancelarAnimacion(elemento)
export function cancelarPorContexto(contexto)
export function cancelarTodasLasAnimaciones()
export function estaAnimando(elemento)
export function reducirMovimientoHabilitado()
```

Relación con selección visual: `seleccionVisual.js` **consume** `animaciones.js`, nunca al contrario.

---

## Alcance (archivos previstos)

### Crear

1. **`js/ui/animaciones.js`** — módulo global de animaciones basado en Anime.js.
2. **`tests/animaciones.test.mjs`** — tests del módulo de animaciones (entrada, salida, concurrencia, cancelación individual/por contexto/global, prefers-reduced-motion, limpieza).
3. **`tests/seleccionVisual.test.mjs`** — tests del módulo de selección visual.

### Modificar

4. **`js/ui/seleccionVisual.js`** — dejar de importar Anime.js directamente; consumir las primitivas de `js/ui/animaciones.js`.
5. **`sw.js`** — añadir al precache: `js/lib/anime.esm.min.js`, `js/lib/viselect.esm.js`, `js/ui/animaciones.js`, `js/ui/seleccionVisual.js`.

### No modificar (fuera de alcance)

- No se toca `firebase/`, modelos, servicios ni reglas de Firestore.
- No se cambia el esquema de datos.
- No se añade bundler ni proceso de compilación (AGENTS.md §5.1).
- No se introduce `!important` ni estilos inline (AGENTS.md §5.2).
- No se implementan aún animaciones específicas para modales, vistas o componentes.
- No se migran más páginas al sistema de selección.
- No se refactorizan componentes ajenos.

---

## Dependencias

| Librería | Versión | Uso | Justificación |
|----------|---------|-----|---------------|
| `@viselect/vanilla` | ^3.10.1 | Selección visual por arrastre (marquee) | Cero dependencias, vanilla JS, ESM. |
| `animejs` | ^4.5.0 | Animaciones globales de la aplicación | ESM-first, modular, self-hosted en `js/lib/`. |

Ambas se venden como ES Modules en `js/lib/` y se importan como ES Modules (sin bundler, AGENTS.md §5.1).

---

## Plan de implementación (fases completadas)

### Fase 1: Infraestructura y dependencias
- [x] Añadir `@viselect/vanilla` y `animejs` a `package.json`.
- [x] Vender archivos ESM en `js/lib/` (`anime.esm.min.js`, `viselect.esm.js`).
- [x] Crear `js/ui/seleccionVisual.js`.
- [x] Crear `js/ui/animaciones.js` (infraestructura global de animaciones).
- [x] Desacoplar `seleccionVisual.js` de Anime.js (usa `animaciones.js`).

### Fase 2: Migrar páginas al sistema de selección
- [x] `js/pages/movimientos.js`
- [x] `js/pages/trading.js`
- [x] `js/pages/cuentas.js`
- [x] `js/pages/inversiones.js`

### Fase 3: Service Worker y PWA
- [x] Añadir assets al precache de `sw.js`.

### Fase 4: Tests
- [x] `tests/animaciones.test.mjs` — 16/16.
- [x] `tests/seleccionVisual.test.mjs` — 10/10.

### Fase 5: Verificación
- [x] `npm test` — sin regresiones respecto al baseline (solo fallos preexistentes).
- [x] `npm run lint` — limpio en archivos modificados.

### Fase 6: Documentación
- [x] Actualizar `docs/PLAN_INTEGRACION_SELECCION_ANIMACIONES.md` (este documento).

---

## Riesgos y consideraciones

1. **Conflicto de eventos**: Viselect gestiona `pointerdown`/`pointermove`/`pointerup` para el marquee. Las páginas ya tienen gestos de clic sostenido y swipe. Se resolvió con `singleTap.allow: false` en Viselect, de modo que solo hace marqueo y el clic sigue en los handlers de cada página.
2. **Ciclo de vida de animaciones**: `animaciones.js` registra cada animación y se desregistra automáticamente al finalizar o al cancelar, evitando referencias a elementos retirados del DOM.
3. **Accesibilidad**: `prefers-reduced-motion` se respeta en todas las animaciones del módulo global.
4. **PWA / Service Worker**: los módulos de animación y selección deben estar en el precache para funcionar sin conexión. `BUILD_ID` se gestiona por `tools/generar-build.mjs`.
5. **No bundler**: todo se importa como ES Modules relativos desde `js/lib/` y `js/ui/`.

---

## Criterios de finalización

- Existe un módulo independiente de animaciones (`js/ui/animaciones.js`).
- Cualquier módulo de escinco puede consumirlo sin importar Anime.js directamente.
- Selección visual utiliza esa infraestructura sin depender directamente de Anime.js.
- Las animaciones pueden coexistir y cancelarse (individual, por contexto, global).
- Se respeta la reducción de movimiento (`prefers-reduced-motion`).
- Los módulos necesarios están disponibles mediante el Service Worker.
- Las pruebas específicas pasan.
- No existen regresiones respecto al baseline.
- La documentación refleja la arquitectura definitiva.

---

## Diferencias respecto al plan original

El plan original mezclaba selección y animaciones en un solo módulo (`seleccionVisual.js`). La arquitectura definitiva separa ambas responsabilidades:
- `seleccionVisual.js`: solo selección (estado, Viselect, eventos de teclado).
- `animaciones.js`: solo animaciones (primitivas, ciclo de vida, contextos, accesibilidad).
- `seleccionVisual.js` consume `animaciones.js`, nunca al contrario.
