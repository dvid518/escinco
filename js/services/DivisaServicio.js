import { actualizarPreferencias } from "../../firebase/firestore.js"
import { DIVISAS, DIVISAS_LABELS, DIVISAS_SYMBOLS, DIVISAS_PALABRAS, TIPO_CAMBIO_DEFAULT } from "../../constants/divisas.js"
import { sesion } from "../core/sesion.js"

// ============================================
// DIVISA SERVICIO
// ============================================

export function getDivisaPrincipal() {
    const prefs = sesion.getPreferencias()
    return prefs?.divisaPrincipal || DIVISAS.PEN
}

export function getSimboloDivisaPrincipal() {
    return DIVISAS_SYMBOLS[getDivisaPrincipal()] || "S/"
}

// ============================================
// FORMATO DE DIVISA · SÍMBOLO ($) O CÓDIGO (USD)
// ============================================
// Preferencia del usuario: "simbolo" (por defecto, muestra $) o "codigo" (USD).

export function getFormatoDivisa() {
    const prefs = sesion.getPreferencias()
    const formato = prefs?.formatoDivisa
    return formato === "codigo" ? "codigo" : "simbolo"
}

/**
 * Devuelve la representación de una moneda según la preferencia:
 *   simbolo → "$" · codigo → "USD"
 */
export function presentarDivisa(moneda) {
    const clave = String(moneda || getDivisaPrincipal()).toLowerCase()
    if (getFormatoDivisa() === "codigo") {
        return DIVISAS_LABELS[clave] ? DIVISAS_LABELS[clave].toUpperCase() : String(clave).toUpperCase()
    }
    // Monedas fuera de las tres base (un cripto "BTC", una divisa libre...):
    // nunca "S/" por defecto, que confundiría; se muestra el código en
    // mayúsculas, que es el mejor símbolo que puede tener una moneda sin uno.
    return DIVISAS_SYMBOLS[clave] || String(clave).toUpperCase()
}

/**
 * Etiqueta de subcuenta según el formato elegido por el usuario:
 *   simbolo → "SOLES" / "DÓLARES" / "USDT" (palabra, nunca solo "$")
 *   codigo  → "PEN" / "USD" / "USDT"
 * Vale para cualquier divisa: fuera de la lista usa el código en mayúsculas.
 */
export function etiquetaDivisa(moneda) {
    const clave = String(moneda || getDivisaPrincipal()).toLowerCase()
    if (getFormatoDivisa() === "codigo") {
        return DIVISAS_LABELS[clave] ? DIVISAS_LABELS[clave].toUpperCase() : String(clave).toUpperCase()
    }
    return DIVISAS_PALABRAS[clave] || DIVISAS_LABELS[clave]?.toUpperCase() || String(clave).toUpperCase()
}

/**
 * Formatea un monto respetando el formato de divisa elegido:
 *   simbolo → "$ 100.00" · codigo → "100.00 USD"
 * `despues` indica si el código va después del número (para cuentas/movimientos).
 */
export function formatearMontoConDivisa(monto, moneda = null) {
    const importe = Number(monto).toFixed(2)
    if (getFormatoDivisa() === "codigo") {
        return `${importe} ${DIVISAS_LABELS[(moneda || getDivisaPrincipal()).toLowerCase()] || String(moneda || "").toUpperCase() || "PEN"}`
    }
    return `${presentarDivisa(moneda)} ${importe}`
}

export function getTipoCambio() {
    const prefs = sesion.getPreferencias()
    return prefs?.tipoCambio || TIPO_CAMBIO_DEFAULT
}

// --------------------------------------------
// CONVERSIÓN
// --------------------------------------------
// Cada tasa se guarda como "unidades de la divisa por 1 USD". USDT ya NO se
// normaliza a USD: es una divisa propia (por defecto 1 USDT = 1 USD, ajustable).

function numeroPositivo(valor, respaldo) {
    const n = Number(valor)
    return Number.isFinite(n) && n > 0 ? n : respaldo
}

/** Devuelve las unidades por 1 USD de una divisa, o null si no es fiat conocida. */
export function getTasaCambio(divisa) {
    const tc = getTipoCambio()
    const d = String(divisa || "").toLowerCase()

    if (d === DIVISAS.USD) return 1
    if (d === DIVISAS.PEN) return numeroPositivo(tc.pen_usd, TIPO_CAMBIO_DEFAULT.pen_usd)
    if (d === DIVISAS.EUR) return numeroPositivo(tc.eur_usd, TIPO_CAMBIO_DEFAULT.eur_usd)
    if (d === DIVISAS.USDT) return numeroPositivo(tc.usdt_usd, TIPO_CAMBIO_DEFAULT.usdt_usd)

    // Cripto o divisa libre: sin tasa. No se convierte.
    return null
}

