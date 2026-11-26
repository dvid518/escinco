# Etapa 8 — Contrato Actualizado: Restricciones de Dimensiones y Composiciones del Dashboard

**Fecha:** 2025-11-25  
**Estado:** Especificación aprobada por PO — Lista para implementación  
**Fuente:** Decisiones PO Etapa 8 + Nuevas decisiones PO (2025-11-25) + Resoluciones pendientes (2025-11-25)

---

## 1. Matriz de Dimensiones Permitidas por Tarjeta (Actualizada)

Fuente: constante `DASHBOARD_DIMENSIONES` en `js/pages/dashboard.js`.

| Tarjeta | Eje | Ancho (col) | Alto (filas) | Default | Comentario |
|---------|-----|-------------|--------------|---------|------------|
| **patrimonio** | Y | 1 (fijo) | 1–2 | 1×1 | Solo 1×1 y 1×2. Eje Y. Toggle de divisa (PEN/USD/EUR, sin USDT). |
| **cuentas** | Y | 1 (fijo) | 1–2 | 1×1 | Máximo 1×2. |
| **inversiones** | Y | 1 (fijo) | 1–2 | 1×1 | Máximo 1×2. |
| **vencimientos** | Y | 1 (fijo) | 1–2 | 1×1 | Máximo 1×2. |
| **movimientos** | Y | 1 (fijo) | 1–3 | 1×2 | Con scroll interno. |
| **favoritos** | Y | 1 (fijo) | 1–2 | 1×2 | **Solo 1×2 y 1×3** (sin 1×1). |
| **metas** | Y | 1 (fijo) | 1–3 | 1×1 | Botón "Nueva". Skeleton persistente = defecto funcional. |
| **presupuestos** | Y | 1 (fijo) | 1–3 | 1×1 | Skeleton persistente = defecto funcional. |
| **pendientes** | Y | 1 (fijo) | 1–3 | 1×1 | Orden: vencidos → próximos → sin fecha. |
| **ordenes** | Y | 1 (fijo) | 1–3 | 1×1 | Orden: activas → ejecutadas → canceladas. |
| **estrategias** | Y | 1 (fijo) | 1–3 | 1×1 | Orden: próximas → sin fecha → pasadas. |
| **programados** | Y | 1 (fijo) | 1–3 | 1×1 | Orden: próximos → pasados. |
| **gastos-periodo** | Y | 1 (fijo) | 1 (fijo) | 1×1 | **Solo 1×1**. Valor negativo. |
| **ingresos-periodo** | Y | 1 (fijo) | 1 (fijo) | 1×1 | **Solo 1×1**. Valor positivo. |
| **balance-periodo** | Y | 1 (fijo) | 1 (fijo) | 1×1 | **Solo 1×1**. |
| **deudas** | Y | 1 (fijo) | 1 (fijo) | 1×1 | **Solo 1×1**. Total obligaciones (saldo deuda tarjetas crédito). |
| **distribucion** | Y | 1 (fijo) | 1–3 | 1×2 | **Única tarjeta con 3 filas original**. Distribución patrimonial. |
| **distribucion-activos** | Y | 1 (fijo) | 1–3 | 1×2 | Distribución por tipo de activo. 1×2: barras; 1×3: barras + dona. |
| **patrimonio-divisa** | Y | 1 (fijo) | 1–3 | 1×2 | Patrimonio por divisa. 1×2: barras + valores; 1×3: barras + dona. |
| **alertas** | Y | 1 (fijo) | 1 (fijo) | 1×1 | **Solo 1×1**. |
| **grafico** | X | 1–2 | 2 (fijo) | 2×2 | Canvas 200px requiere alto fijo 2. |
| `cuenta:*` / `activo:*` | — | 1 (fijo) | 1 (fijo) | 1×1 | Instancias, no redimensionables. |

**Tarjetas eliminadas:**
- `flujo-caja` — Eliminada por PO.

**Regla de 3 filas:** Solo `distribucion`, `distribucion-activos` y `patrimonio-divisa` pueden tener `altoMax: 3`.

**Regla 1×1 prohibida en tarjetas de distribución:** Ninguna tarjeta de distribución (`distribucion`, `distribucion-activos`, `patrimonio-divisa`) puede tener dimensión 1×1.

---

## 2. Composiciones Definitivas por Tarjeta

### 2.1 Patrimonio Total (`patrimonio`) — Eje Y, 1×1 / 1×2

| Tamaño | Contenido |
|--------|-----------|
| **1×1** | Selector de divisa (toggle-group PEN → USD → EUR, sin USDT), valor principal grande, subtítulo detalle (disponible / inmovil / deudas). |
| **1×2** | Igual que 1×1 + área extra para estadísticas o desglose extendido. |

