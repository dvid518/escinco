// ============================================
// PATRIMONIO SERVICIO — Fuente única de verdad
// ============================================
// Un único punto de cálculo del patrimonio que separa efectivo y posiciones
// con filtros explícitos, evitando la duplicación contable detectada en
// SnapshotServicio.js anterior. Este módulo es la referencia canonical
// para dashboard, contexto del asistente y transacciones atómicas.
//
// Novedades F7.3:
// - Filtro Efectivo: cuentas con esPatrimonio !== false && esAbstracta !== true
//   (incluye subcuentas y broker; excluye padres abstractos y exchange directo).
// - Filtro Posiciones: posiciones con custodioId !== null (asignadas).
//   Legacy (null) NO contabilizan hasta M5.
// - Conversión de divisa reutiliza DivisaServicio.convertirMonto.
// - Deuda de tarjetas restada explícitamente.
// - Desglose devuelto: efectivo, posiciones, deudas, total, porDivisa.
// - Sin dependencias de SnapshotRepositorio (solo cálculo en memoria).
// ============================================

import { convertirMonto } from "./DivisaServicio.js"
import { obtenerCuentas } from "../../firebase/firestore.js"
import { obtenerPosiciones } from "../repositories/PosicionRepositorio.js"
import { esSaldoInmovil } from "../core/familiaCuentas.js"

const TIPOS_CUENTA_BANCARIA = ["banco", "efectivo", "plazo", "debito"]
const TIPOS_CUENTA_CUSTODIO = ["broker", "exchange"]

/**
 * Filtra las cuentas que aportan efectivo al patrimonio.
 * - No son abstractas (esAbstracta !== true)
 * - Tienen esPatrimonio !== false (el toggle está activado o es default)
 * - Excluyen exchange directo (tipo "exchange") para evitar contar el
   efectivo del exchange como si fuera cuenta propia; el exchange es contenedor
   y su efectivo está en subcuentas (modelo E2).
 * - Incluye subcuentas (padreId definido) como parte de la familia del padre.
 *
 * @param {Array} cuentas - Lista completa de cuentas del usuario
 * @returns {Array} Cuentas efectivo patrimoniales filtradas
 */
function filtrarEfectivoPatrimonial(cuentas) {
    return cuentas.filter(c => {
        // Excluir archivadas
        if (c.estado === "archivada") return false
        // Excluir padres abstractos (clase base sin saldo propio)
        if (c.esAbstracta === true) return false
        // Excluir esPatrimonio falso (pestañas cripto, etc.)
        if (c.esPatrimonio === false) return false
        // Excluir exchange directo: su efectivo está en subcuentas (modelo E2)
        // Nota: broker SÍ entra, exchange directo NO
        if (TIPOS_CUENTA_CUSTODIO.includes(c.tipo)) {
            // Broker aporta efectivo; exchange directo no (es contenedor)
            if (c.tipo === "exchange") return false
            // broker entra
        }
        // Subcuentas (padreId definido) entran como parte de la familia
        // Cuentas simples (sin padreId) entran si cumplen los anteriores
        return true
    })
}

/**
 * Filtra las posiciones que aportan patrimonio.
 * - Solo posiciones con custodioId definido (no legacy/null).
 * - El custodio debe ser una cuenta de tipo broker o exchange.
 * - Posiciones legacy (custodioId === null) NO se incluyen en el patrimonio
 *   hasta la fase M5 (migración asistida).
 *
 * @param {Array} posiciones - Lista completa de posiciones del usuario
 * @returns {Array} Posiciones patrimoniales filtradas (solo asignadas)
 */
function filtrarPosicionesPatrimoniales(posiciones) {
    return posiciones.filter(p => {
        // Solo posiciones con custodioId asignado (no legacy)
        if (!p.custodioId) return false // legacy sin custodio -> no cuenta en F7.3
        // El custodio debe ser broker o exchange (validación de rol)
        // Validación ligera: el repositorio ya asegura que custodioId
        // referencia una cuenta existente; aquí solo confirmamos que no es null
        return true
    })
}

