# REGISTRO DE DECISIONES DISPONIBLES

## 6.1 Decisiones Aprobadas (Confirmadas por Evidencia)

| ID | Decisión | Fecha | Evidencia | Impacto |
|----|----------|-------|-----------|---------|
| D-001 | Unificar `esMovimientoPositivo` en `js/core/movimientos.js` | 2026-10-05 | `git show 89d9f58`, código actual, tests | Eliminó 3 copias divergentes, fix BUG-024/025, base para DEUDA-001/003/004 |
| D-002 | Validación compartida `validarCamposMovimiento`/`validarCamposCuenta` en Firestore rules | Fase 3 | `firebase/firestore.rules`, `tests/reglas.test.mjs` | Resolvió asimetría create/update (DEUDA-012), create y update ahora usan mismas funciones validadoras |
| D-003 | Configurar CI/lint en `.github/workflows/` | 2026-10-12 | `.github/workflows/test.yml`, `package.json` scripts, `eslint.config.js` | Tests y lint se ejecutan en push/PR, previene regresiones silenciosas |
| D-004 | Migrar modales a templates HTML | Fase 3 | `js/ui/modal.js`, `tests/plantillas.test.mjs` (10/10), `contenidoDesdeTemplate()` | Elimina `innerHTML` con datos de usuario, mejora seguridad y mantenibilidad |
| D-005 | Cache estratégico por tipo de recurso en Service Worker | 2026-10-30 | `sw.js` reescrito, `INFORME_CACHES_SW.md` (31/31 tests OK) | JS/CSS nuevo en 1ª recarga, fuentes cache-first, offline funcional |
| D-006 | Normalizar divisas a minúsculas en modelo | Decisión arquitectónica | `constants/divisas.js`, `DivisaServicio.js`, todo el código JS | Canonicalización: `pen`, `usd`, `usdt`, `eur` siempre minúsculas en BD |
| D-007 | Sin persistence offline en Firestore (modo lectura directa) | 2026-10-30 | `firebase/firestore.js` línea 24-31 | Evita estado "offline permanente"; lecturas fallan rápido y UI muestra error claro |
| D-008 | Sistema de dos niveles de color (dark/light con variantes) | `DISENO.md` | `css/style.css` `:root`, `[data-theme="dark"]`, `[data-theme="light"]` | 10+ variables de color por tipo de activo/divisa con variantes por tema |
| D-009 | `esMovimientoPositivo` como función unificada con 4 ramas | 2026-10-05 | `js/core/movimientos.js`, importado por 3 páginas | `pagoTarjeta`, `cambioDivisa`, `transferencia`, `error` - todas en un solo lugar |
| D-010 | Preferencias de usuario con notación de punto en Firestore | `firebase/firestore.js` | `actualizarPreferencias()`, `aplicarPreferenciasDiff()` | `setDoc` con merge real, no borra campos no tocados (ej. `divisaPrincipal`) |

## 6.2 Decisiones Descartadas (No Implementadas)

| ID | Decisión | Opciones | Justificación | Estado |
|----|----------|----------|---------------|--------|
| D- pendiente | Split `dashboard.js` en 3 módulos | A) Mantener como está <br> B) Split 3 módulos (estado/render/interacción) <br> C) Split fino | La B ofrece mejor equilibrio; C podría sobre-engineerizar. Requiere aprobación para cambiar estructura de imports en todo el código. | **Suspendida** - ETAPA 9 esperando autorización PO |
| D- pendiente | Transformar `notificaciones.js` en event bus | A) Mantener ciclo actual <br> B) Event bus pattern | B rompe 5 ciclos importación, notificaciones becomes puro. Mejora mantenibilidad pero requiere tiempo de testing. | **Suspendida** - ETAPA 9 esperando autorización PO |
| D- pendiente | Eliminar 18 exports sin usar (DEUDA-006) | A) Eliminar ahora <br> B) Marcarlos como API prevista | A reduce JS sin usar y ruido de mantenimiento. Bajo riesgo, alto beneficio de higiene. | Pendiente - requiere autorización |
| D- pendiente | Actualizar `docs/reporte-bugs.md` (BUG-029) | A) Actualizar para marcar como resuelto <br> B) Dejar como documento histórico | A mantiene documentación alineada con código. B acepta desviación conocida. | Pendiente - documentación pendiente |
| D- pendiente | Graphify en flujo de CI | A) Agregar paso `graphify update .` <br> B) Usar esporádicamente <br> C) Descartar | A mantiene arquitectura visible; B suficiente para auditoría actual; C si se considera overhead innecesario. | **A aprobada en principio**, pendiente implementación en pipeline |

