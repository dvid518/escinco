// Ida y vuelta de las preferencias de páginas: pintar -> leer -> diff -> escribir.
//
// El fallo que motivó esto: `cargarPreferencias` pintaba las casillas desde el
// grupo CRUDO de Firestore, que está siempre incompleto (solo se guarda lo que
// se aparta de los defaults). Una clave ausente llegaba a `marcarPagina` como
// `undefined` y `undefined !== false` la dejaba MARCADA, así que Configuración
// afirmaba que Inversiones y Trading estaban activas cuando su valor era false.
//
// Para que esto sea una regresión de verdad, no una descripción del problema,
// el test NO reimplementa el pintado: extrae del fuente la expresión de fusión y
// la `marcarPagina` reales y las ejecuta con dobles de `prefs`/`sesion`/`document`.
// `leerTogglePagina` y `diferenciasContraDefaults` también son el código real.
import vm from "node:vm"
import { leer, extraerFuncion } from "./helpers.mjs"

const srcConfig = leer("js/ui/configuracion.js")
const srcSesion = leer("js/core/sesion.js")

// ── Pila real: defaults + helpers ──────────────────────────────────────────
function contextoBase() {
    const ctx = { console: { warn() {}, log() {}, error() {} }, Number, Object, Array, Math, JSON, Set }
    vm.createContext(ctx)

    const iDef = srcSesion.indexOf("export const PREFERENCIAS_POR_DEFECTO")
    const iIni = srcSesion.indexOf("Object.freeze(", iDef)
    let nivel = 0, iFin = iIni
    for (let k = iIni; k < srcSesion.length; k++) {
        if (srcSesion[k] === "(") nivel++
        else if (srcSesion[k] === ")") { nivel--; if (nivel === 0) { iFin = k + 1; break } }
    }
    vm.runInContext(`var PREFERENCIAS_POR_DEFECTO = ${srcSesion.slice(iIni, iFin)};`, ctx)

    const cargar = (src, nombre) =>
        vm.runInContext(extraerFuncion(src, nombre).replace("export ", "") + ";", ctx)
    cargar(srcSesion, "fusionarProfundo")
    cargar(srcSesion, "esObjetoPlano")
    cargar(srcConfig, "esIgual")
    cargar(srcConfig, "esObjetoSimple")
    cargar(srcConfig, "diferenciasContraDefaults")
    return ctx
}

const base = contextoBase()
const DEFAULTS = base.PREFERENCIAS_POR_DEFECTO
const fusionarProfundo = base.fusionarProfundo
const diferenciasContraDefaults = base.diferenciasContraDefaults

// Sin comentarios al recortar expresiones: la nota que explica el fallo cita la
// expresión antigua, y sin limpiarla las comprobaciones la encontrarían.
const codigo = srcConfig.replace(/\/\/[^\n]*/g, "")

const IDS_PAGINAS = ["toggle-dashboard", "toggle-movimientos", "toggle-inversiones", "toggle-trading"]

// ── El pintado REAL, extraído del fuente ──────────────────────────────────

/** Ejecuta la expresión real `const paginas = ...` de `cargarPreferencias`. */
function fusionReal(prefs, sesion) {
    const m = codigo.match(/const paginas = ([\s\S]*?)\n\s*const marcarPagina/)
    if (!m) throw new Error("no se encontro la fusion de `paginas` en configuracion.js")
    const ctx = { prefs, sesion }
    vm.createContext(ctx)
    return vm.runInContext(`(${m[1]})`, ctx)
}