**Reglas del toggle-group de divisa (Patrimonio Total):**
- **Nunca muestra USDT.**
- **Únicas divisas permitidas:** PEN (soles), USD (dólares), EUR (euros) — **estrictamente en ese orden**.
- **Solo divisas con historial:** Muestra únicamente las divisas que el usuario haya utilizado **alguna vez** en sus movimientos o registros históricos (no solo cuentas activas).
- **Historial completo, sin límite temporal:** Consultar **movimientos**, **cuentas activas y archivadas**, **snapshots** y **posiciones**. Una divisa usada en cualquier fuente permanece en el toggle aunque se elimine la cuenta origen.
- **Orden fijo:** PEN → USD → EUR, independientemente de cuándo se usó cada divisa.
- **Sin opciones vacías:** Si el usuario nunca usó una divisa, no aparece.
- **Una sola divisa:** Si solo usó una, muestra solo esa opción.
- **Historial ≠ cuentas activas:** Eliminar/desactivar una cuenta **no** hace desaparecer una divisa ya usada.
- **Ámbito:** Estas restricciones aplican **solo al toggle-group de Patrimonio Total**; no se confunden con reglas de cálculo o visualización de otras tarjetas.

---

### 2.2 Distribución Patrimonial (`distribucion`) — Eje Y, 1×2 / 1×3 (NO 1×1)

**Composición aprobada (propuesta OpenCode aplicada):**

| Tamaño | Contenido |
|--------|-----------|
| **1×2** | Título + **barras horizontales** (4 categorías: Liquidez, Inversiones, Inmovilizado, Deudas) con valores y porcentajes. Lista y barras alineadas hacia la **parte inferior** de la tarjeta. |
| **1×3** | Título + **dona** (ocupa espacio libre entre título y lista) + **barras horizontales** completas con valores y porcentajes. Lista y barras alineadas hacia la **parte inferior**. La dona no debe tener scroll ni indicador de inserción visual. |

**Reglas visuales/funcionales:**
- 4 categorías fijas siempre presentes (aunque tengan 0): Liquidez, Inversiones, Inmovilizado, Deudas.
- Colores fijos por categoría (paleta distribución): `--distribucion-liquidez`, `--distribucion-inversiones`, `--distribucion-inmovil`, `--distribucion-deudas`.
- Orden por valor descendente (mayor participación primero).
- En 1×2: la dona **no** se muestra.
- En 1×3: la dona se muestra en el espacio entre título y lista; lista y barras quedan ancladas abajo.
- **Sin scroll** en ningún tamaño.
- Los porcentajes siempre suman 100% (recalculados sobre valores reales).

---

### 2.3 Distribución por Tipo de Activo (`distribucion-activos`) — Eje Y, 1×2 / 1×3 (NO 1×1)

**Composición aprobada (propuesta OpenCode aplicada):**

| Tamaño | Contenido |
|--------|-----------|
| **1×2** | Título + **lista completa de tipos** (Acción, ETF, Cripto, Bono, Otros) con barras horizontales y valores. Tipos sin participación muestran **0%**. Lista y barras alineadas hacia la **parte inferior**. |
| **1×3** | Título + **dona** (espacio libre entre título y lista) + **lista completa** con barras y valores. Tipos sin participación muestran **0%**. Lista y barras ancladas abajo. Dona sin scroll ni indicador visual de inserción. |

**Reglas visuales/funcionales:**
- **Todos los tipos posibles siempre aparecen** (5 tipos: Acción, ETF, Cripto, Bono, Otros), aunque el usuario no tenga posiciones.
- **Orden fijo:** `[accion, etf, crypto, bono, otros]` — siempre en este orden, tanto en barras como en dona. No ordenar por valor descendente.
- Tipos sin participación: barra en 0%, valor 0, etiqueta visible.
- Colores por tipo (variables CSS): `--violet` (acción), `--aqua` (ETF), `--orange` (cripto), `--piggie` (bono), `--cappuccino` (otros).
- En 1×2: la dona **no** se muestra.
- En 1×3: dona en espacio libre; lista anclada abajo.
- **Sin scroll** en ningún tamaño.

---

### 2.4 Patrimonio por Divisa (`patrimonio-divisa`) — Eje Y, 1×2 / 1×3 (NO 1×1)

**Composición aprobada (propuesta OpenCode aplicada):**

| Tamaño | Contenido |
|--------|-----------|
| **1×2** | Título + **barras horizontales** por divisa (PEN, USD, EUR — solo las usadas históricamente) con **valores en su moneda original** y porcentajes. Lista y barras alineadas hacia la **parte inferior**. |
| **1×3** | Título + **dona** (espacio libre entre título y lista) + **barras horizontales** completas con valores en moneda original y porcentajes. Lista y barras ancladas abajo. Dona sin scroll ni indicador visual. |

