# AUDITORÍA TÉCNICA DE ESCINCO

## 5.1 Metodología de la Auditoría

- **Fecha**: Nov 2026
- **Enfoque**: Inspección estática de código, sin ejecutar Firestore, sin desplegar
- **Herramientas**: Lectura de 17 documentos, `npm test`, `npm run lint`, `graphify-out/GRAPH_REPORT.md`
- **Profundidad**: Análisis de 137 archivos JavaScript, 18 archivos CSS, 15 documentos de documentación

## 5.2 Hallazgos Críticos

### CR-1: `js/pages/dashboard.js` - "Dios object" (4461 líneas)

**Evidencia**: 
- Archivo más grande del proyecto (4461 líneas)
- Concentra: orquestación de datos, rendering grid H2, disposición de cards, event listeners, gestión de preferencias, estados carga/error/vacío, integración con servicios

**Problema**: Módulo con demasiadas responsabilidades sin cohesión clara. Comprensión difícil, testing complejo, modificación riesgoso.

**Consecuencia**: Cada cambio requiere entender todo el archivo; nuevos bugs más difíciles de debug; nuevos agentes abrumados al principio.

**Solución propuesta** (ETAPA 9 no autorizada): Split en 3 módulos:
- `dashboard-estado.js`: Estado y preferencias puras (~1200 líneas)
- `dashboard-render.js`: Renderizado grid H2, disposición cards (~1500 líneas)
- `dashboard-interaccion.js`: Event listeners, arrastre, clicks (~800 líneas)
- `dashboard.js`: Orchestrator delgado que importa los 3 módulos anteriores (~961 líneas)

**Riesgo**: Cambia estructura de imports en todo el código que referencia `dashboard.js`.

**Beneficio**: Cada módulo más pequeño y fococado; tests más focalizados; riesgo de regresión contenido por boundaries claros.

### CR-2: 5 Ciclos de importación alrededor de `notificaciones.js`

**Evidencia**: Graphify analysis detectó 5 ciclos de importación múltiples todos involucran `js/ui/notificaciones.js`:
- 2-file cycle: `movimientos.js ↔ notificaciones.js`
- 3-file × 5 cycles: a través de notificaciones en el camino
- 4-file × 2 cycles, 5-file × 2 cycles: ciclos extensos através de notificaciones

**Problema**: `notificaciones.js` actúa como puente central, creando dependencias circulares involuntarias.

**Consecuencia**: Código difícil de seguir; modifying one part can break other unexpected parts; acoplamiento fuerte entre módulos aparentemente independientes.

**Solución propuesta** (ETAPA 9 no autorizada): Transformar `notificaciones.js` en patrón Event Bus:
- `publicarNotificacion(tipo, datos)`: lógica pura, sin imports de páginas
- Páginas usan `publicarNotificacion()` en lugar de imports directos
- Rompe todos los ciclos de importación detectados
- `notificaciones.js` becomes module puro, testable en Node

## 5.3 Hallazgos de Alto Nivel

### AL-1: `js/core/movimientos.js` - Éxito en racionalización

**Evidencia**: `esMovimientoPositivo` unificado en este módulo (DEUDA-004 resuelta)
- Antes: 3 copias divergentes en `cuentas.js`, `movimientos.js`, `dashboard.js`
- Ahora: 1 sola función exportada, importada por las 3 páginas
- La función tiene 4 ramas: `pagoTarjeta`, `cambioDivisa`, `transferencia`, `error`
- `montoDeMovimiento` propagate `cuentaId` correctamente

**Estado**: ✅ Resuelto - es el mayor acierto de auditorías previas.

### AL-2: `js/core/familiaCuentas.js` - Buen diseño modular

**Evidencia**: 166 líneas, responsabilidad única bien definida
- Lógica pura de subcuentas: `esHija`, `hijasDe`, `familiaDe`, etc.
- Sin dependencias Firestore directas
- Tests completos (32/32 verdes en modelo.test.mjs)
- Reutilizado por páginas y servicios

**Beneficio**: Código limpio, tests focalizados, responsabilidad única.

### AL-3: `js/services/MovimientoServicio.js` - Lógica de negocio compleja

**Evidencia**: ~868 líneas, gestiona saldos, transferencias, creación atómica

**Problema**: Alta betweenness centrality en grafo. Dependencia a `firebase/firestore.js` directa en algunos casos.

**Consecuencia**: Comprensión limitada, testing complejo.

