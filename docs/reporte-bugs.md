# Reporte de bugs conocidos

Proyecto: **escinco** · Fase: **beta** (1.0.0-beta.17)

## Resumen

- Total de bugs identificados: **26**
- Resueltos: **20**
- Pendientes: **5**
- Descartados: **1**
- Críticos: **0**
- Altos: **0**
- Medios: **1**
- Bajos: **4**

Los cuatro conteos de severidad son **de los bugs pendientes**. Entre los 20
resueltos hay 2 de severidad Alta (R-03 y R-05) y 3 más Alta (BUG-019, BUG-029
y BUG-030). El descartado (BUG-018) estaba como Media. **Ya no queda ningún bug
de severidad Alta pendiente**, que era el objetivo.

### Convenciones de identificadores

| Prefijo | Significado |
|---------|-------------|
| `R-01`…`R-11` | Bugs **resueltos**, ordenados por commit |
| `BUG-013`…`BUG-030` | Bugs con identificador propio, resueltos o pendientes |

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
| BUG-013 | La cuenta nueva no se selecciona automáticamente | `js/pages/cuentas.js` | Media | `bf663ab` (+ `ae6b045`) | 2026-10-03 |
| BUG-014 | "Estado del ciclo" de la tarjeta aparece dentro del scroll | `js/pages/cuentas.js` | Baja | `9cfe6cd` | 2026-10-03 |
| BUG-015 | El badge de estado "Normal" no abre el modal educativo | `js/pages/cuentas.js` | Baja | `9cfe6cd` | 2026-10-03 |
| BUG-020 | `fechaRealizacion` se guarda como `Date` en dos rutas | `js/pages/inversiones.js` | Media | `a4b1041` | 2026-10-03 |
| BUG-029 | Un `ReferenceError` rompe la vista de detalle de movimientos | `js/pages/movimientos.js` | **Alta** | `496e6b2` | 2026-10-03 |
| BUG-030 | El campo `id` del historial rompe la importación en cuentas nuevas | `js/services/ExportarServicio.js`, `js/services/ImportarServicio.js` | **Alta** | `f05fef5` | 2026-10-03 |
| BUG-027 | Se ofrece "Pagar tarjeta" en un ciclo ya pagado | `js/pages/cuentas.js`, `js/services/CreditoServicio.js` | Baja | `944819d` | 2026-10-03 |

> **Nota sobre R-02:** el commit declara corregido el signo de las
> transferencias, pero solo se aplicó a `js/pages/cuentas.js`. Las otras dos
> copias de la función quedaron atrás: ver **BUG-024**.

> **Nota sobre BUG-014, BUG-015, BUG-020, BUG-027, BUG-029 y BUG-030:** los seis
> están commiteados y revisados en código, pero **ninguno verificado todavía en
> navegador** (salvo BUG-030, que se verificó por ejecución). Se anotan como
> resueltos de forma provisional: si al verificarlos fallaran, se revierte el
> commit y vuelven a la lista de pendientes.

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

#### BUG-013: La cuenta nueva no se selecciona automáticamente
- **Módulo**: `js/pages/cuentas.js`
- **Severidad**: Media
- **Prioridad**: Media
- **Estado**: Resuelto por `bf663ab` (2026-10-03), cerrado con `ae6b045`
- **Descripción**: los caminos de creación de cuenta llamaban a `crearCuenta()`
  y a `cargarCuentas()`, pero nunca a `seleccionarCuenta()`.
  `cargarCuentas()` preserva la selección anterior y, si no hay ninguna, elige
  `cuentas[0]`. El resultado era que la cuenta recién creada no quedaba
  seleccionada, pese a que `crearCuenta` sí devuelve el `DocumentReference` con
  su `.id` y el dato estaba disponible.
- **Pasos para reproducir**:
  1. Entrar a Cuentas con al menos una cuenta ya seleccionada.
  2. Crear una cuenta nueva (lastbar → *Nueva cuenta*), cualquier tipo.
  3. Observar la vista tras el toast *"Cuenta creada"*.
  4. Repetir partiendo de cero, sin ninguna cuenta seleccionada.
- **Resultado esperado**: el detalle de la cuenta recién creada se abre
  automáticamente, para poder verificarla y empezar a operar sobre ella.
- **Resultado actual**: corregido. Los dos caminos vivos llaman a
  `seleccionarCuenta(creada.id)` después de `cargarCuentas()`.
- **Evidencia**: `js/pages/cuentas.js:1558-1564` (modal de dos pasos),
  `js/pages/cuentas.js:1705-1710` (formulario de un paso),
  `js/pages/cuentas.js:170-175` (la preservación de selección en `cargarCuentas`),
  `firebase/firestore.js:118-125` (`crearCuenta` devuelve el resultado de `addDoc`)
- **Notas**: el reporte original creía que había **tres** caminos y señalaba
  un tercero en `js/pages/cuentas.js:1843`. No los hay: eran **dos**. El
  tercero era `_abrirModalCrearCuentaLegacy`, una función de 156 líneas sin
  ninguna llamada en todo el repositorio, eliminada como código muerto en
  `ae6b045` como parte del cierre de este bug. El arreglo quedó entonces en
  dos sitios, no en tres, y no hace falta unificar la creación en una sola
  función.

  La llamada a `seleccionarCuenta()` va **después** de `cargarCuentas()` y no
  antes: `seleccionarCuenta` busca el id dentro del array `cuentas` y aborta
  si no lo encuentra, y la cuenta recién creada solo existe en ese array
  después de recargar.

  **Pendiente de verificación en navegador.** El cierre queda sujeto a que se
  comprueben los tres casos de los pasos de reproducción.

#### BUG-014: "Estado del ciclo" de la tarjeta aparece dentro del scroll
- **Módulo**: `js/pages/cuentas.js`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Resuelto, **pendiente de verificación en navegador**
- **Descripción**: la fila *"Estado del ciclo"* se emitía dentro de
  `.cuenta-detalle`, que es el contenedor con scroll del panel de detalle.
  Duplicaba la información que el badge del encabezado ya muestra, y ese badge
  está fuera del scroll. Al desplazarse, el usuario veía el mismo dato dos
  veces.
