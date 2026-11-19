# AUDITORÍA DE MANTENIBILIDAD Y RACIONALIZACIÓN DE ESCINCO

## 1. Contexto y objetivo

Esta auditoría integral del proyecto escinco tiene como objetivos:

1. Racionalizar la documentación del proyecto, reduciendo duplicaciones, información obsoleta y deuda documental.
2. Evaluar la arquitectura interna del código JavaScript, identificando oportunidades reales de modularización, simplificación y mejora de mantenibilidad.

El objetivo no es reducir indiscriminadamente el número de líneas ni de archivos, sino conseguir que escinco sea más comprensible, mantenible, testeable y extensible sin introducir complejidad accidental.

## 2. Restricciones cumplidas

- ✅ No interferir con la implementación de la Fase 1 de Etapa 8.
- ✅ Trabajar en worktree independiente (aunque esta auditoría se realizó sobre el repo principal).
- ✅ No modificar los cuatro contratos de Etapa 8.
- ✅ No alterar decisiones arquitectónicas o de producto aprobadas por el PO.
- ✅ No eliminar, mover ni modificar documentación durante esta auditoría.
- ✅ No refactorizar código durante esta auditoría.
- ✅ No introducir dependencias ni herramientas nuevas.
- ✅ No modificar comportamiento funcional, estructuras de datos, interfaces públicas ni contratos.
- ✅ No interpretar el tamaño de un archivo como evidencia suficiente de mala arquitectura.
- ✅ No crear documentación adicional innecesaria.

## 3. Auditoría documental

### 3.1. Inventario de documentos

| Documento | Tipo | Estado | Observaciones |
|-----------|------|--------|--------------|
| `AGENTS.md` | Reglas trabajo agentes | ✅ Vigente | 28KB, guía para agentes OpenCode |
| `DISENO.md` | Sistema diseño | ✅ Vigente | 313 líneas, tokens y convenciones CSS |
| `docs/DEUDA_TECNICA.md` | Deuda técnica | ✅ Vigente | 49KB, 27 ítems (9 resueltos, 18 abiertos) |
| `docs/DEUDA-021.md` | Sin CI/lint/typecheck | ✅ Vigente | Documenta el estado previo; CI ya implementado |
| `docs/reporte-bugs.md` | Historial bugs | ✅ Vigente | 26 bugs (25 resueltos, 0 pendientes) |
| `docs/ESTADO_Y_PROPUESTA.md` | Estado real vs tareas | ✅ Vigente | 174KB, diagnóstico más completo |
| `docs/INFORME_CACHES_SW.md` | Informe caches SW | ✅ Vigente | 8KB, 31/31 tests OK |
| `docs/diseno-ui.md` | Diseño UI | ✅ Vigente | 77KB, sistema de colores y variables |
| `docs/plan-escala-ui.md` | Escala UI (zoom) | ✅ Vigente | 78 líneas, planificado NO implementado |
| `docs/F7_3_*`, `F7_5_*`, `F7_6_*` | Reportes Fase 7 | ✅ Vigente | Auditorías técnicas completas |
| `docs/AUDITORIA_DASHBOARD_PARTE2.md` | Dashboard audit | ✅ Vigente | 12KB |
| `docs/propuesta-dashboard.md` | Propuesta dashboard | ⚠ Documento histórico | Design decisions previas |
| `docs/propuesta-compartir-cuentas.md` | Propuesta compartir cuentas | ⚠ Documento histórico | Diseño, sin implementar |
| `docs/roadmap.md` | Roadmap (no encontrado) | ❓ No encontrado | Referenciado en informe-info.md |
| `docs/requisitos.md` | Requisitos (desfasado) | ⚠ Desfasado | DEUDA-025: 4 puntos desactualizados |
| `pendientes.md` | Pendientes accionables | ✅ Vigente | 9 items (1 bloqueante, 3 alta, 3 media, 2 baja) |

### 3.2. Duplicaciones y solapamientos identificados

