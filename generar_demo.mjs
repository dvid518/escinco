// Generador del .dvid de datos de referencia para demo.
// Replica las reglas de firebase/firestore.rules y el comportamiento de
// ImportarServicio.js para producir un archivo que importe con 0 errores.
import { writeFileSync } from "node:fs"

const HOY = "2026-10-01"          // fecha de la demo
const TC = 3.75                    // tipo de cambio PEN/USD de las preferencias
const ANCLA = "efectivo-inicial"   // unica cuenta con ID determinista (firebase/firestore.js:65)

const r2 = n => Math.round(n * 100) / 100
// Acepta "HH:MM" y "HH:MM:SS"; siempre devuelve un ISO que Date.parse entiende.
const iso = (d, h = "10:00:00") => `${d}T${h.length === 5 ? `${h}:00` : h}.000Z`

// ---------------------------------------------------------------- CUENTAS
// saldoInicial es el SALDO VIVO final (MovimientoServicio.js:535-578 nunca
// recalcula el saldo, solo lo actualiza al crear movimientos).
// No se incluye ninguna cuenta tipo "efectivo": si la hubiera, la cuenta
// automatica efectivo-inicial no se crearia y el ancla quedaria colgando.
const cuentas = [
    { id: "cta-corriente", nombre: "Cuenta Corriente", tipo: "debito", moneda: "pen",
      saldoInicial: 8450, estado: "activa", esPatrimonio: true, orden: 1,
      fechaCreacion: iso("2026-06-01", "09:00:00") },
    { id: "cta-ahorros", nombre: "Cuenta de Ahorros", tipo: "debito", moneda: "pen",
      saldoInicial: 12500, estado: "activa", esPatrimonio: true, orden: 2,
      fechaCreacion: iso("2026-06-01", "09:05:00") },
    { id: "cta-dolares", nombre: "Cuenta en Dolares", tipo: "debito", moneda: "usd",
      saldoInicial: 2150, estado: "activa", esPatrimonio: true, orden: 3,
      fechaCreacion: iso("2026-06-01", "09:10:00") },
    { id: "cta-broker", nombre: "Broker", tipo: "broker", moneda: "usd",
      saldoInicial: 3400, estado: "activa", esPatrimonio: true, orden: 4,
      fechaCreacion: iso("2026-06-15", "10:00:00") },
    { id: "cta-exchange", nombre: "Exchange", tipo: "exchange", moneda: "usd",
      saldoInicial: 850, estado: "activa", esPatrimonio: true, orden: 5,
      fechaCreacion: iso("2026-07-01", "11:00:00") },
    { id: "cta-tarjeta", nombre: "Tarjeta de Credito", tipo: "credito", moneda: "pen",
      saldoInicial: 0, deuda: 1500, limite: 5000, diaCorte: 15, diaPago: 5,
      desgravamen: 0.34, umbralAviso: 60, umbralCritico: 85,
      anualidad: 2400, anualidadFecha: "10-15",
      avisoUsoEnviado: false, avisoCriticoEnviado: false,
      estado: "activa", esPatrimonio: true, orden: 6,
      fechaCreacion: iso("2026-06-01", "09:15:00") },
]

// ------------------------------------------------------------------ ACTIVOS
const activos = [
    { id: "a-aapl", nombre: "Apple Inc.", simbolo: "AAPL", tipo: "accion",
      ultimoPrecio: 195, favorito: true, fuente: "manual", apiSimbolo: null,
      ultimaActualizacion: iso(HOY, "08:00:00"), fechaCreacion: iso("2026-07-10", "08:00:00") },
    { id: "a-msft", nombre: "Microsoft Corp.", simbolo: "MSFT", tipo: "accion",
      ultimoPrecio: 420, favorito: false, fuente: "manual", apiSimbolo: null,
      ultimaActualizacion: iso(HOY, "08:00:00"), fechaCreacion: iso("2026-07-10", "08:05:00") },
    { id: "a-spy", nombre: "S&P 500 ETF", simbolo: "SPY", tipo: "etf",
      ultimoPrecio: 445, favorito: true, fuente: "manual", apiSimbolo: null,
      ultimaActualizacion: iso(HOY, "08:00:00"), fechaCreacion: iso("2026-07-12", "08:00:00") },
    { id: "a-btc", nombre: "Bitcoin", simbolo: "BTC", tipo: "crypto",
      ultimoPrecio: 62500, favorito: true, fuente: "manual", apiSimbolo: null,
      ultimaActualizacion: iso(HOY, "08:00:00"), fechaCreacion: iso("2026-08-01", "08:00:00") },
    { id: "a-tlt", nombre: "Treasury Bond ETF", simbolo: "TLT", tipo: "bono",
      ultimoPrecio: 92.5, favorito: false, fuente: "manual", apiSimbolo: null,
      ultimaActualizacion: iso(HOY, "08:00:00"), fechaCreacion: iso("2026-08-15", "08:00:00") },
]

