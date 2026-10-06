import {
    login,
    loginConGoogle,
    registrarConEmail,
    registrarConGoogle,
    observeAuth,
    obtenerMetodosDeEmail,
    enviarVerificacion,
    recargarUsuario,
    enviarRecuperacion,
    aplicarCodigoDeAccion
} from "../../firebase/auth.js"
import { initTemaLocal } from "../core/tema.js"
import { initPWA } from "../core/pwa.js"
import { initDoodles } from "../ui/doodles.js"
import { icono } from "../core/iconos.js"
import { mostrarNotificacion } from "../ui/notificaciones.js"
import { pintarVersionPanel } from "../ui/panelVersion.js"

// ============================================
// INIT
// ============================================

initTemaLocal()
initPWA()
initDoodles({ logoSpin: true })
pintarVersionPanel()

// ============================================
// ESTADOS
// ============================================

// Los cuatro estados comparten documento. Solo dos tienen ruta: /login entra
// por el login y /register por el registro. La recuperación y la verificación se
// alcanzan desde un enlace dentro de la página y no cambian la URL.
const RUTAS = {
    login: "/login",
    registro: "/register"
}

// Los cuatro estados del documento, en el orden en que se recorren.
const ESTADOS = ["login", "recuperar", "registro", "verificacion"]

const ESTADO_POR_DEFECTO = "login"

// Primer control de cada estado: al cambiar de estado el foco pasa allí, para
// que seguir escribiendo no vaya a un campo que ya no está en pantalla.
const PRIMER_CONTROL = {
    login: "login_email",
    recuperar: "recuperar_email",
    registro: "registro_nombre",
    verificacion: "verificacion_comprobar"
}

// Botón de Google de cada estado: se resalta cuando el correo que se escribió
// pertenece a una cuenta que solo se puede abrir con Google.
const BOTON_GOOGLE = {
    login: "login_google",
    registro: "registro_google"
}

// Tiempo máximo que se espera a Firebase antes de mostrar la página. Mismo
// salvavidas que js/core/app.js:30: una red lenta no puede dejar la pantalla en
// negro con el login dentro.
const ESPERA_MAXIMA_MS = 5000

function seccion(nombre) {
    return document.getElementById(`estado_${nombre}`)
}

// ============================================
// CAMBIO DE ESTADO
// ============================================

/**
 * Muestra un estado y oculta los otros tres, sin recargar.
 * @param {string} nombre - login | recuperar | registro | verificacion
 */
function mostrarEstado(nombre) {
    for (const estado of ESTADOS) {
        seccion(estado)?.toggleAttribute("hidden", estado !== nombre)
    }

    // La URL solo se mueve entre los dos estados que tienen ruta: recargar
    // después de cambiar a registro debe devolver el registro, no el login. La
    // query se arrastra: un enlace de verificación llega como /auth.html?oobCode
    // y un replaceState con la ruta desnacha borraría el código.
    const ruta = RUTAS[nombre]
    if (ruta && window.location.pathname !== ruta) {
        window.history.replaceState({ auth: nombre }, "", ruta + window.location.search)
    }

    document.getElementById(PRIMER_CONTROL[nombre])?.focus({ preventScroll: true })
}

function pintarDestinatario(email) {
    const destino = document.getElementById("verificacion_email")
    if (destino) destino.textContent = email
}

// ============================================
// REDIRECCIÓN AL DASHBOARD
// ============================================
// El login exitoso y observeAuth corren en paralelo y los dos navegarían. Un
// solo guard evita el segundo replace, que cancelaba a mitad el primero.

let redirigiendo = false

function irAlDashboard() {
    if (redirigiendo) return
    redirigiendo = true
    window.location.replace("/dashboard")
}

/**
 * Espera a que el navegador pinte un frame, para que la instantánea de la
 * transición no capture el body todavía oculto por .loading.
 */
function trasPintar() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

/**
 * Destino común de los cuatro caminos que abren sesión (login con contraseña,
 * registro, Google en login y Google en registro): si el correo está verificado
 * se entra, y si no se manda el enlace y se pasa al estado de verificación.
 * @param {object} user
 */
