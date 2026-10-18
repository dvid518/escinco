import {
    crearMovimiento,
    crearCuenta,
    obtenerCuenta,
    obtenerCuentas,
    actualizarCuenta,
    obtenerMovimientos,
    actualizarMovimientoDoc,
    eliminarMovimientoDoc,
    restaurarDocumento,
    db,
    doc,
    writeBatch
} from "../../firebase/firestore.js"
import { TIPOS_MOVIMIENTO, CONFIG_MOVIMIENTOS } from "../../constants/tiposMovimiento.js"
import { getFechaHoy } from "../core/fechas.js"
import { obtenerMeta, obtenerMetas, actualizarMeta } from "../repositories/MetaRepositorio.js"
import { evaluarCreditosYNotificar } from "./CreditoServicio.js"
import { mostrarNotificacion } from "../ui/notificaciones.js"
import { cacheCapa } from "../core/cache.js"

// No se permiten fechas futuras: cualquier fechaRealizacion mayor que hoy
// se normaliza al día de hoy. Aplica tanto al registrar como al editar.
function normalizarFechaFutura(datos) {
    const iso = typeof datos?.fechaRealizacion === "string" ? datos.fechaRealizacion.slice(0, 10) : ""
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && iso > getFechaHoy()) {
        datos.fechaRealizacion = getFechaHoy()
    }
    return datos
}

// ============================================
// REGISTRAR MOVIMIENTO
// ============================================

export async function registrarMovimiento(uid, tipo, datos) {
    const tipoUpper = tipo.toUpperCase()
    const tipoValido = Object.values(TIPOS_MOVIMIENTO).find(
        t => t.toUpperCase() === tipoUpper
    )

    if (!tipoValido) {
        throw new Error(`Tipo de movimiento inválido: ${tipo}`)
    }

    const tipoFinal = tipoValido
    const config = CONFIG_MOVIMIENTOS[tipoFinal]

    if (!config) {
        throw new Error(`Configuración no encontrada para: ${tipoFinal}`)
    }

    const camposFaltantes = config.camposObligatorios.filter(campo => {
        return datos[campo] === undefined || datos[campo] === null || datos[campo] === ""
    })

    if (camposFaltantes.length > 0) {
        throw new Error(`Campos obligatorios faltantes: ${camposFaltantes.join(", ")}`)
    }

    normalizarFechaFutura(datos)

    // Los pagos de tarjeta se limitan a la deuda pendiente: si el monto la
    // supera, solo se registra lo necesario para pagarla por completo.
    await ajustarPagoDeTarjeta(uid, tipoFinal, datos)
    await validarTransferencia(uid, tipoFinal, datos)

    // 1. Crear el movimiento
    const movimiento = await crearMovimiento(uid, {
        tipo: tipoFinal,
        ...datos
    })

    // 2. Actualizar saldos
    await actualizarSaldos(uid, tipoFinal, datos)

    // 2b. Si un movimiento cambió la deuda de una tarjeta, avisar al cruzar un umbral.
    await evaluarCreditosYNotificar(uid)

    // 3. Actualizar posición si es compra/venta de activo.
    //    El error NO se traga: si la posición no pudo actualizarse, el
    //    usuario debe saberlo para no dejar el inventario inconsistente.
    if (esMovimientoDeActivo(tipoFinal)) {
        try {
            await aplicarPosicion(uid, tipoFinal, datos)
            console.log(`[INFO] Posición actualizada para activo: ${datos.activo}`)
        } catch (error) {
            console.error("[ERROR] Error actualizando posición:", error)
            throw new Error(
                `El movimiento se guardó, pero no se pudo actualizar la posición de "${datos.activo}": ${error.message}`
            )
        }
    }

    notificarMovimientosActualizados()

    return movimiento
}

// ============================================
// SUBCUENTAS CRIPTO EN EXCHANGES
// ============================================
// Un exchange funciona así: la cuenta nace en USDT y cada criptomoneda que se
// compra crea una pestaña propia. Aquí "pestaña" es una subcuenta real con
// `moneda` = símbolo (BTC, ETH...) que guarda SU cantidad. La cuenta sigue en
// USDT, sin tocar su saldo ni su número/CCI/vigencia; las pestañas se ven como
// pills en el panel de la cuenta y no son patrimoniales (la posición se valora
// por separado). El movimiento de efectivo (idr la cantidad x precio al saldo
// USDT) lo hace actualizarSaldos como siempre.

// ¿Qué se cuenta como cripto? Todo símbolo que no sea una de las tres divisas
// base: el modelo del exchange no tiene por qué conocer cada token de antemano.
function esCriptoParaExchange(simbolo) {
    return !["PEN", "USD", "USDT"].includes(simbolo)
}

