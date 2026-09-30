# escinco · Levantamiento de información para informe académico

**Fecha de levantamiento**: 2026-09-29
**Alcance**: lectura completa del repositorio `escinco` (raíz del proyecto).
**Naturaleza de este documento**: inventario de lo que **sí** está documentado en el
código y en los documentos del repositorio, y de lo que **no** existe. No contiene
valoraciones ni información inventada.

> Convención de citas: `archivo:línea`. Cuando algo no existe en el repositorio se
> indica explícitamente como **"no documentado"**, **"no existe"** o **"no se puede
> determinar desde el código"**.

---

## 1. Descripción del proyecto

### 1.1 ¿Qué es escinco?

Definición oficial en el repositorio:

> "escinco es una **SPA de finanzas personales** que registra el patrimonio, las
> cuentas, los movimientos, las inversiones y el trading de un usuario en
> Firestore. No usa framework: JavaScript (ES Modules), HTML y CSS propios."
> — `docs/requisitos.md:11-13`

Otros descriptores encontrados:

| Descriptor | Valor | Fuente |
|---|---|---|
| Nombre | escinco | `manifest.webmanifest:2`, `constants/version.js:3` |
| `short_name` | escinco | `manifest.webmanifest:3` |
| `description` (manifest) | `"tucson"` | `manifest.webmanifest:4` |
| `description` (versión) | `"tucson"` | `constants/version.js:5` |
| `description` (requisitos) | `"tucson"` | `docs/requisitos.md:7` |
| Categorías PWA | `finance`, `productivity` | `manifest.webmanifest:15` |
| Idioma | `es` (español) | `manifest.webmanifest:5` |
| Autor | `david` | `constants/version.js:6` |

**Advertencia importante**: el campo `description` con el valor literal `"tucson"`
es un **placeholder no reemplazado** en los tres sitios donde aparece. No es una
descripción funcional del producto. Se reporta como inconsistencia.

Puntos de entrada HTML:

| Archivo | Rol | Cita |
|---|---|---|
| `login.html` | Inicio de sesión (email/contraseña + Google) | `login.html:27-67`, script `login.html:70` |
| `register.html` | Registro | `register.html`, script `js/pages/register.js` |
| `dashboard.html` | Contenedor SPA (navbar + `#app-content` + `#app-footer`) | `dashboard.html:67`, `dashboard.html:70`, `dashboard.html:72` |
| `404.html` | Página de error | `404.html` (25 líneas) |
| `test-cache.html` | Banco de pruebas de caché (excluido de despliegue) | `test-cache.html`, `firebase.json:18` |

### 1.2 ¿Cuál es su propósito?

- **Declarado**: gestión integral de finanzas personales — patrimonio, cuentas,
  movimientos, inversiones y trading (`docs/requisitos.md:11-13`).
- **Alcance funcional detallado**: `docs/requisitos.md:28-114` (autenticación,
  dashboard, cuentas, movimientos, pendientes, inversiones, estrategias DCA, metas,
  trading, órdenes, snapshots, divisa, datos, experiencia).
- **Declarado fuera de alcance**: "Renta variable dentro de trading/posiciones y
  carga de precios diarios" (`docs/requisitos.md:115-118`).
- **Público objetivo**: no está declarado de forma explícita más allá del
  descriptor "finanzas personales" de un "usuario" único.

**No documentado**: no hay documento de problema, justificación, objetivos SMART,
misión, visión ni alcance de negocio. **No existe `README.md`** (verificado).

### 1.3 ¿Quién es el usuario?

- Modelo de datos: **usuario único con aislamiento total por `uid`**. Todas las
  colecciones cuelgan de `usuarios/{uid}` (`docs/modelo-datos.md:16-28`,
  `docs/modelo-datos.md:33-34`).
- Perfil registrado: email, nombre (displayName), foto, fecha de registro
  (`docs/modelo-datos.md:38-44`; `firebase/auth.js:118-135`).
- El documento de usuario se crea automáticamente en el primer registro/login
  (`firebase/auth.js:118-135`, `firebase/firestore.js:40-83`).
- Al registrarse se crea automáticamente una cuenta de tipo `efectivo` con ID
  fijo `efectivo-inicial` y saldo 0 (`firebase/firestore.js:65-78`).
- Divisas soportadas: `PEN` (por defecto), `USD`, `USDT` (`constants/divisas.js:1-5`;
  `docs/modelo-datos.md:51`).

**Sobre el "email hardcodeado"**: se buscó en **todos** los archivos `.js`, `.html`,
`.json` y `.md` del proyecto (excluyendo `.git` y `.agents`) y **no existe ningún
email hardcodeado en el código de la aplicación**. La única dirección de correo
encontrada es la del autor en la configuración de Git
(`git config user.email` → `davidal.berrocallengua@gmail.com`), que es metadato de
Git, no de la app. Este supuesto de la consigna **queda desmentido por el código**.

### 1.4 ¿Cuál es el alcance actual (versión)?

| Fuente | Versión | Cita |
|---|---|---|
| `constants/version.js` | **1.0.0-beta.15** | `constants/version.js:2` |
| `docs/requisitos.md` | 1.0.0-beta.5 | `docs/requisitos.md:4` |
| `docs/roadmap.md` | "v1.0.0-beta.5 (≈86 % del ideal)" | `docs/roadmap.md:4` |
| Último commit | `1.0.0-beta.15` | commit `f5b74c8` |

**Inconsistencias documentadas**:
- `docs/requisitos.md` y `docs/roadmap.md` están desactualizados respecto a
  `constants/version.js` (3 minors de diferencia).
- `docs/requisitos.md:33` indica "cierre por inactividad (30 min)" mientras el valor
  por defecto real en código es **15 minutos** (`js/core/sesion.js:15`,
  `firebase/auth.js:29`), configurable por el usuario (5/15/30/60 o "nunca").

- **Fase declarada**: `beta` (`constants/version.js:10`, `docs/requisitos.md:5`).
- **Fecha de lanzamiento declarada**: `2026-09-13` (`constants/version.js:9`,
  `docs/requisitos.md:6`).
- **Fecha del primer commit**: `2026-08-04` (commit `fd484d5`).
- **Último commit**: `2026-09-24` (commit `f5b74c8`).

---

## 2. Stack tecnológico

### 2.1 Resumen

| Componente | Tecnología | Versión | Cita principal |
|---|---|---|---|
| Estructura | HTML5 | — | `dashboard.html:1-2` |
| Estilos | CSS3 (custom properties, grid, flex) | — | `css/style.css`, `css/dashboard.css` |
| Lógica | JavaScript ES Modules | — | `dashboard.html:72`, `login.html:70` |
| Framework JS | **ninguno** (vanilla) | — | `docs/requisitos.md:13`, `docs/requisitos.md:19` |
| Bundler / build | **ninguno** (Vite eliminado explícitamente) | — | commit `3b884eb` "chore: eliminar vite" |
| Autenticación | Firebase Authentication | CDN `12.0.0` | `firebase/auth.js:20` |
| Base de datos | Cloud Firestore | CDN `12.0.0` | `firebase/firestore.js:13` |
| Hosting | Firebase Hosting (sitio `escinco`) | — | `firebase.json:8-9` |
| Storage | Cloud Storage | — | `storageBucket` en `firebase/config.js:5` |
| Gráficos | Chart.js (UMD embebido local) | **4.4.7** | `js/lib/chart.umd.min.js:1-9` |
| Iconos | Set SVG propio con paths de **Lucide** (ISC) | — | `js/core/iconos.js:6` |
| PWA | `manifest.webmanifest` + Service Worker (módulo) | — | `manifest.webmanifest`, `sw.js:1` |
| Fuentes | Inter, Roboto Mono (TTF autoalojadas) | — | `css/style.css:1-60`, `fonts/` |
| Entorno dev | Firebase Emulators (solo hosting) | — | `package.json:3-4`, `docs/requisitos.md:23` |

### 2.2 HTML5

- **Dónde**: `dashboard.html`, `login.html`, `register.html`, `404.html`,
  `test-cache.html`.
- **Uso**: `lang`/`dir` declarados en el manifest (`manifest.webmanifest:5-6`);
  `data-theme` en `<html>` (`dashboard.html:2`, `login.html:2`); `meta viewport`
  (`dashboard.html:7`); `meta theme-color` (`dashboard.html:8`).
- **Por qué**: no hay comentario ni documento que lo justifique.

### 2.3 CSS3

- **Dónde**: 17 hojas en `css/`; todas cargadas desde `dashboard.html:12-23`,
  subconjunto desde `login.html:14-17`.
- **Técnicas**: custom properties (`--z-modal`, `--modal-x`, `--modal-y` en
  `js/ui/modal.js:455-464`), CSS Grid (`docs/auditoria-dashboard.md:29-36`),
  flexbox, `prefers-color-scheme` (`dashboard.html:9-10`),
  `prefers-reduced-motion` (`css/style.css:874`), variables de tema
  (`docs/requisitos.md:20`).
- **Por qué**: las variables de tema son el mecanismo de theming declarado
  (`docs/requisitos.md:20`).
- **Duplicación conocida**: `docs/roadmap.md:39` lista como pendiente
  "Desduplicar CSS y cargar solo los estilos de cada página".

### 2.4 JavaScript ES Modules

- **Dónde**: todos los archivos bajo `js/`, `firebase/` y `constants/`.
- **Entrada**: `dashboard.html:72` → `js/core/app.js`; `login.html:70` →
  `js/pages/index.js`; `register.html` → `js/pages/register.js`.
- **Code-splitting**: import dinámico nativo (`js/core/router.js:124`,
  `js/core/router.js:173`; `js/core/lastbar.js:496`).
- **Service Worker como módulo**: `sw.js:1` importa `VERSION` y se registra con
  `{ type: "module" }` (`js/core/pwa.js:56`).
- **Por qué**: "JavaScript (ES Modules), sin frameworks" (`docs/requisitos.md:19`).
  No hay justificación argumentada (tamaño de bundle, curva de aprendizaje,
  portabilidad) documentada.

### 2.5 Firebase

| Servicio | Dónde se usa | Cita |
|---|---|---|
| **Auth** (email/password, Google, reauth, deleteUser, persistencia) | `firebase/auth.js` | `firebase/auth.js:1-20`, `firebase/auth.js:27` |
| **Firestore** (CRUD, batch, serverTimestamp) | `firebase/firestore.js` | `firebase/firestore.js:1-17` |
| **Hosting** | configuración de despliegue | `firebase.json:8-35` |
| **Reglas de seguridad** | `firebase/firestore.rules` | `firebase/firestore.rules:1-524` |
| **Índices compuestos** | `firebase/firestore.indexes.json` | `firebase/firestore.indexes.json:1-20` |
| **Storage** | solo declarado en la config | `firebase/config.js:5` — **no hay ningún uso de Storage en el código** |

Proyecto Firebase: `cinco-96064` (`.firebaserc:3`), región Firestore `nam5`
(`firebase.json:4`), sitio Hosting `escinco` (`firebase.json:9`).

**Punto único de acceso**: `firebase/firestore.js:19-21` re-exporta `db`, `doc` y
`updateDoc` para que el resto de la app no importe del CDN directamente. Comentario
que lo justifica en `firebase/firestore.js:19-20` y `docs/roadmap.md:8-11`.

### 2.6 Chart.js

- **Versión**: **4.4.7** (`js/lib/chart.umd.min.js:1-9`:
  `chart.js@4.4.7/dist/chart.umd.js`).
- **Ubicación**: embebido localmente en `js/lib/chart.umd.min.js` (ni CDN ni npm).
- **Declarado**: "Chart.js embebido local (`js/lib/chart.umd.min.js`)"
  (`docs/requisitos.md:24`).
- **Uso**: a través del módulo de envoltura `js/ui/graficos.js`
  (`crearGraficoPatrimonio`, `crearGraficoEvolucionPrecio`,
  `destruirGraficoPatrimonio`, `destruirGrafico`). Ninguna página instancia Chart.js
  directamente.
- **Almacenamiento en caché**: `sw.js:122` lo precachea; `firebase.json:56-60` lo
  sirve con `Cache-Control: immutable, max-age=31536000`.
- **Racional**: no hay comentario que explique la decisión de embebido; se infiere
  del patrón "cero build" y del precache del SW.

### 2.7 Service Worker / PWA

- **Manifest**: `display: standalone`,
  `display_override: ["standalone","minimal-ui"]`, `orientation: portrait-primary`
  (`manifest.webmanifest:10-12`); 3 iconos (192, 512, maskable 512)
  (`manifest.webmanifest:17-36`); 3 shortcuts (Dashboard, Movimientos, Inversiones)
  (`manifest.webmanifest:37-56`).
- **SW**: `sw.js`, registrado como módulo con scope `/` (`js/core/pwa.js:52-68`).
- **Estrategias de caché**:
  - Precachado del shell completo (~120 assets) en `install` (`sw.js:136-147`, lista
    en `sw.js:9-130`).
  - Limpieza de cachés antiguas en `activate` + `clients.claim()` (`sw.js:153-170`).
  - Firebase/Firestore **nunca se cachea** (`sw.js:187-189`, `sw.js:219-227`).
  - Fuentes → `stale-while-revalidate` (`sw.js:192-195`, `sw.js:237-251`).
  - Navegación HTML → `network-first` con fallback a `/dashboard.html`
    (`sw.js:198-201`, `sw.js:253-274`).
  - Mismo origen y CDNs externos → `network-first` (`sw.js:206-212`).
  - Mensaje `SKIP_WAITING` desde la app (`sw.js:280-283`).
- **Versionado de caché**: `escinco-v${VERSION.numero}-shell` / `-runtime`
  (`sw.js:4-6`), lo que permite invalidación por versión.
- **Banner de actualización**: notificación con botón "Actualizar" y temporizador de
  seguridad de 5 s (`js/core/pwa.js:93-120`).
- **NO existe**: `beforeinstallprompt`, `appinstalled`, notificaciones push
  (`pushManager`, `Notification.requestPermission`) — verificado, 0 coincidencias.
  Tampoco existe función de borrado de datos offline.

### 2.8 Fuentes

- **Inter** (5 variantes: Regular, Medium, SemiBold, Bold, Italic) — `css/style.css:33-60`,
  archivos en `fonts/Inter/`.
- **Roboto Mono** (5 variantes) — `css/style.css:1-32`, archivos en
  `fonts/Roboto_Mono/`.
- Formato `.ttf` con `format("truetype")`; **no hay `font-display`** declarado.
- Caché inmutable de 1 año para `/fonts/**` (`firebase.json:62-66`).
- **Por qué**: no hay comentario ni documento que lo justifique.

### 2.9 SDK de Firebase (versión CDN)

- **Versión**: `12.0.0` en todas las importaciones por CDN.
- **Módulos importados por URL**:
  - `firebase-app.js` — `firebase/firebaseClient.js:1`
  - `firebase-auth.js` — `firebase/auth.js:20`
  - `firebase-firestore.js` — `firebase/firestore.js:13`, `firebase/auth.js:22`
- **Racional documentado**: "se mantiene CDN" (`docs/roadmap.md:10`). No hay más
  justificación.
- **Consecuencia**: no hay empaquetado, ni `package-lock.json` (ignorado en
  `.gitignore:76`), ni `node_modules`.

### 2.10 Otras dependencias y librerías

| Dependencia | Estado | Cita |
|---|---|---|
| **Lucide (paths SVG)** | Copiados al catálogo propio `ICONOS` (49 entradas). Licencia ISC mencionada en el comentario. **No** se carga en runtime. | `js/core/iconos.js:6`, `js/core/iconos.js:8-58` |
| Google Fonts (Inter/Roboto Mono) | **No se usan**; los `.ttf` están autoalojados en `fonts/` | `fonts/` |
| Google Identity Services (GIS) | **No se usa**; se usa `signInWithPopup` de Firebase Auth | `firebase/auth.js:64` |
| Binance API | precios de cripto | `js/strategies/PrecioAutomaticoStrategy.js:89-92` |
| Yahoo Finance API | precios de acciones/ETFs | `js/strategies/PrecioAutomaticoStrategy.js:94-108` |
| API de tipo de cambio | modo automático del TC | `js/services/DivisaServicio.js:160-186` |

Dependencias npm declaradas en `package.json`: **ninguna** (el archivo solo tiene
`scripts`). No hay `dependencies` ni `devDependencies`.

---

## 3. Arquitectura del software

### 3.1 Estructura de carpetas

```
escinco/
├── constants/          # constantes de dominio
│   ├── divisas.js
│   ├── tiposMovimiento.js
│   └── version.js
├── css/                # 17 hojas de estilo
├── docs/               # 6 documentos markdown
├── experimentos/       # exp.js (experimento de gestos táctiles)
├── firebase/           # capa de infraestructura Firebase
│   ├── auth.js
│   ├── config.js
│   ├── firebaseClient.js
│   ├── firestore.js
│   ├── firestore.indexes.json
│   └── firestore.rules
├── fonts/              # Inter, Roboto Mono (TTF)
├── icons/              # favicon SVG, PNG PWA, icons.ai
├── js/
│   ├── core/           # app, router, sesion, cache, tema, pwa, lastbar, fechas, iconos
│   ├── lib/            # chart.umd.min.js (Chart.js 4.4.7)
│   ├── models/         # Activo, Estrategia, Meta, Orden, Pendiente, Posicion, Trade
│   ├── pages/          # dashboard, cuentas, movimientos, inversiones, trading, index, register
│   ├── repositories/   # 10 repositorios Firestore
│   ├── services/       # 18 servicios de dominio
│   ├── strategies/     # ManualPrecioStrategy, PrecioAutomaticoStrategy
│   └── ui/             # modal, configuracion, graficos, metas, pendientes, formularios, widgets
├── 404.html
├── dashboard.html
├── login.html
├── manifest.webmanifest
├── package.json
├── register.html
├── sw.js
├── test-cache.html
├── firebase.json
└── .firebaserc
```

### 3.2 Patrón arquitectónico

El patrón descrito en el propio código es de modelo de datos por usuario
(`firebase/firestore.rules:6-9`).

El proyecto es una **SPA vanilla con arquitectura por capas (MVC conceptual)**,
documentada de facto en la estructura de carpetas:

```
UI (js/pages, js/ui)
      ↓  imports
Servicio (js/services)          ← lógica de negocio
      ↓
Repositorio (js/repositories)   ← acceso a Firestore
      ↓
Firestore
```

- **Inyección de dependencias**: no hay contenedor de IoC. La "inyección" se hace
  por **imports ES estáticos** en el tope del módulo y por **imports dinámicos**
  para code-splitting.
- **Acoplamientos observados**:
  - `js/pages/cuentas.js:4-13` accede a Firestore **directamente** (saltando la capa
    de repositorio) — inconsistencia arquitectónica.
  - `js/pages/movimientos.js:1` igual.
  - `js/core/app.js:1-10` importa transversalmente de `firebase/`, `js/ui/`, `js/core/`.
  - `js/pages/configuracion.js` fue movido a `js/ui/configuracion.js` (renombrado
    sin commitear) al dejar de ser una página y pasar a ser un modal.

### 3.3 Cómo se comunican las capas

- **Imports ES estáticos** en el encabezado de cada archivo. Ejemplo de capas en
  `js/pages/dashboard.js:1-35`: `core/` (1-3), `firebase/` (4), `constants/` (5),
  `services/` (6-10, 15-24, 28), `ui/` (11-14, 29-30, 32, 35), `core/iconos.js` (31),
  `repositories/` (25-27, 34).
