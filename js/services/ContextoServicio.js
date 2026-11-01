import { obtenerCuentas, obtenerMovimientos } from "../../firebase/firestore.js"
import { calcularPatrimonio } from "./SnapshotServicio.js"
import { convertirMonto, getDivisaPrincipal, getTipoCambio } from "./DivisaServicio.js"
import { obtenerPosiciones } from "../repositories/PosicionRepositorio.js"
import { TIPOS_MOVIMIENTO } from "../../constants/tiposMovimiento.js"
import { montoDeMovimiento } from "../core/movimientos.js"

// ============================================
// CONTEXTO DEL ASISTENTE
// ============================================
// Construye un resumen en texto de los datos financieros del usuario para que
// drov pueda responder con cifras reales. Es de SOLO LECTURA: no escribe nada
// en Firestore.
//
// El resumen se cachea unos segundos porque cada mensaje del chat lo necesita
// y las lecturas de Firestore ya vienen cacheadas por `cacheCapa`; esto evita
// recalcular el texto en preguntas seguidas.

const VIGENCIA_MS = 30000

const TIPOS_CUENTA = {
    banco: "banco",
    efectivo: "efectivo",
    broker: "broker",
    exchange: "exchange",
    plazo: "depósito a plazo",
    debito: "tarjeta de débito",
    credito: "tarjeta de crédito"
}

let cache = { uid: null, texto: "", momento: 0 }
let enCurso = null

/**
 * Devuelve el resumen de datos del usuario listo para el prompt del asistente.
 * Si algo falla, devuelve un texto parcial o vacío: el chat sigue funcionando.
 *
 * @param {string} uid
 * @returns {Promise<string>}
 */
export async function obtenerContextoAsistente(uid) {
    if (!uid) return ""

    const ahora = Date.now()
    if (cache.uid === uid && cache.texto && ahora - cache.momento < VIGENCIA_MS) {
        return cache.texto
    }

    if (enCurso) return enCurso

    enCurso = construirContexto(uid)
        .then(texto => {
            cache = { uid, texto, momento: Date.now() }
            return texto
        })
        .catch(error => {
            console.warn("[WARN] No se pudo construir el contexto del asistente:", error)
            return "No se pudieron leer los datos del usuario en este momento."
        })
        .finally(() => {
            enCurso = null
        })

    return enCurso
}

/** Descarta el resumen cacheado (por ejemplo, tras crear o editar datos). */
export function invalidarContextoAsistente() {
    cache = { uid: null, texto: "", momento: 0 }
}

async function construirContexto(uid) {
    const [cuentas, movimientos, patrimonio, posiciones] = await Promise.all([
        obtenerCuentas(uid).catch(() => []),
        obtenerMovimientos(uid).catch(() => []),
        calcularPatrimonio(uid).catch(() => null),
        obtenerPosiciones(uid).catch(() => [])
    ])

    if (!patrimonio && cuentas.length === 0 && posiciones.length === 0 && movimientos.length === 0) {
        return "No se pudieron leer los datos del usuario en este momento."
    }

    const lineas = []
    const principal = getDivisaPrincipal().toUpperCase()
    const cambio = getTipoCambio()

    lineas.push(`Fecha de hoy: ${fechaDeHoy()}. Divisa principal del usuario: ${principal}.`)
    lineas.push(
        "Tipo de cambio configurado (unidades por 1 USD): " +
        `PEN ${numero(cambio.pen_usd)}, EUR ${numero(cambio.eur_usd)}, USDT ${numero(cambio.usdt_usd)}.`
    )

    if (patrimonio) {
        lineas.push(
            "Patrimonio neto total (cuentas + inversiones − deudas), expresado en cada divisa: " +
            `USD ${numero(patrimonio.patrimonioUSD)} | PEN ${numero(patrimonio.patrimonioPEN)} | USDT ${numero(patrimonio.patrimonioUSDT)}.`
        )
        lineas.push(
            "Los mismos bloques, cada uno expresado en las dos divisas (no son sumas separadas): " +
            `liquidez USD ${numero(patrimonio.liquidezUSD)} / PEN ${numero(patrimonio.liquidezPEN)}; ` +
            `inmovilizado USD ${numero(patrimonio.inmovilUSD)} / PEN ${numero(patrimonio.inmovilPEN)}; ` +
            `deuda de tarjetas USD ${numero(patrimonio.deudasUSD)} / PEN ${numero(patrimonio.deudasPEN)}.`
        )
    }

    const { efectivo, inversiones } = repartirPorDivisa(cuentas, posiciones)
    const totalCuentasUSD = totalEnUSD(efectivo)
    const totalInversionesUSD = totalEnUSD(inversiones)
    lineas.push(`Dinero en cuentas por divisa (sin inversiones, deuda de tarjetas restada): ${resumenDivisas(efectivo)}.`)
    lineas.push(`Inversiones por divisa (valor de mercado actual): ${resumenDivisas(inversiones)}.`)
    lineas.push(
        "Totales convertidos a USD (composición exacta del patrimonio): " +
        `cuentas ${numero(totalCuentasUSD)} + inversiones ${numero(totalInversionesUSD)} = ${numero(totalCuentasUSD + totalInversionesUSD)}.`
    )

    lineas.push(...lineasCuentas(cuentas))
    lineas.push(...lineasInversiones(posiciones))
    lineas.push(...lineasMovimientos(movimientos, cuentas, principal))

    return lineas.join("\n")
}

