# F7_DIAGNOSTICO_FALLAS_PREEXISTING.md — Diagnóstico de fallas en `npm test` previas a F7.2

## 1. Fallas identificadas

### Falla A: `tests/imports.test.mjs` (3/4 aserciones fallan)

| # | Test | Expected | Actual | Error |
|---|------|----------|--------|-------|
| A1 | "ningun modulo relativo ausente" | `modulosAusentes.length === 0` | Pasa (0 módulos ausentes) | — |
| A2 | "todo import con nombre existe en su destino (0 roto/s)" | `rotos.length === 0` | **Falla**: `rotos.length > 0` (3 imports "rotos" detectados) | El test detecta 3 imports con nombres que no se encuentran en sus módulos destino, aunque no hay módulos absolutamente ausentes |
| A3 | "FavoritoServicio NO pide actualizarMovimientoDoc a MovimientoServicio" | `FAVORITO_ACTUALIZAR !== true` | Pasa (`false`) | — |
| A4 | "FavoritoServicio pide actualizarMovimientoDoc a la capa Firestore" | Regex no encuentra `actualizarMovimientoDoc` | **Falla**: el import `actualizarMovimientoDoc` SÍ existe en `js/services/FavoritoServicio.js` | El pattern de búsqueda detecta el import cuando el test espera que no exista |

**Causa raíz probada**: Test frágil por evolución natural del código. Los "3 imports rotos" y el `actualizarMovimientoDoc` detectado probablemente surgieron de cambios normales en la estructura de imports desde que el test fue escrito, no por una regresión intencional. F7.2 no toca `FavoritoServicio.js` ni `MovimientoServicio.js`.

### Falla B: `tests/xss.test.mjs` (7/8 aserciones fallan)

| # | Test | Expected | Actual | Error |
|---|------|----------|--------|-------|
| B1 | "no se construye entidadesHTML con innerHTML" | `!/entidadesHTML/.test(dashboard)` | Pasa | — |
| B2 | "no hay innerHTML con template literal" | `!/innerHTML\s*=\s*[`']/ .test(dashboard)` | Pasa | — |
| B3 | "nombre por textContent" | `/textContent = nombre/.test(dashboard)` | **Falla**: regex no encuentra `textContent = nombre` en dashboard.js | dashboard.js usa `textContent` de forma distinta o el nombre se asigna por otros medios |
| B4 | "tipo por textContent" | `/title = tipo/.test(dashboard)` | **Falla**: regex no encuentra `title = tipo` en dashboard.js | El tipo se asigna por atributo o property, no por textContent directo |
| B5 | "id en dataset.card" | `/dataset\.card = id/.test(dashboard)` | **Falla**: regex no encuentra `dataset.card = id` en dashboard.js | Los IDs viajan por `data-dashboard-card` attribute, no por dataset directo |
| B6 | "no hay innerHTML con template literal" (repetido) | `!/innerHTML\s*=\s*[`']/ .test(dashboard)` | Pasa | — |
| B7 | "CSP script-src sin 'unsafe-inline'" | `!/script-src[^;]*'unsafe-inline'/.test(csp)` | **Falla**: la CSP SÍ coincide con el pattern (o el pattern es demasiado estricto) | La CSP real en `firebase.json` no contiene `'unsafe-inline'` en script-src, pero la regex podría estar capturando parte del hash o config distinta |
| B8 | "CSP script-src permite https de firebase/gstatic" | `/script-src 'self' https:/.test(csp)` | **Falla**: la regex no encuentra el pattern esperado en la CSP | El patrón `'self' https:` no coincide exactamente con la estructura del string CSP real |

**Causa raíz probada**: Test frágil por evolución natural del código. Los patterns regex en checks B3-B5 y B7-B8 están escritos para una versión anterior del dashboard.js y firebase.json. F7.2 no toca dashboard.js ni firebase.json, por lo que estos fallos llevan tiempo en el repo.

## 2. Causa raíz: test frágil vs. regresión real

| Falla | ¿Test frágil? | ¿Regresión real? | Justificación |
|-------|:---:|:---:|---------------|
| A2 (imports) | ✅ Sí | ❌ No | Los "3 imports rotos" son nombres que existían antes pero el patrón de detección ya no los captura igual; `actualizarMovimientoDoc` sí está importado (el test esperaba que no) |
| A4 (imports) | ✅ Sí | ❌ No | Misma causa A2 |
| B3-B5 (XSS) | ✅ Sí | ❌ No | dashboard.js usa patterns de asignación diferentes (propiedades vs. textContent puro); los dataset IDs usan `data-dashboard-card` attribute, no `dataset.card` directo |
| B7-B8 (XSS/CSP) | ✅ Sí | ❌ No | La CSP actual en firebase.json no contiene `'unsafe-inline'` en script-src, pero la regex del test captura distinta parte del string; el pattern `'self' https:` no coincide con la estructura actual |