/** Ejecuta la `marcarPagina` real contra un `document` de mentira. */
function fnMarcarPagina(documentStub) {
    const m = codigo.match(/const marcarPagina = ([\s\S]*?)\n\s*marcarPagina\("toggle-dashboard"/)
    if (!m) throw new Error("no se encontro `marcarPagina` en configuracion.js")
    const ctx = { document: documentStub, console: { warn() {} } }
    vm.createContext(ctx)
    vm.runInContext(`var marcarPagina = ${m[1]}`, ctx)
    return ctx.marcarPagina
}

/** Ejecuta `leerTogglePagina` REAL contra un mapa de casillas. */
function fnLeerToggle(controles, paginasSesion) {
    const ctx = {
        document: { getElementById: i => (i in controles ? controles[i] : null) },
        sesion: { getPaginasVisibles: () => paginasSesion }
    }
    vm.createContext(ctx)
    vm.runInContext(extraerFuncion(srcConfig, "leerTogglePagina") + ";", ctx)
    return ctx.leerTogglePagina
}

/**
 * Cadena real completa: lo que hay en Firestore -> lo que se pinta en pantalla.
 * Devuelve las casillas resultantes, que es lo que el usuario ve.
 */
function pintarReal(grupoFirestore, paginasSesion) {
    const paginas = fusionReal(
        grupoFirestore === undefined ? undefined : { paginas: grupoFirestore },
        { getPaginasVisibles: () => paginasSesion }
    )
    const casillas = {}
    const marcar = fnMarcarPagina({ getElementById: id => casillas[id] ?? null })
    for (const id of IDS_PAGINAS) {
        casillas[id] = { checked: false }
        marcar(id, paginas[id.replace(/^toggle-/, "")])
    }
    return casillas
}

/** Lo que `construirPreferencias` leería de esas casillas. */
function leerPaginas(casillas, paginasSesion) {
    const leer = fnLeerToggle(casillas, paginasSesion)
    return {
        dashboard: leer("toggle-dashboard"),
        cuentas: true,
        movimientos: leer("toggle-movimientos"),
        inversiones: leer("toggle-inversiones"),
        trading: leer("toggle-trading"),
        configuracion: true
    }
}

const diffDe = (paginas, sesionBase) =>
    diferenciasContraDefaults({ ...fusionarProfundo({}, DEFAULTS), paginas })

export default function ejecutar(t) {
    const sesionBase = { ...DEFAULTS.paginas }

    console.log("A) Lo que ve el usuario, painted desde el grupo crudo de Firestore")
    // El grupo esta incompleto por diseño: si el usuario no toca una pagina, su
    // clave no esta en el documento (o el grupo no existe).
    for (const [nombre, raw] of [["sin grupo", undefined], ["grupo vacío", {}]]) {
        const casillas = pintarReal(raw, sesionBase)
        t.check(`${nombre}: la casilla de Inversiones sale DESMARCADA`,
            casillas["toggle-inversiones"].checked === false, String(casillas["toggle-inversiones"].checked))
        t.check(`${nombre}: la casilla de Trading sale DESMARCADA`,
            casillas["toggle-trading"].checked === false, String(casillas["toggle-trading"].checked))
    }

    const parcial = pintarReal({ trading: true }, sesionBase)
    t.check("grupo parcial: Trading sale MARCADA", parcial["toggle-trading"].checked === true)
    t.check("grupo parcial: Inversiones NO se inventa, sigue DESMARCADA",
        parcial["toggle-inversiones"].checked === false, String(parcial["toggle-inversiones"].checked))

    console.log("\nB) El fijado del fuente")
    t.check("cargarPreferencias fusiona en vez de sustituir",
        /const paginas = \{\s*\.\.\.sesion\.getPaginasVisibles\(\),\s*\.\.\.\(prefs\?\.paginas \|\| \{\}\)\s*\}/.test(codigo))
    t.check("ya no usa el `||` que se comia los defaults",
        !/prefs\?\.paginas \|\| sesion\.getPaginasVisibles\(\)/.test(codigo))
    t.check("marcarPagina usa `=== true`", /if \(el\) el\.checked = valor === true/.test(codigo))

    // El guard de la race: SOLO dentro de `aplicarPreferencias`, que es donde
    // el DOM puede estar ya desmontado. En `iniciarConfiguracion` releer la
    // pantalla es lo correcto y sigue happening.
    const cuerpoAplicar = extraerFuncion(srcConfig, "aplicarPreferencias")
    t.check("aplicarPreferencias ya no reconstruye lineaBase desde la pantalla",
        !/lineaBase = construirPreferencias\(\)/.test(cuerpoAplicar) &&
        /lineaBase = preferencias/.test(cuerpoAplicar))

    console.log("\nC) Un control ausente no se lee como activado")
    const sinControl = fnLeerToggle({}, sesionBase)
    t.check("sin checkbox y sesion en false -> false", sinControl("toggle-inversiones") === false,
        String(sinControl("toggle-inversiones")))
    const conSesionEncendida = fnLeerToggle({}, { ...sesionBase, inversiones: true })
    t.check("sin checkbox y sesion en true -> true (respeta la sesion)",
        conSesionEncendida("toggle-inversiones") === true)
    const desmarcada = fnLeerToggle({ "toggle-inversiones": { checked: false } },
        { ...sesionBase, inversiones: true })
    t.check("checkbox desmarcado -> false, aunque la sesion diga true (manda el control)",
        desmarcada("toggle-inversiones") === false)

    console.log("\nD) Ida y vuelta: el usuario marca Inversiones y Trading y guarda")
    const marcadas = {
        "toggle-dashboard": { checked: true },
        "toggle-movimientos": { checked: true },
        "toggle-inversiones": { checked: true },
        "toggle-trading": { checked: true }
    }
    const diffOn = diffDe(leerPaginas(marcadas, sesionBase), sesionBase)
    t.check("set incluye paginas.inversiones=true", diffOn.set["paginas.inversiones"] === true,
        JSON.stringify(diffOn.set["paginas.inversiones"]))
    t.check("set incluye paginas.trading=true", diffOn.set["paginas.trading"] === true)
    t.check("no se manda unset para ellas",
        !diffOn.unset.includes("paginas.inversiones") && !diffOn.unset.includes("paginas.trading"))

    console.log("\nE) Ida y vuelta: vuelve a desmarcarlas y guarda")
    const apagadas = Object.fromEntries(
        Object.entries(marcadas).map(([k, v]) => [k, { checked: false }])
    )
    const diffOff = diffDe(leerPaginas(apagadas, sesionBase), sesionBase)
    t.check("unset incluye paginas.inversiones (se BORRA, no se escribe false)",
        diffOff.unset.includes("paginas.inversiones"), JSON.stringify(diffOff.unset))
    t.check("unset incluye paginas.trading", diffOff.unset.includes("paginas.trading"))
    t.check("no hay nada en set para ellas",
        !("paginas.inversiones" in diffOff.set) && !("paginas.trading" in diffOff.set))

    console.log("\nF) Un usuario que no toca nada no genera escrituras")
    const diffNada = diferenciasContraDefaults(fusionarProfundo({}, DEFAULTS))
    t.check("set no menciona ninguna pagina",
        Object.keys(diffNada.set).every(k => !k.startsWith("paginas.")),
        Object.keys(diffNada.set).join(", ") || "set vacio")

    console.log("\nG) Regresion: el escenario que antes encendia Inversiones")
    // Guardar sin tocar nada, con el grupo crudo {} tal como venia de Firestore.
    // Este es exactamente el caso que disparo el bug.
    const pintadas = pintarReal({}, sesionBase)
    t.check("la casilla de Inversiones sale DESMARCADA",
        pintadas["toggle-inversiones"].checked === false, String(pintadas["toggle-inversiones"].checked))
    const diffAhora = diffDe(leerPaginas(pintadas, sesionBase), sesionBase)
    t.check("y guardar eso NO escribe paginas.inversiones",
        !("paginas.inversiones" in diffAhora.set), JSON.stringify(diffAhora.set))

    // El estado anterior, escrito a mano, para dejar por registrada la
    // diferencia. No es codigo de produccion: es el `||` viejo mas el
    // `!== false` viejo.
    function comoAntes(grupo, sesion) {
        const paginas = grupo || sesion
        return Object.fromEntries(IDS_PAGINAS.map(id => [
            id, { checked: paginas[id.replace(/^toggle-/, "")] !== false }
        ]))
    }
    const casillasAntes = comoAntes({}, sesionBase)
    t.check("antes: el grupo crudo {} dejaba Inversiones marcada",
        casillasAntes["toggle-inversiones"].checked === true)
    const diffAntes = diffDe(leerPaginas(casillasAntes, sesionBase), sesionBase)
    t.check("antes: eso escribia paginas.inversiones=true sin que nadie tocara nada",
        diffAntes.set["paginas.inversiones"] === true, JSON.stringify(diffAntes.set))

    return t
}