// Aplicador de propuestas de preferencias M6-M8 para Firestore.
// Lee propuesta-m6.json / m7 / m8, aplica solo las con estado_general === "aprobada",
// escribe preferencias.dashboard y nombres de subcuentas (M8), es idempotente,
// requiere --dry-run para no escribir nada, y guarda el estado previo en
// reporte-preferencias.json para rollback.
//
// Transportes:
//   - memoria  : objeto en memoria (tests, sin red)
//   - archivo  : lee/escribe un JSON local (simula Firestore en desarrollo)
//   - rest     : Firestore REST API (FIREBASE_ACCESS_TOKEN o emulator Bearer owner)
//
// Uso:
//   node scripts/migraciones/aplicar-preferencias.mjs --dry-run
//   node scripts/migraciones/aplicar-preferencias.mjs --transporte=memoria
//   node scripts/migraciones/aplicar-preferencias.mjs --transporte=rest --uid=XXX

import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { RAIZ } from "./helpers.mjs"

const PROPUESTA_M6 = resolve(RAIZ, "propuesta-m6.json")
const PROPUESTA_M7 = resolve(RAIZ, "propuesta-m7.json")
const PROPUESTA_M8 = resolve(RAIZ, "propuesta-m8.json")
const REPORTE_ROLLBACK = resolve(RAIZ, "reporte-preferencias.json")

const ESTADO_APROBADA = "aprobada"

//----------------------------------------------------------------------------
// Argumentos de línea de comandos
//----------------------------------------------------------------------------

function argumentos(argv = process.argv.slice(2)) {
    const valor = prefijo => argv.find(a => a.startsWith(prefijo))?.slice(prefijo.length) || null
    return {
        dryRun: argv.includes("--dry-run"),
        uid: valor("--uid="),
        transporte: valor("--transporte=") || "memoria",
        reporte: valor("--reporte=") || REPORTE_ROLLBACK
    }
}

//----------------------------------------------------------------------------
// Transporte: abstracción de lectura/escritura de preferencias
//----------------------------------------------------------------------------

class TransportError extends Error {
    constructor(mensaje, causa) {
        super(mensaje)
        this.causa = causa
        this.name = "TransportError"
    }
}

class MemoriaTransport {
    constructor(inicial = {}) {
        this.datos = JSON.parse(JSON.stringify(inicial))
        this.escribido = false
    }

    leerUsuario(uid) {
        const u = this.datos[uid]
        return u ? JSON.parse(JSON.stringify(u)) : null
    }

    escribirUsuario(uid, datos) {
        if (!this.datos[uid]) this.datos[uid] = {}
        this.datos[uid] = JSON.parse(JSON.stringify(datos))
        this.escribido = true
        return null
    }

    borrarCampoCuenta(uid, cuentaId, campo) {
        if (!this.datos[uid]) this.datos[uid] = {}
        if (!this.datos[uid].cuentas) this.datos[uid].cuentas = {}
        if (this.datos[uid].cuentas[cuentaId]) {
            delete this.datos[uid].cuentas[cuentaId][campo]
        }
        this.escribido = true
        return null
    }

    snapshot() {
        return JSON.parse(JSON.stringify(this.datos))
    }
}

class ArchivoTransport {
    constructor(ruta) {
        this.ruta = ruta
        this.datos = {}
        this.escribido = false
        this.cargar()
    }

    cargar() {
        if (existsSync(this.ruta)) {
            try {
                this.datos = JSON.parse(readFileSync(this.ruta, "utf-8"))
            } catch {
                this.datos = {}
            }
        }
    }

    leerUsuario(uid) {
        const u = this.datos[uid]
        return u ? JSON.parse(JSON.stringify(u)) : null
    }

    escribirUsuario(uid, datos) {
        if (!this.datos[uid]) this.datos[uid] = {}
        this.datos[uid] = JSON.parse(JSON.stringify(datos))
        this.escribido = true
        this.persistir()
        return null
    }

    borrarCampoCuenta(uid, cuentaId, campo) {
        if (!this.datos[uid]) this.datos[uid] = {}
        if (!this.datos[uid].cuentas) this.datos[uid].cuentas = {}
        if (this.datos[uid].cuentas[cuentaId]) {
            delete this.datos[uid].cuentas[cuentaId][campo]
        }
        this.escribido = true
        this.persistir()
        return null
    }