// Saldos e inversiones en su divisa nativa, sin convertir: así el asistente
// puede responder "cuánto tengo en dólares" sin mezclar monedas.
function repartirPorDivisa(cuentas, posiciones) {
    const efectivo = {}
    const inversiones = {}

    for (const cuenta of cuentas) {
        if (cuenta.estado === "archivada" || cuenta.esAbstracta === true || cuenta.esPatrimonio === false) continue
        const divisa = String(cuenta.moneda || "pen").toLowerCase()
        const monto = cuenta.tipo === "credito"
            ? -(Number(cuenta.deuda) || 0)
            : Number(cuenta.saldoInicial) || 0
        efectivo[divisa] = (efectivo[divisa] || 0) + monto
    }

    for (const posicion of posiciones) {
        const precio = Number(posicion?.activo?.ultimoPrecio) || 0
        if (!posicion?.activo || precio <= 0) continue
        const divisa = String(posicion.divisa || "usd").toLowerCase()
        const valor = (Number(posicion.cantidad) || 0) * precio
        inversiones[divisa] = (inversiones[divisa] || 0) + valor
    }

    return { efectivo, inversiones }
}

function lineasCuentas(cuentas) {
    const activas = cuentas.filter(cuenta =>
        cuenta.estado !== "archivada" &&
        cuenta.esAbstracta !== true &&
        cuenta.esPatrimonio !== false
    )

    if (activas.length === 0) return ["Cuentas: el usuario no tiene cuentas activas."]

    const visibles = activas.slice(0, 20)
    const lineas = [`Cuentas activas (${activas.length}):`]

    for (const cuenta of visibles) {
        const tipo = TIPOS_CUENTA[cuenta.tipo] || cuenta.tipo || "cuenta"
        const divisa = String(cuenta.moneda || "pen").toUpperCase()
        const nombre = cuenta.nombre || "Sin nombre"

        if (cuenta.tipo === "credito") {
            const deuda = Number(cuenta.deuda) || 0
            const limite = Number(cuenta.limite) || 0
            lineas.push(`- ${nombre} | ${tipo} | ${divisa} | deuda ${numero(deuda)} de límite ${numero(limite)}`)
        } else {
            lineas.push(`- ${nombre} | ${tipo} | ${divisa} | saldo ${numero(cuenta.saldoInicial)}`)
        }
    }

    if (activas.length > visibles.length) {
        lineas.push(`- … y ${activas.length - visibles.length} cuentas más.`)
    }

    return lineas
}

function lineasInversiones(posiciones) {
    const abiertas = posiciones
        .filter(posicion => (Number(posicion?.cantidad) || 0) > 0)
        .sort((a, b) => valorDePosicion(b) - valorDePosicion(a))

    if (abiertas.length === 0) return ["Inversiones: no hay posiciones abiertas."]

    const visibles = abiertas.slice(0, 10)
    const lineas = [`Posiciones abiertas (${abiertas.length}):`]

    for (const posicion of visibles) {
        const activo = posicion.activo || {}
        const simbolo = activo.simbolo || activo.nombre || "Activo"
        const divisa = String(posicion.divisa || "usd").toUpperCase()
        const cantidad = Number(posicion.cantidad) || 0
        const precio = Number(activo.ultimoPrecio) || 0
        const valor = cantidad * precio
        const promedio = Number(posicion.precioPromedio) || 0
        const rendimiento = promedio > 0 ? ((precio / promedio) - 1) * 100 : 0
        const signo = rendimiento >= 0 ? "+" : ""
        lineas.push(
            `- ${simbolo} | ${cantidad} unidades | precio ${numero(precio)} ${divisa} | ` +
            `valor ${numero(valor)} ${divisa} | rendimiento ${signo}${rendimiento.toFixed(1)}%`
        )
    }

    if (abiertas.length > visibles.length) {
        lineas.push(`- … y ${abiertas.length - visibles.length} posiciones más.`)
    }

    return lineas
}

