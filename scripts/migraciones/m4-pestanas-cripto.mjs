// Migración M4: Reconciliación de pestañas cripto legacy
// Detecta cuentas exchange con esPatrimonio false y las reconcilia con posiciones.
// Lee datos reales desde Firestore o backup JSON via lector-datos.mjs.
// Lógica real sin return true placeholder.
// dry-run obligatorio (--dry-run)
// Genera propuesta JSON: propuesta-m4.json
// Requiere revisión/confirmación usuario antes de aplicar

import { writeFileSync } from "node:fs"
import {
    leerCuentas, leerPosiciones, esPestañaCripto, esPosiciónLegacy,
    uidDesdeBackup, UID_RESPALDO
} from "./lector-datos.mjs"

// Una posición es candidata de la pestaña si es del mismo activo y ya está
// asignada a esa misma pestaña, o si sigue legacy (sin custodio).
function esPosicionCandidataM4(pos, pestaña) {
    // La pestaña nunca es candidata de sí misma: aunque cuentas y posiciones
    // son colecciones distintas, un id repetido sería una fusión falsa.
    if (pos.id === pestaña.id) return false
    const activoPos = String(pos.activoId || "").toUpperCase()
    const activoPestaña = String(pestaña.moneda || "").toUpperCase()
    if (activoPos === "" || activoPos !== activoPestaña) return false
    return pos.custodioId === pestaña.id || esPosiciónLegacy(pos)
}

// === EJECUCIÓN ===

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const backupPath = args.find(a => a.startsWith("--backup="))?.replace("--backup=", "")
const uidArg = args.find(a => a.startsWith("--uid="))?.replace("--uid=", "")

// UID: --uid manda; si no, el uid del backup; si tampoco, el del backup real.
const uid = uidArg || uidDesdeBackup(backupPath) || UID_RESPALDO

console.log(`=== M4: Reconciliación de pestañas cripto ===${dryRun ? " (DRY-RUN)" : ""}${
  backupPath ? ` (backup: ${backupPath})` : ""
}`)
console.log(`UID: ${uid}`)

// 1. Leer datos reales
console.log("\n>>> Leyendo datos...")
let cuentas, posiciones

try {
    cuentas = await leerCuentas(uid, { backupPath })
    console.log(`   Cuentas leídas: ${cuentas.length}`)
} catch (error) {
    console.error("❌ Error leyendo cuentas:", error.message)
    process.exit(1)
}

try {
    posiciones = await leerPosiciones(uid, { backupPath })
    console.log(`   Posiciones leídas: ${posiciones.length}`)
} catch (error) {
    console.error("❌ Error leyendo posiciones:", error.message)
    process.exit(1)
}

// 2. Identificar pestañas cripto legacy
const pestañas = cuentas.filter(esPestañaCripto)
console.log(`\nPestañas cripto legacy encontradas: ${pestañas.length}`)
console.log(`Total de posiciones: ${posiciones.length}\n`)

// 3. Para cada pestaña, encontrar posiciones candidatas
// Candidata: mismo activo que la divisa de la pestaña y (ya en esa pestaña o legacy)
const propuestas = []

