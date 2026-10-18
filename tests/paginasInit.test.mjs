// Toda página ENRUTADA tiene que exportar `render()` e `init()`.
//
// El router hace `if (module.init) { await module.init() }`: si el módulo no lo
// exporta, la comprobación falla en silencio y la página se queda a medio
// pintar. En movimientos.js pasó: al insertar el bloque de favoritos se
// sobrescribió `init()` entero, y la página se quedó con los esqueletos, sin
// listeners y sin cargar cuentas — sin un solo error en consola.
//
// Solo se comprueban las páginas del router. `auth.js`, `index.js`,
// `legal.js` y `reset-password.js` viven en js/pages/ pero los cargan sus
// propios HTML con `<script type="module">` (auth.html, index.html,
// privacidad.html, terminos.html, reset-password.html) y no pasan por aquí.
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { RAIZ } from "./helpers.mjs"

const router = readFileSync(join(RAIZ, "js/core/router.js"), "utf8")

// La lista sale del propio router: si mañana se añade una ruta, el test la ve.
const rutas = [...router.matchAll(/'\/(\w+)':\s*'(\w+)'/g)].map(m => m[2])
const paginasEnRouter = [...new Set(rutas)]

// `configuracion` vive en js/ui/ (comparte código con la ventana) y el resto en
// js/pages/. Se resuelve por existencia en vez de parsear PAGINAS_EN_UI: menos
// frágil y no depende del formato de ese Set.
function archivoDe(page) {
    const enPages = join(RAIZ, "js", "pages", page + ".js")
    return existsSync(enPages) ? enPages : join(RAIZ, "js", "ui", page + ".js")
}

export default function ejecutar(t) {
    console.log(`Rutas del router: ${paginasEnRouter.join(", ")}\n`)

    const sinInit = []
    const sinRender = []
    const inexistentes = []

    for (const page of paginasEnRouter) {
        const rel = archivoDe(page)
        if (!existsSync(rel)) { inexistentes.push(page); continue }
        const codigo = readFileSync(rel, "utf8")
        const tieneInit = /export\s+(async\s+)?function\s+init\s*\(/.test(codigo)
        const tieneRender = /export\s+function\s+render\s*\(/.test(codigo)

        if (!tieneInit) sinInit.push(page)
        if (!tieneRender) sinRender.push(page)
        console.log(
            `  ${page.padEnd(14)} init: ${tieneInit ? "sí" : "NO"}   render: ${tieneRender ? "sí" : "NO"}`
        )
    }

    console.log("")
    t.check("el router declara rutas", paginasEnRouter.length > 0, String(paginasEnRouter.length))
    t.check("toda página enruta existe en disco", inexistentes.length === 0, inexistentes.join(", "))
    t.check(`toda página enruta exporta init() (${paginasEnRouter.length - sinInit.length}/${paginasEnRouter.length})`,
        sinInit.length === 0, sinInit.join(", "))
    t.check(`toda página enruta exporta render() (${paginasEnRouter.length - sinRender.length}/${paginasEnRouter.length})`,
        sinRender.length === 0, sinRender.join(", "))

    // Y que el init de movimientos llame de verdad a las tres piezas: un init
    // vacío también exportaría init() y el test no lo pillaría.
    const mov = readFileSync(join(RAIZ, "js/pages/movimientos.js"), "utf8")
    const init = /export\s+async\s+function\s+init\s*\(\)\s*\{([\s\S]*?)\n\}/.exec(mov)?.[1] || ""
    t.check("el init de movimientos existe", init !== "")
    t.check("init de movimientos carga las cuentas", /cargarCuentas\(\)/.test(init))
    t.check("init de movimientos carga los movimientos", /cargarMovimientos\(\)/.test(init))
    t.check("init de movimientos engancha los eventos", /configurarEventos\(\)/.test(init))

    return t
}