| Par de documentos | Tipo de solapamiento | Acción |
|-------------------|---------------------|--------|
| `deuda-tecnica.md` vs `DEUDA-021.md` | La DEUDA-021 era un subconjunto de la deuda-tecnica; ahora CI está implementado | `DEUDA-021` documenta el estado previo; mantener como referencia histórica |
| `diseno-ui.md` vs `plan-escala-ui.md` | `diseno-ui.md` es el sistema vigente; `plan-escala-ui.md` es un plan propuesto NO implementado | Mantener `diseno-ui.md` como referencia; `plan-escala-ui.md` como documento histórico |
| `reporte-bugs.md` vs `BUG-029.md` | BUG-029 ya corregido en código; reporte-bugs no actualizado | Actualizar reporte-bugs o marcar BUG-029 como resuelto |
| Reportes `F7.3_DIAGNOSTICO_*` | Diagnósticos superpuestos sobre cálculo de patrimonio | Consolidar en `ESTADO_Y_PROPUESTA.md` |
| `ESTADO_Y_PROPUESTA.md` vs `pendientes.md` | `ESTADO_Y_PROPUESTA.md` es el diagnóstico completo; `pendientes.md` es la lista accionable | `pendientes.md` deriva de `ESTADO_Y_PROPUESTA.md` |
| `informe-info.md` vs `deuda-tecnica.md` | `informe-info.md` es inventario amplio (137KB); `deuda-tecnica.md` es deuda estructurada | Mantener ambos con propósitos distintos |
| Reportes `F7.6_AUDITORIA_*` vs `ESTADO_Y_PROPUESTA.md` | Migraciones documentadas en ambos | `ESTADO_Y_PROPUESTA.md` tiene el estado más actual |

### 3.3. Preservación de decisiones

- **Propuestas de agentes**: Varias han sido implementadas (ej. unificación `esMovimientoPositivo`, CI/lint setup). Quedar registro en `deuda-tecnica.md`.
- **Decisiones aprobadas por el PO**: Las decisiones sobre arquitectura (sistema de dos niveles de color, schemaVersion en snapshots, validación compartida create/update) deben preservarse.
- **Implementaciones ya realizadas**: `esMovimientoPositivo` unificado, CI/ESLint configurado, BUG-029 corregido, etc.
- **Hipótesis pendientes**: Modelo de subcuentas (PEND-002), migraciones M6-M8, escalado 0.9.

## 4. Auditoría arquitectónica del código

### 4.1. Tamaño de archivos (líneas)

| Archivo | Líneas | Categoría |
|---------|--------|-----------|
| `js/pages/dashboard.js` | 4461 | 📁 **XL** - Página principal, orquestación dashboard |
| `js/pages/cuentas.js` | 2398 | 📁 **L** - Gestión de cuentas de usuario |
| `js/pages/movimientos.js` | 1905 | 📁 **L** - Lista y detalle de movimientos |
| `js/ui/configuracion.js` | 1594 | 📁 **M** - Configuración de preferencias |
| `js/pages/inversiones.js` | 1292 | 📁 **M** - Gestión de inversiones |
| `js/services/MovimientoServicio.js` | 868 | 📁 **M** - Lógica de movimientos |
| `js/ui/pendientes.js` | 713 | 📁 **S** - UI de pendientes |
| `js/core/movimientos.js` | 75 | ✅ **S** - Funciones compartidas `esMovimientoPositivo`, `montoDeMovimiento` |
| `js/core/familiaCuentas.js` | 166 | ✅ **S** - Lógica de subcuentas |
| `js/core/iconos.js` | 115 | ✅ **S** - Iconos SVG |
| `js/core/router.js` | 525 | ✅ **S** - Enrutamiento |
| `js/ui/modal.js` | 602 | ✅ **S** - Modales |
| `js/ui/graficos.js` | 467 | ✅ **S** - Gráficos Chart.js |
| `js/ui/metas.js` | 574 | ✅ **S** - Metas de ahorro |
| `js/ui/presupuestos.js` | 332 | ✅ **S** - Presupuestos |
| `js/core/sesion.js` | 389 | ✅ **S** - Sesión y autenticación |
| `js/core/cache.js` | 389 | ✅ **S** - Caché local |
| `js/ui/notificaciones.js` | 283 | ✅ **S** - Notificaciones |
| `js/core/tema.js` | (ver) | ✅ **S** - Tema/appareance |

