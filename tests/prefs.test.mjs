// Modelo de preferencias: Firestore guarda SOLO lo que se aparta del default y
// volver a marcar un default produce una BAJA de clave (unset), no una
// reescritura. Se extraen las funciones reales de sesion.js y configuracion.js
// y se evaluan en un contexto VM minimo (esos modulos tocan DOM/Storage).
import vm from "node:vm"
import { leer, extraerFuncion, contarHojas, nuevoReporter } from "./helpers.mjs"

const srcConfig = leer("js/ui/configuracion.js")
const srcSesion = leer("js/core/sesion.js")

export default function ejecutar(t = nuevoReporter("prefs")) {
    const ctx = {
        PREFERENCIAS_POR_DEFECTO: null,
        Number, Object, Array, Math, JSON, Set,
        console: { warn() {}, log() {} }
    }
    vm.createContext(ctx)

    // Extraer SOLO el literal de defaults de sesion.js.
    const iDef = srcSesion.indexOf("export const PREFERENCIAS_POR_DEFECTO")
    const iIni = srcSesion.indexOf("Object.freeze(", iDef)
    let nivel = 0, iFin = iIni
    for (let k = iIni; k < srcSesion.length; k++) {
        if (srcSesion[k] === "(") nivel++
        else if (srcSesion[k] === ")") { nivel--; if (nivel === 0) { iFin = k + 1; break } }
    }
    vm.runInContext(`var PREFERENCIAS_POR_DEFECTO = ${srcSesion.slice(iIni, iFin)};`, ctx)
    const DEFAULTS = ctx.PREFERENCIAS_POR_DEFECTO

    const cargar = (src, nombre) => vm.runInContext(extraerFuncion(src, nombre).replace("export ", "") + ";", ctx)
    cargar(srcSesion, "fusionarProfundo")
    cargar(srcSesion, "esObjetoPlano")
    cargar(srcConfig, "esIgual")
    cargar(srcConfig, "esObjetoSimple")
    cargar(srcConfig, "diferenciasContraDefaults")

    const fusionarProfundo = ctx.fusionarProfundo
    const diferencias = ctx.diferenciasContraDefaults
    const completo = () => fusionarProfundo({}, DEFAULTS)
    const hojas = contarHojas(DEFAULTS)

    console.log(`defaults cargados: ${hojas} hojas en ${Object.keys(DEFAULTS).length} grupos\n`)

    console.log("A) Usuario que no toco nada: no se escribe nada")
    let r = diferencias(completo())
    t.check("set vacio", Object.keys(r.set).length === 0, JSON.stringify(r.set))
    t.check(`unset cubre las ${hojas} hojas`, r.unset.length === hojas, r.unset.length + " de " + hojas)
    t.check("no hay ruta repetida", new Set(r.unset).size === r.unset.length)

    console.log("\nB) Cambia el tema (no es el default)")
    let p = completo()
    p.tema = "light"
    r = diferencias(p)
    t.check("guarda solo tema", JSON.stringify(r.set) === '{"tema":"light"}', JSON.stringify(r.set))
    t.check("no toca paginas", !("paginas" in r.set))

    console.log("\nC) Vuelve el tema al default: se BORRA")
    r = diferencias(completo())
    t.check("tema no esta en set", !("tema" in r.set))
    t.check("tema esta en unset", r.unset.includes("tema"))

    console.log("\nD) Cambia una hoja dentro de un grupo")
    p = completo()
    p.accesibilidad.doodles = true
    r = diferencias(p)
    t.check("guarda la ruta con punto", r.set["accesibilidad.doodles"] === true, JSON.stringify(r.set))
    t.check("no guarda el grupo entero", !("accesibilidad" in r.set))
    t.check("las hojas en default del mismo grupo van a unset", r.unset.includes("accesibilidad.lateralidadCuentaInfo"))

    console.log("\nE) Dos cambios en el mismo grupo")
    p = completo()
    p.accesibilidad.doodles = true
    p.accesibilidad.unClickSeleccion = true
    p.accesibilidad.lateralidadCuentaInfo = "izquierda"
    r = diferencias(p)
    t.check("3 rutas en set", Object.keys(r.set).length === 3, JSON.stringify(r.set))

    console.log("\nF) Cambiar y volver al default")
    p = completo()
    p.accesibilidad.doodles = true
    r = diferencias(p)
    t.check("doodles se guarda", r.set["accesibilidad.doodles"] === true)
    p.accesibilidad.doodles = false
    r = diferencias(p)
    t.check("doodles ya no se guarda", !("accesibilidad.doodles" in r.set))
    t.check("doodles se borra", r.unset.includes("accesibilidad.doodles"))

    console.log("\nG) Casos limite")
    p = completo()
    p.movimientosRecientes = "5"
    r = diferencias(p)
    t.check("string '5' != numero 5, se guarda", r.set.movimientosRecientes === "5")

    p = completo()
    p.resaltarPatrimonio = NaN
    r = diferencias(p)
    t.check("NaN no es el default (0): se guarda o se borra", r.set.resaltarPatrimonio !== undefined || r.unset.includes("resaltarPatrimonio"))

    p = completo()
    delete p.accesibilidad.lateralidadCuentaInfo
    r = diferencias(p)
    t.check("campo ausente en pantalla: no decide", !("accesibilidad.lateralidadCuentaInfo" in r.set) && !r.unset.includes("accesibilidad.lateralidadCuentaInfo"))

    p = completo()
    p.claveFutura = "x"
    r = diferencias(p)
    t.check("clave fuera de los defaults: se ignora", !("claveFutura" in r.set))

    return t
}
