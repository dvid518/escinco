# MODELO DE DATOS DE ESCINCO

## 4.1 Esquemas de Firestore

### Estructura por usuario: `usuarios/{uid}`

Cada usuario tiene un documento raíz con sus preferencias y colecciones anidadas.

#### `usuarios/{uid}` - Documento raíz
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `email` | string | Email del usuario |
| `nombre` | string | Nombre del usuario |
| `fechaRegistro` | timestamp | Fecha de registro |
| `preferencias` | map | Preferencias del usuario (tema, formatoDivisa, divisaPrincipal, tipoCambio, etc.) |

#### `usuarios/{uid}/cuentas/{cuentaId}` - Cuentas
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | string | Nombre de la cuenta |
| `tipo` | string | "efectivo", "banco", "tarjeta-debito", "tarjeta-de-cambio", "exchange" |
| `moneda` | string | Divisa en minúsculas: "pen", "usd", "usdt", "eur" |
| `saldoInicial` | number | Saldo actual de la cuenta |
| `estado` | string | "activa", "inactiva" |
| `esPatrimonio` | boolean | Si cuenta cuenta para el patrimonio total |
| `deuda` | number | Deuda asociada (cuentas tipo crédito) |
| `limite` | number | Límite de gasto o crédito |
| `desgravamen` | number | Gravamen sobre la cuenta |
| `diaCorte` | string | Formato "MM-DD" día corte de cuenta |
| `diaPago` | string | Formato "MM-DD" día pago |
| `orden` | number | Orden de visualización (≥ 0) |
| `anualidad` | number | Monto anualidad (si aplica) |
| `anualidadFecha` | string | Formato "MM-MM" fecha anualidad |
| `avisoUsoEnviado` | boolean | Si ya se avisó del uso |
| `avisoCriticoEnviado` | boolean | Si ya se avisó del crítico |
| `num` | string | Número de cuenta |
| `cci` | string | CódigoCuentaClave Internacional |
| `vence` | string | Fecha de vencimiento |
| `padreId` | string | ID de cuenta padre (para subcuentas) |
| `uid` | string | ID del usuario dueño |
| `subcuentas` | map | Subcuentas por divisa: { habilitadas: [ ... ] } |
| `esAbstracta` | boolean | Cuenta base sin divisa/saldo propios |

**Reglas Firestore**: `validarCamposCuenta()` - validación compartida create/update (DEUDA-012)

#### `usuarios/{uid}/movimientos/{movimientoId}` - Movimientos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tipo` | string | Tipo de movimiento (ingreso, gasto, transferencia, cambioDivisa, compraActivo, ventaActivo, p2pCompra, p2pVenta, compraTarjeta, pagoTarjeta, error) |
| `cuenta` | string | ID de la cuenta afectada |
| `concepto` | string | Concepto del movimiento |
| `monto` | number | Monto principal |
| `divisa` | string | Divisa en minúsculas: "pen", "usd", "usdt", "eur" |
| `fechaRealizacion` | string \| timestamp | Fecha del movimiento (formato YYYY-MM-DD o Date) |
| `fechaRegistro` | timestamp | Fecha de registro en Firestore (siempre) |
| `cuentaOrigen` | string \| null | Cuenta origen (transferencia, cambioDivisa) |
| `cuentaDestino` | string \| null | Cuenta destino (transferencia, cambioDivisa) |
| `montoOrigen` | number \| null | Monto en divisa origen (cambioDivisa, transferencia entre divisas) |
| `montoDestino` | number \| null | Monto en divisa destino (cambioDivisa, transferencia entre divisas) |
| `tasa` | number \| null | Tasa de cambio explícita |
| `activo` | string \| null | Símbolo de activo (compra/venta P2P, trading) |
| `cantidad` | number \| null | Cantidad de activo (P2P, trading) |
| `precio` | number \| null | Precio por unidad del activo |
| `comision` | number \| null | Comisión asociada |
| `exchange` | string \| null | ID exchange (P2P trading) |
| `nombreVendedor` | string \| null | Nombre vendedor (P2P) |
| `nombreComprador` | string \| null | Nombre comprador (P2P) |
| `cuentaPago` | string \| null | Cuenta de pago (P2P) |
| `cuentaCobro` | string \| null | Cuenta de cobro (P2P) |
| `tarjeta` | string \| null | ID tarjeta (compra con tarjeta) |
| `metaId` | string \| null | ID meta asociada (si aplica) |
| `operacion` | string \| null | Tipo operación (P2P) |
| `etiquetas` | list | Lista de etiquetas de catálogo (hasta 20, suma ≤ 480 chars) |
| `favoritoId` | string \| null | ID favorito plantilla (si se derivó de una) |

