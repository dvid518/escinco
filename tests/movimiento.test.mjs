// Mutaciones de dinero atómicas (hallazgo #1).
//
// js/services/MovimientoServicio.js inicializa Firebase al cargarse, así que no
// se puede importar en Node. Se extraen las funciones de transacción por texto
// y se evalúan con un `tx` simulado, siguiendo el patrón de
// tests/reglas.test.mjs.
//
// Qué se verifica:
//  - txRevertirSaldos deshace exactamente lo que txActualizarSaldos hizo
//    (reversión lógica de una transacción: si falla, nada queda aplicado).
//  - Un fallo al leer una cuenta dentro de la transacción lanza y no aplica
//    ningún saldo.
import { extraerFuncion, nuevoReporter, leer } from "./helpers.mjs"
import { TIPOS_MOVIMIENTO } from "../constants/tiposMovimiento.js"

const src = leer("js/services/MovimientoServicio.js")

const txActualizarSaldosSrc = extraerFuncion(src, "txActualizarSaldos")
const txRevertirSaldosSrc = extraerFuncion(src, "txRevertirSaldos")
const txLeerCuentaSrc = extraerFuncion(src, "txLeerCuenta")
const txEscribirCuentaSrc = extraerFuncion(src, "txEscribirCuenta")
const montosDeTransferenciaTxSrc = extraerFuncion(src, "montosDeTransferenciaTx")

function docStub() {
    return { path: "usuarios/uid/cuentas/cuenta1" }
}

// `tx` simulado: `get` lee de un mapa, `update` aplica. `fallarEn` hace que el
// n-ésimo `update` lance (simula una transacción que se aborta a mitad).
function hacerTx(cuentasIniciales = {}) {
    const cuentas = new Map(Object.entries(cuentasIniciales))
    let fallarEn = null
    let nUpdate = 0
    const tx = {
        async get(ref) {
            const id = String(ref.path).split("/").pop()
            const datos = cuentas.get(id)
            return { exists: () => datos !== undefined, data: () => datos || {} }
        },
        update(ref, datos) {
            nUpdate++
            if (fallarEn !== null && nUpdate === fallarEn) {
                throw new Error("falla simulada en transacción")
            }
            const id = String(ref.path).split("/").pop()
            const actual = cuentas.get(id) || {}
            cuentas.set(id, { ...actual, ...datos })
        }
    }
    return { tx, cuentas, fallarEn: v => { fallarEn = v } }
}

const txLeerCuenta = new Function(
    "doc", "db",
    `${txLeerCuentaSrc}\nreturn txLeerCuenta`
)(docStub, {})

const txEscribirCuenta = new Function(
    "doc", "db",
    `${txEscribirCuentaSrc}\nreturn txEscribirCuenta`
)(docStub, {})

const montosDeTransferenciaTx = new Function(
    `${montosDeTransferenciaTxSrc}\nreturn montosDeTransferenciaTx`
)()

const txActualizarSaldos = new Function(
    "doc", "db", "TIPOS_MOVIMIENTO", "console", "txLeerCuenta", "txEscribirCuenta", "montosDeTransferenciaTx",
    `${txActualizarSaldosSrc}\nreturn txActualizarSaldos`
)(docStub, {}, TIPOS_MOVIMIENTO, console, txLeerCuenta, txEscribirCuenta, montosDeTransferenciaTx)

const txRevertirSaldos = new Function(
    "doc", "db", "TIPOS_MOVIMIENTO", "console", "txLeerCuenta", "txEscribirCuenta", "montosDeTransferenciaTx",
    `${txRevertirSaldosSrc}\nreturn txRevertirSaldos`
)(docStub, {}, TIPOS_MOVIMIENTO, console, txLeerCuenta, txEscribirCuenta, montosDeTransferenciaTx)

export default async function ejecutar(t = nuevoReporter("movimiento")) {
    // 1. Ingreso: sumar y revertir vuelve al saldo inicial.
    {
        const { tx, cuentas } = hacerTx({ cuenta1: { saldoInicial: 100 } })
        await txActualizarSaldos(tx, "u1", TIPOS_MOVIMIENTO.INGRESO, { cuenta: "cuenta1", monto: 50 })
        await txRevertirSaldos(tx, "u1", TIPOS_MOVIMIENTO.INGRESO, { cuenta: "cuenta1", monto: 50 })
        t.check("ingreso reversible: saldo vuelve a 100", cuentas.get("cuenta1").saldoInicial === 100, String(cuentas.get("cuenta1").saldoInicial))
    }

    // 2. Gasto (cuenta normal): restar y revertir vuelve al saldo inicial.
    {
        const { tx, cuentas } = hacerTx({ cuenta1: { saldoInicial: 100 } })
        await txActualizarSaldos(tx, "u1", TIPOS_MOVIMIENTO.GASTO, { cuenta: "cuenta1", monto: 30 })
        await txRevertirSaldos(tx, "u1", TIPOS_MOVIMIENTO.GASTO, { cuenta: "cuenta1", monto: 30 })
        t.check("gasto reversible: saldo vuelve a 100", cuentas.get("cuenta1").saldoInicial === 100, String(cuentas.get("cuenta1").saldoInicial))
    }

    // 3. Transferencia: origen resta, destino suma, y revertir restaura ambos.
    {
        const { tx, cuentas } = hacerTx({
            origen: { saldoInicial: 100 },
            destino: { saldoInicial: 50 }
        })
        await txActualizarSaldos(tx, "u1", TIPOS_MOVIMIENTO.TRANSFERENCIA, {
            cuentaOrigen: "origen", cuentaDestino: "destino", monto: 30
        })
        await txRevertirSaldos(tx, "u1", TIPOS_MOVIMIENTO.TRANSFERENCIA, {
            cuentaOrigen: "origen", cuentaDestino: "destino", monto: 30
        })
        t.check("transferencia reversible: origen 100", cuentas.get("origen").saldoInicial === 100, String(cuentas.get("origen").saldoInicial))
        t.check("transferencia reversible: destino 50", cuentas.get("destino").saldoInicial === 50, String(cuentas.get("destino").saldoInicial))
    }

    // 4. Fallo al leer dentro de la transacción: lanza y no aplica ningún saldo.
    {
        const { tx, cuentas } = hacerTx({ cuenta1: { saldoInicial: 100 } })
        // `get` lanza: la transacción no puede leer ni escribir nada.
        tx.get = () => { throw new Error("no se puede leer la cuenta") }
        let lanzo = false
        try {
            await txActualizarSaldos(tx, "u1", TIPOS_MOVIMIENTO.INGRESO, { cuenta: "cuenta1", monto: 50 })
        } catch {
            lanzo = true
        }
        t.check("fallo de lectura: txActualizarSaldos lanza", lanzo)
        t.check("fallo de lectura: nada se aplicó (saldo sigue 100)", cuentas.get("cuenta1").saldoInicial === 100, String(cuentas.get("cuenta1").saldoInicial))
    }

    // 5. Los tres puntos de escritura (registrar/actualizar/eliminar) usan
    //    runTransaction (código fuente).
    t.check("registrarMovimiento usa runTransaction", /runTransaction\s*\(db,\s*async\s*tx/.test(src))
    t.check("actualizarMovimiento usa runTransaction", /runTransaction\s*\(db,\s*async\s*tx/.test(src))
    t.check("eliminarMovimiento usa runTransaction", /eliminarMovimiento[\s\S]{0,400}runTransaction/.test(src))

    return t
}
