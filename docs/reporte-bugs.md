# Reporte de bugs conocidos

Proyecto: **escinco** · Fase: **beta** (1.0.0-beta.17)

## Resumen

- Total de bugs identificados: **21**
- Resueltos: **13**
- Pendientes: **8**
- Críticos: **0**
- Altos: **0**
- Medios: **3**
- Bajos: **5**

Los cuatro conteos de severidad son **de los bugs pendientes**. Entre los 13
resueltos hay 2 de severidad Alta (R-03 y R-05) y 1 más Alta (BUG-019).

### Convenciones de identificadores

| Prefijo | Significado |
|---------|-------------|
| `R-01`…`R-11` | Bugs **resueltos**, ordenados por commit |
| `BUG-013`…`BUG-025` | Bugs con identificador propio, resueltos o pendientes |

`BUG-012` ("Transferencias no permiten agregar concepto") se investigó en el
código y resultó **ya corregido** por `38e7f7a`; quedó registrado como **R-01**
y su identificador original no se reutiliza.

`BUG-021`, `BUG-022` y `BUG-023` se proponían para tres `console.warn` que
silencian fallos no fatales, pero finalmente se determinaron **dentro de
DEUDA-010** (limpieza de `console.*`) y no se emiten como bugs independientes.
Esa numeración queda como hueco.

Escala de severidad: **Crítica** (bloquea el uso) · **Alta** (pérdida de datos
o acción destructiva) · **Media** (funciona mal en un caso real) · **Baja**
(cosmético o de comodidad).

---

## Bugs resueltos

| ID | Título | Módulo | Severidad | Commit | Fecha |
|----|--------|--------|-----------|--------|------|
| R-01 | Transferencias sin campo de concepto | `constants/tiposMovimiento.js` | Media | `38e7f7a` | 2026-10-01 |
| R-02 | Transferencias mostradas como negativas en la cuenta destino | `js/pages/cuentas.js` | Media | `a942616` | 2026-10-01 |
| R-03 | `operacion` rechazado por las reglas al crear movimientos tipo error | `firebase/firestore.rules` | Alta | `9c4cc4b` | 2026-10-01 |
| R-04 | Tres correcciones: `case` duplicado en lastbar, precaché incompleto, roundtrip de backup | `js/core/lastbar.js`, `sw.js`, `js/services/ImportarServicio.js` | Media | `ea1b411` | 2026-09-20 |
| R-05 | `metaId` rechazado por las reglas al crear aportes a meta | `firebase/firestore.rules` | Alta | `c014e94` | 2026-09-22 |
| R-06 | Cards del dashboard no clicables (movimientos, favoritos, metas) | `js/pages/dashboard.js` | Media | `c014e94` | 2026-09-22 |
| R-07 | Click en una meta del dashboard abría el modal equivocado | `js/pages/dashboard.js` | Baja | `c014e94` | 2026-09-22 |
| R-08 | El gráfico de un activo sin historial rompía el modal | `js/pages/inversiones.js` | Media | `c014e94` | 2026-09-22 |
| R-09 | `margin: 0 auto` en `button`/`select` centraba controles de toda la app | `css/style.css` | Media | `c014e94` | 2026-09-22 |
| R-10 | Header de modal con `cursor: grab` en modales fijos; `border` anulado en el cierre | `css/modal.css`, `css/movimientos.css` | Baja | `c014e94` | 2026-09-22 |
| R-11 | Cards clicables sin `cursor: pointer` | `css/dashboard.css` | Baja | `c014e94` | 2026-09-22 |
| BUG-024 | Divergencia entre las tres copias de `esMovimientoPositivo` | `js/pages/movimientos.js`, `js/pages/dashboard.js` | Baja | `89d9f58` | 2026-10-03 |
| BUG-019 | Los modales de progreso son descartables a media operación | `js/ui/configuracion.js`, `js/ui/exportar.js`, `js/ui/modal.js` | **Alta** | `b953014` | 2026-10-03 |

> **Nota sobre R-02:** el commit declara corregido el signo de las
> transferencias, pero solo se aplicó a `js/pages/cuentas.js`. Las otras dos
> copias de la función quedaron atrás: ver **BUG-024**.

### Detalle de los bugs resueltos

