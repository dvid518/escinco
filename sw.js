import { VERSION } from "./constants/version.js"
import { BUILD_ID } from "./constants/build.js"

// ============================================
// SERVICE WORKER · escinco
// ============================================
// Objetivo: que un despliegue nuevo llegue al navegador sin que nadie tenga que
// limpiar la caché, y que la app siga funcionando sin conexión.
//
// Dos identificadores distintos, a propósito:
//   · VERSION.numero (constants/version.js) → versión COMERCIAL del producto.
//   · BUILD_ID (constants/build.js)         → despliegue TÉCNICO concreto.
// El nombre de la caché lleva los dos: cambiar cualquiera de ellos estrena
// caché y tira la anterior. BUILD_ID lo genera tools/generar-build.mjs desde el
// `predeploy` de firebase.json, así que no depende de subir la versión a mano.
//
// Estrategias (y por qué):
//   · Navegaciones  → red primero. Nunca se sirve un HTML viejo teniendo red.
//   · JS/CSS        → red primero. El código nuevo manda en la PRIMERA carga.
//   · Fuentes       → caché primero (no cambian nunca; ahorran 2 MB de red).
//   · Iconos/imgs   → stale-while-revalidate (pueden esperar una carga).
//   · Otros orígenes (SDK de Firebase en gstatic, fuentes de Google, analítica)
//                    → no se interceptan: los gestiona el navegador.
// ============================================

const CACHE_SHELL = `escinco-${VERSION.numero}-${BUILD_ID}-shell`
const CACHE_RUNTIME = `escinco-${VERSION.numero}-${BUILD_ID}-runtime`

// Prefijo propio: `activate` solo borra cachés que empiecen por aquí. Nunca
// toca cachés de otras apps del mismo origen.
const PREFIJO_CACHE = "escinco-"

