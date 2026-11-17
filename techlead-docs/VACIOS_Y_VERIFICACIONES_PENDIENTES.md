# VACÍOS Y VERIFICACIONES PENDIENTES

## 8.1 Vacíos de Información Identificados

### V-1: Documentación desactualizada vs código real

| Área | Documentación | Código Real | Desviación |
|------|--------------|-------------|------------|
| `docs/requisitos.md` | Versión `1.0.0-beta.5`, inactividad 30 min, divisas PEN/USD/USDT, campo `nota` en trades | `1.0.0-beta.30`, 15 min, PEN/USD/USDT/EUR, sin `nota` | 4 puntos desfasados (DEUDA-025) |
| `docs/deuda-tecnica.md` | No incluye subcuentas, diff de preferencias, modo Panel | App ya está en beta.21+ con esas características | Resumen desactualizado |
| `docs/reporte-bugs.md` | BUG-029 listado como Pendiente | Código corregido en `js/pages/movimientos.js:1724-1753` | Bug corregido, documentación no actualizada |
| `ESTADO_Y_PROPUESTA.md` | Versión `beta.5` referenciada en varios lados | Versión real `beta.30` | Referencias históricas no actualizadas |

**Impacto**: Nuevos agentes (como Kimi) pueden tomar decisiones basadas en información obsoleta. Requerir actualización de documentación antes de considerar completa la transferencia.

### V-2: Deuda técnica no documentada en algunos lugares

| Ítem | Dónde Está Documentado | Dónde Falta |
|------|----------------------|-------------|
| Subcuentas `padreId` | `ESTADO_Y_PROPUESTA.md`, `familiaCuentas.js` | `docs/deuda-tecnica.md` no las incluye en el resumen |
| Diff de preferencias (tema entre dispositivos) | `tema.js` sincronización Firestore | `docs/requisitos.md` no menciona |
| Modo Panel (visión alternativa del dashboard) | `dashboard.js` con distintas disposiciones | No documentado en ningún lado |
| 18 exports sin usar (DEUDA-006) | `deuda-tecnica.md:338-372` | No mencionado en `ESTADO_Y_PROPUESTA.md` |
| 218 `console.*` (DEUDA-010) | `deuda-tecnica.md:575-604` | No reflejado en métricas de calidad visibles |

### V-3: Decisiones arquitectónicas orales vs documentadas

Algunas decisiones clave parecen haberse tomado en reuniones sin quedar registrado explícitamente en los documentos:

- Razón por la cual `dashboard.js` no se había modularizado antes (decisiones PO previas)
- Critérios exactos para cuándo una función debe ir a `core/` vs `services/` vs `repositories/`
- Decisión de usar variables CSS en lugar de clases utility para tokens de diseño
- Cuándo y por qué se deshabilitó la persistence offline en Firestore

### V-4: Brechas de conocimiento

- **GEMINI_API_KEY rotación**: No hay documentación sobre cuándo fue la última rotación ni el procedimiento exacto
- **Procedimiento de despliegue real**: `INFORME_CACHES_SW.md` menciona que los cambios no se han desplegado; no hay guía paso a paso del flujo completo
- **Testing rules en CI**: `tests/rules.test.mjs` SALTA si emuladores no están levantados; no hay configuración `emulators` en `firebase.json` visible
- **Procedimiento de backup/restore**: `.dvid` format v4.0.0 existe (`ExportarServicio.js`/`ImportarServicio.js`), pero no hay documentación de restauración paso a paso
- **Límites de planes plana/flash**: No definidos en ningun lado; `AnalyticsServicio.js:67` menciona `plana` y `DrovServicio.js` menciona `flash`, pero sin matriz de qué funcionalidad cada uno tiene

## 8.2 Verificaciones Pendientes (Qué Faltaría Confirmar)

### VP-1: Confirma en producción (requiere desplegar)