**Reglas visuales/funcionales:**
- **Divisas mostradas:** Solo PEN, USD, EUR que el usuario haya usado **alguna vez** (historial de movimientos/registros, no solo cuentas activas). Orden fijo: PEN → USD → EUR.
- **Nunca USDT** en esta tarjeta.
- Valores mostrados en su **moneda original** (no convertidos): ej. "S/ 12 500,00", "$ 3 200,00", "€ 1 800,00".
- Porcentajes calculados sobre total convertido a moneda común (para comparabilidad).
- En 1×2: dona **no** se muestra.
- En 1×3: dona en espacio libre; lista anclada abajo.
- **Sin scroll** en ningún tamaño.
- Colores por divisa: `--orange` (PEN), `--violet` (USD), `--piggie` (EUR).

---

### 2.5 Deudas (`deudas`) — Eje Y, 1×1 (SOLO 1×1)

**Función:** Mostrar el **total de obligaciones pendientes** = suma del saldo `deuda` de cada tarjeta de crédito activa.

**Fuentes de datos y cálculo:**
- **Única fuente:** Tarjetas de crédito (`tipo === "credito"`, `estado !== "archivada"`, `esPatrimonio !== false`) con `deuda > 0`. Cada tarjeta cuenta como **una deuda individual**.
- **No se suman:** cuotas próximas, pagos programados, metas, estrategias, anualidades, ni pendientes de cobro/pago. El campo `deuda` ya representa el saldo total adeudado; las cuotas futuras son parte de ese saldo, no deuda adicional.
- **Anti-duplicación garantizada:** Una sola fuente (`cuenta.deuda`). `analiticaData.programados` (tipo "tarjeta") solo sirve para el detalle textual, nunca para el cálculo del total.

**Composición 1×1:**
- Título: "Deudas"
- Valor principal: total formateado en divisa actual del dashboard (`analiticaData.deudas`)
- Detalle:
  - Si existe un próximo pago de tarjeta (`programados.find(tipo === "tarjeta")`): `"Próximo pago: DD/MM"`
  - Si no existe próximo pago: `"X tarjetas con deuda"` (donde X = `tarjetasConDeuda`)
  - **No identificar individualmente la tarjeta** en el detalle.
- Navegación: click → `/cuentas`
- Clase `negative` si total > 0

**No se proponen variantes 1×2 ni 1×3 para esta tarjeta.**

---

### 2.6 Resto de Tarjetas (Resumen de Decisiones PO Previas)

| Tarjeta | Dimensiones | Notas |
|---------|-------------|-------|
| `cuentas` | 1×1, 1×2 | Máximo 1×2 |
| `inversiones` | 1×1, 1×2 | Máximo 1×2 |
| `vencimientos` | 1×1, 1×2 | Máximo 1×2 |
| `movimientos` | 1×1, 1×2, 1×3 | Con scroll interno |
| `favoritos` | 1×2, 1×3 | **Sin 1×1** |
| `metas` | 1×1, 1×2, 1×3 | Skeleton persistente = defecto |
| `presupuestos` | 1×1, 1×2, 1×3 | Skeleton persistente = defecto |
| `pendientes` | 1×1, 1×2, 1×3 | Orden: vencidos → próximos → sin fecha |
| `ordenes` | 1×1, 1×2, 1×3 | Orden: activas → ejecutadas → canceladas |
| `estrategias` | 1×1, 1×2, 1×3 | Orden: próximas → sin fecha → pasadas |
| `programados` | 1×1, 1×2, 1×3 | Orden: próximos → pasados |
| `gastos-periodo` | 1×1 | Solo 1×1, valor negativo |
| `ingresos-periodo` | 1×1 | Solo 1×1, valor positivo |
| `balance-periodo` | 1×1 | Solo 1×1 |
| `alertas` | 1×1 | Solo 1×1 |
| `grafico` | 1×2, 2×2 | Alto fijo 2, eje X |

---

## 3. Reglas Funcionales y Visuales Transversales

### 3.1 Sin Scroll en Tarjetas de Distribución
- **Ninguna tarjeta de distribución** (`distribucion`, `distribucion-activos`, `patrimonio-divisa`) puede tener scroll vertical u horizontal.
- La lista y las barras deben **alinearse hacia la parte inferior** de la tarjeta.
- La dona (en 1×3) ocupa el **espacio libre** entre el título y la lista.
- No debe existir **scroll ni indicador de inserción visual** (flecha, fade, etc.).

