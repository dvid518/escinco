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
        if (!ctx.createdElements[id]) {
            ctx.createdElements[id] = {
                textContent: "",
                replaceChildren: function () { this.children = [] },
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

    // Extraer los 5 actualizadores que tienen retorno anticipado sin limpiar
    // skeleton cuando analiticaData es null.
    vm.runInContext(`
        var document = { getElementById: ctx.stubDocumentGetElementById };
        var analiticaData = ctx.analiticaData;
        var divisaActual = ctx.divisaActual;
        var formatearMontoConDivisa = ctx.stubFormatearMontoConDivisa;
        var formatearProximaEjecucion = ctx.stubFormatearProximaEjecucion;
        var tarjetaVacia = ctx.stubTarjetaVacia;
        var actualizarScrollFade = ctx.stubActualizarScrollFade;
        var contenidoDesdeFilas = ctx.stubContenidoDesdeFilas;
        var aplicoAnchoBarras = ctx.stubAplicoAnchoBarras;
        var dibujarDonaDistribucion = ctx.stubDibujarDonaDistribucion;
    `, ctx)

    vm.runInContext(extraerFuncion(SRC, "actualizarFlujoCaja") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarDeudas") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarDistribucion") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarProgramados") + ";", ctx)
    vm.runInContext(extraerFuncion(SRC, "actualizarAlertas") + ";", ctx)

    // Helper para verificar que replaceChildren fue llamado en un elemento.
    function replaceChildrenFueLlamado(id) {
        const el = ctx.createdElements[id]
        return el && el.children !== undefined && el.children.length === 0
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

    return t
}
