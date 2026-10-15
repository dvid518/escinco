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
import { leer, RAIZ, nuevoReporter } from "./helpers.mjs"

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

// Llamadas contenidoDesdeTemplate("id", { hueco: ... }) en todo js/.
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
        const src = leer(relative(RAIZ, ruta))
        for (const m of src.matchAll(/contenidoDesdeTemplate\(\s*"([^"]+)"\s*(?:,\s*\{([\s\S]*?)\})?\s*\)/g)) {
            const hues = m[2] ? [...m[2].matchAll(/(\w+)\s*:/g)].map(x => x[1]) : []
            llamadas.push({ archivo: relative(RAIZ, ruta).replace(/\\/g, "/"), id: m[1], hues })
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
    for (const { archivo, id, hues } of llamadas) {
        const cuerpo = docs["dashboard.html"].get(id)
        if (!cuerpo) {
            sinTemplate.push(`${archivo}: "${id}"`)
            continue
        }
        const declarados = huecosDe(cuerpo)
        for (const hueco of hues) {
            if (!declarados.has(hueco)) huesPerdidos.push(`${archivo}: ${id} no tiene data-tpl="${hueco}"`)
        }
    }
    t.check("toda llamada apunta a un template existente", sinTemplate.length === 0, sinTemplate.join(" | "))
    t.check("todo hueco pasado existe en su template", huesPerdidos.length === 0, huesPerdidos.join(" | "))

    // Los templates no son HTML muerto: cada uno se usa.
    const huerfanos = [...docs["dashboard.html"].keys()]
        .filter(id => !llamadas.some(c => c.id === id))
    t.check("ningún template queda sin usar", huerfanos.length === 0, huerfanos.join(" | "))

    // La inserción por textContent es lo que hace seguro el patrón: si alguien
    // vuelve a meter innerHTML dentro de contenidoDesdeTemplate, este test lo ve.
    const modalJs = leer("js/ui/modal.js")
    const cuerpoHelper = modalJs.slice(
        modalJs.indexOf("export function contenidoDesdeTemplate"),
        modalJs.indexOf("/**", modalJs.indexOf("export function contenidoDesdeTemplate") + 10)
    )
    t.check("contenidoDesdeTemplate no usa innerHTML", !cuerpoHelper.includes("innerHTML"))

    return t
}