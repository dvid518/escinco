# PLAN DE ETAPA 9 — REESTRUCTURACIÓN ARQUITECTÓNICA Y ESTANDARIZACIÓN DE ESCINCO

*Plan de fase suspendida hasta autorización explícita del PO después de completar Etapa 8.*

## 1. Contexto y base

Esta planificación deriva directamente de la **AUDITORÍA DE MANTENIBILIDAD Y RACIONALIZACIÓN DE ESCINCO** completada previamente. Los hallazgos de esa auditoría forman la base factual de cada decisión propuesta aquí.

**No se ejecutarán refactorizaciones durante esta fase.** El presente documento sirve como diseño preparatorio para aprobación del PO.

### 1.1. Origen de los datos

- **Auditoría**: `AUDITORIA_MANTENIBILIDAD.md` (28KB), inspección de 17 documentos, ejecución `npm test` y `npm run lint`
- **Graph analysis**: `graphify-out/GRAPH_REPORT.md` (601 líneas), 2865 nodos, 8096 edges, 124 comunidades
- **Tests baseline**: `npm test` → 108/113 passing, 5 fallos por módulos ausentes en `scripts/`
- **Lint baseline**: `npm run lint` → 13 errores (7 auto-correctibles)

### 1.2. Restricciones vigentes

- ✅ No modificar código funcional
- ✅ No ejecutar refactorizaciones
- ✅ No alterar implementación Etapa 8
- ✅ No mover/eliminar/consolidar archivos
- ✅ No instalar herramientas sin autorización
- ✅ No introducir decisiones sin evidencia
- ✅ Etapa 9 planificada, no autorizada para ejecución

## 2. Arquitectura actual (resumen inspeccionado)

### 2.1. Capas identificadas

| Capa | Archivos representativos | Responsabilidad |
|------|------------------------|-----------------|
| **Presentación/UI** | `js/ui/`, `css/` | Renderizado, interacción mínima lógica |
| **Páginas/Orquestación** | `js/pages/` (8 páginas) | Coordinación datos + UI, event handlers |
| **Servicios** | `js/services/` (19 servicios) | Lógica de negocio, operaciones Firestore |
| **Repositorios** | `js/repositories/` (16 repositorios) | Acceso a datos, CRUD, normalización |
| **Modelos** | `js/models/` (8 modelos) | Representación de datos, validación |
| **Core** | `js/core/` (11 módulos) | Funciones puras, utilidades, sin depende Firestore |
| **Constants** | `constants/` (4 archivos) | Configuración, divisas, tipos, versión |

### 2.2. Tamaño de archivos relevantes

| Archivo | Líneas | Categoría | Preocupación principal |
|---------|--------|-----------|-----------------------|
| `js/pages/dashboard.js` | 4461 | 📁 XL | Dios object: orquestación + rendering + eventos |
| `js/pages/cuentas.js` | 2398 | 📁 L | Gestión cuentas + formulario |
| `js/pages/movimientos.js` | 1905 | 📁 L | Lista + detalle movimientos |
| `js/ui/configuracion.js` | 1594 | 📁 M | Preferencias UI |
| `js/services/DivisaServicio.js` | 9428 | 📁 XL | Según graphique, alta betweenness |
| `js/core/movimientos.js` | 75 | ✅ S | ÉXITO: esMovimientoPositivo unificado |
| `js/core/familiaCuentas.js` | 166 | ✅ S | Buen diseño, tests 32/32 |

### 2.3. Dependencias circulares

**5 ciclos detectados**, todos involucran `js/ui/notificaciones.js` como nodo central:
- 2-file: `movimientos.js ↔ notificaciones.js`
- 3-file ×5: través de notificaciones en el camino
- 4-file ×2, 5-file ×2: ciclos extensos

## 3. Propuesta de modularización

### 3.1. `js/pages/dashboard.js` — Split propuesto

**Justificación**: 4461 líneas concentran responsabilidades incompatibles con mantenimiento a largo plazo.