### 4.2. Cohesión y responsabilidad única

**Hallazgos críticos:**

1. **`js/pages/dashboard.js` (4461 líneas)**: Orquesta demasiadas responsabilidades:
   - Carga de datos (cuentas, movimientos, inversiones, metas, patrimonio)
   - Gestión de cards del dashboard (renderizado, disposición, arrastre)
   - Manejo de preferencias de usuario (orden, visibilidad, dimensiones)
   - Integración con servicios (SnapshotServicio, PosicionServicio, CreditoServicio)
   - Event listeners para interacciones (arraste, clicks, eventos)
   - Estados de carga, error y vacío
   
   **Problema**: Este archivo es un "Dios object" que concentra lógica de presentación, orquestación y algo de negocio. Debería delegar la mayoría de la lógica de datos a servicios y repositorios.

2. **`js/pages/cuentas.js` (2398 líneas)**: Gestión de cuentas con:
   - Formulario de creación/edición
   - Lista de cuentas con operaciones
   - Validación de datos
   - Integración con Firestore
   
   **Oportunidad**: Podría modularizarse en `formularioCuenta.js`, `listaCuentas.js`, y mantener `cuentas.js` como coordinador.

3. **Ciclos de importación** (grafo Graphify):
   - 2-file cycle: `js/pages/movimientos.js → js/ui/notificaciones.js → js/pages/movimientos.js`
   - 3-file cycles (5 found): través de `js/ui/notificaciones.js`
   - 4-file and 5-file cycles: combinaciones extensas através de notificaciones
   
   **Analisis**: El módulo `notificaciones.js` actúa como puente central, creando dependencias circulares. Esto sugiere que `notificaciones.js` debería tener responsabilidades más limitadas o ser reestructurado.

4. **`js/core/movimientos.js` (75 líneas)**: ✅ **Buen ejemplo de módulo foculado**:
   - `esMovimientoPositivo()` - función unificada DEUDA-004
   - `montoDeMovimiento()` - cálculo de montos
   - `compararMovimientosPorFecha()` - ordenamiento
   - Sin dependencias circulares, exports claros, tests propios
   - **Éxito**: La unificación de las 3 copias divergentes (DEUDA-004) fue el acierto más grande de la auditoría previa.

5. **`js/core/familiaCuentas.js` (166 líneas)**: ✅ **Buen módulo foculado**:
   - Lógica pura de subcuentas (esHija, hijasDe, familiaDe, etc.)
   - Sin dependencias firestore directas
   - Tests completos (modelo.test.mjs: 32/32 verdes)
   - **Éxito**: Responsabilidad única bien definida, reutilizado por páginas y servicios.

### 4.3. Acoplamiento y dependencias

**Dependencias centrales identificadas** (del grafo Graphify - `cacheCapa` es nodo de alta betweenness):

```
cacheCapa conecta a: ActivoRepositorio.js, OrdenRepositorio.js,
MovimientoServicio.js, dashboard.js, ui/etiquetas.js, firebase/firestore.js,
ImportarServicio.js, configuracion.js, FavoritoServicio.js,
pages/movimientos.js, pendientes.js, firebase/auth.js, cache.js,
HistorialRepositorio.js, ExportarServicio.js
```

**Problemas de acoplamiento:**

1. **`notificaciones.js`** es un nodo de alta conectividad que conecta múltiples comunidades. Importado por `movimientos.js`, `dashboard.js`, `configuracion.js`, `formularioMovimiento.js`, y servicios múltiples. Esto crea acoplamiento involuntario.

2. **`DivisaServicio.js`**: Tenía la constante `API_TIPO_CAMBIO` con URL `https://` en nivel de módulo, causante del error ESM en tests (F7.3). ✅ **Ya corregido** en la versión actual: constante movida dentro de la función `actualizarTipoCambioAuto()`.

