// Carga de estilos por página (Fase 3, tarea 13).
//
// El shell (dashboard.html) solo debe llevar los estilos globales; los de cada
// página los inyecta js/core/estilos.js al importar su módulo. Este test vigila
// que no se cuele una hoja de página otra vez en el HTML y que cada hoja
// declarada exista y esté en el precache offline.
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { leer, RAIZ, nuevoReporter } from "./helpers.mjs"

// Hojas que el armazón SÍ sirve siempre (aplican a cualquier ruta).
const GLOBALES = ["style", "componentes", "navegacion", "configuracion", "modal", "pendientes", "iconos"]

export default function ejecutar(t = nuevoReporter("estilos")) {
    const src = leer("js/core/estilos.js")

    const mapa = {}
    for (const m of src.matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)) {
        mapa[m[1]] = [...m[2].matchAll(/["']([^"']+)["']/g)].map(x => x[1])
    }

    const paginas = Object.keys(mapa)
    t.check("estilos.js declara las 5 páginas", paginas.length === 5, paginas.join(", "))

    // Cada hoja declarada debe existir en disco y ser un .css.
    const faltan = []
    const todasLasHojas = []
    for (const [pagina, hojas] of Object.entries(mapa)) {
        t.check(`${pagina} declara al menos una hoja`, hojas.length > 0)
        for (const href of hojas) {
            todasLasHojas.push(href)
            if (!href.endsWith(".css")) faltan.push(`${pagina}: ${href} no es .css`)
            if (!existsSync(resolve(RAIZ, href.replace(/^\//, "")))) faltan.push(`${pagina}: ${href} no existe`)
        }
    }
    t.check("todas las hojas declaradas existen y son .css", faltan.length === 0, faltan.join(" | "))

    // Cada módulo de página debe importar estilos.js y asegurar su hoja.
    const modulosFaltan = []
    for (const pagina of paginas) {
        const ruta = `js/pages/${pagina}.js`
        if (!existsSync(resolve(RAIZ, ruta))) { modulosFaltan.push(`${ruta} no existe`); continue }
        const js = leer(ruta)
        if (!/from\s+["']\.\.\/core\/estilos\.js["']/.test(js)) modulosFaltan.push(`${ruta} no importa estilos.js`)
        if (!new RegExp(`asegurarEstilos\\(\\s*["']${pagina}["']\\s*\\)`).test(js)) modulosFaltan.push(`${ruta} no llama asegurarEstilos("${pagina}")`)
    }
    t.check("cada módulo asegura la hoja de su página", modulosFaltan.length === 0, modulosFaltan.join(" | "))

    // El HTML no debe volver a enlazar hojas por página...
    const html = leer("dashboard.html")
    const enlazadas = [...html.matchAll(/<link[^>]+href=['"]css\/([\w-]+)\.css['"]/g)].map(m => m[1])
    const coladas = todasLasHojas
        .map(h => (h.match(/([\w-]+)\.css$/) || [])[1])
        .filter(nombre => enlazadas.includes(nombre))
    t.check("dashboard.html no enlaza hojas por página", coladas.length === 0, coladas.join(", "))

    // ...y sí todas las globales.
    const sinGlobal = GLOBALES.filter(g => !enlazadas.includes(g))
    t.check("dashboard.html enlaza todas las hojas globales", sinGlobal.length === 0, sinGlobal.join(", "))

// Las hojas por página deben estar en el precache (offline tras primer uso).
    const sw = leer("sw.js")
    const bloque = sw.match(/const SHELL_ASSETS = \[([\s\S]*?)\n\]/)
    const assets = bloque ? [...bloque[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : []
    const fuera = todasLasHojas.filter(h => !assets.some(a => a.endsWith(h)))
    t.check("las hojas por página están en SHELL_ASSETS", fuera.length === 0, fuera.join(", "))
    t.check("estilos.js está en SHELL_ASSETS", assets.some(a => a.endsWith("/js/core/estilos.js")))

    // Ninguna página puede usar clases que solo estén en la hoja de OTRA
    // página: se veía bien únicamente si antes habías visitado esa otra
    // (cuentas y trading salían sin píldora ni fondo hasta pasar por
    // inversiones). Las clases compartidas van en componentes.css, que está
    // entre las globales; cada página declara el resto de lo que necesita.
    const sinComentarios = texto => texto
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/.*$/gm, "$1 ")

    const definidasPor = {}
    for (const hoja of [...GLOBALES, ...todasLasHojas].map(h => `css/${h}.css`)) {
        const ruta = resolve(RAIZ, hoja)
        if (!existsSync(ruta)) continue
        for (const m of sinComentarios(leer(hoja)).matchAll(/\.(-?[a-zA-Z][\w-]*)/g)) {
            const cls = m[1]
            ;(definidasPor[cls] ||= new Set()).add(hoja.replace(/^css\//, ""))
        }
    }

    const huecos = []
    for (const pagina of paginas) {
        const js = leer(`js/pages/${pagina}.js`)
        const cargadas = new Set([
            ...GLOBALES.map(g => `${g}.css`),
            ...mapa[pagina].map(h => h.replace(/^css\//, ""))
        ])
        const usadas = new Set()
        for (const m of js.matchAll(/class=\\?"([^"\\]*)/g)) {
            for (const cls of m[1].split(/\s+/)) {
                if (cls && !/[${}]/.test(cls)) usadas.add(cls)
            }
        }
        for (const cls of usadas) {
            const hojas = definidasPor[cls]
            if (!hojas) continue // el estilo se aplica por JS o no depende de CSS
            if (![...hojas].some(h => cargadas.has(h))) {
                huecos.push(`${pagina}: .${cls} solo en ${[...hojas].join("/")}`)
            }
        }
    }
    t.check("ninguna página usa clases sin hoja disponible", huecos.length === 0, huecos.join(" | "))

    // El test de arriba razona por nombre de clase y se escapa de los estilos
    // que dependen del contenedor (#lista-movimientos-cuenta) o que solo son
    // una parte de la clase (.posicion-item). Estas son las dependencias
    // conocidas entre páginas: si alguien las quita de la declaración, los
    // items vuelven a verse distinto según por dónde se entre.
    const REPARTO_ESPERADO = {
        // El detalle de una cuenta lista movimientos con el markup de
        // movimientos.js: sin su hoja, .card-item-main no es flex y la fila
        // se apila en vez de mostrar valor a la derecha.
        cuentas: ["css/movimientos.css"],
        // Trades y órdenes reutilizan el bloque de posiciones de inversiones.
        trading: ["css/inversiones.css"]
    }
    const repartoFallan = []
    for (const [pagina, requeridas] of Object.entries(REPARTO_ESPERADO)) {
        for (const href of requeridas) {
            if (!mapa[pagina]?.includes(href)) {
                repartoFallan.push(`${pagina} ya no declara ${href}`)
            }
        }
    }
    t.check("las páginas que reutilizan markup ajeno declaran su hoja", repartoFallan.length === 0, repartoFallan.join(" | "))

    return t
}
