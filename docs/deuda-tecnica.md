# Registro de deuda técnica

Proyecto: **escinco** · Fase: **beta** (1.0.0-beta.17)

## Resumen

- Total de ítems: **23**
- Prioridad alta: **5**
- Prioridad media: **10**
- Prioridad baja: **8**
- De los anteriores, **3 están resueltos** (DEUDA-001, DEUDA-003, DEUDA-004) y
  conservan su prioridad original tachada, para que se vea qué eran.

Los conteos del resumen son de la tabla, no al revés: 5 + 10 + 8 = 23.

### Criterio de prioridad

| Prioridad | Criterio |
|-----------|----------|
| **Alta** | Produce datos incorrectos en producción, o ya ha causado una caída de permisos real. |
| **Media** | Mantiene el coste de evolución o ha causado un bug ya registrado. |
| **Baja** | Ruido, higiene o consistencia; no afecta al comportamiento. |

Relación con [`reporte-bugs.md`](./reporte-bugs.md): varios ítems de deuda son
la causa raíz o la solución de bugs registrados. Se indica en cada uno.

---

## Ítems de deuda técnica

| ID | Título | Módulo | Impacto | Prioridad |
|----|--------|--------|---------|-----------|
| DEUDA-001 | `cambioDivisa` sin signo ni monto correctos en la cuenta destino | `js/core/movimientos.js` | **Resuelta al unificar `esMovimientoPositivo`** | ~~Alta~~ Resuelta |
| DEUDA-002 | Transferencias entre divisas distintas mueven el mismo nominal en ambos lados | `constants/tiposMovimiento.js`, `js/services/MovimientoServicio.js` | **Mitigada en `f9ceb1a`: ahora se rechazan. Ver DEUDA-002b** | Alta |
| DEUDA-002b | Transferencia no soporta `tasa` ni `montoDestino`, así que no puede cruzar divisas | `constants/tiposMovimiento.js`, `js/services/MovimientoServicio.js` | No se puede mover dinero entre divisas si se desactiva *Cambio de divisa* | Media |
| DEUDA-012 | Asimetría `create`/`update`: `create` no valida 11 campos que `update` sí | `firebase/firestore.rules` | Documentos que se pueden crear pero no editar | Alta |
| DEUDA-013 | El `hasOnly` de `movimientos` es una lista manual ya desincronizada dos veces | `firebase/firestore.rules` | **Ya causó R-03 y R-05; reincidencia previsible** | Alta |
| DEUDA-003 | `montoDeMovimiento` llama a `esMovimientoPositivo` sin `cuentaId` | `js/core/movimientos.js` | **Resuelta al unificar las dos funciones** | ~~Media~~ Resuelta |
| DEUDA-004 | Tres copias de `esMovimientoPositivo`, todavía divergentes | `js/core/movimientos.js` | **Resuelta**: una sola función, con las tres ramas que faltaban | ~~Media~~ Resuelta |
| DEUDA-006 | 18 exports sin un solo llamador | 13 archivos de `js/` | ~600 líneas de código muerto | Media |
| DEUDA-008 | `doodles.js` se importa en caliente pero no está precacheado | `sw.js` | **Fallo de import offline en el primer arranque** | Media |
| DEUDA-022 | Un cálculo desnormalizado en dos sitios se detecta leyendo el código entero | 4 bugs cerrados juntos en 2026-10-05 | **Es la causa raíz de BUG-025 y BUG-026, y de DEUDA-001/003/004** | Alta |
| DEUDA-011 | `fechaRealizacion` como `Date` (→ `Timestamp`) en 2 rutas, string en el resto | `js/pages/inversiones.js` | Colección heterogénea; origen de BUG-020 | Media |
| DEUDA-014 | Siete copias de la función de formateo de fecha | 7 archivos de `js/` | ~90 líneas duplicadas y con divergencias | Media |
| DEUDA-016 | ~40 normalizaciones ad-hoc de moneda, 4 convenciones distintas | 15 archivos de `js/` | Formato de divisa incoherente entre vistas | Media |
| DEUDA-017 | *"Configuración de brokers (en desarrollo)"* expuesta en la UI, 2 veces | `js/pages/trading.js:780`, `js/pages/inversiones.js:1648` | Botón que abre un modal vacío al usuario | Media |
| DEUDA-018 | La acción "Actualizar" de la lastbar no está implementada | `js/core/lastbar.js:438` | Botón que solo emite un `console.warn` | Media |
| DEUDA-005 | El tipo `error` no declara `fechaRealizacion` | `constants/tiposMovimiento.js:144-151` | Esos movimientos se muestran siempre con fecha "—" | Baja |
| DEUDA-007 | Placeholder `"tucson"` como descripción de la app | `manifest.webmanifest:4`, `constants/version.js:4`, `docs/requisitos.md:7` | Texto visible en la instalación del PWA | Baja |
| DEUDA-009 | 12 selectores CSS duplicados en 7 archivos | `css/` | ~75 líneas duplicadas; el orden de cascada decide el resultado | Baja |
| DEUDA-010 | 218 `console.*` sin limpiar en 35 archivos | `js/` | Ruido en consola; 3 `console.warn` silencian fallos reales | Baja |
| DEUDA-015 | `formatearMontoConDivisa` exportada y redefinida localmente | `DivisaServicio.js:46`, `cuentas.js:71` | Dos implementaciones del mismo formateo | Baja |
| DEUDA-019 | Archivos huérfanos y de prueba en el repositorio | raíz, `experimentos/` | Basura que se despliega o confunde | Baja |
| DEUDA-020 | `docs/informe-info.md` pesa 137 KB | `docs/` | Ilegible como documento de referencia | Baja |
| DEUDA-021 | Sin scripts de `lint`, `test` ni `typecheck` | `package.json` | Ninguna validación automática posible | Baja |

---

## Detalle

### DEUDA-001: `cambioDivisa` sin signo ni monto correctos en la cuenta destino — RESUELTA
- **Módulo**: `js/core/movimientos.js` (antes `MovimientoServicio.js` y 3 páginas)
- **Resolución (2026-10-05)**: resuelta de paso al unificar `esMovimientoPositivo`
  y `montoDeMovimiento` en `js/core/movimientos.js`. `cambioDivisa` tiene su
  rama (`positivo` en la cuenta destino) y `montoDeMovimiento` elige entre
  `montoOrigen` y `montoDestino` según `cuentaId`. Sin `cuentaId` —la lista
  global de Movimientos y el dashboard, que no tienen vista por cuenta— se
  muestra el nominal de origen, que es el que salió del bolsillo. Verificado
  por ejecución.