async function sincronizarSubcuentaExchange(uid, tipo, datos) {
    if (!datos?.cuenta || !datos?.activo) return
    const esCompra = tipo === TIPOS_MOVIMIENTO.COMPRA_ACTIVO || tipo === TIPOS_MOVIMIENTO.P2P_COMPRA
    const esVenta = tipo === TIPOS_MOVIMIENTO.VENTA_ACTIVO || tipo === TIPOS_MOVIMIENTO.P2P_VENTA
    if (!esCompra && !esVenta) return

    const simbolo = String(datos.activo).trim().toUpperCase()
    if (!esCriptoParaExchange(simbolo)) return

    const cuenta = await obtenerCuenta(uid, datos.cuenta)
    if (!cuenta || cuenta.tipo !== "exchange") return

    const cantidad = Number(datos.cantidad) || 0
    if (cantidad <= 0) return

    const hermanas = (await obtenerCuentas(uid)).filter(c => c.padreId === cuenta.id)
    const pestana = hermanas.find(c => (c.moneda || "").toUpperCase() === simbolo)

    if (pestana) {
        const delta = esCompra ? cantidad : -cantidad
        await actualizarCuenta(uid, pestana.id, {
            saldoInicial: Math.max(0, (pestana.saldoInicial || 0) + delta)
        })
        return
    }

    // No hay pestaña para esa cripto: se crea al comprar. Una venta sin
    // pestaña previa no tiene sentido y no crea nada.
    if (esVenta) return
    await crearCuenta(uid, {
        tipo: "exchange",
        moneda: simbolo,
        saldoInicial: cantidad,
        padreId: cuenta.id,
        estado: "activa",
        esPatrimonio: false,
        orden: (cuenta.orden ?? 0) + hermanas.length + 1
    })
}

/**
 * Aplica el efecto de un movimiento de activo a la posición.
 * Se reutiliza tras crear, al revertir y al volver a aplicar en ediciones.
 */
async function aplicarPosicion(uid, tipo, datos) {
    // Las pestañas cripto de un exchange se crean/actualizan junto a la
    // posición; revertirPosicion la llama con el tipo inverso y deshace.
    await sincronizarSubcuentaExchange(uid, tipo, datos)
    const { actualizarPosicionPorMovimiento } = await import("./PosicionServicio.js")
    await actualizarPosicionPorMovimiento(uid, {
        tipo,
        activo: datos.activo,
        cuenta: datos.cuenta,
        cantidad: datos.cantidad,
        precio: datos.precio,
        comision: datos.comision || 0,
        divisa: datos.divisa
    })
}

/**
 * Revierte el efecto de un movimiento de activo (compra ↔ venta).
 */
async function revertirPosicion(uid, m) {
    if (!esMovimientoDeActivo(m.tipo)) return

    const tipoInverso = {
        [TIPOS_MOVIMIENTO.COMPRA_ACTIVO]: TIPOS_MOVIMIENTO.VENTA_ACTIVO,
        [TIPOS_MOVIMIENTO.VENTA_ACTIVO]: TIPOS_MOVIMIENTO.COMPRA_ACTIVO,
        [TIPOS_MOVIMIENTO.P2P_COMPRA]: TIPOS_MOVIMIENTO.P2P_VENTA,
        [TIPOS_MOVIMIENTO.P2P_VENTA]: TIPOS_MOVIMIENTO.P2P_COMPRA
    }[m.tipo]

    await aplicarPosicion(uid, tipoInverso, {
        activo: m.activo,
        cuenta: m.cuenta,
        cantidad: Math.abs(m.cantidad || 0),
        precio: m.precio,
        comision: 0,
        divisa: m.divisa
    })
}

// ============================================
// ACTUALIZAR MOVIMIENTO
// ============================================
// Revierte el efecto del movimiento original (saldos + posición) y aplica
// el del nuevo. NO reescribe fechaRegistro (se mantiene la creación).