    persistir() {
        writeFileSync(this.ruta, JSON.stringify(this.datos, null, 2))
    }

    snapshot() {
        return JSON.parse(JSON.stringify(this.datos))
    }
}

class RestTransport {
    constructor(projectId, accessToken) {
        this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
        this.accessToken = accessToken
        this.escribido = false
    }

    async leerUsuario(uid) {
        const url = `${this.base}/usuarios/${encodeURIComponent(uid)}`
        const respuesta = await fetch(url, {
            headers: { Authorization: `Bearer ${this.accessToken}` }
        })
        if (!respuesta.ok) {
            if (respuesta.status === 404) return null
            throw new TransportError(`Firestore GET ${url}: ${respuesta.status}`, respuesta.status)
        }
        const datos = await respuesta.json()
        const resultado = {}
        if (datos.fields?.preferencias) resultado.preferencias = this.descampos(datos.fields.preferencias)
        if (datos.fields?.cuentas) resultado.cuentas = this.descampos(datos.fields.cuentas)
        return Object.keys(resultado).length > 0 ? resultado : null
    }

    async escribirUsuario(uid, datos) {
        const url = `${this.base}/usuarios/${encodeURIComponent(uid)}`
        const campos = {}
        if (datos.preferencias !== undefined) {
            campos.preferencias = { mapValue: { fields: this.acampos(datos.preferencias) } }
        }
        if (datos.cuentas !== undefined) {
            campos.cuentas = { mapValue: { fields: this.acampos(datos.cuentas) } }
        }
        const body = { fields: campos }
        const respuesta = await fetch(url, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })
        if (!respuesta.ok) {
            throw new TransportError(`Firestore PATCH ${url}: ${respuesta.status}`, respuesta.status)
        }
        this.escribido = true
        return await respuesta.json()
    }

    async borrarCampoCuenta(uid, cuentaId, campo) {
        const url = `${this.base}/usuarios/${encodeURIComponent(uid)}/cuentas/${encodeURIComponent(cuentaId)}`
        const body = {
            fields: {
                [campo]: { delete: true }
            }
        }
        const respuesta = await fetch(url, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })
        if (!respuesta.ok) {
            throw new TransportError(`Firestore PATCH ${url}: ${respuesta.status}`, respuesta.status)
        }
        this.escribido = true
        return await respuesta.json()
    }

    // Convierte un objeto JS plano a Firestore field values (recursivo).
    acampos(valor) {
        if (valor === null) return { nullValue: null }
        if (typeof valor === "boolean") return { booleanValue: valor }
        if (typeof valor === "number") return { doubleValue: valor }
        if (typeof valor === "string") return { stringValue: valor }
        if (Array.isArray(valor)) {
            return {
                arrayValue: { values: valor.map(v => this.acampos(v)) }
            }
        }
        if (typeof valor === "object") {
            const campos = {}
            for (const [k, v] of Object.entries(valor)) {
                if (v !== undefined) campos[k] = this.acampos(v)
            }
            return { mapValue: { fields: campos } }
        }
        return { nullValue: null }
    }

    // Convierte un Firestore field value a objeto JS plano (recursivo).
    descampos(campo) {
        if (campo.nullValue !== undefined) return null
        if (campo.booleanValue !== undefined) return campo.booleanValue
        if (campo.doubleValue !== undefined) return campo.doubleValue
        if (campo.integerValue !== undefined) return Number(campo.integerValue)
        if (campo.stringValue !== undefined) return campo.stringValue
        if (campo.timestampValue !== undefined) return new Date(campo.timestampValue)
        if (campo.arrayValue) return (campo.arrayValue.values || []).map(v => this.descampos(v))
        if (campo.mapValue) {
            const resultado = {}
            for (const [k, v] of Object.entries(campo.mapValue.fields || {})) {
                resultado[k] = this.descampos(v)
            }
            return resultado
        }
        return null
    }
}

//----------------------------------------------------------------------------
// Lectura de propuestas
//----------------------------------------------------------------------------

function leerPropuesta(ruta) {
    if (!existsSync(ruta)) return null
    try {
        return JSON.parse(readFileSync(ruta, "utf-8"))
    } catch {
        return null
    }
}

//----------------------------------------------------------------------------
// Aplicación de cambios (pura, sobre un objeto de preferencias)
//----------------------------------------------------------------------------

