// Tests del módulo unificado js/ui/seleccionVisual.js.
// Las funciones de estado se extraen del código real y se evalúan en vm con
// mocks mínimos, sin DOM ni anime.js. Todo el código vm vive dentro de
// ejecutar (fuera falla con "import outside module").
import vm from "node:vm"
import { leer } from "./helpers.mjs"

const src = leer("js/ui/seleccionVisual.js")
const sinExport = src.replace(/^import .*$/gm, "").replace(/export /g, "")

export default async function ejecutar(t) {
    const ctx = {
        seleccionados: new Set(),
        ordenSeleccion: [],
        obtenerIdActivo: (el) => el && el.id,
        onCambioActivo: () => {},
        animarToggle: () => {},
        cancelarPorContexto: () => {},
        contenedorActivo: { querySelector: () => null },
        elementoPorId: () => null,
        Set, Array, Map, Number, Math, Object
    }
    vm.createContext(ctx)
    vm.runInContext(sinExport, ctx)

    // --- seleccionar / estaSeleccionado / obtenerSeleccionados ---
    ctx.seleccionar("a")
    t.check("seleccionar: estaSeleccionado true", ctx.estaSeleccionado("a") === true)
    t.check("seleccionar: estaSeleccionado false otro", ctx.estaSeleccionado("b") === false)
    t.check("seleccionar: obtenerSeleccionados incluye a", [...ctx.obtenerSeleccionados()].includes("a") === true)

    // --- toggle ---
    ctx.toggle("b")
    t.check("toggle: añade b", ctx.estaSeleccionado("b") === true)
    ctx.toggle("b")
    t.check("toggle: quita b", ctx.estaSeleccionado("b") === false)

    // --- deseleccionar ---
    ctx.seleccionar("c")
    ctx.deseleccionar("c")
    t.check("deseleccionar: quita c", ctx.estaSeleccionado("c") === false)

    // --- limpiar ---
    ctx.seleccionar("x")
    ctx.seleccionar("y")
    ctx.limpiar()
    t.check("limpiar: set vacío", ctx.estaSeleccionado("x") === false && ctx.estaSeleccionado("y") === false)

    // --- expandirSeleccion (rango con ancla) ---
    ctx.limpiar()
    const ids = ["a", "b", "c", "d", "e"]
    t.check("expandirSeleccion: sin ancla no expande", ctx.expandirSeleccion(ids, "d") === false)
    ctx.seleccionar("b")
    ctx.expandirSeleccion(ids, "d")
    t.check("expandirSeleccion: marca rango b,c,d", [...ctx.obtenerSeleccionados()].join(",") === "b,c,d")
    t.check("expandirSeleccion: orden tiene 3", ctx.obtenerOrdenSeleccion ? ctx.obtenerOrdenSeleccion().length === 3 : true)
}
