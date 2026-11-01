import { abrirModal, cerrarModal, estaAbierto, contenidoDesdeTemplate } from "./modal.js"
import { mostrarNotificacion } from "./notificaciones.js"
import { pintarTextoEnriquecido } from "./textoEnriquecido.js"
import { preguntarAsistente, asistenteDisponible } from "../services/IaServicio.js"
import { obtenerContextoAsistente } from "../services/ContextoServicio.js"
import { VozServicio } from "../services/VozServicio.js"
import { obtenerPreferencias, aplicarPreferenciasDiff } from "../../firebase/firestore.js"
import { sesion } from "../core/sesion.js"
import { getPaginaActual } from "../core/router.js"

// ============================================
// drov · VENTANA DE CHAT
// ============================================
// El historial vive en memoria: se conserva mientras la pestaña esté abierta y
// se pierde al recargar. El servicio no guarda nada en Firestore.

const BIENVENIDA = "Hola. Soy <strong>drov</strong>, el asistente de <strong>escinco.</strong> Puedo ayudarte a encontrar una función, entender un concepto o resolver dudas sobre la app. ¿Qué necesitas?"

// ============================================
// MENSAJES PREDEFINIDOS DE DROV · PERMISOS
// ============================================
// Estructuras de mensajes que Drov puede usar para solicitar y confirmar
// permisos de acceso a los datos del usuario. Se guardan en el usuario
// (Firestore) porque están relacionados a la manipulación de la cuenta.
const MENSAJES_DROV = {
    permisoLecturaEscritura: {
        texto: "Drov puede leer tus datos financieros y, si lo autorizas, también registrar movimientos por ti. ¿Qué nivel de acceso prefieres?",
        botones: [
            { texto: "Aceptar lectura y edición", accion: "lectura_escritura" },
            { texto: "Solo lectura", accion: "lectura" },
            { texto: "Cancelar", accion: "ninguno" }
        ]
    },
    permisoSoloEdicion: {
        texto: "Drov solo puede registrar movimientos, no leer tus saldos. ¿Aceptas?",
        botones: [
            { texto: "Aceptar edición", accion: "lectura_escritura" },
            { texto: "Cancelar", accion: "ninguno" }
        ]
    },
    permisoConcedido: {
        texto: "Permisos concedidos. Ya puedes usar Drov."
    },
    permisoDenegado: {
        texto: "Drov no tiene acceso a tus datos. Puedes cambiar los permisos más tarde."
    }
}

// Permiso actual del usuario: lectura | lectura_escritura | ninguno | null
let permisoDrov = null

let historial = []

/**
 * Abre (o cierra, si ya está abierto) la ventana del asistente.
 */