- **Lo que se describe** es el estado original, anterior a la resolución:
- **Descripción**: el tipo `cambioDivisa` no está contemplado en ninguna de las
  tres copias de `esMovimientoPositivo`, así que cae a la rama `default` y
  devuelve `false` siempre: el cambio de divisa se muestra **negativo también en
  la cuenta destino**, donde debería ser positivo. En paralelo,
  `montoDeMovimiento` resuelve `if (m.montoOrigen) return ...` antes de llegar
  a `montoDestino`, así que **la cuenta destino muestra el monto de origen**: la
  línea siguiente es código inalcanzable para este tipo.
  El balance sí es correcto: `MovimientoServicio.js:407-410` resta `montoOrigen`
  del origen y suma `montoDestino` al destino.
- **Impacto**: el usuario ve un cambio de divisa que parece una salida de dinero
  en las dos cuentas, con un importe que no corresponde a la cuenta que está
  mirando. Es el bug más engañoso de la lista, porque induce a concluir que se
  ha perdido dinero.
- **Prioridad**: Alta
- **Solución propuesta**: añadir el caso a la función compartida
  (ver **DEUDA-004**):
  `if (m?.tipo === "cambioDivisa") return cuentaId ? m.cuentaDestino === cuentaId : false`
  y hacer que `montoDeMovimiento` reciba `cuentaId` para elegir entre
  `montoOrigen` y `montoDestino`, igual que ya hace con el signo.
- **Evidencia**: `js/pages/cuentas.js:672-679` (falta el caso),
  `js/pages/movimientos.js:283-295`, `js/pages/dashboard.js:2581-2594`,
  `js/pages/cuentas.js:1012-1013`, `js/pages/movimientos.js:306-307`,
  `js/pages/dashboard.js:2605-2606` (el `return` inalcanzable),
  `js/services/MovimientoServicio.js:407-410` (el balance, correcto)

### DEUDA-002: Transferencias entre divisas distintas mueven el mismo nominal
- **Módulo**: `constants/tiposMovimiento.js`, `js/services/MovimientoServicio.js`
- **Descripción**: el tipo `transferencia` declara `camposObligatorios:
  [cuentaOrigen, cuentaDestino, monto, fechaRealizacion]` y **no** tiene
  `montoDestino` ni `tasa` (a diferencia de `cambioDivisa`, que sí los tiene).
  `actualizarSaldos` usa `datos.monto` en los dos lados. El formulario permite
  elegir cuentas de distinta divisa sin conversión alguna.
- **Impacto**: una transferencia de 100 USD a una cuenta en PEN descuenta 100 de
  la cuenta en USD y **suma 100 a la cuenta en PEN**. Los saldos quedan
  corruptos y, como el error es silencioso y contable, no se detecta hasta que
  el patrimonio deja de cuadrar. Es el ítem más grave del registro.
- **Prioridad**: Alta
- **Estado**: **Mitigada** en `f9ceb1a` con la opción (a). El defecto sigue
  latente en los movimientos ya guardados; la solución de fondo es **DEUDA-002b**.
- **Lo que se hizo en `f9ceb1a`**: `validarDivisaTransferencia` rechaza la
  transferencia si origen y destino no comparten divisa, en las dos rutas de
  escritura (`registrarMovimiento` y `actualizarMovimiento`), y
  `filtrarCuentasDestinoTransferencia` oculta en el formulario las opciones de
  destino incompatibles. Ambas capas copian el patrón que ya existía para
  `pagoTarjeta`, que es donde estaba la validación equivalente
  (`MovimientoServicio.js:343-345`). **No** se valida al revertir, para que los
  movimientos heredados corruptos se puedan borrar y deshacer.
- **Lo que queda**: **DEUDA-002b**. Los documentos ya corruptos no se reparan.
- **Solución propuesta**: dos alternativas. (a) Mínimo: validar en
  `actualizarSaldos` y en el formulario que `cuentaOrigen` y `cuentaDestino`
  compartan divisa, y rechazarlo con un mensaje claro. (b) Correcto: extender
  `transferencia` con `tasa` y `montoDestino`, igual que `cambioDivisa`, y
  hacer la conversión en el servicio. Mientras tanto, la opción (a) evita el
  daño.
- **Evidencia**: `constants/tiposMovimiento.js:37-48` (transferencia sin
  `montoDestino`/`tasa`), `constants/tiposMovimiento.js:50-60` (el contraste con
  `cambioDivisa`), `js/services/MovimientoServicio.js:402-405` (el mismo
  `datos.monto` en ambos lados), `js/services/MovimientoServicio.js:535-557`
  (`actualizarSaldoCuenta`, aritmética pura sin conversión)
- **Nota de alcance**: la severidad Alta de este ítem era **teórica**: depende de
  que existan usuarios con cuentas en varias divisas que transferan entre ellas.
  Nadie lo había verificado en datos. Queda pendiente de comprobarlo en la
  consola de Firebase; si no hay usuarios afectados, la prioridad real la
  define ese recuento y no la severidad.

### DEUDA-002b: Transferencia no soporta `tasa` ni `montoDestino`
- **Módulo**: `constants/tiposMovimiento.js`, `js/services/MovimientoServicio.js`,
  `js/ui/formularioMovimiento.js`
- **Descripción**: extender `transferencia` con `tasa` y `montoDestino` para
  permitir transferencias entre divisas con conversión explícita. La conversión
  existe (`convertirMonto`, `js/services/DivisaServicio.js:63-88`), pero la
  tasa debe venir del usuario, no de las preferencias, porque la app tiene un
  solo tipo de cambio global (PEN/USD).
- **Por qué no se hizo ya en DEUDA-002**: `convertirMonto` es pura y síncrona,
  pero lee el tipo de cambio de las preferencias del usuario y normaliza
  `USDT = USD`. Convertir con ella aplicaría en silencio una tasa que el usuario
  no eligió y que no podría revisar, que es exactamente el daño que
  `f9ceb1a` evita rechazando. La tasa tiene que ser un dato explícito del
  movimiento, como ya hace `cambioDivisa` con su campo `tasa`.
