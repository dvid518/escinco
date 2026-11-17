# Etapa 8 — Contrato: Restricciones de dimensiones del dashboard

**Fase 0 — Preparación y Contratos Técnicos.**
Define la matriz de dimensiones permitidas por tarjeta, el eje de cada tarjeta, la regla de 3 filas, la normalización y el formato de persistencia. Solo describe el comportamiento; no modifica código de producción.

## 1. Matriz de dimensiones por tarjeta

Fuente: constante `DASHBOARD_DIMENSIONES` en `js/pages/dashboard.js`. `anchoMin/anchoMax` y `altoMin/altoMax` son los mínimos y máximos que el usuario puede elegir en el editor; `anchoDefault/altoDefault` es el valor cuando no hay preferencia guardada.

| Tarjeta | Eje | Columnas (ancho) | Filas (alto) | Default | Comentario |
|---------|-----|------------------|--------------|---------|------------|
| patrimonio | Y | 1 | 1 | 1×1 | Siempre visible, no se oculta. |
| distribucion | Y | 1 | 1–3 | 1×1 | **Sóla tarjeta que permite 3 filas** (requisito PO). |
| movimientos | Y | 1 | 1–3 | 1×2 | Con scroll. |
| metas | Y | 1 | 1–3 | 1×1 | |
| presupuestos | Y | 1 | 1–3 | 1×1 | |
| pendientes | Y | 1 | 1–3 | 1×1 | |
| favoritos | Y | 1 | 1–3 | 1×1 | |
| patrimonio-divisa | Y | 1 | 1–3 | 1×1 | |
| cuentas | Y | 1 | 1–2 | 1×1 | |
| inversiones | Y | 1 | 1–2 | 1×1 | |
| vencimientos | Y | 1 | 1–2 | 1×1 | |
| ingresos-periodo | Y | 1 | 1–2 | 1×1 | |
| gastos-periodo | Y | 1 | 1–2 | 1×1 | |
| balance-periodo | Y | 1 | 1–2 | 1×1 | |
| deudas | Y | 1 | 1–2 | 1×1 | |
| ordenes | Y | 1 | 1–2 | 1×1 | |
| estrategias | Y | 1 | 1–2 | 1×1 | |
| programados | Y | 1 | 1–2 | 1×1 | |
| alertas | Y | 1 | 1–2 | 1×1 | |
| flujo-caja | Y | 1 | 1–2 | 1×1 | |
| grafico | X | 1–2 | 2 (fijo) | 2×2 | Canvas de 200 px requiere alto fijo 2. |
| cuenta:\* / activo:\* | — | 1 | 1 | 1×1 | Instancias, no redimensionables. |

**Agrupación por secciones (PO Etapa 8):**
- **Cards:** tarjetas regulares del catálogo (movimientos, metas, presupuestos, etc.).
- **Cuentas:** instancias `cuenta:<id>`.
- **Activos:** instancias `activo:<id>`.

**Resto (cualquier tarjeta no listada arriba):** 1×1 / 1×2 (ancho 1, alto 1 o 2).

## 2. Eje por tarjeta

- **Eje Y (alto variable, ancho fijo 1):** la gran mayoría de tarjetas. El usuario elige el número de filas dentro del rango permitido.
- **Eje X (ancho variable, alto fijo 2):** solo `grafico` (`anchoMin 1`, `anchoMax 2`, `altoMin 2`, `altoMax 2`). El alto no es editable porque el canvas (200 px) debe caber en 2 filas.

## 3. Regla de 3 filas

**Solo `distribucion` puede tener 3 filas.** Ninguna otra tarjeta del catálogo puede establecer `filas: 3` en el editor.

> ⚠️ **Ambigüedad detectada para el PO:** la constante `DASHBOARD_DIMENSIONES` actual permite `altoMax: 3` en varias tarjetas además de `distribucion` (patrimonio, movimientos, metas, presupuestos, pendientes, favoritos, patrimonio-divisa). El requisito del PO ("solo Distribución con 3 filas") contradice el catálogo actual. ¿Se restringe el catálogo para que solo Distribución tenga altoMax 3, o se mantiene el catálogo y solo se limita en el editor de Distribución?

## 4. Normalización: `clampDimensionesDashboard`

`clampDimensionesDashboard(dimensiones)` valida las dimensiones guardadas contra la matriz `DASHBOARD_DIMENSIONES`:

- Lee el formato actual `{ columnas, filas }` y también el legado `{ ancho, alto }` (retrocompatibilidad).
- Instancias `cuenta:` y `activo:` se fuerzan a `{ columnas: 1, filas: 1 }` (no redimensionables).
- Para cada tarjeta del catálogo: `columnas = clamp(columnas, anchoMin, anchoMax)` y `filas = clamp(filas, altoMin, altoMax)`, usando `anchoDefault`/`altoDefault` cuando falta el valor.
- Tarjetas sin catálogo se dejan como están.
- **Solo afecta al valor en memoria; nunca modifica la preferencia guardada en Firestore.**

## 5. Persistencia en Firestore

El campo `dimensiones` dentro de `preferencias.dashboard` debe conservar el formato:

```js
{
  [id]: { columnas: <numero>, filas: <numero> }
}
```

- `guardarPreferenciasDashboard` escribe `dashboard.dimensiones` en Firestore (notación de punto) y lo refleja en la sesión.
- `cargarCardsVisiblesDashboard` / `configurarCardsDashboardDesdeSesión` leen `dashboard.dimensiones` y aplican `clampDimensionesDashboard`.
- `dimensionesCard(id)` devuelve `{ ancho, alto }` priorizando `cardsDimensionesDashboard[id]` sobre el catálogo.
