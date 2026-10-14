// Caché de datos en memoria (Fase 3, tarea 14b).
//
// js/core/cache.js es ESM puro (sin DOM ni Firebase), así que se importa tal cual.
// Cada caso usa un uid propio para no pisar el estado de módulo de los demás.
import { cacheCapa } from "../js/core/cache.js"
import { nuevoReporter } from "./helpers.mjs"

const dormir = ms => new Promise(r => setTimeout(r, ms))

export default async function ejecutar(t = nuevoReporter("cache")) {
    // 1. Acierto: la segunda llamada no vuelve a la red.
    let n = 0
    const fn = async () => { n++; return [1, 2] }
    const a1 = await cacheCapa.obtener("u1", "k", fn)
    const a2 = await cacheCapa.obtener("u1", "k", fn)
    t.check("acierto: fn se llama una sola vez", n === 1, `n=${n}`)
    t.check("acierto: devuelve el mismo dato", a1 === a2 && a1[0] === 1)

    // 2. TTL: tras expirar, vuelve a leer.
    let m = 0
    const fnTtl = async () => { m++; return m }
    await cacheCapa.obtener("u2", "k", fnTtl, { ttl: 30 })
    await cacheCapa.obtener("u2", "k", fnTtl, { ttl: 30 })
    t.check("dentro del TTL no relee", m === 1, `m=${m}`)
    await dormir(60)
    await cacheCapa.obtener("u2", "k", fnTtl, { ttl: 30 })
    t.check("tras el TTL relee", m === 2, `m=${m}`)

    // 3. Dedupe en vuelo: dos llamadas simultáneas comparten una lectura.
    let p = 0
    const fnLento = async () => { p++; await dormir(20); return "x" }
    const [r1, r2] = await Promise.all([
        cacheCapa.obtener("u3", "k", fnLento),
        cacheCapa.obtener("u3", "k", fnLento)
    ])
    t.check("dedupe en vuelo: una sola lectura", p === 1, `p=${p}`)
    t.check("dedupe en vuelo: mismo resultado", r1 === "x" && r2 === "x")

    // 4. invalidar fuerza la siguiente lectura.
    let q = 0
    const fnInv = async () => { q++; return q }
    await cacheCapa.obtener("u4", "k", fnInv)
    cacheCapa.invalidar("u4", "k")
    await cacheCapa.obtener("u4", "k", fnInv)
    t.check("invalidar() fuerza relectura", q === 2, `q=${q}`)

    // 5. invalidarPrefijo borra las claves con ese prefijo.
    let s = 0
    const fnPref = async v => { s++; return v }
    await cacheCapa.obtener("u5", "activos", fnPref)
    await cacheCapa.obtener("u5", "activosHist", fnPref)
    await cacheCapa.obtener("u5", "cuentas", fnPref)
    const sAntes = s
    cacheCapa.invalidarPrefijo("u5", "activos")
    await cacheCapa.obtener("u5", "activos", fnPref)
    await cacheCapa.obtener("u5", "activosHist", fnPref)
    t.check("invalidarPrefijo() invalida activos*", s === sAntes + 2, `s=${s}`)
    await cacheCapa.obtener("u5", "cuentas", fnPref)
    t.check("invalidarPrefijo() respeta otras claves", s === sAntes + 2, `s=${s}`)

    // 6. parchear corrige en sitio sin gastar lecturas.
    let c = 0
    const fnPar = async () => { c++; return [1, 2] }
    await cacheCapa.obtener("u6", "k", fnPar)
    cacheCapa.parchear("u6", "k", arr => [...arr, 3])
    const parcheado = await cacheCapa.obtener("u6", "k", fnPar)
    t.check("parchear() no relee", c === 1, `c=${c}`)
    t.check("parchear() deja el array actualizado", parcheado.length === 3 && parcheado[2] === 3, parcheado.join(","))

    // 7. limpiar vacía solo las claves del uid indicado.
    let z = 0
    const fnLim = async () => { z++; return z }
    await cacheCapa.obtener("u7", "a", fnLim)
    await cacheCapa.obtener("u7", "b", fnLim)
    await cacheCapa.obtener("otro", "a", fnLim)
    cacheCapa.limpiar("u7")
    await cacheCapa.obtener("u7", "a", fnLim)
    await cacheCapa.obtener("u7", "b", fnLim)
    await cacheCapa.obtener("otro", "a", fnLim)
    t.check("limpiar() invalida solo su uid", z === 5, `z=${z}`)

    // 8. Sin uid no cachea (bypass).
    let y = 0
    const fnSin = async () => { y++; return y }
    await cacheCapa.obtener(null, "k", fnSin)
    await cacheCapa.obtener(null, "k", fnSin)
    t.check("sin uid no cachea", y === 2, `y=${y}`)

    // 9. Estadísticas con forma estable y ahorro coherente.
    cacheCapa.reiniciarEstadisticas()
    let w = 0
    const fnEst = async () => { w++; return w }
    await cacheCapa.obtener("u9", "k", fnEst)
    await cacheCapa.obtener("u9", "k", fnEst)
    const est = cacheCapa.estadisticas()
    t.check("estadisticas() expone porClave y ahorro", Array.isArray(est.porClave) && typeof est.ahorroPorcentual === "number")
    t.check("ahorro 1 lectura de 2 = 50%", est.solicitadas === 2 && est.red === 1 && est.ahorroPorcentual === 50,
        `sol=${est.solicitadas} red=${est.red} ahorro=${est.ahorroPorcentual}`)
    cacheCapa.reiniciarEstadisticas()
    t.check("reiniciarEstadisticas() pone a cero", cacheCapa.estadisticas().solicitadas === 0)

    return t
}