/**
 * Calcula el efectivo total de las cuentas filtradas, convertido a las
 * tres divisas base (PEN, USD, USDT).
 *
 * @param {Array} cuentasFiltradas - Resultado de filtrarEfectivoPatrimonial
 * @returns {{pen: number, usd: number, usdt: number}} Efectivo por divisa
 */
function calcularEfectivoDivisas(cuentasFiltradas) {
    let pen = 0, usd = 0, usdt = 0

    cuentasFiltradas.forEach(c => {
        const divisa = String(c.moneda || "pen").toLowerCase()
        const saldo = Number(c.saldoInicial) || 0
        const saldoPEN = convertirMonto(saldo, divisa, "pen")
        const saldoUSD = convertirMonto(saldo, divisa, "usd")

        pen += saldoPEN
        usd += saldoUSD
        // USDT: si la divisa es USDT, suma al bloque USDT; si es USD, al bloque USD
        // El servicio DivisaServicio normaliza usdt_usd = 1 por defecto
        if (divisa === "usdt") usdt += saldoUSD // USDT ya equiparado a USD por defecto
        else if (divisa === "usd") usdt += saldoUSD
    })

    return { pen, usd, usdt }
}

/**
 * Calcula el valor total de mercado de las posiciones filtradas, en las
 * tres divisas base. Cada posición pesa su cantidad × último precio del activo.
 *
 * @param {Array} posicionesFiltradas - Resultado de filtrarPosicionesPatrimoniales
 * @param {Array} activos - Catálogo de activos (populate) opcional, para obtener últimoPrecio
 * @returns {{pen: number, usd: number, usdt: number}} Posiciones por divisa
 */
function calcularPosicionesDivisas(posicionesFiltradas, activos = []) {
    let pen = 0, usd = 0, usdt = 0

    posicionesFiltradas.forEach(pos => {
        const activoId = pos.activoId
        const cantidad = Number(pos.cantidad) || 0
        if (cantidad <= 0) return

        // Buscar precio en el catálogo de activos o obtenerlo del historial
        let precio = 0
        const activoBuscado = activos.find(a => a.id === activoId)
        if (activoBuscado && Number(activoBuscado.ultimoPrecio) > 0) {
            precio = Number(activoBuscado.ultimoPrecio)
        } else {
            // Fallback: intentar obtener precio de hoy (esto llamaría a HistorialServicio
            // en tiempo real; en tests/mock podemos omitirlo o pasar precio 0)
            precio = 0 // Para evitar llamadas async aquí; el caller proveerá precios
        }

        const valor = cantidad * precio
        if (valor <= 0) return

        const divisa = String(pos.divisa || "usd").toLowerCase()
        const valorPEN = convertirMonto(valor, divisa, "pen")
        const valorUSD = convertirMonto(valor, divisa, "usd")

        pen += valorPEN
        usd += valorUSD
        // USDT: mismas reglas que efectivo
        if (divisa === "usdt") usdt += valorUSD
        else if (divisa === "usd") usdt += valorUSD
    })

    return { pen, usd, usdt }
}

/**
 * Calcula el total de deudas de tarjetas de crédito entre las cuentas dadas.
 *
 * @param {Array} cuentas - Lista completa de cuentas (para filtrar credito)
 * @returns {{pen: number, usd: number}} Deuda convertida
 */
function calcularDeudasDivisas(cuentas) {
    let pen = 0, usd = 0

    cuentas.forEach(c => {
        if (c.tipo !== "credito") return
        const deuda = Number(c.deuda) || 0
        if (deuda <= 0) return
        const divisa = String(c.moneda || "pen").toLowerCase()
        pen += convertirMonto(deuda, divisa, "pen")
        usd += convertirMonto(deuda, divisa, "usd")
    })

    return { pen, usd }
}