### 3.2 Alineación Inferior (Bottom-Anchored)
Para las tres tarjetas de distribución en tamaños 1×2 y 1×3:
- El contenedor de la lista+barras usa `display: flex; flex-direction: column; justify-content: flex-end` (o equivalente CSS Grid).
- La dona (si existe) se coloca **arriba** (`margin-bottom: auto` o `grid-row: 1`), la lista **abajo** (`margin-top: auto` o `grid-row: 2` con `align-self: end`).

### 3.3 Cero Valores Visibles
- En `distribucion-activos`: **todos los 5 tipos** siempre se renderizan, los de valor 0 muestran "0%" y barra vacía.
- En `patrimonio-divisa`: solo divisas con historial (PEN/USD/EUR en orden fijo).
- En `distribucion`: 4 categorías fijas siempre presentes.

### 3.4 Estados de Carga (Skeleton)
- Conservar los skeleton existentes: 3 filas `skeleton-dashboard-list` para lista + `dona-esqueleto` para dona.
- **Garantía anti-skeleton-persistente:** Cada `actualizarX()` (`actualizarDistribucion`, `actualizarDistribucionActivos`, `actualizarPatrimonioDivisa`, `actualizarDeudas`) debe tener `catch` que reemplace skeleton por estado vacío o error, nunca dejar skeleton infinito.

### 3.5 Estados Vacíos
- Conservar `tarjetaVacia()` y template `tpl-card-vacio` (diseño actual).
- Textos específicos por tarjeta:
  - `distribucion`: "Sin patrimonio para distribuir"
  - `distribucion-activos`: "Sin posiciones abiertas"
  - `patrimonio-divisa`: "Sin patrimonio en divisas registradas"
  - `deudas`: "Sin deudas registradas"

### 3.6 Estados de Error
- Implementar mensajes específicos por tarjeta (sin botones de reintento ni nuevos componentes visuales):
  - `distribucion`: "Error al cargar distribución patrimonial"
  - `distribucion-activos`: "Error al cargar distribución por tipo de activo"
  - `patrimonio-divisa`: "Error al cargar patrimonio por divisa"
  - `deudas`: "Error al cargar deudas"
- Patrón: en `catch` de cada `actualizarX()`, `lista.replaceChildren(tarjetaVacia(mensajeError))` + `cardEl?.classList.add("card-error")`.

### 3.7 Colores Fijos (Paleta Distribución)
Las variables CSS en `css/style.css` (ya definidas en `DISENO.md`):
```css
--distribucion-liquidez: var(--aqua);
--distribucion-inversiones: var(--orange);
--distribucion-inmovil: var(--violet);
--distribucion-deudas: var(--negative);
```
Tipos de activo: `--violet` (acción), `--aqua` (ETF), `--orange` (cripto), `--piggie` (bono), `--cappuccino` (otros).
Divisas: `--orange` (PEN), `--violet` (USD), `--piggie` (EUR), `--aqua` (USDT — no usada en estas tarjetas).

### 3.8 Templates Compartidos
- `tpl-distribucion-item` (en `dashboard.html` y `demo.html`) usado por las tres tarjetas de distribución.
- Huecos: `etiqueta`, `porcentaje`, `barra-clase` (data-clase), `valor`.
- Verificación: `tests/plantillas.test.mjs` debe confirmar identidad entre `dashboard.html` y `demo.html`.

---

## 4. Inconsistencias / Conflictos Detectados y Resueltos

