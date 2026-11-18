# Etapa 8 · Fase 3 — Diseño del Drag & Drop con Ghost Cards

Basado en la implementación histórica `18b9663` (ver
`docs/etapa8-ghost-cards-historial.md`). El diseño **conserva** el fantasma y la
cancelación, y sustituye el arrastre nativo de HTML5 por el arrastre propio de
SortableJS (`forceFallback`) para controlar el cursor y la card en mano. El
reacomodo pasa de aplicarse al soltar a previsualizarse en vivo.

## 1. Componentes

### 1.1 Elemento arrastrado (card original)

- Cualquier card visible del dashboard salvo `patrimonio`.
- Al empezar el arrastre recibe `.dashboard-card-ghost` y se queda en el grid
  como hueco: `opacity: 0`, sin borde y sin fondo.
- Conserva sus celdas explícitas (`grid-row/column-start/end`). No se vacían
  porque SortableJS no reordena nodos: el reparto lo decide la app.

### 1.2 Card en mano (el «ghost» visual)

- `forceFallback: true`: SortableJS clona la card en un nodo propio
  (`.dashboard-card-fallback`) que sigue al puntero, con sombra y sin capturar
  el puntero.
- `fallbackOnBody: false`: el clon se cuelga del propio `.dashboard`, no del
  `body`. Así hereda las reglas de `.dashboard .card` (fondo opaco, `padding`,
  `flex` y tipografía de `card-title` / `card-value` / `card-sub`) y se ve igual
  que la card real. Es `position: fixed`, así que no ocupa celda en el grid.
- `onStart` limpia lo que la copia arrastra: `id` y `data-dashboard-card`
  (contaría como una card más en el reparto) y la `opacity: 0.8` inline que pone
  SortableJS.
- `.dashboard .card` anima `transform` (0,3 s) y SortableJS mueve el clon con
  `transform` inline: hay que anular la transición en el clon
  (`.dashboard.dashboard-edicion-activo > .dashboard-card-fallback`) o persigue
  al puntero con retardo y parece que apenas se desplaza.
- La clase de edición se pone en el propio `.dashboard`, no en un ancestro: los
  selectores que la usan deben ser `.dashboard.dashboard-edicion-activo …`.
- El arrastre propio permite el cursor que pide el producto: `grab` en reposo
  (modo edición) y `grabbing` durante todo el arrastre, vía
  `body.dashboard-card-dragging`.
- No se usan `dragClass` ni `chosenClass`: el clon ya lo controla el fallback.

### 1.3 Hueco de destino

- Es la propia card arrastrada, invisible, reposicionada por el reparto.
- Tamaño = `dimensionesCard(id)`; columna clampeada a
  `[0, columnasActuales - ancho]`.
- Sin borde punteado: el destino se comunica con el hueco que dejan las demás
  cards al apartarse.

### 1.4 Destinos válidos

- Cualquier celda del grid con `row >= 0` y `0 <= col < columnasActuales`;
  `celdaEnPuntoDashboard()` devuelve `null` fuera del grid.
- Las celdas de `patrimonio` no son destino: es fija en la esquina y el reparto
  la reserva siempre primero.
- Fuera del grid, Escape o soltar en la celda de origen **no** son movimientos
  válidos: se restaura el reparto y no se persiste nada.

## 2. Integración con el reparto

`calcularDistribucion(cards, dimensiones, columnas, metadata, opciones)` acepta:

- `opciones.posiciones`: celdas elegidas (`posicionesPreferidasDashboard`).
- `opciones.prioridad`: id de la card en movimiento. Se intenta primero, de modo
  que si dos preferencias chocan gana la que el usuario mueve.
- Las preferencias que no caben caen al empaquetado denso: nunca se pierde una
  card.

`aplicarPosicionesDashboard(prioridadId, posiciones)` es la única salida al DOM:

1. Recalcula `columnasActuales` con el ancho real del grid.
2. Reparte con `calcularDistribucion()` + preferencias.
3. Escribe `grid-column/row-start/end` (+1 por el indexado 1-based de CSS).
4. Limpia preferencias de cards que ya no están en el grid. Solo cuando se
   reparte sobre el objeto real: la previsualización usa una copia.

