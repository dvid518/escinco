# CONTEXTO ESPECÍFICO ETAPA 9

## 9.1 Origen y Base de la Auditoría

Esta sección del contexto para el Tech Lead (Kimi) deriva directamente de la **AUDITORÍA DE MANTENIBILIDAD Y RACIONALIZACIÓN DE ESCINCO** completada previamente. Los hallazgos de esa auditoría forman la base factual de cada decisión propuesta en la ETAPA 9.

**No se ejecutarán refactorizaciones durante esta fase** a menos que el PO autorice la ETAPA 9. El presente documento sirve como diseño preparatorio para aprobación del Product Owner.

### Datos Base Confirmados

| Métrica | Valor Actual | Fuente |
|---------|-------------|--------|
| Errores lint | 13 (7 auto-correctibles) | `npm run lint` |
| Tests passing | 108/113 | `npm test` |
| Ciclos importación | 5 (todos por `notificaciones.js`) | `graphify-out/GRAPH_REPORT.md` |
| `dashboard.js` líneas | 4461 | Recuento de líneas actual |
| `esMovimientoPositivo` copies | 1 (unificado) | `js/core/movimientos.js` |
| God nodes Graphify | 3 identificados | `contenidoDesdeTemplate()` (160 edges), `mostrarNotificacion()` (128 edges), `abrirModal()` (101 edges) |
| Comunidades Graphify | 124 detectadas | `graphify-out/GRAPH_REPORT.md` |

## 9.2 Áreas Prioritarias de la ETAPA 9

### 9.2.1 Dashboard Split (PO-1)

**Problema**: `js/pages/dashboard.js` es un "Dios object" de 4461 líneas que concentra:
- Carga de datos (cuentas, movimientos, inversiones, metas, patrimonio)
- Gestión de cards del dashboard (renderizado, disposición, arrastre)
- Manejo de preferencias de usuario (orden, visibilidad, dimensiones)
- Integración con servicios (SnapshotServicio, PosicionServicio, CreditoServicio)
- Event listeners para interacciones (arrastre, clicks, eventos)
- Estados de carga, error y vacío

**Criterio de Aceptación (suspendido)**:
- ✅ Dashboard comportamiento idéntico visual y funcionalmente (misma disposición H2, mismas interacciones)
- ✅ Cada nuevo módulo tiene tests propias o coverage equivalente
- ✅ No hay imports rotos en toda la códigobase
- ✅ Lint pasa en todos los archivos nuevos/transformados

**Propuesta (no implementada sin autorización PO)**:
1. `dashboard-estado.js`: Estado y preferencias puras (~1200 líneas)
   - Exporta: `uid`, `cuentas`, `posiciones`, `orden`, `cardsVisibles`, `dimensiones`, `versionCarga`
   - Inputs: nada de DOM, todo datos puros
   - Tests: testables en Node sin DOM

2. `dashboard-render.js`: Renderizado grid H2, disposición cards (~1500 líneas)
   - Exporta: `calcularDistribucion()`, `clasesCard()`, `normalizarCardsOrden()`, `dimensionesCard()`
   - Inputs: datos de estado, templates HTML
   - Tests: testing rendering con templates mock

3. `dashboard-interaccion.js`: Event listeners, arrastre, clicks (~800 líneas)
   - Exporta: `moverCardDashboard()`, `reordenarDashboard()`, handlers de evento
   - Inputs: DOM elements, estado desde módulo anterior
   - Tests: testing eventos con DOM simulado

4. `dashboard.js`: Orchestrator delgado (~961 líneas)
   - Importa los 3 módulos above
   - Inicialización, compatibilidad versión
   - Sin lógica propia, solo wired

### 9.2.2 Event Bus Notificaciones (PO-2)

**Problema**: `js/ui/notificaciones.js` es un nodo de alta conectividad que conecta múltiples comunidades. Importado por `movimientos.js`, `dashboard.js`, `configuracion.js`, `formularioMovimiento.js`, y servicios múltiples. Esto crea acoplamiento involuntario a través de 5 ciclos de importación detectados.

