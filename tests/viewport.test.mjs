// Test de viewport y lastbar (tarea: lastbar siempre visible, sin cobertura por barras de navegador).
//
// Verifica:
// 1. Todos los HTML incluyen `viewport-fit=cover` en el meta viewport.
// 2. El CSS de lastbar (navegacion.css) incluye `env(safe-area-inset-bottom`.
// 3. El contenedor raíz (style.css, body) declara `100dvh`.

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { leer, RAIZ, nuevoReporter } from "./helpers.mjs"

const HTML_FILES = [
    "index.html", "dashboard.html", "demo.html", "auth.html",
    "404.html", "eliminar-datos.html", "privacidad.html",
    "terminos.html", "reset-password.html"
]

export default function ejecutar(t = nuevoReporter("viewport")) {
    // 1. viewport-fit=cover en todos los HTML
    for (const archivo of HTML_FILES) {
        if (!existsSync(resolve(RAIZ, archivo))) {
            t.check(`${archivo} existe`, false)
            continue
        }
        const html = leer(archivo)
        const ok = /viewport["']?\s*content=["'][^"']*viewport-fit=cover/.test(html)
        t.check(`${archivo} tiene viewport-fit=cover`, ok)
    }

    // 2. CSS de lastbar incluye env(safe-area-inset-bottom
    const cssNav = leer("css/navegacion.css")
    const okLastbar = /\.lastbar\s*\{[^}]*env\(safe-area-inset-bottom/.test(cssNav)
    t.check("navegacion.css: .lastbar usa env(safe-area-inset-bottom)", okLastbar)

    // 3. Contenedor raíz usa 100dvh
    const cssStyle = leer("css/style.css")
    const okDvh = /body\s*\{[\s\S]*?height:\s*100vh\s*;[\s\S]*?height:\s*100dvh\s*;/.test(cssStyle)
    t.check("style.css: body usa 100vh + 100dvh", okDvh)

    return t
}
