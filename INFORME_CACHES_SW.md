# Informe de auditoría — Sistema de caché, Service Worker y despliegues de escinco

**Fecha:** 30 de octubre de 2026  
**Repositorio:** `C:\Users\david\Downloads\David\prog\escinco`  
**Estado del trabajo:** todo completado, nada desplegado a producción (solo `firebase deploy --dry-run`).

---

## 1. Diagnóstico

El problema reportado era que los cambios desplegados no llegaban a los usuarios. La auditoría del camino completo (HTTP cache, CacheStorage, Firebase Hosting, recursos externos, estado en memoria de la pestaña) concluyó que **el Service Worker era el cuellobotella principal, pero no el único**:

1. **SW con caché por nombre de archivo inmutable:** `js/lib/chart.umd.min.js` y todos los JS/CSS del sitio se servían con `stale-while-revalidate` desde caché, de modo que tras un despliegue el navegador seguía ejecutando el código antiguo hasta la segunda recarga (o hasta que caducara el HTTP cache).
2. **Precache frágil e incompleto:** `sw.js` de HEAD usaba `cache.addAll` con 126 entradas, incluía `/index.html` (que el target `app` no publica) y no incluía 9 módulos ni `/eliminar-datos.html`. Si un solo activo fallaba, la instalación caía en silencio y dejaba un SW activo con un shell a medias.
3. **Cachés nombradas solo con `VERSION.numero`:** el nombre de caché dependía únicamente de la versión comercial. Si el operador no subía la versión, el despliegue no estrenaba caché y el SW anterior seguía al mando.
4. **Respaldo offline acoplado a una lista de hosts (`HOSTS_APP`):** en dominios no listados (p. ej. `app-escinco.firebaseapp.com`) el SW devolvía un `index.html` inexistente y la página se rompía con `TypeError: Cannot read properties of undefined`.
5. **`manifest.start_url: "/app"`:** en producción el target `app` no publica `/app`, con lo que una PWA instalada desde la landing aterrizaba en un 404.
6. **Cabeceras `Cache-Control` en rutas sin extensión:** Firebase Hosting aplica `max-age=3600` a `/`, `/dashboard`, `/login`, etc., porque la regla de cabeceras `**/*.@(html|js|mjs|css)` no matchea rutas sin extensión. Un HTML antiguo puede quedarse en el HTTP cache del navegador aunque el SW ya esté actualizado.

---

## 2. Evidencias

### Ejecuciones del banco de pruebas (Chrome real vía CDP contra un mock de Firebase Hosting)

| Fase | Resultado | Fallos |
|------|-----------|--------|
| `antes` (código de HEAD, `repo-antes`) | **24/31 OK** | P2 1ª recarga JS, P3 1ª y 2ª recarga CSS, P8 host `app-escinco.firebaseapp.com`, P8 `manifest.start_url: "/app"` → 404, P9 lib 1ª recarga, P9 caché ajena borrada |
| `despues` (código con fix) | **31/31 OK** | Ninguno |

Resultados guardados en:
- `C:\Users\david\AppData\Local\Temp\opencode\esc\resultado-antes.json`
- `C:\Users\david\AppData\Local\Temp\opencode\esc\resultado-despues.json`

### Suite de tests del repositorio (`npm test`)

**TODO OK — 29 suites, todas verdes**, incluida la nueva `precache.test.mjs` (8/8) que impide el drift del precache.

### Producción (lectura sola, `curl`/`Invoke-WebRequest`)

