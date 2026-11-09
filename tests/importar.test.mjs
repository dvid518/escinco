// Importación preserva relaciones (hallazgo #2).
//
// js/services/ImportarServicio.js inicializa Firebase al cargarse, así que no
// se puede importar en Node. Se extraen las funciones puras por texto y se
// evalúan con stubs, siguiendo el patrón de tests/reglas.test.mjs.
//
// Qué se verifica:
//  - reescribirRefCuenta reemplaza id de cuenta viejo -> nuevo según el mapa.
//  - importarMovimientos/importarCuentas/importarActivos construyen y usan los
//    mapas oldId -> newId (código fuente).
import { extraerFuncion, nuevoReporter, leer } from "./helpers.mjs"

const src = leer("js/services/ImportarServicio.js")

const reescribirRefCuentaSrc = extraerFuncion(src, "reescribirRefCuenta")
const reescribirRefCuenta = new Function(`${reescribirRefCuentaSrc}\nreturn reescribirRefCuenta`)()

export default async function ejecutar(t = nuevoReporter("importar")) {
    const mapa = new Map([
        ["vieja-cuenta-1", "nueva-cuenta-1"],
        ["vieja-cuenta-2", "nueva-cuenta-2"]
    ])

    // 1. cuenta, cuentaOrigen, cuentaDestino, tarjeta se reescriben cuando el
    //    id viejo está en el mapa.
    {
        const d = {
            cuenta: "vieja-cuenta-1",
            cuentaOrigen: "vieja-cuenta-2",
            cuentaDestino: "no-existe",
            tarjeta: "vieja-cuenta-1"
        }
        reescribirRefCuenta(d, "cuenta", mapa)
        reescribirRefCuenta(d, "cuentaOrigen", mapa)
        reescribirRefCuenta(d, "cuentaDestino", mapa)
        reescribirRefCuenta(d, "tarjeta", mapa)
        t.check("cuenta reescrita a id nuevo", d.cuenta === "nueva-cuenta-1")
        t.check("cuentaOrigen reescrita a id nuevo", d.cuentaOrigen === "nueva-cuenta-2")
        t.check("cuentaDestino sin mapa se deja intacta", d.cuentaDestino === "no-existe")
        t.check("tarjeta reescrita a id nuevo", d.tarjeta === "nueva-cuenta-1")
    }

    // 2. id ausente del mapa no se toca (no lanza).
    {
        const d = { cuenta: "desconocida" }
        reescribirRefCuenta(d, "cuenta", mapa)
        t.check("id sin mapeo se conserva intacto", d.cuenta === "desconocida")
    }

    // 3. Los importadores construyen y usan los mapas oldId -> newId.
    t.check("importarActivos llena activoIdMap", /activoIdMap\.set\(activo\.id, nuevoId\)/.test(src))
    t.check("importarActivos reusa id de activo existente", /activoIdMap\.set\(activo\.id, existente\.id\)/.test(src))
    t.check("importarCuentas llena cuentaIdMap", /cuentaIdMap\.set\(cuenta\.id, nuevoId\)/.test(src))
    t.check("importarCuentas reescribe padreId", /cuentaIdMap\.get\(padreId\)/.test(src))
    t.check("importarMovimientos reescribe cuenta/cuentaOrigen/cuentaDestino/tarjeta",
        /reescribirRefCuenta\(datos, "cuenta"/.test(src)
        && /reescribirRefCuenta\(datos, "cuentaOrigen"/.test(src)
        && /reescribirRefCuenta\(datos, "cuentaDestino"/.test(src)
        && /reescribirRefCuenta\(datos, "tarjeta"/.test(src))

    return t
}
