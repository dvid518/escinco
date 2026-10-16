// ============================================
// FIXTURE DE LA DEMO · DATOS DE EJEMPLO
// ============================================
// Construye un "Firestore" completo con los MISMOS documentos y campos que
// escribiría la app real (cuentas con subcuentas, movimientos, activos,
// posiciones, trades, órdenes, estrategias, metas, pendientes, snapshots e
// historial de precios). Se vuelca en firebase/demo/store.js.

import * as store from "../../firebase/demo/store.js"

export const UID = "demo"

const HOY = new Date()

function iso(diasAtras = 0) {
    const fecha = new Date(HOY)
    fecha.setDate(fecha.getDate() - diasAtras)
    return fecha.toISOString().slice(0, 10)
}

function momento(diasAtras = 0, hora = 10) {
    const fecha = new Date(HOY)
    fecha.setDate(fecha.getDate() - diasAtras)
    fecha.setHours(hora, 0, 0, 0)
    return fecha
}

export function construirFixture() {
    const db = {}
    const poner = (ruta, valor) => { db[ruta] = valor }

    // ---------- usuario ----------
    poner(`usuarios/${UID}`, {
        email: "demo@escinco.app",
        nombre: "Invitado",
        fechaRegistro: momento(120),
        preferencias: {
            tema: "dark", divisaPrincipal: "pen",
            paginas: { inversiones: true, trading: true }
        }
    })

    // ---------- cuentas ----------
    poner(`usuarios/${UID}/cuentas/efectivo-inicial`, {
        nombre: "EFECTIVO", tipo: "efectivo", moneda: "pen", saldoInicial: 1250.5,
        estado: "activa", esPatrimonio: true, orden: 0, fechaCreacion: momento(120)
    })
    poner(`usuarios/${UID}/cuentas/bcp`, {
        nombre: "BCP VISA", tipo: "credito", moneda: "pen", saldoInicial: 0,
        estado: "activa", esPatrimonio: true, orden: 1, limite: 5000, deuda: 1230.4,
        diaCorte: 22, umbralAviso: 30, umbralCritico: 70,
        numero: "**** 4821", vencimiento: "2029-06", fechaCreacion: momento(110)
    })
    poner(`usuarios/${UID}/cuentas/interbank`, {
        nombre: "INTERBANK", tipo: "banco", moneda: "pen", saldoInicial: 0,
        estado: "activa", esPatrimonio: true, orden: 2, esAbstracta: true,
        fechaCreacion: momento(100)
    })
    poner(`usuarios/${UID}/cuentas/interbank-pen`, {
        padreId: "interbank", nombre: "", tipo: "banco", moneda: "pen", saldoInicial: 3400,
        estado: "activa", esPatrimonio: true, orden: 0, fechaCreacion: momento(100)
    })
    poner(`usuarios/${UID}/cuentas/interbank-usd`, {
        padreId: "interbank", nombre: "", tipo: "banco", moneda: "usd", saldoInicial: 600,
        estado: "activa", esPatrimonio: true, orden: 1, fechaCreacion: momento(100)
    })
    poner(`usuarios/${UID}/cuentas/binance`, {
        nombre: "BINANCE", tipo: "exchange", moneda: "usdt", saldoInicial: 300,
        estado: "activa", esPatrimonio: true, orden: 3, fechaCreacion: momento(90)
    })

    // ---------- movimientos ----------
    const movimientos = {
        "m-sueldo": { tipo: "ingreso", cuenta: "efectivo-inicial", concepto: "Sueldo", monto: 3200, divisa: "pen", fechaRealizacion: iso(1), etiquetas: ["sueldo"] },
        "m-mercado": { tipo: "gasto", cuenta: "interbank-pen", concepto: "Mercado", monto: 320.5, divisa: "pen", fechaRealizacion: iso(2), etiquetas: ["esencial"] },
        "m-restaurante": { tipo: "gasto", cuenta: "bcp", concepto: "Restaurante", monto: 180.4, divisa: "pen", fechaRealizacion: iso(3), etiquetas: ["ocio"] },
        "m-transferencia": { tipo: "transferencia", cuentaOrigen: "interbank-pen", cuentaDestino: "efectivo-inicial", monto: 500, divisa: "pen", concepto: "Ahorro", fechaRealizacion: iso(4) },
        "m-cambio": { tipo: "cambioDivisa", cuentaOrigen: "interbank-pen", cuentaDestino: "interbank-usd", montoOrigen: 375, montoDestino: 100, tasa: 3.75, fechaRealizacion: iso(5) },
        "m-pago-tarjeta": { tipo: "pagoTarjeta", cuentaOrigen: "efectivo-inicial", tarjeta: "bcp", monto: 500, divisa: "pen", fechaRealizacion: iso(6) },
        "m-compra-btc": { tipo: "compraActivo", cuenta: "binance", activo: "BTC", cantidad: 0.002, precio: 60000, divisa: "usd", concepto: "Compra BTC", fechaRealizacion: iso(7), etiquetas: ["inversión"] },
        "m-p2p": { tipo: "p2pVenta", cuenta: "binance", activo: "USDT", cantidad: 150, precio: 1, divisa: "usd", concepto: "Venta P2P", fechaRealizacion: iso(8), etiquetas: ["p2p"] },
        "m-freelance": { tipo: "ingreso", cuenta: "interbank-usd", concepto: "Freelance", monto: 450, divisa: "usd", fechaRealizacion: iso(9) },
        "m-netflix": { tipo: "gasto", cuenta: "bcp", concepto: "Netflix", monto: 44.9, divisa: "pen", fechaRealizacion: iso(10), etiquetas: ["suscripción"] }
    }
    const diasMov = { "m-sueldo": 1, "m-mercado": 2, "m-restaurante": 3, "m-transferencia": 4, "m-cambio": 5, "m-pago-tarjeta": 6, "m-compra-btc": 7, "m-p2p": 8, "m-freelance": 9, "m-netflix": 10 }
    for (const [id, movimiento] of Object.entries(movimientos)) {
        poner(`usuarios/${UID}/movimientos/${id}`, { ...movimiento, fechaRegistro: momento(diasMov[id]) })
    }

    // ---------- activos y posiciones ----------
    poner(`usuarios/${UID}/activos/btc`, {
        nombre: "Bitcoin", simbolo: "BTC", tipo: "crypto", ultimoPrecio: 97500,
        favorito: true, fuente: "manual", apiSimbolo: null,
        ultimaActualizacion: momento(0), fechaCreacion: momento(60)
    })
    poner(`usuarios/${UID}/activos/voo`, {
        nombre: "Vanguard S&P 500", simbolo: "VOO", tipo: "etf", ultimoPrecio: 512.3,
        favorito: false, fuente: "manual", apiSimbolo: null,
        ultimaActualizacion: momento(0), fechaCreacion: momento(45)
    })
    poner(`usuarios/${UID}/posiciones/btc`, {
        activoId: "btc", cantidad: 0.002, divisa: "usd", precioPromedio: 60000,
        ultimaActualizacion: momento(7)
    })
    poner(`usuarios/${UID}/posiciones/voo`, {
        activoId: "voo", cantidad: 2, divisa: "usd", precioPromedio: 500,
        ultimaActualizacion: momento(20)
    })

    // historial de precio de BTC (últimos 7 días)
    for (let i = 6; i >= 0; i--) {
        poner(`usuarios/${UID}/activos/btc/historial/${iso(i)}`, {
            fecha: iso(i), precio: 95000 + (6 - i) * 420, cerrado: true, actualizacion: momento(i)
        })
    }

    // ---------- trades ----------
    poner(`usuarios/${UID}/trades/t-btc`, {
        activo: "BTC", cuenta: "binance", entrada: 96000, salida: null, lotaje: 0.002,
        sl: 92000, tp: 105000, tipo: "long", estado: "abierto", divisa: "usd",
        ordenId: null, fechaRegistro: momento(7), fechaCierre: null
    })
    poner(`usuarios/${UID}/trades/t-eth`, {
        activo: "ETH", cuenta: "binance", entrada: 3400, salida: 3600, lotaje: 0.5,
        sl: null, tp: null, tipo: "long", estado: "cerrado", divisa: "usd",
        ordenId: null, fechaRegistro: momento(40), fechaCierre: momento(12)
    })

    // ---------- órdenes ----------
    poner(`usuarios/${UID}/ordenes/o-btc`, {
        activo: "BTC", cuenta: "binance", tipoOrden: "limite", direccion: "short",
        precioDisparo: 105000, lotaje: 0.001, sl: null, tp: null, divisa: "usd",
        estado: "pendiente", tradeId: null, precioEjecucion: null,
        fechaCreacion: momento(5), fechaEjecucion: null
    })
    poner(`usuarios/${UID}/ordenes/o-eth`, {
        activo: "ETH", cuenta: "binance", tipoOrden: "stop", direccion: "long",
        precioDisparo: 3600, lotaje: 0.2, sl: null, tp: null, divisa: "usd",
        estado: "pendiente", tradeId: null, precioEjecucion: null,
        fechaCreacion: momento(3), fechaEjecucion: null
    })

    // ---------- estrategias ----------
    poner(`usuarios/${UID}/estrategias/dca-btc`, {
        nombre: "DCA Bitcoin", activoSimbolo: "BTC", cuentaId: "binance", montoFijo: 50,
        divisa: "usd", frecuencia: "mensual", diaPreferido: 1,
        proximaEjecucion: momento(-11), ultimaEjecucion: momento(19), activa: true,
        fechaCreacion: momento(50)
    })

    // ---------- metas ----------
    poner(`usuarios/${UID}/metas/viaje`, {
        nombre: "Viaje", montoObjetivo: 5000, montoActual: 3200, divisa: "pen",
        fechaLimite: null, activa: true, icono: "target", fechaCreacion: momento(80)
    })
    poner(`usuarios/${UID}/metas/emergencia`, {
        nombre: "Fondo emergencia", montoObjetivo: 10000, montoActual: 7800, divisa: "pen",
        fechaLimite: null, activa: true, icono: "coins", fechaCreacion: momento(80)
    })

    // ---------- pendientes ----------
    poner(`usuarios/${UID}/pendientes/alquiler`, {
        concepto: "Alquiler", tipo: false, monto: 800, divisa: "pen",
        fechaRegistro: momento(15), fechaVencimiento: momento(-5),
        fechaConsolidacion: null, pendiente: true
    })
    poner(`usuarios/${UID}/pendientes/freelance`, {
        concepto: "Freelance", tipo: true, monto: 1200, divisa: "pen",
        fechaRegistro: momento(10), fechaVencimiento: momento(-20),
        fechaConsolidacion: null, pendiente: true
    })

    // ---------- snapshots de patrimonio (últimos 14 días) ----------
    for (let i = 13; i >= 0; i--) {
        const base = 11800 + Math.round(Math.sin(i / 2) * 420) + (13 - i) * 55
        poner(`usuarios/${UID}/snapshots/${iso(i)}`, {
            patrimonioPEN: base, patrimonioUSD: Math.round(base / 3.75),
            cerrado: true, actualizacion: momento(i)
        })
    }

    return db
}

// Vuelca el fixture en el almacén. Por defecto solo la primera vez; `forzar`
// reescribe todo (botón "Reiniciar demo").
export function sembrar({ forzar = false } = {}) {
    if (!forzar && store.existe(`usuarios/${UID}`)) return false
    store.reemplazarTodo(construirFixture())
    return true
}
