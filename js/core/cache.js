// ============================================
// CACHÉ DE DATOS EN MEMORIA (por usuario)
// ============================================
// Evita repetir lecturas de Firestore en cada
// navegación (dashboard, cuentas, movimientos...).
//
// - TTL por defecto: 5 minutos.
// - Los repositorios invalidan al escribir.
// - Deduplica peticiones concurrentes.
// - Estadísticas integradas (medición + reportes).
//
// Uso:
//   const cuentas = await cacheCapa.obtener(uid, "cuentas", fetchFn)
//   cacheCapa.invalidar(uid, "cuentas")        // tras escribir
//   cacheCapa.invalidarPrefijo(uid, "activos") // varias claves
//   cacheCapa.limpiar(uid)                     // logout / borrado total
//
// Medición:
//   cacheCapa.estadisticas()          // resumen en memoria
//   cacheCapa.reiniciarEstadisticas() // limpiar contadores
//   cacheCapa.guardarReporte()        // descarga JSON en el navegador
// ============================================

import { descargarArchivoSeguro } from "./descarga.js"

const TTL_DEFAULT = 5 * 60 * 1000

const entradas = new Map() // `${uid}::${clave}` -> { datos, expira }
const enVuelo = new Map()  // `${uid}::${clave}` -> Promise (dedupe)

// ---- Estadísticas (aciertos vs lecturas de red) ----
const stats = {
    iniciado: Date.now(),
    solicitadas: 0,      // llamadas a obtener()
    aciertos: 0,         // servidas desde caché válida
    aciertosEnVuelo: 0,  // servidas reutilizando una petición en curso
    red: 0,              // lecturas que realmente tocaron la fuente
    invalidaciones: 0,
    parches: 0,          // correcciones en sitio que evitaron una lectura
    porClave: new Map()  // clave -> { solicitadas, aciertos, aciertosEnVuelo, red }
}

function claveCompuesta(uid, clave) {
    return `${uid}::${clave}`
}

// ============================================
// PERSISTENCIA EN localStorage
// ============================================
// Las entradas ya leídas de Firestore se guardan en localStorage para que
// sobrevivan a recargas y a cambiar de pestaña del navegador. Así, al volver
// a una página ya cargada, se sirve desde ahí y no se vuelve a pintar el
// esqueleto ni a gastar una lectura de red.
// Se usa de forma defensiva: si no hay localStorage (Node/privado) o se
// agota la cuota, se ignora y la caché en memoria sigue funcionando igual.
const STORAGE_PREFIX = "escinco_cache:"

function storageKey(uid, clave) {
    return `${STORAGE_PREFIX}${claveCompuesta(uid, clave)}`
}

function leerPersistido(uid, clave) {
    try {
        if (typeof localStorage === "undefined") return null
        const k = storageKey(uid, clave)
        const raw = localStorage.getItem(k)
        if (!raw) return null
        const entrada = JSON.parse(raw)
        if (!entrada || typeof entrada.expira !== "number") return null
        if (Date.now() > entrada.expira) {
            borrarPersistido(uid, clave)
            return null
        }
        // Los Timestamps de Firestore ({seconds, nanoseconds}) sobreviven al
        // JSON de localStorage pero pierden su tipo. Se reviven a Date para
        // que el resto de la app (y el exportador) los vea como fechas reales.
        entrada.datos = revivirTimestamps(entrada.datos)
        return entrada.datos
    } catch {
        return null
    }
}

function persistir(uid, clave, datos, expira) {
    try {
        if (typeof localStorage === "undefined") return
        localStorage.setItem(storageKey(uid, clave), JSON.stringify({ datos, expira }))
    } catch (error) {
        // Cuota excedida o modo privado: la caché en memoria sigue funcionando,
        // pero se avisa en consola para depuración.
        console.warn("[caché] No se pudo persistir en localStorage:", error.message)
    }
}

function borrarPersistido(uid, clave) {
    try {
        if (typeof localStorage === "undefined") return
        localStorage.removeItem(storageKey(uid, clave))
    } catch {}
}

function borrarPrefijoPersistido(prefijo) {
    try {
        if (typeof localStorage === "undefined") return
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i)
            if (k && k.startsWith(prefijo)) {
                localStorage.removeItem(k)
            }
        }
    } catch {}
}

