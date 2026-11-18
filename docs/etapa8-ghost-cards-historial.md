# Etapa 8 · Fase 3 — Historial de la implementación de Ghost Cards

Investigación previa a tocar código, siguiendo la protección del PO: no se
reconstruye lo que ya existe sin localizar su origen.

## Resumen

| Dato | Valor |
|------|-------|
| Commit real de Ghost Cards | `18b9663` — «mi loco arreglamos los cards» (2026-11-15) |
| Relación con `2e4176d` | **Posterior.** `2e4176d` es solo un commit de logs de Playwright |
| Estado en `HEAD` | La implementación sigue viva (no se perdió después) |

## Comandos usados

```bash
git log --oneline --all
git log --oneline --all --grep="ghost" -i
git log --oneline --all --grep="drag" -i
git log --oneline --all --grep="drop" -i
git log --oneline --all --grep="sortable" -i
git log --oneline --all --grep="placeholder" -i
git log --oneline --all -S"dashboard-card-ghost" -- js/pages/dashboard.js css/dashboard.css
git log --oneline --all -S"ghostClass" -- js/pages/dashboard.js
git log --oneline --all -S"sortable-placeholder" -- js/pages/dashboard.js css/dashboard.css
git show <commit> -- js/pages/dashboard.js css/dashboard.css
```

## Cronología relevante

| Commit | Fecha | Aporte al arrastre |
|--------|-------|--------------------|
| `18960a5` | 2026-10-31 | Re-habilita drag con `dashboard-card-arrastrando` y handle nativo (`draggable`). Sin ghost. |
| `db0d252` | 2026-10-31 | Auto-scroll durante el arrastre. |
| `bca3317` | 2026-11-02 | Grid de celdas uniformes + SortableJS. Sin `ghostClass`. |
| `803e511` | 2026-11-11 | Placeholder **manual** (`.sortable-placeholder`) creado en `onStart` y movido en `onMove`. |
| `6a6f283` | 2026-11-12 | Editor visual H2; el arrastre no cambia. |
| `cc78c4a` | 2026-11-13 | Ajustes del editor; el arrastre no cambia. |
| `2e4176d` | 2026-11-13 | **Solo** `.playwright-mcp/*.log` y `.yml`. Confirmado: no hay código. |
| `18b9663` | 2026-11-15 | **Implementación real de Ghost Cards.** |
| `8583a1c` | 2026-11-16 | Solo editor/preferencias; el arrastre no cambia. |
| `d55184a` | 2026-11-17 | Limpieza (`HEAD`); el arrastre no cambia. |

Evidencia de que `2e4176d` no implementa nada:

```
$ git show --stat --oneline 2e4176d
2e4176d el drag and drop está de ptmre
 .playwright-mcp/console-2026-11-13T12-54-53-400Z.log | 12 ++
 .playwright-mcp/console-2026-11-13T13-00-40-952Z.log | 24 ++++
 .playwright-mcp/console-2026-11-13T13-01-59-434Z.log | 33 +++++
 .playwright-mcp/page-2026-11-13T12-54-55-256Z.yml    |  0
 .playwright-mcp/page-2026-11-13T12-55-47-958Z.yml    | 21 ++++
 .playwright-mcp/page-2026-11-13T13-00-41-888Z.yml    |  0
 .playwright-mcp/page-2026-11-13T13-02-00-236Z.yml    |  0
 .playwright-mcp/page-2026-11-13T13-02-44-324Z.yml    | 122 +++++++++++++
```

## Qué introdujo `18b9663`

Archivos: `css/dashboard.css`, `js/pages/dashboard.js` (además de AGENTS,
tests y un backup, que no forman parte de esta fase).

### JavaScript

- Elimina el placeholder manual (`placeholderDashboard`,
  `crearPlaceholderDashboard`, `onMove`) y el estilo
  `dashboard-card-arrastrando`.
- Añade `ghostClass: "dashboard-card-ghost"` a la instancia de SortableJS.
- `onStart`: guarda la celda de origen (`celdaOrigenDashboard`) **antes** de
  vaciar las celdas explícitas del item, para que SortableJS pueda moverlo
  durante el arrastre.
- `celdaCardDashboard(id, card)`: celda 0-indexada actual (DOM primero,
  `posicionesPreferidasDashboard` como respaldo).
- `celdaEnPuntoDashboard(x, y)`: mide el grid real
  (`gridTemplateColumns`, `gridAutoRows`, `rowGap`) para saber la celda bajo el
  puntero, incluidas columnas `auto-fill`.
- `previsualizarDestinoDashboard(evento)`: enganchado a `dragover` del grid;
  pinta la card arrastrada (la que tiene `.dashboard-card-ghost`) en la celda
  bajo el puntero, clampeando el ancho a `columnasActuales`.
- `onEnd`: si el `originalEvent` no es un `drop` (Escape) o la celda destino es
  la de origen, restaura con `reordenarDashboard()` sin guardar. Si hay destino,
  fija `posicionesPreferidasDashboard[idArrastrada]`, recalcula con
  `aplicarPosicionesDashboard(idArrastrada)` y persiste el orden.
- `draggable`: excluye solo `patrimonio`; el **Gráfico sí se arrastra**
  (antes estaba excluido).
- `animation: reduceMotion ? 0 : 150` con
  `prefers-reduced-motion: reduce`.

### CSS

- `.dashboard-card-ghost`: `opacity: 0.4`, `border: 2px dashed`, fondo
  transparente, `box-shadow: none` y `pointer-events: none` (deja pasar el
  puntero para que `dragover` siga avanzando de celda).
- `body.dashboard-card-dragging` fuerza `cursor: grabbing` y
  `user-select: none`.
- El bloque `@media (prefers-reduced-motion: reduce)` anula transiciones y
  animaciones.

## Estado encontrado en `HEAD` y huecos detectados

Todo lo anterior sigue presente. Sin embargo, en `HEAD` el arrastre solo
arrancaba desde la empuñadura:

```js
handle: '.btn-mover-card'
```

Además, el arrastre nativo de HTML5 impedía controlar el cursor y el reacomodo
solo se veía al soltar. Las tres correcciones (arrastre desde el cuerpo, arrastre
propio con `grab`/`grabbing` y reacomodo en vivo con FLIP) están documentadas en
`docs/etapa8-ghost-cards-diseno.md`.

## Por qué no se reconstruyó nada más

Las piezas del ghost (clase visual, hueco de destino, reacomodo al soltar y
cancelación) existen y están cubiertas por los tests A1/A2 de
`tests/dashboard.test.mjs`. Reescribirlas habría sustituido código verificado
por una versión nueva sin necesidad, justo lo que el PO pidió evitar.