- **Pasos para reproducir**:
  1. Ir a Cuentas y seleccionar una **tarjeta de crédito**.
  2. Ver el badge de estado en la esquina superior derecha del encabezado
     (*Normal*, *Advertencia*, *Crítico* o *Pagado*).
  3. Desplazar el bloque de detalle hasta el final.
  4. Observar la fila *"Estado del ciclo"* con el mismo valor.
- **Resultado esperado**: el estado del ciclo se muestra **solo** en el badge
  del encabezado, que permanece siempre visible.
- **Resultado actual**: corregido. La fila se eliminó de la plantilla.
- **Evidencia**: el badge del encabezado sigue en `js/pages/cuentas.js:430`; la
  fila duplicada estaba en `js/pages/cuentas.js:479-482` (pre-`bf663ab`), y
  `css/cuentas.css:207-217` (`.cuenta-detalle` con `overflow-y: auto`)
- **Notas**: la fila era la última del bloque, así que solo se veía al llegar
  al final del scroll; por eso convivió tanto tiempo sin reportarse. Al
  quitarla no queda ninguna variable muerta: `claseEstado` sigue usándose en
  el resumen de *"Consumos del ciclo"* y en el badge de porcentaje, y
  `nivelTexto` en el badge del encabezado.

  Al abrir el modal educativo desde el badge (**BUG-015**) la fila del scroll
  ya no compite con nada: el dato vive en el encabezado y su explicación, en el
  modal.

#### BUG-015: El badge de estado "Normal" no abre el modal educativo
- **Módulo**: `js/pages/cuentas.js`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Resuelto, **pendiente de verificación en navegador**
- **Descripción**: el badge de estado de la tarjeta se renderizaba como un
  `span` plano: sin `tabindex`, sin `role`, sin `data-*`, sin `cursor: pointer`
  y **sin ningún listener**. El usuario que no entendía qué significaba
  *Normal* / *Advertencia* / *Crítico* no tenía dónde consultarlo.
- **Pasos para reproducir**:
  1. Ir a Cuentas y seleccionar una tarjeta de crédito.
  2. Localizar el badge de estado junto a *Tarjeta de crédito*.
  3. Hacer clic sobre él.
  4. Intentar alcanzarlo con el teclado (Tab).
- **Resultado esperado**: el badge es un control activable (por clic y por
  teclado) que abre un modal educativo explicando los niveles de uso de la
  línea de crédito.
- **Resultado actual**: corregido. El badge es un `<button type="button">` con
  listener que abre el modal educativo.
- **Evidencia**: `js/pages/cuentas.js:430` (el badge, ahora `button`),
  `js/pages/cuentas.js:354-357` (el listener, en el bloque post-render donde ya
  se enlazaban los `.btn-copiar`),
  `js/services/CreditoServicio.js:281` (el modal), `css/cuentas.css:158-175`
  (el estilo de interaction)
- **Notas**: **el reporte original se equivocaba en el diagnóstico.** Afirmaba
  que *"no existe el modal educativo en el código"*. Sí existía:
  `abrirModalEducativoCredito(tarjeta)` en `js/services/CreditoServicio.js:281`,
  con su markup `.credito-educativo-*` y todo su CSS ya escrito
  (`css/cuentas.css:379-458`). No hubo que crearlo ni decidir su diseño.

  Lo que faltaba era **el acceso**: la función estaba `export`ada pero su único
  llamador era `notificarUsoDeCredito`
  (`js/services/CreditoServicio.js:277`), que a su vez solo se dispara desde el
  botón *"Más info"* de un toast de cruce de umbral
  (`js/services/CreditoServicio.js:231,238`). Es decir, el modal era
  inalcanzable salvo en el instante en que la tarjeta cruzaba un umbral, y
  nunca desde la tarjeta que lo motivating. El arreglo fue una línea de
  `import` y un listener.

  Se eligió `<button>` nativo en vez de `span` con `role`/`tabindex`: da
  teclado, rol y `focus-visible` sin wiring a mano.

  Del CSS hizo falta algo que no estaba previsto: el `button` global de
  `css/style.css:318` pone `background-color: var(--surface)` y un
  `button:hover` propio (`css/style.css:332`). El `background: transparent` que
  necesita el badge para verse como el `span` que era **anulaba también el
  hover**, dejando un control clicable sin ninguna señal. Se añadió un hover
  explícito en `css/cuentas.css:173-175`.

  Abrir el modal destapó dos defectos que no estaban registrados: **BUG-026**
  y **BUG-027**.

#### BUG-020: `fechaRealizacion` se guarda como `Date` en dos rutas
- **Módulo**: `js/pages/inversiones.js`
- **Severidad**: Media
- **Prioridad**: Media
- **Estado**: Resuelto por `a4b1041` (2026-10-03), pendiente de verificación en navegador
- **Descripción**: los modales de **compra** y **venta** manual de
  inversiones escribían `fechaRealizacion` como un objeto `Date`. `addDoc` lo
  convierte a `Timestamp` de Firestore, mientras que el resto de la aplicación
  usa string `"YYYY-MM-DD"`. Como `normalizarFechaFutura()` solo normaliza
  cuando el valor es string, estas dos rutas **no recortaban las fechas futuras**,
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
- **Resultado actual**: corregido en las dos vías de alta. Además del cambio de
  tipo, se añadió `max="${hoy}"` a los dos `input type="date"`, que es la
  prevention en la UI que ya usa el formulario canónico de movimientos
  (`js/ui/formularioMovimiento.js:249`). Sin esa segunda capa el recorte sería
  silencioso: el usuario elegiría mañana y se guardaría hoy sin aviso.
