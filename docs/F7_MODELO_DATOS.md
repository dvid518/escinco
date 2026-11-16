# F7_MODELO_DATOS.md — Modelo de datos Firestore final

## 1. Esquema de `cuentas`

### 1.1 Campos obligatorios y semántica

| Campo | Tipo | Semántica | Valores esperados |
|-------|------|-----------|-------------------|
| `tipo` | string | Rol de la cuenta | `banco`, `efectivo`, `broker`, `exchange`, `plazo`, `debito`, `credito` |
| `padreId` | string | Referencia a contenedor padre | `null` para cuentas simples; ID padre para contenedores multidivisa |
| `esAbstracta` | boolean | Indica contenedor sin saldo propio | `true` para exchange/padre abstracto; `false` para cuentas operativas |
| `esPatrimonio` | boolean | Si el efectivo cuenta para patrimonio | `true` por defecto; `false` para pestañas cripto exchange |
| `tieneNombrePropio` | boolean | Nombre derivado o personalizado | Solo lectura (calculado); `true` si el documento tiene `nombre` |
| `moneda` | string | Divisa operativa | `pen`, `usd`, `eur`, `usdt`, `usdc` |
| `saldoInicial` | number | Saldo actual de la cuenta (efectivo) | Número; `0` para contenedores |
| `estado` | string | Estado de la cuenta | `activa`, `archivada` |
| `orden` | number | Orden de aparición en UI | Número entero |
| `nombre` | string | Nombre de la cuenta | Puede ser automático (derivado) o personalizado |

### 1.2 Combinaciones semánticas válidas

| Tipo | `esAbstracta` | `esPatrimonio` | Descripción |
|------|:---:|:---:|-----------|
| Cuenta regular (`banco`, `efectivo`, `plazo`, `debito`, `credito`) | `false` | Según toggle usuario | Cuenta efectiva con saldo propio |
| Contenedor padre (familia bancaria) | `true` | `false` (o `true` si legacy) | Sostiene hijas por divisa; `saldoInicial: 0` |
| Subcuenta monetaria | `true` | `false` | Hija de un padre; efectivo en divisa específica |
| Broker | `false` | `true` por defecto | Cuenta financiera + custodio de posiciones |
| Exchange (modelo E2) | `true` | `false` | Contenedor abstracto; efectivo en subcuentas; posiciones via `custodioId` |

### 1.3 Legacy: pestañas cripto

Las cuentas con `tipo: exchange`, `moneda = símbolo` (BTC, ETH...), `esPatrimonio: false` y `padreId` al documento exchange son **legacy** hasta la fase M4. No se eliminan pero tampoco se crean nuevas desde el flujo de compras.

## 2. Esquema de `posiciones`

### 2.1 Campos del modelo

| Campo | Tipo | Requisito | Descripción |
|-------|------|-----------|-----------|
| `activoId` | string | Obligatorio | ID del activo en `activos/{id}` |
| `custodioId` | string | **Opcional** (F7.2+) | ID de la cuenta `cuentas/{id}` con `tipo: broker` o `tipo: exchange`; `null` = legacy pendiente_asignacion |
| `cantidad` | number | Obligatorio | Cantidad del activo (puede ser negativa para ventas parciales) |
| `divisa` | string | Obligatorio | Divisa del activo (`usd`, `pen`, `eur`, etc.) |
| `precioPromedio` | number | Obligatorio | Precio promedio ponderado de todas las operaciones sobre este activo en este custodio |
| `ultimaActualizacion` | fecha | Automático | `serverTimestamp` en escritura |

### 2.2 Identidad lógica

- **Una posición por `(custodioId, activoId)`**: el par debe ser único por usuario. `custodioId null` es un caso especial (legacy).
- **ID de documento**: autogenerado por Firestore `push()` (no determinista tipo `${custodioId}__${activoId}`).
- **Fusión vs. rechazo**: si se intenta crear una posición con `custodioId + activoId` ya existente (y ambos definidos), el servicio decide:
  - **Modo fusión**: suma la cantidad y recalcula precio promedio (compras sucesivas).
  - **Modo rechazo**: lanza error si ya existe posición para ese activo en ese custodio.

