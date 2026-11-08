// Gestión de favoritos con los botones de siempre de la lastbar.
//
// Los favoritos NO tienen items propios en la barra: se editan y se borran con
// los mismos botones que los movimientos, que solo se activan y desactivan
// (`desact`). Nada aparece ni desaparece.
import vm from "node:vm"
import { leer, extraerFuncion } from "./helpers.mjs"

const srcLastbar = leer("js/core/lastbar.js")
const srcMov = leer("js/pages/movimientos.js")
const srcServicio = leer("js/services/FavoritoServicio.js")
const srcModal = leer("js/ui/modal.js")

// ── Doble de la lastbar ────────────────────────────────────────────────────
function crearLastbarFalsa(seleccionados = new Set(), favs = []) {
    const items = {}
    const ACCIONES = ["editar-movimiento", "etiquetar-movimiento", "eliminar-movimiento"]
    for (const accion of ACCIONES) {
        const clases = new Set()
        items[accion] = {
            dataset: { accion }, hidden: false, clases,
            classList: {
                toggle: (c, v) => { if (v) clases.add(c); else clases.delete(c) },
                add: c => clases.add(c),
                remove: c => clases.delete(c),
                contains: c => clases.has(c)
            }
        }
    }
    const ctx = {
        console: { warn() {}, log() {}, error() {} },
        Object, Array, Math, JSON, Set, Number,
        document: {
            querySelectorAll: sel => {
                const accion = /data-accion="([^"]+)"/.exec(sel)?.[1]
                return accion && items[accion] ? [items[accion]] : []
            },
            getElementById: () => null
        }
    }
    vm.createContext(ctx)
    vm.runInContext(extraerFuncion(srcMov, "actualizarEstadoLastbar").replace("export ", "") + ";", ctx)
    ctx.seleccionados = new Set()
    ctx.seleccionadosFavoritos = seleccionados
    ctx.favoritosCache = favs
    return { ctx, items, desact: a => !!items[a]?.clases.has("desact"), oculto: a => !!items[a]?.hidden }
}

function correrCon(src, nombre, dobles, extras = []) {
    const ctx = { console: { warn() {}, log() {}, error() {} }, Object, Array, Math, JSON, Set, Number, ...dobles }
    vm.createContext(ctx)
    vm.runInContext(extraerFuncion(src, nombre).replace("export ", "") + ";", ctx)
    for (const e of extras) vm.runInContext(e + ";", ctx)
    return ctx
}

const FAVS = [
    { id: "f1", nombre: "Café", tipo: "gasto", cuenta: "c1", monto: -5, divisa: "pen", etiquetas: [] },
    { id: "f2", nombre: "Sueldo", tipo: "ingreso", cuenta: "c1", monto: 900, divisa: "pen", etiquetas: [] }
]

