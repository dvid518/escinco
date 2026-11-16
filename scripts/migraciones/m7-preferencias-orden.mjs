// M7: deja coherentes cardsVisibles, orden y dimensiones.
// Con --desde=propuesta-m6.json valida la propuesta de M6 sin aplicarla.
// Solo genera `propuesta-m7.json`; no escribe Firestore desde Node.
//----------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import {
    UID_RESPALDO,
    leerActivos,
    leerCuentas,
    leerPreferencias,
    resolverRuta,
    uidDesdeBackup
} from "./lector-datos.mjs"
import {
    argumentosMigracion,
    migrarPreferenciasM7,
    resumenCambios
} from "./preferencias.mjs"

const args = argumentosMigracion()
const uid = args.uid || uidDesdeBackup(args.backupPath) || UID_RESPALDO

function fuenteDatos() {
    const origen = args.backupPath ? `backup ${args.backupPath}` : "Firestore"
    return args.desde ? `${origen}; dashboard de ${args.desde}` : origen
}

function dashboardDeEntrada(preferencias) {
    if (!args.desde) return preferencias?.dashboard
    const ruta = resolverRuta(args.desde)
    if (!existsSync(ruta)) throw new Error(`no existe la propuesta indicada en --desde: ${ruta}`)
    const propuesta = JSON.parse(readFileSync(ruta, "utf-8"))
    if (!propuesta.dashboard_propuesto) {
        throw new Error(`${args.desde} no contiene dashboard_propuesto`)
    }
    return propuesta.dashboard_propuesto
}

async function ejecutar() {
    console.log(`=== M7: coherencia de orden, visibilidad y dimensiones ===${args.dryRun ? " (DRY-RUN)" : ""}`)
    console.log(`UID: ${uid}`)

    const cuentas = await leerCuentas(uid, { backupPath: args.backupPath })
    const activos = await leerActivos(uid, { backupPath: args.backupPath })
    const preferencias = await leerPreferencias(uid, { backupPath: args.backupPath })
    const dashboard = dashboardDeEntrada(preferencias)
    if (!dashboard) throw new Error("las preferencias no tienen dashboard")

    const { dashboard: propuesto, cambios } = migrarPreferenciasM7(dashboard, cuentas, activos)
    const resumen = resumenCambios(cambios)
    const propuesta = {
        migracion: "M7",
        fecha: new Date().toISOString(),
        uid,
        fuente: fuenteDatos(),
        resumen,
        cambios,
        dashboard_propuesto: propuesto,
        estado_general: cambios.length > 0 ? "pendiente_aplicacion" : "sin_cambios",
        instrucciones: [
            "Revisar los cambios y editar el JSON si alguna card no debe descartarse.",
            "Aplicar después de M6 y de la UI de F7.7.",
            "No se escribe Firestore desde Node; la aplicación real requiere un escritor de preferencias."
        ]
    }

    writeFileSync("./propuesta-m7.json", JSON.stringify(propuesta, null, 2))
    console.log(`\nCuentas leídas: ${cuentas.length}`)
    console.log(`Activos leídos: ${activos.length}`)
    console.log(`Cards huérfanas: ${resumen.card_huerfana || 0}`)
    console.log(`Cards añadidas al orden: ${resumen.orden_completado || 0}`)
    console.log(`Dimensiones ajustadas: ${resumen.dimension_ajustada || 0}`)
    console.log(`\n> Propuesta guardada en: ./propuesta-m7.json`)
    if (cambios.length === 0) console.log("Sin cambios: las preferencias ya son coherentes.")
    if (args.dryRun) console.log("\n⚠ Modo DRY-RUN: solo se generó la propuesta.")
}

ejecutar().catch(error => {
    console.error("❌", error.message)
    process.exit(1)
})