- **Evidencia**: `js/pages/inversiones.js:2` (el import de `fechaLocalISO`, que
  faltaba y hubo que añadir), `js/pages/inversiones.js:1442,1570` (los dos
  `input type="date"` con `max`), `js/pages/inversiones.js:1505,1624` (las dos
  escrituras, ya como string),
  `js/services/MovimientoServicio.js:19-25` (`normalizarFechaFutura`, que solo
  actúa sobre strings),
  `js/services/MovimientoServicio.js:17-18` (la regla documentada que se incumplía)
- **Notas**: la vista no se rompe porque `formatearFecha`
  (`js/pages/cuentas.js:1029-1042`) y `normalizarFecha`
  (`js/services/MovimientoServicio.js:709-713`) sí saben leer `Timestamp`. El
  problema de la inconsistencia de datos de partida queda como **DEUDA-011**, y
  las reglas de Firestore no lo detectan porque `create` no valida el tipo de
  `fechaRealizacion` (**DEUDA-012**).

  El arreglo **solo afecta a escrituras nuevas**: los movimientos de compra y
  venta ya guardados siguen con `Timestamp` y no se migran. Decisión tomada, no
  un olvido.

  Las dos capas de la defensa son complementarias, no intercambiables: `max` es
  prevención en la UI y se puede saltar desde la consola o DevTools;
  `normalizarFechaFutura` es la red de seguridad del servicio. Con las dos, los
  dos caminos dan hoy.

  **Pendiente de verificación en navegador.** Los pasos 2, 3 y 5 son verificables
  en la aplicación; el paso 4 **no**: `fechaRealizacion` no se muestra en
  ningún sitio más que a través de `formatearFecha`, que ya normaliza los tres
  tipos, así que un `Timestamp` y un string se ven idénticos. Distinguirlo
  requiere la consola de Firebase.

---

#### BUG-030: El campo `id` del historial rompe la importación en cuentas nuevas
- **Módulo**: `js/services/ExportarServicio.js`, `js/services/ImportarServicio.js`
- **Severidad**: Alta
- **Prioridad**: Alta
- **Estado**: Pendiente
- **Descripción**: el export del historial de precios añade un campo `id` que
  la aplicación nunca escribe. En `ExportarServicio.js:116` el mapeo es
  `registros.map(r => ({ id: r.fecha, ...r }))`: el `id` es un artefacto de
  para tener el identificador a mano, pero **viaja dentro del JSON**. Al
  importar, `ImportarServicio.js:388-394` hace `setDoc` con `...datos`, y
  `datos` contiene ese `id`. Y las reglas limitan la colección a
  `hasOnly(['fecha', 'precio', 'cerrado', 'actualizacion'])`
  (`firebase/firestore.rules:489-491`): **`id` no está en la lista.**

  El efecto es que importar un `.dvid` en una cuenta **sin historial previo**
  falla en **cada registro**, con *"Missing or insufficient permissions"*. Los
  errores se acumulan en `resultado.errores` (`:398`) sin que la interfaz
  explique nada. Es el **mismo modo de fallo que DEUDA-013**, que ya lo
  provocó dos veces (R-03 con `operacion`, R-05 con `metaId`): un
  `hasOnly` escrito a mano que el código y las reglas no comparten, y un
  rechazo que la app no sabe explicar.

  **Es invisible en las pruebas de roundtrip sobre la misma cuenta**, y por eso
  lleva tiempo sin reportarse. En `update` las reglas usan validadores
  condicionales sin `hasOnly` (`firestore.rules:496-499`, por diseño para no
  romper documentos legacy), así que reimportar sobre datos que ya existen
  **sí pasa** e inyecta un campo `id` que la app nunca escribe. El bug solo
  aparece al importar en una cuenta nueva.
- **Pasos para reproducir**:
  1. Exportar un `.dvid` de una cuenta que tenga historial de precios.
  2. Abrir el archivo y comprobar que cada registro de `historial[].registros`
     trae `"id"` junto a `"fecha"`, con el mismo valor.
  3. Crear una cuenta nueva, o una cuenta existente sin historial.
  4. Importar el `.dvid`.
  5. Observar que el resumen de la importación muestra `historial: 0` y una
     lista de erroresfilled de *"Missing or insufficient permissions"*.
  6. Como contraste: en la cuenta original, reimportar el mismo archivo
     **funciona**, y los documentos de historial quedan con un campo `id`
     espurio.
- **Resultado esperado**: el `.dvid` no transporta campos que la aplicación no
  escribe, e importar un respaldo en una cuenta vacía restituye todo.
- **Resultado actual**: la importación del historial falla por completo en
  cuentas nuevas, y duplica la fecha en las existentes.
- **Evidencia**:
  - `js/services/ExportarServicio.js:116` (el `id` en el mapeo del export)
  - `js/services/ImportarServicio.js:385` (`registro.fecha || registro.id`, usa
    el `id` como fallback pero no lo descarta), `:388` (`datos` lo conserva),
    `:390-394` (`setDoc` con `...datos`, que lo escribe)
  - `firebase/firestore.rules:489-491` (`hasOnly` de `create` en `historial`,
    sin `id`)
  - `firebase/firestore.rules:496-499` (`update` sin `hasOnly`, por eso el
    roundtrip sobre la misma cuenta no falla)
  - `js/repositories/HistorialRepositorio.js:114-117` (el lector ya devuelve
    `fecha` desde el id del documento; el `id` del export es redundante
    también como valor)
