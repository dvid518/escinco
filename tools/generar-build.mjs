// ============================================
// GENERADOR DE constants/build.js
// ============================================
// Calcula un identificador técnico único por despliegue y lo escribe en
// constants/build.js. Se ejecuta automáticamente desde el `predeploy` de
// firebase.json, así que no hace falta tocar nada a mano antes de publicar.
//
// El identificador combina:
//   1. El commit de git (corto), si estamos dentro de un repositorio.
//   2. Un hash del CONTENIDO de todos los archivos que se publican.
//
// Con eso, dos despliegues distintos nunca comparten BUILD_ID, y volver a
// desplegar exactamente el mismo contenido reutiliza el mismo (idempotente:
// `predeploy` corre una vez por target y no queremos ids distintos).
//
// Uso:
//   node tools/generar-build.mjs            -> escribe constants/build.js
//   node tools/generar-build.mjs --print    -> muestra el id sin escribir
//   node tools/generar-build.mjs --id local -> fija un id concreto (tests)
// ============================================

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SALIDA = join(RAIZ, "constants", "build.js")

// Carpetas que firebase.json no publica (o que no forman parte del sitio).
const CARPETAS_IGNORADAS = new Set([
    ".git",
    ".firebase",
    ".github",
    ".agents",
    ".swarm",
    "node_modules",
    "docs",
    "tests",
    "tools",
    "experimentos"
])

// Archivos que no se publican o que no deben influir en el hash.
const ARCHIVOS_IGNORADOS = new Set(["firebase.json", "firebase-debug.log", "package.json", "package-lock.json", "skills-lock.json", "prompt.txt"])

const EXTENSIONES = /\.(html|css|js|mjs|json|webmanifest|svg|png|jpg|jpeg|webp|ico|ttf|otf|woff2?|txt|xml)$/i

function esIgnorado(nombre) {
    return nombre.startsWith(".") || nombre.endsWith(".md") || nombre.endsWith(".log") || ARCHIVOS_IGNORADOS.has(nombre)
}

function listarArchivos(dir, acumulado = []) {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        if (entrada.isDirectory()) {
            if (CARPETAS_IGNORADAS.has(entrada.name) || entrada.name.startsWith(".")) continue
            listarArchivos(join(dir, entrada.name), acumulado)
            continue
        }
        if (!entrada.isFile()) continue
        if (esIgnorado(entrada.name)) continue
        if (!EXTENSIONES.test(entrada.name)) continue
        acumulado.push(join(dir, entrada.name))
    }
    return acumulado
}

function commitCorto() {
    try {
        return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
            cwd: RAIZ,
            stdio: ["ignore", "pipe", "ignore"]
        }).toString().trim()
    } catch {
        return "nogit"
    }
}

function huellaDeContenido(archivos) {
    const hash = createHash("sha256")
    for (const archivo of archivos) {
        // La ruta entra en el hash: mover un archivo también es un cambio.
        hash.update(relative(RAIZ, archivo).split(sep).join("/"))
        hash.update("\0")
        hash.update(readFileSync(archivo))
        hash.update("\0")
    }
    return hash.digest("hex").slice(0, 10)
}

export function calcularBuildId() {
    // constants/build.js se excluye del hash (se reescribe a sí mismo).
    const archivos = listarArchivos(RAIZ)
        .filter(a => a !== SALIDA)
        .sort()
    return `${commitCorto()}-${huellaDeContenido(archivos)}`
}

export function contenidoBuild(id) {
    return [
        "// ============================================",
        "// IDENTIFICADOR TÉCNICO DEL DESPLIEGUE",
        "// ============================================",
        "// ARCHIVO GENERADO por tools/generar-build.mjs — no editar a mano.",
        "//",
        "// `BUILD_ID` identifica una publicación concreta del sitio. NO es la",
        "// versión comercial (`VERSION.numero` en constants/version.js).",
        "//",
        "// En el repositorio vale \"local\" (desarrollo y `firebase serve`). El",
        "// `predeploy` de firebase.json lo reescribe en cada `firebase deploy`",
        "// con el commit y una huella del contenido publicado.",
        "// ============================================",
        "",
        `export const BUILD_ID = "${id}"`,
        ""
    ].join("\n")
}

function argumento(nombre) {
    const i = process.argv.indexOf(nombre)
    return i === -1 ? null : process.argv[i + 1]
}

const esEjecucionDirecta = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (esEjecucionDirecta) {
    const idFijado = argumento("--id")
    const id = idFijado || calcularBuildId()
    const contenido = contenidoBuild(id)

    if (process.argv.includes("--print")) {
        console.log(id)
    } else {
        writeFileSync(SALIDA, contenido, "utf8")
        console.log(`[build] constants/build.js -> ${id}`)
    }
}
