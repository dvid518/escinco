# MAPA DE MÓDULOS DE ESCINCO

## 3.1 Estructura por Capas

### Capa: Core (`js/core/`)
| Archivo | Líneas | Exportaciones Principales | Dependencias |
|---------|--------|--------------------------|--------------|
| `movimientos.js` | 75 | `esMovimientoPositivo(m, cuentaId)`, `montoDeMovimiento(m, cuentaId)`, `compararMovimientosPorFecha(a, b)` | Ninguna (módulo puro) |
| `cache.js` | 389 | `cacheCapa.obtener()`, `cacheCapa.invalidar()`, `cacheCapa.parchear()`, `cacheCapa.limpiar()`, `cacheCapa.estadisticas()`, `revivirTimestamps()` | `js/core/descarga.js` |
| `tema.js` | 222 | `aplicarTema()`, `cambiarTema()`, `cambiarTemaLocal()`, `ciclarTema()`, `initTemaLocal()`, `getTemaLocal()`, `setTemaLocal()` | `firebase/firestore.js` (solo en `guardarTemaFirestore`) |
| `fechas.js` | 42 | `getFechaHoy()`, `parseFechaLocal()`, `fechaLocalISO()` | Ninguna (módulo puro) |
| `router.js` | 525 | Enrutamiento SPA, gestión de páginas | `js/core/lastbar.js` |
| `sesion.js` | 389 | `sesion`, `getPreferencias()`, `setPreferencias()`, validación sesión | `firebase/auth.js` |

### Capa: Models (`js/models/`)
| Archivo | Exportaciones Principales | Validaciones Clave |
|---------|--------------------------|-------------------|
| `Meta.js` | Clase `Meta` con getters `porcentaje`, `montoRestante`, `completada`, `estadoTexto` | `DIVISAS_META` = ["pen", "usd", "usdt"], validar nombre/monto/divisa |
| `Pendiente.js` | Clase `Pendiente` con getters `tipoTexto`, `tipoClase`, `estaVencido`, `estaPendiente`, `estaConsolidado`, `diasHastaVencimiento` | `concepto` obligatorio, `monto > 0`, `divisa` obligatoria |
| `Trade.js` | Clase `Trade` con getters `pnl`, `pnlPorcentaje`, `esGanancia`, `esPerdida`, `estaAbierto`, `estaCerrado` | `activo` obligatorio, `entrada > 0`, `lotaje > 0`, `tipo` = long/short |
| `Activo.js` | Clase `Activo` | Validación de nombre/simbolo/tipo/últimoPrecio |
| `Favorito.js` | Clase `Favorito` | Validación de nombre, tipo, cuenta, monto, divisa, concepto, etiquetas |
| `Presupuesto.js` | Clase `Presupuesto` | Validación de nombre, monto, divisa, período |

### Capa: Services (`js/services/`)
| Archivo | Líneas | Responsabilidad Principal |
|---------|--------|---------------------------|
| `MovimientoServicio.js` | ~4000+ | Lógica de movimientos, batches de saldos, TRANSFERENCIA, CAMBIO_DIVISA, COMPRA/VENTA ACTIVO |
| `DivisaServicio.js` | ~4000+ | Formateo de divisa (`presentarDivisa`, `formatearMontoConDivisa`), conversión de tipos de cambio, `getDivisaPrincipal()`, `getFormatoDivisa()` |
| `AuthServicio.js` | - | Autenticación de sesión |
| `SnapshotServicio.js` | - | Snapshots patrimoniales diarios |
| `CreditoServicio.js` | - | Cálculo y notificación de créditos |
| `EstrategiaServicio.js` | - | Gestión de estrategias de inversión |
| `OrdenServicio.js` | - | Órdenes límite/stop |
| `PosicionServicio.js` | - | Posiciones de activos |
| `PresupuestoServicio.js` | - | Presupuestos periocicos |
| `FavoritoServicio.js` | - | Favoritos/plantillas de movimiento |
| `ImportarServicio.js` | - | Importación de respaldos (.dvid) |
| `ExportarServicio.js` | - | Exportación de respaldos (.dvid) |
| `VozServicio.js` | - | Integración de voz/asistente |
| `ContextoServicio.js` | - | Contexto para IA drov |
| `IaServicio.js` | - | Orquestación de IA |

### Capa: Repositories (`js/repositories/`)
| Archivo | Responsabilidad |
|---------|----------------|
| `MovimientoRepositorio.js` | CRUD movimientos, obtención con cache |
| `CuentaRepositorio.js` | CRUD cuentas, normalización de nombres |
| `MetaRepositorio.js` | CRUD metas de ahorro |
| `PendienteRepositorio.js` | CRUD pendientes |
| `PosicionRepositorio.js` | CRUD posiciones de activos |
| `PrecioRepositorio.js` | CRUD precios de activos |
| `PresupuestoRepositorio.js` | CRUD presupuestos |
| `TradeRepositorio.js` | CRUD trades |
| `FavoritoRepositorio.js` | CRUD favoritos |
| `ActivoRepositorio.js` | CRUD activos + historial precios |
| `SnapshotRepositorio.js` | CRUD snapshots patrimoniales |