**Propuesta (no implementada sin autorización PO)**:
**Antes**: Funciones de notificación importadas directamente por páginas:
```javascript
import { mostrarNotificacion } from '../ui/notificaciones.js'
// Uso: mostrarNotificacion('tipo', { mensaje })
```

**Después**: Event bus pattern:
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

**Beneficios**:
- Rompe todos los ciclos de importación detectados
- Acoplamiento suelto: páginas pueden elegir suscribir o no
- `notificaciones.js` becomes module puro, testable en Node
- Patrón comprobado en código base (ya hay usos similares)

**Criterios de aceptación (suspendidos)**:
- ✅ Zero imports circulares detectados por Graphify
- ✅ Todas las páginas que usaban `import {...} from notificaciones.js` ahora usan `publicarNotificacion()`
- ✅ Tests de que eventos se propagan correctamente
- ✅ Lint pasa sin errores nuevos

### 9.2.3 Lint Rules Enforcement

**Estado Actual**: 13 errores identificados, 7 auto-correctibles con `--fix`

**Errores Pendientes (3 por corregir manualmente)**:
1. `require-await` en `firebaseClient.mjs` - function async sin await
2. Shadow variables no intencionales en files selectos
3. `no-unused-vars` en files de tests (18 exports sin usar DEUDA-006)

**Baseline para CI**:
- `npm run lint` debe pasar con 0 errores
- `npm test` debe dar 108/113 passing (los 5 fallando son módulos scripts/ ausentes, no errores de lógica)

### 9.2.4 Graphify en Flujo de Trabajo

**Propuesta (PO-5)**:
Agregar paso `graphify update .` al workflow de CI para mantener grafo actualizado después de cambios relevantes.

**Flujo**:
1. Después de cambios relevantes en push/PR
2. Ejecutar `graphify update .` para actualizar el grafo
3. Comparar reporte nuevo vs baseline (commit anterior)
4. Fallar build si nuevos God nodes o cycles detectados (comparando con baseline de 0 ciclos nuevos)

**Limitaciones**:
- Grafo se generó 10/11/2026; requiere `graphify update .` para actualizarse
- Communities bajas cohesion (0.03-0.07) pueden ser módulos terceros o símbolos sueltos
- No distingue automáticamente dependencias "uso" vs "dependencia fuerte"

## 9.3 Evidencia Base y Líneas de Partida

### 9.3.1 Estados Actuales Medibles

| Métrica | Valor Actual | Meta Etapa 9 | Cómo Medir |
|---------|-------------|--------------|------------|
| Errores lint | 13 | 0 errores | `npm run lint` passing |
| Tests passing | 108/113 | 113/113 | `npm test` passing count |
| Ciclos importación | 5 | 0 ciclos | `graphify query` analysis |
| `dashboard.js` líneas | 4461 | <2000 (orchestrator + 3 módulos) | `wc -l` después split |
| `esMovimientoPositivo` copies | 1 | 1 (mantener) | Revisar código `js/core/movimientos.js` |
| `notificaciones.js` cycles | 5 detectados | 0 detectados | Graphify analysis post-intervención |

### 9.3.2 Líneas de Partida Confirmadas

- ✅ `esMovimientoPositivo` ya unificado en `js/core/movimientos.js` (DEUDA-004 resuelta)
- ✅ CI/lint configurado (`.github/workflows/ci.yml`, `package.json` scripts, `eslint.config.js`)
- ✅ Tests suite existe y corren (aunque 5 fallan por módulos scripts/ ausentes)
- ✅ Graphify analysis disponible y muestra estructura real
- ⚠️ 5 fallos tests por módulos `scripts/` ausentes (investigar PO)
- ⚠️ DEUDA-016 (~40 normalizaciones ad-hoc de moneda) aún abierta
- ⚠️ `reporte-bugs.md` BUG-029 no actualizado (code corregido, doc no)

