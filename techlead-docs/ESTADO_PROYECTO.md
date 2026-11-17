# ESTADO ACTUAL DEL PROYECTO

## 7.1 Versión y Fase

- **Versión**: `1.0.0-beta.34` (`constants/version.js:2`)
- **Fase**: `beta`
- **Fecha**: Nov 2026
- **Ultimo despliegue**: Ninguno (solo `firebase deploy --dry-run`)

## 7.2 Funcionalidades Implementadas

### Completo ✅

| Área | Características Principales |
|------|----------------------------|
| **Autenticación** | `firebase/auth.js`, `js/pages/auth.js`, `js/pages/reset-password.js`, sesión con cierre por inactividad (15 min) |
| **Cuentas** | Gestión de cuentas de usuario, múltiples divisas, subcuentas con `padreId`, saldoInicial, deuda, tipo (efectivo/banco/tarjeta) |
| **Movimientos** | Registro de ingresos, gastos, transferencias (entre divisas), cambio de divisa, compra/venta de activo, pago con tarjeta, error |
| **Metas de ahorro** | Creación de metas con monto objetivo, seguimiento de progreso (`porcentaje`, `montoRestante`, `completada`), 4 divisas soportadas |
| **Inversiones** | Registro de activos (BTC, ETH, etc.), posiciones con precio promedio, historial de precios |
| **Presupuestos** | Presupuestos mensuales/anuales, categorías del sistema o etiquetas usuario, seguimiento de gasto |
| **Patrimonio** | Snapshots diarios con desglose PEN/USD/USDT/EUR, liquidez, inversiones, deudas |
| **Trading** | Órdenes límite/stop, trades abiertos/cerrados, P&L calculation, tipo long/short |
| **Favoritos** | Plantillas de movimiento recurrente, 36/36 tests pass, último sistema de etiquetado tri-estado |
| **Configuración** | Tema oscuro/claro/sistema, formato divisa (simbolo/codigo), preferencias de notificación |
| **Lastbar** | Barra inferior navegación, siempre visible, `100dvh` + `viewport-fit=cover`, `safe-area-inset-bottom` |
| **Búsqueda global** | `abrirBuscadorGlobal` en `js/core/atajos.js`, lastbar `buscar` |
| **Notificaciones** | Centro de notificaciones, `js/ui/notificaciones.js`, eventos de sistema |
| **Service Worker** | Estrategias por tipo de recurso, 139 precache assets, offline fallback por rutas |
| **Landing page** | `index.html`, `home.css`, `js/pages/index.js` |
| **PWA** | `manifest.webmanifest`, `sw.js`, instalable en dispositivo móvil |

### Parcial ⚠️

| Área | Estado | Falta |
|------|--------|-------|
| **Trading** | Funcionalidades básicas operativas | Órdenes sin ejecución automática completa, comprobantes con IA |
| **IA (drov)** | Integración con Gemini básica | Orquestador completo, API económica, medir coste por plan, adaptación a planes |
| **Subcuentas** | Modelo implementado | QA en navegador (PEND-002) - "Funciona en los tests, nunca se ha ejecutado en la app" |
| **Service Worker offline** | Funciona en rutas SPA | No verificado end-to-end en producción real |
| **Matiz fino de divisas** | Sistema canonicalizado | Algunos puntos aún usan `toUpperCase()` local (`DEUDA-016`) |

### Pendiente ⏳

| Área | Tarea | Bloqueante |
|------|-------|------------|
| **PEND-001** | Confirmar snapshot diario en producción | Reglas e índice desplegados 2026-10-12, falta confirmar un día real |
| **PEND-002** | Probar subcuentas en navegador | Modelo implementado y testeado offline, nunca ejecutado en la app |
| **CI/lint configuración** | Corregir 6 errores lint restantes | 7 auto-correctibles, 3 manuales (`require-await`, shadow variables, no-unused-vars) |
| **Matriz de funciones por plan** | Definir qué puede hacer plana vs flash | No existe en el código |
| **Mecanismo de invitación beta** | Definir e implementar | No hay en el código actualmente |
| **Eliminar exports muertos** | 18 exports sin usar (DEUDA-006) | Reduce mantenimiento y confusión |

### Roto ❌ (Ya corregido en código, docs pendientes)

| Tarea | Estado en Código | Estado en Documentación |
|-------|------------------|------------------------|
| **BUG-029** (edición de movimientos) | ✅ Corregido en `js/pages/movimientos.js:1724-1753` | ❌ `docs/reporte-bugs.md` aún lo lista como Pendiente |
| **MODAL innerHTML** | ✅ Migración completada a templates | Documentación desactualizada en algunos lugares |

## 7.3 Funcionalidades Incompletas

### Fase 4 - Beta gratuita
- **Invitar 5-10 usuarios**: No hay mecanismo de invitación ni panel de beta en el código
- **Matriz de funciones por plan**: No definida - `plana`/`flash` sin límites diferenciados

### Fase 5 - Planes y comercial
- **Precios, suscripciones**: No hay rastro de precios ni suscripciones en el código
- **Coste IA**: `DrovServicio.js` mide coste pero sin plan de precios asociado

### Fase 6 - Funcionalidades y productividad
- **Pagos periódicos**: No hay rastro en el código
- **Calendario financiero**: No implementado
- **Calculadora integrada**: No implementada
- **Comparativas, informes**: No implementados
- **División de cuentas y propinas**: Solo anotado para evaluar

### Fase 7 - Cuentas compartidas
- **Roles, invitaciones, caducidad, permisos**: Solo diseño en `docs/propuesta-compartir-cuentas.md`, sin implementar en `firestore.rules` ni código
- **Patrimonio sin duplicar**: No abordado estructuralmente

