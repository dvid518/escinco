// CSP permite las APIs externas (hallazgo #6).
//
// Verifica que connect-src de firebase.json incluye los orígenes que la app
// necesita para tasas de cambio y precios automáticos en produccion.
import { nuevoReporter, leer } from "./helpers.mjs"

const firebaseJson = leer("firebase.json")
const csp = firebaseJson.match(/"Content-Security-Policy".*?"value":\s*"([^"]+)"/)?.[1] || ""

export default async function ejecutar(t = nuevoReporter("csp")) {
    const origenes = ["open.er-api.com", "api.binance.com", "api.allorigins.win"]
    for (const origen of origenes) {
        t.check(`connect-src permite ${origen}`,
            new RegExp(`connect-src[^;]*${origen.replace(".", "\\.")}`).test(csp))
    }
    // self y los orígenes de Firebase siguen presentes (no se removieron).
    t.check("connect-src conserva self", /connect-src 'self'/.test(csp))
    t.check("connect-src conserva googleapis", /connect-src[^;]*\*.googleapis.com/.test(csp))

    return t
}
