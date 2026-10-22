// Test de las reglas contra los emuladores de Firestore + Auth.
// Necesita ambos (npm run test:rules los arranca solo). Si no están escuchando,
// el test se SALTA sin fallar, para que `npm test` siga siendo offline.
//
// A diferencia de `Bearer owner` (que en el emulador es admin y BYPASEA las
// reglas), aquí se crea un usuario real en el emulador de Auth y se usa su
// idToken: así request.auth.uid es de verdad el dueño y las reglas se evalúan.
const PROJECT = process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || "cinco-96064"
const HOST_FS = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080"
const HOST_AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"

const BASE = `http://${HOST_FS}/v1/projects/${PROJECT}/databases/(default)/documents`
const AUTH = `http://${HOST_AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`
const FECHA = "2026-10-08"

// Margen amplio: el emulador de Firestore carga las reglas en el primer
// request y puede tardar bastante más de 3 s en arrancar en frio.
const TIMEOUT_MS = 20000

function encode(v) {
    if (v === null || v === undefined) return { nullValue: null }
    if (typeof v === "boolean") return { booleanValue: v }
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
    if (v instanceof Date) return { timestampValue: v.toISOString() }
    if (typeof v === "string") return { stringValue: v }
    if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } }
    if (typeof v === "object") {
        const fields = {}
        for (const [k, val] of Object.entries(v)) if (val !== undefined) fields[k] = encode(val)
        return { mapValue: { fields } }
    }
    throw new Error("tipo no soportado: " + typeof v)
}

async function alcanzable(url) {
    try { await fetch(url, { signal: AbortSignal.timeout(1000) }); return true } catch { return false }
}

async function registrarUsuario() {
    const res = await fetch(AUTH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `u${Date.now()}${Math.random().toString(36).slice(2)}@t.co`, password: "secreto123", returnSecureToken: true }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!res.ok) throw new Error(`Auth signUp HTTP ${res.status}`)
    const json = await res.json()
    return { uid: json.localId, token: json.idToken }
}

async function pedir(method, url, token, body) {
    const headers = { "Content-Type": "application/json" }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    const texto = await res.text()
    let cuerpo = null
    try { cuerpo = JSON.parse(texto) } catch { cuerpo = texto }
    return { status: res.status, cuerpo }
}

// El cuerpo de `documents.create` es `{ fields: {...} }` con CADA campo codificado
// por separado. Codificar el documento entero lo envolvería en un `mapValue` y el
// emulador respondía 400 "Payload isn't valid for request" en TODAS las peticiones
// —incluidas las que las reglas deberían rechazar—, así que el test era verde por
// el motivo equivocado mientras no había emuladores.
const documento = datos => ({
    fields: Object.fromEntries(
        Object.entries(datos)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, encode(v)])
    )
})

const crear = (token, uid, fecha, datos) =>
    pedir("POST", `${BASE}/usuarios/${uid}/snapshots?documentId=${fecha}`, token, documento(datos))

const actualizar = (token, uid, fecha, datos) =>
    pedir("PATCH", `${BASE}/usuarios/${uid}/snapshots/${fecha}`, token, documento(datos))

const crearEn = (token, uid, col, id, datos) =>
    pedir("POST", `${BASE}/usuarios/${uid}/${col}?documentId=${id}`, token, documento(datos))

const aceptado = r => r.status === 200 || r.status === 201
const denegado = r => r.status === 400 || r.status === 401 || r.status === 403
const motivo = r => `HTTP ${r.status} ${r.cuerpo?.error?.message || ""}`.trim()

