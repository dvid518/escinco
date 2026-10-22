import {
    guardarSnapshotDelDia,
    obtenerSnapshots,
    obtenerSnapshotHoy
} from "../repositories/SnapshotRepositorio.js"
import { convertirMonto } from "./DivisaServicio.js"
import { obtenerCuentas } from "../../firebase/firestore.js"
import { obtenerPosiciones } from "../repositories/PosicionRepositorio.js"
import { obtenerPrecioHistorialDeHoy } from "./HistorialServicio.js"
import { esSaldoInmovil } from "../core/familiaCuentas.js"

// ============================================
// SNAPSHOT SERVICIO
// ============================================

/**
 * Calcula el patrimonio actual del usuario en las 3 divisas base.
 *
 * Incluye las posiciones de inversión: cada posición pesa su cantidad × el
 * último precio del activo, en la divisa de la posición. Si el activo no tiene
 * precio cargado se cae al precio de hoy del historial; si tampoco, no pesa.
 */
export async function calcularPatrimonio(uid) {
    const cuentas = await obtenerCuentas(uid)

    let patrimonioPEN = 0
    let patrimonioUSD = 0
    let patrimonioUSDT = 0
    let totalActivos = 0
    let totalDeuda = 0
    let totalCuentas = 0
    // Mismos bloques que la card de distribución patrimonial: liquidez,
    // inversiones, inmovilizado y deudas. Se guardan en PEN y USD porque el
    // gráfico puede mostrar cualquiera de las dos y la conversión histórica
    // debe ser la del día del snapshot, no la del tipo de cambio actual.
    let liquidezPEN = 0
    let liquidezUSD = 0
    let inversionesPEN = 0
    let inversionesUSD = 0
    let inmovilPEN = 0
    let inmovilUSD = 0
    let deudasPEN = 0
    let deudasUSD = 0
    // Desglose por divisa en su propia moneda (no convertido): cuánto dinero
    // hay en cada una. Los tres totales de arriba son el MISMO patrimonio
    // expresado en tres monedas, así que no sirven para repartir pesos.
    const porDivisa = {}
    const sumarDivisa = (divisa, monto) => {
        const clave = String(divisa || "pen").toLowerCase()
        porDivisa[clave] = (porDivisa[clave] || 0) + monto
    }

    cuentas.forEach(c => {
        if (c.estado === "archivada") return
        // Padre abstracto: clase base sin saldo; pesan sus hijas.
        if (c.esAbstracta === true) return

        totalCuentas++

        if (c.esPatrimonio === false) return

        const divisa = c.moneda || "pen"

        // Tarjetas de crédito: restar deuda
        if (c.tipo === "credito") {
            const deuda = c.deuda || 0
            const deudaPEN = convertirMonto(deuda, divisa, "pen")
            const deudaUSD = convertirMonto(deuda, divisa, "usd")

            totalDeuda += deudaPEN
            deudasPEN += deudaPEN
            deudasUSD += deudaUSD
            patrimonioPEN -= deudaPEN
            patrimonioUSD -= deudaUSD
            patrimonioUSDT -= deudaUSD
            sumarDivisa(divisa, -deuda)
            return
        }

        // Cuentas normales
        const saldo = c.saldoInicial || 0
        const saldoPEN = convertirMonto(saldo, divisa, "pen")
        const saldoUSD = convertirMonto(saldo, divisa, "usd")
        totalActivos += saldoPEN
        patrimonioPEN += saldoPEN
        patrimonioUSD += saldoUSD
        patrimonioUSDT += saldoUSD
        sumarDivisa(divisa, saldo)

        if (esSaldoInmovil(c, cuentas)) {
            inmovilPEN += saldoPEN
            inmovilUSD += saldoUSD
        } else {
            liquidezPEN += saldoPEN
            liquidezUSD += saldoUSD
        }
    })

    // Inversiones: posiciones en su divisa. No fallan no por que una posición
    // corrompida (activo borrado) no pueda tumbar el patrimonio del día.
    try {
        const posiciones = await obtenerPosiciones(uid)
        for (const posicion of posiciones) {
            const activo = posicion?.activo
            if (!activo) continue

            let precio = Number(activo.ultimoPrecio) || 0
            if (precio <= 0) {
                precio = Number(await obtenerPrecioHistorialDeHoy(uid, activo.id)) || 0
            }
            if (precio <= 0) continue

            const valor = (Number(posicion.cantidad) || 0) * precio
            if (valor <= 0) continue

            const divisaPosicion = (posicion.divisa || "usd").toLowerCase()
            const pen = convertirMonto(valor, divisaPosicion, "pen")
            const usd = convertirMonto(valor, divisaPosicion, "usd")
            totalActivos += pen
            patrimonioPEN += pen
            patrimonioUSD += usd
            patrimonioUSDT += usd
            inversionesPEN += pen
            inversionesUSD += usd
            sumarDivisa(divisaPosicion, valor)
        }
    } catch (error) {
        console.warn("[WARN] No se pudieron valorar las posiciones para el patrimonio:", error)
    }

    // Las categorías se guardan como importes positivos, igual que la dona de
    // distribución: una deuda de 500 pesa 500 en su bloque, y el neto sigue
    // saliendo de `patrimonioPEN`. Los saldos negativos no se arrastran a la
    // serie de la categoría; así el gráfico no mezcla deuda con liquidez.
    const positivo = valor => Math.max(0, Number(valor) || 0)

    return {
        patrimonioPEN,
        patrimonioUSD,
        patrimonioUSDT,
        porDivisa,
        totalActivos,
        totalDeuda,
        totalCuentas,
        liquidezPEN: positivo(liquidezPEN),
        liquidezUSD: positivo(liquidezUSD),
        inversionesPEN: positivo(inversionesPEN),
        inversionesUSD: positivo(inversionesUSD),
        inmovilPEN: positivo(inmovilPEN),
        inmovilUSD: positivo(inmovilUSD),
        deudasPEN: positivo(deudasPEN),
        deudasUSD: positivo(deudasUSD),
        patrimonio: patrimonioPEN,
        tieneDeuda: totalDeuda > 0
    }
}

