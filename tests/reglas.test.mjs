// Invariantes estáticas de firestore.rules (Fase 3, tarea 14a).
//
// No sustituyen al simulador, pero atrapan sin red las regresiones que ya nos
// mordieron: campos que el create rechaza pero el update admite (DEUDA-013), o
// un update de snapshots con hasOnly que tiraría los documentos legacy
// (PEND-001). El simulador real se cubre aparte en rules.test.mjs.
import { leer, nuevoReporter } from "./helpers.mjs"
import { TIPOS_MOVIMIENTO, CONFIG_MOVIMIENTOS } from "../constants/tiposMovimiento.js"

const COLECCIONES = ["cuentas", "movimientos", "posiciones", "estrategias", "metas", "pendientes", "snapshots", "trades", "ordenes", "activos", "historial"]

const AUXILIARES = [
    "estaAutenticado", "esPropietario",
    "esNumero", "esTexto", "esBool", "esTimestamp", "esMapa", "esListaEtiquetas",
    "esNumeroONulo", "esTextoONulo", "esBoolONulo", "esTimestampONulo",
    "ifPresenteTexto", "ifPresenteNumero", "ifPresenteBool", "ifPresenteTimestamp",
    "ifPresenteTextoONulo", "ifPresenteEtiquetas", "ifPresenteNumeroONulo", "ifPresenteTimestampONulo"
]

function saltarString(texto, i) {
    const q = texto[i]
    i++
    while (i < texto.length) {
        if (texto[i] === "\\") { i += 2; continue }
        if (texto[i] === q) return i + 1
        i++
    }
    return i
}

// Quita comentarios (// y /* */) sin tocar los literales de cadena: los
// comentarios del hasOnly llevan corchetes que romperían el parseo de listas.
function sinComentarios(texto) {
    let out = "", i = 0
    while (i < texto.length) {
        const ch = texto[i]
        if (ch === "'" || ch === '"') { const j = saltarString(texto, i); out += texto.slice(i, j); i = j; continue }
        if (ch === "/" && texto[i + 1] === "/") { i = texto.indexOf("\n", i); if (i === -1) break; continue }
        if (ch === "/" && texto[i + 1] === "*") { const j = texto.indexOf("*/", i + 2); i = j === -1 ? texto.length : j + 2; continue }
        out += ch; i++
    }
    return out
}

function finBloque(texto, i) {
    let nivel = 0
    for (; i < texto.length; i++) {
        const ch = texto[i]
        if (ch === "'" || ch === '"') { i = saltarString(texto, i) - 1; continue }
        if (ch === "/" && texto[i + 1] === "/") { i = texto.indexOf("\n", i); if (i === -1) return texto.length; continue }
        if (ch === "{") nivel++
        else if (ch === "}") { nivel--; if (nivel === 0) return i }
    }
    return texto.length - 1
}

function bloqueDe(texto, nombre) {
    // Salta el comodín ({cuentaId}) y apunta a la llave del cuerpo del match.
    const m = new RegExp(`match\\s+/${nombre}/\\s*\\{[^}]*\\}\\s*\\{`).exec(texto)
    if (!m) return null
    const llave = m.index + m[0].length - 1
    return texto.slice(llave, finBloque(texto, llave) + 1)
}

function capturarSentencia(texto, etiqueta) {
    const i = texto.indexOf(etiqueta)
    if (i === -1) return null
    let nivel = 0
    for (let k = i; k < texto.length; k++) {
        const ch = texto[k]
        if (ch === "'" || ch === '"') { k = saltarString(texto, k) - 1; continue }
        if (ch === "/" && texto[k + 1] === "/") { k = texto.indexOf("\n", k); if (k === -1) return texto.slice(i); continue }
        if (ch === "{") nivel++
        else if (ch === "}") nivel--
        else if (ch === ";" && nivel === 0) return texto.slice(i, k)
    }
    return texto.slice(i)
}

function lista(sentencia, fn) {
    if (!sentencia) return null
    const m = sentencia.match(new RegExp(`${fn}\\s*\\(\\s*\\[([\\s\\S]*?)\\]`))
    if (!m) return null
    return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])
}

