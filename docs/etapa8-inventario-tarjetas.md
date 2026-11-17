# Etapa 8 — Inventario de tarjetas del dashboard

**Fase 2, Parte A — Inventario (solo documentación).**
Inventario del catálogo de tarjetas (`DASHBOARD_CARDS`) y sus instancias dinámicas (`cuenta:<id>`, `activo:<id>`), con contenido actual por tamaño, estados y dependencias de datos.

**Regla de Fase 0/2:** este documento no modifica código de producción ni inventa variantes visuales. El diseño visual de las variantes está protegido por el PO y se define con el PO y ChatGPT.

---

## 1. Catálogo de tarjetas (`DASHBOARD_CARDS`)

| # | id | label | Eje | 1×1 | 1×2 | 1×3 | Notas |
|---|----|-------|-----|-----|-----|-----|-------|
| 1 | patrimonio | Patrimonio total | Y | sí | sí | no | Siempre visible, fija primero, no se oculta ni mueve. |
| 2 | cuentas | Cuentas | Y | sí | sí | no | |
| 3 | inversiones | Inversiones | Y | sí | sí | no | |
| 4 | vencimientos | Próximos vencimientos | Y | sí | sí | no | |
| 5 | movimientos | Últimos movimientos | Y | sí | sí | no | Con scroll interno. |
| 6 | favoritos | Favoritos | Y | sí | sí | no | |
| 7 | metas | Metas de ahorro | Y | sí | sí | no | Botón "Nueva". |
| 8 | presupuestos | Presupuestos | Y | sí | sí | no | |
| 9 | pendientes | Pendientes | Y | sí | sí | no | |
| 10 | ordenes | Órdenes | Y | sí | sí | no | |
| 11 | estrategias | Estrategias | Y | sí | sí | no | |
| 12 | flujo-caja | Flujo de caja | Y | sí | sí | no | |
| 13 | gastos-periodo | Gastado | Y | sí | sí | no | Valor negativo. |
| 14 | ingresos-periodo | Ingresado | Y | sí | sí | no | Valor positivo. |
| 15 | balance-periodo | Balance | Y | sí | sí | no | |
| 16 | deudas | Deudas | Y | sí | sí | no | |
| 17 | distribucion | Distribución patrimonial | Y | sí | sí | sí | **Sólo tarjeta con 3 filas** (requisito PO). |
| 18 | patrimonio-divisa | Patrimonio por divisa | Y | sí | sí | no | Dona por divisa. |
| 19 | programados | Movimientos programados | Y | sí | sí | no | |
| 20 | alertas | Alertas | Y | sí | sí | no | |
| 21 | grafico | Evolución patrimonial | X | sí (ancho 1-2) | 2×2 | no | Alto fijo 2 filas (canvas 200px). Eje X. |

**Total tarjetas del catálogo: 21.**

### Instancias dinámicas (no redimensionables, siempre 1×1)

| id | label | Notas |
|----|-------|-------|
| `cuenta:<id>` | nombre de la cuenta | Una por cuenta final (ver M6 / cuentasFinales). |
| `activo:<id>` | nombre del activo | Una por posición de activo. |

Estas instancias se agregan al orden del dashboard y no aparecen en `DASHBOARD_CARDS`; se pintan con generadores propios (`montarCardsInstanciadas`).

---

## 2. Contenido actual por tamaño (HTML generado)

**Hallazgo estructural de Fase 2A:** en la implementación actual, los generadores (`GENERADORES_CARD`) devuelven el **mismo HTML independientemente del tamaño** (1×1, 1×2 o 1×3). El tamaño solo afecta a las clases CSS de span (`card-span-2`, `card-span-row-2`, `card-span-2x2`) aplicadas por `clasesCard()`/`dimensionesCard()`, y al reparto del grid (`calcularDistribucion`). No existen variantes visuales diferentes por tamaño en el código actual. El diseño visual de variantes (qué se muestra/oculta o reacomoda en 1×2 vs 1×3) está protegido por el PO y se definirá en la Fase 2 Parte B.

A continuación el contenido del esqueleto/HTML que genera cada tarjeta hoy (único para todos los tamaños).

### 2.1 Tarjetas métrica (valor + detalle)

Generadas por `generarCardMetrica(cardId, titulo, subtitulo, valorId, detalleId)`:

| id | Título | Valor | Detalle | Botón/extra |
|----|--------|-------|---------|-------------|
| cuentas | "Cuentas" | `total-cuentas` (skeleton) | — | — |
| inversiones | "Inversiones" | `inversiones-valor` | `inversiones-detalle` | — |
| vencimientos | "Próximos vencimientos" | `vencimientos-cantidad` | `vencimientos-detalle` | — |
| flujo-caja | "Flujo de caja" | `flujo-caja-valor` | `flujo-caja-detalle` | — |
| balance-periodo | "Balance" | `balance-periodo-valor` | `balance-periodo-detalle` | — |
| deudas | "Deudas" | `deudas-valor` | `deudas-detalle` | — |