| # | Conflicto | Descripción | Resolución Aplicada |
|---|-----------|-------------|---------------------|
| 1 | **`DASHBOARD_DIMENSIONES` actual vs PO** | El código actual permite `altoMax: 3` en muchas tarjetas. PO: **solo 3 tarjetas con 3 filas** (`distribucion`, `distribucion-activos`, `patrimonio-divisa`). | Actualizar `DASHBOARD_DIMENSIONES`: `altoMax: 3` solo en esas 3. El resto `altoMax: 2` (o 1 donde PO lo fijó). |
| 2 | **`distribucion-activos` y `patrimonio-divisa` permitían 1×1** | PO: **prohibido 1×1** en tarjetas de distribución. | Cambiar `altoMin: 2` en ambas. `distribucion` → `altoMin: 2`. |
| 3 | **`favoritos` permite 1×1 en código** | PO: `favoritos` **solo 1×2 y 1×3**. | `altoMin: 2`, `altoMax: 3`. |
| 4 | **`deudas` permite hasta 3 filas en código** | PO: `deudas` **solo 1×1**. | `altoMin: 1`, `altoMax: 1`. |
| 5 | **`alertas` permite hasta 3 filas en código** | PO: `alertas` **solo 1×1**. | `altoMin: 1`, `altoMax: 1`. |
| 6 | **`gastos-periodo`, `ingresos-periodo`, `balance-periodo` permiten 1×2** | PO: **solo 1×1**. | `altoMin: 1`, `altoMax: 1`. |
| 7 | **`cuentas`, `inversiones`, `vencimientos` permiten 1×3** | PO: **máximo 1×2**. | `altoMax: 2`. |
| 8 | **`flujo-caja` sigue en catálogo** | PO: **eliminada**. | Quitar de `DASHBOARD_CARDS` y `DASHBOARD_DIMENSIONES`. |
| 9 | **`patrimonio-divisa` orden de divisas incluye USDT** | Código usa `ORDEN_DIVISAS_PATRIMONIO = ["pen", "usd", "eur", "usdt"]`. PO: **PEN → USD → EUR, sin USDT, solo historial**. | Actualizar `ORDEN_DIVISAS_PATRIMONIO` = `["pen", "usd", "eur"]` y lógica de filtrado en `actualizarPatrimonioDivisa()` y `obtenerDivisasConHistorial()`. |
| 10 | **`divisasDeCuentas()` usa solo cuentas activas** | PO: **historial completo** (movimientos, cuentas archivadas, snapshots, posiciones). | Reemplazar por `obtenerDivisasConHistorial(uid)` que consulta las 4 fuentes. |
| 11 | **`actualizarPatrimonioDivisa()` filtra por `valor > 0` actual** | PO: mostrar divisas usadas **históricamente**, aunque ahora tengan 0. | Cambiar filtro: usar `obtenerDivisasConHistorial()`, no `patrimonioStats.porDivisa`. |
| 12 | **Deudas: posible doble conteo con `programados`** | `actualizarDeudas()` usaba `analiticaData.deudas` + `programados` tipo tarjeta. | **Fuente única:** `analiticaData.deudas` (suma `cuenta.deuda`). `programados` solo para detalle textual. |
| 13 | **`distribucion-activos` dona en 1×2?** | Código: `if (filas === 3 && dona)` — dona solo en 1×3. **Correcto**. | Confirmado: dona **solo 1×3**. |
| 14 | **`patrimonio-divisa` dona en 1×2?** | Código: `if (filas === 3)` — dona solo en 1×3. **Correcto**. | Confirmado: dona **solo 1×3**. |
| 15 | **`distribucion` 1×1 existe en código** | `generarCardDistribucionDona` tiene rama `filas === 1`. PO: **no 1×1**. | Eliminar rama 1×1; `altoMin: 2`. |
| 16 | **Skeleton persistente Metas/Presupuestos** | PO: investigar como **defectos funcionales**. | Bug a corregir en implementación (fuera de este contrato). |

---

## 5. DASHBOARD_DIMENSIONES — Versión Final para Código