**Solución**: Modularizar lógica de saldos y transferencias en sub-módulos (baja prioridad).

### AL-4: `DivisaServicio.js` - 9428 líneas, alta betweenness

**Evidencia**: Constantemente usado por múltiples páginas y servicios

**Problema Histórico**: `API_TIPO_CAMBIO` con URL `https://` en nivel de módulo causaba error ESM en tests (F7.3).

**Solución aplicada**: ✅ Corregido - constante movida dentro de la función `actualizarTipoCambioAuto()`.

**Estado actual**: Tests ESM funcionando, código más puro.

## 5.4 Hallazgos Médio

### MD-1: Duplicación `formatearMontoConDivisa`

**Evidencia**: 
- Existe en `DivisaServicio.js:46` y se reexporta/usa en `cuentas.js:71` (DEUDA-015 documentada)
- `cuentas.js` tiene copia local en lugar de importar la del servicio

**Impacto**: Dos implementaciones del mismo formateo. La de la página no respeta `getFormatoDivisa()` ni la divisa principal configurada por el usuario; la del servicio sí. La vista de Cuentas puede ignorar la preferencia de formato de divisa.

**Solución**: Borrar la copia de `cuentas.js` e importar la del servicio (como ya hacen `dashboard.js`, `configuracion.js` y `graficos.js`).

### MD-2: Normalizaciones ad-hoc de moneda (DEUDA-016)

**Evidencia**: ~40 normalizaciones en 15 archivos JS, 4 convenciones distintas:
1. `(c.moneda || "PEN").toUpperCase()` - `cuentas.js:385`
2. `c.moneda?.toUpperCase() || "PEN"` - `inversiones.js:1667`, `trading.js:1478`
3. `presentarDivisa(...)` - `formularioMovimiento.js:33`, `metas.js`, `graficos.js`
4. `formatearMontoConDivisa(...)` - importado del servicio

**Impacto**: La misma cuenta puede mostrar `PEN` en un sitio y `Pen` en otro. Los `data-moneda` de los `<select>` sí van en minúsculas, lo que significa que la comparación depende de que cada punto de lectura aplique el `toLowerCase()` correcto.

**Solución propuesta**: Fijar `pen`/`usd`/`usdt` en minúsculas como única forma canónica en el modelo, y exponer una función de presentación única (`presentarDivisa`, que ya existe en `DivisaServicio.js:33`) como el **único** camino para mostrar. Banear `toUpperCase()`/`toLowerCase()` sobre `moneda` con una regla de linter.

### MD-3: 18 exports sin llamador (DEUDA-006)

**Evidencia**: 13 archivos con 18 exports que tienen cero referencias en todo el repositorio
- Ejemplos: `DivisaServicio.js:14` `getSimboloDivisaPrincipal`, `DivisaServicio.js:104` `formatearMontoEnPrincipal`, `MovimientoServicio.js:628` `obtenerMovimientosConFiltros`, etc.
- ~600 líneas de código muerto

**Impacto**: Código que se mantiene, lee y revisa sin aportar nada. `obtenerMovimientosConFiltros` hace creer que ese filtrado existe y funciona, cuando en realidad hay duplicado en el código de la página.

**Solución**: Eliminar los 18 exports o marcarlos explícitamente como API prevista. Activar un linter de exports sin usaría evitar la reincidencia.

### MD-4: `console.*` sin limpiar (DEUDA-010)

**Evidencia**: 218 llamadas en 35 archivos, distribución:
- `js/core/router.js`: 22
- `js/pages/dashboard.js`: 20
- `js/pages/inversiones.js`: 16
- `js/pages/cuentas.js`: 15
- `js/ui/configuracion.js`: 14
- `js/services/MovimientoServicio.js`: 13
- `js/pages/trading.js`: 13
- `js/core/pwa.js`: 9

**Impacto**: Ruido que entierra errores que sí importan. 3 `console.warn` silencian fallos no fatales:
- `dashboard.js:212` - "No se pudieron cargar las cards visibles del dashboard"
- `dashboard.js:3241` - "No se pudo registrar el snapshot" (histórico de patrimonio deja de crecer)
- `inversiones.js:1128` - "No se pudo obtener el historial" (gráfico vacío sin contexto)

**Solución**: Mantener solo `console.error` en manejadores de error; enviar el resto a logger mínimo con nivel `debug` desactivado por defecto en producción.

### MD-5: `dashboard.js` - console.* críticos sin limpiar