- **Impacto**: con la opción (a) aplicada, un usuario que desactive *Cambio de
  divisa* en Configuración → Apariencia **se queda sin ninguna forma de mover
  dinero entre cuentas de distinta divisa**. Hoy puede hacerlo mal; con el
  arreglo, no puede. El mensaje de error de `validarDivisaTransferencia` le dice
  dónde reactivar el toggle, pero eso es un rodeo, no una solución.
- **Prioridad**: Media
- **Evidencia**: `constants/tiposMovimiento.js:37-48` (lo que le falta a
  `transferencia`), `js/services/DivisaServicio.js:54-88` (el tipo de cambio
  global y `convertirMonto`), `js/ui/formularioMovimiento.js:164-206` (los
  `input` de `montoOrigen`, `montoDestino` y `tasa` que hay que replicar para
  `transferencia`)
- **Notas**: **no requiere cambios en las reglas de Firestore**.
  `montoOrigen`, `montoDestino` y `tasa` ya están en el `hasOnly` de movimientos
  (`firebase/firestore.rules:158`) y ya se validan como número (`:170-172`), que
  es la trampa que ya produjo R-03 y R-05 dos veces. Aquí está pagada de
  antemano.

  Conviene resolverla junto con **BUG-028**, que ya se cerró (2026-10-05) y
  dejó escrita la regla de qué tipos de cuenta pueden participar en una
  transferencia: los selects de un tipo que mueve saldos ofrecen cuentas con
  saldo; los que mueven deuda ofrecen tarjetas. Al extender `transferencia` con
  `tasa` y `montoDestino` esa regla ya está decidida y solo hay que respetarla.

**Nota**: `validarDivisaTransferencia` produjo hasta ahora los dos rechazos —
  el de divisa (esta ficha) y el de tarjeta (**BUG-028**)—, y nombra en cada
  mensaje el tipo de movimiento que sí sirve para el caso. Si se extiende
  `transferencia` con conversión, el rechazo por divisa desaparece de esta
  función y queda solo el de tarjeta.

### DEUDA-012: Asimetría `create`/`update` en las reglas de Firestore
- **Módulo**: `firebase/firestore.rules`
- **Descripción**: en `usuarios/{uid}/movimientos`, la regla `create` solo
  valida el tipo de `monto`, `cantidad`, `precio`, `comision`, `montoOrigen`,
  `montoDestino`, `tasa`, `metaId` y `operacion`. **No** valida `cuenta`,
  `concepto`, `divisa`, `fechaRealizacion`, `activo`, `exchange`, `tarjeta`,
  `nombreVendedor`, `nombreComprador`, `cuentaPago` ni `cuentaCobro`, mientras
  que `update` los valida todos. El mismo hueco existe en `cuentas`:
  `fechaCreacion` está en el `hasOnly` de `create` sin validar su tipo, pero
  `update` exige `timestamp` o `null`.
- **Impacto**: se pueden escribir documentos que las propias reglas del proyecto
  rechazarían en la siguiente edición. Los datos inválidos se acumulan sin que
  ninguna regla los señale, y `normalizarFechaFutura` deja de aplicarse en las
  rutas que escriben `Date` (**DEUDA-011** / **BUG-020**). Un usuario podría
  dejar un documento que ya no puede corregir él mismo.
- **Prioridad**: Alta
- **Solución propuesta**: derivar la validación de un único origen. Definir una
  función `validarCamposMovimiento(data)` con el `hasOnly` y los validadores, y
  aplicarla tanto en `create` como en `update`. Las reglas admiten funciones de
  nivel superior, así que es un refactor contenido dentro del archivo.
- **Evidencia**: `firebase/firestore.rules:155-174` (`create` de movimientos),
  `firebase/firestore.rules:176-200` (`update` de movimientos),
  `firebase/firestore.rules:99-120` (`create` de cuentas),
  `firebase/firestore.rules:144` (`update` de cuentas)

### DEUDA-013: El `hasOnly` de `movimientos` es una lista manual ya desincronizada
- **Módulo**: `firebase/firestore.rules`, `constants/tiposMovimiento.js`,
  `js/services/ExportarServicio.js`, `js/services/ImportarServicio.js`
- **Descripción**: la lista de campos admitidos en `create` para movimientos
  está escrita a mano y se desincroniza cada vez que `CONFIG_MOVIMIENTOS` crece.
  Ya ha pasado **tres veces**, y la tercera es de otra naturaleza:

  | # | Qué se desincronizó | Síntoma | Estado |
  |---|---|---|---|
  | 1 | `metaId` no estaba en la lista | *"Missing or insufficient permissions"* al aportar a una meta | R-05, `c014e94` |
  | 2 | `operacion` no estaba en la lista | Ídem, y además rompía el deshacer | R-03, `9c4cc4b` |
  | 3 | `id` **sobra** en el historial | La importación de historial falla entera en cuentas nuevas | **BUG-030**, pendiente |

  En los dos primeros casos **faltaba** un campo que el código escribía. En el
  tercero **sobra** uno que el exportador escribe y la app nunca. Los dos casos
  confirmen que la lista está desalineada **en las dos direcciones**, que es
  justo lo que hace imposible detectarla leyendo solo un lado.

  El síntoma es idéntico en los tres: *"Missing or insufficient permissions"*, sin
  ningún mensaje de la app que lo explique. En BUG-030 es peor, porque la ruta
  es la **importación de un respaldo**, y ahí el usuario está intentando
  recuperar sus datos: el fallo aparece justo cuando más le importa.
- **Impacto**: cada campo nuevo —y cada campo sobrante— obliga a recordar tres
  sitios (constantes, reglas `create`, reglas `update`). Es deuda que **ya ha
  causado dos incidentes de producción y un bug abierto**, por lo que la
  prioridad no es hipotética.