### Capa: UI (`js/ui/`)
| Archivo | Líneas | Componente |
|---------|--------|------------|
| `modal.js` | 602 | Modales reutilizables con templates HTML |
| `notificaciones.js` | 283 | Centro de notificaciones (patrón event bus propuesto) |
| `graficos.js` | 467 | Visualizaciones Chart.js |
| `metas.js` | 574 | UI de metas de ahorro |
| `presupuestos.js` | 332 | UI de presupuestos |
| `configuracion.js` | 1594 | Preferencias de interfaz |
| `accionesLista.js` | - | Lista de acciones |
| `seleccion.js` | - | Selección de items |
| `scrollEdges.js` | - | Manejo de scroll edges |
| `doodles.js` | - | Animaciones decorativas |

### Capa: Pages (`js/pages/`)
| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `dashboard.js` | 4461 | Dios object - orquestación + rendering + eventos (objetivo ETAPA 9) |
| `cuentas.js` | 2398 | Gestión de cuentas de usuario |
| `movimientos.js` | 1905 | Lista y detalle de movimientos |
| `inversiones.js` | 1292 | Gestión de inversiones |
| `trading.js` | - | Trading de activos |
| `configuracion.js` | 1594 | Preferencias UI |
| `auth.js` | - | Autenticación página |
| `index.js` | - | Landing page |
| `pendientes.js` | - | Pendientes por consolidar |

### Capa: Constants (`constants/`)
| Archivo | Contenido |
|---------|-----------|
| `version.js` | VERSION.numero, VERSION.nombre, getVersionLabel(), getVersionInfo() |
| `divisas.js` | DIVISAS = {PEN, USD, USDT, EUR}, DIVISAS_LABELS, DIVISAS_SYMBOLS, DIVISAS_DECIMALS, DIVISAS_PALABRAS, ORDEN_DIVISAS, CRIPTOMONEDAS, TIPO_CAMBIO_DEFAULT |
| `tiposMovimiento.js` | TIPOS_MOVIMIENTO, CONFIG_MOVIMIENTOS (definición de campos obligatorios/opcionales por tipo) |

## 3.2 Módulos Críticos y sus Consumidores

### `dashboard.js` (4461 líneas)
**Consumido por**: Toda la página dashboard, lastbar, y potencialmente todas las páginas mediante imports
**Problema**: Concentra estado, renderizado, interacción, carga de datos, preferencias
**Propuesta ETAPA 9**: Split en `dashboard-estado.js`, `dashboard-render.js`, `dashboard-interaccion.js`, y `dashboard.js` orchestrator delgado

### `notificaciones.js` (283 líneas)
**Consumido por**: `movimientos.js`, `dashboard.js`, `configuracion.js`, `formularioMovimiento.js`, servicios múltiples
**Problema**: 5 ciclos de importación giran alrededor de este módulo
**Propuesta ETAPA 9**: Transformar a patrón Event Bus

### `cacheCapa` (389 líneas)
**Consumido por**: `js/core/cache.js` es importado por múltiples repositorios y servicios
**Patrón**: `obtener(uid, clave, fn)` - cacheo memoria+localStorage con TTL, deducción de peticiones en vuelo, invalidación tras writes

### `DivisaServicio.js`
**Consumido por**: `cuentas.js`, `dashboard.js`, `movimientos.js`, `metas.js`, `graficos.js`, `formularioMovimiento.js`
**Funciones clave**: `presentarDivisa()`, `formatearMontoConDivisa()`, `getDivisaPrincipal()`, `getFormatoDivisa()`, `etiquetaDivisa()`

### `firebase/firestore.js`
**Consumido por**: `js/services/` (todos), `js/repositories/` (todos), `js/core/firestore.js` (único punto de acceso Firebase)
**Regla**: Nunca importar directamente en páginas/core. Punto único de acceso a Firestore.

## 3.3 Módulos Reutilizables (CSS)

### Clases en `css/componentes.css`
| Clase | Uso |
|-------|-----|
| `.badge` | Etiquetas tipo pastilla |
| `.badge--positive` | Variante positiva |
| `.badge--negative` | Variante negativa |
| `.badge--aviso` | Variante de aviso |
| `.badge--border` | Con borde |
| `.badge--interactivo` | Clicable con cursor/hover/foco |
| `.card-item` | Card base para listas |
| `.card-item.seleccionado` | Estado seleccionado |
| `.btn-sm` | Botón compacto |
| `.btn-xs` | Botón muy compacto |
| `.btn-danger` | Botón de peligro |
| `.lista-cards` | Contenedor de lista de cards |
| `.panel-header` | Cabecera de panel |
| `.totales` | Fila de totales |
| `.notificacion` | Notificación flotante |
| `.chip-etiqueta` | Chip de etiqueta |
| `.resumen-card` | Card de resumen de cifras |
| `.aporte-progreso` | Barra de progreso |
| `.desact` | Utilidad para desactivar elementos |
| `.lista-vacia` | Estado de lista vacía |

### Tokens en `css/style.css`
- Variables `--onyx`, `--graphite`, `--frostedGraphite`, `--slateGrey`, etc.
- Variables de tipografía `--font-primary`, `--font-secondary`
- Variables de color por tipo de activo y divisa

## 3.4 Módulos Pendientes (Scripts)

Los 5 tests que fallan en `npm test` son por módulos en `scripts/` que aún no están completamente integrados o tienen dependencias faltantes. Estos no forman parte del código fuente principal pero afectan la cobertura de tests.