- **Notas**: **son dos arreglos, y solo uno está en el alcance de este bug.**
  1. Quitar `id` del `.dvid`. Es una línea y cierra el síntoma.
  2. La causa de fondo es **DEUDA-013**: la lista de campos admitidos está
     escrita a mano en las reglas y no se deriva de la que usa el código. Un
     campo sobrante rompe un `create` exactamente igual que un campo faltante.
     Este bug es la **tercera aparición** del mismo modo de fallo, registrada
     en DEUDA-013.

  El arreglo (1) no previene (2): la próxima vez que una ruta de escritura
  añada un campo, el mismo fallo reaparece. Y al revés que en R-03 y R-05,
  aquí el campo **sobra** en vez de faltar, lo que confirma que la lista está
  desalineada en las dos direcciones.

  Se detectó **midiendo**, no leyendo código de forma lineal: al comparar las
  secciones del `.dvid` con los `hasOnly` de las reglas, buscando simetrías
  entre export e import. Ninguna de las dos mitades del flujo delata el problema
  por separado.

  Verificado ejecutando las transformaciones exactas de ambos servicios sobre
  un documento de historial: el campo `id` sobrevive a la serialización y
  aparece entre los rechazados por `hasOnly`.

#### BUG-029: Un `ReferenceError` rompe la vista de detalle de movimientos
- **Módulo**: `js/pages/movimientos.js`
- **Severidad**: Alta
- **Prioridad**: Alta
- **Estado**: Pendiente
- **Descripción**: `abrirFormularioDetalle` compara contra `tipo`, que **no está
  declarado en su ámbito**. La única declaración de `tipo` del archivo es el
  parámetro de `abrirFormularioMovimiento` (`:943`); no hay local ni
  declaración a nivel de módulo. Es el caso más severo del registro, y el
  diagnóstico inicial —"se rompe el modal de detalle"— era incorrecto: el
  modal **sí abre**.

  La razón es que la función es `async`. El `ReferenceError` no interrumpe la
  ejecución de forma sincronizable: se convierte en una **promesa rechazada**.
  Y el modal ya está abierto para entonces, porque `abrirModal` corre en
  `:1148`, catorce líneas antes. El usuario ve el modal con normalidad y no
  perceive nada raro.

  Lo que se rompe es todo lo que viene después:

  | Línea | Qué deja de ejecutarse | Consecuencia visible |
  |-------|------------------------|----------------------|
  | `:1164` | `vincularSimboloDivisa()` | el símbolo de divisa junto a *Monto* no se actualiza al cambiar de cuenta |
  | `:1165` | `bloquearFormulario(true)` | **el formulario queda editable en una vista que debe ser de solo lectura** |
  | `:1166` | `renderizarAccionesDetalle(modalEl, true)` | **no se pintan los botones de acción** (Editar, Deshacer, Eliminar) |

  Y como `:1155-1156` declara `confirmText: null` y `cancelText: null`, tampoco
  hay botones en el footer. El resultado es un **formulario editable sin
  ningún botón para guardar**: el usuario cree que está en modo edición y no
  puede guardar. Solo puede cerrarlo.

  Lo que hace la severidad Alta, y por encima de la pérdida de la garantía de
  solo lectura, es que **`manejarAccionDetalle("guardar")` (`:1223`) queda
  inalcanzable**: sus botones nunca se pintaron. **La función de editar
  movimientos está muerta por este bug.** La rama `"cancelar"` (`:1212-1213`),
  que vuelve a llamar a `abrirFormularioDetalle`, es inalcanzable por lo mismo
  —y si se alcanzara, lanzaría el mismo error otra vez.

- **Pasos para reproducir**:
  1. Abrir Movimientos.
  2. Hacer clic en cualquier movimiento para ver su detalle.
  3. Observar que el modal **abre**.
  4. Comprobar que **no hay botones de acción** abajo (Editar, Deshacer,
     Eliminar).
  5. Comprobar que los campos **sí son editables**, cuando deberían estar
     deshabilitados.
  6. Abrir la consola: `Uncaught (in promise) ReferenceError: tipo is not defined`.
- **Resultado esperado**: la vista de detalle muestra el movimiento con los
  campos deshabilitados y sus botones de acción (Editar, Deshacer, Eliminar).
- **Resultado actual**: el modal abre con un formulario editable y sin ningún
  botón, ni de acción ni de confirmación. Editar es imposible.
- **Evidencia**:
  - `js/pages/movimientos.js:1161-1163` (la comparación con `tipo` no declarado)
  - `js/pages/movimientos.js:943` (la única declaración de `tipo`: el parámetro
    de `abrirFormularioMovimiento`)
  - `js/pages/movimientos.js:1148` (`abrirModal`, que se ejecuta antes y por eso
    el modal sí abre)
  - `js/pages/movimientos.js:1155-1156` (`confirmText: null`, `cancelText: null`)
  - `js/pages/movimientos.js:1164-1166` (las tres llamadas que no se ejecutan)
  - `js/pages/movimientos.js:1223` (`manejarAccionDetalle("guardar")`,
    inalcanzable)
  - `js/pages/movimientos.js:1212-1213` (la rama `"cancelar"`, también
    inalcanzable)
  - Call sites sin `await` ni `.catch()`: `js/pages/dashboard.js:2554`,
    `js/pages/movimientos.js:1139`, `js/pages/movimientos.js:1213`
  - Sin handler global: cero coincidencias de `unhandledrejection` y
    `window.onerror` en `js/` y en `sw.js`
- **Notas**: **es silencioso**, y por eso lleva meses sin reportarse: la
  excepción solo aparece como `Uncaught (in promise) ReferenceError` en la
  consola, sin ningún aviso en la interfaz. Ninguno de los tres call sites la
  captura y no hay handler global que la muestre.

  El arreglo más pequeño es **borrar la llamada**: en una vista de solo lectura
  el filtro no aporta nada, porque `bloquearFormulario(true)` deshabilita todos
  los `select` justo después. Y activarlo no sería neutro: si se limitara a
  cambiar `tipo` por `m.tipo`, el `actualizar()` del filtro detectaría el destino
  deshabilitado en las transferencias heredadas entre divisas y pondría
  `destino.value = ""`, borrando de la pantalla la cuenta de destino.

  **Este bug se detectó de paso al aplicar DEUDA-002.** Se buscaba un segundo
  call site de `filtrarCuentasPagoTarjeta` —el segundo sí existe, en
  `:1162`— y al leerlo se vio que comparaba contra una variable inexistente.
  Es el tercer hallazgo cuyo diagnóstico inicial estuvo mal: BUG-019, BUG-024 y
  este.

