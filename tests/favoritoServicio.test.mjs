import { nuevoReporter, leer, extraerFuncion } from "./helpers.mjs"

/**
 * Extrae una función de FavoritoServicio.js y la devuelve lista para llamar,
 * inyectando las dependencias como parámetros. Así no importamos el módulo
 * real (que traería el SDK de Firebase y fallaría en Node sin loader de URLs).
 */
function cargarFuncion(src, nombre, deps) {
    // extraerFuncion devuelve el código fuente de la función, incluida la
    // palabra 'export'. La quitamos para poder evaluar el cuerpo en un
    // contexto de función normal.
    const cuerpo = extraerFuncion(src, nombre).replace(/^export\s+/, "")
    const params = Object.keys(deps)
    const valores = Object.values(deps)
    const fn = new Function(...params, `${cuerpo}\nreturn ${nombre}`)
    return fn(...valores)
}

export default async function ejecutar(t = nuevoReporter("favoritoServicio")) {
    const src = leer("js/services/FavoritoServicio.js")
    const UID = "usuario-prueba"

    // ------------------------------------------------------------
    // esTipoFavoritable
    // ------------------------------------------------------------
    {
        const esTipoFavoritable = cargarFuncion(src, "esTipoFavoritable", {
            TIPOS_FAVORITO: ["ingreso", "gasto", "compraTarjeta"]
        })
        t.check("esTipoFavoritable: ingreso es favoritable", esTipoFavoritable("ingreso") === true)
        t.check("esTipoFavoritable: gasto es favoritable", esTipoFavoritable("gasto") === true)
        t.check("esTipoFavoritable: compraTarjeta es favoritable", esTipoFavoritable("compraTarjeta") === true)
        t.check("esTipoFavoritable: transferencia NO es favoritable", esTipoFavoritable("transferencia") === false)
        t.check("esTipoFavoritable: compraActivo NO es favoritable", esTipoFavoritable("compraActivo") === false)
    }

    // ------------------------------------------------------------
    // crearFavoritoDesdeMovimiento
    // ------------------------------------------------------------
    {
        let creado = null, vinculadoId = null, vinculadoDatos = null, notificado = false
        const favoritoId = await cargarFuncion(src, "crearFavoritoDesdeMovimiento", {
            esTipoFavoritable: (tipo) => ["ingreso", "gasto", "compraTarjeta"].includes(tipo),
            crearFavorito: async (u, datos) => { creado = datos; return "fav-1" },
            actualizarMovimientoDoc: async (u, id, datos) => { vinculadoId = id; vinculadoDatos = datos },
            notificarMovimientosActualizados: () => { notificado = true }
        })(UID, {
            id: "m1",
            tipo: "gasto",
            cuenta: "c1",
            monto: 100,
            divisa: "pen",
            concepto: "Supermercado",
            etiquetas: ["comida"]
        })
        t.check("crearFavoritoDesdeMovimiento: crea el favorito con datos del movimiento", creado.nombre === "Supermercado" && creado.tipo === "gasto" && creado.cuenta === "c1" && creado.monto === 100 && creado.divisa === "pen" && JSON.stringify(creado.etiquetas) === JSON.stringify(["comida"]))
        t.check("crearFavoritoDesdeMovimiento: devuelve el id del favorito", favoritoId === "fav-1")
        t.check("crearFavoritoDesdeMovimiento: vincula el movimiento con el favoritoId", vinculadoId === "m1" && vinculadoDatos.favoritoId === "fav-1")
        t.check("crearFavoritoDesdeMovimiento: notifica cambios de movimientos", notificado === true)
    }

    {
        let lanzo = false
        try {
            await cargarFuncion(src, "crearFavoritoDesdeMovimiento", {
                esTipoFavoritable: (tipo) => ["ingreso", "gasto", "compraTarjeta"].includes(tipo),
                crearFavorito: async () => "f"
            })(UID, { tipo: "transferencia", cuenta: "c1", monto: 50 })
        } catch (e) { lanzo = true }
        t.check("crearFavoritoDesdeMovimiento: rechaza tipos no favoritables", lanzo === true)
    }

    // ------------------------------------------------------------
    // desvincularMovimiento
    // ------------------------------------------------------------
    {
        let actualizadoId = null, actualizadoDatos = null, notificado = false
        await cargarFuncion(src, "desvincularMovimiento", {
            actualizarMovimientoDoc: async (u, id, datos) => { actualizadoId = id; actualizadoDatos = datos },
            deleteField: () => ({ __deleteField: true }),
            notificarMovimientosActualizados: () => { notificado = true }
        })(UID, "m1")
        t.check("desvincularMovimiento: quita el favoritoId del movimiento", actualizadoId === "m1" && actualizadoDatos.favoritoId.__deleteField === true)
        t.check("desvincularMovimiento: notifica cambios", notificado === true)
    }

    // ------------------------------------------------------------
    // ejecutarFavorito
    // ------------------------------------------------------------
    {
        let registrado = null
        const hoy = "2026-10-17"
        const favoritoId = await cargarFuncion(src, "ejecutarFavorito", {
            esTipoFavoritable: (tipo) => ["ingreso", "gasto", "compraTarjeta"].includes(tipo),
            registrarMovimiento: async (u, tipo, datos) => { registrado = datos; return "mov-9" },
            getFechaHoy: () => hoy
        })(UID, {
            id: "f1",
            tipo: "gasto",
            cuenta: "c1",
            monto: 44.9,
            divisa: "pen",
            concepto: "Netflix",
            etiquetas: ["suscripcion"]
        })
        t.check("ejecutarFavorito: crea instancia vinculada con datos del favorito", registrado.tipo === "gasto" && registrado.cuenta === "c1" && registrado.monto === 44.9 && registrado.divisa === "pen" && registrado.concepto === "Netflix" && JSON.stringify(registrado.etiquetas) === JSON.stringify(["suscripcion"]) && registrado.fechaRealizacion === hoy && registrado.favoritoId === "f1")
        t.check("ejecutarFavorito: devuelve el id del movimiento creado", favoritoId === "mov-9")

        {
            let lanzo = false
            try {
                await cargarFuncion(src, "ejecutarFavorito", {
                    esTipoFavoritable: (tipo) => ["ingreso", "gasto", "compraTarjeta"].includes(tipo),
                    registrarMovimiento: async () => "m"
                })(UID, { tipo: "transferencia", cuenta: "c1", monto: 50 })
            } catch (e) { lanzo = true }
            t.check("ejecutarFavorito: rechaza tipos no favoritables", lanzo === true)
        }
    }

    // ------------------------------------------------------------
    // guardarInstanciaVinculada
    // ------------------------------------------------------------
    {
        let registrado = null, idDevuelto = null
        idDevuelto = await cargarFuncion(src, "guardarInstanciaVinculada", {
            esTipoFavoritable: (tipo) => ["ingreso", "gasto", "compraTarjeta"].includes(tipo),
            registrarMovimiento: async (u, tipo, datos) => { registrado = datos; return "mov-10" }
        })(UID, "f1", {
            tipo: "gasto",
            cuenta: "c2",
            monto: 10,
            divisa: "usd",
            concepto: "Netflix mensual",
            etiquetas: ["suscripcion", "streaming"]
        })
        t.check("guardarInstanciaVinculada: crea instancia vinculada con datos editados", registrado.tipo === "gasto" && registrado.cuenta === "c2" && registrado.monto === 10 && registrado.divisa === "usd" && registrado.concepto === "Netflix mensual" && registrado.favoritoId === "f1")
        t.check("guardarInstanciaVinculada: devuelve el id del movimiento", idDevuelto === "mov-10")

        {
            let lanzo = false
            try {
                await cargarFuncion(src, "guardarInstanciaVinculada", {
                    esTipoFavoritable: (tipo) => ["ingreso", "gasto", "compraTarjeta"].includes(tipo),
                    registrarMovimiento: async () => "m"
                })(UID, "f1", { tipo: "transferencia", cuenta: "c1", monto: 50 })
            } catch (e) { lanzo = true }
            t.check("guardarInstanciaVinculada: rechaza tipos no favoritables", lanzo === true)
        }
    }

    // ------------------------------------------------------------
    // eliminarFavoritoConDesvinculacion
    // ------------------------------------------------------------
    {
        let borradoId = null, actualizados = [], loteCommit = false, parcheados = [], notificado = false
        const lote = {
            delete: (ref) => { borradoId = ref },
            update: (ref, datos) => { actualizados.push({ id: ref, datos }) },
            commit: async () => { loteCommit = true }
        }

        const vinculados = await cargarFuncion(src, "eliminarFavoritoConDesvinculacion", {
            obtenerFavorito: async (u, id) => ({ id: "fav-antiguo", nombre: "Antiguo", tipo: "gasto", cuenta: "c1", monto: 50 }),
            obtenerMovimientos: async () => [
                { id: "m1", favoritoId: "fav-antiguo", concepto: "A" },
                { id: "m2", favoritoId: "fav-antiguo", concepto: "B" },
                { id: "m3", favoritoId: "otro", concepto: "C" }
            ],
            db: {},
            doc: (...partes) => partes.slice(1).join("/"),
            writeBatch: () => lote,
            deleteField: () => ({ __deleteField: true }),
            cacheCapa: {
                parchear: (uid, clave, fn) => { parcheados.push({ uid, clave }); return fn([]) }
            },
            notificarMovimientosActualizados: () => { notificado = true }
        })(UID, "fav-antiguo")

        t.check("eliminarFavoritoConDesvinculacion: elimina el favorito", borradoId === "usuarios/usuario-prueba/favoritos/fav-antiguo")
        t.check("eliminarFavoritoConDesvinculacion: desvincula los movimientos vinculados", actualizados.length === 2 && actualizados.every(a => a.datos.favoritoId.__deleteField === true))
        t.check("eliminarFavoritoConDesvinculacion: no toca movimientos de otros favoritos", actualizados.map(a => a.id.split("/").pop()).sort().join(",") === "m1,m2")
        t.check("eliminarFavoritoConDesvinculacion: hace commit del lote", loteCommit === true)
        t.check("eliminarFavoritoConDesvinculacion: parchea caché de favoritos y movimientos", parcheados.some(p => p.clave === "favoritos") && parcheados.some(p => p.clave === "movimientos"))
        t.check("eliminarFavoritoConDesvinculacion: notifica cambios", notificado === true)
        t.check("eliminarFavoritoConDesvinculacion: devuelve cantidad de vinculados", vinculados === 2)

        {
            let lanzo = false
            try {
                await cargarFuncion(src, "eliminarFavoritoConDesvinculacion", {
                    obtenerFavorito: async () => null,
                    obtenerMovimientos: async () => [],
                    doc: (...partes) => partes.slice(1).join("/"),
                    writeBatch: () => ({ delete() {}, update() {}, commit: async () => {} }),
                    deleteField: () => ({}),
                    cacheCapa: { parchear: (uid, clave, fn) => fn([]) },
                    notificarMovimientosActualizados: () => {}
                })(UID, "fav-inexistente")
            } catch (e) { lanzo = true }
            t.check("eliminarFavoritoConDesvinculacion: lanza si el favorito no existe", lanzo === true)
        }
    }

    return t
}