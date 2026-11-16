// Tests de los scripts de migración F7.5 (M4 y M5).
//
// Cubre las dos piezas que fallaban con datos reales: la lectura del backup
// .dvid (uid y posiciones con activoSimbolo) y el filtro de candidatas de M4.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import vm from "node:vm"
import { nuevoReporter, leer, extraerFuncion } from "./helpers.mjs"
import {
    UID_RESPALDO,
    esCustodioCandidato,
    esPestañaCripto,
    leerPosiciones,
    resolverRutaBackup,
    uidDesdeBackup
} from "../scripts/migraciones/lector-datos.mjs"

const M4_SRC = leer("scripts/migraciones/m4-pestanas-cripto.mjs")

function backupTemporal(datos) {
    const dir = mkdtempSync(join(tmpdir(), "escinco-migraciones-"))
    const ruta = join(dir, "backup.dvid")
    writeFileSync(ruta, JSON.stringify(datos), "utf-8")
    return { ruta, limpiar: () => rmSync(dir, { recursive: true, force: true }) }
}

export default async function ejecutar(t = nuevoReporter("migraciones")) {
    // Backup con la forma real del .dvid exportado por ExportarServicio.
    const backup = backupTemporal({
        formato: "escinco",
        uid: "4ulBrBffJMMM2EojNojawRPjad13",
        cuentas: [{ id: "cExchange", tipo: "exchange", moneda: "USDT", esPatrimonio: false }],
        posiciones: [
            { id: "pLegacy", activoSimbolo: "BTC", cantidad: "0.5", divisa: "usd", custodioId: null },
            { id: "pAsignada", activoSimbolo: "ETH", cantidad: 2, divisa: "usd", custodioId: "cExchange" },
            // Posición legacy sin custodioId: Firestore lo omite cuando es null.
            { id: "pSinCampo", activoSimbolo: "SOL", cantidad: 3, divisa: "usd" }
        ]
    })

    try {
        t.check(
            "L1 el uid se lee del backup",
            uidDesdeBackup(backup.ruta) === "4ulBrBffJMMM2EojNojawRPjad13",
            String(uidDesdeBackup(backup.ruta))
        )
        t.check(
            "L1 sin backup se usa el UID real de respaldo",
            UID_RESPALDO === "4ulBrBffJMMM2EojNojawRPjad13" &&
            uidDesdeBackup() === null,
            UID_RESPALDO
        )

        const posiciones = await leerPosiciones(null, { backupPath: backup.ruta })
        const legacy = posiciones.find(p => p.id === "pLegacy")
        const asignada = posiciones.find(p => p.id === "pAsignada")
        const sinCampo = posiciones.find(p => p.id === "pSinCampo")

        t.check(
            "L2 el .dvid usa activoSimbolo y se normaliza a activoId",
            legacy?.activoId === "BTC" && asignada?.activoId === "ETH",
            JSON.stringify({ legacy, asignada })
        )
        t.check(
            "L2 la cantidad se normaliza a número",
            legacy?.cantidad === 0.5 && asignada?.cantidad === 2,
            JSON.stringify([legacy?.cantidad, asignada?.cantidad])
        )
        t.check(
            "L2 custodioId ausente queda null (legacy)",
            legacy?.custodioId === null && sinCampo?.custodioId === null,
            JSON.stringify({ legacy: legacy?.custodioId, sinCampo: sinCampo?.custodioId })
        )

        const anteriorRuta = resolverRutaBackup("escinco_backup_2026-11-15.dvid")
        t.check(
            "L3 una ruta relativa cuelga de la raíz del repo",
            anteriorRuta.endsWith("escinco\\escinco_backup_2026-11-15.dvid") ||
            anteriorRuta.endsWith("escinco/escinco_backup_2026-11-15.dvid"),
            anteriorRuta
        )
    } finally {
        backup.limpiar()
    }

    // M4: candidata = mismo activo y (mismo custodio o legacy), nunca sí misma.
    const ctx = {
        esPosiciónLegacy: posicion => posicion.custodioId === null
    }
    vm.createContext(ctx)
    vm.runInContext(extraerFuncion(M4_SRC, "esPosicionCandidataM4") + ";", ctx)

    const pestaña = { id: "cExchange", moneda: "usdt", tipo: "exchange", esPatrimonio: false }
    t.check(
        "M4 misma pestaña, mismo activo legacy es candidata",
        ctx.esPosicionCandidataM4({ id: "p1", activoId: "USDT", custodioId: null }, pestaña) === true
    )
    t.check(
        "M4 misma pestaña, mismo activo y mismo custodio es candidata",
        ctx.esPosicionCandidataM4({ id: "p2", activoId: "usdt", custodioId: "cExchange" }, pestaña) === true
    )
    t.check(
        "M4 otro custodio (no legacy) NO es candidata",
        ctx.esPosicionCandidataM4({ id: "p3", activoId: "USDT", custodioId: "cBroker" }, pestaña) === false
    )
    t.check(
        "M4 legacy de otro activo NO es candidata",
        ctx.esPosicionCandidataM4({ id: "p4", activoId: "BTC", custodioId: null }, pestaña) === false
    )
    t.check(
        "M4 la pestaña no es candidata de sí misma",
        ctx.esPosicionCandidataM4({ id: "cExchange", activoId: "USDT", custodioId: null }, pestaña) === false
    )
    t.check(
        "M4 la pestaña legacy se detecta por tipo y esPatrimonio",
        esPestañaCripto(pestaña) === true &&
        esPestañaCripto({ ...pestaña, esPatrimonio: true }) === false &&
        esPestañaCripto({ ...pestaña, tipo: "broker" }) === false
    )

    // M5 no puede proponer una cuenta archivada como custodio.
    t.check(
        "M5 broker/exchange activo es candidato a custodio",
        esCustodioCandidato({ id: "c1", tipo: "broker", estado: "activa" }) === true &&
        esCustodioCandidato({ id: "c2", tipo: "exchange", estado: "activa" }) === true
    )
    t.check(
        "M5 cuenta archivada NO es candidata a custodio",
        esCustodioCandidato({ id: "c3", tipo: "exchange", estado: "archivada" }) === false &&
        esCustodioCandidato({ id: "c4", tipo: "broker", estado: "archivada" }) === false
    )
    t.check(
        "M5 un banco NO es candidato a custodio",
        esCustodioCandidato({ id: "c5", tipo: "banco", estado: "activa" }) === false
    )

    return t
}
