// Mutaciones de dinero atómicas (hallazgo #1).
//
// js/services/MovimientoServicio.js inicializa Firebase al cargarse, así que no
// se puede importar en Node. Se verifica estáticamente el código fuente:
//  - registrarMovimiento / actualizarMovimiento / eliminarMovimiento usan
//    writeBatch (atómico) en lugar de runTransaction (que no existe en este
//    SDK) ni escrituras sueltas no atómicas.
import { nuevoReporter, leer } from "./helpers.mjs"

const src = leer("js/services/MovimientoServicio.js")

export default async function ejecutar(t = nuevoReporter("movimiento")) {
    // 1. No se usa runTransaction (no existe en el SDK de Firebase instalado).
    t.check("no usa runTransaction", !/runTransaction/.test(src))

    // 2. Los tres puntos de escritura usan writeBatch.
    t.check("registrarMovimiento usa writeBatch",
        /registrarMovimiento[\s\S]{0,2000}writeBatch\(db\)/.test(src))
    t.check("actualizarMovimiento usa writeBatch",
        /actualizarMovimiento[\s\S]{0,2000}writeBatch\(db\)/.test(src))
    t.check("eliminarMovimiento usa writeBatch",
        /eliminarMovimiento[\s\S]{0,2000}writeBatch\(db\)/.test(src))

    // 3. El documento del movimiento va en el mismo batch que los saldos.
    t.check("registrarMovimiento usa batch.set para el movimiento",
        /registrarMovimiento[\s\S]{0,2000}batch\.set\(refMovimiento/.test(src))
    t.check("actualizarMovimiento usa batch.update para el movimiento",
        /actualizarMovimiento[\s\S]{0,5000}batchU\.update\s*\(\s*doc\(db, "usuarios", uid, "movimientos", movimientoId\)/.test(src))
    t.check("eliminarMovimiento usa batch.delete para el movimiento",
        /eliminarMovimiento[\s\S]{0,2000}batch\.delete\(doc\(db, "usuarios", uid, "movimientos", m.id\)/.test(src))

    return t
}