// --------------------------------------------------------------- POSICIONES
const posiciones = [
    { id: "p-aapl", activoSimbolo: "AAPL", cantidad: 3, divisa: "usd", precioPromedio: 181,
      ultimaActualizacion: iso(HOY, "08:10:00") },
    { id: "p-spy", activoSimbolo: "SPY", cantidad: 3, divisa: "usd", precioPromedio: 440.67,
      ultimaActualizacion: iso(HOY, "08:10:00") },
    { id: "p-btc", activoSimbolo: "BTC", cantidad: 0.008, divisa: "usd", precioPromedio: 60750,
      ultimaActualizacion: iso(HOY, "08:10:00") },
    { id: "p-tlt", activoSimbolo: "TLT", cantidad: 10, divisa: "usd", precioPromedio: 91.2,
      ultimaActualizacion: iso(HOY, "08:10:00") },
]

// --------------------------------------------------------------- MOVIMIENTOS
// Todos apuntan al ANCLA, que es el unico ID de cuenta que existe con certeza
// en una cuenta nueva. Si apuntaran a los ids del archivo, addDoc les asignaria
// ids aleatorios y la app mostraria "Cuenta eliminada".
// Se evitan: tipo "error" (necesita el campo "operacion", prohibido por hasOnly),
// tipo "trade" (no existe en el catalogo y rompe el modal de detalle),
// "compraTarjeta"/"pagoTarjeta" (exigen el id real de la tarjeta) y el prefijo
// "Aporte a meta: " en el concepto (tiene efecto secundario sobre las metas).
const M = (f, hora, tipo, campos) => ({
    tipo, cuenta: ANCLA,
    fechaRealizacion: f, fechaRegistro: iso(f, hora), ...campos,
})