### 2.3 Estados de posición

| Estado | `custodioId` | Descripción | Contabiliza en patrimonio |
|--------|:---:|-----------|--------------------------|
| **Legacy** | `null` | Posición sin dueño asignado, creada antes F7.2 o sin custodio. | **No** hasta M5 (migración asistida). |
| **Asignada** | `string` (ej. `"broker1"`, `"exchange1"`) | Posición con custodio conocido. | **Sí**, computada en `calcularPatrimonio`. |

### 2.4 Funciones de utilidad

- `posicion.estaAsignada()`: devuelve `true` si `custodioId !== null` (posición asignada), `false` si es `null` (legacy).
- `posicion.custodioId === null` indica posición legacy, pendiente de asignación en fase M5.

## 3. Esquema de `preferencias.dashboard`

| Campo | Tipo | Descripción |
|-------|------|-----------|
| `cardsVisibles` | `string[]` | IDs de cards visibles: `patrimonio`, `cuenta:<id>`, `activo:<id>`. Lista plana, sin arrays por categoría. |
| `orden` | `string[]` | Orden de las cards en el dashboard. Lista plana, refleja la libertad de disposición del usuario. |
| `dimensiones` | `{ [cardId]: { columnas: number, filas: number } }` | Dimensiones por card ID. Cards `cuenta:` y `activo:` son `1×1` y no redimensionables (decisión UI F7.7). |

## 4. Validaciones de esquema

### 4.1 Validaciones en modelo/repositorio (no en reglas Firestore)

| Validación | Ubicación | Condición | Mensaje |
|------------|-----------|-----------|---------|
| `Posicion.activoId` presente | `Posicion.validar()` | `!activoId` | `'El ID del activo es obligatorio'` |
| `Posicion.custodioId` controlado | `Posicion.validar()` | `custodioId === undefined` | `'El custodio de la posición es obligatorio (o debe ser null para legacy)'` |
| `Posicion.cantidad >= 0` | `Posicion.validar()` | `cantidad < 0` | `'La cantidad no puede ser negativa'` |
| `Posicion.precioPromedio >= 0` | `Posicion.validar()` | `precioPromedio < 0` | `'El precio promedio no puede ser negativo'` |
| `crearPosicion`: `custodioId` undefined → legacy | `crearPosicion` servicio | `custodioId === undefined` | Crear posición con `custodioId: null`, pendiente_asignacion (M5) |
| `crearOActualizarPosicion`: `custodioId` definido → identidad | `crearOActualizarPosicion` | `custodioId !== undefined` | Usar identidad `custodioId + activoId`; fusionar o lanzar error |

### 4.2 Validaciones en reglas Firestore (F7.9 — fuera de este scope)

No se añaden validaciones nuevas en reglas; la integridad principal vive en el servicio y el modelo.

## 5. Notas sobre migration (F7.4–F7.6)

### 5.1 M1 — Padre con saldo propio

Padres con `saldoInicial != 0` → migrar usando `migrarPadreASubcuenta` (transaccional). El saldo se transfiere a la hija y el padre queda en 0.

### 5.2 M2 — Creación de subcuentas monetarias

Crear subcuentas monetarias existentes → distribuir `saldoInicial` a hijas; riesgo de duplicación si ya había hijas.

### 5.3 M3 — Brokers multidivisa

Brokers multidivisa → efectivo ya está en familias; solo actualizar `tipo` si es necesario.

### 5.4 M4 — Posiciones legacy sin custodio (PENDENCIA CRÍTICA)