**Módulos propuestos:**

1. **`dashboard-estado.js`** (≈1200 líneas)
   - Responsabilidad: Estado y preferencias puras
   - Exporta: `uid`, `cuentas`, `posiciones`, `orden`, `cardsVisibles`, `dimensiones`, `versionCarga`
   - Inputs: nada de DOM, todo datos puros
   - Tests: testables en Node sin DOM

2. **`dashboard-render.js`** (≈1500 líneas)
   - Responsabilidad: Renderizado grid H2, disposición cards
   - Exporta: `calcularDistribucion()`, `clasesCard()`, `normalizarCardsOrden()`, `dimensionesCard()`
   - Inputs: datos de estado, templates HTML
   - Tests: testing rendering con templates mock

3. **`dashboard-interaccion.js`** (≈800 líneas)
   - Responsabilidad: Event listeners, arrastre, clicks, estados de carga/error
   - Exporta: `moverCardDashboard()`, `reordenarDashboard()`, handlers de evento
   - Inputs: DOM elements, estado desde módulo anterior
   - Tests: testing eventos con DOM simulado

4. **`dashboard.js`** (orchestrator ≈961 líneas)
   - Responsabilidad: Importar los 3 módulos above, inicialización, compatibilidad versión
   - Hace: `import { estado } from './dashboard-estado.js'`, `import { render } from './dashboard-render.js'`, `import { interaccion } from './dashboard-interaccion.js'`
   - Sin lógica propia, solo wired

**Beneficios esperados:**
- Cada módulo ~1/3 tamaño original, comprensible individualmente
- Tests más focalizados (lógica sin DOM, rendering sin lógica, eventos sin lógica)
- Riesgo de regresión contenido por boundaries claros
- Nuevos agentes pueden aprender un módulo a la vez

**Criterios de aceptación:**
- Dashboard comportamiento idéntico visual y funcionalmente (misma disposición H2, mismas interacciones)
- Cada nuevo módulo tiene tests propias o coverage equivalente
- Lint pasa en todos los archivos nuevos/transformados
- No hay imports rotos en toda la códigobase

### 3.2. `js/ui/notificaciones.js` — Event Bus pattern

**Justificación**: 5 ciclos de importación giran alrededor de este módulo, acoplamiento involuntario.

**Transformación propuesta:**

**Antes**: Funciones de notificación importadas directamente por páginas:
```javascript
// En movimientos.js o dashboard.js
import { mostrarNotificacion } from '../ui/notificaciones.js'
// Uso: mostrarNotificacion('tipo', { mensaje })
```

**Después**: Event bus pattern
```javascript
// en notificaciones.js
export function publicarNotificacion(tipo, datos) {
    // Lógica de crear y mostrar notificación
    // Sin imports de páginas, módulo puro
}

// En páginas
import { publicarNotificacion } from '../ui/notificaciones.js'
// Uso: publicarNotificacion('éxito', { mensaje: 'Guardado' })
```

**Beneficios:**
- Rompe todos los ciclos de importación detectados
- Acoplamiento suelto: páginas pueden elegir suscribir o no
- `notificaciones.js` becomes module puro, testable en Node
- Patrón comprobado en códigobase (ya hay usos similares)

**Criterios de aceptación:**
- Zero imports circulares detectados por Graphify
- Todas las páginas que usaban `import {...} from notificaciones.js` ahora usan `publicarNotificacion()`
- Tests de que eventos se propagan correctamente
- Lint pasa sin errores nuevos

### 3.3. `js/core/` — Consolidación de funciones puras

**Observación**: `js/core/movimientos.js` (75 líneas) es modelo a seguir. `js/core/familiaCuentas.js` (166 líneas) también.

**Propuestas de extracción** (bajo riesgo, alta utilidad):

