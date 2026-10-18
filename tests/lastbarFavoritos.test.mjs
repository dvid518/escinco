// Lastbar de favoritos: alternancia de items, contexto y acciones.
//
// Igual que en el resto de tests del repo, aquí se ejecuta el CÓDIGO REAL
// extraído del fuente con dobles mínimos, no una reimplementación: si
// `actualizarEstadoLastbar` deja de alternar los items, esto falla.
import vm from "node:vm"
import { leer, extraerFuncion } from "./helpers.mjs"

const srcLastbar = leer("js/core/lastbar.js")
const srcMov = leer("js/pages/movimientos.js")
const srcServicio = leer("js/services/FavoritoServicio.js")
const srcModal = leer("js/ui/modal.js")

const codigo = s => s.replace(/\/\/[^\n]*/g, "")

// ── Doble de la lastbar en el DOM ───────────────────────────────────────────
function crearLastbarFalsa(seleccionados = new Set(), favs = []) {
    const items = {}
    const ACCIONES = [
        "editar-movimiento", "etiquetar-movimiento", "eliminar-movimiento",
        "editar-favorito", "ejecutar-favorito", "cancelar-favorito"
    ]
    for (const accion of ACCIONES) {
        items[accion] = { dataset: { accion }, hidden: false, clases: new Set(), classList: null }
        items[accion].classList = { toggle: (c, v) => { if (v) items[accion].clases.add(c) } }
    }
    const contexto = { textContent: "", hidden: false }
    const ctx = {
        console: { warn() {}, log() {}, error() {} },
        Object, Array, Math, JSON, Set, Number,
        document: {
            // `.lastbar .item` devuelve todos; los selectores literales por
            // acción, solo ese item.
            querySelectorAll: sel => {
                if (sel.includes(".lastbar .item")) return Object.values(items)
                const accion = /data-accion="([^"]+)"/.exec(sel)?.[1]
                return accion && items[accion] ? [items[accion]] : []
            },
            getElementById: id => (id === "lastbar-contexto" ? contexto : null)
        }
    }
    vm.createContext(ctx)
    // Las dos listas de acciones son `const` de módulo y `textoContextoFavoritos`
    // es otra función del módulo: viven fuera de `actualizarEstadoLastbar`, así
    // que el contexto tiene que reproducirlas. Se leen del fuente, no se
    // reescriben.
    const mov = /const ACCIONES_MOVIMIENTO_LASTBAR = (\[[^\]]*\])/.exec(srcMov)?.[1]
    const fav = /const ACCIONES_FAVORITO_LASTBAR = (\[[^\]]*\])/.exec(srcMov)?.[1]
    if (!mov || !fav) throw new Error("no se encontraron ACCIONES_*_LASTBAR en movimientos.js")
    vm.runInContext(`var ACCIONES_MOVIMIENTO_LASTBAR = ${mov};`, ctx)
    vm.runInContext(`var ACCIONES_FAVORITO_LASTBAR = ${fav};`, ctx)
    vm.runInContext(extraerFuncion(srcMov, "textoContextoFavoritos") + ";", ctx)
    vm.runInContext(extraerFuncion(srcMov, "actualizarEstadoLastbar").replace("export ", "") + ";", ctx)
    ctx.seleccionados = new Set()
    ctx.seleccionadosFavoritos = seleccionados
    ctx.favoritosCache = favs
    return { ctx, items, contexto, visibles: a => items[a] && !items[a].hidden, desactivado: a => !!items[a]?.clases.has("desact") }
}

// ── Utilidad: correr una función del módulo con dobles ─────────────────────
function correrCon(src, nombre, dobles, extras = []) {
    const ctx = { console: { warn() {}, log() {}, error() {} }, Object, Array, Math, JSON, Set, Number, ...dobles }
    vm.createContext(ctx)
    vm.runInContext(extraerFuncion(src, nombre).replace("export ", "") + ";", ctx)
    for (const extra of extras) vm.runInContext(extra + ";", ctx)
    return ctx
}

const FAVS = [
    { id: "f1", nombre: "Café", tipo: "gasto", cuenta: "c1", monto: -5, divisa: "pen", etiquetas: [] },
    { id: "f2", nombre: "Sueldo", tipo: "ingreso", cuenta: "c1", monto: 900, divisa: "pen", etiquetas: [] }
]

