// El <select> de cuenta destino se quedaba VACÍO en transferencias.
//
// `contenidoDesdeFilas` devuelve un único DocumentFragment y `appendChild`
// MUEVE nodos: origen y destino compartían ese fragmento, así que el segundo
// selector se lo quedaba sin opciones (o se las quitaba al primero).
//
// Aquí se comprueba el contrato que lo arregla: pedir las opciones dos veces
// da dos conjuntos completos e independientes.
import { leer } from "./helpers.mjs"

const src = leer("js/ui/formularioMovimiento.js")

// --- 1) Estructura: las opciones se fabrican con una factoría por campo ---
const factoriasExpuestas = /nuevoCuentasOptions:\s*opcionesCuentas/.test(src) &&
    /nuevoTarjetasOptions:\s*opcionesTarjetas/.test(src)

// Nadie debe volver a usar un fragmento pre-construido y compartido: en un
// formulario con dos selectores de cuenta, el segundo quedaría vacío.
const sinFragmentoCompartido = !/opciones:\s*cuentasOptions\b/.test(src) &&
    !/opciones:\s*tarjetasOptions\b/.test(src)

const CUENTAS = ["campo-cuenta", "campo-cuentaOrigen", "campo-cuentaDestino"]
const camposConCopiaPropia = CUENTAS.every(id => {
    const i = src.indexOf(`id: "${id}"`)
    return i !== -1 && src.slice(i, i + 220).includes("opciones: opcionesCuentas()")
})

// --- 2) Comportamiento: modelo mínimo del "mover" de appendChild ---
// Un <select> con sus <option>. `appendChild` quita el nodo de su padre
// anterior: es exactamente lo que vacía el segundo selector.
function crearSelect() { return { opciones: [] } }
function crearFragmento(cuentas) {
    return { nodos: cuentas.map(id => ({ value: id })) }
}
function appendChild(destino, fragmento) {
    for (const nodo of fragmento.nodos) {
        const anterior = nodo.padre
        if (anterior) anterior.opciones.splice(anterior.opciones.indexOf(nodo), 1)
        destino.opciones.push(nodo)
        nodo.padre = destino
    }
    return destino
}
const ids = select => select.opciones.map(o => o.value)

// El fallo original: un único fragmento para los dos selectores. Como
// `appendChild` mueve nodos y el destino se genera después del origen, el
// ORIGEN se queda sin cuentas y todas acaban en el destino.
const compartido = crearFragmento(["cta-pen", "cta-usd"])
const oCompartido = appendChild(crearSelect(), compartido)
const dCompartido = appendChild(crearSelect(), compartido)
const regresionVisible = oCompartido.opciones.length === 0 && dCompartido.opciones.length === 2

// El arreglo: cada selector fabrica y recibe su propia copia.
const factory = () => crearFragmento(["cta-pen", "cta-usd"])
const oArreglado = appendChild(crearSelect(), factory())
const dArreglado = appendChild(crearSelect(), factory())

export default function ejecutar(t) {
    console.log("A) La regresión que motivó el arreglo (fragmento compartido)")
    t.check("compartiendo el fragmento, el selector de ORIGEN queda vacío", regresionVisible,
        `origen=${ids(oCompartido).length}, destino=${ids(dCompartido).length}`)

    console.log("\nB) Cada selector recibe sus propias opciones")
    t.check("origen tiene las 2 cuentas", ids(oArreglado).length === 2, JSON.stringify(ids(oArreglado)))
    t.check("destino tiene las 2 cuentas", ids(dArreglado).length === 2, JSON.stringify(ids(dArreglado)))
    t.check("ambos selectores son independientes",
        oArreglado.opciones[0] !== dArreglado.opciones[0])

    console.log("\nC) Estructura del código")
    t.check("el contexto expone las factorías de opciones", factoriasExpuestas)
    t.check("nadie usa un fragmento de opciones pre-construido", sinFragmentoCompartido)
    t.check("cuenta, cuentaOrigen y cuentaDestino piden copia propia", camposConCopiaPropia,
        CUENTAS.filter(id => {
            const i = src.indexOf(`id: "${id}"`)
            return i === -1 || !src.slice(i, i + 220).includes("opciones: opcionesCuentas()")
        }).join(", ") || "los tres")

    return t
}