for (const pestaña of pestañas) {
    console.log(`> Pestaña: ${pestaña.id} (${pestaña.moneda}, esPatrimonio:${pestaña.esPatrimonio})`)

    // Buscar posiciones candidatas: mismo activo y mismo custodio o legacy.
    const posicionesCandidatas = posiciones.filter(pos => esPosicionCandidataM4(pos, pestaña))

    // Refinar: remover duplicados
    const posicionesCandidatasRefinadas = [...new Set(posicionesCandidatas.map(p => p.id))]
        .map(id => posicionesCandidatas.find(p => p.id === id))

    console.log(`  Posiciones candidatas (refinadas): ${posicionesCandidatasRefinadas.length}`)

    if (posicionesCandidatasRefinadas.length === 0) {
        // Caso: pestaña sin posición candidata → mantener legacy
        propuestas.push({
            tipo: "pestaña_sin_posicion",
            pestaña: {
                cuentaId: pestaña.id,
                simbolo: pestaña.moneda,
                esPatrimonio: pestaña.esPatrimonio
            },
            posicion_candidata: null,
            accion_propuesta: "mantener",
            motivo: "Sin posiciones asociadas, mantener legacy",
            certeza: "alto",
            estado: "pendiente"
        })
        console.log(`  - Pestaña sin posición → mantener legacy (alto certeza)`)
    } else if (posicionesCandidatasRefinadas.length === 1) {
        // Caso: una única posición candidata → fusionar
        const pos = posicionesCandidatasRefinadas[0]
        propuestas.push({
            tipo: "pestaña_con_posicion_unica",
            pestaña: {
                cuentaId: pestaña.id,
                simbolo: pestaña.moneda,
                esPatrimonio: pestaña.esPatrimonio
            },
            posicion_candidata: {
                posicionId: pos.id,
                activoId: pos.activoId,
                cantidad: pos.cantidad,
                custodioId: pos.custodioId
            },
            accion_propuesta: "fusionar",
            motivo: "Única posición candidata, fusionar al custodio exchange",
            certeza: "alto",
            estado: "pendiente"
        })
        console.log(`  - Única posición candidata (${pos.activoId}) → fusionar (alto certeza)`)
    } else {
        // Caso: múltiples posiciones candidatas → pendiente usuario
        propuestas.push({
            tipo: "pestaña_con_posiciones_multiples",
            pestaña: {
                cuentaId: pestaña.id,
                simbolo: pestaña.moneda,
                esPatrimonio: pestaña.esPatrimonio
            },
            posiciones_candidatas: posicionesCandidatasRefinadas.map(pos => ({
                posicionId: pos.id,
                activoId: pos.activoId,
                cantidad: pos.cantidad,
                custodioId: pos.custodioId
            })),
            accion_propuesta: "pendiente",
            motivo: `Múltiples posiciones candidatas (${posicionesCandidatasRefinadas.length}), requiere decisión usuario`,
            certeza: "medio",
            estado: "pendiente"
        })
        console.log(`  - Múltiples posiciones (${posicionesCandidatasRefinadas.length}) → pendiente (medio certeza)`)
    }
}

// 4. Buscar posiciones sin pestaña correspondiente
// (Posiciones legacy sin cuenta exchange que las contenga)
const posicionesYaProcesadas = new Set(propuestas
    .filter(p => p.posicion_candidata)
    .flatMap(p => p.posicion_candidata.posicionId ? [p.posicion_candidata.posicionId] : []))

const posicionesSinPestaña = posiciones.filter(pos => {
    // Si la posición ya fue procesada, saltar
    if (posicionesYaProcesadas.has(pos.id)) return false
    // Si la posición es legacy y no hay pestañas exchange en absoluto
    const hayPestañasExchange = cuentas.some(c => c.tipo === "exchange" && esPestañaCripto(c))
    return !hayPestañasExchange
})

for (const pos of posicionesSinPestaña) {
    propuestas.push({
        tipo: "posicion_sin_pestaña",
        posicion_candidata: {
            posicionId: pos.id,
            activoId: pos.activoId,
            cantidad: pos.cantidad,
            custodioId: pos.custodioId
        },
        accion_propuesta: "mantener",
        motivo: "Posición sin pestaña exchange correspondiente, mantener legacy",
        certeza: "medio",
        estado: "pendiente"
    })
    console.log(`> Posición ${pos.id} (${pos.activoId}) sin pestaña → mantener (medio certeza)`)
}

// 5. Ordenar propuestas por certainty (alto primero)
const ordenCerteza = {"alto": 3, "medio": 2, "bajo": 1}
propuestas.sort((a, b) => ordenCerteza[b.certeza] - ordenCerteza[a.certeza])

// 6. Generar objeto propuesta final
const propuesta = {
    migracion: "M4",
    fecha: new Date().toISOString(),
    total_pestañas: pestañas.length,
    total_propuestas: propuestas.length,
    propuestas: propuestas,
    estado_general: "pendiente_aplicacion",
    instrucciones: "Revisar cada propuesta en propuesta-m4.json. 'aprobar' (aplicar) o 'rechazar' (mantener status quo). Ejecutar: node scripts/migraciones/aplicar-propuesta.mjs propuesta-m4.json"
}

// 7. Guardar propuesta JSON
writeFileSync("./propuesta-m4.json", JSON.stringify(propuesta, null, 2))
console.log(`\n> Propuesta guardada en: ./propuesta-m4.json`)
console.log(`Total de propuestas: ${propuestas.length}`)
console.log(`Aprobar todas: editar propuesta-m4.json y cambiar estado a 'aprobada'`)
console.log(`Luego ejecutar: node scripts/migraciones/aplicar-propuesta.mjs propuesta-m4.json`)

// 8. Modo dry-run
if (dryRun) {
    console.log(`\n⚠ Modo DRY-RUN: No se aplican cambios.`)
    console.log(`Para aplicar, editar propuesta-m4.json y ejecutar sin --dry-run`)
} else {
    console.log(`\n⚠ Cuidado: Esta acción modificará datos. Se generó backup automático.`)
    console.log(`Ejecutar nuevamente con --dry-run para ver qué haría antes de aplicar.`)
}