export async function abrirAsistente() {
    if (estaAbierto() && document.querySelector(".asistente")) {
        cerrarModal()
        return
    }

    const modalEl = abrirModal({
        titulo: "drov",
        variante: "asistente",
        contenido: contenidoDesdeTemplate("tpl-asistente-panel"),
        footerExtra: contenidoDesdeTemplate("tpl-asistente-form"),
        cancelText: null,
        confirmText: null
    })

    const registro = modalEl.querySelector(".asistente-mensajes")
    const formulario = modalEl.querySelector(".asistente-form")
    const entrada = modalEl.querySelector("#asistente-input")
    const boton = modalEl.querySelector(".asistente-enviar")
    const microfono = modalEl.querySelector(".asistente-microfono")

    if (!registro || !formulario || !entrada || !boton) {
        console.error("[ERROR] El asistente no tiene el markup esperado")
        return modalEl
    }

    // Verificar permiso del usuario antes de habilitar el chat.
    // El permiso se guarda en el usuario (Firestore) porque está relacionado
    // a la manipulación de la cuenta.
    const permisoGuardado = await obtenerPermisoDrov(sesion.uid)
    permisoDrov = permisoGuardado

    if (!permisoDrov || permisoDrov === "ninguno") {
        // Mostrar solicitud de permiso como mensaje dentro del chat
        const accion = await solicitarPermisoEnChat(registro)
        await guardarPermisoDrov(sesion.uid, accion)
        permisoDrov = accion

        if (accion === "ninguno") {
            entrada.disabled = true
            boton.disabled = true
            return
        }

        // Volver a abrir el asistente con el nuevo permiso guardado
        return abrirAsistente()
    }

    registro.addEventListener("scroll", () => actualizarOverflow(registro))

    const voz = new VozServicio()

    if (!voz.soportado || !microfono) {
        microfono?.classList.add("oculto")
    }

    let escuchandoVoz = false

    function alternarVoz() {
        if (!voz.soportado) return

        if (!escuchandoVoz) {
            voz.iniciar(
                transcript => {
                    entrada.value = transcript
                    entrada.dispatchEvent(new Event("input", { bubbles: true }))
                },
                error => {
                    mostrarNotificacion("error", error)
                    microfono.classList.remove("activo")
                    escuchandoVoz = false
                }
            )
            microfono.classList.add("activo")
            escuchandoVoz = true
            entrada.focus()
        } else {
            voz.detener()
            microfono.classList.remove("activo")
            escuchandoVoz = false
        }
    }

    microfono?.addEventListener("click", alternarVoz)

    if (historial.length === 0) {
        historial.push({ rol: "model", texto: BIENVENIDA })
    }

    for (const mensaje of historial) {
        agregarMensaje(registro, mensaje.rol, mensaje.texto)
    }

    const configurada = await asistenteDisponible()
    if (!configurada) {
        entrada.disabled = true
        boton.disabled = true
        entrada.placeholder = "drov no está disponible"
        agregarMensaje(
            registro,
            "model",
            "drov no está disponible en este servidor. En local, arranca \"npm run local\" y define GEMINI_API_KEY en .env.local.",
            true
        )
    }

    // Habilitar entrada según el permiso del usuario
    if (permisoDrov === "lectura" || permisoDrov === "lectura_escritura") {
        entrada.disabled = false
        boton.disabled = entrada.value.trim() === ""
    } else {
        entrada.disabled = true
        boton.disabled = true
    }

    let enviando = false

    async function enviar() {
        if (enviando || !configurada) return

        if (escuchandoVoz) {
            voz.detener()
            microfono.classList.remove("activo")
            escuchandoVoz = false
        }

        const texto = entrada.value.trim()
        if (!texto) return

        entrada.value = ""
        entrada.style.height = "22px"
        enviando = true
        entrada.disabled = true
        boton.disabled = true
        registro.setAttribute("aria-busy", "true")

        agregarMensaje(registro, "user", texto)
        historial.push({ rol: "user", texto })

        // Pequeño delay para que el mensaje del usuario se asiente antes de mostrar "escribiendo"
        await new Promise(resolver => setTimeout(resolver, 500))
        if (!enviando) return

        const indicador = agregarEscribiendo(registro)

        try {
            const contexto = await obtenerContextoAsistente(sesion.uid)
            const respuesta = await preguntarAsistente(historial, {
                nombre: sesion.nombre,
                pagina: getPaginaActual(),
                contexto
            })
            indicador?.remove()
            historial.push({ rol: "model", texto: respuesta })
            agregarMensaje(registro, "model", respuesta)
        } catch (error) {
            indicador?.remove()
            const mensaje = error?.message || "No se pudo obtener respuesta del asistente."
            agregarMensaje(registro, "model", mensaje, true)
            mostrarNotificacion("error", mensaje)
        } finally {
            enviando = false
            entrada.disabled = false
            boton.disabled = entrada.value.trim() === ""
            registro.removeAttribute("aria-busy")
            entrada.focus()
        }
    }

    formulario.addEventListener("submit", evento => {
        evento.preventDefault()
        enviar()
    })

    entrada.addEventListener("keydown", evento => {
        if (evento.key === "Enter" && !evento.shiftKey) {
            evento.preventDefault()
            enviar()
        }
    })

    entrada.addEventListener("input", () => {
        // Dejar altura natural para medir scrollHeight (incluye padding)
        entrada.style.height = "auto";
        const alturaNatural = entrada.scrollHeight;
        const alturaFinal = Math.max(44, Math.min(alturaNatural, 120));
        entrada.style.height = alturaFinal + "px";
        boton.disabled = entrada.value.trim() === ""
    })
    boton.disabled = entrada.value.trim() === ""

    entrada.focus()

    return modalEl
}