---

#### BUG-027: Se ofrece "Pagar tarjeta" en un ciclo ya pagado
- **Módulo**: `js/pages/cuentas.js`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Resuelto por `944819d` (2026-10-03), pendiente de verificación
- **Descripción**: el botón *"Pagar tarjeta"* se ofrece incluso cuando el ciclo
  de la tarjeta ya está saldado. El usuario puede abrir el formulario de pago
  de una deuda que ya está pagada, y el movimiento resultante sería un pago sin
  contrapartida real.
- **Pasos para reproducir**:
  1. Ir a Cuentas y seleccionar una **tarjeta de crédito**.
  2. Pagar el ciclo completo, hasta que el badge marque *Pagado*.
  3. Pulsar el botón *"Pagar tarjeta"* de la barra de totales.
  4. Abrir el formulario de pago igualmente.
  5. Repetir con el botón *"Pagar tarjeta"* del modal educativo (badge).
- **Resultado esperado**: con el ciclo pagado, no se ofrece pagar, o el botón
  aparece deshabilitado explicando que no hay nada pendiente.
- **Resultado actual**: el botón se sigue mostrando y abre el formulario.
- **Evidencia**: `js/pages/cuentas.js:595` (el botón de la barra de totales; se
  emite siempre que `cuenta.tipo === "credito"`, sin mirar el estado del ciclo),
  `js/pages/cuentas.js:611-622` (el listener, también sin mirar el estado),
  `js/services/CreditoServicio.js:320` (el `confirmText` del modal educativo,
  que lo ofrece siempre),
  `js/pages/cuentas.js:411,477` (el flag `pagadoCompleto` sí se calcula y se
  usa, pero no en estos dos sitios)
- **Notas**: **el defecto está en dos sitios, no en uno.** El bug se reportaba
  contra el detalle de tarjeta, pero el modal educativo
  (`CreditoServicio.js:320`) tiene su propio `confirmText: "Pagar tarjeta"`
  incondicional, así que cerrar solo el de `cuentas.js:595` dejaría el mismo
  problema en el modal. Ambos deben consultar `pagadoCompleto`.

  `pagadoCompleto` lo calcula `estadoCicloDe` (`CreditoServicio.js:171`), que
  `mostrarDetalleCuenta` ya invoca para las tarjetas
  (`cuentas.js:322`), así que el dato está disponible: no hace falta trabajo
  extra para corregirlo.

  En el caso del modal, la corrección natural es convertirlo en `soloCerrar`
  cuando el ciclo está pagado. Hay que decidir si `abrirModalEducativoCredito`
  recibe el estado del ciclo o lo calcula, porque hoy solo recibe la tarjeta y
  no tiene acceso a los movimientos.

  Se decidió **no tocarlo** en el sprint de BUG-014/015 por ser de los menores,
  y por eso queda registrado en vez de resuelto.

---

---

## Bugs pendientes

| ID | Título | Módulo | Severidad | Prioridad | Estado |
|----|--------|--------|-----------|-----------|--------|
| BUG-016 | El hover del selector de tipo ilumina un cuadrado | `js/pages/movimientos.js`, `css/pendientes.css` | Baja | Baja | Pendiente (sin verificar) |
| BUG-017 | El pie de Configuración se extiende debajo del sidebar | `js/ui/configuracion.js` | Baja | Baja | Pendiente (sin verificar) |
| BUG-025 | El filtro por cuenta inactivo deja negativas las transferencias entrantes | `js/pages/movimientos.js` | Baja | Baja | Pendiente (latente) |
| BUG-026 | Divergencia entre `nivelEstadoCuenta` y `nivelUsoDe` | `js/pages/cuentas.js`, `js/services/CreditoServicio.js` | Media | Media | Pendiente |
| BUG-028 | Las tarjetas de crédito no se excluyen del filtro de transferencias | `js/ui/formularioMovimiento.js` | Baja | Baja | Pendiente |

---

## Bugs descartados

| ID | Título | Módulo | Severidad | Estado |
|----|--------|--------|-----------|--------|
| BUG-018 | La desviación del logo de progreso es ≤8px | `js/ui/modal.js`, `css/modal.css` | Baja | Descartado (wontfix) |

### BUG-018 descartado — la desviación del logo de progreso es ≤8px
- **Módulo**: `js/ui/modal.js`, `css/modal.css`
- **Severidad**: Baja (cosmético)
- **Prioridad**: Baja
- **Estado**: Descartado (*wontfix*)
- **Descripción**: el indicador de carga (logo de escinco girando) se posiciona
  con `top: 48%` respecto de la caja completa del `.modal` (header + body +
  footer), no respecto del `.modal-body`, que es la única zona que se difumina.
  Eso es cierto, pero la desviación resultante es **imperceptible**. Con `a` el
  alto del header, `f` el del footer y `H` el del modal:

  ```
  centro del logo = 0.48H
  centro del body = (H + a − f) / 2
  desviación      = −0.02H + (f − a)/2
  ```

  Medidos del CSS, `a ≈ 61px` y `f ≈ 77px`, luego `(f − a)/2 = +8px`:

  | Modal | H | Desviación | ¿Invade el header? |
  |-------|---|------------|--------------------|
  | Confirmación corta (`.modal-confirm`) | ~222px | **+3.6px** (ligeramente abajo) | No: el logo de 72px cabe en el body de ~84px |
  | Configuración (`.modal-xl`, 88vh) | ~792px | **−7.8px** (ligeramente arriba) | No |

  Sobre un logo de 72px, el máximo es **11%, y no se percibe**. El caso en el que
  la desviación crecería a ~34px —los modales sin footer— **no existe**: los
  únicos sin footer son los `soloCerrar` (`confirmText: "Cerrar"`), y los 11 que
  hay tienen `onConfirm` **síncrono**, así que el spinner nunca llega a verse; y
  los `confirmText: null, cancelText: null` sin footer tampoco tienen `onConfirm`.
  Se revisaron los 42 `onConfirm: async` del proyecto: todos acaban teniendo
  footer, porque `confirmText: null` se convierte en `"Aceptar"`
  (`js/ui/modal.js:79-81`) y eso ya fuerza `mostrarFooter = true`. Los dos
  `footerExtra` (`js/pages/dashboard.js:1021`, `js/pages/trading.js:1278`) añaden
  un botón en la misma fila flex, así que no alteran la altura del footer.