export async function actualizarMovimiento(uid, movimientoId, movimientoOriginal, tipo, datos) {
    const tipoUpper = tipo.toUpperCase()
    const tipoFinal = Object.values(TIPOS_MOVIMIENTO).find(
        t => t.toUpperCase() === tipoUpper
    )

    if (!tipoFinal) {
        throw new Error(`Tipo de movimiento inválido: ${tipo}`)
    }

    const config = CONFIG_MOVIMIENTOS[tipoFinal]
    if (!config) {
        throw new Error(`Configuración no encontrada para: ${tipoFinal}`)
    }

    const camposFaltantes = config.camposObligatorios.filter(campo => {
        return datos[campo] === undefined || datos[campo] === null || datos[campo] === ""
    })

    if (camposFaltantes.length > 0) {
        throw new Error(`Campos obligatorios faltantes: ${camposFaltantes.join(", ")}`)
    }

    normalizarFechaFutura(datos)

    await ajustarPagoDeTarjeta(uid, tipoFinal, datos, movimientoOriginal)
    await validarTransferencia(uid, tipoFinal, datos)

    const metaVinculada = await resolverMetaDeMovimiento(uid, movimientoOriginal)

    // 1. Deshacer el efecto del movimiento original
    await revertirSaldos(uid, movimientoOriginal.tipo, movimientoOriginal)
    await revertirPosicion(uid, movimientoOriginal)
    if (metaVinculada) {
        await revertirAporteMetaDeMeta(uid, metaVinculada, Math.abs(movimientoOriginal.monto || 0))
    }

    // 2. Aplicar el nuevo efecto
    await actualizarSaldos(uid, tipoFinal, datos)
    if (esMovimientoDeActivo(tipoFinal)) {
        await aplicarPosicion(uid, tipoFinal, datos)
    }
    if (metaVinculada) {
        await aplicarAporteMeta(uid, metaVinculada.id, Math.abs(datos.monto || 0))
    }

    // 2b. El resultado final puede haber cruzado (o dejado de cruzar) un umbral.
    await evaluarCreditosYNotificar(uid)

    // 3. Actualizar el documento (conserva el vínculo con la meta)
    const datosGuardado = { tipo: tipoFinal, ...datos }
    if (metaVinculada) {
        datosGuardado.metaId = metaVinculada.id
    }
    await actualizarMovimientoDoc(uid, movimientoId, datosGuardado)

    notificarActualizacionMetas()
    notificarMovimientosActualizados()

    return true
}

// ============================================
// ELIMINAR MOVIMIENTO
// ============================================
// Revierte el efecto del movimiento (saldos + posición) y borra el doc.

export async function eliminarMovimiento(uid, m) {
    await revertirSaldos(uid, m.tipo, m)
    await revertirPosicion(uid, m)
    await revertirAporteMeta(uid, m)
    await eliminarMovimientoDoc(uid, m.id)
    await evaluarCreditosYNotificar(uid)
    notificarActualizacionMetas()
    notificarMovimientosActualizados()
    return true
}

// ============================================
// RESTAURAR MOVIMIENTO (deshacer eliminación)
// ============================================
// Reaplica el efecto del movimiento (saldos + posición + aporte a meta)
// y recrea el documento con su id y fecha originales.

export async function restaurarMovimiento(uid, m) {
    if (!m?.id) return false

    await actualizarSaldos(uid, m.tipo, m)
    await evaluarCreditosYNotificar(uid)
    if (esMovimientoDeActivo(m.tipo)) {
        await aplicarPosicion(uid, m.tipo, m)
    }
    const meta = await resolverMetaDeMovimiento(uid, m)
    if (meta) {
        await aplicarAporteMeta(uid, meta.id, Math.abs(m.monto || 0))
    }

    await restaurarDocumento(uid, "movimientos", m.id, m)

    notificarActualizacionMetas()
    notificarMovimientosActualizados()
    return true
}

// ============================================
// VÍNCULO CON METAS DE AHORRO
// ============================================
// Un gasto creado por "Aportar a meta" guarda `metaId`. Al eliminar o editar
// ese movimiento se ajusta el monto actual de la meta para que el fondo y el
// total aportado reflejen el nuevo estado de la cuenta.
//
// Los movimientos de aporte creados antes de que existiera el vínculo explícito
// (sin `metaId`) se resuelven por su concepto "Aporte a meta: {nombre}" cuando
// ese nombre coincide con una única meta.

async function resolverMetaDeMovimiento(uid, m) {
    if (m?.metaId) {
        try {
            const meta = await obtenerMeta(uid, m.metaId)
            if (meta) return meta
        } catch {
            // La meta pudo haber sido borrada; intentar el fallback por nombre.
        }
    }

    const nombre = nombreMetaDesdeConcepto(m?.concepto)
    if (!nombre) return null

    try {
        const metas = await obtenerMetas(uid)
        const coincidencias = metas.filter(meta =>
            (meta.nombre || "").trim().toLowerCase() === nombre
        )
        return coincidencias.length === 1 ? coincidencias[0] : null
    } catch {
        return null
    }
}

function nombreMetaDesdeConcepto(concepto) {
    const prefijo = "aporte a meta: "
    const texto = String(concepto || "").trim().toLowerCase()
    if (!texto.startsWith(prefijo)) return null
    const nombre = String(concepto).trim().slice(prefijo.length).trim()
    return nombre ? nombre.toLowerCase() : null
}