`repartirDashboard()` envuelve lo anterior con FLIP (`animarRepartoDashboard`):
mide las cards antes de repartir, aplica las celdas y anima la diferencia con
`element.animate()` (`translate` de la posición vieja a la nueva, 180 ms). La
card arrastrada se salta la animación: su hueco debe seguir al puntero sin
transición. Con `prefers-reduced-motion: reduce` no se anima nada.

## 3. Flujo

### Arrastre

1. `pointerdown` sobre la card (cualquier zona salvo controles filtrados).
2. SortableJS aplica `fallbackTolerance` (3 px), clona la card y dispara
   `onStart`:
   - cancela si `patrimonio` o si no hay modo edición;
   - guarda `celdaOrigenDashboard` y la preferencia previa de la card;
   - `arrastrando = true`, `body.dashboard-card-dragging`;
   - registra `keydown` en captura para Escape.

### Previsualización en vivo

- `pointermove` del grid → `previsualizarDestinoDashboard()`:
  - mide la celda bajo el puntero;
  - si la celda cambió, reparte con la card ahí (`repartirDashboard(id,
    posiciones, id)`): las demás cards se apartan con FLIP;
  - vuelve a la celda de origen → se restaura la preferencia previa y el
    reparto queda igual que al empezar;
  - sobre `patrimonio` no se actualiza el destino.

### Soltar

1. `onEnd` con destino distinto del origen y sin cancelación.
2. `posicionesPreferidasDashboard[idArrastrada] = celdaDestinoDashboard`.
3. `repartirDashboard(idArrastrada)` fija el reparto (ya visible desde la
   previsualización).
4. `cardsOrdenDashboard` se reconstruye leyendo el reparto por filas y columnas;
   las cards ocultas conservan su orden al final.
5. `guardarPreferenciasDashboard({ orden })`; `cambiosPendientesDashboard` pasa
   a `false` solo si la escritura tiene éxito. El esquema de preferencias no
   cambia: la celda se recupera del orden al recargar.

### Cancelación

- Escape: `cancelarArrastreDashboard()` marca el arrastre como cancelado y envía
  a SortableJS el `mouseup` que espera para abortar (la librería no cancela el
  fallback por sí sola). `onEnd` ve la marca y llama a `reordenarDashboard()`.
- Soltar en la celda de origen se detecta con `mismaCelda`.
- En ambos casos no se tocan orden ni preferencias y el `finally` limpia celdas,
  marcas, `arrastrando` y `body.dashboard-card-dragging`.

## 4. Zonas de arrastre y controles

- Inicio desde cualquier zona no interactiva del cuerpo de la card y desde la
  empuñadura (`.btn-mover-card`).
- `filter` excluye `button:not(.btn-mover-card), a, input, textarea, select,
  label, [contenteditable='true']`, con `preventOnFilter: false` para no alterar
  el comportamiento normal de esos controles.
- `patrimonio`: fuera de `draggable`, cancelada en `onStart` y cursor `default`.
- El Gráfico: incluido en `draggable` y sin cancelación en `onStart`.

## 5. Accesibilidad y movimiento

- Las flechas «subir/bajar» siguen siendo la alternativa sin puntero:
  `moverCardDashboard()` escribe la misma preferencia de celda y reordena.
- `prefers-reduced-motion: reduce`: `animation: 0` en SortableJS, FLIP omitido y
  el bloque CSS que anula transiciones y animaciones.
- `body.dashboard-card-dragging` bloquea la selección de texto durante el
  arrastre.

## 6. Límites conocidos (documentados, no bloqueantes)

- El reparto en vivo reempaqueta todas las cards en cada celda nueva, así que
  varias pueden cambiar de sitio a la vez. Es el mismo resultado que se guarda al
  soltar (previsualización = resultado final).
- El orden solo se persiste; las celdas se reconstruyen con el empaquetado denso
  al recargar. Es el contrato de preferencias existente y no se ha modificado.
- Verificación visual en navegador pendiente en esta sesión.