const PLAN = [
    // --- septiembre ---
    ["2026-09-01", "08:15", "ingreso",      { monto: 3500, divisa: "pen", concepto: "Sueldo" }],
    ["2026-09-01", "09:10", "gasto",        { monto: 1400, divisa: "pen", concepto: "Alquiler" }],
    ["2026-09-02", "10:25", "gasto",        { monto: 185, divisa: "pen", concepto: "Supermercado" }],
    ["2026-09-03", "12:35", "gasto",        { monto: 45, divisa: "pen", concepto: "Transporte" }],
    ["2026-09-04", "11:05", "gasto",        { monto: 210, divisa: "pen", concepto: "Supermercado" }],
    ["2026-09-04", "13:50", "gasto",        { monto: 78, divisa: "pen", concepto: "Restaurante" }],
    ["2026-09-05", "09:45", "gasto",        { monto: 265, divisa: "pen", concepto: "Servicios del hogar" }],
    ["2026-09-06", "18:10", "gasto",        { monto: 62, divisa: "pen", concepto: "Farmacia" }],
    ["2026-09-07", "10:50", "gasto",        { monto: 240, divisa: "pen", concepto: "Supermercado" }],
    ["2026-09-08", "08:30", "gasto",        { monto: 38, divisa: "pen", concepto: "Transporte" }],
    ["2026-09-08", "19:15", "gasto",        { monto: 25, divisa: "pen", concepto: "Estacionamiento" }],
    ["2026-09-09", "09:20", "gasto",        { monto: 34, divisa: "pen", concepto: "Cafes y panaderia" }],
    ["2026-09-10", "13:50", "gasto",        { monto: 95, divisa: "pen", concepto: "Restaurante" }],
    ["2026-09-10", "17:20", "ingreso",      { monto: 180, divisa: "pen", concepto: "Venta de articulo" }],
    ["2026-09-11", "10:15", "gasto",        { monto: 195, divisa: "pen", concepto: "Supermercado" }],
    ["2026-09-12", "20:30", "gasto",        { monto: 72, divisa: "pen", concepto: "Suscripciones" }],
    ["2026-09-13", "11:00", "gasto",        { monto: 225, divisa: "pen", concepto: "Supermercado" }],
    ["2026-09-14", "18:10", "gasto",        { monto: 48, divisa: "pen", concepto: "Farmacia" }],
    ["2026-09-15", "14:30", "ingreso",      { monto: 1400, divisa: "pen", concepto: "Trabajo freelance" }],
    ["2026-09-16", "15:15", "gasto",        { monto: 260, divisa: "pen", concepto: "Cursos" }],
    ["2026-09-16", "12:35", "gasto",        { monto: 52, divisa: "pen", concepto: "Transporte" }],
    ["2026-09-17", "13:50", "gasto",        { monto: 68, divisa: "pen", concepto: "Restaurante" }],
    ["2026-09-18", "10:00", "compraActivo", { activo: "MSFT", cantidad: 2, precio: 405, comision: 1, divisa: "usd" }],
    ["2026-09-19", "10:40", "gasto",        { monto: 255, divisa: "pen", concepto: "Supermercado" }],
    ["2026-09-20", "10:30", "gasto",        { monto: 190, divisa: "pen", concepto: "Supermercado" }],
    ["2026-09-21", "09:45", "gasto",        { monto: 240, divisa: "pen", concepto: "Servicios del hogar" }],
    ["2026-09-21", "21:40", "p2pVenta",     { activo: "BTC", cantidad: 0.001, precio: 61800, exchange: "Exchange P2P", nombreComprador: "Comprador Demo", divisa: "usd" }],
    ["2026-09-22", "15:45", "ventaActivo",  { activo: "AAPL", cantidad: 1, precio: 190, comision: 1, divisa: "usd" }],
    ["2026-09-23", "12:35", "gasto",        { monto: 44, divisa: "pen", concepto: "Transporte" }],
    ["2026-09-24", "13:50", "gasto",        { monto: 110, divisa: "pen", concepto: "Restaurante" }],
    ["2026-09-24", "16:05", "ingreso",      { monto: 120, divisa: "pen", concepto: "Reembolso" }],
    ["2026-09-25", "10:20", "gasto",        { monto: 205, divisa: "pen", concepto: "Supermercado" }],
    ["2026-09-26", "18:00", "gasto",        { monto: 180, divisa: "pen", concepto: "Ropa" }],
    ["2026-09-27", "10:35", "gasto",        { monto: 230, divisa: "pen", concepto: "Supermercado" }],
    ["2026-09-28", "18:10", "gasto",        { monto: 55, divisa: "pen", concepto: "Farmacia" }],
    ["2026-09-29", "10:00", "compraActivo", { activo: "SPY", cantidad: 1, precio: 438, comision: 1, divisa: "usd" }],
    ["2026-09-30", "09:45", "gasto",        { monto: 255, divisa: "pen", concepto: "Servicios del hogar" }],
    ["2026-09-30", "21:05", "p2pCompra",    { activo: "BTC", cantidad: 0.002, precio: 61500, exchange: "Exchange P2P", nombreVendedor: "Vendedor Demo", divisa: "usd" }],

    // --- octubre (mes en curso: alimenta las cards de flujo/ahorro/balance) ---
    ["2026-10-01", "08:15", "ingreso",      { monto: 3500, divisa: "pen", concepto: "Sueldo" }],
    ["2026-10-01", "09:10", "gasto",        { monto: 1400, divisa: "pen", concepto: "Alquiler" }],
    ["2026-10-01", "09:45", "gasto",        { monto: 280, divisa: "pen", concepto: "Servicios del hogar" }],
    ["2026-10-01", "10:15", "gasto",        { monto: 190, divisa: "pen", concepto: "Supermercado" }],
    ["2026-10-01", "10:00", "compraActivo", { activo: "AAPL", cantidad: 2, precio: 188, comision: 1, divisa: "usd" }],
    ["2026-10-01", "10:05", "compraActivo", { activo: "SPY", cantidad: 1, precio: 441, comision: 1, divisa: "usd" }],
    ["2026-10-01", "14:30", "ingreso",      { monto: 850, divisa: "pen", concepto: "Trabajo freelance" }],
    ["2026-10-01", "15:45", "ventaActivo",  { activo: "AAPL", cantidad: 1, precio: 193, comision: 1, divisa: "usd" }],
    ["2026-10-01", "21:05", "p2pCompra",    { activo: "BTC", cantidad: 0.002, precio: 62000, exchange: "Exchange P2P", nombreVendedor: "Vendedor Demo", divisa: "usd" }],
    ["2026-10-01", "21:40", "p2pVenta",     { activo: "BTC", cantidad: 0.001, precio: 62800, exchange: "Exchange P2P", nombreComprador: "Comprador Demo", divisa: "usd" }],
]