Estructura HTML: `.glass.card.card-navegable.metric-card` > `.card-header` (`.card-title`) > `.card-value` (skeleton) > [`.card-sub` detalle].

### 2.2 Tarjetas métrica con badge (cantidad + lista)

Generadas directa o por `generarCardListaSimple`:

| id | Título | Badge | Lista | Detalle |
|----|--------|-------|-------|---------|
| movimientos | "Últimos movimientos" | — | `movimientos-lista` (2 filas skeleton) | — |
| favoritos | "Favoritos" | `favoritos-cantidad` | `favoritos-lista` (2 filas) | — |
| pendientes | "Pendientes" | `pendientes-cantidad` | `pendientes-lista` (2 filas) | — |
| ordenes | "Órdenes" | `ordenes-cantidad` | `ordenes-lista` (2 filas) | `.card-sub` `ordenes-detalle` |
| estrategias | "Estrategias" | `estrategias-cantidad` | `estrategias-lista` (3 filas) | — |
| programados | "Programados" | `programados-cantidad` | `programados-lista` (2 filas) | — |
| alertas | "Alertas" | `alertas-cantidad` | `alertas-lista` (2 filas) | — |
| presupuestos | "Presupuestos" | `presupuestos-cantidad` | `presupuestos-lista` (3 filas) | — |

Estructura: `.glass.card` > `.card-header` (`.card-title` + `.badge`) > `.{id}-lista.scroll-fade` (skeletonMarkup) > [`.card-sub`].

### 2.3 Tarjetas con dona

| id | Título | Dona | Lista |
|----|--------|------|-------|
| distribucion | "Distribución patrimonial" | `distribucion-dona` + `dona-esqueleto` | `distribucion-lista` (3 filas) |
| patrimonio-divisa | "Patrimonio por divisa" | `divisa-dona` + `dona-esqueleto` | `divisa-lista` (3 filas) |

### 2.4 Tarjetas especiales

| id | Título | Contenido |
|----|--------|-----------|
| patrimonio | "Patrimonio Total" | select de divisa (PEN/USD/USDT), `.card-value` grande, `.card-sub` detalle. Fija, no navegable. |
| metas | "Metas de ahorro" | botón "Nueva" (`.btn-meta-nueva`), `metas-lista` (2 filas). |
| grafico | "Evolución patrimonial" | toggle-group de periodos, canvas `grafico-patrimonio`, `.grafico-estado` (skeleton chart). Alto fijo 2 filas. |

---

## 3. Elementos que cambian según el tamaño

| Elemento | 1×1 | 1×2 | 1×3 (solo distribucion) |
|----------|-----|-----|-------------------------|
| HTML del generador | idéntico | idéntico | idéntico |
| Clase de ancho | (ninguna) | `card-span-2` | (ninguna, ancho 1) |
| Clase de alto | (ninguna) | `card-span-row-2` | `card-span-row-2` (alto 3 no tiene clase propia hoy) |
| Clase combinada | — | `card-span-2x2` si ambas | — |
| scroll interno | según tarjeta (movimientos) | igual | igual |

**Conclusión de inventario:** hoy no hay contenido que cambie según tamaño; solo el espacio reservado en el grid. Cualquier variante visual real (ocultar detalle en 1×1, mostrar más items en 1×2/1×3, etc.) es decisión de producto pendiente (Fase 2 Parte B con el PO).

---

## 4. Estados de carga, vacío y error

Documentado por tarjeta según lo que genera el código actual.

### 4.1 Estado de carga (skeleton)

Todas las tarjetas renderizan esqueletos al abrir el dashboard (`.dashboard-cargando` + `pointer-events: none`).

| id | Esqueleto usado | Detalle |
|----|----------------|---------|
| métricas simples | `skeletonText("skeleton-value")` en `.card-value` | + `skeletonText()` en detalle si existe |
| patrimonio | `skeletonText("skeleton-value-large")` | + detalle |
| listas (movimientos, favoritos, …) | `skeletonMarkup({rows: N, className: "skeleton-dashboard-list"})` | filas de `skeleton-item` |
| metas/presupuestos | igual que listas | filas de skeleton |
| distribucion / patrimonio-divisa | `dona-esqueleto` + `skeletonMarkup(rows: 3)` | dona + lista |
| grafico | `skeletonMarkup(variant:"chart", label:"Cargando gráfico")` | bloque de gráfico |

