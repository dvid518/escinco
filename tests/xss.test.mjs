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
    t.check("nombre por textContent", /textContent = e\.nombre/.test(dashboard))
    t.check("tipo por textContent", /textContent = e\.tipo/.test(dashboard))

    // 4. Los ids viajan en dataset (no interpolados en atributos HTML).
    t.check("id en dataset.entidadId", /dataset\.entidadId = e\.id/.test(dashboard))

    // 5. iconoNodo (nodo DOM) en lugar de icono() (string HTML) para el boton.
    t.check("boton usa iconoNodo", /iconoNodo\("plus", 14\)/.test(dashboard))

    // 6. CSP de produccion: script-src ya no permite 'unsafe-inline'.
    t.check("CSP script-src sin 'unsafe-inline'", !/script-src[^;]*'unsafe-inline'/.test(csp))
    t.check("CSP script-src permite https de firebase/gstatic", /script-src 'self' https:/.test(csp))

    return t
}
