import { registrarMovimiento, notificarMovimientosActualizados } from "./MovimientoServicio.js"
// `actualizarMovimientoDoc` es una utilidad de la capa Firestore, no del
// servicio de movimientos: MovimientoServicio.js la importa para uso interno y
// no la re-exporta, así que pedirla ahí rompía el enlace del módulo entero
// (SyntaxError) y con ella la página de movimientos.
import { db, obtenerMovimientos, actualizarMovimientoDoc, doc, writeBatch, serverTimestamp, runTransaction } from "../../firebase/firestore.js"
import { cacheCapa } from "../core/cache.js"
import { obtenerFavorito, crearFavorito, actualizarFavorito } from "../repositories/FavoritoRepositorio.js"
import { mostrarNotificacion } from "../ui/notificaciones.js"
import { getFechaHoy } from "../core/fechas.js"

// Tipos de movimiento que admiten ser guardados como favorito: una sola cuenta
// + un monto. Las transferencias y compras de activo tienen formularios con
// más matices y no encajan en este molde (quedan fuera del alcance v1).
const TIPOS_FAVORITO = ["ingreso", "gasto", "compraTarjeta"]

// Límite del nombre de la plantilla. replica la regla de firestore.rules para
// favoritos ("nombre.size() <= 40"), para que el error salte en el formulario y
// no en una excepción del servidor.
export const MAX_LARGO_NOMBRE_FAVORITO = 40

export function esTipoFavoritable(tipo) {
    return TIPOS_FAVORITO.includes(tipo)
}

// ============================================
// IDEMPOTENCIA: bloqueo por favoritoId para evitar ejecuciones duplicadas
// ============================================
// El bloqueo se adquiere y libera EXCLUSIVAMENTE en este servicio.
// La página NO debe adquirir ni liberar este bloqueo.
const ejecucionesEnCurso = new Set()

export function estaEjecutandoFavorito(favoritoId) {
    return ejecucionesEnCurso.has(favoritoId)
}

// Funciones internas para adquirir/liberar el bloqueo atómicamente (check + add en una operación)
// Exportadas con prefijo __ para uso en tests
export function __bloquearEjecucionFavorito(favoritoId) {
    if (ejecucionesEnCurso.has(favoritoId)) {
        return false
    }
    ejecucionesEnCurso.add(favoritoId)
    return true
}

export function __liberarEjecucionFavorito(favoritoId) {
    ejecucionesEnCurso.delete(favoritoId)
}

// Funciones internas (alias para uso interno) - también exportadas para tests
export function _bloquearEjecucionFavorito(favoritoId) {
    return __bloquearEjecucionFavorito(favoritoId)
}

export function _liberarEjecucionFavorito(favoritoId) {
    __liberarEjecucionFavorito(favoritoId)
}

/**
 * Crea una plantilla de favorito a partir de un movimiento existente y la
 * vincula a él (asigna su favoritoId). Nombre derivado del concepto o del
 * tipo + cuenta si no hay concepto.
 *
 * Parámetros opcionales (para tests):
 *   deps.crearFavorito, deps.actualizarMovimientoDoc, deps.notificarMovimientosActualizados
 */
export async function crearFavoritoDesdeMovimiento(uid, movimiento, deps = {}) {
    if (!esTipoFavoritable(movimiento.tipo)) {
        throw new Error(`El tipo "${movimiento.tipo}" no puede guardarse como favorito`)
    }
    const nombre = movimiento.concepto || `${movimiento.tipo} en ${movimiento.cuenta}`
    const crearFavoritoFn = deps.crearFavorito || crearFavorito
    const actualizarMovimientoDocFn = deps.actualizarMovimientoDoc || actualizarMovimientoDoc
    const notificarFn = deps.notificarMovimientosActualizados || notificarMovimientosActualizados
    const favoritoId = await crearFavoritoFn(uid, {
        nombre,
        tipo: movimiento.tipo,
        cuenta: movimiento.cuenta || '',
        monto: movimiento.monto || 0,
        divisa: movimiento.divisa || 'pen',
        concepto: movimiento.concepto || '',
        etiquetas: movimiento.etiquetas || []
    })
    await actualizarMovimientoDocFn(uid, movimiento.id, { favoritoId })
    notificarFn()
    return favoritoId
}

/**
 * Desvincula un movimiento de su favorito. El favorito sigue
 * existiendo; solo deja de tener esa instancia.
 * El movimiento conserva su favoritoId para permitir recuperación futura.
 *
 * Parámetros opcionales (para tests):
 *   deps.notificarMovimientosActualizados
 */
