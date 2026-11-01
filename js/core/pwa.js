import { mostrarNotificacion } from "../ui/notificaciones.js"

// ============================================
// PWA · Registro del Service Worker
// ============================================
// El SW ya no depende de subir VERSION.numero: cada despliegue tiene su
// BUILD_ID y el nombre de la caché incluye los dos. Aquí solo hay que
// asegurarse de que el navegador COMPRUEBE si hay una versión nueva y de que la
// página se recargue una única vez cuando el SW nuevo toma el control.
// ============================================

const INTERVALO_COMPROBACION_MINUTOS = 60
const MINIMO_ENTRE_COMPROBACIONES_MS = 5 * 60 * 1000
const CLAVE_SW_DEV = "escinco_sw_dev"

let registroSW = null
let intervaloComprobacion = null
let ultimaComprobacion = 0
let escuchandoControl = false
let recargando = false

export function initPWA() {
    if (!("serviceWorker" in navigator)) {
        console.log("[PWA] Service Worker no soportado")
        return
    }

    if (esEntornoDeDesarrollo() && !swHabilitadoEnDesarrollo()) {
        console.log("[PWA] SW no registrado en desarrollo (localhost / 127.0.0.1)")
        limpiarSWEnDesarrollo()
        return
    }

    if (document.readyState === "complete") {
        registrarSW()
        return
    }

    window.addEventListener("load", registrarSW, { once: true })
}

// Evita el SW pegado en desarrollo comprobando el host local. Para probar el
// service worker en localhost: `localStorage.setItem("escinco_sw_dev", "1")`.
function esEntornoDeDesarrollo() {
    const host = window.location.hostname
    return host === "localhost" || host === "127.0.0.1"
}

function swHabilitadoEnDesarrollo() {
    try {
        return window.localStorage.getItem(CLAVE_SW_DEV) === "1"
    } catch {
        return false
    }
}

// Elimina un SW viejo que haya quedado registrado de sesiones anteriores
async function limpiarSWEnDesarrollo() {
    try {
        const registracion = await navigator.serviceWorker.getRegistration()
        if (!registracion) return

        await registracion.unregister()
        console.log("[PWA] SW antiguo eliminado en desarrollo")

        // Recargar una sola vez para soltar el control del SW viejo
        if (navigator.serviceWorker.controller) {
            recargarUnaVez()
        }
    } catch (error) {
        console.warn("[PWA] No se pudo limpiar el SW en desarrollo:", error)
    }
}

async function registrarSW() {
    try {
        registroSW = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            type: "module",
            // No permitir que el HTTP cache sirva un sw.js viejo: si el
            // navegador se queda con la copia anterior, nunca ve el despliegue.
            updateViaCache: "none"
        })
        console.log("[PWA] SW registrado:", registroSW.scope)

        // El listener va ANTES de update(): si la comprobación termina muy
        // rápido, el `updatefound` no se pierde.
        registroSW.addEventListener("updatefound", manejarActualizacion)
        escucharCambioDeControl()

        // Forzar comprobación de actualización en cada carga
        comprobarActualizacion({ forzar: true })

        programarComprobacionPeriodica()
        programarComprobacionAlVolver()
    } catch (error) {
        console.warn("[PWA] Error registrando SW:", error)
    }
}

// Un solo listener para toda la vida de la página: `controllerchange` puede
// dispararse más de una vez y no queremos dos recargas seguidas.
function escucharCambioDeControl() {
    if (escuchandoControl) return
    escuchandoControl = true

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("[PWA] El SW nuevo controla la página")
        recargarUnaVez()
    })
}

function recargarUnaVez() {
    if (recargando) return
    recargando = true
    window.location.reload()
}

// Comprueba actualizaciones mientras la app sigue abierta
function programarComprobacionPeriodica() {
    if (intervaloComprobacion) return

    intervaloComprobacion = setInterval(() => {
        comprobarActualizacion({ forzar: true })
    }, INTERVALO_COMPROBACION_MINUTOS * 60 * 1000)
}

// Al volver a la pestaña (o al recuperar la conexión) se mira si hay algo
// nuevo, como mucho una vez cada 5 minutos para no golpear al servidor.
function programarComprobacionAlVolver() {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") comprobarActualizacion()
    })

    window.addEventListener("online", () => comprobarActualizacion({ forzar: true }))
}

function comprobarActualizacion({ forzar = false } = {}) {
    if (!registroSW) return

    const ahora = Date.now()
    if (!forzar && ahora - ultimaComprobacion < MINIMO_ENTRE_COMPROBACIONES_MS) return
    ultimaComprobacion = ahora

    registroSW.update().catch(error => console.warn("[PWA] update()", error))
}

function manejarActualizacion() {
    const nuevoSW = registroSW?.installing
    if (!nuevoSW) return

    nuevoSW.addEventListener("statechange", () => {
        if (nuevoSW.state === "installed" && navigator.serviceWorker.controller) {
            console.log("[PWA] Nueva versión instalada")
            aplicarActualizacion()
        }
    })
}

// Aplica la versión nueva sin pedir nada al usuario. Si el SW nuevo ya llamó a
// skipWaiting() en su install, el relevo ocurre solo y `controllerchange`
// recarga. Si se quedó en `waiting` (SW antiguo sin skipWaiting), se le pide el
// relevo y se recarga con un límite de tiempo por si el mensaje no llega.
function aplicarActualizacion() {
    const enEspera = registroSW?.waiting

    if (!enEspera) {
        // Sin relevo pendiente no hay nada que forzar; si la página no tiene
        // controlador es una primera instalación y tampoco hay que recargar.
        return
    }

    enEspera.postMessage({ tipo: "SKIP_WAITING" })

    setTimeout(() => {
        if (!recargando) recargarUnaVez()
    }, 5000)
}

function mostrarAvisoActualizacion() {
    mostrarNotificacion("info", "Hay una nueva versión disponible", 0, {
        texto: "Actualizar",
        alClick: () => aplicarActualizacion()
    })
}

if (typeof window !== "undefined") {
    window.mostrarAvisoActualizacion = mostrarAvisoActualizacion
}
