// Lector de datos para migraciones M4 y M5
// Lee desde Firestore real o desde un archivo backup (.dvid/JSON) via --backup=path
// Expone: leerCuentas(), leerPosiciones(), uidDesdeBackup()
//----------------------------------------------------------------------------

import { existsSync, readFileSync } from "node:fs"
import { isAbsolute, resolve } from "node:path"
import { RAIZ } from "./helpers.mjs"

// UID del usuario real. Solo se usa cuando no hay --uid ni backup del que leerlo.
export const UID_RESPALDO = "4ulBrBffJMMM2EojNojawRPjad13"

//----------------------------------------------------------------------------
// Backup JSON: el .dvid exportado por ExportarServicio es
// { formato, uid, cuentas, posiciones, ... }; también se acepta un array suelto.
//----------------------------------------------------------------------------

/** Ruta absoluta: se respeta si ya lo es; si no, cuelga de la raíz. */
export function resolverRuta(ruta) {
    if (!ruta) return null
    return isAbsolute(ruta) ? ruta : resolve(RAIZ, ruta)
}

/** Ruta absoluta del backup (alias histórico de resolverRuta). */
export function resolverRutaBackup(backupPath) {
    return resolverRuta(backupPath)
}

function leerBackup(backupPath) {
    const ruta = resolverRutaBackup(backupPath)
    if (!existsSync(ruta)) throw new Error(`backup no encontrado: ${ruta}`)
    const datos = JSON.parse(readFileSync(ruta, "utf-8"))
    if (Array.isArray(datos)) {
        return { uid: null, cuentas: datos, posiciones: [], activos: [], preferencias: null }
    }
    return {
        uid: datos.uid || null,
        cuentas: Array.isArray(datos.cuentas) ? datos.cuentas : [],
        posiciones: Array.isArray(datos.posiciones) ? datos.posiciones : [],
        activos: Array.isArray(datos.activos) ? datos.activos : [],
        preferencias: datos.preferencias || null
    }
}

/** UID guardado en el backup, o null si no hay backup legible. */
export function uidDesdeBackup(backupPath) {
    if (!backupPath) return null
    try {
        return leerBackup(backupPath).uid
    } catch {
        return null
    }
}

//----------------------------------------------------------------------------
// Leer cuentas desde Firestore (con UID) o desde backup JSON
//----------------------------------------------------------------------------

/**
 * Lee cuentas desde Firestore para el UID dado, o desde un archivo backup JSON.
 * Si se proporciona --backup=path, lee del archivo JSON en lugar de Firestore.
 *
 * @param {string} uid - UID del usuario (requerido para Firestore)
 * @param {Object} options - Opciones
 * @param {string} [options.backupPath] - Ruta al archivo backup JSON
 * @returns {Promise<Array>} Lista de cuentas con sus IDs
 */
export async function leerCuentas(uid, { backupPath } = {}) {
    if (backupPath) {
        return leerBackup(backupPath).cuentas.map(cuenta => ({
            ...cuenta,
            id: cuenta.id || cuenta.uid || null
        }))
    }

    // Leer desde Firestore real
    try {
        const moduloFirebase = await import("../../firebase/firestore.js")
        const { obtenerCuentas: obtenerCuentasFirebase } = moduloFirebase
        const resultado = await obtenerCuentasFirebase(uid)
        return resultado.docs.map(documento => ({
            id: documento.id,
            ...documento.data()
        }))
    } catch (error) {
        throw new Error(`no se pudo leer cuentas de Firestore: ${error.message}`)
    }
}

//----------------------------------------------------------------------------
// Leer posiciones desde Firestore o desde backup JSON
//----------------------------------------------------------------------------

/**
 * Lee posiciones desde Firestore para el UID dado, o desde un archivo backup JSON.
 * Si se proporciona --backup=path, lee del archivo JSON en lugar de Firestore.
 *
 * @param {string} uid - UID del usuario (requerido para Firestore)
 * @param {Object} options - Opciones
 * @param {string} [options.backupPath] - Ruta al archivo backup JSON
 * @returns {Promise<Array>} Lista de posiciones con sus IDs
 */
export async function leerPosiciones(uid, { backupPath } = {}) {
    if (backupPath) {
        return leerBackup(backupPath).posiciones.map(posicion => normalizarPosicionBackup(posicion))
    }

    // Leer desde Firestore real
    try {
        const moduloFirebase = await import("../../firebase/firestore.js")
        const { obtenerPosiciones: obtenerPosicionesFirebase } = moduloFirebase
        const resultado = await obtenerPosicionesFirebase(uid)
        return resultado.docs.map(documento => ({
            id: documento.id,
            ...documento.data()
        }))
    } catch (error) {
        throw new Error(`no se pudo leer posiciones de Firestore: ${error.message}`)
    }
}