export function desvincularMovimiento(uid, movimientoId, deps = {}) {
    const notificarFn = deps.notificarMovimientosActualizados || notificarMovimientosActualizados
    // No se elimina el favoritoId del movimiento (se conserva para recuperación)
    // Solo se notifica el cambio para que la UI se actualice
    notificarFn()
}

/**
 * Ejecuta un favorito tal cual: crea una nueva instancia de movimiento
 * vinculada al favorito, con fecha de hoy.
 * El bloqueo se adquiere y libera en esta función (autoridad exclusiva).
 *
 * Parámetros opcionales (para tests):
 *   deps.registrarMovimiento, deps.getFechaHoy
 */
export async function ejecutarFavorito(uid, favorito, deps = {}) {
    if (!esTipoFavoritable(favorito.tipo)) {
        throw new Error(`El tipo "${favorito.tipo}" no puede ejecutarse como favorito`)
    }
    // Adquirir bloqueo atómicamente (check + add en una operación)
    if (!_bloquearEjecucionFavorito(favorito.id)) {
        throw new Error("Ejecución en curso para este favorito")
    }
    try {
        const registrarMovimientoFn = deps.registrarMovimiento || registrarMovimiento
        const getFechaHoyFn = deps.getFechaHoy || getFechaHoy
        const datos = {
            tipo: favorito.tipo,
            cuenta: favorito.cuenta,
            monto: favorito.monto,
            divisa: favorito.divisa,
            concepto: favorito.concepto || '',
            etiquetas: favorito.etiquetas || [],
            fechaRealizacion: getFechaHoyFn(),
            favoritoId: favorito.id
        }
        const movimiento = await registrarMovimientoFn(uid, favorito.tipo, datos)

        // Evento de analytics tras crear la instancia del movimiento vinculada al favorito.
        // Se importa de forma dinámica para que el módulo cargue incluso si Analytics no está disponible.
        try {
            const { rastrearEvento } = await import("./AnalyticsServicio.js")
            rastrearEvento("favorito_ejecutado", { tipo: favorito.tipo })
        } catch {
            // Silencioso: Analytics no bloquea la lógica de negocio.
        }

        return movimiento
    } finally {
        _liberarEjecucionFavorito(favorito.id)
    }
}

/**
 * Guarda desde el modal de edición de un favorito existente: crea una nueva
 * instancia vinculada al favorito con los datos que el usuario editó.
 *
 * Parámetros opcionales (para tests):
 *   deps.registrarMovimiento
 */
export function guardarInstanciaVinculada(uid, favoritoId, datos, deps = {}) {
    if (!esTipoFavoritable(datos.tipo)) {
        throw new Error(`El tipo "${datos.tipo}" no puede guardarse como favorito`)
    }
    const registrarMovimientoFn = deps.registrarMovimiento || registrarMovimiento
    return registrarMovimientoFn(uid, datos.tipo, { ...datos, favoritoId })
}

/**
 * Guarda los cambios de la PLANTILLA de un favorito (lo que hace el botón
 * "Editar" de la lastbar con un favorito marcado). No crea ningún movimiento:
 * los que ya se ejecutaron desde ella conservan sus datos, que es justo lo
 * distinto de "usar el favorito con un importe puntual".
 *
 * El tipo no se toca: el movimiento creado tiene su propio tipo y cambiarlo en
 * la plantilla dejaría fuera de juego a las instancias ya registradas.
 *
 * Parámetros opcionales (para tests):
 *   deps.actualizarFavorito, deps.notificarMovimientosActualizados
 */
export async function editarPlantillaFavorito(uid, favorito, datos, deps = {}) {
    if (!esTipoFavoritable(favorito.tipo)) {
        throw new Error(`El tipo "${favorito.tipo}" no se puede editar como favorito`)
    }
    const actualizarFn = deps.actualizarFavorito || actualizarFavorito

    // Mismo criterio que al crear el favorito desde un movimiento: si el
    // usuario deja el nombre vacío se deriva del concepto, y si no hay
    // concepto, del tipo y la cuenta.
    const nombre = String(datos.nombre || "").trim().slice(0, MAX_LARGO_NOMBRE_FAVORITO)
        || String(datos.concepto || "").trim().slice(0, MAX_LARGO_NOMBRE_FAVORITO)
        || `${favorito.tipo} en ${favorito.cuenta}`
    const monto = Number(datos.monto)
    if (!Number.isFinite(monto) || monto <= 0) {
        throw new Error("El monto del favorito debe ser mayor que cero")
    }

    const cambios = {
        nombre,
        cuenta: datos.cuenta || '',
        monto,
        divisa: datos.divisa || 'pen',
        concepto: datos.concepto || '',
        etiquetas: Array.isArray(datos.etiquetas) ? datos.etiquetas : []
    }

    await actualizarFn(uid, favorito.id, cambios)
    const notificarFn = deps.notificarMovimientosActualizados || notificarMovimientosActualizados
    notificarFn()
    return cambios
}

