# Registro de pendientes

Proyecto: **escinco** · Fase: **beta** (1.0.0-beta.27)

Este archivo es la lista **accionable** de lo que queda abierto: lo que bloquea,
lo que está a medio hacer y lo que se decidió aplazar. No sustituye a los
registros históricos, los referencia:

- [`reporte-bugs.md`](./reporte-bugs.md) — historial de bugs (`BUG-0xx` resueltos, `R-xx`).
- [`deuda-tecnica.md`](./deuda-tecnica.md) — deuda estructural (`DEUDA-0xx`) con prioridad.
- [`roadmap.md`](./roadmap.md) — fases del producto.

Cada pendiente usa un id `PEND-0xx`. Cuando se resuelve, se deja tachado con su
commit y, si procede, se propaga al registro que le corresponda.

## Resumen

| Prioridad | Pendientes |
|-----------|-----------|
| **Bloqueante** | 1 |
| **Alta** | 3 |
| **Media** | 3 |
| **Baja** | 2 |

---

## Bloqueantes

### PEND-001 · `Missing or insufficient permissions` al registrar el snapshot diario

| | |
|---|---|
| **Prioridad** | Bloqueante |
| **Estado** | Reglas e índice **desplegados** (2026-10-12) · falta confirmar un día real |
| **Módulo** | `firebase/firestore.rules`, `js/services/SnapshotServicio.js` |

Al registrar el snapshot del día salta `FirebaseError: Missing or insufficient
permissions`.

**Causa probable**: la regla combinada `allow create, update` exigía
`request.resource.data.keys().hasOnly([...])` también en la actualización. En
una escritura *merge*, `request.resource.data` es el documento **resultante**
(con los campos legacy del snapshot anterior), así que cualquier campo extra en
un snapshot antiguo hacía fallar el `hasOnly` y la regla devolvía
`permission-denied`.

**Corrección aplicada** (working tree, sin desplegar):

- `firebase/firestore.rules` (~374): la actualización ya permite campos legacy.
  `allow create` conserva el `hasOnly` original; `allow update` valida solo el
  tipo de lo que viene en la escritura (`ifPresente*`), igual que el resto de
  colecciones.
- **Desplegado el 2026-10-12**: `firebase deploy --only firestore:rules` y
  `firestore:indexes` completados; el índice compuesto de `snapshots`
  (`__name__ DESCENDING`) está en producción.
- Falta confirmar en producción que el snapshot del día se registra sin
  `Missing or insufficient permissions` (esperar al siguiente cierre diario, o
  borrar el de hoy para forzar la escritura).
- Extra: `obtenerSnapshots` tiene plan B en memoria si el índice no estuviera
  desplegado.

**Cómo confirmar**: DevTools → consola → reproducir → copiar el objeto `error`
completo si sigue fallando (incluye `code`, `message` y `customData`).

---

## Alta

### PEND-002 · Rediseño de subcuentas sin commitear y sin probar en navegador

| | |
|---|---|
| **Prioridad** | Alta |
| **Estado** | Funciona en los tests, nunca se ha ejecutado en la app |
| **Módulo** | `js/core/familiaCuentas.js`, `js/pages/cuentas.js`, `js/pages/dashboard.js` |

El modelo de subcuentas (`padreId`) está implementado y la suite de `tests/`
(`npm test`) pasa, pero **nunca ha corrido en navegador**.

Modelo implementado, para no perderlo:

- El padre es una **clase abstracta**: no tiene divisa operativa ni saldo, solo
  sostiene a sus hijas (`esAbstracta: true`).
- Cada divisa —incluida la primera— es una cuenta real con `padreId`; con N
  divisas salen N+1 documentos.
- Cada hija conserva su `moneda` y su `saldoInicial`; el nombre se deriva del
  padre al leer (`resolverNombresCuentas`) y no se petrifica en Firestore.
- Las hijas se ocultan del sidebar y de los selectores (`cuentasVisibles` /
  `cuentasOperables`).
- La card del padre muestra el total de la familia (`saldoFamilia`).
- Transferencias entre divisas distintas siguen exigiendo *Cambio de divisa*.
- Archivar el padre archiva también a sus hijas; eliminarlo se bloquea si tiene hijas.