1. **Utilidades de formateo** actualmente esparcidas:
   - `formatearMontoConDivisa` existe en `DivisaServicio.js` y `cuentas.js` (DEUDA-015)
   - Consolidar en `js/core/formateo.js` o mantener en servicio correspondiente

2. **Utilidades de fecha** (`tiempoFecha`, `compararMovimientosPorFecha` en `movimientos.js`):
   - Ya están en `movimientos.js` (core), buen lugar
   - Verificar si otras páginas las reutilizan

3. **Helpers de DOM mínimo** (solo si son puras):
   - Functions que operan solo en objetos/strings, no Window/document
   - Mudar a `js/core/` si son usadas por múltiples módulos

**Criterio**: Solo extraer si la función es pura (mismo input → mismo output, sin efectos secundarios) y es usada por ≥2 módulos.

## 4. Reglas arquitectónicas propuestas

### 4.1. Dirección de dependencias

```
Capa superior:          Capa inferior:
Pages   ←→   Services   ←→   Repositorios   ←→   Firestore
  ↑               ↑               ↑               ↑
Core (lectura solo)  Utilidades       Convenciones    Lint/Tests
```

**Reglas:**
1. **Pages** pueden importar de: Services, Core (lectura), Constants
2. **Services** pueden importar de: Repositorios, Core (lectura), Constants
3. **Repositorios** pueden importar de: Core (solo funciones puras), Constants
4. **Core** NO puede importar de: Pages, Services, Repositorios
5. **UI** puede importar de: Core (solo funciones puras), Components itself

### 4.2. Límites de responsabilidad

| Capa | Puede tener | Debe EVITAR |
|------|-------------|------------|
| **Core** | Funciones puras, utilidades matemáticas, formateo, fechas | Dependencias Firestore, DOM, window, localStorage |
| **Services** | Lógica de negocio, operaciones Firestore, llamadas API externas | Dependencias de presentación (DOM, CSS classes) |
| **Repositorios** | CRUD Firestore, normalización de datos, queries | Lógica de negocio, decisiones de UI |
| **Pages** | Orquestación, coordinación llamadas, gestión estado temporal | Contener lógica de negocio pura |
| **UI** | Presentación, manejadores eventos básicos, renderizado | Lógica de negocio, cálculos de negocio, acceso a datos |

### 4.3. Convenciones de importación y exportación

- **Default exports**: Solo para módulos únicos por archivo (rare). Preferir named exports.
- **Named exports**: Grupos lógicos: `export { esMovimientoPositivo, montoDeMovimiento }` desde core
- **Index files**: `js/core/index.js` que re-exporta funciones comunes, `js/services/index.js` para consumers
- **Rutas absolutas relativas**: Siempre `import {X} from './archivo.js'`, nunca paths absolutos ni `../` profundidad variable
- **Cartas de firestore**: Nunca importar firestore directamente en páginas/core; siempre a través de `firebase/firestore.js` punto único

### 4.4. Criterios de modularización (cuándo extraer)

**Extraer SÍ si:**
1. Módulo tiene responsabilidad coherente aislable
2. Consumido por ≥2 otros módulos (reduce duplicación)
3. Lógica testable aisladamente (sin DOM/Firestore)
4. Tamaño >200 líneas con múltiples responsabilidades claras

**Extraer NO si:**
1. La extracción crea más archivos de los que se consumen
2. Responsabilidades son intrínsecamente inseparables (ej. UI + lógica mezclada intencionalmente por diseño)
3. Beneficio puramente estético (archivos más pequeños sin ganancia real)
4. La extracción requiere cambiar >50% del código existente

## 5. Estandarización para agentes de IA

### 5.1. Estructura de conocimiento

