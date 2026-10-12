// Utilidades compartidas por los tests funcionales.
//
// Los tests leen el codigo REAL del repo (no copias) para que un cambio que
// rompa una regla haga fallar la suite. Unos modulos se pueden importar tal
// cual (JS puro, sin DOM ni Firebase); a los que si dependen de DOM/Firebase se
// les extrae la funcion por texto y se evalua con stubs minimos.
import { readFileSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join, resolve } from "node:path"

// Raiz del repositorio (el directorio que contiene js/, css/, tests/...).
export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export function leer(rel) {
    return readFileSync(join(RAIZ, rel), "utf-8")
}

export function urlDe(rel) {
    return pathToFileURL(join(RAIZ, rel)).href
}

/**
 * Extrae el texto completo de una funcion (async o no) del codigo fuente.
 * Localiza el cuerpo por la primera llave con los parentesis de la cabecera
 * equilibrados, para no confundirse con `{ esCredito = false }` en los params.
 */
export function extraerFuncion(src, nombre) {
    const asy = src.indexOf(`async function ${nombre}`)
    const sin = src.indexOf(`function ${nombre}`)
    const i = asy !== -1 ? asy : sin
    if (i === -1) throw new Error(`no existe la funcion ${nombre}`)

    let parentesis = 0, k = i, cuerpo = -1
    for (; k < src.length; k++) {
        const ch = src[k]
        if (ch === "(") parentesis++
        else if (ch === ")") parentesis--
        else if (ch === "{" && parentesis === 0) { cuerpo = k; break }
    }
    if (cuerpo === -1) throw new Error(`no se encontro el cuerpo de ${nombre}`)

    let nivel = 0
    for (k = cuerpo; k < src.length; k++) {
        if (src[k] === "{") nivel++
        else if (src[k] === "}") { nivel--; if (nivel === 0) break }
    }
    return src.slice(i, k + 1)
}

// Reporter sencillo: cada test acumula OK/fallos y el runner decide el exit code.
export function nuevoReporter(nombre) {
    const r = { nombre, total: 0, fallos: 0 }
    r.check = (descripcion, ok, detalle = "") => {
        r.total++
        if (!ok) r.fallos++
        console.log(`  ${ok ? "OK" : "!!"} ${descripcion}${detalle ? " -> " + detalle : ""}`)
    }
    return r
}

// Numero de hojas (valores simples) de un objeto anidado, para no clavar a mano
// el total de unset que espera el diff de preferencias.
export function contarHojas(obj) {
    let n = 0
    for (const valor of Object.values(obj)) {
        if (valor && typeof valor === "object" && !Array.isArray(valor)) n += contarHojas(valor)
        else n++
    }
    return n
}