```javascript
const DASHBOARD_DIMENSIONES = {
    // Patrimonio: solo 1x1 y 1x2 (eje Y). Toggle divisa PEN/USD/EUR (sin USDT, solo historial).
    patrimonio:        { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 2, anchoDefault: 1, altoDefault: 1 },

    // Distribución patrimonial: 1x2 y 1x3 (NO 1x1). Única con 3 filas original.
    distribucion:      { anchoMin: 1, anchoMax: 1, altoMin: 2, altoMax: 3, anchoDefault: 1, altoDefault: 2 },

    // Distribución por tipo de activo: 1x2 y 1x3 (NO 1x1). Dona solo en 1x3.
    "distribucion-activos": { anchoMin: 1, anchoMax: 1, altoMin: 2, altoMax: 3, anchoDefault: 1, altoDefault: 2 },

    // Patrimonio por divisa: 1x2 y 1x3 (NO 1x1). Dona solo en 1x3. Divisas: PEN/USD/EUR solo historial.
    "patrimonio-divisa": { anchoMin: 1, anchoMax: 1, altoMin: 2, altoMax: 3, anchoDefault: 1, altoDefault: 2 },

    // Movimientos: 1x1, 1x2, 1x3 (con scroll).
    movimientos:       { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 3, anchoDefault: 1, altoDefault: 2 },

    // Favoritos: SOLO 1x2 y 1x3 (sin 1x1).
    favoritos:         { anchoMin: 1, anchoMax: 1, altoMin: 2, altoMax: 3, anchoDefault: 1, altoDefault: 2 },

    // Metas: 1x1, 1x2, 1x3. Skeleton persistente = defecto.
    metas:             { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 3, anchoDefault: 1, altoDefault: 1 },

    // Presupuestos: 1x1, 1x2, 1x3. Skeleton persistente = defecto.
    presupuestos:      { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 3, anchoDefault: 1, altoDefault: 1 },

    // Pendientes: 1x1, 1x2, 1x3. Orden: vencidos → próximos → sin fecha.
    pendientes:        { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 3, anchoDefault: 1, altoDefault: 1 },

    // Órdenes: 1x1, 1x2, 1x3. Orden: activas → ejecutadas → canceladas.
    ordenes:           { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 3, anchoDefault: 1, altoDefault: 1 },

    // Estrategias: 1x1, 1x2, 1x3. Orden: próximas → sin fecha → pasadas.
    estrategias:       { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 3, anchoDefault: 1, altoDefault: 1 },

    // Programados: 1x1, 1x2, 1x3. Orden: próximos → pasados.
    programados:       { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 3, anchoDefault: 1, altoDefault: 1 },

    // Métricas de período: SOLO 1x1.
    "gastos-periodo":  { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 1, anchoDefault: 1, altoDefault: 1 },
    "ingresos-periodo":{ anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 1, anchoDefault: 1, altoDefault: 1 },
    "balance-periodo": { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 1, anchoDefault: 1, altoDefault: 1 },

    // Deudas: SOLO 1x1. Total obligaciones (saldo deuda tarjetas crédito).
    deudas:            { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 1, anchoDefault: 1, altoDefault: 1 },

    // Cuentas: máximo 1x2.
    cuentas:           { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 2, anchoDefault: 1, altoDefault: 1 },

    // Inversiones: máximo 1x2.
    inversiones:       { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 2, anchoDefault: 1, altoDefault: 1 },

    // Vencimientos: máximo 1x2.
    vencimientos:      { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 2, anchoDefault: 1, altoDefault: 1 },

    // Alertas: SOLO 1x1.
    alertas:           { anchoMin: 1, anchoMax: 1, altoMin: 1, altoMax: 1, anchoDefault: 1, altoDefault: 1 },

    // Gráfico: eje X, ancho 1-2, alto fijo 2.
    grafico:           { anchoMin: 1, anchoMax: 2, altoMin: 2, altoMax: 2, anchoDefault: 2, altoDefault: 2 },
};
```

**Catálogo `DASHBOARD_CARDS` actualizado (sin `flujo-caja`):**
```javascript
const DASHBOARD_CARDS = [
    { id: "patrimonio", label: "Patrimonio total", spanColumnas: 1, spanFilas: 1 },
    { id: "cuentas", label: "Cuentas", spanColumnas: 1, spanFilas: 1 },
    { id: "inversiones", label: "Inversiones", spanColumnas: 1, spanFilas: 1 },
    { id: "vencimientos", label: "Próximos vencimientos", spanColumnas: 1, spanFilas: 1 },
    { id: "movimientos", label: "Últimos movimientos", spanColumnas: 1, spanFilas: 2, scroll: true },
    { id: "favoritos", label: "Favoritos", spanColumnas: 1, spanFilas: 2 },  // default 1x2
    { id: "metas", label: "Metas de ahorro", spanColumnas: 1, spanFilas: 1 },
    { id: "presupuestos", label: "Presupuestos", spanColumnas: 1, spanFilas: 1 },
    { id: "pendientes", label: "Pendientes", spanColumnas: 1, spanFilas: 1 },
    { id: "ordenes", label: "Órdenes", spanColumnas: 1, spanFilas: 1 },
    { id: "estrategias", label: "Estrategias", spanColumnas: 1, spanFilas: 1 },
    { id: "gastos-periodo", label: "Gastado", spanColumnas: 1, spanFilas: 1 },
    { id: "ingresos-periodo", label: "Ingresado", spanColumnas: 1, spanFilas: 1 },
    { id: "balance-periodo", label: "Balance", spanColumnas: 1, spanFilas: 1 },
    { id: "deudas", label: "Deudas", spanColumnas: 1, spanFilas: 1 },
    { id: "distribucion", label: "Distribución patrimonial", spanColumnas: 1, spanFilas: 2 }, // default 1x2
    { id: "distribucion-activos", label: "Distribución por tipo de activo", spanColumnas: 1, spanFilas: 2 }, // default 1x2
    { id: "patrimonio-divisa", label: "Patrimonio por divisa", spanColumnas: 1, spanFilas: 2 }, // default 1x2
    { id: "programados", label: "Movimientos programados", spanColumnas: 1, spanFilas: 1 },
    { id: "alertas", label: "Alertas", spanColumnas: 1, spanFilas: 1 },
    { id: "grafico", label: "Evolución patrimonial", spanColumnas: 2, spanFilas: 2 }
];
```

---

