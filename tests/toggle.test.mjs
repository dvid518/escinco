// Test FUNCIONAL de conectarToggleDivisas: extrae la funcion REAL de
// cuentas.js y la ejecuta contra un DOM simulado para comprobar la interaccion
// de los toggles de divisa (activar, desactivar, bloquear, sincronizar saldo).
import { leer, extraerFuncion, nuevoReporter } from "./helpers.mjs"

const src = leer("js/pages/cuentas.js")

class ClassList {
    constructor(init = []) { this.set = new Set(init) }
    add(c) { this.set.add(c) }
    contains(c) { return this.set.has(c) }
    remove(c) { this.set.delete(c) }
    toggle(c, force) { force ? this.set.add(c) : this.set.delete(c) }
    values() { return [...this.set] }
}

function opcion(divisa, activa = false) {
    return {
        dataset: { divisa },
        classList: new ClassList(activa ? ["active"] : []),
        attrs: {},
        title: "",
        _lis: [],
        setAttribute(k, v) { this.attrs[k] = v; if (k === "aria-disabled") this.ariaDisabled = v },
        removeAttribute(k) { delete this.attrs[k] },
        addEventListener(ev, fn) { if (ev === "click") this._lis.push(fn) },
        clic() { this._lis.forEach(f => f()) }
    }
}

function raizCon(opts, bloqueadas = []) {
    const saldos = {}
    const raiz = {
        opts,
        saldos,
        querySelectorAll() { return this.opts },
        querySelector(sel) {
            const m = sel.match(/saldo-divisa\[data-divisa="(\w+)"\]/)
            if (!m) return null
            saldos[m[1]] = saldos[m[1]] || { divisa: m[1], hidden: true, dataset: { divisa: m[1] } }
            return saldos[m[1]]
        }
    }
    return raiz
}

export default function ejecutar(t = nuevoReporter("toggle")) {
    const avisos = []
    const conectar = new Function("mostrarNotificacion", `return (${extraerFuncion(src, "conectarToggleDivisas")})`)(
        (tipo, msg) => avisos.push({ tipo, msg })
    )

    console.log("Caso 1 · crear: cada clic activa su divisa")
    let raiz = raizCon([opcion("pen"), opcion("usd"), opcion("usdt")])
    conectar(raiz)
    raiz.opts[0].clic()
    raiz.opts[1].clic()
    t.check("PEN activa", raiz.opts[0].classList.contains("active"))
    t.check("USD activa", raiz.opts[1].classList.contains("active"))
    t.check("USDT sigue inactiva", !raiz.opts[2].classList.contains("active"))

    console.log("\nCaso 2 · con 2 activas, repetir el clic desactiva")
    raiz.opts[0].clic()
    t.check("PEN se desactiva", !raiz.opts[0].classList.contains("active"))
    t.check("USD sigue activa", raiz.opts[1].classList.contains("active"))

    console.log("\nCaso 3 · la ultima divisa activa no se apaga (avisa)")
    avisos.length = 0
    raiz = raizCon([opcion("pen", true), opcion("usd")])
    conectar(raiz)
    raiz.opts[0].clic()
    t.check("PEN sigue activa", raiz.opts[0].classList.contains("active"))
    t.check("se mostro el aviso", avisos.some(a => a.tipo === "info"), JSON.stringify(avisos))

    console.log("\nCaso 4 · divisa bloqueada (ya existe): activa y no se puede quitar")
    raiz = raizCon([opcion("pen"), opcion("usd"), opcion("usdt")])
    conectar(raiz, ["pen"])
    t.check("PEN arranca activa", raiz.opts[0].classList.contains("active"))
    t.check("PEN con aria-disabled", raiz.opts[0].attrs["aria-disabled"] === "true")
    t.check("PEN con title explicativo", raiz.opts[0].title.length > 0)
    raiz.opts[0].clic()
    t.check("PEN sigue activa tras clic", raiz.opts[0].classList.contains("active"))
    raiz.opts[1].clic()
    t.check("USD se puede anadir", raiz.opts[1].classList.contains("active"))

    console.log("\nCaso 5 · el bloque de saldo sigue a la divisa")
    raiz = raizCon([opcion("pen"), opcion("usd")])
    conectar(raiz)
    t.check("PEN oculto antes de clicar", raiz.saldos.pen.hidden === true)
    raiz.opts[0].clic()
    t.check("PEN visible tras clicar", raiz.saldos.pen.hidden === false)
    raiz.opts[1].clic()
    t.check("USD visible tras clicar", raiz.saldos.usd.hidden === false)

    console.log("\nCaso 6 · entradas degeneradas no rompen")
    let lanzo = false
    try { conectar(null) } catch { lanzo = true }
    t.check("raiz null no lanza", !lanzo)
    lanzo = false
    try { conectar({ querySelectorAll: () => [] }) } catch { lanzo = true }
    t.check("raiz sin toggles no lanza", !lanzo)

    return t
}
