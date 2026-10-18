import { leer, extraerFuncion, nuevoReporter } from "./helpers.mjs"
import vm from "node:vm"

/** Extrae varias funciones y las evalúa en un contexto vm con los símbolos
    libres que necesitan (calcularGastoReal usa etiquetasDelPresupuesto y
    tagsCoincidentes del mismo módulo). */
function extraerYEvaluar(src, nombres, extras = {}) {
    const ctx = {
        console: { warn() {}, log() {}, error() {} },
        Object, Array, Map, Number, String, Math, Date, Set,
        ...extras
    }
    vm.createContext(ctx)
    for (const nombre of nombres) {
        vm.runInContext(extraerFuncion(src, nombre).replace("export ", "") + ";", ctx)
    }
    return ctx
}

export default async function ejecutar(t) {
    const srcServicio = leer("js/services/PresupuestoServicio.js")
    const srcModelo = leer("js/models/Presupuesto.js")

    // Clase Presupuesto real (necesaria para los getters periodoFin, porcentaje, estado...).
    const srcEtiquetas = leer("js/core/etiquetas.js")
    const mCats = srcEtiquetas.match(/export const CATEGORIAS_SISTEMA = Object\.freeze\((\[[\s\S]*?\])\)/)
    const CATEGORIAS_SISTEMA_TEXTO = mCats ? mCats[1] : null
    const ctxModelo = {
        console: { warn() {}, log() {}, error() {} },
        Object, Array, Map, Number, String, Math, Date, Set,
        ALERTA_50: 50, ALERTA_75: 75, ALERTA_90: 90
    }
    vm.createContext(ctxModelo)
    ctxModelo.CATEGORIAS_SISTEMA = vm.runInContext(CATEGORIAS_SISTEMA_TEXTO, ctxModelo)
    vm.runInContext(extraerFuncion(srcEtiquetas, "esCategoriaSistema").replace("export ", "") + ";", ctxModelo)

    function extraerClase(s, nombre) {
        const i = s.indexOf(`class ${nombre}`)
        let nivel = 0, k = i
        for (; k < s.length; k++) {
            if (s[k] === "{") nivel++
            else if (s[k] === "}") { nivel--; if (nivel === 0) break }
        }
        return s.slice(i, k + 1)
    }
    vm.runInContext(extraerClase(srcModelo, "Presupuesto") + ";", ctxModelo)
    const Presupuesto = vm.runInContext(`(${extraerClase(srcModelo, "Presupuesto")})`, ctxModelo)

    const TIPOS_MOVIMIENTO = { GASTO: "gasto" }

    // ============================================
    // calcularGastoReal (pura)
    // ============================================
    {
        const ctx = extraerYEvaluar(srcServicio, [
            "etiquetasDelPresupuesto", "tagsCoincidentes", "calcularGastoReal"
        ], { Presupuesto, TIPOS_MOVIMIENTO })
        const calcularGastoReal = ctx.calcularGastoReal

        const mGastoVivienda = { id: "m1", tipo: "gasto", monto: -100, etiquetas: ["vivienda", "arriendo"], fechaRealizacion: "2026-10-10" }
        const mGastoComida = { id: "m2", tipo: "gasto", monto: -60, etiquetas: ["alimentación", "supermercado"], fechaRealizacion: "2026-10-12" }
        const mIngreso = { id: "m3", tipo: "ingreso", monto: 500, etiquetas: [], fechaRealizacion: "2026-10-05" }   // ignorar (no gasto)
        const mFueraPeriodo = { id: "m4", tipo: "gasto", monto: -40, etiquetas: ["transporte"], fechaRealizacion: "2026-11-05" } // ignorar (fuera de periodo)
        const movimientos = [mGastoVivienda, mGastoComida, mIngreso, mFueraPeriodo]

        const pVivienda = new Presupuesto({ nombre: "Vivienda", monto: 500, divisa: "pen", periodo: "mensual", fechaInicio: new Date("2026-10-01"), categoria: "vivienda", etiquetas: [] })
        // m1: 100 abs / 2 tags * 1 coincidente = 50
        t.check("calcularGastoReal: categoria vivienda = 50", calcularGastoReal(pVivienda, movimientos) === 50)

        const pComida = new Presupuesto({ nombre: "Comida", monto: 200, divisa: "pen", periodo: "mensual", fechaInicio: new Date("2026-10-01"), categoria: null, etiquetas: ["alimentación"] })
        // m2: 60 abs / 2 tags * 1 coincidente = 30
        t.check("calcularGastoReal: etiqueta alimentación = 30", calcularGastoReal(pComida, movimientos) === 30)

        const pViviendaArriendo = new Presupuesto({ nombre: "Vivienda+Arriendo", monto: 200, divisa: "pen", periodo: "mensual", fechaInicio: new Date("2026-10-01"), categoria: null, etiquetas: ["vivienda", "arriendo"] })
        // m1: 100 abs / 2 tags * 2 coincidentes = 100
        t.check("calcularGastoReal: dos etiquetas del mismo gasto = 100", calcularGastoReal(pViviendaArriendo, movimientos) === 100)

        const pVacia = new Presupuesto({ nombre: "Vacia", monto: 100, divisa: "pen", periodo: "mensual", fechaInicio: new Date("2026-10-01"), categoria: null, etiquetas: ["ocio"] })
        t.check("calcularGastoReal: sin coincidencias = 0", calcularGastoReal(pVacia, movimientos) === 0)

        const pSinTags = new Presupuesto({ nombre: "SinTags", monto: 100, divisa: "pen", periodo: "mensual", fechaInicio: new Date("2026-10-01"), categoria: null, etiquetas: ["compras"] })
        const mSinEtiquetas = { id: "m5", tipo: "gasto", monto: -50, etiquetas: [], fechaRealizacion: "2026-10-08" }
        t.check("calcularGastoReal: gasto sin tags = 0", calcularGastoReal(pSinTags, [mSinEtiquetas]) === 0)
    }

    // ============================================
    // obtenerPresupuestosConProgreso
    // ============================================
    {
        const dobleObtenerPresupuestos = async () => [
            new Presupuesto({ nombre: "Arriendo", monto: 1000, divisa: "pen", periodo: "mensual", fechaInicio: new Date("2026-10-01"), categoria: "vivienda", etiquetas: [] }),
            new Presupuesto({ nombre: "Super", monto: 200, divisa: "pen", periodo: "mensual", fechaInicio: new Date("2026-10-01"), categoria: null, etiquetas: ["alimentación"] })
        ]
        const dobleObtenerMovimientos = async () => [
            { id: "m1", tipo: "gasto", monto: -600, etiquetas: ["vivienda", "arriendo"], fechaRealizacion: "2026-10-10", cuenta: "c1" },
            { id: "m2", tipo: "gasto", monto: -60, etiquetas: ["alimentación", "supermercado"], fechaRealizacion: "2026-10-12", cuenta: "c1" },
            { id: "m3", tipo: "ingreso", monto: 500, etiquetas: [], fechaRealizacion: "2026-10-05", cuenta: "c1" }
        ]

        const ctx = {
            console: { warn() {}, log() {}, error() {} },
            Object, Array, Map, Number, String, Math, Date, Set,
            ALERTA_50: 50, ALERTA_75: 75, ALERTA_90: 90,
            calcularGastoReal: async () => 0, // placeholder, se sobreescribe abajo
            TIPOS_MOVIMIENTO,
            obtenerPresupuestos: dobleObtenerPresupuestos,
            obtenerMovimientos: dobleObtenerMovimientos,
            Presupuesto
        }
        vm.createContext(ctx)
        vm.runInContext(extraerFuncion(srcServicio, "calcularGastoReal").replace("export ", "") + ";", ctx)
        vm.runInContext(extraerFuncion(srcServicio, "etiquetasDelPresupuesto").replace("export ", "") + ";", ctx)
        vm.runInContext(extraerFuncion(srcServicio, "tagsCoincidentes").replace("export ", "") + ";", ctx)
        vm.runInContext(extraerFuncion(srcServicio, "obtenerPresupuestosConProgreso").replace("export ", "") + ";", ctx)

        const resultado = await ctx.obtenerPresupuestosConProgreso("u1", {})
        t.check("obtenerPresupuestosConProgreso: devuelve 2 presupuestos", resultado.length === 2, String(resultado.length))

        const arriendo = resultado.find(r => r.presupuesto.nombre === "Arriendo")
        // m1: 600 abs / 2 tags * 1 coincidente = 300
        t.check("Arriendo: gastoReal 300", arriendo.gastoReal === 300, String(arriendo.gastoReal))
        t.check("Arriendo: porcentaje 30%", arriendo.porcentaje === 30, String(arriendo.porcentaje))
        t.check("Arriendo: estado dentro", arriendo.estado === "dentro", arriendo.estado)
        t.check("Arriendo: montoRestante 700", arriendo.montoRestante === 700, String(arriendo.montoRestante))

        const super_ = resultado.find(r => r.presupuesto.nombre === "Super")
        // m2: 60 abs / 2 tags * 1 = 30 → 15%
        t.check("Super: gastoReal 30", super_.gastoReal === 30, String(super_.gastoReal))
        t.check("Super: porcentaje 15%", super_.porcentaje === 15, String(super_.porcentaje))

        // Orden: nivel 1 (categoría) antes que nivel 2 (etiquetas).
        t.check("orden: nivel 1 primero", resultado[0].presupuesto.categoria === "vivienda")
        t.check("orden: nivel 2 después", resultado[1].presupuesto.categoria === null)
    }

    // ============================================
    // crearPresupuestoServicio (inyección de dependencia)
    // ============================================
    {
        const ctxServicio = extraerYEvaluar(srcServicio, ["crearPresupuestoServicio"], { Presupuesto, TIPOS_MOVIMIENTO })
        let creado = null
        const id = await ctxServicio.crearPresupuestoServicio("u1", { nombre: "Arriendo", monto: 500, periodo: "mensual", fechaInicio: new Date("2026-10-01"), categoria: "vivienda", etiquetas: [] }, { crearPresupuesto: async (uid, datos) => { creado = datos; return "pres-1" } })
        t.check("crearPresupuestoServicio: llama al repo", creado !== null)
        t.check("crearPresupuestoServicio: devuelve id del repo", id === "pres-1")
    }

    return t
}