**Reglas Firestore**: `validarCamposMovimiento()` - validación completa con `hasOnly` + tipos. La lista `hasOnly` debe mantenerse sincronizada con `CONFIG_MOVIMIENTOS` (constants/tiposMovimiento.js).

#### `usuarios/{uid}/etiquetas/{etiquetaId}` - Etiquetas (catálogo usuario)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | string | Nombre de la etiqueta (hasta 24 chars) |
| `color` | string | Color del catálogo: "verde", "rojo", "ambar", "azul", "menta", "frambuesa", "mostaza", "cielo" |
| `esPrincipal` | boolean | Si es la etiqueta principal |
| `fechaCreacion` | timestamp | Cuándo fue creada |

#### `usuarios/{uid}/favoritos/{favoritoId}` - Favoritos (plantillas)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | string | Nombre de la plantilla |
| `tipo` | string | Tipo de movimiento (ingreso, gasto, etc.) |
| `cuenta` | string | Cuenta por defecto |
| `monto` | number | Monto por defecto |
| `divisa` | string | Divisa por defecto |
| `concepto` | string | Concepto por defecto |
| `etiquetas` | list | Lista de etiquetas del catálogo |
| `fechaCreacion` | timestamp | Cuándo fue creado |

#### `usuarios/{uid}/presupuestos/{presupuestoId}` - Presupuestos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | string | Nombre del presupuesto |
| `monto` | number | Monto asignado |
| `divisa` | string | Divisa del presupuesto |
| `periodo` | string | "mensual" o "anual" |
| `fechaInicio` | timestamp | Fecha de inicio del período |
| `categoria` | string \| null | Categoría del sistema o etiqueta |
| `etiquetas` | list | Lista de etiquetas del usuario |
| `activa` | boolean | Si el presupuesto está activo |
| `fechaCreacion` | timestamp | Cuándo fue creado |

#### `usuarios/{uid}/posiciones/{posicionId}` - Posiciones de activo
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `activoId` | string | ID del activo |
| `cantidad` | number | Cantidad total de unidades |
| `divisa` | string | Divisa del precio promedio |
| `precioPromedio` | number | Precio promedio de compra |
| `ultimaActualizacion` | timestamp | Última actualización de la posición |

#### `usuarios/{uid}/metas/{metaId}` - Metas de ahorro
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | string | Nombre de la meta |
| `montoObjetivo` | number | Monto objetivo a alcanzar |
| `montoActual` | number | Monto ahorrado hasta ahora |
| `divisa` | string | Divisa en minúsculas: "pen", "usd", "usdt" |
| `fechaLimite` | timestamp \| null | Fecha límite para completar la meta |
| `activa` | boolean | Si la meta está activa |
| `icono` | string | Ícono asociado (ej. "target") |
| `fechaCreacion` | timestamp | Cuándo fue creada |

#### `usuarios/{uid}/snapshots/{fecha}` - Snapshots patrimoniales
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `patrimonioPEN` | number | Patrimonio en PEN |
| `patrimonioUSD` | number | Patrimonio en USD |
| `patrimonioUSDT` | number | Patrimonio en USDT (opcional, desde dejó de escribirse: idéntico a USD) |
| `liquidezPEN` | number | Liquidez en PEN |
| `liquidezUSD` | number | Liquidez en USD |
| `inversionesPEN` | number | Inversiones en PEN |
| `inversionesUSD` | number | Inversiones en USD |
| `inmovilPEN` | number | Inmovilizado en PEN |
| `inmovilUSD` | number | Inmovilizado en USD |
| `deudasPEN` | number | Deudas en PEN |
| `deudasUSD` | number | Deudas en USD |
| `cerrado` | boolean | Si el snapshot está cerrado (histórico) |
| `actualizacion` | timestamp | Cuándo fue la última actualización |
| `schemaVersion` | number | Versión del esquema (actual: 1) - tolera v0 para compatibilidad con históricos |