## 6. Plan de Implementación por Tarjetas

### Fase 0 — Preparación y Constantes (Bloqueante para todo)
| Tarea | Archivos | Dependencias |
|-------|----------|--------------|
| 0.1 Actualizar `DASHBOARD_DIMENSIONES` | `js/pages/dashboard.js` | — |
| 0.2 Actualizar `DASHBOARD_CARDS` (eliminar `flujo-caja`, defaults 1×2) | `js/pages/dashboard.js` | 0.1 |
| 0.3 Actualizar `DEFAULT_CARDS_VISIBLES` / `DEFAULT_CARDS_ORDEN` | `js/pages/dashboard.js` | 0.2 |
| 0.4 Añadir `ORDEN_DIVISAS_PATRIMONIO = ["pen", "usd", "eur"]` (sin USDT) | `js/pages/dashboard.js` | — |
| 0.5 Añadir `ORDEN_TIPOS_ACTIVO = ["accion", "etf", "crypto", "bono", "otros"]` | `js/pages/dashboard.js` | — |

### Fase 1 — Tarjetas de Distribución (Core Visual)
*Orden: `distribucion` → `distribucion-activos` → `patrimonio-divisa` (comparten patrones)*

| Tarjeta | Tareas | Archivos | Dependencias |
|---------|--------|----------|--------------|
| **distribucion** | 1.1 Eliminar rama 1×1 en `generarCardDistribucionDona`<br>1.2 `actualizarDistribucion()`: bottom-anchored, 4 categorías fijas, dona solo 1×3<br>1.3 CSS: `.distribucion-lista-bottom`, `.distribucion-dona-top` | `js/pages/dashboard.js`, `css/dashboard.css` | Fase 0 |
| **distribucion-activos** | 2.1 `generarCardDistribucionActivos`: eliminar 1×1, layout 1×2/1×3<br>2.2 `actualizarDistribucionActivos()`: 5 tipos fijos (`ORDEN_TIPOS_ACTIVO`), inyectar 0%, dona solo 1×3, bottom-anchored<br>2.3 CSS: reusar clases Fase 1.1 | `js/pages/dashboard.js`, `css/dashboard.css` | Fase 0, 1.1 |
| **patrimonio-divisa** | 3.1 `generarCardPatrimonioDivisa`: eliminar 1×1, layout 1×2/1×3<br>3.2 `actualizarPatrimonioDivisa()`: filtrar por `obtenerDivisasConHistorial()`, orden PEN→USD→EUR, valores moneda original, bottom-anchored, dona solo 1×3<br>3.3 CSS: reusar clases Fase 1.1 | `js/pages/dashboard.js`, `css/dashboard.css` | Fase 0, 1.1 |

### Fase 2 — Servicios de Datos Compartidos
| Tarea | Archivos | Dependencias |
|-------|----------|--------------|
| 2.1 Crear `obtenerDivisasConHistorial(uid)` en `DivisaServicio.js` o `dashboard.js` | `js/services/DivisaServicio.js` o `js/pages/dashboard.js` | Fase 0 |
| &nbsp;&nbsp;• Consultar: `movimientos` (campo `divisa`), `cuentas` incl. archivadas (`moneda`), `snapshots` (campos `*PEN/*USD/*EUR`), `posiciones` (`divisa`)<br>&nbsp;&nbsp;• Devolver `Set<"pen"|"usd"|"eur">`<br>&nbsp;&nbsp;• Cache 5 min (`cacheCapa`) | | |
| 2.2 Actualizar `configurarDivisa()` / `divisasDeCuentas()` → usar `obtenerDivisasConHistorial()` | `js/pages/dashboard.js` | 2.1 |
| 2.3 Verificar `actualizarPatrimonioDivisa()` usa nueva fuente | `js/pages/dashboard.js` | 2.1, 3.2 |

### Fase 3 — Tarjeta Deudas (Simplificación)
| Tarea | Archivos | Dependencias |
|-------|----------|--------------|
| 3.1 `actualizarDeudas()`: confirmar fuente única `analiticaData.deudas` (suma `cuenta.deuda` tarjetas crédito activas) | `js/pages/dashboard.js` | Fase 0 |
| 3.2 Detalle: `programados.find(tipo === "tarjeta")` → "Próximo pago: DD/MM" / else "X tarjetas con deuda" | `js/pages/dashboard.js` | 3.1 |
| 3.3 Eliminar cualquier lógica 1×2/1×3 en generador (ya es métrica simple) | `js/pages/dashboard.js` | Fase 0 |