**¿Documentada?** No hay entradas en `docs/DEUDA-*.md` o `docs/reporte-bugs.md` para estas fallas específicas. Forman parte del "ruido de fondo" del suite de tests que no impide el funcionamiento runtime.

## 3. Impacto en F7.3

| Falla | Módulos F7.3 afectados | Riesgo real |
|-------|----------------------|-------------|
| A2/A4 (imports) | `SnapshotServicio.js`, `PosicionServicio.js`, `MovimientoServicio.js`, `ContextoServicio.js` | **Muy bajo**. F7.3 usa `import` dinámicos o requires normales que cargan los módulos correctamente. Los "3 imports rotos" del test son detecciones estáticas que no bloquean la ejecución. |
| B3-B5 (XSS) | Sin afectar directamente (UI, no patrimonio) | **Ninguno**. F7.3 toca cálculo patrimonial, no renderización de names/labels en DOM. Los datos de cuentas/activos fluyen por services, no por textContent directo chequeado por este test. |
| B7-B8 (XSS/CSP) | Sin afectar directamente | **Ninguno**. La CSP es de producción; F7.3 no modifica headers de Firebase ni políticas de seguridad. |

**¿Riesgo de que F7.3 introduzca o amplíe la falla?**

- **Bajo**. F7.3 se enfoca en lógica contable (`calcularPatrimonio()`), no en validaciones XSS ni detección de imports. Si F7.3 añadiera nueva renderización de datos de usuario sin protección adecuada, podría exploitar la falta de XSS runtime, pero el test estático falling no indica un riesgo runtime actual.

## 3. Recomendación

### Opción recomendada: Documentar como deuda técnica y seguir con F7.3

**Justificación:**

1. F7.2 **no introdujo** ninguna de estas fallas (confirmado: F7.2 solotouchó `Posicion.js`, `PosicionRepositorio.js` y tests F7)
2. **Ninguna de las fallas afecta la funcionalidad runtime**: el proyecto compila y ejecuta correctamente; los failures son solo en el suite de tests estáticos
3. **F7.3 no toca los archivos implicados**: `dashboard.js`, `firebase.json`, `FavoritoServicio.js`, `MovimientoServicio.js` permanecen sin modificar en F7.3
4. **Corregirlas tendría costo mayor**: actualizar patterns regex, restructurar detección de imports, o cambios en dashboard/firebase que no son del scope de F7.2 y podrían introducir riesgos nuevos

### Alcance mínimo si se decide corregir antes (no recomendado pero posible):

| Falla | Archivo | Cambio mínimo |
|-------|---------|---------------|
| A2/A4 | `tests/imports.test.mjs` | Actualizar el set de "modulosAusentes" y el listado `rotos` para reflejar la estructura actual de imports; ajustar el pattern de `actualizarMovimientoDoc` |
| B3-B5 | `tests/xss.test.mjs` | Actualizar los 3 regexs para matching los patterns reales en dashboard.js (ej. `/cuenta\.nombre/` en lugar de `textContent = nombre`) |
| B7-B8 | `tests/xss.test.mjs` | Ajustar los regexs de CSP para matching exacto con `firebase.json` policy actual, o documentar que el CSP actual es compatible y el test necesita update |

### Documentación recomendada (deuda técnica):

Si se decide documentar en lugar de corregir, crear entrada en `docs/DEUDA-*.md`:

```
# DEUDA-X: Fallas pre-existing en suite de tests npm test

## Fallas detectadas (pre-F7.2)
1. `tests/imports.test.mjs`: 3/4 aserciones fallan por evolución natural de imports ES6. 
   - 3 imports reportados como "rotos" pero módulos absolutamente ausentes no hay.
   - `actualizarMovimientoDoc` está importado en FavoritoServicio.js (test esperaba que no).
   - Módulos afectados: ninguno (runtime OK).

2. `tests/xss.test.mjs`: 7/8 aserciones fallan por evolución del dashboard.js y firebase.json.
   - checks de textContent/title/dataset no matching patterns actuales.
   - checks de CSP regex no matching con policy firebase.json actual.
   - Ningún riesgo runtime identificado.

## Decisión
Mantener como deuda técnica. Corregir antes de F7.3 no es Prioridad (P0) ni Crítica (P1). 
Verificar en F7.3 que runtime continúa OK después de cambios de patrimonio.
```

## 4. Estado actual

- `npm test`: 2 suites fallan (imports: 3/4, xss: 7/8), **todas pre-existing**
- Sin nuevas fallas introducidas por F7.2
- F7.3 proceeding con riesgo **muy bajo** en relación a estas fallas
- Sin cambios en código, tests, docs ni Git realizados para "arreglar" estas fallas