- **Pasos para reproducir**: no se reproduce. El síntoma que motivó el reporte
  original (*"en modales cortos el logo invade el encabezado"*) **no ocurre**.
- **Resultado esperado**: el indicador centrado sobre el área de contenido
  difuminada, sea cual sea la altura del modal.
- **Resultado actual**: hasta 8px de desviación, imperceptible a simple vista.
- **Evidencia**: `js/ui/modal.js:178-183` (el logo se añade como hijo de
  `.modal`), `css/modal.css:403-415` (`position: absolute`, `top: 48%`),
  `css/modal.css:397-401` (lo que se difumina es `.modal-body`),
  `css/modal.css:84-94` (alto del header), `css/modal.css:205-213` (alto del
  footer), `js/ui/modal.js:88-89` (cálculo de `soloCerrar` y `mostrarFooter`)
- **Notas**: la solución correcta —envolver `.modal-body` y el logo en un
  contenedor `position: relative` y centrarlo con `top: 50%`— tocaría el flujo de
  scroll de los 42 modales que pasan por `confirmar()`, para ganar 8px. Riesgo de
  regresión alto sobre un beneficio imperceptible, así que se descarta. Ajustar
  `top: 48%` a `top: 50%` mejoraría los modales altos (−7.8 → −4.2px) y
  empeoraría los cortos (+3.6 → −0.4px): tampoco compensa.

  El defecto **grave** de este mismo flujo de modal no era este, sino el cierre
  a media operación, que sí se corrigió y está registrado como **BUG-019**.

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

### BUG-028: Las tarjetas de crédito no se excluyen del filtro de transferencias
- **Módulo**: `js/ui/formularioMovimiento.js`
- **Severidad**: Baja
- **Prioridad**: Baja
- **Estado**: Pendiente
- **Descripción**: al cerrar DEUDA-002 (opción a) se añadió
  `filtrarCuentasDestinoTransferencia`, que oculta las opciones de destino cuya
  divisa no coincide con la del origen. El filtro **no excluye las tarjetas de
  crédito**, y no se excluyeron a propósito: hacerlo cambiaría más
  comportamiento del que cubre DEUDA-002.

  El problema de fondo es otro y es anterior: para el tipo `transferencia`,
  `cuentasElegibles` es `cuentasActivas` **sin ningún filtro**, así que los dos
  selects (origen y destino) ofrecen también tarjetas de crédito. Y una tarjeta
  no tiene un saldo que mover: su deuda vive en el campo `deuda`, no en
  `saldoInicial`. Una transferencia hacia una tarjeta acaba en
  `actualizarSaldoCuenta`, que resta el monto a `saldoInicial` de la tarjeta,
  un campo que las tarjetas no usan para nada. El efecto es un campo
  `saldoInicial` basura en una tarjeta, invisible salvo que alguien lo mire.
- **Pasos para reproducir**:
  1. Ir a Movimientos → *Transferencia*.
  2. Abrir la lista de cuenta de destino.
  3. Observar que aparecen tarjetas de crédito.
  4. Elegir una tarjeta como destino y guardar.
  5. Leer el documento de la tarjeta y observar que `saldoInicial` cambió.
- **Resultado esperado**: los selects de origen y destino de una transferencia
  ofrecen solo cuentas con saldo, nunca tarjetas. La deuda de una tarjeta se
  mueve con `pagoTarjeta` o con `gasto`, no con una transferencia.
- **Resultado actual**: las tarjetas son elegibles y el movimiento se guarda.
- **Evidencia**: `js/ui/formularioMovimiento.js:26-30` (para `transferencia`,
  `cuentasElegibles = cuentasActivas`, sin exclusión de `credito`; compárese con
  la rama de `esPagoTarjeta` en la línea 27, que sí la excluye),
  `js/ui/formularioMovimiento.js:32-34` (las opciones que se pintan en ambos
  selects), `js/ui/formularioMovimiento.js:113-122` (el select de destino),
  `js/services/MovimientoServicio.js:535-557` (`actualizarSaldoCuenta`, que solo
  toca `saldoInicial` y no distingue el tipo de cuenta)
- **Notas**: se puede resolver junto con **DEUDA-002b**. Al extender
  `transferencia` con `tasa` y `montoDestino` hay que decidir de paso qué tipos
  de cuenta pueden participar, y ahí encaja de forma natural filtrar las
  tarjetas.

  Quedó fuera de DEUDA-002 a propósito y así se dice en su commit: excluir las
  tarjetas del filtro es una decisión de alcance que no corresponde a un arreglo
  cuya premisa es "las dos cuentas deben usar la misma divisa".