#### R-01: Transferencias sin campo de concepto
El tipo `transferencia` no declaraba ningún campo opcional, así que
`recogerDatosFormulario` (`js/ui/formularioMovimiento.js:336`) no dibujaba input
para el concepto y el movimiento se guardaba sin etiqueta. Se añadió
`camposOpcionales: ["concepto"]`. El formulario, la lectura de datos,
`MovimientoServicio` y las reglas de Firestore ya soportaban el campo: no hubo
que tocar ninguno de esos tres.

#### R-02: Transferencias mostradas como negativas en la cuenta destino
El signo se decidía sin perspectiva de cuenta, así que una transferencia se
mostraba negativa tanto en el origen como en el destino. `esMovimientoPositivo`
pasó a comparar con `cuentaDestino`; sin `cuentaId` (lista global y dashboard)
mantiene el comportamiento negativo, coherente con la etiqueta de origen.
**Corrección incompleta: ver BUG-024.**

#### R-03: `operacion` rechazado por las reglas
El tipo `error` declara `operacion` como campo obligatorio, el formulario lo
escribe y `MovimientoServicio` lo lee, pero `operacion` no figuraba en el
`hasOnly` de `create`. Eso hacía fallar `addDoc` con *"Missing or insufficient
permissions"* y, por extensión, el **deshacer**, porque `restaurarDocumento` usa
`setDoc`, que dispara `create`. También se cerró el hueco de `update`, que no
validaba el campo.

#### R-04: Tres correcciones agrupadas
1. El `case` de `inversiones` estaba duplicado y separado en `lastbar.js`, lo
   que dejaba la navegación inconsistente.
2. El precaché del service worker no incluía los módulos vivos, provocando
   fallos al arrancar sin red.
3. El backup `.dvid` de escinco no hacía roundtrip: se perdían datos al
   reimportar.

#### R-05: `metaId` rechazado por las reglas
Mismo modo de fallo que R-03: `metaId` faltaba en el `hasOnly` de `create` y en
la validación de `update` de `usuarios/{uid}/movimientos`. Los aportes a meta
fallaban con *"Missing or insufficient permissions"*.

#### R-06: Cards del dashboard no clicables
`plantillaMovimiento` y `plantillaFavorito` no emitían `data-*` ni
`role="button"`, y no existía ningún listener. Se añadieron
`enlazarMovimientos()` y `enlazarFavoritos()` con delegación de eventos y
soporte de teclado (Enter/Espacio).

#### R-07: Click en una meta abría el modal equivocado
`enlazarListaMetas` usaba un `lista.onclick` que ignoraba el item pulsado y
siempre llamaba `mostrarMetas()` (listado), en vez de abrir el formulario de
aporte. Ahora cada `.meta-item` abre `abrirModalAporteMeta(meta)`.

#### R-08: El gráfico de un activo sin historial rompía el modal
`mostrarGraficoActivo()` no manejaba el caso de historial vacío ni el error de
`historialParaGrafico()`, y quedaba un modal sin gráfico. Ahora captura el error
y notifica *"No hay historial de precios disponible para este activo"*.

#### R-09: `margin: 0 auto` en controles globales
`button, select` heredaban `margin: 0 auto` desde `css/style.css`, lo que
centraba en su contenedor todo control inline de la app, no solo los que
deben estar centrados.

#### R-10: Header de modal arrastrable en modales fijos
`.modal-header { cursor: grab }` se aplicaba también al modo estándar, donde
el modal es fijo y centrado y no se puede arrastrar. Se acotó a
`.modal-overlay-ventana`. Además `.modal-close` declaraba `border: 1px solid`
y luego `border: none`, que lo anulaba; y `.modal-footer` /
`.movimiento-detalle-acciones` cambiaron de `flex-end` a `center`.

#### R-11: Cards clicables sin `cursor: pointer`
`.movimiento-item` y `.favorito-item` eran clicables (R-06) pero no declaraban
`cursor: pointer`.