// ============================================
// PRECACHÉ (lo mínimo para arrancar sin red)
// ============================================
// Todo lo de esta lista se descarga con `cache: "reload"` (saltándose el HTTP
// cache del navegador) y, si algo falla, la instalación se aborta entera: es
// preferible seguir con el SW anterior que quedarse con un offline a medias.
//
// NO se incluye `/index.html`: el target `app` no lo publica (firebase.json lo
// ignora), así que pedirlo daría 404 y tumbaría la instalación. La portada de
// cada sitio se cachea como `/`, que sí responde en los dos targets (landing →
// index.html, app → dashboard.html). Las fuentes tampoco se precachean: son
// 2 MB y se cachean en caliente con cache-first.
const SHELL_ASSETS = [
    // Documentos
    "/",
    "/demo.html",
    "/dashboard.html",
    "/auth.html",
    "/reset-password.html",
    "/privacidad.html",
    "/terminos.html",
    "/tratamiento-datos.html",
    "/404.html",
    "/manifest.webmanifest",

    // SEO
    "/robots.txt",
    "/sitemap.xml",

    // CSS
    "/css/style.css",
    "/css/index.css",
    "/css/home.css",
    "/css/demo.css",
    "/css/auth.css",
    "/css/dashboard.css",
    "/css/navegacion.css",
    "/css/cuentas.css",
    "/css/movimientos.css",
    "/css/inversiones.css",
    "/css/trading.css",
    "/css/configuracion.css",
    "/css/pendientes.css",
    "/css/modal.css",
    "/css/componentes.css",
    "/css/iconos.css",
    "/css/legal.css",
    "/css/404.css",

    // JS core
    "/js/core/app.js",
    "/js/core/estilos.js",
    "/js/core/router.js",
    "/js/core/sesion.js",
    "/js/core/supresorClick.js",
    "/js/core/tema.js",
    "/js/core/lastbar.js",
    "/js/core/pwa.js",
    "/js/core/iconos.js",
    "/js/core/cache.js",
    "/js/core/descarga.js",
    "/js/core/fechas.js",
    "/js/core/movimientos.js",
    "/js/core/familiaCuentas.js",
    "/js/core/atajos.js",
    "/js/core/escape.js",
    "/js/core/etiquetas.js",
    "/js/core/iaConfig.js",
    "/js/core/gtm.js",

    // JS lib (third-party, self-hosted)
    "/js/lib/sortable.min.js",

    // JS pages
    "/js/pages/index.js",
    "/js/pages/auth.js",
    "/js/pages/reset-password.js",
    "/js/pages/legal.js",
    "/js/pages/dashboard.js",
    "/js/pages/cuentas.js",
    "/js/pages/movimientos.js",
    "/js/pages/inversiones.js",
    "/js/pages/trading.js",
    "/js/pages/404.js",

    // JS UI
    "/js/ui/modal.js",
    "/js/ui/asistente.js",
    "/js/ui/textoEnriquecido.js",
    "/js/ui/configuracion.js",
    "/js/ui/panelVersion.js",
    "/js/ui/formularioMovimiento.js",
    "/js/ui/pendientes.js",
    "/js/ui/metas.js",
    "/js/ui/presupuestos.js",
    "/js/ui/graficos.js",
    "/js/ui/notificaciones.js",
    "/js/ui/exportar.js",
    "/js/ui/colapsoSidebar.js",
    "/js/ui/skeletons.js",
    "/js/ui/scrollEdges.js",
    "/js/ui/seleccion.js",
    "/js/ui/etiquetas.js",
    "/js/ui/accionesLista.js",
    "/js/ui/doodles.js",

    // JS models
    "/js/models/Activo.js",
    "/js/models/Posicion.js",
    "/js/models/Pendiente.js",
    "/js/models/Trade.js",
    "/js/models/Orden.js",
    "/js/models/Meta.js",
    "/js/models/Estrategia.js",
    "/js/models/Etiqueta.js",
    "/js/models/Favorito.js",
    "/js/models/Presupuesto.js",

    // JS repositories
    "/js/repositories/ActivoRepositorio.js",
    "/js/repositories/PosicionRepositorio.js",
    "/js/repositories/PendienteRepositorio.js",
    "/js/repositories/TradeRepositorio.js",
    "/js/repositories/SnapshotRepositorio.js",
    "/js/repositories/HistorialRepositorio.js",
    "/js/repositories/OrdenRepositorio.js",
    "/js/repositories/MetaRepositorio.js",
    "/js/repositories/EstrategiaRepositorio.js",
    "/js/repositories/PrecioRepositorio.js",
    "/js/repositories/EtiquetaRepositorio.js",
    "/js/repositories/FavoritoRepositorio.js",
    "/js/repositories/PresupuestoRepositorio.js",

    // JS services
    "/js/services/ActivoServicio.js",
    "/js/services/AuthServicio.js",
    "/js/services/AnalyticsServicio.js",
    "/js/services/PosicionServicio.js",
    "/js/services/PendienteServicio.js",
    "/js/services/TradingServicio.js",
    "/js/services/MovimientoServicio.js",
    "/js/services/DeshacerServicio.js",
    "/js/services/SnapshotServicio.js",
    "/js/services/HistorialServicio.js",
    "/js/services/DivisaServicio.js",
    "/js/services/CreditoServicio.js",
    "/js/services/ExportarServicio.js",
    "/js/services/ImportarServicio.js",
    "/js/services/EliminarServicio.js",
    "/js/services/OrdenServicio.js",
    "/js/services/MetaServicio.js",
    "/js/services/EstrategiaServicio.js",
    "/js/services/PrecioServicio.js",
    "/js/services/FavoritoServicio.js",
    "/js/services/PresupuestoServicio.js",
    "/js/services/IaServicio.js",
    "/js/services/ContextoServicio.js",
    "/js/services/VozServicio.js",
    "/js/services/DrovServicio.js",

    // JS firebase
    "/firebase/firebaseClient.js",
    "/firebase/config.js",
    "/firebase/auth.js",
    "/firebase/firestore.js",

    // JS demo
    "/js/demo/demo.js",
    "/js/demo/fixture.js",
    "/firebase/demo/store.js",
    "/firebase/demo/firestore.js",
    "/firebase/demo/auth.js",
    "/firebase/demo/app.js",
    "/firebase/demo/analytics.js",

    // JS constants
    "/constants/version.js",
    "/constants/build.js",
    "/constants/tiposMovimiento.js",
    "/constants/divisas.js",

    // JS strategies
    "/js/strategies/ManualPrecioStrategy.js",
    "/js/strategies/PrecioAutomaticoStrategy.js",

    // JS libs (chart.js servido en local)
    "/js/lib/chart.umd.min.js",

    // Iconos
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
    "/icons/favicon-dark.svg",
    "/icons/favicon-light.svg"
]

// ============================================
// INSTALL
// ============================================

self.addEventListener("install", (event) => {
    console.log("[SW] Install", BUILD_ID)
    event.waitUntil(precachear())
})

