// Sintaxis ESM: cada archivo .js/.mjs del proyecto debe parsear como MODULO ES.
// `node --check` sobre un .js no vale (lo trata como CommonJS y se traga
// errores); se copia cada archivo a un .mjs temporal y se pasa por el parser.
import { readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { RAIZ, nuevoReporter } from "./helpers.mjs"

const IGNORAR = new Set([".git", "node_modules", "docs", ".firebase", "js/lib"])

function recorrer(dir, acc = []) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const rel = relative(RAIZ, join(dir, e.name)).replace(/\\/g, "/")
        if (IGNORAR.has(e.name) || [...IGNORAR].some(ig => rel.startsWith(ig + "/"))) continue
        const p = join(dir, e.name)
        if (e.isDirectory()) recorrer(p, acc)
        else if (/\.(js|mjs)$/.test(e.name)) acc.push(p)
    }
    return acc
}

export default function ejecutar(t = nuevoReporter("sintaxis")) {
    const tmp = join(tmpdir(), "escinco-syntax-check")
    mkdirSync(tmp, { recursive: true })

    const archivos = recorrer(RAIZ)
    let ok = 0
    const fallos = []

    for (const p of archivos) {
        const destino = join(tmp, relative(RAIZ, p).replace(/[\\/]/g, "_") + ".mjs")
        writeFileSync(destino, readFileSync(p))
        try {
            execFileSync(process.execPath, ["--check", destino], { stdio: "pipe" })
            ok++
        } catch (e) {
            const salida = (e.stderr?.toString() || e.stdout?.toString() || "").split(/\r?\n/).slice(0, 3).join(" | ")
            fallos.push(`${relative(RAIZ, p)}: ${salida}`)
        }
        rmSync(destino, { force: true })
    }

    t.check(`parsean como modulo ES (${ok}/${archivos.length})`, fallos.length === 0, fallos.join("\n      "))
    return t
}