```
/escinco/                          ← Raíz proyecto
│
├── AGENTS.md                      ← Reglas para agentes OpenCode
│   ├── Reglas generales           ← Sin editar sin aprobación PO
│   ├── Por directorio             ← Instrucciones js/, css/, tests/
│   ├── Límites responsabilidad    ← Por capa (core/services/pages/ui)
│   └── Procedimientos             ← Investigación, debug, refactorización
│
├── DISENO.md                      ← Sistema diseño (tokens, convenciones, NO modificar sin PO)
│
├── docs/                          ← Documentación histórica
│   ├── DEUDA_TECNICA.md           ← Déficit técnica consolidada
│   ├── ESTADO_Y_PROPUESTA.md      ← Diagnóstico actual (snapshop)
│   └── ... (archivos archivados si no operativos)
│
├── js/                            ← Código fuente
│   ├── core/                      ← Funciones puras, utilidades
│   │   ├── movimientos.js         ← esMovimientoPositivo, montoDeMovimiento
│   │   ├── cache.js               ← cacheCapa, persistencia local
│   │   ├── tema.js                ← tema oscuro/claro
│   │   ├── router.js              ← enrutamiento SPA
│   │   └── index.js               ← re-exports comunes core
│   ├── services/                  ← Lógica de negocio
│   │   ├── movimiento.js          ← saldos, transferencias
│   │   ├── divisa.js              ← convertirMonto
│   │   ├── auth.js                ← autenticación
│   │   └── index.js               ← re-exports comunes services
│   ├── repositories/              ← Acceso datos
│   │   ├── movimiento.js
│   │   ├── cuenta.js
│   │   └── index.js
│   ├── models/                    ← Datos/validación
│   │   ├── movimiento.js
│   │   ├── cuenta.js
│   │   └── index.js
│   ├── pages/                     ← Orquestación por página
│   │   ├── dashboard/             ← ETAPA 9: split estado/render/interacción
│   │   │   ├── estado.js
│   │   │   ├── render.js
│   │   │   ├── interaccion.js
│   │   │   └── index.js           ← orchestrator delgado
│   │   ├── cuentas.js
│   │   ├── movimientos.js
│   │   ├── inversiones.js
│   │   ├── trading.js
│   │   ├── configuracion.js
│   │   ├── auth.js
│   │   └── index.js
│   ├── ui/                        ← Componentes UI
│   │   ├── notificaciones.js      ← ETAPA 9: event bus pattern
│   │   ├── modal.js               ← modales reutilizables
│   │   ├── formularios.js         ← forms comunes
│   │   └── index.js
│   └── core/                      ← Ya existe, consolidar utilidades
│
├── css/                           ← Estilos
│   ├── style.css                  ← Tokens globales, :root variables
│   ├── componentes.css            ← Clases reutilizables (.btn, .card, .badge)
│   ├── dashboard.css              ← Estilos página
│   └── ...
│
├── tests/                         ← Suite tests (baseline 113)
│   ├── helpers.mjs                ← nuevoReporter, extraerFuncion
│   ├── dashboard.test.mjs
│   ├── modelo.test.mjs
│   └── ...
│
├── graphify-out/                  ← Análisis arquitectónico (generado, .gitignore)
│   └── GRAPH_REPORT.md
│
└── package.json                   ← Dependencies, scripts (lint, test, build)
```

### 5.2. Prevención de degradación arquitectónica

**Mecanismos automáticos (CI/CD):**

1. **Lint en cada push**: `npm run lint` falla si hay:
   - `no-unused-vars` no exento (pattern `/^_/u`)
   - `require-await` en functions async sin await
   - Shadow variables no intencionales
   - `no-console` error level (máximo 1 console.error permitido)

2. **Tests en cada push**: `npm test` falla si:
   - Baja cobertura por debajo de baseline (108/113 passing)
   - Nuevos tests fallen (no `TODO OK` sin causa)
   - Tests de reglas firestore SKIP por emulador no disponible (esperado)

3. **Graphify update**: Paso opcional en CI para detectar nuevos ciclos:
   - `graphify update .` → compara con reporte base
   - Si nuevos ciclos > baseline (0), fallar build y notificar