### BUG-026: Divergencia entre `nivelEstadoCuenta` y `nivelUsoDe`
- **Módulo**: `js/pages/cuentas.js`, `js/services/CreditoServicio.js`
- **Severidad**: Media
- **Prioridad**: Media
- **Estado**: Pendiente
- **Descripción**: el nivel de uso de una tarjeta se calcula en la aplicación
  con **dos funciones distintas y sobre dos magnitudes distintas**:

  | Función | Base del porcentaje | Dónde se usa |
  |---------|--------------------|--------------|
  | `nivelEstadoCuenta(tarjeta, consumos)` | consumos **del ciclo** | el badge del encabezado y la barra de progreso de `cuentas.js` |
  | `nivelUsoDe(tarjeta)` | campo almacenado `deuda` | el modal educativo, las notificaciones de cruce y las tarjetas del dashboard |

  Las dos viven en `js/services/CreditoServicio.js` y tienen casi el mismo
  cuerpo, pero **no son equivalentes**: `nivelEstadoCuenta` recibe los
  consumos por parámetro y `nivelUsoDe` los lee del documento.

  Y el campo `deuda` **no se deriva** de los movimientos del ciclo: se mantiene
  como un contador incremental que `js/services/MovimientoServicio.js:602-616`
  suma y resta en cada alta. El consumo del ciclo, en cambio, se recalcula en
  cada render desde la lista de movimientos
  (`js/services/CreditoServicio.js:168`, `movimientosDelCiclo`). Son dos
  mecanismos independientes para el mismo concepto.

  El propio código admite que pueden no coincidir: `cuentas.js:413` compara
  `deuda` con `estado.restante` y trata la diferencia como la excepción
  (`saldoPorPagarIgual = Math.abs(deuda - estado.restante) < 0.005`), en vez de
  asumir que son lo mismo.

  Consecuencias:
  1. El badge puede marcar *Normal* mientras el modal que se abre al pulsarlo
     explica un nivel distinto, con otro color de barra y otro porcentaje.
  2. En el caso inverso, el badge *Crítico* abre un modal que se ve *Normal*.
  3. Las notificaciones de cruce de umbral se disparan por `nivelUsoDe`
     (`CreditoServicio.js:225`), así que un usuario puede recibir un aviso de
     *Crítico* con la tarjeta mientras su badge dice *Normal*.
- **Pasos para reproducir**:
  1. Encontrar una tarjeta donde `deuda` y `consumos − pagos` del ciclo no
     coincidan (típico: un pago del ciclo anterior, una importación de `.dvid`
     o un movimiento deshecho).
  2. Ir a Cuentas y anotar el nivel del badge y el porcentaje de la barra.
  3. Pulsar el badge para abrir el modal educativo.
  4. Comparar el nivel y el porcentaje del modal con los del badge.
  5. Repetir observando el dashboard, que usa `nivelUsoDe`.
- **Resultado esperado**: un único cálculo de nivel de uso, el mismo en el
  badge, en el modal, en el dashboard y en las notificaciones.
- **Resultado actual**: cuatro superficies que pueden discrepar entre sí.
- **Evidencia**:
  - `js/services/CreditoServicio.js:42-52` (`nivelUsoDe`, sobre `deuda`)
  - `js/services/CreditoServicio.js:54-65` (`nivelEstadoCuenta`, sobre `consumos`)
  - `js/pages/cuentas.js:403` (el badge usa `nivelEstadoCuenta`)
  - `js/services/CreditoServicio.js:282` (el modal usa `nivelUsoDe`)
  - `js/services/CreditoServicio.js:225` (las notificaciones usan `nivelUsoDe`)
  - `js/services/MovimientoServicio.js:602-616` (el contador `deuda`, incremental)
  - `js/services/CreditoServicio.js:168-183` (`estadoCicloDe`, recalculado)
  - `js/pages/cuentas.js:413` (`saldoPorPagarIgual`, que presupone la
    posibilidad de divergencia)
- **Notas**: **solución: unificar en una sola función.** La decisión de fondo no
  es cuál de las dos se queda, sino cuál de las dos magnitudes es la buena. Si
  se unifica sobre `deuda`, el nivel pasa a ser independiente del ciclo y hay
  que revisar `estadoCicloDe`. Si se unifica sobre los consumos del ciclo, hay
  que decidir qué ocurre con `deuda` y quién la mantiene. Son las dos
  hipótesis y conviene decidir antes de escribir el código, porque es un
  cambio de comportamiento, no una refactorización.

  Es el mismo patrón de divergencia por copias que ya se detectó en
  **DEUDA-004** con `esMovimientoPositivo`, y comparte con él la causa:
  **cálculo desnormalizado en dos sitios en lugar de uno solo.** Resolver las
  dos cosas juntas tiene sentido.

  Lo que destapó este bug fue el cierre de **BUG-015**: el modal ya existía y
  funcionaba, pero nunca se había abierto desde la tarjeta, así que la
  discrepancia entre el badge y el modal no era observable.

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

  **Pendiente de verificación en navegador.** Este bug y **BUG-017** se
  reportaron leyendo el CSS, sin abrirlos en el navegador. Si al verificarlos
  resultan ser como **BUG-018** —una desviación imperceptible—, se descartarán
  con el mismo criterio. No invertir esfuerzo en arreglarlos sin verlos primero.

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

  **Pendiente de verificación en navegador.** Al igual que **BUG-016**, se
  reportó leyendo el CSS sin abrir la aplicación. Si al verificarlo resulta ser
  como **BUG-018**, se descartará con el mismo criterio.

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
| BUG-013 reportado con 3 caminos de creación | Eran 2: el tercero era código muerto, borrado en `ae6b045` |
| Sin reportar, hallazgo al conectar el modal educativo | **BUG-026**, **BUG-027** |
| Sin reportar, hallazgo al aplicar DEUDA-002 (opción a) | **BUG-028**, **BUG-029** |
| Sin reportar, hallazgo al medir el formato `.dvid` | **BUG-030** |

Pendiente de verificación manual: **BUG-016** y **BUG-017**, más los cierres de
**BUG-013**, **BUG-014**, **BUG-015** y **BUG-020** —los de Cuentas, Inversiones
y Movimientos—, más el paso 5 de **BUG-029**. Los dos primeros dependen de
percepción visual: su mecanismo está identificado en el código CSS, pero conviene
una comprobación en navegador antes de darlos por buenos. Los cierres sí están
verificados en código, pero el arreglo no se da por bueno hasta verlo funcionar;
si alguno fallara, se revierte. **BUG-029** se verifica mirando no si el modal
abre, sino si tiene botones de acción y si los campos están deshabilitados.
**BUG-030** está verificado por ejecución, no necesita navegador: se reproduce
importando un `.dvid` en una cuenta sin historial. El resto se confirmó leyendo
el código, salvo **BUG-025**, que es latente por definición: no se reproduce
mientras el filtro por cuenta no esté conectado.

