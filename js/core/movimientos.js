import { TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"

export function esMovimientoPositivo(m, cuentaId = null) {
    if (!m?.tipo) return false

    if (m.tipo === TIPOS_MOVIMIENTO.PAGO_TARJETA) {
        return cuentaId ? m.tarjeta === cuentaId : false
    }

    if (m.tipo === TIPOS_MOVIMIENTO.ERROR) {
        return m.operacion === "sumar"
    }

    if (
        m.tipo === TIPOS_MOVIMIENTO.TRANSFERENCIA ||
        m.tipo === TIPOS_MOVIMIENTO.CAMBIO_DIVISA
    ) {
        return cuentaId ? m.cuentaDestino === cuentaId : false
    }

    return (
        m.tipo === TIPOS_MOVIMIENTO.INGRESO ||
        m.tipo === TIPOS_MOVIMIENTO.VENTA_ACTIVO ||
        m.tipo === TIPOS_MOVIMIENTO.P2P_VENTA
    )
}

export function montoDeMovimiento(m, cuentaId = null) {
    if (m?.monto !== undefined && m?.monto !== null && m?.monto !== "") {
        return Number(m.monto) || 0
    }

    if (m?.cantidad && m?.precio) {
        const total = Number(m.cantidad) * Number(m.precio)
        const comision = Number(m.comision) || 0
        return esMovimientoPositivo(m, cuentaId) ? (total - comision) : (total + comision)
    }

    if (m?.tipo === TIPOS_MOVIMIENTO.CAMBIO_DIVISA && cuentaId) {
        if (m.cuentaOrigen === cuentaId) return Number(m.montoOrigen) || 0
        if (m.cuentaDestino === cuentaId) return Number(m.montoDestino) || 0
    }

    if (m?.montoOrigen !== undefined && m?.montoOrigen !== null && m?.montoOrigen !== "") {
        return Number(m.montoOrigen) || 0
    }
    if (m?.montoDestino !== undefined && m?.montoDestino !== null && m?.montoDestino !== "") {
        return Number(m.montoDestino) || 0
    }
    return 0
}

function tiempoFecha(valor) {
    if (valor == null) return null
    if (typeof valor.toDate === "function") return valor.toDate().getTime()
    if (typeof valor.seconds === "number") return valor.seconds * 1000
    const tiempo = new Date(valor).getTime()
    return isNaN(tiempo) ? null : tiempo
}

export function compararMovimientosPorFecha(a, b) {
    const fa = tiempoFecha(a?.fechaRealizacion) ?? tiempoFecha(a?.fechaRegistro) ?? 0
    const fb = tiempoFecha(b?.fechaRealizacion) ?? tiempoFecha(b?.fechaRegistro) ?? 0
    if (fb !== fa) return fb - fa

    const tiempoRegistro = m => {
        const v = m?.fechaRegistro
        if (v == null) return 0
        return tiempoFecha(v) ?? Number.MAX_SAFE_INTEGER
    }
    return tiempoRegistro(b) - tiempoRegistro(a)
}