- **Imports dinámicos** para code-splitting:
  - Páginas: `js/core/router.js:124` (precarga), `js/core/router.js:173` (carga).
  - Acciones de lastbar: `js/core/lastbar.js:496` y cada handler
    (`js/core/lastbar.js:340-474`).
  - Configuración: `js/core/router.js:18` → `import("../ui/configuracion.js")`.
  - Cruzados entre páginas: `js/pages/cuentas.js:455` → `import("./movimientos.js")`;
    `js/pages/movimientos.js:915` → `import("./trading.js")`;
    `js/pages/dashboard.js:520` → `import("./cuentas.js")`.
  - Servicio → UI (dependencia inversa): `js/services/CreditoServicio.js:323`
    importa `abrirPagarTarjeta` de `js/pages/cuentas.js`.

### 3.4 Gestión del estado

No hay librería de estado global. El estado se reparte en varios mecanismos:

| Mecanismo | Ubicación | Contenido |
|---|---|---|
| **Clase `Sesion` (singleton en memoria)** | `js/core/sesion.js:1-250` | Usuario, preferencias (valores por defecto completos en `js/core/sesion.js:5-38`), caché en `Map` con TTL (`js/core/sesion.js:178-198`) |
| **`sessionStorage`** | `js/core/sesion.js:50`, `135` | `escinco_usuario`, `escinco_preferencias` |
| **`localStorage`** | `js/core/tema.js:16`, `js/core/router.js:276`, `js/ui/colapsoSidebar.js:8`, `js/ui/configuracion.js:1354` | `escinco_tema`, `escinco_lastbar_mode`, `escinco_sidebar_collapsed` |
| **Firestore (fuente de verdad)** | `usuarios/{uid}.preferencias` | `firebase/firestore.js:216-238` — merge con notación de punto |
| **Caché de datos en memoria por usuario** | `js/core/cache.js:24-193` | `Map` con clave `${uid}::${clave}`, TTL 5 min, dedupe de peticiones en vuelo, invalidación por repositorio, estadísticas con `ahorroPorcentual` |
| **Estado local de página** | variables de módulo | p. ej. flags de idempotencia de listeners en `js/pages/dashboard.js:58`, `142`, `143` |
| **Sincronización entre páginas** | `CustomEvent` | `metas-actualizadas` (`js/ui/metas.js:58-60`, consumidor `js/pages/dashboard.js:2639`); `movimientos-actualizadas` (`js/services/MovimientoServicio.js:322-328`, consumidores `js/pages/dashboard.js:1234`, `js/pages/cuentas.js:97`); `pagina-cambiando` (`js/core/router.js:339-344`); `tema-cambiado` (`js/core/lastbar.js:53-55`) |

**Preferencias por defecto** (`js/core/sesion.js:5-38`): `paginas` (6 rutas),
`seg` (inactividad 15 min, cerrar al cerrar pestaña), `accesibilidad` (5 opciones),
`tiposMovimiento` (7 interruptores), `movimientosRecientes: 5`,
`periodoEvolucion: "30d"`, `resaltarPatrimonio: 0`, `formatoDivisa: "simbolo"`.

### 3.5 Navegación (router)

**Es router basado en `pathname` (History API), NO hash-based.** Esto contradice el
supuesto de la consigna.

- **Mapa de rutas** (`js/core/router.js:4-11`): `/` → `dashboard`, `/dashboard` →
  `dashboard`, `/cuentas`, `/movimientos`, `/inversiones`, `/trading`.
- **`/configuracion` no es una ruta de página**: se abre como modal `xl` sobre la
  ruta actual, conservándose como enlace profundo (`js/core/router.js:13-20`,
  `js/core/router.js:350-353`, `js/core/router.js:428-434`).
- **Ciclo de navegación** (`js/core/router.js:138-207`):
  1. Token anti-carrera `navId` (`js/core/router.js:139`).
  2. `aria-busy` en `#app-content` + spin del logo (`js/core/router.js:140-141`).
  3. Bloqueo de páginas ocultas por preferencia (`js/core/router.js:148-153`).
  4. Import dinámico del módulo de página (`js/core/router.js:173`).
  5. `destroy()` de la página anterior (`js/core/router.js:301-307`).
  6. `render()` → `container.innerHTML` (`js/core/router.js:310-311`).
  7. Re-render de la lastbar (`js/core/router.js:313-318`).
  8. `pushState` (`js/core/router.js:323-326`).
  9. `init()` de la página (`js/core/router.js:186-193`).
  10. Restauración de scroll y foco (`js/core/router.js:166-167`).
- **Transiciones**: `document.startViewTransition` si existe y el usuario no pidió
  movimiento reducido (`js/core/router.js:113-119`).
- **Precarga por `pointerover` / `focusin`** sobre los links de navegación
  (`js/core/router.js:397-405`).
- **Manejo de errores por página**: contador de fallos, sin reintento infinito;
  `SyntaxError` no se reintenta nunca (`js/core/router.js:217-267`).
- **Rewrites de Hosting** que hacen posible el deep-link sin 404
  (`firebase.json:25-35`).
- **Botón atrás**: `popstate` (`js/core/router.js:408-421`).
- **Aviso de cambio de página**: evento `pagina-cambiando` cancelable para detectar
  cambios sin guardar (`js/core/router.js:337-345`).

### 3.6 Lastbar (barra de acciones contextual)

Sistema central propio, análogo a una action bar contextual:

- Render por página: `js/core/lastbar.js:290-293` (`LASTBARS[page]`).
- Delegación única de eventos sobre `#app-footer` (permanente):
  `js/core/lastbar.js:476-503`, instalado en `js/core/app.js:84`.
- Mapa de 21 acciones: `js/core/lastbar.js:338-474`.
- Tooltips accesibles con `role="tooltip"`: `js/core/lastbar.js:295-329`.
- Modo auto-hide / siempre visible persistido en `localStorage`:
  `js/core/router.js:275-281`, `js/ui/configuracion.js:1354`.

---

## 4. Modelo de datos

### 4.1 Árbol de colecciones

```
usuarios/{uid}
├── preferencias            (objeto embebido)
├── cuentas/{autoId}
├── movimientos/{autoId}
├── activos/{autoId}
│   └── historial/{YYYY-MM-DD}
├── posiciones/{autoId}
├── pendientes/{autoId}
├── estrategias/{autoId}
├── metas/{autoId}
├── ordenes/{autoId}
├── snapshots/{YYYY-MM-DD}
└── trades/{autoId}

config/{doc}                (global, versionado)
```

Fuente: `docs/modelo-datos.md:16-31`.

### 4.2 Convenciones de nombres

`docs/modelo-datos.md:3-11` y `docs/reglas.md:1-7`:

- Todo en `camelCase`.
- Todos los tipos en minúsculas.
- Divisas en **mayúsculas** (`PEN`, `USD`, `USDT`).
- IDs personalizados en minúsculas con guiones bajos.
- Todas las fechas en Firestore son `Timestamp`.
- Snapshots usan ID `YYYY-MM-DD`.
- **"No se guarda información que pueda recalcularse, salvo por rendimiento"**
  (`docs/modelo-datos.md:11`).

### 4.3 Campos por colección

#### `usuarios/{uid}` — `docs/modelo-datos.md:36-67`

| Campo | Tipo | Nota |
|---|---|---|
| `email` | string | de Firebase Auth |
| `nombre` | string | displayName |
| `foto` | string/null | photoURL |
| `fechaRegistro` | Timestamp | `serverTimestamp()` |
| `preferencias` | object | ver abajo |

**Discrepancia**: el código también escribe `efectivoInicialCreado: boolean`
(`firebase/firestore.js:53`, `61`, `80`), campo **no documentado** en
`docs/modelo-datos.md` y **no permitido** por `hasOnly` en el `create`
(`firebase/firestore.rules:53`). Funciona solo porque la validación de `update` es
un `return true` (`firebase/firestore.rules:61-65`).

#### `preferencias` — `docs/modelo-datos.md:46-66` + `js/core/sesion.js:5-38`

| Campo | Tipo | Valores |
|---|---|---|
| `tema` | string | `dark` \| `light` \| `system` |
| `divisaPrincipal` | string | `pen` (def.) \| `usd` \| `usdt` |
| `tipoCambio` | object | `{ pen_usd, modo, actualizacion }` |
| `paginas` | object | visibilidad por ruta (6 booleanos) |
| `dashboard` | object | `{ cardsVisibles[], orden[], nuevasCardsV1 }` |
| `periodoEvolucion` | string | `30d` por defecto |
| `periodoFlujo` | string | período del flujo de caja |
| `resaltarPatrimonio` | number | `0` \| `1` \| `2` |
| `formatoDivisa` | string | `simbolo` \| `codigo` |
| `movimientosRecientes` | number | 2–5 |
| `seg` | object | `{ inactividadMinutos, cerrarAlCerrarPestana }` |
| `accesibilidad` | object | `{ modalesPersistentes, doodles, unClickSeleccion, lateralidadCuentaInfo, resaltarIngresoGasto }` |
| `tiposMovimiento` | object | 7 interruptores booleanos |

**Discrepancia**: `docs/modelo-datos.md:46-66` solo documenta 5 de estas 13 claves.

#### `cuentas/{autoId}` — `docs/modelo-datos.md:69-88` + `firebase/firestore.rules:99-120`

| Campo | Tipo | Nota |
|---|---|---|
| `nombre` | string | |
| `tipo` | string | `banco` \| `efectivo` \| `broker` \| `exchange` \| `credito` |
| `moneda` | string | divisa (**`docs/modelo-datos.md:75` lo llama `divisa`; el código y las reglas usan `moneda`**) |
| `saldoInicial` | number | saldo vivo |
| `esPatrimonio` | boolean | **no documentado** en `modelo-datos.md` |
| `estado` | string | `activa` \| `archivada` (**no documentado**) |
| `orden` | number | ≥ 0, orden manual (**no documentado**) |
| `fechaCreacion` | Timestamp | |
| `deuda` | number | tarjetas |
| `limite` | number | tarjetas |
| `diaCorte`, `diaPago` | number | tarjetas |
| `desgravamen` | number | porcentaje (**campo en modelo y reglas, pero ninguna función del código lo usa**) |
| `num` | string | número de cuenta/tarjeta (**no documentado**) |
| `cci` | string | (**no documentado**) |
| `vence` | string | MM/AA (**no documentado**) |
| `anualidad`, `anualidadFecha` | number, string `MM-DD` | (**no documentado**) |
| `umbralAviso`, `umbralCritico` | number | (**no documentado**) |
| `avisoUsoEnviado`, `avisoCriticoEnviado` | boolean | control de notificaciones (**no documentado**) |

#### `movimientos/{autoId}` — `docs/modelo-datos.md:90-110` + `firebase/firestore.rules:156-173`

| Campo | Tipo |
|---|---|
| `tipo` | string (11 valores, `constants/tiposMovimiento.js:1-13`) |
| `cuenta`, `cuentaOrigen`, `cuentaDestino`, `tarjeta` | string |
| `concepto` | string |
| `monto`, `montoOrigen`, `montoDestino` | number |
| `cantidad`, `precio`, `comision`, `tasa` | number |
| `activo` | string (símbolo) |
| `divisa` | string |
| `exchange`, `nombreVendedor`, `nombreComprador`, `cuentaPago`, `cuentaCobro` | string (P2P) |
| `fechaRealizacion` | date/Timestamp |
| `fechaRegistro` | Timestamp (server) |
| `metaId` | string (**no documentado**; vínculo con meta, `js/services/MovimientoServicio.js:51`) |
| `operacion` | string (solo tipo `error`, `constants/tiposMovimiento.js:145`; **no está en `hasOnly`** de las reglas → la escritura fallaría si se usa) |

**Discrepancia detectada**: el tipo `error` exige el campo `operacion`
(`constants/tiposMovimiento.js:145`) pero las reglas no lo permiten en `create`
(`firebase/firestore.rules:156-162`).

#### `activos/{autoId}` — `docs/modelo-datos.md:112-122`, `js/models/Activo.js:4-15`

| Campo | Tipo | Default |
|---|---|---|
| `nombre` | string | `""` |
| `simbolo` | string | `""` (normalizado a mayúsculas en `toFirestore`, `js/models/Activo.js:34`) |
| `tipo` | string | `accion` \| `etf` \| `crypto` \| `bono` |
| `ultimoPrecio` | number | `0` |
| `favorito` | boolean | `false` |
| `fuente` | string | `manual` \| `api` \| `broker` (**no documentado** en `modelo-datos.md`, sí en reglas `firebase/firestore.rules:457`) |
| `apiSimbolo` | string | `null` (**no documentado**) |
| `ultimaActualizacion`, `fechaCreacion` | Timestamp | `new Date()` |

#### `activos/{id}/historial/{YYYY-MM-DD}` — `docs/modelo-datos.md:124-129`, `js/repositories/HistorialRepositorio.js:55-58`

| Campo | Tipo |
|---|---|
| `fecha` | string `YYYY-MM-DD` (el ID) |
| `precio` | number |
| `cerrado` | boolean |
| `actualizacion` | Timestamp |

**Retención**: solo se conservan los **7 días más recientes**
(`js/repositories/HistorialRepositorio.js:154-169`).

#### `posiciones/{autoId}` — `docs/modelo-datos.md:131-142`, `js/models/Posicion.js:4-10`

| Campo | Tipo |
|---|---|
| `activoId` | string (FK a `activos/{id}`) |
| `cantidad` | number |
| `divisa` | string (def. `usd`) |
| `precioPromedio` | number (media ponderada **incluida comisión de compra**) |
| `ultimaActualizacion` | Timestamp |

Campos **calculados** (no almacenados): `valorTotal`, `ganancia`,
`rendimientoPorcentual` (`js/models/Posicion.js:48-63`).

#### `pendientes/{autoId}` — `docs/modelo-datos.md:188-202`, `js/models/Pendiente.js:4-12`

| Campo | Tipo | Default |
|---|---|---|
| `concepto` | string | `""` |
| `tipo` | **boolean** | `true` = cobrar, `false` = pagar |
| `monto` | number | `0` |
| `divisa` | string | `pen` |
| `fechaRegistro` | Timestamp | |
| `fechaVencimiento` | Timestamp/null | |
| `fechaConsolidacion` | Timestamp/null | |
| `pendiente` | boolean | `true` |
| `movimientoId` | string/null | vínculo al movimiento generado |

#### `estrategias/{autoId}` — `docs/modelo-datos.md:144-164`, `js/models/Estrategia.js:25-36`

12 campos: `nombre`, `activoSimbolo`, `cuentaId`, `montoFijo`, `divisa`,
`frecuencia` (`diaria|semanal|mensual`), `diaPreferido`, `proximaEjecucion`,
`ultimaEjecucion`, `activa`, `fechaCreacion`, `id`.

#### `metas/{autoId}` — `docs/modelo-datos.md:166-186`, `js/models/Meta.js:20-28`

9 campos: `nombre`, `montoObjetivo`, `montoActual`, `divisa`, `fechaLimite`,
`activa`, `icono`, `fechaCreacion`, `id`.
Calculados: `porcentaje`, `montoRestante`, `completada` (`js/models/Meta.js:74-85`).

#### `trades/{autoId}` — `docs/modelo-datos.md:214-232`, `js/models/Trade.js:4-18`

15 campos: `activo`, `cuenta`, `entrada`, `salida`, `lotaje`, `sl`, `tp`, `tipo`
(`long|short`), `estado` (`abierto|cerrado`), `divisa`, `nota`, `ordenId`,
`fechaRegistro`, `fechaCierre`, `id`.
Calculados: `pnl`, `pnlPorcentaje` (`js/models/Trade.js:76-93`).

#### `ordenes/{autoId}` — `docs/modelo-datos.md:234-267`, `js/models/Orden.js:32-47`

16 campos: `activo`, `cuenta`, `tipoOrden` (`limite|stop`), `direccion`
(`long|short`), `precioDisparo`, `lotaje`, `sl`, `tp`, `divisa`, `nota`, `estado`
(`pendiente|ejecutada|cancelada`), `tradeId`, `precioEjecucion`, `fechaCreacion`,
`fechaEjecucion`, `id`.

#### `snapshots/{YYYY-MM-DD}` — `docs/modelo-datos.md:204-212`

| Campo | Tipo | Nota |
|---|---|---|
| `patrimonioPEN` | number | |
| `patrimonioUSD` | number | |
| `patrimonioUSDT` | number | |
| `cerrado` | boolean | |
| `actualizacion` | Timestamp | |

`docs/modelo-datos.md:210` lo describe como campo "`total…`", lo cual es incorrecto:
los tres campos tienen nombre fijo.

#### `config/{doc}` — `docs/modelo-datos.md:30`, `firebase/firestore.rules:510-515`

Lectura para cualquier autenticado; escritura **prohibida** desde el cliente
(`allow write: if false`).

### 4.4 Relaciones entre colecciones (claves foráneas conceptuales)

Firestore no tiene joins; las relaciones son por ID o símbolo referenciado:

| Origen | Campo | Destino | Evidencia |
|---|---|---|---|
| `posiciones` | `activoId` | `activos/{activoId}` | `js/models/Posicion.js:5`; `js/repositories/PosicionRepositorio.js:78` |
| `activos/{id}/historial` | (subcolección) | `activos/{activoId}` | `docs/modelo-datos.md:21` |
| `trades` | `ordenId` | `ordenes/{ordenId}` | `js/models/Trade.js:16` |
| `ordenes` | `tradeId` | `trades/{tradeId}` | `js/models/Orden.js:44` |
| `pendientes` | `movimientoId` | `movimientos/{id}` | `js/repositories/PendienteRepositorio.js:83-95` |
| `movimientos` | `metaId` | `metas/{metaId}` | `js/services/MovimientoServicio.js:51` |
| `movimientos` | `cuenta`, `cuentaOrigen`, `cuentaDestino`, `tarjeta` | `cuentas/{id}` | `constants/tiposMovimiento.js`; `js/pages/cuentas.js:594-601` |
| `estrategias` | `cuentaId` | `cuentas/{id}` | `js/models/Estrategia.js:28` |
| `estrategias` | `activoSimbolo` | `activos.simbolo` (**por símbolo, no por id**) | `js/models/Estrategia.js:27`; `js/services/EstrategiaServicio.js:87-88` |
| `trades`, `ordenes` | `activo` | símbolo (no id) | `js/models/Trade.js:5`, `js/models/Orden.js:33` |

**Patrón importante**: los `activos` se referencian por **símbolo** (string) en
posiciones de respaldo, estrategias, trades y órdenes, lo que permite que el
importador resuelva el nuevo `activoId` tras una importación
(`js/services/ImportarServicio.js:290-322`).

### 4.5 Índices compuestos

`firebase/firestore.indexes.json:1-20` — **un único índice compuesto declarado**:

| Colección | Campos | Densidad |
|---|---|---|
| `pendientes` (scope `COLLECTION`) | `pendiente` ASC, `fechaRegistro` DESC | `SPARSE_ALL` |

`fieldOverrides`: ninguno.

Consultas que **requieren índice automático de un solo campo** (documentadas en
`docs/modelo-datos.md:163-164`, `185-186`, `266-267`): `estrategias`, `metas`,
`ordenes` ordenados por `fechaCreacion`; `activos` por `nombre`
(`js/repositories/ActivoRepositorio.js:53`); `trades`/`posiciones` sin orden en
Firestore (orden en JS, `js/repositories/TradeRepositorio.js:42-47`).

**Nota**: `docs/roadmap.md:12-14` menciona "el índice ya está desplegado" para
reactivar `orderBy` en pendientes. El límite práctico de 10 000 documentos por
`limit()` está documentado en `js/services/ExportarServicio.js:28-30` (se usa
`DIAS_HISTORIAL = 9999`).

### 4.6 Reglas de seguridad

`firebase/firestore.rules:1-524`, `rules_version = '2'`.

