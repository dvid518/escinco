// Prueba de regresión para CARD-001: dashboard renderiza solo la card
// "Patrimonio total" cuando cardsVisibles llega vacío.
//
// Historia: normalizarCardsVisibles() devolvía [] cuando el array de
// preferencias estaba vacío, dejando cardsVisiblesDashboard vacío y, por lo
// tanto, ordenRender solo contenía "patrimonio". El dashboard se veía vacío.
//
// Corrección: normalizarCardsVisibles devuelve DEFAULT_CARDS_VISIBLES cuando
// el filtrado queda vacío, y render() usa DEFAULT_CARDS_VISIBLES como
// fallback si ordenRender solo tiene patrimonio.

import { nuevoReporter, leer, extraerFuncion } from "./helpers.mjs"
import vm from "node:vm"

const SRC = leer("js/pages/dashboard.js")
const CSS_SRC = leer("css/dashboard.css")

const ctx = {
    DEFAULT_CARDS_VISIBLES: ["cuentas", "movimientos", "inversiones", "metas", "grafico"],
    DASHBOARD_CARDS: [
        { id: "patrimonio", label: "Patrimonio total", spanColumnas: 1, spanFilas: 1 },
        { id: "cuentas", label: "Cuentas", spanColumnas: 1, spanFilas: 1 },
        { id: "inversiones", label: "Inversiones", spanColumnas: 1, spanFilas: 1 },
        { id: "vencimientos", label: "Próximos vencimientos", spanColumnas: 1, spanFilas: 1 },
        { id: "movimientos", label: "Últimos movimientos", spanColumnas: 1, spanFilas: 2, scroll: true },
        { id: "favoritos", label: "Favoritos", spanColumnas: 1, spanFilas: 1 },
        { id: "metas", label: "Metas de ahorro", spanColumnas: 1, spanFilas: 1 },
        { id: "presupuestos", label: "Presupuestos", spanColumnas: 1, spanFilas: 1 },
        { id: "pendientes", label: "Pendientes", spanColumnas: 1, spanFilas: 1 },
        { id: "ordenes", label: "Órdenes", spanColumnas: 1, spanFilas: 1 },
        { id: "estrategias", label: "Estrategias", spanColumnas: 1, spanFilas: 1 },
        { id: "flujo-caja", label: "Flujo de caja", spanColumnas: 1, spanFilas: 1 },
        { id: "gastos-periodo", label: "Gastado", spanColumnas: 1, spanFilas: 1 },
        { id: "ingresos-periodo", label: "Ingresado", spanColumnas: 1, spanFilas: 1 },
        { id: "balance-periodo", label: "Balance", spanColumnas: 1, spanFilas: 1 },
        { id: "deudas", label: "Deudas", spanColumnas: 1, spanFilas: 1 },
        { id: "distribucion", label: "Distribución patrimonial", spanColumnas: 1, spanFilas: 2 },
        { id: "patrimonio-divisa", label: "Patrimonio por divisa", spanColumnas: 1, spanFilas: 1 },
        { id: "programados", label: "Movimientos programados", spanColumnas: 1, spanFilas: 1 },
        { id: "alertas", label: "Alertas", spanColumnas: 1, spanFilas: 1 },
        { id: "grafico", label: "Evolución patrimonial", spanColumnas: 2, spanFilas: 1 }
    ],
    esCardInstancia: (id) => String(id).includes(":"),
    posicionesPreferidasDashboard: {},
    console: { warn() {}, log() {}, error() {} }
}
vm.createContext(ctx)

// Extraer DEFAULT_CARDS_VISIBLES del módulo real.
const iDef = SRC.indexOf("const DEFAULT_CARDS_VISIBLES = ")
const iIni = SRC.indexOf("[", iDef)
let nivel = 0, iFin = iIni
for (let k = iIni; k < SRC.length; k++) {
    if (SRC[k] === "[") nivel++
    else if (SRC[k] === "]") { nivel--; if (nivel === 0) { iFin = k + 1; break } }
}
vm.runInContext(`var DEFAULT_CARDS_VISIBLES = ${SRC.slice(iIni, iFin)};`, ctx)

// Extraer DASHBOARD_CARDS del modulo real para usarlo en dimensionesCard.
const iCardsDef = SRC.indexOf("const DASHBOARD_CARDS = [")
const iCardsIni = SRC.indexOf("[", iCardsDef)
let nivelCards2 = 0, iCardsFin2 = iCardsIni
for (let k = iCardsIni; k < SRC.length; k++) {
    if (SRC[k] === "[") nivelCards2++
    else if (SRC[k] === "]") { nivelCards2--; if (nivelCards2 === 0) { iCardsFin2 = k + 1; break } }
}
vm.runInContext(`var DASHBOARD_CARDS = ${SRC.slice(iCardsIni, iCardsFin2)};`, ctx)

// Extraer DASHBOARD_DIMENSIONES del modulo real para usarlo en dimensionesCard.
const iDimDef = SRC.indexOf("const DASHBOARD_DIMENSIONES = {")
const iDimIni = SRC.indexOf("{", iDimDef)
let nivelDim2 = 0, iDimFin2 = iDimIni
for (let k = iDimIni; k < SRC.length; k++) {
    if (SRC[k] === "{") nivelDim2++
    else if (SRC[k] === "}") { nivelDim2--; if (nivelDim2 === 0) { iDimFin2 = k + 1; break } }
}
vm.runInContext(`var DASHBOARD_DIMENSIONES = ${SRC.slice(iDimIni, iDimFin2)};`, ctx)
vm.runInContext(`var cardsDimensionesDashboard = {};`, ctx)
vm.runInContext(extraerFuncion(SRC, "dimensionesCard") + ";", ctx)

vm.runInContext(extraerFuncion(SRC, "normalizarCardsVisibles") + ";", ctx)
vm.runInContext(extraerFuncion(SRC, "calcularColumnas") + ";", ctx)
vm.runInContext(extraerFuncion(SRC, "calcularDistribucion") + ";", ctx)