- **Prioridad**: Alta
- **Solución propuesta**: dos niveles. (a) Corto plazo: una prueba unitaria o un
  script de build que compare `CONFIG_MOVIMIENTOS` contra el `hasOnly` y falle
  si no coinciden. (b) Largo plazo: mover el control a `flame`/tests de reglas
  de Firebase, de forma que cada tipo de movimiento tenga un test que intente
  guardarlo. Como mínimo, un comentario en el `hasOnly` que recuerde la
  dependencia.
  Con BUG-030, la comparación debería abarcar **también las rutas de escritura no
  covered por la UI** —el export/import es una de ellas y nadie la tenía en la
  cabeza al escribir las reglas—. Un campo `id` en el export es el tipo de cosa
  que un test de roundtrip habría atrapado al primer intento.
- **Evidencia**: `firebase/firestore.rules:156-162` (la lista),
  `constants/tiposMovimiento.js:16-151` (la fuente que la obliga a crecer),
  `firebase/firestore.rules:489-491` (el `hasOnly` de `historial`, sin `id`),
  `js/services/ExportarServicio.js:116` (el `id` que se introduce),
  `js/services/ImportarServicio.js:388-394` (la escritura rechazada),
  `git show 9c4cc4b`, `git show c014e94` (los dos commits que la repararon)

### DEUDA-004: Tres copias de `esMovimientoPositivo`, todavía divergentes — RESUELTA
- **Módulo**: `js/core/movimientos.js`
- **Resolución (2026-10-05)**: `esMovimientoPositivo` y `montoDeMovimiento`
  viven ahora en `js/core/movimientos.js` y las tres páginas las importan. Las
  copias locales se borraron. La función unificada tiene las cuatro ramas que
  faltaban en algún sitio:
  - `pagoTarjeta` (solo estaba en `cuentas.js`)
  - `cambioDivisa` (no estaba en ninguna)
  - `transferencia` y `error` (ya alineadas)
  Y `montoDeMovimiento` elige el nominal de `cambioDivisa` según `cuentaId`
  (**DEUDA-001**) y propaga `cuentaId` al decidir el signo de la comisión
  (**DEUDA-003**).

  Esto es lo que hizo posible cerrar **BUG-025**: la ficha de ese bug pedía
  expresamente no limitarse a copiar la función, sino propagar el `cuentaId`
  desde la plantilla, y eso solo era fiable con un único hogar.
- **Lo que se describe** es el estado original:
- **Descripción**: la función está triplicada. El commit `a942616` añadió la
  rama `transferencia` solo en la copia de `cuentas.js`, y las otras dos se
  quedaron atrás, también sin el parámetro `cuentaId`. El commit `89d9f58`
  alineó esas dos copias con la primera, pero la divergencia de `pagoTarjeta`
  sigue ahí:

  | Rama | `cuentas.js:672` | `movimientos.js:283` | `dashboard.js:2581` |
  |------|------------------|----------------------|---------------------|
  | `pagoTarjeta` | ✅ | ❌ | ❌ |
  | `error` | ✅ | ✅ | ✅ |
  | `transferencia` | ✅ | ✅ (alineada en `89d9f58`) | ✅ (alineada en `89d9f58`) |
  | `cambioDivisa` | ❌ | ❌ | ❌ (véase **DEUDA-001**) |

- **Impacto**: la divergencia de `transferencia` quedó registrada como BUG-024 y
  ya está resuelta. Quedan dos: la rama `pagoTarjeta`, que sigue faltando en
  dos de tres copias, y `cambioDivisa`, que falta en las tres. Mientras la
  función esté triplicada, cualquier arreglo tiene un 66% de probabilidad de
  aplicarse solo a una copia: es exactamente lo que pasó con `a942616`.
- **Prioridad**: Media
- **Solución propuesta**: mover la función a un módulo compartido (por ejemplo
  `js/core/movimientos.js`, junto al resto de reglas de presentación de
  movimientos) y exportarla una sola vez con la firma
  `esMovimientoPositivo(m, cuentaId = null)`. Aprovechar para dar
  `cambioDivisa` su rama (**DEUDA-001**) y `pagoTarjeta` la suya una sola vez.
  Importante: al unificar no basta con copiar la función, hay que **pasar
  `cuentaId` desde `plantillaMovimiento` hasta la llamada**, o **BUG-025**
  reaparece en cuanto se conecte el filtro por cuenta de Movimientos.
- **Evidencia**: `js/pages/cuentas.js:672-679`,
  `js/pages/movimientos.js:283-295`, `js/pages/dashboard.js:2581-2594`,
  `git show a942616` (el fix incompleto), `git show 89d9f58` (la alineación),
  `js/pages/movimientos.js:248` (el `plantillaMovimiento` sin ámbito de cuenta)

### DEUDA-003: `montoDeMovimiento` llama a `esMovimientoPositivo` sin `cuentaId` — RESUELTA
- **Módulo**: `js/core/movimientos.js`
- **Resolución (2026-10-05)**: resuelta con **DEUDA-004**. La función unificada
  tiene la firma `montoDeMovimiento(m, cuentaId = null)` y todas las llamadas
  que tienen ámbito de cuenta lo pasan. Las dos que no lo tienen (la lista
  global de Movimientos y los últimos movimientos del dashboard) no tienen vista
  por cuenta, así que `null` es la respuesta correcta ahí, no una omisión.
- **Lo que se describe** es el estado original:
- **Descripción**: al calcular el total de una compra/venta de activo,
  `montoDeMovimiento` decide si la comisión suma o resta con
  `esMovimientoPositivo(m)`, sin segundo argumento. Con `cuentaId === null` las
  ramas `pagoTarjeta` y `transferencia` devuelven `false` por diseño, así que la
  decisión se toma sin ninguna perspectiva de cuenta. (Nota: la línea real es
  **1010** en `cuentas.js`, no 1007).
- **Impacto**: bajo por sí solo, pero es el mismo patrón de llamada incompleta que
  hace frágil **DEUDA-001** y **DEUDA-004**, y es la razón por la que un
  movimiento puede mostrar una comisión con el signo invertido respecto de la
  cuenta desde la que se mira.
- **Prioridad**: Media
- **Solución propuesta**: propagar `cuentaId` a `montoDeMovimiento`, igual que ya
  se hace con `plantillaMovimiento(m, cuentaId)` en la misma página. Resolver
  junto con **DEUDA-004**, que le da un único hogar a la función.