async function trasAutenticar(user) {
    if (user.emailVerified) {
        await trasPintar()
        irAlDashboard()
        return
    }

    // El enlace ya puede haberse enviado antes (reintento de verificación):
    // enviarVerificacion no hace nada si el correo ya está verificado, pero sí
    // si lo está reenvía. Un fallo aquí no debe trappingar a quien ya entró: el
    // estado de verificación tiene su propio botón de reenviar.
    try {
        await enviarVerificacion(user)
    } catch (error) {
        console.error("No se pudo enviar el correo de verificación:", error)
        mostrarNotificacion("warning", "No se pudo enviar el correo de verificación. Reinténtalo aquí.")
    }

    pintarDestinatario(user.email)
    mostrarEstado("verificacion")
}

// ============================================
// LOGIN CON EMAIL Y CONTRASEÑA
// ============================================

async function iniciarSesion() {
    const email = document.getElementById("login_email").value.trim()
    const password = document.getElementById("login_clave").value

    if (!email) return avisar("Escribe tu correo electrónico.", "login_email")
    if (!password) return avisar("Escribe tu contraseña.", "login_clave")

    try {
        const { user } = await login(email, password)
        await trasAutenticar(user)
    } catch (error) {
        await manejarErrorLogin(error, email, password)
    }
}

// ============================================
// REGISTRO CON EMAIL Y CONTRASEÑA
// ============================================

async function crearCuenta() {
    const nombre = document.getElementById("registro_nombre").value.trim()
    const email = document.getElementById("registro_email").value.trim()
    const password = document.getElementById("registro_clave").value
    const confirmar = document.getElementById("registro_confirmar_clave").value

    const errorValidacion = validarDatos(nombre, email, password, confirmar)
    if (errorValidacion) {
        mostrarNotificacion("error", errorValidacion)
        return
    }

    try {
        // registrarConEmail ya guarda el nombre en el perfil de Auth y en el doc
        // de Firestore; aquí solo queda la verificación del correo.
        const { user } = await registrarConEmail(nombre, email, password)
        await trasAutenticar(user)
    } catch (error) {
        mostrarNotificacion("error", mensajeDeError(error))
        limpiarClaves()
        document.getElementById("registro_clave").focus()
    }
}

// ============================================
// RECUPERACIÓN DE CONTRASEÑA
// ============================================

async function recuperarClave() {
    const email = document.getElementById("recuperar_email").value.trim()
    const aviso = document.getElementById("recuperar_aviso")

    if (!email) {
        aviso.textContent = "Escribe tu correo electrónico."
        return document.getElementById("recuperar_email").focus()
    }

    try {
        await enviarRecuperacion(email)
        // El mismo texto exista o no la cuenta: confirmarlo sería filtrar qué
        // correos están registrados.
        aviso.textContent = "Si ese correo tiene una cuenta, te enviamos un enlace para cambiar la contraseña."
    } catch (error) {
        console.error(error)
        aviso.textContent = mensajeDeError(error)
    }
}

// ============================================
// VERIFICACIÓN DE CORREO
// ============================================

async function comprobarVerificacion() {
    // El enlace de Firebase no pasa por la app: el user de la sesión sigue
    // diciendo emailVerified: false hasta que se recarga contra el servidor.
    const user = await recargarUsuario()

    if (!user) {
        mostrarEstado("login")
        return
    }

    if (!user.emailVerified) {
        mostrarNotificacion("info", "Todavía no vemos la confirmación. Revisa el correo y la carpeta de spam.")
        return
    }

    await trasPintar()
    irAlDashboard()
}

async function reenviarVerificacion() {
    try {
        const enviado = await enviarVerificacion()
        mostrarNotificacion(
            enviado ? "info" : "warning",
            enviado ? "Enlace reenviado. Revisa tu correo." : "Ese correo ya está verificado."
        )
    } catch (error) {
        console.error(error)
        mostrarNotificacion("error", mensajeDeError(error))
    }
}

// ============================================
// GOOGLE
// ============================================

async function entrarConGoogle(estado) {
    try {
        const { user } = estado === "registro" ? await registrarConGoogle() : await loginConGoogle()
        await trasAutenticar(user)
    } catch (error) {
        console.error("Error Google:", error)
        mostrarNotificacion("error", mensajeDeError(error))
    }
}

// ============================================
// ERRORES
// ============================================

function avisar(mensaje, idCampo) {
    mostrarNotificacion("error", mensaje)
    document.getElementById(idCampo)?.focus()
}

