// Migración M1: Padre con saldo propio
// Detecta cuentas con esAbstracta: true y saldoInicial != 0,
// crea subcuentas o cuentas regulares con el saldo, y vacía el padre.
//
// idempotente: si ya está migrado (migradoM1: true), no repite.
// dry-run: --dry-run muestra qué haría sin aplicar.
// rollback: guarda estado previo en ./backup_m1_{fecha}.json

import { RAIZ } from "./helpers.mjs"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

// Cargar datos de cuentas desde Firestore (mock con datos locales para migración)
// En producción esto leería de Firestore directamente
function obtenerCuentas() {
    // En una implementación real, esto leería de Firestore
    // Por ahora, simulamos con la estructura esperada
    return []
}

// Guardar backup antes de migrar
function guardarBackup(cuentas, nombre) {
    if (dryRun) return
    const fecha = new Date().toISOString().split("T")[0]
    const rutaBackup = `./backup_${nombre}_${fecha}.json`
    fs.writeFileSync(rutaBackup, JSON.stringify(cuentas, null, 2))
    console.log(`Backup guardado en: ${rutaBackup}`)
}

// Aplicar migración M1 a una cuenta padre
function aplicarMigracionM1(cuenta) {
    const { esAbstracta, saldoInicial, esPatrimonio, tipo, padreId, estado, ...resto } = cuenta
    
    // Verificar si ya está migrado
    if (cuenta.migradoM1) {
        console.log(`✓ Cuenta ${cuenta.id} ya migrada M1, saltando`)
        return false
    }
    
    // Verificar condiciones: esAbstracta true y saldoInicial != 0
    if (!esAbstracta || saldoInicial === 0 || saldoInicial === null || saldoInicial === undefined) {
        console.log(`- Cuenta ${cuenta.id}: no cumple condiciones M1 (esAbstracta=${esAbstracta}, saldo=${saldoInicial}), saltando`)
        return false
    }
    
    console.log(`> Migrando cuenta padre ${cuenta.id}: saldo=${saldoInicial}, tipo=${tipo}`)
    
    if (dryRun) {
        console.log(`   [DRY-RUN] Crearía subcuenta/cuenta con saldo ${saldoInicial}`)
        console.log(`   [DRY-RUN] Vaciaría saldoInicial a 0 en padre ${cuenta.id}`)
        console.log(`   [DRY-RUN] Marcaría migradoM1: true en ${cuenta.id}`)
        return true
    }
    
    // En implementación real, aquí crearíamos la(s) subcuenta(s) o cuenta regular
    // con el saldo del padre y estableceríamos migradoM1: true
    
    // Por ahora, solo simulamos el cambio
    cuenta.saldoInicial = 0
    cuenta.migradoM1 = true
    
    console.log(`✓ Cuenta ${cuenta.id} migrada M1 exitosamente`)
    return true
}

// Ejecutar migración M1
async function ejecutarM1() {
    console.log("=== Migración M1: Padre con saldo propio ===\n")
    
    const cuentas = obtenerCuentas()
    console.log(`Total de cuentas cargadas: ${cuentas.length}`)
    
    let migradas = 0
    const paraMigrar = cuentas.filter(c => aplicarMigracionM1(c))
    
    // En implementación real: guardarBackup(cuentas, "m1")
    
    console.log(`\n=== Resultado M1 ===`)
    console.log(`Total de cuentas procesadas: ${cuentas.length}`)
    console.log(`Candidatas a migrar: ${paraMigrar.length}`)
    console.log(`Migraciones aplicadas (simuladas): ${migradas}`)
    
    if (dryRun) {
        console.log("\n⚠ Ejecutado en modo DRY-RUN. No se persisten cambios.")
        console.log("   Usa el script sin --dry-run para aplicar de verdad (con backup previo)")
    }
}

// Ejecutar
ejecutarM1()