**Reglas Firestore**: `hasOnly` definido (líneas 494-498), validación de tipos numéricos, `ifPresenteNumeroONulo` para `patrimonioUSDT`.

#### `usuarios/{uid}/trades/{tradeId}` - Trades (órdenes trading)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `activo` | string | Símbolo del activo (ej. "BTC", "ETH") |
| `cuenta` | string | Cuenta donde se ejecutó la orden |
| `entrada` | number | Precio de entrada |
| `salida` | number \| null | Precio de salida (si está cerrado) |
| `lotaje` | number | Cantidad de unidades |
| `sl` | number \| null | Stop loss |
| `tp` | number \| null | Take profit |
| `tipo` | string | "long" o "short" |
| `estado` | string | "abierto" o "cerrado" |
| `divisa` | string | Divisa del trade (usd, pen, usdt, eur) |
| `ordenId` | string \| null | ID de la orden asociada |
| `fechaRegistro` | timestamp | Fecha de registro |
| `fechaCierre` | timestamp \| null | Fecha de cierre (si está cerrado) |
| `nota` | string \| null | Nota libre (puede estar AUSENTE, no null) |

**Reglas Firestore**: `hasOnly` incluye `nota`, pero usa `ifPresenteTextoONulo` para tolerar que falta.

#### `usuarios/{uid}/ordenes/{ordenId}` - Órdenes (limit/stop)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `activo` | string | Símbolo del activo |
| `cuenta` | string | Cuenta donde se coloca la orden |
| `tipoOrden` | string | "limit" o "stop" |
| `direccion` | string | "comprar" o "vender" |
| `precioDisparo` | number | Precio de disparo |
| `lotaje` | number | Cantidad de unidades |
| `sl` | number \| null | Stop loss |
| `tp` | number \| null | Take profit |
| `divisa` | string | Divisa de la orden |
| `nota` | string \| null | Nota libre (puede estar AUSENTE) |
| `estado` | string | "pendiente", "ejecutada", "cancelada" |
| `tradeId` | string \| null | ID trade asociado (si la orden se ejecutó) |
| `precioEjecucion` | number \| null | Precio de ejecución |
| `fechaCreacion` | timestamp | Fecha de creación |
| `fechaEjecucion` | timestamp \| null | Fecha de ejecución |

#### `usuarios/{uid}/activos/{activoId}` - Activos por usuario
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | string | Nombre del activo |
| `simbolo` | string | Símbolo (ej. "BTC", "ETH") |
| `tipo` | string | Tipo de activo |
| `ultimoPrecio` | number | Último precio conocido |
| `ultimaActualizacion` | timestamp | Cuándo se actualizó el precio |
| `favorito` | boolean | Si es favorito del usuario |
| `fuente` | string \| null | Fuente del dato ("api", "manual", etc.) |
| `apiSimbolo` | string \| null | Símbolo desde API externa |

#### `usuarios/{uid}/historial/{fecha}` - Historial de precios de activo
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `fecha` | string | Formato "YYYY-MM-DD" |
| `precio` | number | Precio en esa fecha |
| `cerrado` | boolean | Si la posición está cerrada |
| `actualizacion` | timestamp | Cuándo se registró el precio |

#### `/config/{docId}` - Configuración global (solo lectura, escritura consola)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Varios | Varios | Configuración global del sistema |

## 4.2 Campos por Divisa (Canonicalización)

El modelo canonicaliza las divisas a minúsculas en todo momento:

| Divisa | Código Canónico | Símbolo | Palabra |
|--------|----------------|---------|---------|
| PEN | `pen` | `S/` | "SOLES" |
| USD | `usd` | `$` | "DÓLARES" |
| USDT | `usdt` | `₮` | "USDT" |
| EUR | `eur` | `€` | "EUROS" |

**Regla**: Siempre usar minúsculas en el modelo (`divisa` field en Firestore). Las mayúsculas solo para visualización en UI a través de `DivisaServicio.js`.

## 4.3 Validaciones Principales

### Por modelo de clase:

**Meta.validar()**:
1. `nombre` no vacío
2. `montoObjetivo > 0`
3. `montoActual >= 0`
4. `divisa` en ["pen", "usd", "usdt"]
5. Retorna `true` si todas las validaciones pasan

**Pendiente.validar()**:
1. `concepto` no vacío
2. `monto > 0`
3. `divisa` definida (no vacía)
4. Retorna `true` si todas las validaciones pasan

**Trade.validar()**:
1. `activo` no vacío
2. `entrada > 0`
3. `lotaje > 0`
4. `tipo` es "long" o "short"
5. Retorna `true` si todas las validaciones pasan

### Validaciones Firestore (rules)

- `hasOnly()`: Cada colección define qué campos puede tener el documento
- `hasAll()`: Campos obligatorios mínimos
- `esNumero()`, `esTexto()`, `esBool()`, `esTimestamp()`: Validadores de tipo
- `esColorEtiqueta()`: Valida que el color esté en la paleta permitida
- `esListaEtiquetas()`: Hasta 20 etiquetas, suma de chars ≤ 480
- `ifPresente*()`: Validación condicional - solo si el campo está presente (para no romper docs legacy)

## 4.4 Contratos entre Módulos

### `cacheCapa.obtener(uid, clave, fn, opciones)`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `uid` | string | ID de usuario (opcional: sin uid usa sesión actual) |
| `clave` | string | Clave identificadora del dato |
| `fn` | function | Función fetch que retorna Promise<datos> |
| `opciones` | object | Opcionales: `ttl` (default 5 min) |

**Retorna**: `Promise<datos>` - los datos cacheados o fetcheados

**Comportamiento**:
1. Revisa caché memoria (`Map`)
2. Si expirado o vacío, revisa localStorage
3. Si persistido, usa y actualiza caché memoria
4. Si no hay cache, ejecuta `fn()` y guarda en caché + localStorage
5. Dedupea peticiones concurrentes (`enVuelo` Map)

### `DivisaServicio.presentarDivisa(moneda)`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `moneda` | number \| string | Moneda a formatear (opcional, usa divisa principal si undefined) |

**Retorna**: `string` - representación visual de la divisa
- Si formato "codigo": `"USD"`, `"PEN"`, etc.
- Si formato "simbolo": `"$"`, `"S/"`, `"₮"`, `"€"`
- Monedas fuera de las base: muestra código en mayúsculas

### `Meta.fromFirestore(id, data)`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID del documento |
| `data` | object | Datos desde Firestore |

**Retorna**: `new Meta({...})` - instancia de Meta con validación y getters

**Mapeo**: `divisa` se normaliza con `.toLowerCase()` en constructor.

### `Pendiente.fromFirestore(id, data)`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID del documento |
| `data` | object | Datos desde Firestore |

**Retorna**: `new Pendiente({...})` - instancia de Pendiente

**Mapeo**: `fechaRegistro` y `fechaVencimiento`/`fechaConsolidacion` se reviven con `.toDate?.()`.

### `Trade.fromFirestore(id, data)`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID del documento |
| `data` | object | Datos desde Firestore |

**Retorna**: `new Trade({...})` - instancia de Trade

**Mapeo**: `fechaRegistro` revivido con `.toDate?.()`. `fechaCierre` idem. Campo `nota` tolera estar ausente.

## 4.5 Estrategias de Persistencia y Sincronización

### Niveles de cache

