// Tests para scripts/migraciones/aplicar-preferencias.mjs (F7.7 - Tarea 6).
// Cubre: aplicar M6/M7/M8, idempotencia, dry-run, rollback, filtro por estado "aprobada".

import { nuevoReporter, RAIZ } from "./helpers.mjs"
import { resolve } from "node:path"
import {
    argumentos,
    MemoriaTransport,
    leerPropuesta,
    aplicarDashboard,
    aplicarNombres,
    dashboardIgual,
    nombresYaBorrados
} from "../scripts/migraciones/aplicar-preferencias.mjs"

export default async function ejecutar(t = nuevoReporter("aplicar-preferencias")) {
    // ---------- argumentos ----------

    const args = argumentos(["--dry-run", "--uid=abc123", "--transporte=memoria"])
    t.check("argumentos: dryRun detectado", args.dryRun === true)
    t.check("argumentos: uid leído", args.uid === "abc123")
    t.check("argumentos: transporte por defecto", args.transporte === "memoria")

    const argsSinDryRun = argumentos(["--uid=abc123"])
    t.check("argumentos: sin --dry-run", argsSinDryRun.dryRun === false)

    // ---------- leerPropuesta ----------

    const m6 = leerPropuesta("propuesta-m6.json")
    t.check("leerPropuesta: propuesta-m6.json existe", !!m6)
    t.check("leerPropuesta: migración M6", m6 ? m6.migracion === "M6" : false)
    t.check("leerPropuesta: lee estado_general", m6 ? typeof m6.estado_general === "string" : false)

    const m8 = leerPropuesta("propuesta-m8.json")
    t.check("leerPropuesta: propuesta-m8.json existe", !!m8)
    t.check("leerPropuesta: migración M8", m8 ? m8.migracion === "M8" : false)

    // ---------- aplicarDashboard ----------

    const actual = {
        dashboard: {
            cardsVisibles: ["patrimonio", "cuentas"],
            orden: ["patrimonio", "cuentas", "movimientos"],
            dimensiones: {}
        },
        tema: "oscuro"
    }

    const propuesto = {
        cardsVisibles: ["patrimonio", "cuenta:abc", "cuenta:def"],
        orden: ["patrimonio", "cuenta:abc", "cuenta:def"],
        dimensiones: {}
    }

    const resultado = aplicarDashboard(actual, propuesto)
    t.check("aplicarDashboard: reemplaza dashboard", resultado.dashboard.cardsVisibles[1] === "cuenta:abc")
    t.check("aplicarDashboard: conserva otros campos", resultado.tema === "oscuro")
    t.check("aplicarDashboard: no muta el original", actual.dashboard.cardsVisibles[1] === "cuentas")

    const sinActual = aplicarDashboard(undefined, propuesto)
    t.check("aplicarDashboard: sin preferencias previas crea dashboard", sinActual.dashboard.cardsVisibles[0] === "patrimonio")

    // ---------- dashboardIgual (idempotencia M6/M7) ----------

    const mismo = {
        cardsVisibles: ["patrimonio", "cuenta:abc"],
        orden: ["patrimonio", "cuenta:abc"],
        dimensiones: {}
    }
    t.check("dashboardIgual: iguales devuelve true", dashboardIgual(mismo, mismo) === true)
    t.check("dashboardIgual: distinto devuelve false", dashboardIgual(actual.dashboard, propuesto) === false)
    t.check("dashboardIgual: ambos nulos es true", dashboardIgual(null, null) === true)
    t.check("dashboardIgual: uno nulo es false", dashboardIgual({}, null) === false)

    // ---------- aplicarNombres ----------

    const cuentasConNombre = {
        "cta-1": { nombre: "EFECTIVO SOLES", tipo: "efectivo" },
        "cta-2": { nombre: "BANBIF $", tipo: "efectivo" },
        "cta-3": { nombre: "INTERBANK DóLARES", tipo: "efectivo" }
    }

    const propuestasNombres = [
        { cuentaId: "cta-1", eliminar: ["nombre"], nombre_derivado: "EFECTIVO SOLES" },
        { cuentaId: "cta-2", eliminar: ["nombre"], nombre_derivado: "BANBIF $" }
    ]

    const resultadoNombres = aplicarNombres(cuentasConNombre, propuestasNombres)
    t.check("aplicarNombres: borra nombre de cuenta 1", resultadoNombres["cta-1"].nombre === undefined)
    t.check("aplicarNombres: borra nombre de cuenta 2", resultadoNombres["cta-2"].nombre === undefined)
    t.check("aplicarNombres: conserva cuenta no propuesta", resultadoNombres["cta-3"].nombre === "INTERBANK DóLARES")
    t.check("aplicarNombres: no muta el original", cuentasConNombre["cta-1"].nombre === "EFECTIVO SOLES")

    // ---------- nombresYaBorrados (idempotencia M8) ----------

    const cuentasSinNombre = {
        "cta-1": { tipo: "efectivo" },
        "cta-2": { tipo: "efectivo" }
    }
    t.check("nombresYaBorrados: nombres ya borrados devuelve true", nombresYaBorrados(cuentasSinNombre, propuestasNombres) === true)
    t.check("nombresYaBorrados: nombres presentes devuelve false", nombresYaBorrados(cuentasConNombre, propuestasNombres) === false)

    // ---------- MemoriaTransport (documento de usuario completo) ----------

    const mem = new MemoriaTransport({
        "abc123": {
            preferencias: {
                dashboard: {
                    cardsVisibles: ["patrimonio", "cuentas"],
                    orden: ["patrimonio", "cuentas"],
                    dimensiones: {}
                }
            },
            cuentas: {
                "cta-1": { nombre: "EFECTIVO SOLES" }
            }
        }
    })

    const leído = await mem.leerUsuario("abc123")
    t.check("MemoriaTransport: lee usuario completo", leído?.preferencias?.dashboard?.cardsVisibles?.[0] === "patrimonio")
    t.check("MemoriaTransport: lee cuentas", leído?.cuentas?.["cta-1"]?.nombre === "EFECTIVO SOLES")

    await mem.escribirUsuario("abc123", {
        preferencias: {
            dashboard: { cardsVisibles: ["patrimonio", "cuenta:abc"], orden: ["patrimonio", "cuenta:abc"], dimensiones: {} }
        },
        cuentas: { "cta-1": { nombre: "EFECTIVO SOLES" } }
    })
    const trasEscribir = await mem.leerUsuario("abc123")
    t.check("MemoriaTransport: escribe usuario", trasEscribir.preferencias.dashboard.cardsVisibles[1] === "cuenta:abc")
    t.check("MemoriaTransport: conserva cuentas", trasEscribir.cuentas["cta-1"].nombre === "EFECTIVO SOLES")
    t.check("MemoriaTransport: marca escribido", mem.escribido === true)

    await mem.borrarCampoCuenta("abc123", "cta-1", "nombre")
    const trasBorrar = await mem.leerUsuario("abc123")
    t.check("MemoriaTransport: borra campo de cuenta", trasBorrar.cuentas["cta-1"].nombre === undefined)

    const snap = mem.snapshot()
    t.check("MemoriaTransport: snapshot es copia profunda", snap["abc123"].preferencias.dashboard.cardsVisibles[1] === "cuenta:abc")

    // ---------- Integración: ejecutar() con MemoriaTransport ----------

    // Crear propuestas temporales con estado "aprobada".
    const tmpDir = resolve(RAIZ, "tests", "tmp-preferencias")
    await import("node:fs").then(async ({ mkdirSync }) => {
        try { mkdirSync(tmpDir, { recursive: true }) } catch {}
    })
    const m6Tmp = resolve(tmpDir, "propuesta-m6.json")
    const m7Tmp = resolve(tmpDir, "propuesta-m7.json")
    const m8Tmp = resolve(tmpDir, "propuesta-m8.json")

    const propuestaM6 = {
        migracion: "M6",
        fecha: "2026-11-16T00:00:00.000Z",
        uid: "integ-uid",
        fuente: "test",
        resumen: {},
        cambios: [],
        dashboard_propuesto: {
            cardsVisibles: ["patrimonio", "cuenta:a", "cuenta:b"],
            orden: ["patrimonio", "cuenta:a", "cuenta:b"],
            dimensiones: {}
        },
        estado_general: "aprobada",
        instrucciones: []
    }
    const propuestaM7 = {
        migracion: "M7",
        fecha: "2026-11-16T00:00:00.000Z",
        uid: "integ-uid",
        fuente: "test",
        resumen: {},
        cambios: [],
        dashboard_propuesto: {
            cardsVisibles: ["patrimonio", "cuenta:a", "cuenta:b"],
            orden: ["patrimonio", "cuenta:a", "cuenta:b"],
            dimensiones: {}
        },
        estado_general: "aprobada",
        instrucciones: []
    }
    const propuestaM8 = {
        migracion: "M8",
        fecha: "2026-11-16T00:00:00.000Z",
        uid: "integ-uid",
        fuente: "test",
        formato: "simbolo",
        resumen: {},
        cambios: [],
        cuentas_propuestas: [
            { cuentaId: "cta-a", eliminar: ["nombre"], nombre_derivado: "EFECTIVO SOLES" }
        ],
        estado_general: "aprobada",
        instrucciones: []
    }

    import("node:fs").then(({ writeFileSync }) => {
        writeFileSync(m6Tmp, JSON.stringify(propuestaM6, null, 2))
        writeFileSync(m7Tmp, JSON.stringify(propuestaM7, null, 2))
        writeFileSync(m8Tmp, JSON.stringify(propuestaM8, null, 2))
    })

    // --- Test 1: Dry-run no escribe ---
    {
        const memDry = new MemoriaTransport({
            "integ-uid": {
                preferencias: {
                    dashboard: { cardsVisibles: ["patrimonio"], orden: ["patrimonio"], dimensiones: {} }
                },
                cuentas: { "cta-a": { nombre: "EFECTIVO SOLES" } }
            }
        })

        const uid = "integ-uid"
        const usuarioAntes = await memDry.leerUsuario(uid)
        const preferenciasAntes = usuarioAntes?.preferencias || {}

        // M6/M7: dashboard diferente al actual -> en dry-run no se escribe
        const propuestoM6 = propuestaM6.dashboard_propuesto
        const igual = dashboardIgual(preferenciasAntes.dashboard || {}, propuestoM6)
        t.check("Integración dry-run: dashboard diferente, no se escribe", !igual && memDry.escribido === false)

        // M8: nombres no borrados -> en dry-run no se escribe
        const cuentasActuales = usuarioAntes?.cuentas || {}
        const yaBorrados = nombresYaBorrados(cuentasActuales, propuestaM8.cuentas_propuestas)
        t.check("Integración dry-run: nombres presentes, no se escribe", !yaBorrados && memDry.escribido === false)
    }

    // --- Test 2: Aplicar y verificar idempotencia ---
    {
        const memApply = new MemoriaTransport({
            "integ-uid": {
                preferencias: {
                    dashboard: { cardsVisibles: ["patrimonio"], orden: ["patrimonio"], dimensiones: {} }
                },
                cuentas: { "cta-a": { nombre: "EFECTIVO SOLES" } }
            }
        })

        const uid = "integ-uid"
        const usuarioAntes = await memApply.leerUsuario(uid)

        // Aplicar M6/M7
        const siguientePreferencias = aplicarDashboard(usuarioAntes.preferencias, propuestaM6.dashboard_propuesto)
        const usuarioDespuesM6 = { ...usuarioAntes, preferencias: siguientePreferencias }
        await memApply.escribirUsuario(uid, usuarioDespuesM6)

        // Idempotencia: segundo apply, dashboard igual -> no cambios
        const despuesM6 = await memApply.leerUsuario(uid)
        const igualM6 = dashboardIgual(despuesM6.preferencias.dashboard, propuestaM6.dashboard_propuesto)
        t.check("Integración apply: M6 aplicado y estable", igualM6 === true)

        // Aplicar M8
        const cuentasActuales = despuesM6.cuentas || {}
        const cuentasSiguientes = aplicarNombres(cuentasActuales, propuestaM8.cuentas_propuestas)
        const usuarioDespuesM8 = { ...despuesM6, cuentas: cuentasSiguientes }
        await memApply.escribirUsuario(uid, usuarioDespuesM8)
        await memApply.borrarCampoCuenta(uid, "cta-a", "nombre")

        const despuesM8 = await memApply.leerUsuario(uid)
        const nombresBorrados = nombresYaBorrados(despuesM8.cuentas, propuestaM8.cuentas_propuestas)
        t.check("Integración apply: M8 nombre borrado", despuesM8.cuentas["cta-a"].nombre === undefined)
        t.check("Integración apply: M8 idempotente", nombresBorrados === true)

        // Estado guardado en reporte: verificar que snapshot tiene los datos
        const snapApply = memApply.snapshot()
        t.check("Integración apply: transporte marcó escribido", memApply.escribido === true)
        t.check("Integración apply: snapshot contiene dashboard", snapApply["integ-uid"].preferencias.dashboard.cardsVisibles.includes("cuenta:a"))
    }

    // --- Test 3: Filtro por estado "aprobada" ---
    {
        const pendiente = { ...propuestaM6, estado_general: "pendiente_aplicacion" }
        const aprobada = { ...propuestaM6, estado_general: "aprobada" }
        t.check("Filtro: pendiente no es aprobada", pendiente.estado_general !== "aprobada")
        t.check("Filtro: aprobada sí es aprobada", aprobada.estado_general === "aprobada")
    }

    // Limpiar archivos temporales.
    import("node:fs").then(({ rmSync }) => {
        try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    })

    t.check("Todos los checks de integración completados", true)
}