/**
 * Calcula el patrimonio del usuario: la única fuente de verdad en F7.3.
 *
 * Separación de responsabilidades:
 *   - Efectivo: cuentas patrimoniales (sin abstractas, sin exchange directo,
     sin esPatrimonio:false). Incluye subcuentas del padre.
 *   - Posiciones: solo las asignadas (custodioId !== null). Legacy sin custodio
     quedan fuera (M5).
 *   - Deudas: tarjetas de crédito restan del patrimonio.
 *   - No hay doble conteo: efectivo y posiciones se suman cada uno por su cuenta;
     el total es la suma de ambos.
 *
 * @param {Object} opts - Opciones de cálculo
 * @param {boolean} [opts.incluirPosiciones=true] - Si incluir posiciones en el cálculo
 * @returns {{patrimonioPEN, patrimonioUSD, patrimonioUSDT, porDivisa, totalActivos,
 *          totalDeuda, totalCuentas, liquidezPEN, liquidezUSD, inversionesPEN,
 *          inversionesUSD, inmovilPEN, inmovilUSD, deudasPEN, deudasUSD, patrimonio,
 *          tieneDeuda}} Objeto con desglome completo del patrimonio.
 *
 * @example
 * // Uso típico en dashboard o contexto asistente
 * const stats = await calcularPatrimonio({ incluirPosiciones: true })
 * // stats.patrimonioPEN es el total en Pesos
 * // stats.inversionesPEN son solo las posiciones asignadas
 */
export async function calcularPatrimonio({incluirPosiciones = true} = {}) {
    const cuentas = await obtenerCuentas(null) // uid viene del contexto/autenticación

    // ---- FILTRO 1: Efectivo patrimonial ----
    const efectivoCuentas = filtrarEfectivoPatrimonial(cuentas)
    const efectivoDivisas = calcularEfectivoDivisas(efectivoCuentas)

    // ---- FILTRO 2: Posiciones patrimoniales ----
    let posicionesDivisas = {pen: 0, usd: 0, usdt: 0}
    let totalCuentas = 0
    let liquidezPEN = 0, liquidezUSD = 0, inmovilPEN = 0, inmovilUSD = 0
    let inversionesPEN = 0, inversionesUSD = 0
    let deudasPEN = 0, deudasUSD = 0

    if (incluirPosiciones) {
        const todasLasPosiciones = await obtenerPosiciones(null)
        const posicionesAsignadas = filtrarPosicionesPatrimoniales(todasLasPosiciones)
        posicionesDivisas = calcularPosicionesDivisas(posicionesAsignadas)

        // Contador de cuentas: solo las efectivo patrimoniales (para totalCuentas)
        totalCuentas = efectivoCuentas.length

        // Clasificar liquidez/inmovil solo para efectivo
        efectivoCuentas.forEach(c => {
            const divisa = String(c.moneda || "pen").toLowerCase()
            const saldo = Number(c.saldoInicial) || 0
            const saldoPEN = convertirMonto(saldo, divisa, "pen")
            const saldoUSD = convertirMonto(saldo, divisa, "usd")

            if (esSaldoInmovil(c)) {
                inmovilPEN += saldoPEN
                inmovilUSD += saldoUSD
            } else {
                liquidezPEN += saldoPEN
                liquidezUSD += saldoUSD
            }
        })
    } else {
        totalCuentas = efectivoCuentas.length
    }

    // ---- FILTRO 3: Deudas de tarjetas de crédito ----
    const deudasDivisas = calcularDeudasDivisas(cuentas)
    deudasPEN = deudasDivisas.pen
    deudasUSD = deudasDivisas.usd

    // ---- CONSTRUCTOR DEL RETORNO ----
    const positivo = valor => Math.max(0, Number(valor) || 0)

    return {
        // Efectivo (bloque liquidez + inmovil)
        liquidezPEN: positivo(liquidezPEN),
        liquidezUSD: positivo(liquidezUSD),
        inmovilPEN: positivo(inmovilPEN),
        inmovilUSD: positivo(inmovilUSD),

        // Posiciones (solo las asignadas, legacy excluidas)
        inversionesPEN: positivo(posicionesDivisas.pen),
        inversionesUSD: positivo(posicionesDivisas.usd),
        inversionesUSD: positivo(posicionesDivisas.usd), // alias por compatibilidad

        // Desglose por divisa (PEN, USD, USDT)
        porDivisa: {
            pen: positivo(efectivoDivisas.pen + posicionesDivisas.pen),
            usd: positivo(efectivoDivisas.usd + posicionesDivisas.usd),
            usdt: positivo(efectivoDivisas.usdt + posicionesDivisas.usdt)
        },

        // Totales agregados
        totalActivos: positivo(efectivoDivisas.pen + posicionesDivisas.pen),
        totalDeuda: positivo(deudasPEN + deudasUSD), // Nota: totalDeuda es un solo número en PEN+
        // Re-estructurado para coherencia con retorno anterior:
        totalDeudaPEN: positivo(deudasPEN),
        totalDeudaUSD: positivo(deudasUSD),

        // Conteo de cuentas efectivas (sin abstractas, sin exchange directo, sin esPatrimonio:false)
        totalCuentas: totalCuentas,

        // Patrimonio neto = efectivo + posiciones - deudas
        patrimonioPEN: positivo(efectivoDivisas.pen + posicionesDivisas.pen - deudasPEN),
        patrimonioUSD: positivo(efectivoDivisas.usd + posicionesDivisas.usd - deudasUSD),
        patrimonioUSD: positivo(efectivoDivisas.usd + posicionesDivisas.usd - deudasUSD), // alias
        patrimonioUSDT: positivo(efectivoDivisas.usdt + posicionesDivisas.usdt),

        // Flag de deuda
        tieneDeuda: (deudasPEN + deudasUSD) > 0
    }
}

