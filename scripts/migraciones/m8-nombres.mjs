// M8: borra el nombre guardado de las subcuentas automáticas para que se
// derive de padre + divisa. Las personalizadas no se tocan.
// Solo genera `propuesta-m8.json`; no escribe Firestore desde Node.
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
    migrarNombresM8,
    resumenCambios
} from "./preferencias.mjs"

const args = argumentosMigracion()
const uid = args.uid || uidDesdeBackup(args.backupPath) || UID_RESPALDO

function fuenteDatos() {
    return args.backupPath ? `backup ${args.backupPath}` : "Firestore"
}

async function ejecutar() {
    console.log(`=== M8: nombres automáticos de subcuentas ===${args.dryRun ? " (DRY-RUN)" : ""}`)
    console.log(`UID: ${uid}`)

    const cuentas = await leerCuentas(uid, { backupPath: args.backupPath })
    const preferencias = await leerPreferencias(uid, { backupPath: args.backupPath })
    const formato = args.formato === "codigo"
        ? "codigo"
        : preferencias?.formatoDivisa === "codigo" ? "codigo" : "simbolo"

    const { cambios, cuentas_propuestas, conservados } = migrarNombresM8(cuentas, { formato })
    const resumen = resumenCambios(cambios)
    const propuesta = {
        migracion: "M8",
        fecha: new Date().toISOString(),
        uid,
        fuente: fuenteDatos(),
        formato,
        resumen: {
            ...resumen,
            nombres_personalizados_conservados: conservados.length
        },
        cambios,
        cuentas_propuestas,
        nombres_conservados: conservados,
        estado_general: cambios.length > 0 ? "pendiente_aplicacion" : "sin_cambios",
        instrucciones: [
            "Cada entrada de cuentas_propuestas pide borrar el campo `nombre` de una subcuenta automática.",
            "No se escribe `tieneNombrePropio`: el contrato lo deriva de si existe `nombre`.",
            "Aplicar después de revisar que ningún nombre personalizado aparece en cuentas_propuestas."
        ]
    }

    writeFileSync("./propuesta-m8.json", JSON.stringify(propuesta, null, 2))
    console.log(`\nCuentas leídas: ${cuentas.length}`)
    console.log(`Subcuentas con nombre automático guardado: ${cambios.length}`)
    console.log(`Nombres personalizados conservados: ${conservados.length}`)
    console.log(`Formato de nombre: ${formato}`)
    console.log(`\n> Propuesta guardada en: ./propuesta-m8.json`)
    if (cambios.length === 0) console.log("Sin cambios: no hay nombres automáticos guardados.")
    if (args.dryRun) console.log("\n⚠ Modo DRY-RUN: solo se generó la propuesta.")
}

ejecutar().catch(error => {
    console.error("❌", error.message)
    process.exit(1)
})
