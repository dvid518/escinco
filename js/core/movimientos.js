import { TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"

// ============================================
// PRESENTACIÓN DE MOVIMIENTOS · UN ÚNICO ORIGEN
// ============================================
// Estas dos funciones estaban triplicadas en `cuentas.js`, `movimientos.js` y
// `dashboard.js`, y las copias divergían: la de `cuentas.js` tenía la rama
// `pagoTarjeta` y las otras dos no, y ninguna tenía `cambioDivisa`. Cada
// arreglo aplicado a una copia dejaba las otras dos desalineadas, que es
// exactamente lo que pasó con `a942616` (BUG-024) y con `89d9f58`.
//
// Aquí viven las dos, con la firma única `f(m, cuentaId = null)`.
//
// `cuentaId` no es opcional en la práctica: sin él, los tipos cuyo signo
// depende de en qué cuenta se miran (`transferencia`, `cambioDivisa`,
// `pagoTarjeta`) **no tienen respuesta correcta** y devuelven `false`. Es el
// motivo de BUG-025: quien llame sin perspectiva de cuenta está viendo el
// saldo de la cuenta de origen, que para una transferencia entrante es justo
// el lado contrario del correcto.

// ============================================
// SIGNO
// ============================================

export function esMovimientoPositivo(m, cuentaId = null) {
    if (!m?.tipo) return false

    // El pago de una tarjeta es salida de dinero de la cuenta desde la que se
    // paga, y reducción de deuda para la tarjeta: en la cuenta de origen es
    // negativo, y en la tarjeta no aparece (la deuda va en `deuda`).
    if (m.tipo === TIPOS_MOVIMIENTO.PAGO_TARJETA) {
        return cuentaId ? m.tarjeta === cuentaId : false
    }

    // Una corrección manual declara su propio signo en `operacion`.
    if (m.tipo === TIPOS_MOVIMIENTO.ERROR) {
        return m.operacion === "sumar"
    }

    // Transferencia y cambio de divisa: positivo solo en la cuenta destino.
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

// ============================================
// MONTO
// ============================================

export function montoDeMovimiento(m, cuentaId = null) {
    if (m?.monto !== undefined && m?.monto !== null && m?.monto !== "") {
        return Number(m.monto) || 0
    }

    if (m?.cantidad && m?.precio) {
        const total = Number(m.cantidad) * Number(m.precio)
        const comision = Number(m.comision) || 0
        // La comisión se resta cuando el movimiento entra: el usuario recibe
        // menos de lo que vendió. El signo decide, y el signo depende de la
        // cuenta (DEUDA-003), así que `cuentaId` llega también hasta aquí.
        return esMovimientoPositivo(m, cuentaId) ? (total - comision) : (total + comision)
    }

    // El cambio de divisa mueve dos nominales distintos. Sin perspectiva de
    // cuenta se muestra el de origen, que es el que salió del bolsillo
    // (DEUDA-001).
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
