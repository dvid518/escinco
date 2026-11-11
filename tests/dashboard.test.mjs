import { leer, nuevoReporter } from "./helpers.mjs"

const src = leer("js/pages/dashboard.js")

// Extraemos la lógica de ordenRender del cuerpo de render() para probar el
// fallback sin depender del DOM ni de Firebase.
const bloqueOrdenRender = `
function calcularOrdenRender(cardsVisiblesDashboard, cardsOrdenDashboard) {
    const DEFAULT_CARDS_VISIBLES = ["cuentas", "movimientos", "inversiones", "metas", "grafico"]
    const visibles = cardsVisiblesDashboard.length > 0
        ? cardsVisiblesDashboard
        : [...DEFAULT_CARDS_VISIBLES.filter(id => id !== "patrimonio")];
    const ordenRender = ["patrimonio", ...cardsOrdenDashboard.filter(id => id !== "patrimonio" && visibles.includes(id))];
    return ordenRender
}
`
const calcularOrdenRender = eval(`(${bloqueOrdenRender})`)

const ORDEN_CATALOGO = [
    "cuentas", "movimientos", "inversiones", "metas", "grafico",
    "vencimientos", "favoritos", "presupuestos", "pendientes", "ordenes",
    "estrategias", "flujo-caja", "gastos-periodo", "ingresos-periodo",
    "balance-periodo", "deudas", "distribucion", "patrimonio-divisa",
    "programados", "alertas"
]

export default function ejecutar(t = nuevoReporter("dashboard")) {
    // Caso 1: sin cards visibles (preferencias vacías) -> usa las 5 por defecto
    const r1 = calcularOrdenRender([], ORDEN_CATALOGO)
    t.check("cardsVisiblesDashboard=[] empieza con patrimonio", r1[0] === "patrimonio")
    t.check("cardsVisiblesDashboard=[] incluye cuentas", r1.includes("cuentas"))
    t.check("cardsVisiblesDashboard=[] incluye movimientos", r1.includes("movimientos"))
    t.check("cardsVisiblesDashboard=[] incluye inversiones", r1.includes("inversiones"))
    t.check("cardsVisiblesDashboard=[] incluye metas", r1.includes("metas"))
    t.check("cardsVisiblesDashboard=[] incluye grafico", r1.includes("grafico"))
    t.check("cardsVisiblesDashboard=[] tiene 6 elementos (patrimonio + 5)", r1.length === 6)

    // Caso 2: solo patrimonio -> solo patrimonio (respeta la elección del usuario)
    const r2 = calcularOrdenRender(["patrimonio"], ORDEN_CATALOGO)
    t.check("cardsVisiblesDashboard=['patrimonio'] solo tiene patrimonio", r2.length === 1 && r2[0] === "patrimonio")

    console.log("\nContrato con el codigo real")
    t.check("dashboard.js usa la variable visibles", src.includes("const visibles"))
    t.check("dashboard.js usa DEFAULT_CARDS_VISIBLES en el fallback", src.includes("DEFAULT_CARDS_VISIBLES.filter(id => id !== \"patrimonio\")"))

    return t
}