async function revertirAporteMeta(uid, m) {
    const meta = await resolverMetaDeMovimiento(uid, m)
    if (!meta) return
    await revertirAporteMetaDeMeta(uid, meta, Math.abs(m.monto || 0))
}

async function revertirAporteMetaDeMeta(uid, meta, monto) {
    if (!meta || !monto || monto <= 0) return
    await actualizarMeta(uid, meta.id, {
        montoActual: Math.max(0, (meta.montoActual || 0) - monto)
    })
}

async function aplicarAporteMeta(uid, metaId, monto) {
    if (!metaId || !monto || monto <= 0) return

    const meta = await obtenerMeta(uid, metaId)
    if (!meta) return

    await actualizarMeta(uid, metaId, {
        montoActual: (meta.montoActual || 0) + monto
    })
}

// Cuando un movimiento vinculado a una meta cambia, las vistas abiertas de
// metas (dashboard y modal) deben refrescar sus datos.
function notificarActualizacionMetas() {
    try {
        window.dispatchEvent(new CustomEvent("metas-actualizadas"))
    } catch {
        // Entorno sin window (p.ej. tests): el evento se ignora.
    }
}

// Cuando cualquier movimiento cambia (crear/editar/eliminar/restaurar), las
// páginas abiertas (cuentas, dashboard) deben refrescar sus datos.
export function notificarMovimientosActualizados() {
    try {
        window.dispatchEvent(new CustomEvent("movimientos-actualizados"))
    } catch {
        // Entorno sin window (p.ej. tests): el evento se ignora.
    }
}

/**
 * Limita el monto de un pago de tarjeta a la deuda pendiente. Si el pago
 * supera la deuda, solo se registra lo necesario para pagarla por completo
 * y se avisa al usuario. Si la tarjeta no tiene deuda, el pago se rechaza.
 */
async function ajustarPagoDeTarjeta(uid, tipo, datos, movimientoOriginal = null) {
    if (tipo !== TIPOS_MOVIMIENTO.PAGO_TARJETA) return datos

    const tarjeta = datos?.tarjeta ? await obtenerCuenta(uid, datos.tarjeta) : null
    const origen = datos?.cuentaOrigen ? await obtenerCuenta(uid, datos.cuentaOrigen) : null
    if (!tarjeta) throw new Error("No se encontró la tarjeta a pagar")
    if (!origen) throw new Error("No se encontró la cuenta de origen")
    if (origen.tipo === "credito") throw new Error("Una tarjeta de crédito no puede ser origen de un pago de tarjeta")
    if ((origen.moneda || "pen").toLowerCase() !== (tarjeta.moneda || "pen").toLowerCase()) {
        throw new Error("La cuenta de origen debe usar la misma divisa que la tarjeta")
    }

    const montoSolicitado = Number(datos.monto) || 0
    if (montoSolicitado <= 0) throw new Error("El monto del pago debe ser mayor a cero")

    let deudaMaxima = Math.max(0, Number(tarjeta.deuda) || 0)
    if (
        movimientoOriginal?.tipo === TIPOS_MOVIMIENTO.PAGO_TARJETA &&
        movimientoOriginal.tarjeta === datos.tarjeta
    ) {
        deudaMaxima += Math.max(0, Number(movimientoOriginal.monto) || 0)
    }

    if (deudaMaxima <= 0) throw new Error(`"${tarjeta.nombre}" no tiene deuda pendiente`)

    if (montoSolicitado > deudaMaxima) {
        datos.monto = deudaMaxima
        mostrarNotificacion(
            "info",
            `El pago superaba la deuda de "${tarjeta.nombre}". Solo se registró ${deudaMaxima.toFixed(2)}.`
        )
    }

    return datos
}

/**
 * Una transferencia tiene dos formas:
 *
 *  - Origen y destino comparten divisa: se mueve `monto` en los dos lados.
 *  - Origen y destino usan divisas distintas: se mueven `montoOrigen` y
 *    `montoDestino`, con `tasa` como dato informativo (DEUDA-002/002b). Así se
 *    puede cruzar divisas sin el salto silencioso de nominal que denunciaba
 *    DEUDA-002: 100 USD salen y entran, por ejemplo, 375 PEN.
 *
 * No se convierte con `convertirMonto` a propósito: la app tiene un único tipo
 * de cambio global (PEN/USD) y no uno por par, así que la tasa aplicada es la
 * que el usuario deja escrita en el movimiento y puede revisar.
 *
 * Valida además que ninguna de las dos cuentas sea una tarjeta de crédito
 * (BUG-028): una tarjeta no tiene saldo que mover.
 *
 * Solo se valida al crear y al editar, nunca al revertir: los movimientos
 * heredados que ya están corruptos deben poder borrarse y deshacerse.
 */