function aplicarDashboard(preferenciasActual, dashboardPropuesto) {
    const siguiente = JSON.parse(JSON.stringify(preferenciasActual || {}))
    siguiente.dashboard = JSON.parse(JSON.stringify(dashboardPropuesto))
    return siguiente
}

function aplicarNombres(cuentasActuales, cuentasPropuestas) {
    const siguiente = JSON.parse(JSON.stringify(cuentasActuales || {}))
    for (const propuesta of cuentasPropuestas) {
        if (!propuesta.eliminar || !propuesta.eliminar.includes("nombre")) continue
        const cuentaId = propuesta.cuentaId
        if (!siguiente[cuentaId]) siguiente[cuentaId] = {}
        delete siguiente[cuentaId].nombre
    }
    return siguiente
}

// Idempotencia: ¿el dashboard ya coincide con el propuesto?
function dashboardIgual(actual, propuesto) {
    if (!actual || !propuesto) return !actual && !propuesto
    return (
        JSON.stringify(actual.cardsVisibles) === JSON.stringify(propuesto.cardsVisibles) &&
        JSON.stringify(actual.orden) === JSON.stringify(propuesto.orden) &&
        JSON.stringify(actual.dimensiones) === JSON.stringify(propuesto.dimensiones)
    )
}

// ¿Ya se borró el nombre de todas las cuentas propuestas?
function nombresYaBorrados(cuentasActuales, cuentasPropuestas) {
    for (const propuesta of cuentasPropuestas) {
        if (!propuesta.eliminar || !propuesta.eliminar.includes("nombre")) continue
        const cuenta = (cuentasActuales || {})[propuesta.cuentaId]
        if (cuenta && cuenta.nombre !== undefined) return false
    }
    return true
}

//----------------------------------------------------------------------------
// Ejecución principal
//----------------------------------------------------------------------------