**Funciones auxiliares**:
- `estaAutenticado()` — `firebase/firestore.rules:24-26`
- `esPropietario(uid)` = autenticado y `request.auth.uid == uid` —
  `firebase/firestore.rules:28-30`
- Validadores de tipo: `esNumero`, `esTexto`, `esBool`, `esTimestamp`, `esMapa` y sus
  variantes "o nulo" — `firebase/firestore.rules:36-46`
- Validadores condicionales "si está presente" — `firebase/firestore.rules:71-77`

**Nivel de validación declarado: MEDIA** (`firebase/firestore.rules:11-15`):

| Colección | `create` | `update` | `delete` |
|---|---|---|---|
| `usuarios/{uid}` | `esPropietario` + `hasOnly` + `hasAll` + tipos estrictos (`:86-87`) | `esPropietario` (sin validación: `return true`, `:88-89`, `:61-65`) | `esPropietario` (`:90`) |
| `cuentas` | `hasOnly` 20 campos + `hasAll` 7 + tipos (`:98-120`) | tipos condicionales (`:122-144`) | `esPropietario` (`:146`) |
| `movimientos` | `hasOnly` 22 campos + `hasAll` 2 + tipos (`:155-173`) | tipos condicionales (`:175-198`) | `esPropietario` (`:200`) |
| `posiciones` | `hasOnly` 5 + `hasAll` 3 (`:209-217`) | condicionales (`:219-224`) | `esPropietario` (`:226`) |
| `estrategias` | `hasOnly` 11 + `hasAll` 7 (`:235-252`) | condicionales (`:254-265`) | `esPropietario` (`:267`) |
| `metas` | `hasOnly` 8 + `hasAll` 6 (`:276-290`) | condicionales (`:292-300`) | `esPropietario` (`:302`) |
| `pendientes` | `hasOnly` 9 + `hasAll` 5 (`:311-321`) | condicionales (`:323-332`) | `esPropietario` (`:334`) |
| `snapshots` | `hasOnly` 5 + tipos (`:343-351`) | igual que create | `esPropietario` (`:353`) |
| `trades` | `hasOnly` 14 + `hasAll` 8 (`:362-375`) | condicionales (`:377-391`) | `esPropietario` (`:393`) |
| `ordenes` | `hasOnly` 14 + `hasAll` 9 (`:402-426`) | condicionales (`:428-443`) | `esPropietario` (`:445`) |
| `activos` | `hasOnly` 8 + `hasAll` 2 (`:454-466`) | condicionales (`:468-476`) | `esPropietario` (`:478`) |
| `activos/{id}/historial/{fecha}` | `hasOnly` 4 + `hasAll` 2 (`:486-492`) | condicionales (`:494-498`) | `esPropietario` (`:500`) |
| `config/{doc}` | lectura: autenticado (`:512`); **escritura: siempre denegada** (`:514`) | | |

- **Aislamiento por usuario**: toda lectura/escritura bajo `usuarios/{uid}` exige
  `esPropietario(uid)`.
- **Denegación por defecto** documentada (`firebase/firestore.rules:517-522`).
- **Debilidades detectadas** (hallazgos, no invenciones):
  - `usuarios/{uid}` en `update` **no valida nada** (`firebase/firestore.rules:61-65`),
    justificado por compatibilidad con documentos *legacy*.
  - No se valida que `orden >= 0` se mantenga en `update` (solo en `create`,
    `firebase/firestore.rules:113`).
  - No hay validación de rangos de negocio (montos > 0, `diaCorte` 1-31,
    `desgravamen` 0-100).

---

## 5. Módulos y funcionalidades

### 5.1 Dashboard (`js/pages/dashboard.js`)

**Funcionalidades**:
- Resumen de patrimonio en la divisa elegida con desglose de activos y deuda.
- Selector de divisa (PEN/USD/USDT).
- Gráfico de evolución patrimonial (Chart.js) con 5 periodos: 7D/30D/90D/1A/Todo
  (`js/pages/dashboard.js:927-936`).
- Flujo de caja con selector de periodo 7D/30D/90D.
- **Catálogo de 20 cards** (`js/pages/dashboard.js:64-85`): `patrimonio`, `cuentas`,
  `inversiones`, `vencimientos`, `movimientos`, `favoritos`, `metas`, `pendientes`,
  `ordenes`, `estrategias`, `flujo-caja`, `gastos-periodo`, `ingresos-periodo`,
  `balance-periodo`, `deudas`, `ahorro`, `distribucion`, `programados`, `alertas`,
  `grafico`.
- **Cards instanciadas**: una por cuenta y una por activo con posición abierta
  (`js/pages/dashboard.js:249-510`), con ID compuesto `cuenta:{id}` / `activo:{id}`.
- **Masonry propio en JavaScript** con columnas por altura mínima
  (`js/pages/dashboard.js:544-601`), recalculado en `resize` con debounce de 120 ms.
- **Editor de cards**: selector de visibilidad, **drag & drop HTML5**
  (`js/pages/dashboard.js:655-701`), botones subir/bajar, guardar/descartar, aviso de
  cambios sin guardar (`js/pages/dashboard.js:771-796`).
- Vencimientos consolidados (pendientes + tarjetas + anualidades + metas).
- Skeletons de carga (`js/ui/skeletons.js`).
- Refresco total: `recargarDatos()` (`js/pages/dashboard.js:1254-1270`).

**Servicios usados**: `SnapshotServicio` (registro y cálculo de patrimonio),
`DivisaServicio`, `PosicionServicio`, `CreditoServicio` (ciclo, umbral de uso,
anualidad), `EstrategiaServicio` (próxima ejecución).

**Repositorios usados**: `MetaRepositorio`, `PendienteRepositorio`,
`OrdenRepositorio`, `EstrategiaRepositorio` (`js/pages/dashboard.js:25-27`, `34`).

**Acceso a datos**: `obtenerCuentas`, `obtenerMovimientos`, `obtenerPreferencias`,
`actualizarPreferencias` desde `firebase/firestore.js` (`js/pages/dashboard.js:4`).

**Modales que abre**: selector de cards, detalle de patrimonio, evolución
patrimonial (variante `wide`), programados, alertas, vencimientos. Indirectamente:
alta de meta, aporte a meta, detalle de pendiente, pago de tarjeta, detalle de
movimiento.

**Acciones de lastbar que consume** (`js/core/lastbar.js:97-129`): `mov`,
`actualizar`, `extracto`, `tema`, `editar-dashboard`, `cerrar-sesion`,
`pendientes`, `metas`.

**Persistencia del layout**: en Firestore `preferencias.dashboard.{cardsVisibles,
orden, nuevasCardsV1}` (`js/pages/dashboard.js:196-208`) con espejo en
`sessionStorage`. **Ya no usa `localStorage["escinco_dashboard_cards"]`** — la
auditoría (`docs/auditoria-dashboard.md:175-191`) describe el estado anterior.

**Eventos**: emite ninguno; escucha `pagina-cambiando` (`js/pages/dashboard.js:718`),
`metas-actualizadas` (`js/pages/dashboard.js:2639`), y un listener a
`movimientos-actualizadas` (`js/pages/dashboard.js:1234`) que **está muerto**: no
existe ningún `dispatchEvent` con ese nombre en el repositorio.

### 5.2 Movimientos (`js/pages/movimientos.js`)

**Funcionalidades**:
- 9 filtros laterales: Todos, Ingresos, Gastos, Transferencias, Cambio divisa,
  Inversiones, P2P, Tarjetas, Errores (`js/pages/movimientos.js:37-47`), filtrados
  por páginas habilitadas (`js/pages/movimientos.js:51-54`).
- Filtros: rango de fechas (desde/hasta), cuenta, divisa, búsqueda de texto
  (`js/pages/movimientos.js:604-683`).
- Totales +/- por divisa del conjunto filtrado (`js/pages/movimientos.js:689-731`).
- Detalle de movimiento con edición y eliminación integradas
  (`js/pages/movimientos.js:1095-1199`).
- Selección múltiple con clic, Shift+click, clic sostenido (500 ms táctil / 700 ms
  ratón) y doble clic (`js/pages/movimientos.js:409-487`).
- Swipe horizontal para revelar acciones (`js/pages/movimientos.js:517-602`).
- Eliminación múltiple con deshacer (`js/pages/movimientos.js:1281-1316`).
- Exportación de extracto CSV con escape de comas y comillas
  (`js/pages/movimientos.js:1322-1378`).
- Selector de tipo de movimiento en dos grupos (destacados/secundarios)
  (`js/pages/movimientos.js:822-892`).

**Servicios**: `MovimientoServicio` (registrar, actualizar, eliminar, restaurar),
`DeshacerServicio`, `DivisaServicio`.

**Repositorios**: ninguno; accede a Firestore vía `firebase/firestore.js`
(`js/pages/movimientos.js:1`).

**Modales**: selector de tipo, selector de dirección de trade, formulario de alta,
detalle, eliminar, eliminar varios.

**Acciones de lastbar** (`js/core/lastbar.js:160-199`): `mov`,
`editar-movimiento`, `eliminar-movimiento`, `extracto`, `pendientes`, `metas`.

**Código muerto**: `esMovimientoDeMeta` definida y nunca llamada
(`js/pages/movimientos.js:1382-1385`).

### 5.3 Cuentas (`js/pages/cuentas.js`)

**Funcionalidades**:
- Sidebar de cuentas con selección única y **reordenamiento por drag & drop**
  (`js/pages/cuentas.js:175`, `193-217`).
- Detalle de cuenta normal: saldo, tipo, moneda, estado, número, vencimiento, CCI,
  con botones de copiar al portapapeles (`js/pages/cuentas.js:319-357`).
- Detalle de tarjeta de crédito: crédito disponible, deuda, consumo del ciclo,
  % de uso con barra de progreso, corte, pago, desgravamen, anualidad
  (`js/pages/cuentas.js:363-450`).
- Últimos **20** movimientos que involucran la cuenta
  (`js/pages/cuentas.js:470-520`, corte en `:500`).
- Totales por divisa con acciones: registrar gasto, pagar tarjeta, nuevo movimiento
  (`js/pages/cuentas.js:523-590`).
- CRUD de cuentas con flujo de 2 pasos (tipo → formulario)
  (`js/pages/cuentas.js:1335-1666`), edición, archivar/desarchivar, eliminar.
- Notificación de cruces de umbral de crédito
  (`js/services/CreditoServicio.js:217-255`).
- Preferencia de lateralidad del panel de info (`js/pages/cuentas.js:286-288`).

**Servicios**: `MovimientoServicio`, `CreditoServicio`, `DeshacerServicio`.
**Repositorios**: ninguno (acceso directo a `firebase/firestore.js`,
`js/pages/cuentas.js:4-13`).

**Modales**: crear cuenta (2 pasos), editar cuenta, archivar, desarchivar,
"forzar archivo", eliminar, eliminar movimiento, pagar tarjeta.

**Acciones de lastbar** (`js/core/lastbar.js:130-159`): `cuenta`, `editar-cuenta`,
`archivar-cuenta`, `pendientes`, `metas`.

**Nota**: no existe sistema de filtros en esta página; el "filtrado" es selección
de cuenta más recorte top-20.

**Código muerto**: `_abrirModalCrearCuentaLegacy` definida y nunca invocada
(`js/pages/cuentas.js:1668-1823`).

### 5.4 Inversiones (`js/pages/inversiones.js`)

**Funcionalidades**:
- Vista conmutable **Posiciones ↔ Estrategias** (`js/pages/inversiones.js:719-732`).
- Filtros por tipo de activo: todas, acción, ETF, crypto
  (`js/pages/inversiones.js:68-71`, `1311-1349`).
- Resumen: valor total, rendimiento, número de posiciones
  (`js/pages/inversiones.js:1284-1305`).
- Posiciones con precio actual, cantidad, precio promedio, resultado, fuente de
  precio y fecha de actualización (`js/pages/inversiones.js:229-292`).
- **Favoritos optimistas** con debounce de 400 ms, cola de escrituras y rollback en
  error (`js/pages/inversiones.js:611-695`).
- Gráfico de evolución de precio de un activo (Chart.js, 7 días)
  (`js/pages/inversiones.js:1120-1179`).
- Actualización de precio manual y automática
  (`js/pages/inversiones.js:1185-1232`).
- **CRUD completo de estrategias DCA** con preview de próxima ejecución
  (`js/pages/inversiones.js:895-1064`), ejecutar/pausar/eliminar
  (`js/pages/inversiones.js:830-889`).
- Modales de compra y venta de activos (crean el activo si no existe)
  (`js/pages/inversiones.js:1400-1639`).
- Selección múltiple, clic sostenido, swipe.

**Servicios**: `PosicionServicio`, `EstrategiaServicio` (calcular próxima ejecución,
ejecutar), `PrecioServicio` (manual/automático, historial para gráfico),
`DeshacerServicio`, `DivisaServicio`, `MovimientoServicio` (dinámico).

**Repositorios**: `ActivoRepositorio`, `PosicionRepositorio`,
`EstrategiaRepositorio` (`js/pages/inversiones.js:4-16`).

**Acciones de lastbar** (`js/core/lastbar.js:200-243`): `comprar`, `vender`,
`actualizar`, `nueva-estrategia`, `exportar`, `pendientes`, `metas`.

**Código muerto**: `abrirModalBroker()` (stub "en desarrollo",
`js/pages/inversiones.js:1645-1651`) e import de `actualizarPrecioActivo` sin uso
(`js/pages/inversiones.js:7`).

### 5.5 Trading (`js/pages/trading.js`)

**Funcionalidades**:
- Vista conmutable **Trades ↔ Órdenes** (`js/pages/trading.js:414-427`).
- Filtros: Todas, Long, Short, Abiertos, Cerrados (`js/pages/trading.js:45-49`,
  `437-452`).
- Resumen contextual: P&L total, abiertos, cerrados / pendientes, ejecutadas,
  canceladas (`js/pages/trading.js:350-390`).
- Trades: crear long/short, cerrar (con precio de salida), reabrir, editar, eliminar
  con deshacer (`js/pages/trading.js:789-1106`).
- **Órdenes límite/stop**: crear, editar, cancelar, eliminar, ver detalle
  (`js/pages/trading.js:1112-1461`).
- **Evaluación automática de órdenes al entrar** a la página
  (`js/pages/trading.js:124-135`).
- P&L flotante de trades abiertos contra el último precio conocido
  (`js/services/TradingServicio.js:61-101`).
- Selección múltiple, clic sostenido, swipe, doble clic.

**Servicios**: `TradingServicio`, `OrdenServicio`, `DeshacerServicio`,
`DivisaServicio`.
**Repositorios**: ninguno (los servicios los usan internamente).
**Modales**: 9 (nuevo trade, cerrar, reabrir, editar, eliminar, nueva orden, detalle
orden, editar orden, eliminar orden).

**Acciones de lastbar** (`js/core/lastbar.js:244-287`): `largo`, `corto`,
`actualizar`, `nueva-orden`, `exportar`, `pendientes`, `metas`.

**Bug documentado**: la acción `actualizar` de la lastbar de trading **no está
implementada** en el `switch` de `js/core/lastbar.js:401-420` (solo maneja
`dashboard` e `inversiones`); cae en el `default` con `console.warn`. La función
`recargarTrading` existe y se exporta (`js/pages/trading.js:141`) pero nadie la
invoca.

**Código muerto**: `abrirModalBroker()` (`js/pages/trading.js:777-783`).

### 5.6 Configuración (`js/ui/configuracion.js`)

**Ya no es una página**: es un modal variante `xl` que se abre sobre cualquier ruta
(`js/core/router.js:13-20`, `js/ui/configuracion.js:486`). `/configuracion` se
conserva como enlace profundo.

**Secciones** (`js/ui/configuracion.js:45-52`):

| # | Sección | Contenido |
|---|---|---|
| 1 | **Cuenta** | Nombre editable, correo (solo lectura), contraseña (configurar/cambiar), cerrar sesión, eliminar cuenta (zona de peligro) |
| 2 | **Apariencia** | Tema (3 modos), resaltar patrimonio (0/1/2), páginas visibles (4 switches), últimos movimientos (2-5), tipos de movimiento en el selector (7 switches) |
| 3 | **Moneda** | Divisa principal, formato (símbolo/código), periodo de evolución, tipo de cambio manual/automático, valor del TC, botón "Actualizar ahora" |
| 4 | **Seguridad** | Cierre por inactividad (5/15/30/60/nunca), cerrar sesión al cerrar pestaña, nota informativa sobre operaciones sensibles |
| 5 | **Accesibilidad** | Modales persistentes, doodles, un click para seleccionar, lateralidad del panel, lastbar auto-hide, resaltar ingreso/gasto |
| 6 | **Datos** | Exportar `.dvid`, Importar `.dvid` (con previsualización de 7 conteos), **Eliminar todos los datos** (doble confirmación + escritura de la palabra `ELIMINAR` + respaldo automático previo) |

- **Persistencia**: `actualizarPreferencias` con notación de punto
  (`js/ui/configuracion.js:1331-1341`); `guardarDivisaPrincipal` y
  `guardarTipoCambio` de `DivisaServicio` (`js/ui/configuracion.js:1323-1329`) para
  no pisar campos con `undefined`; `localStorage` para tema y modo lastbar
  (`js/ui/configuracion.js:1353-1354`); `sesion.setPreferencias` para el espejo en
  `sessionStorage` (`js/ui/configuracion.js:1342`).
- **Detección de cambios**: 19 listeners `change` más `hayCambiosEnVivo()` que
  compara cada control contra la sesión (`js/ui/configuracion.js:945-1040`).
- **Patrón de "cambios sin guardar"**: `onCancel` construye las preferencias antes de
  que el DOM desaparezca y ofrece Guardar/Descartar en notificación persistente
  (`js/ui/configuracion.js:495-514`).
- **Reautenticación**: `conReautenticacion(alContinuar)`
  (`js/ui/configuracion.js:1842-1853`) protege eliminar datos, eliminar cuenta y
  cambiar contraseña.
- **Acción de lastbar que expone**: `cerrar-sesion` (`abrirModalLogout`,
  `js/ui/configuracion.js:1436-1455`).

### 5.7 Módulos transversales

| Módulo | Responsabilidad | Cita |
|---|---|---|
| `js/ui/pendientes.js` | Lista de pendientes en modal, consolidación individual y en lote | `js/ui/pendientes.js` (778 líneas) |
| `js/ui/metas.js` | Lista de metas, CRUD, aporte con proyección en vivo, borrado en lote | `js/ui/metas.js:132-761` |
| `js/ui/modal.js` | Sistema de modales: pila, focus trap, drag, 6 variantes | `js/ui/modal.js:38-464` |
| `js/ui/graficos.js` | Envoltura de Chart.js | `js/ui/graficos.js` |
| `js/ui/notificaciones.js` | Notificaciones DOM | `js/ui/notificaciones.js` |
| `js/ui/exportar.js` | Orquestación de exportación | `js/ui/exportar.js` |
| `js/ui/formularioMovimiento.js` | Generación y lectura del formulario de movimiento por tipo | `js/ui/formularioMovimiento.js` |
| `js/ui/skeletons.js` | Esqueletos de carga accesibles | `js/ui/skeletons.js:3`, `52`, `68` |
| `js/ui/colapsoSidebar.js` | Sidebar colapsable a riel de íconos | `js/ui/colapsoSidebar.js:32-58` |
| `js/ui/doodles.js` | Animación secreta de 5 dedos | `js/ui/doodles.js` |
| `js/ui/scrollEdges.js` | Desvanecido de bordes de scroll | `js/ui/scrollEdges.js` |
| `js/ui/seleccion.js` | Selección por rango (Shift+click) | `js/ui/seleccion.js:14` |
| `js/core/fechas.js` | Fechas locales sin desfase UTC | `js/core/fechas.js:5-9`, `18-24` |
| `js/core/iconos.js` | 49 iconos SVG inline | `js/core/iconos.js:8-58` |
| `js/core/tema.js` | Temas con persistencia dual | `js/core/tema.js:43-168` |
| `js/core/pwa.js` | Registro del SW y aviso de actualización | `js/core/pwa.js:13-124` |

