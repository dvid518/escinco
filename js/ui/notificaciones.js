import { icono } from "../core/iconos.js"
import { sesion } from "../core/sesion.js"

// ============================================
// NOTIFICACIONES
// ============================================
// Uso: mostrarNotificacion("exito", "Cambios guardados")
// Tipos: exito | error | info | warning
// Se apilan en un contenedor fijo y se autoeliminan.

const TIPOS = {
    exito:   { icono: "check",        clase: "exito" },
    error:   { icono: "x-circle",     clase: "error" },
    info:    { icono: "info",         clase: "info" },
    warning: { icono: "alert-triangle", clase: "warning" }
}

// Clave de localStorage para persistir el historial de notificaciones.
// Incluye el uid del usuario para tener datos aislados por cuenta.
const CLAVE_HISTORIAL_LOCAL = () => `escinco:notificaciones:${sesion.uid || "anon"}`

let contenedorInyectado = false
const activas = new Map()

// ============================================
// HISTORIAL · CENTRO DE NOTIFICACIONES
// ============================================
// Cada notificación mostrada se guarda (tope 50) para poder revisarla luego
// desde el centro. Se marca leída al abrir el centro.
// Carga perezosa: el historial se lee de localStorage al primer uso
// (al abrir el centro o al suscribirse a cambios), no al módulo inicializar.

let historialCargado = false
const HISTORIAL = []
const MAX_HISTORIAL = 50
let noLeidas = 0
const oyentesHistorial = new Set()

function cargarHistorialLocalStorage() {
    if (historialCargado) return
    historialCargado = true
    try {
        const clave = CLAVE_HISTORIAL_LOCAL()
        const texto = localStorage.getItem(clave)
        if (texto) {
            const datos = JSON.parse(texto)
            // Convertir fechas ISO a objetos Date
            datos.forEach(item => {
                if (item.fecha && typeof item.fecha === "string") {
                    item.fecha = new Date(item.fecha)
                }
            })
            // Mantener el tope 50 y fusionar con el actual (el nuevo sobrante se descarta)
            const fusionado = [...datos, ...HISTORIAL]
                .sort((a, b) => (b.fecha || a.fecha) - (a.fecha || b.fecha))
            HISTORIAL.splice(0, MAX_HISTORIAL, ...fusionado.slice(0, MAX_HISTORIAL))
        }
    } catch (error) {
        console.warn("[WARN] Error cargando historial de notificaciones localStorage:", error)
    }
}

function guardarHistorialLocalStorage() {
    try {
        const clave = CLAVE_HISTORIAL_LOCAL()
        // Serializar fechas a strings ISO para localStorage
        const datos = HISTORIAL.slice(0, MAX_HISTORIAL).map(item => ({
            id: item.id,
            tipo: item.tipo,
            mensaje: item.mensaje,
            fecha: item.fecha instanceof Date ? item.fecha.toISOString() : item.fecha
        }))
        localStorage.setItem(clave, JSON.stringify(datos))
    } catch (error) {
        console.warn("[WARN] Error guardando historial de notificaciones localStorage:", error)
    }
}

function notificarCambioHistorial() {
    for (const oyente of oyentesHistorial) {
        try {
            oyente(noLeidas)
        } catch (error) {
            console.warn("[WARN] Oyente de notificaciones falló:", error)
        }
    }
}

function registrarEnHistorial(tipo, mensaje) {
    if (!mensaje) return
    // Asegurar que el historial está cargado desde localStorage
    cargarHistorialLocalStorage()
    HISTORIAL.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        tipo,
        mensaje,
        fecha: new Date()
    })
    if (HISTORIAL.length > MAX_HISTORIAL) HISTORIAL.pop()
    noLeidas++
    guardarHistorialLocalStorage()
    notificarCambioHistorial()
}

/** Suscribe una función a los cambios del historial. Devuelve un desuscriptor. */
export function alCambiarNotificaciones(oyente) {
    oyentesHistorial.add(oyente)
    // Cargar historial desde localStorage si aún no se ha cargado
    if (!historialCargado) cargarHistorialLocalStorage()
    oyente(noLeidas)
    return () => oyentesHistorial.delete(oyente)
}