function camposUpdate(sentencia) {
    const refs = new Set()
    for (const m of sentencia.matchAll(/ifPresente\w*\s*\(\s*request\.resource\.data\s*,\s*'([^']+)'/g)) refs.add(m[1])
    if (/ifPresenteEtiquetas\s*\(/.test(sentencia)) refs.add("etiquetas")
    return refs
}

export default function ejecutar(t = nuevoReporter("reglas")) {
    const src = sinComentarios(leer("firebase/firestore.rules"))

    // Llaves equilibradas.
    let prof = 0
    for (const ch of src) { if (ch === "{") prof++; else if (ch === "}") prof-- }
    t.check("llaves equilibradas", prof === 0, `balance ${prof}`)

    // Auxiliares definidos y usados.
    const definidas = new Set([...src.matchAll(/function\s+(\w+)\s*\(/g)].map(m => m[1]))
    const sinDefinir = AUXILIARES.filter(f => !definidas.has(f))
    t.check("auxiliares declarados", sinDefinir.length === 0, sinDefinir.join(", "))

    const usadas = new Set([...src.matchAll(/\b((?:es|ifPresente|validar)\w*)\s*\(/g)].map(m => m[1]))
    const usadasSinDefinir = [...usadas].filter(f => !definidas.has(f))
    t.check("todo auxiliar usado está definido", usadasSinDefinir.length === 0, usadasSinDefinir.join(", "))

    // Ningún allow write abierto.
    t.check("no hay allow write: if true", !/allow\s+write\s*:\s*if\s+true/.test(src))

    const faltanCreate = [], faltanUpdate = [], faltanRead = [], faltanDelete = []
    const sinHasOnly = [], asimetrias = [], hasAllSinValidar = [], sinPropietario = []
    let snapshotsSinHasOnlyUpdate = true

    for (const col of COLECCIONES) {
        const bloque = bloqueDe(src, col)
        if (!bloque) { asimetrias.push(`${col}: sin bloque`); continue }

        for (const [accion, arr] of [["read", faltanRead], ["create", faltanCreate], ["update", faltanUpdate], ["delete", faltanDelete]]) {
            if (!new RegExp(`allow\\s+${accion}\\s*:`).test(bloque)) arr.push(col)
        }

        const create = capturarSentencia(bloque, "allow create:")
        const update = capturarSentencia(bloque, "allow update:")
        const permitidos = lista(create, "hasOnly")
        const requeridos = lista(create, "hasAll")

        // create sin hasOnly deja entrar cualquier campo: la puerta abierta clásica.
        if (!permitidos) sinHasOnly.push(col)

        // Toda operación de la colección debe exigir propiedad (uid del path).
        for (const [accion, sentencia] of [["read", capturarSentencia(bloque, "allow read:")], ["create", create], ["update", update], ["delete", capturarSentencia(bloque, "allow delete:")]]) {
            if (sentencia && !/esPropietario\s*\(\s*uid\s*\)/.test(sentencia)) sinPropietario.push(`${col}.${accion}`)
        }

        // Cada campo que el update valida debe estar permitido en el create
        // (si no, se puede crear un doc que luego nunca se deja actualizar).
        if (permitidos) {
            const fuera = [...camposUpdate(update || "")].filter(f => !permitidos.includes(f))
            if (fuera.length) asimetrias.push(`${col}: update referencia ${fuera.join(", ")} fuera de hasOnly`)
        }

        // Cada campo obligatorio del create debe validarse (tipo) en el create.
        if (requeridos) {
            for (const f of requeridos) {
                if (!new RegExp(`\\.${f}\\b`).test(create)) hasAllSinValidar.push(`${col}.${f}`)
            }
        }

        if (col === "snapshots") snapshotsSinHasOnlyUpdate = !/allow update:[\s\S]*?hasOnly\s*\(/.test(bloque)
    }

    t.check("cada colección define read/create/update/delete",
        [faltanRead, faltanCreate, faltanUpdate, faltanDelete].every(a => a.length === 0),
        [...faltanRead, ...faltanCreate, ...faltanUpdate, ...faltanDelete].join(", "))
    t.check("cada create tiene hasOnly", sinHasOnly.length === 0, sinHasOnly.join(", "))
    t.check("toda operación exige esPropietario(uid)", sinPropietario.length === 0, sinPropietario.join(", "))
    t.check("update no usa campos fuera del hasOnly del create", asimetrias.length === 0, asimetrias.join(" | "))
    t.check("campos obligatorios del create están validados", hasAllSinValidar.length === 0, hasAllSinValidar.join(", "))
    t.check("snapshots no usa hasOnly en update (PEND-001)", snapshotsSinHasOnlyUpdate)

    // DEUDA-013: el hasOnly de movimientos es una lista manual que se queda
    // atrás (o delante) de CONFIG_MOVIMIENTOS. Comparamos ambos lados.
    const hasOnlyMov = lista(capturarSentencia(bloqueDe(src, "movimientos"), "allow create:"), "hasOnly") || []
    const deLaApp = new Set()
    for (const cfg of Object.values(CONFIG_MOVIMIENTOS)) {
        for (const f of cfg.camposObligatorios || []) deLaApp.add(f)
        for (const f of cfg.camposOpcionales || []) deLaApp.add(f)
    }
    const comunes = ["tipo", "divisa", "fechaRegistro", "metaId", "etiquetas"]
    const faltanEnReglas = [...deLaApp].filter(f => !hasOnlyMov.includes(f))
    t.check("todo campo de CONFIG_MOVIMIENTOS está en el hasOnly de movimientos (DEUDA-013)", faltanEnReglas.length === 0, faltanEnReglas.join(", "))

    const sobranEnReglas = hasOnlyMov.filter(f => !deLaApp.has(f) && !comunes.includes(f))
    t.check("el hasOnly de movimientos no admite campos huérfanos (DEUDA-013)", sobranEnReglas.length === 0, sobranEnReglas.join(", "))

    const sinConfig = Object.values(TIPOS_MOVIMIENTO).filter(tp => !CONFIG_MOVIMIENTOS[tp])
    t.check("cada tipo de movimiento tiene configuración", sinConfig.length === 0, sinConfig.join(", "))

    return t
}