4. **Convenciones de nombre**: ESLint rules enforced:
   - `camelCase` funciones/variables
   - `kebab-case` IDs HTML, selectors CSS
   - `PascalCase` componentes React (no usados, consistencia)
   - Archivos `*.test.mjs` para tests, `*.mjs` para módulos ESM

**Mecanismos manuales (revisión humana):**

1. **Code review** en Pull Requests: checklist incluye:
   - ✅ ¿Nuevo módulo respeta límites de capa?
   - ✅ ¿Nueva dependencia cruza capas en dirección prohibida?
   - ✅ ¿Responsabilidad del módulo está clara en nombre y docs?
   - ✅ ¿Tests cubren el nuevo módulo o módificado?

2. **Documentación actualizada**: Cualquier cambio de arquitectura mayor se refleja en:
   - `AGENTS.md` (instrucciones por directorio)
   - `DISENO.md` (tokens, convenciones)
   - `ESTADO_Y_PROPUESTA.md` (diagnóstico actual)

3. **Baseline de tests**: Después de cada intervención mayor, correr `npm test` y comparar resultados con commit anterior.

## 6. Plan de fases de Etapa 9 (suspendido)

### 6.1. Fase 9-A: Fundaciones (suspendida)

**Objetivo**: Establecer base arquitectónica, no tocar funcionalidad visible.

**Áreas suspendidas:**
1. ✅ Lint rules enforcement - corregir 13 errores restantes, configurar CI
2. ✅ Graphify en CI - agregar `graphify update .` workflow
3. ✅ Mejoras tests - resolver 5 fallos módulos scripts/
4. ✅ Documentación agente - actualizar `AGENTS.md` estructura propuesta

**Entregables suspendidos:**
- Lint 0 errores en CI
- Graphify integrado pipeline CI
- Tests baseline passing consistentemente
- Instrucciones actualizadas nuevos agentes

### 6.2. Fase 9-B: Modularización dashboard (suspendida)

**Objetivo**: Split `dashboard.js` manteniendo comportamiento H2.

**Áreas suspendidas:**
1. Extraer `dashboard-estado.js`: estado y preferencias puras
2. Extraer `dashboard-render.js`: grid H2, dimensiones, normalización
3. Extraer `dashboard-interaccion.js`: eventos, arrastre, clicks
4. Refactorizar `dashboard.js`: orchestrator delgado importando 3 módulos
5. Actualizar todos los imports en código que referencia dashboard.js
6. Tests: comportamiento H2 preservado

**Criterio de aceptación suspendido:**
- Dashboard comportamiento idéntico (misma disposición, mismas interacciones)
- Cada módulo nuevo tiene tests propias o coverage equivalente
- No hay imports rotos en códigobase
- Lint pasa en todos los nuevos archivos

### 6.3. Fase 9-C: Patrones de comunicación (suspendida)

**Objetivo**: Resolver dependencias circulares.

**Áreas suspendidas:**
1. Transformar `notificaciones.js` en event bus pattern
2. Actualizar imports que dependen de notificaciones
3. Verificar eliminación de 5 ciclos de importación
4. Tests de propagación de eventos

### 6.4. Fase 9-D: Consolidación y revisión (suspendida)

**Objetivo**: Revisar todo, validar, entregar.

**Áreas suspendidas:**
1. Revisar todos los cambios fases anteriores
2. Verificar que ninguna funcionalidad se perdió
3. Actualizar documentación
4. Presentar reporte final al PO
5. Marcar decisiones pendientes pendientes o aprobadas

## 7. Decisiones pendientes del PO (suspendidas)

