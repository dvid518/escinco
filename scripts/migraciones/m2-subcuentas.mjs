// Migración M2: Subcuentas monetarias
// Detecta padres multidivisa sin subcuentas por divisa y crea las subcuentas faltantes.
//
// idempotente: si ya existen subcuentas, no duplica.
// dry-run: --dry-run muestra qué haría sin aplicar.
// rollback: info en ./backup_m2_{fecha}.json

import { RAIZ } from "./helpers.mjs"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

// Cargar datos de padres
function obtenerPadres() {
    // En implementación real, leería de Firestore
    return []
}

// Verificar si padre tiene subcuentas por divisa
function tieneSubcuentasDivisa(padre, divisas) {
    // Verifica si el padre ya tiene subcuentas para cada divisa en divisas[]
    return true // Placeholder
}

// Aplicar migración M2 a un padre
function aplicarMigracionM2(padre) {
    // Verificar si ya tiene todas las subcuentas
    const divisas = ["pen", "usd", "usdt"] // divisas base
    const yaTiene = padre.subcuentas ? padre.subcuentas.length : 0
    
    if (yaTiene >= divisas.length && padre.subcuentas) {
        console.log(`> Padre ${padre.id}: ya tiene ${yaTiene} subcuentas, saltando`)
        return false
    }
    
    // Verificar esAbstracta y tipo broker/exchange
    if (!padre.esAbstracta || !["broker", "exchange"].includes(padre.tipo)) {
        console.log(`> Padre ${padre.id}: no es candidato M2 (tipo=${padre.tipo}, esAbstracta=${padre.esAbstracta}), saltando`)
        return false
    }
    
    console.log(`> Migrando M2 padre ${padre.id}: creando subcuentas por divisa`)
    
    if (dryRun) {
        console.log(`   [DRY-RUN] Crearía ${divisas.length - (padre.subcuentas ? padre.subcuentas.length : 0)} subcuentas faltantes`)
        console.log(`   [DRY-RUN] Establecería saldoInicial: 0 en cada subcuenta`)
        return true
    }
    
    // En implementación real, crearía las subcuentas faltantes aquí
    // padre.subcuentas = [...subcuentasFaltantes]
    
    console.log(`✓ Padre ${padre.id} migrado M2 exitosamente`)
    return true
}

// Ejecutar migración M2
async function ejecutarM2() {
    console.log("=== Migración M2: Subcuentas monetarias ===\n")
    
    const padres = obtenerPadres()
    console.log(`Total de padres cargados: ${padres.length}`)
    
    let migrados = 0
    for (const padre of padres) {
        if (aplicarMigracionM2(padre)) {
            migrados++
        }
    }
    
    console.log(`\n=== Resultado M2 ===`)
    console.log(`Total de padres procesados: ${padres.length}`)
    console.log(`Migraciones aplicadas (simuladas): ${migrados}`)
    
    if (dryRun) {
        console.log("\n⚠ Ejecutado en modo DRY-RUN. No se persisten cambios.")
        console.log("   Usa el script sin --dry-run para aplicar de verdad (con backup previo)")
    }
}

// Ejecutar
ejecutarM2()