**Evidencia**:
- `dashboard.js:212` - "No se pudieron cargar las cards visibles del dashboard"
- `dashboard.js:3241` - "No se pudo registrar el snapshot" (el histórico de patrimonio deja de crecer y nada lo indica)

### MD-6: Ciclos de importación (5 detectados)

**Evidencia**: Todos giran alrededor de `notificaciones.js` como nodo central
- Modulos afectados: `movimientos.js`, `dashboard.js`, `configuracion.js`, `formularioMovimiento.js`, servicios múltiples

**Impacto**: Modificar una parte rompe otras inesperadamente; código difícil de seguir.

## 5.5 Oportunidades de Modularización

### Propuestas concretas (sin implementar):

1. **Split `dashboard.js`** (ver ETAPA 9):
   - `dashboard-estado.js`: estado y preferencias puras
   - `dashboard-render.js`: grid H2, dimensiones, normalización
   - `dashboard-interaccion.js`: eventos, arrastre, clicks
   - `dashboard.js`: orchestrator delgado

2. **Extraer lógica de subcuentas de `cuentas.js`**:
   - Mover `esHija`, `hijasDe`, `tieneHijas`, `familiaDe`, `saldoFamilia`, `esAbstracta` a su propio módulo
   - Beneficio: `dashboard.js` y `pages/index.js` también usarían esta lógica

3. **Modularizar `notificaciones.js`**:
   - Separar lógica de creación de notificaciones de UI/renderizado
   - Beneficio: Reducir acoplamiento con `movimientos.js` y otras páginas

4. **Crear `js/services/PatrimonioServicio.js`**:
   - Unificar cálculo de patrimonio que está parcialmente en `SnapshotServicio.js` y lógica de dashboard
   - Beneficio: Facilitar tests, clarificar responsabilidades, preparar migraciones M4-M5

5. **Dividir `configuracion.js`**:
   - `general.js`: preferencias generales (tema, formato, inactividad)
   - `appearance.js`: apariencia (escala, animaciones)
   - `accesibilidad.js`: accesibilidad
   - `configuracion.js`: orchestrator

## 5.6 Graphify Analysis (10/11/2026)

### God Nodes (mayor conectividad)
1. `contenidoDesdeTemplate()` - 160 edges
2. `mostrarNotificacion()` - 128 edges
3. `abrirModal()` - 101 edges
4. `Js` - 72 edges
5. `An` - 63 edges

### Communities (124 detectadas)
- 101 mostradas, 23 omitidas por ser "thin" (baja cohesión)
- Las comunidades con menor cohesión (0.03-0.07) probablemente son módulos terceros o símbolos sueltos

### Betweenness Centrality
- `cacheCapa` - 0.021 (nodo puente entre comunidades)
- `mostrarNotificacion()` - 0.020 (nodo puente)

### Import Cycles Detectados
- 2-cycle, 3-cycle (5 found), 4-cycle (2 found), 5-cycle (2 found)
- Patrón central: siempre `notificaciones.js` como intermediario

## 5.7 Estado de Decisiones Previas

### Resueltas (✅)
- DEUDA-001: `cambioDivisa` sin signo ni monto correctos - unificado `esMovimientoPositivo`
- DEUDA-002: Transferencias entre divisas - soportar `montoOrigen`/`montoDestino`/`tasa`
- DEUDA-002b: Transferencia con `tasa` y `montoDestino`
- DEUDA-003: `montoDeMovimiento` sin `cuentaId` - propagación con el unificado
- DEUDA-004: Tres copias de `esMovimientoPositivo` - una sola función
- DEUDA-009: Selectores CSS duplicados entre hojas - desduplicados + tests
- DEUDA-012: Asimetría `create`/`update` en reglas Firestore - validador compartido
- DEUDA-013: `hasOnly` desincronizado - vigilancia con tests
- DEUDA-024: Sin CI - `.github/workflows/test.yml` configurado

### Abiertas (⚠️)
- DEUDA-006: 18 exports sin llamador - identificar y eliminar
- DEUDA-010: 218 `console.*` sin limpiar - reducir a console.error solamente
- DEUDA-016: ~40 normalizaciones ad-hoc de moneda - 4 convenciones distintas
- DEUDA-014: Siete copias de función de formateo de fecha - consolidar en `js/core/fechas.js`
- DEUDA-017: "Configuración de brokers" botón en UI vacío - decidir ocultar/implementar
- DEUDA-018: Lastbar "Actualizar" no implementada - quitar o implementar
- DEUDA-011: `fechaRealizacion` como Date en 2 rutas, string en el resto - normalizar
- DEUDA-021: Sin scripts de lint/typecheck/CI - configurar en package.json
- DEUDA-025: `docs/requisitos.md` desfasado en 4 puntos - actualizar