---

## 6. Seguridad implementada

### 6.1 Autenticación

| Aspecto | Implementación | Cita |
|---|---|---|
| **Email + contraseña** | `createUserWithEmailAndPassword` / `signInWithEmailAndPassword` | `firebase/auth.js:41-52`, `firebase/auth.js:108-110` |
| **Google** | `signInWithPopup` + `GoogleAuthProvider` con `prompt: select_account` | `firebase/auth.js:60-81` |
| **Mismo flujo para registro y login con Google** | `loginConGoogle()` delega en `registrarConGoogle()` | `firebase/auth.js:79-81` |
| **Detección de cuenta "solo-Google"** | Ante `user-not-found` / `wrong-password` / `invalid-credential` se consulta `fetchSignInMethodsForEmail` y se informa al usuario | `js/pages/index.js:89-119` |
| **Vincular contraseña a cuenta Google** | `linkWithCredential` con `EmailAuthProvider` | `firebase/auth.js:283-292` |
| **Cambio de contraseña** | Exige reautenticación con la contraseña actual | `firebase/auth.js:301-314` |
| **Cambio de nombre** | `updateProfile` + `updateDoc`, con validaciones (no vacío, ≤ 60 caracteres) | `firebase/auth.js:88-102` |
| **Persistencia de sesión** | `browserSessionPersistence` (sessionStorage) o `browserLocalPersistence` (localStorage), según preferencia del usuario | `firebase/auth.js:212-219` |
| **Observación de estado** | `onAuthStateChanged` | `firebase/auth.js:158-160` |
| **Cierre de sesión** | Limpia caché de datos, sesión local y marca de reautenticación antes de `signOut` | `firebase/auth.js:141-152` |
| **Protección de rutas** | Sin usuario autenticado, `window.location.replace("/login")` | `js/core/app.js:36-40` |
| **Mapeo de errores a español** | 8 códigos de Firebase traducidos | `js/pages/index.js:121-143` |

### 6.2 Reautenticación para operaciones sensibles

- **Vigencia**: 5 minutos (`REAUTH_VIGENCIA_MINUTOS = 5`, `firebase/auth.js:30`).
- **Marcador**: `sessionStorage["escinco_reauth_time"]` (`firebase/auth.js:31`,
  `firebase/auth.js:227-233`).
- **Cálculo**: máximo entre `user.metadata.lastSignInTime` y la marca de reauth
  (`firebase/auth.js:235-249`).
- **Funciones**:
  - `esSesionReciente(minutos = 5)` — `firebase/auth.js:251-255`
  - `reautenticarConPassword(password)` — `firebase/auth.js:360-369`
  - `reautenticarConGoogle()` (popup, debe invocarse desde un gesto de usuario) —
    `firebase/auth.js:376-386`
- **Orquestador en UI**: `conReautenticacion(alContinuar)` decide entre modal de
  contraseña o popup de Google según `tienePassword()`
  (`js/ui/configuracion.js:1842-1853`).
- **Operaciones protegidas**:
  - Eliminar todos los datos — `js/ui/configuracion.js:1691`
  - Eliminar cuenta — `js/ui/configuracion.js:1832`
  - Cambiar contraseña — `js/ui/configuracion.js:644`

### 6.3 Reglas de Firestore

Ver detalle completo en la **sección 4.6**. Resumen: aislamiento total por `uid`,
`hasOnly` + `hasAll` + tipos estrictos en `create`, validación condicional en
`update`, `config/*` con escritura denegada.

### 6.4 Validación de datos en cliente

**Tres capas de validación detectadas:**

1. **Modelos** (`js/models/*.js`): método `validar()` en los 7 modelos
   (`js/models/Activo.js:18-29`, `js/models/Posicion.js:13-24`,
   `js/models/Estrategia.js:39-59`, `js/models/Meta.js:31-45`,
   `js/models/Pendiente.js:15-26`, `js/models/Trade.js:21-35`,
   `js/models/Orden.js:50-70`).
2. **Servicios**: validación de campos obligatorios por tipo contra
   `CONFIG_MOVIMIENTOS[tipo]` (`js/services/MovimientoServicio.js:42-54`); reglas de
   negocio de tarjeta (`js/services/MovimientoServicio.js:335-369`); un pago no puede
   exceder la deuda; una tarjeta de crédito no puede ser origen de un pago de
   tarjeta (`js/services/MovimientoServicio.js:342`); los aportes a meta exigen
   cuenta de la misma divisa (`js/services/MetaServicio.js:37-43`).
3. **UI**: validaciones manuales en cada `onConfirm` de modal, más restricciones
   HTML nativas (`type="number"`, `min`, `step`, `maxlength`, `required`).

**Normalización de entradas**:
- `trim()` y `toUpperCase()` en símbolos (`js/models/Activo.js:34`,
  `js/models/Estrategia.js:27`).
- Fechas futuras recortadas a hoy (`js/services/MovimientoServicio.js:19-25`).
- Monto de pago a tarjeta truncado a la deuda con notificación
  (`js/services/MovimientoServicio.js:360-366`).
- Nota de trade truncada a 1500 caracteres (`js/repositories/TradeRepositorio.js:105`).

**Debilidades detectadas** (hallazgos, no invenciones):
- El campo `campo-vence` (MM/AA) se declara `type="text"` y **no se valida**.
- No hay validación de duplicados de nombre de cuenta.
- No se valida `diaCorte < diaPago` ni coherencia entre umbrales.
- `exportarExtractoCSV` escapa comas y comillas pero **no** protege contra
  inyección de fórmulas (`=`, `+`, `-`, `@`) en Excel
  (`js/pages/movimientos.js:1372-1378`).

### 6.5 Gestión de sesión

- **Almacenamiento**: `sessionStorage` para usuario y preferencias
  (`js/core/sesion.js:50`, `135`); `localStorage` para tema, modo lastbar y colapso
  del sidebar.
- **Cierre por inactividad**:
  - Eventos de actividad: `click`, `mousemove`, `keydown`, `scroll`, `touchstart`
    (`firebase/auth.js:32`).
  - Tiempo configurable: 5/15/30/60 min o "nunca" (0 no programa temporizador)
    (`firebase/auth.js:169-190`).
  - Por defecto 15 min (`js/core/sesion.js:15`).
  - Al expirar: `logout()` más `window.location.replace("/login")`
    (`firebase/auth.js:186-189`).
- **Limpieza**: `sesion.limpiar()` borra usuario, caché y ambas claves de
  `sessionStorage` (`js/core/sesion.js:204-247`).
- **Al eliminar cuenta**: también se limpian 3 claves de `localStorage`
  (`js/services/EliminarServicio.js:150-152`).

### 6.6 Sanitización de inputs — **HALLAZGO CRÍTICO**

**No existe ninguna función de escape o sanitización de HTML en todo el
repositorio.** Verificado buscando `escapeHtml`, `DOMPurify`, `sanitiz`,
`encodeHTML` sobre `js/**` y `*.html`: 0 coincidencias.

El HTML dinámico se genera con **template literals e `innerHTML` interpolando datos
de Firestore sin escapar**. Ejemplos representativos:

| Ubicación | Dato interpolado sin escapar |
|---|---|
| `js/pages/cuentas.js:327` | `c.nombre` (nombre de cuenta) |
| `js/pages/cuentas.js:352-354` | `c.num`, `c.cci` (en texto y en atributos `data-copiar`) |
| `js/pages/cuentas.js:616` | `m.concepto` o `m.activo` |
| `js/pages/cuentas.js:1843` | `cuenta.nombre` dentro de `value="..."` |
| `js/pages/movimientos.js:170-173` | `c.id`, `c.nombre` dentro de `<option value="...">` |
| `js/pages/movimientos.js:247` | `m.concepto`, `m.activo` |
| `js/pages/trading.js:236`, `317` | `t.activo`, `o.activo` |
| `js/pages/dashboard.js:1884`, `1936-1937`, `2148`, `2328-2330`, `2611-2612`, `2671` | conceptos, nombres de estrategia/cuenta/activo, nombre del usuario |
| `js/ui/metas.js:82`, `106` | `c.nombre`/`c.id` en `<option>`, `meta.nombre` |
| `js/pages/inversiones.js:1478` | `c.nombre` en `<option>` |

Existe un **escape parcial e inconsistente solo en `trading.js`** (solo `<` a
`&lt;`, sin escapar `&`, `"` ni `>`): `js/pages/trading.js:981`, `1014`, `1267`,
`1323`, `1363`.

**Mitigación contextual**: el riesgo real es **XSS almacenado de autoataque** (un
usuario escribe HTML en su propia cuenta y se lo ejecuta a sí mismo), porque las
reglas de Firestore aíslan completamente al usuario
(`firebase/firestore.rules:28-30`) y no hay compartición de datos entre usuarios ni
campo de texto libre compartido. **No se ha identificado un vector de XSS entre
usuarios.** Aun así, es un defecto de seguridad que debe reportarse.

**Otros puntos**:
- `insertAdjacentHTML` con icono derivado de un mapa cerrado:
  `js/pages/cuentas.js:182` (seguro).
- `outerHTML` con valor de un mapa cerrado: `js/core/lastbar.js:47` (seguro).
- **No hay `eval`, `Function()`, `document.write` ni `setTimeout` con string** en
  el proyecto (verificado).
- **Sin token CSRF**: irrelevante, ya que la autenticación es por SDK y las
  operaciones son cliente-Firestore mediadas por reglas.

---

## 7. Requerimientos funcionales

Extraídos de `js/pages/*.js`, `js/services/*.js` y `docs/requisitos.md:28-114`.

### 7.1 Módulo de autenticación

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-AUT-01 | Registrarse con email, nombre y contraseña | `firebase/auth.js:41-52` |
| RF-AUT-02 | Registrarse / iniciar sesión con Google | `firebase/auth.js:60-81` |
| RF-AUT-03 | Iniciar sesión con email y contraseña | `firebase/auth.js:108-110` |
| RF-AUT-04 | Detectar e informar cuentas que solo usan Google | `js/pages/index.js:89-119` |
| RF-AUT-05 | Vincular contraseña a una cuenta existente de Google | `firebase/auth.js:283-292` |
| RF-AUT-06 | Cambiar el nombre de usuario | `firebase/auth.js:88-102` |
| RF-AUT-07 | Cambiar la contraseña (con reautenticación) | `firebase/auth.js:301-314` |
| RF-AUT-08 | Cerrar sesión | `firebase/auth.js:141-152` |
| RF-AUT-09 | Crear automáticamente el documento de usuario en Firestore | `firebase/auth.js:118-135` |
| RF-AUT-10 | Crear automáticamente una cuenta de efectivo inicial | `firebase/firestore.js:40-83` |
| RF-AUT-11 | Eliminar definitivamente la cuenta de Firebase Auth | `firebase/auth.js:393-398` |

### 7.2 Módulo de dashboard

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-DAS-01 | Mostrar el patrimonio total en la divisa seleccionada | `js/services/SnapshotServicio.js:17-68` |
| RF-DAS-02 | Seleccionar la divisa de visualización (PEN/USD/USDT) | `js/pages/dashboard.js:2705-2735` |
| RF-DAS-03 | Mostrar el detalle de activos y deuda | `js/pages/dashboard.js:1763-1780` |
| RF-DAS-04 | Graficar la evolución patrimonial con 5 periodos | `js/pages/dashboard.js:927-936` |
| RF-DAS-05 | Seleccionar y reordenar las cards del dashboard (drag & drop y botones) | `js/pages/dashboard.js:655-701` |
| RF-DAS-06 | Añadir cards instanciadas por cuenta y por activo | `js/pages/dashboard.js:249-510` |
| RF-DAS-07 | Podar automáticamente cards de cuentas/activos inexistentes | `js/pages/dashboard.js:230-244` |
| RF-DAS-08 | Persistir visibilidad y orden de cards en Firestore | `js/pages/dashboard.js:196-208` |
| RF-DAS-09 | Migrar automáticamente cards nuevas (flag `nuevasCardsV1`) | `js/pages/dashboard.js:162-184` |
| RF-DAS-10 | Mostrar el flujo de caja del periodo (gastado/ingresado/balance) | `js/pages/dashboard.js:1980-2043` |
| RF-DAS-11 | Mostrar los últimos movimientos (2-5 configurables) | `js/pages/dashboard.js:2108-2136` |
| RF-DAS-12 | Mostrar próximos vencimientos consolidados | `js/pages/dashboard.js:1813-1862` |
| RF-DAS-13 | Consolidar un pendiente desde el modal de vencimientos | `js/pages/dashboard.js:2471-2556` |
| RF-DAS-14 | Mostrar metas de ahorro con barra de progreso, crear y aportar | `js/pages/dashboard.js:2646-2692` |
| RF-DAS-15 | Mostrar activos favoritos y su precio | `js/pages/dashboard.js:2570-2602` |
| RF-DAS-16 | Mostrar órdenes, estrategias, movimientos programados y alertas | `js/pages/dashboard.js:1893-1978`, `2046-2106` |
| RF-DAS-17 | Mostrar la distribución patrimonial en barras | `js/pages/dashboard.js:2026-2044` |
| RF-DAS-18 | Registrar snapshot del patrimonio al abrir el dashboard | `js/pages/dashboard.js:2810` |
| RF-DAS-19 | Recargar todos los datos | `js/pages/dashboard.js:1254-1270` |
| RF-DAS-20 | Layout masonry responsive (1/2/3/4 columnas) | `js/pages/dashboard.js:537-601` |

### 7.3 Módulo de cuentas

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-CUE-01 | Crear cuentas de tipo banco, efectivo, broker, exchange, credito | `js/pages/cuentas.js:1335-1666` |
| RF-CUE-02 | Editar cuentas | `js/pages/cuentas.js:1829-1992` |
| RF-CUE-03 | Archivar / desarchivar cuentas (con bloqueo si hay saldo) | `js/pages/cuentas.js:1073-1158` |
| RF-CUE-04 | Eliminar cuentas (bloqueada con saldo, con deshacer) | `js/pages/cuentas.js:1180-1227` |
| RF-CUE-05 | Reordenar cuentas por drag & drop | `js/pages/cuentas.js:193-217` |
| RF-CUE-06 | Copiar número de cuenta/tarjeta y CCI al portapapeles | `js/pages/cuentas.js:307-312` |
| RF-CUE-07 | Ver los 20 últimos movimientos de una cuenta | `js/pages/cuentas.js:470-520` |
| RF-CUE-08 | Ver totales por divisa de una cuenta | `js/pages/cuentas.js:523-570` |
| RF-CUE-09 | Registrar un gasto con tarjeta de crédito | `js/pages/cuentas.js:574-581` |
| RF-CUE-10 | Pagar una tarjeta de crédito | `js/pages/cuentas.js:453-464` |
| RF-CUE-11 | Ver el ciclo de facturación (corte, pago, consumo, % de uso) | `js/services/CreditoServicio.js:96-183` |
| RF-CUE-12 | Configurar umbral de aviso y umbral crítico de uso | `js/services/CreditoServicio.js:22-29` |
| RF-CUE-13 | Configurar anualidad y fecha de renovación | `js/services/CreditoServicio.js:191-208` |
| RF-CUE-14 | Notificar al cruzar umbrales de uso (una sola vez) | `js/services/CreditoServicio.js:217-255` |
| RF-CUE-15 | Elegir la lateralidad del panel de información | `js/pages/cuentas.js:286-288` |

### 7.4 Módulo de movimientos (11 tipos)

Tipos (`constants/tiposMovimiento.js:1-13`): `ingreso`, `gasto`, `transferencia`,
`cambioDivisa`, `compraActivo`, `ventaActivo`, `p2pCompra`, `p2pVenta`,
`compraTarjeta`, `pagoTarjeta`, `error`.

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-MOV-01 | Registrar movimientos de los 11 tipos con validación de campos obligatorios por tipo | `js/services/MovimientoServicio.js:42-54`; `constants/tiposMovimiento.js:16-149` |
| RF-MOV-02 | Actualizar saldos automáticamente según el tipo | `js/services/MovimientoServicio.js:384-461` |
| RF-MOV-03 | Aplicar comisión en compras (suma) y ventas (resta) | `js/services/MovimientoServicio.js:413`, `422`, `428`, `436` |
| RF-MOV-04 | Editar un movimiento con reversión y reaplicación de efectos | `js/services/MovimientoServicio.js:140-199` |
| RF-MOV-05 | Eliminar un movimiento revirtiendo saldos, posiciones y aportes a metas | `js/services/MovimientoServicio.js:206-215`, `467-529` |
| RF-MOV-06 | Deshacer la eliminación restaurando el documento con su ID original | `js/services/MovimientoServicio.js:223-241` |
| RF-MOV-07 | Filtrar por tipo, cuenta, divisa, rango de fechas y texto libre | `js/pages/movimientos.js:604-683` |
| RF-MOV-08 | Ver totales de ingresos y gastos por divisa | `js/pages/movimientos.js:689-731` |
| RF-MOV-09 | Seleccionar varios movimientos y eliminarlos en lote | `js/pages/movimientos.js:1281-1316` |
| RF-MOV-10 | Exportar extracto CSV | `js/pages/movimientos.js:1322-1370` |
| RF-MOV-11 | Mostrar el detalle completo y editarlo desde el detalle | `js/pages/movimientos.js:1095-1199` |

### 7.5 Módulo de pendientes

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-PEN-01 | Registrar pendientes de cobro y de pago con monto, divisa y vencimiento | `js/models/Pendiente.js:4-12`; `js/repositories/PendienteRepositorio.js:22-31` |
| RF-PEN-02 | Consolidar un pendiente en un movimiento (compatibilidad por tipo) | `js/services/PendienteServicio.js:21-52` |
| RF-PEN-03 | Consolidar varios pendientes en un único movimiento | `js/services/PendienteServicio.js:59-101` |
| RF-PEN-04 | Archivar automáticamente el pendiente consolidado | `js/repositories/PendienteRepositorio.js:83-95` |
| RF-PEN-05 | Editar y eliminar pendientes | `js/repositories/PendienteRepositorio.js:69-81` |
| RF-PEN-06 | Notificar vencimientos | `js/pages/dashboard.js:1813-1862` |

### 7.6 Módulo de inversiones

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-INV-01 | Registrar compras de activos (creando el activo si no existe) | `js/pages/inversiones.js:1400-1520` |
| RF-INV-02 | Registrar ventas validando unidades disponibles | `js/pages/inversiones.js:1526-1639` |
| RF-INV-03 | Calcular el precio promedio ponderado de la posición (incluida comisión) | `js/repositories/PosicionRepositorio.js:119-167` |
| RF-INV-04 | Valorar la posición contra `ultimoPrecio` | `js/models/Posicion.js:48-51` |
| RF-INV-05 | Calcular rendimiento absoluto y porcentual | `js/models/Posicion.js:54-63` |
| RF-INV-06 | Marcar activos como favoritos | `js/pages/inversiones.js:611-695` |
| RF-INV-07 | Actualizar el precio de un activo manualmente | `js/services/PrecioServicio.js:37-44` |
| RF-INV-08 | Actualizar el precio automáticamente desde una API externa | `js/services/PrecioServicio.js:50-69`; `js/strategies/PrecioAutomaticoStrategy.js` |
| RF-INV-09 | Graficar la evolución del precio de un activo | `js/pages/inversiones.js:1120-1179` |
| RF-INV-10 | Filtrar posiciones por tipo de activo | `js/pages/inversiones.js:1311-1349` |
| RF-INV-11 | Eliminar una posición con deshacer | `js/pages/inversiones.js:1238-1278` |
| RF-INV-12 | Guardar historial diario de precios (7 días de retención) | `js/repositories/HistorialRepositorio.js:40-169` |