/**
 * Elimina una plantilla de favorito. Los movimientos vinculados conservan su favoritoId
 * para permitir recuperación futura. Solo se elimina el documento de la plantilla.
 * Devuelve la cantidad de movimientos que estaban vinculados.
 *
 * Parámetros opcionales (para tests):
 *   deps.obtenerFavorito, deps.obtenerMovimientos, deps.doc, deps.writeBatch,
 *   deps.cacheCapa, deps.notificarMovimientosActualizados
 */
export async function eliminarFavoritoConDesvinculacion(uid, favoritoId, deps = {}) {
    const obtenerFavoritoFn = deps.obtenerFavorito || obtenerFavorito
    const obtenerMovimientosFn = deps.obtenerMovimientos || obtenerMovimientos
    const docFn = deps.doc || doc
    const writeBatchFn = deps.writeBatch || writeBatch
    const cacheCapaFn = deps.cacheCapa || cacheCapa
    const notificarFn = deps.notificarMovimientosActualizados || notificarMovimientosActualizados

    const favorito = await obtenerFavoritoFn(uid, favoritoId)
    if (!favorito) {
        // Documento ya no existe: el desmarcado ya está satisfecho,
        // no se recrea el documento (idempotente).
        return 0
    }

    let movimientos
    try {
        movimientos = await obtenerMovimientosFn(uid)
    } catch (error) {
        console.error("Error cargando movimientos para eliminar favorito:", error)
        mostrarNotificacion("error", "No se pudo cargar el listado de movimientos. El favorito no se eliminó.")
        throw error
    }
    const vinculados = movimientos.filter(m => m.favoritoId === favoritoId)

    const lote = writeBatchFn(db)
    lote.delete(docFn(db, "usuarios", uid, "favoritos", favoritoId))
    // NO se modifica favoritoId en los movimientos (se conserva para recuperación)
    await lote.commit()

    cacheCapaFn.parchear(uid, "favoritos", lista => lista.filter(f => f.id !== favoritoId))
    // NO se modifica favoritoId en movimientos (se conserva para recuperación)
    notificarFn()
    return vinculados.length
}

/**
 * Recupera un favorito eliminado usando su ID histórico.
 * Usa una transacción para garantizar atomicidad: si el documento ya existe,
 * no se sobrescribe y se devuelve el existente.
 *
 * @param {string} uid - ID del usuario
 * @param {string} favoritoId - ID histórico del favorito a recuperar
 * @param {Object} datosMovimiento - Datos del movimiento para reconstruir la plantilla
 * @returns {Promise<Object>} El favorito recuperado (existente o nuevo)
 */
export async function recuperarFavoritoConId(uid, favoritoId, datosMovimiento) {
    // Las dependencias (db, doc, runTransaction, serverTimestamp, cacheCapa, notificarMovimientosActualizados)
    // se resuelven vía imports del módulo o se sobreescriben en tests vía closure de cargarFuncion
    const refPath = doc(db, "usuarios", uid, "favoritos", favoritoId)

    // Usar transacción para atomicidad: check-and-create
    const favorito = await runTransaction(db, async (tx) => {
        const snap = await tx.get(refPath)
        if (snap.exists()) {
            // Ya existe: devolver existente (idempotente)
            return { id: favoritoId, ...snap.data() }
        }

        // No existe: construir plantilla desde movimiento (misma semántica que crearFavoritoDesdeMovimiento)
        const nombre = datosMovimiento.concepto || `${datosMovimiento.tipo} en ${datosMovimiento.cuenta}`
        const favoritoData = {
            nombre,
            tipo: datosMovimiento.tipo,
            cuenta: datosMovimiento.cuenta || '',
            monto: datosMovimiento.monto || 0,
            divisa: datosMovimiento.divisa || 'pen',
            concepto: datosMovimiento.concepto || '',
            etiquetas: datosMovimiento.etiquetas || [],
            fechaCreacion: serverTimestamp()  // Fecha de recuperación
        }

        tx.set(refPath, favoritoData)
        return { id: favoritoId, ...favoritoData }
    })

    cacheCapa.invalidarPrefijo(uid, "favoritos")
    notificarMovimientosActualizados()
    return favorito
}