## 9.4 Decisiones Pendientes del PO (ETAPA 9)

| ID | Decisión | Opciones | Consecuencia |
|----|----------|----------|--------------|
| PO-1 | **Split dashboard.js** | A) Mantener como está <br> B) Split en 3 módulos <br> C) Split fino | La B ofrece mejor equilibrio; C podría sobre-engineerizar. Requiere aprobación para cambiar estructura de imports en todo el código. |
| PO-2 | **Event bus notificaciones** | A) Mantener ciclo actual <br> B) Event bus pattern | B rompe 5 ciclos importación, notificaciones becomes puro | Mejora mantenibilidad pero requiere tiempo de testing. |
| PO-3 | **Continuar limpieza DEUDA-016** | A) Abordar ahora <br> B) Dejar para Fase 3/4 después de Etapa 8 | A mejora coherencia UI ahora; B pospone riesgo técnico. | |
| PO-4 | **Actualizar reporte-bugs.md** | A) Actualizar para reflejar BUG-029 como resuelto <br> B) Dejar como documento histórico | A mantiene documentación alineada con código; B acepta desviación conocida. | |
| PO-5 | **Graphify en flujo de trabajo** | A) Integrar paso update en CI <br> B) Usar gráfico solo para esta auditoría <br> C) Descartar | A mantiene arquitectura visible; B suficiente para auditoría actual; C si se considera overhead innecesario. | |

## 9.5 Roadmap de ETAPA 9 (Suspendido)

### Fase 9-A: Fundaciones (suspendida)
- Objetivo: Establecer base arquitectónica, no tocar funcionalidad visible
- Áreas suspendidas: Lint rules enforcement, Graphify en CI, Mejoras tests, Documentación agente

### Fase 9-B: Modularización dashboard (suspendida)
- Objetivo: Split `dashboard.js` manteniendo comportamiento H2
- Áreas suspendidas: Extraer dashboard-estado.js, dashboard-render.js, dashboard-interaccion.js, refactorizar dashboard.js, actualizar imports, tests comportamiento H2 preservado

### Fase 9-C: Patrones de comunicación (suspendida)
- Objetivo: Resolver dependencias circulares
- Áreas suspendidas: Transformar notificaciones.js en event bus pattern, actualizar imports que dependen de notificaciones, verificar eliminación de 5 ciclos importación, tests propagación eventos

### Fase 9-D: Consolidación y revisión (suspendida)
- Objetivo: Revisar todo, validar, entregar
- Áreas suspendidas: Revisar todos los cambios fases anteriores, verificar que ninguna funcionalidad se perdió, actualizar documentación, presentar reporte final al PO, marcar decisiones pendientes aprobadas o pendientes

## 9.6 Herramientas para ETAPA 9

### Comandos Útiles

```bash
# Ver grafo actual (si se necesita)
graphify extract . --code-only

# Actualizar grafo (después de cambios)
graphify update .

# Ejecutar tests focalizados
npm test -- --grep "movimiento"

# Lint y tests baseline
npm run lint
npm test

# Resetear BUILD_ID para desarrollo
node tools/generar-build.mjs --id local
```

### Referencias Rápidas

- `AGENTS.md` - Reglas para agentes OpenCode (nunca modificar sin aprobación PO)
- `DISENO.md` - Sistema diseño (tokens, convenciones, NO modificar sin PO)
- `ESTADO_Y_PROPUESTA.md` - Diagnóstico actual (snapshot más completo)
- `deuda-tecnica.md` - 27 ítems deuda técnica (9 resueltos, 18 abiertos)
- `pendientes.md` - 9 items pendientes accionables (1 bloqueante, 3 alta, 3 media, 2 baja)
- `graphify-out/GRAPH_REPORT.md` - 2865 nodos, 8096 edges, 124 comunidades