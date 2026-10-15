// Plantillas de modal declaradas en el HTML (migración de `contenido:`).
//
// Los cuerpos de modal se clonan con contenidoDesdeTemplate() (js/ui/modal.js),
// que rellena los huecos [data-tpl] con textContent. Este test vigila las tres
// formas de romperlo sin tocar el navegador:
//   1. llamar a un template que no está en el HTML (el modal no abre),
//   2. pasar un hueco que el template no tiene (el texto se pierde en silencio),
//   3. dejar un template fuera de dashboard.html o tester.html (se rompe la demo).
import { readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { leer, RAIZ, nuevoReporter, extraerFuncion } from "./helpers.mjs"

// Documentos que sirven la app (los dos precacheados por sw.js).
const DOCUMENTOS = ["dashboard.html", "tester.html"]

// Cuerpo de un <template>...</template> por id, tal cual aparece en el HTML.
// Los finales de línea se normalizan: dashboard.html va en CRLF y tester.html en
// LF, y eso no es una diferencia de contenido.
function templatesDe(html) {
    const mapa = new Map()
    for (const m of html.matchAll(/<template\s+id="([^"]+)"\s*>([\s\S]*?)<\/template>/g)) {
        mapa.set(m[1], m[2].replace(/\r\n/g, "\n").trim())
    }
    return mapa
}

// Huecos declarados en un template: [data-tpl="hueco"].
function huecosDe(cuerpo) {
    return new Set([...cuerpo.matchAll(/data-tpl="([^"]+)"/g)].map(m => m[1]))
}

// Llamadas contenidoDesdeTemplate("id", { valores: {...}, html: {...} }) y
// contenidoDesdeFilas("id", filas, fila => ({ valores: {...} })) en todo js/.
function llamadasEnJs() {
    const archivos = []
    const recorrer = dir => {
        for (const entrada of readdirSync(dir)) {
            if (entrada === "node_modules" || entrada === ".git") continue
            const ruta = join(dir, entrada)
            if (statSync(ruta).isDirectory()) recorrer(ruta)
            else if (entrada.endsWith(".js")) archivos.push(ruta)
        }
    }
    recorrer(join(RAIZ, "js"))

    const llamadas = []
    for (const ruta of archivos) {
        // modal.js es donde se definen los helpers: ahí los nombres son variables.
        if (/js[\\/]ui[\\/]modal\.js$/.test(ruta)) continue
        const src = leer(relative(RAIZ, ruta))
        const archivo = relative(RAIZ, ruta).replace(/\\/g, "/")
        const re = /contenidoDesde(Template|Filas)\(/g
        for (const m of src.matchAll(re)) {
            // Texto de la llamada: desde el paréntesis hasta su cierre, contando
            // llaves y paréntesis anidados, para no leer las opciones de la
            // llamada siguiente.
            let nivel = 0
            let fin = m.index + m[0].length
            for (; fin < src.length; fin++) {
                const ch = src[fin]
                if (ch === "(" || ch === "{" || ch === "[") nivel++
                else if (ch === ")" || ch === "}" || ch === "]") {
                    nivel--
                    if (nivel < 0) break
                }
            }
            const llamada = src.slice(m.index, fin)
            // Un id puede venir de un condicional (`cond ? "tpl-a" : "tpl-b"`),
            // así que se recogen todos los literales que parecen un template.
            const ids = [...llamada.matchAll(/"(tpl-[\w-]+)"/g)].map(x => x[1])

            // Los huecos son las claves de los objetos `valores:` y `html:`,
            // incluidos los que llevan atributo ("tipo@data-tipo").
            const hues = new Set()
            for (const bloque of llamada.matchAll(/(?:valores|html)\s*:\s*\{([^}]*)\}/g)) {
                for (const k of bloque[1].matchAll(/["']?([\w-]+(?:@[\w-]+)?)["']?\s*:/g)) {
                    hues.add(k[1])
                }
            }
            llamadas.push({ archivo, ids, helper: m[1], hues: [...hues] })
        }
    }
    return llamadas
}

export default function ejecutar(t = nuevoReporter("plantillas")) {
    const docs = Object.fromEntries(DOCUMENTOS.map(d => [d, templatesDe(leer(d))]))

    t.check("dashboard.html declara algún template", docs["dashboard.html"].size > 0,
        `${docs["dashboard.html"].size} template(s)`)

    // Mismos templates en ambos documentos, con el mismo cuerpo: la demo carga
    // las mismas páginas y no puede quedarse sin ellos.
    const sincronia = []
    for (const [id, cuerpo] of docs["dashboard.html"]) {
        if (!docs["tester.html"].has(id)) sincronia.push(`${id} falta en tester.html`)
        else if (docs["tester.html"].get(id) !== cuerpo) sincronia.push(`${id} difiere entre dashboard y tester`)
    }
    for (const id of docs["tester.html"].keys()) {
        if (!docs["dashboard.html"].has(id)) sincronia.push(`${id} sobra en tester.html`)
    }
    t.check("dashboard.html y tester.html declaran los mismos templates", sincronia.length === 0, sincronia.join(" | "))

    const llamadas = llamadasEnJs()
    t.check("hay al menos una llamada a contenidoDesdeTemplate", llamadas.length > 0, `${llamadas.length} llamada(s)`)

    const sinTemplate = []
    const huesPerdidos = []
    for (const { archivo, ids, hues } of llamadas) {
        // Con un condicional hay varios candidatos: vale cualquiera de ellos.
        const candidatos = ids.map(id => docs["dashboard.html"].get(id)).filter(Boolean)
        if (ids.length === 0 || candidatos.length === 0) {
            sinTemplate.push(`${archivo}: ${ids.length ? ids.join(" / ") : "sin id"}`)
            continue
        }
        // Un hueco "tipo@data-tipo" se busca por la parte anterior a la arroba.
        const declarados = new Set()
        for (const cuerpo of candidatos) {
            for (const hueco of huecosDe(cuerpo)) declarados.add(hueco.split("@")[0])
        }
        for (const hueco of hues) {
            if (!declarados.has(hueco.split("@")[0])) {
                huesPerdidos.push(`${archivo}: ${ids.join("/")} no tiene data-tpl="${hueco.split("@")[0]}"`)
            }
        }
    }
    t.check("toda llamada apunta a un template existente", sinTemplate.length === 0, sinTemplate.join(" | "))
    t.check("todo hueco pasado existe en su template", huesPerdidos.length === 0, huesPerdidos.join(" | "))

    // Los templates no son HTML muerto: cada uno se usa.
    const huerfanos = [...docs["dashboard.html"].keys()]
        .filter(id => !llamadas.some(c => c.ids.includes(id)))
    t.check("ningún template queda sin usar", huerfanos.length === 0, huerfanos.join(" | "))

    // La inserción por textContent es lo que hace seguro el patrón: si alguien
    // cambia los valores por innerHTML, este test lo ve. El markup de iconos
    // (catálogo propio) va en una clave aparte, y los ids en otra.
    const rellenar = extraerFuncion(leer("js/ui/modal.js"), "rellenarHuecos")
    const iTexto = rellenar.indexOf("destino.textContent")
    const iMarkup = rellenar.indexOf("destino.innerHTML")
    t.check("los valores se escriben con textContent", iTexto !== -1)
    t.check("el markup de iconos va en su propia clave, aparte de los valores",
        iMarkup !== -1 && iMarkup > iTexto)
    t.check("los ids y values van por atributos con la clave hueco@atributo",
        /clave\.split\("@"\)/.test(rellenar) && /setAttribute\(atributo/.test(rellenar))

    return t
}