function limpiarClaves() {
    for (const id of ["login_clave", "registro_clave", "registro_confirmar_clave"]) {
        const campo = document.getElementById(id)
        if (campo) campo.value = ""
    }
}

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
            const tieneGoogle = metodos.includes("google.com")
            const tienePassword = metodos.includes("password")

            if (tieneGoogle && !tienePassword) {
                mostrarNotificacion("info", "Esta cuenta usa Google. Inicia sesión con Google.")
                resaltarGoogle("login")
                return
            }
        }
    } catch (e) {
        console.error("Error al consultar métodos de autenticación:", e)
    }

    mostrarNotificacion("error", mensajeDeError(error))
    document.getElementById("login_clave").value = ""
    document.getElementById("login_clave").focus()
}

function validarDatos(nombre, email, password, confirmar) {
    if (!nombre) return "Escribe tu nombre."
    if (nombre.length < 2) return "El nombre es demasiado corto."
    if (!email) return "Escribe tu correo electrónico."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "El correo no es válido."
    if (!password) return "Escribe una contraseña."
    if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres."
    if (!confirmar) return "Confirma tu contraseña."
    if (password !== confirmar) return "Las contraseñas no coinciden."
    return null
}

function mensajeDeError(error) {
    switch (error.code) {
        case "auth/email-already-in-use":
            return "Ya existe una cuenta con ese correo."
        case "auth/invalid-email":
            return "El correo no es válido."
        case "auth/user-disabled":
            return "Esta cuenta está deshabilitada."
        case "auth/user-not-found":
            return "No existe una cuenta con ese correo."
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Correo o contraseña incorrectos."
        case "auth/weak-password":
            return "La contraseña es demasiado débil."
        case "auth/too-many-requests":
            return "Demasiados intentos. Prueba más tarde."
        case "auth/mail-not-sent":
            return "No se pudo enviar el correo. Revisa la dirección e inténtalo otra vez."
        case "auth/operation-not-allowed":
            return "El acceso con correo está deshabilitado."
        case "auth/popup-closed-by-user":
            return "Cancelaste el acceso con Google."
        case "auth/popup-blocked":
            return "El navegador bloqueó la ventana emergente de Google."
        case "auth/network-request-failed":
            return "Sin conexión. Revisa tu red."
        default:
            return "No se pudo completar la operación. Inténtalo de nuevo."
    }
}

function resaltarGoogle(estado) {
    const boton = document.getElementById(BOTON_GOOGLE[estado])
    if (!boton) return
    boton.classList.add("destacado")
    setTimeout(() => boton.classList.remove("destacado"), 2000)
}

// ============================================
// AVISO DE CONTRASEÑA RESTABLECIDA
// ============================================

function avisarClaveRestablecida() {
    if (new URLSearchParams(window.location.search).get("restablecida") !== "1") return
    mostrarNotificacion("exito", "Contraseña restablecida. Ya puedes entrar.", 5000)
    window.history.replaceState({}, "", RUTAS.login)
}

// ============================================
// ENLACE DE VERIFICACIÓN
// ============================================
// Con handleCodeInApp el enlace de Firebase no muestra su propia pantalla:
// vuelve a auth.html con ?oobCode=...&mode=verifyEmail. El código no marca el
// correo por sí solo — hay que aplicarlo contra la sesión abierta — y hasta
// después el usuario de la sesión sigue diciendo emailVerified: false.

const MODO_VERIFICACION = "verifyEmail"

function codigoDeVerificacion() {
    const query = new URLSearchParams(window.location.search)
    if (query.get("mode") !== MODO_VERIFICACION) return null
    return query.get("oobCode")
}

// El código es de un solo uso. Dejarlo en la URL haría que un recargar —o
// volver atrás en el historial— intentara aplicarlo otra vez y fallara con
// "enlace no válido" en lugar de dejar entrar al usuario.
function limpiarEnlaceDeVerificacion() {
    const url = new URL(window.location.href)
    for (const param of ["oobCode", "apiKey", "mode", "lang"]) {
        url.searchParams.delete(param)
    }
    window.history.replaceState({}, "", url.pathname + url.search)
}

/**
 * Aplica el enlace de verificación si la URL trae uno.
 * @returns {boolean} true si había enlace y se-cyó de la redirección exterior
 */