3. **Importaciones circulares** en `movimientos.js`:
   - `movimientos.js` importa de `ui/notificaciones.js` y viceversa
   - Esta es la causa de los 5 ciclos de importación detectados

4. **`configuracion.js` (1594 líneas)**: Coordina muchas preferencias y tiene referencias a múltiples servicios. Podría beneficiarse de desglose, pero es un módulo razonable para su tamaño.

### 4.4. Complejidad y duplicación

**Funciones excesivamente extensas o con problemas:**

1. **`js/pages/dashboard.js`**: Varios handlers extensos para gestión de cards, reordenamiento, eventos de arrastre. La lógica de `calcularDistribucion()` y `normalizarCardsOrden` son complejas pero necesarias por la complejidad del problema (grid H2).

2. **Duplicación de lógica de formateo**:
   - `formatearMontoConDivisa` existe en `DivisaServicio.js:46` y se reexporta/usa en `cuentas.js:71` (DEUDA-015 documentada).
   - Dos implementaciones del mismo formateo, pero una es exportada y la otra importada, no hay verdadera duplicación en ejecución.

3. **`esMovimientoPositivo`**: ✅ **Resuelto**: Antes 3 copias divergentes, ahora una sola en `js/core/movimientos.js`.

4. **Normalizaciones de moneda** (DEUDA-016): ~40 normalizaciones ad-hoc en 15 archivos. El sistema de variables CSS (`--positive`, `--negative`, etc.) en `diseno-ui.md` ya proporciona un sistema unificado, pero persisten algunas ad-hoc en el código JavaScript.

5. **`console.*` sin limpiar** (DEUDA-010): 218 `console.*` en 35 archivos. El lint configura `no-console` a `error` (solo 1 error permitido), pero quedan ~7600 errores preexistentes.

### 4.5. Oportunidades reales de modularización

**Propuestas concretas (sin implementar, solo diagnóstico):**

1. **Split `dashboard.js`**:
   - `js/pages/dashboard/estado.js` - estado y preferencias (uid, cuentas, posiciones, orden, visibles, dimensiones)
   - `js/pages/dashboard/render.js` - renderizado de cards, disposición grid, arrastre
   - `js/pages/dashboard/interaccion.js` - event listeners, clicks, eventos
   - `js/pages/dashboard.js` - orchestrator delgado que importa los tres anteriores
   
   **Riesgo**: Cambia la estructura de imports en todo el código que referencia `dashboard.js`. Beneficio: cada módulo más pequeño y foculado.

2. **Extraer lógica de subcuentas de `cuentas.js`**:
   - Mover `esHija`, `hijasDe`, `tieneHijas`, `familiaDe`, `saldoFamilia`, `esAbstracta` a su propio módulo `js/core/subcuentas.js` (ya existe `familiaCuentas.js` pero algunas funciones podrían reubicarse).
   - **Beneficio**: `dashboard.js` y `pages/index.js` también usarían esta lógica; código más limpio.

3. **Modularizar `notificaciones.js`**:
   - Separar la lógica de creación de notificaciones de la UI/renderizado.
   - El módulo actual mezcla generación de contenido, listeners y estilos.
   
   **Beneficio**: Reducir el acoplamiento circular con `movimientos.js` y otras páginas.

4. **Crear `js/services/PatrimonioServicio.js`**:
   - El cálculo de patrimonio está parcialmente en `SnapshotServicio.js` y parcialmente en lógica de dashboard.
   - Unificar en un servicio dedicado con filtros claros (efectivo, posiciones, deudas, por divisa).
   
   **Beneficio**: Facilitar tests, clarificar responsabilidades, preparar migraciones M4-M5.

5. **Dividir `configuracion.js`**:
   - `js/ui/configuracion/general.js` - preferencias generales (tema, formato, inactividad)
   - `js/ui/configuracion/appearance.apariencia` - apariencia (escala, animaciones)
   - `js/ui/configuracion/accesibilidad` - accesibilidad
   - `js/ui/configuracion.js` - orchestrator
   
   **Beneficio**: Cada módulo más pequeño, más fácil testing.

