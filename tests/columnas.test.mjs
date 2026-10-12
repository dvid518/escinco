// Regla de columnas del formulario de cuenta: ajustarAnchoNombre reparte el
// campo "nombre" a una o dos columnas para que ninguna fila quede con un campo
// huerfano. Se prueba la funcion REAL con formularios sinteticos que cubren
// los casos (incluidos grupos "full" y ocultos).
import { leer, extraerFuncion, nuevoReporter } from "./helpers.mjs"

const src = leer("js/pages/cuentas.js")
const ajustar = eval(`(${extraerFuncion(src, "ajustarAnchoNombre")})`)

function grupo({ nombre = false, full = false, hidden = false } = {}) {
    const g = {
        nombre,
        hidden,
        full,
        classList: {
            contains: c => (c === "full" ? g.full : false),
            toggle: (c, f) => { if (c === "full") g.full = f }
        }
    }
    g.querySelector = sel => (sel === "#campo-nombre" && nombre ? {} : null)
    return g
}

function formulario(grupos) {
    return { querySelectorAll: () => grupos }
}

// Celdas que ocupa cada grupo: 2 si es full, 1 si no.
const celdas = grupos => grupos.filter(g => !g.hidden).reduce((n, g) => n + (g.full ? 2 : 1), 0)

export default function ejecutar(t = nuevoReporter("columnas")) {
    const casos = [
        { desc: "nombre + 1 campo", grupos: [grupo({ nombre: true }), grupo()] },
        { desc: "nombre + 2 campos", grupos: [grupo({ nombre: true }), grupo(), grupo()] },
        { desc: "nombre + 1 campo full", grupos: [grupo({ nombre: true }), grupo({ full: true })] },
        { desc: "nombre + 1 normal + 1 full", grupos: [grupo({ nombre: true }), grupo(), grupo({ full: true })] },
        { desc: "nombre + 1 normal + 1 oculto", grupos: [grupo({ nombre: true }), grupo(), grupo({ hidden: true })] }
    ]

    for (const caso of casos) {
        ajustar(formulario(caso.grupos))
        const total = celdas(caso.grupos)
        t.check(`${caso.desc}: sin huerfano`, total % 2 === 0, `celdas=${total}`)
    }

    console.log("\nCasos degenerados")
    let lanzo = false
    try { ajustar(null) } catch { lanzo = true }
    t.check("formulario null no lanza", !lanzo)

    lanzo = false
    try { ajustar(formulario([grupo(), grupo()])) } catch { lanzo = true }
    t.check("sin #campo-nombre no lanza", !lanzo)

    console.log("\nContrato con el codigo real")
    t.check("ajustarAnchoNombre se usa en la page de cuentas", src.includes("ajustarAnchoNombre("))

    return t
}