export function contarNotificacionesNoLeidas() {
    return noLeidas
}

export function obtenerHistorialNotificaciones() {
    return [...HISTORIAL]
}

export function marcarNotificacionesLeidas() {
    if (noLeidas === 0) return
    noLeidas = 0
    guardarHistorialLocalStorage()
    notificarCambioHistorial()
}

/** Abre el centro de notificaciones (historial de las últimas mostradas). */
export async function abrirCentroNotificaciones() {
    const { abrirModal } = await import("./modal.js")

    // Cargar historial desde localStorage si aún no se ha cargado
    // (carga perezosa: solo cuando se solicita el centro)
    if (!historialCargado) cargarHistorialLocalStorage()

    marcarNotificacionesLeidas()

    const contenido = HISTORIAL.length
        ? `<div class="centro-notificaciones">
            ${HISTORIAL.map(item => `
                <div class="centro-notificacion centro-notificacion-${TIPOS[item.tipo]?.clase || "info"}">
                    <span class="centro-notificacion-icono">${icono(TIPOS[item.tipo]?.icono || "info", 18)}</span>
                    <span class="centro-notificacion-cuerpo">
                        <span class="centro-notificacion-mensaje"></span>
                        <span class="centro-notificacion-fecha">${formatearFechaNotificacion(item.fecha)}</span>
                    </span>
                </div>
            `).join("")}
        </div>`
        : `<p class="centro-notificaciones-vacio">No hay notificaciones.</p>`

    const modalEl = abrirModal({
        titulo: "Notificaciones",
        contenido,
        variante: "narrow",
        confirmText: null,
        cancelText: "Cerrar"
    })

    // Los mensajes se insertan como texto para no interpretar HTML del usuario.
    const mensajes = modalEl.querySelectorAll(".centro-notificacion-mensaje")
    HISTORIAL.forEach((item, i) => {
        if (mensajes[i]) mensajes[i].textContent = item.mensaje
    })
}

function formatearFechaNotificacion(fecha) {
    try {
        return fecha.toLocaleString("es-PE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        })
    } catch {
        return ""
    }
}

export function cerrarNotificacionMasAntigua() {
    const primera = activas.values().next().value
    if (!primera) return false
    primera.cerrar()
    return true
}

document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Delete" || evento.target.closest("input, textarea, select, [contenteditable='true']")) return
    cerrarNotificacionMasAntigua()
})

function obtenerContenedor() {
    let contenedor = document.querySelector(".notificaciones-container")
    if (!contenedor) {
        contenedor = document.createElement("div")
        contenedor.className = "notificaciones-container"
        contenedor.setAttribute("aria-live", "polite")
        contenedorInyectado = true
        document.body.appendChild(contenedor)
    }
    return contenedor
}

function limpiarContenedorVacio() {
    const contenedor = document.querySelector(".notificaciones-container")
    if (!contenedor) return
    if (contenedor.childElementCount === 0 && contenedorInyectado) {
        contenedor.remove()
        contenedorInyectado = false
    }
}

/**
 * Muestra una notificación transitoria.
 * @param {("exito"|"error"|"info"|"warning")} tipo
 * @param {string} mensaje
 * @param {number} [duracion=3000] ms. 0 = no se autoelimina.
 * @param {{texto: string, alClick: Function, primaria?: boolean, clase?: string} | Array<{texto: string, alClick: Function, primaria?: boolean, clase?: string}> | null} [accion] botón(es) opcional(es).
 * @param {() => void} [alCerrar] callback al cerrarse la notificación por cualquier vía.
 * @returns {Function} función para cerrarla manualmente.
 */
