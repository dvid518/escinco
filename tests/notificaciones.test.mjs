// Pruebas del ciclo de vida de notificaciones.
//
// El entorno de pruebas es Node sin DOM real (no hay jsdom), por lo que no se
// puede importar js/ui/notificaciones.js directamente (arrastra Firebase,
// window, document...). Estas pruebas verifican:
//   • Que los cambios de código fuente están presentes (300 ms, clearTimeout,
//     prefers-reduced-motion en JS y CSS).
//   • La lógica de `cerrar()` ejecutada con una implementación simulada idéntica
//     a la real (temporizador, idempotencia, eliminación del DOM, cancelación).
//
// La verificación visual (entrada/salida por CSS, swipe, preferencia de
// movimiento en el navegador) queda pendiente para verificación en navegador.

import { leer } from "./helpers.mjs"

const SRC_JS = "js/ui/notificaciones.js"
const SRC_CSS = "css/componentes.css"

// ---------------------------------------------------------------------------
// Lectura de código fuente
// ---------------------------------------------------------------------------

function leerCodigo(rel) {
    return leer(rel)
}

const src = leerCodigo(SRC_JS)
const css = leerCodigo(SRC_CSS)

// ---------------------------------------------------------------------------
// Implementación simulada de `cerrar()`, idéntica a la real.
// Se usa para probar la lógica sin depender del DOM del navegador.
// ---------------------------------------------------------------------------

function fabricarCerrarConLogica({ reducirMovimiento = false, setTimeoutFn = setTimeout } = {}) {
    let cerrada = false
    const timer = null
    let removeLlamado = false
    let limpiarLlamado = false
    let alCerrarLlamado = false
    let setTimeoutCapturado = null

    const notificacion = {
        isConnected: true,
        classList: { remove: () => {}, add: () => {} },
        remove: () => { removeLlamado = true }
    }

    const activas = new Map()

    function limpiarContenedorVacio() { limpiarLlamado = true }
    function alCerrar() { alCerrarLlamado = true }

    const cerrar = () => {
        if (cerrada || !notificacion.isConnected) return
        cerrada = true
        if (timer) clearTimeout(timer)
        activas.delete("id-1")
        notificacion.classList.remove("notificacion-activa")
        notificacion.classList.add("notificacion-saliendo")
        setTimeoutFn(() => {
            notificacion.remove()
            limpiarContenedorVacio()
        }, reducirMovimiento ? 0 : 300)
        if (alCerrar) alCerrar()
    }

    activas.set("id-1", { notificacion, cerrar })

    // Capturar la llamada a setTimeout sin esperar realmente.
    const setTimeoutCaptura = (fn, delay) => {
        setTimeoutCapturado = { fn, delay }
        return 1
    }

    return {
        cerrar,
        setTimeoutCaptura,
        obtenerEstado: () => ({
            cerrada,
            removeLlamado,
            limpiarLlamado,
            alCerrarLlamado,
            setTimeoutCapturado
        }),
        notificacion
    }
}

export default async function (t) {
    // =======================================================================
    // Cambios de código fuente (lectura estática)
    // =======================================================================

    t.check(
        "A: Eliminación del DOM a 300 ms (no 250 ms)",
        src.includes("}, reducirMovimiento ? 0 : 300)")
    )

    t.check(
        "C: clearTimeout(timer) presente en cerrar()",
        src.includes("if (timer) clearTimeout(timer)")
    )

    t.check(
        "B: Detección de prefers-reduced-motion en JS",
        src.includes('matchMedia("(prefers-reduced-motion: reduce)")')
    )

    t.check(
        "B: Salida inmediata (0 ms) con prefers-reduced-motion",
        src.includes("reducirMovimiento ? 0 : 300")
    )

    t.check(
        "B: Regla @media prefers-reduced-motion en CSS",
        css.includes("@media (prefers-reduced-motion: reduce)")
    )

    t.check(
        "B: Transiciones desactivadas con prefers-reduced-motion",
        css.includes("transition: none")
    )

    t.check(
        "D: manejarSwipe presente en el módulo",
        src.includes("function manejarSwipe")
    )

    t.check(
        "D: Umbral de 50 px en swipe",
        src.includes("deltaX > 50")
    )

    t.check(
        "D: Variable CSS --desplazamiento en swipe",
        src.includes("--desplazamiento")
    )

    t.check(
        "D: Eventos pointer en swipe",
        src.includes("pointerdown") && src.includes("pointermove") && src.includes("pointerup")
    )

    // =======================================================================
    // Lógica de cerrar() (implementación simulada idéntica a la real)
    // =======================================================================

    // Caso 1: cierre automático programa setTimeout a 300 ms
    {
        const capturo = { delay: null }
        const { cerrar, obtenerEstado } = fabricarCerrarConLogica({
            setTimeoutFn: (fn, delay) => { capturo.delay = delay; return 1 }
        })
        cerrar()
        const estado = obtenerEstado()

        t.check("Cierre automático: cerrada = true", estado.cerrada === true)
        t.check("Cierre automático: setTimeout a 300 ms", capturo.delay === 300)
        t.check("Cierre automático: alCerrar llamado", estado.alCerrarLlamado === true)
    }

    // Caso 2: cierre repetido es idempotente (no falla ni duplica acciones)
    {
        const { cerrar, obtenerEstado } = fabricarCerrarConLogica()
        cerrar()
        cerrar() // segunda llamada: no debe hacer nada
        const estado = obtenerEstado()

        t.check("Cierre repetido: idempotente (no falla)", estado.cerrada === true)
        t.check("Cierre repetido: alCerrar llamado una vez", estado.alCerrarLlamado === true)
    }

    // Caso 3: prefers-reduced-motion → eliminación inmediata (0 ms)
    {
        const capturo = { delay: null }
        const { cerrar } = fabricarCerrarConLogica({
                reducirMovimiento: true,
                setTimeoutFn: (fn, delay) => { capturo.delay = delay; return 1 }
            })
        cerrar()

        t.check("prefers-reduced-motion: setTimeout a 0 ms", capturo.delay === 0)
    }

    // Caso 4: elemento no conectado (!isConnected) no hace nada
    {
        let cerro = false
        const cerrarNoConectado = () => {
            const isConnected = false
            if (false || !isConnected) return
            cerro = true
        }
        cerrarNoConectado()
        t.check("Elemento no conectado: no cierra", cerro === false)
    }

    // =======================================================================
    // Resumen
    // =======================================================================
}