- **Evidencia**: `js/pages/cuentas.js:1003-1015` (la función),
  `js/pages/cuentas.js:1010` (la llamada sin `cuentaId`),
  `js/pages/cuentas.js:638` (el patrón correcto, en `plantillaMovimiento`),
  `js/pages/movimientos.js:299`, `js/pages/dashboard.js:2598` (las otras dos
  copias)

### DEUDA-006: 18 exports sin un solo llamador
- **Módulo**: 13 archivos de `js/services/`, `js/repositories/`, `js/ui/`, `js/models/`, `js/core/`, `js/pages/`
- **Descripción**: de 295 exports, **18** no tienen ninguna referencia en todo el
  repositorio (verificado nombre por nombre: cero coincidencias fuera de su
  propia declaración).
- **Impacto**: ~600 líneas que se mantienen, se leen y se revisan sin aportar
  nada. En `MovimientoServicio.js` la pieza muerta (`obtenerMovimientosConFiltros`,
  60 líneas) implementa el filtrado completo por cuenta, divisa, rango de fechas
  y búsqueda: hace creer que ese filtrado **existe** y funciona, cuando en
  realidad hay duplicado en el código de la página.
- **Prioridad**: Media
- **Solución propuesta**: eliminar los 18, o marcar explícitamente los que sean
  API prevista. Conviene hacerlo en dos commits (repos primero, servicios
  después) para no mezclarla con cambios de comportamiento. Activar un linter de
  exports sin usar evitaría la reincidencia (**DEUDA-021**).
- **Evidencia** (18 ítems):
  - `js/services/DivisaServicio.js:14` `getSimboloDivisaPrincipal`
  - `js/services/DivisaServicio.js:104` `formatearMontoEnPrincipal`
  - `js/services/EliminarServicio.js:103` `eliminarColeccion`
  - `js/services/HistorialServicio.js:28` `obtenerHistorialParaGrafico`
  - `js/services/MovimientoServicio.js:628` `obtenerMovimientosConFiltros`
  - `js/services/OrdenServicio.js:74` `cancelarOrden`
  - `js/services/PendienteServicio.js:59` `consolidarPendientesEnLote`
  - `js/services/PendienteServicio.js:103` `getMovimientosParaPendiente`
  - `js/services/SnapshotServicio.js:126` `obtenerOCrearSnapshotHoy`
  - `js/repositories/ActivoRepositorio.js:97` `actualizarActivo`
  - `js/repositories/ActivoRepositorio.js:137` `eliminarActivo`
  - `js/repositories/HistorialRepositorio.js:71` `cerrarDia`
  - `js/repositories/SnapshotRepositorio.js:57` `cerrarSnapshotDelDia`
  - `js/repositories/SnapshotRepositorio.js:108` `obtenerSnapshotPorFecha`
  - `js/core/iconos.js:106` `ICONOS_DISPONIBLES`
  - `js/models/Meta.js:7` `ICONOS_META`
  - `js/pages/trading.js:141` `recargarTrading`
  - `js/ui/notificaciones.js:139` `cerrarNotificaciones`

### DEUDA-008: `doodles.js` se importa en caliente pero no está precacheado
- **Módulo**: `sw.js`, `js/ui/doodles.js`
- **Descripción**: `SHELL_ASSETS` (`sw.js:11-124`) enumera 15 CSS y unos 60
  módulos, pero **no incluye `/js/ui/doodles.js`**, que sí se importa
  estáticamente en `js/core/app.js:7`, `js/pages/index.js:4` y
  `js/pages/register.js:4`. Tampoco incluye `/css/404.css` ni `/404.html`.
- **Impacto**: en el **primer arranque sin red** tras instalar el PWA, la
  importación de `doodles.js` falla en los tres puntos de entrada, lo que puede
  tumbar `app.js` entero y dejar la aplicación en blanco. Un precaché que
  declara módulos "vivos" pero los omite es peor que uno que no los declara, por
  la falsa sensación de cobertura. Los otros dos casos (`404.css`, `404.html`)
  son menores: solo afectan a la página de error sin conexión.
- **Prioridad**: Media
- **Solución propuesta**: añadir `/js/ui/doodles.js`, `/css/404.css` y
  `/404.html` a `SHELL_ASSETS`. Mejor aún: generar la lista de precaché a partir
  los `<script type="module">` y los `<link>` de los HTML, para que no vuelva a
  desincronizarse.
- **Evidencia**: `sw.js:11-124` (la lista),
  `js/core/app.js:7`, `js/pages/index.js:4`, `js/pages/register.js:4` (los tres
  imports en caliente), `404.html:11` (`css/404.css`)

### DEUDA-011: `fechaRealizacion` como `Date` en 2 rutas, string en el resto
- **Módulo**: `js/pages/inversiones.js`, `js/services/MovimientoServicio.js`
- **Descripción**: los modales de compra y venta manual escriben
  `fechaRealizacion: fecha ? parseFechaLocal(fecha) : new Date()`. `parseFechaLocal`
  devuelve un `Date`, que `addDoc` convierte a `Timestamp`. El resto de la
  aplicación escribe el string `"YYYY-MM-DD"`. Son dos convenciones para el mismo
  campo en la misma colección.
- **Impacto**: datos heterogéneos que obligan a cada lector a comprobar el tipo
  (`formatearFecha` y `normalizarFecha` lo hacen, pero no todos los lectores
  lo hacen). Y una consecuencia funcional: `normalizarFechaFutura()` solo actúa
  sobre strings, así que estas dos rutas **no recortan las fechas futuras**,
  contra la regla escrita en el propio archivo. Registrado como **BUG-020**.
- **Prioridad**: Media
- **Solución propuesta**: escribir siempre `fechaLocalISO(parseFechaLocal(fecha))`,
  que ya existe en `js/core/fechas.js:37` y devuelve el string local correcto.
  Añadir un test o una aserción que verifique el tipo al guardar.
- **Evidencia**: `js/pages/inversiones.js:1505`, `js/pages/inversiones.js:1624`,
  `js/core/fechas.js:25-28` (`parseFechaLocal` devuelve `Date`),
  `js/core/fechas.js:37` (`fechaLocalISO`, el formateador correcto),
  `js/services/MovimientoServicio.js:19-25` (el normalizador que se salta)