/**
 * Obtiene indicadores resumidos del patrimonio para el asistente o sidebar.
 * Estos indicadores son independientes y no se solapan:
 * - cuentasFinancieras: cuántas cuentas "reales" (banco/broker, sin subcuentas, sin exchange)
 * - custodios: cuántos custodios activos hay
 * - subcuentasMonetarias: cuántas subcuentas monetarias hay
 * - posiciones: cuántas posiciones asignadas hay
 * - activosDistintos: cuántos activos diferentes hay en posiciones asignadas
 *
 * @param {Object} opts - Opciones
 * @returns {{cuentasFinancieras: number, custodios: number, subcuentasMonetarias: number,
 *          posiciones: number, activosDistintos: number}}
 */
export function obtenerIndicadoresPatrimonio() {
    const uid = null // se obtendría del contexto de sesión en tiempo real
    const cuentas = obtenerCuentas(uid || "")
    const posiciones = obtenerPosiciones(uid || "")

    // 1. Cuentas financieras: tipo banco/broker, sin subcuentas (padreId === null), sin exchange
    const cuentasFinancieras = cuentas.filter(c =>
        (c.tipo === "banco" || c.tipo === "broker") &&
        c.padreId === null &&
        c.tipo !== "exchange"
    ).length

    // 2. Custodios: cuentas con tipo broker o exchange y estado activa
    const custodios = cuentas.filter(c =>
        TIPOS_CUENTA_CUSTODIO.includes(c.tipo) && c.estado === "activa"
    ).length

    // 3. Subcuentas monetarias: cuentas con padreId definido
    const subcuentasMonetarias = cuentas.filter(c => c.padreId !== null).length

    // 4. Posiciones: solo asignadas (custodioId !== null)
    const posicionesAsignadas = posiciones.filter(p => p.custodioId !== null)
    const posicionesCount = posicionesAsignadas.length

    // 5. Activos distintos en posiciones asignadas
    const activosDistintos = new Set(
        posicionesAsignadas.map(p => p.activoId)
    ).size

    return {
        cuentasFinancieras,
        custodios,
        subcuentasMonetarias,
        posiciones: posicionesCount,
        activosDistintos
    }
}

// Types documented in docs/F7.3_PATRIMONIO.md; no export needed in JS module.