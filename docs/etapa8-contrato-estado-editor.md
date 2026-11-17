# Etapa 8 — Contrato: Estado temporal del editor de dashboard

**Fase 0 — Preparación y Contratos Técnicos.**
Este documento define el contrato del estado local (temporal) del editor de cards del dashboard. Solo describe el comportamiento; no modifica código de producción.

## 1. Estructura de `editorState`

El editor opera sobre una copia local del estado global para que los cambios no se persistan hasta que el usuario pulse **Guardar**.

| Campo | Tipo | Origen (al abrir el editor) | Descripción |
|-------|------|-----------------------------|-------------|
| `ordenModal` | `string[]` | `[...cardsOrdenDashboard]` | Orden COMPLETO de cards (visibles y ocultas), siempre con Patrimonio primero. No se modifica al ocultar/mostrar tarjetas. |
| `visiblesModal` | `Set<string>` | `new Set(cardsVisiblesDashboard)` | IDs de cards visibles en esta apertura del editor. |
| `dimensionesModal` | `Object` | `{ ...cardsDimensionesDashboard }` | `{ [id]: { columnas, filas } }` dimensiones elegidas en esta apertura. |
| `estadoInicial` | `Object` | copia de `editorState` al abrir | Snapshot completo (`ordenModal`, `visiblesModal`, `dimensionesModal`) tomado en el momento de abrir el editor. Sirve de referencia para detectar cambios sin depender de un booleano. |

> Nota de implementación actual: `dashboard.js` no guarda un `estadoInicial` objeto; usa el booleano `cambiosPendientesDashboard` y, al cancelar, lo restaura desde `cambiosPendientesAntesModal`. El contrato de Fase 0 establece que la detección de cambios debe hacerse comparando `editorState` actual contra `estadoInicial`, sin un booleano que pueda desincronizarse.

## 2. Detección de cambios

Hay cambio pendiente si, en cualquier momento tras abrir el editor:

- `ordenModal` difiere de `estadoInicial.ordenModal` (misma secuencia de IDs), o
- `visiblesModal` difiere de `estadoInicial.visiblesModal` (mismos IDs), o
- `dimensionesModal` difiere de `estadoInicial.dimensionesModal` (mismo `{ columnas, filas }` por id).

No se usará un booleano único (`cambiosPendientes`) como única fuente de verdad, porque puede desincronizarse del estado real tras un Restablecer o un Cancelar.

## 3. Flujo del editor

```
Abrir  →  Modificar  →  Guardar (persistir)
                 ↳ Cancelar (descartar, no persiste)
                 ↳ Restablecer (valores por defecto, no persiste hasta Guardar)
```

1. **Abrir:** `abrirEditorDashboard()` activa el modo edición y `abrirSelectorCardsDashboard()` construye `ordenModal`, `visiblesModal`, `dimensionesModal` a partir del estado global y captura `estadoInicial`. Nada se escribe en Firestore aún.
2. **Modificar:** el usuario alterna visibilidad (card/pill), ajusta dimensiones (toggle-group) y reordena (drag & drop). Cada interacción marca cambio pendiente y vuelve a renderizar el esqueleto del modal.
3. **Guardar:** `onConfirm` llama a `guardarPreferenciasDashboard({ cardsVisibles, orden, dimensiones })`. Solo tras confirmar la persistencia en Firestore se actualizan los globales `cardsVisiblesDashboard`, `cardsOrdenDashboard`, `cardsDimensionesDashboard` y se resetea `cambiosPendientesDashboard = false`. Si falla, se conserva el estado anterior y el modal permanece abierto.
4. **Cancelar:** `onCancel` descarta los cambios locales (restaura el flag de cambios pendientes al valor previo al abrir) y no persiste nada.
5. **Restablecer:** botón `[data-dashboard-reset]` devuelve `ordenModal` al orden completo (Patrimonio primero), `visiblesModal` a `DEFAULT_CARDS_VISIBLES` y `dimensionesModal` a `{}`. No persiste hasta Guardar.

## 4. Toggle del botón "Editar Dashboard"

- Entrada `editar-dashboard` (lastbar) → `abrirEditorDashboard()` → `activarModoEdicionDashboard()`.
- Botón `dashboard-abrir-cards` (barra de edición) → activa modo edición y abre el selector de cards.
- Botón `dashboard-listo` (barra de edición) → `guardarYSalirEdicionDashboard()`: guarda si hay cambios pendientes y sale del modo edición.
- Tecla **Escape** (sin modal abierto): si hay cambios pendientes o se pulsa Enter, guarda y sale; si no, `salirModoEdicionDashboard()`.
- Tecla **Enter**: guarda y sale.

**Contrato de toggle (Fase 0):** si el modo edición ya está activo y el usuario vuelve a pulsar "Editar Dashboard", el comportamiento esperado es **salir del modo edición** (`salirModoEdicionDashboard()`), no volver a activarlo. La implementación actual (`activarModoEdicionDashboard`) es idempotente (siempre activa). Esta discrepancia es una ambigüedad a confirmar con el PO.

## 5. Archivos relacionados

- `js/pages/dashboard.js`: `abrirSelectorCardsDashboard`, `activarModoEdicionDashboard`, `salirModoEdicionDashboard`, `guardarYSalirEdicionDashboard`, `guardarOrdenDashboard`, `abrirEditorDashboard`, `manejarTeclaEdicionDashboard`, `configurarEdicionDashboard`.
- `js/core/lastbar.js`: acción `"editar-dashboard"`.
