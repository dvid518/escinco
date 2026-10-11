export const DIVISAS = {
    PEN: 'pen',
    USD: 'usd',
    USDT: 'usdt',
    EUR: 'eur'
}

export const DIVISAS_LABELS = {
    [DIVISAS.PEN]: 'PEN',
    [DIVISAS.USD]: 'USD',
    [DIVISAS.USDT]: 'USDT',
    [DIVISAS.EUR]: 'EUR'
}

export const DIVISAS_SYMBOLS = {
    [DIVISAS.PEN]: 'S/',
    [DIVISAS.USD]: '$',
    [DIVISAS.USDT]: '₮',
    [DIVISAS.EUR]: '€'
}

export const DIVISAS_DECIMALS = {
    [DIVISAS.PEN]: 2,
    [DIVISAS.USD]: 2,
    [DIVISAS.USDT]: 2,
    [DIVISAS.EUR]: 2
}

// Palabra con la que se nombra por defecto una subcuenta según su divisa
// ("BBVA SOLES", "Efectivo DÓLARES", ...). Se usa para rellenar el nombre de
// una hija cuando el usuario no pone uno.
export const DIVISAS_PALABRAS = {
    [DIVISAS.PEN]: "SOLES",
    [DIVISAS.USD]: "DÓLARES",
    [DIVISAS.USDT]: "USDT",
    [DIVISAS.EUR]: "EUROS"
}

// Orden absoluto de divisas para tabs y selectores.
export const ORDEN_DIVISAS = ["pen", "usd", "eur", "usdt"]

export function compararDivisas(a, b) {
    const ia = ORDEN_DIVISAS.indexOf(String(a || "").toLowerCase())
    const ib = ORDEN_DIVISAS.indexOf(String(b || "").toLowerCase())
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
}
// Criptomonedas reconocidas para el intercambio (cuenta tipo exchange): la
// compra de una de estas dentro de una cuenta exchange crea una subcuenta con
// `moneda` = símbolo. Fuera de esta lista, cualquier símbolo libre también
// puede usarse: el modelo no lo prohíbe.
export const CRIPTOMONEDAS = [
    "BTC", "ETH", "USDT", "USDC", "BUSD", "SOL", "XRP", "BNB",
    "ADA", "DOGE", "DOT", "MATIC", "AVAX", "LINK", "DAI", "TUSD"
]

export const TIPO_CAMBIO_DEFAULT = {
    pen_usd: 3.75,
    eur_usd: 0.92,
    usdt_usd: 1,
    modo: 'manual'
}