async function precachear() {
    const cache = await caches.open(CACHE_SHELL)
    const fallos = []

    // En serie y con `cache: "reload"`: lo que se guarda es lo que el servidor
    // está sirviendo AHORA, no una copia con `max-age` del HTTP cache.
    for (const url of SHELL_ASSETS) {
        try {
            const respuesta = await fetch(new Request(url, { cache: "reload" }))
            if (!respuesta || respuesta.status !== 200) {
                throw new Error(`HTTP ${respuesta ? respuesta.status : "sin respuesta"}`)
            }
            await cache.put(url, respuesta)
        } catch (error) {
            fallos.push(url)
            console.warn("[SW] No se pudo precachear:", url, error)
        }
    }

    if (fallos.length > 0) {
        // Instalación incompleta → no dejar un SW a medias sirviendo un offline
        // parcial. Se borra la caché y se deja al SW anterior al mando.
        await caches.delete(CACHE_SHELL)
        throw new Error(`[SW] Precache incompleto (${fallos.length}): ${fallos.join(", ")}`)
    }

    // Ya hay shell completo: se activa sin esperar a que se cierren las pestañas.
    await self.skipWaiting()
}

// ============================================
// ACTIVATE
// ============================================

self.addEventListener("activate", (event) => {
    console.log("[SW] Activate", CACHE_SHELL)
    event.waitUntil(limpiarYReclamar())
})

async function limpiarYReclamar() {
    const claves = await caches.keys()
    const propias = claves.filter(clave => clave.startsWith(PREFIJO_CACHE))
    const sobrantes = propias.filter(clave => clave !== CACHE_SHELL && clave !== CACHE_RUNTIME)

    await Promise.all(sobrantes.map(clave => {
        console.log("[SW] Eliminando caché antigua de escinco:", clave)
        return caches.delete(clave)
    }))

    // Las cachés de otras apps del mismo origen se quedan como están.
    await self.clients.claim()
}

// ============================================
// FETCH
// ============================================

self.addEventListener("fetch", (event) => {
    const { request } = event
    if (request.method !== "GET") return

    const url = new URL(request.url)
    if (!url.protocol.startsWith("http")) return

    // Solo se atiende lo del propio origen. Un `fetch()` lanzado por el SW se
    // evalúa contra el `connect-src` de la CSP de la página; si interceptáramos
    // el SDK de Firebase (gstatic) y esa directiva no lo incluyera, el módulo
    // fallaría con "Refused to connect" y el login se quedaría sin SDK. Además,
    // gstatic ya sirve esos archivos con caché inmutable: el navegador los
    // gestiona mejor sin nosotros.
    if (url.origin !== self.location.origin) return

    // Consultas que el navegador debe resolver con su propio HTTP cache
    // (`only-if-cached` no puede ir a red por definición).
    if (request.cache === "only-if-cached") return

    // 1. Navegaciones → red primero + respaldo offline.
    if (request.mode === "navigate") {
        event.respondWith(redPrimero(event, CACHE_RUNTIME, () => respaldoOffline(url.pathname)))
        return
    }

    // 2. Código del propio sitio (JS/CSS) → red primero: el cambio se ejecuta
    //    en la primera carga. Si no hay red, se sirve la copia cacheada.
    if (esCodigo(url)) {
        event.respondWith(redPrimero(event, CACHE_RUNTIME, null))
        return
    }

    // 3. Fuentes → caché primero (los .ttf no cambian de contenido).
    if (esFuente(url) || request.destination === "font") {
        event.respondWith(cachePrimero(event, CACHE_RUNTIME))
        return
    }

    // 4. Iconos, imágenes y resto de estáticos → stale-while-revalidate.
    event.respondWith(redYLuegoCache(event, CACHE_RUNTIME))
})

// ============================================
// CLASIFICACIÓN DE PETICIONES
// ============================================

function esCodigo(url) {
    return /\.(js|mjs|css)$/i.test(url.pathname)
}

function esFuente(url) {
    return /\.(ttf|otf|woff|woff2)$/i.test(url.pathname)
}

// ============================================
// HTML DE RESPALDO SIN CONEXIÓN
// ============================================
// Cada sitio (landing / app) guarda su portada en la clave `/`, así que el
// respaldo no depende de adivinar el host: se sirve la `/` cacheada en ESTE
// origen. Antes se comparaba contra una lista de hosts (app.escinco.com,
// app-escinco.web.app) y cualquier otro dominio de la app —por ejemplo
// app-escinco.firebaseapp.com— caía en un index.html que la app no publica.
async function respaldoOffline(ruta) {
    const shell = await caches.open(CACHE_SHELL)
    const runtime = await caches.open(CACHE_RUNTIME)

    const candidatos = []
    if (ruta.startsWith("/demo")) candidatos.push("/demo.html")
    if (ruta === "/login" || ruta === "/register") candidatos.push("/auth.html")
    if (ruta === "/reset-password") candidatos.push("/reset-password.html")
    candidatos.push("/")

    for (const candidato of candidatos) {
        const respuesta = await shell.match(candidato, { ignoreSearch: true })
        if (respuesta) return respuesta
        const enRuntime = await runtime.match(candidato, { ignoreSearch: true })
        if (enRuntime) return enRuntime
    }

    return paginaSinConexion()
}