//----------------------------------------------------------------------------
// Leer preferencias y activos (M6-M8)
//----------------------------------------------------------------------------

/**
 * Lee `preferencias` desde Firestore o desde el backup. Solo se usa la rama de
 * backup en Node: Firestore exige el SDK web.
 *
 * @param {string} uid - UID del usuario
 * @param {Object} options - { backupPath }
 * @returns {Promise<Object|null>} Preferencias completas del usuario
 */
export async function leerPreferencias(uid, { backupPath } = {}) {
    if (backupPath) return leerBackup(backupPath).preferencias

    try {
        const { obtenerPreferencias } = await import("../../firebase/firestore.js")
        return await obtenerPreferencias(uid)
    } catch (error) {
        throw new Error(`no se pudieron leer las preferencias de Firestore: ${error.message}`)
    }
}

/**
 * Lee activos desde Firestore o desde el backup. Hace falta para validar las
 * cards `activo:<id>`: el backup identifica las posiciones por símbolo, no por
 * el id del activo.
 *
 * @param {string} uid - UID del usuario
 * @param {Object} options - { backupPath }
 * @returns {Promise<Array>} Activos con id
 */
export async function leerActivos(uid, { backupPath } = {}) {
    if (backupPath) {
        return leerBackup(backupPath).activos.map(activo => ({
            ...activo,
            id: activo.id || activo.activoId || null
        }))
    }

    try {
        const { obtenerActivos } = await import("../../js/repositories/ActivoRepositorio.js")
        const resultado = await obtenerActivos(uid)
        const lista = Array.isArray(resultado)
            ? resultado
            : Array.isArray(resultado?.docs) ? resultado.docs.map(doc => ({ id: doc.id, ...doc.data() })) : []
        return lista.map(activo => ({ ...activo, id: activo.id || activo.activoId || null }))
    } catch (error) {
        throw new Error(`no se pudieron leer los activos de Firestore: ${error.message}`)
    }
}

// El .dvid exporta las posiciones con el SÍMBOLO del activo (activoSimbolo) en
// lugar de activoId, y omite custodioId cuando es null.
function normalizarPosicionBackup(posicion) {
    return {
        ...posicion,
        id: posicion.id || null,
        activoId: posicion.activoId || posicion.activoSimbolo || posicion.activo || null,
        cantidad: posicion.cantidad !== undefined ? Number(posicion.cantidad) : 0,
        divisa: posicion.divisa || "usd",
        custodioId: posicion.custodioId ?? null,
        tipo: posicion.tipo || "posicion"
    }
}

//----------------------------------------------------------------------------
// Utilidad: identificar si una cuenta es pestaña cripto legacy
//----------------------------------------------------------------------------

/**
 * Verifica si una cuenta es pestaña cripto legacy.
 * Criterio: tipo === "exchange" && esPatrimonio === false
 *
 * @param {Object} cuenta - Objeto cuenta
 * @returns {boolean} true si es pestaña cripto legacy
 */
export function esPestañaCripto(cuenta) {
    return cuenta.tipo === "exchange" && cuenta.esPatrimonio === false
}

//----------------------------------------------------------------------------
// Utilidad: verificar si una posición es legacy (sin custodio)
//----------------------------------------------------------------------------

/**
 * Verifica si una posición es legacy (sin custodio asignado).
 * Criterio: custodioId === null
 *
 * @param {Object} posicion - Objeto posición
 * @returns {boolean} true si es posición legacy
 */
export function esPosiciónLegacy(posicion) {
    return posicion.custodioId === null
}

//----------------------------------------------------------------------------
// Constantes de configuración
//----------------------------------------------------------------------------

export const TIPOS_CUSTODIO_VALIDOS = ["broker", "exchange"]
export const DIVISAS_BASE = ["pen", "usd", "usdt"]

/**
 * Verifica si un custodio es de tipo válido (broker o exchange).
 * @param {Object} custodio - Objeto custodio con campo tipo
 * @returns {boolean} true si es broker o exchange
 */
export function esCustodioValido(custodio) {
    return TIPOS_CUSTODIO_VALIDOS.includes(custodio.tipo)
}

/**
 * Cuenta que puede recibir una posición legacy en M5.
 * Una cuenta archivada conserva su historial pero ya no custodia activos:
 * ofrecerla como candidata produciría propuestas inválidas.
 *
 * @param {Object} cuenta - Objeto cuenta
 * @returns {boolean} true si es broker/exchange y no está archivada
 */
export function esCustodioCandidato(cuenta) {
    return esCustodioValido(cuenta) && cuenta.estado !== "archivada"
}