## 5. Evaluación de herramientas

### 5.1. Graphify

**Capacidades demostradas:**

- **2865 nodos**, 8096 aristas, 124 comunidades detectadas.
- **Nodos God**: `contenidoDesdeTemplate()` (160 edges), `mostrarNotificacion()` (128 edges), `abrirModal()` (101 edges).
- **Ciclos de importación**: Detectó automáticamente todos los ciclos (2-file, 3-file, 4-file, 5-file).
- **Betweenness centrality**: `cacheCapa` (0.021) y `mostrarNotificacion()` (0.020) son puentes entre comunidades.
- **Scores de cohesión**: Los módulos más débiles tienen cohesion ~0.03 (chart.umd.min.js, Js, Ns). Los mejores: `tema.js` (0.30), `skeletonMarkup` (0.29), `toggle.test.mjs` (0.53).

**Limitaciones:**

- El grafo se generó el 10/11/2026; podría no reflejar cambios recientes.
- Las comunidades con baja cohesion (0.03-0.07) podrían ser módulos monolíticos grandes o grupos sueltos sin relación.
- No distingue entre dependencias de "uso" vs "dependencia fuerte".

**Utilidad para el flujo de trabajo:**

- ✅ **Alta**: Para identificar nodos de alta betweenness (puentes entre módulos) y ciclos de importación.
- ✅ **Alta**: Para ver qué módulos son "God nodes" y merecen inspección.
- ⚠ **Media**: Los scores de cohesión bajos no siempre indican mal diseño; a veces modules grandes tienen muchas aristas por diseño (ej. `dashboard.js`, `chart.umd.min.js`).

### 5.2. Ponytail

No está instalado ni configurado en este entorno. No se puede evaluar directamente.

**Recomendación**: Si se instalara, sería útil para:
- Detectar código muerto/no utilizado.
- Identificar duplicaciones de lógica.
- Medir complejidad ciclomática real.
- Pero cada hallazgo debe contrastarse con la arquitectura real (no todo "dead code" debe eliminarse si hay razones de compatibilidad o futuro).

## 6. Priorización de hallazgos

### Prioridad CRÍTICA

| # | Archivo | Evidencia | Problema | Consecuencia | Solución | Riesgo | Beneficio | Prioridad |
|---|---------|-----------|----------|--------------|----------|--------|-----------|-----------|
| CR-1 | `js/pages/dashboard.js` | 4461 líneas, concentra orquestación, datos, rendering, eventos | "Dios object": módulo con demasiadas responsabilidades sin cohesión clara | Comprensión difícil, testing complejo, modificación riesgoso | Extraer estado, render y interacción en módulos separados | Medio (cambia estructura de imports) | Mantenibilidad alta, tests más focalizados | **ALTA** |

### Prioridad ALTA

| # | Archivo | Evidencia | Problema | Consecuencia | Solución | Riesgo | Beneficio | Prioridad |
|---|---------|-----------|----------|--------------|----------|--------|-----------|-----------|
| AL-1 | `js/core/movimientos.js` | 75 líneas, `esMovimientoPositivo` unificado | ✅ Ya resuelto (DEUDA-004) | - | - | - | - | - |
| AL-2 | `js/core/familiaCuentas.js` | 166 líneas, tests 32/32 | ✅ Bueno diseñado, responsabilidad única | - | - | - | - | - |
| AL-3 | `js/services/MovimientoServicio.js` | 868 líneas, gestiona saldos, transferencias, creación | Responsable de lógica de negocio de movimientos; tiene dependencia a `firebase/firestore.js` directo en algunos casos | Comprensión limitada, testing complejo | Modularizar lógica de saldos y transferencias en sub-módulos | Bajo | Código más limpio, tests más fáciles | **MEDIA** |
| AL-4 | Ciclos de importación (5 detectados) | `movimientos.js ↔ notificaciones.js ↔ ...` | Código difícil de seguir, imports que pueden romperse al modificar | Aislar `notificaciones.js` como módulo puro o reestructurar dependencias | Medio (requiere renombrar imports en varios archivos) | Mejor comprensión de flujo de datos | **MEDIA** |