async function aplicarEnlaceDeVerificacion() {
    const oobCode = codigoDeVerificacion()
    if (!oobCode) return false

    limpiarEnlaceDeVerificacion()

    try {
        await aplicarCodigoDeAccion(oobCode)
    } catch (error) {
        console.error("No se pudo aplicar el enlace de verificación:", error)
        mostrarNotificacion("error", mensajeDeErrorVerificacion(error))
        return false
    }

    // El código ya está aplicado, pero el usuario de la sesión se creó antes de
    // aplicarlo: sin recargar, emailVerified seguiría valiendo false.
    const user = await recargarUsuario()

    if (!user?.emailVerified) {
        mostrarNotificacion("warning", "No vemos la confirmación todavía. Reinténtalo en unos segundos.")
        return true
    }

    mostrarNotificacion("exito", "Correo verificado. Entrando...")
    await trasPintar()
    irAlDashboard()
    return true
}

function mensajeDeErrorVerificacion(error) {
    switch (error.code) {
        case "auth/expired-action-code":
            return "Este enlace ha caducado. Pide uno nuevo con el botón de reenviar."
        case "auth/invalid-action-code":
            return "El enlace no es válido o ya se usó. Pide uno nuevo con el botón de reenviar."
        case "auth/network-request-failed":
            return "Sin conexión. Revisa tu red."
        default:
            return "No se pudo verificar el correo. Inténtalo de nuevo."
    }
}

// ============================================
// SESIÓN YA ABIERTA
// ============================================
// Solo la primera resolución del observador redirige: si no, cada login exitoso
// dispararía el observador y los dos navegarían. Y solo con el correo verificado:
// un usuario recién registrado tiene sesión pero todavía no puede entrar al
// dashboard, y su camino es el estado de verificación, no la redirección.

let sesionResuelta = false

function observarSesion() {
    observeAuth(async user => {
        if (sesionResuelta) return
        sesionResuelta = true
        await trasPintar()
        document.body.classList.remove("loading")
        if (!user) return

        // El enlace de verificación se aplica antes de decidir: en este momento
        // el usuario de la sesión todavía dice emailVerified: false, y saltarse
        // este paso dejaría a un usuario ya verificado mirando el login.
        if (await aplicarEnlaceDeVerificacion()) return

        if (user.emailVerified) irAlDashboard()
    })

    setTimeout(() => {
        document.body.classList.remove("loading")
    }, ESPERA_MAXIMA_MS)
}

// ============================================
// EVENTOS
// ============================================

function alPulsarEnter(campo, accion) {
    campo?.addEventListener("keydown", event => {
        if (event.key !== "Enter") return
        event.preventDefault()
        accion()
    })
}

function enfocar(id) {
    document.getElementById(id)?.focus()
}

alPulsarEnter(document.getElementById("login_email"), () => enfocar("login_clave"))
alPulsarEnter(document.getElementById("login_clave"), iniciarSesion)
alPulsarEnter(document.getElementById("recuperar_email"), recuperarClave)
alPulsarEnter(document.getElementById("registro_nombre"), () => enfocar("registro_email"))
alPulsarEnter(document.getElementById("registro_email"), () => enfocar("registro_clave"))
alPulsarEnter(document.getElementById("registro_clave"), () => enfocar("registro_confirmar_clave"))
alPulsarEnter(document.getElementById("registro_confirmar_clave"), crearCuenta)

document.getElementById("login_submit")?.addEventListener("click", iniciarSesion)
document.getElementById("login_google")?.addEventListener("click", () => entrarConGoogle("login"))
document.getElementById("registro_submit")?.addEventListener("click", crearCuenta)
document.getElementById("registro_google")?.addEventListener("click", () => entrarConGoogle("registro"))
document.getElementById("recuperar_submit")?.addEventListener("click", recuperarClave)
document.getElementById("verificacion_comprobar")?.addEventListener("click", comprobarVerificacion)
document.getElementById("verificacion_reenviar")?.addEventListener("click", reenviarVerificacion)

document.querySelectorAll("[data-estado]").forEach(enlace => {
    enlace.addEventListener("click", event => {
        event.preventDefault()
        mostrarEstado(enlace.dataset.estado)
    })
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

// ============================================
// ARRANQUE
// ============================================

const rutaActual = window.location.pathname.replace(/\/+$/, "") || "/"
const estadoInicial = Object.entries(RUTAS).find(([, ruta]) => ruta === rutaActual)?.[0]

mostrarEstado(estadoInicial || ESTADO_POR_DEFECTO)
avisarClaveRestablecida()
observarSesion()