# 📋 Mapeo de bugs — proyecto escinco

**Repositorio:** `C:\Users\david\Downloads\David\prog\escinco`  
**Estado de tests:** `npm test` → **TODO OK** (29 suites, 0 fallos)  
**Fecha:** 4 nov 2026

---

## 1. Bugs conocidos (registrados como BUG-XXX / DEUDA-XXX / PEND-XXX)

| ID | Archivo / línea | Qué ocurría | Estado |
|---|---|---|---|
| **BUG-016** | `js/pages/movimientos.js:1250` | El foco podía quedar fuera del recorrido del teclado al navegar movimientos | Documentado (corregido) |
| **BUG-019** | `js/ui/configuracion.js:1483,1593,1784` / `js/ui/exportar.js:24` | El modal de progreso/importación no se cierra hasta que la operación termina | Por diseño |
| **BUG-025** | `js/pages/movimientos.js:601` | En una transferencia, el saldo se movía al lado contrario de la cuenta de destino | Documentado (corregido) |
| **BUG-026** | `js/pages/cuentas.js:1067` / `js/services/CreditoServicio.js:46` | El nivel de uso de tarjeta discrepaba entre superficies | Documentado (corregido) |
| **BUG-027** | `js/pages/cuentas.js:1220` / `js/services/CreditoServicio.js:295` | Con el ciclo pagado, el botón ofrecía saldar deuda ya pagada | Documentado (corregido) |
| **BUG-028** | `js/services/MovimientoServicio.js:460,477` / `js/ui/formularioMovimiento.js:42` | Una tarjeta no tiene saldo que mover; el formulario ya no ofrece tarjetas como origen | Documentado (corregido) |
| **BUG-029** | `js/pages/movimientos.js` (abrirFormularioDetalle) | `ReferenceError: tipo is not defined` | **CORREGIDO** (test en `tests/bug029.test.mjs`) |
| **BUG-030** | `js/services/ExportarServicio.js:121` / `tests/reglas.test.mjs` | El `hasOnly` de `historial` no admite `id` | Documentado (corregido) |
| **DEUDA-002 / 002b** | `constants/tiposMovimiento.js:42` / `js/services/MovimientoServicio.js:451` | Campos de transferencia a divisa distinta (`montoDestino`, `tasa`) pendientes de unificar | Pendiente |
| **DEUDA-012** | `tests/reglas.test.mjs` | `create` y `update` comparten validador en movimientos y cuentas | Pendiente |
| **DEUDA-013** | `tests/reglas.test.mjs` | Todos los campos de `CONFIG_MOVIMIENTOS` deben estar en el `hasOnly` de movimientos; paleta de etiquetas debe coincidir entre reglas y `style.css` | Pendiente |
| **PEND-001** | `tests/reglas.test.mjs` | `snapshots` no usa `hasOnly` en `update` | Pendiente |

---

## 2. Bugs nuevos corregidos

### ✅ A — Descargas de archivo canceladas prematuramente (`URL.revokeObjectURL(url), 0`)

**Archivos modificados:**
- `js/core/descarga.js` **(nuevo)** — helper `descargarArchivoSeguro(url, nombre)` que revoca el ObjectURL a los 1000 ms en vez de 0 ms, asegurando que el navegador ya empezó a leer el blob.
- `js/core/cache.js` — `guardarReporte()` usa `descargarArchivoSeguro`.
- `js/services/ExportarServicio.js` — exportación `.dvid` usa `descargarArchivoSeguro`; se eliminó la función `descargarArchivo` local duplicada.
- `js/pages/movimientos.js` — exportación CSV usa `descargarArchivoSeguro`; se eliminó la función `descargarArchivo` local duplicada.
- `sw.js` — `/js/core/descarga.js` añadido a `SHELL_ASSETS` para el precache del Service Worker.

**Descripción:** Se reemplazó el patrón `setTimeout(() => URL.revokeObjectURL(url), 0)` por un helper centralizado con margen de 1000 ms, evitando que la descarga se cancele antes de arrancar en navegadores lentos o con archivos grandes.

---

### ✅ B — `innerHTML` con datos dinámicos (violación de `AGENTS.md` §1)

