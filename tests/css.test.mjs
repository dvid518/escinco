// Anti-duplicados de CSS (Fase 3, tarea 13a).
//
// Regla: dentro del armazón de la app una misma regla (selector + cuerpo
// idénticos) no debe repetirse en dos hojas. Los overrides aditivos (reglas con
// el mismo selector pero cuerpo distinto, típicos de @media o de container-type)
// son legítimos y no se tocan.
//
// Las excepciones que se aceptan a propósito van en PERMITIDOS con el motivo.
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { leer, RAIZ, nuevoReporter } from "./helpers.mjs"

// Hojas que forman el armazón de la SPA (shell + páginas).
const HOJAS = [
    "style", "componentes", "navegacion", "configuracion", "modal", "pendientes", "iconos",
    "dashboard", "cuentas", "movimientos", "inversiones", "trading"
]

// Copias exactas toleradas: `${selector}|||${cuerpo normalizado}` -> motivo.
const PERMITIDOS = new Map()

// Selectores que, tras la desduplicación, deben vivir en una única hoja.
const UNICOS = [
    ".panel-header", ".panel-header h2",
    ".lista-vacia", ".lista-vacia.error", ".lista-vacia-hint",
    ".config-hint"
]

function quitarComentarios(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, "")
}

// Elimina los bloques @keyframes (sus tramas 0%/100% no son selectores reales).
function quitarKeyframes(css) {
    let out = "", i = 0
    while (i < css.length) {
        const at = css.indexOf("@keyframes", i)
        if (at === -1) { out += css.slice(i); break }
        out += css.slice(i, at)
        let j = css.indexOf("{", at), nivel = 0
        for (; j < css.length; j++) {
            if (css[j] === "{") nivel++
            else if (css[j] === "}") { nivel--; if (nivel === 0) { j++; break } }
        }
        i = j
    }
    return out
}

const normal = s => s.replace(/\s+/g, " ").trim()

// Devuelve `selector|||cuerpo` por regla plana (las @media se aplanan solas:
// su preludio no empareja y las reglas internas sí).
function reglas(css) {
    const limpio = quitarKeyframes(quitarComentarios(css))
    const res = []
    for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = normal(m[1])
        if (sel.startsWith("@")) continue
        res.push({ sel, cuerpo: normal(m[2]) })
    }
    return res
}

export default function ejecutar(t = nuevoReporter("css")) {
    const porRegla = new Map() // `${sel}|||${cuerpo}` -> Set(archivos)
    const porSelector = new Map() // sel -> [archivos]

    for (const hoja of HOJAS) {
        const rel = `css/${hoja}.css`
        if (!existsSync(resolve(RAIZ, rel))) { t.check(`${rel} existe`, false); continue }
        for (const { sel, cuerpo } of reglas(leer(rel))) {
            const clave = `${sel}|||${cuerpo}`
            if (!porRegla.has(clave)) porRegla.set(clave, new Set())
            porRegla.get(clave).add(hoja)

            if (!porSelector.has(sel)) porSelector.set(sel, [])
            if (!porSelector.get(sel).includes(hoja)) porSelector.get(sel).push(hoja)
        }
    }

    const copias = [...porRegla.entries()]
        .filter(([, hojas]) => hojas.size > 1)
        .map(([clave, hojas]) => ({ clave, hojas: [...hojas] }))

    const inesperadas = copias.filter(c => !PERMITIDOS.has(c.clave))
    t.check(
        "sin reglas idénticas duplicadas entre hojas",
        inesperadas.length === 0,
        inesperadas.map(c => `${c.hojas.join("/")}: ${c.clave.slice(0, 70)}`).join(" | ")
    )

    for (const sel of UNICOS) {
        const hojas = porSelector.get(sel) || []
        t.check(`${sel} definido en una sola hoja`, hojas.length === 1, hojas.join(", "))
    }

    return t
}