### 7.7 Módulo de estrategias DCA

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-EST-01 | Crear estrategias de compra programada por activo | `js/pages/inversiones.js:895-1064` |
| RF-EST-02 | Configurar monto fijo, divisa, cuenta y frecuencia (diaria/semanal/mensual) | `js/models/Estrategia.js:25-36` |
| RF-EST-03 | Configurar el día preferido de ejecución | `js/models/Estrategia.js:32` |
| RF-EST-04 | Calcular la próxima fecha de ejecución (con clamp de fin de mes) | `js/services/EstrategiaServicio.js:25-61` |
| RF-EST-05 | Ejecutar la estrategia manualmente (compra fraccionaria) | `js/services/EstrategiaServicio.js:69-111` |
| RF-EST-06 | Pausar y reanudar estrategias | `js/pages/inversiones.js:844-853` |
| RF-EST-07 | Editar y eliminar estrategias | `js/pages/inversiones.js:855-889` |
| RF-EST-08 | Exigir que el activo exista antes de crear la estrategia | `js/pages/inversiones.js:982-989` |

### 7.8 Módulo de metas de ahorro

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-MET-01 | Crear metas con monto objetivo, divisa, fecha límite e ícono | `js/ui/metas.js:467-568`; `js/models/Meta.js:20-28` |
| RF-MET-02 | Registrar aportes que descuentan de una cuenta y generan un movimiento `gasto` | `js/services/MetaServicio.js:21-58` |
| RF-MET-03 | Calcular porcentaje, monto restante y estado completada | `js/models/Meta.js:74-85` |
| RF-MET-04 | Pausar y reanudar metas | `js/models/Meta.js:26`; `js/ui/metas.js:553` |
| RF-MET-05 | Editar y eliminar metas (individual y en lote) con deshacer | `js/ui/metas.js:682-761` |
| RF-MET-06 | Exigir que la cuenta de aporte tenga la misma divisa que la meta | `js/services/MetaServicio.js:37-43` |
| RF-MET-07 | Mostrar metas en el dashboard con barra de progreso | `js/pages/dashboard.js:2646-2692` |

### 7.9 Módulo de trading

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-TRA-01 | Registrar trades long y short (entrada, lotaje, SL, TP, nota) | `js/pages/trading.js:789-876`; `js/models/Trade.js:4-18` |
| RF-TRA-02 | Cerrar un trade con precio de salida | `js/pages/trading.js:882-931` |
| RF-TRA-03 | Reabrir un trade cerrado | `js/pages/trading.js:937-965` |
| RF-TRA-04 | Editar y eliminar trades | `js/pages/trading.js:971-1106` |
| RF-TRA-05 | Calcular P&L y P&L porcentual al cerrar | `js/models/Trade.js:76-93` |
| RF-TRA-06 | Calcular P&L flotante de trades abiertos | `js/services/TradingServicio.js:61-101` |
| RF-TRA-07 | Filtrar trades por tipo y estado | `js/pages/trading.js:154-161` |
| RF-TRA-08 | Crear órdenes límite y stop (compra o venta) | `js/pages/trading.js:1112-1212`; `js/models/Orden.js:32-47` |
| RF-TRA-09 | Evaluar órdenes automáticamente al entrar a Trading | `js/pages/trading.js:124-135`; `js/models/Orden.js:119-134` |
| RF-TRA-10 | Abrir automáticamente un trade al dispararse una orden | `js/services/OrdenServicio.js`; `js/repositories/OrdenRepositorio.js:86-97` |
| RF-TRA-11 | Editar, cancelar y eliminar órdenes | `js/pages/trading.js:1315-1461` |
| RF-TRA-12 | Enlace bidireccional orden ↔ trade | `js/models/Trade.js:16`; `js/models/Orden.js:44` |

### 7.10 Módulo de divisa

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-DIV-01 | Usar PEN, USD o USDT como divisa principal | `js/services/DivisaServicio.js:118-127` |
| RF-DIV-02 | Cambiar el formato de presentación (símbolo o código) | `js/services/DivisaServicio.js:23-27` |
| RF-DIV-03 | Convertir montos entre divisas | `js/services/DivisaServicio.js:63-88` |
| RF-DIV-04 | Configurar el tipo de cambio PEN/USD manualmente | `js/services/DivisaServicio.js:135-146` |
| RF-DIV-05 | Obtener el tipo de cambio automáticamente desde una API, con fallback manual | `js/services/DivisaServicio.js:160-186` |

### 7.11 Módulo de datos

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-DAT-01 | Exportar respaldo `.dvid` (formato ESCINCO, 12 secciones) | `js/services/ExportarServicio.js:64-158` |
| RF-DAT-02 | Previsualizar una importación sin escribir nada | `js/services/ImportarServicio.js:478-507` |
| RF-DAT-03 | Importar un `.dvid` (agrega, no borra; compatible desde v2.0.0) | `js/services/ImportarServicio.js:56-168` |
| RF-DAT-04 | Eliminar todos los datos con doble confirmación y palabra clave | `js/ui/configuracion.js:1669-1798` |
| RF-DAT-05 | Descargar un respaldo automático antes de eliminar | `js/ui/configuracion.js:1744-1745`; `js/services/EliminarServicio.js:138` |
| RF-DAT-06 | Eliminar una colección concreta | `js/services/EliminarServicio.js:103-112` |

### 7.12 Módulo de configuración

Las ~30 preferencias de los 6 apartados descritos en la sección 5.6
(`js/ui/configuracion.js:78-451`): tema, resaltar patrimonio, páginas visibles,
últimos movimientos, tipos de movimiento, divisa principal, formato de divisa,
periodo de evolución, tipo de cambio manual/automático, inactividad, cerrar al
cerrar pestaña, modales persistentes, doodles, un click para seleccionar,
lateralidad, lastbar auto-hide, resaltar ingreso/gasto, nombre de usuario,
contraseña, exportar, importar, eliminar datos, eliminar cuenta.

### 7.13 Módulo de experiencia / transversales

| ID | Requerimiento | Evidencia |
|---|---|---|
| RF-EXP-01 | Tema oscuro/claro/sistema sincronizado entre dispositivos | `js/core/tema.js:43-168` |
| RF-EXP-02 | PWA instalable con respaldo offline del shell | `manifest.webmanifest`, `sw.js` |
| RF-EXP-03 | Aviso de actualización de la app | `js/core/pwa.js:93-120` |
| RF-EXP-04 | Modal reutilizable con 6 variantes, arrastre y focus trap | `js/ui/modal.js:38-464` |
| RF-EXP-05 | Notificaciones en el DOM | `js/ui/notificaciones.js` |
| RF-EXP-06 | Sidebar colapsable a riel de íconos | `js/ui/colapsoSidebar.js:32-58` |
| RF-EXP-07 | Páginas ocultables según preferencia | `js/ui/configuracion.js:102-131`; `js/core/router.js:148-153` |
| RF-EXP-08 | Lastbar contextual con auto-hide opcional | `js/core/lastbar.js`; `js/ui/configuracion.js:406-409` |
| RF-EXP-09 | Skeletons de carga | `js/ui/skeletons.js` |
| RF-EXP-10 | Desvanecido de bordes de scroll | `js/ui/scrollEdges.js` |
| RF-EXP-11 | Doodles (animación secreta de 5 dedos) | `js/ui/doodles.js` |
| RF-EXP-12 | Selección múltiple con gestos táctiles | `js/ui/seleccion.js`; varias páginas |

---

## 8. Requerimientos no funcionales

### 8.1 Rendimiento

| Técnica | Implementación | Cita |
|---|---|---|
| **Carga diferida (code-splitting)** | `import()` nativo para páginas, acciones de lastbar y configuración | `js/core/router.js:124`, `:173`; `js/core/lastbar.js:496`; `js/core/router.js:18` |
| **Precarga por hover/foco** | `pointerover` / `focusin` sobre links de navegación | `js/core/router.js:397-405` |
| **Caché de datos en memoria** | TTL 5 min, dedupe de peticiones concurrentes, invalidación por repositorio, estadísticas de ahorro | `js/core/cache.js:24-193` |
| **Invalidación de caché desde repositorios** | Cada escritura invalida su clave y algunas cruzadas (p.ej. `activos` → `posiciones`) | `js/repositories/ActivoRepositorio.js:105`, `118`, `129`, `141` |
| **Escrituras evitadas** | El snapshot no se reescribe si los totales no cambiaron | `js/repositories/SnapshotRepositorio.js:32-36` |
| **Ordenamiento en JS en vez de Firestore** | Evita índices compuestos y reduce lecturas | `js/repositories/TradeRepositorio.js:42-47` (comentario en `:52`) |
| **Anti N+1** | `Promise.all` para el *populate* de activos en posiciones | `js/repositories/PosicionRepositorio.js:41-50` |
| **Actualizaciones optimistas** | Favoritos con debounce, cola de escrituras y rollback | `js/pages/inversiones.js:611-695` |
| **Escrituras en lote** | `normalizarOrdenCuentas` usa `writeBatch` | `firebase/firestore.js:96-101` |
| **Cache-Control por tipo de asset** | `immutable` 1 año para `/js/lib/**` y `/fonts/**`; 1 semana para `/icons/**`; `no-cache` para HTML/JS/CSS | `firebase.json:36-74` |
| **Transiciones de página** | `document.startViewTransition` | `js/core/router.js:113-119` |
| **Debounce de layout** | 120 ms en `resize` del dashboard | `js/pages/dashboard.js:594-601` |
| **Protección contra respuestas fuera de orden** | Secuencia numérica en el gráfico | `js/pages/dashboard.js:2818-2850` |
| **Abort de fetch** | `AbortController` con timeout de 10 s en APIs externas | `js/services/DivisaServicio.js:153-162`; `js/strategies/PrecioAutomaticoStrategy.js:56-57` |
| **Historial local de precios** | Se persiste la serie descargada para no volver a pedirla | `js/services/PrecioServicio.js:111-125` |
| **Sin bundler ni framework** | Cero costo de compilación y de runtime de framework | `docs/requisitos.md:19`; commit `3b884eb` |

**No documentado**: no hay presupuesto de rendimiento, métricas de Lighthouse,
pruebas de carga, ni objetivo de tiempo de respuesta.

### 8.2 Usabilidad

| Aspecto | Estado | Evidencia |
|---|---|---|
| **Responsive** | Sí, CSS puro en la mayoría de casos + JS en el dashboard (columnas masonry) | `docs/auditoria-dashboard.md:40-50`; `js/pages/dashboard.js:537-542` |
| **Tema oscuro/claro/sistema** | Sí, con persistencia dual y sincronización | `js/core/tema.js:43-58`, `119-168` |
| **Accesibilidad — ARIA** | Parcial: `aria-label`, `aria-busy`, `aria-current`, `aria-haspopup`, `aria-live` | `js/pages/dashboard.js:988`; `dashboard.html:45` |
| **Accesibilidad — foco** | Focus trap en modales y restauración de foco al cerrar | `js/ui/modal.js:208-240`, `330-340`; `js/core/router.js:129-136` |
| **Accesibilidad — teclado** | Parcial: `Escape`/`Delete` en selecciones, Enter/Espacio en cards del dashboard. **Ausente en cuentas, movimientos, inversiones y trading** (tarjetas sin `tabindex`/`role`) | `js/pages/movimientos.js:498-515`; `js/pages/dashboard.js:2207-2212` |
| **Accesibilidad — movimiento reducido** | `prefers-reduced-motion` respetado en transiciones | `js/core/router.js:114`; `css/style.css:874` |
| **Accesibilidad — lastbar** | Items globales con `role="button" tabindex="0"`; **items por página sin role/tabindex** | `js/core/lastbar.js:17`, `32`, `58`, `67`, `78` frente a `:133`, `141`, `148`, `163`, `171`, `178`, `188`, `203-239`, `247-283` |
| **Feedback de carga** | Skeletons accesibles con `role="status"` y `aria-busy` | `js/ui/skeletons.js:3`, `52`, `68` |
| **Deshacer** | Ofrecido en cada eliminación (10 s por defecto) | `js/services/DeshacerServicio.js:3`, `9-38` |
| **Aviso de cambios sin guardar** | Patrón consistente (configuración, dashboard, editor de cards) | `js/ui/configuracion.js:495-514`; `js/pages/dashboard.js:771-796` |
| **Atajos de teclado globales** | Escape limpia selección, Delete deselecciona | `js/pages/movimientos.js:498-515`; `js/pages/inversiones.js:523-538` |
| **Gestos táctiles** | Clic sostenido y swipe con Pointer Events | `js/pages/movimientos.js:517-602` |

**Debilidades documentadas en el código** (reportadas sin valoración de valor):
- Sin `role`/`tabindex` en las tarjetas seleccionables de cuentas, movimientos,
  inversiones y trading.
- Sin `aria-live` en listas que se actualizan solas.
- Botones de filtro sin `aria-pressed`.
- Sin alternativa de teclado al drag & drop (ni en cards del dashboard, ni en el
  sidebar de cuentas).
- `<select>` interactivo dentro de un contenedor `role="button"` (card de patrimonio).
- El asa de arrastre del editor de cards es enfocable pero no tiene handler de
  teclado (`js/pages/dashboard.js:639`).

### 8.3 Seguridad

Ver la sección 6 completa.

### 8.4 Compatibilidad

- **No hay matriz de navegadores soportados documentada.** No existe `browserslist`
  ni `.browserslistrc` ni `caniuse` en el repositorio.
- **Se puede inferir del código** (no documentado explícitamente):
  - Requiere **módulos ES** → navegadores modernos.
  - Requiere `import` desde CDN con **módulos nativos de Firebase** (no scripts UMD).
  - Usa `document.startViewTransition` **con fallback** si no existe
    (`js/core/router.js:114`) → funciona sin View Transitions API.
  - Usa Pointer Events → compatible con navegadores modernos.
  - `meta name="theme-color"` y `manifest` → navegadores con soporte PWA.
  - Usa `?.` y `??` (optional chaining y nullish coalescing) ampliamente → requiere
    navegador moderno.
  - CSS: custom properties, grid, `min()` → navegador moderno.
- **El Service Worker se registra como módulo** (`{ type: "module" }`,
  `js/core/pwa.js:56`) → requiere soporte de module service workers
  (Chrome/Edge 91+, Safari 16.4+, Firefox 114+ aproximadamente). **Este requisito
  no está documentado en el repositorio.**
- `manifest.webmanifest:12` fija `orientation: portrait-primary`, lo que puede
  presentar comportamiento no deseado en escritorio. No hay nota al respecto.

### 8.5 PWA

| Requisito PWA | Estado | Evidencia |
|---|---|---|
| Manifest válido | Sí | `manifest.webmanifest:1-57` |
| Iconos 192/512/maskable | Sí | `manifest.webmanifest:17-36` |
| Service Worker | Sí (módulo, scope `/`) | `sw.js`, `js/core/pwa.js:52-68` |
| Precache del shell | Sí (~120 assets) | `sw.js:9-147` |
| Estrategia offline | `network-first` con fallback a `/dashboard.html` | `sw.js:253-274` |
| Instalable (standalone) | Sí por el manifest, **pero sin `beforeinstallprompt`** | `manifest.webmanifest:10` |
| Shortcuts de app | Sí (3) | `manifest.webmanifest:37-56` |
| Aviso de actualización | Sí (notificación, no banner DOM) | `js/core/pwa.js:93-120` |
| Versionado de caché | Sí, por versión de app | `sw.js:4-6` |
| **Offline: lectura de datos** | **No**: el SW nunca cachea Firestore (`sw.js:187-189`) → sin datos offline | |
| **Notificaciones push** | **No existe** | 0 coincidencias de `pushManager` |
| **Background Sync / Workbox** | **No existe** | |

**Contradicción documentada**: `docs/requisitos.md:109` afirma "respaldo offline",
lo que es cierto para el *código* (shell y assets) pero **no para los datos**: no
hay caché de datos de Firestore, por lo que la app **no muestra datos sin
conexión**.

**CSS huérfano**: existe la clase `.pwa-update-banner` con estilo completo
(`css/style.css:967-1032`) pero **ningún archivo JS o HTML la referencia** (resto de
una implementación anterior del bannerbased en DOM).

### 8.6 Mantenibilidad

| Aspecto | Estado | Evidencia |
|---|---|---|
| **Tests automatizados** | **NO EXISTEN.** 0 archivos `*.test.js`, `*.spec.js`. 0 carpetas `test/` o `tests/` | verificado |
| **Linter / formateador** | **NO EXISTE.** Sin `eslint`, `prettier`, `biome`, `.editorconfig` | verificado |
| **TypeScript** | **NO.** JS puro con JSDoc parcial | — |
| **Test runner** | **NO EXISTE** | — |
| **Estructura por capas** | Sí, consistente | `js/core`, `js/pages`, `js/services`, `js/repositories`, `js/models`, `js/ui`, `js/strategies` |
| **Convenciones de nombres** | Sí, documentadas | `docs/reglas.md:1-7`, `docs/modelo-datos.md:3-11` |
| **Documentación en el código** | Alta densidad de comentarios explicativos en español, a veces con justificación de decisiones | p.ej. `js/core/fechas.js:5-9`, `js/services/PosicionServicio.js:50-51`, `firebase/firestore.js:19-20` |
| **Código muerto detectado** | Sí, varios: `js/pages/inversiones.js:1645-1651`, `js/pages/cuentas.js:1668-1823`, `js/pages/trading.js:777-783`, `js/pages/movimientos.js:1382-1385`, `js/pages/dashboard.js:1234` (listener de un evento que nadie emite), `js/pages/inversiones.js:7` (import sin uso), `js/repositories/TradeRepositorio.js:10` (import `where` sin uso), CSS huérfano (`css/style.css:967-1032`, `css/cuentas.css:526-547`) | |
| **Duplicación** | `formatearMontoConDivisa` duplicado en `js/pages/cuentas.js:52-58` y `js/services/DivisaServicio.js:46-52`; `obtenerMovimientosConFiltros` (`js/services/MovimientoServicio.js:628-706`) definido pero no consumido por ninguna página | |
| **Saltos de capa** | `js/pages/cuentas.js:4-13` y `js/pages/movimientos.js:1` acceden a Firestore sin capa de repositorio; `js/services/CreditoServicio.js:323` importa de `js/pages/` | |
| **Ids SVG duplicados** | `icono()` genera `id="icono-${id}"`, que se repite al insertar el mismo icono varias veces (`js/core/iconos.js:96`; caso visible en `js/pages/inversiones.js:286-287`) | |
| **Versionado** | Sí, centralizado en `constants/version.js` con función de etiqueta y de info | `constants/version.js:13-24` |
| **Logs** | 222 llamadas a `console.*` en 34 archivos, con prefijos de módulo (`[INFO]`, `[WARN]`, `[ERROR]`, `[SW]`, `[EXP]`, `[caché]`) | verificado |

---

## 9. Proceso actual vs. proceso propuesto

### 9.1 ¿Cómo se gestionaban las finanzas antes de escinco?

**No documentado.** No hay ningún documento, comentario, nota o referencia en el
repositorio que describa el proceso previo, el problema que motivó el proyecto, ni
el "AS-IS" del usuario.