#### BUG-024: Divergencia entre las tres copias de `esMovimientoPositivo`
- **Módulo**: `js/pages/movimientos.js`, `js/pages/dashboard.js`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Resuelto por `89d9f58` (2026-10-03)
- **Descripción**: la función `esMovimientoPositivo` está triplicada y había
  divergido. El commit `a942616` (R-02) añadió la rama `transferencia` solo en
  la copia de `cuentas.js`. Las copias de `movimientos.js` y `dashboard.js` no
  la tienen, pero **no la necesitan**: todos sus call sites omiten `cuentaId` y
  la función se aplica sobre la lista global, donde manda la etiqueta de origen.
  Lo que era real era la divergencia en sí, no un síntoma visible: propagar la
  rama sin más habría lanzado `ReferenceError` (ninguna de las dos funciones
  declaraba el parámetro `cuentaId`), y con el parámetro añadido el
  comportamiento no cambia porque `cuentaId` siempre llega en `null`.
- **Pasos para reproducir**: no aplica. Ninguna vista de Movimientos ni del
  Dashboard muestra un movimiento desde la perspectiva de una cuenta.
- **Resultado esperado**: las tres copias de la función son idénticas, para que
  su unificación sea un cambio mecánico.
- **Resultado actual**: las tres copias coinciden. La unificación en un módulo
  compartido sigue pendiente en **DEUDA-004**.
- **Evidencia**: `js/pages/cuentas.js:672-679` (referencia),
  `js/pages/movimientos.js:283-295` y `js/pages/dashboard.js:2581-2594`
  (corregidas en `89d9f58`),
  `js/pages/movimientos.js:250, 301, 716, 1363` y `js/pages/dashboard.js:2565, 2600`
  (call sites que siempre omiten `cuentaId`)
- **Notas**: queda pendiente la rama `pagoTarjeta`, que sigue faltando en estas
  dos copias y está conectada con **DEUDA-003** y **DEUDA-001**. El caso
  latente que este trabajo deja tapado está en **BUG-025**.

#### BUG-019: Los modales de progreso son descartables a media operación
- **Módulo**: `js/ui/configuracion.js`, `js/ui/exportar.js`, `js/ui/modal.js`
- **Severidad**: Alta
- **Prioridad**: Alta
- **Estado**: Resuelto por `b953014` (2026-10-03)
- **Descripción**: los cuatro modales de progreso de la aplicación se abren con
  `confirmText: null, cancelText: null` y **sin `onConfirm` propio**. Como no
  tienen callback de confirmación, la bandera `procesando` de `abrirModal` nunca
  llega a activarse en ellos, así que el guard de `cerrar()`
  (`js/ui/modal.js:145`) no protege nada. Al heredear los valores por defecto
  de `abrirModal` (`cerrarAlClickFuera: true`, `cerrarConEsc: true`, `true`) y
  tener siempre presente la X del header, el usuario podía cerrarlos por las
  tres vías mientras la operación seguía corriendo, y se quedaba sin ninguna
  señal de que el proceso continuaba.

  Los cuatro sitios:

  | # | Ubicación | Título | ¿Destructivo? |
  |---|-----------|--------|----------------|
  | 1 | `js/ui/configuracion.js:1982-1998` | Eliminando datos | **Sí** — borra todos los datos del usuario |
  | 2 | `js/ui/configuracion.js:2226-2242` | Eliminando cuenta | **Sí** — borra la cuenta y redirige a `/login` |
  | 3 | `js/ui/configuracion.js:1816-1832` | Importando... | **Sí** — importa un `.dvid` sobre los datos actuales |
  | 4 | `js/ui/exportar.js:14-30` | Exportando respaldo | No — el archivo se descarga igual |

  El caso más grave es el **nº 2**: cuando el usuario cerraba el modal, la cuenta
  ya se había borrado y el `window.location.replace("/login")` de la línea 2253
  lo expulsaba de la aplicación a media operación, sin haber visto el resultado.
- **Pasos para reproducir**:
  1. Configuración → *Eliminar todos los datos* (o *Eliminar cuenta*, o
     *Importar .dvid*, o *Exportar .dvid*).
  2. Confirmar la confirmación previa.
  3. Mientras se muestra el modal de progreso, pulsar la **X** del header.
  4. Repetir con **ESC**.
  5. Repetir con un **clic fuera** del modal.
  6. Observar que el modal se cierra y la operación sigue su curso.
- **Resultado esperado**: el modal de progreso no se puede cerrar por ninguna vía
  hasta que la operación termine, y entonces muestra su resultado.
- **Resultado actual**: se cierra por la X, por ESC o por clic fuera, y el
  usuario se queda sin feedback mientras la operación termina a escondidas.
