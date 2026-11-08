// Prueba de regresión para BUG-029: ReferenceError: tipo is not defined
// en abrirFormularioDetalle (js/pages/movimientos.js).
//
// Historia: la versión afectada referenciaba una variable `tipo` que no
// existía en el ámbito de `abrirFormularioDetalle` (zona antigua :1161-1163).
// Como la función es async, el ReferenceError se convertía en promesa
// rechazada y no se ejecutaban :1164-1166
// (vincularSimboloDivisa, bloquearFormulario(true),
// renderizarAccionesDetalle). El modal abría pero sin botones de acción ni
// formulario en solo lectura.
//
// Corrección aplicada: se eliminó la referencia a `tipo` suelto; el código
// actual usa m.tipo (propiedad del movimiento) y ejecuta las tres líneas
// sin error. Este test verifica:
//   1. Estáticamente: abrirFormularioDetalle no referencia `tipo` como
//      variable libre sin definir (solo m.tipo / config / tipoNombre).
//   2. Dinámicamente: bloquearFormulario(true) deshabilita el formulario.
//   3. Dinámicamente: renderizarAccionesDetalle(modalEl, true) pinta los
//      botones de acción en el DOM.
//   4. CONFIG_MOVIMIENTOS tiene entrada para cada tipo relevante, de modo
//      que ninguna ruta de tipo lance ReferenceError.

import { nuevoReporter, leer, extraerFuncion } from "./helpers.mjs"

const SRC = leer("js/pages/movimientos.js")

// ------------------------------------------------------------------
// Helper: extrae una función y la devuelve lista para llamar, inyectando
// sus dependencias (variables libres) como parámetros. Igual que el patrón
// de favoritoServicio.test.mjs, pero retorna la función en vez de ejecutar
// de inmediato, para poder pasarle sus propios argumentos.
function cargarFuncion(src, nombre, deps) {
    const cuerpo = extraerFuncion(src, nombre).replace(/^export\s+/, "")
    const params = Object.keys(deps)
    const valores = Object.values(deps)
    const fn = new Function(...params, `${cuerpo}\nreturn ${nombre}`)
    return fn(...valores)
}

// ------------------------------------------------------------------
// Stubs de DOM mínimos para bloquearFormulario y renderizarAccionesDetalle.

function crearElementoStub(disabledInicial = false) {
    return {
        disabled: disabledInicial,
        classList: {
            toggle: () => {}
        }
    }
}

function crearFormStub() {
    const el = crearElementoStub()
    el.querySelectorAll = () => [crearElementoStub(), crearElementoStub(), crearElementoStub()]
    el.classList = { toggle: () => {} }
    return el
}

const documentStub = {
    getElementById: () => crearFormStub()
}

function crearContenedorStub() {
    const hijos = []
    return {
        replaceChildren: (nuevo) => { hijos.push(nuevo) },
        querySelector: () => null,
        get hijos() { return hijos }
    }
}

const modalStub = {
    querySelector: () => crearContenedorStub()
}

// Stubs de funciones del módulo usadas por renderizarAccionesDetalle.
const contenidoDesdeTemplateStub = (id, { html }) => ({ id, html })
const iconoStub = () => "<svg>icono</svg>"

// ------------------------------------------------------------------
export default async function ejecutar(t = nuevoReporter("bug029")) {
    const TIPOS = [
        "ingreso", "gasto", "transferencia", "pagoTarjeta",
        "compraActivo", "ventaActivo", "error"
    ]

    // ----------------------------------------------------------
    // 1. Verificación estática: no hay `tipo` suelto en
    //    abrirFormularioDetalle.
    // ----------------------------------------------------------
    {
        const cuerpo = extraerFuncion(SRC, "abrirFormularioDetalle")

        // Todas las referencias a la palabra "tipo" en el cuerpo. Una
        // referencia es SEGURA solo si va precedida inmediatamente de "m."
        // (acceso a propiedad del movimiento, ej. m.tipo). Cualquier otra
        // aparición de "tipo" como palabra suelta es una variable no definida
        // y habría causado el ReferenceError original.
        const referencias = [...cuerpo.matchAll(/\btipo\b/g)]

        const sinDefinir = referencias
            .map(m => m.index)
            .filter(idx => cuerpo[idx - 2] !== "m" || cuerpo[idx - 1] !== ".")

        t.check(
            "abrirFormularioDetalle no referencia `tipo` como variable sin definir",
            sinDefinir.length === 0,
            `referencias sin definir: ${sinDefinir.length}`
        )

        // Todas las referencias usan m.tipo (propiedad del movimiento).
        const mtipo = cuerpo.match(/m\.tipo/g)
        t.check(
            "todos los usos de tipo son m.tipo (propiedad del movimiento)",
            mtipo !== null && mtipo.length >= 2,
            `${mtipo ? mtipo.length : 0} uso(s) de m.tipo`
        )
    }

    // ----------------------------------------------------------
    // 2. Verificación dinámica: CONFIG_MOVIMIENTOS tiene cada tipo.
    // ----------------------------------------------------------
    {
        const srcTipos = leer("constants/tiposMovimiento.js")
        for (const tipo of TIPOS) {
            t.check(
                `CONFIG_MOVIMIENTOS declara "${tipo}"`,
                srcTipos.includes(`"${tipo}"`) || srcTipos.includes(`'${tipo}'`)
            )
        }
    }

    // ----------------------------------------------------------
    // 3. Verificación dinámica: bloquearFormulario(true) deshabilita
    //    el formulario sin lanzar ReferenceError.
    // ----------------------------------------------------------
    {
        const bloquearFormulario = cargarFuncion(SRC, "bloquearFormulario", {
            document: documentStub
        })

        let lanzo = false
        try {
            bloquearFormulario(true)
        } catch { lanzo = true }

        t.check("bloquearFormulario(true) no lanza ReferenceError", lanzo === false)
    }

    // ----------------------------------------------------------
    // 4. Verificación dinámica: renderizarAccionesDetalle(modalEl, true)
    //    pinta los botones de acción sin lanzar ReferenceError.
    // ----------------------------------------------------------
    {
        const renderizarAccionesDetalle = cargarFuncion(SRC, "renderizarAccionesDetalle", {
            contenidoDesdeTemplate: contenidoDesdeTemplateStub,
            icono: iconoStub,
            document: documentStub
        })

        let lanzo = false
        try {
            renderizarAccionesDetalle(modalStub, true)
        } catch { lanzo = true }

        t.check("renderizarAccionesDetalle(modalEl, true) no lanza ReferenceError", lanzo === false)
    }

    return t
}