function lineasMovimientos(movimientos, cuentas, principal) {
    const ahora = new Date()
    const treintaDias = new Date(ahora)
    treintaDias.setHours(0, 0, 0, 0)
    treintaDias.setDate(treintaDias.getDate() - 29)

    let ingresos30 = 0
    let gastos30 = 0
    let nIngresos30 = 0
    let nGastos30 = 0
    let ingresosMes = 0
    let gastosMes = 0

    for (const movimiento of movimientos) {
        if (movimiento.tipo !== TIPOS_MOVIMIENTO.INGRESO && movimiento.tipo !== TIPOS_MOVIMIENTO.GASTO) continue

        const fecha = fechaDeMovimiento(movimiento)
        if (!fecha || Number.isNaN(fecha.getTime())) continue

        const monto = Math.abs(convertirMonto(
            montoDeMovimiento(movimiento),
            divisaDeMovimiento(movimiento, cuentas),
            principal.toLowerCase()
        ))

        if (fecha >= treintaDias) {
            if (movimiento.tipo === TIPOS_MOVIMIENTO.INGRESO) {
                ingresos30 += monto
                nIngresos30++
            } else {
                gastos30 += monto
                nGastos30++
            }
        }

        if (fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth()) {
            if (movimiento.tipo === TIPOS_MOVIMIENTO.INGRESO) ingresosMes += monto
            else gastosMes += monto
        }
    }

    return [
        `Movimientos últimos 30 días (en ${principal}): ingresos ${numero(ingresos30)} (${nIngresos30}), ` +
        `gastos ${numero(gastos30)} (${nGastos30}), balance ${numero(ingresos30 - gastos30)}.`,
        `Mes actual (en ${principal}): ingresos ${numero(ingresosMes)}, gastos ${numero(gastosMes)}, ` +
        `balance ${numero(ingresosMes - gastosMes)}.`
    ]
}

function valorDePosicion(posicion) {
    const precio = Number(posicion?.activo?.ultimoPrecio) || 0
    return (Number(posicion?.cantidad) || 0) * precio
}

function divisaDeMovimiento(movimiento, cuentas) {
    if (movimiento.divisa) return String(movimiento.divisa).toLowerCase()
    const cuentaId = movimiento.cuenta || movimiento.cuentaOrigen
    const cuenta = cuentas.find(item => item.id === cuentaId)
    return String(cuenta?.moneda || "pen").toLowerCase()
}

function fechaDeMovimiento(movimiento) {
    const valor = movimiento.fechaRealizacion || movimiento.fechaRegistro
    if (!valor) return null
    if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
        const [anio, mes, dia] = valor.split("-").map(Number)
        return new Date(anio, mes - 1, dia)
    }
    if (valor?.toDate) return valor.toDate()
    if (valor?.seconds) return new Date(valor.seconds * 1000)
    return new Date(valor)
}

function totalEnUSD(mapa) {
    return Object.entries(mapa).reduce(
        (total, [divisa, monto]) => total + convertirMonto(monto, divisa, "usd"),
        0
    )
}

function resumenDivisas(mapa) {
    const entradas = Object.entries(mapa)
        .filter(([, monto]) => Math.abs(monto) > 0.005)
        .sort(([a], [b]) => a.localeCompare(b))

    if (entradas.length === 0) return "sin saldo"
    return entradas.map(([divisa, monto]) => `${divisa.toUpperCase()} ${numero(monto)}`).join(" | ")
}

function numero(valor) {
    const n = Number(valor)
    return (Number.isFinite(n) ? n : 0).toFixed(2)
}

function fechaDeHoy() {
    const ahora = new Date()
    return ahora.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
}