**Búsqueda realizada**: no existen referencias a planillas de cálculo, hojas de
cálculo, cuaderno, notas, ni a la herramienta previa que se usara antes de escinco,
ni en `docs/` ni en los comentarios del código. Las únicas apariciones de
"actualmente" o "actual" en el repositorio son descripciones del estado actual del
*software*, no del proceso de negocio previo.

### 9.2 ¿Cómo se gestionan con escinco? (flujo "TO-BE" reconstruido del código)

El flujo se reconstruye **desde el código**, no desde un documento de proceso:

1. **Alta**: el usuario se registra en `/register` (email+contraseña o Google) → se
   crea `usuarios/{uid}` y una cuenta de efectivo inicial
   (`firebase/auth.js:118-135`, `firebase/firestore.js:40-83`).
2. **Configuración inicial**: el usuario entra a Configuración y define divisa
   principal, tipo de cambio, tema y páginas visibles
   (`js/ui/configuracion.js:78-451`).
3. **Alta de cuentas**: en `/cuentas` crea cuentas (banco, efectivo, broker,
   exchange, tarjeta de crédito) con saldo inicial y, si es tarjeta, límites, corte,
   pago y anualidad (`js/pages/cuentas.js:1335-1666`).
4. **Registro de movimientos**: desde la lastbar (`mov`) o desde el detalle de una
   cuenta, elige tipo → completa el formulario → se guarda. El sistema actualiza
   saldos, deuda, posiciones y metas automáticamente
   (`js/services/MovimientoServicio.js:31-92`).
5. **Pendientes**: registra cobros y pagos con vencimiento; los consolida cuando
   ocurren, generando el movimiento correspondiente
   (`js/services/PendienteServicio.js:21-52`).
6. **Inversiones**: registra compras/ventas o crea estrategias DCA que se ejecutan
   manualmente; los precios se actualizan desde Binance o Yahoo Finance
   (`js/pages/inversiones.js:1400-1639`, `js/services/EstrategiaServicio.js:69-111`).
7. **Trading**: registra trades y órdenes; las órdenes se evalúan al entrar a la
   página y abren trades automáticamente (`js/models/Orden.js:119-134`,
   `js/pages/trading.js:124-135`).
8. **Metas**: define metas y registra aportes; cada aporte es un movimiento `gasto`
   con `metaId` (`js/services/MetaServicio.js:21-58`).
9. **Seguimiento**: el dashboard consolida patrimonio, flujo de caja, vencimientos,
   alertas y evolución patrimonial; se registra un snapshot diario
   (`js/pages/dashboard.js`, `js/services/SnapshotServicio.js:73-89`).
10. **Respaldo**: exporta/importa `.dvid` periódicamente desde Configuración
    (`js/services/ExportarServicio.js:64-158`).

### 9.3 ¿Qué mejora aporta?

**Parcialmente documentado**, de forma indirecta:

- `docs/requisitos.md:11-13` declara el objetivo general.
- `docs/roadmap.md:45-46` declara dos propiedades deseables: "Ninguna tarea borra
  datos" y "`EliminarServicio` ya exige confirmación doble".
- El backup `.dvid` con roundtrip verificado se menciona en el commit `ea1b411`
  ("roundtrip backup escinco") — evidencia de preocupación por la portabilidad de
  datos.
