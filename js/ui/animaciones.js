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
 * @param {Function} [onCancel] callback ejecutado antes de desregistrar, útil para
 *        restaurar estilos inline (p. ej. limpiar transform) al cancelar.
 */
export function cancelarAnimacion(elemento, onCancel) {
    const entrada = porElemento.get(elemento)
    if (!entrada) return
    pausarElemento(elemento)
    if (onCancel) onCancel(elemento)
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

/**
 * Anima el desplazamiento vertical de un elemento (patrón FLIP: Invert + Play).
 * Anima `translateY` de `deltaY` a `0`, dejando el elemento en su posición natural
 * al terminar. Limpia solo la parte `translateY` que inyecta la animación, sin
 * sobrescribir estilos ajenos (p. ej. `--desplazamiento` del swipe).
 * @param {HTMLElement} elemento
 * @param {Object} [opciones]
 * @param {number} [opciones.deltaY=0] - desplazamiento inicial en px (positivo = abajo)
 * @param {number} [opciones.duracion=300]
 * @param {string|undefined} [opciones.contexto]
 * @returns {Promise} que se resuelve cuando la animación termina
 */
export function animarDesplazamiento(elemento, { deltaY = 0, duracion = 300, contexto } = {}) {
    if (reducirMovimientoHabilitado()) {
        limpiarSoloTranslateY(elemento)
        return Promise.resolve()
    }

    // Guardar transform previo (excluyendo translateY que vamos a animar)
    const transformPrevio = obtenerTransformSinTranslateY(elemento)

    cancelarAnimacion(elemento, (el) => {
        // Al cancelar: restaurar solo el transform previo, no borrar todo
        el.style.transform = transformPrevio
    })

    const instancia = animate(elemento, {
        translateY: [deltaY, 0],
        duration: duracion,
        easing: "easeOutQuad",
    })

    instancia.finished.then(() => {
        // Al terminar: restaurar transform previo (sin el translateY animado)
        elemento.style.transform = transformPrevio
    }, () => {
        // Al fallar/cancelar: idem
        elemento.style.transform = transformPrevio
    })

    registrar(elemento, instancia, contexto)
    return instancia.finished
}

/**
 * Extrae el valor de `transform` quitando cualquier `translateY(...)` o `translate3d(..., ..., ...)`
 * que pueda haber sido inyectado por FLIP. Conserva el resto (p. ej. `translateX(var(--desplazamiento))`).
 * @param {HTMLElement} elemento
 * @returns {string} transform sin componentes de translateY
 */
export function obtenerTransformSinTranslateY(elemento) {
    const transform = elemento.style.transform || ""
    if (!transform) return ""
    // Quitar translateY(...) y translate3d(..., Y, ...) pero conservar translateX y otros
    return transform
        .replace(/translateY\([^)]+\)/g, "")
        .replace(/translate3d\(([^,]+),\s*[^,]+,\s*([^)]+)\)/g, "translate3d($1, 0, $2)")
        .replace(/\s+/g, " ")
        .trim()
}

/**
 * Limpia solo la componente `translateY` del estilo inline `transform`.
 * @param {HTMLElement} elemento
 */
function limpiarSoloTranslateY(elemento) {
    elemento.style.transform = obtenerTransformSinTranslateY(elemento)
}