export default async function ejecutar(t) {
    console.log("A) Sin selección: los items de favoritos están ocultos")
    {
        const { ctx, visibles, desactivado } = crearLastbarFalsa(new Set(), FAVS)
        ctx.actualizarEstadoLastbar()
        t.check("editar-favorito oculto", !visibles("editar-favorito"))
        t.check("ejecutar-favorito oculto", !visibles("ejecutar-favorito"))
        t.check("cancelar-favorito oculto", !visibles("cancelar-favorito"))
        t.check("los items de movimiento visibles",
            visibles("editar-movimiento") && visibles("etiquetar-movimiento") && visibles("eliminar-movimiento"))
        t.check("sin nada seleccionado, eliminar está desactivo", desactivado("eliminar-movimiento"))
    }

    console.log("\nB) Con un favorito seleccionado: se invierte el grupo")
    {
        const sel = new Set(["f1"])
        const { ctx, visibles, desactivado } = crearLastbarFalsa(sel, FAVS)
        ctx.actualizarEstadoLastbar()
        t.check("editar-favorito visible", visibles("editar-favorito"))
        t.check("ejecutar-favorito visible", visibles("ejecutar-favorito"))
        t.check("cancelar-favorito visible", visibles("cancelar-favorito"))
        t.check("editar-movimiento oculto", !visibles("editar-movimiento"))
        t.check("etiquetar-movimiento oculto", !visibles("etiquetar-movimiento"))
        t.check("eliminar-movimiento SIGUE visible (es el botón dual)",
            visibles("eliminar-movimiento"))
        t.check("y está ACTIVO porque hay un favorito marcado",
            desactivado("eliminar-movimiento") === false)
    }

    console.log("\nC) El contexto dice qué está seleccionado")
    {
        const uno = crearLastbarFalsa(new Set(["f1"]), FAVS)
        uno.ctx.actualizarEstadoLastbar()
        t.check("con 1 seleccionado, el nombre", uno.contexto.textContent === "Café", uno.contexto.textContent)
        t.check("contexto visible", uno.contexto.hidden === false)

        const dos = crearLastbarFalsa(new Set(["f1", "f2"]), FAVS)
        dos.ctx.actualizarEstadoLastbar()
        t.check("con 2 seleccionados, '2 favoritos'", dos.contexto.textContent === "2 favoritos", dos.contexto.textContent)

        const tres = crearLastbarFalsa(new Set(["f1", "f2", "f3"]), FAVS)
        tres.ctx.actualizarEstadoLastbar()
        t.check("con 3 seleccionados, '3 favoritos'", tres.contexto.textContent === "3 favoritos", tres.contexto.textContent)

        const ninguno = crearLastbarFalsa(new Set(), FAVS)
        ninguno.ctx.actualizarEstadoLastbar()
        t.check("sin selección, contexto vacío", ninguno.contexto.textContent === "", ninguno.contexto.textContent)
        t.check("sin selección, contexto oculto", ninguno.contexto.hidden === true)
    }

    console.log("\nD) Las tres acciones están registradas en MAPA_ACCIONES")
    for (const accion of ["editar-favorito", "ejecutar-favorito", "cancelar-favorito"]) {
        t.check(`MAPA_ACCIONES registra "${accion}"`,
            new RegExp('"' + accion + '"\\s*:\\s*async').test(codigo(srcLastbar)))
    }
    t.check("NO existe una acción eliminar-favorito aparte",
        !/data-accion="eliminar-favorito"/.test(srcLastbar) &&
        !/"eliminar-favorito"\s*:/.test(srcLastbar))
    t.check("las acciones delegan en movimientos.js",
        /"editar-favorito"[\s\S]{0,200}editarFavoritoSeleccionado/.test(srcLastbar) &&
        /"ejecutar-favorito"[\s\S]{0,200}ejecutarFavoritosSeleccionados/.test(srcLastbar) &&
        /"cancelar-favorito"[\s\S]{0,200}cancelarSeleccionFavoritos/.test(srcLastbar))

    console.log("\nE) Acción Editar: abre el modal precargado con el favorito")
    {
        const abiertas = []
        const ctx = correrCon(srcMov, "editarFavoritoSeleccionado", {}, [
            "var seleccionadosFavoritos = new Set(['f1'])",
            "function abrirFormularioConFavorito(id){ abiertas.push(id) }"
        ])
        ctx.abiertas = abiertas
        await ctx.editarFavoritoSeleccionado()
        t.check("abrió el formulario con el favorito seleccionado",
            abiertas.length === 1 && abiertas[0] === "f1", JSON.stringify(abiertas))
    }
    {
        const abiertas = []
        const ctx = correrCon(srcMov, "editarFavoritoSeleccionado", {}, [
            "var seleccionadosFavoritos = new Set(['f1','f2'])",
            "function abrirFormularioConFavorito(id){ abiertas.push(id) }"
        ])
        ctx.abiertas = abiertas
        await ctx.editarFavoritoSeleccionado()
        t.check("con 2 seleccionados no abre nada (editar es de uno)",
            abiertas.length === 0, JSON.stringify(abiertas))
    }

    console.log("\nF) Acción Ejecutar: crea el movimiento con favoritoId")
    {
        const ejecutados = []
        const ctx = correrCon(srcMov, "ejecutarFavoritosSeleccionados", {}, [
            "var seleccionadosFavoritos = new Set(['f1','f2'])",
            `var favoritosCache = ${JSON.stringify(FAVS)}`,
            "var uid = 'u1'",
            "var limpiar = 0",
            "function limpiarSeleccionFavoritos(){ limpiar++; seleccionadosFavoritos.clear() }",
            `async function ejecutarFavorito(u, f){ ejecutados.push(f.id) }`,
            "function mostrarNotificacion(){}"
        ])
        ctx.ejecutados = ejecutados
        await ctx.ejecutarFavoritosSeleccionados()
        t.check("ejecuta ambos favoritos seleccionados",
            ejecutados.length === 2 && ejecutados.join(",") === "f1,f2", JSON.stringify(ejecutados))
        t.check("limpia la selección", ctx.limpiar === 1, String(ctx.limpiar))
    }
    {
        // Y el movimiento resultante lleva favoritoId: aquí se usa el
        // ejecutarFavorito REAL del servicio, con registrarMovimiento doble.
        const registros = []
        const ctx = correrCon(srcServicio, "ejecutarFavorito", {
            registrarMovimiento: async (u, tipo, datos) => { registros.push({ tipo, datos }) }
        }, [
            "var getFechaHoy = () => '2026-10-18'",
            `var TIPOS_FAVORITO = ${/const TIPOS_FAVORITO = (\[[^\]]*\])/.exec(srcServicio)[1]}`,
            extraerFuncion(srcServicio, "esTipoFavoritable") + ";"
        ])
        await ctx.ejecutarFavorito("u1", FAVS[0])
        const r = registros[0]
        t.check("el movimiento lleva favoritoId", r?.datos?.favoritoId === "f1", JSON.stringify(r?.datos?.favoritoId))
        t.check("y el monto del favorito", r?.datos?.monto === -5, JSON.stringify(r?.datos?.monto))
    }

    console.log("\nG) Acción Cancelar: limpia la selección y devuelve la lastbar")
    {
        const ctx = correrCon(srcMov, "cancelarSeleccionFavoritos", {}, [
            "var seleccionadosFavoritos = new Set(['f1'])",
            "var limpios = 0",
            "function limpiarSeleccionFavoritos(){ limpios++; seleccionadosFavoritos.clear() }"
        ])
        ctx.cancelarSeleccionFavoritos()
        t.check("llama a limpiar la selección", ctx.limpios === 1, String(ctx.limpios))
        t.check("la selección queda vacía", ctx.seleccionadosFavoritos.size === 0)
    }

    console.log("\nH) El botón Eliminar es dual: favoritos o movimientos")
    {
        // Con favoritos marcados, el botón normal borra los favoritos.
        const ctx = correrCon(srcMov, "eliminarSeleccionados", {}, [
            "var seleccionadosFavoritos = new Set(['f1'])",
            "var seleccionados = new Set()",
            "var borradosFav = 0",
            "var borradosMov = 0",
            "async function eliminarSeleccionadosFavoritos(){ borradosFav++ }",
            "function abrirModalEliminarVarios(l){ borradosMov++ }"
        ])
        await ctx.eliminarSeleccionados()
        t.check("delega en eliminarSeleccionadosFavoritos",
            ctx.borradosFav === 1, String(ctx.borradosFav))
        t.check("y NO borra movimientos", ctx.borradosMov === 0, String(ctx.borradosMov))
    }
    {
        // Sin favoritos, mantiene el comportamiento previo.
        const ctx = correrCon(srcMov, "eliminarSeleccionados", {}, [
            "var seleccionadosFavoritos = new Set()",
            "var seleccionados = new Set(['m1'])",
            "var movimientos = [{ id: 'm1' }]",
            "var borradosFav = 0",
            "var borradosMov = 0",
            "async function eliminarSeleccionadosFavoritos(){ borradosFav++ }",
            "function limpiarSeleccion(){}",
            "function abrirModalEliminarVarios(l){ borradosMov = l.length }"
        ])
        await ctx.eliminarSeleccionados()
        t.check("borra los movimientos como antes",
            ctx.borradosMov === 1 && ctx.borradosFav === 0,
            `mov=${ctx.borradosMov} fav=${ctx.borradosFav}`)
    }
    {
        // Y con nada marcado no hace nada.
        const ctx = correrCon(srcMov, "eliminarSeleccionados", {}, [
            "var seleccionadosFavoritos = new Set()",
            "var seleccionados = new Set()",
            "var llamadas = 0",
            "async function eliminarSeleccionadosFavoritos(){ llamadas++ }",
            "function abrirModalEliminarVarios(){ llamadas++ }"
        ])
        await ctx.eliminarSeleccionados()
        t.check("sin selección no borra nada", ctx.llamadas === 0, String(ctx.llamadas))
    }
    t.check("el modal de favoritos usa su propio texto",
        /¿Eliminar \$\{lista\.length\} favorito\(s\)\?/.test(srcMov))
    t.check("el de movimientos conserva el suyo",
        /¿Eliminar \$\{lista\.length\} movimiento\(s\)\?/.test(srcMov))
    t.check("eliminarSeleccionadosFavoritos limpia la selección aunque la lista quede vacía",
        /limpiarSeleccionFavoritos\(\)\s*\n\s*if \(!lista\.length\) return/.test(srcMov))

    console.log("\nI) XSS: un nombre malicioso se escribe como texto, no como HTML")
    {
        // El nombre va por textContent en el contexto de la lastbar.
        const malicioso = '<img src=x onerror=alert(1)>'
        const c = crearLastbarFalsa(new Set(["f1"]), [{ ...FAVS[0], nombre: malicioso }])
        c.ctx.actualizarEstadoLastbar()
        t.check("el contexto guarda el literal como texto",
            c.contexto.textContent === malicioso, c.contexto.textContent)
        t.check("y nunca se asigna a innerHTML",
            !/contexto\.innerHTML/.test(codigo(srcMov)))
    }
    {
        // En el contenedor, el nombre viaja en `valores` (que rellena
        //rellenarHuecos con textContent), nunca en `html`.
        const bloque = /contenidoDesdeFilas\("tpl-favorito-item"[\s\S]*?\}\)\)/.exec(srcMov)?.[0] || ""
        t.check("el nombre del favorito va en `valores`", /nombre:\s*f\.nombre/.test(bloque))
        t.check("y no se inyecta como markup", !/html:\s*\{[^}]*nombre/.test(bloque))
    }
    {
        // Y rellenarHuecos asigna texto con textContent: se ejecuta la real.
        const elemento = {
            textContent: undefined, atributos: {}, innerHTML: undefined,
            setAttribute(k, v) { this.atributos[k] = v },
            hasAttribute() { return false },
            appendChild() {}
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
        t.check("rellenarHuecos escribe en textContent",
            elemento.textContent === malicioso, JSON.stringify(elemento.textContent))
        t.check("no pasa por innerHTML", elemento.innerHTML === undefined)
    }

    revisarListaDeCuenta(t)
    return t
}

