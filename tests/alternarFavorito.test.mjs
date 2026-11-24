// Flujo de alternarFavoritoMovimiento() en la página de movimientos.
//
// Verifica los dos riesgos corregidos en la Subfase 2:
//   1. Identidad histórica: al recuperar, NO se sustituye el favoritoId del
//      movimiento por un id temporal; la caché optimista usa el id histórico.
//   2. Rollback selectivo y concurrencia: un fallo revierte SOLO el favorito
//      afectado sin pisar cambios optimistas de otros favoritos.
//
// Se extrae la función real del fuente y se ejecuta en un contexto vm con DOM
// y servicios falsos, igual que lastbarFavoritos.test.mjs.
import vm from "node:vm"
import { leer, extraerFuncion } from "./helpers.mjs"

const srcMov = leer("js/pages/movimientos.js")

// Construye un contexto vm con dobles para ejecutar alternarFavoritoMovimiento.
// `opciones.servicios` permite sobreescribir crear/recuperar/eliminar.
function crearContexto(opciones = {}) {
    const {
        movimientos = [],
        favoritos = [],
        crearFavorito = async () => "fav-nuevo",
        recuperarFavorito = async () => ({ id: "x" }),
        eliminarFavorito = async () => 0,
        fallo = null // { en: "crear"|"recuperar"|"eliminar", error }
    } = opciones

    // Estrellas falsas por movimiento (id -> { esFavorito })
    const estrellas = new Map()
    for (const mov of movimientos) {
        estrellas.set(mov.id, { esFavorito: Boolean(mov.favoritoId) })
    }

    const llamadas = { crear: [], recuperar: [], eliminar: [], render: [] }

    const estrellaFalsa = (movId) => {
        const estado = estrellas.get(movId) || { esFavorito: false }
        return {
            dataset: {},
            classList: {
                toggle: (c, v) => { if (c === "es-favorito") estado.esFavorito = Boolean(v) },
                add: (c) => { if (c === "es-favorito") estado.esFavorito = true },
                remove: (c) => { if (c === "es-favorito") estado.esFavorito = false },
                contains: (c) => c === "es-favorito" ? estado.esFavorito : false
            },
            setAttribute: () => {}
        }
    }

    const ctx = {
        console: { warn() {}, log() {}, error() {} },
        Object, Array, Math, JSON, Set, Number, Date, Boolean, String,
        uid: "uid-1",
        movimientos,
        favoritosCache: [...favoritos],
        alternanciasEnCurso: new Set(),
        // Servicios
        crearFavoritoDesdeMovimiento: async (uid, m) => {
            if (fallo?.en === "crear") throw fallo.error
            llamadas.crear.push({ uid, m })
            return crearFavorito(uid, m)
        },
        recuperarFavoritoConId: async (uid, id, m) => {
            if (fallo?.en === "recuperar") throw fallo.error
            llamadas.recuperar.push({ uid, id, m })
            return recuperarFavorito(uid, id, m)
        },
        eliminarFavoritoConDesvinculacion: async (uid, id) => {
            if (fallo?.en === "eliminar") throw fallo.error
            llamadas.eliminar.push({ uid, id })
            return eliminarFavorito(uid, id)
        },
        // renderFavoritos: el doble registra con qué opciones se llama. La
        // implementación real pinta desde favoritosCache cuando recibe
        // `{ desdeCache: true }`; aquí se respeta esa caché para poder verificar
        // el estado optimista y el rollback selectivo.
        renderFavoritos: async (_uid, opciones = {}) => { llamadas.render.push(opciones) },
        cacheCapa: { invalidarPrefijo: () => {} },
        mostrarNotificacion: () => {},
        document: {
            querySelector: (sel) => {
                const id = /data-movimiento-id="([^"]+)"/.exec(sel)?.[1]
                if (!id || !estrellas.has(id)) return null
                return {
                    dataset: {},
                    querySelector: (s) => s === ".movimiento-favorito" ? estrellaFalsa(id) : null
                }
            }
        }
    }
    vm.createContext(ctx)
    vm.runInContext(extraerFuncion(srcMov, "alternarFavoritoMovimiento").replace("export ", "") + ";", ctx)

    return { ctx, llamadas, estrellas }
}