Tres afirmaciones de este reporte se apoyan en la **ausencia de un llamador** y
conviene comprobarlas en el navegador antes de construir nada sobre ellas:
`limpiarHistorial` (`js/services/HistorialServicio.js:66`, sin llamadores),
`cerrarDia` (`js/repositories/HistorialRepositorio.js:71`, sin llamadores) y
`cerrarSnapshotDelDia` (`js/repositories/SnapshotRepositorio.js:57`, sin
llamadores). Solo la primera tiene consecuencias de crecimiento; las otras dos
son un campo muerto cada una. También es invisible desde el código si hay una
política **TTL nativa de Firestore** activa sobre `historial` o `snapshots`:
eso se configura en la consola del proyecto, no en el repo.

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
**BUG-013** a **BUG-018**, **BUG-024**, **BUG-025**, **BUG-028** y **BUG-029**
tienen su causa raíz o su solución en los ítems **DEUDA-003**, **DEUDA-004**,
**DEUDA-006**, **DEUDA-012** y **DEUDA-002b**. El código muerto que se borró al
cerrar **BUG-013** (`ae6b045`) es un caso más de **DEUDA-006**. **BUG-026** es un
caso más del mismo tipo que **DEUDA-004**, y ambos deberían resolverse juntos.

---

## Lecciones aprendidas

Este registro se redactó en seis pasos y **siete de los veintiséis hallazgos
iniciales resultaron mal descritos, mal contados o sobredimensionados**. Se deja
constancia porque el valor de un reporte de bugs está en ser honesto sobre su
propia fiabilidad, no solo en la lista final.

### Qué salió mal

| Tipo de bug | Ejemplos | Por qué falló |
|-------------|----------|---------------|
| Visual, reportado sin navegador | BUG-018 (descartado), BUG-016 y BUG-017 (sin verificar) | Se dedujo el efecto de una regla CSS sin renderizarlo. En BUG-018 se afirmó que el logo invadía el header; la desviación real es de ≤8px. |
| De flujo asíncrono, reportado sin leer el flujo entero | BUG-019, BUG-024 | Se leyó el fragmento relevante (`pointer-events`, el call site) y se infirió el comportamiento, sin abrir la función que lo governa. En BUG-019 se afirmó que el modal se cerraba a media operación; lo impedía el guard `if (procesando) return` de `cerrar()`. |
| Conteo de sitios sin comprobar las llamadas | BUG-013 | Se afirmó que había tres caminos de creación de cuenta y se señaló uno a `js/pages/cuentas.js:1843` que no tenía ninguna llamada en el repositorio. Eran dos. |
| Afirmar la ausencia de algo sin buscarlo | BUG-015 | Se escribió que *"no existe el modal educativo en el código"*. Existía entero, con su markup y su CSS, en `js/services/CreditoServicio.js:281`; lo que faltaba era el call site. |
| Leer un síntoma sin abrir el flujo completo | BUG-029 | Se afirmaba que el modal de detalle se rompía. Como la función es `async`, el `ReferenceError` se convierte en promesa rechazada y el modal **síabre** (`abrirModal` corre antes). Lo que se pierde es `bloquearFormulario(true)` y `renderizarAccionesDetalle`, es decir, los botones de acción y el modo de solo lectura. |

En los seis casos verificados la comprobación en código demostró que el bug
**no existía, estaba mal descrito o estaba sobredimensionado**, y en los cuatro
primeros el defecto real resultó ser **otro distinto** que sí se corrigió
(BUG-025, BUG-019, BUG-026 y BUG-029 respectivamente).

**BUG-030 es el caso contrario y por eso reinforces la regla**: no fue un error de
diagnóstico sino un defecto que nadie había mirado, y apareció al **medir** —
comparando las secciones del `.dvid` contra los `hasOnly` de las reglas y
buscando simetrías entre export e import. Ninguna de las dos mitades del flujo
delata el problema por separado. Un mapa de "qué campos escribe cada ruta" es
lo que lo hunted, y no leer el código de arriba abajo.

### Regla que se adopta

1. **Verificar en código antes de reportar.** Abrir la función completa que
   gobierna el comportamiento, no solo el fragmento que lo sugiere. Para BUG-019
   bastaba con leer `cerrar()` en `js/ui/modal.js:145`.
2. **Marcar explícitamente lo que no se puede verificar.** Un bug visual sin
   navegador disponible va como *"pendiente de verificación en navegador"*, nunca
   como confirmado. Así queda BUG-016 y BUG-017.
3. **No reportar defectos cosméticos sin cuantificarlos.** Si el beneficio no
   supera el ruido, es *wontfix* documentado, como BUG-018.
4. **Documentar las correcciones, no solo los hallazgos.** Las secciones de
   *Trazabilidad* y *Correcciones de alcance* existen para que un lector pueda
   encadenar el razonamiento. Un reporte que solo muestra el estado final esconde
   cuánto costó llegar a él y cuánto margen de error tiene.

### Lo que sí sobrevivió a la verificación

Once de los veinte bugs resueltos salieron de commits cuyo diff se leyó entero,
no de inferencia: R-01 a R-11, BUG-019 (tras corregir el diagnóstico) y
BUG-024. De los nueve restantes, **BUG-013** se cerró leyendo su diff, con una
corrección de alcance (el reporte lo situaba en tres sitios y eran dos), y
**BUG-014**, **BUG-015**, **BUG-020**, **BUG-027**, **BUG-029** y **BUG-030** se
resolvieron leyendo su propio diff, aunque los seis están a la espera de
comprobación.

Los cinco pendientes verificados en código son **BUG-025**, **BUG-026** y
**BUG-028** (más BUG-016 y BUG-017 a la espera de comprobación visual). Ninguno
de ellos depende de una percepción.