async function validarTransferencia(uid, tipo, datos) {
    if (tipo !== TIPOS_MOVIMIENTO.TRANSFERENCIA) return datos

    const origen = datos?.cuentaOrigen ? await obtenerCuenta(uid, datos.cuentaOrigen) : null
    const destino = datos?.cuentaDestino ? await obtenerCuenta(uid, datos.cuentaDestino) : null
    if (!origen) throw new Error("No se encontró la cuenta de origen")
    if (!destino) throw new Error("No se encontró la cuenta de destino")

    // Una tarjeta de crédito no tiene saldo que mover: su deuda vive en
    // `deuda`, y una transferencia terminaría restando o sumando a
    // `saldoInicial`, un campo que las tarjetas no usan para nada. El efecto
    // es un `saldoInicial` basura, invisible salvo que alguien lo mire. El
    // formulario ya no ofrece tarjetas (BUG-028); esto es la misma regla en
    // la única capa donde no se puede confiar en el cliente.
    if (destino.tipo === "credito") {
        throw new Error(
            `"${destino.nombre}" es una tarjeta de crédito y no admite transferencias. ` +
            `Para pagar su deuda usa "Pago de tarjeta", y para gastar con ella, "Gasto".`
        )
    }
    if (origen.tipo === "credito") {
        throw new Error(
            `"${origen.nombre}" es una tarjeta de crédito y no tiene saldo del que transferir. ` +
            `Para pagar su deuda usa "Pago de tarjeta".`
        )
    }

    const monedaOrigen = (origen.moneda || "pen").toLowerCase()
    const monedaDestino = (destino.moneda || "pen").toLowerCase()

    if (monedaOrigen === monedaDestino) {
        const monto = Number(datos.monto) || 0
        if (monto <= 0) throw new Error("El monto de la transferencia debe ser mayor a cero")
        delete datos.montoOrigen
        delete datos.montoDestino
        delete datos.tasa
        return datos
    }

    const montoOrigen = Number(datos.montoOrigen) || 0
    const montoDestino = Number(datos.montoDestino) || 0
    if (montoOrigen <= 0) throw new Error('Para transferir entre divisas, indica el monto de origen')
    if (montoDestino <= 0) throw new Error('Para transferir entre divisas, indica el monto de destino')

    const tasa = Number(datos.tasa) || 0
    datos.tasa = tasa > 0 ? tasa : Number((montoOrigen / montoDestino).toFixed(6))
    delete datos.monto
    return datos
}

function esMovimientoDeActivo(tipo) {
    return (
        tipo === TIPOS_MOVIMIENTO.COMPRA_ACTIVO ||
        tipo === TIPOS_MOVIMIENTO.VENTA_ACTIVO ||
        tipo === TIPOS_MOVIMIENTO.P2P_COMPRA ||
        tipo === TIPOS_MOVIMIENTO.P2P_VENTA
    )
}

// ============================================
// ACTUALIZAR SALDOS SEGÚN TIPO
// ============================================

/**
 * Devuelve cuánto mueve la transferencia de cada lado. Las transferencias
 * nuevas entre divisas traen `montoOrigen`/`montoDestino`; las normales y las
 * heredadas, un único `monto` que aplica a los dos lados.
 */
function montosDeTransferencia(datos) {
    const origen = Number(datos?.montoOrigen)
    const destino = Number(datos?.montoDestino)
    if (Number.isFinite(origen) && origen > 0 && Number.isFinite(destino) && destino > 0) {
        return { origen, destino }
    }
    const monto = Number(datos?.monto) || 0
    return { origen: monto, destino: monto }
}

