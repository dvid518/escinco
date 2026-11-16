// Aplicador de propuestas de migración M4 y M5.
// Lee un JSON de propuesta y aplica solo las propuestas marcadas "aprobada".
// Las escrituras van por el repositorio de posiciones (SDK web de Firestore),
// que no se puede cargar desde Node: en ese caso aborta ANTES de tocar nada y
// lo explica, en vez de fingir que aplicó. La lectura de estado usa
// lector-datos.mjs, así que `--backup` permite verificar sin Firestore.
//
// Idempotente: si la posición ya tiene custodio, no se sobrescribe.
//----------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { leerPosiciones, uidDesdeBackup, UID_RESPALDO } from "./lector-datos.mjs"

//----------------------------------------------------------------------------
// Argumentos
//----------------------------------------------------------------------------

const args = process.argv.slice(2)
const rutaArchivo = args.find(a => !a.startsWith("--"))
const uidArg = args.find(a => a.startsWith("--uid="))?.replace("--uid=", "")
const backupPath = args.find(a => a.startsWith("--backup="))?.replace("--backup=", "")

if (!rutaArchivo) {
    console.error("❌ Uso: node aplicar-propuesta.mjs <propuesta.json> [--uid=...] [--backup=...]")
    console.log("   Ejemplo: node scripts/migraciones/aplicar-propuesta.mjs propuesta-m4.json --backup=escinco_backup.dvid")
    process.exit(1)
}

if (!existsSync(rutaArchivo)) {
    console.error(`❌ El archivo ${rutaArchivo} no existe`)
    process.exit(1)
}

// UID: --uid manda; si no, el uid del backup; si tampoco, el del backup real.
const uid = uidArg || uidDesdeBackup(backupPath) || UID_RESPALDO

//----------------------------------------------------------------------------
// Repositorio de posiciones
//----------------------------------------------------------------------------

// El repositorio importa firebaseClient.js, que carga el SDK por https:// y no
// se puede importar desde Node. El import es dinámico para que este script
// pueda leer y verificar propuestas aunque la escritura no sea posible.
async function cargarRepositorio() {
    try {
        return await import("../../js/repositories/PosicionRepositorio.js")
    } catch (error) {
        throw new Error(
            `no se pudo cargar el repositorio de posiciones desde Node (${error.message}). ` +
            "Las escrituras requieren el SDK web de Firestore en el navegador."
        )
    }
}

//----------------------------------------------------------------------------
// Aplicar una propuesta aprobada
//----------------------------------------------------------------------------

function custodioDe(prop) {
    // M4 fusiona una posición con una pestaña exchange; M5 asigna un custodio.
    return prop.posicion ? prop.custodio_posible?.id : prop.pestaña?.cuentaId
}

function posicionDe(prop) {
    return prop.posicion?.posicionId || prop.posicion_candidata?.posicionId
}

async function aplicarPropuesta({ migracion, propuesta, repositorio, posicionesActuales, uidUsuario }) {
    const posicionId = posicionDe(propuesta)
    const custodioId = custodioDe(propuesta)

    if (!posicionId || !custodioId) {
        throw new Error("la propuesta aprobada no indica posición o custodio")
    }

    const actual = posicionesActuales.find(p => p.id === posicionId)
    if (actual && actual.custodioId) {
        return {
            accion: "idempotente",
            posicionId,
            custodioId: actual.custodioId,
            mensaje: `Posición ${posicionId} ya tenía custodio ${actual.custodioId}, no se sobrescribe`
        }
    }

    await repositorio.actualizarPosicion(uidUsuario, posicionId, {
        custodioId,
        ultimaActualizacion: new Date().toISOString()
    })

    return {
        accion: migracion === "M4" ? "fusionar" : "asignar",
        posicionId,
        custodioId,
        mensaje: `Posición ${posicionId} asignada al custodio ${custodioId}`
    }
}

//----------------------------------------------------------------------------
// Main
//----------------------------------------------------------------------------

