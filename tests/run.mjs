// Runner de tests. Ejecuta todos los `*.test.mjs` de tests/ (o solo los que
// pasen como argumento) e imprime un resumen. Exit code != 0 si algo falla.
import { readdirSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
import { nuevoReporter } from "./helpers.mjs"

const AQUI = dirname(fileURLToPath(import.meta.url))
const filtros = process.argv.slice(2)

const archivos = readdirSync(AQUI)
    .filter(f => f.endsWith(".test.mjs"))
    .filter(f => filtros.length === 0 || filtros.some(x => f.includes(x)))
    .sort()

let totalFallos = 0
const resumen = []

for (const archivo of archivos) {
    console.log(`\n=== ${archivo} ===`)
    const t = nuevoReporter(archivo)
    try {
        const mod = await import(pathToFileURL(join(AQUI, archivo)).href)
        if (typeof mod.default !== "function") {
            t.check("el modulo exporta un test por defecto", false)
        } else {
            await mod.default(t)
        }
    } catch (e) {
        t.check(`excepcion no controlada: ${e.message}`, false)
    }
    totalFallos += t.fallos
    resumen.push(t)
}

console.log("\n" + "=".repeat(48))
for (const r of resumen) {
    console.log(`${r.fallos === 0 ? "PASA" : "FALLA"}  ${r.nombre.padEnd(28)} ${r.total - r.fallos}/${r.total}`)
}
console.log("=".repeat(48))
console.log(totalFallos === 0 ? "TODO OK" : `${totalFallos} comprobacion(es) fallan`)

process.exit(totalFallos === 0 ? 0 : 1)
