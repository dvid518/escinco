/**
 * Infraestructura global de animaciones para escinco.
 *
 * Centraliza el uso de Anime.js para que cualquier página o componente pueda
 * animar elementos sin importar directamente la biblioteca ni duplicar lógica
 * de ciclo de vida, registro o cancelación.
 *
 * Animaciones soportadas:
 *   • entrada   : opacity 0 → 1 (escala opcional).
 *   • salida    : opacity 1 → 0, con promesa que se resuelve al terminar.
 *   • toggle    : entrada o salida según un booleano.
 *   • colección : aparición de varios elementos con stagger.
 *
 * Cada animación tiene ciclo de vida independiente y se registra para poder
 * cancelarla individualmente, por contexto o de forma global. Se respeta
 * prefers-reduced-motion: cuando está activado, las animaciones se resuelven
 * inmediatamente sin movimiento.
 */

import { animate } from "../lib/anime.esm.min.js"

// ---------------------------------------------------------------------------
// Preferencia de reducción de movimiento (accesibilidad)
// ---------------------------------------------------------------------------

const MEDIA_REDUCIR = matchMedia("(prefers-reduced-motion: reduce)")

export function reducirMovimientoHabilitado() {
    return MEDIA_REDUCIR.matches
}

// ---------------------------------------------------------------------------
// Registro de animaciones activas (ciclo de vida)
// ---------------------------------------------------------------------------
// porElemento:  elemento → { instancia, contexto }
// porContexto : contexto → Set de elementos
// Se usa Map (no WeakMap) para poder iterar en cancelaciones globales y por
// contexto. Las entradas se eliminan cuando la animación termina o se cancela
// explícitamente, evitando referencias a elementos retirados del DOM.
const porElemento = new Map()
const porContexto = new Map()

function registrar(elemento, instancia, contexto) {
    const entrada = { instancia, contexto }
    porElemento.set(elemento, entrada)

    if (contexto) {
        let set = porContexto.get(contexto)
        if (!set) {
            set = new Set()
            porContexto.set(contexto, set)
        }
        set.add(elemento)
    }

    instancia.finished.then(() => {
        desregistrar(elemento)
    }, () => {
        desregistrar(elemento)
    })
}

function desregistrar(elemento) {
    const entrada = porElemento.get(elemento)
    if (!entrada) return

    if (entrada.contexto) {
        const set = porContexto.get(entrada.contexto)
        if (set) {
            set.delete(elemento)
            if (set.size === 0) porContexto.delete(entrada.contexto)
        }
    }

    porElemento.delete(elemento)
}

function pausarElemento(elemento) {
    const entrada = porElemento.get(elemento)
    if (!entrada) return
    try { entrada.instancia.pause() } catch { /* anime ya no es necesario */ }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Anima la entrada de un elemento (opacity 0 → 1).
 * @param {HTMLElement} elemento
 * @param {Object} [opciones]
 * @param {number} [opciones.duracion=250]
 * @param {string|undefined} [opciones.contexto] - agrupar para cancelar por contexto
 * @returns {Promise} que se resuelve cuando la animación termina
 */
export function animarEntrada(elemento, { duracion = 250, contexto } = {}) {
    if (reducirMovimientoHabilitado()) return Promise.resolve()

    cancelarAnimacion(elemento)

    const instancia = animate(elemento, {
        opacity: [0, 1],
        duration: duracion,
        easing: "easeOutQuad",
    })

    registrar(elemento, instancia, contexto)
    return instancia.finished
}

/**
 * Anima la salida de un elemento (opacity 1 → 0).
 * @param {HTMLElement} elemento
 * @param {Object} [opciones]
 * @param {number} [opciones.duracion=250]
 * @param {string|undefined} [opciones.contexto]
 * @returns {Promise} que se resuelve cuando la animación termina (útil antes
 *         de retirar el elemento del DOM).
 */
export function animarSalida(elemento, { duracion = 250, contexto } = {}) {
    if (reducirMovimientoHabilitado()) return Promise.resolve()

    cancelarAnimacion(elemento)

    const instancia = animate(elemento, {
        opacity: [1, 0],
        duration: duracion,
        easing: "easeOutQuad",
    })

    registrar(elemento, instancia, contexto)
    return instancia.finished
}

/**
 * Alterna entrada o salida según `activo`.
 * @param {HTMLElement} elemento
 * @param {boolean} activo - true para entrada, false para salida
 * @param {Object} [opciones]
 * @returns {Promise}
 */
export function animarToggle(elemento, activo, { duracion = 250, contexto } = {}) {
    return activo
        ? animarEntrada(elemento, { duracion, contexto })
        : animarSalida(elemento, { duracion, contexto })
}

/**
 * Anima la aparición de una colección de elementos con stagger (retraso
 * escalonado entre cada uno).
 * @param {Iterable<HTMLElement>} elementos
 * @param {Object} [opciones]
 * @param {number} [opciones.duracion=250]
 * @param {number} [opciones.estagger=60] - ms de retraso entre elementos
 * @param {number} [opciones.delay=0] - retraso inicial antes del primero
 * @param {string|undefined} [opciones.contexto]
 * @returns {Promise} que se resuelve cuando todas terminan
 */
export function animarColeccion(elementos, {
    duracion = 250,
    estagger = 60,
    delay = 0,
    contexto
} = {}) {
    if (reducirMovimientoHabilitado()) return Promise.resolve()

    const lista = Array.from(elementos)
    const promesas = lista.map((elemento, indice) => {
        cancelarAnimacion(elemento)
        const instancia = animate(elemento, {
            opacity: [0, 1],
            duration: duracion,
            delay: delay + indice * estagger,
            easing: "easeOutQuad",
        })
        registrar(elemento, instancia, contexto)
        return instancia.finished
    })

    return Promise.all(promesas)
}

/**
 * Cancela la animación activa de un elemento individual.
 * @param {HTMLElement} elemento
 */
export function cancelarAnimacion(elemento) {
    const entrada = porElemento.get(elemento)
    if (!entrada) return
    pausarElemento(elemento)
    desregistrar(elemento)
}

/**
 * Cancela todas las animaciones activas de un contexto.
 * @param {string} contexto
 */
export function cancelarPorContexto(contexto) {
    const set = porContexto.get(contexto)
    if (!set) return

    for (const elemento of [...set]) {
        pausarElemento(elemento)
        desregistrar(elemento)
    }

    porContexto.delete(contexto)
}

/**
 * Cancela todas las animaciones activas de la aplicación.
 */
export function cancelarTodasLasAnimaciones() {
    for (const elemento of [...porElemento.keys()]) {
        pausarElemento(elemento)
        desregistrar(elemento)
    }
}

/**
 * Comprueba si un elemento tiene una animación activa.
 * @param {HTMLElement} elemento
 * @returns {boolean}
 */
export function estaAnimando(elemento) {
    return porElemento.has(elemento)
}