### DEUDA-014: Siete copias de la función de formateo de fecha
- **Módulo**: `js/pages/cuentas.js:1029`, `js/pages/dashboard.js:3121`,
  `js/pages/inversiones.js:1103`, `js/pages/movimientos.js:308`,
  `js/pages/trading.js:1296`, `js/pages/metas.js:44`,
  `js/pages/pendientes.js:58`
- **Descripción**: siete funciones de formateo de fecha, con nombres distintos
  según el archivo (`formatearFecha`, `formatearFechaEstrategia`,
  `formatearFechaOrden`, `formatearFechaPendiente`). Las de `cuentas.js`,
  `movimientos.js` y `dashboard.js` son idénticas salvo por el último par de
  líneas; `metas.js` tiene una versión más corta que no contempla `Timestamp`.
- **Impacto**: ~90 líneas duplicadas. El caso real es `formatearFecha` en
  `cuentas.js` y `movimientos.js`, **idénticas carácter a carácter** en las 13
  líneas que manejan string, `Timestamp` y `seconds`. Cualquier mejora en el
  manejo de zonas horarias habría que aplicarla siete veces, y basta una
  omisión para que dos vistas muestren fechas distintas.
- **Prioridad**: Media
- **Solución propuesta**: una única función en `js/core/fechas.js`, con la
  variante más completa (la de `cuentas.js:1029-1042`) como referencia. Los
  alias con nombre propio de `inversiones`, `trading` y `pendientes` pueden
  sobrevivir como reexports de una línea.
- **Evidencia**: `js/pages/cuentas.js:1029-1042`,
  `js/pages/movimientos.js:308-321`,
  `js/pages/dashboard.js:3121`, `js/pages/inversiones.js:1103`,
  `js/pages/trading.js:1296`, `js/pages/metas.js:44`,
  `js/pages/pendientes.js:58`

### DEUDA-016: ~40 normalizaciones ad-hoc de moneda, 4 convenciones distintas
- **Módulo**: 15 archivos de `js/`
- **Descripción**: el código normaliza `moneda`/`divisa` con `.toUpperCase()` o
  `.toLowerCase()` en línea, en cada punto de uso, y con cuatro convenciones
  distintas para presentar el mismo dato:
  1. `(c.moneda || "PEN").toUpperCase()` — `cuentas.js:385`
  2. `c.moneda?.toUpperCase() || "PEN"` — `inversiones.js:1667`, `trading.js:1478`
  3. `presentarDivisa(...)` — `formularioMovimiento.js:33`, `metas.js`, `graficos.js`
  4. `formatearMontoConDivisa(...)` — importado del servicio
  Además hay `toUpperCase()` en las escrituras de preferencias
  (`dashboard.js:2834, 2840, 3159, 3281`) y `toLowerCase()` en la lectura.
- **Impacto**: la misma cuenta puede mostrar `PEN` en un sitio y `Pen` en otro
  según el archivo. Los `data-moneda` de los `<select>` sí van en minúsculas, lo
  que significa que la comparación depende de que cada punto de lectura aplique
  el `toLowerCase()` correcto: un olvido produce un filtro de divisa
  silenciosamente vacío. Cuatro convenciones distintas para un dato de tres
  valores (`pen`, `usd`, `usdt`).
- **Prioridad**: Media
- **Solución propuesta**: fijar `pen`/`usd`/`usdt` en minúsculas como única forma
  canónica en el modelo, y exponer una función de presentación única
  (`presentarDivisa`, que ya existe en `DivisaServicio.js:33`) como el **único**
  camino para mostrar. Banear `toUpperCase()`/`toLowerCase()` sobre `moneda` con
  una regla de linter.
- **Evidencia**: `js/pages/cuentas.js:73, 385, 566, 1878`,
  `js/pages/dashboard.js:493, 600, 1759, 2834, 2840, 3159, 3281`,
  `js/pages/inversiones.js:767, 777, 1667`,
  `js/pages/movimientos.js:664-665, 711, 1364`,
  `js/pages/trading.js:1478`, `js/ui/metas.js:81-82, 515`,
  `js/ui/formularioMovimiento.js:22-23, 33, 42`,
  `js/services/DivisaServicio.js:33-36, 46-49, 94, 97`

### DEUDA-017: "Configuración de brokers (en desarrollo)" expuesta en la UI
- **Módulo**: `js/pages/trading.js:780`, `js/pages/inversiones.js:1648`
- **Descripción**: dos botones abren un modal cuyo único contenido es el texto
  *"Configuración de brokers (en desarrollo)"*. No hay ninguna otra
  implementación, ni parcial ni comentada, en todo el repositorio.
- **Impacto**: el usuario final (no el equipo) encuentra un botón que abre un
  modal vacío. En una beta distribuida a un curso integrador, es la clase de
  detalle que más resta credibilidad. Además son dos copias del mismo placeholder,
  lo que confirma que es trabajo a medias duplicado en lugar de pendiente.
- **Prioridad**: Media
- **Solución propuesta**: decidir. Si la funcionalidad entra en la beta,
  implementarla detrás de un flag de preferencias. Si no, ocultar los botones y
  quitar el caso del router de la lastbar. No dejar el placeholder.
- **Evidencia**: `js/pages/trading.js:780`,
  `js/pages/inversiones.js:1648`

### DEUDA-018: La acción "Actualizar" de la lastbar no está implementada
- **Módulo**: `js/core/lastbar.js:438`
- **Descripción**: el botón "Actualizar" tiene un caso que solo hace
  `console.warn('"Actualizar" no implementado para la página "..."')`. No hay
  ninguna ruta de código que haga refresh.
- **Impacto**: botón visible que no hace nada, con un aviso que solo llega a la
  consola del desarrollador. El usuario no tiene forma de saber que existe ni de
  reportar el problema.
- **Prioridad**: Media
- **Solución propuesta**: o implementar el refresh por página (la mayoría ya
  tienen un `cargarX()` reentrante), o quitar el botón de las páginas que no lo
  soporten y dejar el `case` como `default` explícito.
- **Evidencia**: `js/core/lastbar.js:438`