- `docs/requisitos.md:11-13` ("SPA de finanzas personales que registra el
  patrimonio, las cuentas, los movimientos, las inversiones y el trading") es la
  única declaración de valor.

**No documentado**: no hay sección de beneficios, ventajas, mejoras medidas,
comparativa antes/después, ni métricas de impacto (ahorro de tiempo, tasa de
errores, alcance de uso).

---

## 10. Planificación

### 10.1 ¿Hay un roadmap?

**Sí**: `docs/roadmap.md` (46 líneas).

- **Versión objetivo declarada**: `1.0.0` estable (`docs/roadmap.md:3`).
- **Estado declarado**: "v1.0.0-beta.5 (≈86 % del ideal)" (`docs/roadmap.md:4`).
  **Desactualizado**: la versión real es `1.0.0-beta.15` (`constants/version.js:2`).
- Contiene 14 tareas numeradas (1-14).

### 10.2 ¿Hay fases definidas?

**Sí, 3 fases** (`docs/roadmap.md:6-41`):

**Fase 1 — Estabilización** (desbloquea v1), 5 tareas:

| # | Tarea | Estado real |
|---|---|---|
| 1 | Unificar Firebase (punto único de acceso al SDK) | Hecho: `firebase/firestore.js:19-21` |
| 2 | Reactivar `orderBy` en pendientes | Hecho: `js/repositories/PendienteRepositorio.js:42-44` |
| 3 | Comisión en ventas | Marcada como verificada/completada en `docs/roadmap.md:15-17` |
| 4 | Documentación | Parcial: existen 6 docs, 2 desactualizados |
| 5 | 404 con marca + higiene (eliminar debug logs) | Parcial: `404.html` y `css/404.css` existen; `firestore-debug.log` sigue presente (0 bytes) |

**Fase 2 — Funcionalidad media**, tabla de 7 tareas con prioridad:

| # | Tarea | Prioridad declarada | Estado real |
|---|---|---|---|
| 6 | Tasa de cambio automática con fallback manual | Alta | Hecho: `js/services/DivisaServicio.js:160-186` |
| 7 | Módulo de órdenes límite/stop ligado a trades | Media | Hecho: `js/models/Orden.js`, `js/services/OrdenServicio.js` |
| 8 | Consolidar pendientes en lote | Media | Hecho: `js/services/PendienteServicio.js:59-101` |
| 9 | Dashboard: selector de periodos | Media | Hecho: `js/pages/dashboard.js:927-936` |
| 10 | Favoritos y metas de ahorro | Media | Hecho: `js/models/Meta.js`, `js/models/Activo.js:9` |
| 11 | Estrategias de compra programada / DCA | Media | Hecho: `js/models/Estrategia.js`, `js/services/EstrategiaServicio.js` |
| 12 | Renta variable (acciones/ETFs) + carga de precios diarios | Media | **Parcial**: hay `tipo: accion` y `tipo: etf` (`js/models/Activo.js:7`) y carga automática de precios (`js/services/PrecioServicio.js:50-69`), pero la "carga de precios diarios" automática no existe (evaluación pull) |

**Fase 3 — Pulido**, 2 tareas:

| # | Tarea | Estado real |
|---|---|---|
| 13 | Desduplicar CSS y cargar solo los estilos de cada página | Pendiente: las 12 hojas se siguen cargando todas en `dashboard.html:12-23` |
| 14 | Probar reglas en simulador + test de caché en producción | Pendiente: `test-cache.html` existe pero no hay evidencia de ejecución; no hay `firestore.rules.local` |

**Conclusión**: el roadmap está **muy desactualizado**; 6 de 7 tareas de la Fase 2 ya
están implementadas. `docs/roadmap.md:44-46` declara el orden de ejecución previsto,
que ya no aplica.

### 10.3 ¿Hay un WBS o cronograma?

**NO EXISTE.** No hay:

- WBS (Work Breakdown Structure).
- Diagrama de Gantt.
- Cronograma con fechas.
- Estimaciones de esfuerzo (horas, story points).
- Tabla de asignación de tareas.
- Diagrama de dependencias entre tareas.
- Tabla de riesgos de proyecto (el bloque "Riesgos y decisiones pendientes" de
  `docs/propuesta-dashboard.md:249-256` es de alcance técnico del dashboard, no de
  proyecto).

### 10.4 ¿Hay un Lean Canvas?

**NO EXISTE.** No hay Lean Canvas, Business Model Canvas, Value Proposition Canvas,
Personas, ni plantillas de definición de producto en el repositorio.

---

## 11. Pruebas

### 11.1 ¿Hay tests automatizados?

**NO.** Verificado exhaustivamente:

- 0 archivos `*.test.js`, `*.spec.js`, `*.test.mjs`.
- 0 carpetas `test/`, `tests/`, `spec/`, `__tests__/`.
- `package.json` no declara `scripts.test` ni dependencias de testing
  (`package.json:1-9`).
- No hay configuración de Jest, Vitest, Mocha, Playwright, Cypress ni similares.

### 11.2 ¿Hay casos de prueba documentados?

**NO EXISTE** un documento de casos de prueba (ni manual ni automatizado).

Lo más cercano a un plan de pruebas es:

- `docs/roadmap.md:40` — tarea #14: "Probar reglas en simulador + test de caché en
  producción (`test-cache.html`)". Es una **tarea planificada, no ejecutada ni
  documentada**.
- `docs/roadmap.md:15-17` — notas de verificación manual de la tarea 3 (comisión en
  ventas), con la fórmula concreta citada.

### 11.3 ¿Hay pruebas manuales?

**Sí, dos artefactos:**

1. **`test-cache.html`** (417 líneas) — banco de pruebas manual de la capa de caché.
   Simula un "backend" con escenarios de navegación, mide aciertos contra lecturas de
   red, valida coherencia interna y descarga un `resultados-cache.json`
   (`test-cache.html:24-42`). Contiene una **copia inline** de `js/core/cache.js`
   (`test-cache.html:44-60`) para poder ejecutarse sin servidor. Está excluido del
   despliegue (`firebase.json:18`).

2. **`experimentos/exp.js`** (34 líneas) — experimento de detección de pulsos
   táctiles de 2 a 5 dedos, con instrucciones de carga en el comentario de cabecera
   (`experimentos/exp.js:1-6`). Es un experimento técnico, no una prueba.

**No existe**: checklist de pruebas manuales, matriz de trazabilidad
requerimiento-prueba, ni registro de resultados de pruebas de aceptación.

### 11.4 ¿Cómo se verifica que algo funciona?

**Por inferencia del código y los scripts** (no hay documento que lo describa):

| Mecanismo | Evidencia |
|---|---|
| **Emulador de Hosting de Firebase** | `package.json:3-4`: `firebase serve`, `firebase emulators:start`; `docs/requisitos.md:23` |
| **Consola del navegador** | 222 llamadas a `console.*` con prefijos; el SW registra install/activate/errores (`sw.js:137`, `154`, `163`) |
| **`test-cache.html`** | Descarga un reporte JSON de estadísticas de caché (`js/core/cache.js:162-192`) |
| **`node --check`** | **No documentado ni scriptado en ningún archivo.** No hay script de verificación de sintaxis |
| **Simulador de reglas de Firestore** | Solo mencionado como tarea pendiente (`docs/roadmap.md:40`). **No hay `firestore.rules.local`** (está en `.gitignore:42`) ni script que lo use |
| **Revisión de accesibilidad del dashboard** | Commit `cb4a0e6` "feat: mejorar accesibilidad del dashboard" (2026-09-23) |
| **Auditoría escrita del dashboard** | `docs/auditoria-dashboard.md` (302 líneas, 2026-09-23) — revisión de código sin modificarlo |
| **Verificación de roundtrip del backup** | Commit `ea1b411` "roundtrip backup escinco" |
| **Limpieza de SW en desarrollo** | `js/core/pwa.js:35-50` desregistra el SW en localhost para evitar caché obsoleta |

**No existe**: pipeline de pruebas, cobertura de código, revisión de código formal
(code review), ni definición de "hecho" (definition of done).

---

## 12. Despliegue

### 12.1 ¿Dónde se despliega?

- **Plataforma**: Firebase Hosting, sitio único `escinco` (`firebase.json:8-9`).
- **Proyecto**: `cinco-96064` (`.firebaserc:3`).
- **Región de Firestore**: `nam5` (Iowa) (`firebase.json:4`).
- **Dominio personalizado**: **no documentado**; no hay campo `hosting.matches` en
  `firebase.json` ni referencia a ningún dominio.
- **URL**: no documentada en el repositorio.

### 12.2 ¿Cómo se despliega?

Scripts disponibles (`package.json:2-8`):

| Script | Comando | Alcance |
|---|---|---|
| `npm run serve` | `firebase serve` | Hosting local |
| `npm run emulators` | `firebase emulators:start` | Emulador de Hosting |
| `npm run deploy:hosting` | `firebase deploy --only hosting` | Solo el sitio web |
| `npm run deploy:rules` | `firebase deploy --only firestore:rules` | Solo reglas |
| `npm run deploy` | `firebase deploy --only hosting,firestore:rules` | Hosting + reglas |

- **Índices**: existen en `firebase/firestore.indexes.json` pero **ningún script los
  despliega**. Deben desplegarse manualmente con
  `firebase deploy --only firestore:indexes`.
- **No hay paso de build**: `firebase.json:10` define `"public": "."` — se despliega
  la raíz del proyecto tal cual, sin transpilación ni minificación.
- **Rewrites** para deep-link SPA (`firebase.json:25-35`).
- **Headers de caché** por tipo de asset (`firebase.json:36-74`).
- **Exclusiones de despliegue**: `firebase.json:11-24` (firebase.json, dotfiles,
  rules, indexes, logs, `test-cache.html`, package.json, skills-lock.json, `*.md`,
  `docs/**`).
- **Analytics de despliegue**: **no hay** sección `hosting.headers` de analytics ni
  configuración de performance.

### 12.3 ¿Hay entornos separados (dev/prod)?

**NO EXISTE separación de entornos.**

- Un solo proyecto Firebase en `.firebaserc:2-4` (solo `default`).
- Un solo archivo `firebase.json`, sin `targets` de hosting múltiples.
- **No hay** archivos `firebase.prod.json`, `.env.production`, ni flags de build.
- Lo más cercano a un control de entorno es un **guard de desarrollo en el Service
  Worker**: si el host es `localhost` o `127.0.0.1`, no se registra el SW y se
  desregistra el existente (`js/core/pwa.js:19-23`, `29-32`, `35-50`).
- `firebase/config.js:1-8` contiene **la configuración de producción hardcodeada**
  (apiKey, authDomain, projectId, storageBucket, appId). No hay conmutador
  dev/prod.

**Consecuencia**: el emulador de Hosting sirve el mismo código contra el backend de
**producción** (no hay `emulators.firestore` configurado en `firebase.json`), por lo
que las pruebas locales escriben en Firestore real.

### 12.4 ¿Hay CI/CD?

**NO EXISTE.**

- No hay carpeta `.github/` (verificado).
- No hay `.gitlab-ci.yml`, `.circleci/`, `azure-pipelines.yml`,
  `bitbucket-pipelines.yml`.
- No hay `.husky/` ni hooks de Git configurados en el repositorio.
- No hay `Dockerfile` ni configuración de contenedores.
- No hay Dependabot ni Renovate configurados.
- El despliegue es **manual desde la máquina del desarrollador**.

---

## 13. Control de versiones

### 13.1 Sistema

**Git**. Inicializado en la raíz. No hay otros SCM en el proyecto.

### 13.2 Estrategia de ramas

- **Rama principal**: `main` (rama activa, verificado con `git branch`).
- **Rama remota**: `origin/main`.
- **NO hay ramas de feature, develop, release ni hotfix.** El historial es lineal
  sobre `main` (verificado: sin bifurcaciones visibles en `git log`).
- **NO hay tags de versión** confirmados. El versionado se hace en el mensaje del
  commit (p.ej. `d60c754 1.0.0-beta.1`, `f5b74c8 1.0.0-beta.15`). No se puede
  determinar desde los archivos si existen tags Git.
- **Convención de mensajes de commit**: mixta.
  - Prefijos estilo Conventional Commits en algunos: `feat:`, `fix:`, `chore:`,
    `layout:` (p.ej. `cb4a0e6 feat: mejorar accesibilidad del dashboard`,
    `3b884eb chore: eliminar vite`).
  - Tags de versión como mensaje completo en otros: `d60c754 1.0.0-beta.1`.
  - Mensajes libres en otros: `c014e94 correcciones y pc más`,
    `faab340 Movimientos pulido`, `60abb0b estructura inicial`, `8ed60bf arq final`.
- **No hay CONTRIBUTING.md ni CHANGELOG.md** (verificado).

### 13.3 Repositorio remoto

- **Sí**: `origin` → `https://github.com/dvid518/cinco-.git` (fetch y push).
- Repositorio en GitHub, propietario `dvid518`, nombre `cinco-`.
  **Nota**: el nombre del repositorio remoto (`cinco-`) difiere del nombre del
  producto (`escinco`).

### 13.4 Número de commits

- **26 commits** en total (`git rev-list --count HEAD`).
- **Autor único**: `david` en los 26 commits.
- **Rango de fechas**: `2026-08-04` (primer commit `fd484d5`) → `2026-09-24`
  (último commit `f5b74c8`). **≈ 51 días** de actividad.
- **Distribución aproximada**: 4 commits de estructura inicial (4-6 agosto),
  15 commits de versionado beta (16-24 septiembre), 6 commits de dashboard masonry
  y accesibilidad (23-24 septiembre).

### 13.5 Versión actual

- **`1.0.0-beta.15`** (`constants/version.js:2`), fase `beta`, lanzamiento
  `2026-09-13`, autor `david`, año 2026.
- Funciones de apoyo: `getVersionLabel()` (`constants/version.js:13-15`) y
  `getVersionInfo()` (`constants/version.js:17-24`).

### 13.6 Estado del árbol de trabajo

Hay **cambios sin commitear** (verificado con `git status --short`):

- 12 archivos CSS modificados (`css/componentes.css`, `configuracion.css`,
  `dashboard.css`, `iconos.css`, `modal.css`, `navegacion.css`, `pendientes.css`,
  `style.css`, etc.).
- `dashboard.html` y `sw.js` modificados.
- `docs/modelo-datos.md` y `docs/requisitos.md` modificados.
- `js/core/lastbar.js`, `js/core/router.js`, `js/core/sesion.js` modificados.
- `js/pages/dashboard.js`, `js/pages/index.js`, `js/pages/register.js` modificados.
- `js/ui/modal.js` modificado.
- **Renombrado**: `js/pages/configuracion.js` → `js/ui/configuracion.js`.
- `firestore-debug.log` presente en la raíz (verificado: 0 bytes; ya ignorado por
  `.gitignore:41`).

---

## 14. Mantenimiento

### 14.1 ¿Hay plan de backups?

**No hay un plan documentado**, pero sí hay un **mecanismo de respaldo implementado**:

| Mecanismo | Implementación | Cita |
|---|---|---|
| **Exportación manual `.dvid`** | Descarga un archivo con 12 secciones de datos | `js/services/ExportarServicio.js:64-158` |
| **Importación con previsualización** | Valida formato y versión sin escribir; luego importa | `js/services/ImportarServicio.js:478-507` |
| **Respaldo automático antes de eliminar** | Se descarga un `.dvid` antes de borrar todos los datos o la cuenta | `js/ui/configuracion.js:1744-1745`; `js/services/EliminarServicio.js:138` |
| **Exportación de extracto CSV** | Solo movimientos, para análisis externo | `js/pages/movimientos.js:1322-1370` |
| **Retención de historial de precios** | Solo 7 días | `js/repositories/HistorialRepositorio.js:154-169` |
| **Retención de snapshots en el backup** | Solo los últimos 365 días | `js/services/ExportarServicio.js:92` |
| **Respaldo de Firebase** | **No documentado** (depende del plan Blaze, no verificable desde el código) | — |

**No documentado**: política de frecuencia de respaldo, dónde se almacenan los
`.dvid` (el `.gitignore:82` los excluye del repo, lo que sugiere almacenamiento local
del usuario), rotación, verificación de restaurabilidad, ni plan de recuperación ante
desastres.

### 14.2 ¿Hay logs?

**Sí, pero solo de cliente y a consola.**

| Tipo | Cantidad / Ubicación |
|---|---|
| **`console.*` en el código de app** | **222 llamadas** en 34 archivos, con prefijos de módulo: `[INFO]`, `[WARN]`, `[ERROR]`, `[SW]`, `[caché]`, `[EXP]` |
| **Service Worker** | `sw.js:137` (install), `sw.js:154` (activate), `sw.js:163` (limpieza de caché), `sw.js:144` (error de precache) |
| **Caché de datos** | `js/core/cache.js:169-173` — resumen y tabla de estadísticas |
| **Archivo `firestore-debug.log`** | Presente en la raíz, **0 bytes** (verificado), ya ignorado por `.gitignore:41` |
| **Archivo `firebase-debug.log`** | No presente actualmente (ignorado por `.gitignore:40`) |
| **Archivo `ui-debug.log`** | No presente (ignorado por `.gitignore:43`) |

**No existe**: logging estructurado, envío a un servicio externo (Sentry,
LogRocket, Firebase Crashlytics), niveles de log configurables, ni rotación de logs.

### 14.3 ¿Hay monitoreo?

**NO EXISTE monitoreo**, verificable desde el código:

- **Sin Firebase Analytics** (0 referencias a `firebase-analytics`).
- **Sin Crashlytics** (0 referencias).
- **Sin Sentry, Performance Monitoring ni Error Reporting** (0 referencias).
- **Sin healthchecks ni monitor de uptime.**
- **Sin alertas.**

Lo más cercano a "observabilidad" es el **reporte de estadísticas de caché**,
descargable como JSON (`js/core/cache.js:162-192`, `test-cache.html:24-42`), que
mide solicitudes, aciertos, aciertos-en-vuelo, lecturas de red, invalidaciones y
`ahorroPorcentual`.

### 14.4 ¿Hay un plan de mantenimiento documentado?

**NO EXISTE.** No hay:

- Calendario de releases ni de publicación.
- Política de soporte de versiones.
- Procedimiento de respuesta a incidentes.
- Definición de "deuda técnica" ni backlog.
- Criterios de priorización formalizados (el `docs/roadmap.md` tiene prioridades
  "Alta"/"Media" pero sin criterios explícitos).
- Procedimiento de onboarding de nuevos desarrolladores.
- Documento de "cómo contributes".

---

## 15. Documentación existente

### 15.1 Lista de archivos en `docs/`

| # | Archivo | Líneas | Fecha declarada | Qué cubre |
|---|---|---|---|---|
| 1 | `docs/requisitos.md` | 118 | — | Descripción del proyecto, stack, funcionalidades por módulo, fuera de alcance |
| 2 | `docs/roadmap.md` | 46 | — | Versión objetivo, 3 fases, 14 tareas, orden de ejecución |
| 3 | `docs/modelo-datos.md` | 284 | — | Convenciones, árbol de colecciones, campos por colección, relaciones, formato de respaldo |
| 4 | `docs/reglas.md` | 7 | — | Convenciones de nomenclatura (camelCase, tipos, divisas, IDs, fechas) |
| 5 | `docs/auditoria-dashboard.md` | 302 | 2026-09-23 | Auditoría del dashboard previo: grid, cards, breakpoints, persistencia, accesibilidad. **DESACTUALIZADA** |
| 6 | `docs/propuesta-dashboard.md` | 268 | — | Propuesta de masonry del dashboard: anchors, scheduler, persistencia, drag & drop, teclado, riesgos. **YA IMPLEMENTADA** |

**No existe en la raíz del repositorio**: `README.md`, `CHANGELOG.md`,
`CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
`ARCHITECTURE.md`, `API.md`, ni subcarpetas `docs/adr/`, `docs/api/`,
`docs/diagramas/`, `docs/pruebas/`.

### 15.2 Estado de actualización de la documentación

| Documento | Estado | Evidencia de desactualización |
|---|---|---|
| `docs/requisitos.md` | **Desactualizado** | Versión `beta.5` (`:4`) frente a `beta.15` real; inactividad "30 min" (`:33`) frente a 15 min real; no documenta 16 de las 20 cards del dashboard; no menciona flujo de caja, distribución, alertas, cards instanciadas ni el masonry |
| `docs/roadmap.md` | **Muy desactualizado** | Declara "beta.5 ≈86%" (`:4`); 6 de 7 tareas de la Fase 2 ya implementadas |
| `docs/modelo-datos.md` | **Parcialmente desactualizado** | Declara el formato de respaldo como "4.0.0" (`:271`) pero el código usa `VERSION_DVID = "4.1.0"` (`js/services/ExportarServicio.js:26`); `cuentas` describe `divisa` pero el código usa `moneda` (`:75`); faltan 12 campos de `cuentas`, más `fuente`/`apiSimbolo` de `activos` y `metaId` de `movimientos`; el campo de snapshot aparece como `total…` (`:210`) cuando los nombres reales son fijos |
| `docs/reglas.md` | **Vigente** | Consistente con el código |
| `docs/auditoria-dashboard.md` | **Obsoleto** | Describe 8 cards y `localStorage["escinco_dashboard_cards"]` (`:175-191`); el código tiene 20 cards y persiste en Firestore |
| `docs/propuesta-dashboard.md` | **Obsoleto** (pero valuable como registro histórico de decisiones de diseño) | El masonry propuesto ya está implementado |

### 15.3 Qué falta por documentar

1. **README.md** con instrucciones de instalación, desarrollo, despliegue y
   estructura.
2. **Documento de arquitectura** formal (capas, diagrama de dependencias, flujo de
   datos).
3. **Manual de usuario** o documentación de las funcionalidades de UI.
4. **Changelog** automático o manual.
5. **Licencia** del proyecto y de las dependencias (los paths de Lucide son ISC
   según `js/core/iconos.js:6`, pero no hay archivo de licencia en el repositorio).
6. **Documentación de las reglas de seguridad** explicada para el usuario final.
7. **Política de privacidad** (la app guarda datos financieros en Firestore).
8. **ADR** (Architecture Decision Records) para decisiones de diseño relevantes: por
   qué CDN, por qué sin framework, por qué Chart.js embebido, por qué este modelo
   de datos, por qué referencias por símbolo en vez de por ID.
9. **Documentación de las APIs externas** usadas (Binance, Yahoo Finance, tipo de
   cambio) con sus términos de uso y límites de tasa.
10. **Diagramas**: ER, arquitectura, flujo de usuario, secuencia, BPMN.
11. **Documento de pruebas**: plan, casos, resultados.
12. **Documento de despliegue y mantenimiento**.
13. **Plan de respaldos y recuperación ante desastres**.
14. **Documentación de accesibilidad** (nivel WCAG objetivo, auditoría, lista de
    defectos conocidos).
15. **Matriz de trazabilidad** requisito → implementación → prueba.
16. **Actualización** de `docs/requisitos.md` y `docs/roadmap.md` al estado real.
17. **Eliminar o archivar** `docs/auditoria-dashboard.md` y
    `docs/propuesta-dashboard.md` (o marcarlos como históricos con fecha).
18. **Documentación de la caché de datos** y de sus métricas
    (`js/core/cache.js:1-22` documenta el uso, pero no hay guía del usuario).
19. **Documentación del formato `.dvid`** como especificación formal independiente
    (actualmente solo en `docs/modelo-datos.md:269-284` y en el código).

---

## 16. Glosario de términos

### 16.1 Términos técnicos

| Término | Definición | En el proyecto |
|---|---|---|
| **SPA (Single Page Application)** | Aplicación web que carga una sola página HTML y cambia su contenido dinámicamente sin recargar el navegador. | Toda la app tras `login` (`docs/requisitos.md:11`) |
| **ES Modules** | Sistema de módulos nativo de JavaScript (`import` / `export`), estandarizado y con alcance de módulo. | Base de todo el código (`dashboard.html:72`) |
| **Code-splitting** | División del código en fragmentos que se cargan bajo demanda. | `import()` dinámico en rutas y acciones (`js/core/router.js:173`) |
| **Firestore** | Base de datos documental NoSQL de Google, en la nube, con sincronización en tiempo real y reglas de seguridad declarativas. | Backend de datos (`firebase/firestore.js:17`) |
| **Documento** | Unidad de datos de Firestore: conjunto de campos clave-valor identificado por un ID. | `usuarios/{uid}`, `cuentas/{id}` |
| **Colección** | Conjunto de documentos del mismo tipo. | `usuarios/{uid}/cuentas` |
| **Subcolección** | Colección anidada dentro de un documento. | `usuarios/{uid}/activos/{id}/historial` (`docs/modelo-datos.md:21`) |
| **Snapshot (Firestore)** | Estado inmutable de un documento en un momento dado. En este proyecto también designa el registro diario del patrimonio. | `registrarSnapshot` (`js/services/SnapshotServicio.js:73-89`); `docs/modelo-datos.md:204` |
| **serverTimestamp()** | Marca de tiempo generada por el servidor, no por el cliente, para evitar manipulación. | `firebase/firestore.js:11`, `166` |
| **Timestamp** | Tipo de dato de fecha-hora de Firestore. | Convención del proyecto (`docs/reglas.md:5`) |
| **writeBatch** | Escritura múltiple atómica en Firestore (se aplica toda o ninguna). | `firebase/firestore.js:96-100`, `106-110` |
| **Reglas de seguridad** | Archivo declarativo que define quién puede leer/escribir cada documento. | `firebase/firestore.rules:1-524` |
| **Índice compuesto** | Índice de Firestore que permite consultas con `where` + `orderBy` sobre campos distintos. | `firebase/firestore.indexes.json:2-18` |
| **PWA (Progressive Web App)** | Aplicación web instalable, con capacidad offline y comportamiento similar a una app nativa. | `manifest.webmanifest`, `sw.js` |
| **Service Worker** | Script que se ejecuta en segundo plano, intercepta peticiones de red y sirve una caché propia. | `sw.js:1-284` |
| **Precache** | Descarga y almacenamiento de una lista de recursos al instalar el Service Worker. | `sw.js:9-147` |
| **network-first** | Estrategia de caché que intenta la red primero y usa la caché solo si falla. | `sw.js:253-274` |
| **stale-while-revalidate** | Estrategia que sirve la caché de inmediato y actualiza la caché en segundo plano. | `sw.js:237-251` |
| **Cache Storage API** | API del navegador para almacenar respuestas HTTP en pares clave-valor. | `caches.open(...)` (`sw.js:140`) |
| **Theme color** | Color que el navegador aplica a la barra del sistema en móvil. | `manifest.webmanifest:14`, `dashboard.html:8` |
| **Maskable icon** | Icono PWA con zona de seguridad que el sistema puede recortar. | `icons/icon-maskable-512.png` (`manifest.webmanifest:31-35`) |
| **Focus trap** | Técnica de accesibilidad que mantiene el foco de teclado dentro de un diálogo. | `js/ui/modal.js:208-240` |
| **aria-label / role / tabindex** | Atributos ARIA y de tabulación que definen semántica y acceso por teclado. | `js/pages/dashboard.js:979`, `318` |
| **aria-live** | Región cuyo cambio se anuncia a lectores de pantalla. | `js/pages/dashboard.js:988` |
| **Carga diferida (lazy loading)** | Cargar un recurso solo cuando es necesario. | `js/core/router.js:173` |
| **Debounce** | Retrasar la ejecución hasta que la actividad se detenga. | Favoritos 400 ms (`js/pages/inversiones.js:649-652`); layout 120 ms (`js/pages/dashboard.js:594-601`) |
| **Invalidación de caché** | Marcar como obsoleto un dato cacheado para forzar una relectura. | `js/core/cache.js:97-126` |
| **Strategy pattern** | Patrón de diseño que encapsula una familia de algoritmos intercambiables tras una interfaz común. | `js/strategies/ManualPrecioStrategy.js`, `js/strategies/PrecioAutomaticoStrategy.js` |
| **MVC** | Modelo-Vista-Controlador: separación de datos, presentación y control. | Aplicado de forma conceptual (capas) |
| **Dependency Injection** | Proporcionar las dependencias desde fuera en vez de construirlas internamente. | Solo por imports ES; no hay contenedor de IoC |
| **CDN** | Red de entrega de contenido que sirve archivos desde servidores cercanos. | SDK de Firebase 12.0.0 (`firebase/auth.js:20`) |
| **UMD** | Formato universal de módulo JS (CommonJS + AMD + global). | `js/lib/chart.umd.min.js` |
| **Masonry** | Distribución de bloques de altura variable que evita huecos, sin usar CSS `columns`. | Implementado en JS (`js/pages/dashboard.js:554-577`) |
| **Pointer Events** | API unificada para ratón, lápiz y táctil. | Gestos (`js/pages/movimientos.js:517-602`) |
| **Document.startViewTransition** | API para animaciones de transición entre estados del DOM. | `js/core/router.js:118` |
| **matchMedia / prefers-*** | Media queries de CSS consultables desde JS. | `js/core/tema.js:17`, `js/core/router.js:114` |
| **Custom properties (CSS variables)** | Variables CSS (`--nombre`) reutilizables y con cascada. | `css/style.css`, `js/ui/modal.js:455-464` |
| **History API (SPA routing)** | Enrutado del lado del cliente con `pushState` / `popstate`. | `js/core/router.js:325`, `408` |
| **Hash-based routing** | Enrutado basado en el fragmento `#` de la URL. | **NO usado** en este proyecto |

### 16.2 Términos financieros

| Término | Definición | En el proyecto |
|---|---|---|
| **Patrimonio (net worth)** | Valor total de los activos menos las deudas. | Calculado en `SnapshotServicio.calcularPatrimonio` (`js/services/SnapshotServicio.js:17-68`); **solo considera cuentas, no posiciones de inversión** (`js/services/SnapshotServicio.js:15-16`) |
| **Activo** | Bien o derecho con valor económico (efectivo, banco, inversiones). | Cuentas noArchived y no-tarjeta dentro del patrimonio (`js/services/SnapshotServicio.js:49-55`) |
| **Pasivo / Deuda** | Obligación financiera con terceros. | `deuda` de la tarjeta de crédito (`docs/modelo-datos.md:84`); `totalDeuda` (`js/services/SnapshotServicio.js:25`) |
| **Balance / Flujo de caja** | Diferencia entre ingresos y gastos de un periodo. | Cards `flujo-caja`, `gastos-periodo`, `ingresos-periodo`, `balance-periodo` (`js/pages/dashboard.js:1063-1088`) |
| **Cuenta corriente / de ahorro** | Cuentas bancarias usadas para operar y almacenar saldo. | Tipos de cuenta: `banco`, `efectivo` (`docs/modelo-datos.md:74`) |
| **Tarjeta de crédito** | Instrumento de pago con línea de crédito, ciclo de facturación y deuda asociada. | Tipo `credito`; campos `deuda`, `limite`, `diaCorte`, `diaPago` (`docs/modelo-datos.md:82-88`) |
| **Ciclo de facturación** | Periodo mensual entre el corte y el pago de la tarjeta. | `CreditoServicio.periodoDeCorte` (`js/services/CreditoServicio.js:96-113`) |
| **Corte (día de corte)** | Fecha en que cierra el ciclo de consumo de la tarjeta. | `diaCorte` (`docs/modelo-datos.md:86`) |
| **Día de pago** | Fecha en que se paga la deuda de la tarjeta. | `diaPago` (`docs/modelo-datos.md:87`) |
| **Desgravamen** | Porcentaje de comisión cobrado por la entidad financiera al pagar una tarjeta con dinero de otra tarjeta. | Campo `desgravamen` (`docs/modelo-datos.md:88`, `firebase/firestore.rules:101`); **el campo existe pero ninguna función del código lo utiliza** |
| **Anualidad** | Cuota anual de una tarjeta. | `anualidad` + `anualidadFecha` (`js/services/CreditoServicio.js:191-208`) |
| **Límite de crédito** | Monto máximo que la tarjeta permite gastar. | `limite` (`docs/modelo-datos.md:85`) |
| **P2P (Peer to Peer)** | Intercambio directo de criptoactivos entre usuarios sin intermediario. | Tipos `p2pCompra`, `p2pVenta` (`constants/tiposMovimiento.js:8-9`) |
| **Exchange** | Casa de cambio o plataforma de comercio de criptoactivos. | `exchange` en movimientos P2P (`docs/modelo-datos.md:106`); tipo de cuenta `exchange` |
| **DCA (Dollar Cost Averaging / compra programada)** | Invertir una cantidad fija de forma periódica, independientemente del precio. | Estrategias de compra (`docs/modelo-datos.md:144-164`; `js/models/Estrategia.js`) |
| **Promedio ponderado** | Precio medio de una posición, ponderado por cantidad, que incluye comisiones. | `precioPromedio` (`js/repositories/PosicionRepositorio.js:132-134`) |
| **Posición abierta** | Cantidad netamente positiva de un activo que se mantiene. | Base de las cards instanciadas de activo (`docs/modelo-datos.md:64-67`) |
| **Favorito** | Activo marcado por el usuario para resaltarlo. | `favorito` (`js/models/Activo.js:9`) |
| **Pendiente de cobro / de pago** | Compromiso futuro de recibir (cobrar) o pagar una cantidad. | `tipo: true|false` en `pendientes` (`js/models/Pendiente.js:5`) |
| **Consolidar pendiente** | Convertir un pendiente en un movimiento real cuando ocurre. | `PendienteServicio.consolidarPendienteAMovimiento` (`js/services/PendienteServicio.js:21-52`) |
| **Meta de ahorro** | Objetivo de ahorro con monto objetivo, progreso y fecha límite. | `js/models/Meta.js` |
| **Trade (operación bursátil)** | Compra o venta de un instrumento financiero. | `js/models/Trade.js` |
| **Long / Short** | Posición alcista (compra) o bajista (venta en corto). | `tipo: long|short` (`js/models/Trade.js:12`) |
| **Lotaje** | Tamaño de una posición (cantidad de unidades). | `lotaje` (`js/models/Trade.js:9`) |
| **Stop Loss (SL) / Take Profit (TP)** | Niveles de protección que cierran automáticamente la posición. | `sl` / `tp` (`js/models/Trade.js:10-11`) |
| **P&L (Profit and Loss)** | Ganancia o pérdida de una operación. | `pnl`, `pnlPorcentaje` (`js/models/Trade.js:76-93`); P&L flotante (`js/services/TradingServicio.js:83-99`) |
| **Orden límite** | Se ejecuta cuando el precio alcanza un nivel a favor del orden. | `tipoOrden: limite` (`js/models/Orden.js:14-17`) |
| **Orden stop** | Se ejecuta cuando el precio alcanza un nivel en contra del orden. | `tipoOrden: stop` (`js/models/Orden.js:14-17`) |
| **Pull evaluation (evaluación bajo demanda)** | Los triggers se evalúan cuando el usuario entra a la página, no en un servidor programado. | `docs/modelo-datos.md:237-239`; `js/pages/trading.js:124-135` |
| **ETF (Exchange-Traded Fund)** | Fondo de inversión cotizado en bolsa. | `tipo: etf` de activo (`js/models/Activo.js:7`, `docs/modelo-datos.md:118`) |
| **Acción** | Título de participación en una empresa cotizada. | `tipo: accion` (`docs/modelo-datos.md:118`) |
| **Criptoactivo** | Activo digital (BTC, ETH, USDT…). | `tipo: crypto` (`docs/modelo-datos.md:118`); `constants/divisas.js:4` |
| **Bono** | Instrumento de deuda con rendimiento fijo. | `tipo: bono` (`docs/modelo-datos.md:118`) |
| **Cambio de divisa** | Operación de conversión de una moneda a otra a un tipo de cambio dado. | Tipo de movimiento `cambioDivisa` (`constants/tiposMovimiento.js:5`); campo `tasa` |
| **Desgravamen de tarjeta** | Comisión por pagar una tarjeta de crédito con otra tarjeta. | `desgravamen` (campo definido, no implementado) |
| **Cuentas no patrimoniales** | Cuentas excluidas del cálculo de patrimonio (`esPatrimonio: false`). | `js/services/SnapshotServicio.js:32` |
| **Cuenta archivada** | Cuenta fuera del patrimonio (`estado: "archivada"`). | `js/services/SnapshotServicio.js:28`; `docs/modelo-datos.md:77` |

---

## 17. Referencias

### 17.1 Documentación oficial y recursos externos usados

| Recurso | URL | Dónde se referencia |
|---|---|---|
| **Firebase JS SDK 12.0.0 (app)** | `https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js` | `firebase/firebaseClient.js:1` |
| **Firebase JS SDK 12.0.0 (auth)** | `https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js` | `firebase/auth.js:20` |
| **Firebase JS SDK 12.0.0 (firestore)** | `https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js` | `firebase/firestore.js:13`, `firebase/auth.js:22` |
| **Chart.js 4.4.7** | `https://www.chartjs.org/` (no enlazado, embebido) | `js/lib/chart.umd.min.js:1-9`; `docs/requisitos.md:24` |
| **Chart.js: aviso sobre SRI** | `https://www.jsdelivr.com/using-sri-with-dynamic-files` | `js/lib/chart.umd.min.js:3` |
| **Lucide (iconos, licencia ISC)** | `https://lucide.dev/` (no enlazado, paths copiados) | `js/core/iconos.js:6` |
| **jsDelivr** | `https://www.jsdelivr.com/` | `js/lib/chart.umd.min.js:3` |
| **Binance API** (precios cripto) | endpoints `/api/v3/ticker/price` y `/api/v3/klines` | `js/strategies/PrecioAutomaticoStrategy.js:89-92`, `110-126` |
| **Yahoo Finance API** (precios de acciones/ETFs) | endpoints `query1.finance.yahoo.com` (`/v8/finance/chart/`) | `js/strategies/PrecioAutomaticoStrategy.js:94-108`, `128-152` |
| **API de tipo de cambio** (modo automático) | `open.er-api.com` | `js/services/DivisaServicio.js:160-186` |
| **Inter (tipografía)** | `https://rsms.me/inter/` | `fonts/Inter/`, `css/style.css:33-60` |
| **Roboto Mono (tipografía)** | `https://fonts.google.com/specimen/Roboto+Mono` | `fonts/Roboto_Mono/`, `css/style.css:1-32` |
| **Repositorio remoto** | `https://github.com/dvid518/cinco-` | `.git/config` (`origin`) |
| **Consola del proyecto Firebase** | `cinco-96064` | `.firebaserc:3` |
| **Hosting de Firebase** | `cinco-96064.firebaseapp.com` (derivable, **no escrito en el repo**) | `firebase/config.js:3` (authDomain) |

### 17.2 Referencias en comentarios y documentos

| Referencia | Dónde |
|---|---|
| Licencia ISC de los paths de Lucide | `js/core/iconos.js:6` |
| Límite de 10 000 documentos por `limit()` en Firestore | `js/services/ExportarServicio.js:28-30` |
| `Date.toISOString()` devuelve UTC (motivo del módulo de fechas) | `js/core/fechas.js:5-9` |
| `document.startViewTransition` con fallback | `js/core/router.js:113-119` |
| `prefers-reduced-motion` | `css/style.css:874`; `js/core/router.js:114` |
| Evolución del formato de respaldo (2.0.0 → 3.0.0 → 4.0.0) | `docs/modelo-datos.md:280-284`; `js/services/ExportarServicio.js:21-25` |
| Bug #3 (activo fantasma al pasar ID en vez de símbolo) | `js/services/EstrategiaServicio.js:87-88` |
| Bug #6 (datos del usuario anterior en `sessionStorage`) | `firebase/auth.js:143-144` |
| Bug #9 (revoke prematuro de Object URL) | `js/services/ExportarServicio.js:150` |
| "Yahoo no acepta `Nd`" en rangos de fechas | `js/strategies/PrecioAutomaticoStrategy.js:129` |

### 17.3 Referencias que **no** están en el repositorio

- **No hay bibliografía, referencias académicas ni citas bibliográficas** de ningún
  tipo.
- **No hay `LICENSE`** para el proyecto ni para las dependencias.
- **No hay `NOTICE`** de atribución de Lucide, Chart.js, Inter o Roboto Mono.
- **No hay `CODE_OF_CONDUCT`** ni `SECURITY.md` ni `CONTRIBUTING.md`.

---

## 18. Información faltante

Esta sección lista explícitamente todo lo que un índice formal de informe académico
suele pedir y que **NO** está en el repositorio.

### 18.1 Contexto organizacional y de problema

| # | Falta | Estado |
|---|---|---|
| 1 | **Organización cliente o entidad depositaria** | No existe. No hay ninguna mención de una empresa, institución o cliente. |
| 2 | **Misión, visión, valores de la organización** | No documentado. |
| 3 | **Problema u oportunidad detectada** | No documentado. No hay análisis del problema. |
| 4 | **Justificación del proyecto** (por qué se hizo, qué motivó la creación) | No documentado. |
| 5 | **Análisis de la competencia o de herramientas existentes** | No documentado. |
| 6 | **Benchmarking** | No documentado. |
| 7 | **Alcance geográfico o de mercado** | No documentado. Solo se infiere uso de divisas PEN/USD/USDT. |
| 8 | **Costo del proyecto** (horas, presupuesto, licencias) | No documentado. |
| 9 | **Plan de negocio o modelo de ingresos** | No documentado. El proyecto parece personal (autor único: `david`). |
| 10 | **Estatus de propiedad intelectual** (privado / comercial) | No documentado. No hay `LICENSE`. |

### 18.2 Equipo de desarrollo

| # | Falta | Estado |
|---|---|---|
| 11 | **Equipo de desarrollo** | No documentado. El historial Git muestra un **único autor** (`david`) en los 26 commits. No hay nombres de roles (analista, desarrollador, arquitecto, probador, líder de proyecto). |
| 12 | **Organigrama del equipo** | No existe. |
| 13 | **Roles y responsabilidades** (RACI) | No existe. |
| 14 | **Currículos o perfiles del equipo** | No existen. |
| 15 | **Herramientas de gestión de tareas** (Jira, Trello, GitHub Projects) | No hay rastro. No existe carpeta `.github/`. |
| 16 | **Número de personas involvedidas en cada fase** | No documentado. |

### 18.3 Metodología de investigación y validación

| # | Falta | Estado |
|---|---|---|
| 17 | **Entrevistas con usuarios** | No existen. No hay transcripciones, guiones ni notas. |
| 18 | **Encuestas** | No existen. |
| 19 | **Pretest / postest** | No existen. |
| 20 | **Análisis estadístico de datos** | No documentado. Solo hay métricas técnicas de caché (`js/core/cache.js:132-150`). |
| 21 | **Métodos de investigación** (observación, grupos focales, benchmarking) | No documentado. |
| 22 | **Definición de la población y muestra** | No documentado. |
| 23 | **Consentimiento informado / ética de investigación** | No documentado. |
| 24 | **Evaluación de usabilidad con usuarios** (SUS, System Usability Scale) | No existe. Solo hay autoauditorías técnicas (`docs/auditoria-dashboard.md`). |
| 25 | **Diagrama de proceso AS-IS (situación actual previa)** | No existe. |
| 26 | **Diagrama de proceso TO-BE (situación propuesta)** | No existe. Solo se puede reconstruir desde el código (ver sección 9.2). |
| 27 | **Diagrama BPMN** | No existe. |
| 28 | **Diagrama DFD** | No existe. |
| 29 | **Manual de usuario / manual de procedimientos** | No existe. |
| 30 | **Manual de instalación y despliegue** | No existe. Solo hay 5 scripts en `package.json`. |
| 31 | **Catálogo de requisitos con identificadores y trazabilidad** | Parcial: se puede reconstruir (ver sección 7), pero no existe en el repo. `docs/requisitos.md` no asigna IDs. |
| 32 | **Priorización de requisitos** | Parcial: `docs/roadmap.md:25-34` tiene prioridades Alta/Media para 7 tareas, no para los requisitos. |
| 33 | **Matriz de trazabilidad requisito → diseño → implementación → prueba** | No existe. |

### 18.4 Diseño técnico

| # | Falta | Estado |
|---|---|---|
| 34 | **Documento de arquitectura de software (SADT, 4+1, etc.)** | No existe. Solo hay la estructura de carpetas, que se puede inferir. |
| 35 | **Diagrama de arquitectura de componentes** | No existe. |
| 36 | **Diagrama de secuencia** | No existe. |
| 37 | **Diagrama de clases /uml** | No existe. |
| 38 | **Diagrama ER** | Parcial: existe un árbol de colecciones en texto (`docs/modelo-datos.md:15-31`), pero **no hay diagrama ER formal** (el enunciado menciona un "erDiagram" que **no existe** en el repo). |
| 39 | **Documento de decisión de arquitectura (ADR)** | No existe. Las decisiones están en comentarios de código pero no formalizadas. |
| 40 | **Catálogo de APIs / especificación de la API interna** | No existe. |
| 41 | **Especificación formal del formato `.dvid`** | Parcial: `docs/modelo-datos.md:269-284` describe la evolución; falta una especificación formal. |
| 42 | **Modelo de amenazas (STRIDE u otro)** | No existe. |
| 43 | **Análisis de riesgos de seguridad** | No existe. Solo hay un bloque de riesgos técnicos del dashboard (`docs/propuesta-dashboard.md:249-256`). |
| 44 | **Análisis de rendimiento (métricas, Lighthouse)** | No existe. |
| 45 | **Presupuesto de rendimiento (objetivos medibles)** | No documentado. |
| 46 | **Justificación de los navegadores objetivo** | No documentado. |

### 18.5 Calidad, pruebas y mantenimiento

| # | Falta | Estado |
|---|---|---|
| 47 | **Pruebas automatizadas** | **NO EXISTEN.** 0 archivos de test. |
| 48 | **Informe de cobertura de pruebas** | No existe. |
| 49 | **Casos de prueba documentados** | No existen. |
| 50 | **Registro de resultados de pruebas** | No existe. |
| 51 | **Plan de pruebas (de aceptación, de regresión, de integración)** | No existe. Solo una tarea de roadmap (`docs/roadmap.md:40`). |
| 52 | **Configuración de linter o formateador** | **NO EXISTE.** |
| 53 | **Documentación de accesibilidad y auditoría WCAG** | No existe. Solo autoauditorías parciales. |
| 54 | **Plan de mantenimiento evolutivo** | No documentado. |
| 55 | **Plan de respaldos y recuperación ante desastres** | No documentado. |
| 56 | **Política de versionamiento (semver)** | Parcial: se usa `1.0.0-beta.15` (`constants/version.js:2`), pero no hay documento que defina la política. |
| 57 | **Changelog** | No existe. |
| 58 | **Política de soporte de versiones** | No documentada. |
| 59 | **Registro de incidencias / bugs** | No existe. |
| 60 | **Documentación de despliegue y operación** | No existe. |
| 61 | **Monitoreo y alertas** | No existen. |
| 62 | **Plan de escalamiento** | No documentado. |

### 18.6 Planificación de proyecto

| # | Falta | Estado |
|---|---|---|
| 63 | **WBS (Work Breakdown Structure)** | No existe. |
| 64 | **Cronograma / diagrama de Gantt** | No existe. |
| 65 | **Estimaciones de esfuerzo** | No documentadas. |
| 66 | **Lean Canvas** | No existe. |
| 67 | **Business Model Canvas** | No existe. |
| 68 | **Value Proposition Canvas** | No existe. |
| 69 | **Personas / mapa de empathize** | No existe. |
| 70 | **Matriz de riesgos de proyecto** | No existe. |
| 71 | **Plan de recursos** | No documentado. |
| 72 | **Presupuesto** | No documentado. |
| 73 | **Cronograma de releases** | No documentado. |
| 74 | **Acta de constitution del proyecto** | No existe. |

### 18.7 Contexto de uso y despliegue

| # | Falta | Estado |
|---|---|---|
| 75 | **Número de usuarios reales** | No documentado. |
| 76 | **Entornos dev/staging/prod separados** | No existen. Solo un proyecto Firebase. |
| 77 | **Pipeline de CI/CD** | No existe. |
| 78 | **Documentación de la infraestructura de despliegue** | Parcial: solo `firebase.json` y `.firebaserc`. |
| 79 | **Política de privacidad y tratamiento de datos** | No documentada. La app maneja datos financieros. |
| 80 | **Cumplimiento normativo** (protection de datos personales) | No documentado. |
| 81 | **Licencias de todas las dependencias** | Parcial: se menciona ISC para Lucide (`js/core/iconos.js:6`), pero no hay inventario. |
| 82 | **Manual de respaldo y restauración** | No documentado. |
| 83 | **Documento de pérdida de datos (data loss)** | No documentado. |
| 84 | **SLA / acuerdo de nivel de servicio** | No documentado. |

### 18.8 Evaluación de resultados

| # | Falta | Estado |
|---|---|---|
| 85 | **Métricas de uso** (usuarios activos, frecuencia) | No existen. Sin analytics. |
| 86 | **Métricas de impacto** (ahorro de tiempo, reducción de errores) | No documentadas. |
| 87 | **Resultados de pruebas de usabilidad** | No existen. |
| 88 | **Comparación de métricas antes/después** | No documentada. |
| 89 | **Retroalimentación de usuarios** | No documentada. |
| 90 | **Balance del proyecto** | No documentado. |

### 18.9 Elementos técnicos concretos ausentes

| # | Falta | Estado |
|---|---|---|
| 91 | **`README.md`** | No existe. |
| 92 | **`CHANGELOG.md`** | No existe. |
| 93 | **`CONTRIBUTING.md`** | No existe. |
| 94 | **`LICENSE`** | No existe. |
| 95 | **`SECURITY.md`** | No existe. |
| 96 | **`CODE_OF_CONDUCT.md`** | No existe. |
| 97 | **Configuración de linter/formateador** | No existe. |
| 98 | **Suite de tests** | No existe. |
| 99 | **Configuración de CI/CD** (`.github/`) | No existe. |
| 100 | **Limpieza del repositorio** | Parcial: `firestore-debug.log` sigue presente (0 bytes) pese a `docs/roadmap.md:19-21`. |

---

## Resumen del levantamiento

### Estado de las secciones

| Sección | Estado | Observación |
|---|---|---|
| 1. Descripción del proyecto | **Completa** | Solo falta el propósito de negocio y el cliente; la descripción técnica está bien cubierta. |
| 2. Stack tecnológico | **Completa** | Todas las tecnologías con versión y ubicación. Falta el "por qué" de HTML/CSS/fuentes y la elección de CDN vs npm. |
| 3. Arquitectura del software | **Completa** | Capas, comunicación, estado y navegación documentados con citas. |
| 4. Modelo de datos | **Completa** | Todas las colecciones, campos, relaciones, índices y reglas. Se detectaron y listaron discrepancias con `docs/modelo-datos.md`. |
| 5. Módulos y funcionalidades | **Completa** | Los 6 módulos con funcionalidades, servicios, repositorios, modales y acciones de lastbar. |
| 6. Seguridad implementada | **Completa** | Auth, reauth, reglas, validación, sesión y sanitización. Hallazgo crítico de XSS documentado. |
| 7. Requerimientos funcionales | **Completa** | 12 grupos, ~120 requisitos con ID y evidencia. Reconstruido desde el código. |
| 8. Requerimientos no funcionales | **Parcial** | Rendimiento, usabilidad, PWA y mantenibilidad cubiertos. **Falta**: matriz de compatibilidad de navegadores, presupuesto de rendimiento, nivel WCAG objetivo. |
| 9. Proceso actual vs. propuesto | **Parcial** | El flujo TO-BE se reconstruyó desde el código. **Falta por completo** el proceso AS-IS y cualquier declaración de mejora medida. |
| 10. Planificación | **Parcial** | Roadmap y 3 fases existen. **Falta**: WBS, cronograma, estimaciones, Lean Canvas, matriz de riesgos. |
| 11. Pruebas | **Parcial** | Solo hay `test-cache.html` y `exp.js`. **Falta**: todo lo demás (tests, casos, plan, resultados, cobertura). |
| 12. Despliegue | **Completa** | Firebase Hosting, 5 scripts, sin entornos separados, sin CI/CD. |
| 13. Control de versiones | **Completa** | Git, 26 commits, un autor, rama `main`, remoto en GitHub. |
| 14. Mantenimiento | **Completa** | Backups implementados pero sin plan; logs de consola; sin monitoreo. |
| 15. Documentación existente | **Completa** | 6 documentos inventariados, con su estado de actualización y 19 faltantes. |
| 16. Glosario de términos | **Completa** | ~85 términos técnicos y financieros definidos. |
| 17. Referencias | **Completa** | URLs de Firebase, Chart.js, Lucide, fuentes y APIs externas. |
| 18. Información faltante | **Completa** | 100 ítems ausentes catalogados. |

**Totales**: **13 secciones completas**, **5 secciones parciales**, **0 secciones vacías**.

### Información imprescindible que NO está

En orden de criticidad para un informe académico formal:

1. **No hay organización cliente ni contexto de proyecto** (ítems 1-10 de la
   sección 18.1). Sin esto, el informe no puede situar el proyecto.
2. **No hay equipo de desarrollo documentado** (sección 18.2). El Git solo revela un
   autor.
3. **No hay ningún proceso AS-IS documentado** (sección 9.1). Sin el "antes", el
   comparativo de la sección 9 no puede sostenerse formalmente.
4. **No hay ningún tipo de prueba automatizada** (sección 18.5). Si el índice exige
   cobertura de pruebas o calidad de software, el dato **no existe**.
5. **No hay métricas de resultados** (sección 18.8). Sin analytics, no hay cifras de
   uso, impacto ni comparación.
6. **No hay cronograma, WBS ni estimaciones** (sección 18.6). La planificación solo
   puede apoyarse en el roadmap de fases, que además está desactualizado.
7. **No hay Lean Canvas ni Business Model Canvas** (sección 18.6).
8. **No hay `README.md`**, por lo que la instalación y el uso no están documentados
   para un tercero.
9. **No hay LICENCIA**, lo que impide afirmar nada sobre la reutilización del
   código.
10. **No hay BPMN ni diagramas formales** (sección 18.3). Los diagramas que sí existen
    son solo texto (árbol de colecciones) y están en un documento obsoleto.

### Recomendaciones para adaptar el informe

1. **Marcar explícitamente qué secciones no aplican** a un proyecto personal de
   un solo autor, en lugar de dejarlas vacías.
2. **Usar la evidencia del código** como fuente primaria y citar siempre
   `archivo:línea`, como se ha hecho en este documento.
3. **Reconstruir los diagramas faltantes** (arquitectura por capas, flujo de usuario,
   modelo de datos) a partir de este levantamiento; toda la información necesaria
   está aquí.
4. **Para el comparativo AS-IS/TO-BE**, usar la reconstrucción de la sección 9.2 como
   TO-BE y declarar explícitamente que el AS-IS no fue documentado por el autor.
5. **Para el apartado de calidad**, presentar la ausencia de pruebas automatizadas
   como un hallazgo y delimitarlo con las pruebas manuales que sí existen
   (`test-cache.html`) y con las autoauditorías escritas.
6. **Para el apartado de seguridad**, apoyarse en las reglas de Firestore
   (`firebase/firestore.rules`) como evidencia sólida, y reportar el hallazgo de
   XSS almacenado de autoataque como riesgo identificado y mitigado por aislamiento.
7. **Para el apartado de resultados**, no inventar cifras. Si el índice exige
   métricas, declarar que no se recogieron.

---

*Fin del documento de levantamiento.*