### Decisiones del PO (suspendidas ETAPA 9)
- PO-1: Modularizar dashboard.js - decidir split 3 módulos vs mantener
- PO-2: Modularizar notificaciones.js - event bus pattern vs mantener actual
- PO-3: Continuar limpieza DEUDA-016 - abordar ahora o postergar
- PO-4: Actualizar `reporte-bugs.md` - reflejar BUG-029 como resuelto
- PO-5: Graphify en flujo de trabajo - agregar paso update a CI

## 5.8 Lint y Calidad de Código

### Configuración ESLint (.eslintrc.json o eslint.config.js)
- `no-unused-vars`: Detecta exports sin usar (DEUDA-006)
- `no-console`: Nivel `error` (máximo 1 console.error permitido), pero quedan ~7600 errores preexistentes
- `require-await`: En functions async sin await
- Shadow variables no intencionales

### Errores actuales (13 totales, 7 auto-correctibles)
Los 6 restantes requieren revisión manual.

### Cobertura de tests
- 113 tests suites esperadas
- 108 passing, 5 falling (por módulos scripts/ ausentes, no por lógica)
- Tests focalizados en: modelos (Meta, Pendiente, Trade), reglas Firestore, snapshot schema, precache

## 5.9 Seguridad y Secretos

### GEMINI_API_KEY
- Secreto privado, nuca debe exponerse en el cliente
- En desarrollo local: `.env.local` (fuera de Git)
- En producción: Google AI Studio / Secret Manager
- Debe usarse desde Cloud Function `drovProxy`, no directamente desde el cliente

### Firestore reglas
- `esPropietario(uid)` en toda operación
- `hasOnly` + `hasAll` en create/update
- Validación de tipos estrictos
- `config/{docId}`: `allow write: if false` (solo consola puede escribir)

### Datos sensibles en código
- Nunca introducir secrets en: `js/`, `firebase/`, archivos `*.html`, `tools/`, repositorios públicos, logs visibles para usuarios
- `firebaseConfig.apiKey` es pública por diseño

## 5.10 Dépendencias Circulares y Acoplamiento

### Principales ciclos detectados (Graphify)

1. **2-file**: `movimientos.js → notificaciones.js → movimientos.js`
2. **3-file × 5**: A través de `notificaciones.js` en el camino
3. **4-file × 2**: A través de `notificaciones.js`
4. **5-file × 2**: A través de `notificaciones.js`

### Nodos de alta betweenness
- `cacheCapa` (0.021): Conecta a ActivoRepositorio, OrdenRepositorio, MovimientoServicio, dashboard.js, ui/etiquetas.js, firebase/firestore.js, ImportarServicio, configuracion.js, FavoritoServicio, pages/movimientos.js, pendientes.js, firebase/auth.js, cache.js, HistorialRepositorio, ExportarServicio
- `mostrarNotificacion()` (0.020): Puente entre comunidades

### Impacto
- Modificar un módulo de alta betweenness requiere revisar efectos en muchos otros módulos
- Los ciclos de importación hacen difícil determinar qué carga primero, qué falla si hay error de carga

## 5.11 Recomendaciones de Prioridad

### CRÍTICO (bloqueantes)
1. Implementar CI mínimo (lint + tests en push/PR) - `DEUDA-021`
2. Rotar clave de Gemini (ya estuvo expuesta en cliente)
3. Verificar `PEND-001` (snapshot diario en producción)
4. Probar `PEND-002` (subcuentas) en navegador

### ALTA (mejoras significativas)
5. Split `dashboard.js` en 3 módulos (ETAPA 9)
6. Transformar `notificaciones.js` en event bus pattern
7. Abordar DEUDA-016 (normalizaciones de moneda)
8. Eliminar 18 exports sin usar (DEUDA-006)

### MEDIA (mantenimiento)
9. Consolidar 7 copias de formateo de fecha en una sola en `js/core/fechas.js`
10. Migrar `console.*` a logger estructurado
11. Normalizar `fechaRealizacion` tipo en todo el código

### BAJA (higiene)
12. Eliminar exports muertos identificados
13. Actualizar `docs/requisitos.md`
14. Decidir sobre botones "Configuración de brokers" vacíos