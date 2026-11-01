// Servidor local para probar la landing y la app a la vez.
//
//   npm run local
//
//   landing → http://localhost:5080
//   app     → http://localhost:5085
//
// En Firebase Hosting son dos sitios distintos (targets `landing` y `app`) del
// mismo repositorio, cada uno con sus rewrites. Aquí se emulan con dos
// servidores sobre el mismo directorio, aplicando los rewrites de firebase.json
// y su CSP. Los puertos se pueden cambiar con PUERTO_LANDING / PUERTO_APP.
//
// Se usan 5080/5085 a propósito: `firebase serve --port N` ocupa N y N+5 (los
// targets landing y app), así que los puertos habituales 5010/5020/5030 ya
// pueden estar cogidos por instancias abiertas.
//
// La landing enlaza a la app con URLs absolutas (https://app.escinco.com). Al
// servir su HTML se reescriben a la app local para que "Entrar", "Registrarse",
// etc. no salten a producción. Las rutas internas de la app son relativas, así
// que una vez dentro se quedan en el puerto 5085.
//
// Este archivo vive en tools/ y firebase.json ignora tools/**, así que no se
// publica.
//
// Además sirve el proxy del asistente drov en /api/ia. La clave de Gemini se lee
// de `GEMINI_API_KEY` (o de `.env.local`) y NUNCA llega al navegador: el cliente
// solo ve esta ruta local. Al desplegar, esa ruta tiene que ser una Cloud
// Function o Firebase AI Logic, porque el hosting estático no ejecuta Node.

import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { IA_CONFIG } from "../js/core/iaConfig.js"

const RAIZ = resolve(fileURLToPath(new URL("..", import.meta.url)))
const HOST = "127.0.0.1"
const PUERTO_LANDING = Number(process.env.PUERTO_LANDING || 5080)
const PUERTO_APP = Number(process.env.PUERTO_APP || 5085)

// ============================================
// PROXY DE IA
// ============================================
// Rutas y límites. El cuerpo máximo evita que una petición enorme se coma la
// memoria del proceso local.

const RUTA_IA = "/api/ia"
const RUTA_ESTADO = "/api/ia/estado"
const MAX_CUERPO_IA = 512 * 1024

// ============================================
// CACHÉ Y RATE LIMITING DEL PROXY
// ============================================
// Evita reenviar a Gemini peticiones idénticas (mismo cuerpo) y limita la
// frecuencia para no agotar la cuota gratuita (429 Too Many Requests).

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos
const cacheRespuestas = new Map() // hash -> { texto, status, expira }

function hashDe(texto) {
    return createHash("sha256").update(texto).digest("hex")
}

function obtenerDeCache(hash) {
    const entrada = cacheRespuestas.get(hash)
    if (!entrada || Date.now() > entrada.expira) {
        cacheRespuestas.delete(hash)
        return null
    }
    return entrada
}

function guardarEnCache(hash, texto, status) {
    cacheRespuestas.set(hash, { texto, status, expira: Date.now() + CACHE_TTL_MS })
    if (cacheRespuestas.size > 200) {
        const primera = cacheRespuestas.keys().next().value
        if (primera !== undefined) cacheRespuestas.delete(primera)
    }
}

// Rate limiting: máximo 20 peticiones por minuto (ventana deslizante simple).
const LIMITE_PETICIONES = 20
const VENTANA_MS = 60 * 1000
const marcasPorIp = new Map() // ip -> [timestamps]

function rateLimitOK(ip) {
    const ahora = Date.now()
    const inicio = ahora - VENTANA_MS
    const marcas = marcasPorIp.get(ip) || []
    const recientes = marcas.filter(m => m > inicio)

    if (recientes.length >= LIMITE_PETICIONES) return false

    recientes.push(ahora)
    marcasPorIp.set(ip, recientes)
    return true
}

function ipDe(req) {
    return (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim() || "local"
}

const entornoLocal = await leerEntornoLocal()
const CLAVE_IA = (process.env.GEMINI_API_KEY || entornoLocal.GEMINI_API_KEY || "").trim()

async function leerEntornoLocal() {
    try {
        const texto = await readFile(resolve(RAIZ, ".env.local"), "utf8")
        const valores = {}

        for (const linea of texto.split(/\r?\n/)) {
            const limpia = linea.trim()
            if (!limpia || limpia.startsWith("#")) continue

            const separador = limpia.indexOf("=")
            if (separador === -1) continue

            const clave = limpia.slice(0, separador).trim()
            let valor = limpia.slice(separador + 1).trim()
            if (
                (valor.startsWith("\"") && valor.endsWith("\"")) ||
                (valor.startsWith("'") && valor.endsWith("'"))
            ) {
                valor = valor.slice(1, -1)
            }

            if (clave) valores[clave] = valor
        }

        return valores
    } catch {
        return {}
    }
}

// El proxy solo atiende al propio servidor: una web abierta en el navegador no
// puede usar la clave haciendo peticiones a localhost.
function origenPermitido(req) {
    const origen = req.headers.origin
    if (!origen) return true

    try {
        return new URL(origen).host === req.headers.host
    } catch {
        return false
    }
}

function responderJson(res, estado, datos) {
    const cuerpo = JSON.stringify(datos)
    res.writeHead(estado, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(cuerpo),
        "Cache-Control": "no-store"
    })
    res.end(cuerpo)
}

