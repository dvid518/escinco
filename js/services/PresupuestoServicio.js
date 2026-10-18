import {
    crearPresupuesto,
    obtenerPresupuestos,
    actualizarPresupuesto,
    eliminarPresupuesto
} from "../repositories/PresupuestoRepositorio.js"
import { obtenerMovimientos } from "../../firebase/firestore.js"
import { TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"
import { CATEGORIAS_SISTEMA } from "../core/etiquetas.js"

// ============================================
// PRESUPUESTO SERVICIO
// ============================================
// Lógica de negocio: crear presupuestos y calcular el gasto real de cada uno
// a partir de los movimientos del usuario.
//
// Gasto real: movimientos tipo gasto dentro del periodo del presupuesto que
// coincidan con su categoría (nivel 1) o con ≥1 de sus etiquetas (nivel 2).
// Un gasto con varias tags reparte su monto por partes iguales entre ellas,
// así que un presupuesto por "comida" recibe monto/nºTags de cada gasto que
// lleve esa etiqueta.
// ============================================

/** Etiquetas que "disparan" un presupuesto por categoría del sistema. */
function etiquetasDelPresupuesto(p) {
    if (p.categoria) return [p.categoria]
    return p.etiquetas
}

/** ¿Un movimiento coincide con este presupuesto? Devuelve cuántas de sus
    tags están en el presupuesto (0 si ninguna). */
function tagsCoincidentes(movimiento, etiquetasPresupuesto) {
    const tagsMovimiento = Array.isArray(movimiento.etiquetas)
        ? movimiento.etiquetas.filter(Boolean)
        : []
    if (!tagsMovimiento.length) return 0
    const coinciden = tagsMovimiento.filter(t =>
        etiquetasPresupuesto.some(e => String(e).toLowerCase() === String(t).toLowerCase())
    )
    return coinciden.length
}

/** Gasto real consumido por un presupuesto, calculado sobre una lista de
    movimientos ya filtrada por tipo gasto y periodo. */
export function calcularGastoReal(presupuesto, movimientos) {
    const etiquetas = etiquetasDelPresupuesto(presupuesto)
    if (!etiquetas.length) return 0

    let gasto = 0
    for (const m of movimientos) {
        const coinciden = tagsCoincidentes(m, etiquetas)
        if (!coinciden) continue
        // Split igual entre las tags del movimiento: cada tag coincidente
        // recibe montoAbs / nºTags.
        const montoAbs = Math.abs(Number(m.monto) || 0)
        gasto += (montoAbs / Math.max(1, m.etiquetas ? m.etiquetas.filter(Boolean).length : 1)) * coinciden
    }
    return gasto
}

/** Crea un presupuesto validado. */
export async function crearPresupuestoServicio(uid, datos, deps = {}) {
    const crearFn = deps.crearPresupuesto || crearPresupuesto
    return crearFn(uid, datos)
}

/** Obtiene los presupuestos del usuario con su gasto real, porcentaje y
    estado (dentro / atención / alerta / crítico / superado). */
export async function obtenerPresupuestosConProgreso(uid, deps = {}) {
    const obtenerPresupuestosFn = deps.obtenerPresupuestos || obtenerPresupuestos
    const obtenerMovimientosFn = deps.obtenerMovimientos || obtenerMovimientos

    const presupuestos = await obtenerPresupuestosFn(uid)
    const movimientos = await obtenerMovimientosFn(uid)

    const gastosPorPeriodo = presupuestos.map(p => {
        const periodoInicio = new Date(p.fechaInicio)
        const periodoFin = p.periodoFin
        const movsDelPeriodo = movimientos.filter(m => {
            if (m.tipo !== TIPOS_MOVIMIENTO.GASTO) return false
            const f = new Date(m.fechaRealizacion)
            return f >= periodoInicio && f < periodoFin
        })
        const gastoReal = calcularGastoReal(p, movsDelPeriodo)
        return {
            presupuesto: p,
            gastoReal,
            montoRestante: Math.max(0, p.monto - gastoReal),
            porcentaje: p.porcentaje(gastoReal),
            estado: p.estado(gastoReal),
            estadoTexto: p.estadoTexto(gastoReal)
        }
    })

    // Orden: nivel 1 (categoría) antes que nivel 2 (etiquetas), y dentro de
    // cada nivel alfabético.
    gastosPorPeriodo.sort((a, b) => {
        const aNivel1 = !!a.presupuesto.categoria
        const bNivel1 = !!b.presupuesto.categoria
        if (aNivel1 !== bNivel1) return bNivel1 - aNivel1
        return a.presupuesto.nombre.localeCompare(b.presupuesto.nombre, "es", { sensitivity: "base" })
    })

    return gastosPorPeriodo
}

export { actualizarPresupuesto, eliminarPresupuesto }