- **Evidencia**:
  - `js/ui/modal.js:62-64` (valores por defecto de las tres opciones de cierre)
  - `js/ui/modal.js:145` (el guard `if (procesando) return`, inactivo aquí al no
    existir `onConfirm`)
  - `js/ui/modal.js:99` (la X, que antes se renderizaba incondicionalmente en la
    línea 95, sin forma de ocultarla)
  - `js/ui/configuracion.js:1982-1998`, `js/ui/configuracion.js:2226-2242`,
    `js/ui/configuracion.js:1816-1832`, `js/ui/exportar.js:14-30` (los cuatro)
  - `js/ui/configuracion.js:2253` (el `location.replace` a media operación)
- **Notas**: el arreglo (`b953014`) añade la opción `cerrarConBotonX` a
  `abrirModal` y aplica `cerrarAlClickFuera: false`, `cerrarConEsc: false` y
  `cerrarConBotonX: false` a los cuatro modales. Los cuatro usos de `closeBtn`
  en `modal.js` ya eran optional-chained, así que la X ausente no rompe nada.

  Este bug **se detectó por error de análisis**: se documentó en un principio
  como *"el modal se cierra a media operación"*, yendo al guard `procesando` que
  en realidad lo impedía. El razonamiento del cambio queda en *Trazabilidad*.

---

## Bugs pendientes

| ID | Título | Módulo | Severidad | Prioridad | Estado |
|----|--------|--------|-----------|-----------|--------|
| BUG-013 | La cuenta nueva no se selecciona automáticamente | `js/pages/cuentas.js` | Media | Media | Pendiente |
| BUG-014 | "Estado del ciclo" de la tarjeta aparece dentro del scroll | `js/pages/cuentas.js` | Baja | Baja | Pendiente |
| BUG-015 | El badge de estado "Normal" no abre el modal educativo | `js/pages/cuentas.js` | Baja | Baja | Pendiente |
| BUG-016 | El hover del selector de tipo ilumina un cuadrado | `js/pages/movimientos.js`, `css/pendientes.css` | Baja | Baja | Pendiente |
| BUG-017 | El pie de Configuración se extiende debajo del sidebar | `js/ui/configuracion.js` | Baja | Baja | Pendiente |
| BUG-018 | El loading de los modales fijos se posiciona mal | `js/ui/modal.js`, `css/modal.css` | Media | Media | Pendiente |
| BUG-020 | `fechaRealizacion` se guarda como `Date` en dos rutas | `js/pages/inversiones.js` | Media | Media | Pendiente |
| BUG-025 | El filtro por cuenta inactivo deja negativas las transferencias entrantes | `js/pages/movimientos.js` | Baja | Baja | Pendiente (latente) |

---

## Detalle de bugs pendientes

### BUG-025: El filtro por cuenta inactivo deja negativas las transferencias entrantes
- **Módulo**: `js/pages/movimientos.js`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Pendiente — latente, no se reproduce hoy
- **Descripción**: la página de Movimientos no tiene filtro por cuenta activo
  (la búsqueda de `filtros.cuenta` no se usa en la página). El filtrado por
  cuenta ya existe en el servicio, así que el día que se conecte, una
  transferencia entrante se seguirá viendo **negativa**: `plantillaMovimiento(m)`
  recibe solo el movimiento y llama a `esMovimientoPositivo(m)` sin
  `cuentaId`, así que la rama `transferencia` devuelve siempre `false`.
- **Pasos para reproducir**: no reproducibles hoy, porque el filtro no está
  activo. Se reproducirá en cuanto se conecte `filtros.cuenta`:
  1. Conectar el filtro por cuenta en la página de Movimientos.
  2. Crear una transferencia de A (origen) a B (destino).
  3. Filtrar la lista por la cuenta B.
  4. Localizar la transferencia en los resultados.
- **Resultado esperado**: con el filtro por B activo, la transferencia aparece
  con signo **positivo**, igual que en la vista de Cuentas.
- **Resultado actual**: no aplica con el filtro inactivo (la lista es global y
  la transferencia se etiqueta con su cuenta de origen, que es el comportamiento
  correcto). Con el filtro conectado, la aparecería negativa en B.
- **Evidencia**: `js/pages/movimientos.js:283` (la rama `transferencia` y el
  parámetro `cuentaId`, ambos presentes pero nunca usados),
  `js/pages/movimientos.js:248` (`plantillaMovimiento(m)`, sin ámbito de cuenta),
  `js/services/MovimientoServicio.js:657-666` (el filtro por cuenta que ya
  existe y no está conectado)