| ID | Decisión | Opciones | Recomendación (basada en evidencia) | Impacto si se pospone |
|----|----------|----------|-------------------------------------|----------------------|
| PO-1 | **Split dashboard.js** | A) Mantener B) Split 3 módulos C) Split fino | **B**: Evidencia dashboard 4461 líneas difícil mantenimiento; split mantiene behavior H2 | Dashboard seguirá difícil mantener, nuevos bugs harder debug |
| PO-2 | **Event bus notificaciones** | A) Mantener ciclo actual B) Event bus pattern | **B**: Rompe 5 ciclos importación, notificaciones becomes puro | Continuará deuda arquitectónica, nuevos módulos harder integrar |
| PO-3 | **Priorización lint vs features** | A) Corregir todos lint B) Críticos luego | **A**: Evidencia 7600 errores preexistentes; base lint evita acumulación | Lint errors acumularse, ruido development, riesgo bugs silenciosos |
| PO-4 | **Graphify en CI** | A) Integrar paso update B) Usar esporádicamente C) Descartar | **A**: Evidencia graphify detecta nodes God, cycles; herramienta valiosa | Pérdida herramienta análisis arquitectónico continuo |
| PO-5 | **Estructura core/services/repos** | A) Aprobar límites B) Dejar abierta | **A**: Agentes nuevos frontera clara decisiones consistentes | Arquitectura fragmentarse inconsistently entre agentes |

## 8. Evidencia base y líneas de partida

### 8.1. Estados actuales medibles

| Métrica | Valor actual | Meta Etapa 9 | Cómo medir |
|---------|-------------|--------------|------------|
| Errores lint | 13 (7 auto-correctibles) | 0 errores | `npm run lint` passing |
| Tests passing | 108/113 | 113/113 | `npm test` passing count |
| Ciclos importación | 5 (todos por notificaciones.js) | 0 ciclos | `graphify query` analysis |
| `dashboard.js` líneas | 4461 | <2000 (orchestrator + 3 módulos) | `wc -l` después split |
| `esMovimientoPositivo` copies | 1 (unificado) | 1 (mantener) | Revisar código `js/core/movimientos.js` |
| `notificaciones.js` cycles | 5 detectados | 0 detectados | Graphify analysis post-intervención |

### 8.2. Líneas de partida confirmadas

- **✅** `esMovimientoPositivo` ya unificado en `js/core/movimientos.js` (DEUDA-004 resuelta)
- **✅** CI/lint configurado (`.github/workflows/ci.yml`, `package.json` scripts, `eslint.config.js`)
- **✅** Tests suite existe y corren (aunque 5 fallan por módulos scripts/ ausentes)
- **✅** Graphify analysis disponible y muestra estructura real
- **⚠** 5 fallos tests por módulos `scripts/` ausentes (investigar PO)
- **⚠** DEUDA-016 (~40 normalizaciones ad-hoc de moneda) aún abierta
- **⚠** `reporte-bugs.md` BUG-029 no actualizado (code corregido, doc no)

## 9. Herramientas evaluadas

### 9.1. Graphify

**Utilidad confirmada:**
- ✅ Detecta nodos God (conectividad excesiva)
- ✅ Identifica comunidades (agrupaciones lógicas)
- ✅ Encuentra ciclos de importación (todos 5 mediante notificaciones.js)
- ✅ Mide betweenness centrality (cacheCapa 0.021, mostrarNotificacion 0.020)

**Limitaciones confirmadas:**
- ⚠️ Grafo se generó 10/11/2026, requiere `graphify update .` para actualizar
- ⚠️ Communities bajas cohesion (0.03-0.07) pueden ser módulos terceros o simbolos sueltos
- ⚠️ No distingue dependencias "uso" vs "dependencia fuerte" automáticamente

**Propuesta integración CI:**
- Agregar paso `graphify update .` después de cambios relevantes
- Comparar reporte nuevo vs baseline (commit anterior)
- Fallar build si nuevos God nodes o cycles detectados
- Costo bajo (sin API cost, local)

### 9.2. Ponytail

**Estado**: No instalado en entorno actual (auditoría anterior lo identificó como no disponible).

**Decisión**: No instalar sin autorización expresa del PO.

**Alternativas consideradas:**
- Análisis estático existente (lint, tests) cubre casos de uso principales
- Graphify ya provee visión arquitectónica
- Ponytail sería complementaria, no sustitutiva

