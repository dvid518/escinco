// Cobertura del precaché del service worker.
//
// `assets.test.mjs` comprueba que lo que declara SHELL_ASSETS existe en disco.
// Este test comprueba lo contrario: que TODO el código publicado está en
// SHELL_ASSETS. Sin esto, un módulo nuevo se queda fuera del offline y el fallo
// solo aparece cuando el usuario abre esa pantalla sin conexión (es lo que
// pasaba con doodles.js, presupuestos.js, Favorito/Presupuesto y AuthServicio).
//
// El router carga páginas con `import()` dinámico y nombre construido en
// tiempo de ejecución, así que no se puede calcular el cierre de imports
// estáticamente: se exige la lista completa de carpetas de código.
import { readdirSync } from "node:fs"
import { leer, RAIZ, nuevoReporter } from "./helpers.mjs"

const CARPETAS_JS = ["js", "firebase", "constants"]
const CARPETA_CSS = "css"

// Documentos que sirven las dos webs de Firebase Hosting.
const DOCUMENTOS = [
    "/",
    "/dashboard.html",
    "/auth.html",
    "/reset-password.html",
    "/demo.html",
    "/privacidad.html",
    "/terminos.html",
    "/tratamiento-datos.html",
    "/404.html",
    "/manifest.webmanifest"
]

function listar(dir, extension) {
    const salida = []
    for (const entrada of readdirSync(`${RAIZ}/${dir}`, { withFileTypes: true })) {
        const ruta = `${dir}/${entrada.name}`
        if (entrada.isDirectory()) {
            salida.push(...listar(ruta, extension))
        } else if (entrada.name.endsWith(extension)) {
            salida.push(`/${ruta}`)
        }
    }
    return salida
}

export default function ejecutar(t = nuevoReporter("precache")) {
    const sw = leer("sw.js")
    const m = sw.match(/const SHELL_ASSETS = \[([\s\S]*?)\n\]/)
    if (!m) {
        t.check("SHELL_ASSETS localizable en sw.js", false)
        return t
    }

    const assets = new Set([...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]))

    // El target `app` no publica index.html (firebase.json lo ignora). Pedirlo
    // en el install devolvía 404 y, con `cache.addAll`, tumbaba TODO el precaché.
    t.check("el precache no pide /index.html (la app no lo publica)", !assets.has("/index.html"))

    // `/` responde en los dos targets (landing -> index.html, app -> dashboard.html)
    // y es el respaldo offline independiente del dominio.
    t.check("el precache incluye / como portada de cada sitio", assets.has("/"))

    const faltanDocumentos = DOCUMENTOS.filter(d => !assets.has(d))
    t.check("todos los documentos están en el precache", faltanDocumentos.length === 0, faltanDocumentos.join(", "))

    const modulos = CARPETAS_JS.flatMap(carpeta => listar(carpeta, ".js"))
    const faltanModulos = modulos.filter(m2 => !assets.has(m2))
    t.check("todos los módulos publicados están en el precache", faltanModulos.length === 0,
        faltanModulos.slice(0, 12).join(", ") + (faltanModulos.length > 12 ? ` (+${faltanModulos.length - 12})` : ""))

    const hojas = listar(CARPETA_CSS, ".css")
    const faltanHojas = hojas.filter(h => !assets.has(h))
    t.check("todas las hojas de estilo están en el precache", faltanHojas.length === 0, faltanHojas.join(", "))

    // Cada despliegue debe tener un identificador técnico propio, separado de
    // la versión comercial.
    const build = leer("constants/build.js")
    t.check("constants/build.js exporta BUILD_ID", /export\s+const\s+BUILD_ID\s*=\s*"[^"]+"/.test(build))
    t.check("sw.js usa BUILD_ID en el nombre de las cachés", /BUILD_ID/.test(sw) && /escinco-\$\{VERSION\.numero\}-\$\{BUILD_ID\}/.test(sw))

    // Las cachés ajenas no se tocan: activate solo borra el prefijo propio.
    t.check("activate solo borra cachés con prefijo escinco-", /PREFIJO_CACHE\s*=\s*"escinco-"/.test(sw)
        && /startsWith\(PREFIJO_CACHE\)/.test(sw))

    // El SW no debe interceptar recursos de otros orígenes: su `fetch()` se
    // evalúa contra el `connect-src` de la CSP de la página y, si no incluye el
    // origen (p. ej. www.gstatic.com), el módulo de Firebase se bloquea y el
    // login se queda sin SDK. gstatic ya cachea esos archivos por su cuenta.
    const guardaOrigen = sw.indexOf("url.origin !== self.location.origin")
    const primerRespondWith = sw.indexOf("event.respondWith")
    t.check("el SW deja pasar los recursos de otros orígenes",
        guardaOrigen !== -1 && primerRespondWith !== -1 && guardaOrigen < primerRespondWith)
    t.check("el SW no cachea el SDK de Firebase de gstatic",
        !/esSdkVersionado|firebasejs/.test(sw))

    return t
}