- **Notas**: resolver junto con **DEUDA-004**. Al unificar
  `esMovimientoPositivo` en un módulo compartido no basta con copiar la función:
  hay que pasar el `cuentaId` desde `plantillaMovimiento` hasta la llamada, o
  el bug reaparece en cuanto se conecte el filtro.

### BUG-013: La cuenta nueva no se selecciona automáticamente
- **Módulo**: `js/pages/cuentas.js`
- **Severidad**: Media
- **Prioridad**: Media
- **Estado**: Pendiente
- **Descripción**: los tres caminos de creación de cuenta llaman a
  `crearCuenta()` y a `cargarCuentas()`, pero nunca a `seleccionarCuenta()`.
  `cargarCuentas()` preserva la selección anterior y, si no hay ninguna, elige
  `cuentas[0]`. El resultado es que la cuenta recién creada no queda
  seleccionada, pese a que `crearCuenta` sí devuelve el `DocumentReference` con
  su `.id` y el dato está disponible.
- **Pasos para reproducir**:
  1. Entrar a Cuentas con al menos una cuenta ya seleccionada.
  2. Crear una cuenta nueva (lastbar → *Nueva cuenta*), cualquier tipo.
  3. Observar la vista tras el toast *"Cuenta creada"*.
  4. Repetir partiendo de cero, sin ninguna cuenta seleccionada.
- **Resultado esperado**: el detalle de la cuenta recién creada se abre
  automáticamente, para poder verificarla y empezar a operar sobre ella.
- **Resultado actual**: el detalle sigue mostrando la cuenta anterior (o la
  primera del listado). El usuario tiene que buscarla y hacer clic.
- **Evidencia**: `js/pages/cuentas.js:1558-1561` (formulario dos pasos),
  `js/pages/cuentas.js:1702-1705` (formulario de un paso),
  `js/pages/cuentas.js:1843` (formulario antiguo),
  `js/pages/cuentas.js:170-175` (la preservación de selección en `cargarCuentas`),
  `firebase/firestore.js:118-125` (`crearCuenta` devuelve el resultado de `addDoc`)
- **Notas**: son tres sitios a corregir porque conviven un formulario de dos
  pasos, uno de un paso y el antiguo. Si se unifica la creación en una sola
  función, el arreglo es de una línea.

### BUG-018: El loading de los modales fijos se posiciona mal
- **Módulo**: `js/ui/modal.js`, `css/modal.css`
- **Severidad**: Media
- **Prioridad**: Media
- **Estado**: Pendiente — el estado de carga **sí existe**, el defecto es de colocación
- **Descripción**: el indicador de carga (logo de escinco girando) se posiciona
  con `top: 48%` respecto de la caja completa del `.modal` (header + body +
  footer), no respecto del `.modal-body`, que es la única zona que se difumina.
  En consecuencia no queda centrado sobre el contenido.
- **Pasos para reproducir**:
  1. Abrir un modal de confirmación de altura corta (por ejemplo *Eliminar
     cuenta*).
  2. Pulsar confirmar.
  3. Observar dónde aparece el logo girando respecto del título y del texto.
  4. Comparar con un modal alto (por ejemplo el de configuración).
- **Resultado esperado**: el indicador centrado sobre el área de contenido
  difuminada, sea cual sea la altura del modal.
- **Resultado actual**: en modales cortos el logo invade el área del
  encabezado; en los altos queda descentrado respecto del cuerpo.
- **Evidencia**: `js/ui/modal.js:178-183` (se añade `.modal-procesando-logo`
  como hijo de `.modal`), `css/modal.css:403-415` (`position: absolute`,
  `top: 48%`), `css/modal.css:397-401` (lo que se difumina es `.modal-body`)
- **Notas**: la animación en sí es correcta: `@keyframes loading` está definida
  en `css/style.css:980` y `.loading-logo svg.spin` en `css/modal.css:561`.
  El defecto grave de este mismo flujo, el cierre del modal a media operación,
  está registrado como **BUG-019**.