- `https://app-escinco.web.app/` → 200, título "Dashboard"
- `https://app-escinco.web.app/index.html` → 404 (confirmado: la app no publica `/index.html`)
- `https://app-escinco.web.app/app` → 404 (confirmado: el bug del manifest)
- `https://escinco.web.app/` → 200, título "Tus finanzas, claras en segundos"
- Cabeceras production confirmadas: documentos sin extensión devuelven `max-age=3600` (defecto #6); `/dashboard.html`, `/sw.js` devuelven `no-cache`.

---

## 3. Problemas de arquitectura

| # | Problema | Impacto | Origen |
|---|----------|---------|--------|
| A | JS/CSS del sitio sin `no-cache` ni versión en la URL | El navegador sirve código viejo en la 1ª recarga tras un despliegue | `sw.js` (SWR por defecto) + HTTP cache de Firebase Hosting |
| B | Precache con `cache.addAll` y `/index.html` incluido | Si `/index.html` 404 (target app) o cualquier activo falla, el install cae en silencio con shell incompleto | `sw.js` HEAD |
| C | Nombre de caché solo con `VERSION.numero` | Sin subir la versión, no hay nuevo caché ni nuevo SW | `constants/version.js` acoplado al nombre de caché |
| D | Respaldo offline por lista de hosts (`HOSTS_APP`) | Dominios no listados rompen la app offline | `sw.js` HEAD |
| E | `manifest.start_url: "/app"` | PWA instalada desde landing abre un 404 en producción | `manifest.webmanifest` HEAD |
| F | `Cache-Control: max-age=3600` en rutas sin extensión | HTML antiguo persistente en el HTTP cache del navegador | `firebase.json` (regla solo para `*.@(html\|js\|mjs\|css)`) |

---

## 4. Cambios y justificación

### `sw.js` (reescrito)

- **Nombre de caché:** `escinco-${VERSION.numero}-${BUILD_ID}-shell|runtime`. Ambos identificadores entran en el nombre, así que cualquier despliegue (con o sin subida de versión) estrenan caché.
- **Precache con `cache: "reload"`:** se descarta el HTTP cache del navegador y se guarda lo que el servidor sirve ahora.
- **Install abortiva:** si cualquier activo del precache falla, se borra la caché shell y se lanza error, para no dejar un SW activo con shell a medias.
- **Estrategias por tipo de recurso:**
  - Navegaciones → red primero + respaldo offline desde caché.
  - JS/CSS del sitio → red primero (`cache: "no-cache"`), código nuevo en la 1ª recarga.
  - Fuentes → caché primero (2 MB, inmutables).
  - Iconos/imágenes → stale-while-revalidate.
  - SDK Firebase versionado en gstatic (`/firebasejs/12.x/...`) → caché primero (URL inmutable).
  - APIs Firebase/Google → red solamente, sin cachear.
- **`event.waitUntil`** en todas las escrituras a caché.
- **Activate** borra solo cachés con prefijo `escinco-`; nunca toca cachés de otras apps del mismo origen.
- **Respaldo offline independiente del host:** se sirve la `/` cacheada de este origen, con fallbacks por ruta (`/demo` → `/demo.html`, `/login|/register` → `/auth.html`, etc.). Eliminada la lista `HOSTS_APP`.
- **SHELL_ASSETS ampliado a 139 entradas:** se añaden los 9 módulos que faltaban (`doodles.js`, `presupuestos.js`, `AuthServicio.js`, `FavoritoServicio.js`, `PresupuestoServicio.js`, `FavoritoRepositorio.js`, `PresupuestoRepositorio.js`, `Favorito.js`, `Presupuesto.js`), `/eliminar-datos.html`, `/constants/build.js`; se quita `/index.html`.

### `js/core/pwa.js` (reescrito)

- `updateViaCache: "none"` en el registro, para que el navegador siempre compruebe si hay un `sw.js` nuevo.
- Comprobación de actualización en cada carga, al volver a la pestaña y al recuperar la conexión (máx. una vez cada 5 min).
- Un solo listener `controllerchange` con guardia `recargando`, para recargar exactamente una vez cuando el SW nuevo toma el control.
- Bandera `escinco_sw_dev` en `localStorage` para probar el SW en `localhost` (donde por defecto se desactiva).

### `constants/build.js` (nuevo)

- Exporta `BUILD_ID`, el identificador técnico del despliegue, separado de `VERSION.numero` (versión comercial).
- Valor por defecto en el repositorio: `"local"` (para `firebase serve` y desarrollo).

### `tools/generar-build.mjs` (nuevo)

- Calcula `BUILD_ID = <git-sha-corto>-<sha256-contenido-publicado[:10]>`.
- Idempotente: mismo contenido → mismo ID. `--print` muestra sin escribir; `--id local` resuelve para tests.
- Excluye `constants/build.js` de su propio hash.

### `firebase.json`

- `predeploy: ["node tools/generar-build.mjs"]` en ambos targets (`landing` y `app`).
- Ignora `tests/**`, `tools/**`, `experimentos/**` en ambos targets; además `index.html` solo en `app`.
- Nueva regla de cabecera `source: "**"` con CSP para todo.
- Reglas `no-cache` específicas para documentos sin extensión de cada target:
  - landing: `/`, `/@(privacidad|terminos|eliminar-datos|demo)`, `/demo/**`
  - app: `/`, `/@(login|register|reset-password|dashboard|cuentas|movimientos|inversiones|trading|configuracion)`
- `/sw.js` mantiene `no-cache, no-store, must-revalidate`.
- `/manifest.webmanifest` mantiene `public, max-age=3600`; `/js/lib/**` y `/fonts/**` inmutables; `/icons/**` 7 días.

### `manifest.webmanifest`

- `start_url` de `"/app"` → `"/"` (resuelve por sitio: landing → `index.html`, app → `dashboard.html`).

### `tests/precache.test.mjs` (nuevo)

- Comprueba que todo el código publicado (`js/`, `firebase/`, `constants/`, `css/`) y todos los documentos están en `SHELL_ASSETS`.
- Comprueba que no hay `/index.html`, que hay `/`, que `BUILD_ID` existe y se usa en los nombres de caché, y que `activate` solo borra el prefijo `escinco-`.

---

## 5. Pruebas en localhost

Se reprodujo con **Chrome real** mediante CDP (sin dependencias extra) contra un **mock de Firebase Hosting** en Node que sirve cuatro hosts (`www.escinco.test`, `app.escinco.test`, `app-escinco.firebaseapp.com`, `otro.escinco.test`) mapeados a `127.0.0.1`.

- Los "despliegues" se simulan con un **overlay** que el servidor aplica en caliente desde un archivo de control (no toca el repositorio).
- La "caída de red" se simula cortando el socket (`req.socket.destroy()`), por lo que las pruebas offline son reales.
- `js/core/pwa.js` desactiva el SW en `localhost`/`127.0.0.1`, por eso se usan hosts falsos en vez de `localhost`.

El banco cubre 31 checks (P1–P9): primera instalación, JS/CSS nuevo en 1ª recarga, cambio de versión con pestaña abierta, dos pestañas a la vez, offline real (socket caído), respaldo de rutas SPA, aborto de install por activo 500, landing vs app vs host firebaseapp, manifest.start_url, librería local y preservación de cachés ajenas.

---

## 6. Resultados antes/después

| Check | Antes (HEAD) | Después (fix) |
|-------|-------------|---------------|
| P1 instalación SW + precache >100 | OK (126) | OK (139) |
| P2 JS nuevo, 1ª recarga | **FALLA** (sirve A) | OK (sirve B) |
| P2 JS nuevo, 2ª recarga | OK | OK |
| P3 CSS nuevo, 1ª recarga | **FALLA** (sirve A) | OK (sirve B) |
| P3 CSS nuevo, 2ª recarga | **FALLA** (sirve A) | OK (sirve B) |
| P4 cambio de versión, pestaña abierta | OK | OK |
| P5 dos pestañas actualizadas | OK | OK |
| P6 offline real + respaldo SPA | OK | OK |
| P6 offline en `app-escinco.firebaseapp.com` | **FALLA** (TypeError) | OK |
| P7 install aborta si activo falla | **FALLA** (SW activo, shell a medias) | OK (no hay SW activo) |
| P8 `manifest.start_url` → 200 | **FALLA** (`/app` → 404) | OK (`/` → 200) |
| P9 lib local 1ª recarga | **FALLA** (sirve A) | OK (sirve B) |
| P9 caché ajena preservada | **FALLA** (borrada) | OK |
| **Total** | **24/31** | **31/31** |

---

## 7. Pendientes

1. **Verificación end-to-end en producción real:** no se puede hacer sin desplegar. Los cambios en `firebase.json` (cabeceras `no-cache` en rutas sin extensión) solo se validarán definitivamente tras un `firebase deploy` real. Se recomienda ejecutar `firebase deploy --only hosting` en un entorno de staging o directamente en producción tras revisar este informe.
2. **`firebase serve` ignora la lista `ignore`:** al usar el emulador obsoleto, `app /` sirve `index.html` (que en producción está ignorado y da 404). Es una limitación del comando deprecado, no del fix. No bloquea el despliegue.
3. **Constatar que `constants/build.js` sucio tras cada deploy es aceptable:** el `predeploy` reescribe el archivo, dejando el working tree sucio (`constants/build.js` modificado). Está documentado; el valor por defecto `"local"` se restaura con `node tools/generar-build.mjs --id local`.

---

## 8. Instrucciones de verificación manual

1. **Arranque local:** `npm run serve` (o `firebase serve --only hosting --port 5020`). La landing responde en `:5020`, la app en `:5025`.
2. **Validar `firebase.json` sin desplegar:** `firebase deploy --only hosting --dry-run --non-interactive`. Debe terminar con "Dry run complete" y ejecutar el `predeploy` de ambos targets sin subir nada.
3. **Comprobar que un despliegue llega en la 1ª recarga:** editar un JS/CSS, simular el despliegue (overlay o deploy real), recargar la página una sola vez y confirmar que se ejecuta el código nuevo (marca del build).
4. **Comprobar offline:** con Chrome, activar "Offline" en DevTools → Network, recargar y navegar por rutas del sitio; la demo y las rutas SPA deben responder desde caché.
5. **Comprobar cabeceras de rutas sin extensión:** `curl -I https://escinco.web.app/` y `https://app-escinco.web.app/dashboard` deben devolver `Cache-Control: no-cache` (tras el deploy real).
6. **Tests del repositorio:** `npm test` debe quedar TODO OK (29 suites).

---

## 9. Comandos de arranque local

```powershell
# Instalar firebase-tools (si no está)
npm install -g firebase-tools

# Login y selección de proyecto
firebase login --no-localhost
firebase use cinco-96064

# Arranque local de los dos targets
npm run serve
# -> landing: http://localhost:5020   app: http://localhost:5025

# Validar configuración sin desplegar
firebase deploy --only hosting --dry-run --non-interactive

# Tests del repositorio
npm test

# Regenerar BUILD_ID (devuelve a "local")
node tools/generar-build.mjs --id local
```

---

## 10. Confirmación explícita de que no se desplegó nada

**No se ha desplegado nada a Firebase Hosting ni a ningún entorno de producción.** Las únicas operaciones ejecutadas contra Firebase fueron:

- `firebase deploy --only hosting --dry-run --non-interactive` (validación de configuración, nada subido)
- `firebase deploy --only hosting:app --dry-run --non-interactive --debug` (validación del target app, nada subido)
- `firebase serve --only hosting` en puertos locales (emulador local, sin publicar)

No se modificaron Firestore, reglas de seguridad, Auth, el modelo de datos, el diseño visual ni la versión comercial. Todos los cambios se limitan a la capa de caché/SW, `firebase.json`, `manifest.webmanifest` y los archivos nuevos (`constants/build.js`, `tools/generar-build.mjs`, `tests/precache.test.mjs`).

**Pruebas que no pudieron ejecutarse:** verificación end-to-end en producción real (requiere un `firebase deploy` real que queda fuera del alcance de esta tarea por instrucción expresa) y validación de las cabeceras `no-cache` de rutas sin extensión en el entorno de producción (solo validadas localmente con `minimatch` y en `firebase serve`, que ignora las reglas `headers`).