function leerCuerpo(req, maximo) {
    return new Promise((resolver, rechazar) => {
        const trozos = []
        let total = 0

        req.on("data", trozo => {
            total += trozo.length
            if (total > maximo) {
                rechazar(new Error("CUERPO_DEMASIADO_GRANDE"))
                req.destroy()
                return
            }
            trozos.push(trozo)
        })
        req.on("end", () => resolver(Buffer.concat(trozos).toString("utf8")))
        req.on("error", rechazar)
    })
}

async function manejarIa(req, res, ruta) {
    if (!origenPermitido(req)) {
        responderJson(res, 403, { error: { message: "Origen no permitido." } })
        return
    }

    if (ruta === RUTA_ESTADO) {
        if (req.method !== "GET" && req.method !== "HEAD") {
            res.writeHead(405, { Allow: "GET, HEAD" })
            res.end()
            return
        }
        responderJson(res, 200, {
            disponible: Boolean(CLAVE_IA),
            modelo: IA_CONFIG.modelo
        })
        return
    }

    if (req.method !== "POST") {
        res.writeHead(405, { Allow: "POST" })
        res.end()
        return
    }

    if (!CLAVE_IA) {
        responderJson(res, 503, {
            error: { message: "Falta GEMINI_API_KEY en .env.local o en el entorno." }
        })
        return
    }

    // Rate limiting por IP
    const ip = ipDe(req)
    if (!rateLimitOK(ip)) {
        responderJson(res, 429, {
            error: { message: "Demasiadas peticiones al asistente. Espera un momento." }
        })
        return
    }

    let cuerpo
    try {
        cuerpo = await leerCuerpo(req, MAX_CUERPO_IA)
    } catch (error) {
        if (error?.message === "CUERPO_DEMASIADO_GRANDE") {
            responderJson(res, 413, { error: { message: "La petición es demasiado grande." } })
            return
        }
        responderJson(res, 400, { error: { message: "No se pudo leer la petición." } })
        return
    }

    // Caché: si ya hicimos esta petición exacta hace menos de 5 min, la servimos
    // sin consultar a Gemini.
    const hash = hashDe(cuerpo)
    const cacheado = obtenerDeCache(hash)
    if (cacheado) {
        res.writeHead(cacheado.status, {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": Buffer.byteLength(cacheado.texto),
            "Cache-Control": "no-store",
            "X-Proxy-Cache": "hit"
        })
        res.end(cacheado.texto)
        return
    }

    const controlador = new AbortController()
    const temporizador = setTimeout(() => controlador.abort(), IA_CONFIG.tiempoMaximoMs + 5000)

    try {
        const respuesta = await fetch(
            `${IA_CONFIG.endpoint}/models/${IA_CONFIG.modelo}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": CLAVE_IA
                },
                body: cuerpo,
                signal: controlador.signal
            }
        )

        const texto = await respuesta.text()

        // Guarda en caché respuestas exitosas (200)
        if (respuesta.ok) {
            guardarEnCache(hash, texto, respuesta.status)
        }

        // Si Gemini responde 429, reenvía el estado y un mensaje claro al cliente
        const cabeceras = {
            "Content-Type": respuesta.headers.get("content-type") || "application/json; charset=utf-8",
            "Content-Length": Buffer.byteLength(texto),
            "Cache-Control": "no-store"
        }
        if (respuesta.headers.has("retry-after")) {
            cabeceras["Retry-After"] = respuesta.headers.get("retry-after")
        }

        res.writeHead(respuesta.status, cabeceras)
        res.end(texto)
    } catch (error) {
        const abortado = error?.name === "AbortError"
        console.error("[local:ia]", abortado ? "Gemini no respondió a tiempo" : error?.message || error)
        responderJson(res, 502, {
            error: {
                message: abortado
                    ? "Gemini tardó demasiado en responder."
                    : "No se pudo contactar con Gemini."
            }
        })
    } finally {
        clearTimeout(temporizador)
    }
}

const TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".eot": "application/vnd.ms-fontobject",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".pdf": "application/pdf"
}

const firebase = JSON.parse(await readFile(resolve(RAIZ, "firebase.json"), "utf8"))

function configDe(target) {
    const hosting = (firebase.hosting || []).find(h => h.target === target)
    if (!hosting) throw new Error(`No hay target "${target}" en firebase.json`)
    return hosting
}

function cspDe(config) {
    for (const regla of config.headers || []) {
        const cabecera = (regla.headers || []).find(h => h.key.toLowerCase() === "content-security-policy")
        if (cabecera) return cabecera.value
    }
    return null
}

// Los rewrites de firebase.json son exactos (/login) o de prefijo (/demo/**).
function rewritesDe(config) {
    return (config.rewrites || []).map(({ source, destination }) => {
        if (source.endsWith("/**")) {
            return { prefijo: `${source.slice(0, -3)}/`, destino: destination }
        }
        return { exacto: source, destino: destination }
    })
}

function resolverRuta(config, ruta) {
    const rewrites = rewritesDe(config)

    for (const r of rewrites) {
        if (r.exacto === ruta) return r.destino
    }
    for (const r of rewrites) {
        if (r.prefijo && ruta.startsWith(r.prefijo)) return r.destino
    }

    // Sin rewrite, "/" es el index.html del directorio público.
    return ruta === "/" ? "/index.html" : ruta
}

function archivoSeguro(ruta) {
    const relativa = ruta.replace(/^\/+/, "")
    const archivo = resolve(RAIZ, relativa)
    if (archivo !== RAIZ && !archivo.startsWith(RAIZ + sep)) return null
    return archivo
}

async function servirArchivo(req, res, archivo, { estado = 200, reescribirEnlaces = false, csp = null } = {}) {
    let contenido = await readFile(archivo)
    const tipo = TIPOS[extname(archivo).toLowerCase()] || "application/octet-stream"

    if (reescribirEnlaces && tipo.startsWith("text/html")) {
        const host = (req.headers.host || "localhost").replace(/:\d+$/, "")
        contenido = Buffer.from(
            contenido.toString("utf8").replaceAll("https://app.escinco.com", `http://${host}:${PUERTO_APP}`),
            "utf8"
        )
    }

    const cabeceras = {
        "Content-Type": tipo,
        "Content-Length": contenido.length,
        "Cache-Control": "no-cache"
    }
    if (csp) cabeceras["Content-Security-Policy"] = csp

    res.writeHead(estado, cabeceras)
    res.end(req.method === "HEAD" ? undefined : contenido)
}