### BUG-020: `fechaRealizacion` se guarda como `Date` en dos rutas
- **Módulo**: `js/pages/inversiones.js`
- **Severidad**: Media
- **Prioridad**: Media
- **Estado**: Pendiente
- **Descripción**: los modales de **compra** y **venta** manual de
  inversiones escriben `fechaRealizacion` como un objeto `Date`. `addDoc` lo
  convierte a `Timestamp` de Firestore, mientras que el resto de la aplicación
  usa string `"YYYY-MM-DD"`. Como `normalizarFechaFutura()` solo normaliza
  cuando el valor es string, estas dos rutas **no recortan las fechas futuras**,
  contradiciendo la regla documentada en el propio archivo.
- **Pasos para reproducir**:
  1. En Inversiones, registrar una **compra** manual con fecha de realización
     en el futuro.
  2. Confirmar que se guarda con esa fecha futura (el resto de tipos de
     movimiento la convierten a hoy).
  3. Repetir en el modal de **venta**.
  4. Opcional: leer el documento y observar que `fechaRealizacion` es un
     `Timestamp`, no un string.
- **Resultado esperado**: toda `fechaRealizacion` se guarda como string
  `"YYYY-MM-DD"` y se normaliza a hoy cuando es futura, en los tres tipos de
  vía de alta.
- **Resultado actual**: dos de las tres vías guardan un `Timestamp` y aceptan
  fechas futuras.
- **Evidencia**: `js/pages/inversiones.js:1505` (compra),
  `js/pages/inversiones.js:1624` (venta),
  `js/services/MovimientoServicio.js:19-25` (`normalizarFechaFutura`, solo
  actúa sobre strings),
  `js/services/MovimientoServicio.js:17-18` (la regla documentada que se incumple)
- **Notas**: la vista no se rompe porque `formatearFecha`
  (`js/pages/cuentas.js:1029-1042`) y `normalizarFecha`
  (`js/services/MovimientoServicio.js:709-713`) sí saben leer `Timestamp`. El
  problema es la inconsistencia de datos de partida, tratada como **DEUDA-011**,
  y el incumplimiento de la regla de fechas futuras. Las reglas de Firestore no
  lo detectan porque `create` no valida el tipo de `fechaRealizacion`
  (**DEUDA-012**).

### BUG-014: "Estado del ciclo" de la tarjeta aparece dentro del scroll
- **Módulo**: `js/pages/cuentas.js`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Pendiente
- **Descripción**: la fila *"Estado del ciclo"* se emite dentro de
  `.cuenta-detalle`, que es el contenedor con scroll del panel de detalle. Duplica
  la información que el badge del encabezado ya muestra, y ese badge está fuera
  del scroll. Al desplazarse, el usuario ve el mismo dato dos veces.
- **Pasos para reproducir**:
  1. Ir a Cuentas y seleccionar una **tarjeta de crédito**.
  2. Ver el badge de estado en la esquina superior derecha del encabezado
     (*Normal*, *Advertencia*, *Crítico* o *Pagado*).
  3. Desplazar el bloque de detalle hasta el final.
  4. Observar la fila *"Estado del ciclo"* con el mismo valor.
- **Resultado esperado**: el estado del ciclo se muestra **solo** en el badge
  del encabezado, que permanece siempre visible.
- **Resultado actual**: aparece también como última fila del bloque con scroll,
  duplicando el dato.
- **Evidencia**: `js/pages/cuentas.js:479-482` (la fila dentro de
  `.cuenta-detalle`), `js/pages/cuentas.js:423` (el badge del encabezado),
  `css/cuentas.css:207-217` (`.cuenta-detalle` con `overflow-y: auto`)
- **Notas**: la fila es la última del bloque, así que solo se ve al llegar al
  final del scroll; por eso convivió tanto tiempo sin reportarse.

### BUG-015: El badge de estado "Normal" no abre el modal educativo
- **Módulo**: `js/pages/cuentas.js`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Pendiente
- **Descripción**: el badge de estado de la tarjeta se renderiza como un `span`
  plano: sin `tabindex`, sin `role`, sin `data-*`, sin `cursor: pointer` y **sin
  ningún listener**. Tampoco existe el modal educativo que debería abrir. El
  usuario que no entiende qué significa *Normal* / *Advertencia* / *Crítico* no
  tiene dónde consultarlo.
- **Pasos para reproducir**:
  1. Ir a Cuentas y seleccionar una tarjeta de crédito.
  2. Localizar el badge de estado junto a *Tarjeta de crédito*.
  3. Hacer clic sobre él.
  4. Intentar alcanzarlo con el teclado (Tab).