### DEUDA-005: El tipo `error` no declara `fechaRealizacion`
- **Módulo**: `constants/tiposMovimiento.js:144-151`, páginas de movimientos y cuentas
- **Descripción**: `error` declara `camposObligatorios: [cuenta, operacion,
  monto]` y ningún otro campo. `recogerDatosFormulario` solo recorre
  `obligatorios ∪ opcionales`, así que la clave `fechaRealizacion` **nunca se
  escribe**: el documento resultante no la tiene. Los consumidores que la leen
  sin fallback mostrarán `"—"` (es lo que devuelve `formatearFecha` ante un valor
  falsy). Hay seis de esos puntos de lectura.
- **Impacto**: los movimientos de corrección manual —los que el usuario crea
  justamente para cuadrar un descuadre— no tienen fecha propia. Se ordenan y se
  filtran por `fechaRegistro`, que es la fecha de creación del documento, no la
  del error corregido. En una lista ordenada por fecha, corregir un movimiento
  antiguo hoy lo sitúa en hoy.
- **Prioridad**: Baja
- **Solución propuesta**: añadir `fechaRealizacion` a los obligatorios de `error`
  (el formulario ya tiene el input genérico para ese campo, y
  `MovimientoServicio.normalizarFechaFutura` ya lo normalizaría). Los documentos
  antiguos sin el campo siguen funcionando gracias a los fallbacks
  `fechaRealizacion || fechaRegistro`.
- **Evidencia**: `constants/tiposMovimiento.js:144-151` (la ausencia),
  `js/ui/formularioMovimiento.js:336-338` (por qué no se escribe),
  `js/pages/cuentas.js:644, 975`, `js/pages/movimientos.js:254, 1071, 1117, 1359`
  (lecturas sin fallback),
  `js/pages/cuentas.js:1018` (el fallback correcto, `fechaRealizacion ||
  fechaRegistro`)

### DEUDA-007: Placeholder "tucson" como descripción de la app
- **Módulo**: `manifest.webmanifest:4`, `constants/version.js:4`, `docs/requisitos.md:7`
- **Descripción**: los tres campos `description` de la aplicación contienen el
  literal `"tucson"`, un nombre de proyecto provisional que sobrevivió a la
  reescritura de la descripción.
- **Impacto**: texto visible por el usuario en el diálogo de instalación del
  PWA, en el gestor de aplicaciones del sistema operativo y en la página de
  información de la app. Ya está documentado en `docs/informe-info.md:32-34`,
  así que es deuda conocida y no descubierta.
- **Prioridad**: Baja
- **Solución propuesta**: definir el texto definitivo en `constants/version.js` y
  derivar de ahí el manifest, para que no puedan volver a divergir los tres
  sitios.
- **Evidencia**: `manifest.webmanifest:4`, `constants/version.js:4`,
  `docs/requisitos.md:7`, `docs/informe-info.md:32-34`

### DEUDA-009: 12 selectores CSS duplicados en 7 archivos
- **Módulo**: `css/`
- **Descripción**: 12 selectores están definidos en más de un archivo:
  `#panel` en cuatro (`style.css`, `navegacion.css` en dos sitios,
  `movimientos.css`, `inversiones.css`), `.lista-vacia` / `.lista-vacia.error` /
  `.lista-vacia-hint` en `style.css` e `inversiones.css`, `.panel-header` (y su
  `h2`) en `componentes.css` e `inversiones.css`, `.config-hint` en
  `configuracion.css` y `modal.css`, `.glass-btn` en `style.css` y
  `configuracion.css`, y `#logo` / `main` en `style.css` y `navegacion.css`.
  Son unos 14 bloques, ~75 líneas.
- **Impacto**: bajo por volumen, pero con una trampa real: cuando el mismo
  selector se declara en dos archivos cargados en el mismo HTML, el resultado
  depende del **orden de los `<link>`**, no de la especificidad. Reordenar los
  CSS en `dashboard.html` cambia el aspecto sin tocar ninguna regla. Es una
  fuente de bugs visuales difíciles de rastrear.
- **Prioridad**: Baja
- **Solución propuesta**: declarar cada componente en un único archivo, el del
  módulo que lo usa. `.lista-vacia*` pertenece a `componentes.css` y no a
  `inversiones.css`; `.panel-header` igual; `.config-hint` debería ir solo en
  `componentes.css`.
- **Evidencia**: `css/style.css:201, 232, 688, 764, 768, 785, 828, 970`,
  `css/navegacion.css:34, 323, 668, 723`, `css/inversiones.css:80, 86, 177, 187`,
  `css/componentes.css:200`, `css/configuracion.css:222, 313`,
  `css/modal.css:670`, `css/movimientos.css:14`

### DEUDA-010: 218 `console.*` sin limpiar en 35 archivos
- **Módulo**: `js/` (35 archivos)
- **Descripción**: **218** llamadas a `console.log` / `warn` / `error` / `info` /
  `debug`, excluyendo la librería de terceros. No es "unas 70": la cifra real es
  tres veces esa estimación. Reparto: `js/core/router.js` 22,
  `js/pages/dashboard.js` 20, `js/pages/inversiones.js` 16,
  `js/pages/cuentas.js` 15, `js/ui/configuracion.js` 14,
  `js/services/MovimientoServicio.js` 13, `js/pages/trading.js` 13,
  `js/core/pwa.js` 9.
- **Impacto**: ruido que entierra los errores que sí importan. Ningún `console`
  está detrás de una bandera de entorno, así que un `console.log` de datos de
  usuario (nombres de cuenta, importes) queda expuesto en la consola del
  navegador en producción.
- **Prioridad**: Baja
- **Solución propuesta**: mantener solo `console.error` en los manejadores de
  error; enviar el resto a un logger mínimo con nivel `debug` desactivado por
  defecto en producción. Un `no-console` de ESLINT con excepción para `error`
  impide la reincidencia.
- **Evidencia**: los 35 archivos listados arriba, con los conteos indicados
- **Nota**: **3 de estos `console.warn` silencian fallos no fatales**, lo que los
  convierte en bugs leves disfrazados de ruido:
  - `js/pages/dashboard.js:212` — *"No se pudieron cargar las cards visibles del
    dashboard"*: si falla la lectura de preferencias, el dashboard arranca con
    la disposición por defecto sin avisar.
  - `js/pages/dashboard.js:3241` — *"No se pudo registrar el snapshot"*: el
    histórico de patrimonio deja de crecer y nada lo indica.
  - `js/pages/inversiones.js:1128` — *"No se pudo obtener el historial"*: se
    muestra el gráfico vacío sin contexto (el `catch` se añadió en R-08, pero
    solo cubre el modal).