/**
 * Registra (o actualiza) el snapshot del día.
 */
export async function registrarSnapshot(uid) {
    try {
        if (!uid) throw new Error("uid vacío: la escritura se intentó antes de autenticar")
        const patrimonio = await calcularPatrimonio(uid)
        const numero = valor => {
            const n = Number(valor)
            return Number.isFinite(n) ? n : 0
        }

        await guardarSnapshotDelDia(uid, {
            patrimonioPEN: numero(patrimonio.patrimonioPEN),
            patrimonioUSD: numero(patrimonio.patrimonioUSD),
            // Desglose que alimenta el selector del modal de evolución. Son
            // cuatro bloques × dos divisas; el gráfico puede convertir USDT
            // desde USD porque el servicio los normaliza.
            liquidezPEN: numero(patrimonio.liquidezPEN),
            liquidezUSD: numero(patrimonio.liquidezUSD),
            inversionesPEN: numero(patrimonio.inversionesPEN),
            inversionesUSD: numero(patrimonio.inversionesUSD),
            inmovilPEN: numero(patrimonio.inmovilPEN),
            inmovilUSD: numero(patrimonio.inmovilUSD),
            deudasPEN: numero(patrimonio.deudasPEN),
            deudasUSD: numero(patrimonio.deudasUSD)
            // `patrimonioUSDT` no se persiste: era idéntico a
            // `patrimonioUSD` (el servicio normaliza USDT = USD), así que solo
            // ocupaba espacio en cada documento y en cada .dvid. Los snapshots
            // antiguos que lo conserven siguen leyéndose: las reglas lo
            // aceptan como opcional y `obtenerPatrimonioParaGrafico` cae a
            // `patrimonioUSD`.
        })

        console.log("[INFO] Snapshot registrado:", patrimonio)
        return patrimonio
    } catch (error) {
        console.error("Error registrando snapshot:", error?.code, error?.message, error?.customData || "")
        throw error
    }
}

/**
 * Devuelve los datos para el gráfico de patrimonio.
 */
export async function obtenerPatrimonioParaGrafico(uid, dias = 30) {
    try {
        const snapshots = await obtenerSnapshots(uid, dias)

        const valorSerie = (snapshot, campo) => {
            const valor = snapshot[campo]
            // Los snapshots anteriores al desglose no tienen la clave. Se deja
            // null para que Chart.js abra un hueco, en vez de dibujar un 0 que
            // haría creer que esa categoría no existía.
            if (valor === undefined || valor === null) return null
            return Number(valor) || 0
        }
        const serie = (campoPEN, campoUSD = campoPEN) => {
            const pen = snapshots.map(s => valorSerie(s, campoPEN))
            const usd = snapshots.map(s => valorSerie(s, campoUSD))
            // USDT = USD por definición del servicio, así que la serie sale de
            // `...USD`. Funciona igual con los snapshots antiguos que todavía
            // guarden `patrimonioUSDT`.
            return { pen, usd, usdt: usd }
        }

        const dataPEN = snapshots.map(s => Number(s.patrimonioPEN) || 0)
        const dataUSD = snapshots.map(s => Number(s.patrimonioUSD) || 0)

        return {
            labels: snapshots.map(s => {
                const fecha = new Date(s.fecha + "T00:00:00")
                return fecha.toLocaleDateString("es-PE", {
                    day: "2-digit",
                    month: "2-digit"
                })
            }),
            dataPEN,
            dataUSD,
            dataUSDT: dataUSD,
            // Series por categoría. Los snapshots anteriores a este cambio no
            // tienen los campos: quedan como huecos (null) y no rompen el
            // gráfico; la serie se va llenando desde el primer snapshot nuevo.
            categorias: {
                todo: { pen: dataPEN, usd: dataUSD, usdt: dataUSD },
                liquidez: serie("liquidezPEN", "liquidezUSD"),
                inversiones: serie("inversionesPEN", "inversionesUSD"),
                inmovil: serie("inmovilPEN", "inmovilUSD"),
                deudas: serie("deudasPEN", "deudasUSD")
            },
            snapshots
        }
    } catch (error) {
        console.error("Error obteniendo snapshots para gráfico:", error)
        return {
            labels: [],
            dataPEN: [],
            dataUSD: [],
            dataUSDT: [],
            categorias: {},
            snapshots: []
        }
    }
}

/**
 * Snapshot de hoy o lo crea si no existe.
 */
export async function obtenerOCrearSnapshotHoy(uid) {
    try {
        let snapshot = await obtenerSnapshotHoy(uid)

        if (!snapshot) {
            await registrarSnapshot(uid)
            snapshot = await obtenerSnapshotHoy(uid)
        }

        return snapshot
    } catch (error) {
        console.error("Error obteniendo snapshot de hoy:", error)
        return null
    }
}