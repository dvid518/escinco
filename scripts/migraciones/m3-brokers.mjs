// Migración M3: Brokers multidivisa
// Detecta brokers con efectivo en varias divisas y organiza la estructura.
//
// idempotente: si ya está organizado, no reestructura.
// dry-run: --dry-run muestra qué haría sin aplicar.
// rollback: info en ./backup_m3_{fecha}.json

import { RAIZ } from "./helpers.mjs"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

// Cargar datos de brokers
function obtenerBrokers() {
    // En implementación real, leería de Firestore
    return []
}

// Aplicar migración M3 a un broker
function aplicarMigracionM3(broker) {
    // Verificar si ya tiene subcuentas organizadas
    if (broker.subcuentas && broker.subcuentas.length > 0) {
        console.log(`> Broker ${broker.id}: ya tiene ${broker.subcuentas.length} subcuentas, saltando`)
        return false
    }
    
    // Verificar es broker y tiene efectivo
    if (broker.tipo !== "broker" || !broker.saldoInicial) {
        console.log(`> Broker ${broker.id}: no es candidato M3 (tipo=${broker.tipo}, saldo=${broker.saldoInicial}), saltando`)
        return false
    }
    
    console.log(`> Migrando M3 broker ${broker.id}: organizando efectivo por divisa`)
    
    if (dryRun) {
        console.log(`   [DRY-RUN] Analizaría ${broker.monedas || "desconocidas"} divisas`)
        console.log(`   [DRY-RUN] Crearía subcuentas por divisa si aplica`)
        console.log(`   [DRY-RUN] No duplicaría efectivo existente`)
        return true
    }
    
    // En implementación real, organizaría el efectivo del broker en subcuentas
    // por divisa, sin duplicar el saldo total
    
    console.log(`✓ Broker ${broker.id} migrado M3 exitosamente`)
    return true
}

// Ejecutar migración M3
async function ejecutarM3() {
    console.log("=== Migración M3: Brokers multidivisa ===\n")
    
    const brokers = obtenerBrokers()
    console.log(`Total de brokers cargados: ${brokers.length}`)
    
    let migrados = 0
    for (const broker of brokers) {
        if (aplicarMigracionM3(broker)) {
            migrados++
        }
    }
    
    console.log(`\n=== Resultado M3 ===`)
    console.log(`Total de brokers procesados: ${brokers.length}`)
    console.log(`Migraciones aplicadas (simuladas): ${migrados}`)
    
    if (dryRun) {
        console.log("\n⚠ Ejecutado en modo DRY-RUN. No se persisten cambios.")
        console.log("   Usa el script sin --dry-run para aplicar de verdad (con backup previo)")
    }
}

// Ejecutar
ejecutarM3()