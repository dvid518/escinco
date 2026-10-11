import { cambiarTema, nombreModoTema } from "../core/tema.js"
import { sesion } from "../core/sesion.js"
import { mostrarNotificacion } from "./notificaciones.js"

// ============================================
// ESCINCOS DOODLES · EASTER EGGS
// ============================================
// Pequeños easter eggs ocultos. Funcionan SIEMPRE (independientemente de la
// preferencia "Habilitar escindos doodles", que se registra en accesibilidad).
//
//  · Tap con 5 dedos o clic en el logotipo (login / register) → alterna tema claro/oscuro.
//    La notificación indica el modo al que cambia, no solo "cambiar tema".
// ============================================

let inicializado = false

export function initDoodles(opciones = {}) {
    if (inicializado) return
    inicializado = true

    activarDoodleCincoDedos()
    if (opciones.logoSpin) {
        activarDoodleGiroLogo()
    }
}

// --------------------------------------------
// DOODLE · TAP CON 5 DEDOS → CAMBIAR TEMA
// --------------------------------------------

const dedosActivos = new Set()
let cincoDedosListos = false

function activarDoodleCincoDedos() {
    document.addEventListener("touchstart", manejarTouches, { passive: true })
    document.addEventListener("touchend", manejarTouches, { passive: true })
    document.addEventListener("touchcancel", manejarTouches, { passive: true })
}

function manejarTouches(evento) {
    for (const touch of evento.changedTouches) {
        if (evento.type === "touchstart") {
            dedosActivos.add(touch.identifier)
        } else {
            dedosActivos.delete(touch.identifier)
        }
    }

    if (dedosActivos.size >= 5) {
        cincoDedosListos = true
        console.log("[DOODLE] 5 dedos detectados", { dedosActivos: dedosActivos.size })
    }

    if (cincoDedosListos && dedosActivos.size === 0) {
        cincoDedosListos = false
        ciclarTemaDoodle()
    }
}

async function ciclarTemaDoodle() {
    try {
        const actual = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"
        const siguiente = actual === "light" ? "dark" : "light"
        await cambiarTema(sesion.uid, siguiente)
        mostrarNotificacion("exito", nombreModoTema(siguiente))
    } catch (error) {
        console.error("[ERROR] No se pudo cambiar el tema con el doodle:", error)
        mostrarNotificacion("error", "No se pudo cambiar el tema")
    }
}

// --------------------------------------------
// DOODLE · CLIC EN EL LOGOTIPO → CAMBIAR TEMA
// --------------------------------------------
// Clic en el logo (login / register): alterna claro/oscuro, igual que el tap
// de 5 dedos.

function activarDoodleGiroLogo() {
    const logo = document.getElementById("logo")
    if (!logo) return

    logo.addEventListener("click", ciclarTemaDoodle)
}