async function actualizarSaldos(uid, tipo, datos) {
    switch (tipo) {
        case TIPOS_MOVIMIENTO.INGRESO:
            await actualizarSaldoCuenta(uid, datos.cuenta, datos.monto, "sumar")
            break

        case TIPOS_MOVIMIENTO.GASTO: {
            const cuenta = await obtenerCuenta(uid, datos.cuenta)
            if (cuenta?.tipo === "credito") {
                // Comprar con una tarjeta de crédito es un gasto que
                // aumenta su deuda (no mueve saldoInicial).
                await actualizarDeudaTarjeta(uid, datos.cuenta, datos.monto, "aumentar")
            } else {
                await actualizarSaldoCuenta(uid, datos.cuenta, datos.monto, "restar")
            }
            break
        }

        case TIPOS_MOVIMIENTO.TRANSFERENCIA: {
            const { origen, destino } = montosDeTransferencia(datos)
            await actualizarSaldoCuenta(uid, datos.cuentaOrigen, origen, "restar")
            await actualizarSaldoCuenta(uid, datos.cuentaDestino, destino, "sumar")
            break
        }

        case TIPOS_MOVIMIENTO.CAMBIO_DIVISA:
            await actualizarSaldoCuenta(uid, datos.cuentaOrigen, datos.montoOrigen, "restar")
            await actualizarSaldoCuenta(uid, datos.cuentaDestino, datos.montoDestino, "sumar")
            break

        case TIPOS_MOVIMIENTO.COMPRA_ACTIVO: {
            // La cuenta es opcional (una compra puede no salir de ninguna
            // cuenta: un regalo, una aportación). Sin cuenta solo se registra
            // la posición, sin tocar saldos.
            if (!datos.cuenta) break
            const totalCompra = (datos.cantidad * datos.precio) + (datos.comision || 0)
            const cuenta = await obtenerCuenta(uid, datos.cuenta)
            if (cuenta?.tipo === "credito") await actualizarDeudaTarjeta(uid, datos.cuenta, totalCompra, "aumentar")
            else await actualizarSaldoCuenta(uid, datos.cuenta, totalCompra, "restar")
            break
        }

        case TIPOS_MOVIMIENTO.VENTA_ACTIVO: {
            // ✅ Comisión descontada del saldo recibido
            if (!datos.cuenta) break
            const totalVenta = (datos.cantidad * datos.precio) - (datos.comision || 0)
            await actualizarSaldoCuenta(uid, datos.cuenta, totalVenta, "sumar")
            break
        }

        case TIPOS_MOVIMIENTO.P2P_COMPRA: {
            const totalP2PCompra = (datos.cantidad * datos.precio) + (datos.comision || 0)
            const cuenta = await obtenerCuenta(uid, datos.cuenta)
            if (cuenta?.tipo === "credito") await actualizarDeudaTarjeta(uid, datos.cuenta, totalP2PCompra, "aumentar")
            else await actualizarSaldoCuenta(uid, datos.cuenta, totalP2PCompra, "restar")
            break
        }

        case TIPOS_MOVIMIENTO.P2P_VENTA: {
            const totalP2PVenta = (datos.cantidad * datos.precio) - (datos.comision || 0)
            await actualizarSaldoCuenta(uid, datos.cuenta, totalP2PVenta, "sumar")
            break
        }

        case TIPOS_MOVIMIENTO.COMPRA_TARJETA:
            await actualizarDeudaTarjeta(uid, datos.cuenta, datos.monto, "aumentar")
            break

        case TIPOS_MOVIMIENTO.PAGO_TARJETA:
            await actualizarDeudaTarjeta(uid, datos.tarjeta, datos.monto, "reducir")
            await actualizarSaldoCuenta(uid, datos.cuentaOrigen, datos.monto, "restar")
            break

        case TIPOS_MOVIMIENTO.ERROR:
            if (datos.operacion === "sumar") {
                await actualizarSaldoCuenta(uid, datos.cuenta, datos.monto, "sumar")
            } else if (datos.operacion === "restar") {
                await actualizarSaldoCuenta(uid, datos.cuenta, datos.monto, "restar")
            }
            break

        default:
            console.warn(`Tipo de movimiento sin actualización de saldo: ${tipo}`)
    }
}

// ============================================
// REVERTIR SALDOS (inverso de actualizarSaldos)
// ============================================

