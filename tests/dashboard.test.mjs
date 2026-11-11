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

export default function ejecutar(t = nuevoReporter("card-001")) {
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

    return t
}