Tarjeta patrimonio tiene también el select de divisa ya renderizado (no es esqueleto).

### 4.2 Estado vacío

**Hallazgo:** el código actual NO tiene estado vacío específico por tarjeta (no existe "No tienes movimientos", etc.). Las listas vacías se renderizan como contenedor `{id}-lista` vacío tras reemplazar esqueletos con `actualizarUI()`. No se usa `.lista-vacia` (de `css/componentes.css`) dentro de las tarjetas del dashboard hoy.

Si se desea un estado vacío por tarjeta en la Fase 2, es decisión de producto (PO).

### 4.3 Estado de error

Existe un manejador genérico en `render()` (catch del generador): tarjeta `.glass.card.card-error` con `.card-title` y `.card-value negative` con texto **"Error al cargar esta card"**. Se aplica a cualquier tarjeta cuyo generador falle.

No hay error específico por tarjeta (ej. "Error al cargar movimientos"). Es decisión de producto si se refina por tarjeta (Fase 2 Parte B).

---

## 5. Dependencias de datos por tarjeta

| id | Depende de | Fuente / repositorio |
|----|-----------|---------------------|
| patrimonio | total, disponible, invertido, deudas, divisa | `calcularPatrimonio()` (SnapshotServicio), `divisaActual` |
| cuentas | saldos de cuentas | `obtenerCuentas()` (firebase/firestore) |
| inversiones | valor total de posiciones | `obtenerPosicionesConValor()` (PosicionServicio) |
| vencimientos | vencimientos pendientes | `obtenerPendientes()` (PendienteRepositorio) |
| movimientos | últimos movimientos | `obtenerMovimientos()` (firebase/firestore) |
| favoritos | favoritos del usuario | (servicio de favoritos) |
| metas | metas de ahorro | `obtenerMetas()` (MetaRepositorio) |
| presupuestos | presupuestos con progreso | `obtenerPresupuestosConProgreso()` (PresupuestoServicio) |
| pendientes | pendientes | `obtenerPendientes()` |
| ordenes | órdenes | `obtenerOrdenes()` (OrdenRepositorio) |
| estrategias | estrategias | `obtenerEstrategias()` (EstrategiaRepositorio) |
| flujo-caja | flujo de caja | datos de movimientos/cuentas |
| gastos-periodo | gastado en periodo | movimientos filtrados por periodo |
| ingresos-periodo | ingresado en periodo | movimientos filtrados por periodo |
| balance-periodo | balance del periodo | movimientos filtrados por periodo |
| deudas | deudas de cuentas | saldos de cuentas de crédito |
| distribucion | liquidez, inversiones, inmovil, deudas | `analiticaData` (calculada en `abrirModalDistribucionPatrimonial`) |
| patrimonio-divisa | patrimonio por divisa | patrimonio agrupado por divisa |
| programados | movimientos programados | (servicio de programados) |
| alertas | alertas del sistema | (servicio de alertas) |
| grafico | evolución patrimonial | `obtenerPatrimonioParaGrafico()` (SnapshotServicio) |
| `cuenta:<id>` | saldo de esa cuenta | cuenta individual (`obtenerCuenta`) |
| `activo:<id>` | posición y valor del activo | posiciones (`obtenerPosicionesConValor`) |

---

## 6. Archivos relacionados

- `js/pages/dashboard.js`: `DASHBOARD_CARDS`, `DASHBOARD_DIMENSIONES`, `GENERADORES_CARD`, `generarCard*`, `clasesCard()`, `dimensionesCard()`, `calcularDistribucion()`, `render()`.
- `js/ui/skeletons.js`: `skeletonText`, `skeletonMarkup`, variantes de esqueleto.
- `css/componentes.css`: `.card-item`, `.skeleton-item`, `.lista-vacia`, `.badge` (en style.css).
- `css/dashboard.css`: `.dashboard .card`, `clasesCard`, dimensiones de cards del dashboard.
- `DISENO.md`: reglas de diseño y componentes reutilizables.

---

## 7. Pendientes / ambigüedades para el PO

- **Diseño visual de variantes (protegido):** qué se muestra u oculta en 1×1 vs 1×2 vs 1×3 no está definido. El código actual usa el mismo HTML para todos los tamaños. Se define con el PO y ChatGPT en Fase 2 Parte B.
- **Estado vacío por tarjeta:** no existe hoy. Si se quiere (ej. "No tienes movimientos"), es decisión de producto.
- **Estado de error por tarjeta:** hoy es genérico ("Error al cargar esta card"). Refinarlo por tarjeta es decisión de producto.
- **Alto 3 de Distribución:** el catálogo permite `altoMax: 3` solo en `distribucion` (ajustado en Fase 1); qué contenido extra se muestra en 1×3 está por definir.
