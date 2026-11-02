import { analytics, logEvent, setUserId, setUserProperties } from "../../firebase/firebaseClient.js"

// DebugView: activa el modo depuración de Analytics en localhost o con el
// parámetro ?debug_analytics en la URL. Útil para ver eventos en tiempo real
// con la extensión de Chrome de Firebase. Se envuelve en try/catch para que
// nunca falle al importarse (entornos de test, sin window, etc.).
function activarDebugView() {
    try {
        const enLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1"
        const parametroDebug = location.search.includes("debug_analytics")
        if (!enLocalhost && !parametroDebug) return
        // eslint-disable-next-line no-undef
        window.firebase.analytics().setAnalyticsCollectionEnabled(true)
        console.log("[INFO] Analytics DebugView activado")
    } catch {
        // Silencioso: si no está disponible, se ignora.
    }
}

activarDebugView()

/**
 * Rastrea una vista de pantalla (página visitada).
 * @param {string} nombrePantalla - Nombre de la pantalla, ej. "dashboard", "cuentas".
 */
export function rastrearPantalla(nombrePantalla) {
    if (!analytics) return
    try {
        logEvent(analytics, "screen_view", {
            screen_name: nombrePantalla,
            screen_class: nombrePantalla
        })
    } catch {
        // Silencioso: Analytics no debe bloquear la navegación.
    }
}

/**
 * Rastrea un evento personalizado.
 * @param {string} nombreEvento - Nombre del evento, ej. "login", "movimiento_creado".
 * @param {object} [params] - Parámetros del evento (sin datos personales ni montos).
 */
export function rastrearEvento(nombreEvento, params = {}) {
    if (!analytics) return
    try {
        logEvent(analytics, nombreEvento, params)
    } catch {
        // Silencioso: Analytics no debe bloquear la lógica de negocio.
    }
}

/**
 * Asocia los eventos posteriores a un usuario identificado.
 * @param {string} uid - UID del usuario autenticado.
 */
export function identificarUsuario(uid) {
    if (!analytics) return
    try {
        setUserId(analytics, uid)
    } catch {
        // Silencioso.
    }
}

/**
 * Establece propiedades de usuario (ej. plan: 'plana' | 'flash').
 * @param {object} props - Par clave-valor de propiedades de usuario.
 */
export function setPropiedadesUsuario(props) {
    if (!analytics) return
    try {
        setUserProperties(analytics, props)
    } catch {
        // Silencioso.
    }
}

/**
 * Registra que el usuario alcanzó el límite de su plan para una funcionalidad.
 * @param {string} funcionalidad - 'inversiones' | 'trading' | ...
 */
export function rastrearPlanLimiteAlcanzado(funcionalidad) {
    rastrearEvento("plan_limite_alcanzado", { funcionalidad })
}
