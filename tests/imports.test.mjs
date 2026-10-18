// Integridad de los imports ES.
//
// `sintaxis.test.mjs` solo comprueba que cada archivo PARSEA. Eso no detecta
// un import con nombre que el módulo destino no exporta, que en el navegador es
// un SyntaxError al ENLAZAR el módulo y se lleva por delante la página entera.
// FavoritoServicio.js pedía `actualizarMovimientoDoc` a MovimientoServicio.js
// (que solo la importa, no la re-exporta) y movimientos.js pedía `crearFavorito`
// a FavoritoServicio.js (que vive en el repositorio).
import { readdirSync, statSync, readFileSync } from "node:fs"
import { dirname, join, resolve, relative } from "node:path"
import { RAIZ } from "./helpers.mjs"

// Nombres de export que una sentencia `export` puede producir.
function exportsDe(codigo) {
    const nombres = new Set()
    for (const m of codigo.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|class)\s+([A-Za-z0-9_$]+)/gm)) {
        nombres.add(m[1])
    }
    for (const m of codigo.matchAll(/^\s*export\s+(?:const|let|var)\s+([^=;\n]+)/gm)) {
        for (const parte of m[1].split(",")) {
            const nom = parte.trim().split(/[\s=]/)[0]
            if (nom) nombres.add(nom)
        }
    }
    for (const m of codigo.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
        for (const parte of m[1].split(",")) {
            const t = parte.trim()
            if (!t) continue
            const as = t.split(/\s+as\s+/)
            nombres.add((as[1] || as[0]).trim())
        }
    }
    return nombres
}

function recorrer(dir, acc = []) {
    for (const entrada of readdirSync(dir)) {
        if (entrada === "node_modules" || entrada === ".git" || entrada === "experimentos") continue
        const p = join(dir, entrada)
        if (statSync(p).isDirectory()) recorrer(p, acc)
        else if (/\.(js|mjs)$/.test(entrada)) acc.push(p)
    }
    return acc
}

const IGNORAR = new Set(["tests"])
const archivos = recorrer(RAIZ).filter(f => !IGNORAR.has(relative(RAIZ, f).split(/[\\/]/)[0]))

const rotos = []
const modulosAusentes = []

for (const archivo of archivos) {
    const codigo = readFileSync(archivo, "utf8")
    for (const m of codigo.matchAll(/import\s+(\{[^}]*\})?\s*from\s*['"](\.[^'"]+)['"]/g)) {
        const destino = m[2]
        let destinoCodigo
        try {
            destinoCodigo = readFileSync(resolve(dirname(archivo), destino), "utf8")
        } catch {
            modulosAusentes.push(`${relative(RAIZ, archivo)} -> ${destino}`)
            continue
        }
        const disponibles = exportsDe(destinoCodigo)
        for (const parte of (m[1] || "").replace(/[{}]/g, "").split(",")) {
            const original = parte.trim().split(/\s+as\s+/)[0].trim()
            if (original && !disponibles.has(original)) {
                rotos.push(`${relative(RAIZ, archivo)} importa { ${original} } de ${destino}`)
            }
        }
    }
}

// Casos concretos que ya se rompieron, para que el fallo sea legible.
const FAVORITO_ACTUALIZAR = leerCaso(
    "js/services/FavoritoServicio.js",
    /import\s*\{([^}]*)\}\s*from\s*"\.\/MovimientoServicio\.js"/
)

export default function ejecutar(t) {
    console.log(`${archivos.length} modulos revisados`)

    t.check("ningun modulo relativo ausente", modulosAusentes.length === 0, modulosAusentes.join("; "))

    t.check(`todo import con nombre existe en su destino (${rotos.length} roto/s)`, rotos.length === 0,
        rotos.join(" | "))

    t.check("FavoritoServicio NO pide actualizarMovimientoDoc a MovimientoServicio",
        FAVORITO_ACTUALIZAR !== true, String(FAVORITO_ACTUALIZAR))
    t.check("FavoritoServicio pide actualizarMovimientoDoc a la capa Firestore",
        /import\s*\{[^}]*\bactualizarMovimientoDoc\b[^}]*\}\s*from\s*"\.\.\/\.\.\/firebase\/firestore\.js"/.test(
            readFileSync(join(RAIZ, "js/services/FavoritoServicio.js"), "utf8")))

    return t
}

// Devuelve el nombre del export que FavoritoServicio le pide a MovimientoServicio.
function leerCaso(rel, re) {
    const codigo = readFileSync(join(RAIZ, rel), "utf8")
    const m = codigo.match(re)
    if (!m) return false
    const pide = m[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0])
    return pide.includes("actualizarMovimientoDoc") ? "actualizarMovimientoDoc" : false
}