import {
    obtenerCuentas,
    obtenerMovimientos,
    obtenerPreferencias
} from "../../firebase/firestore.js"
import { obtenerActivos } from "../repositories/ActivoRepositorio.js"
import { getFechaHoy } from "../core/fechas.js"
import { obtenerPendientes } from "../repositories/PendienteRepositorio.js"
import { obtenerPosiciones } from "../repositories/PosicionRepositorio.js"
import { obtenerTrades } from "../repositories/TradeRepositorio.js"
import { obtenerSnapshots } from "../repositories/SnapshotRepositorio.js"
import { obtenerHistorial } from "../repositories/HistorialRepositorio.js"
import { obtenerOrdenes } from "../repositories/OrdenRepositorio.js"
import { obtenerEstrategias } from "../repositories/EstrategiaRepositorio.js"
import { obtenerMetas } from "../repositories/MetaRepositorio.js"

// ============================================
// EXPORTAR SERVICIO
// ============================================

// Versión del formato de respaldo.
//  2.0.0 → cuentas, movimientos, activos, pendientes, snapshots
//  3.0.0 → + posiciones, trades, historial, preferencias
//          + timestamps normalizados (ISO) para roundtrip fiel
//  4.0.0 → + ordenes, estrategias, metas
const VERSION_DVID = "4.1.0"

// Firestore rechaza limit() > 10000 (límite duro por consulta), aunque la
// colección tenga pocos documentos. 9999 días (~27 años) cubre todo caso real.
const DIAS_HISTORIAL = 9999

/**
 * Convierte fechas (Date o Timestamp de Firestore) y estructuras anidadas
 * a un formato JSON serializable. Los Date quedan como ISO string
 * y los Timestamp de Firestore (objetos con .toDate) también.
 */
function serializarFechas(valor) {
    if (valor === null || valor === undefined) return valor
    if (typeof valor !== "object") return valor

    if (typeof valor.toDate === "function") {
        return valor.toDate().toISOString()
    }
    if (valor instanceof Date) {
        return valor.toISOString()
    }
    if (Array.isArray(valor)) {
        return valor.map(serializarFechas)
    }

    const resultado = {}
    for (const [clave, item] of Object.entries(valor)) {
        resultado[clave] = serializarFechas(item)
    }
    return resultado
}

/**
 * Exporta TODOS los datos del usuario a un archivo .dvid (JSON).
 *
 * @param {string} uid
 * @returns {Promise<{ ok: boolean, archivo: string }>}
 */
export async function exportarDVID(uid) {
    try {
        console.log("[INFO] Exportando datos como .dvid...")

        const activos = await obtenerActivos(uid)

        const simboloPorActivoId = new Map()
        for (const activo of activos) {
            simboloPorActivoId.set(activo.id, activo.simbolo)
        }

        const [
            cuentas,
            movimientos,
            pendientes,
            posicionesRaw,
            trades,
            snapshots,
            preferencias,
            ordenes,
            estrategias,
            metas
        ] = await Promise.all([
            obtenerCuentas(uid),
            obtenerMovimientos(uid),
            obtenerPendientes(uid, false),   // false = incluir consolidados
            obtenerPosiciones(uid),
            obtenerTrades(uid),
            obtenerSnapshots(uid, 365),      // últimos 365 días
            obtenerPreferencias(uid),
            obtenerOrdenes(uid),
            obtenerEstrategias(uid),
            obtenerMetas(uid)
        ])

        // Al reimportar los activos pueden crear nuevos IDs, así que las
        // posiciones se exportan con el SÍMBOLO en lugar del activoId.
        const posiciones = posicionesRaw.map(posicion => {
            const { activo, activoId, ...resto } = posicion
            return {
                ...resto,
                activoSimbolo: simboloPorActivoId.get(posicion.activoId) || null
            }
        })

        // Historial de precios por activo (con símbolo para remapeado).
        //
        // En paralelo: son A consultas, y en serie costaban A viajes de red
        // secuenciales. Con 20 activos, 20 esperas en cadena.
        //
        // DIAS_HISTORIAL se queda en 9999 a propósito: `limit()` no cuesta nada
        // cuando la colección tiene menos documentos, así que recortarlo no
        // daría rendimiento y sí perdería historial del respaldo.
        //
        // `registros` va sin transformar: `obtenerHistorial` ya devuelve
        // `{ fecha: <id del doc>, ...datos }`. El `id` que se añadía aquí
        // era un artefacto del mapeo que rompía la importación en cuentas
        // nuevas, porque el `hasOnly` de `historial` no lo admite (BUG-030).
        const historial = (await Promise.all(
            activos.map(async activo => {
                const registros = await obtenerHistorial(uid, activo.id, DIAS_HISTORIAL)
                if (registros.length === 0) return null
                return {
                    activoSimbolo: activo.simbolo,
                    // `cerrado` siempre es false y su único escritor
                    // (`cerrarDia`) no tiene llamador. Fuera del .dvid.
                    registros: registros.map(({ cerrado, ...registro }) => registro)
                }
            })
        )).filter(Boolean)

        const datos = {
            formato: "escinco",
            version: VERSION_DVID,
            fechaExportacion: new Date().toISOString(),
            uid,
            cuentas: serializarFechas(cuentas),
            movimientos: serializarFechas(movimientos),
            activos: serializarFechas(activos),
            pendientes: serializarFechas(pendientes),
            posiciones: serializarFechas(posiciones),
            trades: serializarFechas(trades),
            ordenes: serializarFechas(ordenes),
            estrategias: serializarFechas(estrategias),
            metas: serializarFechas(metas),
            historial: serializarFechas(historial),
            // `cerrado` siempre es false: `cerrarSnapshotDelDia` no tiene llamador.
            // Fuera del .dvid. El documento de Firestore lo conserva (setDoc
            // con merge no borra campos).
            snapshots: serializarFechas(snapshots.map(({ cerrado, ...s }) => s)),
            preferencias: serializarFechas(preferencias)
        }

        // Sin indentación: es el 30 % del archivo y un .dvid no se lee a mano.
        const json = JSON.stringify(datos)
        const blob = new Blob([json], { type: "application/x-escinco-backup" })
        const url = URL.createObjectURL(blob)

        const fecha = getFechaHoy()
        const nombreArchivo = `escinco_backup_${fecha}.dvid`

        descargarArchivo(url, nombreArchivo)
        // Revoke diferido: revocar aquí cancelaba la descarga en algunos
        // navegadores antes de que arrancara (bug #9).
        setTimeout(() => URL.revokeObjectURL(url), 0)

        console.log("[INFO] .dvid exportado:", nombreArchivo)
        return { ok: true, archivo: nombreArchivo }
    } catch (error) {
        console.error("[ERROR] Error exportando .dvid:", error)
        throw error
    }
}

// ============================================
// DESCARGAR ARCHIVO
// ============================================

function descargarArchivo(url, nombre) {
    const link = document.createElement("a")
    link.href = url
    link.download = nombre
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}