/**
 * Convierte los Timestamps de Firestore serializados como mapas
 * `{seconds, nanoseconds}` (lo que queda tras un JSON.parse de localStorage)
 * de vuelta a objetos Date. Recorre arrays y objetos anidados.
 */
export function revivirTimestamps(valor) {
    if (Array.isArray(valor)) {
        return valor.map(revivirTimestamps)
    }
    if (valor !== null && typeof valor === "object") {
        if (typeof valor.seconds === "number" && typeof valor.nanoseconds === "number") {
            return new Date(valor.seconds * 1000 + Math.round(valor.nanoseconds / 1e6))
        }
        const resultado = {}
        for (const [clave, item] of Object.entries(valor)) {
            resultado[clave] = revivirTimestamps(item)
        }
        return resultado
    }
    return valor
}

function registrarIngresoClave(clave, campo) {
    const entradaClave = stats.porClave.get(clave) ||
        { solicitadas: 0, aciertos: 0, aciertosEnVuelo: 0, red: 0 }
    entradaClave[campo]++
    stats.porClave.set(clave, entradaClave)
}

export const cacheCapa = {
    async obtener(uid, clave, fn, opciones = {}) {
        if (!uid) {
            stats.solicitadas++
            stats.red++
            return await fn()
        }

        const ttl = opciones.ttl ?? TTL_DEFAULT
        const k = claveCompuesta(uid, clave)
        const ahora = Date.now()

        stats.solicitadas++
        registrarIngresoClave(clave, "solicitadas")

        const entrada = entradas.get(k)
        if (entrada && entrada.expira > ahora) {
            stats.aciertos++
            registrarIngresoClave(clave, "aciertos")
            return entrada.datos
        }

        // Caché persistente (localStorage): sobrevive a recargas y a cambiar
        // de pestaña del navegador, así no se vuelve a pintar esqueleto ni a
        // gastar una lectura de red cuando ya se tienen datos de la BD.
        const persistido = leerPersistido(uid, clave)
        if (persistido !== null) {
            stats.aciertos++
            registrarIngresoClave(clave, "aciertos")
            entradas.set(k, { datos: persistido, expira: ahora + ttl })
            return persistido
        }

        // Reutilizar la petición si hay una en vuelo
        if (enVuelo.has(k)) {
            stats.aciertosEnVuelo++
            registrarIngresoClave(clave, "aciertosEnVuelo")
            return enVuelo.get(k)
        }

        stats.red++
        registrarIngresoClave(clave, "red")

        const promesa = Promise.resolve()
            .then(fn)
            .then(datos => {
                entradas.set(k, { datos, expira: Date.now() + ttl })
                persistir(uid, clave, datos, Date.now() + ttl)
                return datos
            })
            .finally(() => {
                enVuelo.delete(k)
            })

        enVuelo.set(k, promesa)
        return promesa
    },

    /**
     * Lee datos ya cacheados (memoria o localStorage) sin ejecutar fetchFn ni
     * tocar la red. Devuelve null si no hay nada válido. No registra
     * estadísticas: es una consulta de "¿ya tenemos esto?".
     */
    leerCache(uid, clave) {
        if (!uid) return null
        const k = claveCompuesta(uid, clave)
        const ahora = Date.now()

        const entrada = entradas.get(k)
        if (entrada && entrada.expira > ahora) {
            return entrada.datos
        }

        const persistido = leerPersistido(uid, clave)
        if (persistido !== null) {
            entradas.set(k, { datos: persistido, expira: ahora + TTL_DEFAULT })
            return persistido
        }

        return null
    },

    invalidar(uid, clave) {
        if (!uid) return
        const k = claveCompuesta(uid, clave)
        if (entradas.has(k)) {
            entradas.delete(k)
            stats.invalidaciones++
        }
        borrarPersistido(uid, clave)
    },

    /**
     * Corrige una entrada de caché en sitio, sin soltar la invalidación.
     *
     * Para colecciones que crecen de a uno (movimientos): cuando la caché está
     * caliente, parchear el array cuesta 0 lecturas de red, mientras que
     * invalidar obliga a releer la colección entera en el siguiente render. Con
     * varias vistas suscritas a un mismo evento, un solo guardado disparaba
     * varias lecturas completas.
     *
     * Si la entrada no existe o ya expiró, no hace nada: el siguiente
     * `obtener()` la trae fresca de Firestore, que es el comportamiento
     * correcto.
     *
     * @param {string} uid
     * @param {string} clave
     * @param {(datos:any[]) => any[]} fn  recibe el array actual y devuelve el nuevo
     */
    parchear(uid, clave, fn) {
        if (!uid || typeof fn !== "function") return
        const k = claveCompuesta(uid, clave)
        const entrada = entradas.get(k)
        if (!entrada) return

        if (entrada.expira <= Date.now()) {
            entradas.delete(k)
            return
        }
        if (!Array.isArray(entrada.datos)) return

        const siguiente = fn(entrada.datos)
        if (!Array.isArray(siguiente)) return

        entrada.datos = siguiente
        stats.parches++
        // Persistir el parche en localStorage para que sobreviva a recargas
        // y cambios de pestaña. Si falla (cuota o modo privado), la copia en
        // memoria sigue siendo válida y el siguiente obtener() la usa.
        persistir(uid, clave, siguiente, entrada.expira)
    },

    invalidarPrefijo(uid, prefijo) {
        if (!uid) return
        const p = claveCompuesta(uid, prefijo)
        for (const k of entradas.keys()) {
            if (k.startsWith(p)) {
                entradas.delete(k)
                stats.invalidaciones++
            }
        }
        borrarPrefijoPersistido(`${STORAGE_PREFIX}${p}`)
    },

    limpiar(uid) {
        if (!uid) return
        const p = `${uid}::`
        for (const k of entradas.keys()) {
            if (k.startsWith(p)) {
                entradas.delete(k)
                stats.invalidaciones++
            }
        }
        borrarPrefijoPersistido(`${STORAGE_PREFIX}${p}`)
    },

    // --------------------------------------------
    // MEDICIÓN / REPORTES
    // --------------------------------------------

    estadisticas() {
        const solicitadas = stats.solicitadas
        const red = stats.red
        return {
            generado: new Date().toISOString(),
            iniciado: stats.iniciado,
            solicitadas,
            red,
            aciertos: stats.aciertos,
            aciertosEnVuelo: stats.aciertosEnVuelo,
            invalidaciones: stats.invalidaciones,
            parches: stats.parches,
            ahorroPorcentual: solicitadas
                ? Math.round(((solicitadas - red) / solicitadas) * 100)
                : 0,
            porClave: [...stats.porClave.entries()]
                .map(([clave, valores]) => ({ clave, ...valores }))
                .sort((a, b) => b.solicitadas - a.solicitadas || b.red - a.red)
        }
    },

    reiniciarEstadisticas() {
        stats.iniciado = Date.now()
        stats.solicitadas = 0
        stats.aciertos = 0
        stats.aciertosEnVuelo = 0
        stats.red = 0
        stats.invalidaciones = 0
        stats.parches = 0
        stats.porClave.clear()
    },

    guardarReporte() {
        const reporte = {
            tipo: "reporte-cache",
            navegador: typeof navigator !== "undefined" ? navigator.userAgent : "node",
            cacheCapa: this.estadisticas()
        }

        console.info("[caché] Resumen de estadísticas:")
        console.info(`  solicitadas: ${reporte.cacheCapa.solicitadas}`)
        console.info(`  red:         ${reporte.cacheCapa.red}`)
        console.info(`  ahorro:      ${reporte.cacheCapa.ahorroPorcentual}%`)
        console.info(reporte.cacheCapa.porClave)

        if (typeof document !== "undefined" && document.createElement) {
            const blob = new Blob(
                [JSON.stringify(reporte, null, 2)],
                { type: "application/json" }
            )
            const url = URL.createObjectURL(blob)
            descargarArchivoSeguro(
                url,
                `reporte-cache-${new Date().toISOString().slice(0, 10)}.json`
            )
            // Revocación diferida con margen (1000 ms): evita cancelar la
            // descarga antes de que arranque (bug #9).
        }

        return reporte
    }
}