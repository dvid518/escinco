# Etapa 8 — Inventario de clases reutilizables (tarjetas del dashboard)

**Fase 2, Parte A — Inventario (solo documentación).**
Clases CSS existentes aplicables a las tarjetas del dashboard, extraídas de `css/componentes.css`, `css/style.css` (vía DISENO.md) y `css/dashboard.css`. No se modifica código de producción.

**Regla de Fase 0/2:** este documento inventaria lo existente. No se crean clases nuevas ni se inventan variantes visuales (protegido por el PO).

---

## 1. Títulos de card

| Clase | Archivo | Descripción |
|-------|---------|-------------|
| `.card-title` | `css/dashboard.css` | Título de las cards del dashboard (línea ~373). Tamaño 13px, color `--textSecondary`, mayúsculas, peso 500. |
| `.card-header` | `css/dashboard.css` | Cabecera de card (línea ~410). Flex row con espacio entre título y acciones/divisa. |

## 2. Valores numéricos

| Clase | Archivo | Descripción |
|-------|---------|-------------|
| `.card-value` | `css/dashboard.css` | Valor principal de las cards del dashboard (línea ~383). Fuente `--font-secondary`, 32px, peso 700, color `--text`. Variantes `.positive`, `.negative`. |
| `.card-item-valor` | `css/componentes.css` | Valor de los items de lista (línea ~386). Fuente `--font-secondary`, peso 600, `white-space: nowrap`. Variantes `.positive`, `.negative`, `.ambar`. |
| `.resumen-valor` | `css/componentes.css` | Valor de las cards de resumen de cifras (línea ~674). Fuente `--font-secondary`, 24px, peso 600. Variantes `.positive`, `.negative`. |
| `.text-mono` | `css/style.css` (DISENO.md) | Fuente monospaced (`--font-secondary`) para cifras. |
| `.text-medium` / `.text-semibold` | `css/style.css` (DISENO.md) | Peso 500 / 600. |

## 3. Badges

| Clase | Archivo | Descripción |
|-------|---------|-------------|
| `.badge` | `css/style.css` (línea ~541, DISENO.md) | Base para etiquetas tipo pastilla (tipo, estado). Color varía con modificadores. |
| `.badge--positive` | `css/style.css` (línea ~562, DISENO.md) | Variante positiva (`--positive`). |
| `.badge--negative` | `css/style.css` (línea ~567, DISENO.md) | Variante negativa (`--negative`). |
| `.badge--aviso` | `css/style.css` (línea ~572, DISENO.md) | Variante de aviso (`--ambar`). |
| `.badge--border` | `css/style.css` (línea ~577, DISENO.md) | Variante con borde (`--border`). |
| `.badge--interactivo` | `css/style.css` (línea ~584, DISENO.md) | Badge clicable con cursor, hover y foco. |

En el dashboard las tarjetas usan `<span class="badge" id="...-cantidad">` para contadores (favoritos, pendientes, ordenes, estrategias, presupuestos, metas…).

## 4. Items de lista (movimientos, metas, presupuestos…)

| Clase | Archivo | Descripción |
|-------|---------|-------------|
| `.card-item` | `css/componentes.css` (línea ~339) | Card base para listas. Flex row, padding 12px 20px, borde, radio 40px, fondo `--surface`. |
| `.card-item.seleccionado` | `css/componentes.css` (línea ~407) | Estado seleccionado: borde `--text`, fondo `--backgroundAlt`, sombra interior. |
| `.card-item-titulo` | `css/componentes.css` (línea ~366) | Título del item (peso 500, color `--text`, ellipsis). |
| `.card-item-detalle` | `css/componentes.css` (línea ~374) | Detalle del item (12px, color `--textSecondary`). |
| `.card-item-etiquetas` | `css/componentes.css` (línea ~379) | Contenedor de etiquetas/chips del item (flex wrap, gap 4px). |
| `.skeleton-item` | `css/componentes.css` (línea ~427, DISENO.md) | Esqueleto de item de lista con borde, fondo y animación shimmer. |
| `.scroll-fade` | `css/dashboard.css` | Clase aplicada a las listas de las cards del dashboard (`.movimientos-lista.scroll-fade`, etc.). |

## 5. Estados y utilidades de tarjeta