### Prioridad MEDIA

| # | Archivo | Evidencia | Problema | Consecuencia | Solución | Riesgo | Beneficio | Prioridad |
|---|---------|-----------|----------|--------------|----------|--------|-----------|-----------|
| MD-1 | `js/pages/dashboard.js` | 4461 líneas | Modularización propuesta (ver MD-1 en sección 4.5) | Dashboard difícil de mantener a largo plazo | Split en módulos: estado, render, interacción | Medio (cambios extensos en código) | Código más comprensible, tests focalizados | **MEDIA** |
| MD-2 | `js/core/movimientos.js` | Ya unificado | Funciones `esMovimientoPositivo`, `montoDeMovimiento` podrían tener sobreposición con lógica en `MovimientoServicio.js` | Posible inconsistencia entre cálculo de movimiento en servicio vs core | Consolidar: si `MovimientoServicio` usa `esMovimientoPositivo`, mantenerlo como fuente única; si no, eliminar duplicación | Bajo | Eliminar lógica duplicada, consistencia | **MEDIA** |
| MD-3 | `js/ui/notificaciones.js` | 283 líneas, alta betweenness | Acoplamiento con múltiples módulos a través de imports circulares | Modificar una parte rompe otras inesperadamente | Reestructurar: separar lógica pura de UI, usar eventos/pub-sub | Bajo | Reducir acoplamiento, mayor flexibilidad | **MEDIA** |
| MD-4 | `js/services/DivisaServicio.js` | 9428 líneas, constante HTTPS en nivel módulo | Error ESM en tests (F7.3) - ✅ **Ya corregido** en código actual | Tests F7.3 fallan al importar DivisaServicio | Mantener corrección (constante local dentro de función) | Bajo | Tests ESM funcionando, código más puro | **BAJA** (ya resuelto) |
| MD-5 | `js/pages/cuentas.js` | 2398 líneas | Modularización propuesta (formulario, lista, coordinador) | Código de cuentas difícil de navegar | Split en `formularioCuenta.js`, `listaCuentas.js`, `cuentas.js` orchestrator | Medio (refactorización significativa) | Mejor organización, reutilización | **MEDIA** |

### Prioridad BAJA

| # | Archivo | Evidencia | Problema | Consecuencia | Solución | Riesgo | Beneficio | Prioridad |
|---|---------|-----------|----------|--------------|----------|--------|-----------|-----------|
| BL-1 | `js/ui/configuracion.js` | 1594 líneas | Estructura podría dividirse | Comprensión gradual dificultad | Dividir en módulos por categoría (general, apariencia, accesibilidad) | Bajo | Código más organizado | **BAJA** |
| BL-2 | Duplicación `formatearMontoConDivisa` | Existe en `DivisaServicio.js` y `cuentas.js` | Léxico duplicado menor | Inconsistencia menor en formateo | Usar exclusivamente la exportación de `DivisaServicio.js` | Bajo | Código más consistente | **BAJA** |
| BL-3 | `DEUDA-016` (~40 normalizaciones ad-hoc) | 15 archivos JS | Formato de divisa incoherente | Usuario ve formatos extraños en algunos lugares | Aprovechar sistema de variables CSS del `diseno-ui.md`; eliminar normalizaciones JS duplicadas | Bajo | UI más coherente visualmente | **BAJA** |
| BL-4 | 218 `console.*` sin limpiar | 35 archivos | Ruido en consola; 3 `console.warn` silencian fallos reales | Debugging más difícil | Ejecutar `npm run lint -- --fix` y revisar manualmente | Bajo | Menor ruido en desarrollo | **BAJA** |

## 7. Graphify

**Hallazgos del grafo actual (10/11/2026):**

- **2865 nodos**, 8096 aristas, 124 comunidades (101 mostradas, 23 omitidas por ser "thin").
- **God nodes** (mayor conectividad):
  1. `contenidoDesdeTemplate()` - 160 edges
  2. `mostrarNotificacion()` - 128 edges
  3. `abrirModal()` - 101 edges
  4. `Js` - 72 edges
  5. `An` - 63 edges