export function mostrarNotificacion(tipo = "info", mensaje, duracion = 3000, accion = null, alCerrar = null) {
    if (!mensaje) return

    const config = TIPOS[tipo] || TIPOS.info
    const contenedor = obtenerContenedor()
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

    registrarEnHistorial(tipo, mensaje)

    const acciones = (Array.isArray(accion) ? accion : (accion ? [accion] : []))
        .filter(Boolean)
        .map(a => ({
            ...a,
            texto: a.texto ?? a.text ?? "Aceptar"
        }))

    const notificacion = document.createElement("div")
    notificacion.className = `glass notificacion notificacion-${config.clase}`
    notificacion.dataset.id = id
    notificacion.innerHTML = `
        <span class="notificacion-icono">${icono(config.icono, 20)}</span>
        <span class="notificacion-mensaje"></span>
        ${acciones.map(a => `
            <button type="button" class="notificacion-accion${a.primaria ? " notificacion-accion-primaria" : ""}${a.clase ? ` ${a.clase}` : ""}"></button>
        `).join("")}
        <button type="button" class="notificacion-cerrar" aria-label="Cerrar notificación">${icono("x", 16)}</button>
    `
    notificacion.querySelector(".notificacion-mensaje").textContent = mensaje
    notificacion.querySelectorAll(".notificacion-accion").forEach((btn, i) => {
        btn.textContent = acciones[i]?.texto ?? "Aceptar"
    })

    contenedor.appendChild(notificacion)

    // Forzar reflow para disparar la animación de entrada
    requestAnimationFrame(() => notificacion.classList.add("notificacion-activa"))

    let cerrada = false
    const cerrar = () => {
        if (cerrada || !notificacion.isConnected) return
        cerrada = true
        activas.delete(id)
        notificacion.classList.remove("notificacion-activa")
        notificacion.classList.add("notificacion-saliendo")
        setTimeout(() => {
            notificacion.remove()
            limpiarContenedorVacio()
        }, 250)
        if (alCerrar) alCerrar()
    }

    notificacion.querySelector(".notificacion-cerrar").addEventListener("click", cerrar)

    notificacion.querySelectorAll(".notificacion-accion").forEach((btn, i) => {
        const accionItem = acciones[i]
        btn.addEventListener("click", () => {
            // Cerrar de inmediato sin esperar a que la acción termine.
            cerrar()
            const resultado = accionItem?.alClick?.()
            if (resultado && typeof resultado.catch === "function") {
                resultado.catch(() => {})
            }
        })
    })

    let timer = null
    if (duracion > 0) {
        timer = setTimeout(() => {
            activas.delete(id)
            cerrar()
        }, duracion)
    }

    activas.set(id, { notificacion, cerrar, timer })

    // Gesto swipe horizontal para descartar en táctil
    manejarSwipe(notificacion)

    return cerrar
}

/** Cierra todas las notificaciones visibles. */
export function cerrarNotificaciones() {
    for (const { cerrar } of activas.values()) {
        cerrar()
    }
    activas.clear()
}

// ============================================
// GESTO SWIPE HORIZONTAL PARA DESCARTAR
// ============================================
// Durante el arrastre se expone la variable CSS --desplazamiento
// (el CSS la usa para el transform). Al superar 50px se cierra la
// notificación. Una sola versión, sin duplicados.

function manejarSwipe(notificacionElemento) {
    if (!notificacionElemento) return

    let inicioX = 0
    let arrastreActivo = false
    const id = notificacionElemento.dataset.id

    notificacionElemento.addEventListener("pointerdown", (e) => {
        inicioX = e.clientX
        arrastreActivo = true
    })

    notificacionElemento.addEventListener("pointermove", (e) => {
        if (!arrastreActivo) return
        const desplazamiento = e.clientX - inicioX
        notificacionElemento.style.setProperty("--desplazamiento", `${desplazamiento}px`)
    })

    notificacionElemento.addEventListener("pointerup", (e) => {
        if (!arrastreActivo) return
        arrastreActivo = false
        notificacionElemento.style.removeProperty("--desplazamiento")

        const deltaX = Math.abs(e.clientX - inicioX)
        if (deltaX > 50) {
            const entrada = activas.get(id)
            if (entrada) entrada.cerrar()
        }
    })

    notificacionElemento.addEventListener("pointercancel", () => {
        arrastreActivo = false
        notificacionElemento.style.removeProperty("--desplazamiento")
    })
}