- **Resultado esperado**: el badge es un control activable (por clic y por
  teclado) que abre un modal educativo explicando los niveles de uso de la
  línea de crédito.
- **Resultado actual**: no ocurre nada al hacer clic; el badge no es alcanzable
  con el teclado y no hay ningún modal educativo en el código.
- **Evidencia**: `js/pages/cuentas.js:423` (el `span` sin atributos de
  interacción), `js/pages/cuentas.js:409` (el `claseBadge` que decide el
  aspecto pero nunca se enlaza),
  `js/pages/cuentas.js:347, 864, 1489-1491` (los únicos `querySelectorAll` de
  la página: ninguno sobre `.cuenta-badge`)
- **Notas**: existe un resto del diseño anterior en
  `css/cuentas.css:298`, un comentario que aún dice *"CRÉDITO · BARRA DE USO
  (modal educativo)"*. Conviene decidir si el modal educativo se implementa o si
  el badge deja de aparentar ser interactivo.

### BUG-016: El hover del selector de tipo ilumina un cuadrado
- **Módulo**: `js/pages/movimientos.js`, `css/pendientes.css`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Pendiente
- **Descripción**: los tipos destacados (*Ingreso* y *Gasto*) se emiten como un
  `<div>` que se estira a ocupar toda su celda del grid `1fr 1fr`, con fondo
  transparente y sin bordes. El objetivo visual y el único con listener es el
  círculo interior. Pero la regla `:hover` se aplica al `div` completo, así que
  **la zona sensible es el cuadrado entero**: al pasar el cursor por las esquinas
  vacías alrededor del círculo se dispara el efecto, y lo que se ve iluminado es
  un bloque cuadrado en lugar del círculo.
- **Pasos para reproducir**:
  1. Movimientos → *Nuevo movimiento*.
  2. Situar el cursor sobre el círculo de *Ingreso*: el círculo se ilumina.
  3. Mover el cursor fuera del círculo pero **dentro de la misma celda**, hacia
     una esquina.
  4. Observar que el efecto se sigue disparando.
- **Resultado esperado**: el efecto de hover se activa únicamente al pasar
  sobre el círculo, que es el objetivo real y el único clicable.
- **Resultado actual**: basta con entrar en la celda completa; el `transform:
  scale(1.02)` se aplica a un bloque cuadrado, y además el `div` no es
  alcanzable por teclado (solo el `button` interior lo es).
- **Evidencia**: `js/pages/movimientos.js:853-858` (el `div.tipo-movimiento-btn`
  envuelve a un `button.tipo-icono`),
  `js/pages/movimientos.js:898-902` (el listener está solo en `.tipo-icono`),
  `css/pendientes.css:242-246` (grid `1fr 1fr`),
  `css/pendientes.css:274-284` (`.tipo-principal` estira, fondo transparente),
  `css/pendientes.css:318-320` (`.tipo-movimiento-btn:hover { transform: scale() }`)
- **Notas**: el elemento debería ser un `<button>` por sí mismo, o el `:hover`
  debería aplicarse a `.tipo-movimiento-btn.tipo-principal .tipo-icono`, que ya
  tiene su propio `:hover` (en `css/pendientes.css:300-306`). De paso se
  arreglaría la accesibilidad por teclado.

### BUG-017: El pie de Configuración se extiende debajo del sidebar
- **Módulo**: `js/ui/configuracion.js`, `css/configuracion.css`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Pendiente
- **Descripción**: el pie con la versión (`.panel-footer`) se emite como
  **hermano** de `.config-layout`, no como ítem de su grid. Como
  `.config-layout` es un grid de dos columnas (`210px` para el menú de
  secciones y el resto para el contenido) y el pie está fuera, ocupa el ancho
  completo del modal y se extiende por debajo de la columna del menú.
- **Pasos para reproducir**:
  1. Abrir Configuración como panel (lastbar) o como página, según la
     preferencia de accesibilidad.
  2. Observar el pie con la versión y el copyright.
  3. Comprobar que su borde izquierdo arranca en el mismo `x` que el menú de
     secciones, no con el del contenido.
- **Resultado esperado**: el pie alineado con la columna del contenido, sin
  extenderse bajo el sidebar.