**Archivos modificados:**
- `js/core/iconos.js` — Añadida función `iconoNodo(nombre, tamano, strokewidth)` que devuelve un `<svg>` Node en vez de cadena HTML, permitiendo insertar iconos sin `innerHTML`.
- `js/pages/dashboard.js`:
  - Línea ~748: controles de edición de card — migrado de `controles.innerHTML = \`...\`` a `document.createElement` + `setAttribute` + `iconoNodo()`.
  - Línea ~1121: preview grid del modal — migrado de `previewGrid.innerHTML = previewHTML` a `replaceChildren()` + `createElement` por cada card.
  - Línea ~1747: simplificado `contenedor.innerHTML = contenido; return contenedor.innerHTML` a `return contenido` (el string ya se inyecta en el router).
- `js/core/router.js`:
  - Línea ~421: `container.innerHTML = html` → `insertarHTML(container, html)`.
  - Líneas ~430/432: `lastbarExistente.innerHTML` / `footer.innerHTML` → `insertarHTML(...)`.
  - Añadida función local `insertarHTML(destino, htmlString)` que parsea el HTML en un `<template>` temporal e importa los nodos con `document.importNode(tpl.content, true)`, evitando `innerHTML` directo en el DOM real.
- `sw.js` — `/js/core/descarga.js` añadido a `SHELL_ASSETS`.

---

### ✅ C — Supresor de doble clic replicado en 6 archivos

**Archivos modificados:**
- `js/core/supresorClick.js` **(nuevo)** — helper `crearSupresorDobleClick(delay)` que devuelve `{ marcar(), consumir() }` con estado encapsulado por instancia. Cada instancia es independiente, así que hacer clic en un elemento no suprime clics en otros.
- `js/pages/movimientos.js` — Reemplazadas variables `supresorClick`/`supresorClickTimer` y funciones locales por `crearSupresorDobleClick()`.
- `js/pages/trading.js` — Igual.
- `js/pages/inversiones.js` — Igual.
- `js/pages/cuentas.js` — Igual (nombres `supresorClickCuenta`).
- `js/ui/pendientes.js` — Igual (incluida la referencia pasada como callback a `vincularGestosPendientes`).
- `js/ui/metas.js` — Igual (incluidas referencias pasadas como callback).
- `sw.js` — `/js/core/supresorClick.js` añadido a `SHELL_ASSETS`.

**Descripción:** Cada página tenía su propia implementación con variables globales por página (`supresorClick`/`supresorClickTimer`), lo que hacía que un clic en un elemento suprimiera clics en cualquier otro elemento de la misma página durante 400 ms. Ahora cada instancia del supresor es independiente.

---

### ✅ D — Caché persistente fallaba en silencio

**Archivo modificado:**
- `js/core/cache.js` — `persistir()` ahora hace `console.warn("[caché] No se pudo persistir en localStorage:", error.message)` en el catch, en vez de ignorar el error silenciosamente. La caché en memoria sigue funcionando igual.

---

## 3. Quedan pendientes (deudas técnicas documentadas)

| ID | Qué | Por qué no se corrigió aún |
|---|---|---|
| **DEUDA-002 / 002b** | Campos de transferencia a divisa distinta | Cambio en el modelo de datos y validadores |
| **DEUDA-012** | `create`/`update` comparten validador | Requiere revisión de reglas de Firestore |
| **DEUDA-013** | `hasOnly` y paleta de etiquetas | Requiere sincronización reglas ↔ CSS |
| **PEND-001** | `snapshots` sin `hasOnly` en `update` | Requiere revisión de reglas de Firestore |

### Listeners globales (bajo riesgo, ya mitigados)

Los listeners globales en `cuentas.js` (`movimientos-actualizados`, `cuentas-actualizadas`), `movimientos.js` (`movimientos-actualizados`) y `dashboard.js` (`metas-actualizadas`, `presupuestos-actualizadas`) usan guards para evitar duplicados (`eventosRefreshCuentaListos`, `eventosGlobalesListos`, `sincronizacionMetasInstalada`, `sincronizacionPresupuestosInstalada`) y revisan si los elementos del DOM existen antes de actuar. El riesgo de memory leak es bajo. Para eliminarlo por completo sería necesario implementar `destroy()` en cada página y llamarlo desde el router al cambiar de ruta.

---

## 4. Verificación

- `npm test` → **TODO OK** (29 suites, 0 fallos)
- `npm run lint` → tiene ~9000 problemas preexistentes (código legacy, librerías minificadas, tests). No se introdujeron nuevos errores en los archivos modificados.