| Verificación | Por Qué Es Crítico | Estado Actual |
|-------------|-------------------|---------------|
| **Snapshot diario en producción (PEND-001)** | El historial de patrimonio solo crece si las reglas e índice estaban bien desplegados el 2026-10-12. Sin confirmación, el dashboard de evolución queda vacío en producción. | Reglas e índice desplegados 2026-10-12, pero falta confirmar un día real en producción. `npm test` no cubre esto (tests en Node contra emuladores no levantados). |
| **Service Worker offline en producción** | Los fixes de `sw.js` y `firebase.json` fueron probados en banco de pruebas (31/31 checks), pero `firebase serve` ignora las reglas `headers`. Despliegue real necesario para validar cabeceras `no-cache` en rutas sin extensión. | Banco de pruebas OK (31/31), pero no desplegado a producción. |
| **GEMINI_API_KEY rotación** | La clave actual debió rotarse antes de producir (AGENTS.md:7 advierte que ya estuvo expuesta en cliente). Desplegar sin rotar es un riesgo de seguridad. | No hay evidencia de rotación reciente. Riesgo alto si se despliega antes de rotar. |

### VP-2: Confirma sin desplegar (solo código)

| Verificación | Evidencia | Estado |
|-------------|-----------|--------|
| **`esMovimientoPositivo` unificado** | `js/core/movimientos.js` exporta una sola función, importada por `cuentas.js`, `movimientos.js`, `dashboard.js`. Tests pass. | ✅ Confirmado en código |
| **FIRESTORE rules validación compartida** | `validarCamposMovimiento` y `validarCamposCuenta` usadas por create y update (DEUDA-012 resuelta). `tests/reglas.test.mjs` cubre el caso. | ✅ Confirmado en código |
| **Cache estrategias SW** | `sw.js` usa `cache: "no-cache"` para JS/CSS (nuevo en 1ª recarga), `caché-first` para fuentes, `stale-while-revalidate` para iconos. `tests/precache.test.mjs` (10/10) pass. | ✅ Confirmado en código |
| **18 exports sin usar** | Verificado nombre por nombre en todo el repositorio (0 coincidencias fuera de su propia declaración). 13 archivos afectados. | ✅ Confirmado en código |
| **17 documentos de auditoría inspeccionados** | `AUDITORIA_MANTENIBILIDAD.md:360` - "Se ha inspeccionado la documentación relevante (17 documentos revisados)". | ✅ Confirmado |

### VP-3: Tests que faltan por escribir

| Área | Caso de Prueba Faltante | Impacto si No Existe |
|------|------------------------|----------------------|
| **Subcuentas en navegador** | `PEND-002`: "Funciona en los tests, nunca se ha ejecutado en la app" | Usuario beta con cuentas multi-divisa ve patrimonio incorrecto; no invitar usuarios hasta probar |
| **Snapshot schema en producción** | Verificar comportamiento real con `schemaVersion: 0` vs `1` documentos antiguos | Histórico de patrimonio puede tener datos heterogéneos sin visibilidad |
| **Consola ruido** | Contar efectivamente los 218 `console.*` y los 3 que silencian fallos | Debugging más difícil en producción |
| **Lint errors restantes** | 6 errores por corregir manualmente (3 auto-fixables + 3 por revisar) | Risk de acumulación de nuevos errors, ruido en desarrollo |
| **Rules test con emuladores** | `tests/rules.test.mjs` SALTA si emuladores no levantados; falta configurar `emulators` en `firebase.json` | Rules no se validan automáticamente en CI, pueden desincronizarse |

### VP-4: Arquitectura - Qué Necesita Decisión