- **Resultado actual**: el pie es una barra de ancho completo que pasa por
  debajo del sidebar. En modo página el problema persiste: la variante
  `.config-pagina .panel-footer` solo cambia `position` a `static`, sin alterar
  la anchura.
- **Evidencia**: `js/ui/configuracion.js:478-482` (el `footer`, hermano del
  `.config-layout`), `js/ui/configuracion.js:69-77` (el grid y sus dos hijos),
  `css/configuracion.css:78-83` (`grid-template-columns: 210px minmax(0, 1fr)`),
  `css/configuracion.css:467-481` (`.panel-footer` con márgenes negativos a
  borde de `.modal-body`),
  `css/configuracion.css:178-185` (variante de página, `position: static`)
- **Notas**: el pie está `position: sticky; bottom: 0` para que la versión siga
  visible en secciones largas; la solución debe preservar ese comportamiento
  (por ejemplo, haciéndolo ítem del grid en la fila 2, columna 2).

---

## Trazabilidad

| Origen | Destino |
|--------|---------|
| `BUG-012` (pendiente en el reporte original) | Resuelto por `38e7f7a` → **R-01** |
| `c014e94` "correcciones y pc más" (mensaje vago) | **R-05** … **R-11** |
| `a942616` declarado completo | **R-02**, pero solo en 1 de 3 copias → **BUG-024** |
| Sin reportar, hallazgo del análisis de código | **BUG-019**, **BUG-020** |
| Sin reportar, hallazgo al aplicar BUG-024 | **BUG-025** (latente) |
| Sin reportar, propuesto y luego descartado | BUG-021/022/023 → **DEUDA-010** |
| `576d71c` (comentario corregido) | Impide volver a afirmar el síntoma falso de BUG-019 |

Pendiente de verificación manual: **BUG-016**, **BUG-017** y **BUG-018**. Los
tres dependen de percepción visual: su mecanismo está identificado en el código
CSS, pero conviene una comprobación en navegador antes de darlos por buenos. El
resto se confirmó leyendo el código, salvo **BUG-025**, que es latente por
definición: no se reproduce mientras el filtro por cuenta no esté conectado.

### Correcciones de alcance aplicadas durante la redacción

Este registro se redactó en dos pasos y dos de los hallazgos iniciales
resultaron estar mal descritos. Se deja la corrección visible porque el
razonamiento importa más que el estado final.

**BUG-024** se documentó como *"el fix de transferencias no se propagó a 2 de 3
vistas"*, con severidad Media. Al verificar los call sites se comprobó que
Movimientos y Dashboard nunca pasan `cuentaId` y no tienen vista por cuenta, así
que el síntoma descrito no se reproducía. Se reclasificó a Baja como
divergencia entre copias, y el caso que sí podría manifestarse quedó registrado
aparte como **BUG-025**.

**BUG-019** se documentó como *"el modal fijo se cierra al hacer clic fuera
mientras procesa"*, con severidad Alta. Ese diagnóstico era **falso**: las cuatro
vías de cierre (X, ESC, clic fuera y Cancelar) pasan por `cerrar()`, que aborta
mientras `procesando === true` (`js/ui/modal.js:145`). El error vino de leer el
CSS (`pointer-events`) e inferir el comportamiento de JS sin abrir esa función.
Al verificarlo apareció el defecto real, que es distinto y sí se reproducía: los
cuatro modales de progreso se abren **sin `onConfirm`**, así que `procesando`
nunca se activa en ellos y el guard no protege nada, heredando
`cerrarAlClickFuera`, `cerrarConEsc` y la X. Se mantuvo la severidad Alta,
ahora con el contenido correcto, y se amplió de 1 a los 4 sitios afectados.

De ambos casos salió además una lección operativa que quedó en el código: el
comentario de `modal.js` sobre el overlay (corregido en `576d71c`) afirmaba que
la interfaz de fondo seguía navegable, cuando el CSS hace lo contrario. El
código y su documentación discrepaban, y la documentación era la que mentía.

Documento relacionado: [`deuda-tecnica.md`](./deuda-tecnica.md). Los bugs
**BUG-013** a **BUG-018**, **BUG-024** y **BUG-025** tienen su causa raíz o su
solución en los ítems **DEUDA-003**, **DEUDA-004**, **DEUDA-006** y
**DEUDA-012**.
