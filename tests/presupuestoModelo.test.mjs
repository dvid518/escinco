import { leer, extraerFuncion } from "./helpers.mjs"
import vm from "node:vm"

function extraerClase(src, nombre) {
    const i = src.indexOf(`class ${nombre}`)
    if (i === -1) throw new Error(`no existe la clase ${nombre}`)
    let nivel = 0, k = i
    for (; k < src.length; k++) {
        if (src[k] === "{") nivel++
        else if (src[k] === "}") { nivel--; if (nivel === 0) break }
    }
    return src.slice(i, k + 1)
}

export default async function ejecutar(t) {
    const srcModelo = leer("js/models/Presupuesto.js")
    const srcEtiquetas = leer("js/core/etiquetas.js")

    const mCats = srcEtiquetas.match(/export const CATEGORIAS_SISTEMA = Object\.freeze\((\[[\s\S]*?\])\)/)
    if (!mCats) throw new Error("no se encontró CATEGORIAS_SISTEMA en core/etiquetas.js")
    const mPeriodos = srcModelo.match(/export const PERIODOS_PRESUPUESTO = Object\.freeze\((\[[\s\S]*?\])\)/)
    if (!mPeriodos) throw new Error("no se encontró PERIODOS_PRESUPUESTO en modelos/Presupuesto.js")

    // Todo dentro del contexto vm: así los métodos de la clase ven ALERTA_*,
    // esCategoriaSistema y PERIODOS_PRESUPUESTO como globales del módulo.
    const ctx = {
        console: { warn() {}, log() {}, error() {} },
        Object, Array, Map, Number, String, Math, Date, Set,
        ALERTA_50: 50, ALERTA_75: 75, ALERTA_90: 90
    }
    vm.createContext(ctx)
    ctx.PERIODOS_PRESUPUESTO = vm.runInContext(mPeriodos[1], ctx)
    ctx.CATEGORIAS_SISTEMA = vm.runInContext(mCats[1], ctx)
    ctx.CATEGORIAS_INDICE = new Map(ctx.CATEGORIAS_SISTEMA.map(c => [c.nombre.toLowerCase(), c]))
    vm.runInContext(extraerFuncion(srcEtiquetas, "esCategoriaSistema").replace("export ", "") + ";", ctx)
    const esCategoriaSistema = vm.runInContext("esCategoriaSistema", ctx)

    // La clase se define dentro de vm: ve ALERTA_*, esCategoriaSistema, etc.
    vm.runInContext(extraerClase(srcModelo, "Presupuesto") + ";", ctx)
    const Presupuesto = vm.runInContext("Presupuesto", ctx)

    const base = {
        nombre: "Arriendo",
        monto: 500,
        divisa: "pen",
        periodo: "mensual",
        fechaInicio: new Date("2026-10-01"),
        categoria: "vivienda",
        etiquetas: [],
        activa: true
    }

    // ------------------------------------------------------------
    // validar()
    // ------------------------------------------------------------
    {
        const valido = () => new Presupuesto({ ...base }).validar()
        t.check("validar: presupuesto válido no lanza", (() => { try { valido(); return true } catch { return false } })() === true)

        const casosInvalidos = [
            ["nombre vacío", { ...base, nombre: "" }],
            ["monto cero", { ...base, monto: 0 }],
            ["monto negativo", { ...base, monto: -10 }],
            ["periodo invalido", { ...base, periodo: "semanal" }],
            ["fechaInicio vacía", { ...base, fechaInicio: null }],
            ["categoria no del sistema", { ...base, categoria: "compras" }],
            ["categoria y etiquetas (no ambos)", { ...base, categoria: "vivienda", etiquetas: ["ocio"] }],
            ["sin categoria ni etiquetas", { ...base, categoria: null, etiquetas: [] }]
        ]
        for (const [desc, datos] of casosInvalidos) {
            let lanzo = false
            try { new Presupuesto(datos).validar() } catch { lanzo = true }
            t.check(`validar: rechaza "${desc}"`, lanzo === true)
        }
    }

    // ------------------------------------------------------------
    // periodoFin
    // ------------------------------------------------------------
    {
        const inicio = new Date("2026-10-01")
        const mensual = new Presupuesto({ ...base, periodo: "mensual", fechaInicio: inicio })
        const anual = new Presupuesto({ ...base, periodo: "anual", fechaInicio: inicio })
        // Mensual: fin distinto de mes de inicio (~30 días después)
        t.check("periodoFin mensual cambió de mes", mensual.periodoFin.getMonth() !== inicio.getMonth())
        // Anual: fin distinto de año de inicio
        t.check("periodoFin anual cambió de año", anual.periodoFin.getFullYear() !== inicio.getFullYear())
        t.check("periodoFin sin fechaInicio es null", new Presupuesto({ ...base, fechaInicio: null }).periodoFin === null)
    }

    // ------------------------------------------------------------
    // estaVigente
    // ------------------------------------------------------------
    {
        const p = new Presupuesto({ ...base, fechaInicio: new Date("2026-10-01") })
        t.check("estaVigente dentro del periodo", p.estaVigente(new Date("2026-10-15")) === true)
        t.check("estaVigente antes del inicio", p.estaVigente(new Date("2026-09-30")) === false)
        t.check("estaVigente después del fin", p.estaVigente(new Date("2026-11-02")) === false)
        t.check("estaVigente en el límite exacto del fin", p.estaVigente(new Date("2026-11-01")) === false)
    }

    // ------------------------------------------------------------
    // porcentaje / estado / estadoTexto
    // ------------------------------------------------------------
    {
        const p = new Presupuesto({ ...base, monto: 1000 })
        t.check("porcentaje gasto 0 = 0", p.porcentaje(0) === 0)
        t.check("porcentaje gasto 500 = 50", p.porcentaje(500) === 50)
        t.check("porcentaje gasto 1000 = 100", p.porcentaje(1000) === 100)
        t.check("porcentaje gasto 1500 = 100 (tope)", p.porcentaje(1500) === 100)
        t.check("estado 0 = dentro", p.estado(0) === "dentro")
        t.check("estado 500 = atencion (50 %)", p.estado(500) === "atencion")
        t.check("estado 750 = alerta (75 %)", p.estado(750) === "alerta")
        t.check("estado 900 = critico (90 %)", p.estado(900) === "critico")
        t.check("estado 1000 = superado (100 %)", p.estado(1000) === "superado")
        t.check("estadoTexto superado", p.estadoTexto(1200) === "Superado")
        t.check("estadoTexto dentro", p.estadoTexto(10) === "Dentro del presupuesto")
    }

    // ------------------------------------------------------------
    // esCategoriaSistema (reutilizada del módulo real)
    // ------------------------------------------------------------
    {
        t.check("esCategoriaSistema reconoce vivienda", esCategoriaSistema("vivienda") === true)
        t.check("esCategoriaSistema reconoce ahorro", esCategoriaSistema("ahorro") === true)
        t.check("esCategoriaSistema rechaza compras", esCategoriaSistema("compras") === false)
        t.check("esCategoriaSistema ignora mayúsculas", esCategoriaSistema("Vivienda") === true)
    }

    return t
}