| Cuestión | Opciones | Consecuencia |
|----------|----------|--------------|
| **Modularizar dashboard.js** (PO-1) | A) Mantener vs B) Split 3 módulos vs C) Split fino | Decide si nuevo agente encuentra dashboard abrumador o comprensible |
| **Event bus notificaciones** (PO-2) | A) Mantener vs B) Event bus pattern | Afecta a 5 ciclos de importación y facilidad de añadir nuevos módulos |
| **DEUDA-016 priority** (PO-3) | A) Ahora vs B) Post-Etapa 8 | UI consistente vs posponer riesgo técnico |
| **Graphify en CI** (PO-5) | A) Integrar paso update vs B) Esporádico vs C) Descartar | Pérdida herramienta análisis continuo si se descarta |
| **Actualizar reporte-bugs.md** (PO-4) | A) Actualizar vs B) Dejar histórico | Nueva agents se confundirá si docs no reflejan código real |

## 8.3 Herramientas para Kimi (Nuevo Tech Lead)

### Para Empezar a Trabajar:

1. **Ejecutar baseline**:
   ```bash
   npm test      # 108/113 passing (5 fallan por módulos scripts/ ausentes)
   npm run lint  # 13 errores (7 auto-correctibles, 6 manuales)
   ```

2. **Entender la estructura**:
   - Revisar `AGENTS.md` para reglas del proyecto
   - Revisar `DISENO.md` para tokens y convenciones CSS
   - Explorar `graphify-out/GRAPH_REPORT.md` para visión arquitectónica

3. **Priorizar primeros fixes**:
   - Rotar `GEMINI_API_KEY` (secreto expuesto históricamente)
   - Actualizar `docs/requisitos.md` (4 puntos desfasados)
   - Corregir 6 errores lint restantes
   - Decidir ETAPA 9 (dashboard split + notificaciones event bus)

4. **Herramientas de análisis**:
   - `graphify query <consulta>` para inspeccionar grafo actualizado
   - `npm test -- --grep <patrón>` para tests focalizados
   - `tools/generar-build.mjs --id local` para resetear BUILD_ID en dev

### Enlaces Rápidos (Rutas de Archivos)

- `js/pages/dashboard.js` - 4461 líneas (objetivo modularización)
- `js/ui/notificaciones.js` - 283 líneas (5 ciclos de importación)
- `js/core/movimientos.js` - 75 líneas (éxito: esMovimientoPositivo unificado)
- `js/core/cache.js` - 389 líneas (cacheCapa memoria+localStorage)
- `js/services/MovimientoServicio.js` - lógica de negocio movimientos
- `js/services/DivisaServicio.js` - formateo y conversión de divisas
- `firebase/firestore.rules` - validación de datos
- `constants/divisas.js` - DIVISAS = {PEN, USD, USDT, EUR}
- `package.json` - scripts, dependencias
- `AGENTS.md` - reglas para agentes OpenCode
- `DISENO.md` - sistema de diseño tokens y convenciones

## 8.4 Resumen de Qué Necesita Confirmación del Product Owner

| Decisión | Qué Define | Plazo Recomendado |
|----------|-----------|-------------------|
| **ETAPA 9 autorización** | Qué intervenciones arquitectónicas proceder | Inmediato - define rumbo nuevo Tech Lead |
| **Prioridad DEUDA-016** | Si normalizaciones de moneda se arreglan ahora o se pospone | Junto con ETAPA 9 |
| **Rotar GEMINI_API_KEY** | Si se rota antes de cualquier producción | Inmediato - riesgo seguridad |
| **Actualizar documentación** | Qué docs actualizar primero (requisitos, reporte-bugs) | Inmediato - nuevos agentes necesitan info correcta |
| **Mecanismo de invitación beta** | Definir cómo se invitan los 5-10 usuarios beta | Pre-Fase 4 - bloqueante para producto |
| **Prioridad tests vs features** | Qué tan alto estándard de calidad mantener | Define ritmo de desarrollo futuro |

**Nota**: Una vez definidas estas autorizaciones, el Tech Lead (Kimi) podrá proceder con el plan de intervención ordenado y evitar introducir regresiones en un códigobase con las características actuales de escinco.