const movimientos = PLAN.map(([f, hora, tipo, campos], i) => ({
    ...M(f, hora, tipo, campos), id: `mov-${String(i + 1).padStart(3, "0")}`,
}))

// ---------------------------------------------------------------- PENDIENTES
const pendientes = [
    { id: "pen-1", concepto: "Cobro a cliente", tipo: true, monto: 850, divisa: "pen",
      fechaRegistro: iso("2026-09-28", "09:00:00"), fechaVencimiento: iso("2026-10-10", "00:00:00"),
      fechaConsolidacion: null, pendiente: true },
    { id: "pen-2", concepto: "Pago de servicio", tipo: false, monto: 320, divisa: "pen",
      fechaRegistro: iso("2026-09-30", "09:00:00"), fechaVencimiento: iso("2026-10-05", "00:00:00"),
      fechaConsolidacion: null, pendiente: true },
    { id: "pen-3", concepto: "Cobro ya recibido", tipo: true, monto: 500, divisa: "pen",
      fechaRegistro: iso("2026-09-20", "09:00:00"), fechaVencimiento: iso("2026-09-25", "00:00:00"),
      fechaConsolidacion: iso("2026-09-25", "10:00:00"), pendiente: false },
]

// ------------------------------------------------------------------- TRADES
const trades = [
    { id: "trd-1", activo: "MSFT", cuenta: ANCLA, entrada: 410, salida: 420, lotaje: 2,
      sl: 400, tp: 425, tipo: "long", estado: "cerrado", divisa: "usd",
      nota: "Operacion cerrada en objetivo", ordenId: null,
      fechaRegistro: iso("2026-09-18", "14:00:00"), fechaCierre: iso("2026-09-22", "18:00:00") },
    { id: "trd-2", activo: "BTC", cuenta: ANCLA, entrada: 60000, salida: null, lotaje: 0.01,
      sl: 57000, tp: 66000, tipo: "long", estado: "abierto", divisa: "usd",
      nota: "Posicion abierta con stop definido", ordenId: null,
      fechaRegistro: iso("2026-09-30", "15:00:00"), fechaCierre: null },
]

// ------------------------------------------------------------------ ORDENES
// Precios de disparo chosen para que NO se disparen al entrar a /trading:
//   limite+long  -> dispara si precio <= disparo ; 195 <= 175 = false
//   stop+short   -> dispara si precio <= disparo ; 445 <= 430 = false
const ordenes = [
    { id: "ord-1", activo: "AAPL", cuenta: ANCLA, tipoOrden: "limite", direccion: "long",
      precioDisparo: 175, lotaje: 2, sl: 170, tp: 195, divisa: "usd",
      nota: "Compra al soporte", estado: "pendiente", tradeId: null,
      precioEjecucion: null, fechaCreacion: iso("2026-09-27", "10:00:00"), fechaEjecucion: null },
    { id: "ord-2", activo: "SPY", cuenta: ANCLA, tipoOrden: "stop", direccion: "short",
      precioDisparo: 430, lotaje: 1, sl: 445, tp: 405, divisa: "usd",
      nota: "Venta si rompe el soporte", estado: "pendiente", tradeId: null,
      precioEjecucion: null, fechaCreacion: iso("2026-09-29", "10:00:00"), fechaEjecucion: null },
]

