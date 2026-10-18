// La pestaña "Inversiones" disappearing aunque `paginas.inversiones` valía true.
//
// La cadena completa es: Firestore -> `sesion.setPreferencias` (fusiona el grupo
// `paginas`) -> `aplicarAparienciaInicial` (quita `.nav-oculto`) -> router
// (`paginasVisibles[page] === false` redirige a dashboard).
//
// El riesgo real está en la FUSIÓN: `paginas` es un grupo y el documento solo
// guarda las claves que el usuario tocó, así que un grupo guardado
// parcialmente no puede pisar los defaults. Si eso se rompe, el usuario ve la
// pestaña pero el router la deniega (o al revés).
import vm from "node:vm"
import { leer, extraerFuncion } from "./helpers.mjs"

const srcSesion = leer("js/core/sesion.js")
const srcApp = leer("js/core/app.js")
const srcRouter = leer("js/core/router.js")

// --- Sesion real, evaluada en un contexto mínimo ---
function cargarSesion() {
    const ctx = { console: { log() {}, warn() {}, error() {} }, Number, Object, Array, Math, JSON, Set }
    vm.createContext(ctx)

    // Defaults (el primer `Object.freeze(` tras la declaración).
    const iDef = srcSesion.indexOf("export const PREFERENCIAS_POR_DEFECTO")
    const iIni = srcSesion.indexOf("Object.freeze(", iDef)
    let nivel = 0, iFin = iIni
    for (let k = iIni; k < srcSesion.length; k++) {
        if (srcSesion[k] === "(") nivel++
        else if (srcSesion[k] === ")") { nivel--; if (nivel === 0) { iFin = k + 1; break } }
    }
    vm.runInContext(`var PREFERENCIAS_POR_DEFECTO = ${srcSesion.slice(iIni, iFin)};`, ctx)

    const cargar = nombre => vm.runInContext(
        extraerFuncion(srcSesion, nombre).replace("export ", "") + ";", ctx)
    // `fusionarProfundo` llama a `esObjetoPlano`, así que esta va primero.
    cargar("esObjetoPlano")
    cargar("fusionarProfundo")
    return ctx
}

const ctx = cargarSesion()
const fusionarProfundo = ctx.fusionarProfundo
const DEFAULTS = ctx.PREFERENCIAS_POR_DEFECTO

// El helper `setPreferencias` fusiona `preferencias.paginas` sobre lo que ya
// hay. Se replica esa parte porque el método toca sessionStorage.
function fusionarPaginas(prefs, entrante) {
    return { ...prefs, paginas: { ...prefs.paginas, ...entrante } }
}

// --- Lo que hace la app al arrancar, según app.js:60-62 y 113-125 ---
const DE_FIRESTORE = { paginas: { inversiones: true, trading: true } }

const trasCargar = fusionarPaginas(fusionarProfundo({}, DEFAULTS), DE_FIRESTORE.paginas)
const paginas = trasCargar.paginas

// El guard del router (router.js:204)
const paginaPermitida = page => paginas[page] !== false

// --- Qué tendría que hacer `aplicarAparienciaInicial` (app.js:118-125) ---
// `paginas[page] === false` -> `nav-oculto`; cualquier otro valor -> visible.
const pestanaVisible = page => paginas[page] !== false

export default function ejecutar(t) {
    console.log("A) El usuario tiene paginas.inversiones = true en Firestore")
    t.check("tras cargar, la preferencia se lee como true", paginas.inversiones === true, JSON.stringify(paginas.inversiones))
    t.check("la pestaña NO se marca nav-oculto", pestanaVisible("inversiones"))
    t.check("el router NO redirige a dashboard", paginaPermitida("inversiones"))
    t.check("y trading, que se habilita en el mismo sitio", pestanaVisible("trading") && paginaPermitida("trading"))

    console.log("\nB) La fusión no pisa los defaults del resto del grupo")
    t.check("el resto de páginas conserva su default", paginas.dashboard === true && paginas.cuentas === true)
    t.check("una página no guardada sigue con su default (inversiones=false si no se tocó)",
        fusionarProfundo({}, DEFAULTS).paginas.inversiones === false)

    console.log("\nC) Coherencia entre lo que ve el usuario y lo que deja el router")
    for (const page of ["dashboard", "cuentas", "movimientos", "inversiones", "trading", "configuracion"]) {
        t.check(`${page}: pestaña y router coinciden`, pestanaVisible(page) === paginaPermitida(page))
    }

    console.log("\nD) El código mantiene la sincronía que hace funcionar la cadena")
    t.check("app.js quita nav-oculto cuando la página NO vale false",
        /nav-oculto[\s\S]{0,200}remove/.test(srcApp) && /paginas\[page\]\s*===\s*false/.test(srcApp))
    t.check("router.js deniega solo con === false (no con !valor)",
        /paginasVisibles\[page\]\s*===\s*false/.test(srcRouter))
    t.check("dashboard.js no pisa el grupo paginas al guardar sus cards",
        !/setPreferencias\(\{\s*paginas/.test(leer("js/pages/dashboard.js")))

    return t
}