async function ejecutar() {
    const args = argumentos()

    if (args.dryRun) {
        console.info("=== APLICAR PREFERENCIAS M6-M8 (DRY-RUN) ===")
    } else {
        console.info("=== APLICAR PREFERENCIAS M6-M8 ===")
    }

    // Leer propuestas
    const m6 = leerPropuesta(PROPUESTA_M6)
    const m7 = leerPropuesta(PROPUESTA_M7)
    const m8 = leerPropuesta(PROPUESTA_M8)

    const propuestas = []
    if (m6) propuestas.push({ migracion: "M6", datos: m6 })
    if (m7) propuestas.push({ migracion: "M7", datos: m7 })
    if (m8) propuestas.push({ migracion: "M8", datos: m8 })

    const aprobadas = propuestas.filter(p => p.datos?.estado_general === ESTADO_APROBADA)
    const omitidas = propuestas.filter(p => p.datos?.estado_general !== ESTADO_APROBADA)

    console.info(`Propuestas leídas: ${propuestas.length}`)
    console.info(`Aprobadas: ${aprobadas.length}`)
    for (const p of omitidas) {
        console.info(`  ⏭ ${p.migracion}: estado_general="${p.datos?.estado_general}", se omite`)
    }

    if (aprobadas.length === 0) {
        console.info("\nNinguna propuesta aprobada para aplicar.")
        if (args.dryRun) console.info("\n⚠ Modo DRY-RUN: no se escribió nada.")
        return
    }

    // UID: de la primera propuesta aprobada o del argumento --uid=
    const uid = args.uid || aprobadas[0].datos?.uid
    if (!uid) throw new Error("No se pudo determinar el UID (usa --uid=UID)")

    // Leer estado actual
    const projectId = process.env.FIRESTORE_PROJECT_ID || "cinco-96064"
    let transport
    if (args.transporte === "archivo") {
        const rutaArchivo = resolve(RAIZ, args.uid + "-preferencias-transporte.json")
        transport = new ArchivoTransport(rutaArchivo)
    } else if (args.transporte === "rest") {
        const accessToken = process.env.FIREBASE_ACCESS_TOKEN
        if (!accessToken) throw new Error("Transporte rest requiere FIREBASE_ACCESS_TOKEN")
        transport = new RestTransport(projectId, accessToken)
    } else {
        transport = new MemoriaTransport()
    }

    const usuarioAntes = await transport.leerUsuario(uid)

    // Guardar rollback (estado previo) ANTES de escribir nada
    const reporte = {
        generado: new Date().toISOString(),
        uid,
        dryRun: args.dryRun,
        transportes: args.transporte,
        estadoAntes: usuarioAntes ? JSON.parse(JSON.stringify(usuarioAntes)) : null,
        aplicaciones: []
    }

    let usuarioActual = JSON.parse(JSON.stringify(usuarioAntes || {}))
    const preferenciasActual = usuarioActual?.preferencias || {}
    const cuentasActuales = usuarioActual?.cuentas || {}

    for (const propuesta of aprobadas) {
        const app = { migracion: propuesta.migracion, cambios: [], idempotente: false }

        if (propuesta.migracion === "M6" || propuesta.migracion === "M7") {
            const propuesto = propuesta.datos.dashboard_propuesto
            const actualDashboard = preferenciasActual?.dashboard || {}
            if (dashboardIgual(actualDashboard, propuesto)) {
                app.idempotente = true
                app.cambios.push({ tipo: "dashboard", accion: "sin_cambios", motivo: "ya está aplicado" })
            } else {
                if (!args.dryRun) {
                    const siguientePreferencias = aplicarDashboard(preferenciasActual, propuesto)
                    usuarioActual = { ...usuarioActual, preferencias: siguientePreferencias }
                    await transport.escribirUsuario(uid, usuarioActual)
                    // Reflejar en memoria para posibles pasos siguientes.
                    preferenciasActual = siguientePreferencias
                }
                app.cambios.push({
                    tipo: "dashboard",
                    accion: "actualizar",
                    cardsVisibles: propuesto.cardsVisibles?.length ?? 0,
                    orden: propuesto.orden?.length ?? 0,
                    dimensiones: Object.keys(propuesto.dimensiones || {}).length
                })
            }
        }

        if (propuesta.migracion === "M8") {
            const propuestasNombres = propuesta.datos.cuentas_propuestas || []
            if (nombresYaBorrados(cuentasActuales, propuestasNombres)) {
                app.idempotente = true
                app.cambios.push({ tipo: "nombres", accion: "sin_cambios", motivo: "nombres ya borrados" })
            } else {
                if (!args.dryRun) {
                    const siguientesCuentas = aplicarNombres(cuentasActuales, propuestasNombres)
                    usuarioActual = { ...usuarioActual, cuentas: siguientesCuentas }
                    await transport.escribirUsuario(uid, usuarioActual)
                    for (const p of propuestasNombres) {
                        if (p.eliminar && p.eliminar.includes("nombre")) {
                            await transport.borrarCampoCuenta(uid, p.cuentaId, "nombre")
                        }
                    }
                    // Reflejar en memoria.
                    cuentasActuales = siguientesCuentas
                }
                const borrados = propuestasNombres.filter(p => p.eliminar && p.eliminar.includes("nombre")).length
                app.cambios.push({ tipo: "nombres", accion: "borrar_nombre", cuentas: borrados })
            }
        }

        reporte.aplicaciones.push(app)
    }

    // Guardar reporte de rollback
    if (!args.dryRun) {
        writeFileSync(args.reporte, JSON.stringify(reporte, null, 2))
    }

    // Resumen
    console.info("\nAplicaciones:")
    for (const app of reporte.aplicaciones) {
        const marca = app.idempotente ? "(idempotente, sin escritura)" : ""
        console.info(`  ${app.migracion}: ${app.cambios.map(c => c.accion + (c.cuentas ? ` ${c.cuentas} cuentas` : "")).join(", ")} ${marca}`)
    }

    if (args.dryRun) {
        console.info("\n⚠ Modo DRY-RUN: no se escribió nada en Firestore.")
        console.info(`   Reporte de rollback no guardado (usa --dry-run omitido para aplicar de verdad).`)
    } else {
        console.info(`\n✓ Estado previo guardado en: ${args.reporte}`)
        console.info(`   Reporte de rollback listo para restaurar si es necesario.`)
    }
}

export { argumentos, TransportError, MemoriaTransport, ArchivoTransport, RestTransport, leerPropuesta, aplicarDashboard, aplicarNombres, dashboardIgual, nombresYaBorrados, ejecutar }

// Solo ejecutar cuando se invoca directamente como script (no al importar en tests).
const ES_PUNTO_DE_ENTRADA = process.argv[1] && process.argv[1].endsWith("aplicar-preferencias.mjs")
if (ES_PUNTO_DE_ENTRADA) {
    ejecutar().catch(error => {
        console.error("❌", error.message)
        if (error.causa) console.error("   Causa:", error.causa)
        process.exit(1)
    })
}