export default async function ejecutar(t) {
    if (!(await alcanzable(`http://${HOST_FS}/`)) || !(await alcanzable(`http://${HOST_AUTH}/`))) {
        console.log(`  -- SKIP: emuladores no disponibles (firestore ${HOST_FS}, auth ${HOST_AUTH})`)
        return t
    }

    console.log(`  Emuladores en marcha (proyecto ${PROJECT})`)
    const a = await registrarUsuario()
    const b = await registrarUsuario()

    const valido = { patrimonioPEN: 1500.5, patrimonioUSD: 400.25, cerrado: false, actualizacion: new Date("2026-10-08T12:00:00Z") }

    const r1 = await crear(a.token, a.uid, FECHA, valido)
    t.check("create propio válido es aceptado", aceptado(r1), motivo(r1))

    const r2 = await crear(null, a.uid, "2026-10-09", valido)
    t.check("sin token se rechaza", denegado(r2), motivo(r2))

    const r3 = await crear(a.token, b.uid, "2026-10-09", valido)
    t.check("escribir en la colección de otro se rechaza", denegado(r3), motivo(r3))

    const r4 = await crear(a.token, a.uid, "2026-10-10", { ...valido, campoInventado: 1 })
    t.check("campo extra en create se rechaza (hasOnly)", denegado(r4), motivo(r4))

    const r5 = await crear(a.token, a.uid, "2026-10-11", { ...valido, patrimonioPEN: "mucho" })
    t.check("tipo erróneo en create se rechaza", denegado(r5), motivo(r5))

    const r6 = await actualizar(a.token, a.uid, FECHA, { ...valido, campoLegacy: "antiguo" })
    t.check("update con campo legacy extra se acepta (sin hasOnly)", aceptado(r6), motivo(r6))

    const r7 = await actualizar(a.token, a.uid, FECHA, { ...valido, patrimonioPEN: "mucho" })
    t.check("tipo erróneo en update se rechaza", denegado(r7), motivo(r7))

    // Leer una clave AUSENTE de un mapa en las reglas NO devuelve null: lanza
    // "Property X is undefined on object" y deniega la operación entera. Por eso
    // un campo opcional que el cliente no escribe (ya no manda `patrimonioUSDT`)
    // tiene que validarse con `ifPresente*`, que cortocircuita con `||`.
    const r8 = await crear(a.token, a.uid, "2026-10-12", valido)
    t.check("create SIN patrimonioUSDT se acepta (ya no se escribe)", aceptado(r8), motivo(r8))

    const r9 = await crear(a.token, a.uid, "2026-10-13", { ...valido, patrimonioUSDT: 400.25 })
    t.check("create CON patrimonioUSDT se acepta (documentos legacy)", aceptado(r9), motivo(r9))

    const r10 = await actualizar(a.token, a.uid, "2026-10-13", { ...valido, patrimonioUSD: 999 })
    t.check("update quitando patrimonioUSDT se acepta", aceptado(r10), motivo(r10))

    const r11 = await crear(a.token, a.uid, "2026-10-14", { ...valido, patrimonioUSDT: "mucho" })
    t.check("create con patrimonioUSDT de tipo erróneo se rechaza", denegado(r11), motivo(r11))

    // Desglose del modal de evolución: opcional para los snapshots viejos,
    // numérico y dentro del hasOnly para los nuevos.
    const desglose = {
        ...valido,
        liquidezPEN: 800.25,
        liquidezUSD: 210.5,
        inversionesPEN: 500,
        inversionesUSD: 131.5,
        inmovilPEN: 200,
        inmovilUSD: 52.6,
        deudasPEN: 75,
        deudasUSD: 19.7
    }
    const r12 = await crear(a.token, a.uid, "2026-10-15", desglose)
    t.check("create con desglose por categoría se acepta", aceptado(r12), motivo(r12))

    const r13 = await crear(a.token, a.uid, "2026-10-16", { ...desglose, liquidezPEN: "mucho" })
    t.check("create con liquidezPEN de tipo erróneo se rechaza", denegado(r13), motivo(r13))

    const r14 = await actualizar(a.token, a.uid, "2026-10-15", { ...desglose, inmovilUSD: 99 })
    t.check("update del desglose por categoría se acepta", aceptado(r14), motivo(r14))

    // Mismo defecto en órdenes: `Orden.toFirestore()` nunca escribe `nota`, así
    // que la clave llega ausente y `esTextoONulo(nota)` la hacía explotar. El
    // resto de opcionales (`sl`, `tp`, `tradeId`…) sí se escriben, como null.
    const orden = {
        activo: "AAPL", cuenta: "c1", tipoOrden: "limite", direccion: "largo",
        precioDisparo: 100, lotaje: 2, divisa: "usd", estado: "pendiente",
        sl: null, tp: null, tradeId: null, precioEjecucion: null, fechaEjecucion: null,
        fechaCreacion: new Date("2026-10-08T12:00:00Z")
    }
    const o1 = await crearEn(a.token, a.uid, "ordenes", "o1", orden)
    t.check("ordenes: create SIN nota se acepta (el modelo no la escribe)", aceptado(o1), motivo(o1))

    const o2 = await crearEn(a.token, a.uid, "ordenes", "o2", { ...orden, nota: 42 })
    t.check("ordenes: create con nota numérica se rechaza", denegado(o2), motivo(o2))

    // DEUDA-012: create y update de movimientos validan los MISMOS tipos, así
    // que un campo mal tipado se rechaza en las dos ramas. Antes el create
    // admitía `tarjeta` como número y dejaba un documento sin poder corregirse.
    const mov = {
        tipo: "ingreso", fechaRegistro: new Date("2026-10-08T12:00:00Z"),
        cuenta: "c1", concepto: "sueldo", monto: 10, etiquetas: ["trabajo"]
    }
    const m1 = await crearEn(a.token, a.uid, "movimientos", "m1", mov)
    t.check("movimientos: create válido se acepta", aceptado(m1), motivo(m1))

    const m2 = await crearEn(a.token, a.uid, "movimientos", "m2", { ...mov, tarjeta: 123 })
    t.check("movimientos: create rechaza `tarjeta` numérica (DEUDA-012)", denegado(m2), motivo(m2))

    const m3 = await crearEn(a.token, a.uid, "movimientos", "m3", { ...mov, tarjeta: "visa" })
    t.check("movimientos: create acepta `tarjeta` de texto", aceptado(m3), motivo(m3))

    const m4 = await pedir("PATCH", `${BASE}/usuarios/${a.uid}/movimientos/m1`, a.token, documento({ tarjeta: 123 }))
    t.check("movimientos: update rechaza `tarjeta` numérica (DEUDA-012)", denegado(m4), motivo(m4))

    return t
}