export default async function ejecutar(t) {
    // ------------------------------------------------------------------
    // A) Recuperación conserva el favoritoId histórico (antes/durante/después)
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café", favoritoId: "hist-1" }
        const { ctx, llamadas } = crearContexto({
            movimientos: [mov],
            favoritos: [] // el documento histórico NO existe -> recuperación
        })
        // La estrella arranca apagada (el documento no existe en la barra)
        await ctx.alternarFavoritoMovimiento(mov)
        t.check("A1 recuperar: usa el favoritoId histórico (no uno temporal)",
            llamadas.recuperar.length === 1 && llamadas.recuperar[0].id === "hist-1",
            JSON.stringify(llamadas.recuperar.map(l => l.id)))
        t.check("A2 recuperar: NO llama a crearFavoritoDesdeMovimiento",
            llamadas.crear.length === 0)
        t.check("A3 recuperar: el movimiento conserva el id histórico tras confirmar",
            mov.favoritoId === "hist-1", mov.favoritoId)
        t.check("A4 recuperar: no toca eliminarFavorito",
            llamadas.eliminar.length === 0)
    }

    // ------------------------------------------------------------------
    // B) La caché optimista de recuperación usa el id histórico (no temporal)
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café", favoritoId: "hist-2" }
        // Capturamos el id con el que se añadió el favorito provisional espiando
        // la llamada a recuperar: debe coincidir con el id del movimiento.
        const { ctx, llamadas } = crearContexto({ movimientos: [mov], favoritos: [] })
        await ctx.alternarFavoritoMovimiento(mov)
        const idUsado = llamadas.recuperar[0]?.id
        t.check("B1 recuperar: la operación optimista usa el id histórico",
            idUsado === "hist-2" && !String(idUsado).startsWith("temp_"), String(idUsado))
    }

    // ------------------------------------------------------------------
    // C) Si la recuperación falla, se retira el provisional y se conserva el id
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café", favoritoId: "hist-3" }
        const { ctx } = crearContexto({
            movimientos: [mov],
            favoritos: [],
            fallo: { en: "recuperar", error: new Error("permiso denegado") }
        })
        await ctx.alternarFavoritoMovimiento(mov)
        t.check("C1 recuperar falla: conserva el favoritoId histórico del movimiento",
            mov.favoritoId === "hist-3", mov.favoritoId)
        t.check("C2 recuperar falla: retira el favorito provisional de la caché",
            !ctx.favoritosCache.some(f => f.id === "hist-3"),
            JSON.stringify(ctx.favoritosCache.map(f => f.id)))
    }

    // ------------------------------------------------------------------
    // D) Crear favorito sin id histórico reconcilia temp -> definitivo
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café" }
        const { ctx, llamadas } = crearContexto({
            movimientos: [mov],
            favoritos: [],
            crearFavorito: () => "fav-real-9"
        })
        await ctx.alternarFavoritoMovimiento(mov)
        t.check("D1 nuevo: llama a crearFavoritoDesdeMovimiento",
            llamadas.crear.length === 1)
        t.check("D2 nuevo: el movimiento queda con el id real (no temporal)",
            mov.favoritoId === "fav-real-9", mov.favoritoId)
        t.check("D3 nuevo: la caché queda con el id real",
            ctx.favoritosCache.some(f => f.id === "fav-real-9") &&
            !ctx.favoritosCache.some(f => f.id.startsWith("temp_")))
    }

    // ------------------------------------------------------------------
    // E) El rollback de un favorito NO elimina cambios optimistas de otro
    // ------------------------------------------------------------------
    {
        // Otro favorito ya confirmado/optimista en caché que debe sobrevivir.
        const otro = { id: "otro-ya-existente", nombre: "Otro", tipo: "gasto", cuenta: "c9", monto: 5 }
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café", favoritoId: "hist-4" }
        const { ctx } = crearContexto({
            movimientos: [mov],
            favoritos: [otro],
            fallo: { en: "recuperar", error: new Error("fallo") }
        })
        await ctx.alternarFavoritoMovimiento(mov)
        t.check("E1 rollback: conserva el favorito de otra operación (no pisa la caché)",
            ctx.favoritosCache.some(f => f.id === "otro-ya-existente"),
            JSON.stringify(ctx.favoritosCache.map(f => f.id)))
        t.check("E2 rollback: retira solo el provisional del favorito afectado",
            !ctx.favoritosCache.some(f => f.id === "hist-4"))
    }

    // ------------------------------------------------------------------
    // F) Dos operaciones simultáneas sobre favoritos distintos no se pisan
    // ------------------------------------------------------------------
    {
        const movA = { id: "mA", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "A", favoritoId: "hist-A" }
        const movB = { id: "mB", tipo: "gasto", cuenta: "c2", monto: 20, divisa: "pen", concepto: "B", favoritoId: "hist-B" }
        let resolverA, resolverB
        const pbA = new Promise(r => { resolverA = r })
        const pbB = new Promise(r => { resolverB = r })
        const ctxObj = crearContexto({ movimientos: [movA, movB], favoritos: [] })
        // Reemplazar el doble por versiones controladas que bloquean hasta liberar
        ctxObj.ctx.recuperarFavoritoConId = async (uid, id) => {
            await (id === "hist-A" ? pbA : pbB)
            return { id }
        }
        const pA = ctxObj.ctx.alternarFavoritoMovimiento(movA)
        const pB = ctxObj.ctx.alternarFavoritoMovimiento(movB)
        resolverA(); resolverB()
        await Promise.all([pA, pB])
        t.check("F1 concurrente: ambos favoritos distintos quedan en la caché",
            ctxObj.ctx.favoritosCache.some(f => f.id === "hist-A") &&
            ctxObj.ctx.favoritosCache.some(f => f.id === "hist-B"),
            JSON.stringify(ctxObj.ctx.favoritosCache.map(f => f.id)))
        t.check("F2 concurrente: ambos movimientos conservan su id histórico",
            movA.favoritoId === "hist-A" && movB.favoritoId === "hist-B")
    }

    // ------------------------------------------------------------------
    // G) La protección por favoritoId se libera y permite operaciones posteriores
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café", favoritoId: "hist-5" }
        const { ctx, llamadas } = crearContexto({ movimientos: [mov], favoritos: [] })
        await ctx.alternarFavoritoMovimiento(mov) // primera: recupera
        // Simular que el documento pasó a existir para la segunda (desmarcar)
        ctx.favoritosCache.push({ id: "hist-5", nombre: "Café", tipo: "gasto" })
        await ctx.alternarFavoritoMovimiento(mov) // segunda: desmarca
        t.check("G1 guard liberado: la clave no queda bloqueada tras la 1ª op",
            !ctx.alternanciasEnCurso.has("hist-5"),
            JSON.stringify([...ctx.alternanciasEnCurso]))
        t.check("G2 guard liberado: la 2ª operación (desmarcar) llega a eliminar",
            llamadas.eliminar.length === 1 && llamadas.eliminar[0].id === "hist-5",
            JSON.stringify(llamadas.eliminar))
    }

    // ------------------------------------------------------------------
    // H) Doble disparo sobre el MISMO favorito: la 2ª llamada se ignora
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café", favoritoId: "hist-6" }
        const { ctx, llamadas } = crearContexto({ movimientos: [mov], favoritos: [] })
        // Bloquear la primera recuperación para forzar el intercalado
        let liberar
        const pb = new Promise(r => { liberar = r })
        ctx.recuperarFavoritoConId = async (uid, id) => { await pb; llamadas.recuperar.push({ uid, id }); return { id } }
        const p1 = ctx.alternarFavoritoMovimiento(mov)     // en curso (bloqueada)
        const p2 = ctx.alternarFavoritoMovimiento(mov)     // debe ignorarse (guard activo)
        liberar()
        await Promise.all([p1, p2])
        t.check("H1 doble disparo: la 2ª alternancia sobre el mismo favorito se ignora",
            llamadas.recuperar.length === 1,
            `recuperar llamado ${llamadas.recuperar.length} vez/veces`)
        t.check("H2 doble disparo: el guard queda liberado al terminar",
            !ctx.alternanciasEnCurso.has("hist-6"))
    }

    // ------------------------------------------------------------------
    // I) Desmarcar un favorito activo elimina el documento y conserva el id
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café", favoritoId: "hist-7" }
        const { ctx, llamadas } = crearContexto({
            movimientos: [mov],
            favoritos: [{ id: "hist-7", nombre: "Café", tipo: "gasto" }] // documento activo
        })
        await ctx.alternarFavoritoMovimiento(mov)
        t.check("I1 desmarcar: llama a eliminarFavorito con el id histórico",
            llamadas.eliminar.length === 1 && llamadas.eliminar[0].id === "hist-7",
            JSON.stringify(llamadas.eliminar))
        t.check("I2 desmarcar: conserva el favoritoId del movimiento",
            mov.favoritoId === "hist-7", mov.favoritoId)
        t.check("I3 desmarcar: retira el favorito de la caché",
            !ctx.favoritosCache.some(f => f.id === "hist-7"))
        t.check("I4 desmarcar: NO llama a recuperar ni crear",
            llamadas.recuperar.length === 0 && llamadas.crear.length === 0)
    }

    // ------------------------------------------------------------------
    // J) Creación optimista: tarjeta inmediata y render sin releer Firestore
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café" }
        let liberar
        const bloqueo = new Promise(r => { liberar = r })
        const { ctx, llamadas } = crearContexto({ movimientos: [mov], favoritos: [] })
        ctx.crearFavoritoDesdeMovimiento = async (uid, m) => {
            llamadas.crear.push({ uid, m })
            await bloqueo
            return "fav-real-1"
        }

        const enCurso = ctx.alternarFavoritoMovimiento(mov)

        // El primer tramo es síncrono: la caché ya tiene el id temporal aunque
        // la escritura en Firebase siga pendiente.
        const idTemporal = mov.favoritoId
        t.check("J1 optimista: id temporal asignado antes de persistir",
            typeof idTemporal === "string" && idTemporal.startsWith("temp_"), String(idTemporal))
        t.check("J2 optimista: la tarjeta ya está en la caché antes de persistir",
            ctx.favoritosCache.some(f => f.id === idTemporal),
            JSON.stringify(ctx.favoritosCache.map(f => f.id)))
        t.check("J3 optimista: todos los renders usan la caché (sin releer Firestore)",
            llamadas.render.length >= 1 && llamadas.render.every(o => o.desdeCache === true),
            JSON.stringify(llamadas.render))

        liberar()
        await enCurso
        t.check("J4 reconciliación: el movimiento queda con el id real",
            mov.favoritoId === "fav-real-1", mov.favoritoId)
        t.check("J5 reconciliación: no queda ningún id temporal en la caché",
            !ctx.favoritosCache.some(f => String(f.id).startsWith("temp_")),
            JSON.stringify(ctx.favoritosCache.map(f => f.id)))
        t.check("J6 reconciliación: la caché conserva el favorito con su id real",
            ctx.favoritosCache.some(f => f.id === "fav-real-1"))
    }

    // ------------------------------------------------------------------
    // K) Si crear falla, se retira SOLO el provisional temporal
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café" }
        const { ctx } = crearContexto({
            movimientos: [mov],
            favoritos: [],
            fallo: { en: "crear", error: new Error("sin red") }
        })
        await ctx.alternarFavoritoMovimiento(mov)
        t.check("K1 crear falla: no queda ningún favorito temporal en la caché",
            !ctx.favoritosCache.some(f => String(f.id).startsWith("temp_")),
            JSON.stringify(ctx.favoritosCache.map(f => f.id)))
        t.check("K2 crear falla: el movimiento vuelve a no tener favoritoId",
            mov.favoritoId === undefined, String(mov.favoritoId))
    }

    // ------------------------------------------------------------------
    // L) Doble clic durante la creación: no se persiste dos veces
    // ------------------------------------------------------------------
    {
        const mov = { id: "m1", tipo: "gasto", cuenta: "c1", monto: 10, divisa: "pen", concepto: "Café" }
        let liberar
        const bloqueo = new Promise(r => { liberar = r })
        let vecesCreado = 0
        const { ctx } = crearContexto({ movimientos: [mov], favoritos: [] })
        ctx.crearFavoritoDesdeMovimiento = async () => {
            vecesCreado++
            await bloqueo
            return "fav-real-2"
        }

        const primera = ctx.alternarFavoritoMovimiento(mov)
        // El segundo clic ve el id temporal: debe reconocerlo como la MISMA
        // operación en curso, no como un favorito activo que hay que desmarcar.
        const segunda = ctx.alternarFavoritoMovimiento(mov)
        liberar()
        await Promise.all([primera, segunda])

        t.check("L1 doble clic: solo se persiste una vez", vecesCreado === 1, String(vecesCreado))
        t.check("L2 doble clic: el favorito queda activo con el id real",
            mov.favoritoId === "fav-real-2", mov.favoritoId)
    }
}