**Si se autoriza:** Evaluar para detectar código muerto/no utilizado, duplicaciones no evidentes por análisis estático, abstracciones injustificadas. Cada hallazgo contrastarse con arquitectura y contratos reales.

### 9.3. Herramientas complementarias

| Herramienta | Propósito | Estado |
|-------------|-----------|--------|
| **ESLint** | Métricas, dependencias, complejidad | ✅ Disponible, usado en CI |
| **npm test** | Cobertura tests, comportamiento | ✅ Disponible, 108/113 passing |
| **Graphify** | Arquitectura, dependencias, God nodes | ✅ Disponible, reporte generado |
| **Coverage NYC** | Porcentaje cobertura tests | ⚠️ Revisar si agregar a CI |
| **Dependabot** | Actualizaciones de dependencias | ⚠️ Revisar política proyecto |
| **Taille** | Tamaño bundles, detección dead code | ❓ No probado en proyecto |

## 10. Consideraciones finales

### 10.1. Qué NO hará la Etapa 9

1. **No fragmentar indiscriminadamente**: Cada módulo debe tener responsabilidad coherente, no "split por split"
2. **No imponer arquitecturas teóricas**: Arquitectura pragmática, coherente con escala proyecto
3. **No introducir dependencias nuevas**: Usar existentes (Firebase ya configurado, ESLint configurado)
4. **No cambiar comportamiento funcional**: Todos los tests deben seguir passing idéntico
5. **No eliminar archivos sin reemplazo**: Mover lógica, no borrar; archivo antiguo puede deprecated pero no eliminado

### 10.2. Qué SÍ hará la Etapa 9

1. **Reducir complejidad accidental**: Simplificar sin perder funcionalidad
2. **Mejorar separación responsabilidades**: Límites claros entre capas
3. **Modularizar lo que necesita**: Dashboard, notificaciones, basado en evidencia
4. **Reducir acoplamiento**: Romper ciclos importación, event bus pattern
5. **Resolver dependencias circulares**: Esfuerzo concentrado en notificaciones.js
6. **Establecer límites arquitectónicos**: Reglas claras para futuros desarrolladores
7. **Mejorar testabilidad**: Módulos más pequeños = tests más focalizados
8. **Facilitar nuevas funcionalidades**: Patrones consistentes, documentación agente
9. **Establecer estructura comprensible**: Para agentes de IA y desarrolladores humanos

### 10.3. Próximos pasos después de aprobación PO

1. **Sprint 1**: Corregir lint errores restantes, actualizar Graphify en CI
2. **Sprint 2-3**: Ejecutar split `dashboard.js` en 3 módulos + orchestrator
3. **Sprint 3-4**: Transformar `notificaciones.js` event bus pattern
4. **Sprint 4**: Consolidar tests, verificar comportamiento H2 preservado
5. **Sprint 5**: Revisión final, documentación actualizada, presentar reporte
6. **Post-authorization**: Monitorear primer mes, ajustar si descubrimos suposiciones incorrectas

---

**IMPORTANTE: Este plan está SUSPENDIDO hasta autorización explícita del PO después de completar la Etapa 8 del Dashboard.** 

Todos los entregables servirán de base cuando el PO autorice comenzar la implementación de la Etapa 9. La planificación garantiza que, cuando se inicie la ejecución, haya:

- Evidencia clara de problemas y soluciones propuestas
- Criterios de aceptación medibles
- OrdenPriorizado de intervenciones
- Decisiones pendientes del PO documentadas y aprobadas
- Herramientas y métricas baseline establecidas

**Fecha**: Mon Nov 16 2026  
**Basado en**: `AUDITORIA_MANTENIBILIDAD.md`, `graphify-out/GRAPH_REPORT.md`, `npm test`, `npm run lint`  
**Para**: Aprobación PO - Etapa 9 reinstrucción arquitectónica yestandardización