**Antes de commitear**: probar en `https://escinco.web.app` crear una cuenta
PEN/USD/USDT, mover saldo en cada hija, y comprobar que el patrimonio y la card
del padre cuadran.

### PEND-003 · La limpieza de preferencias redundantes queda aplazada

| | |
|---|---|
| **Prioridad** | Alta |
| **Estado** | Decidido aplazar |
| **Módulo** | `usuarios/{uid}/preferencias` |

`aplicarPreferenciasDiff()` (commit `a29a107`) ya escribe **solo** las claves que
difieren del default y **borra con `deleteField()`** las que volvieron a él. Pero
eso solo aplica a partir del próximo guardado de cada usuario: **las
preferencias ya guardadas siguen con sus claves redundantes**.

**Por qué se aplaza**: borrarlas en lote requiere credenciales admin, y el
proyecto no tiene `firebase-admin` ni service account. Añadir esa dependencia no
se ha autorizado.

**Opciones cuando se retome**:

| Opción | Coste |
|--------|-------|
| Migración client-side al leer | Sin dependencias, pero añade una escritura en el primer arranque de cada usuario |
| Script con `firebase-admin` | Barato en escrituras, requiere credenciales y una devDependency nueva |
| Dejarlo así | Inofensivo: las claves de más se sobrescriben al siguiente guardado y no afectan al comportamiento |

**Impacto actual: ninguno.** Se documenta para que no se pierda de vista.

### PEND-004 · Modo Panel de configuración sin verificar en navegador

| | |
|---|---|
| **Prioridad** | Alta |
| **Estado** | Implementado, sin probar en la app |
| **Módulo** | `js/ui/configuracion.js`, `js/core/router.js`, `css/configuracion.css` |

Se invirtió el predeterminado: ahora **Panel** es el modo por defecto y **Modal**
la opción.

- El toggle pasó de tres opciones (Página / Panel) a dos (Panel / Modal).
- `accesibilidad.configComoPagina` sigue siendo la clave almacenada para no
  invalidar lo que ya tienen guardado los usuarios: `false` = modal, `true` = panel.
- `modoActual` (interno) se renombró de `"pagina"`/`"panel"` a `"ruta"`/`"modal"`,
  porque `"panel"` pasó a significar lo contrario.
- El pie se movió **fuera de `.config-layout`**: dentro ocupaba solo el ancho de
  la columna de contenido, y el panel es un grid de menú + cuerpo.
- El pie lleva ahora Guardar y Cerrar propios, porque en modo Panel no hay modal
  que los ponga. En modo Modal se ocultan para no duplicar los del modal.

**Pendiente de comprobar**: el pie a todo el ancho, que Guardar se atenúe sin
cambios, y que Cerrar avise de cambios sin guardar.

**Relacionado**: `BUG-017` (el pie se extendía debajo del sidebar) queda
resuelto por este cambio, pero sigue marcado `PENDIENTE` en `reporte-bugs.md`
porque no se ha verificado en navegador.

---

### PEND-010 · Verificación en navegador del gráfico tras el pulido de UI

| | |
|---|---|
| **Prioridad** | Media |
| **Estado** | Anotado, sin verificar |
| **Módulo** | `js/ui/graficos.js`, `css/dashboard.css`, `css/inversiones.css` |

El pulido visual de la sesión beta.27 (commit `d77cf7d`) tocó el esqueleto de
las cards, los bordes y las capas con `position: fixed`. El gráfico de Chart.js
(`js/ui/graficos.js:127,308,446`) es el punto más frágil frente a ese tipo de
cambios: el canvas se dimensiona contra su contenedor y un desajuste de layout
se ve como líneas borrosas, ejes mal medidos o canvas a 0 px.

**Pendiente de comprobar**: nitidez del canvas con devicePixelRatio ≠ 1,
tamaño de ejes y leyenda, el gráfico de evolución dentro del modal, y el
comportamiento al cambiar de tamaño la ventana. No hay test que cubra esto.

---

## Media