### Fase 4 — Tarjeta Patrimonio Total (Toggle Divisa)
| Tarea | Archivos | Dependencias |
|-------|----------|--------------|
| 4.1 `configurarDivisa()`: usar `obtenerDivisasConHistorial()`, orden fijo PEN→USD→EUR, sin USDT | `js/pages/dashboard.js` | Fase 2 |
| 4.2 Verificar que toggle no muestra divisas sin historial | `js/pages/dashboard.js` | 4.1 |

### Fase 5 — CSS Layout Bottom-Anchored
| Tarea | Archivos | Dependencias |
|-------|----------|--------------|
| 5.1 `.distribucion-card { display: flex; flex-direction: column; }` | `css/dashboard.css` | Fase 1 |
| 5.2 `.distribucion-dona-top { margin-bottom: auto; }` (dona) | `css/dashboard.css` | 5.1 |
| 5.3 `.distribucion-lista-bottom { margin-top: auto; display: flex; flex-direction: column; }` (lista+barras) | `css/dashboard.css` | 5.1 |
| 5.4 Aplicar clases en `actualizarDistribucion()`, `actualizarDistribucionActivos()`, `actualizarPatrimonioDivisa()` según `filas` | `js/pages/dashboard.js` | 5.1-5.3 |

### Fase 6 — Estados Vacíos, Carga y Error
| Tarea | Archivos | Dependencias |
|-------|----------|--------------|
| 6.1 Textos `tarjetaVacia()` específicos por tarjeta (Sección 3.5) | `js/pages/dashboard.js` | Fase 1-3 |
| 6.2 `catch` en cada `actualizarX()` de distribución + deudas → mensaje error específico + `card-error` | `js/pages/dashboard.js` | Fase 1-3 |
| 6.3 Verificar `limpiarEsqueletosDashboard()` no deja skeletons en distribución | `js/pages/dashboard.js` | Fase 1-3 |

### Fase 7 — Tests y Verificación
| Tarea | Archivos | Dependencias |
|-------|----------|--------------|
| 7.1 `tests/plantillas.test.mjs`: verificar `dashboard.html` ≡ `demo.html` templates | `tests/plantillas.test.mjs` | Fase 1-3 |
| 7.2 Tests dimensiones: `clampDimensionesDashboard` respeta nuevos `altoMin/altoMax` | `tests/dashboard.test.mjs` | Fase 0 |
| 7.3 Tests composiciones: `actualizarDistribucionActivos` renderiza 5 tipos fijos | `tests/dashboard.test.mjs` | Fase 2 |
| 7.4 Verificación visual navegador: 1×2 y 1×3 de 3 tarjetas distribución (responsive, alineación, sin scroll, dona centrada) | — | Fase 5 |

---

## 7. Resumen de Cambios Clave vs Estado Anterior

| Aspecto | Antes | Después (PO Aprobado) |
|---------|-------|----------------------|
| `patrimonio` alto | 1–3 | **1–2** |
| `distribucion` alto | 1–3 | **2–3** (sin 1×1, default 1×2) |
| `distribucion-activos` alto | 1–3 | **2–3** (sin 1×1, default 1×2) |
| `patrimonio-divisa` alto | 1–3 | **2–3** (sin 1×1, default 1×2) |
| `favoritos` alto | 1–3 | **2–3** (sin 1×1, default 1×2) |
| `deudas` alto | 1–3 | **1** (fijo 1×1) |
| `alertas` alto | 1–3 | **1** (fijo 1×1) |
| `gastos/ingresos/balance-periodo` alto | 1–2 | **1** (fijo 1×1) |
| `cuentas/inversiones/vencimientos` alto | 1–3 | **1–2** (máx 1×2) |
| `flujo-caja` | Existe | **Eliminada** |
| Divisas toggle Patrimonio | PEN/USD/USDT/EUR (cuentas activas) | **PEN/USD/EUR (historial completo, sin USDT, orden fijo)** |
| `distribucion-activos` tipos | Solo los que tiene usuario | **Todos los 5 tipos siempre (0% si no hay), orden fijo** |
| `patrimonio-divisa` valores | Convertidos | **Moneda original** |
| Deudas cálculo | `deudas` + `programados` tarjeta | **Solo `cuenta.deuda` tarjetas crédito** |
| Layout distribución | Variable | **Bottom-anchored, sin scroll, dona en espacio libre (1×3)** |
| Estados error | Genérico | **Específico por tarjeta** |
| Estados vacíos | Genéricos | **Copy específico por tarjeta** |

---

**Fin del documento.**  
Este contrato sustituye a `etapa8-contrato-dimensiones.md` y `etapa8-inventario-tarjetas.md` para la fase de implementación.  
**Todas las decisiones PO están cerradas. El plan de implementación (Sección 6) está listo para revisión y autorización.**