// La estrella es de la página de movimientos. En la lista de una cuenta no
// tiene sentido: ahí la lista es de consulta, no de gestión de favoritos.
export function revisarListaDeCuenta(t) {
    console.log("\nJ) La lista de una cuenta no lleva el botón de favoritos")
    const cuentas = leer("js/pages/cuentas.js")

    const usos = [...cuentas.matchAll(/contenidoDesdeFilas\("tpl-movimiento-card"/g)]
    t.check("cuentas.js usa la card de movimientos", usos.length === 2, String(usos.length))

    const conFiltro = [...cuentas.matchAll(/sinBotonFavorito\(\s*contenidoDesdeFilas\("tpl-movimiento-card"/g)]
    t.check("los 2 usos pasan por sinBotonFavorito()",
        conFiltro.length === 2, String(conFiltro.length))

    t.check("sinBotonFavorito quita el nodo .movimiento-favorito",
        /function sinBotonFavorito\(fragmento\)[\s\S]{0,200}querySelectorAll\("\.movimiento-favorito"\)[\s\S]{0,120}\.remove\(\)/.test(cuentas))

    t.check("ningún uso queda sin filtrar",
        !/contenidoDesdeFilas\("tpl-movimiento-card"(?!\s*,)/.test(
            cuentas.replace(/sinBotonFavorito\(\s*contenidoDesdeFilas\("tpl-movimiento-card"/g, "")
        ))

    return t
}