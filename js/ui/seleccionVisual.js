/**
 * Selección unificada de elementos (movimientos, trades, posiciones, estrategias).
 *
 * Combina:
 *   • @viselect/vanilla  → selección visual por arrastre ("marquee", como escritorio).
 *   • anime.js           → animación de entrada/salida de la clase .seleccionado.
 *
 * Cada página sigue gestionando sus propios listeners de click / dblclick /
 * clic sostenido / teclado, pero en lugar de manipular un Set local llama a
 * las funciones de este módulo. Así el estado de selección queda centralizado
 * y se añade selección por arrastre sin reescribir toda la interacción.
 *
 * El módulo no conoce los selectores DOM concretos de cada página: recibe
 * `selectorItem` (para viselect) y `obtenerId` (para mapear elemento → id).
 */

import Viselect from "../lib/viselect.esm.js"
import { animarToggle, cancelarPorContexto } from "./animaciones.js"

// ---------------------------------------------------------------------------
// Estado interno (una sola selección activa a la vez en la app)
// ---------------------------------------------------------------------------

let viselect = null           // instancia de Viselect
let contenedorActivo = null   // elemento contenedor de la lista actual
let obtenerIdActivo = null    // fn(elemento) -> id
let onCambioActivo = null     // callback(idsSeleccionados, orden)

const seleccionados = new Set()   // ids seleccionados
const ordenSeleccion = []         // orden en que se seleccionaron

// ---------------------------------------------------------------------------
// Sincronización con viselect (selección por arrastre / marquee)
// ---------------------------------------------------------------------------