1. **Sin caché** (modo estricto): `cacheCapa.obtener(uid, clave, fn, { ttl: 0 })` → siempre ejecuta `fn()`
2. **Caché memoria solo**: Dedupe de peticiones en vuelo, TTL de 5 min
3. **Caché memoria + localStorage**: Sobrevive recargas y cambio de pestaña
4. **Persistencia Firestore**: Datos estructurados con reglas de seguridad

### Flujo de escritura

1. **Servicio** (`MovimientoServicio.js`, etc.) escribe en Firestore vía `addDoc()`/`updateDoc()`
2. **Cache invalidation**: `cacheCapa.invalidar(uid, clave)` después de cada escritura
3. **Parcheo optimizado** (movimientos): `cacheCapa.parchear()` agrega/elimina un movimiento en lugar de invalidar toda la colección
4. **Notificación entre pestañas**: `notificarOtrasPestanas()` escribe sentinel en localStorage; otras pestañas escuchan evento `storage` y aplican invalidación

### Sincronización de tema

1. **Local primero**: `getTemaLocal()` → `localStorage` → aplicar inmediatamente
2. **Remoto**: `sincronizarTemaFirestore(uid, temaRemoto)` → Firestore si hay uid
3. **Sistema operativo**: `prefers-color-scheme` media query como fallback
4. **Ciclado**: `ciclarTema(uid)` → cambia al siguiente en orden: dark → light → system → dark

## 4.6 Datos Heterogéneos y Migraciones

### Problemas conocidos

1. **`fechaRealizacion` tipo inconsistente**: Algunas rutas escriben `Date` (que Firestore convierte a `Timestamp`), otras escriben string `"YYYY-MM-DD"`. El lector debe comprobar el tipo.
   - *Ubicaciones Date*: `js/pages/inversiones.js`, `js/services/MovimientoServicio.js:19-25`
   - *Ubicaciones string*: Rutas generales, la mayoría de movimientos

2. **`schemaVersion` en snapshots**: 
   - Versión 1: Tiene campos completos
   - Versión 0: Antiguos, puede falta `patrimonioUSDT`, `liquidez*` some fields
   - El código tolera v0 y rellena valores undefined con 0 o valores por defecto

3. **`patrimonioUSDT`**: Desde que dejó de escribirse (normaliza USDT = USD), el campo puede estar ausente en documentos nuevos. Las reglas usan `ifPresenteNumeroONulo` para no fallar al leer docs viejos que sí lo tienen.

4. **Subcuentas `padreId`**: Implementado pero algunas rutas aún no lo usan consistentemente. El modelo soporta cuentas abstractas sin divisa/saldo propios.

## 4.7 IDs Personalizados

- **Movimientos**: ID generado por Firestore `addDoc()` (auto ID) o personalizado si se usa `setDoc()` con ID específico
- **Metas**: ID personalizado (`metaId`) que es la clave del documento
- **Etiquetas**: ID personalizado (`etiquetaId`) - nombre de la etiqueta
- **Favoritos**: ID personalizado (`favoritoId`) - nombre de la plantilla
- **Presupuestos**: ID personalizado (`presupuestoId`)
- **Posiciones**: ID personalizado (`posicionId`)
- **Órdenes**: ID personalizado (`ordenId`)
- **Trades**: ID personalizado (`tradeId`)
- **Snapshots**: ID por fecha (`fecha` en formato, ej. "2026-10-20")

**Nota**: Los repositorios a veces generan IDs personalizados y a veces usan los de Firestore. El patrón depende de la colección específica y del método (`addDoc` vs `setDoc`).

## 4.8 Datos Personales

Los datos personales (nombre, email, saldos, movimientos) permanecen bajo la estructura `usuarios/{uid}`. El acceso está restringido mediante reglas `esPropietario(uid)`. Las reglas de Firestore aseguran que un usuario solo pueda leer/escribir sus propios datos.

Los datos financieros (montos, divisas, tipos de movimiento) son el núcleo del modelo y están sujetos a validación de tipos y campos obligatorios.

Los datos de IA/contexto (preferencias de tema, configuraciones) también están bajo `usuarios/{uid}/preferencias`.