### PEND-005 · `js/core/familiaCuentas.js` fuera del precache

| | |
|---|---|
| **Prioridad** | Media |
| **Estado** | **Corregido en el working tree** |
| **Módulo** | `sw.js` |

El módulo nuevo no estaba en `SHELL_ASSETS`, así que sin red la página de Cuentas
fallaría al importar `familiaCuentas.js`. Añadido a `SHELL_ASSETS` junto a
`movimientos.js`, con la versión subida a `1.0.0-beta.21`.

Pendiente de confirmar en la siguiente carga que el service worker toma la
versión nueva.

### PEND-006 · `configuracion.js` se commiteó con cambios previos dentro

| | |
|---|---|
| **Prioridad** | Media |
| **Estado** | Anotado, sin resolver |
| **Módulo** | `js/ui/configuracion.js` |

El commit `a29a107` (diff de preferencias) arrastró cambios anteriores de ese
archivo que ya estaban en el working tree y no eran de este trabajo. Quedó
anotado en el mensaje del commit, pero si se quiere separar, hay que partir el
archivo en dos commits.

### ~~PEND-007 · Sin suite de tests en el repositorio~~

| | |
|---|---|
| **Prioridad** | ~~Media~~ Resuelto |
| **Estado** | Cerrado (commit `815b141`) |
| **Módulo** | `tests/`, `package.json` |

Resuelto: la suite vive en `tests/` y corre con `npm test` (runner propio en
Node, sin dependencias). Cubre el modelo de familia de cuentas, la creación de
familias, el diff de preferencias, los toggles de divisa, el reparto de
columnas de los formularios, el precache del service worker y la sintaxis ESM
de todos los `.js`. `npm run test:rules` ejecuta el smoke test de reglas de
snapshots contra el emulador (se salta solo si no hay emulador).

---

## Baja

### PEND-008 · El deploy publica cambios sin revisar

| | |
|---|---|
| **Prioridad** | Baja |
| **Estado** | Riesgo conocido, aceptado |
| **Módulo** | `firebase.json` |

`npm run deploy` sube el working tree completo. En el último despliegue se
publicaron 1421 archivos, incluidos **32 archivos modificados que no eran de este
trabajo** (home, auth, tema, gráficos, sidebar, manifest…) y el rediseño de
PEND-002 sin commitear.

Mitigación futura: `firebase deploy --only hosting` sigue usando el directorio,
así que la única forma real es desplegar con el árbol limpio.

### PEND-009 · Actualizar el estado de beta en la documentación

| | |
|---|---|
| **Prioridad** | Baja |
| **Estado** | Desfasado |
| **Módulo** | `docs/` |

- `roadmap.md` dice "v1.0.0-beta.5 (≈86 %)"; la app va en **beta.21**.
- `deuda-tecnica.md` ya está en beta.21, pero su resumen de ítems y prioridades
  no incluye lo que este trabajo añadió (subcuentas, diff de preferencias,
  modo Panel).
- Ambos siguen describiendo el modelo de cuentas sin `padreId`.

---

## Planes a futuro

1. **Limpiar preferencias redundantes** en lote (PEND-003).
2. **Cerrar el origen del `Missing or insufficient permissions`** de los snapshots
   (PEND-001).
3. **Partir `configuracion.js`** para que el diff de preferencias y los cambios
   previos sean commits independientes (PEND-006).
4. **Revisar `DEUDA-012` y `DEUDA-013`** (`create`/`update` asimétricos y el
`hasOnly` manual de `movimientos`): son reincidentes, y ya produjeron R-03
y R-05. Desde la Fase 3 los tests offline (`tests/reglas.test.mjs`) avisan si
vuelven a desalinearse, pero queda pendiente resolver la parte de validación de
tipos.

---

## Reglas de este archivo

- Un pendiente se cierra con su commit y, si aplica, con una línea en
  `reporte-bugs.md` o `deuda-tecnica.md`.
- Nada se borra: se tacha. El motivo importa tanto como el arreglo.
- Si un pendiente necesita una decisión del usuario y no está clara, se queda
  en *Bloqueante* con la pregunta escrita.