function sincronizarConViselect() {
    if (!viselect) return
    const elementos = viselect.getSelection() || []
    const nuevosIds = new Set(elementos.map(el => obtenerIdActivo(el)).filter(Boolean))

    // Detectar añadidos y removidos para animar
    const previos = new Set(seleccionados)
    for (const id of nuevosIds) {
        if (!previos.has(id)) {
            const el = elementoPorId(id)
            if (el) animarToggle(el, true, { duracion: 150, contexto: "seleccion" })
        }
    }
    for (const id of previos) {
        if (!nuevosIds.has(id)) {
            const el = elementoPorId(id)
            if (el) animarToggle(el, false, { duracion: 150, contexto: "seleccion" })
        }
    }

    seleccionados.clear()
    ordenSeleccion.length = 0
    for (const id of nuevosIds) {
        seleccionados.add(id)
        ordenSeleccion.push(id)
    }

    if (onCambioActivo) onCambioActivo(new Set(seleccionados), [...ordenSeleccion])
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Activa la selección visual sobre un contenedor.
 * @param {HTMLElement} contenedor - elemento padre de la lista (p. ej. #lista-trades)
 * @param {Object} opciones
 * @param {string} opciones.selectorItem - selector CSS de los items seleccionables
 * @param {Function} opciones.obtenerId - fn(elemento) -> id del item
 * @param {Function} [opciones.onCambio] - fn(idsSet, ordenArray) llamado al cambiar
 * @param {boolean} [opciones.deselectOnBlur] - si se limpia al hacer clic fuera
 */
export function activarSeleccion(contenedor, {
    selectorItem,
    obtenerId,
    onCambio = null,
    deselectOnBlur = false,
} = {}) {
    if (viselect) desactivarSeleccion()

    contenedorActivo = contenedor
    obtenerIdActivo = obtenerId
    onCambioActivo = onCambio

    viselect = new Viselect({
        selectables: selectorItem,
        document: document,
        features: { deselectOnBlur, singleTap: { allow: false } },
        behaviour: { intersect: "partial", overlap: "invert" },
        selectionAreaClass: "selection-area",
    })

    viselect.on("select", () => sincronizarConViselect())
    viselect.on("deselect", () => sincronizarConViselect())
    viselect.on("stop", () => sincronizarConViselect())

    // Estado inicial: sincronizar con lo que ya hubiera seleccionado
    sincronizarConViselect()
}

export function desactivarSeleccion() {
    if (!viselect) return
    try { viselect.destroy() } catch { /* ignore */ }
    viselect = null
    contenedorActivo = null
    obtenerIdActivo = null
    onCambioActivo = null
    cancelarPorContexto("seleccion")
}

/**
 * Devuelve una copia del Set de ids seleccionados.
 */
export function obtenerSeleccionados() {
    return new Set(seleccionados)
}

/**
 * Devuelve una copia del array de orden de selección.
 */
export function obtenerOrdenSeleccion() {
    return [...ordenSeleccion]
}

/**
 * Comprueba si un id está seleccionado.
 */
export function estaSeleccionado(id) {
    return seleccionados.has(id)
}

/**
 * Selecciona un id (y anima su elemento si está en el DOM).
 */
export function seleccionar(id) {
    if (seleccionados.has(id)) return
    seleccionados.add(id)
    if (!ordenSeleccion.includes(id)) ordenSeleccion.push(id)
    const el = elementoPorId(id)
    if (el) animarToggle(el, true, { duracion: 150, contexto: "seleccion" })
    if (onCambioActivo) onCambioActivo(new Set(seleccionados), [...ordenSeleccion])
}

/**
 * Deselecciona un id.
 */
export function deseleccionar(id) {
    if (!seleccionados.has(id)) return
    seleccionados.delete(id)
    const idx = ordenSeleccion.indexOf(id)
    if (idx !== -1) ordenSeleccion.splice(idx, 1)
    const el = elementoPorId(id)
    if (el) animarToggle(el, false, { duracion: 150, contexto: "seleccion" })
    if (onCambioActivo) onCambioActivo(new Set(seleccionados), [...ordenSeleccion])
}

/**
 * Alterna un id.
 */
export function toggle(id) {
    if (seleccionados.has(id)) deseleccionar(id)
    else seleccionar(id)
}

/**
 * Selecciona todos los ids dados.
 */
export function seleccionarTodos(listaIds) {
    for (const id of listaIds) {
        if (!seleccionados.has(id)) {
            seleccionados.add(id)
            if (!ordenSeleccion.includes(id)) ordenSeleccion.push(id)
            const el = elementoPorId(id)
            if (el) animarToggle(el, true, { duracion: 150, contexto: "seleccion" })
        }
    }
    if (onCambioActivo) onCambioActivo(new Set(seleccionados), [...ordenSeleccion])
}

/**
 * Limpia la selección (y anima salida de todos los elementos seleccionados).
 */
export function limpiar() {
    if (seleccionados.size === 0) return
    for (const id of seleccionados) {
        const el = elementoPorId(id)
        if (el) animarToggle(el, false, { duracion: 150, contexto: "seleccion" })
    }
    seleccionados.clear()
    ordenSeleccion.length = 0
    if (onCambioActivo) onCambioActivo(new Set(), [])
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function elementoPorId(id) {
    if (!contenedorActivo) return null
    // Los items pueden usar distintos atributos data-*; probamos los más comunes.
    for (const attr of ["data-id", "data-movimiento-id", "data-tradeid", "data-trade-id",
                        "data-ordenid", "data-orden-id", "data-posicion-id", "data-id"]) {
        const el = contenedorActivo.querySelector(`[${attr}="${id}"]`)
        if (el) return el
    }
    return null
}

// Rango con Shift (análogo a expandirSeleccion de seleccion.js, pero usando el
// módulo de estado propio para no depender del Set de cada página).
export function expandirSeleccion(ids, id) {
    if (!ids.includes(id) || seleccionados.size === 0) return false

    const actual = ids.indexOf(id)
    const anclaId = seleccionados.has(id) ? id
        : (ordenSeleccion.length > 0 ? ordenSeleccion[ordenSeleccion.length - 1] : ordenSeleccion[0])
    const ancla = ids.indexOf(anclaId)
    if (ancla < 0) return false

    const inicio = Math.min(actual, ancla)
    const fin = Math.max(actual, ancla)
    for (const item of ids.slice(inicio, fin + 1)) {
        seleccionar(item)
    }
    return true
}