function paginaSinConexion() {
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>escinco | Sin conexión</title>
</head>
<body>
<main>
<h1>Sin conexión</h1>
<p>No hay red y esta página todavía no estaba guardada en el dispositivo.</p>
<p>Vuelve a conectarte y recarga para continuar.</p>
</main>
</body>
</html>`
    return new Response(html, {
        status: 503,
        statusText: "Sin conexión",
        headers: { "Content-Type": "text/html; charset=utf-8" }
    })
}

// ============================================
// ESTRATEGIAS
// ============================================

// Extiende la vida del evento para que la escritura en caché no se cancele al
// responder. Si el evento ya cerró, la promesa sigue su curso igualmente.
function esperar(evento, promesa) {
    try {
        evento.waitUntil(promesa)
    } catch {
        /* el evento ya no admite waitUntil: la escritura no es crítica */
    }
}

function sePuedeGuardar(respuesta) {
    return !!respuesta && respuesta.status === 200 && (respuesta.type === "basic" || respuesta.type === "cors")
}

// Evita que el HTTP cache del navegador devuelva un JS/CSS viejo aunque algún
// día se configure un `max-age` largo por error. `no-store` y `only-if-cached`
// se respetan tal cual porque expresan una intención explícita del que llama.
function peticionFresca(request) {
    if (request.cache === "no-store") return request
    try {
        return new Request(request, { cache: "no-cache" })
    } catch {
        return request
    }
}

async function redPrimero(evento, cacheName, alFallar) {
    const { request } = evento

    try {
        const respuesta = await fetch(peticionFresca(request))
        if (sePuedeGuardar(respuesta)) {
            const cache = await caches.open(cacheName)
            esperar(evento, cache.put(request, respuesta.clone()).catch(() => {}))
        }
        return respuesta
    } catch (error) {
        const enCache = await buscarEnCachesPropias(request)
        if (enCache) return enCache

        if (alFallar) {
            const respaldo = await alFallar()
            if (respaldo) return respaldo
        }
        throw error
    }
}

async function cachePrimero(evento, cacheName) {
    const { request } = evento
    const cache = await caches.open(cacheName)
    const enCache = await cache.match(request)
    if (enCache) return enCache

    try {
        const respuesta = await fetch(request)
        if (sePuedeGuardar(respuesta)) {
            esperar(evento, cache.put(request, respuesta.clone()).catch(() => {}))
        }
        return respuesta
    } catch (error) {
        const otra = await buscarEnCachesPropias(request)
        if (otra) return otra
        throw error
    }
}

async function redYLuegoCache(evento, cacheName) {
    const { request } = evento
    const cache = await caches.open(cacheName)
    const enCache = await cache.match(request)

    const desdeRed = fetch(request)
        .then(respuesta => {
            if (sePuedeGuardar(respuesta)) {
                esperar(evento, cache.put(request, respuesta.clone()).catch(() => {}))
            }
            return respuesta
        })
        .catch(() => null)

    if (enCache) {
        // Se responde ya con la copia y la red se resuelve en segundo plano.
        esperar(evento, desdeRed)
        return enCache
    }

    const respuesta = await desdeRed
    if (respuesta) return respuesta

    const otra = await buscarEnCachesPropias(request)
    if (otra) return otra
    throw new Error(`[SW] Sin red ni caché para ${request.url}`)
}

// Busca SOLO en las cachés de escinco: `caches.match()` recorre todas las del
// origen y podría devolver la copia de otra aplicación.
async function buscarEnCachesPropias(request) {
    for (const cacheName of [CACHE_RUNTIME, CACHE_SHELL]) {
        const cache = await caches.open(cacheName)
        const respuesta = await cache.match(request)
        if (respuesta) return respuesta
    }
    return null
}

// ============================================
// MENSAJES (para forzar el relevo desde la app)
// ============================================

self.addEventListener("message", (event) => {
    if (event.data?.tipo === "SKIP_WAITING") {
        self.skipWaiting()
    }
})
