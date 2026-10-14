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
        body: JSON.stringify({ email: `u${Date.now()}${Math.random().toString(36).slice(2)}@t.co`, password: "secreto123", returnSecureToken: true })
    })
    if (!res.ok) throw new Error(`Auth signUp HTTP ${res.status}`)
    const json = await res.json()
    return { uid: json.localId, token: json.idToken }
}

async function pedir(method, url, token, body) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    try {
        const headers = { "Content-Type": "application/json" }
        if (token) headers.Authorization = `Bearer ${token}`
        const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal })
        return { status: res.status }
    } finally {
        clearTimeout(timer)
    }
}

const crear = (token, uid, fecha, datos) =>
    pedir("POST", `${BASE}/usuarios/${uid}/snapshots?documentId=${fecha}`, token, { fields: encode(datos) })

const actualizar = (token, uid, fecha, datos) =>
    pedir("PATCH", `${BASE}/usuarios/${uid}/snapshots/${fecha}`, token, { fields: encode(datos) })

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
    t.check("create propio válido es aceptado", r1.status === 200 || r1.status === 201, `HTTP ${r1.status}`)

    const r2 = await crear(null, a.uid, "2026-10-09", valido)
    t.check("sin token se rechaza", r2.status === 401 || r2.status === 403, `HTTP ${r2.status}`)

    const r3 = await crear(a.token, b.uid, "2026-10-09", valido)
    t.check("escribir en la colección de otro se rechaza", r3.status === 401 || r3.status === 403, `HTTP ${r3.status}`)

    const r4 = await crear(a.token, a.uid, "2026-10-10", { ...valido, campoInventado: 1 })
    t.check("campo extra en create se rechaza (hasOnly)", r4.status === 400 || r4.status === 403, `HTTP ${r4.status}`)

    const r5 = await crear(a.token, a.uid, "2026-10-11", { ...valido, patrimonioPEN: "mucho" })
    t.check("tipo erróneo en create se rechaza", r5.status === 400 || r5.status === 403, `HTTP ${r5.status}`)

    const r6 = await actualizar(a.token, a.uid, FECHA, { ...valido, campoLegacy: "antiguo" })
    t.check("update con campo legacy extra se acepta (sin hasOnly)", r6.status === 200, `HTTP ${r6.status}`)

    const r7 = await actualizar(a.token, a.uid, FECHA, { ...valido, patrimonioPEN: "mucho" })
    t.check("tipo erróneo en update se rechaza", r7.status === 400 || r7.status === 403, `HTTP ${r7.status}`)

    return t
}