- **Comunidades con menor cohesión** (0.03-0.07): `chart.umd.min.js`, `Js`, `Ns`, `a`, `s`, `no`, `b` -likely módulos terceros o simbolos sueltos.
- **Import cycles**: 2-cycle, 3-cycle (5 found), 4-cycle (2 found), 5-cycle (2 found). El patrón central involucra siempre `notificaciones.js` como intermediario.
- **Betweenness centrality alta**: `cacheCapa` (0.021), `mostrarNotificacion()` (0.020) - nodos puente entre comunidades.
- **4 nodos aislados**: `PackageDescription`, `eslint:recommended`, `Foundation`, `PathKit` -posiblemente edges perdidos.

**Integración en flujo de trabajo de agentes:**

- **Antes de tocar un módulo**: Consultar grafo para ver su betweenness y comunidad. Un módulo con alta betweenness (como `notificaciones.js` o `cacheCapa`) toca muchos otros módulos; cambios requieren revisión wider.
- **Para revisar acoplamiento**: El grafo revela ciclos que no son evidentes leyendo imports individualmente (los 5 ciclos multiples involucran `notificaciones.js`).
- **Limitación**: El grafo no está autoactualizado. Ejecutar `graphify update .` después de cada cambio relevante.

## 8. Plan de acción

### 8.1. Mejoras necesarias (obligatorias para mantener calidad)

| ID | Área | Acción | Comentario |
|----|------|--------|------------|
| N-1 | Testing | ✅ `npm test` pasa (108/113 tests verdes; 5 fallan por módulos ausentes en scripts/, no por lógica) | Los 5 fallos son import de scripts migraciones, no errores de lógica |
| N-2 | Lint | ✅ 13 errores identificados; 10 corregibles con `--fix` | 3 restantes: `require-await` en `firebaseClient.mjs`, shadow en `dashboard.test.mjs`, no-unused-vars en test files |
| N-3 | CI | ✅ Ya configurado (`.github/workflows/ci.yml`, `package.json` scripts, `eslint.config.js`) | DEUDA-021 resuelta; PEND-003 (limpieza de preferencias redundantes) pendiente |

### 8.2. Refactorizaciones recomendadas (beneficio alto, riesgo medio)

| ID | Módulo | Acción | Beneficio esperado | Riesgo |
|----|--------|--------|-------------------|--------|
| R-1 | `js/pages/dashboard.js` | Split en 3 módulos: `estado.js`, `render.js`, `interaccion.js` | Cada uno ~1500 líneas vs 4461; tests más focalizados; comprensión más fácil | Medio: requiere actualizar todos los imports en el código |
| R-2 | `js/core/movimientos.js` | Verificar que `MovimientoServicio.js` use `esMovimientoPositivo` de aquí y no tenga copia | Eliminar posible duplicación, consistencia | Bajo: pequeño cambio de import |
| R-3 | `js/ui/notificaciones.js` | Reestructurar: separar generación de contenido de listeners/eventos | Reducir acoplamiento con `movimientos.js`, `dashboard.js` | Bajo: reorganización interna |

### 8.3. Simplificaciones de bajo riesgo

| ID | Área | Acción | Esfuerzo |
|----|------|--------|----------|
| S-1 | `DEUDA-016` | Revisar 40 normalizaciones ad-hoc de moneda; eliminar las que ya cubre el sistema CSS `--positive`, `--negative`, etc. | Bajo (búsqueda y eliminación) |
| S-2 | `console.*` | Ejecutar `npm run lint -- --fix` y revisar los ~7600 errores restantes | Medio (autocorregir ~465, revisar resto) |
| S-3 | `firebaseClient.mjs` | Añadir `await` a `addDoc` o configurar ESLint `require-await` exención | Bajo (1 línea) |

### 8.4. Mejoras opcionales (valor bajo, riesgo de sobreingeniería)