// --------------------------------------------------------------- ESTRATEGIAS
// proximaEjecucion siempre en el FUTURO respecto a HOY, para no disparar la
// alerta de estrategia atrasada (dashboard.js:1731-1736).
const estrategias = [
    { id: "est-1", nombre: "DCA mensual BTC", activoSimbolo: "BTC", cuentaId: ANCLA,
      montoFijo: 150, divisa: "usd", frecuencia: "mensual", diaPreferido: 5,
      proximaEjecucion: iso("2026-11-05", "05:00:00"), ultimaEjecucion: iso("2026-09-05", "05:00:00"),
      activa: true, fechaCreacion: iso("2026-09-05", "10:00:00") },
    { id: "est-2", nombre: "DCA semanal SPY", activoSimbolo: "SPY", cuentaId: ANCLA,
      montoFijo: 100, divisa: "usd", frecuencia: "semanal", diaPreferido: 1,
      proximaEjecucion: iso("2026-10-06", "05:00:00"), ultimaEjecucion: iso("2026-09-29", "05:00:00"),
      activa: true, fechaCreacion: iso("2026-08-29", "10:00:00") },
]

// -------------------------------------------------------------------- METAS
const metas = [
    { id: "met-1", nombre: "Fondo de emergencia", montoObjetivo: 15000, montoActual: 7200,
      divisa: "pen", fechaLimite: iso("2027-06-30", "05:00:00"), activa: true,
      icono: "landmark", fechaCreacion: iso("2026-07-01", "10:00:00") },
    { id: "met-2", nombre: "Viaje", montoObjetivo: 8000, montoActual: 2650,
      divisa: "pen", fechaLimite: iso("2027-01-31", "05:00:00"), activa: true,
      icono: "trending-up", fechaCreacion: iso("2026-07-15", "10:00:00") },
    { id: "met-3", nombre: "Equipo nuevo", montoObjetivo: 4500, montoActual: 4500,
      divisa: "pen", fechaLimite: null, activa: true,
      icono: "wallet", fechaCreacion: iso("2026-08-01", "10:00:00") },
]

// ---------------------------------------------------------------- HISTORIAL
// SIN campo "id": ImportarServicio.js:388 no lo desestructura y hasOnly de
// historial (rules:487-489) no lo permite -> rechazaba el documento entero.
const DIAS_HIST = ["2026-09-18","2026-09-19","2026-09-20","2026-09-21","2026-09-22",
                   "2026-09-23","2026-09-24","2026-09-25","2026-09-26","2026-09-27",
                   "2026-09-28","2026-09-29","2026-09-30","2026-10-01"]
const series = {
    AAPL: [186, 187.5, 188.2, 187.9, 189.4, 190.1, 191.3, 190.8, 192, 193, 192.6, 194, 194.4, 195],
    SPY:  [438, 439.2, 440.1, 439.8, 441.2, 442, 443.1, 442.7, 443.5, 444, 443.8, 444.6, 444.9, 445],
    BTC:  [60200, 60500, 60900, 60750, 61200, 61500, 61800, 61600, 62000, 62200, 62100, 62350, 62400, 62500],
    TLT:  [91.8, 91.7, 91.9, 91.6, 91.5, 91.8, 92, 91.9, 92.1, 92.2, 92.1, 92.4, 92.3, 92.5],
}
const historial = Object.entries(series).map(([simbolo, precios]) => ({
    activoSimbolo: simbolo,
    registros: DIAS_HIST.map((f, i) => ({
        fecha: f,
        precio: precios[i],
        cerrado: f < HOY,
        actualizacion: iso(f, "22:00:00"),
    })),
}))

// --------------------------------------------------------------- SNAPSHOTS
// Replica calcularPatrimonio (SnapshotServicio.js:17-68) a partir de las
// cuentas de arriba: efectivo-inicial (automatico, 0) + las 5 del archivo,
// menos la deuda de la tarjeta.
function patrimonioFinal() {
    let pen = 0
    for (const c of cuentas) {
        if (c.estado === "archivada" || c.esPatrimonio === false) continue
        if (c.tipo === "credito") { pen -= c.deuda || 0; continue }
        pen += c.moneda === "usd" ? c.saldoInicial * TC : c.saldoInicial
    }
    return r2(pen)
}
const PATRIMONIO_HOY = patrimonioFinal()

