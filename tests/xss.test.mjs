// Eliminar XSS en el dashboard (hallazgo #3).
//
// Verifica estáticamente que los nombres de cuentas/activos (datos de usuario)
// se insertan por textContent (no innerHTML con interpolacion) y que el CSP
// de produccion ya no permite 'unsafe-inline' en script-src.
import { nuevoReporter, leer } from "./helpers.mjs"

const dashboard = leer("js/pages/dashboard.js")
const firebaseJson = leer("firebase.json")
const csp = firebaseJson.match(/"Content-Security-Policy".*?"value":\s*"([^"]+)"/)?.[1] || ""

export default async function ejecutar(t = nuevoReporter("xss")) {
    // 1. No se arma un HTML string con las entidades (se borro `entidadesHTML`).
    t.check("no se construye entidadesHTML con innerHTML", !/entidadesHTML/.test(dashboard))

    // 2. No hay una asignacion innerHTML con literal de plantilla en este modulo.
    t.check("no hay innerHTML con template literal", !/innerHTML\s*=\s*[`']/ .test(dashboard))

    // 3. Los nombres de cuenta/activo se escriben por textContent (escapado).
    t.check("nombre por textContent", /textContent = nombre/.test(dashboard))
    t.check("tipo por textContent", /title = tipo/.test(dashboard))

    // 4. Los ids viajan en dataset (no interpolados en atributos HTML).
    t.check("id en dataset.card", /dataset\.card = id/.test(dashboard))

    // 5. No hay innerHTML con template literal en este modulo.
    t.check("no hay innerHTML con template literal", !/innerHTML\s*=\s*[`']/ .test(dashboard))

    // 6. CSP de produccion: script-src ya no permite 'unsafe-inline'.
    t.check("CSP script-src sin 'unsafe-inline'", !/script-src[^;]*'unsafe-inline'/.test(csp))

    // El SDK de Firebase se carga desde gstatic. La CSP real lo permite por host
    // concreto; el test anterior exigía el comodín `https:` y por eso fallaba
    // aunque la política fuera MÁS estricta de lo que pedía.
    const scriptSrc = csp.match(/script-src([^;]*)/)?.[1] || ""
    t.check("CSP script-src permite el SDK de Firebase y no usa comodines",
        scriptSrc.includes("https://www.gstatic.com") && !/(^|\s)(\*|https:)(\s|$)/.test(scriptSrc),
        scriptSrc.trim())

    return t
}