export default async function ejecutar(t) {
    console.log("A) La lastbar no tiene items propios de favoritos")
    for (const accion of ["editar-favorito", "ejecutar-favorito", "cancelar-favorito"]) {
        t.check(`no existe el item "${accion}"`, !new RegExp(`data-accion="${accion}"`).test(srcLastbar))
        t.check(`no existe la acción "${accion}"`, !new RegExp(`"${accion}"\\s*:`).test(srcLastbar))
    }
    t.check("no queda el span de contexto", !/lastbar-contexto/.test(srcLastbar))
    t.check("ni su CSS", !/lastbar-contexto/.test(leer("css/movimientos.css")))

    console.log("\nB) Nada se oculta: los items siempre están visibles")
    for (const [nombre, sel] of [["sin selección", new Set()], ["con 1 favorito", new Set(["f1"])], ["con 3 favoritos", new Set(["f1", "f2", "f3"])]]) {
        const { ctx, oculto } = crearLastbarFalsa(sel, FAVS)
        ctx.actualizarEstadoLastbar()
        t.check(`${nombre}: ningún item se oculta`,
            !oculto("editar-movimiento") && !oculto("etiquetar-movimiento") && !oculto("eliminar-movimiento"))
    }

    console.log("\nC) Activar/desactivar según lo seleccionado")
    {
        const { ctx, desact } = crearLastbarFalsa(new Set(), FAVS)
        ctx.actualizarEstadoLastbar()
        t.check("nada seleccionado: editar y eliminar desactivos",
            desact("editar-movimiento") && desact("eliminar-movimiento"))
    }
    {
        const { ctx, desact } = crearLastbarFalsa(new Set(["m1"]), FAVS)
        ctx.seleccionados = new Set(["m1"])
        ctx.actualizarEstadoLastbar()
        t.check("1 movimiento: editar y eliminar activos, etiquetar activo",
            !desact("editar-movimiento") && !desact("eliminar-movimiento") && !desact("etiquetar-movimiento"))
    }
    // El botón Etiquetar va siempre activo, con selección o sin ella.
    for (const [nombre, sel] of [["sin selección", new Set()], ["con movimientos", new Set(["m1"])]]) {
        const { ctx, desact } = crearLastbarFalsa(sel, FAVS)
        if (nombre === "con movimientos") ctx.seleccionados = new Set(["m1"])
        ctx.actualizarEstadoLastbar()
        t.check(`etiquetar siempre activo (${nombre})`, desact("etiquetar-movimiento") === false)
    }
    {
        const { ctx, desact } = crearLastbarFalsa(new Set(), FAVS)
        ctx.seleccionados = new Set(["m1", "m2"])
        ctx.actualizarEstadoLastbar()
        t.check("2 movimientos: editar DESACTIVO (solo se edita de a uno)",
            desact("editar-movimiento") === true)
        t.check("2 movimientos: eliminar sigue activo", desact("eliminar-movimiento") === false)
    }

    console.log("\nD) El botón Editar edita el movimiento seleccionado")
    {
        const abiertas = []
        const ctx = correrCon(srcMov, "editarSeleccionados", {}, [
            "var seleccionadosFavoritos = new Set()",
            "var seleccionados = new Set(['m1'])",
            "var sel = { ids: seleccionados, orden: [] }",
            "var movimientos = [{ id: 'm1', tipo: 'gasto' }]",
            "function limpiarSeleccionHelper(){}",
            "function actualizarSeleccionEnDOM(){}",
            "function actualizarEstadoLastbar(){}",
            "function abrirFormularioMovimiento(tipo){ abiertas.push(tipo) }"
        ])
        ctx.abiertas = abiertas
        await ctx.editarSeleccionados()
        t.check("edita el movimiento marcado", abiertas.length === 1 && abiertas[0] === "gasto", JSON.stringify(abiertas))
    }
    {
        const abiertas = []
        const ctx = correrCon(srcMov, "editarSeleccionados", {}, [
            "var seleccionadosFavoritos = new Set()",
            "var seleccionados = new Set(['m1','m2'])",
            "var movimientos = []",
            "function limpiarSeleccion(){}",
            "function abrirFormularioMovimiento(){ abiertas.push('mov') }"
        ])
        ctx.abiertas = abiertas
        await ctx.editarSeleccionados()
        t.check("con 2 movimientos no abre nada (queda deseleccionado)",
            abiertas.length === 0, JSON.stringify(abiertas))
    }

    console.log("\nE) El botón Eliminar borra los movimientos seleccionados")
    {
        const ctx = correrCon(srcMov, "eliminarSeleccionados", {}, [
            "var seleccionadosFavoritos = new Set()",
            "var seleccionados = new Set()",
            "var borradosMov = 0",
            "function abrirModalEliminarVarios(){ borradosMov++ }"
        ])
        await ctx.eliminarSeleccionados()
        t.check("sin selección no borra nada", ctx.borradosMov === 0, String(ctx.borradosMov))
    }
    {
        const ctx = correrCon(srcMov, "eliminarSeleccionados", {}, [
            "var seleccionadosFavoritos = new Set()",
            "var seleccionados = new Set(['m1'])",
            "var sel = { ids: seleccionados, orden: [] }",
            "var movimientos = [{ id: 'm1' }]",
            "var borradosMov = 0",
            "function limpiarSeleccionHelper(){}",
            "function actualizarSeleccionEnDOM(){}",
            "function actualizarEstadoLastbar(){}",
            "function abrirModalEliminarVarios(l){ borradosMov = l.length }"
        ])
        await ctx.eliminarSeleccionados()
        t.check("borra los movimientos seleccionados",
            ctx.borradosMov === 1, String(ctx.borradosMov))
    }

    console.log("\nF) Ejecutar sigue funcionando (doble click en el contenedor)")
    {
        const ctx = correrCon(srcServicio, "ejecutarFavorito", {
            registrarMovimiento: async (u, tipo, datos) => { ctx.registros.push(datos) }
        }, [
            "var getFechaHoy = () => '2026-10-18'",
            `var TIPOS_FAVORITO = ${/const TIPOS_FAVORITO = (\[[^\]]*\])/.exec(srcServicio)[1]}`,
            extraerFuncion(srcServicio, "esTipoFavoritable") + ";"
        ])
        ctx.registros = []
        await ctx.ejecutarFavorito("u1", FAVS[0])
        t.check("el movimiento lleva favoritoId", ctx.registros[0]?.favoritoId === "f1", JSON.stringify(ctx.registros[0]?.favoritoId))
    }

    console.log("\nG) La card de una cuenta no lleva el botón de favoritos")
    const cuentas = leer("js/pages/cuentas.js")
    const usos = [...cuentas.matchAll(/contenidoDesdeFilas\("tpl-movimiento-item"/g)]
    const filtrados = [...cuentas.matchAll(/sinBotonFavorito\(\s*contenidoDesdeFilas\("tpl-movimiento-item"/g)]
    t.check("cuentas.js usa la card de movimientos", usos.length === 2, String(usos.length))
    t.check("los 2 usos pasan por sinBotonFavorito()", filtrados.length === 2, String(filtrados.length))

    console.log("\nH) La card tiene un solo fondo")
    const css = leer("css/movimientos.css")
    const main = /:is\(#lista-movimientos, #lista-movimientos-cuenta\) \.card-item-main \{([\s\S]*?)\n\}/.exec(css)?.[1] || ""
    t.check(".card-item-main ya no se pinta encima (sin background: inherit)",
        !/background:\s*inherit/.test(main), main.match(/background:[^;]*/)?.[0] || "sin background")
    t.check("ni con z-index por encima de la fila", !/z-index:\s*1/.test(main))

    revisarEtiquetas(t)
    return t
}

// =========================================================================
// ETIQUETAS EN LOTE
// =========================================================================
function revisarEtiquetas(t) {
    const eti = leer("js/ui/etiquetas.js")

    console.log("\nI) Etiquetado en lote: tri-estado")
    t.check("las activas se calculan (enTodos)", /enTodos/.test(srcMov))
    t.check("las parciales también (enAlguno)", /enAlguno/.test(srcMov))
    t.check("el selector pinta .activo", /toggle\("activo"/.test(eti))
    t.check("y .semi para las parciales", /toggle\("semi"/.test(eti))
    t.check("el catálogo se puede pasar al selector (para las huérfanas)",
        /opciones\.catalogo|catalogo:\s*/.test(eti) && !/catalogo = await obtenerEtiquetas\(uid\)[\s\S]{0,40}opciones/.test(eti))

    console.log("\nJ) XSS en el nombre de la etiqueta")
    const elemento = {
        textContent: undefined, atributos: {}, innerHTML: undefined,
        setAttribute(k, v) { this.atributos[k] = v },
        hasAttribute() { return false }, appendChild() {}
    }
    const ctx = {
        console, Object, Array, JSON, Set,
        fragmento: { querySelector: sel => (sel.includes('"nombre"') ? elemento : null) }
    }
    vm.createContext(ctx)
    vm.runInContext(
        extraerFuncion(srcModal, "rellenarHuecos") + ";" +
        "var PROPIEDADES = ['checked','disabled','selected','hidden','indeterminate'];",
        ctx
    )
    const malicioso = '<img src=x onerror=alert(1)>'
    ctx.rellenarHuecos(ctx.fragmento, { valores: { nombre: malicioso } })
    t.check("el nombre se escribe en textContent", elemento.textContent === malicioso)
    t.check("nunca en innerHTML", elemento.innerHTML === undefined)
}