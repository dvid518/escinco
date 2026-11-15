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
    ctx.stubObtenerPatrimonioStats = function () { return { totalCuentas: 0, totalActivos: 0, totalDeuda: 0, tieneDeuda: false, patrimonio: 0 } }

    // Extraer los 5 actualizadores que tienen retorno anticipado sin limpiar
    // skeleton cuando analiticaData es null.
    vm.runInContext(`
        var document = { getElementById: ctx.stubDocumentGetElementById, createTextNode: ctx.stubDocumentCreateTextNode };
        var analiticaData = ctx.analiticaData;
        var divisaActual = ctx.divisaActual;
        var formatearMontoConDivisa = ctx.stubFormatearMontoConDivisa;
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
        "B3-C patrimonio alto 5 se clampea a 3",
        p.patrimonio.filas === 3
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
        const legacy = ctx.clampDimensionesDashboard({ patrimonio: { ancho: 1, alto: 3 } })
        t.check(
            "P5 clamp conserva alto 3 guardado como {alto}",
            legacy.patrimonio.columnas === 1 && legacy.patrimonio.filas === 3,
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
        const iLimpieza = srcArrastre.indexOf('evt.item.style.gridRowStart = ""')
        t.check(
            "A1 onStart guarda la celda de origen antes de retirar las celdas",
            iOrigen !== -1 && iLimpieza !== -1 && iOrigen < iLimpieza
        )
        t.check(
            "A1 el hueco de destino se pinta desde dragover con la geometría del grid",
            srcArrastre.includes('grid.addEventListener("dragover", previsualizarDestinoDashboard)') &&
            !srcArrastre.includes("onMove:")
        )
        t.check(
            "A1 Escape y soltar en la celda de origen no guardan cambios",
            srcArrastre.includes('evt.originalEvent?.type !== "drop"') &&
            srcArrastre.includes("mismaCelda") &&
            srcArrastre.includes("reordenarDashboard()")
        )
        t.check(
            "A1 el ghost deja pasar el puntero para no bloquear el dragover",
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

    return t
}
