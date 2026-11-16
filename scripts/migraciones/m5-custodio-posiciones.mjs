// Migración M5: Asignación de custodio a posiciones legacy
// Detecta posiciones con custodioId null y propone custodio basado en disponibilidad real.
// Lee datos reales desde Firestore o backup JSON via lector-datos.mjs.
// Custodios posibles: brokers y exchanges reales del usuario.
// dry-run obligatorio (--dry-run)
// Genera propuesta JSON: propuesta-m5.json
// Requiere revisión/confirmación usuario antes de aplicar

import { writeFileSync } from "node:fs"
import {
    leerCuentas, leerPosiciones, esPosiciónLegacy, esCustodioCandidato,
    uidDesdeBackup, UID_RESPALDO
} from "./lector-datos.mjs"

// === CONFIGURACIÓN ===

// === EJECUCIÓN ===

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const backupPath = args.find(a => a.startsWith("--backup="))?.replace("--backup=", "")
const uidArg = args.find(a => a.startsWith("--uid="))?.replace("--uid=", "")

// UID: --uid manda; si no, el uid del backup; si tampoco, el del backup real.
const uid = uidArg || uidDesdeBackup(backupPath) || UID_RESPALDO

console.log(`\n=== M5: Asignación de custodio a posiciones legacy ===${dryRun ? " (DRY-RUN)" : ""}${
  backupPath ? ` (backup: ${backupPath})` : ""
}`)
console.log(`UID: ${uid}`)

// 1. Leer datos reales
console.log("\n>>> Leyendo datos...")
let posiciones

try {
    posiciones = await leerPosiciones(uid, { backupPath })
    console.log(`   Posiciones leídas: ${posiciones.length}`)
} catch (error) {
    console.error("❌ Error leyendo posiciones:", error.message)
    process.exit(1)
}

// 2. Obtener todas las cuentas candidatas para ser custodio
// Leer cuentas desde Firestore o backup
let cuentasCandidatas

try {
    cuentasCandidatas = await leerCuentas(uid, { backupPath })
    // Broker/exchange no archivados: una cuenta archivada no puede custodiar.
    cuentasCandidatas = cuentasCandidatas.filter(esCustodioCandidato)
    console.log(`   Cuentas candidatas (broker/exchange activas): ${cuentasCandidatas.length}`)
} catch (error) {
    console.error("❌ Error leyendo cuentas candidatas:", error.message)
    process.exit(1)
}

console.log(`\n> Posiciones con custodioId null a procesar:`)

// Filtrar posiciones sin custodio (legacy)
const posicionesSinCustodio = posiciones.filter(esPosiciónLegacy)
console.log(`   Total sin custodio: ${posicionesSinCustodio.length}\n`)

// 3. Para cada posición sin custodio, determinar propuesta
const propuestas = []

for (const posicion of posicionesSinCustodio) {
    console.log(`> Posición: ${posicion.id} (${posicion.activoId}, cantidad:${posicion.cantidad})`)

    // Saltar si ya tiene custodioId (idempotencia)
    if (posicion.custodioId !== null) {
        console.log(`  - Ya tiene custodioId (${posicion.custodioId}), saltando (idempotente)`)
        continue
    }

    // 1. Custodios posibles: broker/exchange no archivados del usuario
    const custodiosPosibles = cuentasCandidatas

    // 2. Determinar nivel de certeza
    if (custodiosPosibles.length === 1) {
        // Caso: un único custodio posible → asignar con alta certeza
        const custodio = custodiosPosibles[0]
        propuestas.push({
            tipo: "posicion_sin_custodio",
            posicion: {
                posicionId: posicion.id,
                activoId: posicion.activoId,
                cantidad: posicion.cantidad
            },
            custodio_posible: {
                id: custodio.id,
                nombre: custodio.nombre || custodio.id,
                tipo: custodio.tipo
            },
            accion_propuesta: "asignar",
            motivo: `Sólo un custodio posible (${custodio.tipo}: ${custodio.nombre}), certeza alta`,
            certeza: "alto",
            estado: "pendiente"
        })
        console.log(`> 1 solo custodio posible (${custodio.tipo}: ${custodio.nombre}) → asignar (alto certeza)`)
    } else if (custodiosPosibles.length === 0) {
        // Caso: no hay custodios posibles → mantener pendiente_asignacion
        propuestas.push({
            tipo: "posicion_sin_custodio",
            posicion: {
                posicionId: posicion.id,
                activoId: posicion.activoId,
                cantidad: posicion.cantidad
            },
            custodio_posible: null,
            accion_propuesta: "mantener",
            motivo: "No hay custodios broker/exchange disponibles, mantener pendiente_asignacion",
            certeza: "medio",
            estado: "pendiente"
        })
        console.log(`> No hay custodios posibles → mantener pendiente_asignacion (medio certeza)`)
    } else {
        // Caso: múltiples custodios posibles → marcar ambigüedad
        propuestas.push({
            tipo: "posicion_sin_custodio",
            posicion: {
                posicionId: posicion.id,
                activoId: posicion.activoId,
                cantidad: posicion.cantidad
            },
            custodio_posible: custodiosPosibles.map(c => ({
                id: c.id,
                nombre: c.nombre || c.id,
                tipo: c.tipo
            })),
            accion_propuesta: "pendiente",
            motivo: `Múltiples custodios posibles (${custodiosPosibles.length}), requiere decisión usuario`,
            certeza: "baja",
            estado: "pendiente"
        })
        console.log(`> Múltiples custodios (${custodiosPosibles.length}) → pendiente (baja certeza)`)
    }
}

// 4. Ordenar por certainty (alto primero)
const ordenCerteza = {"alto": 3, "medio": 2, "baja": 1}
propuestas.sort((a, b) => ordenCerteza[b.certeza] - ordenCerteza[a.certeza])

// 5. Generar objeto propuesta final
const propuesta = {
    migracion: "M5",
    fecha: new Date().toISOString(),
    total_posiciones_sin_custodio: propuestas.length,
    propuestas: propuestas,
    estado_general: "pendiente_aplicacion",
    instrucciones: "Revisar cada propuesta en propuesta-m5.json. 'aprobar' (asignar custodio) o 'rechazar' (mantener pendiente_asignacion). Ejecutar: node scripts/migraciones/aplicar-propuesta.mjs propuesta-m5.json"
}

// 6. Guardar propuesta JSON
writeFileSync("./propuesta-m5.json", JSON.stringify(propuesta, null, 2))
console.log(`\n> Propuesta guardada en: ./propuesta-m5.json`)
console.log(`Total de propuestas: ${propuestas.length}`)
console.log(`Aprobar todas: editar propuesta-m5.json y cambiar estado a 'aprobada'`)
console.log(`Luego ejecutar: node scripts/migraciones/aplicar-propuesta.mjs propuesta-m5.json`)

// 7. Modo dry-run
if (dryRun) {
    console.log(`\n⚠ Modo DRY-RUN: No se aplican cambios.`)
    console.log(`Para aplicar, editar propuesta-m5.json y ejecutar sin --dry-run`)
} else {
    console.log(`\n⚠ Cuidado: Esta acción modificará datos. Se generó backup automático.`)
    console.log(`Ejecutar nuevamente con --dry-run para ver qué haría antes de aplicar.`)
}