async function aplicar(rutaPropuesta) {
    console.log(`=== Aplicador de propuestas: ${rutaPropuesta} ===`)
    console.log(`UID: ${uid}`)

    let propuesta
    try {
        propuesta = JSON.parse(readFileSync(rutaPropuesta, "utf-8"))
    } catch (error) {
        console.error(`❌ Error: ${rutaPropuesta} no es un JSON válido (${error.message})`)
        process.exit(1)
    }

    console.log(`Migración: ${propuesta.migracion}`)
    console.log(`Fecha: ${propuesta.fecha}`)
    console.log(`Total de propuestas: ${propuesta.propuestas.length}`)
    console.log(`Estado general: ${propuesta.estado_general}\n`)

    let posicionesActuales
    try {
        posicionesActuales = await leerPosiciones(uid, { backupPath })
        console.log(`Estado actual leído: ${posicionesActuales.length} posiciones`)
    } catch (error) {
        console.error("❌ No se pudo leer el estado actual:", error.message)
        process.exit(1)
    }

    // Cargar el repositorio solo si hay algo que escribir: sin aprobadas, este
    // script solo informa y no necesita Firestore.
    const aprobadas = propuesta.propuestas.filter(p => p.estado === "aprobada")
    let repositorio = null
    if (aprobadas.length > 0) {
        try {
            repositorio = await cargarRepositorio()
        } catch (error) {
            console.error("❌", error.message)
            process.exit(1)
        }
    }

    let aplicadas = 0
    let rechazadas = 0
    let ignoradas = 0
    const detalles = []

    for (const prop of propuesta.propuestas) {
        console.log(`> [${prop.tipo}] ${prop.accion_propuesta} (estado: ${prop.estado}) - ${prop.motivo}`)

        let resultado = null

        if (prop.estado === "aprobada") {
            try {
                resultado = await aplicarPropuesta({
                    migracion: propuesta.migracion,
                    propuesta: prop,
                    repositorio,
                    posicionesActuales,
                    uidUsuario: uid
                })
                if (resultado.accion === "idempotente") {
                    ignoradas++
                    console.log(`  ⏳ ${resultado.mensaje}`)
                } else {
                    aplicadas++
                    console.log(`  ✓ ${resultado.mensaje}`)
                }
            } catch (error) {
                rechazadas++
                resultado = { accion: "error", mensaje: error.message }
                console.error(`  ✗ Error aplicando ${prop.tipo}:`, error.message)
            }
        } else if (prop.estado === "rechazada") {
            rechazadas++
            console.log("  ✗ Rechazada (mantener status quo)")
        } else if (prop.estado === "pendiente") {
            ignoradas++
            console.log("  ⏳ Pendiente (no aplicar ahora)")
        } else {
            ignoradas++
            console.log(`  ? Estado desconocido: ${prop.estado}`)
        }

        detalles.push({
            tipo: prop.tipo,
            accion: resultado?.accion || prop.accion_propuesta,
            estado: prop.estado,
            motivo: prop.motivo,
            certeza: prop.certeza,
            mensaje: resultado?.mensaje
        })
    }

    const reporte = {
        migracion: propuesta.migracion,
        fecha: new Date().toISOString(),
        total_propuestas: propuesta.propuestas.length,
        aplicadas,
        rechazadas,
        ignoradas,
        detalles,
        estado_final: aplicadas > 0 ? "parcial" : "sin_acciones"
    }

    const nombreReporte = rutaPropuesta.replace(/\.json$/, "-reporte.json")
    writeFileSync(nombreReporte, JSON.stringify(reporte, null, 2))
    console.log(`\n> Reporte guardado en: ${nombreReporte}`)

    console.log("\n=== Resumen ===")
    console.log(`Aplicadas: ${aplicadas}`)
    console.log(`Rechazadas: ${rechazadas}`)
    console.log(`Ignoradas (pendientes o idempotentes): ${ignoradas}`)
    console.log(`Estado final: ${reporte.estado_final}`)

    if (aplicadas === 0 && rechazadas === 0) {
        console.log("⚠ No se aplicaron acciones. Revisar los estados de las propuestas.")
    } else if (aplicadas > 0) {
        console.log(`\n✅ Migración ${propuesta.migracion} aplicada. Revisar el reporte para detalles.`)
    }
}

aplicar(rutaArchivo).catch(error => {
    console.error("❌ Error fatal en la aplicación:", error.message)
    process.exit(1)
})