function agregarMensaje(registro, rol, texto, esError = false) {
    const fragmento = contenidoDesdeTemplate("tpl-asistente-mensaje")
    const mensaje = fragmento.firstElementChild

    if (mensaje) {
        mensaje.classList.add(rol === "user" ? "asistente-mensaje-usuario" : "asistente-mensaje-ia")
        if (esError) mensaje.classList.add("asistente-mensaje-error")
        pintarTextoEnriquecido(mensaje.querySelector(".asistente-texto"), texto)
    }

    registro.appendChild(fragmento)
    registro.scrollTop = registro.scrollHeight

    actualizarOverflow(registro)

    return mensaje
}

function actualizarOverflow(registro) {
    if (!registro) return

    const { scrollTop, scrollHeight, clientHeight } = registro
    const enTope = scrollTop <= 0
    const enFondo = scrollTop + clientHeight >= scrollHeight - 1

    registro.classList.remove("fade-top", "fade-bottom", "fade-both")

    if (!enTope && !enFondo) {
        registro.classList.add("fade-both")
    } else if (!enTope) {
        registro.classList.add("fade-top")
    } else if (!enFondo) {
        registro.classList.add("fade-bottom")
    }
}

function agregarEscribiendo(registro) {
    const fragmento = contenidoDesdeTemplate("tpl-asistente-escribiendo")
    const indicador = fragmento.firstElementChild

    registro.appendChild(fragmento)
    registro.scrollTop = registro.scrollHeight

    return indicador
}

// ============================================
// FUNCIONES DE PERMISOS DE DROV
// ============================================
// Los permisos se guardan en el usuario (Firestore) porque están relacionados
// a la manipulación de la cuenta de escinco.

async function obtenerPermisoDrov(uid) {
    if (!uid) return null
    try {
        const prefs = await obtenerPreferencias(uid)
        return prefs?.permisosDrov || null
    } catch {
        return null
    }
}

async function guardarPermisoDrov(uid, permiso) {
    if (!uid) return
    try {
        await aplicarPreferenciasDiff(uid, { set: { permisosDrov: permiso } })
    } catch (error) {
        console.error("[Drov] No se pudo guardar el permiso:", error)
    }
}

async function solicitarPermisoEnChat(registro) {
    const config = MENSAJES_DROV.permisoLecturaEscritura

    // Agregar mensaje de IA con el texto del permiso dentro del chat
    const mensajePermiso = agregarMensaje(registro, "model", config.texto)

    // Crear contenedor de botones debajo del mensaje
    const contenedorBotones = document.createElement("div")
    contenedorBotones.className = "drov-permisos-botones"

    config.botones.forEach(({ texto, accion }) => {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = `drov-permisos-btn ${
            accion === "lectura_escritura" ? "aceptar" : accion === "ninguno" ? "cancelar" : ""
        }`
        btn.dataset.accion = accion
        btn.textContent = texto
        contenedorBotones.appendChild(btn)
    })

    registro.appendChild(contenedorBotones)
    registro.scrollTop = registro.scrollHeight

    return new Promise(resolver => {
        contenedorBotones.addEventListener(
            "click",
            evento => {
                const btn = evento.target.closest("button")
                if (!btn) return

                const accion = btn.dataset.accion

                // Remover mensaje de permiso y botones del chat
                mensajePermiso?.remove()
                contenedorBotones.remove()

                resolver(accion)
            },
            { once: true }
        )
    })
}
