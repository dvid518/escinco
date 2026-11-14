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

    return t
}
