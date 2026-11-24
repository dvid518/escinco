// Estado real de la estrella de favoritos en la lista de movimientos.
//
// Un movimiento conserva su favoritoId aunque la plantilla se elimine (es la
// identidad histórica que permite recuperarla). Por eso la estrella no puede
// depender de que `favoritoId` exista: solo debe encenderse cuando la plantilla
// está en `favoritosCache`.
import vm from "node:vm"
import { leer, extraerFuncion } from "./helpers.mjs"

const srcMov = leer("js/pages/movimientos.js")

function crearContexto(favoritos = []) {
    const ctx = {
        favoritosCache: favoritos,
        seleccionados: new Set(),
        CONFIG_MOVIMIENTOS: { gasto: { nombre: "Gasto" } },
        montoDeMovimiento: () => 10,
        esMovimientoPositivo: () => false,
        formatearFecha: () => "01/01/2026",
        nombreCuentaDeMovimiento: () => "Cuenta",
        contenidoDesdeFilas: () => [],
        icono: () => "",
        formatearMontoConDivisa: () => "S/ 10.00",
        Number, Math, Array, Object, String, Boolean
    }
    vm.createContext(ctx)
    vm.runInContext(
        extraerFuncion(srcMov, "esFavoritoActivo").replace("export ", "") + ";",
        ctx
    )
    vm.runInContext(
        extraerFuncion(srcMov, "filaMovimiento").replace("export ", "") + ";",
        ctx
    )
    return ctx
}

export default async function ejecutar(t) {
    const movimiento = {
        id: "m1",
        tipo: "gasto",
        cuenta: "c1",
        monto: 10,
        divisa: "pen",
        concepto: "Café",
        fechaRealizacion: "2026-01-01",
        favoritoId: "fav-1"
    }

    // ------------------------------------------------------------------
    // A) La plantilla existe: la estrella está activa
    // ------------------------------------------------------------------
    {
        const ctx = crearContexto([{ id: "fav-1", nombre: "Café", tipo: "gasto" }])
        const fila = ctx.filaMovimiento(movimiento)
        t.check("A1 con plantilla: la clase es-favorito está presente",
            fila.valores["favorito@class"].includes("es-favorito"),
            fila.valores["favorito@class"])
        t.check("A2 con plantilla: el aria-label invita a quitarlo",
            fila.valores["favorito@aria-label"] === "Quitar de favoritos",
            fila.valores["favorito@aria-label"])
    }

    // ------------------------------------------------------------------
    // B) Plantilla eliminada: la estrella se apaga, pero el id histórico
    //    sigue en la fila para poder recuperarlo
    // ------------------------------------------------------------------
    {
        const ctx = crearContexto([])
        const fila = ctx.filaMovimiento(movimiento)
        t.check("B1 sin plantilla: la clase es-favorito NO está presente",
            !fila.valores["favorito@class"].includes("es-favorito"),
            fila.valores["favorito@class"])
        t.check("B2 sin plantilla: el aria-label invita a marcarlo",
            fila.valores["favorito@aria-label"] === "Marcar como favorito",
            fila.valores["favorito@aria-label"])
        t.check("B3 sin plantilla: el id histórico se conserva para recuperación",
            fila.valores["item@data-favorito-id"] === "fav-1" &&
            fila.valores["favorito@data-favorito-id"] === "fav-1",
            fila.valores["item@data-favorito-id"])
    }

    // ------------------------------------------------------------------
    // C) Movimiento sin favoritoId: nunca activo, aunque haya otros favoritos
    // ------------------------------------------------------------------
    {
        const ctx = crearContexto([{ id: "otro", nombre: "Otro", tipo: "gasto" }])
        const fila = ctx.filaMovimiento({ ...movimiento, favoritoId: undefined })
        t.check("C1 sin favoritoId: la estrella está apagada",
            !fila.valores["favorito@class"].includes("es-favorito"),
            fila.valores["favorito@class"])
        t.check("C2 sin favoritoId: el dataset queda vacío",
            fila.valores["favorito@data-favorito-id"] === "")
    }

    // ------------------------------------------------------------------
    // D) El helper consulta la caché, no el id en crudo
    // ------------------------------------------------------------------
    {
        const ctx = crearContexto([{ id: "fav-1" }])
        t.check("D1 esFavoritoActivo: true cuando la plantilla existe",
            ctx.esFavoritoActivo("fav-1") === true)
        t.check("D2 esFavoritoActivo: false cuando la plantilla no existe",
            ctx.esFavoritoActivo("fav-borrado") === false)
        t.check("D3 esFavoritoActivo: false sin id",
            ctx.esFavoritoActivo(undefined) === false)
    }
}
