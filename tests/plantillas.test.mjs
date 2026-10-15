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

// ----------------------------------------------------------------------
// Lectura del HTML
// ----------------------------------------------------------------------

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

// ----------------------------------------------------------------------
// Lectura del JS
// ----------------------------------------------------------------------

// Avanza saltando una cadena (", ' o `), incluidas las interpolaciones ${...}
// de las plantillas literales, para que un paréntesis o una clave dentro de un
// texto no se cuente como código.
function saltarCadena(src, i) {
    const comilla = src[i]
    i++
    while (i < src.length) {
        const ch = src[i]
        if (ch === "\\") { i += 2; continue }
        if (comilla === "`" && ch === "$" && src[i + 1] === "{") {
            let nivel = 1
            i += 2
            while (i < src.length && nivel > 0) {
                const c = src[i]
                if (c === '"' || c === "'" || c === "`") { i = saltarCadena(src, i); continue }
                if (c === "{") nivel++
                else if (c === "}") nivel--
                i++
            }
            continue
        }
        if (ch === comilla) return i + 1
        i++
    }
    return i
}

// Texto de una llamada: desde el paréntesis hasta su cierre, contando anidados.
function argumentosDe(src, inicio) {
    let nivel = 0
    for (let i = inicio; i < src.length; i++) {
        const ch = src[i]
        if (ch === '"' || ch === "'" || ch === "`") { i = saltarCadena(src, i) - 1; continue }
        if (ch === "(" || ch === "{" || ch === "[") nivel++
        else if (ch === ")" || ch === "}" || ch === "]") {
            nivel--
            if (nivel < 0) return src.slice(inicio, i)
        }
    }
    return src.slice(inicio)
}

// Claves del objeto que empieza en `pos` (la llave de {). Solo las del primer
// nivel: es donde van los pares { hueco: valor }.
function clavesDeObjeto(src, pos) {
    const claves = []
    let nivel = 0
    let esperarClave = true
    for (let i = pos; i < src.length; i++) {
        const ch = src[i]
        if (ch === '"' || ch === "'" || ch === "`") {
            const fin = saltarCadena(src, i)
            if (nivel === 1 && ch === '"' && esperarClave) {
                // clave entre comillas, o valor: se ve por lo que sigue
                let j = fin
                while (j < src.length && /\s/.test(src[j])) j++
                if (src[j] === ":") claves.push(src.slice(i + 1, fin - 1))
            }
            i = fin - 1
            esperarClave = false
            continue
        }
        if (ch === "{" || ch === "[" || ch === "(") {
            nivel++
            if (nivel === 1) esperarClave = true
            continue
        }
        if (ch === "}" || ch === "]" || ch === ")") {
            nivel--
            if (nivel === 0) break
            continue
        }
        if (ch === "," && nivel === 1) { esperarClave = true; continue }
        if (/[\w$]/.test(ch)) {
            let j = i
            while (j < src.length && /[\w$-]/.test(src[j])) j++
            const palabra = src.slice(i, j)
            let k = j
            while (k < src.length && /\s/.test(src[k])) k++
            if (nivel === 1 && src[k] === ":") claves.push(palabra)
            // Atajo: { mensaje } sin dos puntos.
            else if (nivel === 1 && esperarClave) claves.push(palabra)
            i = j - 1
            esperarClave = false
            continue
        }
        if (!/\s/.test(ch)) esperarClave = false
    }
    return claves
}

// Llamadas contenidoDesdeTemplate(...) y contenidoDesdeFilas(...) en todo js/.
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
        for (const m of src.matchAll(/contenidoDesde(Template|Filas)\(/g)) {
            const llamada = argumentosDe(src, m.index + m[0].length)
            // Un id puede venir de un condicional (`cond ? "tpl-a" : "tpl-b"`),
            // así que se recogen todos los literales que parecen un template.
            const ids = [...llamada.matchAll(/"(tpl-[\w-]+)"/g)].map(x => x[1])
            const hues = new Set()
            for (const bloque of llamada.matchAll(/(?:valores|html)\s*:\s*\{/g)) {
                for (const clave of clavesDeObjeto(llamada, bloque.index + bloque[0].length - 1)) {
                    if (clave) hues.add(clave)
                }
            }
            llamadas.push({ archivo, ids, helper: m[1], hues: [...hues] })
        }
    }
    return llamadas
}

// ----------------------------------------------------------------------

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
    // (catálogo propio) va en una clave aparte, y atributos y propiedades en
    // otras ("hueco@data-tipo", "marcado@checked").
    const rellenar = extraerFuncion(leer("js/ui/modal.js"), "rellenarHuecos")
    const iTexto = rellenar.indexOf(".textContent")
    const iMarkup = rellenar.indexOf(".innerHTML")
    t.check("los valores se escriben con textContent", iTexto !== -1)
    t.check("el markup de iconos va en su propia clave, aparte de los valores",
        iMarkup !== -1 && iMarkup > iTexto)
    t.check("los atributos y las casillas van por su clave",
        /clave\.split\("@"\)/.test(rellenar) && /setAttribute\(destino/.test(rellenar) &&
        /PROPIEDADES\.includes\(destino\)/.test(rellenar))

    return t
}