// Serie de 30 dias que termina EXACTAMENTE en el patrimonio real de hoy, para
// que el snapshot que el dashboard escribe al abrir no genere un salto.
const DIAS_SNAP = 30
function seriePatrimonio() {
    const fechas = []
    const d = new Date(`${HOY}T12:00:00Z`)
    for (let i = DIAS_SNAP - 1; i >= 0; i--) {
        const f = new Date(d); f.setUTCDate(f.getUTCDate() - i)
        fechas.push(f.toISOString().slice(0, 10))
    }
    // LCG determinista para una variacion estable y realista
    let seed = 20261001
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const inicio = PATRIMONIO_HOY * 0.905
    const paso = (PATRIMONIO_HOY - inicio) / (DIAS_SNAP - 1)
    return fechas.map((f, i) => {
        const base = inicio + paso * i
        const ruido = i === DIAS_SNAP - 1 ? 0 : (rnd() - 0.5) * (PATRIMONIO_HOY * 0.012)
        return r2(Math.max(1000, base + ruido))
    })
}
const seriePEN = seriePatrimonio()
const snapshots = seriePEN.map((pen, i) => ({
    fecha: seriePEN.length ? new Date(Date.parse(`${HOY}T12:00:00Z`) - (DIAS_SNAP - 1 - i) * 86400000).toISOString().slice(0, 10) : HOY,
    patrimonioPEN: pen,
    patrimonioUSD: r2(pen / TC),
    patrimonioUSDT: r2(pen / TC),
    cerrado: i < DIAS_SNAP - 1,
    actualizacion: iso(seriePEN[i] ? new Date(Date.parse(`${HOY}T12:00:00Z`) - (DIAS_SNAP - 1 - i) * 86400000).toISOString().slice(0, 10) : HOY, "23:00:00"),
}))

// ------------------------------------------------------------ PREFERENCIAS
const CARDS = ["cuentas","inversiones","vencimientos","movimientos","favoritos","metas",
    "pendientes","ordenes","estrategias","flujo-caja","gastos-periodo","ingresos-periodo",
    "balance-periodo","deudas","ahorro","distribucion","distribucion-activos",
    "patrimonio-divisa","programados","alertas","grafico"]

const preferencias = {
    tema: "dark",
    divisaPrincipal: "pen",
    formatoDivisa: "simbolo",
    tipoCambio: { pen_usd: TC, modo: "manual", actualizacion: iso(HOY, "07:00:00") },
    periodoEvolucion: "30d",
    periodoFlujo: "30d",
    movimientosRecientes: 8,
    resaltarPatrimonio: 1,
    paginas: { dashboard: true, cuentas: true, movimientos: true, inversiones: true, trading: true, configuracion: true },
    seg: { inactividadMinutos: 15, cerrarAlCerrarPestana: true },
    accesibilidad: {
        modalesPersistentes: false, doodles: true, unClickSeleccion: false,
        lateralidadCuentaInfo: "derecha", resaltarIngresoGasto: true,
    },
    tiposMovimiento: {
        cambioDivisa: true, compraActivo: true, ventaActivo: true,
        pagoTarjeta: true, p2pCompra: true, p2pVenta: true, trade: true,
    },
    dashboard: {
        orden: [...CARDS],
        cardsVisibles: [...CARDS],
        nuevasCardsV1: true, nuevasCardsV2: true, nuevasCardsV3: true,
    },
}

// ------------------------------------------------------------------ ENSAMBLE
const salida = {
    formato: "escinco",
    version: "4.1.0",
    fechaExportacion: iso(HOY, "12:00:00"),
    uid: "demo-referencia",
    cuentas, movimientos, activos, pendientes, posiciones, trades,
    ordenes, estrategias, metas, historial, snapshots, preferencias,
}

const ruta = process.argv[2]
writeFileSync(ruta, JSON.stringify(salida, null, 2), "utf8")
console.log(`Escrito: ${ruta}`)
console.log(`Patrimonio final calculado: PEN ${PATRIMONIO_HOY} | USD ${r2(PATRIMONIO_HOY / TC)} | USDT ${r2(PATRIMONIO_HOY / TC)}`)
console.log(`Snapshots: ${snapshots.length} (${snapshots[0].fecha} -> ${snapshots.at(-1).fecha})`)
console.log(`Ultimo snapshot == patrimonio real: ${snapshots.at(-1).patrimonioPEN === PATRIMONIO_HOY}`)
console.log(`Totales -> cuentas:${cuentas.length} mov:${movimientos.length} activos:${activos.length} pos:${posiciones.length} pend:${pendientes.length} trades:${trades.length} ord:${ordenes.length} est:${estrategias.length} metas:${metas.length} hist:${historial.reduce((a, h) => a + h.registros.length, 0)} snap:${snapshots.length}`)