async function revertirSaldos(uid, tipo, datos) {
    switch (tipo) {
        case TIPOS_MOVIMIENTO.INGRESO:
            await actualizarSaldoCuenta(uid, datos.cuenta, datos.monto, "restar")
            break

        case TIPOS_MOVIMIENTO.GASTO: {
            const cuenta = await obtenerCuenta(uid, datos.cuenta)
            if (cuenta?.tipo === "credito") {
                await actualizarDeudaTarjeta(uid, datos.cuenta, datos.monto, "reducir")
            } else {
                await actualizarSaldoCuenta(uid, datos.cuenta, datos.monto, "sumar")
            }
            break
        }

        case TIPOS_MOVIMIENTO.TRANSFERENCIA: {
            const { origen, destino } = montosDeTransferencia(datos)
            await actualizarSaldoCuenta(uid, datos.cuentaOrigen, origen, "sumar")
            await actualizarSaldoCuenta(uid, datos.cuentaDestino, destino, "restar")
            break
        }

        case TIPOS_MOVIMIENTO.CAMBIO_DIVISA:
            await actualizarSaldoCuenta(uid, datos.cuentaOrigen, datos.montoOrigen, "sumar")
            await actualizarSaldoCuenta(uid, datos.cuentaDestino, datos.montoDestino, "restar")
            break

        case TIPOS_MOVIMIENTO.COMPRA_ACTIVO:
        case TIPOS_MOVIMIENTO.P2P_COMPRA: {
            if (tipo === TIPOS_MOVIMIENTO.COMPRA_ACTIVO && !datos.cuenta) break
            const total = (datos.cantidad * datos.precio) + (datos.comision || 0)
            const cuenta = await obtenerCuenta(uid, datos.cuenta)
            if (cuenta?.tipo === "credito") await actualizarDeudaTarjeta(uid, datos.cuenta, total, "reducir")
            else await actualizarSaldoCuenta(uid, datos.cuenta, total, "sumar")
            break
        }

        case TIPOS_MOVIMIENTO.VENTA_ACTIVO:
        case TIPOS_MOVIMIENTO.P2P_VENTA: {
            if (tipo === TIPOS_MOVIMIENTO.VENTA_ACTIVO && !datos.cuenta) break
            const total = (datos.cantidad * datos.precio) - (datos.comision || 0)
            await actualizarSaldoCuenta(uid, datos.cuenta, total, "restar")
            break
        }

        case TIPOS_MOVIMIENTO.COMPRA_TARJETA:
            await actualizarDeudaTarjeta(uid, datos.cuenta, datos.monto, "reducir")
            break

        case TIPOS_MOVIMIENTO.PAGO_TARJETA:
            await actualizarDeudaTarjeta(uid, datos.tarjeta, datos.monto, "aumentar")
            await actualizarSaldoCuenta(uid, datos.cuentaOrigen, datos.monto, "sumar")
            break

        case TIPOS_MOVIMIENTO.ERROR:
            if (datos.operacion === "sumar") {
                await actualizarSaldoCuenta(uid, datos.cuenta, datos.monto, "restar")
            } else if (datos.operacion === "restar") {
                await actualizarSaldoCuenta(uid, datos.cuenta, datos.monto, "sumar")
            }
            break

        default:
            break
    }
}

// ============================================
// ACTUALIZAR SALDO DE UNA CUENTA
// ============================================

async function actualizarSaldoCuenta(uid, cuentaId, monto, operacion) {
    if (!cuentaId) {
        console.warn("No se proporcionó cuentaId para actualizar saldo")
        return
    }

    try {
        const cuenta = await obtenerCuenta(uid, cuentaId)
        if (!cuenta) {
            console.warn(`Cuenta no encontrada: ${cuentaId}`)
            return
        }

        const saldoActual = cuenta.saldoInicial || 0
        let nuevoSaldo

        switch (operacion) {
            case "sumar":
                nuevoSaldo = saldoActual + monto
                break
            case "restar":
                nuevoSaldo = saldoActual - monto
                break
            default:
                throw new Error(`Operación inválida: ${operacion}`)
        }

        // Se permite gastar más de lo que hay, pero se advierte con una
        // notificación en el momento en que el saldo pasa a negativo.
        if (cuenta.tipo !== "credito" && nuevoSaldo < 0) {
            console.warn(`Saldo negativo en cuenta ${cuenta.nombre}: ${nuevoSaldo}`)
            mostrarNotificacion(
                "warning",
                `El movimiento dejó la cuenta "${cuenta.nombre}" en saldo negativo (${nuevoSaldo.toFixed(2)}). Se registró igual.`
            )
        }

        await actualizarCuenta(uid, cuentaId, { saldoInicial: nuevoSaldo })
        console.log(`[INFO] Cuenta ${cuenta.nombre}: ${saldoActual} → ${nuevoSaldo}`)
    } catch (error) {
        console.error("Error actualizando saldo:", error)
        throw error
    }
}

// ============================================
// ACTUALIZAR DEUDA DE UNA TARJETA
// ============================================

async function actualizarDeudaTarjeta(uid, tarjetaId, monto, operacion) {
    if (!tarjetaId) {
        console.warn("No se proporcionó tarjetaId para actualizar deuda")
        return
    }

    try {
        const tarjeta = await obtenerCuenta(uid, tarjetaId)
        if (!tarjeta) {
            console.warn(`Tarjeta no encontrada: ${tarjetaId}`)
            return
        }

        if (tarjeta.tipo !== "credito") {
            console.warn(`La cuenta ${tarjetaId} no es una tarjeta de crédito`)
            return
        }

        const deudaActual = tarjeta.deuda || 0
        let nuevaDeuda

        switch (operacion) {
            case "aumentar":
                nuevaDeuda = deudaActual + monto
                break
            case "reducir":
                nuevaDeuda = Math.max(0, deudaActual - monto)
                break
            default:
                throw new Error(`Operación inválida: ${operacion}`)
        }

        await actualizarCuenta(uid, tarjetaId, { deuda: nuevaDeuda })
        console.log(`[INFO] Tarjeta ${tarjeta.nombre}: deuda ${deudaActual} → ${nuevaDeuda}`)
    } catch (error) {
        console.error("Error actualizando deuda:", error)
        throw error
    }
}

