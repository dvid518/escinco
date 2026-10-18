import { registrarMovimiento, notificarMovimientosActualizados } from "./MovimientoServicio.js"
// `actualizarMovimientoDoc` es una utilidad de la capa Firestore, no del
// servicio de movimientos: MovimientoServicio.js la importa para uso interno y
// no la re-exporta, así que pedirla ahí rompía el enlace del módulo entero
// (SyntaxError) y con ella la página de movimientos.
import { db, obtenerMovimientos, actualizarMovimientoDoc, doc, writeBatch, deleteField } from "../../firebase/firestore.js"
import { cacheCapa } from "../core/cache.js"
import { obtenerFavorito, eliminarFavorito, crearFavorito, actualizarFavorito } from "../repositories/FavoritoRepositorio.js"
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
 * Quita el favoritoId de un movimiento (desvincula). El favorito sigue
 * existiendo; solo deja de tener esa instancia.
 *
 * Parámetros opcionales (para tests):
 *   deps.actualizarMovimientoDoc, deps.notificarMovimientosActualizados
 */
export async function desvincularMovimiento(uid, movimientoId, deps = {}) {
    const actualizarMovimientoDocFn = deps.actualizarMovimientoDoc || actualizarMovimientoDoc
    const deleteFieldFn = deps.deleteField || deleteField
    const notificarFn = deps.notificarMovimientosActualizados || notificarMovimientosActualizados
    await actualizarMovimientoDocFn(uid, movimientoId, { favoritoId: deleteFieldFn() })
    notificarFn()
}

/**
 * Ejecuta un favorito tal cual: crea una nueva instancia de movimiento
 * vinculada al favorito, con fecha de hoy.
 *
 * Parámetros opcionales (para tests):
 *   deps.registrarMovimiento, deps.getFechaHoy
 */
export async function ejecutarFavorito(uid, favorito, deps = {}) {
    if (!esTipoFavoritable(favorito.tipo)) {
        throw new Error(`El tipo "${favorito.tipo}" no puede ejecutarse como favorito`)
    }
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
    return registrarMovimientoFn(uid, favorito.tipo, datos)
}

/**
 * Guarda desde el modal de edición de un favorito existente: crea una nueva
 * instancia vinculada al favorito con los datos que el usuario editó.
 *
 * Parámetros opcionales (para tests):
 *   deps.registrarMovimiento
 */
export async function guardarInstanciaVinculada(uid, favoritoId, datos, deps = {}) {
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
 * Elimina una plantilla de favorito y desvincula todos los movimientos que la
 * usaban (les quita el favoritoId). Los movimientos siguen existiendo.
 * Devuelve la cantidad de movimientos desvinculados.
 *
 * Parámetros opcionales (para tests):
 *   deps.obtenerFavorito, deps.obtenerMovimientos, deps.doc, deps.writeBatch,
 *   deps.deleteField, deps.cacheCapa, deps.notificarMovimientosActualizados
 */
export async function eliminarFavoritoConDesvinculacion(uid, favoritoId, deps = {}) {
    const obtenerFavoritoFn = deps.obtenerFavorito || obtenerFavorito
    const obtenerMovimientosFn = deps.obtenerMovimientos || obtenerMovimientos
    const docFn = deps.doc || doc
    const writeBatchFn = deps.writeBatch || writeBatch
    const deleteFieldFn = deps.deleteField || deleteField
    const cacheCapaFn = deps.cacheCapa || cacheCapa
    const notificarFn = deps.notificarMovimientosActualizados || notificarMovimientosActualizados

    const favorito = await obtenerFavoritoFn(uid, favoritoId)
    if (!favorito) {
        throw new Error("El favorito ya no existe")
    }

    const movimientos = await obtenerMovimientosFn(uid)
    const vinculados = movimientos.filter(m => m.favoritoId === favoritoId)

    const lote = writeBatchFn(db)
    lote.delete(docFn(db, "usuarios", uid, "favoritos", favoritoId))
    for (const m of vinculados) {
        lote.update(docFn(db, "usuarios", uid, "movimientos", m.id), { favoritoId: deleteFieldFn() })
    }
    await lote.commit()

    cacheCapaFn.parchear(uid, "favoritos", lista => lista.filter(f => f.id !== favoritoId))
    cacheCapaFn.parchear(uid, "movimientos", lista =>
        lista.map(m => {
            if (m.favoritoId !== favoritoId) return m
            const { favoritoId: _, ...resto } = m
            return resto
        })
    )
    notificarFn()
    return vinculados.length
}
