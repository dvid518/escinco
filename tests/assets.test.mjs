// Precache de la PWA: cada asset de SHELL_ASSETS debe existir en disco o el
// `cache.addAll()` del install falla entero (una sola ruta inexistente tumba el
// precache y deja la app sin offline).
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { leer, RAIZ, nuevoReporter } from "./helpers.mjs"

export default function ejecutar(t = nuevoReporter("assets")) {
    const sw = leer("sw.js")
    const m = sw.match(/const SHELL_ASSETS = \[([\s\S]*?)\n\]/)
    if (!m) {
        t.check("SHELL_ASSETS localizable en sw.js", false)
        return t
    }

    const assets = [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1])
    t.check("SHELL_ASSETS tiene rutas", assets.length > 0, assets.length + " assets")

    const faltan = []
    for (const a of assets) {
        const rel = a === "/" ? "index.html" : a.replace(/^\//, "")
        if (!existsSync(resolve(RAIZ, rel))) faltan.push(a)
    }
    t.check("todos los assets del precache existen", faltan.length === 0, faltan.join(", "))

    return t
}
