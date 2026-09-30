import { login, loginConGoogle, observeAuth, obtenerMetodosDeEmail } from "../../firebase/auth.js"
import { initTemaLocal } from "../core/tema.js"
import { initPWA } from "../core/pwa.js"
import { initDoodles } from "../ui/doodles.js"
import { icono } from "../core/iconos.js"
import { mostrarNotificacion } from "../ui/notificaciones.js"
import { pintarVersionPanel } from "../ui/panelVersion.js"

// ============================================
// REFERENCIAS DOM
// ============================================

const inputEmail = document.getElementById("email")
const inputClave = document.getElementById("clave")
const botonSubmit = document.getElementById("login-submit")
const botonGoogle = document.getElementById("login-google")

// ============================================
// INIT
// ============================================

initTemaLocal()
initPWA()
initDoodles({ logoSpin: true })
pintarVersionPanel()

// ============================================
// REDIRECCIÓN AL DASHBOARD
// ============================================
// login()/loginConGoogle() y observeAuth() corren en paralelo tras un login
// exitoso: los dos acaban redirigiendo y compiten por la navegación. Un solo
// guard evita el segundo replace, que cancelaba a mitad el primero.

let redirigiendo = false

function irAlDashboard() {
    if (redirigiendo) return
    redirigiendo = true
    window.location.replace("/")
}

/** Espera a que el navegador pinte un frame, para que la instantánea de la
 *  transición no capture el body todavía oculto por .loading. */
function trasPintar() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

// ============================================
// LOGIN CON EMAIL + CONTRASEÑA
// ============================================

async function iniciarSesionConPassword() {
    const email = inputEmail.value.trim()
    const password = inputClave.value

    if (!email) {
        mostrarNotificacion("error", "Escribe tu correo electrónico.")
        return
    }
    if (!password) {
        mostrarNotificacion("error", "Escribe tu contraseña.")
        return
    }

    try {
        await login(email, password)
        irAlDashboard()
    } catch (error) {
        await manejarErrorLogin(error, email, password)
    }
}

// ============================================
// LOGIN CON GOOGLE
// ============================================

async function iniciarSesionConGoogle() {
    try {
        await loginConGoogle()
        irAlDashboard()
    } catch (error) {
        console.error("Error Google:", error)
        mostrarNotificacion("error", mensajeDeError(error))
    }
}

// ============================================
// MANEJO DE ERRORES
// ============================================

async function manejarErrorLogin(error, email, password) {
    console.error(error)

    // Detectar cuenta que existe solo con Google
    try {
        if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/user-not-found"
        ) {
            const metodos = await obtenerMetodosDeEmail(email)
            const tienePassword = metodos.includes("password")
            const tieneGoogle = metodos.includes("google.com")

            if (tieneGoogle && !tienePassword) {
                mostrarNotificacion(
                    "info",
                    "Esta cuenta usa Google. Inicia sesión con Google."
                )
                resaltarGoogle()
                return
            }
        }
    } catch (e) {
        console.error("Error al consultar métodos de autenticación:", e)
    }

    mostrarNotificacion("error", mensajeDeError(error))
    inputClave.value = ""
    inputClave.focus()
}

function mensajeDeError(error) {
    switch (error.code) {
        case "auth/invalid-email":
            return "El correo no es válido."
        case "auth/user-disabled":
            return "Esta cuenta está deshabilitada."
        case "auth/user-not-found":
            return "No existe una cuenta con ese correo."
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Correo o contraseña incorrectos."
        case "auth/too-many-requests":
            return "Demasiados intentos. Prueba más tarde."
        case "auth/popup-closed-by-user":
            return "Cancelaste el inicio de sesión con Google."
        case "auth/popup-blocked":
            return "El navegador bloqueó la ventana emergente de Google."
        case "auth/network-request-failed":
            return "Sin conexión. Revisa tu red."
        default:
            return "No se pudo iniciar sesión. Inténtalo de nuevo."
    }
}

function resaltarGoogle() {
    if (!botonGoogle) return
    botonGoogle.classList.add("destacado")
    setTimeout(() => botonGoogle.classList.remove("destacado"), 2000)
}

// ============================================
// OBSERVAR AUTH (redirigir si ya logueado)
// ============================================

observeAuth(async (user) => {
    await bodyVisibility(1, 1)
    if (!user) return
    // Un frame basta para que el body sea visible antes de la instantánea de
    // la transición. Los 300 ms de espera se sentían como un cuelgue.
    await trasPintar()
    irAlDashboard()
})

async function bodyVisibility(opacity, ms) {
    await new Promise(resolve => setTimeout(resolve, ms))
    switch (opacity) {
        case 0:
            document.body.classList.add("loading")
            break
        case 1:
            document.body.classList.remove("loading")
            break
    }
}

// ============================================
// EVENTOS
// ============================================

botonSubmit?.addEventListener("click", iniciarSesionConPassword)
botonGoogle?.addEventListener("click", iniciarSesionConGoogle)

inputClave?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault()
        iniciarSesionConPassword()
    }
})

inputEmail?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault()
        inputClave?.focus()
    }
})

// ============================================
// VER / OCULTAR CONTRASEÑA
// ============================================

function alternarVisibilidadClave(boton) {
    const input = document.getElementById(boton.dataset.toggle)
    if (!input) return
    const esVisible = input.type === "text"
    input.type = esVisible ? "password" : "text"
    boton.innerHTML = icono(esVisible ? "eye" : "eye-closed", 18)
    boton.setAttribute("aria-label", esVisible ? "Mostrar contraseña" : "Ocultar contraseña")
}

document.querySelectorAll(".pass-toggle").forEach(boton => {
    boton.addEventListener("click", () => alternarVisibilidadClave(boton))
})