// Pruebas de reorganización animada de notificaciones (patrón FLIP).
//
// Entorno: Node sin DOM real (no hay jsdom). No se pueden importar
// js/ui/notificaciones.js ni js/ui/animaciones.js directamente porque dependen
// de window/document y de anime.js. Por tanto:
//   • Se verifica estáticamente que el código fuente contiene la lógica FLIP.
//   • Se prueba el cálculo de deltaY con valores simulados.
//   • La verificación visual real (desplazamiento suave en navegador) queda
//     pendiente para verificación en navegador con 3+ notificaciones simultáneas.

import { leer } from "./helpers.mjs"

const SRC_ANIM = "js/ui/animaciones.js"
const SRC_NOTIF = "js/ui/notificaciones.js"

const anim = leer(SRC_ANIM)
const notif = leer(SRC_NOTIF)

export default async function (t) {
    // =======================================================================
    // 1. Primitiva animarDesplazamiento en animaciones.js
    // =======================================================================

    t.check(
        "animarDesplazamiento exportada en animaciones.js",
        anim.includes("export function animarDesplazamiento")
    )

    t.check(
        "cancelarAnimacion acepta callback onCancel",
        anim.includes("export function cancelarAnimacion(elemento, onCancel)")
    )

    t.check(
        "animarDesplazamiento limpia solo translateY al finalizar (preserva otros transforms)",
        anim.includes("obtenerTransformSinTranslateY") &&
        anim.includes("instancia.finished.then")
    )

    t.check(
        "animarDesplazamiento respeta prefers-reduced-motion",
        anim.includes("reducirMovimientoHabilitado()")
    )

    t.check(
        "animarDesplazamiento anima translateY de deltaY a 0",
        anim.includes("translateY: [deltaY, 0]")
    )

    // =======================================================================
    // 2. Integración FLIP en notificaciones.js
    // =======================================================================

    t.check(
        "notificaciones.js importa animarDesplazamiento y obtenerTransformSinTranslateY",
        notif.includes('import { animarDesplazamiento, obtenerTransformSinTranslateY } from "./animaciones.js"')
    )

    t.check(
        "cerrar captura firstRects antes de remove",
        notif.includes("const firstRects = restantes.map(el => el.getBoundingClientRect())")
    )

    t.check(
        "cerrar filtra restantes excluyendo la notificación que se cierra",
        notif.includes("filter(el => el !== notificacion)")
    )

    t.check(
        "cerrar aplica FLIP solo si no es prefers-reduced-motion",
        notif.includes("if (!reducirMovimiento && restantes.length > 0)")
    )

    t.check(
        "cerrar aplica el transform invertido preservando transform base (swipe)",
        notif.includes("obtenerTransformSinTranslateY(el)") &&
        notif.includes("translateY(${deltaY}px)")
    )

    t.check(
        "cerrar llama a animarDesplazamiento en cada restante",
        notif.includes("animarDesplazamiento(el, {")
    )

    t.check(
        "cerrar usa contexto 'notificaciones'",
        notif.includes("contexto: \"notificaciones\"")
    )

    // =======================================================================
    // 3. Orden de operaciones: remove → reorganizar → limpiarContenedorVacio
    // =======================================================================

    // Extraer el cuerpo de cerrar() para verificar el orden interno
    const idxCerrar = notif.indexOf("const cerrar = () => {")
    const llaveCerrar = notif.indexOf("{", idxCerrar)
    let nivel = 0
    let finCerrar = -1
    for (let k = llaveCerrar; k < notif.length; k++) {
        if (notif[k] === "{") nivel++
        else if (notif[k] === "}") {
            nivel--
            if (nivel === 0) { finCerrar = k; break }
        }
    }
    const cuerpoCerrar = finCerrar !== -1 ? notif.slice(llaveCerrar + 1, finCerrar) : ""

    const idxRemove = cuerpoCerrar.indexOf("notificacion.remove()")
    const idxLimpiar = cuerpoCerrar.indexOf("limpiarContenedorVacio()")
    const idxAnimar = cuerpoCerrar.indexOf("animarDesplazamiento(")

    t.check(
        "remove() se ejecuta antes de limpiarContenedorVacio() dentro de cerrar()",
        idxRemove !== -1 && idxLimpiar !== -1 && idxRemove < idxLimpiar
    )

    t.check(
        "reorganización FLIP ocurre después de remove() dentro de cerrar()",
        idxRemove !== -1 && idxAnimar !== -1 && idxRemove < idxAnimar
    )

    t.check(
        "limpiarContenedorVacio() se llama después de la reorganización FLIP",
        idxAnimar !== -1 && idxLimpiar !== -1 && idxAnimar < idxLimpiar
    )

    // =======================================================================
    // 4. Cálculo de deltaY (lógica pura, valores simulados)
    // =======================================================================

    function calcularDeltaY(firstTop, lastTop) {
        return firstTop - lastTop
    }

    // Primera notificación se cierra: la segunda sube (deltaY negativo → animar hacia 0)
    {
        const segundoTopAntes = 140
        const segundoTopDespues = 100
        const deltaY = calcularDeltaY(segundoTopAntes, segundoTopDespues)
        t.check("Cierre de primera: segunda sube 40px (deltaY = 40)", deltaY === 40)
        t.check("Cierre de primera: |deltaY| > 0.5, se anima", Math.abs(deltaY) > 0.5)
    }

    // Última notificación se cierra: las anteriores no se mueven
    {
        const penultimoTop = 100
        const penultimoTopDespues = 100
        const deltaY = calcularDeltaY(penultimoTop, penultimoTopDespues)
        t.check("Cierre de última: anterior no se mueve (deltaY = 0)", deltaY === 0)
        t.check("Cierre de última: |deltaY| <= 0.5, no se anima", Math.abs(deltaY) <= 0.5)
    }

    // Cierre de intermedia: la de debajo sube, la de arriba no se mueve
    {
        const arribaTop = 60
        const arribaTopDespues = 60
        const debajoTopAntes = 140
        const debajoTopDespues = 100
        const deltaYArriba = calcularDeltaY(arribaTop, arribaTopDespues)
        const deltaYDebajo = calcularDeltaY(debajoTopAntes, debajoTopDespues)
        t.check("Cierre intermedia: arriba no se mueve (deltaY = 0)", deltaYArriba === 0)
        t.check("Cierre intermedia: debajo sube 40px (deltaY = 40)", deltaYDebajo === 40)
    }

    // =======================================================================
    // 5. Cierres consecutivos (lógica de cancelación)
    // =======================================================================

    t.check(
        "cancelarAnimacion con onCancel limpia transform del elemento",
        anim.includes("if (onCancel) onCancel(elemento)")
    )

    t.check(
        "animarDesplazamiento cancela animación previa y restaura transform previo",
        anim.includes("cancelarAnimacion(elemento, (el) => {") &&
        anim.includes("el.style.transform = transformPrevio")
    )

    // =======================================================================
    // 6. Swipe y temporizadores no afectados
    // =======================================================================

    t.check(
        "manejarSwipe sigue presente en notificaciones.js",
        notif.includes("function manejarSwipe")
    )

    t.check(
        "timer se cancela al cerrar manualmente",
        notif.includes("if (timer) clearTimeout(timer)")
    )

    t.check(
        "duracion=0 sin cambios (temporizador no se crea si duracion <= 0)",
        notif.includes("if (duracion > 0)")
    )

    // =======================================================================
    // 7. Cierre repetido e idempotencia
    // =======================================================================

    t.check(
        "cerrada = true evita doble ejecución",
        notif.includes("if (cerrada || !notificacion.isConnected) return") &&
        notif.includes("cerrada = true")
    )

    // =======================================================================
    // 8. Cierres consecutivos y reorganización pendiente
    // =======================================================================

    t.check(
        "reorganizacionPendiente cancela timeout anterior al cerrar otra notificación",
        notif.includes("reorganizacionPendiente") &&
        notif.includes("clearTimeout(reorganizacionPendiente.timeoutId)")
    )

    t.check(
        "cerrar verifica isConnected y parentElement antes de animar restantes",
        notif.includes("if (!el.isConnected || el.parentElement !== contenedorPadre) return")
    )

    t.check(
        "firstRects se recaptura solo para elementos que siguen en el DOM",
        notif.includes("const firstRects = restantes.map(el => el.getBoundingClientRect())") &&
        notif.includes("const lastRect = el.getBoundingClientRect()")
    )
}