| Clase | Archivo | Descripción |
|-------|---------|-------------|
| `.glass` | `css/style.css` (línea ~780, DISENO.md) | Superficie difuminada (frosted glass) con `backdrop-filter` y borde sutil. Base de todas las cards del dashboard. |
| `.card-navegable` | `css/dashboard.css` | Card que se puede navegar (cursor pointer). |
| `.card-error` | `css/dashboard.js` (render) | Tarjeta de error genérico ("Error al cargar esta card") cuando falla un generador. |
| `.card-con-scroll` | `css/dashboard.css` | Card con scroll interno (overflow-y auto). |
| `.scroll-fade` | `css/dashboard.css` | Contenedor de lista con efecto fade. |
| `.desact` | `css/componentes.css` (línea ~463) | Desactiva elementos (opacity 0.45, pointer-events none). |
| `.lista-vacia` | `css/componentes.css` (línea ~492) | Estado de lista vacía (texto centrado, opacidad). Variante `.lista-vacia.error` (color `--negative`). |
| `.text-secondary` | `css/style.css` (DISENO.md) | `color: var(--textSecondary)`. |
| `.text-muted` | `css/style.css` (DISENO.md) | `opacity: 0.7`. |
| `.text-positive` / `.text-negative` | `css/style.css` (DISENO.md) | Colores semánticos de texto. |

## 6. Dimensiones y span de grid (dashboard)

| Clase | Archivo | Descripción |
|-------|---------|-------------|
| `.card-span-2` | `css/dashboard.css` (línea ~36) | Card que ocupa 2 columnas (`grid-column: span 2`). |
| `.card-span-row-2` | `css/dashboard.css` (línea ~41) | Card que ocupa 2 filas (`grid-row: span 2`). |
| `.card-span-2x2` | `css/dashboard.css` (línea ~45) | Card que ocupa 2 columnas × 2 filas. |
| `.dashboard-card-ghost` | `css/dashboard.css` | Hueco de destino del arrastre (SortableJS). |
| `.dashboard-card-insercion` | `css/dashboard.css` | Línea de inserción al soltar. |

## 7. Esqueletos específicos del dashboard

| Clase | Archivo | Descripción |
|-------|---------|-------------|
| `.dona-esqueleto` | `css/dashboard.css` (línea ~1023) | Esqueleto circular de las donas (distribución, patrimonio-divisa). |
| `.skeleton-dashboard-list` | `js/ui/skeletons.js` | Clase aplicada a las filas de esqueleto de lista del dashboard (`skeletonMarkup({rows, className: "skeleton-dashboard-list"})`). |
| `.skeleton-value` / `.skeleton-value-large` | `js/ui/skeletons.js` | Esqueleto de texto de valor (valor normal / valor grande de patrimonio). |
| `.skeleton-badge` | `js/ui/skeletons.js` | Esqueleto de badge de contador. |

## 8. Otros componentes relevantes (no específicos de dashboard pero reutilizables)

| Clase | Archivo | Descripción |
|-------|---------|-------------|
| `.toggle-group` | `css/configuracion.css` | Grupo de opciones tipo toggle (usado por el gráfico de periodos). |
| `.toggle-option` | `css/configuracion.css` | Opción de toggle. |
| `.chip-etiqueta` | `css/componentes.css` | Chip de etiqueta con punto de color. |
| `.resumen-card` | `css/componentes.css` | Card de resumen de cifras (cuentas, inversiones, trading). |
| `.aporte-progreso` / `.aporte-progreso-barra` | `css/componentes.css` | Barra de progreso (uso de crédito / aporte a meta). |

---

## 9. Conteo

**Clases identificadas aplicables a tarjetas del dashboard: 34** (incluyendo variantes de badge, valor, text, span, utilidades y esqueletos).

---

## 10. Observaciones para Fase 2 Parte B (variantes)

- Las tarjetas del dashboard usan **`.glass.card`** como base, no **`.card-item`** (que es para listas internas de otras páginas). Si las variantes necesitan un estilo de "card de lista" dentro del dashboard, reutilizar `.card-item`.
- No existe hoy una clase de "variante 1×2 con contenido reducido" ni "variante 1×3 con lista expandida". El tamaño solo aplica clases de span (`.card-span-2`, `.card-span-row-2`). El diseño visual de variantes está protegido por el PO.
- Los esqueletos se inyectan vía `innerHTML` en los generadores (`skeletonText`, `skeletonMarkup`), no vía `<template>`, a diferencia de los esqueleto basados en template de `skeletons.js` (`esqueletoFilas`, etc.). Esto es un detalle de implementación actual.