function crearServidor({ nombre, puerto, config, reescribirEnlaces }) {
    const csp = cspDe(config)

    return createServer(async (req, res) => {
        let ruta
        try {
            const url = new URL(req.url, `http://${req.headers.host || "localhost"}`)
            ruta = decodeURIComponent(url.pathname)
        } catch {
            res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" })
            res.end("Petición inválida")
            return
        }

        // El proxy de IA va antes del filtro GET/HEAD: necesita POST.
        if (ruta === RUTA_IA || ruta === RUTA_ESTADO) {
            await manejarIa(req, res, ruta)
            return
        }

        if (req.method !== "GET" && req.method !== "HEAD") {
            res.writeHead(405, { Allow: "GET, HEAD" })
            res.end()
            return
        }

        try {
            const archivo = archivoSeguro(resolverRuta(config, ruta))
            const info = archivo ? await stat(archivo).catch(() => null) : null

            if (info?.isFile()) {
                await servirArchivo(req, res, archivo, { reescribirEnlaces, csp })
                return
            }

            // Mismo 404.html que publica Firebase Hosting.
            const noEncontrado = archivoSeguro("/404.html")
            const info404 = noEncontrado ? await stat(noEncontrado).catch(() => null) : null
            if (info404?.isFile()) {
                await servirArchivo(req, res, noEncontrado, { estado: 404, csp })
                return
            }

            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
            res.end("404")
        } catch (error) {
            console.error(`[local:${nombre}]`, error)
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
            res.end("Error interno del servidor local")
        }
    })
}

function escuchar(servidor, nombre, puerto) {
    servidor.on("error", error => {
        if (error.code === "EADDRINUSE") {
            console.error(`[local] El puerto ${puerto} (${nombre}) ya está ocupado.`)
            console.error(`[local] Cierra el proceso que lo usa o cambia el puerto con PUERTO_LANDING / PUERTO_APP.`)
            process.exit(1)
        }
        throw error
    })

    servidor.listen(puerto, HOST, () => {
        console.log(`[local] ${nombre.padEnd(7)} http://localhost:${puerto}`)
    })
}

const landing = crearServidor({
    nombre: "landing",
    puerto: PUERTO_LANDING,
    config: configDe("landing"),
    reescribirEnlaces: true
})

const app = crearServidor({
    nombre: "app",
    puerto: PUERTO_APP,
    config: configDe("app"),
    reescribirEnlaces: false
})

if (CLAVE_IA) {
    console.log(`[local] drov     proxy ${RUTA_IA} · ${IA_CONFIG.modelo}`)
} else {
    console.warn("[local] drov desactivado: falta GEMINI_API_KEY en .env.local o en el entorno.")
}

escuchar(landing, "landing", PUERTO_LANDING)
escuchar(app, "app", PUERTO_APP)