export function convertirMonto(monto, desde, hacia) {
    if (desde === hacia) return monto

    const tasaDesde = getTasaCambio(desde)
    const tasaHacia = getTasaCambio(hacia)

    // Sin tasa conocida en alguno de los lados, se devuelve el monto tal cual.
    if (tasaDesde == null || tasaHacia == null) return monto

    // Normalizar a USD y volver a la divisa destino.
    return (monto / tasaDesde) * tasaHacia
}

// --------------------------------------------
// FORMATEO
// --------------------------------------------

export function formatearMonto(monto, divisa = null) {
    const div = divisa || getDivisaPrincipal()
    if (getFormatoDivisa() === "codigo") {
        const codigo = DIVISAS_LABELS[div] || String(div).toUpperCase()
        return `${Number(monto).toFixed(2)} ${codigo}`
    }
    const simbolo = DIVISAS_SYMBOLS[div] || "S/"
    return `${simbolo} ${Number(monto).toFixed(2)}`
}

export function formatearMontoEnPrincipal(monto, divisaOrigen) {
    const divPrincipal = getDivisaPrincipal()
    const montoConvertido = convertirMonto(monto, divisaOrigen, divPrincipal)
    return formatearMonto(montoConvertido, divPrincipal)
}

// --------------------------------------------
// PERSISTENCIA
// --------------------------------------------

/**
 * Guarda la divisa principal en Firestore y sesión.
 * Usa dot notation para no pisar otras preferencias.
 */
export async function guardarDivisaPrincipal(uid, divisa) {
    if (!["pen", "usd", "usdt", "eur"].includes(divisa)) {
        throw new Error(`Divisa inválida: ${divisa}`)
    }

    await actualizarPreferencias(uid, { divisaPrincipal: divisa })

    const prefs = sesion.getPreferencias()
    sesion.setPreferencias({ ...prefs, divisaPrincipal: divisa })
}

/**
 * Guarda el tipo de cambio en Firestore y sesión.
 * `actualizacion` refleja cuándo se actualizó el TC: si la persona guarda
 * las preferencias con la moneda en modo "auto" y ya hay una fecha previa,
 * se conserva (el TC no cambió); si se pasa null se sella ahora.
 * `extras` permite adjuntar las tasas de EUR/USDT (unidades por 1 USD).
 */
export async function guardarTipoCambio(uid, penUSD, modo = "manual", actualizacion = null, extras = {}) {
    const previo = getTipoCambio()
    const tipoCambio = {
        pen_usd: penUSD,
        eur_usd: numeroPositivo(extras.eur_usd, numeroPositivo(previo.eur_usd, TIPO_CAMBIO_DEFAULT.eur_usd)),
        usdt_usd: numeroPositivo(extras.usdt_usd, numeroPositivo(previo.usdt_usd, TIPO_CAMBIO_DEFAULT.usdt_usd)),
        modo,
        actualizacion: actualizacion || new Date().toISOString()
    }

    await actualizarPreferencias(uid, { tipoCambio })

    const prefs = sesion.getPreferencias()
    sesion.setPreferencias({ ...prefs, tipoCambio })
}

// --------------------------------------------
// TIPO DE CAMBIO AUTOMÁTICO
// --------------------------------------------

const API_TIPO_CAMBIO = "https://open.er-api.com/v6/latest/USD"
const TIEMPO_MAXIMO_API = 10000

/**
 * Consulta el tipo de cambio PEN/USD en una API pública y lo guarda en
 * Firestore (modo: "auto"). Si el servidor falla, lanza error sin tocar el
 * valor actual; la capa de UI conserva así el valor manual como respaldo.
 */
export async function actualizarTipoCambioAuto(uid) {
    const controlador = new AbortController()
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_API)

    try {
        const respuesta = await fetch(API_TIPO_CAMBIO, { signal: controlador.signal })

        if (!respuesta.ok) {
            throw new Error(`La API respondió ${respuesta.status}`)
        }

        const datos = await respuesta.json()
        const penUSD = datos?.result === "success" ? Number(datos.rates?.PEN) : null
        const eurUSD = datos?.result === "success" ? Number(datos.rates?.EUR) : null

        if (!penUSD || penUSD <= 0) {
            throw new Error("La API no devolvió el tipo de cambio PEN")
        }

        await guardarTipoCambio(uid, penUSD, "auto", null, {
            eur_usd: eurUSD > 0 ? eurUSD : undefined
        })
        return penUSD
    } catch (error) {
        console.error("Error actualizando tipo de cambio automático:", error)
        throw error
    } finally {
        clearTimeout(temporizador)
    }
}