### DEUDA-015: `formatearMontoConDivisa` exportada y redefinida localmente
- **Módulo**: `js/services/DivisaServicio.js:46`, `js/pages/cuentas.js:71`
- **Descripción**: el servicio exporta `formatearMontoConDivisa(monto, moneda)`
  y cuatro módulos lo importan (`dashboard.js:20`, `configuracion.js:9`,
  `graficos.js:5`, y el propio servicio). `cuentas.js` **redefine una copia
  local** en lugar de importarlo. Además el servicio tiene
  `formatearMontoEnPrincipal` y `getSimboloDivisaPrincipal`, ambos muertos
  (**DEUDA-006**), lo que sugiere que la función local de `cuentas.js` es un
  intento anterior de cubrir ese caso.
- **Impacto**: dos implementaciones del mismo formateo con la misma firma. La de
  la página no respeta `getFormatoDivisa()` ni la divisa principal configurada
  por el usuario; la del servicio sí. Es decir, **la vista de Cuentas puede
  ignorar la preferencia de formato de divisa** sin que nada lo indique.
- **Prioridad**: Baja
- **Solución propuesta**: borrar la copia de `cuentas.js` e importar la del
  servicio, como ya hacen `dashboard.js`, `configuracion.js` y `graficos.js`.
  Conviene verificar antes que no cambia el aspecto de la página de Cuentas.
- **Evidencia**: `js/services/DivisaServicio.js:46` (el original),
  `js/pages/cuentas.js:71-77` (la copia),
  `js/pages/dashboard.js:20`, `js/ui/configuracion.js:9`, `js/ui/graficos.js:5`
  (los importadores correctos)

### DEUDA-019: Archivos huérfanos y de prueba en el repositorio
- **Módulo**: raíz del repositorio, `experimentos/`
- **Descripción**:
  - `experimentos/exp.js` — experimento de detección de multitáctil, versionado en
    `bd2ceb1` y **nunca importado** por la aplicación. La propia cabecera dice
    cómo cargarlo a mano.
  - `test-cache.html` — página de prueba de caché, referenciada solo por
    `firebase.json:18`, que la **excluye del despliegue**. Se versiona pero no se
    sirve en ningún entorno.
  - `generar_demo.mjs` — generador del `.dvid` de demo. Está en la raíz y
    **sin trackear** (`??` en `git status`), pese a ser la única fuente de los
    datos de referencia de la demo.
  - `escinco_prueba_v2.dvid` y `firestore-debug.log` — ambos ignorados por
    `.gitignore` (`*.dvid`, `*-debug.log`), presentes en el disco de trabajo.
- **Impacto**: bajo, pero condiciona el trabajo de los demás: `exp.js` y
  `test-cache.html` son ruido para quien lea el repo, y `generar_demo.mjs` se
  pierde en una limpieza de directorio porque Git no lo protege.
- **Prioridad**: Baja
- **Solución propuesta**: borrar `exp.js` y `test-cache.html` (y su entrada en
  `firebase.json`); **versionar `generar_demo.mjs`**, que es documentación
  ejecutable de cómo se fabricó la demo; añadir `.dvid` de prueba al `.gitignore`
  local ya existente sin cambios.
- **Evidencia**: `experimentos/exp.js:1-6`, `firebase.json:18`,
  `git status --short` (muestra `?? generar_demo.mjs`), `.gitignore` (reglas
  `*.dvid` y `*-debug.log`)

### DEUDA-020: `docs/informe-info.md` pesa 137 KB
- **Módulo**: `docs/`
- **Descripción**: un solo archivo de 137.095 bytes, el mayor de `docs/` con
  diferencia (el siguiente, `auditoria-dashboard.md`, pesa 14 KB). Mezcla
  hallazgos de auditoría, tablas de referencias de archivo y notas de versión.
- **Impacto**: ningún agente ni persona puede cargarlo completo en contexto ni
  revisarlo con atención. Es el único documento del proyecto con esta
  concentración de información, y es donde ya se registran hallazgos como el
  placeholder `tucson` (**DEUDA-007**).
- **Prioridad**: Baja
- **Solución propuesta**: trocear por fecha o por tema en `docs/informes/`, y
  dejar un índice en la raíz de `docs/`. Si el proyecto va a producir más
  auditorías, conviene fijar la convención ahora: un archivo por fecha
  (`docs/informes/2026-10-01.md`).
- **Evidencia**: `docs/informe-info.md` (137.095 bytes), `docs/auditoria-dashboard.md`
  (14.318), `docs/propuesta-dashboard.md` (12.286), `docs/modelo-datos.md` (12.202),
  `docs/requisitos.md` (6.924), `docs/roadmap.md` (2.529), `docs/reglas.md` (351)

### DEUDA-021: Sin scripts de `lint`, `test` ni `typecheck`
- **Módulo**: `package.json`
- **Descripción**: los cinco scripts existentes son de Firebase (`serve`,
  `emulators`, `deploy:hosting`, `deploy:rules`, `deploy`). No hay forma de
  validar nada automáticamente. El proyecto tampoco tiene dependencias de
  desarrollo: `package.json` no declara `devDependencies`.
- **Impacto**: es la causa raíz que hace posibles casi todas las demás entradas
  de esta lista. Sin linter, los exports muertos (**DEUDA-006**), el
  `console.*` (**DEUDA-010**) y los `toUpperCase()` sueltos (**DEUDA-016**) se
  acumulan sin que nada los señale. Sin test de reglas, el `hasOnly` se
  desincroniza dos veces (**DEUDA-013**).
- **Prioridad**: Baja en impacto inmediato, pero es la inversión que más
  reduce el resto.
- **Solución propuesta**: añadir ESLint con un config mínimo: `no-unused-vars`
  (detecta **DEUDA-006**), `no-console` con excepción para `error` (**DEUDA-010**)
  y un plugin de Firebase que valide las reglas contra los emuladores en CI
  (**DEUDA-012**, **DEUDA-013**). Empezar por `no-unused-vars` y
  `no-console`: son los dos que más rápido pagan.
- **Evidencia**: `package.json` (los 5 scripts, sin `devDependencies`)