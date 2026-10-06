import { confirmarNuevaClave } from "../../firebase/auth.js"
import { initTemaLocal } from "../core/tema.js"
import { initPWA } from "../core/pwa.js"
import { initDoodles } from "../ui/doodles.js"
import { icono } from "../core/iconos.js"
import { pintarVersionPanel } from "../ui/panelVersion.js"

// ============================================
// RESTABLECER CONTRASEÑA
// ============================================
// Destino del enlace que manda Firebase por correo. El enlace no trae la
// contraseña ni nada que valga por sí solo: trae un código (oobCode) que es lo
// único que permite cambiarla. Si el código falta, ya se usó o caducó, esta
// página no puede hacer nada y se limit a decirlo.

const MIN_CARACTERES = 6

initTemaLocal()
initPWA()
initDoodles({ logoSpin: true })
pintarVersionPanel()

const mensaje = document.getElementById("reset_mensaje")
const formulario = document.getElementById("reset_formulario")
const botonSubmit = document.getElementById("reset_submit")
const campoClave = document.getElementById("reset_clave")
const campoConfirmar = document.getElementById("reset_confirmar_clave")

const oobCode = new URLSearchParams(window.location.search).get("oobCode")

// ============================================
// ENLACE NO UTILIZABLE
// ============================================

/**
 * Deja la página en solo lectura: sin código no hay nada que enviar.
 * @param {string} texto
 */
function mostrarEnlaceInvalido(texto) {
    mensaje.textContent = texto
    formulario.hidden = true
    document.body.classList.remove("loading")
}

// ============================================
// VALIDACIÓN
// ============================================

function errorDeValidacion() {
    if (!campoClave.value) return "Escribe una contraseña nueva."
    if (campoClave.value.length < MIN_CARACTERES) return `La contraseña debe tener al menos ${MIN_CARACTERES} caracteres.`
    if (!campoConfirmar.value) return "Confirma la contraseña nueva."
    if (campoClave.value !== campoConfirmar.value) return "Las contraseñas no coinciden."
    return null
}

// ============================================
// CAMBIO DE CONTRASEÑA
// ============================================

async function guardarClaveNueva() {
    const errorValidacion = errorDeValidacion()
    if (errorValidacion) {
        mensaje.textContent = errorValidacion
        return campoClave.focus()
    }

    botonSubmit.disabled = true
    mensaje.textContent = "Guardando la contraseña nueva..."

    try {
        await confirmarNuevaClave(oobCode, campoClave.value)
        // La sesión sigue siendo la anterior: Firebase no cierra la sesión al
        // restablecer, así que el aviso de "contraseña restablecida" lo muestra
        // el login, no esta página.
        window.location.replace("/login?restablecida=1")
    } catch (error) {
        console.error(error)
        botonSubmit.disabled = false
        mensaje.textContent = mensajeDeError(error)
        campoClave.value = ""
        campoConfirmar.value = ""
        campoClave.focus()
    }
}

function mensajeDeError(error) {
    switch (error.code) {
        case "auth/expired-action-code":
            return "Este enlace ha caducado. Pide uno nuevo desde el login."
        case "auth/invalid-action-code":
            return "El enlace no es válido. Pide uno nuevo desde el login."
        case "auth/missing-password":
            return "Escribe una contraseña nueva."
        case "auth/weak-password":
            return "La contraseña es demasiado débil."
        case "auth/too-many-requests":
            return "Demasiados intentos. Prueba más tarde."
        case "auth/network-request-failed":
            return "Sin conexión. Revisa tu red."
        default:
            return "No se pudo cambiar la contraseña. Inténtalo de nuevo."
    }
}

// ============================================
// EVENTOS
// ============================================

botonSubmit?.addEventListener("click", guardarClaveNueva)

campoConfirmar?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return
    event.preventDefault()
    guardarClaveNueva()
})

document.querySelectorAll(".pass-toggle").forEach(boton => {
    boton.addEventListener("click", () => {
        const input = document.getElementById(boton.dataset.toggle)
        if (!input) return
        const esVisible = input.type === "text"
        input.type = esVisible ? "password" : "text"
        boton.innerHTML = icono(esVisible ? "eye" : "eye-closed", 18)
        boton.setAttribute("aria-label", esVisible ? "Mostrar contraseña" : "Ocultar contraseña")
    })
})

// ============================================
// ARRANQUE
// ============================================

if (!oobCode) {
    mostrarEnlaceInvalido("Este enlace no es válido o ya se usó. Pide uno nuevo desde el login.")
} else {
    document.body.classList.remove("loading")
    campoClave.focus()
}