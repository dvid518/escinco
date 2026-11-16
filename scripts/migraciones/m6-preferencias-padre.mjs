// M6: expande las cards agregadas de familia en una card por cuenta.
// Solo genera la propuesta `propuesta-m6.json`; no escribe Firestore (el SDK
// web no se puede cargar desde Node).
//----------------------------------------------------------------------------

import { writeFileSync } from "node:fs"
import {
    UID_RESPALDO,
    leerCuentas,
    leerPreferencias,
    uidDesdeBackup
} from "./lector-datos.mjs"
import {
    argumentosMigracion,
    migrarPreferenciasM6,
    resumenCambios
} from "./preferencias.mjs"

const args = argumentosMigracion()
const uid = args.uid || uidDesdeBackup(args.backupPath) || UID_RESPALDO

function fuenteDatos() {
    return args.backupPath ? `backup ${args.backupPath}` : "Firestore"
}

async function ejecutar() {
    console.log(`=== M6: preferencias de padre a cards individuales ===${args.dryRun ? " (DRY-RUN)" : ""}`)
    console.log(`UID: ${uid}`)

    const cuentas = await leerCuentas(uid, { backupPath: args.backupPath })
    const preferencias = await leerPreferencias(uid, { backupPath: args.backupPath })
    const dashboard = preferencias?.dashboard
    if (!dashboard) throw new Error("las preferencias no tienen dashboard")

    const { dashboard: propuesto, cambios } = migrarPreferenciasM6(dashboard, cuentas)
    const resumen = resumenCambios(cambios)
    const propuesta = {
        migracion: "M6",
        fecha: new Date().toISOString(),
        uid,
        fuente: fuenteDatos(),
        resumen,
        cambios,
        dashboard_propuesto: propuesto,
        estado_general: cambios.length > 0 ? "pendiente_aplicacion" : "sin_cambios",
        instrucciones: [
            "Revisar los cambios y editar el JSON si algún caso no debe migrarse.",
            "Aplicar cuando la UI de F7.7 lea cada cuenta como instancia individual:",
            "  hoy el dashboard sigue agregando la familia y poda las cards de hijas.",
            "No se escribe Firestore desde Node; la aplicación real requiere un escritor de preferencias."
        ]
    }

    writeFileSync("./propuesta-m6.json", JSON.stringify(propuesta, null, 2))
    console.log(`\nCuentas leídas: ${cuentas.length}`)
    console.log(`Cards de familia expandidas: ${resumen.familia_expandida || 0}`)
    console.log(`Dimensiones ajustadas: ${resumen.dimension_ajustada || 0}`)
    console.log(`Dimensiones eliminadas: ${resumen.dimension_eliminada || 0}`)
    console.log(`\n> Propuesta guardada en: ./propuesta-m6.json`)
    if (cambios.length === 0) console.log("Sin cambios: las preferencias ya están migradas.")
    if (args.dryRun) console.log("\n⚠ Modo DRY-RUN: solo se generó la propuesta.")
}

ejecutar().catch(error => {
    console.error("❌", error.message)
    process.exit(1)
})