### Fase 8 - Automatización e inversiones
- **Captura por correo**: No hay rastro de captura por correo ni bandeja bancaria
- **Comprobantes con IA**: No hay rastro de comprobantes con IA

### Fase 9 - drov (IA transversal)
- **Identidad, interfaz, voz**: Parcial - `DrovServicio.js`, `VozServicio.js`, `IaServicio.js`, `ContextoServicio.js`, lastbar `data-accion="asistente"`
- **Registro por lenguaje natural**: No hay rastro de registro completo
- **Acceso rápido Android/iPhone (widgets)**: No hay rastro
- **IA avanzada (comprobantes, clasificación)**: No implementado
- **Seguridad (claves servidor, límites, datos mínimos)**: Parcial - `DrovServicio.js` usa proxy de función en producción y clave en `.env.local` en localhost, pero clave ya estuvo expuesta en cliente (rotar obligatorio)

## 7.4 Defectos Conocidos

| ID | Descripción | Severidad | Estado |
|----|-------------|-----------|--------|
| BUG-029 | Edición de movimientos referenciaba `tipo` undefined | Ya corregido en código | Docs pendiente actualizar |
| DEUDA-011 | `fechaRealizacion` tipo inconsistente (Date vs string) | Media | Identificado, sin normalizar completo |
| DEUDA-016 | ~40 normalizaciones ad-hoc de moneda, 4 convenciones | Media | 4 convenciones distintas para mismo dato |
| DEUDA-014 | Siete copias de función formateo de fecha | Media | Consolidar en `js/core/fechas.js` |
| DEUDA-010 | 218 `console.*` sin limpiar | Baja | 3 silencian fallos reales |
| DEUDA-006 | 18 exports sin un solo llamador | Media | ~600 líneas muertas |
| DEUDA-017 | Botones "Configuración de brokers" abren modal vacío | Media | Decisión pendente: ocultar/implementar |
| DEUDA-018 | Lastbar "Actualizar" no implementada | Media | O implementar o quitar |
| DEUDA-025 | `docs/requisitos.md` desfasado en 4 puntos | Baja | Actualizar versión, inactividad, divisas, trading |

## 7.5 Roadmap y Etapas

### Etapas Activas / Pendientes

| Etapa | Enfoque | Estado |
|-------|---------|--------|
| **Etapa 9** | Reestructuración arquitectónica yestandarización | **Suspendida** esperando autorización PO |
| **Etapa 8** | Dashboard H2 | **Pausada** hasta establecer nuevas bases arquitectónicas (de la Etapa 9) |
| **Etapa 7** | Cuentas compartidas | Diseño pendiente, sin implementar |
| **Fase 4** | Beta gratuita - invitación usuarios | Bloqueante: no hay mecanismo de invitación |
| **Fase 5** | Planes y comercial | Pendiente: definir precios, matriz de funciones |
| **Fase 6** | Funcionalidades varias | Varios items pendientes (pagos calculadora, informes) |

### Etapas Anteriores Completadas

- **Etapas 1-3**: Estabilización, optimizaciones CSS, modales, lastbar, SW, favoritos
- **Etapa 4**: Inicio de beta, algunas funcionalidades básicas
- **Etapa 5-6**: Inversiones, trading básico, metas
- **Etapa actual**: Mantenimiento, corrección de deuda técnica, preparación para nueva fase

## 7.6 Métricas de Calidad

| Métrica | Valor | Metas |
|---------|-------|-------|
| Tests passing | 108/113 | 113/113 |
| Lint errors | 13 | 0 |
| Cobertura tests | ~70% (aprox) | 80%+ |
| God nodes (Graphify) | 3 identificados | Reducir por modularización |
| Import cycles | 5 (todos por notificaciones.js) | 0 |
| Communities (Graphify) | 124 detectadas | - |
| BUILD_ID | Generado por `tools/generar-build.mjs` | Usar en nombres de caché SW |

## 7.7 Pendientes Críticos para Novo Tech Lead (Kimi)

1. **Aprobar o rechazar decisiones ETAPA 9** (PO-1 a PO-5)
2. **Definir estrategia de migración de `DEUDA-016`** (normalizaciones de moneda)
3. **Priorizar limpieza de `console.*`** (DEUDA-010) - 3 warnings silencian fallos reales
4. **Decidir sobre `dashboard.js` split** - el archivo más grande y complejo del proyecto
5. **Actualizar `docs/reporte-bugs.md`** para reflejar BUG-029 como resuelto
6. **Rotar clave de Gemini** - fue expuesta en entorno cliente, obligatoria antes de producir
7. **Definir mecanismo de invitación beta** - requisito previo a Fase 4
8. **Verificar `PEND-001` y `PEND-002`** - snapshots y subcuentas en navegador

## 7.8 Próximos Pasos Recomendados

1. **Reunión de handoff con PO** para aprobar/desaprobar decisiones ETAPA 9
2. **Si se autoriza ETAPA 9**: Comenzar por split `dashboard.js` y transformar `notificaciones.js`
3. **Corregir los 6 errores de lint restantes** para dejar lint 0 errores
4. **Actualizar `docs/requisitos.md`** con versión actual, inactividad real, divisas completas
5. **Rotar GEMINI_API_KEY** en Google AI Studio antes de cualquier despliegue a producción
6. **Ejecutar `npm test`** y `npm run lint` para baseline actual
7. **Revisar `pendientes.md`** y abordar los items PEND-001 y PEND-002