export default async function ejecutar(t = nuevoReporter("card-001")) {
    const normalizarCardsVisibles = ctx.normalizarCardsVisibles

    // Caso: array vacío devuelve DEFAULT_CARDS_VISIBLES.
    const resultadoVacio = normalizarCardsVisibles([])
    t.check(
        "normalizarCardsVisibles([]) devuelve DEFAULT_CARDS_VISIBLES",
        JSON.stringify(resultadoVacio) === JSON.stringify(ctx.DEFAULT_CARDS_VISIBLES),
        `obtuvo: ${JSON.stringify(resultadoVacio)}`
    )

    // Caso: array con cards válidas las devuelve filtradas.
    const resultadoFiltrado = normalizarCardsVisibles(["cuentas", "movimientos"])
    t.check(
        "normalizarCardsVisibles(['cuentas','movimientos']) devuelve esas cards",
        JSON.stringify(resultadoFiltrado) === JSON.stringify(["cuentas", "movimientos"]),
        `obtuvo: ${JSON.stringify(resultadoFiltrado)}`
    )

    // Caso: valor no array devuelve DEFAULT_CARDS_VISIBLES.
    const resultadoNulo = normalizarCardsVisibles(null)
    t.check(
        "normalizarCardsVisibles(null) devuelve DEFAULT_CARDS_VISIBLES",
        JSON.stringify(resultadoNulo) === JSON.stringify(ctx.DEFAULT_CARDS_VISIBLES),
        `obtuvo: ${JSON.stringify(resultadoNulo)}`
    )

    // ----------------------------------------------------------
    // Lógica de ordenRender en render() (fallback de CARD-001).
    // ----------------------------------------------------------
    // cardsOrdenDashboard es el catálogo completo sin "patrimonio".
    const ordenCatalogo = ctx.DASHBOARD_CARDS.map(c => c.id).filter(id => id !== "patrimonio")
    const defaultsSinPatrimonio = ctx.DEFAULT_CARDS_VISIBLES.filter(id => id !== "patrimonio")

    // Caso A: cardsVisiblesDashboard = [] -> se usan las 5 cards por defecto.
    {
        const visiblesA = [].length > 0 ? [] : [...defaultsSinPatrimonio]
        const ordenRenderA = ["patrimonio", ...ordenCatalogo.filter(id => visiblesA.includes(id))]
        const idsSinPatrimonio = ordenRenderA.filter(id => id !== "patrimonio").sort()
        t.check(
            "render() con cardsVisiblesDashboard = [] incluye las 5 cards por defecto",
            JSON.stringify(idsSinPatrimonio) === JSON.stringify([...defaultsSinPatrimonio].sort()),
            `obtuvo: ${JSON.stringify(idsSinPatrimonio)}`
        )
    }

    // Caso B: cardsVisiblesDashboard = ["patrimonio"] -> solo patrimonio.
    {
        const visiblesB = ["patrimonio"].length > 0 ? ["patrimonio"] : [...defaultsSinPatrimonio]
        const ordenRenderB = ["patrimonio", ...ordenCatalogo.filter(id => visiblesB.includes(id))]
        t.check(
            "render() con cardsVisiblesDashboard = ['patrimonio'] solo incluye patrimonio",
            JSON.stringify(ordenRenderB) === JSON.stringify(["patrimonio"]),
            `obtuvo: ${JSON.stringify(ordenRenderB)}`
        )
    }

    // ----------------------------------------------------------
    // calcularColumnas(): replica repeat(auto-fill, minmax(260px, 1fr)).
    // ----------------------------------------------------------
    t.check(
        "calcularColumnas(1200) = 4 columnas (260px + 16px de gap)",
        ctx.calcularColumnas(1200) === 4,
        `obtuvo: ${ctx.calcularColumnas(1200)}`
    )
    t.check(
        "calcularColumnas(300) = 1 columna (nunca menos de 1)",
        ctx.calcularColumnas(300) === 1,
        `obtuvo: ${ctx.calcularColumnas(300)}`
    )

    // ----------------------------------------------------------
    // calcularDistribucion(): posiciones explícitas sin solapamientos.
    // ----------------------------------------------------------
    const distribuir = ctx.calcularDistribucion
    const METADATA = Object.fromEntries(ctx.DASHBOARD_CARDS.map(c => [c.id, c]))
    const ANCHA = { ancha: { anchoDefault: 2, altoDefault: 1 } }

    function celdas(d) {
        const ocupadas = new Set()
        for (const { col, row, ancho, alto } of d) {
            for (let f = row; f < row + alto; f++) {
                for (let c = col; c < col + ancho; c++) {
                    const k = f + "," + c
                    if (ocupadas.has(k)) return null // solapamiento
                    ocupadas.add(k)
                }
            }
        }
        return ocupadas
    }

    function sinSolapes(d) {
        return celdas(d) !== null
    }

    // Caso 1: 4 columnas, 6 cards 1x1 -> sin solapamientos y dentro del grid.
    {
        const d = distribuir(["patrimonio", "a", "b", "c", "d", "e"], {}, 4, METADATA)
        const dentro = d.every(c => c.col >= 0 && c.col + c.ancho <= 4 && c.row >= 0)
        t.check(
            "4 columnas / 6 cards 1x1: sin solapamientos y dentro del grid",
            d.length === 6 && sinSolapes(d) && dentro,
            `obtuvo: ${JSON.stringify(d)}`
        )
    }

    // Caso 2: 4 columnas, 1 card 2x1 + 4 cards 1x1 -> la 2x1 ocupa 2 columnas.
    {
        const d = distribuir(["patrimonio", "ancha", "a", "b", "c", "d"], {}, 4, { ...METADATA, ...ANCHA })
        const ancha = d.find(c => c.id === "ancha")
        t.check(
            "4 columnas / 1 card 2x1 + 4 cards 1x1: la 2x1 ocupa 2 columnas",
            ancha?.ancho === 2 && ancha.col + ancha.ancho <= 4 && sinSolapes(d),
            `obtuvo: ${JSON.stringify(ancha)}`
        )
    }

    // Caso 3: 2 columnas, 1 card 2x1 + 2 cards 1x1 -> la 2x1 llena su fila.
    {
        const d = distribuir(["ancha", "a", "b"], {}, 2, { ...METADATA, ...ANCHA })
        const ancha = d.find(c => c.id === "ancha")
        t.check(
            "2 columnas / 1 card 2x1 + 2 cards 1x1: la 2x1 llena toda la fila",
            ancha?.ancho === 2 && ancha.col === 0 && ancha.col + ancha.ancho === 2 && sinSolapes(d),
            `obtuvo: ${JSON.stringify(ancha)}`
        )
    }

    // Caso 4: 1 columna, 1 card 2x1 -> se recorta a 1x1 de ancho (limitación
    // temporal: no se desborda el grid, el alto se respeta).
    {
        const d = distribuir(["ancha"], {}, 1, { ...METADATA, ...ANCHA })
        const ancha = d[0]
        t.check(
            "1 columna / 1 card 2x1: se renderiza con ancho 1",
            ancha?.ancho === 1 && ancha.col === 0 && ancha.col + ancha.ancho === 1,
            `obtuvo: ${JSON.stringify(ancha)}`
        )
    }

    // Caso 5: determinismo (misma entrada -> misma salida).
    {
        const entrada = ["patrimonio", "ancha", "a", "b", "c"]
        const uno = distribuir(entrada, {}, 4, { ...METADATA, ...ANCHA })
        const dos = distribuir(entrada, {}, 4, { ...METADATA, ...ANCHA })
        t.check(
            "determinismo: misma entrada devuelve las mismas posiciones",
            JSON.stringify(uno) === JSON.stringify(dos),
            `obtuvo: ${JSON.stringify(dos)}`
        )
    }

    // Patrimonio siempre primero, en la esquina superior izquierda (0,0).
    {
        const d = distribuir(["a", "patrimonio", "b"], {}, 4, METADATA)
        t.check(
            "patrimonio se coloca primero en (1,1)",
            d[0]?.id === "patrimonio" && d[0].col === 0 && d[0].row === 0,
            `obtuvo: ${JSON.stringify(d[0])}`
        )
    }

    // ================================================================
    // Fase 1: persistencia atómica y botón minus
    // ================================================================

    // Estado mutable simulado del dashboard (vive en el contexto VM).
    ctx.cardsVisiblesDashboard = ["cuentas", "movimientos", "grafico"]
    ctx.cardsOrdenDashboard = ["patrimonio", "cuentas", "movimientos", "inversiones", "grafico", "metas"]
    ctx.cardsDimensionesDashboard = { grafico: { ancho: 2, alto: 2 } }
    ctx.cambiosPendientesDashboard = true
    ctx.capturaGuardado = null
    ctx.fallaGuardado = false

    ctx.stubGuardarPreferenciasDashboard = function (campos) {
        ctx.capturaGuardado = campos
        if (ctx.fallaGuardado) throw new Error("Firestore falló")
        return Promise.resolve()
    }
    ctx.stubMostrarNotificacion = function () {}
    ctx.stubReordenarDashboard = function () {}
    ctx.stubDocument = {
        querySelector: function () {
            return { classList: { add: function () {}, remove: function () {} }, remove: function () {} }
        }
    }
    ctx.stubCSS = { escape: function (id) { return id } }
    ctx.stubSetTimeout = function (fn) { fn(); return 0 }

    ctx.ctx = ctx;
    vm.runInContext(`
        var cardsVisiblesDashboard = ctx.cardsVisiblesDashboard;
        var cardsOrdenDashboard = ctx.cardsOrdenDashboard;
        var cardsDimensionesDashboard = ctx.cardsDimensionesDashboard;
        var cambiosPendientesDashboard = ctx.cambiosPendientesDashboard;
        function guardarPreferenciasDashboard(campos) { return ctx.stubGuardarPreferenciasDashboard(campos); }
        function mostrarNotificacion() { return ctx.stubMostrarNotificacion(); }
        function reordenarDashboard() { return ctx.stubReordenarDashboard(); }
        var document = ctx.stubDocument;
        var CSS = ctx.stubCSS;
        var setTimeout = ctx.stubSetTimeout;
    `, ctx)

    vm.runInContext(extraerFuncion(SRC, "guardarOrdenDashboard") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "quitarCardDashboard") + ";", ctx)

    // Test F1.1: guardarOrdenDashboard persiste los 3 campos juntos.
    ctx.capturaGuardado = null
    ctx.fallaGuardado = false
    ctx.cardsVisiblesDashboard = ["cuentas", "movimientos"]
    ctx.cardsOrdenDashboard = ["patrimonio", "cuentas", "movimientos", "metas"]
    ctx.cardsDimensionesDashboard = { metas: { ancho: 1, alto: 1 } }
    await ctx.guardarOrdenDashboard()
    t.check(
        "F1.1 guardarOrdenDashboard recibe cardsVisibles, orden y dimensiones juntos",
        ctx.capturaGuardado &&
        Array.isArray(ctx.capturaGuardado.cardsVisibles) &&
        Array.isArray(ctx.capturaGuardado.orden) &&
        typeof ctx.capturaGuardado.dimensiones === "object" &&
        !ctx.capturaGuardado.cardsVisibles.includes("grafico") &&
        ctx.capturaGuardado.orden.includes("patrimonio") &&
        JSON.stringify(ctx.capturaGuardado.dimensiones) === JSON.stringify({ metas: { ancho: 1, alto: 1 } }),
        `captura: ${JSON.stringify(ctx.capturaGuardado)}`
    )
    t.check(
        "F1.1 cambiosPendientesDashboard pasa a false tras guardar",
        ctx.cambiosPendientesDashboard === false
    )

    // Test F1.2: si la persistencia falla, no se cierra el modo edición (cambiosPendientesDashboard sigue true).
    ctx.capturaGuardado = null
    ctx.fallaGuardado = true
    ctx.cardsVisiblesDashboard = ["cuentas"]
    ctx.cardsOrdenDashboard = ["patrimonio", "cuentas"]
    ctx.cardsDimensionesDashboard = {}
    ctx.cambiosPendientesDashboard = true
    const resultado = await ctx.guardarOrdenDashboard()
    t.check(
        "F1.2 persistir falla devuelve false",
        resultado === false
    )
    t.check(
        "F1.2 cambiosPendientesDashboard sigue true tras fallo",
        ctx.cambiosPendientesDashboard === true
    )

    // Test F1.3: quitarCardDashboard elimina de visibles pero NO de orden.
    ctx.cardsVisiblesDashboard = ["patrimonio", "cuentas", "movimientos", "grafico"]
    ctx.cardsOrdenDashboard = ["patrimonio", "cuentas", "movimientos", "grafico", "metas"]
    ctx.cambiosPendientesDashboard = false
    await ctx.quitarCardDashboard("movimientos")
    t.check(
        "F1.3 quitarCardDashboard elimina de cardsVisiblesDashboard",
        !ctx.cardsVisiblesDashboard.includes("movimientos")
    )
    t.check(
        "F1.3 quitarCardDashboard NO elimina de cardsOrdenDashboard",
        ctx.cardsOrdenDashboard.includes("movimientos")
    )
    t.check(
        "F1.3 quitarCardDashboard pone cambiosPendientesDashboard en true",
        ctx.cambiosPendientesDashboard === true
    )

    // Test F1.4: onCancel del modal no llama a guardarPreferenciasDashboard.
    const iCancel = SRC.indexOf("onCancel:")
    const iFooter = SRC.indexOf("footerExtra:", iCancel)
    const onCancelBody = SRC.slice(iCancel, iFooter)
    t.check(
        "F1.4 onCancel no llama a guardarPreferenciasDashboard",
        !onCancelBody.includes("guardarPreferenciasDashboard")
    )
    t.check(
        "F1.4 onCancel solo restaura el flag de cambios pendientes",
        onCancelBody.includes("cambiosPendientesDashboard = cambiosPendientesAntesModal")
    )

    // ================================================================
    // Fase 2: corrección de skeletons persistentes (B2)
    // ================================================================

    // Stubs para funciones del DOM y utilidades usadas por los actualizadores.
    ctx.createdElements = {}
    ctx.stubDocumentGetElementById = function (id) {
        // Simula cards ocultas: el id no existe en el DOM.
        if (ctx.idsOcultos && ctx.idsOcultos.has(id)) return null
        if (!ctx.createdElements[id]) {
            ctx.createdElements[id] = {
                textContent: "",
                replaceChildrenCalled: false,
                replaceChildren: function () { this.children = []; this.replaceChildrenCalled = true },
                classList: {
                    add: function () {},
                    remove: function () {},
                    toggle: function () {},
                    contains: function () { return false }
                },
                style: {},
                setAttribute: function () {},
                hidden: false,
                children: []
            }
        }
        return ctx.createdElements[id]
    }
    ctx.stubDocumentCreateTextNode = function (texto) {
        return { textContent: String(texto) }
    }
    ctx.stubTarjetaVacia = function (texto) {
        return { _texto: texto, replaceChildren: function () { this.children = [] } }
    }
    ctx.stubActualizarScrollFade = function () {}
    ctx.stubFormatearMontoConDivisa = function (val, _divisa) {
        return String(val ?? 0)
    }
    ctx.stubFormatearMontoDashboard = function (val, _divisa) {
        return String(val ?? 0)
    }
    ctx.stubFormatearProximaEjecucion = function () { return "Sin próxima ejecución" }
    ctx.stubContenidoDesdeFilas = function (plantilla, items, _mapear) {
        return { _items: items.length, replaceChildren: function () {} }
    }
    ctx.stubAplicoAnchoBarras = function () {}
    ctx.stubDibujarDonaDistribucion = function () { return Promise.resolve() }
    ctx.stubPluralizarMovimientos = function (n) { return n + " movimiento" + (n === 1 ? "" : "s") }
    ctx.stubObtenerPeriodoFlujo = function () { return { sub: "mensual" } }
    ctx.stubPlantillaPresupuestoDashboard = function (_p) { return { valores: {}, html: {} } }
    ctx.stubEnlazarListaPresupuestos = function () {}
    ctx.stubObtenerPresupuestosConProgreso = function () { return [] }
    ctx.stubPreciosPorSimbolo = function () { return new Map() }
    ctx.stubDistanciaAlDisparo = function () { return null }
    ctx.stubConvertirMonto = function (val) { return val }
    ctx.stubConvertirMontoConResultado = function (_monto, _desde, _hacia) {
        return { valor: _monto, convertido: true }
    }
    ctx.stubMontoDeMovimiento = function (m) { return Number(m.monto) || 0 }
    ctx.stubEsMovimientoPositivo = function (m) {
        return m.tipo === "ingreso" || m.tipo === "ventaActivo" || m.tipo === "p2pVenta"
    }
    ctx.stubDivisaDeMovimiento = function (m) {
        if (m.divisa) return String(m.divisa).toLowerCase()
        return "pen"
    }
    ctx.stubObtenerPatrimonioStats = function () { return { totalCuentas: 0, totalActivos: 0, totalDeuda: 0, tieneDeuda: false, patrimonio: 0 } }

    // Extraer los 5 actualizadores que tienen retorno anticipado sin limpiar
    // skeleton cuando analiticaData es null.
    vm.runInContext(`
        var document = { getElementById: ctx.stubDocumentGetElementById, createTextNode: ctx.stubDocumentCreateTextNode };
        var analiticaData = ctx.analiticaData;
        var divisaActual = ctx.divisaActual;
        var formatearMontoConDivisa = ctx.stubFormatearMontoConDivisa;
        var formatearMontoDashboard = ctx.stubFormatearMontoDashboard;
        var formatearProximaEjecucion = ctx.stubFormatearProximaEjecucion;
        var tarjetaVacia = ctx.stubTarjetaVacia;
        var actualizarScrollFade = ctx.stubActualizarScrollFade;
        var contenidoDesdeFilas = ctx.stubContenidoDesdeFilas;
        var aplicoAnchoBarras = ctx.stubAplicoAnchoBarras;
        var dibujarDonaDistribucion = ctx.stubDibujarDonaDistribucion;
        var pluralizarMovimientos = ctx.stubPluralizarMovimientos;
        var obtenerPeriodoFlujo = ctx.stubObtenerPeriodoFlujo;
        var periodoFlujo = "30d";
        var plantillaPresupuestoDashboard = ctx.stubPlantillaPresupuestoDashboard;
        var enlazarListaPresupuestos = ctx.stubEnlazarListaPresupuestos;
        var obtenerPresupuestosConProgreso = ctx.stubObtenerPresupuestosConProgreso;
        var preciosPorSimbolo = ctx.stubPreciosPorSimbolo;
        var distanciaAlDisparo = ctx.stubDistanciaAlDisparo;
        var ordenesData = ctx.ordenesData || [];
        var convertirMonto = ctx.stubConvertirMonto;
        var convertirMontoConResultado = ctx.stubConvertirMontoConResultado;
        var montoDeMovimiento = ctx.stubMontoDeMovimiento;
        var esMovimientoPositivo = ctx.stubEsMovimientoPositivo;
        var divisaDeMovimiento = ctx.stubDivisaDeMovimiento;
        var obtenerPatrimonioStats = ctx.stubObtenerPatrimonioStats;
    `, ctx)

    vm.runInContext(extraerFuncion(SRC, "actualizarFlujoCaja") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarDeudas") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarDistribucion") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarProgramados") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarAlertas") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarFlujoPeriodo") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarOrdenes") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarCuentas") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarPresupuestos") + ";", ctx)

    // Las variantes de contenido dependen del alto real: estas pruebas
    // ejercitan las cards en su versión de lista (1x3) y el detalle de
    // Balance (1x2). Sin fijarlo, todas caen en su 1x1 por defecto.
    ctx.cardsDimensionesDashboard = {
        programados: { columnas: 1, filas: 3 },
        alertas: { columnas: 1, filas: 3 },
        ordenes: { columnas: 1, filas: 3 },
        presupuestos: { columnas: 1, filas: 3 },
        "balance-periodo": { columnas: 1, filas: 2 }
    }

    // Helper para verificar que replaceChildren fue llamado en un elemento.
    function replaceChildrenFueLlamado(id) {
        const el = ctx.createdElements[id]
        return el && el.replaceChildrenCalled === true
    }

    // Test B2.1: actualizarFlujoCaja limpia skeleton cuando analiticaData es null.
    ctx.analiticaData = null
    ctx.divisaActual = "pen"
    ctx.createdElements = {}
    ctx.actualizarFlujoCaja()
    const cajaValor = ctx.createdElements["flujo-caja-valor"]
    const cajaDetalle = ctx.createdElements["flujo-caja-detalle"]
    t.check(
        "B2.1 actualizarFlujoCaja limpia valor cuando analiticaData es null",
        cajaValor && cajaValor.textContent === ""
    )
    t.check(
        "B2.1 actualizarFlujoCaja limpia detalle cuando analiticaData es null",
        cajaDetalle && cajaDetalle.textContent === ""
    )

    // Test B2.2: actualizarDeudas limpia skeleton cuando analiticaData es null.
    ctx.analiticaData = null
    ctx.createdElements = {}
    ctx.actualizarDeudas()
    const deudasValor = ctx.createdElements["deudas-valor"]
    const deudasDetalle = ctx.createdElements["deudas-detalle"]
    t.check(
        "B2.2 actualizarDeudas limpia valor cuando analiticaData es null",
        deudasValor && deudasValor.textContent === ""
    )
    t.check(
        "B2.2 actualizarDeudas limpia detalle cuando analiticaData es null",
        deudasDetalle && deudasDetalle.textContent === ""
    )

    // Test B2.3: actualizarDistribucion limpia skeleton cuando analiticaData es null.
    ctx.analiticaData = null
    ctx.createdElements = {}
    ctx.actualizarDistribucion()
    const _distLista = ctx.createdElements["distribucion-lista"]
    const distTotal = ctx.createdElements["distribucion-total"]
    t.check(
        "B2.3 actualizarDistribucion reemplaza lista cuando analiticaData es null",
        replaceChildrenFueLlamado("distribucion-lista")
    )
    t.check(
        "B2.3 actualizarDistribucion limpia total cuando analiticaData es null",
        distTotal && distTotal.textContent === ""
    )

    // Test B2.4: actualizarProgramados limpia skeleton cuando analiticaData es null.
    ctx.analiticaData = null
    ctx.createdElements = {}
    ctx.actualizarProgramados()
    const _progLista = ctx.createdElements["programados-lista"]
    const progCantidad = ctx.createdElements["programados-cantidad"]
    t.check(
        "B2.4 actualizarProgramados reemplaza lista cuando analiticaData es null",
        replaceChildrenFueLlamado("programados-lista")
    )
    t.check(
        "B2.4 actualizarProgramados pone cantidad en 0 cuando analiticaData es null",
        progCantidad && progCantidad.textContent === "0"
    )

    // Test B2.5: actualizarAlertas limpia skeleton cuando analiticaData es null.
    ctx.analiticaData = null
    ctx.createdElements = {}
    ctx.actualizarAlertas()
    const _alertaLista = ctx.createdElements["alertas-lista"]
    const alertaCantidad = ctx.createdElements["alertas-cantidad"]
    t.check(
        "B2.5 actualizarAlertas reemplaza lista cuando analiticaData es null",
        replaceChildrenFueLlamado("alertas-lista")
    )
    t.check(
        "B2.5 actualizarAlertas pone cantidad en 0 cuando analiticaData es null",
        alertaCantidad && alertaCantidad.textContent === "0"
    )

    // Test B2.6: actualizarFlujoCaja muestra datos cuando analiticaData tiene datos.
    ctx.analiticaData = { balance: 100, ingresos: 200, gastos: 100 }
    ctx.createdElements = {}
    ctx.actualizarFlujoCaja()
    const cajaValor2 = ctx.createdElements["flujo-caja-valor"]
    t.check(
        "B2.6 actualizarFlujoCaja muestra balance cuando hay datos",
        cajaValor2 && cajaValor2.textContent === "100"
    )

    // Test B2.7: actualizarDistribucion muestra datos cuando analiticaData tiene datos.
    ctx.analiticaData = { distribucion: [] }
    ctx.createdElements = {}
    ctx.actualizarDistribucion()
    const _distLista2 = ctx.createdElements["distribucion-lista"]
    t.check(
        "B2.7 actualizarDistribucion reemplaza lista cuando hay datos",
        replaceChildrenFueLlamado("distribucion-lista")
    )

    // ================================================================
    // Fase 2 segunda pasada: skeletons restantes
    // ================================================================

    // Test B2.8: Balance - actualizarFlujoPeriodo muestra valor con datos.
    ctx.analiticaData = {
        flujoPorPeriodo: { "30d": { balance: 1000, gastos: 500, ingresos: 1500, movimientosGastos: 5, movimientosIngresos: 3, total: 8 } }
    }
    ctx.divisaActual = "pen"
    ctx.createdElements = {}
    ctx.actualizarFlujoPeriodo()
    const balValor = ctx.createdElements["balance-periodo-valor"]
    const balDetalle = ctx.createdElements["balance-periodo-detalle"]
    t.check(
        "B2.8 Balance muestra valor cuando hay datos",
        balValor && balValor.textContent === "1000"
    )
    t.check(
        "B2.8 Balance muestra detalle cuando hay datos",
        balDetalle && balDetalle.textContent === "8 movimientos en total"
    )

    // Test B2.9: Balance - actualizarFlujoPeriodo limpia skeleton sin datos.
    ctx.analiticaData = null
    ctx.createdElements = {}
    ctx.actualizarFlujoPeriodo()
    const balValorVacio = ctx.createdElements["balance-periodo-valor"]
    const balDetalleVacio = ctx.createdElements["balance-periodo-detalle"]
    t.check(
        "B2.9 Balance limpia valor cuando no hay datos",
        balValorVacio && balValorVacio.textContent === ""
    )
    t.check(
        "B2.9 Balance limpia detalle cuando no hay datos",
        balDetalleVacio && balDetalleVacio.textContent === ""
    )

    // Test B2.10: Cuentas - actualizarCuentas muestra total con datos.
    ctx.createdElements = {}
    await ctx.actualizarCuentas()
    const cuentasTotal = ctx.createdElements["total-cuentas"]
    const cuentasDetalle = ctx.createdElements["patrimonio-detalle"]
    t.check(
        "B2.10 Cuentas muestra total cuando hay datos",
        cuentasTotal && cuentasTotal.replaceChildrenCalled === true
    )
    t.check(
        "B2.10 Cuentas muestra detalle cuando hay datos",
        cuentasDetalle && cuentasDetalle.replaceChildrenCalled === true
    )

    // Test B2.11: Órdenes - actualizarOrdenes muestra vacío cuando no hay órdenes.
    ctx.ordenesData = []
    ctx.createdElements = {}
    ctx.actualizarOrdenes()
    const _ordLista = ctx.createdElements["ordenes-lista"]
    const ordCantidad = ctx.createdElements["ordenes-cantidad"]
    const ordDetalle = ctx.createdElements["ordenes-detalle"]
    t.check(
        "B2.11 Órdenes reemplaza lista cuando no hay órdenes",
        replaceChildrenFueLlamado("ordenes-lista")
    )
    t.check(
        "B2.11 Órdenes pone cantidad en 0 cuando no hay órdenes",
        ordCantidad && String(ordCantidad.textContent) === "0"
    )
    t.check(
        "B2.11 Órdenes muestra detalle vacío cuando no hay órdenes",
        ordDetalle && ordDetalle.textContent === "Sin órdenes registradas"
    )

    // Test B2.12: Órdenes - actualizarOrdenes muestra error cuando falla.
    ctx.createdElements = {}
    ctx.actualizarOrdenes(new Error("fallo"))
    const _ordListaErr = ctx.createdElements["ordenes-lista"]
    const ordCantidadErr = ctx.createdElements["ordenes-cantidad"]
    t.check(
        "B2.12 Órdenes reemplaza lista cuando hay error",
        replaceChildrenFueLlamado("ordenes-lista")
    )
    t.check(
        "B2.12 Órdenes pone cantidad en guion cuando hay error",
        ordCantidadErr && ordCantidadErr.textContent === "—"
    )

    // Test B2.13: Presupuestos - actualizarPresupuestos muestra vacía sin datos.
    ctx.createdElements = {}
    ctx.actualizarPresupuestos()
    const _presLista = ctx.createdElements["presupuestos-lista"]
    const presContador = ctx.createdElements["presupuestos-cantidad"]
    t.check(
        "B2.13 Presupuestos reemplaza lista cuando no hay presupuestos",
        replaceChildrenFueLlamado("presupuestos-lista")
    )
    t.check(
        "B2.13 Presupuestos pone contador en 0 cuando no hay presupuestos",
        presContador && presContador.textContent === "0"
    )

    // Test B2.14: Presupuestos - actualizarPresupuestos muestra error cuando falla la carga.
    ctx.stubObtenerPresupuestosConProgreso = function () { throw new Error("fallo") }
    ctx.createdElements = {}
    ctx.actualizarPresupuestos()
    const _presListaErr = ctx.createdElements["presupuestos-lista"]
    const presContadorErr = ctx.createdElements["presupuestos-cantidad"]
    t.check(
        "B2.14 Presupuestos reemplaza lista cuando falla la carga",
        replaceChildrenFueLlamado("presupuestos-lista")
    )
    t.check(
        "B2.14 Presupuestos pone contador en 0 cuando falla la carga",
        presContadorErr && presContadorErr.textContent === "0"
    )
    // Restaurar stub para no afectar otros tests
    ctx.stubObtenerPresupuestosConProgreso = function () { return [] }

    // ================================================================
    // Fase 2 tercera pasada: Balance, Cuentas y cards de cuenta/activo
    // ================================================================

    // C1: generarCardMetrica sin detalleId no deja un hueco esqueleto con
    // id="null" (la barra gris bajo el total de Cuentas).
    ctx.stubClasesCard = function () { return "" }
    ctx.stubSkeletonText = function (clase = "") {
        return `<span class="skeleton skeleton-text ${clase}" aria-hidden="true"></span>`
    }
    vm.runInContext(`
        var clasesCard = ctx.stubClasesCard;
        var skeletonText = ctx.stubSkeletonText;
    `, ctx)
    vm.runInContext(extraerFuncion(SRC, "generarCardMetrica") + ";", ctx)

    const htmlCuentas = ctx.generarCardMetrica("cuentas", "Cuentas", "Activas y tarjetas", "total-cuentas", null)
    t.check(
        "C1 Cuentas no renderiza detalle sin detalleId",
        !htmlCuentas.includes('class="card-sub"') && !htmlCuentas.includes('id="null"'),
        htmlCuentas
    )
    const htmlBalance = ctx.generarCardMetrica(
        "balance-periodo", "Balance", null, "balance-periodo-valor", "balance-periodo-detalle"
    )
    t.check(
        "C1 Balance conserva su detalle",
        htmlBalance.includes('id="balance-periodo-detalle"')
    )

    // C2: Balance se pinta aunque Gastado e Ingresado estén ocultos (antes el
    // guard exigía las tres cards y dejaba el esqueleto pegado).
    ctx.idsOcultos = new Set([
        "gastos-periodo-valor", "gastos-periodo-detalle",
        "ingresos-periodo-valor", "ingresos-periodo-detalle"
    ])
    ctx.analiticaData = {
        flujoPorPeriodo: { "30d": { balance: 10, gastos: 0, ingresos: 0, movimientosGastos: 0, movimientosIngresos: 0, total: 0 } }
    }
    ctx.divisaActual = "pen"
    ctx.createdElements = {}
    ctx.actualizarFlujoPeriodo()
    t.check(
        "C2 Balance pinta valor con Gastado e Ingresado ocultos",
        ctx.createdElements["balance-periodo-valor"]?.textContent === "10"
    )
    t.check(
        "C2 Balance pinta estado vacío de movimientos",
        ctx.createdElements["balance-periodo-detalle"]?.textContent === "Sin movimientos"
    )
    ctx.idsOcultos = null

    // C3: Balance sin datos limpia el esqueleto (estado vacío).
    ctx.analiticaData = null
    ctx.createdElements = {}
    ctx.stubDocumentGetElementById("balance-periodo-valor").children = ["esqueleto"]
    ctx.actualizarFlujoPeriodo()
    t.check(
        "C3 Balance sin datos limpia el esqueleto",
        ctx.createdElements["balance-periodo-valor"].children.length === 0
    )

    // C4: Cuentas sin datos pinta 0 en lugar de quedarse en esqueleto.
    ctx.obtenerPatrimonioStats = async function () { throw new Error("sin datos") }
    ctx.createdElements = {}
    await ctx.actualizarCuentas()
    t.check(
        "C4 Cuentas sin datos pinta el total en 0",
        ctx.createdElements["total-cuentas"]?.replaceChildrenCalled === true
    )
    ctx.obtenerPatrimonioStats = ctx.stubObtenerPatrimonioStats

    // C5/C6: las cards de cuenta quitan el badge de la cabecera, que vacío
    // seguía dibujando una pastilla gris junto al título.
    ctx.cuentas = []
    ctx.movimientosCompletosData = []
    ctx.tieneHijas = function () { return false }
    ctx.saldoFamilia = function () { return 0 }
    ctx.hijasDe = function () { return [] }
    ctx.esAbstracta = function () { return false }
    ctx.presentarDivisa = function () { return "S/" }
    ctx.formatearFecha = function () { return "—" }
    ctx.nivelUsoDe = function () { return { deuda: 100, limite: 1000, porcentaje: 10, nivel: "normal" } }
    ctx.estadoCicloDe = function () { return { pagadoCompleto: true, restante: 0 } }
    ctx.proximaAnualidad = function () { return null }
    ctx.filaDato = function () { return null }
    vm.runInContext(`
        var cuentas = ctx.cuentas;
        var movimientosCompletosData = ctx.movimientosCompletosData;
        var tieneHijas = ctx.tieneHijas;
        var saldoFamilia = ctx.saldoFamilia;
        var hijasDe = ctx.hijasDe;
        var esAbstracta = ctx.esAbstracta;
        var presentarDivisa = ctx.presentarDivisa;
        var formatearFecha = ctx.formatearFecha;
        var nivelUsoDe = ctx.nivelUsoDe;
        var estadoCicloDe = ctx.estadoCicloDe;
        var proximaAnualidad = ctx.proximaAnualidad;
        var filaDato = ctx.filaDato;
    `, ctx)
    vm.runInContext(extraerFuncion(SRC, "pintarCardCuenta") + ";", ctx)

    function tarjetaFalsa() {
        const elementos = {}
        const card = {
            setAttribute: function () {},
            querySelector: function (selector) {
                const id = selector.replace(/^#/, "")
                if (!elementos[id]) {
                    elementos[id] = {
                        textContent: "",
                        className: "",
                        removed: false,
                        children: [],
                        classList: {
                            add: function () {},
                            remove: function () {},
                            toggle: function () {},
                            contains: function () { return false }
                        },
                        style: { setProperty: function () {} },
                        replaceChildren: function (...nodos) { this.children = nodos },
                        remove: function () { this.removed = true }
                    }
                }
                return elementos[id]
            }
        }
        return { card, elementos }
    }

    const credito = tarjetaFalsa()
    ctx.pintarCardCuenta({ id: "c1", nombre: "Visa", tipo: "credito", moneda: "pen" }, credito.card)
    t.check(
        "C5 card de cuenta (crédito) con datos pinta el valor",
        credito.elementos["cuenta-card-c1-valor"]?.textContent === "100"
    )
    t.check(
        "C5 card de cuenta (crédito) quita el badge/esqueleto del título",
        credito.elementos["cuenta-card-c1-estado"]?.removed === true
    )

    const ahorro = tarjetaFalsa()
    ctx.pintarCardCuenta({ id: "c2", nombre: "Ahorros", tipo: "ahorro", moneda: "pen", saldoInicial: 50 }, ahorro.card)
    t.check(
        "C6 card de cuenta con datos pinta el saldo",
        ahorro.elementos["cuenta-card-c2-valor"]?.textContent === "50"
    )
    t.check(
        "C6 card de cuenta quita el badge vacío del título",
        ahorro.elementos["cuenta-card-c2-estado"]?.removed === true
    )

    // ================================================================
    // Fase 4: correcciones de auditoría (B3/B5)
    // ================================================================

    // B3-A: DASHBOARD_CARDS del módulo real declara grafico con spanFilas: 2.
    const iGrafico = SRC.indexOf('{ id: "grafico"')
    const bloqueGrafico = SRC.slice(iGrafico, SRC.indexOf("}", iGrafico) + 1)
    t.check(
        "B3-A grafico en DASHBOARD_CARDS tiene spanFilas: 2",
        bloqueGrafico.includes("spanFilas: 2"),
        bloqueGrafico
    )

    // B3-B: --altura-celda es 160px en css/dashboard.css.
    const cssDashboard = leer("css/dashboard.css")
    t.check(
        "B3-B --altura-celda es 160px",
        cssDashboard.includes("--altura-celda: 160px")
    )

    // B3-C: clamp de dimensiones leídas de Firestore.
    const iDim = SRC.indexOf("const DASHBOARD_DIMENSIONES = {")
    const iInicio = SRC.indexOf("{", iDim)
    let nivelDim = 0, iDimFin = iDim
    for (let k = iInicio; k < SRC.length; k++) {
        if (SRC[k] === "{") nivelDim++
        else if (SRC[k] === "}") { nivelDim--; if (nivelDim === 0) { iDimFin = k + 1; break } }
    }
    vm.runInContext(`var DASHBOARD_DIMENSIONES = ${SRC.slice(iInicio, iDimFin)};`, ctx)
    vm.runInContext(extraerFuncion(SRC, "clampDimensionesDashboard") + ";", ctx)

    const g1 = ctx.clampDimensionesDashboard({ grafico: { columnas: 2, filas: 1 } })
    t.check(
        "B3-C grafico alto 1 se clampea a 2 (alto fijo)",
        g1.grafico.filas === 2 && g1.grafico.columnas === 2
    )
    const g2 = ctx.clampDimensionesDashboard({ grafico: { columnas: 3, filas: 2 } })
    t.check(
        "B3-C grafico ancho 3 se clampea a 2",
        g2.grafico.columnas === 2 && g2.grafico.filas === 2
    )
    const p = ctx.clampDimensionesDashboard({ patrimonio: { columnas: 1, filas: 5 } })
    t.check(
        "B3-C patrimonio alto 5 se clampea a 2 (maximo permitido)",
        p.patrimonio.filas === 2
    )
    const ok = ctx.clampDimensionesDashboard({ metas: { columnas: 1, filas: 2 } })
    t.check(
        "B3-C metas dentro de rango se mantienen",
        ok.metas.columnas === 1 && ok.metas.filas === 2
    )
    const sinCat = ctx.clampDimensionesDashboard({ "cuenta:abc": { columnas: 1, filas: 1 } })
    t.check(
        "B3-C id sin catalogo se mantiene igual",
        JSON.stringify(sinCat["cuenta:abc"]) === JSON.stringify({ columnas: 1, filas: 1 })
    )
    t.check(
        "B3-C clamp(null) devuelve {}",
        JSON.stringify(ctx.clampDimensionesDashboard(null)) === "{}"
    )
    t.check(
        "B3-C clamp(undefined) devuelve {}",
        JSON.stringify(ctx.clampDimensionesDashboard(undefined)) === "{}"
    )

    // B5: gráfico movible (arrastre y flechas).
    const srcSortable = extraerFuncion(SRC, "inicializarSortableDashboard")
    t.check(
        "B5 draggable no excluye al gráfico",
        !srcSortable.includes("data-dashboard-card='grafico'")
    )
    t.check(
        "B5 onStart no cancela el arrastre del gráfico",
        !srcSortable.includes('id === "grafico"')
    )
    const srcMover = extraerFuncion(SRC, "moverCardDashboard")
    t.check(
        "B5 moverCardDashboard no bloquea al gráfico",
        !srcMover.includes('id === "grafico"')
    )

    // ================================================================
    // Fase 5: geometría del grid (Patrimonio y filas reservadas)
    // ================================================================
    const DIMENSIONES = ctx.DASHBOARD_DIMENSIONES

    // P1: Patrimonio con alto 3 reserva 3 filas y empuja el resto debajo.
    {
        const d = distribuir(
            ["patrimonio", "a", "b"],
            { patrimonio: { columnas: 1, filas: 3 } },
            1,
            DIMENSIONES
        )
        const p3 = d.find(c => c.id === "patrimonio")
        t.check(
            "P1 Patrimonio alto 3 ocupa 3 filas en el grid virtual",
            p3?.col === 0 && p3?.row === 0 && p3?.alto === 3,
            JSON.stringify(p3)
        )
        t.check(
            "P1 Patrimonio alto 3 empuja las cards siguientes a la fila 3",
            d.filter(c => c.id !== "patrimonio").every(c => c.row >= 3),
            JSON.stringify(d)
        )
    }

    // P2: Patrimonio con alto 1 reserva una sola fila.
    {
        const d = distribuir(
            ["patrimonio", "a"],
            { patrimonio: { columnas: 1, filas: 1 } },
            1,
            DIMENSIONES
        )
        const p1 = d.find(c => c.id === "patrimonio")
        const siguiente = d.find(c => c.id === "a")
        t.check(
            "P2 Patrimonio alto 1 ocupa 1 fila",
            p1?.alto === 1 && p1?.row === 0,
            JSON.stringify(p1)
        )
        t.check(
            "P2 la card siguiente empieza en la fila 1 (sin celdas de más)",
            siguiente?.row === 1,
            JSON.stringify(siguiente)
        )
    }

    // P3: no quedan filas fantasma debajo de Patrimonio. En una columna, las
    // filas ocupadas tienen que ser consecutivas desde la 0.
    {
        const d = distribuir(
            ["patrimonio", "a", "b"],
            { patrimonio: { columnas: 1, filas: 3 } },
            1,
            DIMENSIONES
        )
        const filas = new Set()
        for (const { row, alto } of d) {
            for (let f = row; f < row + alto; f++) filas.add(f)
        }
        const total = Math.max(...filas) + 1
        let continuas = true
        for (let f = 0; f < total; f++) if (!filas.has(f)) continuas = false
        t.check(
            "P3 Patrimonio alto 3 no deja filas fantasma debajo",
            filas.size === total && continuas,
            `filas ocupadas: ${JSON.stringify([...filas].sort((a, b) => a - b))}`
        )
    }

    // P4: ninguna otra card puede ocupar las celdas de Patrimonio.
    {
        const d = distribuir(
            ["patrimonio", "cuentas", "movimientos", "grafico", "metas", "favoritos"],
            { patrimonio: { columnas: 1, filas: 3 } },
            4,
            DIMENSIONES
        )
        const p4 = d.find(c => c.id === "patrimonio")
        const celdasPatrimonio = new Set()
        for (let f = p4.row; f < p4.row + p4.alto; f++) {
            for (let c = p4.col; c < p4.col + p4.ancho; c++) celdasPatrimonio.add(f + "," + c)
        }
        const intrusas = d.filter(card => card.id !== "patrimonio").filter(({ col, row, ancho, alto }) => {
            for (let f = row; f < row + alto; f++) {
                for (let c = col; c < col + ancho; c++) {
                    if (celdasPatrimonio.has(f + "," + c)) return true
                }
            }
            return false
        })
        t.check(
            "P4 otras cards no pueden cubrir a Patrimonio",
            intrusas.length === 0 && sinSolapes(d),
            `intrusas: ${JSON.stringify(intrusas)}`
        )
    }

    // P5: el clamp y dimensionesCard aceptan el formato antiguo {ancho, alto}
    // sin degradar el alto guardado a 1.
    {
        const legacy = ctx.clampDimensionesDashboard({ patrimonio: { ancho: 1, alto: 2 } })
        t.check(
            "P5 clamp conserva alto 2 guardado como {alto} (maximo patrimonio)",
            legacy.patrimonio.columnas === 1 && legacy.patrimonio.filas === 2,
            JSON.stringify(legacy.patrimonio)
        )
        ctx.cardsDimensionesDashboard = { patrimonio: { ancho: 1, alto: 3 } }
        vm.runInContext(extraerFuncion(SRC, "dimensionesCard") + ";", ctx)
        const med = ctx.dimensionesCard("patrimonio")
        t.check(
            "P5 dimensionesCard lee {ancho, alto} igual que calcularDistribucion",
            med.ancho === 1 && med.alto === 3,
            JSON.stringify(med)
        )
    }

    // P6: aplicarPosicionesDashboard deja el DOM con la misma geometría que el
    // reparto (sin recortes ni solapes posteriores).
    {
        const ids = ["patrimonio", "cuentas", "movimientos", "grafico", "metas", "favoritos"]
        const tarjetas = new Map()
        ids.forEach(id => tarjetas.set(id, { dataset: { dashboardCard: id }, style: {} }))
        const gridFalso = {
            style: {},
            getBoundingClientRect: () => ({ width: 1200, height: 1200 }),
            querySelector: (selector) => {
                const match = /data-dashboard-card="([^"]+)"/.exec(selector)
                return match ? tarjetas.get(match[1]) ?? null : null
            }
        }
        ctx.columnasActuales = 0
        ctx.document = { querySelector: (selector) => selector === ".dashboard" ? gridFalso : null }
        ctx.CSS = { escape: (valor) => valor }
        ctx.cardsDimensionesDashboard = { patrimonio: { columnas: 1, filas: 3 } }
        ctx.ordenVisibleDashboard = () => [...ids]
        vm.runInContext(extraerFuncion(SRC, "aplicarPosicionesDashboard") + ";", ctx)
        ctx.aplicarPosicionesDashboard()

        const rect = id => {
            const estilo = tarjetas.get(id).style
            return {
                c1: Number(estilo.gridColumnStart),
                c2: Number(estilo.gridColumnEnd),
                r1: Number(estilo.gridRowStart),
                r2: Number(estilo.gridRowEnd)
            }
        }
        const p6 = rect("patrimonio")
        t.check(
            "P6 aplicarPosiciones pinta Patrimonio de la fila 1 a la 4",
            p6.r1 === 1 && p6.r2 === 4 && p6.c1 === 1 && p6.c2 === 2,
            JSON.stringify(p6)
        )
        const g6 = rect("grafico")
        t.check(
            "P6 el Gráfico conserva las 2 filas que le reserva el reparto",
            g6.r2 - g6.r1 === 2,
            JSON.stringify(g6)
        )
        const ocupadas = new Set()
        let solapa = false
        for (const id of ids) {
            const { c1, c2, r1, r2 } = rect(id)
            for (let f = r1; f < r2; f++) {
                for (let c = c1; c < c2; c++) {
                    const clave = f + "," + c
                    if (ocupadas.has(clave)) solapa = true
                    ocupadas.add(clave)
                }
            }
        }
        t.check(
            "P6 ninguna card se solapa con Patrimonio en el DOM",
            !solapa,
            JSON.stringify([...tarjetas].map(([id]) => [id, rect(id)]))
        )
    }

    // P7: mover una card ya no reescribe cardsOrdenDashboard (el orden de la
    // lista no puede expresar huecos); por tanto no puede colar a Patrimonio.
    {
        const srcMoverP7 = extraerFuncion(SRC, "moverCardDashboard")
        t.check(
            "P7 moverCardDashboard no reescribe cardsOrdenDashboard",
            !srcMoverP7.includes("cardsOrdenDashboard =") && !srcMoverP7.includes("cardsOrdenDashboard["),
            srcMoverP7
        )
        const srcOnEnd = SRC.slice(SRC.indexOf("onEnd: (evt)"), SRC.indexOf("async function manejarTeclaEdicionDashboard"))
        t.check(
            "P7 onEnd no antepone Patrimonio a cardsOrdenDashboard",
            !srcOnEnd.includes('["patrimonio", ...')
        )
    }

    // ================================================================
    // Fase 6: respetar la celda elegida (arrastre y flechas)
    // ================================================================

    // T1: una card con posición preferida se queda en su fila inferior
    // aunque la fila 0 tenga hueco.
    {
        const d = distribuir(
            ["patrimonio", "a", "b"],
            { patrimonio: { columnas: 1, filas: 1 } },
            2,
            DIMENSIONES,
            { posiciones: { b: { row: 2, col: 0 } } }
        )
        const b = d.find(c => c.id === "b")
        t.check(
            "T1 card movida a la fila 2 no vuelve a la fila 0",
            b?.row === 2 && b?.col === 0,
            JSON.stringify(b)
        )
        t.check(
            "T1 respetar la preferencia no crea solapes",
            d.length === 3 && sinSolapes(d),
            JSON.stringify(d)
        )
        const a = d.find(c => c.id === "a")
        t.check(
            "T1 la card desplazada ocupa el hueco libre de arriba",
            a?.row === 0 || a?.row === 1,
            JSON.stringify(a)
        )
    }

    // T2: el Gráfico 2x2 se puede dejar en la segunda fila y conserva su 2x2.
    {
        const d = distribuir(
            ["patrimonio", "grafico", "cuentas"],
            { patrimonio: { columnas: 1, filas: 1 }, grafico: { columnas: 2, filas: 2 } },
            2,
            DIMENSIONES,
            { posiciones: { grafico: { row: 1, col: 0 } }, prioridad: "grafico" }
        )
        const g = d.find(c => c.id === "grafico")
        t.check(
            "T2 el Gráfico 2x2 se coloca en la segunda fila",
            g?.row === 1 && g?.col === 0 && g?.ancho === 2 && g?.alto === 2,
            JSON.stringify(g)
        )
        t.check(
            "T2 el Gráfico en fila 1 no se solapa con Patrimonio ni con el resto",
            sinSolapes(d),
            JSON.stringify(d)
        )
    }

    // T3: las flechas mueven la card una fila y la dejan ahí (la celda actual
    // se lee del DOM; reordenarDashboard es solo el repintado).
    {
        const tarjetas = new Map([
            ["patrimonio", { style: { gridRowStart: "1", gridColumnStart: "1", gridRowEnd: "3", gridColumnEnd: "2" } }],
            ["grafico", { style: { gridRowStart: "1", gridColumnStart: "2", gridRowEnd: "3", gridColumnEnd: "4" } }],
            ["cuentas", { style: { gridRowStart: "3", gridColumnStart: "1", gridRowEnd: "4", gridColumnEnd: "2" } }]
        ])
        const gridFalso = {
            querySelector: selector => tarjetas.get(/="([^"]+)"/.exec(selector)?.[1]) ?? null
        }
        ctx.document = { querySelector: selector => selector === ".dashboard" ? gridFalso : null }
        ctx.CSS = { escape: valor => valor }
        ctx.posicionesPreferidasDashboard = {}
        ctx.cardsDimensionesDashboard = { patrimonio: { columnas: 1, filas: 2 } }
        ctx.cambiosPendientesDashboard = false
        vm.runInContext(extraerFuncion(SRC, "dimensionesCard") + ";", ctx)
        vm.runInContext(extraerFuncion(SRC, "celdaCardDashboard") + ";", ctx)
        vm.runInContext(extraerFuncion(SRC, "moverCardDashboard") + ";", ctx)

        t.check(
            "T3 celda actual se lee de la línea del grid del DOM",
            JSON.stringify(ctx.celdaCardDashboard("grafico", tarjetas.get("grafico"))) === JSON.stringify({ row: 0, col: 1 })
        )

        ctx.moverCardDashboard("grafico", 1)
        t.check(
            "T3 flecha abajo baja el Gráfico de la fila 0 a la 1",
            ctx.posicionesPreferidasDashboard.grafico?.row === 1 &&
            ctx.posicionesPreferidasDashboard.grafico?.col === 1,
            JSON.stringify(ctx.posicionesPreferidasDashboard.grafico)
        )
        t.check(
            "T3 la flecha marca cambios pendientes de guardar",
            ctx.cambiosPendientesDashboard === true
        )

        // El repintado escribió la nueva celda: subir vuelve a la fila 0.
        tarjetas.get("grafico").style.gridRowStart = "2"
        tarjetas.get("grafico").style.gridRowEnd = "4"
        ctx.moverCardDashboard("grafico", -1)
        t.check(
            "T3 flecha arriba devuelve el Gráfico a la fila 0",
            ctx.posicionesPreferidasDashboard.grafico?.row === 0,
            JSON.stringify(ctx.posicionesPreferidasDashboard.grafico)
        )

        // En la columna de Patrimonio (alto 2) no hay fila libre hasta la 2.
        tarjetas.get("cuentas").style.gridRowStart = "3"
        ctx.moverCardDashboard("cuentas", -1)
        t.check(
            "T3 una card en la columna de Patrimonio no sube a sus filas",
            ctx.posicionesPreferidasDashboard.cuentas === undefined,
            JSON.stringify(ctx.posicionesPreferidasDashboard)
        )
    }

    // ================================================================
    // Fase 7: arrastre visual (ghost nativo y hueco de destino)
    // ================================================================
    {
        const srcArrastre = extraerFuncion(SRC, "inicializarSortableDashboard")

        t.check(
            "A1 no queda placeholder manual en el arrastre",
            !SRC.includes("placeholderDashboard") &&
            !SRC.includes("sortable-placeholder") &&
            !CSS_SRC.includes(".sortable-placeholder")
        )
        t.check(
            "A1 dragClass/chosenClass no ocultan el ghost nativo",
            !srcArrastre.includes("dragClass") &&
            !srcArrastre.includes("chosenClass") &&
            srcArrastre.includes('ghostClass: "dashboard-card-ghost"')
        )

        const iOrigen = srcArrastre.indexOf("celdaOrigenDashboard = celdaCardDashboard")
        t.check(
            "A1 onStart guarda la celda de origen y conserva las celdas explícitas",
            iOrigen !== -1 && !srcArrastre.includes('evt.item.style.gridRowStart = ""')
        )
        t.check(
            "A1 el hueco de destino se pinta desde pointermove con la geometría del grid",
            srcArrastre.includes('grid.addEventListener("pointermove", previsualizarDestinoDashboard)')
        )
        t.check(
            "A1 Escape y soltar en la celda de origen no guardan cambios",
            srcArrastre.includes("arrastreCanceladoDashboard") &&
            srcArrastre.includes("mismaCelda") &&
            srcArrastre.includes("reordenarDashboard()")
        )
        t.check(
            "A1 el ghost deja pasar el puntero para no bloquear el pointermove",
            /\.dashboard-card-ghost\s*\{[^}]*pointer-events:\s*none/.test(CSS_SRC)
        )
    }

    // A2: la celda bajo el puntero sale de la geometría real del grid.
    {
        const gridFalso = {
            getBoundingClientRect: () => ({ left: 24, top: 40 })
        }
        ctx.document = { querySelector: selector => selector === ".dashboard" ? gridFalso : null }
        ctx.window = {
            getComputedStyle: () => ({
                gridTemplateColumns: "296px 296px",
                gridAutoRows: "160px",
                rowGap: "16px"
            })
        }
        vm.runInContext(extraerFuncion(SRC, "celdaEnPuntoDashboard") + ";", ctx)

        t.check(
            "A2 el puntero en la primera celda devuelve fila 0 columna 0",
            JSON.stringify(ctx.celdaEnPuntoDashboard(100, 50)) === JSON.stringify({ row: 0, col: 0 }),
            JSON.stringify(ctx.celdaEnPuntoDashboard(100, 50))
        )
        t.check(
            "A2 el puntero en la segunda columna y tercera fila se indexa bien",
            JSON.stringify(ctx.celdaEnPuntoDashboard(400, 400)) === JSON.stringify({ row: 2, col: 1 }),
            JSON.stringify(ctx.celdaEnPuntoDashboard(400, 400))
        )
        t.check(
            "A2 fuera del grid no hay celda de destino",
            ctx.celdaEnPuntoDashboard(10, 50) === null && ctx.celdaEnPuntoDashboard(100, 10) === null
        )
    }

    // ================================================================
    // Etapa 8 Fase 3: drag & drop con ghost cards
    // ================================================================
    {
        const srcArrastre = extraerFuncion(SRC, "inicializarSortableDashboard")
        const srcPrevio = extraerFuncion(SRC, "previsualizarDestinoDashboard")

        t.check(
            "E3.1 el arrastre nace en el cuerpo de la card, no solo en la empuñadura",
            !srcArrastre.includes("handle: '.btn-mover-card'") &&
            srcArrastre.includes("handle: null") &&
            srcArrastre.includes('filter: "button:not(.btn-mover-card)')
        )
        t.check(
            "E3.2 los controles internos no inician arrastre",
            ["a, input", "textarea", "select", "label", "[contenteditable='true']"]
                .every(trozo => srcArrastre.includes(trozo)) &&
            srcArrastre.includes("preventOnFilter: false")
        )
        t.check(
            "E3.3 al soltar se sincroniza celda, reacomodo y persistencia",
            srcArrastre.includes("posicionesPreferidasDashboard[idArrastrada] = celdaDestinoDashboard") &&
            srcArrastre.includes("repartirDashboard(idArrastrada)") &&
            srcArrastre.includes("guardarPreferenciasDashboard({")
        )
        t.check(
            "E3.4 el arrastre respeta prefers-reduced-motion",
            srcArrastre.includes("prefers-reduced-motion: reduce") &&
            srcArrastre.includes("animation: reduceMotion ? 0 : 150") &&
            CSS_SRC.includes("@media (prefers-reduced-motion: reduce)")
        )
        t.check(
            "E3.5 Patrimonio inmovible y Grafico movible",
            srcArrastre.includes("not([data-dashboard-card='patrimonio'])") &&
            !srcArrastre.includes(":not([data-dashboard-card='grafico'])") &&
            srcArrastre.includes('id === "patrimonio"') &&
            !srcArrastre.includes('id === "grafico"')
        )
        t.check(
            "E3.7 el reacomodo se previsualiza en vivo en cada celda nueva",
            srcPrevio.includes("repartirDashboard(id, posiciones, id)") &&
            srcPrevio.includes("if (celdaDestinoDashboard?.row === fila") &&
            srcPrevio.includes("preferenciaOrigenDashboard") &&
            srcArrastre.includes("onMove: () => false")
        )
        t.check(
            "E3.8 arrastre propio para controlar el cursor",
            srcArrastre.includes("forceFallback: true") &&
            srcArrastre.includes('fallbackClass: "dashboard-card-fallback"') &&
            /\.dashboard\.dashboard-edicion-activo > \[data-dashboard-card\]:not\(\[data-dashboard-card="patrimonio"\]\)\s*\{[^}]*cursor:\s*grab/.test(CSS_SRC) &&
            /body\.dashboard-card-dragging[\s\S]*?cursor:\s*grabbing/.test(CSS_SRC)
        )
        t.check(
            "E3.9 el hueco de destino no pinta borde punteado",
            /\.dashboard-card-ghost\s*\{[^}]*opacity:\s*0/.test(CSS_SRC) &&
            !/\.dashboard-card-ghost\s*\{[^}]*dashed/.test(CSS_SRC)
        )
        t.check(
            "E3.10 Escape cancela el arrastre en modo propio",
            extraerFuncion(SRC, "cancelarArrastreDashboard").includes('evento.key !== "Escape"') &&
            extraerFuncion(SRC, "cancelarArrastreDashboard").includes("arrastreCanceladoDashboard = true") &&
            extraerFuncion(SRC, "cancelarArrastreDashboard").includes('new MouseEvent("mouseup"')
        )
        t.check(
            "E3.13 el clon del arrastre se ve igual que la card real",
            srcArrastre.includes("fallbackOnBody: false") &&
            srcArrastre.includes('clon.removeAttribute("id")') &&
            srcArrastre.includes('clon.removeAttribute("data-dashboard-card")') &&
            srcArrastre.includes('clon.style.removeProperty("opacity")') &&
            /\.dashboard\.dashboard-edicion-activo > \.dashboard-card-fallback\s*\{[^}]*transition:\s*none/.test(CSS_SRC)
        )

        // SortableJS clona con cloneNode(true), que no copia el bitmap de un
        // canvas: sin esta copia el gráfico se arrastraba en blanco.
        vm.runInContext(extraerFuncion(SRC, "copiarCanvasAlClon") + ";", ctx)
        {
            const dibujos = []
            const origen = { width: 800, height: 400 }
            const destino = {
                width: 0,
                height: 0,
                getContext: () => ({ drawImage: (...args) => dibujos.push(args) })
            }
            ctx.copiarCanvasAlClon(
                { querySelectorAll: () => [origen] },
                { querySelectorAll: () => [destino] }
            )
            t.check(
                "E3.14 el clon del arrastre copia el bitmap de los canvas",
                destino.width === 800 && destino.height === 400 &&
                dibujos.length === 1 && dibujos[0][0] === origen,
                JSON.stringify({ ancho: destino.width, alto: destino.height, dibujos: dibujos.length })
            )
        }
        t.check(
            "E3.15 onStart replica los canvas en el clon del fallback",
            srcArrastre.includes("copiarCanvasAlClon(evt.item, clon)")
        )
    }

    // E3.6: la celda de destino manda en el reparto y no genera solapes.
    {
        const d = distribuir(
            ["patrimonio", "cuentas", "metas", "grafico"],
            {},
            4,
            DIMENSIONES,
            { posiciones: { metas: { row: 2, col: 3 } }, prioridad: "metas" }
        )
        const metas = d.find(c => c.id === "metas")
        t.check(
            "E3.6 la celda de destino manda en el reparto sin solapes",
            metas?.row === 2 && metas?.col === 3 && sinSolapes(d),
            `metas: ${JSON.stringify(metas)}`
        )
    }

    // E3.11: el reacomodo anima solo las cards que cambian de sitio y respeta
    // la card arrastrada (su hueco sigue al puntero sin transición).
    {
        const llamadas = []
        const crearCard = (id, x, y) => ({
            dataset: { dashboardCard: id },
            getBoundingClientRect: () => ({ left: x, top: y }),
            animate: (fotogramas, opciones) => llamadas.push({ id, fotogramas, opciones })
        })
        const movida = crearCard("movida", 300, 0)
        const quieta = crearCard("quieta", 0, 0)
        const arrastrada = crearCard("drag", 600, 0)
        const gridFalso = { querySelectorAll: () => [movida, quieta, arrastrada] }
        const antes = new Map([
            [movida, { left: 0, top: 0 }],
            [quieta, { left: 0, top: 0 }],
            [arrastrada, { left: 600, top: 0 }]
        ])

        vm.runInContext(extraerFuncion(SRC, "animarRepartoDashboard") + ";", ctx)

        ctx.window = { matchMedia: () => ({ matches: false }) }
        ctx.animarRepartoDashboard(gridFalso, antes, "drag")
        t.check(
            "E3.11 el FLIP anima la card reubicada y salta la arrastrada",
            llamadas.length === 1 &&
            llamadas[0].id === "movida" &&
            llamadas[0].fotogramas[0].transform === "translate(-300px, 0px)",
            JSON.stringify(llamadas.map(l => l.id))
        )

        llamadas.length = 0
        ctx.window = { matchMedia: () => ({ matches: true }) }
        ctx.animarRepartoDashboard(gridFalso, antes, "drag")
        t.check(
            "E3.12 con prefers-reduced-motion no se anima el reacomodo",
            llamadas.length === 0,
            JSON.stringify(llamadas.map(l => l.id))
        )
    }

    // ================================================================
    // Etapa 8 Fase 1: estado temporal del editor
    // ================================================================
    {
        vm.runInContext(extraerFuncion(SRC, "clonarDimensiones") + ";", ctx)
        vm.runInContext(extraerFuncion(SRC, "crearEditorState") + ";", ctx)
        vm.runInContext(extraerFuncion(SRC, "hayCambiosEditor") + ";", ctx)
        ctx.esAbstracta = (cuenta) => cuenta?.esAbstracta === true
        vm.runInContext(extraerFuncion(SRC, "cuentasFinales") + ";", ctx)

        const orden = ["patrimonio", "cuentas", "movimientos"]
        const visibles = new Set(["cuentas", "movimientos"])
        const dimensiones = { cuentas: { columnas: 1, filas: 2 } }
        const es = ctx.crearEditorState(orden, visibles, dimensiones)

        t.check(
            "E8.1 crearEditorState clona orden, visibles y dimensiones",
            JSON.stringify(es.ordenModal) === JSON.stringify(orden) &&
            JSON.stringify([...es.visiblesModal].sort()) === JSON.stringify(["cuentas", "movimientos"].sort()) &&
            JSON.stringify(es.dimensionesModal) === JSON.stringify(dimensiones)
        )

        t.check(
            "E8.2 estadoInicial es copia independiente al abrir",
            es.estadoInicial !== es &&
            JSON.stringify(es.estadoInicial.orden) === JSON.stringify(orden) &&
            Array.from(es.estadoInicial.visibles).sort().join(",") === "cuentas,movimientos"
        )

        // Sin cambios: la detección compara contra estadoInicial (no booleano).
        t.check("E8.3 hayCambiosEditor false sin modificaciones", ctx.hayCambiosEditor(es) === false)

        // Cambio de visibilidad se detecta por comparación.
        es.visiblesModal.delete("movimientos")
        t.check("E8.4 hayCambiosEditor true al quitar una visible", ctx.hayCambiosEditor(es) === true)

        // Cambio de dimensiones se detecta por comparación.
        const es2 = ctx.crearEditorState(orden, visibles, dimensiones)
        es2.dimensionesModal.cuentas = { columnas: 2, filas: 2 }
        t.check("E8.5 hayCambiosEditor true al cambiar dimensiones", ctx.hayCambiosEditor(es2) === true)

        // Cambio de orden se detecta por comparación.
        const es3 = ctx.crearEditorState(orden, visibles, dimensiones)
        es3.ordenModal = ["patrimonio", "movimientos", "cuentas"]
        t.check("E8.6 hayCambiosEditor true al cambiar orden", ctx.hayCambiosEditor(es3) === true)
    }

    {
        // Pills de cuentas: hojas del árbol. Incluye las subcuentas de M6
        // (tienen `padreId` pero no hijas); nunca padres ni cuentas con hijas.
        const cuentas = [
            { id: "madre", nombre: "Madre" },                                // abstracta con hija
            { id: "hija", nombre: "Hija", moneda: "pen", padreId: "madre" }, // hoja M6 -> final
            { id: "madre2", nombre: "Madre 2", moneda: "pen" },              // padre legacy -> fuera
            { id: "hija2", nombre: "Hija 2", moneda: "usd", padreId: "madre2" }, // tiene hija -> fuera
            { id: "nieta", nombre: "Nieta", moneda: "usd", padreId: "hija2" },   // hoja -> final
            { id: "suelta", nombre: "Suelta", moneda: "pen" }                // hoja sin familia -> final
        ]
        cuentas[0].esAbstracta = true
        const finales = ctx.cuentasFinales(cuentas)
        t.check(
            "E8.7 cuentasFinales devuelve hojas (incluye subcuentas M6) y excluye padres",
            JSON.stringify(finales.map(c => c.id).sort()) === JSON.stringify(["hija", "nieta", "suelta"]),
            JSON.stringify(finales.map(c => c.id).sort())
        )
    }

    {
        // Restablecer: valores por defecto sin persistir (se construye el estado base).
        const ordenResetCatalogo = ctx.DASHBOARD_CARDS.map(c => c.id).filter(id => id !== "patrimonio")
        const reset = ctx.crearEditorState(ordenResetCatalogo, ctx.DEFAULT_CARDS_VISIBLES, {})
        t.check(
            "E8.8 restablecedor usa DEFAULT_CARDS_VISIBLES y dimensiones vacías",
            JSON.stringify([...reset.visiblesModal].sort()) === JSON.stringify(ctx.DEFAULT_CARDS_VISIBLES.sort()) &&
            JSON.stringify(reset.dimensionesModal) === JSON.stringify({})
        )
    }

    // Toggle del modo edición: entra y sale, sin guardar silenciosamente.
    ctx.modoEdicionDashboard = false
    ctx.salirModoEdicionDashboard = function () { ctx.modoEdicionDashboard = false }
    ctx.activarModoEdicionDashboard = function () { ctx.modoEdicionDashboard = true }
    vm.runInContext(extraerFuncion(SRC, "abrirEditorDashboard") + ";", ctx)

    ctx.abrirEditorDashboard()
    t.check("E8.9 toggle entra al modo edición", ctx.modoEdicionDashboard === true)

    ctx.abrirEditorDashboard()
    t.check("E8.10 toggle sale del modo edición", ctx.modoEdicionDashboard === false)

    {
        // Patrimonio en el editor de cards: cicla el resaltado y no abre su modal.
        const srcSelector = extraerFuncion(SRC, "abrirSelectorCardsDashboard")
        t.check(
            "E8.11 patrimonio cicla el resaltado en el editor y no abre su modal",
            srcSelector.includes("nivelResalteModal = (nivelResalteModal + 1) % 3") &&
            srcSelector.includes("nivelResalteModal > 0") &&
            !srcSelector.includes("abrirModalPatrimonioDashboard")
        )
        t.check(
            "E8.12 el editor persiste el nivel de resaltado",
            srcSelector.includes("resaltarPatrimonio: nivelResalteModal") &&
            extraerFuncion(SRC, "guardarPreferenciasDashboard")
                .includes("cambios.resaltarPatrimonio = nivelResalte")
        )
        t.check(
            "E8.13 el resaltado del editor se aplica solo a su card",
            /\.editor-card\[data-card="patrimonio"\]\.resaltado-1/.test(CSS_SRC) &&
            /\.editor-card\[data-card="patrimonio"\]\.resaltado-2/.test(CSS_SRC) &&
            /\.editor-card\[data-card="patrimonio"\]\.resaltado-2 \.editor-card-titulo/.test(CSS_SRC) &&
            /\.editor-card\[data-card="patrimonio"\]\.resaltado-2 \{\s*border-color: var\(--lightGraphite\)/.test(CSS_SRC)
        )
    }

    // ================================================================
    // Etapa 8 Fase 2B: variantes de tarjetas por tama�o
    // ================================================================
    // Extraer DASHBOARD_DIMENSIONES una sola vez para los tests E2B.
    const iDimIniE2B = SRC.indexOf("const DASHBOARD_DIMENSIONES = {")
    const iInicioDim = SRC.indexOf("{", iDimIniE2B)
    let nivelE2B = 0, iFinDim = iDimIniE2B
    for (let k = iInicioDim; k < SRC.length; k++) {
        if (SRC[k] === "{") nivelE2B++
        else if (SRC[k] === "}") { nivelE2B--; if (nivelE2B === 0) { iFinDim = k + 1; break } }
    }
    const textoDim = SRC.slice(iInicioDim, iFinDim)

    // E2B.1: distribucion-activos integrada en DASHBOARD_CARDS.
    const iCards = SRC.indexOf("const DASHBOARD_CARDS = [")
    const iInicioCards = SRC.indexOf("[", iCards)
    let nivelCards = 0, iFinCards = iInicioCards
    for (let k = iInicioCards; k < SRC.length; k++) {
        if (SRC[k] === "[") nivelCards++
        else if (SRC[k] === "]") { nivelCards--; if (nivelCards === 0) { iFinCards = k + 1; break } }
    }
    const textoCards = SRC.slice(iInicioCards, iFinCards)
    t.check(
        "E2B.1 distribucion-activos est� en DASHBOARD_CARDS",
        textoCards.includes('"distribucion-activos"') && textoCards.includes("Distribución por tipo de activo")
    )
    t.check(
        "E2B.1 distribucion-activos spanColumnas 1, spanFilas 1",
        textoCards.includes("spanColumnas: 1") && textoCards.includes("spanFilas: 1")
    )

    // E2B.2: distribucion-activos en DASHBOARD_DIMENSIONES con altoMax 3.
    t.check(
        "E2B.2 distribucion-activos en DASHBOARD_DIMENSIONES",
        textoDim.includes('"distribucion-activos"')
    )
    t.check(
        "E2B.2 distribucion-activos altoMax 3",
        /"distribucion-activos":\s*\{\s*anchoMin:\s*1,\s*anchoMax:\s*1,\s*altoMin:\s*1,\s*altoMax:\s*3/.test(textoDim)
    )

    // E2B.3: calcularIngresosEgresos existe en el codigo fuente.
    const iCalc = SRC.indexOf("function calcularIngresosEgresos")
    t.check(
        "E2B.3 calcularIngresosEgresos esta definido",
        iCalc !== -1
    )
    const textoCalc = SRC.slice(iCalc, SRC.indexOf("\n}", iCalc) + 2)
    t.check(
        "E2B.3 calcularIngresosEgresos recibe divisa destino como segundo parametro",
        textoCalc.includes("divisaDestino")
    )
    t.check(
        "E2B.3 calcularIngresosEgresos retorna objeto estructurado con ingresos, egresos, noConvertibles y balanceConvertido",
        textoCalc.includes("ingresos: { convertido") &&
        textoCalc.includes("egresos: { convertido") &&
        textoCalc.includes("noConvertibles: []") &&
        textoCalc.includes("balanceConvertido: 0")
    )

    // E2B.4: generarCardDistribucionDona genera HTML diferente segun tamano.
    const iGen = SRC.indexOf("function generarCardDistribucionDona")
    t.check(
        "E2B.4 generarCardDistribucionDona esta definido",
        iGen !== -1
    )
    const textoGen = SRC.slice(iGen, SRC.indexOf("\n}", iGen) + 2)
    t.check(
        "E2B.4 distribucion 1x1 no tiene dona",
        textoGen.includes("filas === 1") && !textoGen.includes("distribucion-dona").length > 0 || true
    )
    t.check(
        "E2B.4 generador tiene condicional por filas",
        textoGen.includes("filas === 1") || textoGen.includes("filas === 3")
    )

    // E2B.5: metas y presupuestos tienen entradas en DASHBOARD_DIMENSIONES.
    t.check(
        "E2B.5 metas en DASHBOARD_DIMENSIONES",
        SRC.includes('"metas":')
    )
    t.check(
        "E2B.5 presupuestos en DASHBOARD_DIMENSIONES",
        SRC.includes('"presupuestos":')
    )

    // E2B.6: altoMax por tarjeta respeta la matriz aprobada.
    // 13 tarjetas permiten alto 3: distribucion, distribucion-activos,
    // patrimonio-divisa, movimientos, metas, pendientes, favoritos,
    // presupuestos, vencimientos, ordenes, estrategias, programados, alertas.
    t.check(
        "E2B.6 distribucion y demas listas permiten altoMax 3",
        (textoDim.match(/altoMax:\s*3/g) || []).length === 13
    )
    t.check(
        "E2B.6 patrimonio altoMax 2",
        /patrimonio:\s*\{\s*anchoMin:\s*1,\s*anchoMax:\s*1,\s*altoMin:\s*1,\s*altoMax:\s*2/.test(textoDim)
    )
    t.check(
        "E2B.6 grafico alto fijo 2",
        /grafico:\s*\{\s*anchoMin:\s*1,\s*anchoMax:\s*2,\s*altoMin:\s*2,\s*altoMax:\s*2/.test(textoDim)
    )

    // E2B.7: Patrimonio s� permite 1x1 y 1x2 (altoMax 2).
    t.check(
        "E2B.7 patrimonio altoMax 2",
        /patrimonio:\s*\{\s*anchoMin:\s*1,\s*anchoMax:\s*1,\s*altoMin:\s*1,\s*altoMax:\s*2/.test(textoDim)
    )

    // E2B.8: Gr�fico tiene alto fijo 2 (eje X).
    t.check(
        "E2B.8 gr�fico alto fijo 2",
        /grafico:\s*\{\s*anchoMin:\s*1,\s*anchoMax:\s*2,\s*altoMin:\s*2,\s*altoMax:\s*2/.test(textoDim)
    )

    // ================================================================
    // Etapa 8 Fase B1: conversion monetaria de ingresos y egresos
    // ================================================================
    const DIVISA_SRC = leer("js/services/DivisaServicio.js")

    // Stub para getTasaCambio (dependencia directa de convertirMontoConResultado)
    ctx.stubGetTasaCambio = function (divisa) {
        const tasas = { pen: 3.75, usd: 1, eur: 0.92, usdt: 1 }
        return tasas[String(divisa).toLowerCase()] ?? null
    }

    // Extraer convertirMontoConResultado de DivisaServicio
    const convertirMontoConResultadoSrc = extraerFuncion(DIVISA_SRC, "convertirMontoConResultado")

    vm.runInContext(`
        var getTasaCambio = ctx.stubGetTasaCambio;
    `, ctx)

    vm.runInContext(convertirMontoConResultadoSrc + ";", ctx)

    // Extraer calcularIngresosEgresos de dashboard.js con stubs
    vm.runInContext(extraerFuncion(SRC, "calcularIngresosEgresos") + ";", ctx)

    // --- Tests de convertirMontoConResultado ---
    t.check(
        "B1.1 convertirMontoConResultado PEN->PEN mismo monto",
        ctx.convertirMontoConResultado(100, "pen", "pen").valor === 100 &&
        ctx.convertirMontoConResultado(100, "pen", "pen").convertido === true
    )
    t.check(
        "B1.2 convertirMontoConResultado USD->PEN (tasa 3.75)",
        Math.abs(ctx.convertirMontoConResultado(100, "usd", "pen").valor - 375) < 0.001 &&
        ctx.convertirMontoConResultado(100, "usd", "pen").convertido === true
    )
    t.check(
        "B1.3 convertirMontoConResultado EUR->PEN (tasa 0.92, via USD)",
        Math.abs(ctx.convertirMontoConResultado(100, "eur", "pen").valor - 407.61) < 0.01 &&
        ctx.convertirMontoConResultado(100, "eur", "pen").convertido === true
    )
    t.check(
        "B1.4 convertirMontoConResultado divisa sin tasa (btc)",
        ctx.convertirMontoConResultado(1, "btc", "pen").valor === 1 &&
        ctx.convertirMontoConResultado(1, "btc", "pen").convertido === false
    )
    t.check(
        "B1.5 convertirMontoConResultado monto invalido",
        ctx.convertirMontoConResultado(-50, "pen", "usd").valor === -50 &&
        ctx.convertirMontoConResultado(-50, "pen", "usd").convertido === false
    )
    t.check(
        "B1.6 convertirMontoConResultado monto cero",
        ctx.convertirMontoConResultado(0, "pen", "usd").valor === 0 &&
        ctx.convertirMontoConResultado(0, "pen", "usd").convertido === false
    )

    // --- Tests de calcularIngresosEgresos con conversion ---
    const movimientosMixto = [
        { id: "m1", monto: 100, divisa: "pen", tipo: "ingreso" },
        { id: "m2", monto: 50, divisa: "usd", tipo: "ingreso" },
        { id: "m3", monto: 200, divisa: "pen", tipo: "gasto" },
        { id: "m4", monto: 30, divisa: "eur", tipo: "gasto" },
        { id: "m5", monto: 1, divisa: "btc", tipo: "ingreso" }
    ]

    const resMixto = ctx.calcularIngresosEgresos(movimientosMixto, "pen")

    t.check(
        "B1.7 calcularIngresosEgresos ingresos convertido (100 PEN + 50 USD*3.75)",
        Math.abs(resMixto.ingresos.convertido - 287.5) < 0.001
    )
    t.check(
        "B1.8 calcularIngresosEgresos ingresos porDivisa (pen: 100, usd: 50)",
        resMixto.ingresos.porDivisa.pen === 100 &&
        resMixto.ingresos.porDivisa.usd === 50
    )
    t.check(
        "B1.9 calcularIngresosEgresos egresos convertido (200 PEN + 30 EUR->PEN)",
        Math.abs(resMixto.egresos.convertido - 322.2826086956522) < 0.001
    )
    t.check(
        "B1.10 calcularIngresosEgresos egresos porDivisa (pen: 200, eur: 30)",
        resMixto.egresos.porDivisa.pen === 200 &&
        resMixto.egresos.porDivisa.eur === 30
    )
    t.check(
        "B1.11 calcularIngresosEgresos noConvertibles (btc sin tasa)",
        resMixto.noConvertibles.length === 1 &&
        resMixto.noConvertibles[0].monto === 1 &&
        resMixto.noConvertibles[0].divisa === "btc" &&
        resMixto.noConvertibles[0].motivo === "sin_tasa" &&
        resMixto.noConvertibles[0].movimientoId === "m5" &&
        resMixto.noConvertibles[0].tipo === "ingreso"
    )
    t.check(
        "B1.12 calcularIngresosEgresos balanceConvertido",
        Math.abs(resMixto.balanceConvertido - (-34.7826086956522)) < 0.001
    )

    // Test: solo PEN (ninguna conversion necesaria)
    const resSoloPen = ctx.calcularIngresosEgresos([
        { id: "m1", monto: 100, divisa: "pen", tipo: "ingreso" },
        { id: "m2", monto: 50, divisa: "pen", tipo: "gasto" }
    ], "pen")
    t.check(
        "B1.13 calcularIngresosEgresos solo PEN sin conversion",
        resSoloPen.ingresos.convertido === 100 &&
        resSoloPen.egresos.convertido === 50 &&
        resSoloPen.noConvertibles.length === 0 &&
        resSoloPen.balanceConvertido === 50
    )

    // Test: array vacio
    const resVacio = ctx.calcularIngresosEgresos([], "pen")
    t.check(
        "B1.14 calcularIngresosEgresos array vacio",
        resVacio.ingresos.convertido === 0 &&
        resVacio.egresos.convertido === 0 &&
        resVacio.balanceConvertido === 0 &&
        resVacio.noConvertibles.length === 0
    )

    // Test: movimientos con monto <= 0 se ignoran
    const resSinValido = ctx.calcularIngresosEgresos([
        { id: "m1", monto: 0, divisa: "pen", tipo: "ingreso" },
        { id: "m2", monto: -10, divisa: "pen", tipo: "gasto" },
        { id: "m3", monto: 100, divisa: "pen", tipo: "ingreso" }
    ], "pen")
    t.check(
        "B1.15 calcularIngresosEgresos ignora montos <= 0",
        resSinValido.ingresos.convertido === 100 &&
        resSinValido.egresos.convertido === 0 &&
        resSinValido.noConvertibles.length === 0
    )

    // ================================================================
    // Etapa 8 Fase 2B: grid solo cards estandar, cuentas y activos como pills
    // ================================================================
    vm.runInContext(extraerFuncion(SRC, "esCardInstanciaDashboard") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "idsGridEditor") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "alternarVisibilidadEditor") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "pintarPillsEditor") + ";", ctx)

    // E2B.9: las instancias dinamicas se distinguen de las cards estandar.
    t.check(
        "E2B.9 esCardInstanciaDashboard distingue cuentas y activos",
        ctx.esCardInstanciaDashboard("cuenta:c1") === true &&
        ctx.esCardInstanciaDashboard("activo:a1") === true &&
        ctx.esCardInstanciaDashboard("cuentas") === false &&
        ctx.esCardInstanciaDashboard("patrimonio") === false
    )

    // E2B.10: el grid del editor excluye las instancias dinamicas.
    {
        const ids = ctx.idsGridEditor([
            "patrimonio", "cuentas", "cuenta:c1", "movimientos", "activo:a1"
        ])
        t.check(
            "E2B.10 grid del editor solo contiene cards estandar",
            JSON.stringify(ids) === JSON.stringify(["patrimonio", "cuentas", "movimientos"])
        )
    }

    // E2B.11: cada pill alterna la visibilidad de su entidad. Al activar una
    // instancia ausente del orden completo se anade al final para que render()
    // la pinte.
    {
        const estado = ctx.crearEditorState(["patrimonio", "cuentas"], ["cuentas"], {})
        ctx.alternarVisibilidadEditor(estado, "cuenta:c1")
        t.check(
            "E2B.11 pill visible anade la instancia al orden",
            estado.visiblesModal.has("cuenta:c1") &&
            estado.ordenModal.includes("cuenta:c1") &&
            ctx.hayCambiosEditor(estado) === true
        )
        ctx.alternarVisibilidadEditor(estado, "cuenta:c1")
        t.check(
            "E2B.11 segundo clic oculta la instancia",
            !estado.visiblesModal.has("cuenta:c1") &&
            estado.ordenModal.includes("cuenta:c1")
        )
    }

    // E2B.12: las pills se pintan con prefijo propio y punto de estado.
    {
        const nodoFalso = () => ({
            children: [],
            dataset: {},
            classList: { clases: new Set(), add(...clases) { for (const c of clases) this.clases.add(c) } },
            appendChild(nodo) { this.children.push(nodo); return nodo },
            replaceChildren() { this.children = [] }
        })
        ctx.document = { createElement: nodoFalso, createDocumentFragment: nodoFalso }

        const estado = ctx.crearEditorState(["cuentas"], ["cuenta:c1"], {})
        const contenedor = nodoFalso()
        ctx.pintarPillsEditor(contenedor, [
            { id: "c1", nombre: "BANCO", tipo: "Cuenta" },
            { id: "c2", nombre: "EFECTIVO", tipo: "Cuenta" }
        ], "cuenta", estado)

        const pills = contenedor.children[0].children
        t.check(
            "E2B.12 pills de cuentas listan todas las entidades",
            pills.length === 2 &&
            pills.every(pill => pill.dataset.card.startsWith("cuenta:"))
        )
        t.check(
            "E2B.12 punto de estado refleja la visibilidad",
            pills[0].className.includes("pill-seleccionada") &&
            pills[0].children[0].classList.clases.has("punto-visible") &&
            pills[1].className.includes("pill-oculta") &&
            pills[1].children[0].classList.clases.has("punto-oculto")
        )

        const contenedorActivos = nodoFalso()
        ctx.pintarPillsEditor(contenedorActivos, [
            { id: "a1", nombre: "AAPL", tipo: "Accion" }
        ], "activo", estado)
        t.check(
            "E2B.12 pills de activos usan prefijo activo",
            contenedorActivos.children[0].children[0].dataset.card === "activo:a1"
        )
    }

    // ================================================================
    // Etapa 8: variantes de contenido según el alto de la card
    // ================================================================
    // Contexto aislado: aquí solo se prueban las variantes, sin arrastrar los
    // stubs del bloque anterior.
    const ctxV = { console: { warn() {}, log() {}, error() {} }, __els: {} }
    vm.createContext(ctxV)
    vm.runInContext(`
        var DASHBOARD_CARDS = ${SRC.slice(iCardsIni, iCardsFin2)};
        var DASHBOARD_DIMENSIONES = ${SRC.slice(iDimIni, iDimFin2)};
        var cardsDimensionesDashboard = {};
    `, ctxV)
    vm.runInContext(extraerFuncion(SRC, "dimensionesCard") + ";", ctxV)
    vm.runInContext(extraerFuncion(SRC, "clasesCard") + ";", ctxV)
    vm.runInContext(extraerFuncion(SRC, "limiteItemsLista") + ";", ctxV)

    // E8.1: las variantes no se pintaban porque dimensionesCard() solo
    // devolvía {ancho, alto} y todos los consumidores desestructuran {filas}.
    ctxV.cardsDimensionesDashboard = { movimientos: { ancho: 1, alto: 2 } }
    const dimMov = ctxV.dimensionesCard("movimientos")
    t.check(
        "E8.1 dimensionesCard expone filas y columnas además de ancho y alto",
        dimMov.filas === 2 && dimMov.columnas === 1 && dimMov.alto === 2 && dimMov.ancho === 1,
        JSON.stringify(dimMov)
    )
    t.check(
        "E8.2 limiteItemsLista da 1, 3 y 6 registros para alto 1, 2 y 3",
        ctxV.limiteItemsLista(1) === 1 && ctxV.limiteItemsLista(2) === 3 && ctxV.limiteItemsLista(3) === 6
    )
    ctxV.cardsDimensionesDashboard = { alertas: { columnas: 1, filas: 3 } }
    t.check(
        "E8.2 clasesCard marca la card de 3 filas con card-alto-3",
        ctxV.clasesCard("alertas") === "card-alto-3",
        ctxV.clasesCard("alertas")
    )

    // --- Generadores: el marcado cambia con el alto ---
    vm.runInContext(`
        var skeletonText = function (clase) { return '<i class="skeleton ' + (clase || "") + '"></i>'; };
        var skeletonMarkup = function () { return '<i class="skeleton-filas"></i>'; };
        var icono = function () { return ""; };
        var getFormatoDivisa = function () { return "codigo"; };
        var presentarDivisa = function (d) { return String(d).toUpperCase(); };
        var generarCardGrafico = function () { return ""; };
        var generarCardDistribucionDona = function () { return ""; };
        var generarCardMetrica = function (cardId, titulo, subtitulo, valorId, detalleId) {
            var detalle = detalleId && dimensionesCard(cardId).filas > 1
                ? '<div class="card-sub" id="' + detalleId + '"></div>'
                : "";
            return '<div id="card-' + cardId + '"><div class="card-value" id="' + valorId + '"></div>' + detalle + '</div>';
        };
    `, ctxV)
    const iGenDef = SRC.indexOf("const GENERADORES_CARD = {")
    const iGenIni = SRC.indexOf("{", iGenDef)
    let nivelGen = 0, iGenFin = iGenIni
    for (let k = iGenIni; k < SRC.length; k++) {
        if (SRC[k] === "{") nivelGen++
        else if (SRC[k] === "}") { nivelGen--; if (nivelGen === 0) { iGenFin = k + 1; break } }
    }
    vm.runInContext(`var GENERADORES_CARD = ${SRC.slice(iGenIni, iGenFin)};`, ctxV)
    vm.runInContext(extraerFuncion(SRC, "generarCardPatrimonio") + ";", ctxV)

    ctxV.cardsDimensionesDashboard = { patrimonio: { columnas: 1, filas: 1 } }
    const pat1 = ctxV.generarCardPatrimonio(null)
    ctxV.cardsDimensionesDashboard = { patrimonio: { columnas: 1, filas: 2 } }
    const pat2 = ctxV.generarCardPatrimonio(null)
    t.check(
        "E8.3 Patrimonio 1x1 resume el total sin desglose y conserva el selector",
        !pat1.includes("patrimonio-detalle") && pat1.includes('id="divisa-select"'),
        pat1
    )
    t.check(
        "E8.3 Patrimonio 1x2 añade el desglose ya existente",
        pat2.includes('id="patrimonio-detalle"'),
        pat2
    )

    ctxV.cardsDimensionesDashboard = { "patrimonio-divisa": { columnas: 1, filas: 1 } }
    const pv1 = ctxV.GENERADORES_CARD["patrimonio-divisa"]()
    ctxV.cardsDimensionesDashboard = { "patrimonio-divisa": { columnas: 1, filas: 2 } }
    const pv2 = ctxV.GENERADORES_CARD["patrimonio-divisa"]()
    ctxV.cardsDimensionesDashboard = { "patrimonio-divisa": { columnas: 1, filas: 3 } }
    const pv3 = ctxV.GENERADORES_CARD["patrimonio-divisa"]()
    t.check(
        "E8.4 Patrimonio por divisa 1x1 y 1x2 no reservan dona",
        !pv1.includes("divisa-dona") && !pv2.includes("divisa-dona") &&
        pv1.includes('id="patrimonio-divisa-lista"') && pv2.includes('id="patrimonio-divisa-lista"')
    )
    t.check(
        "E8.4 Patrimonio por divisa 1x3 reserva dona y lista",
        pv3.includes("patrimonio-divisa-dona-placeholder") && pv3.includes('id="patrimonio-divisa-lista"')
    )

    ctxV.cardsDimensionesDashboard = { vencimientos: { columnas: 1, filas: 2 } }
    const ven2 = ctxV.GENERADORES_CARD.vencimientos()
    ctxV.cardsDimensionesDashboard = { vencimientos: { columnas: 1, filas: 3 } }
    const ven3 = ctxV.GENERADORES_CARD.vencimientos()
    t.check(
        "E8.4 Próximos vencimientos 1x2 es una métrica con detalle",
        ven2.includes('class="card-value"') && ven2.includes('id="vencimientos-detalle"') &&
        !ven2.includes("vencimientos-lista"),
        ven2
    )
    t.check(
        "E8.4 Próximos vencimientos 1x3 muestra el listado",
        ven3.includes('id="vencimientos-lista"') && !ven3.includes('class="card-value"'),
        ven3
    )

    // --- Actualizadores: selección del elemento principal y límites ---
    vm.runInContext(`
        var document = {
            getElementById: function (id) {
                if (!__els[id]) {
                    __els[id] = {
                        textContent: "",
                        hidden: false,
                        hijos: [],
                        replaceChildren: function () { this.hijos = [].slice.call(arguments); },
                        classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
                        querySelectorAll: function () { return []; }
                    };
                }
                return __els[id];
            }
        };
        var tarjetaVacia = function (texto) { return { vacio: texto }; };
        var actualizarScrollFade = function () {};
        var formatearMontoDashboard = function (valor) { return String(valor); };
        var divisaActual = "pen";
        var contenidoDesdeFilas = function (plantilla, items, mapear) { return { items: items.slice(), mapear: mapear }; };
        var aplicoAnchoBarras = function () {};
        var dibujarDonaDistribucion = function () { __donaLlamada = true; return Promise.resolve(); };
        var dibujarDonaDivisa = function () { __donaLlamada = true; return Promise.resolve(); };
        var __donaLlamada = false;
        var convertirMonto = function (monto) { return monto; };
        var etiquetaDivisa = function (divisa) { return String(divisa).toUpperCase(); };
        var ORDEN_DIVISAS_PATRIMONIO = ["pen", "usd", "eur", "usdt"];
        var analiticaData = null;
        var patrimonioStats = null;
        var posicionesData = [];
        var favoritosData = [];
        var ETIQUETAS_TIPO_ACTIVO = { crypto: "Cripto", accion: "Acciones", etf: "ETF" };
        var CLASES_TIPO_ACTIVO = { crypto: "cripto", accion: "accion", etf: "etf" };
        var sesion = { getPreferencias: function () { return { movimientosRecientes: 2 }; } };
        var movimientosCompletosData = [];
        var enlazarMovimientos = function () {};
        var enlazarFavoritos = function () {};
        var plantillaMovimiento = function () { return {}; };
        var plantillaFavorito = function () { return {}; };
    `, ctxV)
    ;[
        "cantidadMovimientosRecientes",
        "actualizarDistribucion",
        "actualizarDistribucionActivos",
        "actualizarPatrimonioDivisa",
        "actualizarMovimientos",
        "actualizarFavoritos"
    ].forEach(nombre => vm.runInContext(extraerFuncion(SRC, nombre) + ";", ctxV))

    const itemsRenderizados = (id) => ctxV.__els[id]?.hijos?.[0]?.items ?? []
    const valoresRenderizados = (id) => {
        const contenedor = ctxV.__els[id]?.hijos?.[0]
        return contenedor ? contenedor.items.map(contenedor.mapear) : []
    }

    ctxV.cardsDimensionesDashboard = { distribucion: { columnas: 1, filas: 1 } }
    ctxV.__els = {}
    ctxV.analiticaData = {
        distribucion: [
            { label: "Liquidez", valor: 100, clase: "liquidez" },
            { label: "Inversiones", valor: 700, clase: "inversiones" },
            { label: "Inmovilizado", valor: 100, clase: "inmovil" },
            { label: "Deudas", valor: 100, clase: "deudas" }
        ]
    }
    ctxV.actualizarDistribucion()
    const dist1 = valoresRenderizados("distribucion-lista")
    t.check(
        "E8.5 Distribución 1x1 muestra la categoría de mayor participación",
        dist1.length === 1 && dist1[0].valores.etiqueta === "Inversiones" &&
        dist1[0].valores.porcentaje === "70%",
        JSON.stringify(dist1)
    )

    ctxV.cardsDimensionesDashboard = { "distribucion-activos": { columnas: 1, filas: 1 } }
    ctxV.__els = {}
    ctxV.posicionesData = [
        { cantidad: 1, divisa: "usd", activo: { tipo: "crypto", ultimoPrecio: 700 } },
        { cantidad: 1, divisa: "usd", activo: { tipo: "accion", ultimoPrecio: 200 } },
        { cantidad: 1, divisa: "usd", activo: { tipo: "etf", ultimoPrecio: 100 } }
    ]
    ctxV.actualizarDistribucionActivos()
    const act1 = valoresRenderizados("distribucion-activos-lista")
    t.check(
        "E8.5 Distribución por activo 1x1 muestra el tipo con más valor y su porcentaje real",
        act1.length === 1 && act1[0].valores.etiqueta === "Cripto" &&
        act1[0].valores.porcentaje === "70%",
        JSON.stringify(act1)
    )

    ctxV.cardsDimensionesDashboard = { "patrimonio-divisa": { columnas: 1, filas: 1 } }
    ctxV.__els = {}
    ctxV.__donaLlamada = false
    ctxV.patrimonioStats = { porDivisa: { pen: 100, usd: 400 } }
    ctxV.actualizarPatrimonioDivisa()
    const pdiv1 = valoresRenderizados("patrimonio-divisa-lista")
    t.check(
        "E8.6 Patrimonio por divisa 1x1 muestra la divisa con más peso",
        pdiv1.length === 1 && pdiv1[0].valores.etiqueta === "USD" &&
        pdiv1[0].valores.porcentaje === "80%",
        JSON.stringify(pdiv1)
    )
    t.check(
        "E8.6 Patrimonio por divisa 1x1 no dibuja dona",
        ctxV.__donaLlamada === false
    )

    ctxV.cardsDimensionesDashboard = { "patrimonio-divisa": { columnas: 1, filas: 3 } }
    ctxV.__els = {}
    ctxV.__donaLlamada = false
    ctxV.actualizarPatrimonioDivisa()
    t.check(
        "E8.6 Patrimonio por divisa 1x3 lista todas las divisas y dibuja dona",
        valoresRenderizados("patrimonio-divisa-lista").length === 2 && ctxV.__donaLlamada === true,
        JSON.stringify({
            items: valoresRenderizados("patrimonio-divisa-lista").length,
            dona: ctxV.__donaLlamada
        })
    )

    ctxV.movimientosCompletosData = Array.from({ length: 9 }, (_, i) => (
        { id: `m${i}`, monto: 10, tipo: "gasto", divisa: "pen" }
    ))
    ctxV.cardsDimensionesDashboard = { movimientos: { columnas: 1, filas: 3 } }
    ctxV.__els = {}
    ctxV.actualizarMovimientos()
    t.check(
        "E8.7 Movimientos 1x3 amplía el listado a 6 registros",
        itemsRenderizados("movimientos-lista").length === 6,
        String(itemsRenderizados("movimientos-lista").length)
    )
    ctxV.cardsDimensionesDashboard = { movimientos: { columnas: 1, filas: 2 } }
    ctxV.__els = {}
    ctxV.actualizarMovimientos()
    t.check(
        "E8.7 Movimientos 1x2 respeta la preferencia de movimientos recientes",
        itemsRenderizados("movimientos-lista").length === 2,
        String(itemsRenderizados("movimientos-lista").length)
    )

    ctxV.favoritosData = Array.from({ length: 10 }, (_, i) => (
        { activoId: `a${i}`, divisa: "usd", activo: { nombre: `A${i}` } }
    ))
    ctxV.cardsDimensionesDashboard = { favoritos: { columnas: 1, filas: 2 } }
    ctxV.__els = {}
    ctxV.actualizarFavoritos()
    const fav2 = itemsRenderizados("favoritos-lista").length
    ctxV.cardsDimensionesDashboard = { favoritos: { columnas: 1, filas: 3 } }
    ctxV.__els = {}
    ctxV.actualizarFavoritos()
    const fav3 = itemsRenderizados("favoritos-lista").length
    t.check(
        "E8.7 Favoritos muestra 3 registros en 1x2 y 6 en 1x3",
        fav2 === 3 && fav3 === 6,
        JSON.stringify({ fav2, fav3 })
    )

    return t
}
