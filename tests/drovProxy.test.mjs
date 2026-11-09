// Autenticar drovProxy (hallazgo #4).
//
// functions/index.js es CommonJS y requiere firebase-admin (no instalado en este
// entorno), por lo que no se puede importar directamente. Se extraen
// `verificarAutorizacion` y `verificarRateLimit` por texto y se evalúan con
// stubs, siguiendo el patrón de tests/reglas.test.mjs.
//
// Qué se verifica:
//  - Sin cabecera Authorization: Bearer -> null (-> 401 en la función).
//  - Con token valido (admin simulado o JWT con formato) -> uid.
//  - Rate limit por uid: permite hasta el limite y luego rechaza.
import { extraerFuncion, nuevoReporter, leer } from "./helpers.mjs"

const src = leer("functions/index.js")

const verificarAutorizacionSrc = extraerFuncion(src, "verificarAutorizacion")
const verificarRateLimitSrc = extraerFuncion(src, "verificarRateLimit")

function b64url(obj) {
    return Buffer.from(JSON.stringify(obj)).toString("base64url")
}

const verificarAutorizacion = new Function(
    "Buffer",
    `${verificarAutorizacionSrc}\nreturn verificarAutorizacion`
)(Buffer)

const LIMITE_POR_MINUTO = 60
const rateLimit = new Map()
const verificarRateLimit = new Function(
    "LIMITE_POR_MINUTO", "rateLimit",
    `${verificarRateLimitSrc}\nreturn verificarRateLimit`
)(LIMITE_POR_MINUTO, rateLimit)

export default async function ejecutar(t = nuevoReporter("drovProxy")) {
    // 1. Sin cabecera Authorization -> null.
    const reqSinToken = { get: () => undefined, headers: {} }
    t.check("sin Authorization devuelve null",
        await verificarAutorizacion(reqSinToken, null) === null)

    // 2. Cabecera mal formada (sin Bearer) -> null.
    const reqMalFormada = { get: () => "Token-abc", headers: {} }
    t.check("cabecera sin Bearer devuelve null",
        await verificarAutorizacion(reqMalFormada, null) === null)

    // 3. Bearer con token que no es JWT (3 partes) -> null (sin admin).
    const reqJwtInvalido = { get: () => "Bearer no-es-un-jwt", headers: {} }
    t.check("token sin formato JWT devuelve null",
        await verificarAutorizacion(reqJwtInvalido, null) === null)

    // 4. Bearer con JWT con formato y uid -> devuelve el uid (sin admin, best-effort).
    const reqValido = {
        get: () => `Bearer ${b64url({ alg: "none", typ: "JWT" })}.${b64url({ uid: "usuario-1" })}.firmafalsa`,
        headers: {}
    }
    const uid = await verificarAutorizacion(reqValido, null)
    t.check("JWT con formato devuelve su uid", uid === "usuario-1", String(uid))

    // 5. Con admin simulado que verifica el token -> devuelve el uid del decoded.
    const adminSimulado = {
        auth: () => ({
            verifyIdToken: async () => ({ uid: "uid-desde-admin" })
        })
    }
    const uidAdmin = await verificarAutorizacion(
        { get: () => "Bearer cualquier-token", headers: {} },
        adminSimulado
    )
    t.check("admin.verifyIdToken devuelve su uid", uidAdmin === "uid-desde-admin")

    // 6. Rate limit: permite LIMITE_POR_MINUTO peticiones y luego rechaza.
    for (let i = 0; i < LIMITE_POR_MINUTO; i++) {
        t.check(`rate limit permite peticion ${i + 1}`, verificarRateLimit("u-rate") === true)
    }
    t.check("rate limit rechaza al exceder el cupo", verificarRateLimit("u-rate") === false)

    // 7. Otro uid no esta afectado por el rate limit del primero.
    t.check("otro uid tiene su propio cupo", verificarRateLimit("u-otro") === true)

    // 8. La funcion expone verificacion de Authorization y rate limit (codigo fuente).
    t.check("drovProxy exige Authorization", /Authorization/.test(src) && /Bearer/.test(src))
    t.check("drovProxy usa verificarAutorizacion", /verificarAutorizacion\(req, admin\)/.test(src))
    t.check("drovProxy usa verificarRateLimit por uid", /verificarRateLimit\(uid\)/.test(src))

    return t
}
