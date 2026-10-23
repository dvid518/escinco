// Validación de schemaVersion en snapshots (Parte C, tarea B1b).
//
// Comprueba, sin Firebase ni DOM:
//   1. El código de escritura (guardarSnapshotDelDia) incluye schemaVersion: 1
//      en el objeto limpio que se persiste.
//   2. firestore.rules admite schemaVersion en el hasOnly del create.
//   3. El código de lectura tolera snapshots sin schemaVersion (v0).
import { leer, nuevoReporter, extraerFuncion } from "./helpers.mjs"

function sinComentarios(texto) {
    let out = "", i = 0
    while (i < texto.length) {
        const ch = texto[i]
        if (ch === "'" || ch === '"') { const j = texto.indexOf(ch, i + 1); out += texto.slice(i, j + 1); i = j + 1; continue }
        if (ch === "/" && texto[i + 1] === "/") { i = texto.indexOf("\n", i); if (i === -1) break; continue }
        if (ch === "/" && texto[i + 1] === "*") { const j = texto.indexOf("*/", i + 2); i = j === -1 ? texto.length : j + 2; continue }
        out += ch; i++
    }
    return out
}

export default async function ejecutar(t = nuevoReporter("snapshotSchema")) {
    const src = sinComentarios(leer("js/repositories/SnapshotRepositorio.js"))
    const reglas = sinComentarios(leer("firebase/firestore.rules"))

    // 1. schemaVersion: 1 está en el objeto limpio de escritura
    t.check("guardarSnapshotDelDia escribe schemaVersion: 1",
        /schemaVersion:\s*1/.test(src),
        src.match(/schemaVersion:\s*\d+/)?.[0] || "no encontrado")

    // 2. schemaVersion está en el hasOnly del create de snapshots en las reglas
    const tieneSnapshotBlock = /match\s*\/snapshots\/\{fecha\}\s*\{/.test(reglas)
    const tieneSchemaVersionEnReglas = /'schemaVersion'/.test(reglas) || /"schemaVersion"/.test(reglas)
    t.check("firestore.rules: tiene bloque snapshots/{fecha}", tieneSnapshotBlock)
    t.check("firestore.rules: schemaVersion aparece en las reglas", tieneSchemaVersionEnReglas)
    // Verificar que schemaVersion está dentro del bloque snapshots (no en otra colección)
    const idxSnap = reglas.indexOf("match /snapshots/{fecha}")
    const idxNext = reglas.indexOf("match /", idxSnap + 1)
    const bloqueSnap = idxNext === -1 ? reglas.slice(idxSnap) : reglas.slice(idxSnap, idxNext)
    t.check("schemaVersion está dentro del bloque snapshots/{fecha}",
        bloqueSnap.includes("'schemaVersion'") || bloqueSnap.includes('"schemaVersion"'),
        bloqueSnap.substring(0, 300))

    // 3. El código de lectura usa spread de doc.data() (no requiere schemaVersion)
    const lectura = extraerFuncion(src, "obtenerSnapshots")
    t.check("lectura de snapshots usa spread de doc.data() (tolerante a v0)",
        /\.\.\.doc\.data\(\)/.test(lectura))

    const lecturaHoy = extraerFuncion(src, "obtenerSnapshotHoy")
    t.check("lectura de snapshot hoy usa spread de doc.data() (tolerante a v0)",
        /\.\.\.resultado\.data\(\)/.test(lecturaHoy))

    return t
}