## 6.3 Decisiones Pendientes (ETAPA 9 - Solicitando PO)

| ID | Decisión | Opciones | Recomendación Basada en Evidencia | Impacto si se Pospone |
|----|----------|----------|-----------------------------------|-----------------------|
| PO-1 | **Modularizar `dashboard.js`** | A) Mantener como está (riesgo de degradación continua) <br> B) Split en 3 módulos (estado/render/interacción) <br> C) Split fino (componentes individuales) | **B**: Evidencia dashboard 4461 líneas difícil mantenimiento; split mantiene behavior H2 | Dashboard seguirá difícil mantener, nuevos bugs harder debug, nuevos agentes abrumados |
| PO-2 | **Modularizar `notificaciones.js`** | A) Dejar como está (acoplamiento aceptable) <br> B) Reestructurar para reducir dependencias circulares | **B**: Rompe 5 ciclos importación, notificaciones becomes puro | Continuará deuda arquitectónica, nuevos módulos harder integrar, bugs silenciosos |
| PO-3 | **Continuar limpieza DEUDA-016** | A) Abordar ahora (eliminar normalizaciones JS duplicadas) <br> B) Dejar para Fase 3/4 después de Etapa 8 | **A**: Mejora coherencia UI ahora; B pospone riesgo técnico | UI seguirá con formatos inconsistentes, usuarios pueden ver `PEN` en un sitio y `Pen` en otro |
| PO-4 | **Actualizar `reporte-bugs.md`** | A) Actualizar para reflejar BUG-029 como resuelto y estados reales <br> B) Dejar como documento histórico | **A**: Documentación debe alinearse con código que ya está corregido | Desviación conocida persists, nuevos agentes confundidos por docs obsoletas |
| PO-5 | **Graphify en flujo de trabajo** | A) Integrar paso de actualización de grafo en CI <br> B) Usar gráfico solo para esta auditoría <br> C) Descartar | **A**: Evidencia graphify detecta nodes God, cycles; herramienta valiosa para mantenimiento continuo | Pérdida herramienta análisis arquitectónico continuo, ciclos pueden pasar desapercibidos en futuros cambios |

## 6.4 Decisiones Históricas (Cerradas)

| ID | Decisión | Resultado |
|----|----------|-----------|
| D-011 | Mover `API_TIPO_CAMBIO` dentro de función en `DivisaServicio.js` | ✅ Corregido error ESM en tests F7.3 |
| D-012 | Migrar modales de `innerHTML` a `<template>` | ✅ 10/10 tests plantillas pass, UI más segura |
| D-013 | Deshabilitar persistence offline en Firestore | ✅ Evita estado offline permanente, lecturas fallan rápido |
| D-014 | Canonicalizar divisas a minúsculas en modelo | ✅ Sistema unificado: `pen`, `usd`, `usdt`, `eur` siempre minúsculas |
| D-015 | Unificar `formatearMontoConDivisa` - borrar copia en `cuentas.js` | ✅ `dashboard.js`, `configuracion.js`, `graficos.js` ya importan del servicio; falta `cuentas.js` |

## 6.5 Propias del Proyecto (Convenciones)

| Convención | Descripción | Documento Donde Está |
|------------|-------------|---------------------|
| Nomenclatura `plana`/`flash`/`drov` | En lugar de `basic`/`premium`/`admin | `ESTADO_Y_PROPUESTA.md:92-93`, `AGENTS.md:7` |
| Modelo de IA `drov` | Asistente transversal, integra Gemini | `js/services/DrovServicio.js`, `js/ui/asistente.js`, `js/core/iaConfig.js` |
| Sin bundler/compiler | ES Modules nativos en navegador | `package.json: "type": "module"` |
| Sin secretos en cliente | `GEMINI_API_KEY` nunca en código del cliente | `AGENTS.md:7`, `DrovServicio.js` usa `drovProxy` |
| Comentarios en español | Todo el código y documentación | Convención del proyecto |
| Fechas en formato `YYYY-MM-DD` | Strings, salvo en Firestore que son Timestamps | `fechas.js`, modelos, firestore.rules |
| Divisas en minúsculas en modelo | `pen`, `usd`, `usdt`, `eur` | `constants/divisas.js`, `DivisaServicio.js` |
| IDs kebab-case en HTML | `data-tpl`, selectores CSS | `DISENO.md:303` |
| Named exports preferidos | Sobre default exports | `AGENTS.md:193` |
| Core NO importa de Pages/Services/Repos | Límite de capa arquitectónica | `AGENTS.md:177` |