- **Sin asignar por símbolo si hay más de un custodio posible**: ambigüedad → usuario decide qué custodio usa para cada activo.
- **`pendiente_asignacion`**: estado explícito de posiciones legacy (`custodioId: null`). No contabilizan en `calcularPatrimonio` hasta que se les asigne un custodio.
- **Migración asistida**: cada posición legacy sin `custodioId` debe recibir un `custodioId` determinado por el usuario; si el mismo activo está en dos custodios diferentes, el usuario decide cuál es "el suyo" o se crean dos posiciones independientes.
- **Después de M4**: `pendiente_asignacion` desaparece; todas las posiciones tienen `custodioId` definido y contabilizan plenamente.

### 5.5 M5 — Preferencias y nombres

- **Preferencias cambian estructuralmente** (M6): `cuenta:<padre>` → tarjeta independiente o instancia individual; el orden libre del usuario se conserva; Cards/Cuentas/Activos son tres secciones solo en el modal Editar.
- **`tieneNombrePropio`**: confirmado como contrato existente (`resolverNombresCuentas` + `tieneNombrePropio`), sin campo nuevo. "Sin `nombre` = automático" sigue vigente.
- **Archivar custodio con efectivo/posiciones**: bloquear (D7). No permitir archivar un custodio si tiene posiciones abiertas o efectivo no asignado.

### 5.6 M6–M8 — Preferencias dashboard y nombres

Implementado en F7.6 (`scripts/migraciones/preferencias.mjs`; detalle en
`docs/F7.6_MIGRACIONES_PREFERENCIAS.md`).

- **Preferencias**: la lista plana `cardsVisibles`/`orden` se mantiene; no hay
  arrays por categoría. La UI separa Cards/Cuentas/Activos solo en el editor.
- **Instancias individuales**: cada cuenta es una card `cuenta:<id>`, incluidas
  las subcuentas. El padre no agrega a la familia.
  - Padre con saldo propio: `cuenta:<padre>` muestra su saldo y cada hija tiene
    su propia `cuenta:<hija>`.
  - Padre abstracto (`esAbstracta: true`): no es instancia; solo sus hijas
    tienen card.
  - M6 expande la card agregada antigua en una card por miembro, conservando la
    posición del grupo.
- **Activos**: `activo:<activoId>`, el id del documento del activo (no
  `activo:<custodioId>:<activoId>`).
- **Dimensiones**: las instancias `cuenta:`/`activo:` son 1×1 y no
  redimensionables; M6/M7 fuerzan ese tamaño. Las cards estándar conservan el
  tamaño elegido por el usuario.
- **`tieneNombrePropio`**: contrato existente, no se escribe. La app lo deriva
  de si el documento tiene `nombre`.
  - Subcuenta automática: sin `nombre`; se muestra "PADRE SOLES/DÓLARES" (o
    "PADRE PEN/USD" con `formatoDivisa: "codigo"`).
  - Subcuenta personalizada: `nombre` guardado. M8 no lo toca.
  - M8 borra el `nombre` guardado de las automáticas para que el texto siga
    derivándose del padre.

## 6. Relación con otras fases

- **F7.3 (Cálculo patrimonial)**: `calcularPatrimonio()` debe filtrar posiciones por `custodioId` y `esPatrimonio` del custodio. Efectivo y posiciones se computan por separado; sin duplicación. Posiciones `custodioId: null` (legacy) se excluyen del patrimonio.
- **F7.7–F7.8 (UI)**: Cards `cuenta:` y `activo:` son `1×1` fijas; el orden es plano y libre. Sin Neat, sin 160 px en esta fase. El modal Editor tiene tres secciones (Cards, Cuentas, Activos) pero el Dashboard mantiene orden libre.
- **F7.9 (Reglas Firestore)**: Sin cambios nuevas; validaciones en servicio y modelo. Las reglas existentes se mantienen sin modificar.

---
*Documento generado para Fase F7.2. Actualizaciones posteriores en M4–M6 quedarán reflejadas aquí.*