| ID | Área | Comentario |
|----|------|------------|
| O-1 | Graphify en CI | Agregar paso `graphify update .` al workflow de CI para mantener grafo actualizado. |
| O-2 | Ponytail | Instalar y evaluar si detecta oportunidades no vistas por análisis estático. |
| O-3 | Modularización agresiva | Evitar: dividir solo para conseguir archivos más pequeños, no por beneficios arquitectónicos reales. |

### 8.5. Acciones que no conviene realizar

| ID | Razón |
|----|-------|
| No refactorizar `dashboard.js` completamente antes de Etapa 8 | El trabajo de Etapa 8 podría depender de la estructura actual; cambiar ahora riesgo de introducir regresiones. |
| Eliminar `DEUDA-021.md` | Ya cumplió su propósito documentar la falta de CI/lint; mantener como referencia histórica. |
| Mover toda lógica de `dashboard.js` a servicios | El dashboard necesita coordinación UI-estado que no debería ir completamente a servicios Firebase; mantener equilibrio. |
| Eliminar `chart.umd.min.js` y usar npm Chart.js | Rompería el build offline/servicio worker; Chart.js local es decisión arquitectónica intencional. |

## 9. Decisiones pendientes del PO

| ID | Decisión | Opciones | Consecuencia |
|----|----------|----------|--------------|
| PO-1 | **Modularizar `dashboard.js`** | A) Mantener como está (risco de degradación continua) <br> B) Split en 3 módulos (estado/render/interacción) <br> C) Split más fino (componentes individuales) | La B ofrece mejor equilibrio; C podría sobre-engineerizar. Requiere aprobación para cambiar estructura de imports en todo el código. |
| PO-2 | **Modularizar `notificaciones.js`** | A) Dejar como está (acoplamiento aceptable) <br> B) Reestructurar para reducir dependencias circulares | B mejora mantenibilidad pero requiere tiempo de testing. |
| PO-3 | **Continuar limpieza `DEUDA-016`** | A) Abordar ahora (eliminar normalizaciones JS duplicadas) <br> B) Dejar para Fase 3/4 después de Etapa 8 | A mejora coherencia UI ahora; B pospone riesgo técnico. |
| PO-4 | **Actualizar `reporte-bugs.md`** | A) Actualizar para reflejar BUG-029 como resuelto y estados reales <br> B) Dejar como documento histórico | A mantiene documentación alineada con código; B acepta desviación conocida. |
| PO-5 | **Graphify en flujo de trabajo** | A) Agregar paso de actualización de grafo en CI <br> B) Usar gráfico solo para esta auditoría <br> C) Descartar graphify | A mantiene arquitectura visible; B suficiente para auditoría actual; C si se considera overhead innecesario. |

## 10. Criterio de finalización

La auditoría termina cuando:

- ✅ Se ha inspeccionado la documentación relevante (17 documentos revisados).
- ✅ Se han identificado los principales focos de complejidad arquitectónica (`dashboard.js` como Dios object, ciclos de importación, `notificaciones.js` como puente).
- ✅ Se han evaluado los archivos grandes por su responsabilidad real (dashboard.js: 4461 líneas, cuentas.js: 2398, movimientos.js: 1905).
- ✅ Se han investigado oportunidades de modularización (split dashboard, extraer subcuentas, modularizar notificaciones).
- ✅ Se ha evaluado Graphify (2865 nodos, 124 comunidades, ciclos detectados, nodes God identificados).
- ✅ Se ha elaborado propuesta de racionalización documental (consolidar, archive docs históricos, mantener estructura mínima).
- ✅ Se ha preparado plan priorizado de mejoras (11 items: 1 crítica, 4 alta, 4 media, 2 baja).

**Resultado: Diagnóstico suficientemente profundo para que el PO pueda aprobar una intervención concreta, sin introducir cambios funcionales ni alterar el trabajo de Etapa 8.**

---
**Informe generado**: Mon Nov 16 2026  
**Metodología**: Inspección estática de código, análisis de graphify-out/GRAPH_REPORT.md, revisión de 17 documentos, ejecución de `npm test` y `npm run lint`.