// ============================================
// OBTENER MOVIMIENTOS CON FILTROS
// ============================================

export async function obtenerMovimientosConFiltros(uid, filtros = {}) {
    const movimientos = await obtenerMovimientos(uid)

    let resultado = movimientos

    if (filtros.tipos && filtros.tipos.length > 0) {
        const tiposValidos = filtros.tipos
        resultado = resultado.filter(m => tiposValidos.includes(m.tipo))
    } else if (filtros.tipo) {
        resultado = resultado.filter(m => m.tipo === filtros.tipo)
    }

    if (filtros.desde) {
        const desde = parseFechaLocal(filtros.desde)
        resultado = resultado.filter(m => {
            const fecha = normalizarFecha(m.fechaRealizacion || m.fechaRegistro)
            return fecha >= desde
        })
    }

    if (filtros.hasta) {
        const hasta = parseFechaLocal(filtros.hasta)
        hasta.setHours(23, 59, 59, 999)
        resultado = resultado.filter(m => {
            const fecha = normalizarFecha(m.fechaRealizacion || m.fechaRegistro)
            return fecha <= hasta
        })
    }

    if (filtros.cuenta) {
        resultado = resultado.filter(m => {
            return (
                m.cuenta === filtros.cuenta ||
                m.cuentaOrigen === filtros.cuenta ||
                m.cuentaDestino === filtros.cuenta ||
                m.tarjeta === filtros.cuenta
            )
        })
    }

    if (filtros.divisa) {
        const divisa = filtros.divisa.toUpperCase()
        resultado = resultado.filter(m => {
            return (
                (m.divisa || "").toUpperCase() === divisa ||
                (m.cuentaDivisa || "").toUpperCase() === divisa
            )
        })
    }

    if (filtros.q) {
        const busqueda = filtros.q.toLowerCase().trim()
        if (busqueda) {
            resultado = resultado.filter(m => {
                const texto = [
                    m.concepto,
                    m.activo,
                    m.exchange,
                    m.nombreVendedor,
                    m.nombreComprador,
                    m.cuentaPago,
                    m.cuentaCobro
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                return texto.includes(busqueda)
            })
        }
    }

    resultado.sort((a, b) => {
        const fechaA = normalizarFecha(a.fechaRealizacion || a.fechaRegistro)
        const fechaB = normalizarFecha(b.fechaRealizacion || b.fechaRegistro)
        return fechaB - fechaA
    })

    return resultado
}

// Normaliza un valor de fecha que puede ser Timestamp, Date o string ISO
function normalizarFecha(valor) {
    if (!valor) return new Date(0)
    if (valor?.toDate) return valor.toDate()
    if (valor instanceof Date) return valor
    return new Date(valor)
}

// ============================================
// ETIQUETADO MASIVO
// ============================================

/**
 * Aplica un set de etiquetas a varios movimientos en un solo batch. NO pasa
 * por actualizarMovimiento: tocar etiquetas no mueve saldos ni posiciones, y
 * revalidar todo el movimiento sería revisar de más. Parchea la caché de
 * movimientos igual que actualizarMovimientoDoc.
 *
 * cambios: [{ id, etiquetas }]
 */
export async function aplicarEtiquetasEnLote(uid, cambios) {
    if (!cambios.length) return
    const lote = writeBatch(db)
    for (const { id, etiquetas } of cambios) {
        lote.update(doc(db, "usuarios", uid, "movimientos", id), { etiquetas })
    }
    await lote.commit()
    cacheCapa.parchear(uid, "movimientos", lista =>
        lista.map(m => {
            const cambio = cambios.find(c => c.id === m.id)
            return cambio ? { ...m, etiquetas: cambio.etiquetas } : m
        })
    )
}

// Parsea "YYYY-MM-DD" como fecha LOCAL (no UTC), para que los filtros
// coincidan con el día mostrado en el formulario.
function parseFechaLocal(valor) {
    if (!valor) return null
    const [anio, mes, dia] = String(valor).split("-").map(Number)
    if (!anio || !mes || !dia) return new Date(valor)
    return new Date(anio, mes - 1, dia)
}